import { timingSafeEqual } from 'node:crypto';
import nodemailer from 'nodemailer';
import { NextRequest, NextResponse } from 'next/server';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';
export const maxDuration = 15;

const EMAIL = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
const MAX_SUBJECT = 200;
const MAX_TEXT = 10_000;

function matchesSecret(received: string | null, expected: string | undefined): boolean {
  if (!received || !expected) return false;
  const left = Buffer.from(received);
  const right = Buffer.from(expected);
  return left.length === right.length && timingSafeEqual(left, right);
}

function json(status: number, body: { success: boolean; message: string }) {
  return NextResponse.json(body, { status, headers: { 'Cache-Control': 'no-store' } });
}

export async function POST(request: NextRequest) {
  if (!matchesSecret(request.headers.get('authorization')?.replace(/^Bearer\s+/i, '') ?? null, process.env.EMAIL_RELAY_TOKEN)) {
    return json(401, { success: false, message: 'Unauthorized' });
  }

  let body: unknown;
  try { body = await request.json(); } catch { return json(400, { success: false, message: 'Invalid request' }); }
  if (!body || typeof body !== 'object') return json(400, { success: false, message: 'Invalid request' });
  const input = body as { to?: unknown; subject?: unknown; text?: unknown };
  const to = typeof input.to === 'string' ? input.to.trim() : '';
  const subject = typeof input.subject === 'string' ? input.subject.trim() : '';
  const text = typeof input.text === 'string' ? input.text : '';
  if (!EMAIL.test(to) || to.length > 254 || /[\r\n\x00-\x1f\x7f]/.test(to) || !subject || subject.length > MAX_SUBJECT || /[\r\n\x00-\x1f\x7f]/.test(subject) || !text || text.length > MAX_TEXT) {
    return json(400, { success: false, message: 'Invalid request' });
  }

  const user = process.env.SMTP_USER?.trim();
  const password = process.env.SMTP_PASSWORD;
  const host = process.env.SMTP_HOST?.trim() || 'smtp.gmail.com';
  const port = Number(process.env.SMTP_PORT || 587);
  const from = process.env.SMTP_FROM?.trim() || user;
  if (!user || !password || !from || !Number.isInteger(port) || ![465, 587].includes(port)) {
    return json(503, { success: false, message: 'Email relay unavailable' });
  }

  try {
    const transporter = nodemailer.createTransport({
      host,
      port,
      secure: port === 465,
      requireTLS: port === 587,
      auth: { user, pass: password },
      connectionTimeout: 10_000,
      greetingTimeout: 10_000,
      socketTimeout: 10_000,
      tls: { minVersion: 'TLSv1.2' },
    });
    await transporter.sendMail({ from, to, subject, text });
    return json(202, { success: true, message: 'Accepted for sending' });
  } catch {
    console.error(JSON.stringify({ event: 'smtp_relay_failed', provider: 'smtp', port }));
    return json(503, { success: false, message: 'Email relay unavailable' });
  }
}
