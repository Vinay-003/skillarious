import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';

// Opt-in integration against an EMPTY disposable local database only.
// No real inbox, credentials, hosted data, OTP logs or remote network requests.
const input = process.env.AUTH_TEST_DATABASE_URL;
if (!input) throw new Error('Set AUTH_TEST_DATABASE_URL to an empty disposable local database.');
const target = new URL(input);
if (!['127.0.0.1', 'localhost'].includes(target.hostname) || !/^\/skillarious_auth_fixture_[a-z0-9_]+$/.test(target.pathname)) {
  throw new Error('Only a named local disposable auth fixture database is permitted.');
}
Object.assign(process.env, {
  DATABASE_URL: input, DATABASE_SSL_CA_FILE: '', NODE_ENV: 'test',
  JWT_SECRET: 'fixture-access-signing-key-not-a-real-credential',
  REFRESH_SECRET: 'fixture-refresh-signing-key-not-a-real-credential',
  EMAIL_PROVIDER: 'resend', RESEND_API_KEY: 're_fixture_only', RESEND_FROM: 'Fixture <hello@example.test>',
  SUPABASE_URL: 'https://fixture.invalid', SUPABASE_SECRET_KEY: '', SUPABASE_SERVICE_ROLE_KEY: '',
  PAYPAL_CLIENT_ID: '', PAYPAL_CLIENT_SECRET: '', APINEX_API_KEY: 'fixture-only-not-provider-key',
  APINEX_PRIMARY_MODEL: 'free/deepseek-v4.1-flash', APINEX_FALLBACK_MODEL: 'free/mimo-v2.6-pro',
});

test('real Express, PostgreSQL, OTP, bcrypt and JWT lifecycle with an in-memory email boundary', async () => {
  const originalFetch = globalThis.fetch;
  const inbox = new Map<string, string>();
  let sends = 0;
  globalThis.fetch = async (request, options) => {
    const url = String(request);
    if (url === 'https://api.resend.com/emails') {
      const mail = JSON.parse(String(options?.body));
      const code = String(mail.text).match(/\b(\d{6})\b/)?.[1];
      assert.ok(code, 'fixture email should contain a verification code');
      inbox.set(mail.to[0], code); sends++;
      return new Response(JSON.stringify({ id: `fixture-email-${sends}` }), { status: 200 });
    }
    if (url === 'https://api.apinex.bond/v1/chat/completions') {
      const payload = JSON.parse(String(options?.body));
      assert.equal(payload.tools, undefined, 'learning model receives no executable tools');
      if (payload.model === 'free/deepseek-v4.1-flash') return new Response('{}', { status: 503 });
      const context = JSON.parse(payload.messages[1].content);
      const sourceId = context.untrusted_learning_excerpts[0].id;
      return new Response(JSON.stringify({ choices: [{ message: { content: `Fixture explanation: functions reuse named code [${sourceId}].` } }] }), { status: 200 });
    }
    if (!url.startsWith('http://127.0.0.1:')) throw new Error('External network is prohibited in this fixture.');
    return originalFetch(request, options);
  };
  const { db } = await import('../src/db/index.ts');
  const { sql } = await import('drizzle-orm');
  let server: import('node:http').Server | undefined;
  try {
    const tables = await db.execute(sql`select count(*)::int as count from information_schema.tables where table_schema='public'`);
    assert.equal(tables[0].count, 0, 'database must be empty; never overwrite an existing schema');
    await db.$client.unsafe(await readFile(new URL('../sql/0000_empty_schema.sql', import.meta.url), 'utf8'));
    const { createApp } = await import('../src/app.ts');
    server = createApp().listen(0, '127.0.0.1');
    await new Promise<void>(resolve => server!.once('listening', resolve));
    const port = (server.address() as import('node:net').AddressInfo).port;
    const base = `http://127.0.0.1:${port}/api/v1`;
    const call = async (path: string, body?: object, token?: string, method = body ? 'POST' : 'GET') => {
      const response = await fetch(`${base}${path}`, {
        method, headers: { 'Content-Type': 'application/json', ...(token ? { Authorization: `Bearer ${token}` } : {}) },
        ...(body ? { body: JSON.stringify(body) } : {}), signal: AbortSignal.timeout(10_000),
      });
      return { status: response.status, body: await response.json() };
    };
    const email = 'student@example.test';
    const password = 'Fixture-only-password-1';
    assert.equal((await call('/auth/signup', { name: 'Fixture Student', email, password })).status, 200);
    const firstCode = inbox.get(email)!;
    assert.equal(sends, 1);
    assert.equal((await call('/auth/login', { email, password })).status, 403);
    assert.equal((await call('/otp/verify', { email, otp: 'invalid' })).status, 400);
    assert.equal((await call('/otp/generate', { email })).status, 429);
    await db.execute(sql`update otps set last_sent=timezone('UTC',now())-interval '61 seconds' where email=${email}`);
    assert.equal((await call('/otp/generate', { email })).status, 200);
    const latestCode = inbox.get(email)!;
    assert.equal(sends, 2);
    if (firstCode !== latestCode) assert.equal((await call('/otp/verify', { email, otp: firstCode })).status, 400);
    const verified = await call('/otp/verify', { email, otp: latestCode });
    assert.equal(verified.status, 200);
    const access = verified.body.accessToken;
    const refresh = verified.body.refreshToken;
    assert.equal(typeof access, 'string'); assert.equal(typeof refresh, 'string');
    assert.equal((await call('/auth/validate', undefined, access)).body.user.verified, true);
    assert.equal((await call('/users/getprofile', undefined, access)).body.data.email, email);
    const replay = await call('/otp/verify', { email, otp: latestCode });
    assert.equal(replay.body.code, 'EMAIL_ALREADY_VERIFIED');
    assert.equal(replay.body.accessToken, undefined);
    assert.equal((await call('/otp/generate', { email })).status, 200);
    assert.equal(sends, 2, 'verified accounts do not receive more verification mail');
    const edited = await call('/users/updateprofile', { name: 'Updated Fixture', phone: '', gender: '', age: 24, isAdmin: true, role: 'admin' }, access, 'PUT');
    assert.equal(edited.status, 200);
    assert.equal(edited.body.data.isAdmin, false, 'profile cannot escalate permissions');
    assert.equal(edited.body.data.role, 'user');
    assert.equal((await call('/users/getprofile', undefined, access)).body.data.name, 'Updated Fixture');
    assert.equal((await call('/users/updateprofile', { name: 'Updated Fixture', age: null }, access, 'PUT')).status, 200);
    assert.equal((await call('/users/getprofile', undefined, access)).body.data.age, null, 'cleared optional field persists');
    const { checkLearningFixture } = await import('./learning-postgres.fixture.ts');
    await checkLearningFixture(db, call, access);
    const rotated = await call('/auth/refreshtoken', { token: refresh });
    assert.equal(rotated.status, 200);
    assert.notEqual(rotated.body.refreshToken, refresh);
    assert.equal((await call('/auth/refreshtoken', { token: refresh })).status, 403);
    assert.equal((await call('/auth/logout', { refreshToken: rotated.body.refreshToken })).status, 200);
    assert.equal((await call('/auth/refreshtoken', { token: rotated.body.refreshToken })).status, 403);
    const login = await call('/auth/login', { email, password });
    assert.equal(login.status, 200);
    assert.equal((await call('/auth/forgotpassword', { email })).status, 200);
    const resetCode = inbox.get(email)!;
    const newPassword = 'Fixture-only-password-2';
    assert.equal((await call('/auth/resetpassword', { email, otp: resetCode, newPassword })).status, 200);
    assert.equal((await call('/auth/resetpassword', { email, otp: resetCode, newPassword })).status, 400);
    assert.equal((await call('/auth/login', { email, password })).status, 401);
    assert.equal((await call('/auth/login', { email, password: newPassword })).status, 200);
    assert.equal((await call('/auth/refreshtoken', { token: login.body.refreshToken })).status, 403);
    const count = await db.execute(sql`select count(*)::int as count from otps where email=${email} and expiry>timezone('UTC',now())`);
    assert.equal(count[0].count, 0, 'no active OTP remains after successful consumption');
    console.info('PASS: disposable signup, blocked preverification login, resend/rate limit/supersession, verification/replay, profile save/permissions, refresh/replay, logout, login and reset/replay. No external messages or OTP logs.');
  } finally {
    globalThis.fetch = originalFetch;
    if (server) await new Promise<void>((resolve, reject) => server!.close(error => error ? reject(error) : resolve()));
    await db.$client.end({ timeout: 2 });
  }
});
