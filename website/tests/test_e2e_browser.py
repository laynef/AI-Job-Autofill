import os
import pytest

playwright = pytest.importorskip("playwright.sync_api")
Page = playwright.Page
expect = playwright.expect

pytestmark = [pytest.mark.e2e, pytest.mark.integration]


def _base_url() -> str:
    return os.environ.get("E2E_BASE_URL", "http://localhost:8080")

def _e2e_enabled() -> bool:
    return os.environ.get("RUN_E2E") == "1"


def test_home_page_flow(page: Page):
    if not _e2e_enabled():
        pytest.skip("Browser E2E not enabled. Set RUN_E2E=1 and E2E_BASE_URL to run.")
    page.goto(_base_url() + "/", wait_until="domcontentloaded")

    expect(page).to_have_title("Hired Always - AI-Powered Job Application Autofill | Land Your Dream Job Faster")
    expect(page.locator("nav .logo")).to_contain_text("Hired Always")

    # CTA should be visible
    expect(page.get_by_role("link", name="Install FREE Now")).to_be_visible()

    # Ad slideshow container should exist
    expect(page.locator("#ad-slideshow")).to_be_visible()


def test_nav_links_flow(page: Page):
    if not _e2e_enabled():
        pytest.skip("Browser E2E not enabled. Set RUN_E2E=1 and E2E_BASE_URL to run.")
    page.goto(_base_url() + "/", wait_until="domcontentloaded")

    page.get_by_role("link", name="Job Categories").click()
    expect(page).to_have_url(_base_url() + "/categories")
    expect(page.locator(".categories-grid")).to_be_visible()

    page.get_by_role("link", name="Pricing").click()
    expect(page).to_have_url(_base_url() + "/purchase")
    expect(page.locator(".pricing-card")).to_be_visible()


def test_categories_infinite_scroll_flow(page: Page):
    if not _e2e_enabled():
        pytest.skip("Browser E2E not enabled. Set RUN_E2E=1 and E2E_BASE_URL to run.")
    page.goto(_base_url() + "/categories", wait_until="domcontentloaded")

    grid = page.locator("#categories-container")
    expect(grid).to_be_visible()

    # Wait for at least first batch of cards
    page.wait_for_timeout(1500)
    initial_count = grid.locator(".category-card").count()
    assert initial_count > 0

    # Scroll to trigger next page
    page.evaluate("window.scrollTo(0, document.body.scrollHeight)")
    page.wait_for_timeout(1500)

    next_count = grid.locator(".category-card").count()
    assert next_count >= initial_count


def test_purchase_page_flow(page: Page):
    if not _e2e_enabled():
        pytest.skip("Browser E2E not enabled. Set RUN_E2E=1 and E2E_BASE_URL to run.")
    page.goto(_base_url() + "/purchase", wait_until="domcontentloaded")

    expect(page.locator(".pricing-card")).to_be_visible()
    expect(page.locator("#paypal-button-container")).to_be_visible()
