import { chromium } from '@playwright/test';

(async () => {
  const browser = await chromium.launch();
  const page = await browser.newPage();

  try {
    // Navigate to the local server
    await page.goto('http://localhost:3000');

    // Wait for the page to load
    await page.waitForLoadState('networkidle');

    // Click on "Start" to enter the app
    const startButton = page.getByRole('button', { name: /Start/i });
    if (await startButton.isVisible()) {
        await startButton.click();
    }

    // Wait for navigation
    await page.waitForTimeout(2000);

    // Switch to "PORTFOLIO" tab
    await page.getByRole('button', { name: /PORTFOLIO/i }).click();

    // Wait for PortfolioBuilder to load
    await page.waitForSelector('text=Portfolio Builder');

    // Check for StockInfoCard
    // The StockInfoCard has a title "Asset Profile"
    await page.waitForSelector('text=Asset Profile');

    // Check if SPY (default) or top holding is being fetched
    // Since we start with empty portfolio, it should be SPY.
    // StockInfoCard displays "SECTOR" badge
    await page.waitForSelector('text=SECTOR');

    // Take screenshot
    await page.screenshot({ path: 'verification/portfolio_stock_info.png', fullPage: true });

    console.log('Verification successful');

  } catch (error) {
    console.error('Verification failed:', error);
    process.exit(1);
  } finally {
    await browser.close();
  }
})();
