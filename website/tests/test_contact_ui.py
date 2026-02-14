import pytest
import sys
import os

# Add parent dir to path to import main
sys.path.append(os.path.dirname(os.path.dirname(os.path.abspath(__file__))))

pytestmark = pytest.mark.integration


def test_contact_section_present(client):
    """Test that the Contact section is rendered on the home page"""
    response = client.get("/")
    assert response.status_code == 200
    content = response.text
    # Check for section existence
    assert 'id="contact"' in content
    assert 'Contact Us' in content

@pytest.mark.integration
def test_contact_form_elements_present(client):
    """Test that the Contact form elements are rendered"""
    response = client.get("/")
    assert response.status_code == 200
    content = response.text
    
    # Check for form inputs
    assert 'name="name"' in content
    assert 'name="email"' in content
    assert 'name="message"' in content
    assert 'type="submit"' in content
