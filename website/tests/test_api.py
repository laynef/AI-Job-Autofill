
import pytest
from fastapi.testclient import TestClient

def test_validate_license_invalid(client):
    response = client.post("/api/validate-license", json={"license_key": "invalid_key"})
    assert response.status_code == 403
    assert response.json()["detail"] == "Invalid license key"

def test_validate_license_valid(client, mock_db):
    # Setup valid license
    mock_db.data["licenses"]["valid_key"] = {
        "active": True, 
        "user_id": "test@example.com",
        "plan": "unlimited"
    }
    
    response = client.post("/api/validate-license", json={"license_key": "valid_key"})
    assert response.status_code == 200
    data = response.json()
    assert data["valid"] is True
    assert data["plan"] == "unlimited"

def test_generate_cover_letter_no_auth(client):
    response = client.post("/api/generate-cover-letter", json={
        "job_description": "Software Engineer",
        "resume_text": "Experienced developer..."
    })
    # Should fail without license or with invalid license
    assert response.status_code == 403 or response.status_code == 401

# Note: Testing the actual AI generation requires mocking the Gemini API call
# We can mock the 'generate_content' function or the api call wrapper
