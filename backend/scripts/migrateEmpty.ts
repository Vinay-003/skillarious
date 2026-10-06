/** Explicit, transactional bootstrap for a confirmed EMPTY Supabase project only. */
import { config } from 'dotenv';
import { readFile } from 'node:fs/promises';
import { createHash } from 'node:crypto';
import postgres from 'postgres';
import { databaseTLS } from '../src/utils/databaseTLS.ts';

config({ path: '.env.local' });

export const files = ['0000_empty_schema.sql', '0001_empty_security_storage.sql'] as const;
export class BootstrapRefusal extends Error {}
const expectedTables = ['admin_invites','admin_logs','category_courses','category','content','courses','doubts','educators','files','messages','modules','otps','reviews','transactions','users','paypal_orders','admin_reports','course_history','course_likes','educator_subscriptions','playlist_courses','playlists'];
export function projectRef(databaseUrl: string): string | null {
  const url = new URL(databaseUrl);
  const direct = /^db\.([a-z0-9]+)\.supabase\.co$/.exec(url.hostname);
  const pooler = /^postgres\.([a-z0-9]+)$/.exec(decodeURIComponent(url.username));
  return direct?.[1] || (url.hostname.endsWith('.pooler.supabase.com') ? pooler?.[1] : null) || null;
}

export async function run(argv = process.argv.slice(2)) {
  const [mode, confirmation] = argv;
  if (!['check', 'apply'].includes(mode) || !/^--project-ref=[a-z0-9]+$/.test(confirmation || ''))
    throw new BootstrapRefusal('Usage: tsx scripts/migrateEmpty.ts check|apply --project-ref=<confirmed Supabase ref>');
  const ref = confirmation.split('=')[1];
  if (process.env.CONFIRMED_EMPTY_PROJECT_REF !== ref || !process.env.DATABASE_URL || !process.env.SUPABASE_URL)
    throw new BootstrapRefusal('Set CONFIRMED_EMPTY_PROJECT_REF, DATABASE_URL, and SUPABASE_URL for the same target');
  if (projectRef(process.env.DATABASE_URL) !== ref || new URL(process.env.SUPABASE_URL).hostname !== `${ref}.supabase.co`)
    throw new BootstrapRefusal('Database URL, Supabase URL, and confirmed project ref do not agree');

  const migrations = await Promise.all(files.map(async name => {
    const body = await readFile(new URL(`../sql/${name}`, import.meta.url), 'utf8');
    return { name, body: body.replace(/--> statement-breakpoint/g, ''), checksum: createHash('sha256').update(body).digest('hex') };
  }));
  const sql = postgres(process.env.DATABASE_URL, { max: 1, prepare: false, connect_timeout: 8, ssl: databaseTLS(process.env) });
  try {
    await sql.begin(async tx => {
      await tx`SET LOCAL search_path = public, pg_catalog`;
      await tx`SET LOCAL lock_timeout = '30s'`;
      await tx`SET LOCAL statement_timeout = '30s'`;
      await tx`SELECT pg_advisory_xact_lock(182734, 1)`;
      // Fail closed: do not delete or overwrite preexisting storage policies.
      const policies = await tx<{ policyname: string }[]>`SELECT policyname FROM pg_policies WHERE schemaname = 'storage' AND tablename IN ('objects', 'buckets')`;
      if (policies.length) throw new BootstrapRefusal(`${policies.length} storage policies already exist; inspect them before bootstrap`);
      const existing = await tx<{ journal: string | null }[]>`SELECT to_regclass('public.empty_bootstrap_journal') AS journal`;
      const hasJournal = existing[0]?.journal !== null;
      const rows = hasJournal ? await tx<{ name: string; checksum: string }[]>`SELECT name, checksum FROM public.empty_bootstrap_journal ORDER BY name` : [];
      if (rows.length) {
        if (rows.length !== migrations.length || rows.some((row, i) => row.name !== migrations[i].name || row.checksum !== migrations[i].checksum))
          throw new BootstrapRefusal('Bootstrap journal mismatch; manual inspection required');
        await verify(tx);
        console.log(`Project ${ref}: journal checksums, tables/RLS and buckets verified; no changes`);
        return;
      }
      if (hasJournal) throw new BootstrapRefusal('Incomplete bootstrap journal; manual inspection required');
      const occupied = await tx<{ name: string }[]>`SELECT table_schema || '.' || table_name AS name FROM information_schema.tables WHERE table_schema = 'public' AND table_type = 'BASE TABLE' LIMIT 1`;
      const buckets = await tx<{ id: string }[]>`SELECT id FROM storage.buckets WHERE id IN ('public-assets','course-content') LIMIT 1`;
      if (occupied.length || buckets.length) throw new BootstrapRefusal('Target is not empty; refusing bootstrap');
      if (mode === 'check') {
        console.log(`Project ${ref}: empty target confirmed; ${migrations.map(m => `${m.name} sha256:${m.checksum}`).join(', ')}; no changes`);
        return;
      }
      await tx.unsafe(`CREATE TABLE public.empty_bootstrap_journal (name text PRIMARY KEY, checksum text NOT NULL, applied_at timestamptz NOT NULL DEFAULT now())`);
      await tx.unsafe('ALTER TABLE public.empty_bootstrap_journal ENABLE ROW LEVEL SECURITY');
      await tx.unsafe('REVOKE ALL ON public.empty_bootstrap_journal FROM PUBLIC, anon, authenticated');
      await tx.unsafe('GRANT SELECT, INSERT ON public.empty_bootstrap_journal TO service_role');
      for (const migration of migrations) {
        await tx.unsafe(migration.body);
        await tx`INSERT INTO public.empty_bootstrap_journal (name, checksum) VALUES (${migration.name}, ${migration.checksum})`;
      }
      await verify(tx);
      console.log(`Project ${ref}: bootstrap applied and verified transactionally`);
    });
  } finally { await sql.end(); }
}

async function verify(tx: any) {
  const tables = await tx`SELECT c.relname, c.relrowsecurity FROM pg_class c JOIN pg_namespace n ON n.oid = c.relnamespace WHERE n.nspname = 'public' AND c.relkind = 'r'`;
  if (['empty_bootstrap_journal', ...expectedTables].some(name => !tables.some((row: any) => row.relname === name && row.relrowsecurity))) throw new BootstrapRefusal('Bootstrap table/RLS verification failed');
  const columns = await tx`SELECT column_name, data_type, column_default FROM information_schema.columns WHERE table_schema='public' AND table_name='doubts'`;
  if (!columns.some((c: any) => c.column_name === 'content_id' && c.data_type === 'uuid') || !columns.some((c: any) => c.column_name === 'status' && c.column_default?.includes('open'))) throw new BootstrapRefusal('Doubt column verification failed');
  const constraints = await tx`SELECT conname FROM pg_constraint WHERE conrelid='public.doubts'::regclass`;
  if (['doubts_content_id_content_id_fk','doubts_class_matches_content','doubts_status_valid','doubts_resolved_matches_status','doubts_message_length','doubts_title_length','doubts_description_length'].some(name => !constraints.some((c: any) => c.conname === name))) throw new BootstrapRefusal('Doubt integrity verification failed');
  const exposed = await tx`SELECT table_name FROM information_schema.role_table_grants WHERE table_schema='public' AND grantee IN ('anon','authenticated','PUBLIC')`;
  if (exposed.length) throw new BootstrapRefusal('Unexpected client-role table grants; inspect before continuing');
  const buckets = await tx`SELECT id, public, file_size_limit, allowed_mime_types FROM storage.buckets WHERE id IN ('public-assets','course-content')`;
  if (buckets.length !== 2 || !buckets.some((b: any) => b.id === 'public-assets' && b.public === true && Number(b.file_size_limit) === 52428800) || !buckets.some((b: any) => b.id === 'course-content' && b.public === false && Number(b.file_size_limit) === 52428800 && b.allowed_mime_types?.includes('text/plain'))) throw new BootstrapRefusal('Bootstrap storage verification failed');
}

export function safeFailure(error: unknown) {
  if (error instanceof BootstrapRefusal) return error.message;
  const code = (error as { code?: string } | null)?.code;
  if (['CERT_HAS_EXPIRED','UNABLE_TO_VERIFY_LEAF_SIGNATURE','ERR_TLS_CERT_ALTNAME_INVALID','SELF_SIGNED_CERT_IN_CHAIN'].includes(code || '')) return 'TLS certificate verification failed; download the Supabase CA certificate and configure DATABASE_SSL_CA_FILE';
  if (['ECONNREFUSED','ETIMEDOUT','ENOTFOUND','CONNECT_TIMEOUT'].includes(code || '')) return 'Database connection failed; check target host and network';
  if (code === '28P01' || code === '28000') return 'Database authentication failed; check local credentials';
  if (code === '55P03' || code === '57014') return 'Database lock or statement timeout; transaction rolled back';
  return 'Bootstrap SQL or verification failed; transaction rolled back. Inspect target state without printing credentials';
}

if (process.argv[1] && import.meta.url === new URL(`file://${process.argv[1]}`).href) {
  run().catch(error => { console.error(safeFailure(error)); process.exitCode = 1; });
}
