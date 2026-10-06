import { expect, test } from '@playwright/test';

const student = { id: 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa', name: 'Fixture Student', email: 'student@example.test', verified: true, isAdmin: false, isEducator: false, role: 'student' };
const courseId = 'cccccccc-cccc-4ccc-8ccc-cccccccccccc';
const course = { id: courseId, name: 'Fixture Python', description: 'Programming fundamentals', about: 'Functions and variables', price: '19.00', educatorId: 'bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb', educatorName: 'Fixture Teacher', thumbnail: '/placeholder-course.jpg' };
test.beforeEach(async ({ page }) => {
  // Catch every external API request. These are deterministic UI contracts,
  // never live SMTP, database or provider verification.
  await page.route('**/api/v1/**', route => route.fulfill({ json: { success: true, data: [], courses: [] } }));
});

for (const smtpFails of [false, true]) {
  test(`signup reaches recoverable verification when SMTP ${smtpFails ? 'fails' : 'succeeds'}`, async ({ page }) => {
    await page.route('**/api/v1/auth/signup', async route => {
      const body = route.request().postDataJSON();
      expect(body.email.toLowerCase()).toBe('student@example.test');
      await route.fulfill({ status: smtpFails ? 503 : 200, json: { success: !smtpFails, requiresVerification: true, message: smtpFails ? 'Verification email unavailable' : 'Verification code sent', user: { email: 'student@example.test' } } });
    });
    await page.goto('/signup');
    await page.getByLabel('Full name').fill('Fixture Student');
    await page.getByLabel('Email address').fill('student@example.test');
    await page.getByLabel('Password', { exact: true }).fill('Test-only-strong-pass');
    await page.getByRole('button', { name: 'Create account ↗', exact: true }).click();
    await expect(page).toHaveURL(/\/verify-email\?email=student%40example.test/);
    await expect(page.getByLabel('OTP digit 1')).toBeVisible();
    let resends = 0;
    await page.route('**/api/v1/otp/generate', async route => { resends++; await route.fulfill({ json: { success: true, message: 'Code sent' } }); });
    await page.getByRole('button', { name: 'Resend code', exact: true }).click();
    await expect(page.getByRole('button', { name: /Resend in/ })).toBeDisabled();
    expect(resends).toBe(1);
  });
}

test('unverified password login routes to email verification', async ({ page }) => {
  await page.route('**/api/v1/auth/login', route => route.fulfill({ status: 403, json: { success: false, requiresVerification: true, message: 'Verify your email' } }));
  await page.goto('/login'); await page.getByLabel('Email address').fill('student@example.test'); await page.getByLabel('Password').fill('Test-only-strong-pass'); await page.getByRole('button', { name: 'Sign in ↗', exact: true }).click();
  await expect(page).toHaveURL(/\/verify-email\?email=student%40example.test/);
});

test('valid verification updates the signed-in profile before entering the dashboard', async ({ page }) => {
  await page.route('**/api/v1/otp/verify', route => route.fulfill({ json: { success: true, message: 'Verified', accessToken: 'fixture-access', refreshToken: 'fixture-refresh' } }));
  await page.route('**/api/v1/auth/validate', route => route.fulfill({ json: { success: true, user: student } }));
  await page.goto('/verify-email?email=student%40example.test');
  for (let digit = 1; digit <= 6; digit++) await page.getByLabel(`OTP digit ${digit}`, { exact: true }).fill(String(digit));
  await page.getByRole('button', { name: 'Verify Email', exact: true }).click();
  await expect(page).toHaveURL(/\/dashboard$/);
  await expect(page.getByRole('heading', { name: 'Welcome back, Fixture.' })).toBeVisible();
});

test('optional registration storage failure cannot invalidate a successful OTP', async ({ page, context }) => {
  await page.addInitScript(() => {
    const getItem = Storage.prototype.getItem;
    Storage.prototype.getItem = function (key: string) {
      if (key === 'pendingEducatorRegistration') throw new DOMException('Storage blocked', 'SecurityError');
      return getItem.call(this, key);
    };
  });
  let verifications = 0;
  await page.route('**/api/v1/otp/verify', route => { verifications++; return route.fulfill({ json: { success: true, message: 'Verified', accessToken: 'fixture-access', refreshToken: 'fixture-refresh' } }); });
  await page.route('**/api/v1/auth/validate', route => route.fulfill({ json: { success: true, user: student } }));
  await page.goto('/verify-email?email=student%40example.test');
  for (let digit = 1; digit <= 6; digit++) await page.getByLabel(`OTP digit ${digit}`, { exact: true }).fill(String(digit));
  await page.getByRole('button', { name: 'Verify Email', exact: true }).click();
  await expect(page).toHaveURL(/\/dashboard$/);
  await expect(page.getByRole('heading', { name: 'Welcome back, Fixture.' })).toBeVisible();
  expect(verifications).toBe(1);
  expect((await context.cookies()).find(cookie => cookie.name === 'refreshToken')?.value).toBe('fixture-refresh');
});

test('already verified response offers sign-in without creating a session', async ({ page, context }) => {
  await page.route('**/api/v1/otp/verify', route => route.fulfill({ status: 400, json: { success: false, code: 'EMAIL_ALREADY_VERIFIED', message: 'Email already verified' } }));
  await page.goto('/verify-email?email=student%40example.test');
  for (let digit = 1; digit <= 6; digit++) await page.getByLabel(`OTP digit ${digit}`, { exact: true }).fill(String(digit));
  await page.getByRole('button', { name: 'Verify Email', exact: true }).click();
  await expect(page.locator('p[role="alert"]')).toContainText('Email already verified');
  await expect(page.locator('#main-content').getByRole('link', { name: 'Sign in' })).toHaveAttribute('href', '/login');
  expect((await context.cookies()).some(cookie => cookie.name === 'refreshToken')).toBe(false);
});

for (const status of [200, 503]) {
  test(`verified OTP with ${status === 200 ? 'missing profile' : 'unavailable validation'} offers sign-in, not success`, async ({ page, context }) => {
    await page.route('**/api/v1/otp/verify', route => route.fulfill({ json: { success: true, accessToken: 'fixture-access', refreshToken: 'fixture-refresh' } }));
    await page.route('**/api/v1/auth/validate', route => route.fulfill({ status, json: status === 200 ? { success: false } : { success: false, message: 'Temporary outage' } }));
    await page.goto('/verify-email?email=student%40example.test');
    for (let digit = 1; digit <= 6; digit++) await page.getByLabel(`OTP digit ${digit}`, { exact: true }).fill(String(digit));
    await page.getByRole('button', { name: 'Verify Email', exact: true }).click();
    await expect(page.locator('p[role="alert"]')).toContainText('Your email was verified');
    await expect(page.locator('#main-content').getByRole('link', { name: 'Sign in' })).toBeVisible();
    await expect(page).toHaveURL(/\/verify-email/);
    expect((await context.cookies()).find(cookie => cookie.name === 'refreshToken')?.value).toBe('fixture-refresh');
  });
}

for (const unavailable of [false, true]) {
  test(`concurrent library requests share a refresh and ${unavailable ? 'retain cookies on outage' : 'retry with rotated cookies'}`, async ({ page, context, baseURL }) => {
    await context.addCookies([{ name: 'accessToken', value: 'old-access', url: baseURL! }, { name: 'refreshToken', value: 'old-refresh', url: baseURL! }]);
    await page.route('**/api/v1/auth/validate', route => route.fulfill({ json: { success: true, user: student } }));
    await page.route(`**/api/v1/courses/single/${courseId}`, route => route.fulfill({ json: { success: true, data: course } }));
    await page.route(`**/api/v1/courses/access/${courseId}`, route => route.fulfill({ json: { success: true, hasAccess: false } }));
    const expired = new Set<string>();
    let release!: () => void;
    const requestsSeen = new Promise<void>(resolve => { release = resolve; });
    await page.route(/\/api\/v1\/student\/(likes|subscriptions|playlists)$/, async route => {
      if (route.request().headers().authorization === 'Bearer old-access') {
        expired.add(new URL(route.request().url()).pathname);
        if (expired.size === 3) release();
        await route.fulfill({ status: 401, json: { success: false, code: 'TOKEN_EXPIRED' } });
      } else await route.fulfill({ json: { success: true, data: [] } });
    });
    let refreshes = 0;
    await page.route('**/api/v1/auth/refreshtoken', async route => {
      refreshes++; expect(route.request().postDataJSON().token).toBe('old-refresh');
      await requestsSeen;
      await route.fulfill({ status: unavailable ? 503 : 200, json: unavailable ? { success: false, message: 'Temporary outage' } : { success: true, accessToken: 'new-access', refreshToken: 'new-refresh' } });
    });
    await page.goto(`/courses/${courseId}`);
    if (unavailable) await expect(page.getByRole('alert').filter({ hasText: 'Temporary outage' })).toBeVisible();
    else await expect(page.getByRole('button', { name: 'Like course', exact: true })).toBeEnabled();
    await expect.poll(() => expired.size).toBe(3);
    await expect.poll(async () => (await context.cookies()).find(cookie => cookie.name === 'refreshToken')?.value).toBe(unavailable ? 'old-refresh' : 'new-refresh');
    await expect.poll(async () => (await context.cookies()).find(cookie => cookie.name === 'accessToken')?.value).toBe(unavailable ? 'old-access' : 'new-access');
    expect(refreshes).toBe(1);
  });
}
