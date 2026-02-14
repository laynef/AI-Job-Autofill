
import pytest
import sys
import os

# Add parent dir to path
sys.path.append(os.path.dirname(os.path.dirname(os.path.abspath(__file__))))

pytestmark = pytest.mark.integration


def test_hero_component_rendering(client):
    """Test that the Hero component renders correctly on the home page"""
    response = client.get("/")
    assert response.status_code == 200
    content = response.text
    
    assert 'class="hero"' in content
    assert 'Stop Wasting Hours on Job Applications' in content
    assert 'Install FREE Now' in content

def test_features_component_rendering(client):
    """Test that the Features section renders correctly"""
    response = client.get("/")
    assert response.status_code == 200
    content = response.text
    
    assert 'id="features"' in content
    assert 'AI-Powered Autofill' in content
    assert 'Smart Cover Letters' in content

def test_pricing_component_rendering(client):
    """Test that the Pricing card renders correctly on purchase page"""
    response = client.get("/purchase")
    assert response.status_code == 200
    content = response.text
    
    assert 'class="pricing-card"' in content
    assert '$9.99' in content
    assert 'paypal-button-container' in content

def test_ad_slideshow_component_integration(client):
    """
    Test that the Ad Slideshow component is integrated into all major pages.
    This serves as a component integration test.
    """
    pages = ["/", "/purchase", "/categories"]
    
    for page in pages:
        response = client.get(page)
        assert response.status_code == 200
        content = response.text
        
        # Check for container ID
        assert 'id="ad-slideshow"' in content, f"Ad container missing on {page}"
        
        # Check for JS inclusion
        assert 'ad-slideshow.js' in content, f"Ad JS missing on {page}"
        
        # Check for CSS inclusion
        assert 'ad-slideshow.css' in content, f"Ad CSS missing on {page}"

def test_contact_component_rendering(client):
    """Test that the Contact section renders correctly"""
    response = client.get("/")
    assert response.status_code == 200
    content = response.text
    
    assert 'id="contact"' in content
    assert 'Contact Us' in content
    assert 'id="contactForm"' in content
    assert 'name="email"' in content
