# Skillarious (Learn Sphere) — Project Pitch Script

> Use this when someone says: *“Tell me about your project.”*  
> Speak in order. Each section is what you say next — not a dump of features.

**Time guide**

| Situation | What to use |
|-----------|-------------|
| 60–90 seconds | Steps 1 → 4 only |
| 3–4 minutes | Steps 1 → 7 |
| Deep dive / follow-ups | Steps 8 → 10 + handoff to README |

---

## Step 1 — Hook (what it is, in one breath)

> “I built **Skillarious**, branded in the product as **Learn Sphere** — an online learning marketplace where educators publish courses, students buy and learn from them, and admins keep the platform safe.”

**Do not** start with tech stack. Start with the product.

---

## Step 2 — Problem (why it exists)

> “The problem I wanted to solve is that learning platforms are not just ‘upload a video.’ You need three sides working together:
>
> 1. **Educators** need a way to structure courses — modules, videos, materials — and answer student doubts.  
> 2. **Students** need a clear path: discover → pay or enroll → get access → learn → ask questions → leave reviews.  
> 3. **Admins** need control — ban abuse, dismiss bad content, see revenue and engagement.
>
> Most toy projects stop at a CRUD course list. The real pain is **access control after payment**, **content ownership**, and **support between student and teacher**.”

**One-liner if interrupted:**  
> “It’s solving multi-role EdTech: who can create, who can watch, who paid, and how doubts get answered.”

---

## Step 3 — Solution (how we solve it — product view)

> “So the solution is a **role-based learning platform**:
>
> - Users sign up and can become **educators**.  
> - Educators create **courses → modules → content** (videos and study materials).  
> - Students browse and either **enroll for free** or **pay via Razorpay**.  
> - Access is not a UI trick — it’s backed by a **transaction record**. If you didn’t complete a purchase, you don’t get access.  
> - On a lesson, students can raise **doubts**; educators get notified and can reply.  
> - Students can leave **reviews** after purchase.  
> - **Admins** can moderate users and content and look at platform analytics.
>
> Frontend is the product UI; backend owns the business rules.”

---

## Step 4 — High-level architecture (how the system is shaped)

> “Architecturally it’s a **split client–server** app:
>
> - **Next.js** frontend for the UI and routing.  
> - **Express** REST API for auth, courses, payments, content, doubts.  
> - **PostgreSQL** (hosted on Supabase) as the source of truth, accessed through **Drizzle ORM**.  
> - **Razorpay** for payments.  
> - **Email** for OTP and doubt notifications.  
> - Supabase **realtime** for doubt/message updates.
>
> The browser never talks to the database directly. All critical rules — login, payment verification, enrollment — live on the API.”

**Draw this verbally if helpful:**  
`UI → API → DB` + `API → Razorpay / Email`

---

## Step 5 — Core user journeys (prove it works end-to-end)

Speak **one journey at a time**. Pick 2–3 unless they ask for all.

### Journey A — Educator publishes

> “An educator registers, creates a course under their educator profile, adds modules, then uploads videos or materials. Files go through the API, get stored, and content rows point to those URLs. Ownership is checked so you can only manage your own courses.”

### Journey B — Student buys and learns

> “A student opens a course, pays through Razorpay Checkout. The server first creates an order, then after payment we **verify the Razorpay signature** and only then insert a completed **transaction**. That transaction is the enrollment proof. Later, access checks and ‘My Courses’ all query that.”

### Journey C — Free course

> “If price is zero, we skip Razorpay and create a free transaction with a special payment id — same access model, different payment path.”

### Journey D — Doubt support

> “On a lesson, the student posts a doubt. We store it, email the course educator, and they can reply in a message thread. That’s the support loop without building a full chat product.”

---

## Step 6 — Key design choices (show engineering judgment)

Say 3–4 of these; don’t recite all.

> “A few design choices I’m intentional about:
>
> 1. **Transactions = enrollment** — one ledger for paid and free access, including refunds by status.  
> 2. **JWT access + refresh stored in DB** — access for API calls, refresh for rotation and logout revocation.  
> 3. **Unified content table** — videos and materials share one model with a type field under modules.  
> 4. **Layered authorization** — Next middleware for coarse route protection, API Bearer auth for real identity, then ownership/purchase checks in controllers.  
> 5. **Payment security** — never trust the client alone; verify HMAC signature and capture status before granting access.”

---

## Step 7 — Tech stack (only after problem + solution)

> “On the stack: **Next.js 14 + TypeScript + Tailwind** on the frontend, **Express + TypeScript** on the backend, **Drizzle + Postgres**, **Razorpay**, **Nodemailer**, and **Supabase** for hosting the DB and realtime. Axios services on the frontend map one-to-one with API domains — auth, courses, payments, content, and so on.”

---

## Step 8 — What I personally built / owned (customize out loud)

Fill this with your truth. Template:

> “I owned [frontend / backend / both]. Specifically I worked on [auth flow / Razorpay verify / course access / educator content upload / doubts / admin analytics]. The hardest part was [e.g. keeping payment verification idempotent and tying it cleanly to enrollment].”

---

## Step 9 — Challenges & what I’d improve (maturity signal)

> “Challenges: getting payment verification and enrollment consistent; modeling course hierarchy cleanly; handling roles without leaking access in the UI only.
>
> If I continued it for production, I’d: shorten token lifetimes and move to httpOnly cookies, always derive payment amount from the DB, move media to object storage, fully wire admin routes to the server, and add tests around payment and access.”

---

## Step 10 — Close + invite questions

> “That’s the project at a high level — a multi-role learning platform with real payment-gated access and educator–student support. Happy to go deeper into auth, the payment flow, or the database design — whichever you prefer.”

---

## 60-second version (memorize this)

> “Skillarious, or Learn Sphere, is an online course marketplace I built for three roles: educators, students, and admins.  
> Educators publish structured courses — modules and content. Students discover courses and either enroll free or pay with Razorpay. Access is granted only after a verified transaction in Postgres — not just a frontend flag. Students can raise doubts on lessons and educators get notified.  
> Technically it’s a Next.js frontend talking to an Express API, with Drizzle on PostgreSQL, plus Razorpay and email.  
> I can walk through payment verification or the auth model if you’d like.”

---

## 3-minute version (checklist while speaking)

1. ☐ Name + what it is  
2. ☐ Problem (3 roles / access / support)  
3. ☐ Solution (marketplace + transaction-gated access)  
4. ☐ Architecture (Next → Express → Postgres + Razorpay)  
5. ☐ One paid journey + one educator publish journey  
6. ☐ 2–3 design choices  
7. ☐ Stack in one sentence  
8. ☐ Challenge / next improvement  
9. ☐ “Want auth, payments, or schema next?”

---

## If they interrupt with specific questions

| They ask… | Jump to |
|------------|---------|
| “How does login work?” | JWT access + DB-backed refresh; Bearer on API |
| “How do you stop unpaid watching?” | `transactions` with `status = completed` |
| “How does payment work?” | create order → Checkout → HMAC verify → insert transaction |
| “What’s the DB design?” | users → educators → courses → modules → content; users ↔ courses via transactions |
| “Why not only Next.js API routes?” | Separate API for payments/uploads/reuse; clearer boundary |
| “What was hard?” | Payment idempotency + access consistency; role ownership checks |

---

## Phrases to avoid

- Listing every page: “There’s login, signup, dashboard, liked, history…”  
- Starting with: “I used React, Node, Mongo…” (wrong DB anyway — it’s Postgres)  
- “It’s like Udemy” without saying **what you actually implemented**  
- Feature salad with no problem → solution → flow

## Phrases that land well

- “Access is a **data** decision, not a UI decision.”  
- “Payment success only counts after **server-side signature verification**.”  
- “Roles are enforced in **layers** — edge, API, then ownership.”  
- “Enrollment and payment share one **transaction ledger**.”

---

*Pair this with `README.md` when they ask for architecture depth.*
