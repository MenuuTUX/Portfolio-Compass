
from playwright.sync_api import sync_playwright

def verify_icons():
    with sync_playwright() as p:
        browser = p.chromium.launch(headless=True)
        page = browser.new_page()
        try:
            print("Navigating to homepage...")
            page.goto("http://localhost:3000")

            # Wait for content to load
            print("Waiting for ETF cards...")
            page.wait_for_selector(".glass-card", timeout=10000)

            # Take a screenshot of the main page with cards
            print("Taking main page screenshot...")
            page.screenshot(path="verification/etf_icons_main.png")

            # Click "Advanced View" on the first card to open the drawer
            # We need to hover first or just click if visible
            # In mobile view it's always visible, desktop it's on hover.
            # Let's force mobile view or just try to click the button.

            # Let's try to search for "Vanguard" to ensure we see a card with a logo
            print("Searching for Vanguard...")
            search_input = page.get_by_placeholder("Search ticker or name...")
            search_input.fill("Vanguard")

            # Wait for results
            page.wait_for_timeout(2000) # Give it time to debounce and fetch

            print("Taking screenshot of search results...")
            page.screenshot(path="verification/etf_icons_search.png")

            # Now click view on first result
            # The button text is "View" (mobile) or "Advanced View" (desktop)
            # Let's target the button by text
            print("Opening Advanced View...")
            # We might need to hover if desktop
            page.hover(".glass-card")
            page.get_by_role("button", name="Advanced View").first.click()

            # Wait for drawer
            print("Waiting for drawer...")
            page.wait_for_selector("text=Price History", timeout=5000)

            # Take screenshot of drawer
            print("Taking drawer screenshot...")
            page.screenshot(path="verification/etf_icons_drawer.png")

        except Exception as e:
            print(f"Error: {e}")
            page.screenshot(path="verification/error.png")
        finally:
            browser.close()

if __name__ == "__main__":
    verify_icons()
