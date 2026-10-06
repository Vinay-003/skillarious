import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import nodemailer from 'nodemailer';
import { DEFAULT_RESEND_FROM, sendEmail } from './sendEmail.js';

vi.mock('nodemailer', () => ({ default: { createTransport: vi.fn() } }));

const fetchMock = vi.fn();
const originalEnv = process.env;
const success = () => new Response(JSON.stringify({ id: 'email_123' }), { status: 200 });

beforeEach(() => {
  process.env = { RESEND_API_KEY: 're_live_testkey', RESEND_FROM: 'Skillarious <hello@example.com>' };
  vi.stubGlobal('fetch', fetchMock);
  fetchMock.mockReset().mockImplementation(async () => success());
  vi.mocked(nodemailer.createTransport).mockReset();
});
afterEach(() => { process.env = originalEnv; vi.unstubAllGlobals(); vi.useRealTimers(); });

describe('sendEmail', () => {
  it('bounds a successful provider body and records no untrusted text', async () => {
    const log = vi.spyOn(console, 'info').mockImplementation(() => {});
    try {
      fetchMock.mockResolvedValue(new Response(JSON.stringify({ id: 'fixture', private: 'x'.repeat(5000) }), { status: 200 }));
      await expect(sendEmail('to@example.com', 'subject', 'test-only-code')).rejects.toThrow();
      expect(log).toHaveBeenCalledWith(expect.stringContaining('invalid_response'));
      expect(JSON.stringify(log.mock.calls)).not.toContain('test-only-code');
      expect(JSON.stringify(log.mock.calls)).not.toContain('to@example.com');
      expect(fetchMock).toHaveBeenCalledTimes(1);
    } finally { log.mockRestore(); }
  });
  it('sends plain text via Resend by default with auth and one unique idempotency key per invocation', async () => {
    expect(await sendEmail('to@example.com', 'Subject', '<p>text</p>')).toBe('email_123');
    expect(await sendEmail('to@example.com', 'Subject', 'second')).toBe('email_123');
    expect(fetchMock).toHaveBeenCalledTimes(2);
    const [url, options] = fetchMock.mock.calls[0];
    expect(url).toBe('https://api.resend.com/emails');
    expect(options.method).toBe('POST');
    expect(options.redirect).toBe('error');
    expect(options.headers.Authorization).toBe('Bearer re_live_testkey');
    expect(options.headers['Idempotency-Key']).toMatch(/^[0-9a-f-]{36}$/i);
    expect(fetchMock.mock.calls[1][1].headers['Idempotency-Key']).not.toBe(options.headers['Idempotency-Key']);
    expect(JSON.parse(options.body)).toEqual({ from: 'Skillarious <hello@example.com>', to: ['to@example.com'], subject: 'Subject', text: '<p>text</p>' });
    expect(vi.mocked(nodemailer.createTransport)).not.toHaveBeenCalled();
  });

  it('uses Resend’s no-domain test sender when RESEND_FROM is omitted', async () => {
    delete process.env.RESEND_FROM;
    await expect(sendEmail('to@example.com', 'Subject', 'text')).resolves.toBe('email_123');
    expect(JSON.parse(fetchMock.mock.calls[0][1].body).from).toBe(DEFAULT_RESEND_FROM);
  });

  it('uses SMTP only when explicitly selected and bounds socket timeouts', async () => {
    process.env = { EMAIL_PROVIDER: 'smtp', SMTP_HOST: 'localhost', SMTP_PORT: '2525', SMTP_USER: 'user', SMTP_PASSWORD: 'secret', SMTP_FROM: 'sender@example.com' };
    const sendMail = vi.fn().mockResolvedValue({ messageId: 'smtp-id' });
    vi.mocked(nodemailer.createTransport).mockReturnValue({ sendMail } as never);
    expect(await sendEmail('to@example.com', 'subject', 'message')).toBe('smtp-id');
    expect(vi.mocked(nodemailer.createTransport)).toHaveBeenCalledWith(expect.objectContaining({ connectionTimeout: expect.any(Number), greetingTimeout: expect.any(Number), socketTimeout: expect.any(Number) }));
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it('relays mail to the Vercel Node function over HTTPS when configured', async () => {
    process.env = {
      EMAIL_PROVIDER: 'vercel_smtp',
      EMAIL_RELAY_URL: 'https://skillarious.vercel.app/api/internal/email',
      EMAIL_RELAY_TOKEN: 'fixture-relay-token',
    };
    fetchMock.mockResolvedValue(new Response(JSON.stringify({ success: true }), { status: 202 }));
    await expect(sendEmail('student@example.com', 'Verify', 'Fixture message')).resolves.toBe('vercel-relay-accepted');
    expect(fetchMock).toHaveBeenCalledTimes(1);
    const [url, options] = fetchMock.mock.calls[0];
    expect(String(url)).toBe('https://skillarious.vercel.app/api/internal/email');
    expect(options.method).toBe('POST');
    expect(options.redirect).toBe('error');
    expect(options.headers.Authorization).toBe('Bearer fixture-relay-token');
    expect(JSON.parse(options.body)).toEqual({ to: 'student@example.com', subject: 'Verify', text: 'Fixture message' });
  });

  it('does not relay when the endpoint or token is missing', async () => {
    process.env = { EMAIL_PROVIDER: 'vercel_smtp', EMAIL_RELAY_URL: 'https://skillarious.vercel.app/api/internal/email' };
    await expect(sendEmail('student@example.com', 'Verify', 'Fixture message')).rejects.toThrow('Email relay is not configured');
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it.each([
    [{}, 'missing Resend config'],
    [{ RESEND_API_KEY: 'your_resend_api_key', RESEND_FROM: 'hello@example.com' }, 'placeholder key'],
    [{ RESEND_API_KEY: 're_live_key', RESEND_FROM: 'your_verified_sender@example.com' }, 'placeholder sender'],
    [{ EMAIL_PROVIDER: 'other', RESEND_API_KEY: 're_live_key', RESEND_FROM: 'hello@example.com' }, 'unknown provider'],
    [{ EMAIL_PROVIDER: 'smtp' }, 'missing SMTP config'],
  ])('rejects %s (%s) without sending', async (env, _description) => {
    process.env = env;
    await expect(sendEmail('to@example.com', 'subject', 'message')).rejects.toThrow();
    expect(fetchMock).not.toHaveBeenCalled();
    expect(vi.mocked(nodemailer.createTransport)).not.toHaveBeenCalled();
  });

  it.each([
    ['to@example.com,b@example.com', 'subject', 'message'],
    ['to@example.com\r\nBcc: b@example.com', 'subject', 'message'],
    ['to@example.com', 'subject\nBcc: b@example.com', 'message'],
    ['to@example.com', 'subject', ''],
  ])('rejects unsafe recipient, subject or text', async (to, subject, text) => {
    await expect(sendEmail(to, subject, text)).rejects.toThrow();
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it('rejects unsafe sender and SMTP recipient before transport creation', async () => {
    process.env.RESEND_FROM = 'Sender <hello@example.com>\r\nBcc: bad@example.com';
    await expect(sendEmail('to@example.com', 'subject', 'text')).rejects.toThrow();
    process.env = { EMAIL_PROVIDER: 'smtp', SMTP_HOST: 'localhost', SMTP_USER: 'user', SMTP_PASSWORD: 'secret', SMTP_FROM: 'sender@example.com' };
    await expect(sendEmail('a@example.com,b@example.com', 'subject', 'text')).rejects.toThrow();
    expect(vi.mocked(nodemailer.createTransport)).not.toHaveBeenCalled();
  });

  it.each([
    [{ ok: false, status: 429, json: async () => ({ error: 'secret' }) }, 'HTTP failure'],
    [{ ok: true, status: 200, json: async () => ({ id: '' }) }, 'missing id'],
    [{ ok: true, status: 200, json: async () => { throw Error('secret'); } }, 'invalid JSON'],
    [{ ok: true, status: 302, json: async () => ({ id: 'fake' }) }, 'redirect'],
  ])('sanitizes %s (%s) without fallback or retry', async (response, _description) => {
    fetchMock.mockResolvedValue(response);
    await expect(sendEmail('to@example.com', 'subject', 'text')).rejects.toThrow('Email delivery unavailable');
    expect(fetchMock).toHaveBeenCalledTimes(1);
    expect(vi.mocked(nodemailer.createTransport)).not.toHaveBeenCalled();
  });

  it('sanitizes network errors without retry', async () => {
    fetchMock.mockRejectedValue(Error('secret credential in network error'));
    await expect(sendEmail('to@example.com', 'subject', 'text')).rejects.toThrow('Email delivery unavailable');
    expect(fetchMock).toHaveBeenCalledTimes(1);
  });

  it('classifies only validated Resend restriction and emits sanitized diagnostics', async () => {
    const secret = 'secret_token_and_otp_123456';
    const logger = vi.spyOn(console, 'info').mockImplementation(() => {});
    fetchMock.mockResolvedValueOnce(new Response(JSON.stringify({ name: 'validation_error', message: `You can only send testing emails to your own email address. Verify a domain to send emails. ${secret}` }), { status: 403 }));
    await expect(sendEmail('someone@example.com', 'subject', secret)).rejects.toMatchObject({ code: 'EMAIL_RECIPIENT_RESTRICTED' });
    expect(JSON.stringify(logger.mock.calls)).not.toContain(secret);
    expect(JSON.stringify(logger.mock.calls)).not.toContain('someone@example.com');
    logger.mockRestore();
    expect(fetchMock).toHaveBeenCalledTimes(1);
  });
  it('does not classify arbitrary provider failures as recipient restriction', async () => {
    fetchMock.mockResolvedValueOnce(new Response(JSON.stringify({ name: 'validation_error', message: 'invalid request' }), { status: 403 }));
    await expect(sendEmail('to@example.com', 'subject', 'text')).rejects.toMatchObject({ code: 'EMAIL_DELIVERY_UNAVAILABLE' });
  });
  it('aborts a stalled response body on deadline', async () => {
    vi.useFakeTimers();
    fetchMock.mockResolvedValue(new Response(new ReadableStream({ start() {} }), { status: 200 }));
    const pending = sendEmail('to@example.com', 'subject', 'text');
    const failure = expect(pending).rejects.toThrow('Email delivery unavailable');
    await vi.advanceTimersByTimeAsync(11_000);
    await failure;
    expect(fetchMock.mock.calls[0][1].signal.aborted).toBe(true);
    expect(fetchMock).toHaveBeenCalledTimes(1);
  });
});
