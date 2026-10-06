import crypto from 'node:crypto';
import { and, desc, eq, gt, sql } from 'drizzle-orm';
import { db } from '../db/index.ts';
import { otpsTable } from '../db/schema.ts';
import { sendEmail } from './sendEmail.ts';

const normalized = (email: string) => email.trim().toLowerCase();

export async function issueOtp(email: string) {
  email = normalized(email);
  const previous = await db.select({ lastSent: otpsTable.lastSent }).from(otpsTable).where(eq(otpsTable.email, email)).orderBy(desc(otpsTable.lastSent)).limit(1);
  if (previous[0] && Date.now() - previous[0].lastSent.getTime() < 60_000) throw new Error('OTP_RATE_LIMIT');
  const code = crypto.randomInt(100000, 1000000);
  await sendEmail(email, 'Your verification code', `Your verification code is ${code}. It expires in 5 minutes.`);
  await db.transaction(async (tx) => {
    await tx.execute(sql`select pg_advisory_xact_lock(hashtext(${email}))`);
    const latest = await tx.select({ lastSent: otpsTable.lastSent }).from(otpsTable).where(eq(otpsTable.email, email)).orderBy(desc(otpsTable.lastSent)).limit(1);
    if (latest[0] && Date.now() - latest[0].lastSent.getTime() < 60_000) throw new Error('OTP_RATE_LIMIT');
    await tx.update(otpsTable).set({ expiry: new Date(0) }).where(and(eq(otpsTable.email, email), gt(otpsTable.expiry, new Date())));
    await tx.insert(otpsTable).values({ email, value: BigInt(code), expiry: new Date(Date.now() + 300_000), lastSent: new Date() });
  });
}

export async function consumeOtp(email: string, input: unknown, onConsumed?: (tx: Parameters<Parameters<typeof db.transaction>[0]>[0]) => Promise<void>): Promise<boolean> {
  email = normalized(email);
  if (typeof input !== 'string' || !/^\d{6}$/.test(input)) return false;
  return db.transaction(async (tx) => {
    await tx.execute(sql`select pg_advisory_xact_lock(hashtext(${email}))`);
    const [record] = await tx.select().from(otpsTable).where(and(eq(otpsTable.email, email), gt(otpsTable.expiry, new Date()))).orderBy(desc(otpsTable.lastSent)).limit(1);
    if (!record) return false;
    const stored = String(record.value);
    if (!/^\d{6}$/.test(stored) || !crypto.timingSafeEqual(Buffer.from(stored), Buffer.from(input))) return false;
    const deleted = await tx.delete(otpsTable).where(and(eq(otpsTable.id, record.id), gt(otpsTable.expiry, new Date()))).returning({ id: otpsTable.id });
    if (!deleted.length) return false;
    if (onConsumed) await onConsumed(tx);
    return true;
  });
}
