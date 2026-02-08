import pytest

pytestmark = pytest.mark.integration


def _assert_meta_present(content: str, needle: str):
    assert needle in content, f"Missing meta tag: {needle}"


def test_home_page_meta_tags(client):
    response = client.get("/")
    assert response.status_code == 200
    content = response.text

    _assert_meta_present(content, '<meta name="description"')
    _assert_meta_present(content, '<link rel="canonical" href="https://hiredalways.com/"')
    _assert_meta_present(content, '<meta property="og:image" content="https://hiredalways.com/static/images/social-preview.png"')
    _assert_meta_present(content, '<meta name="twitter:image" content="https://hiredalways.com/static/images/social-preview.png"')


def test_purchase_page_meta_tags(client):
    response = client.get("/purchase")
    assert response.status_code == 200
    content = response.text

    _assert_meta_present(content, '<meta name="description"')
    _assert_meta_present(content, '<meta name="robots" content="index, follow"')
    _assert_meta_present(content, '<link rel="canonical" href="https://hiredalways.com/purchase"')
    _assert_meta_present(content, '<meta property="og:image" content="https://hiredalways.com/static/images/social-preview.png"')
    _assert_meta_present(content, '<meta name="twitter:image" content="https://hiredalways.com/static/images/social-preview.png"')


def test_categories_page_meta_tags(client):
    response = client.get("/categories")
    assert response.status_code == 200
    content = response.text

    _assert_meta_present(content, '<meta name="description"')
    _assert_meta_present(content, '<meta name="robots" content="index, follow"')
    _assert_meta_present(content, '<link rel="canonical" href="https://hiredalways.com/categories"')
    _assert_meta_present(content, '<meta property="og:image" content="https://hiredalways.com/static/images/social-preview.png"')
    _assert_meta_present(content, '<meta name="twitter:image" content="https://hiredalways.com/static/images/social-preview.png"')
