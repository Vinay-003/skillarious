export const RESTRICTED_EMAIL_MESSAGE = 'Resend’s default test sender works without a domain, but it can only send to the email address on your Resend account. Use that account email for testing, or verify a domain to send to other addresses.';

export class EmailDeliveryError extends Error {
  readonly code: 'EMAIL_RECIPIENT_RESTRICTED' | 'EMAIL_DELIVERY_UNAVAILABLE';
  constructor(code: 'EMAIL_RECIPIENT_RESTRICTED' | 'EMAIL_DELIVERY_UNAVAILABLE' = 'EMAIL_DELIVERY_UNAVAILABLE') {
    super(code === 'EMAIL_RECIPIENT_RESTRICTED' ? RESTRICTED_EMAIL_MESSAGE : 'Email delivery unavailable. Please try again later.');
    this.name = 'EmailDeliveryError';
    this.code = code;
  }
}

export function emailFailure(error: unknown) {
  return error instanceof EmailDeliveryError && error.code === 'EMAIL_RECIPIENT_RESTRICTED'
    ? { code: error.code, message: RESTRICTED_EMAIL_MESSAGE }
    : { code: 'EMAIL_DELIVERY_UNAVAILABLE', message: 'Email delivery unavailable. Please try again later.' };
}

export function recordEmailEvent(event: 'accepted' | 'failed', provider: 'resend' | 'smtp' | 'vercel_smtp', category: 'accepted' | 'recipient_restricted' | 'provider_rejected' | 'network' | 'timeout' | 'invalid_response' | 'configuration', status?: number) {
  // All arguments are internal allowlisted values; never include provider content or recipient identifiers.
  console.info(JSON.stringify({ event: `email_${event}`, provider, category, ...(status ? { status } : {}) }));
}
