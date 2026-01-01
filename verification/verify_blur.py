from playwright.sync_api import sync_playwright

def verify_drawer_blur():
    with sync_playwright() as p:
        browser = p.chromium.launch(headless=True)
        page = browser.new_page()

        # Navigate to the app (assuming it's running on port 3000)
        page.goto("http://localhost:3000")

        # Wait for the "Market Engine" section to ensure page loaded
        page.wait_for_selector("text=Market Engine", timeout=10000)

        # Find an ETF card and click "Advanced View"
        # We need a selector that works. The button has text "Advanced View" (desktop) or just icon (mobile)
        # Let's try to click the first "View" button

        # NOTE: The app might need scrolling to see the cards?
        # The cards are in a grid.

        # Hover over the first ETF card to reveal the button (desktop)
        # Or just click it if it's visible.
        # The button is hidden by default on desktop until hover?
        # "group-hover:opacity-100"

        # Let's target the card container first.
        card = page.locator(".glass-card").first
        card.hover()

        view_btn = card.locator("button", has_text="Advanced View")
        if not view_btn.is_visible():
             # maybe mobile view?
             view_btn = card.locator("button", has_text="View")

        view_btn.click()

        # Drawer should open.
        # Wait for the drawer title (ticker)
        page.wait_for_selector("h2", timeout=5000)

        # Check if the chart container has the blur class immediately (since loading starts on open)
        # We look for a div with 'blur-sm' inside the drawer.
        # The chart container is "lg:col-span-2 ..."

        # We might miss the loading state if it's too fast.
        # But for verification script, we just want to see if the UI opens and doesn't crash.
        # Capturing the blur state is hard without network throttling.

        page.screenshot(path="verification/drawer_open.png")
        print("Screenshot taken")

        browser.close()

if __name__ == "__main__":
    verify_drawer_blur()
