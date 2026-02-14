import pytest
import sys
import os

# Add parent dir to path
sys.path.append(os.path.dirname(os.path.dirname(os.path.abspath(__file__))))

pytestmark = pytest.mark.integration


def test_testimonials_section_present(client):
    """Test that the testimonials section is rendered on the homepage"""
    response = client.get("/")
    assert response.status_code == 200
    content = response.text
    
    # Check for section ID and key content
    assert 'id="testimonials"' in content
    assert 'What Our Users Say' in content
    
    # Check for sample testimonial content (we expect these to be added)
    assert 'class="testimonial-card"' in content
    
def test_faq_section_present(client):
    """Test that the FAQ section is rendered on the homepage"""
    response = client.get("/")
    assert response.status_code == 200
    content = response.text
    
    # Check for section ID and key content
    assert 'id="faq"' in content
    assert 'Frequently Asked Questions' in content
    
    # Check for accordion structure
    assert 'class="faq-item"' in content
    assert 'class="faq-question"' in content
    assert 'class="faq-answer"' in content

def test_faq_content_relevance(client):
    """Test that the FAQ contains relevant questions"""
    response = client.get("/")
    content = response.text
    
    expected_questions = [
        "Is Hired Always really free?",
        "How does the AI Autofill work?",
        "Is my data secure?",
        "Can I cancel my subscription?"
    ]
    
    for question in expected_questions:
        assert question in content
