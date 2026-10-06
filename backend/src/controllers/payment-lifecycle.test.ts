import { beforeEach, expect, it, vi } from 'vitest';
const state = vi.hoisted(() => ({ intent: null as any, paid: null as any, admin: true, events: [] as string[], captures: vi.fn(), getOrder: vi.fn(), refund: vi.fn() }));
vi.mock('../db/index.ts', () => {
  const store: any = {
    select: () => ({ from: (table: any) => {
      const name = table[Symbol.for('drizzle:Name')];
      const builder: any = { where: () => builder, limit: async () => {
        state.events.push(`read:${name}`);
        if (name === 'users') return [{ isAdmin: state.admin }];
        if (name === 'paypal_orders') return state.intent ? [{ ...state.intent }] : [];
        if (name === 'transactions') return state.paid ? [{ ...state.paid }] : [];
        return [];
      } }; return builder;
    } }),
    execute: async () => { state.events.push('lock'); },
    insert: () => ({ values: (values: any) => ({ returning: async () => { state.events.push('enroll'); state.paid = { id: 'transaction', ...values }; return [state.paid]; } }) }),
    update: (table: any) => ({ set: (values: any) => ({ where: async () => {
      const name = table[Symbol.for('drizzle:Name')]; state.events.push(`write:${name}`);
      if (name === 'paypal_orders') Object.assign(state.intent, values);
      if (name === 'transactions') Object.assign(state.paid, values);
    } }) }),
  };
  store.transaction = async (work: any) => {
    const previous = structuredClone({ intent: state.intent, paid: state.paid });
    try { return await work(store); } catch (error) { state.intent = previous.intent; state.paid = previous.paid; throw error; }
  };
  return { db: store };
});
vi.mock('../utils/paymentService.ts', async importOriginal => {
  const original = await importOriginal<any>();
  return { ...original, PaymentService: { getOrder: state.getOrder, captureOrder: state.captures, refund: state.refund } };
});
import { refundPayment, verifyPayment } from './Payment.ts';
const request = { user: { id: 'student' }, body: { orderId: 'ORDER-123', courseId: 'course' } };
const response = () => ({ status: vi.fn().mockReturnThis(), json: vi.fn().mockReturnThis() });
const completedOrder = () => ({ id: 'ORDER-123', status: 'COMPLETED', purchase_units: [{ payee: { merchant_id: 'merchant' }, payments: { captures: [{ id: 'capture', status: 'COMPLETED', amount: { value: '19.00', currency_code: 'USD' } }] } }] });
beforeEach(() => {
  state.intent = { id: 'intent', userId: 'student', courseId: 'course', orderId: 'ORDER-123', amount: '19.00', currency: 'USD', merchantId: 'merchant', status: 'pending', captureId: null, transactionId: null };
  state.paid = null; state.admin = true; state.events = [];
  state.getOrder.mockReset().mockImplementation(async () => { state.events.push('provider-read'); return { status: 'APPROVED' }; });
  state.captures.mockReset().mockImplementation(async () => { state.events.push('capture'); return completedOrder(); });
  state.refund.mockReset().mockResolvedValue({ id: 'refund', status: 'COMPLETED', amount: { value: '19.00', currency_code: 'USD' } });
});
it('pending alternate checkout cannot charge an already-enrolled learner', async () => {
  state.paid = { id: 'existing' }; const res = response(); await verifyPayment(request as any, res as any);
  expect(res.status).toHaveBeenCalledWith(409); expect(state.captures).not.toHaveBeenCalled(); expect(state.getOrder).not.toHaveBeenCalled();
});
it('stored completed verification works during provider outages without recapture', async () => {
  Object.assign(state.intent, { status: 'completed', transactionId: 'transaction', captureId: 'capture' });
  const res = response(); await verifyPayment(request as any, res as any);
  expect(res.json).toHaveBeenCalledWith(expect.objectContaining({ success: true })); expect(state.getOrder).not.toHaveBeenCalled();
});
it('missing or foreign-owner order never reaches the provider', async () => {
  // Simulates the owner-filtered DB lookup returning no row.
  state.intent = null; const res = response(); await verifyPayment(request as any, res as any);
  expect(res.status).toHaveBeenCalledWith(404); expect(state.captures).not.toHaveBeenCalled();
});
it('locks before capture, persists enrollment and makes repeated verification idempotent', async () => {
  await verifyPayment(request as any, response() as any); await verifyPayment(request as any, response() as any);
  expect(state.events.indexOf('lock')).toBeLessThan(state.events.indexOf('capture'));
  expect(state.captures).toHaveBeenCalledTimes(1); expect(state.events.filter(value => value === 'enroll')).toHaveLength(1);
  expect(state.intent.status).toBe('completed'); expect(state.paid.paymentId).toBe('PAYPAL:capture');
});
it('ambiguous capture is committed as unknown and cannot blindly capture again', async () => {
  state.captures.mockRejectedValue(new Error('timeout')); const res = response(); await verifyPayment(request as any, res as any);
  expect(res.status).toHaveBeenCalledWith(503); expect(state.intent.status).toBe('capture_unknown'); expect(state.paid).toBeNull();
  await verifyPayment(request as any, response() as any); expect(state.captures).toHaveBeenCalledTimes(1);
});
it('reconciles an unknown capture only from a matching completed provider read', async () => {
  state.intent.status = 'capture_unknown'; state.getOrder.mockResolvedValue(completedOrder());
  await verifyPayment(request as any, response() as any);
  expect(state.captures).not.toHaveBeenCalled(); expect(state.paid.id).toBe('transaction');
});
it('pending refund preserves enrollment and records uncertainty without a second refund', async () => {
  Object.assign(state.intent, { status: 'completed', transactionId: 'transaction', captureId: 'capture' });
  state.paid = { id: 'transaction', userId: 'student', courseId: 'course', amount: '19.00', paymentId: 'PAYPAL:capture', status: 'completed' };
  state.refund.mockResolvedValue({ id: 'refund', status: 'PENDING', amount: { value: '19.00', currency_code: 'USD' } });
  const res = response(); await refundPayment({ user: { id: 'admin' }, body: { orderId: 'ORDER-123' } } as any, res as any);
  expect(res.status).toHaveBeenCalledWith(503); expect(state.paid.status).toBe('completed'); expect(state.intent.status).toBe('refund_unknown');
  await refundPayment({ user: { id: 'admin' }, body: { orderId: 'ORDER-123' } } as any, response() as any);
  expect(state.refund).toHaveBeenCalledTimes(1);
});
it('non-admin cannot refund and verified refund changes both stored statuses', async () => {
  state.admin = false; await refundPayment({ user: { id: 'student' }, body: { orderId: 'ORDER-123' } } as any, response() as any); expect(state.refund).not.toHaveBeenCalled();
  state.admin = true; Object.assign(state.intent, { status: 'completed', transactionId: 'transaction', captureId: 'capture' });
  state.paid = { id: 'transaction', userId: 'student', courseId: 'course', amount: '19.00', paymentId: 'PAYPAL:capture', status: 'completed' };
  const res = response(); await refundPayment({ user: { id: 'admin' }, body: { orderId: 'ORDER-123' } } as any, res as any);
  expect(res.json).toHaveBeenCalledWith(expect.objectContaining({ success: true })); expect(state.paid.status).toBe('refunded'); expect(state.intent.status).toBe('refunded');
});
