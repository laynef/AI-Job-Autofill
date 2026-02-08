
import pytest
from fastapi.testclient import TestClient
import sys
import os

# Add parent dir to path to import main
sys.path.append(os.path.dirname(os.path.dirname(os.path.abspath(__file__))))

from main import app

client = TestClient(app)

pytestmark = pytest.mark.build

def test_app_startup():
    """
    Smoke test to verify the application starts up and serves the root page.
    This simulates a basic build verification test.
    """
    response = client.get("/")
    assert response.status_code == 200
    assert "<html" in response.text
    assert "Hired Always" in response.text

def test_static_files_serving():
    """
    Verify static files are served correctly.
    Critical for the build to be considered valid.
    """
    response = client.get("/static/css/styles.css")
    assert response.status_code == 200
    assert "text/css" in response.headers["content-type"]

    response = client.get("/static/js/ad-slideshow.js")
    assert response.status_code == 200
    assert "javascript" in response.headers["content-type"] or "text/javascript" in response.headers["content-type"]

def test_api_health():
    """
    Verify API health endpoint.
    """
    response = client.get("/health")
    assert response.status_code == 200
    assert response.json() == {"status": "healthy"}
