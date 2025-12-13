from playwright.sync_api import sync_playwright

def verify_transaction_table():
    with sync_playwright() as p:
        browser = p.chromium.launch(headless=True)
        # Use desktop viewport to see the table columns
        page = browser.new_page(viewport={"width": 1280, "height": 720})

        try:
            print("Navigating to home page...")
            page.goto("http://localhost:3000")

            # Click "Start" to enter the app
            print("Clicking Start...")
            start_button = page.get_by_text("Start Experience")
            if start_button.count() > 0:
                 start_button.click()
            else:
                 # Fallback if text is different
                 page.get_by_role("button", name="Start").click()

            # Wait for navigation
            page.wait_for_timeout(2000)

            # Click "Portfolio" tab. The error says there are multiple buttons.
            # We want the one in the navigation.
            print("Clicking Portfolio tab...")
            # Using exact text match might help or locating within nav
            # nav > button
            page.locator("nav button").filter(has_text="Portfolio").click()

            # Wait for content to load
            page.wait_for_timeout(2000)

            # Click "ETFs" tab
            print("Clicking ETFs tab...")
            page.locator("nav button").filter(has_text="ETFs").click()
            page.wait_for_timeout(2000)

            # Add ETF
            # The previous attempt failed to click add.
            # Let's try finding the "Add" button more loosely.
            # It's inside a button tag.

            # We will grab all buttons on the page and filter by text content

            # Or better, we can assume the initial list has some items (default fetch).
            # We don't need to search if items are there.

            # Wait for grid
            page.wait_for_timeout(2000)

            # Find any button that says "Add" or "Add to Portfolio"
            # Since desktop overlay is hidden, we might need force click or hover.

            # Let's try mobile button first (visible on mobile layout, but we are desktop).
            # On desktop, the mobile actions are hidden (md:hidden).

            # So we must use the desktop button which is hidden until hover.

            # Hover over the first card
            card = page.locator(".glass-card").first
            if card.count() > 0:
                print("Found card, hovering...")
                card.hover()
                page.wait_for_timeout(500)

                # Now click "Add to Portfolio"
                add_btn = page.get_by_text("Add to Portfolio").first
                if add_btn.count() > 0:
                    add_btn.click(force=True)
                    print("Clicked Add to Portfolio")
                else:
                    print("Could not find Add to Portfolio button")
            else:
                print("No cards found")
                # Maybe wait longer?
                page.wait_for_timeout(5000)
                card = page.locator(".glass-card").first
                if card.count() > 0:
                     card.hover()
                     page.get_by_text("Add to Portfolio").first.click(force=True)
                else:
                     print("Still no cards found. Checking console logs for errors.")

            page.wait_for_timeout(1000)

            print("Go back to Portfolio...")
            page.locator("nav button").filter(has_text="Portfolio").click()
            page.wait_for_timeout(2000)

            # Verify table existence
            table = page.locator("table")
            if table.count() > 0:
                print("Table found!")
            else:
                print("Table NOT found!")

            # Verify rows
            # We expect at least one row (the added ETF) + potentially spacers
            rows = page.locator("tbody tr")
            count = rows.count()
            print(f"Number of rows found: {count}")

            # Take screenshot
            print(" taking screenshot...")
            page.screenshot(path="verification/portfolio_table.png")

        except Exception as e:
            print(f"Error: {e}")
            page.screenshot(path="verification/error.png")
        finally:
            browser.close()

if __name__ == "__main__":
    verify_transaction_table()
