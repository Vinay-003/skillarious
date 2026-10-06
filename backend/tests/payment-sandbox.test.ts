import { test } from 'node:test';
import assert from 'node:assert/strict';
import { validateCreatePaymentRequest, validateVerifyPaymentRequest } from '../src/schemas/payment.ts';
import { assertCaptureMatches, paypalMode } from '../src/utils/paymentService.ts';

const courseId = '123e4567-e89b-42d3-a456-426614174000';
test('payment requests reject client-controlled amounts and capture identifiers', () => {
  assert.equal(validateCreatePaymentRequest({ body: { courseId, amount: 1 } }).isValid, false);
  assert.equal(validateVerifyPaymentRequest({ body: { orderId: 'ORDER-123', captureId: 'forged' } }).isValid, false);
  assert.equal(validateVerifyPaymentRequest({ body: { orderId: 'ORDER-123', courseId } }).isValid, true);
});
test('capture must be completed with exact amount, currency, merchant and order', () => {
  const capture = { id: 'CAPTURE-1', status: 'COMPLETED', amount: { value: '19.00', currency_code: 'USD' }, seller_receivable_breakdown: {}, supplementary_data: { related_ids: { order_id: 'ORDER-123' } } };
  const order = { id: 'ORDER-123', status: 'COMPLETED', purchase_units: [{ payee: { merchant_id: 'SELLER' }, payments: { captures: [capture] } }] };
  assert.equal(assertCaptureMatches(order, { orderId: 'ORDER-123', amount: '19.00', currency: 'USD', merchantId: 'SELLER' }).id, 'CAPTURE-1');
  assert.throws(() => assertCaptureMatches(order, { orderId: 'OTHER', amount: '19.00', currency: 'USD', merchantId: 'SELLER' }));
  assert.throws(() => assertCaptureMatches(order, { orderId: 'ORDER-123', amount: '19.01', currency: 'USD', merchantId: 'SELLER' }));
});
test('live mode is disabled by default', () => assert.equal(paypalMode({}), 'sandbox'));
