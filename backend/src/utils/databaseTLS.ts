import { readFileSync } from 'node:fs';
import { rootCertificates } from 'node:tls';
import type { ConnectionOptions } from 'node:tls';

/** Never weaken remote TLS to work around a missing CA certificate. */
export function databaseTLS(env: NodeJS.ProcessEnv): false | 'verify-full' | ConnectionOptions {
  const url = new URL(env.DATABASE_URL || 'postgres://localhost/skillarious');
  if (['localhost', '127.0.0.1', '[::1]'].includes(url.hostname)) return false;
  if (!env.DATABASE_SSL_CA_FILE?.trim()) return 'verify-full';
  try {
    const ca = readFileSync(env.DATABASE_SSL_CA_FILE.trim(), 'utf8');
    if (!ca.includes('-----BEGIN CERTIFICATE-----')) throw new Error();
    return { rejectUnauthorized: true, ca: [...rootCertificates, ca] };
  } catch {
    throw new Error('DATABASE_SSL_CA_FILE must point to a readable PEM CA certificate');
  }
}
