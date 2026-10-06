# Confirmed-empty Supabase bootstrap

## CLI HTTPS path (applied on the hosted target)

`scripts/migrateViaCLI.ts` uses `npx --yes supabase@2.119.0 db query --linked --project-ref ...` through the authenticated Management API. It has the same canonical SQL/checksums/journal as the direct runner. Set `CONFIRMED_EMPTY_PROJECT_REF=ykllmcwljsfeluhpvzbv` and run `npm run db:cli-check-empty` for ongoing verification. `db:cli-apply-empty` was already run once on the hosted target; a matching rerun verifies only. No legacy migration replay/reset is allowed. The CLI path does not solve the application's separate PostgreSQL TLS setup.

`sql/0000_empty_schema.sql` is the offline Drizzle-generated canonical schema from all four `src/db/*Schema.ts` files and `schema.ts`; `sql/0001_empty_security_storage.sql` adds constraints, partial unique indexes, RLS on all 22 application tables, and two Storage buckets. Historical `supabase/migrations/` remains untouched and must **not** be replayed alongside this baseline. `npm run db:bootstrap` only generates an offline comparison into `supabase/bootstrap/`; if schema changes, review and explicitly update the canonical SQL before applying to a new project.

Run from `backend/`, using an ignored `.env.local` with `DATABASE_URL` and `SUPABASE_URL` both for the same Supabase project. The URL must use Supabase direct `db.<ref>.supabase.co` or pooler `postgres.<ref>@*.pooler.supabase.com`; a local DB cannot accidentally substitute for the target. Set `CONFIRMED_EMPTY_PROJECT_REF=<ref>` separately and pass the same ref on the command line:

```sh
CONFIRMED_EMPTY_PROJECT_REF=ykllmcwljsfeluhpvzbv ./node_modules/.bin/tsx scripts/migrateEmpty.ts check --project-ref=ykllmcwljsfeluhpvzbv
CONFIRMED_EMPTY_PROJECT_REF=ykllmcwljsfeluhpvzbv ./node_modules/.bin/tsx scripts/migrateEmpty.ts apply --project-ref=ykllmcwljsfeluhpvzbv
```

`check` inspects the database without writing. `apply` checks public tables and target bucket IDs are empty, serializes concurrent attempts with a transaction-scoped advisory lock, applies both SQL files and checksum journal in **one transaction**, then verifies tables/RLS and buckets. If checks or SQL fail the transaction rolls back; reruns with the same journal checksums verify without changes, while changed files, partial journal, or any pre-existing public table/bucket cause refusal. Do not run against an existing project. The database role must be able to create public tables and insert into Supabase's existing `storage.buckets` table. Never paste credentials into logs or commit them.

TLS certificate and hostname verification is required, with 30-second transaction lock and statement timeouts. If validation fails, download the project's CA certificate from Database → Settings → SSL Configuration and set `DATABASE_SSL_CA_FILE` to its local PEM path. Never disable verification. Existing storage policies cause refusal (inspect them manually; the runner never deletes policies). The journal has RLS and revoked client access; service_role has explicit app-table access. Verification checks doubt columns/constraints as well as tables, grants and buckets. Error output omits credentials/raw database errors. Root `docs/environment-setup.md` explains every credential; `db:check-empty` and `db:apply-empty` package scripts wrap this runner for the known ref.

Private `course-content` permits PDF, text/plain notes, PNG/JPEG/WebP, MP4/WebM; public `public-assets` permits PNG/JPEG/WebP. Each bucket caps objects at 50 MiB. There are no browser-facing write policies and no public access to `course-content`; backend service-role access and entitlement checks are required. Verify unauthorized browser access in staging before production use. Legacy file URLs are not imported.
