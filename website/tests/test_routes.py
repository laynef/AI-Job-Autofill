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


def test_test_ads_page(client):
    response = client.get("/test-ads.html")
    assert response.status_code == 200
    assert "text/html" in response.headers["content-type"]
