import { parseStorageReference } from '../src/utils/storage.ts';

export function assertSeedPermission(env: NodeJS.ProcessEnv) {
  if (env.ALLOW_DEMO_SEED !== 'true') throw new Error('Demo seed requires ALLOW_DEMO_SEED=true');
  if (!env.DATABASE_URL || !env.SUPABASE_URL || !(env.SUPABASE_SECRET_KEY || env.SUPABASE_SERVICE_ROLE_KEY)) throw new Error('Demo seed requires configured Postgres and Supabase Storage');
  if (!/^https:\/\//.test(env.SUPABASE_URL)) throw new Error('Supabase URL must use HTTPS');
  if (env.DEMO_SEED_PASSWORD && env.DEMO_SEED_PASSWORD.length < 8) throw new Error('Demo password must be at least 8 characters');
}

export function assertFixtureRows<T extends Record<string, unknown>>(table: string, fixture: T[], existing: T[], identity: (keyof T)[]) {
  for (const row of existing) {
    const match = fixture.find(item => item.id === row.id || (table === 'users' && item.email === row.email));
    if (!match || identity.some(key => match[key] !== row[key])) throw new Error(`Demo seed identity conflict in ${table}`);
  }
}

export function mediaReference(bucket: string, key: string, isPublic: boolean, publicUrl: string) {
  const reference = `storage://${bucket}/${key}`;
  if (!parseStorageReference(reference)) throw new Error('Invalid demo media reference');
  if (!isPublic) return reference;
  if (!/^https:\/\//.test(publicUrl)) throw new Error('Public demo media URL must be HTTPS');
  return publicUrl;
}

export function isExistingObject(error: { statusCode?: string | number; error?: string } | null) {
  const detail = [error?.error, (error as { message?: string } | null)?.message].filter(Boolean).join(' ');
  return String(error?.statusCode) === '409' && /duplicate|already exists|resource already exists/i.test(detail);
}

export function safeSeedError(_error: unknown) {
  return 'Demo seed failed; inspect configuration, fixture identity conflicts, and storage permissions (provider details withheld).';
}
