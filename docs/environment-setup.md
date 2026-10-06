# Skillarious: credentials and empty Supabase setup

## What is ready, and what is not

The corrected baseline has now been **applied and independently verified** on `ykllmcwljsfeluhpvzbv` through Supabase CLI 2.119.0's authenticated HTTPS Management API. There are 22 application tables plus the protected journal, corrected doubt constraints and both buckets. The earlier direct PostgreSQL attempt failed TLS; CLI setup did not bypass TLS verification. Do not replay the old migration chain.

The backend Storage URL and `SUPABASE_SECRET_KEY` are configured in ignored `backend/.env.local`. Actual private upload/sign/read/anonymous-denial/delete tests passed. Resend and APInex keys supplied in the template were moved into that ignored file and removed from the template. Resend synthetic sending and APInex primary generation pass; live MiMo also answered synthetic context through a locally simulated primary failure. The default Resend onboarding sender is saved privately and configuration passes, but inbox delivery is unverified and general-user delivery requires a verified owned domain. The supplied CA is now configured and a read-only runtime database query passes with verified client TLS 1.3; PayPal credentials remain missing. Keep real secrets out of `.env.example` and chat.

## 1. Where each setting comes from

| Setting | Source | Needed for |
|---|---|---|
| `DATABASE_URL` | Supabase project → **Connect → Session pooler** | Migration and all persistent API features |
| `DATABASE_SSL_CA_FILE` | Supabase → **Database → Settings → SSL Configuration → Download certificate** | Verified DB TLS when system roots cannot validate the certificate |
| `SUPABASE_URL` | Project URL; already known: `https://ykllmcwljsfeluhpvzbv.supabase.co` | Storage API |
| `SUPABASE_SECRET_KEY` | Supabase → **Settings → API Keys → Secret keys** | Backend upload/download/signing only |
| `SUPABASE_SERVICE_ROLE_KEY` | Legacy API keys → `service_role`, alternative only | Same as above; use one backend key, preferably the new secret key |
| `JWT_SECRET`, `REFRESH_SECRET` | Generate locally, separately | App sign-in/session tokens, not Supabase Auth |
| `EMAIL_PROVIDER=resend`, `RESEND_API_KEY`, `RESEND_FROM` | Resend → API Keys; Domains → verified sender | HTTPS signup/reset mail on Render Free |
| `EMAIL_PROVIDER=vercel_smtp`, `EMAIL_RELAY_URL`, `EMAIL_RELAY_TOKEN` | Render backend → private Vercel email route | Render HTTPS relay to Vercel Hobby SMTP |
| `SMTP_HOST/PORT/USER/PASSWORD/FROM` | Vercel-only SMTP settings for the relay, or direct local/paid-host SMTP | Vercel ports 465/587; do not put SMTP credentials on Render Free |
| `PAYPAL_CLIENT_ID/CLIENT_SECRET/MERCHANT_ID` | PayPal Developer → Sandbox merchant REST app and seller Account Info | Current single-merchant course checkout |
| `APINEX_API_KEY` | APInex signed-in account → API keys | Learning AI |
| `NEXT_PUBLIC_API_URL` | Our Express origin + `/api/v1` | Browser connection; the only required frontend env |

No Razorpay or Cloudinary values are needed. No student API keys or teacher API secrets should be collected. A Supabase CLI access token is **not** the database password or Storage key.

## 2. Prepare local files safely

Templates are `backend/.env.example` and `frontend/.env.example`. If `.env.local` already exists, keep it and update missing values—do not overwrite it. To create files only when absent, run from the repository root:

```bash
test -f backend/.env.local || cp backend/.env.example backend/.env.local
test -f frontend/.env.local || cp frontend/.env.example frontend/.env.local
chmod 600 backend/.env.local frontend/.env.local
mkdir -p reports/private
```

Remove obsolete `RAZORPAY_KEY_ID`, `RAZORPAY_SECRET` and Cloudinary entries from your ignored local env. This removes unused settings, not old uploads. Never commit `.env.local` or the private Sandbox CSV. Previously exposed credentials should be rotated.

## 3. Supabase connection and server key

1. Open [this project](https://supabase.com/dashboard/project/ykllmcwljsfeluhpvzbv). Check the reference in the URL before copying anything.
2. Click **Connect**. Select **Session pooler**, URI format, normally port **5432**. Use the displayed region/host—do not invent one. Direct database connections often require IPv6; the session pooler works on IPv4-only hosts.
3. Replace `[YOUR-PASSWORD]` with the **database password chosen when creating the project**, not your Supabase login password. If forgotten, reset it in **Database → Settings** and update any clients using it.
4. URL-encode reserved characters in the password component (`@`, `:`, `/`, `#`, `%`, etc.). Keep the completed URI private. Save it as `DATABASE_URL` in `backend/.env.local`.
5. Set `SUPABASE_URL=https://ykllmcwljsfeluhpvzbv.supabase.co`.
6. Go to **Settings → API Keys**. Create/copy a **Secret key** (`sb_secret_...`) and put it in `SUPABASE_SECRET_KEY`. Alternatively, use the legacy `service_role` JWT in `SUPABASE_SERVICE_ROLE_KEY`. Never use a publishable/anon key for these backend operations; never expose either server key in the browser.
7. In **Database → Settings → SSL Configuration**, download the **CA/root certificate**. Save it as `reports/private/supabase-ca.crt`. It is a public trust certificate, not a private key; obtain it from the project dashboard, not an unverified server handshake.
8. Set `DATABASE_SSL_CA_FILE` to its absolute path, for example `/home/mylappy/Projects/skillarious/reports/private/supabase-ca.crt`. Use the matching path on another machine. The client verifies both certificate trust and hostname; do not set `rejectUnauthorized=false` or `NODE_TLS_REJECT_UNAUTHORIZED=0`.
9. Set `CONFIRMED_EMPTY_PROJECT_REF=ykllmcwljsfeluhpvzbv` for the migration command. This is a safety confirmation, not a secret.

**SSL enforcement is separate from certificate trust.** An off **Enforce SSL on incoming connections** switch permits non-SSL clients; it does not disable SSL. Our backend still requires verified TLS. Enabling enforcement is recommended hardening after confirming all clients use TLS, but the setting was not changed here. For pooler connections, PostgreSQL's `pg_stat_ssl` describes the pooler-to-database leg, not the application's TLS connection to the pooler.

## 4. Apply the corrected migrations

**Already applied in this workspace.** For ongoing verification use the CLI check only:

```bash
cd backend
CONFIRMED_EMPTY_PROJECT_REF=ykllmcwljsfeluhpvzbv npm run db:cli-check-empty
```

The CLI is authenticated and available through `npx --yes supabase@2.119.0`. Its `db query --linked --project-ref ...` path uses the HTTPS Management API and does not need the original DB password or CA for migration. `db:cli-apply-empty` implements the same checksum journal as the direct runner, rechecks empty state under the transaction lock and verifies matching replays without recreating tables. It was tested with check/apply/check/replay on disposable PostgreSQL, then applied once and verified on the hosted target. Do not use `supabase db push` against the old migration directory.

`projects api-keys --project-ref ... --reveal --output json` can retrieve authorized server API keys. Do **not** run it directly into chat, shell logs or screenshots; in this setup its result was captured privately and written only to the ignored env file. CLI access does not reveal your original database password or obtain PayPal/APInex/email credentials. App JWT secrets are generated locally.

The following direct-DB commands are an alternative for future setup/verification once verified PostgreSQL TLS is configured; they are not needed to repeat the completed hosted migration:

From `backend/`, dependencies already installed in this workspace:

```bash
npm run db:check-empty
# Run apply only after check confirms the target is empty.
npm run db:apply-empty
npm run db:check-empty
```

The runner checks that the DB URI, project URL and explicit ref agree. It refuses pre-existing public tables, incomplete/mismatched journals or Storage policies requiring review. It applies both baseline files plus a checksum journal in one transaction, verifies all 22 app tables/RLS and both buckets, and makes a matching rerun verification-only. It never resets/drops a project. On failure, read the sanitized reason; do not retry with disabled security or log the connection URI.

Doubt corrections: `content_id` is a UUID foreign key to actual content; legacy `class_id` may be null or must match that content. Required `message` is preserved. Status defaults to `open`, permits `open/answered/resolved`, and must agree with `resolved`. Nonempty bounded question fields and lookup indexes are included. This baseline is for the **new empty DB only**; a populated legacy database needs a separately reviewed conversion.

Historical `backend/supabase/migrations/` and `backend/sql/001_…` additive scripts are not a second setup path. Do **not** run them after this baseline. `npm run db:bootstrap` is offline schema comparison, not a DB migration. The custom runner's journal is separate from Supabase CLI migration history; do not run `supabase db push` on the legacy directory afterward.

## 5. Supabase Storage, not Cloudinary

The migration creates these buckets:

- `public-assets`: **public**, PNG/JPEG/WebP only; course covers and deliberately public profile images.
- `course-content`: **private**, PDF, text notes, PNG/JPEG/WebP, MP4/WebM. Authorized Express routes upload and issue short-lived signed URLs after ownership/enrollment checks. No browser write/private-read policies are created.

Supabase supports PDFs, videos and images. It does not automatically turn uploaded videos into an adaptive streaming/transcoding service. Our current backend and buckets cap uploads at **50 MiB**; free-plan global limits are 50 MB. Large lecture videos will need a paid plan and a separately implemented resumable upload path with aligned application/bucket limits.

Files do not have a scheduled expiry merely because they are stored there. **Signed viewing URLs expire intentionally** (normally five minutes) and can be regenerated for authorized learners; the underlying object is not deleted by that expiry. No hosted free service is a promise of permanent unlimited hosting: Supabase Free has storage/bandwidth quotas and can pause inactive projects after one week. For reliable production availability, budget for paid hosting/backups and retain an export strategy. This is different from API keys “expiring.”

After apply: open **Storage**, check each bucket's visibility/MIME/size settings, upload a small PDF/video/image through the owning teacher UI, and verify an unenrolled user cannot access private content. A database migration creates metadata/configuration; it does not prove real uploads/downloads. See `backend/STORAGE_MIGRATION.md` for intentionally migrating legacy uploads.

## 6. Generate app secrets

Generate **two different** values locally, using this command twice, and copy each into the local env—never into chat or a report:

```bash
node -e "console.log(require('node:crypto').randomBytes(48).toString('base64url'))"
```

Set `JWT_SECRET` and `REFRESH_SECRET`. These are our Express JWT signing secrets, not Supabase keys. Changing them revokes existing sessions. Keep `PORT=4001`, `FRONTEND_URL=http://localhost:4002`, `TRUST_PROXY=0` locally. Vercel receives only `NEXT_PUBLIC_API_URL=<Render-origin>/api/v1`; Render receives backend secrets. For Render upload the downloaded CA as a **Secret File** named `supabase-ca.crt` and set `DATABASE_SSL_CA_FILE=/etc/secrets/supabase-ca.crt` (the blueprint expects this).

## 7. PayPal Sandbox: current checkout credentials

Current checkout sells **individual courses**, not platform subscriptions/premium. It pays **one configured merchant**. It does not yet transfer money to each teacher or automatically collect 2% commission.

1. Sign in at [PayPal Developer Dashboard](https://developer.paypal.com/dashboard/). Select **Sandbox**, not Live.
2. **Testing Tools → Sandbox Accounts → Create account**: create a **US BUSINESS** account for the test seller and at least one separate **US PERSONAL** buyer. Alternatively import the private CSV at `reports/private/paypal-sandbox-accounts.csv`. Generating the CSV did not create accounts in PayPal.
3. Open **Apps & Credentials → Sandbox → Create App**. For the **existing checkout**, create a **Merchant** REST app associated with that BUSINESS seller.
4. Open that app. Copy its **Client ID** into `PAYPAL_CLIENT_ID` and reveal/copy the **Secret** into `PAYPAL_CLIENT_SECRET`, backend only.
5. **Testing Tools → Sandbox Accounts → seller account → View/Edit Account → Account Info**: copy the **Account ID / merchant ID** into `PAYPAL_MERCHANT_ID`. This is not the app/client ID and not the seller email.
6. Keep `PAYPAL_MODE=sandbox`. Prices currently use **USD**. ₹5,000 is not $5,000; converting/repricing and supported seller-country/currency behavior need an explicit decision before live use.
7. Open the buyer account's profile to obtain its Sandbox login email/password. During checkout, sign into PayPal's hosted **Sandbox** approval page with this buyer. Do not use the seller as buyer; never add buyer passwords to application env or request student client IDs/secrets.
8. Verify approval/cancel, captured amount/merchant, enrollment, repeat verification and admin refund with the buyer/seller transaction histories. Never change an uncertain capture/refund status just to retry.

### Recommended marketplace architecture for your 2% commission

Use **PayPal Complete Payments Platform / multiparty**, with sellers onboarded **before payment**, not teachers handing us their client secrets:

1. Create a separate Sandbox **Platform** REST app under **Apps & Credentials → Create App → Type: Platform**. PayPal provisions a Platform Partner sandbox account. Do not substitute these credentials into current merchant checkout and expect splitting to work.
2. Enable/check platform-fee capabilities with PayPal; their docs note that configuration/account-manager assistance may be needed even in Sandbox. A successful ordinary Merchant checkout is not evidence that partner fees are enabled.
3. Create a separate BUSINESS seller per test teacher, plus PERSONAL buyers. Teachers click **Connect PayPal** and complete PayPal-hosted partner referral onboarding granting the required permissions. Store the verified seller merchant ID and capability/onboarding status—not the teacher's API secret. Verify status server-side, rather than trusting redirect parameters.
4. A backend marketplace order chooses the course's onboarded seller as `payee.merchant_id`, snapshots gross price and commission, and supplies `payment_instruction.platform_fees` from server-side calculations. Use 200 basis points for 2%, integer minor units and defined rounding; never accept a fee/recipient from the student's request.
5. Implement seller-scoped authorization/attribution headers, capture validation, immutable fee ledger, refund/commission treatment, signed webhook verification and reconciliation before calling it complete. Course access is granted only after validated capture.
6. Production requires PayPal partner approval and eligible seller countries; US Sandbox testing does not prove an Indian domestic INR deployment is supported. Confirm PayPal's country/currency rules for the actual business location before going live.

**Example:** a 5,000-unit course produces a 100-unit platform commission and a 4,900-unit teacher share **before PayPal processing fees, taxes or other adjustments**. Decide who bears those additional fees and how refunds reverse the commission. This is a transaction commission, not a student premium membership.

An alternative is collecting all course money as one merchant and recording teacher payables, then doing later payouts. That is **not automatic checkout splitting**, may require payout approval, and shifts merchant-of-record, tax, dispute and regulatory obligations to us. I recommend multiparty for your stated teacher-as-seller model. Marketplace mode is a new implementation, not an env-only toggle; no unused marketplace env knobs have been added to the working merchant template.

## 8. Verification/reset email (Resend HTTPS)

### Render Free: Resend HTTPS or a Vercel SMTP relay

Render Free blocks outbound **25, 465 and 587**, regardless of a custom website domain. Vercel Hobby Node.js Functions block port 25 but allow outbound SMTP ports **465 and 587**. Therefore the Render backend can call a private Vercel route over HTTPS, and that route can send via Gmail/another SMTP provider. A Vercel relay does not bypass provider authentication, quotas, app-password requirements or deliverability rules.

Implemented: **Resend over HTTPS port 443** remains the default. An optional authenticated Render → Vercel relay is also implemented at `/api/internal/email`; it runs on the Node.js runtime, accepts only the private bearer token, validates bounded plain-text input, awaits SMTP completion, and never logs recipients, message bodies or credentials. A failed request never falls back or retries automatically.

1. Create a Resend account, open **Domains → Add Domain**. Prefer a sending subdomain such as `mail.<your-domain>`.
2. Copy the exact DNS records Resend supplies into your DNS provider and wait for **Verified**. Do not invent record values or replace existing website/mail DNS; a sending subdomain avoids conflicts.
3. Open **API Keys → Create API Key** with sending permission, restricted to that domain where available. Save it privately, not in chat.
4. Choose a sender such as `Skillarious <no-reply@mail.<your-domain>>`. Sender verification is separate from receiving mail; a Gmail App Password is not needed for API sending.
5. Set `EMAIL_PROVIDER=resend`, `RESEND_API_KEY` and `RESEND_FROM="Skillarious <no-reply@mail.<your-domain>>"` in ignored `backend/.env.local`. Set the same values in Render's environment; `render.yaml` declares them. Replace the domain placeholder with your actual verified sending domain.
6. From `backend/`, run `npm run email:check` first (local validation only), then `npm run email:check -- --smoke` (one synthetic request to `delivered@resend.dev`, not a real user). Do not add a recipient override: the script intentionally rejects it.
7. Restart the backend and test signup, resend and password reset with an inbox you control after verified database connectivity. A provider acceptance ID alone does not prove delivery or a successful OTP/account transaction.

**Current evidence:** full backend regression tests passed before a live send. With a temporary command-only `RESEND_FROM='Skillarious <onboarding@resend.dev>'`, one synthetic smoke request was accepted. At the user's subsequent request, that sender was saved in ignored `backend/.env.local`; the no-send `email:check` passes. The last read-only domain list returned no domains. No real inbox delivery has been verified. The default sender can test only the Resend account's registered email; confirm that address before sending. Signup/reset for other users requires an owned verified domain. `delivered@resend.dev` is a synthetic destination, not a readable OTP inbox.

The domain name is not present in current local config (`FRONTEND_URL` and frontend API host are localhost). Supply the public domain name to check DNS/sender setup. Resend has plan quotas too; it is not unlimited permanent free delivery.

### Vercel Hobby SMTP relay option

1. Deploy the `frontend` project to Vercel. The route is included automatically by Next.js; no public browser client calls it.
2. In Vercel environment variables, set `EMAIL_RELAY_TOKEN` to a new random value, `SMTP_HOST` (for Gmail: `smtp.gmail.com`), `SMTP_PORT=587` or `465`, `SMTP_USER`, `SMTP_PASSWORD` (for Gmail: an App Password) and `SMTP_FROM`. These are server-only variables; never use `NEXT_PUBLIC_*`.
3. In Render environment variables, set `EMAIL_PROVIDER=vercel_smtp`, `EMAIL_RELAY_URL=https://<your-vercel-project>.vercel.app/api/internal/email` and the exact same `EMAIL_RELAY_TOKEN`. Do not put SMTP credentials on Render.
4. Redeploy both services, then run the protected signup flow with an inbox you control. The backend's `npm run email:check` validates relay URL/token without sending; the relay smoke flag intentionally refuses to send an arbitrary real email.

### Retained direct SMTP option: local or paid hosting

Set `EMAIL_PROVIDER=smtp` explicitly and use your provider's **SMTP** credentials—not an HTTP API key. Copy its hostname, port, username, password and verified sender into `SMTP_HOST`, `SMTP_PORT`, `SMTP_USER`, `SMTP_PASSWORD`, `SMTP_FROM`. Verify the sender/domain first. Port 587 uses STARTTLS; 465 uses implicit TLS. Do not select SMTP on Render Free.

For local Gmail testing, if your account permits App Passwords:

1. Open [Google Account Security](https://myaccount.google.com/security), enable **2-Step Verification**.
2. Open [App passwords](https://myaccount.google.com/apppasswords). Create one named “Skillarious local SMTP.” If unavailable, your account/security/organization policy may disallow it; use another SMTP provider instead.
3. Save that generated app password privately as `SMTP_PASSWORD` (not your Google account login password).
4. Set `SMTP_HOST=smtp.gmail.com`, `SMTP_PORT=587`, `SMTP_USER=<your Gmail address>` and `SMTP_FROM="Skillarious <your Gmail address>"`.
5. Restart the backend. Sign up with an inbox you control, receive a code, verify, then test resend and password reset. Gmail has sending quotas and is a testing choice, not unlimited production delivery. Rotate any app password previously exposed in Git/chat.

Our app uses custom Express JWT accounts; Supabase Auth's email configuration does **not** configure this application sender.

## 9. Learning AI (APInex)

1. Sign in/register on [APInex](https://apinex.bond/), open [API keys](https://apinex.bond/keys). Their developer docs link to this dashboard page.
2. Create a dedicated key for Skillarious and copy it into `APINEX_API_KEY`, backend only. Rotate the earlier chat-exposed test key.
3. Keep the documented free models: `APINEX_PRIMARY_MODEL=free/deepseek-v4.1-flash`, `APINEX_FALLBACK_MODEL=free/mimo-v2.6-pro`. Confirm they still appear in the current provider catalog. Model availability, free quotas and rate limits can change; no permanent free-service guarantee is implied.
4. From `backend/`, run `npm run ai:check` (catalog check), then `npm run ai:check -- --smoke` (small real generation check). Inspect the result, not merely the presence of a key. The implementation does not fall back to paid models.
5. After Storage works, upload an authorized text PDF, open the lesson assistant and verify grounded references. Scanned PDFs need OCR; the current text parser does not do OCR. Uploaded excerpts are sent to the provider for answering, so avoid private student data and review provider retention policies.

## 10. Start, test and finish setup

```bash
# terminal 1: backend/
npm test
npm run typecheck
npm run dev
# terminal 2: frontend/
npm run typecheck
npm run dev
```

Frontend: `http://localhost:4002`; API liveness: `http://localhost:4001/health`; API base: `http://localhost:4001/api/v1`. Liveness alone does not prove DB access. Restart backend after local env changes.

An optional labeled seed requires `ALLOW_DEMO_SEED=true`, a locally chosen `DEMO_SEED_PASSWORD`, and no existing users. Then run `npm run seed`. Do not use fake `.test` inboxes to prove SMTP delivery; the seed accounts are deliberately verified demo accounts. No public default admin password is created. Real teacher/student onboarding and any initial admin provisioning need explicit verification and least-privilege setup.

Before GitHub/Vercel/Render, verify actual signup/email/login/reset, teacher course/module/material/video upload, enrolled/unenrolled access, student and teacher doubt lifecycle, collections, AI, and Sandbox capture/refund. `reports/verification.md` distinguishes local SQL/unit/browser evidence from still-pending hosted checks.

## Official references checked for this guide

- [Supabase database connections](https://supabase.com/docs/guides/database/connecting-to-postgres), [server API keys](https://supabase.com/docs/guides/getting-started/api-keys), [verified SSL and CA download](https://supabase.com/docs/guides/platform/ssl-enforcement).
- [Supabase file types](https://supabase.com/docs/guides/storage), [file size limits](https://supabase.com/docs/guides/storage/uploads/file-limits), [Free-plan quotas/pausing](https://supabase.com/pricing).
- [PayPal platform Sandbox credentials](https://developer.paypal.com/platforms/create-account), [partner fees and approval](https://developer.paypal.com/platforms/overview), [seller onboarding](https://developer.paypal.com/platforms/seller-onboarding).
- [Google App Passwords](https://support.google.com/accounts/answer/185833), [APInex developer/key reference](https://apinex.bond/developers).
- [Render Free SMTP block](https://render.com/changelog/free-web-services-will-no-longer-allow-outbound-traffic-to-smtp-ports), [Vercel SMTP ports/runtime](https://vercel.com/kb/guide/serverless-functions-and-smtp), [Resend domain verification](https://resend.com/docs/dashboard/domains/introduction), [Resend Node/API sending](https://resend.com/docs/send-with-nodejs).
