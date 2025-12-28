from playwright.sync_api import sync_playwright, expect
import time

def run(playwright):
    browser = playwright.chromium.launch(headless=True)
    # Set viewport to something reasonable for a desktop view
    context = browser.new_context(viewport={"width": 1280, "height": 1024})
    page = context.new_page()

    # Wait for server to start
    try:
        page.goto("http://localhost:3000", timeout=60000)
    except Exception as e:
        print(f"Failed to load page: {e}")
        browser.close()
        return

    print("Page loaded.")
    time.sleep(2) # Wait for initial animation

    # Check for "Start Analysis" button in Hero
    try:
        # Try finding the button by text
        start_button = page.get_by_text("Start Analysis")
        if start_button.is_visible():
            start_button.click()
            print("Clicked Start Analysis.")
            time.sleep(2) # Wait for transition
        else:
             print("Start Analysis button not visible.")
    except Exception as e:
        print(f"Error finding start button: {e}")

    # Now we should be in the APP view.
    # The default tab is TRENDING. We need to switch to PORTFOLIO.
    # Navigation component should be visible.

    # Try to find "Portfolio" text which should be in the navigation tabs
    # Using a selector that targets the navigation might be safer if text is ambiguous
    # But let's try get_by_text first.

    try:
        portfolio_tab = page.get_by_text("Portfolio", exact=True)
        # Verify it's clickable
        portfolio_tab.click()
        print("Clicked Portfolio Tab.")
        time.sleep(2)
    except Exception as e:
        print(f"Could not click Portfolio tab: {e}")
        # Take screenshot to debug
        page.screenshot(path="verification/debug_navigation.png")

    # Verify we are on portfolio view
    try:
        expect(page.get_by_role("heading", name="Portfolio Builder")).to_be_visible()
        print("Portfolio Builder header found.")
    except Exception as e:
         print(f"Portfolio header not found: {e}")
         page.screenshot(path="verification/debug_portfolio_fail.png")
         browser.close()
         return

    # Scroll to the bottom to find the Algorithm Explainer
    # We use evaluate to scroll to bottom
    page.evaluate("window.scrollTo(0, document.body.scrollHeight)")
    time.sleep(1) # Wait for scroll

    explainer_heading = page.get_by_text("Optimization Algorithm Exposed")

    # It might be in viewport now
    try:
        expect(explainer_heading).to_be_visible()
        print("Explainer header found.")
    except:
        print("Explainer header NOT found.")
        page.screenshot(path="verification/debug_explainer_fail.png")
        browser.close()
        return

    # Scroll specifically to it to ensure it is centered for screenshot
    explainer_heading.scroll_into_view_if_needed()
    time.sleep(0.5)

    # Take a screenshot of the initial state (Objective Function)
    page.screenshot(path="verification/portfolio_explainer_step1.png")
    print("Step 1 screenshot taken.")

    # Click on the second step "Greedy Look-Ahead"
    try:
        # Looking for button inside the steps list
        # "Greedy Look-Ahead" is the title of the step.
        # It is inside a button element.
        step2_button = page.get_by_role("button", name="Greedy Look-Ahead")
        step2_button.click()
        time.sleep(1) # Wait for animation

        page.screenshot(path="verification/portfolio_explainer_step2.png")
        print("Step 2 screenshot taken.")
    except Exception as e:
        print(f"Error clicking step 2: {e}")

    # Click on the third step "Real-World Constraints"
    try:
        step3_button = page.get_by_role("button", name="Real-World Constraints")
        step3_button.click()
        time.sleep(1) # Wait for animation

        page.screenshot(path="verification/portfolio_explainer_step3.png")
        print("Step 3 screenshot taken.")
    except Exception as e:
        print(f"Error clicking step 3: {e}")

    print("Verification completed successfully.")
    browser.close()

with sync_playwright() as playwright:
    run(playwright)
