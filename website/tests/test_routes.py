import pytest

pytestmark = pytest.mark.integration


def test_html_redirects(client):
    response = client.get("/index.html", follow_redirects=False)
    assert response.status_code == 301
    assert response.headers["location"] == "/"

    response = client.get("/purchase.html", follow_redirects=False)
    assert response.status_code == 301
    assert response.headers["location"] == "/purchase"


def test_manifest_and_browserconfig(client):
    response = client.get("/manifest.json")
    assert response.status_code == 200
    assert "application/json" in response.headers["content-type"]

    response = client.get("/browserconfig.xml")
    assert response.status_code == 200
    assert "application/xml" in response.headers["content-type"]


def test_categories_api_pagination(client):
    response = client.get("/api/categories?page=1&limit=12")
    assert response.status_code == 200
    data = response.json()
    assert data["page"] == 1
    assert data["limit"] == 12
    assert data["total"] == 100
    assert len(data["categories"]) == 12
    assert data["has_more"] is True

    response = client.get("/api/categories?page=9&limit=12")
    assert response.status_code == 200
    data = response.json()
    assert data["page"] == 9
    assert data["has_more"] is False
    assert len(data["categories"]) == 4


def test_categories_api_search(client):
    # Test searching for specific category
    response = client.get("/api/categories?search=Category%201&page=1&limit=100")
    assert response.status_code == 200
    data = response.json()
    
    # Should find Category 1, 10, 11, ... 19, 100
    # Category 2 should NOT be in there unless it's 12, 21 etc. but "Category 2" starts with it
    
    # Let's search for something more specific if possible, or just verify filtering works
    # "Category 1" matches "Category 1", "Category 10", "Category 11"... "Category 19", "Category 100"
    # Total count: 1 (itself) + 10 (10-19) + 1 (100) = 12 matches
    
    categories = data["categories"]
    assert len(categories) > 0
    for cat in categories:
        assert "1" in cat["name"]
    
    # Ensure something that shouldn't match isn't there
    names = [c["name"] for c in categories]
    assert "Category 2" not in names  # Exact match "Category 2"
    assert "Category 20" not in names


def test_test_ads_page(client):
    response = client.get("/test-ads.html")
    assert response.status_code == 200
    assert "text/html" in response.headers["content-type"]
