import { expect, it, vi } from 'vitest';
import { PaymentService } from './paymentService.ts';
it('sets trusted return and cancel URLs for hosted PayPal checkout', async () => {
  vi.stubEnv('FRONTEND_URL', 'http://localhost:4002');
  vi.stubEnv('PAYPAL_CLIENT_ID', 'test-client'); vi.stubEnv('PAYPAL_CLIENT_SECRET', 'test-secret'); vi.stubEnv('PAYPAL_MERCHANT_ID', 'test-merchant');
  const fetcher = vi.fn().mockResolvedValueOnce(new Response(JSON.stringify({ access_token: 'test-token' }))).mockResolvedValueOnce(new Response(JSON.stringify({ id: 'test-order' })));
  vi.stubGlobal('fetch', fetcher);
  try {
    await PaymentService.createOrder('19.00', 'intent');
    const body = JSON.parse(fetcher.mock.calls[1][1].body);
    expect(body.payment_source.paypal.experience_context.return_url).toBe('http://localhost:4002/payments/result');
    expect(body.payment_source.paypal.experience_context.cancel_url).toBe('http://localhost:4002/payments/result?cancel=true');
  } finally { vi.unstubAllGlobals(); vi.unstubAllEnvs(); }
});
