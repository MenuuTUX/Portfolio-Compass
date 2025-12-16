
from playwright.sync_api import sync_playwright
import time

def verify_icons():
    with sync_playwright() as p:
        browser = p.chromium.launch(headless=True)
        context = browser.new_context()
        page = context.new_page()

        # Navigate to the home page (wait for server to start)
        try:
            print("Navigating to http://localhost:3000")
            page.goto("http://localhost:3000", timeout=60000)
        except Exception as e:
            print(f"Failed to load page: {e}")
            browser.close()
            return

        # Wait for content to load
        page.wait_for_load_state("networkidle")

        # Click "Start Analysis"
        print("Clicking Start Analysis...")
        try:
            start_button = page.get_by_text("Start Analysis")
            start_button.click()
            time.sleep(2) # Animation wait
        except Exception as e:
            print(f"Failed to click start: {e}")
            page.screenshot(path="verification/failed_start.png")
            browser.close()
            return

        # Wait for trending tab to load
        page.wait_for_load_state("networkidle")
        time.sleep(5) # Give it time to fetch trending items

        # Take a screenshot of the app view
        print("Taking screenshot of app view...")
        page.screenshot(path="verification/app_view.png", full_page=True)

        # Try to find specific icons
        # Look for image tags with src containing nvstly

        images = page.locator("img[src*='nvstly']")
        count = images.count()
        print(f"Found {count} images from nvstly.")

        if count > 0:
            print("Icons found:")
            for i in range(min(count, 10)):
                src = images.nth(i).get_attribute("src")
                alt = images.nth(i).get_attribute("alt")
                print(f" - {alt}: {src}")
        else:
            print("No nvstly icons found. Checking for local logos...")
            local_images = page.locator("img[src*='/logos/']")
            local_count = local_images.count()
            print(f"Found {local_count} local logos.")
            for i in range(min(local_count, 5)):
                src = local_images.nth(i).get_attribute("src")
                print(f" - Local: {src}")

        browser.close()

if __name__ == "__main__":
    verify_icons()
