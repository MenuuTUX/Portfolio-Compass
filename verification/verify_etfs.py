from playwright.sync_api import sync_playwright

def verify_etf_page():
    with sync_playwright() as p:
        browser = p.chromium.launch(headless=True)
        page = browser.new_page()
        try:
            print("Navigating to home page...")
            page.goto("http://localhost:3000", timeout=60000)

            # Click "Start Intelligence" or similar if needed to get to app
            # Based on app/page.tsx, there's a Hero with onStart
            print("Clicking Start...")
            page.click("text=Start Intelligence")

            # Wait for Navigation to appear
            print("Waiting for navigation...")
            page.wait_for_selector("nav", timeout=10000)

            # Click ETFs tab
            print("Clicking ETFs tab...")
            page.click("text=ETFs")

            # Wait for grid to load (ComparisonEngine)
            # The list uses react-window, so we should see items
            print("Waiting for ETF list...")
            page.wait_for_selector(".glass-card", timeout=15000)

            # Take screenshot of the list
            print("Taking screenshot...")
            page.screenshot(path="verification/etfs_page.png")

        except Exception as e:
            print(f"Error: {e}")
            page.screenshot(path="verification/error.png")
        finally:
            browser.close()

if __name__ == "__main__":
    verify_etf_page()
