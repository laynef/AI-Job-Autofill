import pytest
import sys
import os

# Add parent dir to path
sys.path.append(os.path.dirname(os.path.dirname(os.path.abspath(__file__))))

pytestmark = pytest.mark.integration


def test_back_to_top_button_present_home(client):
    """Test that the Back to Top button is rendered on the homepage"""
    response = client.get("/")
    assert response.status_code == 200
    content = response.text
    
    # Check for button ID
    assert 'id="back-to-top"' in content
    # Check for button accessibility label
    assert 'aria-label="Back to top"' in content

def test_back_to_top_button_present_categories(client):
    """Test that the Back to Top button is rendered on the categories page"""
    response = client.get("/categories")
    assert response.status_code == 200
    content = response.text
    
    # Check for button ID
    assert 'id="back-to-top"' in content

def test_category_search_present(client):
    """Test that the Category Search input is rendered on the categories page"""
    response = client.get("/categories")
    assert response.status_code == 200
    content = response.text
    
    # Check for search input
    assert 'id="category-search"' in content
    assert 'placeholder="Search categories..."' in content
