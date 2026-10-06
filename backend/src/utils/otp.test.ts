import { beforeEach, describe, expect, it, vi } from 'vitest';

const state = vi.hoisted(() => ({ rows: [] as any[], sent: vi.fn(), failUpdate: false }));
vi.mock('../db/index.ts', () => {
  const tx: any = {
    execute: async () => {},
    select: () => ({ from: () => ({ where: () => ({ orderBy: () => ({ limit: async () => state.rows.filter(r => r.expiry > new Date()).sort((a, b) => b.lastSent.getTime() - a.lastSent.getTime()).slice(0, 1) }) }) }) }),
    update: () => ({ set: (values: any) => ({ where: async () => { if (state.failUpdate) throw Error('update failed'); state.rows.forEach(row => { if (row.expiry > new Date()) Object.assign(row, values); }); } }) }),
    insert: () => ({ values: async (values: any) => { state.rows.push({ ...values, id: String(state.rows.length + 1) }); } }),
    delete: () => ({ where: () => ({ returning: async () => { const row = state.rows.find(r => r.expiry > new Date()); if (!row) return []; state.rows.splice(state.rows.indexOf(row), 1); return [{ id: row.id }]; } }) }),
  };
  return { db: { select: tx.select, transaction: async (callback: any) => { const snapshot = state.rows.map(row => ({ ...row })); try { return await callback(tx); } catch (error) { state.rows = snapshot; throw error; } } } };
});
vi.mock('./sendEmail.ts', () => ({ sendEmail: state.sent }));
import { consumeOtp, issueOtp } from './otp.ts';

beforeEach(() => { state.rows = []; state.failUpdate = false; state.sent.mockReset(); });
describe('OTP lifecycle', () => {
  it('never revives the older code after consuming its replacement', async () => {
    state.rows.push({ id: 'old', value: 123456n, expiry: new Date(Date.now() + 300000), lastSent: new Date(Date.now() - 120000) });
    await issueOtp('a@example.com');
    expect(state.rows[0].expiry.getTime()).toBe(0);
    const newer = String(state.rows[1].value);
    expect(await consumeOtp('a@example.com', newer)).toBe(true);
    expect(await consumeOtp('a@example.com', newer)).toBe(false);
    expect(await consumeOtp('a@example.com', '123456')).toBe(false);
  });
  it('rolls back consumption when the account update fails', async () => {
    state.rows.push({ id: 'one', value: 123456n, expiry: new Date(Date.now() + 300000), lastSent: new Date() });
    await expect(consumeOtp('a@example.com', '123456', async () => { throw Error('update failed'); })).rejects.toThrow('update failed');
    expect(await consumeOtp('a@example.com', '123456')).toBe(true);
  });
  it('rejects malformed stored values without throwing', async () => {
    state.rows.push({ id: 'one', value: 123n, expiry: new Date(Date.now() + 300000), lastSent: new Date() });
    expect(await consumeOtp('a@example.com', '123456')).toBe(false);
  });
});
