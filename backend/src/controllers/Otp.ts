import type { Request, Response } from 'express';
import { eq } from 'drizzle-orm';
import { db } from '../db/index.ts';
import { usersTable } from '../db/schema.ts';
import { issueOtp, consumeOtp } from '../utils/otp.ts';
import { generateAccessToken, generateRefreshToken } from '../utils/generateToken.ts';
import { normalizeEmail, validEmail } from './Auth.ts';
import { emailFailure } from '../utils/emailErrors.ts';

export async function generateOtp(req: Request, res: Response) {
  try {
    const email = normalizeEmail(req.body?.email);
    if (!validEmail(email)) return res.status(400).json({ success: false, message: 'Valid email is required' });
    const [user] = await db.select({ id: usersTable.id, verified: usersTable.verified, isBanned: usersTable.isBanned }).from(usersTable).where(eq(usersTable.email, email)).limit(1);
    if (user && !user.verified && !user.isBanned) await issueOtp(email);
    return res.json({ success: true, message: 'If eligible, a verification email was accepted for sending.' });
  } catch (error) {
    if (error instanceof Error && error.message === 'OTP_RATE_LIMIT') return res.status(429).json({ success: false, message: 'Try again in one minute' });
    return res.status(503).json({ success: false, ...emailFailure(error) });
  }
}

export async function verifyOtp(req: Request, res: Response) {
  try {
    const email = normalizeEmail(req.body?.email);
    if (!validEmail(email)) return res.status(400).json({ success: false, message: 'Invalid or expired code' });
    const [user] = await db.select().from(usersTable).where(eq(usersTable.email, email)).limit(1);
    if (!user || user.isBanned) return res.status(400).json({ success: false, message: 'Invalid or expired code' });
    if (user.verified) return res.status(400).json({ success: false, code: 'EMAIL_ALREADY_VERIFIED', message: 'Email already verified. Please sign in.' });
    const accessToken = generateAccessToken(user.id, user.email);
    const refreshToken = generateRefreshToken(user.id);
    if (!await consumeOtp(email, req.body?.otp, async (tx) => {
      const changed = await tx.update(usersTable).set({ verified: true, refreshToken }).where(eq(usersTable.id, user.id)).returning({ id: usersTable.id });
      if (!changed.length) throw new Error('User update failed');
    })) return res.status(400).json({ success: false, message: 'Invalid or expired code' });
    return res.json({ success: true, message: 'OTP verified successfully', accessToken, refreshToken });
  } catch { return res.status(500).json({ success: false, message: 'Unable to verify code' }); }
}
