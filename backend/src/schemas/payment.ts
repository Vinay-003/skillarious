export interface CreatePaymentRequest { courseId: string }
export interface VerifyPaymentRequest { orderId: string; courseId?: string }
export interface PaymentOrderResponse { success: boolean; orderId: string; approvalUrl: string; currency: 'USD' }
export interface PaymentVerificationResponse { success: boolean; message: string; data?: { transactionId: string; status: string } }

const uuid = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
const orderId = /^[A-Za-z0-9-]{6,128}$/;
export function validateCreatePaymentRequest(req: { body?: Record<string, unknown> }) {
  const body = req.body;
  return body && Object.keys(body).length === 1 && typeof body.courseId === 'string' && uuid.test(body.courseId)
    ? { isValid: true } : { isValid: false, error: 'A valid courseId is required; price is determined by the server' };
}
export function validateVerifyPaymentRequest(req: { body?: Record<string, unknown> }) {
  const body = req.body;
  return body && Object.keys(body).every(k => k === 'orderId' || k === 'courseId') &&
    typeof body.orderId === 'string' && orderId.test(body.orderId) &&
    (body.courseId === undefined || typeof body.courseId === 'string' && uuid.test(body.courseId))
    ? { isValid: true } : { isValid: false, error: 'A valid orderId is required' };
}
