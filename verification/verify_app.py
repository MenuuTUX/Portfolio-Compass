from playwright.sync_api import sync_playwright

def verify_portfolio_compass():
    with sync_playwright() as p:
        browser = p.chromium.launch(headless=True)
        page = browser.new_page()

        # Navigate to the app
        print("Navigating to app...")
        page.goto("http://localhost:3000")

        # Wait for content to load
        print("Waiting for content...")
        page.wait_for_selector('h1', timeout=10000)

        # Verify Hero Text
        print("Verifying Hero...")
        hero_text = page.locator('h1').text_content()
        assert "Institutional Grade" in hero_text

        # Take full page screenshot
        print("Taking screenshot...")
        page.screenshot(path="verification/home.png", full_page=True)

        # Interact: Add ETF to portfolio
        print("Adding ETF...")
        # Wait for cards to load (remove loading skeleton)
        page.wait_for_selector('.glass-card', timeout=10000)

        # Click the first card
        page.locator('.glass-card').first.click()

        # Scroll to builder
        page.locator('#builder').scroll_into_view_if_needed()
        page.wait_for_timeout(1000) # Wait for scroll/render

        page.screenshot(path="verification/builder.png")

        print("Done.")
        browser.close()

if __name__ == "__main__":
    verify_portfolio_compass()
