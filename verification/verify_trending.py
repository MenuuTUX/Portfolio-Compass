from playwright.sync_api import Page, expect, sync_playwright

def verify_trending_cards(page: Page):
    # 1. Arrange: Go to the app
    page.goto("http://localhost:3000")

    # 2. Act: Click "Start" to enter the app
    page.get_by_text("Start").click()

    # Wait for the trending tab to load
    page.wait_for_selector("text=Best")

    # 3. Assert: Check for sparklines
    # Look for the sparkline container or the SVG/canvas
    # The sparkline renders a ResponsiveContainer which renders a div class 'recharts-wrapper'
    # and we added a table with caption "Price History Sparkline" for a11y.

    # Wait for data to load
    page.wait_for_timeout(3000)

    # Check if we have sparklines in the cards
    # We can check for the caption we added
    expect(page.locator("caption:text('Price History Sparkline')").first).to_be_attached()

    # Take a screenshot of the trending section
    page.screenshot(path="/home/jules/verification/trending_with_sparklines.png")

if __name__ == "__main__":
    with sync_playwright() as p:
        browser = p.chromium.launch(headless=True)
        page = browser.new_page()
        try:
            verify_trending_cards(page)
        finally:
            browser.close()
