import { describe, it, expect } from 'vitest';
import { validateUpload, parseStorageReference, deleteMedia, storageCredentials } from './storage.ts';

describe('private storage policy', () => {
  it('rejects executable and oversized uploads', () => {
    expect(() => validateUpload({ name: 'evil.js', mimetype: 'application/javascript', size: 10 })).toThrow();
    expect(() => validateUpload({ name: 'large.pdf', mimetype: 'application/pdf', size: 51 * 1024 * 1024 })).toThrow();
  });
  it('does not accept arbitrary external URLs as owned storage', () => {
    expect(parseStorageReference('https://example.com/uploads/evil.pdf')).toBeNull();
    expect(parseStorageReference('storage://course-content/../escape.pdf')).toBeNull();
  });
  it('refuses to delete legacy or attacker-controlled URLs', async () => {
    await expect(deleteMedia('/uploads/legacy.pdf')).rejects.toThrow('Legacy or invalid');
  });
  it('prefers the server-only secret key and retains the legacy service-role fallback', () => {
    const url = 'https://project.supabase.co';
    expect(storageCredentials({ SUPABASE_URL: url, SUPABASE_SECRET_KEY: 'new-secret', SUPABASE_SERVICE_ROLE_KEY: 'legacy-key' })).toEqual({ url, key: 'new-secret' });
    expect(storageCredentials({ SUPABASE_URL: url, SUPABASE_SERVICE_ROLE_KEY: 'legacy-key' })).toEqual({ url, key: 'legacy-key' });
  });
  it('fails closed without usable server credentials and does not echo secrets', () => {
    expect(() => storageCredentials({ SUPABASE_URL: 'https://project.supabase.co', SUPABASE_SECRET_KEY: '  ' })).toThrow('Supabase Storage is not configured');
    expect(() => storageCredentials({ SUPABASE_SECRET_KEY: 'sensitive-secret' })).toThrow('Supabase Storage is not configured');
  });
});
