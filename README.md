# POTHIK — Online Travel Agency for Bangladesh

POTHIK is a full-stack OTA that lets travellers plan a trip across Bangladesh — hotel rooms, transport, tour guides and curated packages — price it on the server, pay in BDT and manage the booking from one account. Hotels, transport operators and guides get their own dashboard for inventory, reservations and finance. Administrators approve providers, moderate content and move money.

| Area | Stack |
| --- | --- |
| Frontend | React 18, Vite 5, React Router 6, TanStack Query 5, Tailwind CSS 3, Recharts |
| Backend | Node.js 22, Express 4, Sequelize 6, Umzug migrations, Zod validation, Pino logging |
| Data | MySQL 8 (authoritative), Redis + BullMQ (optional jobs/cache) |
| Payments | Gateway abstraction: signed demo gateway (default) or SSLCommerz |
| Auth | JWT access tokens (15 min) + rotating refresh cookie, RBAC, backend ownership checks |
| Tests | Jest + Supertest (backend), Vitest + Testing Library, Playwright (frontend) |

## Roles

Five roles only: `ADMIN`, `HOTEL_OWNER`, `TRANSPORT_PROVIDER`, `TOUR_GUIDE`, `CUSTOMER`.

## Quick start (SQLite, no external services)

```bash
npm run setup                 # install backend + frontend dependencies
cp backend/.env.example backend/.env
cp frontend/.env.example frontend/.env
# set JWT_ACCESS_SECRET / JWT_REFRESH_SECRET in backend/.env (>= 32 chars in production)
cd backend && DB_DIALECT=sqlite SQLITE_STORAGE=tmp/dev.sqlite npm run db:setup && DB_DIALECT=sqlite SQLITE_STORAGE=tmp/dev.sqlite npm start
cd frontend && npm run dev
```

Open http://localhost:5173. Demo users created by seeders use the password from `SEED_DEMO_PASSWORD` (default `PothikDemo123`):

| Role | Email |
| --- | --- |
| CUSTOMER | customer@pothik.test |
| HOTEL_OWNER | hotel.owner@pothik.test |
| TRANSPORT_PROVIDER | transport@pothik.test |
| TOUR_GUIDE | guide@pothik.test |

The admin account is created from `ADMIN_EMAIL` / `ADMIN_PASSWORD` in `backend/.env`; no admin password is baked into code or seeders.

## Documentation

| Document | Contents |
| --- | --- |
| [docs/PROJECT_AUDIT.md](docs/PROJECT_AUDIT.md) | What is implemented, what was verified, what is still pending |
| [docs/ARCHITECTURE.md](docs/ARCHITECTURE.md) | Layering, modules, request lifecycle, nine Mermaid diagrams |
| [docs/DATABASE_DESIGN.md](docs/DATABASE_DESIGN.md) | ER diagram and table reference |
| [docs/API_DOCUMENTATION.md](docs/API_DOCUMENTATION.md) | Endpoint catalogue, envelope, error codes, examples |
| [docs/AUTHENTICATION.md](docs/AUTHENTICATION.md) | Token rotation, RBAC, ownership enforcement |
| [docs/BOOKING_WORKFLOW.md](docs/BOOKING_WORKFLOW.md) | State machine, quoting, anti-overbooking |
| [docs/PAYMENT_WORKFLOW.md](docs/PAYMENT_WORKFLOW.md) | Gateways, idempotency, refunds, commissions, payouts |
| [docs/LOAD_BALANCING.md](docs/LOAD_BALANCING.md) | Stateless scaling, Nginx upstream, queues, caching |
| [docs/DEPLOYMENT.md](docs/DEPLOYMENT.md) | Docker Compose topology, environment, operations |
| [docs/TESTING.md](docs/TESTING.md) | How to run every suite and what it covers |
| [docs/IMPLEMENTATION_PROGRESS.md](docs/IMPLEMENTATION_PROGRESS.md) | Phased progress log with evidence |

Interactive API reference: `/api-docs` (Swagger UI) and `/openapi.json`. The spec is intentionally minimal today — see [docs/API_DOCUMENTATION.md](docs/API_DOCUMENTATION.md) for the full catalogue.

## Layout

```
backend/   Express API: modules (auth, catalog, bookings, payments, reviews, suppliers,
           trips, notifications, admin, dashboards), models, migrations, seeders, tests
frontend/  React SPA: public site, auth, customer/provider/admin dashboards
deployment/ Docker Compose, Nginx, scripts
docs/      Architecture and operations documentation
```

## Honesty note

The application was developed and verified end-to-end against SQLite with the demo payment gateway. MySQL 8, Redis/BullMQ, Docker/Nginx and SSLCommerz are implemented but were **not** executed in this environment; see PROJECT_AUDIT.md for the exact verification matrix before claiming production readiness.
