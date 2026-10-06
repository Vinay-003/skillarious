import { beforeEach, describe, expect, it, vi } from 'vitest';

const state = vi.hoisted(() => ({ rows: [] as any[], dbError: null as Error | null, updates: [] as any[], inserts: [] as any[], otp: vi.fn(), consume: vi.fn(), hash: vi.fn(async () => 'hash'), compare: vi.fn(async () => true) }));
vi.mock('../db/index.ts', () => ({ db: {
  select: () => { if (state.dbError) throw state.dbError; return { from: () => ({ where: () => ({ limit: async () => state.rows, then: (resolve: any) => resolve(state.rows) }) }) }; },
  insert: () => ({ values: (value: any) => { state.inserts.push(value); return { returning: async () => [{ ...value, id: 'id' }] }; } }),
  update: () => ({ set: (value: any) => ({ where: (condition: any) => { state.updates.push({ value, condition }); return { returning: async () => [{ id: 'id' }] }; } }) }),
} }));
vi.mock('../utils/otp.ts', () => ({ issueOtp: state.otp, consumeOtp: state.consume }));
vi.mock('bcrypt', () => ({ default: { hash: state.hash, compare: state.compare } }));
vi.mock('../utils/generateToken.ts', () => ({ generateAccessToken: () => 'access', generateRefreshToken: () => 'refresh' }));
vi.mock('jsonwebtoken', () => ({ default: { verify: () => ({ id: 'id' }), TokenExpiredError: class {} } }));
import { signUp, login, resetPassword, refreshToken, authenticateUser, validateSession } from './Auth.ts';
import { generateOtp, verifyOtp } from './Otp.ts';
import { EmailDeliveryError } from '../utils/emailErrors.ts';

function response() { const res: any = { statusCode: 200 }; res.status = vi.fn((code: number) => { res.statusCode = code; return res; }); res.json = vi.fn((body: any) => { res.body = body; return res; }); return res; }
beforeEach(() => { state.rows = []; state.dbError = null; state.updates = []; state.inserts = []; state.otp.mockReset(); state.consume.mockReset(); state.hash.mockClear(); });
describe('auth verification boundaries', () => {
  it('directs an already verified account to sign in without consuming a code or writing', async () => {
    state.rows = [{ id: 'id', email: 'a@example.com', verified: true, isBanned: false }];
    const res = response();
    await verifyOtp({ body: { email: ' A@Example.com ', otp: '123456' } } as any, res);
    expect(res.statusCode).toBe(400);
    expect(res.body).toMatchObject({ success: false, code: 'EMAIL_ALREADY_VERIFIED', message: expect.stringMatching(/sign in/i) });
    expect(res.body.accessToken).toBeUndefined();
    expect(res.body.refreshToken).toBeUndefined();
    expect(state.consume).not.toHaveBeenCalled();
    expect(state.updates).toHaveLength(0);
  });
  it.each([{ rows: [] }, { rows: [{ id: 'id', email: 'a@example.com', verified: true, isBanned: true }] }])('keeps unknown and banned verification failures generic', async ({ rows }) => {
    state.rows = rows;
    const res = response();
    await verifyOtp({ body: { email: 'a@example.com', otp: '123456' } } as any, res);
    expect(res.statusCode).toBe(400);
    expect(res.body).toEqual({ success: false, message: 'Invalid or expired code' });
    expect(state.consume).not.toHaveBeenCalled();
    expect(state.updates).toHaveLength(0);
  });
  it('continues verifying an unverified non-banned account with a valid code', async () => {
    state.rows = [{ id: 'id', email: 'a@example.com', verified: false, isBanned: false }];
    state.consume.mockImplementationOnce(async (_email, _otp, callback) => { await callback({ update: () => ({ set: (value: any) => ({ where: () => ({ returning: async () => { state.updates.push(value); return [{ id: 'id' }]; } }) }) }) }); return true; });
    const res = response();
    await verifyOtp({ body: { email: 'a@example.com', otp: '123456' } } as any, res);
    expect(res.statusCode).toBe(200);
    expect(res.body).toMatchObject({ success: true, accessToken: 'access', refreshToken: 'refresh' });
    expect(state.consume).toHaveBeenCalledWith('a@example.com', '123456', expect.any(Function));
    expect(state.updates).toHaveLength(1);
  });
  it.each([{ rows: [] }, { rows: [{ id: 'id', verified: true, isBanned: false }] }, { rows: [{ id: 'id', verified: false, isBanned: true }] }, { rows: [{ id: 'id', verified: true, isBanned: true }] }])('does not resend verification codes to missing, verified, or banned accounts', async ({ rows }) => {
    state.rows = rows;
    const res = response();
    await generateOtp({ body: { email: ' A@Example.com ' } } as any, res);
    expect(res.statusCode).toBe(200);
    expect(res.body).toEqual({ success: true, message: 'If eligible, a verification email was accepted for sending.' });
    expect(state.otp).not.toHaveBeenCalled();
    expect(state.updates).toHaveLength(0);
  });
  it('resends verification code to an unverified non-banned account', async () => {
    state.rows = [{ id: 'id', verified: false, isBanned: false }];
    const res = response();
    await generateOtp({ body: { email: ' A@Example.com ' } } as any, res);
    expect(res.statusCode).toBe(200);
    expect(state.otp).toHaveBeenCalledOnce();
    expect(state.otp).toHaveBeenCalledWith('a@example.com');
  });
  it('rejects oversized bcrypt passwords before a database write', async () => { const res = response(); await signUp({ body: { name: 'Alice', email: 'a@example.com', password: '🦄'.repeat(19) } } as any, res); expect(res.statusCode).toBe(400); expect(state.inserts).toHaveLength(0); });
  it('creates unverified normalized user and sends code', async () => { const res = response(); await signUp({ body: { name: ' Alice ', email: ' A@Example.com ', password: 'password123' } } as any, res); expect(state.inserts[0]).toMatchObject({ email: 'a@example.com', name: 'Alice', verified: false }); expect(state.otp).toHaveBeenCalledWith('a@example.com'); expect(res.body.requiresVerification).toBe(true); });
  it('blocks unverified login without issuing tokens', async () => { state.rows = [{ id: 'id', email: 'a@example.com', password: 'hash', verified: false }]; const res = response(); await login({ body: { email: ' A@Example.com ', password: 'password123' } } as any, res); expect(res.statusCode).toBe(403); expect(state.updates).toHaveLength(0); });
  it('does not consume reset code for invalid password', async () => { const res = response(); await resetPassword({ body: { email: 'A@Example.com', otp: '123456', newPassword: 'short' } } as any, res); expect(res.statusCode).toBe(400); expect(state.consume).not.toHaveBeenCalled(); });
  it('stale refresh does not clear the current session', async () => { process.env.REFRESH_SECRET = 'test'; state.rows = [{ id: 'id', verified: true, refreshToken: 'current' }]; const res = response(); await refreshToken({ body: { token: 'stale' } } as any, res); expect(res.statusCode).toBe(403); expect(state.updates).toHaveLength(0); });
  it('rejects an unverified user on protected routes', async () => { process.env.JWT_SECRET = 'test'; state.rows = [{ id: 'id', verified: false }]; const res = response(); const next = vi.fn(); await authenticateUser({ headers: { authorization: 'Bearer access' } } as any, res, next); expect(res.statusCode).toBe(403); expect(next).not.toHaveBeenCalled(); });
  it('returns the profile fields expected by the UI', async () => { state.rows = [{ id: 'id', name: 'Alice', verified: true, pfp: 'avatar', phone: null }]; const res = response(); await validateSession({ user: { id: 'id' } } as any, res); expect(res.body.user).toMatchObject({ name: 'Alice', verified: true, pfp: 'avatar' }); });
  it('keeps pending signup recoverable when SMTP is unavailable', async () => { state.otp.mockRejectedValueOnce(Error('SMTP unavailable')); const res = response(); await signUp({ body: { name: 'Alice', email: 'A@Example.com', password: 'password123' } } as any, res); expect(res.statusCode).toBe(503); expect(res.body).toMatchObject({ requiresVerification: true, user: { email: 'a@example.com' } }); expect(state.inserts[0].verified).toBe(false); });
  it('returns restricted configuration guidance for existing pending users only', async () => {
    state.rows = [{ id: 'id', verified: false, isBanned: false }];
    state.otp.mockRejectedValueOnce(new EmailDeliveryError('EMAIL_RECIPIENT_RESTRICTED'));
    const resend = response(); await generateOtp({ body: { email: 'a@example.com' } } as any, resend);
    expect(resend.statusCode).toBe(503); expect(resend.body).toMatchObject({ code: 'EMAIL_RECIPIENT_RESTRICTED', message: expect.stringMatching(/verify a domain/i) });
    state.rows = []; const unknown = response(); await generateOtp({ body: { email: 'unknown@example.com' } } as any, unknown);
    expect(unknown.statusCode).toBe(200); expect(unknown.body.code).toBeUndefined();
  });
  it('preserves pending signup with a restricted recipient without exposing provider details', async () => {
    state.otp.mockRejectedValueOnce(new EmailDeliveryError('EMAIL_RECIPIENT_RESTRICTED'));
    const res = response(); await signUp({ body: { name: 'Alice', email: 'a@example.com', password: 'password123' } } as any, res);
    expect(res.statusCode).toBe(503); expect(res.body).toMatchObject({ requiresVerification: true, code: 'EMAIL_RECIPIENT_RESTRICTED' });
    expect(res.body.message).not.toContain('a@example.com');
  });
  it('never returns tokens when verification transaction fails', async () => { state.rows = [{ id: 'id', email: 'a@example.com', verified: false }]; state.consume.mockImplementationOnce(async (_email, _otp, callback) => { await callback({ update: () => ({ set: () => ({ where: () => ({ returning: async () => { throw Error('write failed'); } }) }) }) }); }); const res = response(); await verifyOtp({ body: { email: 'a@example.com', otp: '123456' } } as any, res); expect(res.statusCode).toBe(500); expect(res.body.accessToken).toBeUndefined(); });
  it('database outage is not reported as an invalid access token', async () => {
    vi.stubEnv('JWT_SECRET', 'test'); state.dbError = Object.assign(new Error('Database unavailable'), { code: 'ECONNREFUSED' });
    try { const res = response(); await authenticateUser({ headers: { authorization: 'Bearer access' } } as any, res, vi.fn()); expect(res.statusCode).toBe(503); expect(res.body.code).toBe('AUTH_UNAVAILABLE'); }
    finally { vi.unstubAllEnvs(); }
  });
  it('missing refresh configuration is a service outage, not token revocation', async () => {
    vi.stubEnv('REFRESH_SECRET', '');
    try { const res = response(); await refreshToken({ body: { token: 'stored' } } as any, res); expect(res.statusCode).toBe(503); expect(state.updates).toHaveLength(0); }
    finally { vi.unstubAllEnvs(); }
  });
});
