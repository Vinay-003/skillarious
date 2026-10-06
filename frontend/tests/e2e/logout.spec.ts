import { expect, test } from '@playwright/test';

const users = [
  { id: 'fixture-one', name: 'First Student', email: 'first@example.test', verified: true, role: 'student' },
  { id: 'fixture-two', name: 'Second Student', email: 'second@example.test', verified: true, role: 'student' },
];

test('late refresh cannot restore tokens after immediate sign out', async ({ page, context, baseURL, isMobile }) => {
  await context.addCookies([{ name: 'accessToken', value: 'first-access', url: baseURL! }, { name: 'refreshToken', value: 'first-refresh', url: baseURL! }]);
  let release!: () => void;
  const held = new Promise<void>(resolve => { release = resolve; });
  let refreshing = false;
  await page.route('**/api/v1/**', route => route.fulfill({ json: { success: true, data: [] } }));
  await page.route('**/api/v1/auth/validate', route => route.fulfill({ json: { success: true, user: users[0] } }));
  await page.route('**/api/v1/student/likes', route => route.fulfill({ status: 401, json: { success: false } }));
  await page.route('**/api/v1/auth/refreshtoken', async route => { refreshing = true; await held; await route.fulfill({ json: { success: true, accessToken: 'late-access', refreshToken: 'late-refresh' } }); });
  await page.route('**/api/v1/auth/logout', route => route.fulfill({ json: { success: true } }));
  await page.goto('/liked');
  await expect.poll(() => refreshing).toBe(true);
  if (isMobile) await page.getByRole('button', { name: 'Open menu' }).click();
  await page.getByRole('button', { name: 'Sign out' }).click();
  await expect(page).toHaveURL(/\/login$/);
  const response = page.waitForResponse('**/api/v1/auth/refreshtoken');
  release();
  await (await response).finished();
  await page.reload();
  expect((await context.cookies()).some(cookie => ['accessToken', 'refreshToken'].includes(cookie.name))).toBe(false);
  await expect(page.getByRole('link', { name: /Sign in/ }).first()).toBeVisible();
});

test('visiting the logout URL does not revoke a session without confirmation', async ({ page, context, baseURL }) => {
  await context.addCookies([{ name: 'accessToken', value: 'first-access', url: baseURL! }, { name: 'refreshToken', value: 'first-refresh', url: baseURL! }]);
  let revocations = 0;
  await page.route('**/api/v1/**', route => route.fulfill({ json: { success: true, data: [] } }));
  await page.route('**/api/v1/auth/validate', route => route.fulfill({ json: { success: true, user: users[0] } }));
  await page.route('**/api/v1/auth/logout', route => { revocations++; return route.fulfill({ json: { success: true } }); });
  await page.goto('/logout');
  await expect(page.getByRole('heading', { name: 'Sign out' })).toBeVisible();
  await expect(page.getByRole('button', { name: 'Sign out' }).last()).toBeVisible();
  expect(revocations).toBe(0);
  expect((await context.cookies()).find(cookie => cookie.name === 'refreshToken')?.value).toBe('first-refresh');
});

test('sign out works on desktop and mobile during an API outage, preserves unrelated preferences, and allows another account', async ({ page, context, baseURL, isMobile }) => {
  await context.addCookies([
    { name: 'accessToken', value: 'first-access', url: baseURL! },
    { name: 'refreshToken', value: 'first-refresh', url: baseURL! },
    { name: 'unrelatedPreference', value: 'keep', url: baseURL! },
  ]);
  await page.route('**/api/v1/**', route => route.fulfill({ json: { success: true, data: [] } }));
  await page.route('**/api/v1/auth/validate', route => route.fulfill({ json: { success: true, user: users[0] } }));
  await page.route('**/api/v1/auth/logout', route => route.fulfill({ status: 503, json: { success: false } }));
  await page.route('**/api/v1/auth/login', route => route.fulfill({ json: { success: true, accessToken: 'second-access', refreshToken: 'second-refresh' } }));
  await page.goto('/');
  await page.evaluate(() => localStorage.setItem('skillarious-theme', 'dark'));
  if (isMobile) {
    await page.getByRole('button', { name: 'Open menu' }).click();
    await expect(page.getByRole('link', { name: 'Your account' })).toBeVisible();
  } else await expect(page.getByRole('link', { name: /Account/ }).first()).toBeVisible();
  await page.getByRole('button', { name: 'Sign out' }).click();
  await expect(page).toHaveURL(/\/login$/);
  await expect(page.getByRole('link', { name: /Sign in/ }).first()).toBeVisible();
  expect((await context.cookies()).filter(cookie => ['accessToken', 'refreshToken'].includes(cookie.name))).toHaveLength(0);
  expect((await context.cookies()).find(cookie => cookie.name === 'unrelatedPreference')?.value).toBe('keep');
  expect(await page.evaluate(() => localStorage.getItem('skillarious-theme'))).toBe('dark');
  await page.reload();
  await expect(page.getByRole('link', { name: /Sign in/ }).first()).toBeVisible();
  await page.route('**/api/v1/auth/validate', route => route.fulfill({ json: { success: true, user: users[1] } }));
  await page.getByLabel('Email address').fill('second@example.test');
  await page.getByLabel('Password').fill('fixture-password');
  await page.getByRole('button', { name: 'Sign in ↗' }).click();
  await expect(page).toHaveURL(/\/dashboard$/);
  expect((await context.cookies()).find(cookie => cookie.name === 'refreshToken')?.value).toBe('second-refresh');
});

test('sign out survives blocked local storage and late validation', async ({ page, context, baseURL, isMobile }) => {
  await context.addCookies([{ name: 'accessToken', value: 'first-access', url: baseURL! }, { name: 'refreshToken', value: 'first-refresh', url: baseURL! }]);
  await page.addInitScript(() => {
    const remove = Storage.prototype.removeItem;
    Storage.prototype.removeItem = function (key: string) {
      if (key === 'user') throw new DOMException('Blocked', 'SecurityError');
      return remove.call(this, key);
    };
  });
  let validations = 0;
  let release!: () => void;
  const held = new Promise<void>(resolve => { release = resolve; });
  await page.route('**/api/v1/**', route => route.fulfill({ json: { success: true, data: [] } }));
  await page.route('**/api/v1/auth/validate', async route => {
    validations++;
    if (validations > 1) await held;
    await route.fulfill({ json: { success: true, user: users[0] } });
  });
  await page.goto('/');
  if (isMobile) {
    await page.getByRole('button', { name: 'Open menu' }).click();
    await expect(page.getByRole('link', { name: 'Your account' })).toBeVisible();
  } else await expect(page.getByRole('link', { name: /Account/ }).first()).toBeVisible();
  // A second profile request races with sign-out.
  await page.evaluate(() => { void fetch('http://127.0.0.1:4001/api/v1/auth/validate'); });
  await page.getByRole('button', { name: 'Sign out' }).click();
  release();
  await expect(page).toHaveURL(/\/login$/);
  expect((await context.cookies()).some(cookie => cookie.name === 'refreshToken')).toBe(false);
});
