from playwright.sync_api import sync_playwright

def verify_trending_sections():
    with sync_playwright() as p:
        browser = p.chromium.launch(headless=True)
        page = browser.new_page()

        # Navigate to the home page (where TrendingTab is)
        page.goto("http://localhost:3000")

        # Wait for trending sections to load
        # We look for section titles
        page.wait_for_selector("text=MAG-7", timeout=10000)
        page.wait_for_selector("text=Natural Resources", timeout=10000)

        # Take a screenshot
        page.screenshot(path="verification/trending_sections.png", full_page=True)

        browser.close()

if __name__ == "__main__":
    verify_trending_sections()
