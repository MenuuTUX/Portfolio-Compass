import { chromium } from 'playwright';

(async () => {
  const browser = await chromium.launch({ headless: true });
  const page = await browser.newPage();

  try {
    // Navigate to the app (assuming it's running on port 3001)
    await page.goto('http://localhost:3001');

    // Wait for the ComparisonEngine to load
    await page.waitForSelector('text=Market Engine');

    // Screenshot the initial state
    await page.screenshot({ path: 'verification/initial_state.png' });
    console.log('Initial state screenshot taken.');

    // Find the first "Add" button and click it to trigger the effect
    const addButtons = await page.$$('button:has-text("Add")');
    if (addButtons.length > 0) {
      await addButtons[0].click();
      // Wait a tiny bit for animation to start
      await page.waitForTimeout(100);
      // Take a screenshot during the shake/flash animation
      await page.screenshot({ path: 'verification/add_effect.png' });
      console.log('Add effect screenshot taken.');

      // Wait for it to settle
      await page.waitForTimeout(1000);

      // Now find "Remove" button
      const removeButtons = await page.$$('button:has-text("Remove")');
      if (removeButtons.length > 0) {
          await removeButtons[0].click();
          await page.waitForTimeout(100);
          await page.screenshot({ path: 'verification/remove_effect.png' });
          console.log('Remove effect screenshot taken.');
      }
    } else {
        console.log('No add buttons found, maybe already in portfolio?');
    }

  } catch (error) {
    console.error('Error during verification:', error);
  } finally {
    await browser.close();
  }
})();
