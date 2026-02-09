import pytest
from fastapi.testclient import TestClient
import types
import api

pytestmark = pytest.mark.integration


def test_check_usage_returns_unlimited(client):
    response = client.post("/api/check-usage", json={"device_fingerprint": "device-1"})
    assert response.status_code == 200
    data = response.json()
    assert data["valid"] is True
    assert data["is_unlimited"] is True


def test_track_usage_increments(client, mock_db):
    response = client.post("/api/track-usage", json={"device_fingerprint": "device-2"})
    assert response.status_code == 200
    data = response.json()
    assert data["allowed"] is True
    assert data["usage_count"] == 1

    # Second call should increment
    response = client.post("/api/track-usage", json={"device_fingerprint": "device-2"})
    assert response.status_code == 200
    data = response.json()
    assert data["usage_count"] == 2


def test_validate_license_invalid_format(client):
    response = client.post(
        "/api/validate-license",
        json={"license_key": "bad", "device_fingerprint": "device-3"},
    )
    assert response.status_code == 400


def test_validate_license_license_not_found(client):
    response = client.post(
        "/api/validate-license",
        json={"license_key": "HA-SUB-123-abc-xyz", "device_fingerprint": "device-4"},
    )
    assert response.status_code == 400


def test_whitelist_activation_forbidden(client):
    response = client.post(
        "/api/activate-whitelist",
        json={"email": "notallowed@example.com", "device_fingerprint": "device-5"},
    )
    assert response.status_code == 403


def test_whitelist_activation_success(client):
    response = client.post(
        "/api/activate-whitelist",
        json={"email": "laynefaler@gmail.com", "device_fingerprint": "device-6"},
    )
    assert response.status_code == 200
    data = response.json()
    assert data["is_whitelisted"] is True


def test_admin_create_license_unauthorized(client):
    response = client.post("/api/admin/create-license", params={"user_id": "u", "secret_key": "bad"})
    assert response.status_code == 403


def test_admin_create_and_revoke_license(client, monkeypatch):
    monkeypatch.setenv("ADMIN_SECRET", "secret")
    monkeypatch.setattr(api, "LICENSE_SECRET", "testsecret")

    response = client.post("/api/admin/create-license", params={"user_id": "u", "secret_key": "secret"})
    assert response.status_code == 200
    data = response.json()
    assert data["user_id"] == "u"
    assert data["license_key"].startswith("HA-SUB-")

    # Revoke
    response = client.post(
        "/api/admin/revoke-license",
        params={"license_key": data["license_key"], "secret_key": "secret"},
    )
    assert response.status_code == 200


def test_admin_revoke_license_not_found(client, monkeypatch):
    monkeypatch.setenv("ADMIN_SECRET", "secret")
    response = client.post(
        "/api/admin/revoke-license",
        params={"license_key": "missing", "secret_key": "secret"},
    )
    assert response.status_code == 404


def test_create_subscription(client):
    response = client.post(
        "/api/create-subscription",
        json={"email": "test@example.com", "subscription_id": "sub_1", "order_id": "order_1"},
    )
    assert response.status_code == 200
    data = response.json()
    assert data["email"] == "test@example.com"
    assert data["subscription_id"] == "sub_1"


def test_paypal_webhook_processed(client):
    response = client.post("/api/webhook/paypal", json={"event_type": "OTHER"})
    assert response.status_code == 200
    assert response.json()["message"] == "Event processed"


def test_paypal_webhook_activation(client):
    response = client.post(
        "/api/webhook/paypal",
        json={
            "event_type": "BILLING.SUBSCRIPTION.ACTIVATED",
            "resource": {"subscriber": {"email_address": "user@example.com"}, "id": "sub_2"},
        },
    )
    assert response.status_code == 200
    data = response.json()
    assert data["message"] == "Subscription activated"
    assert data["license_key"].startswith("HA-SUB-")


@pytest.mark.unit
def test_validate_license_signature_invalid_format(monkeypatch):
    result = api.validate_license_signature("bad")
    assert result["valid"] is False


@pytest.mark.unit
def test_validate_license_signature_invalid_structure(monkeypatch):
    result = api.validate_license_signature("HA-SUB-1-2")
    assert result["valid"] is False


@pytest.mark.unit
def test_validate_license_signature_inactive_license(monkeypatch, mock_db):
    key = api.generate_license_key("user@example.com")
    mock_db.data["licenses"][key] = {
        "active": False,
        "user_id": "user@example.com",
        "start_date": "2026-01-01T00:00:00",
    }
    monkeypatch.setattr(api, "db", mock_db)

    result = api.validate_license_signature(key)
    assert result["valid"] is False


@pytest.mark.unit
def test_validate_license_signature_expired(monkeypatch, mock_db):
    key = api.generate_license_key("user@example.com")
    mock_db.data["licenses"][key] = {
        "active": True,
        "user_id": "user@example.com",
        "start_date": "2020-01-01T00:00:00",
    }
    monkeypatch.setattr(api, "db", mock_db)

    result = api.validate_license_signature(key)
    assert result["valid"] is False


@pytest.mark.unit
def test_validate_license_signature_license_not_found(monkeypatch, mock_db):
    monkeypatch.setattr(api, "db", mock_db)
    result = api.validate_license_signature("HA-SUB-123-abc-xyz")
    assert result["valid"] is False


@pytest.mark.unit
def test_validate_license_signature_error(monkeypatch, mock_db):
    def bad_get_license(_key):
        raise Exception("boom")

    monkeypatch.setattr(api, "db", mock_db)
    monkeypatch.setattr(mock_db, "get_license", bad_get_license)

    result = api.validate_license_signature("HA-SUB-123-abc-xyz")
    assert result["valid"] is False


@pytest.mark.unit
def test_is_whitelisted_user():
    assert api.is_whitelisted_user("laynefaler@gmail.com") is True
    assert api.is_whitelisted_user("nope@example.com") is False


@pytest.mark.unit
def test_check_whitelist_from_device(monkeypatch, mock_db):
    mock_db.data["usage"]["device-7"] = {"license_key": None, "email": "laynefaler@gmail.com"}
    monkeypatch.setattr(api, "db", mock_db)

    assert api.check_whitelist_from_device("device-7") is True


@pytest.mark.unit
def test_get_user_email_from_license(monkeypatch, mock_db):
    key = "license-1"
    mock_db.data["licenses"][key] = {"user_id": "user@example.com"}
    monkeypatch.setattr(api, "db", mock_db)

    assert api.get_user_email_from_license(key) == "user@example.com"


@pytest.mark.unit
def test_get_user_email_from_license_missing(monkeypatch, mock_db):
    monkeypatch.setattr(api, "db", mock_db)
    assert api.get_user_email_from_license("missing") is None


@pytest.mark.unit
def test_check_whitelist_from_device_with_license(monkeypatch, mock_db):
    key = api.generate_license_key("laynefaler@gmail.com")
    mock_db.data["licenses"][key] = {"user_id": "laynefaler@gmail.com", "active": True, "start_date": "2026-01-01T00:00:00"}
    mock_db.data["usage"]["device-8"] = {"license_key": key, "email": None}
    monkeypatch.setattr(api, "db", mock_db)

    assert api.check_whitelist_from_device("device-8") is True


@pytest.mark.unit
def test_check_whitelist_from_device_false(monkeypatch, mock_db):
    mock_db.data["usage"]["device-9"] = {"license_key": None, "email": "nope@example.com"}
    monkeypatch.setattr(api, "db", mock_db)
    assert api.check_whitelist_from_device("device-9") is False


@pytest.mark.unit
def test_validate_license_signature_valid(monkeypatch, mock_db):
    from datetime import datetime

    key = api.generate_license_key("user@example.com")
    mock_db.data["licenses"][key] = {
        "active": True,
        "user_id": "user@example.com",
        "start_date": datetime.now().isoformat(),
    }
    monkeypatch.setattr(api, "db", mock_db)
    result = api.validate_license_signature(key)
    assert result["valid"] is True


@pytest.mark.unit
def test_check_whitelist_from_device_no_email_no_license(monkeypatch, mock_db):
    mock_db.data["usage"]["device-10"] = {"license_key": None, "email": None}
    monkeypatch.setattr(api, "db", mock_db)
    assert api.check_whitelist_from_device("device-10") is False


@pytest.mark.unit
def test_check_whitelist_from_device_license_not_whitelisted(monkeypatch, mock_db):
    key = api.generate_license_key("nope@example.com")
    mock_db.data["licenses"][key] = {"user_id": "nope@example.com", "active": True, "start_date": "2026-01-01T00:00:00"}
    mock_db.data["usage"]["device-11"] = {"license_key": key, "email": None}
    monkeypatch.setattr(api, "db", mock_db)
    assert api.check_whitelist_from_device("device-11") is False


def test_admin_revoke_license_unauthorized(client):
    response = client.post(
        "/api/admin/revoke-license",
        params={"license_key": "missing", "secret_key": "bad"},
    )
    assert response.status_code == 403


def test_proxy_ai_missing_key(client, monkeypatch):
    monkeypatch.setattr(api, "GEMINI_API_KEY", "")
    response = client.post(
        "/api/proxy-ai",
        json={"prompt": "hi", "device_fingerprint": "dev"},
    )
    assert response.status_code == 500


def test_proxy_ai_success(client, monkeypatch):
    monkeypatch.setattr(api, "GEMINI_API_KEY", "key")

    class FakeResponse:
        status_code = 200
        def json(self):
            return {"ok": True}

    class FakeClient:
        async def __aenter__(self):
            return self

        async def __aexit__(self, exc_type, exc, tb):
            return False

        async def post(self, *args, **kwargs):
            return FakeResponse()

    monkeypatch.setattr(api.httpx, "AsyncClient", lambda: FakeClient())

    response = client.post(
        "/api/proxy-ai",
        json={"prompt": "hi", "device_fingerprint": "dev"},
    )
    assert response.status_code == 200
    assert response.json()["ok"] is True


def test_proxy_ai_error_status(client, monkeypatch):
    monkeypatch.setattr(api, "GEMINI_API_KEY", "key")

    class FakeResponse:
        status_code = 500
        text = "bad"

    class FakeClient:
        async def __aenter__(self):
            return self

        async def __aexit__(self, exc_type, exc, tb):
            return False

        async def post(self, *args, **kwargs):
            return FakeResponse()

    monkeypatch.setattr(api.httpx, "AsyncClient", lambda: FakeClient())

    response = client.post(
        "/api/proxy-ai",
        json={"prompt": "hi", "device_fingerprint": "dev"},
    )
    assert response.status_code == 500


def test_proxy_ai_timeout(client, monkeypatch):
    monkeypatch.setattr(api, "GEMINI_API_KEY", "key")

    class FakeClient:
        async def __aenter__(self):
            return self

        async def __aexit__(self, exc_type, exc, tb):
            return False

        async def post(self, *args, **kwargs):
            raise api.httpx.TimeoutException("timeout")

    monkeypatch.setattr(api.httpx, "AsyncClient", lambda: FakeClient())

    response = client.post(
        "/api/proxy-ai",
        json={"prompt": "hi", "device_fingerprint": "dev"},
    )
    assert response.status_code == 504


def test_proxy_ai_unexpected_error(client, monkeypatch):
    monkeypatch.setattr(api, "GEMINI_API_KEY", "key")

    class FakeClient:
        async def __aenter__(self):
            return self

        async def __aexit__(self, exc_type, exc, tb):
            return False

        async def post(self, *args, **kwargs):
            raise Exception("boom")

    monkeypatch.setattr(api.httpx, "AsyncClient", lambda: FakeClient())

    response = client.post(
        "/api/proxy-ai",
        json={"prompt": "hi", "device_fingerprint": "dev"},
    )
    assert response.status_code == 500
