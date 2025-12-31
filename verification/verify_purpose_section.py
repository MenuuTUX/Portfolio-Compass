from playwright.sync_api import sync_playwright

def verify_landing_page():
    with sync_playwright() as p:
        # Launch with a specific viewport size to ensure elements are "in view"
        browser = p.chromium.launch(headless=True)
        context = browser.new_context(viewport={'width': 1920, 'height': 3000})
        page = context.new_page()

        print("Navigating to localhost:3000...")
        page.goto("http://localhost:3000")

        # Wait for the network to be idle (assets loaded)
        page.wait_for_load_state("networkidle")

        print("Waiting for 'Concrete Jungle' text...")
        try:
            # Wait for the specific text from PurposeSection
            # We use a long timeout because of potential animation delays
            page.wait_for_selector("text=Concrete Jungle", state="visible", timeout=30000)
            print("Found text!")
        except Exception as e:
            print(f"Text not found: {e}")
            # Even if text isn't found (maybe due to animation opacity), we take a screenshot

        # Scroll to ensure everything is rendered
        page.evaluate("window.scrollTo(0, 1000)")
        page.wait_for_timeout(2000)

        print("Taking screenshot...")
        page.screenshot(path="verification/landing_page_verification.png", full_page=True)

        browser.close()

if __name__ == "__main__":
    verify_landing_page()
