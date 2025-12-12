from playwright.sync_api import Page, expect, sync_playwright

def verify_sr_only_tables(page: Page):
    # 1. Arrange: Go to the homepage.
    page.goto("http://localhost:3000")

    # Wait for the page to load
    page.wait_for_selector("body", state="visible")

    # Start the app
    try:
        start_btn = page.get_by_role("button", name="Initialize").first
        if not start_btn.is_visible():
             start_btn = page.get_by_role("button", name="Start").first

        if start_btn.is_visible():
            print("Clicking start button")
            start_btn.click()
    except:
        print("Error finding start button")

    page.wait_for_timeout(2000)

    # Go to Growth Tab directly to check for WealthProjector table
    # Use exact=True to avoid matching "PortfolioCompass"
    page.get_by_role("button", name="Growth").click()
    page.wait_for_timeout(2000)

    tables = page.locator("table.sr-only")
    count = tables.count()
    print(f"Found {count} sr-only tables in Growth tab")

    # Modify styles to make them visible for screenshot
    page.add_style_tag(content="""
        .sr-only {
            position: relative !important;
            width: 100% !important;
            height: auto !important;
            clip: auto !important;
            white-space: normal !important;
            overflow: visible !important;
            background: rgba(255, 255, 255, 0.9) !important;
            color: black !important;
            z-index: 9999 !important;
            border: 2px solid red !important;
            padding: 10px !important;
            display: table !important;
            margin-top: 10px !important;
            font-size: 12px !important;
        }
        .sr-only th, .sr-only td {
            border: 1px solid #ccc !important;
            padding: 4px !important;
        }
    """)

    # Take screenshot of Growth tab with visible table
    page.screenshot(path="/home/jules/verification/sr_only_tables_visible.png", full_page=True)

if __name__ == "__main__":
    with sync_playwright() as p:
        browser = p.chromium.launch(headless=True)
        page = browser.new_page()
        try:
            verify_sr_only_tables(page)
        finally:
            browser.close()
