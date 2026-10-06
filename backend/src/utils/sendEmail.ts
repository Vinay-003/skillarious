import { randomUUID } from 'node:crypto';
import nodemailer from 'nodemailer';
import { EmailDeliveryError, recordEmailEvent } from './emailErrors.ts';

const TIMEOUT_MS = 10_000;
export const DEFAULT_RESEND_FROM = 'Skillarious <onboarding@resend.dev>';
async function limitedProviderBody(response: Response, signal: AbortSignal): Promise<string> {
  if (!response.body) return '';
  const reader = response.body.getReader();
  const abort = () => { void reader.cancel().catch(() => {}); };
  signal.addEventListener('abort', abort, { once: true });
  const chunks: Uint8Array[] = [];
  let size = 0;
  try {
    while (true) {
      const { done, value } = await reader.read();
      if (done) break;
      size += value.byteLength;
      if (size > 4096) return '';
      chunks.push(value);
    }
    return new TextDecoder().decode(Buffer.concat(chunks));
  } finally { signal.removeEventListener('abort', abort); void reader.cancel().catch(() => {}); reader.releaseLock(); }
}
const EMAIL = /^[A-Z0-9.!#$%&'*+/=?^_`{|}~-]+@[A-Z0-9](?:[A-Z0-9-]*[A-Z0-9])?(?:\.[A-Z0-9](?:[A-Z0-9-]*[A-Z0-9])?)+$/i;

function address(value: string | undefined): boolean {
  if (!value || /[\r\n\x00-\x1f\x7f,;]/.test(value) || value !== value.trim()) return false;
  const mailbox = value.match(/^(?:[^<>"\\]+ )?<([^<>]+)>$/)?.[1] ?? value;
  return EMAIL.test(mailbox) && !/^(?:example|placeholder|your[_-]|change[_-]|replace[_-])/i.test(mailbox.split('@')[0]);
}

function configured(value: string | undefined): value is string {
  return Boolean(value?.trim() && !/^(?:your|replace|change|placeholder|insert)[_\s-]/i.test(value.trim()));
}

export function isResendConfigured(env: Record<string, string | undefined>): boolean {
  return (env.EMAIL_PROVIDER || 'resend') === 'resend'
    && configured(env.RESEND_API_KEY)
    && /^re_[A-Za-z0-9_-]+$/.test(env.RESEND_API_KEY)
    && address(env.RESEND_FROM?.trim() || DEFAULT_RESEND_FROM);
}

function relayUrl(value: string | undefined): URL | null {
  if (!value?.trim()) return null;
  try {
    const url = new URL(value.trim());
    if (url.protocol === 'https:' || (url.protocol === 'http:' && ['localhost', '127.0.0.1'].includes(url.hostname))) return url;
  } catch { /* Invalid endpoint is handled as configuration failure. */ }
  return null;
}

export function isVercelRelayConfigured(env: Record<string, string | undefined>): boolean {
  return Boolean(relayUrl(env.EMAIL_RELAY_URL) && configured(env.EMAIL_RELAY_TOKEN));
}

async function sendViaVercelRelay(email: string, subject: string, message: string): Promise<string> {
  const endpoint = relayUrl(process.env.EMAIL_RELAY_URL);
  const token = process.env.EMAIL_RELAY_TOKEN?.trim();
  if (!endpoint || !configured(token)) {
    recordEmailEvent('failed', 'vercel_smtp', 'configuration');
    throw new Error('Email relay is not configured');
  }
  const controller = new AbortController();
  let timer: ReturnType<typeof setTimeout> | undefined;
  try {
    const deadline = new Promise<never>((_, reject) => {
      timer = setTimeout(() => { controller.abort(); reject(new Error('Timeout')); }, TIMEOUT_MS);
    });
    const request = fetch(endpoint, {
      method: 'POST', redirect: 'error', signal: controller.signal,
      headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json', 'X-Request-Id': randomUUID() },
      body: JSON.stringify({ to: email, subject, text: message }),
    }).then(async response => {
      if (!response.ok || response.status < 200 || response.status >= 300) {
        recordEmailEvent('failed', 'vercel_smtp', 'provider_rejected', response.status);
        throw new EmailDeliveryError();
      }
      try {
        const data: unknown = JSON.parse(await limitedProviderBody(response, controller.signal));
        if (!data || typeof data !== 'object' || (data as { success?: unknown }).success !== true) throw new Error();
      } catch {
        recordEmailEvent('failed', 'vercel_smtp', controller.signal.aborted ? 'timeout' : 'invalid_response', response.status);
        throw new EmailDeliveryError();
      }
      recordEmailEvent('accepted', 'vercel_smtp', 'accepted', response.status);
      return 'vercel-relay-accepted';
    });
    return await Promise.race([request, deadline]);
  } catch (error) {
    if (error instanceof EmailDeliveryError) throw error;
    recordEmailEvent('failed', 'vercel_smtp', controller.signal.aborted ? 'timeout' : 'network');
    throw new EmailDeliveryError();
  } finally { if (timer) clearTimeout(timer); }
}

export async function sendEmail(email: string, subject: string, message: string): Promise<string> {
  if (!address(email) || !subject?.trim() || /[\r\n\x00-\x1f\x7f]/.test(subject) || !message?.trim()) {
    throw new Error('Invalid email input');
  }

  const provider = process.env.EMAIL_PROVIDER || 'resend';
  if (provider === 'vercel_smtp') return sendViaVercelRelay(email, subject, message);
  if (provider === 'smtp') {
    const { SMTP_HOST, SMTP_PORT, SMTP_USER, SMTP_PASSWORD, SMTP_FROM } = process.env;
    const port = SMTP_PORT ? Number(SMTP_PORT) : 587;
    if (!configured(SMTP_HOST) || !configured(SMTP_USER) || !configured(SMTP_PASSWORD) || !address(SMTP_FROM) || !Number.isInteger(port) || port < 1 || port > 65535) {
      recordEmailEvent('failed', 'smtp', 'configuration');
      throw new Error('SMTP is not configured');
    }
    try {
      const transporter = nodemailer.createTransport({
        host: SMTP_HOST, port, secure: port === 465,
        auth: { user: SMTP_USER, pass: SMTP_PASSWORD },
        connectionTimeout: TIMEOUT_MS, greetingTimeout: TIMEOUT_MS, socketTimeout: TIMEOUT_MS,
      });
      const result = await transporter.sendMail({ from: SMTP_FROM, to: email, subject, text: message });
      if (typeof result.messageId !== 'string' || !result.messageId.trim()) throw new Error();
      recordEmailEvent('accepted', 'smtp', 'accepted');
      return result.messageId;
    } catch {
      recordEmailEvent('failed', 'smtp', 'provider_rejected');
      throw new EmailDeliveryError();
    }
  }

  if (provider !== 'resend') throw new Error('Email provider is not configured');
  const { RESEND_API_KEY } = process.env;
  const RESEND_FROM = process.env.RESEND_FROM?.trim() || DEFAULT_RESEND_FROM;
  if (!isResendConfigured(process.env)) {
    recordEmailEvent('failed', 'resend', 'configuration');
    throw new Error('Resend is not configured');
  }

  const controller = new AbortController();
  let timer: ReturnType<typeof setTimeout> | undefined;
  try {
    const deadline = new Promise<never>((_, reject) => {
      timer = setTimeout(() => { controller.abort(); reject(new Error('Timeout')); }, TIMEOUT_MS);
    });
    const request = async () => {
      const response = await fetch('https://api.resend.com/emails', {
        method: 'POST', redirect: 'error', signal: controller.signal,
        headers: {
          Authorization: `Bearer ${RESEND_API_KEY}`,
          'Content-Type': 'application/json',
          'Idempotency-Key': randomUUID(),
        },
        body: JSON.stringify({ from: RESEND_FROM, to: [email], subject, text: message }),
      });
      if (!response.ok || response.status < 200 || response.status >= 300) {
        let restricted = false;
        if (response.status === 403 || response.status === 422) {
          try {
            const text = await limitedProviderBody(response, controller.signal);
            if (text.length <= 4096) {
              const data: unknown = JSON.parse(text);
              if (data && typeof data === 'object') {
                const { name, message } = data as { name?: unknown; message?: unknown };
                restricted = typeof name === 'string' && /^(validation_error|restricted_recipient|invalid_from_address)$/i.test(name)
                  && typeof message === 'string' && message.length <= 2048
                  && (/only send testing emails to your own email address/i.test(message) || /verify a domain/i.test(message) && /send emails/i.test(message));
              }
            }
          } catch { /* Provider body is untrusted. */ }
        }
        recordEmailEvent('failed', 'resend', restricted ? 'recipient_restricted' : 'provider_rejected', response.status);
        throw new EmailDeliveryError(restricted ? 'EMAIL_RECIPIENT_RESTRICTED' : 'EMAIL_DELIVERY_UNAVAILABLE');
      }
      let data: unknown;
      try {
        data = JSON.parse(await limitedProviderBody(response, controller.signal));
        if (!data || typeof data !== 'object' || !('id' in data) || typeof data.id !== 'string' || !data.id.trim() || /[\r\n\x00-\x1f\x7f]/.test(data.id)) throw new Error();
      } catch {
        recordEmailEvent('failed', 'resend', controller.signal.aborted ? 'timeout' : 'invalid_response', response.status);
        throw new EmailDeliveryError();
      }
      recordEmailEvent('accepted', 'resend', 'accepted', response.status);
      return data.id;
    };
    return await Promise.race([request(), deadline]);
  } catch (error) {
    if (error instanceof EmailDeliveryError) throw error;
    recordEmailEvent('failed', 'resend', controller.signal.aborted ? 'timeout' : 'network');
    throw new EmailDeliveryError();
  } finally {
    if (timer) clearTimeout(timer);
  }
}
