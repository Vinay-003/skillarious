# Skillarious (Learn Sphere) — Interview Deep Dive

> An online learning marketplace where **students buy and watch courses**, **educators create modules/videos/materials and answer doubts**, and **admins moderate the platform**.  
> Product UI brand: **Learn Sphere**. Repo/backend package name: **skillarious**.

This README is written as an **interview cheat sheet**: how pieces talk to each other, full data flows, architecture choices, and why those choices were made.

---

## Table of contents

1. [One-line pitch](#1-one-line-pitch)
2. [High-level architecture](#2-high-level-architecture)
3. [Tech stack & why each piece](#3-tech-stack--why-each-piece)
4. [Repo layout](#4-repo-layout)
5. [Roles & authorization model](#5-roles--authorization-model)
6. [Domain model (how tables relate)](#6-domain-model-how-tables-relate)
7. [Backend request lifecycle](#7-backend-request-lifecycle)
8. [Frontend request lifecycle](#8-frontend-request-lifecycle)
9. [End-to-end data flows](#9-end-to-end-data-flows)
10. [Auth design (JWT + refresh)](#10-auth-design-jwt--refresh)
11. [Payments (Razorpay)](#11-payments-razorpay)
12. [Content & media pipeline](#12-content--media-pipeline)
13. [Doubts / Q&A + realtime](#13-doubts--qa--realtime)
14. [Admin moderation & analytics](#14-admin-moderation--analytics)
15. [API map](#15-api-map)
16. [Frontend pages & guards](#16-frontend-pages--guards)
17. [Validation, middleware, cross-cutting concerns](#17-validation-middleware-cross-cutting-concerns)
18. [Deployment & local run](#18-deployment--local-run)
19. [Design decisions & tradeoffs](#19-design-decisions--tradeoffs)
20. [Interview Q&A cheat sheet](#20-interview-qa-cheat-sheet)
21. [Known gaps / honesty points](#21-known-gaps--honesty-points)

---

## 1. One-line pitch

**Skillarious is a multi-role EdTech SaaS**: educators publish structured course content, students purchase access (free enroll or Razorpay), ask doubts on lessons, leave reviews, and admins can ban users / dismiss content while viewing platform analytics.

---

## 2. High-level architecture

```
┌─────────────────────────────────────────────────────────────────────────┐
│                         Browser (Next.js UI)                            │
│  pages → React context (Auth) → service layer (axios) → cookies/JWT     │
└───────────────────────────────┬─────────────────────────────────────────┘
                                │ HTTP JSON + Bearer token
                                │ CORS + credentials
┌───────────────────────────────▼─────────────────────────────────────────┐
│                    Express API (port 4001)                              │
│  routes → auth/admin middleware → Zod/custom validators → controllers   │
│                         ↓                                               │
│              Drizzle ORM  →  PostgreSQL (Supabase-hosted)               │
│              Local uploads (/uploads) + optional Cloudinary leftovers   │
│              Razorpay SDK  →  payment orders / verify / refund          │
│              Nodemailer    →  OTP + doubt notification emails           │
│              Supabase JS   →  realtime channels on doubts/messages      │
└─────────────────────────────────────────────────────────────────────────┘
```

**Separation of concerns**

| Layer | Responsibility |
|--------|----------------|
| **Frontend (`frontend/`)** | UI, routing, auth session UX, calling APIs |
| **Backend (`backend/`)** | Business rules, auth, payments, DB writes, file serving |
| **Postgres (via Supabase)** | Source of truth for users, courses, transactions, doubts |
| **Razorpay** | Payment orchestration (order → checkout → signature verify) |
| **Email (Nodemailer/Gmail SMTP)** | OTP + educator/student notifications |
| **Vercel rewrite (optional)** | Frontend can proxy `/api/*` to `BACKEND_URL` |

**Why not a monolith Next.js API?**  
Backend is a dedicated Express service so payment webhooks/auth/media upload stay independent of Next’s SSR lifecycle, and the API can be reused by future clients (mobile, admin tools). There is a stub Next route at `frontend/src/app/api/v1/payments/create/route.ts`, but the real payment path hits Express.

---

## 3. Tech stack & why each piece

### Frontend

| Tech | Why |
|------|-----|
| **Next.js 14 (App Router)** | File-based routing, SSR/CSR mix, middleware for cookie checks, easy Vercel deploy |
| **React 18 + TypeScript** | Typed UI contracts with backend DTOs |
| **Tailwind + Radix/shadcn-style UI** | Fast component styling; `class-variance-authority`, `clsx`, `tailwind-merge` |
| **Framer Motion / Motion** | Landing-page animations |
| **Axios** | Centralized HTTP client + interceptors for silent token refresh |
| **react-hot-toast** | Lightweight UX feedback |
| **Razorpay Checkout.js** | Loaded in root layout; opens hosted payment modal |

### Backend

| Tech | Why |
|------|-----|
| **Express + TypeScript (`tsx`/`nodemon`)** | Simple REST API, middleware pipeline, file uploads |
| **Drizzle ORM + drizzle-kit** | Type-safe SQL schema in TS; migrations under `backend/supabase/migrations` |
| **postgres.js** | Lightweight Postgres driver used by Drizzle |
| **Supabase** | Hosted Postgres + Realtime (postgres_changes on `doubts` / `messages`) |
| **JWT (`jsonwebtoken`)** | Stateless access tokens; refresh tokens stored server-side for revocation |
| **bcrypt** | Password hashing (cost factor 10) |
| **Razorpay Node SDK** | Create orders, fetch payments, refunds, HMAC signature verify |
| **express-fileupload** | Multipart video/PDF uploads with temp files |
| **cookie-parser + cors** | Cookie support + frontend origin allowlist with credentials |
| **Zod / custom validators** | Request shape validation (esp. payments, admin actions) |
| **Nodemailer** | Transactional email |

### Infra / tooling

| Piece | Role |
|-------|------|
| **Drizzle Kit `push` / migrations** | Schema evolution |
| **Faker seed scripts** | Demo data (`npm run seed`) |
| **Vercel (`frontend/vercel.json`)** | Frontend hosting + API rewrite to backend |

---

## 4. Repo layout

```
skillarious/
├── frontend/                 # Next.js Learn Sphere UI (dev port 4002)
│   ├── src/app/              # App Router pages
│   ├── src/components/       # UI (video player, payment modal, admin, doubts…)
│   ├── src/context/          # AuthProvider
│   ├── src/services/         # One axios service per domain
│   ├── src/middleware.ts     # Route protection via cookies
│   └── vercel.json           # /api/* → BACKEND_URL
│
└── backend/                  # Express API (dev port 4001)
    ├── server.ts             # App entry: middleware + route mounts
    ├── scripts/seed.ts       # Dummy data
    ├── drizzle.config.ts     # Schema → supabase/migrations
    ├── uploads/              # Local media store served at /uploads
    └── src/
        ├── routes/           # Thin routers
        ├── controllers/      # Business logic
        ├── middleware/       # Admin guard, schema validation, logging
        ├── db/schema.ts      # Drizzle tables (source of truth for model)
        ├── schemas/          # Validation schemas
        └── utils/            # JWT, storage, payment, email, realtime helpers
```

**Frontend service ↔ backend route mapping**

| Frontend service | Talks to |
|------------------|----------|
| `auth.service.ts` | `/api/v1/auth`, `/api/v1/otp` |
| `course.service.ts` | `/api/v1/courses` |
| `content.service.ts` | `/api/v1/content` (modules, classes, materials, categories) |
| `payment.service.ts` / PaymentModal | `/api/v1/payments` |
| `educator.service.ts` | `/api/v1/educators` |
| `student.service.ts` | `/api/v1/student` |
| `doubt.service.ts` | `/api/v1/content/...doubts...` |
| `review.service.ts` | `/api/v1/reviews` |
| `admin.service.ts` | `/api/v1/admin` (routes exist; see [known gaps](#21-known-gaps--honesty-points)) |
| `user.service.ts` | `/api/v1/users` |

---

## 5. Roles & authorization model

### Roles in DB (`users.role` + flags)

| Concept | How it’s stored | What they can do |
|---------|-----------------|------------------|
| **Student / user** | `role: 'user'`, `isEducator: false` | Browse, buy, watch enrolled content, ask doubts, review |
| **Educator** | `isEducator: true` + row in `educators` | Create/update courses, modules, videos, materials; reply to doubts; toggle `doubtOpen` |
| **Admin** | `isAdmin: true` (and/or `role: 'admin'`) | Ban/unban, dismiss course/module/content, analytics, invite admins |
| **Banned user** | `isBanned`, `banReason`, `bannedAt` | Blocked from normal use (moderation path) |

### How authZ is enforced (layers)

1. **Next middleware** (`frontend/src/middleware.ts`)  
   Cookie presence check for `/admin`, `/dashboard`, `/profile`, `/educator`, `/courses/access/*`. Redirect to `/login` if no `accessToken`/`refreshToken` cookies.  
   *This is a coarse gate — not a permission check.*

2. **Client guards**  
   - `EducatorGuard`: redirects non-educators away from educator UI.  
   - Admin pages assume admin flags from `AuthContext` / session validate.

3. **Express `authenticateUser`**  
   Requires `Authorization: Bearer <accessToken>`, verifies JWT, loads user, attaches `req.user = { id, email, role, isAdmin }`.

4. **Domain checks inside controllers**  
   - Course create: must own `educatorId` (`verifyEducatorOwnership`).  
   - Free purchase: price must be `0`.  
   - Reviews: purchase verification before create.  
   - Payments: all payment routes behind `authenticateUser`.

5. **Admin middleware** (`isAdmin`, `isSuperAdmin`)  
   Re-reads DB for `isAdmin` before moderation/analytics; invite-admin requires super-admin.

**Interview line:** *“AuthN is JWT; AuthZ is layered — cookie gate on the edge, role guards in UI, Bearer middleware on API, then ownership/purchase checks in controllers.”*

---

## 6. Domain model (how tables relate)

Core hierarchy:

```
users 1──1 educators
educators 1──* courses
courses *──* category          (via category_courses)
courses 1──* modules
modules 1──* content           (videos + study materials; type discriminator)
users *──* courses             (via transactions = enrollment/purchase)
users *──* reviews → courses / educators
content 1──* doubts → messages
users 1──* otps                (email verification / password reset)
users 1──* admin_logs
admin_invites                  (email invite tokens for new admins)
files                          (generic file metadata; doubts can reference)
```

### Table responsibilities (interview-ready)

| Table | Purpose |
|-------|---------|
| `users` | Identity, credentials, role flags, refresh token, ban state |
| `otps` | Short-lived email OTP (2 min expiry in generator) |
| `educators` | Educator profile (`bio`, `about`, `doubtOpen`) linked to user |
| `courses` | Catalog item: price, thumbnail, schedule, dismiss/moderation fields, viewCount |
| `category` / `category_courses` | Many-to-many tagging for discovery |
| `modules` | Sections inside a course |
| `content` | Polymorphic lesson items (`type`: video/material), `fileUrl`, order, preview flag |
| `transactions` | Proof of purchase / enrollment; status `completed` / `refunded`; `paymentId` (Razorpay id or `FREE_COURSE`) |
| `reviews` | Rating + message; tied to course (and optionally educator) |
| `doubts` / `messages` | Threaded Q&A on a content item; educator replies set `isResponse` |
| `files` | Uploaded file records |
| `admin_logs` | Audit trail of moderation actions |
| `admin_invites` | Tokenized admin onboarding |

**Access rule (business):**  
A student **has access** to a course if there is a `transactions` row with `userId + courseId + status = 'completed'`. Ownership for teaching is `educators.userId` matching the course’s `educatorId`.

---

## 7. Backend request lifecycle

Every API call roughly follows:

```
HTTP request
  → cors (frontend origin + credentials)
  → express.json / urlencoded
  → express-fileupload (temp files in /tmp)
  → cookieParser
  → router mount (/api/v1/...)
      → route-level middleware (authenticateUser, validatePaymentRequest, isAdmin…)
      → controller
          → Drizzle queries / external SDK (Razorpay, email, storage)
      → JSON response { success, message, data? }
```

Entry: `backend/server.ts`

Mounted prefixes:

| Prefix | Domain |
|--------|--------|
| `GET /health` | Liveness |
| `/api/v1/users` | Profile get/update |
| `/api/v1/auth` | Signup, login, refresh, logout, forgot/reset, validate |
| `/api/v1/otp` | Generate / verify OTP |
| `/api/v1/courses` | CRUD-ish courses, search, purchase, access checks |
| `/api/v1/payments` | Create/verify/history/refund |
| `/api/v1/reviews` | CRUD reviews + averages |
| `/api/v1/educators` | Register + profile + doubt toggle |
| `/api/v1/content` | Modules, classes, materials, categories, doubts |
| `/api/v1/student` | Enrolled courses |
| `GET /uploads/*` | Static media |

Admin router exists at `backend/src/routes/admin.ts` but is **not currently mounted** in `server.ts` — important interview honesty point.

---

## 8. Frontend request lifecycle

```
Page / Component
  → uses AuthContext (user, login, logout, …)
  → calls domain service (e.g. course.service)
      → axios with Authorization: Bearer <cookie accessToken>
      → on 401: interceptor calls /auth/refreshtoken once, retries
  → updates UI / toast / router
```

**Auth bootstrap (`AuthContext`)**

1. On mount: read `accessToken` + `refreshToken` cookies.  
2. If only refresh exists → call refresh.  
3. Call `GET /auth/validate` → set `user`.  
4. Expose `login / signup / verifyOtp / forgotPassword / resetPassword / logout / refreshUser`.

**Token storage choice:** cookies (`document.cookie`), not httpOnly.  
*Why (as implemented):* easy for Next middleware + axios to share the same tokens.  
*Tradeoff:* XSS can steal tokens; httpOnly cookies + CSRF would be stricter.

**Env coupling**

- Frontend: `NEXT_PUBLIC_API_URL` → e.g. `http://localhost:4001/api/v1`  
- Backend CORS: `NEXT_PUBLIC_FRONTEND_URL` → e.g. `http://localhost:4002`

---

## 9. End-to-end data flows

### A) Signup → (OTP path) → session

```
UI Signup
  → POST /auth/signup { name, email, password }
  → bcrypt hash → insert users (verified currently set true in controller)
  → optional OTP: POST /otp/generate → store otps + email
  → POST /otp/verify → mark verified, issue access+refresh, store refresh on user
  → auth.service setTokens → cookies
  → AuthContext fetchUserProfile via /auth/validate
```

**Design note:** OTP exists as a verification/password-reset channel; signup currently also marks `verified: true` immediately — worth mentioning as a product inconsistency if asked.

### B) Login → protected page

```
POST /auth/login
  → lookup user by email
  → bcrypt.compare
  → generateAccessToken(id,email) + generateRefreshToken(id)
  → persist refreshToken on users row
  → return tokens → cookies
Next middleware sees cookies → allows /dashboard etc.
```

### C) Silent refresh (axios interceptor)

```
API returns 401
  → interceptor: POST /auth/refreshtoken { token: refreshCookie }
  → server verifies refresh JWT with REFRESH_SECRET
  → checks token == users.refreshToken (revocation / rotation)
  → issues new access + refresh, updates DB
  → retries original request
If refresh fails → clear tokens / logout path
```

### D) Educator publishes a course lesson

```
User registers as educator
  → POST /educators/register → insert educators + users.isEducator=true

Create course
  → POST /courses/create/:educatorId
  → ownership check (user owns that educator profile)
  → insert courses

Create module
  → POST /content/createModule { courseId, name, … }

Upload video “class”
  → POST /content/class/:moduleId  multipart(video)
  → uploadMedia → save under uploads/YYYY-MM/… → public URL
  → insert content { type: 'video', fileUrl, … }

Upload study material
  → POST /content/uploadStudyMaterial → same storage path, content type material
```

### E) Student buys a paid course (Razorpay)

```
Course detail UI → PaymentModal
  → POST /payments/create { courseId, amount, currency }
      → auth required
      → reject if already completed transaction
      → PaymentService.createOrder (amount * 100 paise)
      → return { key, order.id, amount }
  → Razorpay Checkout.js opens
  → on success handler:
      → POST /payments/verify {
            razorpay_payment_id, razorpay_order_id, razorpay_signature, courseId
          }
      → HMAC SHA256(orderId|paymentId, RAZORPAY_SECRET) == signature
      → fetch payment must be 'captured'
      → idempotency: reject duplicate paymentId
      → insert transactions { status: 'completed', paymentId, amount }
  → student now hasAccess = true
```

### F) Free course enroll

```
POST /courses/purchase/:courseId
  → only if price == 0
  → insert transaction with paymentId 'FREE_COURSE', amount 0
```

### G) Watch / access gate

```
GET /courses/access/:courseId  (auth)
  → hasAccess iff completed transaction exists

GET /courses/ownership/:courseId
  → isOwner iff user’s educator profile owns course

GET /content/getClassStream/:contentId
  → returns streamable content metadata/URL
```

### H) Doubt thread

```
Student POST /content/createDoubt { contentId, title, description }
  → validate content exists
  → insert doubts (status open)
  → join path content→module→course→educator→user.email
  → email educator

Educator POST /content/replyToDoubt/:id
  → insert messages { isResponse: true }
  → email student

Realtime: Supabase channels subscribe to postgres_changes on doubts & messages
  → GET /content/realtime-status exposes channel state
```

### I) Review after purchase

```
POST /reviews/create
  → authenticate
  → verifyPurchase (completed transaction)
  → prevent duplicate review
  → insert reviews
Public: GET /reviews/all/:courseId, GET /reviews/averagerating/:courseId
```

---

## 10. Auth design (JWT + refresh)

### Tokens

| Token | Secret | Payload | Lifetime (as coded) | Stored |
|-------|--------|---------|---------------------|--------|
| Access | `JWT_SECRET` | `{ id, email }` | `50d` | Cookie `accessToken` |
| Refresh | `REFRESH_SECRET` | `{ id }` | `1000d` | Cookie + `users.refreshToken` |

### Why access + refresh?

- **Access token:** short-lived *in theory*; used on every API call without DB hit for signature verify (still loads user after verify).  
- **Refresh token:** longer-lived; **server-stored** so logout / token theft can revoke by nulling DB value and rotating on refresh.

### Logout

`POST /auth/logout` with refresh token → set `users.refreshToken = null` → client clears cookies/localStorage leftovers.

### Password reset

`forgotPassword` → OTP/email path → `resetPassword` with OTP + new password (hashed).

### Middleware error codes (useful talking point)

`authenticateUser` returns structured codes: `TOKEN_MISSING`, `TOKEN_INVALID`, `TOKEN_EXPIRED`, `USER_NOT_FOUND`, `AUTH_FAILED` — frontend can branch on expiry vs hard logout.

---

## 11. Payments (Razorpay)

### Why Razorpay?

India-friendly card/UPI wallet checkout, mature JS checkout, server-side order + signature verification pattern.

### Security properties implemented

1. **Server creates order** — client never invents trusted amount alone (still sends amount; server should ideally re-read course price — good improvement to mention).  
2. **HMAC signature verify** — proves payment came from Razorpay with your secret.  
3. **Capture check** — `payments.fetch` status must be `captured`.  
4. **Idempotency** — same `paymentId` can’t create two transactions.  
5. **Auth on all payment routes**.  
6. **Refund path** updates DB status to `refunded` + reason/date.

### Amount units

Razorpay expects **paise** (`INR * 100`). Stored transaction amount is converted back to rupees string.

### Free vs paid

| Path | Mechanism |
|------|-----------|
| Paid | Razorpay order → verify → transaction |
| Free | Direct `purchaseCourse` with `FREE_COURSE` payment id |

Enrollment for UI lists comes from `GET /student/enrolledCourses` (join transactions → courses → educators → users).

---

## 12. Content & media pipeline

### Unified `content` table

Instead of separate `classes` + `materials` tables forever, content is modeled as one table with `type` (`video`, study material, etc.), shared fields: `fileUrl`, `duration`, `views`, `order`, `isPreview`.

**Why:** fewer joins for module curriculum, one upload pipeline, easier ordering/preview flags.

### Storage (current implementation)

`uploadMedia` in `utils/storage.ts`:

1. Sanitize filename  
2. Write under `uploads/YYYY-MM/<timestamp>-name`  
3. Return public URL `{BACKEND_PUBLIC_URL}/uploads/...`  
4. Express serves `/uploads` statically  

Supabase client is still created for **realtime**, not as the primary blob store in this path. Comments/config still mention Cloudinary historically; Next image config allows `res.cloudinary.com`.

**Interview tradeoff:** local disk is simple for MVP; not durable across multiple server instances — S3/Cloudinary/Supabase Storage would be the production move.

### Educator content APIs (under `/api/v1/content`)

- Modules: create / update / delete / list by course  
- Classes (videos): create / update / delete / list / stream  
- Study materials: upload / update / delete / list  
- Categories: CRUD + search  

---

## 13. Doubts / Q&A + realtime

### Sync path

REST creates doubts/messages and emails participants (Nodemailer).

### Async path

Supabase Realtime channels:

- `doubt-changes` → `postgres_changes` on `public.doubts`  
- `message-changes` → on `public.messages`  

Backend logs payloads and exposes `GET /content/realtime-status` for channel health.

**Why Supabase realtime instead of Socket.IO?**  
DB is already on Supabase; listening to row changes avoids a second realtime bus and keeps “source of truth” in Postgres.

**Frontend note:** some chat UI (`ChatBox`) is currently **local React state** (demo), while real doubt flow uses doubt components + API services — distinguish these in interviews.

---

## 14. Admin moderation & analytics

### Moderation actions (controller `Admin.ts`)

| Action | Effect |
|--------|--------|
| Ban user | `isBanned`, reason, timestamp; cannot ban admins; logged in `admin_logs` |
| Unban user | Clears ban fields; logged |
| Dismiss course / module / content | Soft-moderation flags (`isDismissed`, reason, `dismissedAt`) |
| Invite admin | Tokenized invite (`admin_invites`) — super-admin only |
| Register admin | Consumes invite |

### Analytics endpoints (designed)

- User analytics  
- Engagement analytics  
- Revenue analytics  
- Platform overview (users, educators, courses, revenue, reviews, doubts)  
- Review analytics (rating distribution)  
- Educator analytics  

Uses SQL aggregates via Drizzle `sql` / `count` / `avg`.

### Auditability

`logAdminAction` middleware + explicit inserts into `admin_logs` with `metadata` JSON (reason, target email, etc.).

---

## 15. API map

### Auth — `/api/v1/auth`

| Method | Path | Auth | Purpose |
|--------|------|------|---------|
| POST | `/signup` | No | Register |
| POST | `/login` | No | Issue tokens |
| POST | `/refreshtoken` | No (needs refresh body) | Rotate tokens |
| POST | `/logout` | Refresh in body | Revoke refresh |
| POST | `/forgotpassword` | No | Start reset |
| POST | `/resetpassword` | No | Complete reset |
| GET | `/validate` | Bearer | Session → user flags |

### OTP — `/api/v1/otp`

| POST `/generate` | Email OTP |
| POST `/verify` | Verify + issue tokens |

### Courses — `/api/v1/courses`

| GET `/all`, `/single/:id`, `/search`, `/searchByCategory`, `/educator/:id` | Public catalog |
| POST `/create/:educatorId`, PUT `/update/:CourseId`, DELETE `/delete/:CourseId` | Educator |
| POST `/addCategory` | Tag course |
| GET `/ownership/:courseId`, `/access/:courseId` | Auth checks |
| POST `/purchase/:courseId` | Free enroll |
| GET `/purchased` | Auth purchase list |

### Payments — `/api/v1/payments` (all authenticated)

`POST /create`, `POST /verify`, `GET /history`, `POST /refund`, `GET /test-connection`

### Content — `/api/v1/content`

Doubts, modules, study materials, categories, classes/stream as listed in routes.

### Educators / Student / Reviews / Users

Match routers under `backend/src/routes/*`.

---

## 16. Frontend pages & guards

| Area | Routes (examples) | Who |
|------|-------------------|-----|
| Marketing | `/` | Public landing (motion, testimonials, FAQ) |
| Auth | `/login`, `/signup`, `/forgotPassword`, `/verify-email`, `/logout` | Public |
| Catalog | `/courses`, `/courses/[courseId]`, `/category`, `/search` | Public browse |
| Learning | `/watch/[courseId]`, `/courses/access/[courseId]`, `/enrolledCourses`, `/subscribed` | Authed / purchased |
| Student extras | `/doubts`, `/reviews/[courseId]`, `/liked`, `/history`, `/playlists`, `/profile` | Authed |
| Educator | `/educator`, `/educator/register`, `/educator/doubts/[courseId]`, `/content/**` | Educator |
| Admin | `/admin/dashboard`, `/admin/register` | Admin |

**Middleware matcher** protects admin/dashboard/profile/educator/access paths by cookie existence.

**Layout:** root layout wraps `AuthProvider`, Header/Footer, Razorpay script, toaster. Dark theme (`bg-gray-900`).

---

## 17. Validation, middleware, cross-cutting concerns

| Concern | Implementation |
|---------|----------------|
| CORS | Allow frontend origin + `credentials: true` |
| Body parsing | JSON + urlencoded |
| Uploads | `express-fileupload` with temp files |
| Payment validation | `validatePaymentRequest('create'|'verify')` |
| Admin validation | Zod `adminActionSchema` + `validateSchema` |
| Admin logging | `logAdminAction('BAN_USER'|…)` |
| Educator-only helper | `educatorOnly` middleware (DB `isEducator` check) |
| Health | `GET /health` |
| DB connection | `DATABASE_URL` via postgres.js; auth surfaces friendly 503 on network failures |
| Seeding | Faker-based users/educators/courses/modules/content/transactions |

---

## 18. Deployment & local run

### Local

```bash
# Backend
cd backend
cp .env.local.example .env.local   # or fill DATABASE_URL, JWT secrets, Razorpay, Supabase
npm install
npm run migrate    # drizzle-kit push
npm run seed       # optional
npm run dev        # :4001

# Frontend
cd frontend
# NEXT_PUBLIC_API_URL=http://localhost:4001/api/v1
npm install
npm run dev        # :4002
```

### Required env concepts (do not commit secrets)

**Backend:** `DATABASE_URL`, `JWT_SECRET`, `REFRESH_SECRET`, `RAZORPAY_KEY_ID`, `RAZORPAY_SECRET`, `SUPABASE_URL`, `SUPABASE_ANON_KEY`, `NEXT_PUBLIC_FRONTEND_URL`, `PORT`, `BACKEND_PUBLIC_URL` (for absolute media URLs).

**Frontend:** `NEXT_PUBLIC_API_URL`, optional Vercel `BACKEND_URL` for rewrites.

### Production shape

```
Vercel (Next) ──rewrite /api──► Express host (Render/Railway/VM)
                     │
                     ▼
              Supabase Postgres
              Razorpay live keys
              Object storage (recommended upgrade)
```

---

## 19. Design decisions & tradeoffs

| Decision | Rationale | Tradeoff / alternative |
|----------|-----------|------------------------|
| Separate Express API + Next UI | Clear BFF-less API boundary; payments/uploads independent of Next | Two deploys, CORS/config overhead |
| Drizzle over raw SQL / Prisma | Schema-as-TS, lightweight, good Postgres fit | Smaller ecosystem than Prisma |
| Supabase-hosted Postgres | Managed DB + realtime | Vendor coupling; need pooler/IPv4 sometimes |
| JWT access + DB-backed refresh | Revocable sessions without full server sessions | Must protect refresh; long TTLs in code are lax for prod |
| Cookies for tokens (non-httpOnly) | Shared with Next middleware easily | XSS risk vs httpOnly+CSRF |
| Transactions as enrollment proof | Single source for “paid/enrolled” | No separate enrollments table; refunds must flip status |
| Unified `content` table | One curriculum model | `type` must be disciplined |
| Local `/uploads` | Fast MVP media | Not multi-instance safe |
| Razorpay checkout | Familiar India payments UX | Amount should be re-derived from DB on create |
| Soft dismiss flags | Keep data for audits vs hard delete | Queries must filter dismissed content |
| Admin action logs | Accountability | Need consistent mounting of admin routes |
| Service layer on frontend | Thin pages, reusable API calls | Some components still call `fetch` directly (PaymentModal) |
| Layered authZ | Defense in depth | Middleware ≠ fine-grained RBAC library |

### Architectural patterns you can name

- **Layered architecture** (routes → middleware → controllers → data access)  
- **Repository-ish via Drizzle** (schema + queries in controllers)  
- **DTO validation** at edges (payment/admin)  
- **Token rotation** on refresh  
- **Idempotent payment capture**  
- **Soft delete / soft moderation**  
- **Role-based access control (RBAC)** with ownership checks  
- **CQRS-lite** for admin analytics (heavy reads separate from write APIs)  
- **Event-ish realtime** via DB change streams  

---

## 20. Interview Q&A cheat sheet

### “Explain the architecture.”

> Client is Next.js Learn Sphere. It never talks to Postgres directly. All business logic goes through an Express REST API. Postgres on Supabase is the source of truth. Razorpay handles money. Email handles OTP/notifications. Supabase realtime pushes doubt/message changes. Media is stored locally and served statically today.

### “How does authentication work?”

> Login returns JWT access + refresh. Access goes in Authorization header. Refresh is stored hashed-equivalent as raw token in DB for revocation. Axios retries once on 401 after refresh. Logout nulls refresh. Next middleware only checks cookie presence for route gates; real auth is on the API.

### “How do you prevent someone watching without paying?”

> UI may hide content, but the real gate is `checkCourseAccess` / enrolled queries looking for a completed transaction. Free courses create a zero-amount transaction. Paid courses only insert that row after Razorpay signature + capture verification.

### “Walk me through a payment.”

> Create order on server → open Razorpay checkout → client returns payment ids + signature → server HMAC verifies → ensure not duplicate → ensure captured → insert transaction → user appears in enrolled courses.

### “How are educator permissions enforced?”

> User must register into `educators` and set `isEducator`. Course create checks the path param `educatorId` belongs to the logged-in user. Content uploads are behind `authenticateUser` and ownership helpers.

### “How is the course structured?”

> Course → modules → content items (video or material). Categories are M:N. Reviews and doubts hang off courses/content. Purchases hang off users↔courses via transactions.

### “Why Drizzle + Supabase?”

> Wanted typed SQL schema in the repo and managed Postgres. Supabase also gave realtime without standing up Socket.IO for MVP doubt updates.

### “What would you change for production?”

> HttpOnly secure cookies or BFF session; shorten JWT TTLs; mount and harden admin routes; derive payment amount from DB; move media to S3/Cloudinary; rate-limit OTP/auth; add webhook handler for Razorpay; filter dismissed content consistently; add tests; remove secrets from source; align admin frontend paths with backend routes.

### “How do frontend and backend talk?”

> Domain services wrap axios to `NEXT_PUBLIC_API_URL`. CORS allows the Next origin with credentials. Vercel can rewrite `/api/:path*` to the backend URL so the browser can call same-origin `/api`.

### “How do doubts notify teachers?”

> On create, server joins content→module→course→educator→user email and sends mail. Replies email the student. Realtime channels can refresh UIs listening to table changes.

---

## 21. Known gaps / honesty points

Use these if the interviewer probes maturity — shows ownership:

1. **Admin router not mounted in `server.ts`** while `routes/admin.ts` + Admin UI + `admin.service.ts` exist (path shapes also differ slightly: service uses `/admin/users/:id/ban`, router uses `/moderate/user/:userId/ban`).  
2. **JWT lifetimes are very long** (`50d` / `1000d`) — fine for demo, weak for production.  
3. **Tokens in JS-readable cookies** — XSS sensitive.  
4. **Payment create trusts client `amount`** — should re-read `courses.price`.  
5. **Local filesystem uploads** — not horizontally scalable.  
6. **Some watch/chat UI uses dummy data** while other paths are fully API-backed.  
7. **Signup vs OTP verified flags** can be inconsistent depending on path.  
8. **Stripe packages appear in dependencies** but Razorpay is the implemented gateway.  
9. **Email credentials must live in env**, not source (treat any hardcoded SMTP as a bug to fix).  
10. **Completion rate** for enrolled courses is stubbed as `0` in student controller (TODO in code).

---

## Quick mental model (30 seconds)

> **Users become educators or stay students. Educators own courses made of modules and content. Students get access by completing a transaction (free or Razorpay). That transaction unlocks learning and reviewing. Doubts attach to content and notify via email/realtime. Admins moderate users/content and read aggregates. Next.js is the cockpit; Express is the engine; Postgres is the ledger.**

---

*Prepared as an interview helper for the Skillarious / Learn Sphere codebase — architecture, flows, and design rationale.*
