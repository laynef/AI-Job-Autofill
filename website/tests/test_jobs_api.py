import pytest
import types
import api


pytestmark = pytest.mark.integration


class DummyResponse:
    def __init__(self, payload):
        self._payload = payload
        self.status_code = 200

    def json(self):
        return self._payload

    def raise_for_status(self):
        return None


class DummyClient:
    def __init__(self, *args, **kwargs):
        self._response = DummyResponse(
            {
                "results": [
                    {
                        "id": "1",
                        "title": "Software Engineer",
                        "company": "Acme",
                        "location": "Remote",
                        "url": "https://example.com/job/1",
                        "source": "dummy",
                        "remote": True,
                    }
                ]
            }
        )

    async def __aenter__(self):
        return self

    async def __aexit__(self, exc_type, exc, tb):
        return False

    async def get(self, url, params=None, headers=None):
        return self._response


@pytest.mark.anyio
async def test_fetch_jobs_uses_external_api(monkeypatch):
    monkeypatch.setattr(api, "JOB_API_BASE_URL", "https://jobs.example.com")
    monkeypatch.setattr(api, "JOB_API_KEY", "key")
    monkeypatch.setattr(
        api,
        "httpx",
        types.SimpleNamespace(AsyncClient=DummyClient),
    )
    request = api.JobSearchRequest(
        query="engineer",
        location="Remote",
        remote=True,
        limit=5,
    )
    jobs = await api.fetch_jobs(request)
    assert len(jobs) == 1
    job = jobs[0]
    assert job.title == "Software Engineer"
    assert job.company == "Acme"
    assert job.remote is True


def test_search_jobs_endpoint_returns_empty_when_api_disabled(client, monkeypatch):
    monkeypatch.setattr(api, "JOB_API_BASE_URL", "")
    response = client.post(
        "/api/jobs/search",
        json={
            "query": "engineer",
            "location": "Remote",
            "remote": True,
            "limit": 5,
        },
    )
    assert response.status_code == 200
    data = response.json()
    assert data["results"] == []


def test_auto_apply_limits_free_usage_without_license(client, mock_db, monkeypatch):
    monkeypatch.setattr(api, "db", mock_db)
    jobs = [
        {
            "id": "1",
            "title": "Software Engineer",
            "company": "Acme",
            "location": "Remote",
            "url": "https://example.com/job/1",
            "source": "dummy",
            "remote": True,
        },
        {
            "id": "2",
            "title": "Backend Engineer",
            "company": "Acme",
            "location": "Remote",
            "url": "https://example.com/job/2",
            "source": "dummy",
            "remote": True,
        },
        {
            "id": "3",
            "title": "Frontend Engineer",
            "company": "Acme",
            "location": "Remote",
            "url": "https://example.com/job/3",
            "source": "dummy",
            "remote": True,
        },
        {
            "id": "4",
            "title": "DevOps Engineer",
            "company": "Acme",
            "location": "Remote",
            "url": "https://example.com/job/4",
            "source": "dummy",
            "remote": True,
        },
        {
            "id": "5",
            "title": "Data Engineer",
            "company": "Acme",
            "location": "Remote",
            "url": "https://example.com/job/5",
            "source": "dummy",
            "remote": True,
        },
        {
            "id": "6",
            "title": "ML Engineer",
            "company": "Acme",
            "location": "Remote",
            "url": "https://example.com/job/6",
            "source": "dummy",
            "remote": True,
        },
    ]
    response = client.post(
        "/api/jobs/auto-apply",
        json={
            "device_fingerprint": "device-apply-1",
            "jobs": jobs,
            "profile": {
                "full_name": "Test User",
                "email": "test@example.com",
                "resume_url": "https://example.com/resume.pdf",
                "cover_letter": "Hi",
                "location": "Remote",
                "skills": "Python",
            },
        },
    )
    assert response.status_code == 200
    data = response.json()
    assert data["status"] == "upgrade_required"
    assert data["applied_count"] == api.MAX_FREE_AUTO_APPLY
    assert data["queued_count"] == len(jobs) - api.MAX_FREE_AUTO_APPLY
    usage = mock_db.get_usage("device-apply-1")
    assert usage["last_auto_apply_count"] == api.MAX_FREE_AUTO_APPLY


def test_auto_apply_unlimited_with_paid_license(client, mock_db, monkeypatch):
    license_key = "license-123"
    mock_db.create_license(license_key, "user@example.com", plan="unlimited")
    monkeypatch.setattr(api, "db", mock_db)
    jobs = [
        {
            "id": "1",
            "title": "Software Engineer",
            "company": "Acme",
            "location": "Remote",
            "url": "https://example.com/job/1",
            "source": "dummy",
            "remote": True,
        }
    ]
    response = client.post(
        "/api/jobs/auto-apply",
        json={
            "device_fingerprint": "device-apply-2",
            "jobs": jobs,
            "license_key": license_key,
            "profile": {
                "full_name": "Test User",
                "email": "test@example.com",
                "resume_url": "https://example.com/resume.pdf",
            },
        },
    )
    assert response.status_code == 200
    data = response.json()
    assert data["status"] == "ok"
    assert data["applied_count"] == 1
    assert data["queued_count"] == 0
    assert data["unlimited"] is True


def test_has_unlimited_auto_apply_missing_license(monkeypatch, mock_db):
    monkeypatch.setattr(api, "db", mock_db)
    result = api.has_unlimited_auto_apply("missing")
    assert result is False


def test_has_unlimited_auto_apply_inactive_license(monkeypatch, mock_db):
    license_key = "license-inactive"
    mock_db.create_license(license_key, "user@example.com", plan="unlimited")
    mock_db.update_license(license_key, {"active": False})
    monkeypatch.setattr(api, "db", mock_db)
    result = api.has_unlimited_auto_apply(license_key)
    assert result is False
