import { expect, test } from '@playwright/test';

for (const scenario of [
  { name: 'desktop-light', width: 2025, height: 1200, theme: 'light' },
  { name: 'desktop-dark', width: 2025, height: 1200, theme: 'dark' },
  { name: 'laptop-light', width: 1440, height: 1000, theme: 'light' },
  { name: 'mobile-light', width: 390, height: 844, theme: 'light' },
  { name: 'mobile-dark', width: 390, height: 844, theme: 'dark' },
] as const) {
  test(`marketing ${scenario.name}`, async ({ page }) => {
    await page.setViewportSize({ width: scenario.width, height: scenario.height });
    await page.addInitScript((theme) => localStorage.setItem('intellideploy:theme', theme), scenario.theme);
    await page.goto('/');
    await expect(page).toHaveScreenshot(`${scenario.name}.png`, { fullPage: true, animations: 'disabled' });
  });
}
