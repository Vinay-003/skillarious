# Local setup and deployment

## Current release gate
Hosted migrations and Storage setup pass. Resend HTTPS is implemented and synthetic sending passed; APInex catalog/primary generation passed. Do not deploy as production yet: direct Express DB TLS, complete signed-in flows, Sandbox payments and real verified-domain email remain blocked/unverified. Start with `docs/environment-setup.md`. Frontend/build-tool advisories still need review.

## 1. Configure the new Supabase project
`supabase login`, `supabase init`, and `supabase link --project-ref ykllmcwljsfeluhpvzbv` connect the CLI on **the machine where they run**. That login is not copied into this worker and a project ref is not a database password or service-role key.

In Supabase Dashboard → this project:
1. **Connect** → Postgres → connection string. Choose the session pooler for IPv4-only hosts; use the transaction pooler only with prepared statements disabled. Replace the password placeholder locally. Put the entire URI in ignored `backend/.env.local` as `DATABASE_URL`. URL-encode special password characters. Use TLS in deployment.
2. Settings → API Keys: set `SUPABASE_URL=https://ykllmcwljsfeluhpvzbv.supabase.co` and a server-side `SUPABASE_SECRET_KEY` (`sb_secret_...`), or legacy `SUPABASE_SERVICE_ROLE_KEY`. Never put either in `NEXT_PUBLIC_*`.
3. The CLI independently confirmed emptiness and applied the baseline. It is authenticated through `npx --yes supabase@2.119.0`. Use `db:cli-check-empty` for verification, not legacy `db push`. The running Express server still needs the CA certificate from Database → Settings → SSL Configuration and `DATABASE_SSL_CA_FILE`; do not disable verification.
4. The baseline creates `course-content` **private** and `public-assets` public only for intended public imagery. No browser write/private-read policies. Follow `backend/STORAGE_MIGRATION.md` for legacy files; originals are preserved, not silently discarded.

Keep all other backend values from `backend/.env.example`. Generate independent JWT and refresh secrets locally with `node -e "console.log(require('crypto').randomBytes(48).toString('base64url'))"`. Do not send these values in chat.

For a **confirmed empty** database:
```bash
cd backend
npm ci
CONFIRMED_EMPTY_PROJECT_REF=ykllmcwljsfeluhpvzbv npm run db:check-empty
CONFIRMED_EMPTY_PROJECT_REF=ykllmcwljsfeluhpvzbv npm run db:apply-empty
CONFIRMED_EMPTY_PROJECT_REF=ykllmcwljsfeluhpvzbv npm run db:check-empty
```
Review `backend/sql/0000_empty_schema.sql` and `0001_empty_security_storage.sql`. `check` is read-only; `apply` uses one transaction and checksum journal, with target/empty/policy guards and verification. The canonical baseline already includes payment indexes, RLS and bucket configuration: do not apply the legacy history or additive scripts afterward. `npm run db:bootstrap` only generates an offline comparison. See `backend/sql/EMPTY_BOOTSTRAP.md`.

The current code adds moderation fields to `content`; ensure the target has `is_dismissed`, `dismiss_reason`, `dismissed_at` before serving content. Index creation fails if old duplicate active enrollments exist—resolve those explicitly, never delete them automatically.

Optional demo seed, only into a confirmed empty database, using a password chosen locally:
```bash
ALLOW_DEMO_SEED=true npm run seed
```
Set `DEMO_SEED_PASSWORD` privately first. Student email: `sam.student@example.test`; educator email: `alex.educator@example.test`. Passwords are not committed. Upload course material via the educator UI to the private Storage bucket. `/demo` is a separate, clearly labeled visual preview and does not claim real enrollments.

## 2. PayPal US Sandbox
These instructions configure the **existing single-merchant course purchase** implementation, not teacher-specific commission splitting. For the recommended seller-onboarding + 2% platform-fee flow and its additional requirements, read `docs/environment-setup.md`, section 7. Do not collect teacher or student API secrets.
1. Open PayPal Developer Dashboard → Testing Tools → Sandbox Accounts → Bulk creation. Import `reports/private/paypal-sandbox-accounts.csv` generated in this workspace (4 US BUSINESS, 6 US PERSONAL, all USD balances). File contains private passwords; do not commit it.
2. Pick **one US BUSINESS seller** for this application's merchant. Use the **US PERSONAL buyers** to approve purchases; do not pay with the seller account itself.
3. Developer Dashboard → Apps & Credentials → Sandbox → create REST app associated with that seller. Set `PAYPAL_CLIENT_ID`, `PAYPAL_CLIENT_SECRET`, and `PAYPAL_MERCHANT_ID` (the seller merchant/account ID) in backend env. Set `PAYPAL_MODE=sandbox`.
4. Configure `FRONTEND_URL=http://localhost:4002` locally. Hosted approval returns to `/payments/result`; the server derives trusted return/cancel URLs from this origin. Course prices are USD—do not reinterpret existing INR prices without explicitly repricing them.
5. Test paid course order, buyer approval, verified capture/enrollment, cancellation, duplicate verify and rejected wrong-user order. Refund is an admin-only server operation; reconcile uncertain provider failures in Sandbox before retrying.

Account CSV template fields match the supplied PayPal format. Actual account creation happens in PayPal, not by generating this file. Regenerate only if needed with `cd backend && npx tsx scripts/paypalBulk.ts`; the script refuses to overwrite an existing credentials file.

Order reconciliation states are deliberate safety stops. `capture_unknown` permits a read of the provider order, but never a second blind capture; only a matching `COMPLETED` result grants enrollment. `refund_unknown` preserves enrollment and blocks another automated refund. Compare the order, capture, refund amount/currency and merchant in PayPal with the stored intent/transaction, then perform an authorized audited recovery. Do not clear these states simply to make a refund retry. No automatic webhook/reconciliation job is implemented yet.

## 3. Learning AI and email
APInex docs checked: https://apinex.bond/developers and https://apinex.bond/models. OpenAI-compatible `POST https://api.apinex.bond/v1/chat/completions`, Bearer auth, text messages only. Documented free model IDs at inspection:
- `free/deepseek-v4.1-flash` (primary)
- `free/mimo-v2.6-pro` (fallback)

Set `APINEX_API_KEY` privately. The chat-provided test key has not been copied into source or tool commands; configure it in ignored env for a live check, then rotate it. Models can change: confirm IDs in the provider catalog before live verification. No paid-model fallback is permitted.

Notes are fetched only from validated Supabase references after entitlement checks. Text PDFs are parsed in a bounded worker (10 MB, up to 80 pages, 8 second timeout); image-only PDFs need OCR. AI has **no executable model tools**: read-only context retrieval is server-selected, with references returned to the UI. Model instructions alone do not constitute a security guarantee. Current quotas are per-process (20 questions/hour/user), not a distributed/shared quota. Inform students that authorized note excerpts go to APInex; review provider privacy before using sensitive content.

The persistent student AI chat feature adds `backend/sql/20261006_ai_conversations.sql`. Apply this additive migration once, after reviewing it against the target database, before enabling the chat UI. It creates only `ai_conversations` and `ai_messages`; it is not part of the guarded empty-project bootstrap and must not be replayed blindly.

Set `EMAIL_PROVIDER=resend`, `RESEND_API_KEY` and `RESEND_FROM` privately for the default HTTPS path. To use the Vercel relay instead, set `EMAIL_PROVIDER=vercel_smtp`, `EMAIL_RELAY_URL=https://<frontend>.vercel.app/api/internal/email` and the same high-entropy `EMAIL_RELAY_TOKEN` on Render; set `EMAIL_RELAY_TOKEN`, `SMTP_HOST`, `SMTP_PORT` (465 or 587), `SMTP_USER`, `SMTP_PASSWORD` and `SMTP_FROM` only on Vercel. For Gmail, use an app password—not the normal account password—with `smtp.gmail.com` on 587/STARTTLS or 465/TLS. Never place these in `NEXT_PUBLIC_*`. `npm run email:check` validates the Resend configuration only; relay smoke testing happens after both deployments with a controlled recipient. See `docs/environment-setup.md`, section 8.

**Render Free blocks SMTP 25/465/587 even with a custom domain.** SMTP is retained only with explicit `EMAIL_PROVIDER=smtp` for local/paid hosting; there is no fallback from Resend to SMTP. Render can alternatively use `EMAIL_PROVIDER=vercel_smtp`: the backend sends an authenticated HTTPS request to the Vercel Node route, and Vercel opens SMTP on port 465 or 587. The relay awaits `sendMail` before returning. Vercel blocks port 25 but documents 465/587 as open; this does not remove Gmail/provider authentication, quotas or deliverability requirements. Revoke historical exposed credentials; never disable TLS certificate validation.

## 4. Run and verify locally
Signup now requires email verification. An SMTP outage keeps the account pending and routes to `/verify-email`; resend after fixing mail delivery. New codes expire older codes, and consumption/account updates share a transaction. Already-verified seed accounts do not need SMTP for password login. Browser tests verify this flow with fixtures, not live delivery.

```bash
cd backend
npm ci
npm test
npm run typecheck
npm run dev                 # http://localhost:4001
```
In another terminal:
```bash
cd frontend
npm ci
# ignored .env.local: NEXT_PUBLIC_API_URL=http://localhost:4001/api/v1
npm run typecheck
npm run lint
npm run build
npx playwright install chromium
npm run test:e2e
npm run dev                 # http://localhost:4002
```
`/health` is liveness, not a database/payment readiness proof. Browser tests use explicit API fixtures. Run real student/educator/admin and paid-course flows after service configuration; see `reports/verification.md` for blocked checks.

## 5. GitHub, only after verification
In this workspace the three environment files have already been removed from Git's index, with local copies preserved. Do not repeat the removal; the following commands are for a fresh checkout still tracking those files.

Environment files were already tracked in the original repository. `.gitignore` alone cannot protect tracked files. Before any commit, remove **only from the index**, retaining local copies:
```bash
git rm --cached backend/.env backend/.env.local frontend/.env.local
git status --short
git diff --check
```
Rotate exposed credentials; removing files does not erase Git history. Do not rewrite or force-push shared history without a separate coordinated decision. Stage only task code, reviewed docs and lockfiles—exclude `.opencode/`, private account CSV, attachments and unrelated untracked notes. Run a secret scanner before committing. Use conventional commits and push a reviewed feature branch to `https://github.com/Vinay-003/skillarious`, not a blind production push.

## 6. Render backend
1. Render dashboard → New → Web Service → connect the GitHub repository/verified branch.
2. Root directory: `backend`; runtime: Node; Node version 22 or 24 supported by your installed packages; build command `npm ci --include=dev && npm run typecheck`; start command `npm start`. The `/health` endpoint remains available for manual diagnostics, but the repository blueprint no longer configures a periodic Render health check so free instances may sleep.
3. Set all backend secrets through Render Environment. Set `FRONTEND_URL` to your exact Vercel deployment origin, `PAYPAL_MODE=sandbox`, `TRUST_PROXY=1` when there is exactly one trusted proxy. Render supplies `PORT`; do not hardcode it.
4. Supabase buckets are durable; no Render local disk is used as persistent file storage. Migrations are reviewed/manual release steps, not run at each server startup.
5. Deploy the verified commit and record its actual `https://<service>.onrender.com` URL. Check health, denied private requests, signed note access, AI, email and sandbox checkout—not health alone.

Do not assume Render CLI/auth is present: this worker has neither a confirmed Render account nor an authorized deployment target. The dashboard workflow above is sufficient; a connected Render service/API can automate it after access is granted.

## 7. Vercel frontend
From the frontend directory, with Vercel CLI signed in:
```bash
vercel login
vercel link
vercel env add NEXT_PUBLIC_API_URL production
# value: https://<actual-render-service>.onrender.com/api/v1
vercel env add NEXT_PUBLIC_API_URL preview
vercel deploy                 # preview first
```
Use Next.js framework detection, root `frontend` in a Git-connected project, install `npm ci`, build `npm run build`. Update Render's `FRONTEND_URL` to the exact frontend origin used for testing (a single origin, not wildcard CORS). Test preview end-to-end and configure production env before `vercel deploy --prod`. `NEXT_PUBLIC_API_URL` is compiled into the build: changes require a fresh build/deploy. No provider, DB, SMTP or service-role secrets belong in Vercel's public environment.

## Rollback
Redeploy the last known-good frontend/backend commit through the hosting dashboards. Preserve the additive DB schema and payment records; do not reset Supabase or roll back captured transactions. Reconcile any incomplete PayPal order/refund with the provider. Keep migrations and seed execution separate from rolling back app code.
