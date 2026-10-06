# Skillarious product reliability and learning experience plan

> Updated 2026-10-06. This is the execution plan for the issues reported in the latest course, AI, doubts, media, theme, performance, and Git-history review. The implementation should be delivered in small, testable slices; no fake success states or unsupported provider capabilities.

## 0. Non-negotiable safety decisions

- Do not print, copy, or commit values from any environment file.
- Current working-tree environment files remain ignored and are not tracked at `HEAD`.
- Historical environment blobs are still sensitive. Rewriting history only removes references from reachable Git refs; it does not revoke credentials or erase existing clones, GitHub caches, alerts, email notifications, forks, or provider logs. The safe order is revoke/rotate first, then rewrite.
- The user requested no rotation. Therefore no credential rotation is part of this implementation. Do not claim the credentials are safe after history cleanup.
- Never force-push `main`/`master`. If history cleanup is approved, create a sanitized replacement branch and require an explicit repository-owner migration decision; do not silently overwrite the protected/default branch.

## 1. Observed problems and likely causes

### AI sometimes works and sometimes fails

- The frontend keeps only one answer in React state and has no conversation persistence.
- `/ai/ask` currently sends text-only excerpts to APInex, falls back once from DeepSeek to MiMo, and returns a generic 503 when both attempts fail. It does not persist a request ID/model attempt or distinguish provider outage, quota, malformed response, unsupported modality, and context retrieval errors.
- Course context currently contains course fields but not educator identity/about. Content context is authorized, but PDFs are parsed only on demand and image/video bytes are never analyzed.
- Intermittent failures must be diagnosed from redacted request/model/status/duration events, never provider response bodies, prompts, keys, signed URLs, or student text.

### Doubts disappear or show incomplete data

- A student can see their own doubts; educators can see course doubts. A student cannot see other students' doubts by design. Make that rule explicit in the UI.
- The content doubt list makes one request per doubt for messages and silently converts detail failures into an empty message list.
- After creation, the refresh is not awaited. Expansion/unmounting can also destroy local state.
- The course-level doubts screen has an N+1 request pattern across modules, videos, materials, doubts, and detail messages.

### Theme and controls are inconsistent

- `app/globals.css` contains two token systems plus broad legacy utility overrides.
- Components still use hard-coded blue/green/yellow/red and `text-white`, causing low contrast in one of the two themes. Status colors and action colors need semantic tokens, not color names.

### Content and loading are too heavy

- Course detail, rating, enrollment, library, modules, media, signed URLs, doubts, and assistant UI are not consistently separated into critical and background work.
- Video and study-material endpoints currently sign every file URL before the user opens anything.
- Study Materials must render documents/notes/images/text only. Video playback belongs in the separate Videos/Class area.

## 2. Delivery phases

### Phase A — stabilize and instrument the current AI path

1. Add a redacted AI request telemetry record: request ID, user/course/content context type, selected model, fallback attempt, HTTP status category, duration, and failure category. Never log question text, excerpts, keys, provider bodies, or signed URLs.
2. Preserve authorization before retrieval: course overview is public; content, material, video, and doubt context require enrollment or educator ownership.
3. Expand public course context with educator name/bio/about and add a bounded public-catalog context for questions about other published courses and teachers. Retrieve only non-dismissed course/educator fields, cite the matched catalog records, and never expose private educator data, enrolled-only materials, or student data.
4. Keep DeepSeek on text-only inputs. Keep MiMo text-only until APInex's live model contract proves the accepted multimodal payload.
5. Add tests for primary success, fallback success, both unavailable, provider timeout, malformed response, quota/busy state, unauthorized context, and context retrieval failure. Return truthful retry/unsupported messages instead of a generic success.

### Phase B — provider capability verification and grounded insights

1. At deploy time, inspect the APInex model catalog and run a disposable capability probe with no private course data. The catalog currently lists `free/mimo-v2.6-pro` and `free/deepseek-v4.1-flash`, but it does not expose reliable per-model modality fields in the response we can safely depend on.
2. Treat MiMo as potentially multimodal based on its upstream model documentation, but do not assume APInex's OpenAI-compatible bridge accepts PDF/video parts. Verify exact syntax and limits from APInex, not a different gateway.
3. PDFs: keep bounded text extraction for text PDFs. Detect scanned/image-only PDFs; add OCR as an asynchronous derived-text step with page citations. Do not send arbitrary storage URLs to the model.
4. Images: only send authorized, validated images to a confirmed vision-capable provider using provider-specific content parts. Enforce MIME, byte, pixel, image-count, and privacy limits.
5. Videos: never send full lectures synchronously. Add an asynchronous job that extracts audio transcripts, representative frames/slide OCR, timestamps, and summaries. Let DeepSeek answer from transcript text; use MiMo frames only after capability verification. Keep raw video private and cite timestamps.
6. Normalize evidence as bounded records: source ID, type, content, page/timestamp, access scope, version/checksum. Unsupported combinations return a clear 422-style UI state.

### Phase C — persistent AI chats and Ask AI entry points

1. Add durable `ai_conversations` and `ai_messages` tables keyed by student and context (`course`, `content`, or `doubt`), with created/updated timestamps, title, archived state, message role, bounded text, model metadata, and source references.
2. Add authenticated list/create/read/archive endpoints. Enforce ownership by student; educators cannot read private student AI chats unless an explicit future policy grants it.
3. Change `LearningAssistant` from one `result` to a chat thread: load previous messages, show an Ask AI button on course overview, material detail, video detail, and doubt detail, append the new turn, show sources/disclosure, retry failed turns, and preserve chats across refresh/navigation.
4. Use one conversation implementation. Remove or connect the older local-only `ChatBox` so there is no second disappearing chat system.
5. Add pagination/limits and server-side quotas. Never treat browser localStorage as the source of truth for private conversations.

### Phase D — reliable doubts

1. Return the created doubt from the API and insert it immediately, then reconcile with a refresh that is awaited and cancellable.
2. Add a batch/detail response or include authorized messages in the list response to remove N+1 requests. Surface a retryable detail error instead of silently showing an empty thread.
3. Keep student visibility limited to the student's own doubts; show an explicit empty state explaining this. Educators see doubts for courses they own.
4. Preserve thread state in the stable course page or route state; do not rely on a component that is destroyed on collapse.
5. Add tests for one pasted doubt, refresh, multiple doubts, educator reply, student follow-up, resolution, access denial, and temporary detail failure.

### Phase E — content separation and fast course opening

1. Make course shell/title/navigation render immediately with skeletons; load course metadata on the critical path.
2. Start independent rating, enrollment, library, module, and educator checks in parallel. Cache course/module results for the current session and cancel stale requests on navigation.
3. Return content metadata first. Request signed URLs only when a document/image is opened or a video is intentionally started.
4. Study Materials shows only PDF/TXT/images/other document content. Videos are excluded from that list and remain in the separate Videos/Class section.
5. Video elements use `preload="none"` or metadata-only behavior. Do not create signed URLs or download full video data until the user presses play; use range-friendly storage/CDN delivery.
6. Lazy-load PDF/image viewers, video player, doubts, and AI chat. Background-load static metadata after the shell is interactive.
7. Add performance measurements for first meaningful course shell, metadata ready, material open, and video start; compare before/after instead of guessing.

### Phase F — one accessible light/dark design system

1. Consolidate `app/globals.css` tokens into semantic roles: canvas, surface, text, muted text, border, action, action text, success, warning, danger, info, focus.
2. Replace hard-coded status/action utilities with semantic classes or CSS variables. Check every button, tab, badge, spinner, textarea, select, link, progress bar, and error state in both themes.
3. Add contrast-focused browser checks for the reported course, AI, doubts, reviews, material, and video screens at desktop and mobile widths.
4. Keep keyboard focus, disabled state, reduced motion, and visible loading/error states intact.

## 3. Verification gates

- Backend typecheck and unit/API tests pass with no secrets printed.
- Frontend typecheck, lint, production build, and focused Playwright flows pass.
- New tests cover AI fallback/capabilities, persistent chat ownership, one-doubt creation/reload, authorization, both themes, lazy media loading, and course shell responsiveness.
- A redacted endpoint matrix records pass/fail/blocked status. Live provider tests use synthetic text only unless a confirmed, disposable multimodal probe is explicitly enabled.
- Before any deployment: `git diff --check`, tracked-secret scan, ignored-env check, and review of staged paths. Do not stage existing user files automatically.

## 4. Git history cleanup decision

- Historical env paths were removed from the current tree, but reachable old commits still contain them.
- `gh` is not installed in this worker, so GitHub authentication and remote branch mutation cannot be verified here.
- A history rewrite can be prepared locally with `git filter-repo`/BFG after a clean worktree snapshot, but it must not force-push `main`. The safe GitHub procedure is: authenticate with GitHub, create a sanitized replacement branch, have the repository owner review it, change the default branch/branch protections, then retire old refs and rotate credentials. Skipping rotation leaves the leaked credentials usable.

# Historical restoration notes

## Goal and implementation order
Restore the existing Next.js + Express + Drizzle application without changing its core stack. Supabase Postgres and Storage are the durable data services; PayPal Sandbox replaces Razorpay; a server-side APInex learning assistant supports notes, lessons, doubts, course explanations and course discovery. Verify locally before GitHub/hosting deployment.

### Phase 0 — audit and safe configuration
- Preserve existing untracked README.md and PROJECT_PITCH.md and private attachments; do not stage them automatically.
- Prevent secrets from entering new commits. Existing tracked environment files and hardcoded SMTP credentials require removal from tracking and rotation; history rewriting needs a separate decision.
- Inventory all route mounts and client calls. Record actual test/build failures rather than calling untested flows complete.
- Supabase target ref: `ykllmcwljsfeluhpvzbv`. CLI access is now verified; canonical baseline already applied and checked. Runtime DB and server keys belong in ignored backend/.env.local, not chat/templates. Never reset or replay legacy migrations.

### Phase 1 — backend repair and Supabase-only storage
- Separate app creation from server listening for API tests; load configuration consistently; allow startup without payment or AI credentials.
- Fix doubt creation's missing required `message`, normalize statuses, authorize enrolled students/owning educators, validate IDs, persist replies atomically, support student follow-ups and resolution. Never report DB failure as a successful empty list.
- Audit auth, bans, educator ownership, curriculum access, reviews, admin route mounting and client/backend contracts. Prioritize access-control issues and regressions.
- Replace local/Cloudinary uploads with Supabase Storage. Public assets and private course content use separate buckets. Only server service-role access; signed URLs issued after entitlement checks. Enforce file types, sizes and safe keys. Plan migration of existing uploads instead of silently deleting files.
- Prepare non-destructive schema changes, explicit empty-project bootstrap and deterministic demo seed. Do not use the inconsistent legacy migration folder blindly.
- Tests: missing auth, invalid UUID, cross-user access, enrolled/owner paths, create/list/read/reply/resolve persistence, upload/delete/signed URL policy.

### Phase 2 — US PayPal Sandbox
- USD-only sandbox defaults, server-derived course price, server order creation and capture verification; bind order to user/course, currency, amount and merchant. Persist order intent before redirect; unique capture IDs and transactional enrollment prevent replay.
- Replace checkout UI and unused Razorpay/Stripe dependencies. Refund operations require appropriate authority and verified stored payment; never accept arbitrary client amount or capture ownership.
- Produce bulk account generator/template: one US BUSINESS seller and multiple US PERSONAL buyers; all rows use supplied PayPal CSV headers. Account credentials are private artifacts, not committed. Accounts still must be created in the PayPal Developer dashboard.
- Configure sandbox REST app client ID/secret in server env; cancellation, duplicate capture, failed capture and provider outage tests; live sandbox capture remains blocked until credentials are supplied.

### Phase 3 — grounded learning AI and recommendations
- Verify provider docs and exact current free model IDs. Base URL from docs: `https://api.apinex.bond/v1`; select free DeepSeek, fallback free MiMo only, no silent paid-model substitution.
- Send only text. Parse authorized PDFs server-side with bounded byte/page/text limits, retrieve relevant excerpts, and return source references. Scanned/image-only PDFs need OCR separately; show a truthful unsupported state.
- Every request verifies user and enrollment/ownership before obtaining note, lesson or doubt context. Course overview/discovery uses public catalog fields, not private notes or student PII.
- Treat uploaded text and student input as untrusted. No arbitrary URLs, SQL, shell, email, payments or enrollment tools for the model. Read-only context tools are selected by server code, with visible references. Never execute model-generated tool calls.
- Use bounded question/history/context/output sizes, timeout, per-user quotas and safe errors. Prevent obvious instruction override/secret extraction without blocking normal subject questions. Prompt-only guardrails are not a security boundary; authorization and zero write tools are.
- Rank recommendations by topic relevance plus Bayesian-smoothed student reviews/count; return real course/teacher IDs and explain scores, not invented rankings.
- Add assistant UI to material viewer, lesson/course overview and doubt threads plus course-finder UI. Clear AI disclosure, sources, retry/error states and educator escalation.
- Tests: unauthorized note access, prompt injection inside documents, unsupported PDF, provider fallback, exhaustion/timeouts, non-free model rejection, recommendation ranking.

### Phase 4 — complete visual system
- Editorial learning studio: warm ivory surfaces, forest green actions, ink typography; charcoal/moss dark counterpart. Readable type scale, restrained borders, generous spacing, subtle motion, no purple gradients.
- Shared theme tokens and persistent light/dark/system switch without flash; keyboard focus, contrast, reduced motion and mobile navigation.
- Redesign header/footer, landing, catalog/cards, dashboard, auth and doubts first; apply consistent tokens to educator/admin/content forms while preserving functionality.
- Explicit demo preview data, separate from real API errors; never make fake purchases/enrollments appear persisted. Deterministic seed enables realistic local student/educator reviews and course content.
- Test mobile/desktop navigation, both themes, empty/loading/error states, login, course/detail/notes/doubts/checkout flows.

### Phase 5 — verification and release gates
- Install dependencies and record baseline typecheck/build; add automated unit/API tests plus critical browser checks. Target meaningful changed-code coverage, report measured coverage only.
- Endpoint matrix: health; auth signup/login/refresh/logout/reset/OTP; users; educators; public course/search/category; enroll/access/ownership; modules/classes/materials; doubts/follow-ups/resolve; reviews; payments/create/capture/history/refund; admin moderation/analytics; AI/recommendations.
- Separate mocked provider tests from live Supabase/PayPal/APInex evidence. Every endpoint gets a documented status: passed, failed, or blocked with prerequisites.
- Inspect git diff and secret scan before staging; commit only task files and lockfiles. Never push a build with known security or critical flow failures. The user requested push after local testing; hosting requires credentials/account/project confirmation.
- Vercel frontend: root frontend/, reproducible install/build, server-only proxy target and public API URL configured correctly. Render backend: Node service root backend/, actual production start command, health path /health, Supabase pooled DB connection and server secrets, allowed Vercel origin.
- Write exact setup/deploy commands and rollback steps in docs/deployment.md; provide actual deployment URLs only after platform success receipts.

## Acceptance criteria
1. Authorized users can complete persistent course, note and doubt flows; unrelated users cannot read private content.
2. All newly uploaded durable files use Supabase Storage, with signed access for paid content.
3. PayPal Sandbox capture is server-verified and grants exactly one enrollment; fake or mismatched orders never grant access.
4. AI answers from authorized text with references; provider failures have a usable fallback/error; recommendations identify actual catalog teachers and courses.
5. Responsive light/dark UI uses one coherent system and demonstrable preview data without concealing infrastructure failures.
6. Local tests/builds and endpoint matrix are recorded truthfully; deploy only after passing applicable gates.

## External prerequisites / current blocks
- Supabase URL/server key and runtime CA configured; user reports DB password rotation. Ignored local URL was synchronized with the verified rotated password and duplicate removed; saved-config read-only connection passes with verified TLS 1.3. Other historical credentials still need rotation confirmation. Hosted baseline is already applied; do not replay it or seed without explicit test scope.
- PayPal US BUSINESS sandbox seller REST app client ID and secret, plus US PERSONAL buyers (CSV import prepared later).
- APInex key provided in chat is test-only; keep it server-side/private and rotate after this session. Confirm exact models against catalog.
- Resend default `Skillarious <onboarding@resend.dev>` sender saved privately; configuration and synthetic send pass. User confirmed real registered-account inbox receipt on 2026-10-06 with a screenshot. Do not resend that smoke test. General-user OTP/reset delivery still requires a verified owned domain; last domain listing was empty.
- GitHub CLI authentication and Vercel/Render project access; neither project ownership nor deployed status will be assumed.

## Progress evidence
- Audit completed: duplicate header; missing doubt `message`; backend startup coupled to Razorpay; local upload implementation; tracked environment files; hardcoded SMTP credentials; no existing test scripts or dependency installs in this worker.
- Implemented locally: new visual system and demo gallery; Supabase private storage adapter; repaired doubts/access/admin; PayPal hosted Sandbox; grounded text AI and rating-weighted recommendations; persistent student collections; additive schema/SQL; safe config templates and Render/Vercel deployment guidance.
- Latest checks: 240 Vitest + 3 Node tests, one real disposable PostgreSQL auth/learning integration, 52 desktop/mobile browser fixtures, both typechecks and isolated production frontend build pass. Lint: 0 errors/26 warnings. Backend full audit is clean; frontend remains 5 high production/7 high full. Safe source-pattern scan found no secret candidates in 182 changed/untracked text files; historical exposure is not cleared. Existing stack/overrides retained. Prior real inbox/APInex/public-read evidence remains valid; no new live messages/providers invoked. Full hosted signed-in/media/payment/admin workflows remain pending. See reports/verification.md and docs/auth-testing.md.
- Hosted corrected baseline and buckets have now been applied via authenticated CLI; a temporary Storage smoke object was uploaded/read/deleted and absence verified. No seed, GitHub push or hosting deployment performed. Environment files remain ignored; exposed historical credentials still require rotation.

- Auth continuation: user received/submitted OTP; read-only hosted metadata confirms account verified and session stored, but retained browser still redirects to login. Reproduced optional-storage failure in fixtures and repaired post-verification recovery. Verified-account retries now return explicit sign-in guidance, never tokens; resend skips verified/banned accounts. 228 backend tests, 20 desktop/mobile auth-recovery tests, both typechecks pass; lint has 0 errors/28 warnings. Live no-code already-verified rejection passes after backend restart. Original browser exception and usable session persistence remain unconfirmed. Browser is at `http://localhost:4002/login` for direct user sign-in; rotate chat-exposed test password privately before wider use. Do not request secrets or resend verification mail.
- Latest requested fixes: profile shows identity before optional details, bounded parallel loading/retry and real editing/nullable age; desktop/mobile explicit immediate sign-out, owned-cookie cleanup, outage/storage/late-refresh protection; restricted-recipient domain guidance and sanitized HTTP/provider diagnostics without OTP logs. Alternate hosted account is unverified with zero OTP rows; onboarding sender remains inbox-restricted. Added disposable positive auth, collections, reviews, teacher doubt reply/student resolution and authorized-description AI with mocked fallback. Populated recommendation query exposed a 503 from missing aggregate aliases; fixed and verified numeric ratings/count. User's live browser is paused pending direct sign-in/resume; external Brave is not attached. No commit/push/deploy or hosted application write by the agent. Missing verified domain/PayPal and frontend advisories still block release.

## Confirmed-empty setup continuation
- Owner confirmed `ykllmcwljsfeluhpvzbv` is empty. Acceptance: corrected content-backed doubt schema, guarded transactional baseline, app-table RLS and private/public bucket setup, usable env templates and a credential walkthrough. Never reset or silently convert a populated DB.
- Ready: canonical `backend/sql/0000_empty_schema.sql` + `0001_empty_security_storage.sql`, checksum-journal runner, explicit target/empty/policy guards, verified TLS with CA-file support. Doubt content UUID FK and text/status/resolution constraints were tested on real disposable PostgreSQL.
- Initial direct-DB attempt failed certificate validation. Supabase CLI 2.119.0 authentication was subsequently verified; `db query --linked --project-ref` uses authenticated HTTPS Management API. Guarded check/apply/check succeeded on hosted target, with 22 app tables + journal and corrected doubt constraints verified. Server key fetched into ignored env, Storage URL corrected, obsolete Razorpay/Cloudinary env entries removed. User-provided CA now configured privately; read-only runtime query passes with encrypted, authorized client TLS 1.3. Dashboard SSL enforcement setting unchanged.
- Marketplace clarification: current purchases are per-course, not premium subscriptions, but still one merchant. Recommend PayPal multiparty with seller onboarding and 200-basis-point partner commission. Teacher/buyer secrets must not be collected. Automatic seller split requires a new verified implementation and PayPal capability approval; current env alone cannot enable it.
- Supabase Storage remains the only new-upload provider; PDF/text/video/image supported within 50 MiB application limit. Signed URL expiry is access control, not object deletion. Free quotas/project pausing remain availability constraints.
- Resend HTTPS adapter implemented with test-first verification, bounded requests, safe errors, per-call idempotency, no automatic retries/SMTP fallback and plain text. Render blueprint/templates updated. Private keys moved out of `.env.example`; user reports DB password rotation and saved-config TLS verification passes. Default onboarding sender is saved privately, and no-send configuration check passes. Real delivery to the registered-account inbox is user-confirmed; general-user delivery requires an owned verified domain. Signup/reset tests still need controlled account testing.
