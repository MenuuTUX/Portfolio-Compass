import { chromium } from '@playwright/test';

(async () => {
  const browser = await chromium.launch();
  const page = await browser.newPage();

  try {
    await page.goto('http://localhost:3000');
    await page.waitForLoadState('networkidle');

    const startButton = page.getByRole('button', { name: /Start/i });
    if (await startButton.isVisible()) {
        await startButton.click();
    }
    await page.waitForTimeout(2000);

    // Go to STOCKS
    await page.getByRole('button', { name: /STOCKS/i }).click();
    await page.waitForTimeout(2000);

    // Try to trigger hover on the card container
    const card = page.locator('.glass-card').first();
    await card.hover();
    await page.waitForTimeout(500); // Wait for transition

    // Click Advanced View
    const advancedViewBtn = page.getByText('Advanced View').first();
    await advancedViewBtn.click({ force: true });

    // Wait for drawer content
    try {
        await page.waitForSelector('text=Price History', { timeout: 5000 });
    } catch (e) {
        // Capture screenshot of failure state
        await page.screenshot({ path: 'verification/debug_drawer_fail.png', fullPage: true });
        throw e;
    }

    // Check for StockInfoCard content
    await page.waitForSelector('text=Asset Profile');
    await page.waitForSelector('text=SECTOR');

    await page.screenshot({ path: 'verification/drawer_stock_info.png', fullPage: true });

    console.log('Verification successful');

  } catch (error) {
    console.error('Verification failed:', error);
    process.exit(1);
  } finally {
    await browser.close();
  }
})();
