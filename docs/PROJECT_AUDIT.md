# Project Audit — POTHIK OTA

**Audit date:** 2026-10-30
**Scope:** full repository (`backend/`, `frontend/`, `deployment/`, `docs/`) at commit state `d42e70d` plus the current working-tree changes.
**Method:** inspect the code, run the shipped migrations and seeders, execute the backend, frontend and end-to-end suites, call the API and use the UI in a real browser. Nothing below is marked verified unless it was executed in this environment.

## 1. Status at a glance

| Area | Built | Verified locally | Notes |
| --- | --- | --- | --- |
| Customer storefront (destinations, packages, hotels, transport, guides, journal, search) | Yes | Yes | React SPA against the live API and seeded data |
| Trip builder with server-side pricing | Yes | Yes | `/trips/quote` prices on the server; client never supplies totals |
| Booking engine, anti-overbooking, state machine | Yes | Yes | Row locks + per-date inventory; 11-state transition map |
| Auth: JWT access + rotating refresh, RBAC, ownership | Yes | Yes | Refresh reuse revokes the token family |
| Payments, refunds, commissions, payouts | Yes | Yes (demo gateway) | SSLCommerz adapter implemented, not exercised |
| Reviews with verified-booking rules and moderation | Yes | Yes | Owner, completed-booking and duplicate checks |
| Notifications, booking messages, background jobs | Yes | Yes (in-app + inline queue) | Email is a log-only dev transport; Redis queue not run |
| Admin back office | Yes | Yes | Users, providers, documents, bookings, finance, coupons, reviews, blogs, audit |
| Role dashboards (customer, hotel, transport, guide, admin) | Yes | Yes | Browser walkthroughs on SQLite |
| Bilingual UI (EN/BN) | Partially | Yes | 268/268 keys translated; some dashboard sentences remain English |
| MySQL 8 | Supported | **No** | No MySQL server available in this environment |
| Redis + BullMQ | Supported | **No** | No Redis available; inline fallback verified instead |
| Docker / Nginx deployment | Shipped | **No** | Docker CLI is not installed here; compose YAML parsed only |
| SSLCommerz sandbox | Adapter present | **No** | Requires merchant credentials and public callback URL |

## 2. Evidence collected

| Check | Command | Result |
| --- | --- | --- |
| Backend integration suites | `cd backend && npm test` | **8/8 suites, 56/56 tests passed**, 173.7 s (latest run, after the production-seeding guard) |
| Frontend unit tests | `cd frontend && npm test` | **4 files, 22/22 tests passed**, 2.1 s |
| End-to-end (Chromium) | `cd frontend && npm run test:e2e` | **11/11 tests passed**, 12.2 s, own API + SPA on ports 5100/5180 |
| Link previews / structured data | `e2e/seo.spec.js` | Absolute `og:image` + dimensions, WebSite/TouristDestination/BlogPosting JSON-LD, noindex search, robots.txt |
| Production build | `VITE_SITE_URL=https://example.test npm run build` | Built in 6.42 s; main JS 1,084 kB (296 kB gzip); absolute canonical/OG URLs injected |
| Coverage gate | `cd backend && npm run test:coverage` | Exit 0; 83.49% lines / 83.39% functions (80% thresholds) |
| OpenAPI generation | `cd backend && npm run openapi` | 114 paths / 140 operations written to `docs/openapi.json` |
| Migrations + seeders | `npm run db:setup` (SQLite) | 7 seeders: 8 divisions, 64 districts, 9 destinations, 4 packages, 3 posts, 5 providers, 5 bookings |
| Seeder idempotency | Run `db:seed` twice | Second run completed without duplicate rows (refund status stayed `REFUNDED`) |
| Payout lifecycle | Browser: provider request → admin approve → mark paid | Available balance ৳9,680 → ৳0; paid-out ৳9,680; audit rows written |
| Audit trail | API + DB inspection | `payout.approved`, `payout.rejected`, `refund.rejected` include actor, IP, request id |
| Upload validation | Oversized and wrong-type uploads | `413 FILE_TOO_LARGE` and `400 UNSUPPORTED_FILE_TYPE` |
| Document privacy | `tests/suppliers.test.js` | Owner 200, other provider 403/404, anonymous 401, `/uploads/private/...` 404 |

Test harness detail: each backend suite gets a fresh SQLite file created by the real Umzug migrations and seeders; set `DB_DIALECT=mysql` to run the same suites against a disposable MySQL database. The Playwright run boots its own API (`tmp/e2e.sqlite`) and Vite server, so it does not depend on a developer's running processes.

## 3. Implemented feature inventory

### 3.1 Identity and access
- Registration for customers and the three provider types; admin accounts are created only from environment configuration.
- Email verification and password reset token flows (tokens are hashed and expire).
- Access token 15 minutes; refresh token 7 days in an httpOnly cookie with rotation and SHA-256 storage. Reuse of a rotated token revokes the whole family.
- Role/permission model with exactly five roles. Authorization middleware plus service-level ownership checks (provider can only touch its own inventory and bookings).
- Profile management, password change, admin user status/role management.

### 3.2 Catalog and content
- 9 seeded destinations with districts/divisions/tourist spots, packages with departures and itineraries, hotels with rooms and per-date availability, vehicles with drivers, guides with availability, journal posts.
- Public list/detail/search endpoints; admin create/update/archive for destinations and packages; slug generation and moderation states.
- Images are referenced by URL; the seeded demo uses local SVG/PDF placeholders.

### 3.3 Trip builder and bookings
- Custom composition (hotel + transport + guide + destinations + add-ons) quoted on the server; saved trips are owned per customer.
- Booking creation validates dates, inventory and provider ownership, locks inventory rows, snapshots commission rates, writes status history, and expires the hold only via explicit cancellation (see limitations).
- Strict status machine: `PENDING → AWAITING_CONFIRMATION / AWAITING_PAYMENT → CONFIRMED → IN_PROGRESS → COMPLETED`, with `REJECTED`, `CANCELLED`, `REFUND_PENDING`, `REFUNDED` branches.
- Provider actions: accept, reject, start, complete. Completion is what makes provider money available.

### 3.4 Payments, refunds, commissions, payouts
- Gateway abstraction with a signed demo gateway and an SSLCommerz adapter. Callbacks are verified server-side, never trusted from the browser.
- Idempotency keys on initiation; settlement locks payment and booking rows; overpayment is auto-refunded.
- Refund workflow `REQUESTED → APPROVED → PROCESSED` / `REJECTED`, with booking status kept consistent.
- Commission ledger per booking item; provider finance derives earned/available/paid-out and refuses payouts above the available balance.
- Admin payout workflow `REQUESTED → APPROVED → PAID` (or `REJECTED`) with bank reference and audit logging.

### 3.5 Reviews, notifications, messaging
- Reviews require a completed booking, a target that belongs to that booking, one review per target, and moderation before publication. Providers can reply.
- In-app notifications with unread counts and mark-as-read; booking-scoped message threads.
- Background handlers for email, reminders and payout notices; BullMQ when Redis is configured, inline execution otherwise.

### 3.6 Administration and dashboards
- Admin statistics, user and provider queues, document verification, booking search, finance queues, coupons, review moderation, blog management and audit log.
- Customer dashboard (upcoming trip, spend, loyalty, notifications), provider dashboards for hotel/transport/guide, admin revenue dashboard.

### 3.7 Cross-cutting
- Layered modules (`routes → validators → service → repository → models`), Zod validation at the boundary, central error handler, request ids, structured Pino logs, rate limits, Helmet, CORS allow-list, envelope responses, pagination metadata.
- Uploads: images/PDF only, size/count limits, random filenames. Verification documents are stored under `uploads/private` and served only through authenticated owner/admin routes.
- Documentation: architecture, database, API catalogue, OpenAPI, auth, booking, payment, scaling, deployment, testing, progress.

### 3.8 SEO and link previews
- Static `<head>` defaults with canonical, Open Graph, Twitter card and an Organization/WebSite JSON-LD graph; absolute URLs injected at build time from `VITE_SITE_URL` (`PUBLIC_URL` in Docker).
- Per-route metadata and JSON-LD via `frontend/src/lib/seo.js`: destination (`TouristDestination`), package (`TouristTrip` + `Offer`), hotel (`Hotel`), vehicle (`Product` + `Offer`), guide (`Service` + `Offer`), journal (`BlogPosting`), list pages (`CollectionPage`) and `BreadcrumbList` on detail pages.
- `noindex` on search, dashboards, 404 and auth-adjacent areas; `public/robots.txt` blocks account, provider, admin and payment paths.
- 1200×630 PNG preview image generated by `npm run og:image`; SVG covers fall back to it because social scrapers reject SVG.
- Client-rendered only: non-JS crawlers read the static site-level preview; page-specific previews there need SSR/prerendering.

## 4. Security review

| Control | Status |
| --- | --- |
| Secrets only in environment; `.env.example` contains placeholders | Yes |
| Passwords hashed with bcrypt (configurable cost) | Yes |
| Refresh tokens hashed at rest, rotation + reuse detection | Yes |
| Authorization enforced in the API, not only the UI | Yes |
| Provider ownership checks on inventory, bookings and documents | Yes |
| Payment callbacks verified and idempotent | Yes (demo gateway exercised) |
| Financial transitions audited with actor, IP and request id | Yes |
| SQL injection surface | ORM parameterized queries; no raw user input concatenation found |
| Upload type/size limits; KYC documents not publicly served | Yes |
| Rate limiting | Per-process; not shared across replicas (see limitations) |
| Security headers | Helmet on API, explicit headers on the static server |
| Demo credentials in code | None; seeded users take the password from `SEED_DEMO_PASSWORD`, and production seeding refuses to run without an explicit value |

## 5. Known limitations and gaps

These are real and should be addressed before claiming production readiness.

1. **Demo data is demo data.** Seeders create fictional providers, bookings and payments for development. They are not a substitute for production content.
2. **MySQL was not executed here.** The code path is implemented (`mysql2`, utf8mb4, UTC, pool settings) and the suites accept `DB_DIALECT=mysql`, but no MySQL server was available. Run the full suite against MySQL before launch.
3. **Redis/BullMQ was not executed here.** Only the inline fallback was exercised. Verify queue retries, worker restarts and job visibility in staging.
4. **Docker and Nginx were not run.** `docker compose config` and a live request through Nginx remain unverified; the compose file was YAML-parsed only.
5. **SSLCommerz was not exercised.** The adapter needs sandbox credentials and a public callback URL. IPN verification, failure/cancel paths and reconciliation should be tested in sandbox.
6. **Email is log-only.** `src/infrastructure/email/mailer.js` logs messages outside tests. Production needs an SMTP/API transport; password reset and verification emails will not reach users as shipped.
7. **No automatic expiry of unpaid bookings.** `bookings.expires_at` exists in the schema but is never set and no job enforces it. Unpaid holds stay until cancelled.
8. **Booking reminders are not scheduled.** The handler exists, but nothing enqueues reminder jobs yet.
9. **Rate limits are per API process.** With two replicas the effective limit doubles. Move limiting to Redis or the edge for strict global limits.
10. **Bilingual coverage is uneven.** All 268 translation keys exist in both languages, and public/auth screens use them, but several dashboard sentences are hardcoded English (for example the account dashboard greeting). Complete the dashboard pass before advertising a fully bilingual product.
11. **Frontend bundle is one large chunk** (1,084 kB minified). Works, but route-level code splitting is advisable.
12. **Browser coverage is Chromium only.** Playwright is configured for one project; Firefox/WebKit are not run.
13. **No Prometheus metrics endpoint.** Health checks, logs and audit logs exist; dashboards/metrics are intentionally not faked.
14. **Repository hygiene.** `backend/tmp/dev.sqlite` is tracked despite `backend/tmp/` being ignored, and the demo database changes on every run. Untrack it deliberately (preserve a copy first) before sharing the repository.
15. **No load or soak testing.** Horizontal scaling is architecturally supported but not measured.
16. **Page-specific previews require JavaScript.** The SPA updates OG tags at runtime, so non-JS crawlers (WhatsApp, Facebook, LinkedIn) show the site-level preview for every URL. Google and Bing execute JavaScript and see per-page metadata. SSR or prerendering is required to change that.
17. **Previews need the public origin at build time.** `VITE_SITE_URL` / `PUBLIC_URL` must be set before building; rebuilding is required if the domain changes. A wrong value produces absolute preview URLs pointing at the wrong host.

## 6. Pre-production checklist

- [ ] Provision MySQL 8.4/8.0 with utf8mb4, UTC and backups; run migrations and the full test suite with `DB_DIALECT=mysql`.
- [ ] Set unique 32+ byte JWT secrets, `PAYMENT_CALLBACK_SECRET`, and an admin bootstrap password; remove all demo credentials and data.
- [ ] Configure SSLCommerz production credentials and a public HTTPS callback URL; test success, failure, cancel and duplicate IPN.
- [ ] Replace the log mailer with a real provider and verify reset/verification/notification delivery.
- [ ] Terminate TLS at Nginx, enable HSTS, restrict `/api-docs` if it should not be public.
- [ ] Enable Redis, run the worker as a separate service, and test retries plus Redis outage behaviour.
- [ ] Decide and implement unpaid-booking expiry and reminder scheduling.
- [ ] Put rate limiting at the edge or in Redis if strict global limits are required.
- [ ] Set up uptime checks on `/api/v1/health/ready` and `/nginx-health`, log retention and backup verification.
- [ ] Run a load test against ≥2 API replicas and a MySQL primary.

## 7. Reproducing this audit

```bash
# Backend (SQLite, real migrations + seeders)
cd backend
npm ci
DB_DIALECT=sqlite SQLITE_STORAGE=tmp/dev.sqlite npm run db:setup
npm test

# Frontend unit + build
cd ../frontend
npm ci
npm test
npm run build

# End-to-end (starts its own API and SPA)
npm run test:e2e

# OpenAPI document
cd ../backend && npm run openapi
```

## 8. Conclusion

The repository is a working OTA slice, not a mockup: the booking, payment, refund, commission and payout flows are enforced by the API, exercised by integration tests and demonstrated in the browser. It is **not yet production-proven** on MySQL, Redis, Docker/Nginx, SSLCommerz or email delivery, and the limitations in section 5 are material. Treat the local verification as strong evidence of behaviour, not as a deployment sign-off.
