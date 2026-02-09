
import pytest
from fastapi.testclient import TestClient
import sys
import os

# Add parent dir to path to import main
sys.path.append(os.path.dirname(os.path.dirname(os.path.abspath(__file__))))

from main import app

client = TestClient(app)

pytestmark = pytest.mark.build

def test_app_startup():
    """
    Smoke test to verify the application starts up and serves the root page.
    This simulates a basic build verification test.
    """
    response = client.get("/")
    assert response.status_code == 200
    assert "<html" in response.text
    assert "Hired Always" in response.text

def test_static_files_serving():
    """
    Verify static files are served correctly.
    Critical for the build to be considered valid.
    """
    response = client.get("/static/css/styles.css")
    assert response.status_code == 200
    assert "text/css" in response.headers["content-type"]

    response = client.get("/static/js/ad-slideshow.js")
    assert response.status_code == 200
    assert "javascript" in response.headers["content-type"] or "text/javascript" in response.headers["content-type"]

def test_api_health():
    """
    Verify API health endpoint.
    """
    response = client.get("/health")
    assert response.status_code == 200
    assert response.json() == {"status": "healthy"}


def test_templates_exist():
    """
    Build sanity check: required templates should exist for deployment.
    """
    base = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
    templates_dir = os.path.join(base, "templates")
    assert os.path.isdir(templates_dir)

    required_templates = ["index.html", "purchase.html", "categories.html"]
    for template_name in required_templates:
        template_path = os.path.join(templates_dir, template_name)
        assert os.path.exists(template_path), f"Missing template: {template_name}"


def test_static_assets_exist():
    """
    Build sanity check: required static assets should exist for deployment.
    """
    base = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
    static_dir = os.path.join(base, "static")
    assert os.path.isdir(static_dir)

    required_files = [
        "robots.txt",
        "sitemap.xml",
        "manifest.json",
        "browserconfig.xml",
        "css/styles.css",
        "css/ad-slideshow.css",
        "js/ad-slideshow.js",
        "images/social-preview.png",
    ]

    for rel_path in required_files:
        asset_path = os.path.join(static_dir, rel_path)
        assert os.path.exists(asset_path), f"Missing static asset: {rel_path}"
