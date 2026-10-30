# Testing

POTHIK has three executable layers plus manual browser checks. All commands below run from the repository root unless stated otherwise.

| Layer | Tool | Location | Command | Last result |
| --- | --- | --- | --- | --- |
| API integration | Jest + Supertest | `backend/tests` | `cd backend && npm test` | 9 suites, 69 tests, 142.2 s |
| UI unit/component | Vitest + Testing Library | `frontend/src/**/*.test.*` | `cd frontend && npm test` | 4 files, 22 tests, 2.1 s |
| End-to-end | Playwright (Chromium) | `frontend/e2e` | `cd frontend && npm run test:e2e` | 11 tests, 12.2 s |
| Production build | Vite | `frontend` | `VITE_SITE_URL=https://example.test npm run build` | Build succeeds; absolute URLs injected |
| OpenAPI document | Node | `backend/src/docs` | `cd backend && npm run openapi` | 115 paths, 142 operations |

Results were recorded on 2026-10-30 with SQLite and the demo payment gateway. See [PROJECT_AUDIT.md](PROJECT_AUDIT.md) for what was and was not verified.

## 1. Backend integration suite

Each suite calls `setupDatabase()` from `backend/tests/helpers/db.js`, which:

1. creates a unique SQLite file (or uses the configured MySQL database),
2. runs every Umzug migration,
3. runs every seeder,
4. deletes the file on teardown.

That means the suites exercise the same schema and seed data the application ships with. Sessions are obtained by logging in through the real API (`helpers/session.js`), so tokens, cookies and RBAC are part of every test.

Run against MySQL instead:

```bash
cd backend
DB_DIALECT=mysql DB_HOST=127.0.0.1 DB_NAME=pothik_test \
DB_USER=pothik_app DB_PASSWORD='...' NODE_ENV=test npm test
```

Use a disposable schema only: the harness runs migrations and seeders and expects to own the database.

### What each suite covers

| Suite | Coverage |
| --- | --- |
| `auth.test.js` | Register, login, refresh rotation, refresh reuse rejection, logout, profile update, password change/reset |
| `access.test.js` | Role boundaries, ownership enforcement, protected admin/provider routes |
| `catalog.test.js` | Destinations, packages, blogs, search, admin catalog mutations, validation errors |
| `booking.test.js` | Availability, quote, create, anti-overbooking, state machine transitions, provider accept/reject/start/complete, cancellation |
| `payments.test.js` | Initiation, idempotency, demo settlement, gateway capabilities, bKash initiation + GET callback settlement (mocked bKash API), overpayment handling, refund decisions, commission ledger, payout balance rules |
| `bkash.gateway.test.js` | Adapter unit tests with a mocked `fetch`: credential guards, token caching, session creation, execute/status verification, failure/cancel/unknown hints, missing paymentID, auth rejection |
| `reviews.test.js` | Completed-booking requirement, duplicate and out-of-scope rejection, moderation visibility, provider reply |
| `suppliers.test.js` | Provider profile, inventory CRUD, availability calendars, cross-provider ownership, private document storage and download |
| `admin.test.js` | Users and roles, provider decisions, document review, booking search, coupons, blog management, audit log |

Assertions include HTTP status, envelope shape, error codes, database state and money totals.

### Frontend unit suite

- `src/lib/format.test.js` — currency, dates/ranges, nights/days, initials, status tones, text preview.
- `src/lib/seo.test.jsx` — URL absolutization, truncation, breadcrumbs, OG/Twitter/canonical updates, SVG fallback to `og.png`, noindex, default reset, and the `useSeo` mount/unmount lifecycle.
- `src/i18n/LanguageProvider.test.jsx` — default language, Bangla switching, persistence, fallback keys.
- `src/components/ui/Badge.test.jsx` — status tones, empty status, accessible rating and rating input.

Vitest runs in jsdom with `src/test/setup.js` (jest-dom matchers and cleanup). Configuration lives in `vite.config.js` under `test`.

### End-to-end suite

`frontend/playwright.config.js` starts everything it needs:

- API on `http://localhost:5100` using `backend/tmp/e2e.sqlite`, migrations and seeders;
- Vite on `http://localhost:5180` with `VITE_API_URL=http://localhost:5100/api/v1` and `VITE_SITE_URL=http://localhost:5180`;
- Chromium, traces on first retry, screenshots on failure.

Specs:

- `public.spec.js` — home renders with navigation, destinations list seeded data, hotel listing shows the seeded hotel, unknown route renders 404.
- `auth.spec.js` — seeded customer signs in and reaches `/account`; wrong password shows an error; anonymous `/account` redirects to `/login`.
- `seo.spec.js` — home exposes an absolute `og:image`, 1200×630 dimensions, Twitter card and WebSite JSON-LD; destination detail publishes `TouristDestination` plus a breadcrumb; journal articles publish `BlogPosting` with `article:published_time`; `/search` is `noindex` and `robots.txt` disallows private areas.

The suite is self-contained but requires ports 5100 and 5180 to be free. Set `E2E_API_PORT` / `E2E_WEB_PORT` to change them. In CI set `CI=1`, which disables server reuse and adds one retry.

## 2. Manual verification log

Performed in a real browser against the running API and SQLite database:

- Admin, customer and provider dashboards load with seeded aggregates.
- Provider payout: request → admin approve → mark paid, with available balance dropping to zero and an audit row per step.
- Refund queue approvals/rejections and resulting booking state.
- Oversized and wrong-type uploads return `413` / `400` with stable codes.
- Provider verification documents are reachable by the owner and admin, not by other providers or anonymously.
- Language toggle switches public navigation and content between English and Bangla.
- Seeder rerun does not duplicate records or regress booking/refund states.

## 3. Coverage

`npm run test:coverage` is configured with an 80% line/function threshold for `src/modules/**` and `src/shared/**` (routes excluded). Coverage is a guardrail, not a substitute for the scenario assertions above.

Latest run (2026-10-30, SQLite): 9 suites / 69 tests passed in 142.8 s, exit code 0 — **83.68% lines** and **83.78% functions** across the collected files, above both thresholds. Re-run the command to refresh these numbers rather than quoting them after code changes.

## 4. Gaps

- No load, soak or concurrency benchmark. Anti-overbooking is tested functionally, not under contention.
- No MySQL, Redis, Nginx, SSLCommerz or bKash sandbox execution in this environment. The bKash adapter is tested against a mocked API only.
- Only Chromium is configured for Playwright.
- No visual regression testing.
- No test for real email delivery (the dev mailer only logs).
