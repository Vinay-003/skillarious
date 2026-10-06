import { test } from 'node:test';
import assert from 'node:assert/strict';
import { assertRefundMatches } from '../src/utils/paymentService.ts';

test('refund requires completed provider result with exact amount and currency', () => {
  const refund = { id: 'REFUND-1', status: 'COMPLETED', amount: { value: '19.00', currency_code: 'USD' } };
  assert.equal(assertRefundMatches(refund, '19.00', 'USD'), true);
  assert.equal(assertRefundMatches(refund, '19.01', 'USD'), false);
  assert.equal(assertRefundMatches(refund, '19.00', 'EUR'), false);
  assert.equal(assertRefundMatches({ ...refund, status: 'PENDING' }, '19.00', 'USD'), false);
  assert.equal(assertRefundMatches({ ...refund, amount: undefined }, '19.00', 'USD'), false);
});
