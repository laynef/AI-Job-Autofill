
import pytest
from fastapi.testclient import TestClient
import sys
import os

# Add parent dir to path to import main
sys.path.append(os.path.dirname(os.path.dirname(os.path.abspath(__file__))))

from main import app

client = TestClient(app)

@pytest.mark.integration
def test_dark_mode_toggle_present():
    """Test that the Dark Mode toggle button is rendered in the navbar"""
    response = client.get("/")
    assert response.status_code == 200
    content = response.text
    
    # Check for toggle button existence
    assert 'id="darkModeToggle"' in content
    assert 'aria-label="Toggle dark mode"' in content

@pytest.mark.integration
def test_dark_mode_toggle_present_categories():
    """Test that the Dark Mode toggle button is rendered in the categories page"""
    response = client.get("/categories")
    assert response.status_code == 200
    content = response.text
    
    # Check for toggle button existence
    assert 'id="darkModeToggle"' in content
    assert 'aria-label="Toggle dark mode"' in content
