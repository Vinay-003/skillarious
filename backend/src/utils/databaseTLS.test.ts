import { expect, it } from 'vitest';
import { databaseTLS } from './databaseTLS.ts';
it('uses verified TLS for a remote database and never trusts sslmode=disable', () => {
  expect(databaseTLS({ DATABASE_URL: 'postgres://postgres:placeholder@db.example.test/postgres?sslmode=disable' })).toBe('verify-full');
});
it('allows a disposable local database without weakening remote settings', () => {
  expect(databaseTLS({ DATABASE_URL: 'postgres://localhost/skillarious' })).toBe(false);
});
it('fails closed if a configured certificate cannot be read', () => {
  expect(() => databaseTLS({ DATABASE_URL: 'postgres://db.example.test/postgres', DATABASE_SSL_CA_FILE: './missing-ca-file.crt' })).toThrow('readable PEM');
});
