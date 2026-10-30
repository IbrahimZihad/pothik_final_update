# Testing

POTHIK has three executable layers plus manual browser checks. All commands below run from the repository root unless stated otherwise.

| Layer | Tool | Location | Command | Last result |
| --- | --- | --- | --- | --- |
| API integration | Jest + Supertest | `backend/tests` | `cd backend && npm test` | 8 suites, 56 tests, 148.3 s |
| UI unit/component | Vitest + Testing Library | `frontend/src/**/*.test.*` | `cd frontend && npm test` | 3 files, 14 tests |
| End-to-end | Playwright (Chromium) | `frontend/e2e` | `cd frontend && npm run test:e2e` | 7 tests, 28.6 s |
| Production build | Vite | `frontend` | `cd frontend && npm run build` | Build succeeds |
| OpenAPI document | Node | `backend/src/docs` | `cd backend && npm run openapi` | 114 paths, 140 operations |

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
| `payments.test.js` | Initiation, idempotency, demo settlement, overpayment handling, refund decisions, commission ledger, payout balance rules |
| `reviews.test.js` | Completed-booking requirement, duplicate and out-of-scope rejection, moderation visibility, provider reply |
| `suppliers.test.js` | Provider profile, inventory CRUD, availability calendars, cross-provider ownership, private document storage and download |
| `admin.test.js` | Users and roles, provider decisions, document review, booking search, coupons, blog management, audit log |

Assertions include HTTP status, envelope shape, error codes, database state and money totals.

### Frontend unit suite

- `src/lib/format.test.js` — currency, dates/ranges, nights/days, initials, status tones, text preview.
- `src/i18n/LanguageProvider.test.jsx` — default language, Bangla switching, persistence, fallback keys.
- `src/components/ui/Badge.test.jsx` — status tones, empty status, accessible rating and rating input.

Vitest runs in jsdom with `src/test/setup.js` (jest-dom matchers and cleanup). Configuration lives in `vite.config.js` under `test`.

### End-to-end suite

`frontend/playwright.config.js` starts everything it needs:

- API on `http://localhost:5100` using `backend/tmp/e2e.sqlite`, migrations and seeders;
- Vite on `http://localhost:5180` with `VITE_API_URL=http://localhost:5100/api/v1`;
- Chromium only, one worker, traces on first retry, screenshots on failure.

Specs:

- `public.spec.js` — home renders with navigation, destinations list seeded data, hotel listing shows the seeded hotel, unknown route renders 404.
- `auth.spec.js` — seeded customer signs in and reaches `/account`; wrong password shows an error; anonymous `/account` redirects to `/login`.

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

Latest run (2026-10-30, SQLite): 8 suites / 56 tests passed in 145.6 s, exit code 0 — **83.49% lines** (2114/2532) and **83.39% functions** (457/548) across the collected files, above both thresholds. Re-run the command to refresh these numbers rather than quoting them after code changes.

## 4. Gaps

- No load, soak or concurrency benchmark. Anti-overbooking is tested functionally, not under contention.
- No MySQL, Redis, Nginx or SSLCommerz execution in this environment.
- Only Chromium is configured for Playwright.
- No visual regression testing.
- No test for real email delivery (the dev mailer only logs).
