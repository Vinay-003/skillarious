import { describe, expect, it } from 'vitest';
import { assertSeedPermission, assertFixtureRows, mediaReference, safeSeedError, isExistingObject } from './seedDemoCore.ts';

describe('demo seed safety', () => {
  it('requires explicit opt in and real configuration', () => {
    expect(() => assertSeedPermission({ DATABASE_URL: 'postgres://host/db', SUPABASE_URL: 'https://example.supabase.co', SUPABASE_SECRET_KEY: 'key' })).toThrow();
    expect(() => assertSeedPermission({ ALLOW_DEMO_SEED: 'true', DATABASE_URL: 'postgres://host/db', SUPABASE_URL: 'https://example.supabase.co', SUPABASE_SECRET_KEY: 'key' })).not.toThrow();
  });
  it('accepts exact fixture identity but rejects an occupied identity', () => {
    const fixture = [{ id: 'a', email: 'a@example.test', name: 'Demo', role: 'user' }];
    expect(() => assertFixtureRows('users', fixture, fixture, ['id', 'email', 'name', 'role'])).not.toThrow();
    expect(() => assertFixtureRows('users', fixture, [{ ...fixture[0], name: 'Someone else' }], ['id', 'email', 'name', 'role'])).toThrow();
  });
  it('uses valid private references and HTTPS public URLs', () => {
    expect(mediaReference('course-content', 'demo/v1/lesson.pdf', false, '')).toBe('storage://course-content/demo/v1/lesson.pdf');
    expect(mediaReference('public-assets', 'demo/v1/cover.png', true, 'https://project.supabase.co/storage/v1/object/public/public-assets/demo/v1/cover.png')).toMatch(/^https:/);
    expect(() => mediaReference('course-content', '../bad.pdf', false, '')).toThrow();
  });
  it('does not leak provider errors or mistake unrelated errors for an existing object', () => {
    expect(safeSeedError(new Error('postgres://user:password@host'))).not.toContain('password');
    expect(isExistingObject({ statusCode: '409', error: 'Duplicate' })).toBe(true);
    expect(isExistingObject({ statusCode: '403', error: 'Forbidden' })).toBe(false);
  });
});
