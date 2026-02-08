
import pytest
from fastapi.testclient import TestClient
import xml.etree.ElementTree as ET

pytestmark = pytest.mark.integration

def test_sitemap_structure_and_availability(client):
    # 1. Get sitemap
    response = client.get("/sitemap.xml")
    assert response.status_code == 200
    assert "application/xml" in response.headers["content-type"]
    
    # 2. Parse XML
    root = ET.fromstring(response.text)
    namespace = {'ns': 'http://www.sitemaps.org/schemas/sitemap/0.9'}
    
    urls = []
    for url in root.findall('ns:url', namespace):
        loc = url.find('ns:loc', namespace).text
        urls.append(loc)
        
    # 3. Verify URLs
    assert len(urls) > 0
    
    # Check for specific expected pages
    expected_pages = [
        "https://hiredalways.com/",
        "https://hiredalways.com/purchase",
        "https://hiredalways.com/categories"
    ]
    
    for page in expected_pages:
        assert page in urls
        
    # 4. Verify no authenticated pages (e.g. admin or api endpoints shouldn't be here)
    for url in urls:
        assert "/admin" not in url
        assert "/api" not in url
        # Ensure we don't have the .html duplicates we removed earlier
        assert "index.html" not in url
        assert "purchase.html" not in url

def test_sitemap_urls_are_reachable(client):
    """
    Test that every URL in the sitemap is actually reachable.
    We need to strip the domain and test the path.
    """
    response = client.get("/sitemap.xml")
    root = ET.fromstring(response.text)
    namespace = {'ns': 'http://www.sitemaps.org/schemas/sitemap/0.9'}
    
    for url_elem in root.findall('ns:url', namespace):
        full_url = url_elem.find('ns:loc', namespace).text
        # Extract path from https://hiredalways.com/path
        path = full_url.replace("https://hiredalways.com", "")
        if path == "":
            path = "/"
            
        # Test the page
        page_response = client.get(path)
        
        # Should be 200 OK
        assert page_response.status_code == 200, f"Failed to load {path}"
        assert "text/html" in page_response.headers["content-type"]
