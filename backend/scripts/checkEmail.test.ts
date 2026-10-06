import { describe, expect, it, vi } from 'vitest';
import { main, parseArgs } from './checkEmail.ts';

const valid = { EMAIL_PROVIDER: 'resend', RESEND_API_KEY: 're_test_synthetic', RESEND_FROM: 'Test <test@example.com>' };

describe('email check CLI', () => {
  it('defaults to local configuration check', () => {
    expect(parseArgs([])).toEqual({ smoke: false });
  });

  it.each([['--to=someone@example.com'], ['--recipient', 'someone@example.com'], ['--smoke', '--smoke'], ['--unknown']])('rejects unsupported arguments', (...args) => {
    expect(() => parseArgs(args)).toThrow();
  });

  it('never sends during default check', async () => {
    const send = vi.fn();
    const log = vi.fn();
    expect(await main([], { env: valid, send, log })).toBe(0);
    expect(send).not.toHaveBeenCalled();
    expect(log).toHaveBeenCalledWith(expect.stringContaining('configuration'));
  });

  it('checks relay configuration without sending', async () => {
    const send = vi.fn();
    const log = vi.fn();
    const env = { EMAIL_PROVIDER: 'vercel_smtp', EMAIL_RELAY_URL: 'https://frontend.vercel.app/api/internal/email', EMAIL_RELAY_TOKEN: 'fixture-token' };
    expect(await main([], { env, send, log })).toBe(0);
    expect(send).not.toHaveBeenCalled();
    expect(log).toHaveBeenCalledWith(expect.stringContaining('relay configuration is valid'));
  });

  it('does not offer an unguarded relay smoke send', async () => {
    const send = vi.fn();
    const log = vi.fn();
    const env = { EMAIL_PROVIDER: 'vercel_smtp', EMAIL_RELAY_URL: 'https://frontend.vercel.app/api/internal/email', EMAIL_RELAY_TOKEN: 'fixture-token' };
    expect(await main(['--smoke'], { env, send, log })).toBe(1);
    expect(send).not.toHaveBeenCalled();
  });

  it('smokes with exactly one synthetic plain-text message and reports acceptance only', async () => {
    const send = vi.fn().mockResolvedValue('message-id');
    const log = vi.fn();
    expect(await main(['--smoke'], { env: valid, send, log })).toBe(0);
    expect(send).toHaveBeenCalledTimes(1);
    expect(send).toHaveBeenCalledWith('delivered@resend.dev', expect.any(String), expect.any(String));
    expect(send.mock.calls[0][2]).not.toMatch(/otp|verification code|real user/i);
    expect(log.mock.calls.flat().join(' ')).toMatch(/accepted/i);
    expect(log.mock.calls.flat().join(' ')).toMatch(/inbox delivery is not verified/i);
    expect(log.mock.calls.flat().join(' ')).not.toContain('message-id');
  });

  it.each([
    { ...valid, EMAIL_PROVIDER: 'smtp' },
    { ...valid, RESEND_API_KEY: '' },
    { ...valid, RESEND_FROM: 'bad-address' },
    { ...valid, RESEND_FROM: 'test@example.com>' },
    { ...valid, RESEND_FROM: 'your_sender@example.com' },
    { ...valid, RESEND_FROM: 'Sender\u0000 <test@example.com>' },
  ])('fails invalid configuration without sending or disclosing values', async env => {
    const send = vi.fn();
    const log = vi.fn();
    expect(await main(['--smoke'], { env, send, log })).toBe(1);
    expect(send).not.toHaveBeenCalled();
    if (env.RESEND_API_KEY) expect(log.mock.calls.flat().join(' ')).not.toContain(env.RESEND_API_KEY);
    expect(log.mock.calls.flat().join(' ')).not.toContain(env.RESEND_FROM);
  });

  it('sanitizes sender errors and rejects arguments before sending', async () => {
    const send = vi.fn().mockRejectedValue(new Error('secret-from-provider'));
    const log = vi.fn();
    expect(await main(['--smoke'], { env: valid, send, log })).toBe(1);
    expect(log.mock.calls.flat().join(' ')).not.toContain('secret-from-provider');
    expect(await main(['--smoke', '--to=real@example.com'], { env: valid, send, log })).toBe(1);
    expect(send).toHaveBeenCalledTimes(1);
  });
});
