/** Empty-project bootstrap through the authenticated Supabase Management API CLI. */
import { createHash } from 'node:crypto';
import { readFile, mkdtemp, writeFile, chmod, rm } from 'node:fs/promises';
import { join } from 'node:path';
import { spawn } from 'node:child_process';

export const TARGET_REF = 'ykllmcwljsfeluhpvzbv';
export const migrationFiles = ['0000_empty_schema.sql', '0001_empty_security_storage.sql'] as const;
const tables = ['admin_invites','admin_logs','category_courses','category','content','courses','doubts','educators','files','messages','modules','otps','reviews','transactions','users','paypal_orders','admin_reports','course_history','course_likes','educator_subscriptions','playlist_courses','playlists'];
const constraints = ['doubts_content_id_content_id_fk','doubts_class_matches_content','doubts_status_valid','doubts_resolved_matches_status','doubts_message_length','doubts_title_length','doubts_description_length'];
export class CLIRefusal extends Error {}

export function parseArgs(argv: string[], env: NodeJS.ProcessEnv = process.env) {
  if (argv.length !== 2 || !['check', 'apply'].includes(argv[0]) || argv[1] !== `--project-ref=${TARGET_REF}`)
    throw new CLIRefusal(`Usage: tsx scripts/migrateViaCLI.ts check|apply --project-ref=${TARGET_REF}`);
  if (env.CONFIRMED_EMPTY_PROJECT_REF !== TARGET_REF)
    throw new CLIRefusal('Set CONFIRMED_EMPTY_PROJECT_REF to the pinned project ref before running');
  return argv[0] as 'check' | 'apply';
}

export async function loadMigrations() {
  return Promise.all(migrationFiles.map(async name => {
    const raw = await readFile(new URL(`../sql/${name}`, import.meta.url), 'utf8');
    return { name, checksum: createHash('sha256').update(raw).digest('hex'), body: raw.replace(/--> statement-breakpoint/g, '') };
  }));
}

const literal = (s: string) => `'${s.replace(/'/g, "''")}'`;
type Migration = Awaited<ReturnType<typeof loadMigrations>>[number];

export function buildSQL(mode: 'check' | 'apply', migrations: readonly Migration[]) {
  if (migrations.length !== 2 || migrations.some((m, i) => m.name !== migrationFiles[i] || !/^[a-f0-9]{64}$/.test(m.checksum)))
    throw new CLIRefusal('Invalid local migration inputs');
  const names = migrations.map(m => literal(m.name)).join(',');
  const pairs = migrations.map(m => `(${literal(m.name)},${literal(m.checksum)})`).join(',');
  const expected = tables.map(literal).join(',');
  const requiredConstraints = constraints.map(literal).join(',');
  // A DO block allows the already-applied path to bypass CREATE statements without
  // splitting the locked, transactional Management API request into multiple calls.
  return `BEGIN;
SET LOCAL search_path = public, pg_catalog;
SET LOCAL lock_timeout = '30s';
SET LOCAL statement_timeout = '30s';
SELECT pg_advisory_xact_lock(182734, 1);
DO $bootstrap$
DECLARE journal_count integer; matched integer; occupied integer; bucket_count integer; policy_count integer;
BEGIN
  SELECT count(*) INTO policy_count FROM pg_policies WHERE schemaname='storage' AND tablename IN ('objects','buckets');
  IF policy_count <> 0 THEN RAISE EXCEPTION 'storage policies present'; END IF;
  IF to_regclass('public.empty_bootstrap_journal') IS NOT NULL THEN
    SELECT count(*) INTO journal_count FROM public.empty_bootstrap_journal;
    IF journal_count <> 2 THEN RAISE EXCEPTION 'incomplete bootstrap journal'; END IF;
    SELECT count(*) INTO matched FROM public.empty_bootstrap_journal j
      JOIN (VALUES ${pairs}) AS expected(name, checksum) ON j.name=expected.name AND j.checksum=expected.checksum;
    IF matched <> 2 THEN RAISE EXCEPTION 'bootstrap journal mismatch'; END IF;
  ELSE
    journal_count := 0;
  END IF;
  SELECT count(*) INTO occupied FROM information_schema.tables WHERE table_schema='public' AND table_type='BASE TABLE';
  SELECT count(*) INTO bucket_count FROM storage.buckets WHERE id IN ('public-assets','course-content');
  IF journal_count = 0 THEN
    IF occupied <> 0 OR bucket_count <> 0 THEN RAISE EXCEPTION 'nonempty target'; END IF;
    ${mode === 'apply' ? `EXECUTE 'CREATE TABLE public.empty_bootstrap_journal (name text PRIMARY KEY, checksum text NOT NULL, applied_at timestamptz NOT NULL DEFAULT now())';
    EXECUTE 'ALTER TABLE public.empty_bootstrap_journal ENABLE ROW LEVEL SECURITY';
    EXECUTE 'REVOKE ALL ON public.empty_bootstrap_journal FROM PUBLIC, anon, authenticated';
    EXECUTE 'GRANT SELECT, INSERT ON public.empty_bootstrap_journal TO service_role';
    ${migrations.map(m => `EXECUTE ${literal(m.body)};
    INSERT INTO public.empty_bootstrap_journal (name, checksum) VALUES (${literal(m.name)}, ${literal(m.checksum)});`).join('\n    ')}` : ''}
  ELSE
    IF occupied <> 23 OR bucket_count <> 2 THEN RAISE EXCEPTION 'partial bootstrap target'; END IF;
  END IF;
  IF ${mode === 'apply' ? 'true' : 'journal_count = 2'} THEN
  IF (SELECT count(*) FROM pg_class c JOIN pg_namespace n ON n.oid=c.relnamespace
      WHERE n.nspname='public' AND c.relkind='r' AND c.relrowsecurity AND c.relname IN (${expected},'empty_bootstrap_journal')) <> 23
    OR (SELECT count(*) FROM pg_class c JOIN pg_namespace n ON n.oid=c.relnamespace WHERE n.nspname='public' AND c.relkind='r') <> 23
    THEN RAISE EXCEPTION 'table or RLS verification failed'; END IF;
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_schema='public' AND table_name='doubts' AND column_name='content_id' AND data_type='uuid')
    OR NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_schema='public' AND table_name='doubts' AND column_name='status' AND column_default LIKE '%open%')
    OR (SELECT count(*) FROM pg_constraint WHERE conrelid='public.doubts'::regclass AND conname IN (${requiredConstraints})) <> 7
    THEN RAISE EXCEPTION 'doubt integrity verification failed'; END IF;
  IF EXISTS (SELECT 1 FROM information_schema.role_table_grants WHERE table_schema='public' AND grantee IN ('anon','authenticated','PUBLIC'))
    THEN RAISE EXCEPTION 'client grants present'; END IF;
  IF NOT EXISTS (SELECT 1 FROM storage.buckets WHERE id='public-assets' AND public=true AND file_size_limit=52428800
      AND allowed_mime_types @> ARRAY['image/png','image/jpeg','image/webp']::text[] AND cardinality(allowed_mime_types)=3)
    OR NOT EXISTS (SELECT 1 FROM storage.buckets WHERE id='course-content' AND public=false AND file_size_limit=52428800
      AND allowed_mime_types @> ARRAY['application/pdf','text/plain','image/png','image/jpeg','image/webp','video/mp4','video/webm']::text[] AND cardinality(allowed_mime_types)=7)
    THEN RAISE EXCEPTION 'bucket verification failed'; END IF;
  END IF;
END $bootstrap$;
COMMIT;
SELECT 'empty-bootstrap-${mode}-ok' AS result;`;
}

export async function run(argv = process.argv.slice(2), env: NodeJS.ProcessEnv = process.env) {
  const mode = parseArgs(argv, env);
  const migrations = await loadMigrations();
  const sql = buildSQL(mode, migrations);
  const dir = await mkdtemp(join('/tmp/opencode', 'skillarious-bootstrap-'));
  const file = join(dir, 'bootstrap.sql');
  try {
    await chmod(dir, 0o700);
    await writeFile(file, sql, { mode: 0o600, flag: 'wx' });
    await new Promise<void>((resolve, reject) => {
      const child = spawn('npx', ['--yes', 'supabase@2.119.0', 'db', 'query', '--linked', `--project-ref=${TARGET_REF}`, `--file=${file}`, '--output', 'json'],
        { stdio: ['ignore', 'pipe', 'pipe'], env: { ...env, NO_COLOR: '1' } });
      let output = '';
      const timeout = setTimeout(() => child.kill(), 75_000);
      child.stdout.on('data', (chunk: Buffer) => { output += chunk.toString(); if (output.length > 1024 * 1024) child.kill(); });
      // Provider error bodies can contain credentials; discard without displaying.
      child.stderr.resume();
      child.on('error', () => reject(new CLIRefusal('Supabase CLI could not be started')));
      child.on('close', code => {
        clearTimeout(timeout);
        if (code !== 0 || output.length > 1024 * 1024) return reject(new CLIRefusal('Supabase CLI query failed; target may be unchanged or require inspection'));
        try {
          const result = JSON.parse(output);
          if (!JSON.stringify(result).includes(`empty-bootstrap-${mode}-ok`)) throw new Error('missing marker');
          resolve();
        } catch { reject(new CLIRefusal('Supabase CLI returned an unexpected result; inspect target before retrying')); }
      });
    });
    console.log(`Project ${TARGET_REF}: ${mode} completed; journal sha256 ${migrations.map(m => `${m.name}:${m.checksum}`).join(', ')}`);
  } finally {
    await rm(file, { force: true });
    await rm(dir, { recursive: true, force: true });
  }
}

if (process.argv[1] && import.meta.url === new URL(`file://${process.argv[1]}`).href)
  run().catch(() => { console.error('Bootstrap refused or CLI query failed; inspect target before retrying'); process.exitCode = 1; });
