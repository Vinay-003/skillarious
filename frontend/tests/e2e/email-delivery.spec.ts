import { expect, test } from '@playwright/test';

test.beforeEach(async ({ page }) => {
  await page.route('**/api/v1/**', route => route.fulfill({ json: { success: true, data: [] } }));
});

test('restricted signup keeps pending verification and disables futile resend without URL secrets', async ({ page }) => {
  await page.route('**/api/v1/auth/signup', route => route.fulfill({ status: 503, json: { success: false, requiresVerification: true, code: 'EMAIL_RECIPIENT_RESTRICTED', message: 'Resend’s default test sender works without a domain, but only for the Resend account email.', user: { email: 'fixture@example.test' } } }));
  await page.goto('/signup');
  await page.getByLabel('Full name').fill('Fixture Student');
  await page.getByLabel('Email address').fill('fixture@example.test');
  await page.getByLabel('Password').fill('fixture-password-123');
  await page.getByRole('button', { name: 'Create account ↗' }).click();
  await expect(page).toHaveURL(/\/verify-email\?email=fixture%40example.test$/);
  await expect(page.getByRole('alert').filter({ hasText: 'Resend’s default test sender' })).toContainText('needs no domain');
  await expect(page.getByRole('button', { name: 'Resend unavailable for this recipient' })).toBeDisabled();
});

test('restricted resend blocks repetition but transient outage remains retryable', async ({ page }) => {
  let requests = 0;
  await page.route('**/api/v1/otp/generate', route => { requests++; return route.fulfill({ status: 503, json: { success: false, code: requests === 1 ? 'EMAIL_DELIVERY_UNAVAILABLE' : 'EMAIL_RECIPIENT_RESTRICTED' } }); });
  await page.goto('/verify-email?email=fixture%40example.test');
  await page.getByRole('button', { name: 'Resend code' }).click();
  await expect(page.getByRole('button', { name: 'Resend code' })).toBeEnabled();
  await page.getByRole('button', { name: 'Resend code' }).click();
  await expect(page.getByRole('alert').filter({ hasText: 'Resend’s default test sender' })).toContainText('needs no domain');
  await expect(page.getByRole('button', { name: 'Resend unavailable for this recipient' })).toBeDisabled();
  expect(requests).toBe(2);
});

test('unknown account receives neutral acceptance, invalid code stays on verification', async ({ page }) => {
  await page.route('**/api/v1/otp/generate', route => route.fulfill({ json: { success: true, message: 'If eligible, a verification email was accepted for sending.' } }));
  await page.route('**/api/v1/otp/verify', route => route.fulfill({ status: 400, json: { success: false, message: 'Invalid or expired code' } }));
  await page.goto('/verify-email?email=unknown%40example.test');
  await page.getByRole('button', { name: 'Resend code' }).click();
  await expect(page.getByText('If eligible, a verification email was accepted for sending.')).toBeVisible();
  for (let index = 1; index <= 6; index++) await page.getByLabel(`OTP digit ${index}`).fill(String(index));
  await page.getByRole('button', { name: 'Verify Email' }).click();
  await expect(page.getByRole('alert').filter({ hasText: 'Invalid or expired code' })).toBeVisible();
  await expect(page).toHaveURL(/\/verify-email/);
});

test('fixture six-digit verification signs in only after validated profile', async ({ page }) => {
  await page.route('**/api/v1/otp/verify', route => route.fulfill({ json: { success: true, accessToken: 'fixture-access', refreshToken: 'fixture-refresh' } }));
  await page.route('**/api/v1/auth/validate', route => route.fulfill({ json: { success: true, user: { id: 'fixture-id', name: 'Fixture Student', email: 'fixture@example.test', verified: true, role: 'student', isAdmin: false, isEducator: false } } }));
  await page.goto('/verify-email?email=fixture%40example.test');
  for (let index = 1; index <= 6; index++) await page.getByLabel(`OTP digit ${index}`).fill(String(index));
  await page.getByRole('button', { name: 'Verify Email' }).click();
  await expect(page).toHaveURL(/\/dashboard$/);
});
