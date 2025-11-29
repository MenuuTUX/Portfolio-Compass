from playwright.sync_api import sync_playwright

def run():
    with sync_playwright() as p:
        browser = p.chromium.launch(headless=True)
        page = browser.new_page()

        # Navigate to the landing page
        page.goto("http://localhost:3000")

        # Take screenshot of Landing View
        page.screenshot(path="verification/landing.png")
        print("Captured landing.png")

        # Click "Launch Terminal" to enter App View
        page.get_by_role("button", name="Launch Terminal").click()

        # Wait for transition and take screenshot of App View (Portfolio Tab default)
        page.wait_for_timeout(2000) # Wait for animation
        page.screenshot(path="verification/app_portfolio.png")
        print("Captured app_portfolio.png")

        # Click "ETFs" tab
        page.get_by_role("button", name="ETFs").click()
        page.wait_for_timeout(1000)
        page.screenshot(path="verification/app_etfs.png")
        print("Captured app_etfs.png")

        # Click "Growth" tab
        page.get_by_role("button", name="Growth").click()
        page.wait_for_timeout(1000)
        page.screenshot(path="verification/app_growth.png")
        print("Captured app_growth.png")

        browser.close()

if __name__ == "__main__":
    run()
