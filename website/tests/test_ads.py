import pytest
from fastapi.testclient import TestClient


def test_ads_on_home_page(client):
    response = client.get("/")
    assert response.status_code == 200
    content = response.text

    # Check for container
    assert 'id="ad-slideshow"' in content

    # Check for CSS and JS
    assert "ad-slideshow.css" in content
    assert "ad-slideshow.js" in content


def test_ads_on_purchase_page(client):
    response = client.get("/purchase")
    assert response.status_code == 200
    content = response.text

    assert 'id="ad-slideshow"' in content
    assert "ad-slideshow.css" in content
    assert "ad-slideshow.js" in content


def test_ads_on_categories_page(client):
    response = client.get("/categories")
    assert response.status_code == 200
    content = response.text

    assert 'id="ad-slideshow"' in content
    assert "ad-slideshow.css" in content
    assert "ad-slideshow.js" in content
