import pytest
from fastapi.testclient import TestClient
import api

pytestmark = pytest.mark.integration


def test_validate_license_invalid(client):
    response = client.post(
        "/api/validate-license",
        json={"license_key": "invalid_key", "device_fingerprint": "test_device_id"},
    )
    # The API returns 400 for invalid format/signature
    assert response.status_code == 400
    assert (
        "reason" in response.json()["detail"] or "Invalid" in response.json()["detail"]
    )


def test_validate_license_valid(client, mock_db):
    # Generate a valid key using the api function
    valid_key = api.generate_license_key("test@example.com")

    # Setup valid license in DB
    mock_db.data["licenses"][valid_key] = {
        "active": True,
        "user_id": "test@example.com",
        "start_date": "2025-01-01T00:00:00",  # Ensure it's not expired (mock date needed or handled below)
        "plan": "unlimited",
    }

    # We need to make sure the key isn't expired.
    # generate_license_key uses current time.
    # The validate function checks if now > start_date + 31 days.
    # We set start_date to a fixed past date, but if we generated the key just now, the timestamp in the key is NOW.
    # The validation logic extracts timestamp from key only for signature verification?
    # No, it looks up the key in DB and uses 'start_date' from DB to check expiry.
    # So if we set start_date to "2025-01-01", and today is 2026-02-07 (from env), it will be expired.
    # We should set start_date to today.
    from datetime import datetime

    mock_db.data["licenses"][valid_key]["start_date"] = datetime.now().isoformat()

    response = client.post(
        "/api/validate-license",
        json={"license_key": valid_key, "device_fingerprint": "test_device_id"},
    )
    assert response.status_code == 200
    data = response.json()
    assert data["valid"] is True
    assert data["user_id"] == "test@example.com"


# Removed test_generate_cover_letter_no_auth as the endpoint does not exist

# Note: Testing the actual AI generation requires mocking the Gemini API call
# We can mock the 'generate_content' function or the api call wrapper
