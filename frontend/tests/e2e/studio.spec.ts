import { test, expect } from '@playwright/test';
test.beforeEach(async ({ page }) => {
  // A deterministic API fixture is UI evidence, not live Supabase evidence.
  await page.route('**/api/v1/courses/all*', route => route.fulfill({ json: { success: true, courses: [] } }));
});
test('landing has one header, theme persists, and no horizontal overflow', async ({ page }, testInfo) => {
  await page.goto('/');
  await expect(page.locator('header.site-header')).toHaveCount(1);
  await expect(page.getByRole('heading', { name: /Make space for/ })).toBeVisible();
  await page.getByRole('button', { name: 'Dark theme', exact: true }).click();
  await expect(page.locator('html')).toHaveClass(/dark/);
  await page.reload(); await expect(page.locator('html')).toHaveClass(/dark/);
  await page.screenshot({ path: `../reports/studio-${testInfo.project.name}-dark.png`, fullPage: true });
  await page.getByRole('button', { name: 'Light theme', exact: true }).click();
  await expect(page.locator('html')).not.toHaveClass(/dark/);
  await expect(page.locator('.studio-button').first()).toHaveCSS('background-color', 'rgb(36, 75, 55)');
  await page.screenshot({ path: `../reports/studio-${testInfo.project.name}-light.png`, fullPage: true });
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth + 1)).toBe(true);
});
test('labeled demo gallery renders in both responsive layouts', async ({ page }, testInfo) => {
  await page.goto('/demo');
  await expect(page.getByRole('heading', { name: 'Picture your next chapter.' })).toBeVisible();
  await expect(page.locator('article')).toHaveCount(3);
  await page.screenshot({ path: `../reports/studio-${testInfo.project.name}-demo.png`, fullPage: true });
});
test('navigation and login have usable controls', async ({ page }, testInfo) => {
  await page.goto('/');
  if (testInfo.project.name === 'mobile') { await page.getByRole('button', { name: 'Open menu' }).click(); await expect(page.getByRole('navigation', { name: 'Mobile navigation' })).toBeVisible(); }
  await page.goto('/login');
  await expect(page.locator('input[type=email]')).toBeVisible();
  await expect(page.locator('input[type=password]')).toBeVisible();
  await expect(page.getByRole('button', { name: /sign in/i })).toBeVisible();
});
test('course discovery shows errors rather than pretending demo data is persisted', async ({ page }) => {
  await page.route('**/api/v1/courses/all*', route => route.fulfill({ status: 503, json: { success: false, message: 'Catalog unavailable' } }));
  await page.goto('/courses');
  await expect(page.locator('.studio-card[role=alert]')).toBeVisible();
  await expect(page.getByRole('heading', { name: /Less scrolling/ })).toBeVisible();
});
