import { randomUUID } from 'node:crypto';

export class PaymentUnavailable extends Error {}
export class PaymentRejected extends Error {}

export function paypalMode(env: NodeJS.ProcessEnv | Record<string, string | undefined> = process.env) {
  if (env.PAYPAL_MODE === 'live') {
    if (env.PAYPAL_ENABLE_LIVE !== 'true') throw new PaymentUnavailable('Live payments are disabled');
    return 'live';
  }
  return 'sandbox';
}

type Capture = { id?: string; status?: string; amount?: { value?: string; currency_code?: string }; supplementary_data?: { related_ids?: { order_id?: string } } };
type Order = { id?: string; status?: string; purchase_units?: Array<{ payee?: { merchant_id?: string }; amount?: { value?: string; currency_code?: string }; payments?: { captures?: Capture[] } }> };

export function assertCaptureMatches(order: Order, intent: { orderId: string; amount: string; currency: string; merchantId: string }): Capture & { id: string } {
  const units = order.purchase_units;
  const unit = units?.[0];
  const captures = unit?.payments?.captures;
  const capture = captures?.[0];
  if (order.id !== intent.orderId || order.status !== 'COMPLETED' || units?.length !== 1 ||
      unit?.payee?.merchant_id !== intent.merchantId ||
      (unit.amount && (unit.amount.value !== intent.amount || unit.amount.currency_code !== intent.currency)) ||
      captures?.length !== 1 || !capture?.id || capture.status !== 'COMPLETED' ||
      capture.amount?.value !== intent.amount || capture.amount.currency_code !== intent.currency ||
      (capture.supplementary_data?.related_ids?.order_id && capture.supplementary_data.related_ids.order_id !== intent.orderId)) {
    throw new PaymentRejected('PayPal capture does not match the stored order');
  }
  return capture as Capture & { id: string };
}

export function assertRefundMatches(refund: { id?: string; status?: string; amount?: { value?: string; currency_code?: string } }, amount: string, currency: string) {
  return !!refund.id && refund.status === 'COMPLETED' && refund.amount?.value === amount && refund.amount?.currency_code === currency;
}

export class PaymentService {
  private static base() {
    return paypalMode() === 'live' ? 'https://api-m.paypal.com' : 'https://api-m.sandbox.paypal.com';
  }

  private static credentials() {
    const id = process.env.PAYPAL_CLIENT_ID?.trim();
    const secret = process.env.PAYPAL_CLIENT_SECRET?.trim();
    const merchantId = process.env.PAYPAL_MERCHANT_ID?.trim();
    if (!id || !secret || !merchantId) throw new PaymentUnavailable('PayPal checkout is not configured');
    return { id, secret, merchantId };
  }

  static config() {
    const { id } = this.credentials();
    return { clientId: id, mode: paypalMode(), currency: 'USD' };
  }

  private static async token() {
    const { id, secret } = this.credentials();
    const response = await fetch(`${this.base()}/v1/oauth2/token`, {
      method: 'POST', headers: { Authorization: `Basic ${Buffer.from(`${id}:${secret}`).toString('base64')}`, 'Content-Type': 'application/x-www-form-urlencoded' },
      body: 'grant_type=client_credentials', signal: AbortSignal.timeout(10000),
    });
    if (!response.ok) throw new PaymentUnavailable('PayPal is unavailable');
    const data = await response.json() as { access_token?: string };
    if (!data.access_token) throw new PaymentUnavailable('PayPal is unavailable');
    return data.access_token;
  }

  private static async request(path: string, method: string, body?: object, requestId?: string) {
    const token = await this.token();
    const response = await fetch(`${this.base()}${path}`, {
      method,
      headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json', Prefer: 'return=representation', ...(requestId ? { 'PayPal-Request-Id': requestId } : {}) },
      ...(body ? { body: JSON.stringify(body) } : {}), signal: AbortSignal.timeout(15000),
    });
    if (!response.ok) throw new PaymentUnavailable('PayPal request could not be completed');
    return response.json();
  }

  static merchantId() { return this.credentials().merchantId; }

  static async createOrder(amount: string, intentId: string) {
    const frontend = new URL(process.env.FRONTEND_URL || 'http://localhost:4002');
    if (!['http:', 'https:'].includes(frontend.protocol) || frontend.username || frontend.password || (paypalMode() === 'live' && frontend.protocol !== 'https:')) throw new PaymentUnavailable('Checkout return URL is not configured');
    return this.request('/v2/checkout/orders', 'POST', {
      intent: 'CAPTURE', purchase_units: [{ reference_id: intentId, amount: { currency_code: 'USD', value: amount }, payee: { merchant_id: this.merchantId() } }],
      payment_source: { paypal: { experience_context: { brand_name: 'Skillarious', user_action: 'PAY_NOW', return_url: `${frontend.origin}/payments/result`, cancel_url: `${frontend.origin}/payments/result?cancel=true` } } },
    }, intentId) as Promise<Order & { links?: Array<{ rel: string; href: string }> }>;
  }

  static async captureOrder(orderId: string) {
    return this.request(`/v2/checkout/orders/${encodeURIComponent(orderId)}/capture`, 'POST', {}, orderId) as Promise<Order>;
  }

  static async getOrder(orderId: string) {
    return this.request(`/v2/checkout/orders/${encodeURIComponent(orderId)}`, 'GET') as Promise<Order>;
  }

  static async refund(captureId: string, amount: string, requestId: string) {
    return this.request(`/v2/payments/captures/${encodeURIComponent(captureId)}/refund`, 'POST', { amount: { currency_code: 'USD', value: amount } }, requestId) as Promise<{ id?: string; status?: string; amount?: { value?: string; currency_code?: string } }>;
  }

  static newIntentId() { return randomUUID(); }
}
