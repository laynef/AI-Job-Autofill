
import pytest
from fastapi.testclient import TestClient

def test_index_html_redirect(client):
    response = client.get("/index.html", follow_redirects=False)
    assert response.status_code == 301
    assert response.headers["location"] == "/"

def test_purchase_html_redirect(client):
    response = client.get("/purchase.html", follow_redirects=False)
    assert response.status_code == 301
    assert response.headers["location"] == "/purchase"

def test_sitemap_no_duplicates(client):
    response = client.get("/sitemap.xml")
    assert response.status_code == 200
    content = response.text
    assert "<loc>https://hiredalways.com/index.html</loc>" not in content
    assert "<loc>https://hiredalways.com/purchase.html</loc>" not in content
    assert "<loc>https://hiredalways.com/</loc>" in content
    assert "<loc>https://hiredalways.com/purchase</loc>" in content
