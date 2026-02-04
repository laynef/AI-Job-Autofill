
import pytest
from fastapi.testclient import TestClient

def test_read_root(client):
    response = client.get("/")
    assert response.status_code == 200
    assert "text/html" in response.headers["content-type"]
    assert "Hired Always" in response.text

def test_read_purchase(client):
    response = client.get("/purchase")
    assert response.status_code == 200
    assert "text/html" in response.headers["content-type"]
    assert "Upgrade" in response.text

def test_read_sitemap(client):
    response = client.get("/sitemap.xml")
    assert response.status_code == 200
    assert "application/xml" in response.headers["content-type"]
    assert "<urlset" in response.text

def test_robots_txt(client):
    response = client.get("/robots.txt")
    assert response.status_code == 200
    assert "User-agent: *" in response.text
