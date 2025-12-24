import { test, expect } from '@playwright/test';

test('verify metrics drawer', async ({ page }) => {
  // 1. Mobile Viewport
  await page.setViewportSize({ width: 390, height: 844 });

  await page.goto('http://localhost:3000');

  await expect(page.locator('h1').first()).toBeVisible();

  // 2. Enter App
  const startButton = page.getByText('Start Analysis');
  await startButton.click();
  await page.waitForTimeout(1000);

  // 3. Switch to Stocks - Using Icon/Test ID approach since text is hidden on mobile
  // The stocks tab is the 3rd one (index 2).
  // Or find by specific icon class or just use the button with 'Stocks' text, but ensure we don't rely on visibility of the text span.
  // Playwright's getByText checks for visibility by default?
  // Let's use getByRole('button') and filter by content, or use nth-child.

  // Navigation structure:
  // button > span (hidden)
  // button > svg (visible)

  // Let's click the button that *contains* the text 'Stocks', even if the text span is hidden, the button itself is visible.
  // Actually, if the text is hidden, getByText might fail visibility check.
  // Let's find the button by its child icon or order.
  // Stocks is the 3rd tab.
  const stocksTab = page.locator('nav button').nth(2);
  await expect(stocksTab).toBeVisible();
  await stocksTab.click();

  await page.waitForTimeout(2000);

  // 4. Search
  const searchInput = page.getByRole('textbox').first();
  await expect(searchInput).toBeVisible({ timeout: 10000 });
  await searchInput.fill('GOOGL');

  // 5. Select Suggestion to Filter
  const suggestion = page.locator('ul > li').filter({ hasText: 'GOOGL' }).first();
  await expect(suggestion).toBeVisible({ timeout: 10000 });
  await suggestion.click();

  await page.waitForTimeout(2000);

  // 6. Click 'View' button on the card (visible on mobile)
  const viewButton = page.getByRole('button', { name: 'View' }).first();
  await expect(viewButton).toBeVisible({ timeout: 5000 });
  await viewButton.click();

  // 7. Wait for drawer
  const drawer = page.locator('.glass-panel');
  await expect(drawer).toBeVisible({ timeout: 15000 });

  // 8. Check Metrics
  await expect(page.getByText('Key Metrics')).toBeVisible({ timeout: 15000 });
  await expect(page.getByText('Market Cap')).toBeVisible();

  // 9. Screenshot
  await page.screenshot({ path: 'verification/metrics_drawer.png', fullPage: true });
});
