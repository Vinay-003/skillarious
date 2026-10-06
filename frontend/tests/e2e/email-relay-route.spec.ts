import { expect, test } from '@playwright/test';

test('email relay rejects requests without its private server token', async ({ request, baseURL }) => {
  const response = await request.post(`${baseURL}/api/internal/email`, {
    headers: { Authorization: 'Bearer not-the-relay-token' },
    data: { to: 'recipient@example.com', subject: 'fixture', text: 'fixture' },
  });
  expect(response.status()).toBe(401);
  expect(await response.json()).toEqual({ success: false, message: 'Unauthorized' });
});

test('email relay never accepts browser-shaped unauthenticated input', async ({ request, baseURL }) => {
  const response = await request.post(`${baseURL}/api/internal/email`, { data: { to: 'recipient@example.com', subject: 'fixture', text: 'fixture' } });
  expect(response.status()).toBe(401);
});
