import { mkdir, writeFile } from 'node:fs/promises';
import { randomBytes } from 'node:crypto';
const headers = 'country_code,account_type,primary_email_alias,password,first_name,last_name,ppBalance,addBank,ccType,payment_card';
const stamp = Date.now().toString(36);
const cards = ['VISA', 'MASTERCARD', 'AMEX', 'VISA'];
const rows = Array.from({ length: 10 }, (_, index) => {
  const business = index < 4;
  return ['US', business ? 'BUSINESS' : 'PERSONAL', `skillarious-${business ? 'seller' : 'buyer'}-${index + 1}-${stamp}@${business ? 'business' : 'personal'}.example.com`, randomBytes(10).toString('base64url') + 'Aa1!', business ? 'Studio' : 'Student', `Test${index + 1}`, String(1000 + index), index % 2 ? 'N' : 'Y', cards[index % cards.length], 'PAYPAL'].join(',');
});
await mkdir('../reports/private', { recursive: true });
await writeFile('../reports/private/paypal-sandbox-accounts.csv', [headers, ...rows].join('\r\n') + '\r\n', { mode: 0o600, flag: 'wx' });
console.log('Created reports/private/paypal-sandbox-accounts.csv: 4 US BUSINESS sellers and 6 US PERSONAL buyers. Accounts are not created until imported in PayPal.');
