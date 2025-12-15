
import { test, expect } from '@playwright/test';

test('verify fear and greed gauge', async ({ page }) => {
  // Wait for the app to start
  await page.waitForTimeout(2000);

  await page.goto('http://localhost:3000');

  // Click the "Start" button to enter the app
  // I need to find the start button. Based on Hero.tsx (assumed), it should be a button.
  // I'll try to find a button with text "Start" or "Enter" or similar.
  const startButton = page.locator('button', { hasText: /Start|Launch|Enter/i }).first();
  if (await startButton.isVisible()) {
      await startButton.click();
  } else {
      console.log('Start button not found, assuming already in app or different text');
      // Dump page text if failed
      // const text = await page.innerText('body');
      // console.log(text);
  }

  // Wait for transition
  await page.waitForTimeout(1000);

  // Verify the gauge is present
  const gauge = page.locator('text=Fear & Greed Index');
  await expect(gauge).toBeVisible({ timeout: 10000 });

  // Take a screenshot
  await page.screenshot({ path: 'verification/gauge.png', fullPage: true });
});
