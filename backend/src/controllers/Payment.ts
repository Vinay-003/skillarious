import { Request, Response } from 'express';
import { and, desc, eq, sql } from 'drizzle-orm';
import { db } from '../db/index.ts';
import { coursesTable, transactionsTable, usersTable } from '../db/schema.ts';
import { paypalOrdersTable } from '../db/paymentSchema.ts';
import { assertCaptureMatches, assertRefundMatches, PaymentRejected, PaymentService, PaymentUnavailable } from '../utils/paymentService.ts';

type AuthRequest = Request & { user?: { id: string; isAdmin?: boolean; role?: string } };
const failure = (res: Response, error: unknown) => {
  if (error instanceof PaymentUnavailable) return res.status(503).json({ success: false, message: error.message });
  if (error instanceof PaymentRejected) return res.status(409).json({ success: false, message: error.message });
  console.error('Payment operation failed');
  return res.status(500).json({ success: false, message: 'Payment operation failed' });
};

export const getPaymentConfig = (_req: Request, res: Response) => {
  try { return res.json({ success: true, ...PaymentService.config() }); }
  catch (error) { return failure(res, error); }
};

export const createPayment = async (req: AuthRequest, res: Response) => {
  const userId = req.user?.id;
  if (!userId) return res.status(401).json({ success: false, message: 'Authentication required' });
  try {
    // Fail closed before creating a pending intent when sandbox credentials are missing.
    const merchantId = PaymentService.merchantId();
    const [course] = await db.select().from(coursesTable).where(eq(coursesTable.id, req.body.courseId)).limit(1);
    if (!course || course.isDismissed) return res.status(404).json({ success: false, message: 'Course not available' });
    const amount = course.price;
    if (!/^\d+\.\d{2}$/.test(amount) || Number(amount) <= 0) return res.status(400).json({ success: false, message: 'Course is not purchasable' });
    const [existing] = await db.select({ id: transactionsTable.id }).from(transactionsTable).where(and(eq(transactionsTable.userId, userId), eq(transactionsTable.courseId, course.id), eq(transactionsTable.status, 'completed'))).limit(1);
    if (existing) return res.status(409).json({ success: false, message: 'Already enrolled' });
    const id = PaymentService.newIntentId();
    await db.insert(paypalOrdersTable).values({ id, userId, courseId: course.id, amount, currency: 'USD', merchantId });
    const order = await PaymentService.createOrder(amount, id);
    const approvalUrl = order.links?.find(link => link.rel === 'approve' || link.rel === 'payer-action')?.href;
    if (!order.id || !approvalUrl || order.purchase_units?.[0]?.payee?.merchant_id !== merchantId || order.purchase_units?.[0]?.amount?.value !== amount || order.purchase_units?.[0]?.amount?.currency_code !== 'USD') throw new PaymentUnavailable('PayPal order could not be verified');
    await db.update(paypalOrdersTable).set({ orderId: order.id, status: 'pending' }).where(eq(paypalOrdersTable.id, id));
    return res.status(201).json({ success: true, orderId: order.id, approvalUrl, currency: 'USD' });
  } catch (error) { return failure(res, error); }
};

export const verifyPayment = async (req: AuthRequest, res: Response) => {
  const userId = req.user?.id;
  if (!userId) return res.status(401).json({ success: false, message: 'Authentication required' });
  try {
    const [intent] = await db.select().from(paypalOrdersTable).where(and(eq(paypalOrdersTable.orderId, req.body.orderId), eq(paypalOrdersTable.userId, userId))).limit(1);
    if (!intent || req.body.courseId && req.body.courseId !== intent.courseId) return res.status(404).json({ success: false, message: 'Order not found' });
    if (intent.status === 'refunded') return res.status(409).json({ success: false, message: 'Order refunded' });
    if (intent.status !== 'pending' && intent.status !== 'completed' && intent.status !== 'capture_unknown') return res.status(409).json({ success: false, message: 'Order not ready' });
    const transaction = await db.transaction(async tx => {
      // Serialize every order for this student/course, including alternate pending orders.
      await tx.execute(sql`SELECT pg_advisory_xact_lock(hashtext(${userId}), hashtext(${intent.courseId}))`);
      await tx.execute(sql`SELECT id FROM paypal_orders WHERE id = ${intent.id} FOR UPDATE`);
      const [current] = await tx.select().from(paypalOrdersTable).where(eq(paypalOrdersTable.id, intent.id)).limit(1);
      if (current.status === 'refunded') throw new PaymentRejected('Order refunded');
      if (current.status === 'completed' && current.transactionId && current.captureId) return current.transactionId;
      if (current.status !== 'pending' && current.status !== 'capture_unknown') throw new PaymentRejected('Order not ready');
      const [prior] = await tx.select({ id: transactionsTable.id }).from(transactionsTable).where(and(eq(transactionsTable.userId, userId), eq(transactionsTable.courseId, intent.courseId), eq(transactionsTable.status, 'completed'))).limit(1);
      if (prior) throw new PaymentRejected('Already enrolled');
      let order = await PaymentService.getOrder(req.body.orderId);
      if (current.status === 'capture_unknown' && order.status !== 'COMPLETED') throw new PaymentUnavailable('Capture outcome unknown; reconcile the order before retrying');
      if (order.status !== 'COMPLETED') {
        try { order = await PaymentService.captureOrder(req.body.orderId); }
        catch {
          // Commit the uncertainty while holding the intent lock. A retry must inspect
          // the provider, not issue another capture on an ambiguous outcome.
          await tx.update(paypalOrdersTable).set({ status: 'capture_unknown' }).where(eq(paypalOrdersTable.id, intent.id));
          return null;
        }
      }
      const capture = assertCaptureMatches(order, { orderId: req.body.orderId, amount: current.amount, currency: current.currency, merchantId: current.merchantId });
      if (current.captureId && current.captureId !== capture.id) throw new PaymentRejected('Order capture mismatch');
      const [created] = await tx.insert(transactionsTable).values({ userId, courseId: intent.courseId, amount: intent.amount, date: new Date(), status: 'completed', paymentId: `PAYPAL:${capture.id}` }).returning();
      await tx.update(paypalOrdersTable).set({ captureId: capture.id, transactionId: created.id, status: 'completed' }).where(eq(paypalOrdersTable.id, intent.id));
      return created.id;
    });
    if (!transaction) throw new PaymentUnavailable('Capture outcome unknown; reconcile the order before retrying');
    return res.json({ success: true, message: 'Payment verified', data: { transactionId: transaction, status: 'completed' } });
  } catch (error) { return failure(res, error); }
};

export const getTransactionHistory = async (req: AuthRequest, res: Response) => {
  if (!req.user?.id) return res.status(401).json({ success: false, message: 'Authentication required' });
  try {
    const data = await db.select({ id: transactionsTable.id, amount: transactionsTable.amount, status: transactionsTable.status, date: transactionsTable.date, courseName: coursesTable.name }).from(transactionsTable).innerJoin(coursesTable, eq(transactionsTable.courseId, coursesTable.id)).where(eq(transactionsTable.userId, req.user.id)).orderBy(desc(transactionsTable.date));
    return res.json({ success: true, data });
  } catch (error) { return failure(res, error); }
};

export const refundPayment = async (req: AuthRequest, res: Response) => {
  if (!req.user?.id) return res.status(401).json({ success: false, message: 'Authentication required' });
  try {
    const [admin] = await db.select({ isAdmin: usersTable.isAdmin }).from(usersTable).where(eq(usersTable.id, req.user.id)).limit(1);
    if (!admin?.isAdmin) return res.status(403).json({ success: false, message: 'Admin required' });
    const { orderId } = req.body ?? {};
    if (typeof orderId !== 'string' || !/^[A-Za-z0-9-]{6,128}$/.test(orderId) || Object.keys(req.body).some(k => k !== 'orderId')) return res.status(400).json({ success: false, message: 'Only orderId is accepted' });
    const result = await db.transaction(async tx => {
      const [intent] = await tx.select().from(paypalOrdersTable).where(eq(paypalOrdersTable.orderId, orderId)).limit(1);
      if (!intent) throw new PaymentRejected('No refundable capture');
      await tx.execute(sql`SELECT pg_advisory_xact_lock(hashtext(${intent.userId}), hashtext(${intent.courseId}))`);
      await tx.execute(sql`SELECT id FROM paypal_orders WHERE id = ${intent.id} FOR UPDATE`);
      const [current] = await tx.select().from(paypalOrdersTable).where(eq(paypalOrdersTable.id, intent.id)).limit(1);
      if (!current?.captureId || !current.transactionId || current.status !== 'completed') throw new PaymentRejected('No refundable capture');
      const [paid] = await tx.select().from(transactionsTable).where(and(eq(transactionsTable.id, current.transactionId), eq(transactionsTable.paymentId, `PAYPAL:${current.captureId}`), eq(transactionsTable.status, 'completed'))).limit(1);
      if (!paid || paid.userId !== current.userId || paid.courseId !== current.courseId || paid.amount !== current.amount) throw new PaymentRejected('No refundable capture');
       let refund;
       try { refund = await PaymentService.refund(current.captureId, current.amount, current.id); }
       catch {
         await tx.update(paypalOrdersTable).set({ status: 'refund_unknown' }).where(eq(paypalOrdersTable.id, current.id));
         return null;
       }
       if (!assertRefundMatches(refund, current.amount, current.currency)) {
         // Preserve enrollment and commit uncertainty; a retry must not issue a
         // second refund after a timeout or a pending/mismatched provider result.
         await tx.update(paypalOrdersTable).set({ status: 'refund_unknown' }).where(eq(paypalOrdersTable.id, current.id));
         return null;
       }
      await tx.update(transactionsTable).set({ status: 'refunded', refundDate: new Date() }).where(eq(transactionsTable.id, paid.id));
      await tx.update(paypalOrdersTable).set({ status: 'refunded' }).where(eq(paypalOrdersTable.id, current.id));
      return refund;
    });
     if (!result) throw new PaymentUnavailable('Refund outcome unknown; reconcile in PayPal before retrying');
     return res.json({ success: true, refundId: result.id, status: result.status });
  } catch (error) { return failure(res, error); }
};
