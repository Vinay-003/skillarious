# Authentication, profile and email checks

## What the checks prove

- Backend unit/HTTP contract checks: `cd backend && npm test && npm run typecheck`.
- Desktop/mobile UI fixtures: `cd frontend && PLAYWRIGHT_PORT=4012 npm run test:e2e`.
- Frontend checks: `npm run typecheck && npm run lint && npm run build`.
- Disposable PostgreSQL integration: actual Express routes, bcrypt, JWT, Drizzle and OTP transactions. Only the external email transport is replaced by an in-memory fixture inbox. The test rejects remote database URLs, non-fixture database names and populated schemas. It prohibits external network requests and never logs code values.
- Browser fixtures do **not** prove real inbox delivery or production Supabase/PayPal workflows. Live passwords and emailed codes must be entered directly by the account owner in the browser.

## Email restrictions and diagnostics

`onboarding@resend.dev` is Resend's no-domain testing sender. It is limited to the email address registered on the Resend account; a different recipient requires an owned verified sending domain. Gmail is not an owned sending domain. A pending account is retained if sending fails; no usable OTP is persisted when the transport rejects it. `RESEND_FROM` may be omitted and the app will use `Skillarious <onboarding@resend.dev>` automatically.

Recognized restrictions return `EMAIL_RECIPIENT_RESTRICTED`. The signup/verification screen explains that the default sender needs no domain but is limited to the Resend account email, and disables pointless repeated sends for that failure. Temporary failures remain retryable. A resend acceptance is not a delivery receipt, and unknown/verified/banned accounts receive neutral responses without new verification mail.

Backend logs show safe records such as:

```json
{"event":"email_failed","provider":"resend","category":"recipient_restricted","status":403}
```

HTTP diagnostics contain a generated request ID, method, route template, status and duration. They never include request URLs/query strings, request bodies, headers, recipient addresses, passwords, tokens or OTP values. Set `LOG_REQUESTS=0` to disable HTTP diagnostics; they are also suppressed in test mode. Email success records mean **provider acceptance**, not delivery.

If a user has already verified, sign in rather than repeatedly submitting/resending a code. Sign out is an explicit desktop/mobile action; `/logout` is a confirmation screen, not a GET side effect. Local session cleanup happens even when server revocation is unavailable. In that case, existing access tokens are not centrally revoked and expire normally.

## Profile responsiveness

The profile shows known identity after session validation instead of blocking the entire page on optional details. Profile and educator details load in parallel with bounded waits and retry. A route loading screen covers navigation. Editable fields save through the API; email and privileges are not editable. Optional age supports clearing.

`npm run dev` compiles routes on demand. Use `npm run build` then `npm start -- --port 4002` in the frontend to assess production behavior; do not run both on the same port. No numerical live profile-navigation speedup has been established. Warm HTML measurements are not a measurement of authenticated UI/API latency.

## Disposable integration command

Example for Linux with PostgreSQL 16 binaries already installed. Run from `backend/`; the local port must be free. This creates a separate temporary cluster, never touches the hosted database, and stops the cluster on exit. Its remaining temporary data contains fixtures only.

```bash
set -e
PGROOT=$(mktemp -d /tmp/opencode/skillarious-auth-fixture.XXXXXX)
/usr/lib/postgresql/16/bin/initdb -D "$PGROOT/data" --auth=trust --no-locale -U fixture > "$PGROOT/init.log"
/usr/lib/postgresql/16/bin/pg_ctl -D "$PGROOT/data" -l "$PGROOT/server.log" \
  -o "-h 127.0.0.1 -p 55433 -k $PGROOT -c timezone=UTC" -w start
trap '/usr/lib/postgresql/16/bin/pg_ctl -D "$PGROOT/data" -m fast -w stop' EXIT
/usr/lib/postgresql/16/bin/createdb -h 127.0.0.1 -p 55433 -U fixture skillarious_auth_fixture_checks
AUTH_TEST_DATABASE_URL=postgres://fixture@127.0.0.1:55433/skillarious_auth_fixture_checks \
  npm run test:auth-integration
```

Never set `AUTH_TEST_DATABASE_URL` to the application database, and never use the fixture signing keys or transport in a real app. The fixture is an opt-in test, not an application debug mode or OTP backdoor.
