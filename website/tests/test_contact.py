import pytest
import sys
import os

# Add parent dir to path
sys.path.append(os.path.dirname(os.path.dirname(os.path.abspath(__file__))))

pytestmark = pytest.mark.integration


def test_contact_submission_success(client):
    """Test successful contact form submission"""
    payload = {
        "name": "Test User",
        "email": "test@example.com",
        "message": "This is a test message."
    }
    response = client.post("/api/contact", json=payload)
    assert response.status_code == 200
    assert response.json() == {"status": "success", "message": "Message received"}

def test_contact_submission_invalid_email(client):
    """Test contact form with invalid email"""
    payload = {
        "name": "Test User",
        "email": "invalid-email",
        "message": "This is a test message."
    }
    response = client.post("/api/contact", json=payload)
    # Depending on implementation, this might be 422 (Pydantic validation) or 400
    assert response.status_code in [400, 422]

def test_contact_submission_missing_fields(client):
    """Test contact form with missing fields"""
    payload = {
        "name": "Test User"
    }
    response = client.post("/api/contact", json=payload)
    assert response.status_code == 422
