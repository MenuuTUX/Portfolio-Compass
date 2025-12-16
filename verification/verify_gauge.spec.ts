
import { test, expect } from '@playwright/test';

test('verify fear and greed gauge', async ({ page }) => {
  // Wait for the app to start
  await page.waitForTimeout(2000);

  await page.goto('http://localhost:3000');

  // Click the "Start" button to enter the app
  const startButton = page.locator('button', { hasText: /Start|Launch|Enter/i }).first();
  if (await startButton.isVisible()) {
      await startButton.click();
  }

  // Wait for transition
  await page.waitForTimeout(1000);

  // Verify the gauge is present (Updated text locator)
  const gauge = page.locator('text=Fear & Greed');
  // Since "Fear & Greed" might matches "Fear" rating text, use exact or close
  // Actually "Fear & Greed" is the title.
  await expect(gauge.first()).toBeVisible({ timeout: 10000 });

  // Take a screenshot
  await page.screenshot({ path: 'verification/gauge.png', fullPage: true });
});
