
from playwright.sync_api import sync_playwright

def verify_etf_details_drawer():
    with sync_playwright() as p:
        browser = p.chromium.launch(headless=True)
        # Increase viewport size to simulate desktop for sticky layout check
        page = browser.new_page(viewport={'width': 1280, 'height': 800})

        # 1. Navigate to the app
        print("Navigating to home...")
        page.goto("http://localhost:3000")

        # 2. Click "Start" on Hero if present (ViewMode: LANDING -> APP)
        print("Waiting for Start button...")
        try:
            # Hero button says "Start Analysis"
            page.wait_for_timeout(2000)
            start_button = page.get_by_text("Start Analysis")
            if start_button.is_visible():
                start_button.click()
                print("Clicked Start Analysis")
            else:
                print("Start button not visible, maybe already in App?")
        except Exception as e:
            print("Start button error", e)

        # 3. Wait for Trending tab to load
        # Default tab is Trending. Titles: "Crypto", "MAG-7", "Best", "Discounted"
        print("Waiting for Trending content...")
        try:
            page.wait_for_selector("text=Best", timeout=20000)
            print("Found 'Best' section")
        except Exception as e:
            print("Timeout waiting for 'Best'. Taking screenshot.")
            page.screenshot(path="verification/timeout.png")
            raise e

        # 4. Find an item to view details
        print("Opening details drawer...")

        # We need to hover a card in "Best" section to see the button
        # Locator for cards in "Best" section
        # We can find "Best" heading, then finding sibling grid, then first card?
        # Or just find any element with "View Details" title.

        # Let's force click the first "View Details" button we can find in the DOM.
        # It might be hidden (opacity 0), so force=True is needed.
        view_buttons = page.get_by_title("View Details")

        # Wait for data to populate
        page.wait_for_timeout(2000)

        if view_buttons.count() > 0:
            first_btn = view_buttons.first
            print("Clicking View Details button...")
            first_btn.click(force=True)

            # 5. Wait for Drawer
            print("Waiting for drawer to open...")
            page.wait_for_selector("text=Key Metrics", timeout=10000)

            # 6. Verify Layout CSS classes
            print("Verifying classes...")
            drawer = page.locator(".fixed.bottom-0")

            # Wrapper with scroll/hidden logic
            # We filter for the one with the specific height calculation or the overflow class
            # <div class="p-6 h-[calc(85vh-88px)] overflow-y-auto lg:overflow-hidden">
            wrapper = drawer.locator("div.h-\\[calc\\(85vh-88px\\)\\]")

            wrapper_classes = wrapper.get_attribute("class")
            print(f"Wrapper classes: {wrapper_classes}")

            if "lg:overflow-hidden" in wrapper_classes:
                print("SUCCESS: Wrapper has lg:overflow-hidden")
            else:
                print("FAILURE: Wrapper missing lg:overflow-hidden")

            # Right Column
            # It's inside the grid.
            # Grid has class 'grid'
            grid = wrapper.locator(".grid")
            # Right col is the second child (index 1) on desktop
            # But we can find it by content "Sector Allocation" or "Key Metrics" parent?
            # "Key Metrics" is inside the right column.
            # So find text "Key Metrics" and go up to the column container?
            # Metric grid is inside Right Col -> Metrics Grid Div.
            # Right Col: <div className="flex flex-col gap-6 h-full lg:overflow-y-auto pr-2">

            right_col = grid.locator("> div").nth(1)
            right_col_classes = right_col.get_attribute("class")
            print(f"Right Col classes: {right_col_classes}")

            if "lg:overflow-y-auto" in right_col_classes:
                print("SUCCESS: Right Col has lg:overflow-y-auto")
            else:
                print("FAILURE: Right Col missing lg:overflow-y-auto")

            print("Taking success screenshot...")
            page.screenshot(path="verification/drawer_layout.png", full_page=False)

        else:
            print("No View Details buttons found.")
            page.screenshot(path="verification/no_buttons.png")

        browser.close()

if __name__ == "__main__":
    verify_etf_details_drawer()
