from playwright.sync_api import sync_playwright, expect
import time
import re

def verify_features(page):
    # Desktop viewport
    page.set_viewport_size({"width": 1280, "height": 800})

    print("Navigating to home page...")
    page.goto("http://localhost:3000")
    page.wait_for_load_state("networkidle")

    # Start App
    print("Waiting for start button...")
    try:
        start_btn = page.get_by_role("button", name="Start Analysis").first
        if not start_btn.is_visible():
             start_btn = page.get_by_text("Start Analysis").first

        if start_btn.is_visible():
            start_btn.click(force=True)
            print("Clicked Start Analysis")
        else:
            print("Start button not found, assuming already in app")
    except Exception as e:
        print(f"Start button interaction failed: {e}")

    # 1. Verify Trending Page "Load More"
    print("Waiting for Trending page content...")
    try:
        # Wait for "Best" section title
        page.get_by_text("Best", exact=True).wait_for(timeout=20000)
        print("Trending page loaded")

        # Scroll to bottom
        page.evaluate("window.scrollTo(0, document.body.scrollHeight)")
        page.wait_for_timeout(2000)

        # Check for Load More buttons
        # TrendingSection uses "Load More" button text
        load_more_btns = page.get_by_role("button", name="Load More").all()
        print(f"Found {len(load_more_btns)} Load More buttons in Trending")

        if len(load_more_btns) > 0:
             load_more_btns[0].click()
             print("Clicked a Load More button")
             page.wait_for_timeout(2000)

        page.screenshot(path="verification/trending_page.png", full_page=True)

    except Exception as e:
        print(f"Trending verification failed: {e}")
        page.screenshot(path="verification/error_trending.png")

    # 2. Verify ETF Tab Load More
    print("Navigating to ETFs tab...")
    try:
        page.get_by_text("ETFs").click()
        page.wait_for_timeout(2000)

        # Wait for list to load
        page.get_by_text("Market Engine").wait_for()
        page.wait_for_timeout(2000) # Initial fetch

        # Check for Load More button at bottom
        # It might be below the fold, need to scroll or just check visibility
        # The list is virtualized but the load more button is static below it
        load_more_etf = page.get_by_role("button", name="Load More").last

        if load_more_etf.is_visible():
            print("ETF Load More button visible")
            load_more_etf.click()
            print("Clicked ETF Load More")
            page.wait_for_timeout(2000)
        else:
             print("ETF Load More button NOT visible (maybe < 20 items)")

        page.screenshot(path="verification/etf_tab.png", full_page=True)

    except Exception as e:
        print(f"ETF tab verification failed: {e}")
        page.screenshot(path="verification/error_etf.png")

    # 3. Verify Comparison Risk
    print("Verifying Comparison Risk...")
    try:
        # We need to find a card to open. In ETF tab, cards are ComparisonCard.
        # Structure: div class="glass-card" ...
        # Use a more generic selector if glass-card fails
        cards = page.locator(".glass-card").all()
        if not cards:
             # Try finding by text "View" or "Advanced View"
             print("Glass card class not found, trying buttons")
             # This might just be because I didn't wait enough or selectors changed?
             # I used glass-card in ComparisonEngine.tsx
             pass

        if len(cards) > 0:
            first_card = cards[0]
            first_card.hover()
            page.wait_for_timeout(500)

            # Click View
            view_btn = first_card.locator("button", has_text="View").first # Matches "View" and "Advanced View"
            if view_btn.is_visible():
                view_btn.click()
                print("Clicked View")
                page.wait_for_timeout(2000)

                # Check Risk
                # Look for text "Low Risk", "Medium Risk", "High Risk", "Very High Risk"
                risk_locator = page.get_by_text(re.compile(r"(Low|Medium|High|Very High|Safe|Very Safe) Risk|Neutral"))
                if risk_locator.count() > 0:
                     print(f"Found Risk Label: {risk_locator.first.inner_text()}")
                else:
                     print("Risk Label NOT found initially")

                # Toggle Comparison
                toggle = page.locator(".w-8.h-4.rounded-full")
                if toggle.is_visible():
                    toggle.click()
                    print("Toggled vs SPY")
                    page.wait_for_timeout(2000)

                    # Check Risk Again
                    if risk_locator.count() > 0:
                         print(f"Found Risk Label after toggle: {risk_locator.first.inner_text()}")
                    else:
                         print("Risk Label NOT found after toggle (FAILURE)")
                else:
                    print("Comparison toggle not found")

                page.screenshot(path="verification/drawer_comparison.png")

                # Close drawer
                # Just click close button if needed, but not required for verification
            else:
                print("View button not visible")
        else:
            print("No cards found in ETF tab")

    except Exception as e:
        print(f"Comparison verification failed: {e}")
        page.screenshot(path="verification/error_comparison.png")

if __name__ == "__main__":
    with sync_playwright() as p:
        browser = p.chromium.launch(headless=True)
        page = browser.new_page()
        try:
            verify_features(page)
        except Exception as e:
            print(f"Global error: {e}")
        finally:
            browser.close()
