import { expect, test } from '@playwright/test';

const person = { id: 'fixture-user', name: 'Fixture Learner', email: 'learner@example.test', phone: '', pfp: '', isEducator: false, isAdmin: false, role: 'user', verified: true };

test.beforeEach(async ({ page }) => {
  await page.route('**/api/v1/**', route => route.fulfill({ status: 404, json: { success: false, message: 'Unexpected fixture request' } }));
});

test('known identity stays visible while optional profile request is delayed', async ({ page, context, baseURL }) => {
  await context.addCookies([{ name: 'accessToken', value: 'fixture-access', url: baseURL! }]);
  await page.route('**/api/v1/auth/validate', route => route.fulfill({ json: { success: true, user: person } }));
  let release!: () => void;
  const delayed = new Promise<void>(resolve => { release = resolve; });
  let settled = false;
  await page.route('**/api/v1/users/getprofile', async route => {
    await delayed;
    settled = true;
    await route.fulfill({ json: { success: true, data: { ...person, phone: '+12025550123' } } });
  });
  await page.goto('/profile');
  await expect(page.getByRole('heading', { name: 'Fixture Learner' })).toBeVisible();
  expect(settled).toBe(false);
  release();
  await expect(page.getByText('+12025550123')).toBeVisible();
});

test('profile save sends only approved fields, refreshes identity and keeps email read only', async ({ page, context, baseURL }) => {
  await context.addCookies([{ name: 'accessToken', value: 'fixture-access', url: baseURL! }]);
  let name = person.name;
  await page.route('**/api/v1/auth/validate', route => route.fulfill({ json: { success: true, user: { ...person, name } } }));
  await page.route('**/api/v1/users/getprofile', route => route.fulfill({ json: { success: true, data: { ...person, name } } }));
  await page.route('**/api/v1/users/updateprofile', async route => {
    expect(Object.keys(route.request().postDataJSON()).sort()).toEqual(['age', 'gender', 'name', 'phone']);
    expect(route.request().postDataJSON().age).toBeNull();
    name = route.request().postDataJSON().name;
    await route.fulfill({ json: { success: true, data: { ...person, name } } });
  });
  await page.goto('/profile');
  await page.getByRole('button', { name: 'Edit profile' }).click();
  await expect(page.locator('form').getByText(person.email)).toBeVisible();
  await page.getByLabel('Name').fill('Updated Learner');
  await page.getByRole('button', { name: 'Save changes' }).click();
  await expect(page.getByRole('heading', { name: 'Updated Learner' })).toBeVisible();
});

test('signed out visitor is sent to login after auth settles', async ({ page }) => {
  await page.goto('/profile');
  await expect(page).toHaveURL(/\/login/);
});

test('optional detail failure keeps identity and offers retry', async ({ page, context, baseURL }) => {
  await context.addCookies([{ name: 'accessToken', value: 'fixture-access', url: baseURL! }]);
  await page.route('**/api/v1/auth/validate', route => route.fulfill({ json: { success: true, user: person } }));
  let attempts = 0;
  await page.route('**/api/v1/users/getprofile', route => {
    attempts++;
    return route.fulfill(attempts === 1 ? { status: 503, json: { success: false, message: 'Temporary outage' } } : { json: { success: true, data: { ...person, phone: '+12025550123' } } });
  });
  await page.goto('/profile');
  await expect(page.getByRole('heading', { name: person.name })).toBeVisible();
  await expect(page.locator('main [role="alert"]')).toContainText('Temporary outage');
  await page.getByRole('button', { name: 'Retry details' }).click();
  await expect(page.getByText('+12025550123')).toBeVisible();
  expect(attempts).toBe(2);
});
