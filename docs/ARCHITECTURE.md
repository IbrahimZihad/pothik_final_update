# Architecture

POTHIK is a **modular monolith**: one deployable API process with hard module boundaries, plus a static React SPA. That keeps transactional booking and payment logic in one database while still allowing the API tier to scale horizontally behind a load balancer.

## 1. System context

```mermaid
flowchart LR
  Customer[CUSTOMER<br/>web browser]
  Provider[HOTEL_OWNER /<br/>TRANSPORT_PROVIDER /<br/>TOUR_GUIDE]
  Admin[ADMIN]

  SPA[React SPA<br/>Vite build, static files]
  Nginx[Nginx<br/>TLS, static, reverse proxy]
  API[Express API<br/>/api/v1]
  DB[(MySQL 8<br/>source of truth)]
  Redis[(Redis<br/>cache + BullMQ)]
  Files[(Upload storage<br/>verification docs, avatars)]
  Gateway[Payment gateway<br/>demo HMAC, SSLCommerz or bKash]
  Mail[Email transport]

  Customer --> SPA
  Provider --> SPA
  Admin --> SPA
  SPA --> Nginx --> API
  API --> DB
  API -. optional .-> Redis
  API --> Files
  API --> Gateway
  Gateway -->|signed callback| API
  API -. jobs .-> Redis
  API --> Mail
```

Redis is **never** the source of truth for bookings, payments, inventory or balances. If Redis is absent, the API runs background jobs inline and caches in process memory.

## 2. Backend module map

```mermaid
flowchart TB
  subgraph Edge
    app[app.js<br/>helmet, cors, compression,<br/>request id, rate limits]
    routes[routes/index.js]
  end

  subgraph Modules
    auth[auth<br/>register, login, refresh,<br/>verify, reset, profile]
    catalog[catalog<br/>destinations, packages, blogs, search]
    suppliers[suppliers<br/>hotels, rooms, vehicles, guides, docs]
    trips[trips<br/>server-side trip pricing]
    bookings[bookings<br/>quote, state machine, inventory]
    payments[payments<br/>gateways, refunds, commissions, payouts]
    reviews[reviews<br/>verified-booking reviews]
    notifications[notifications<br/>in-app, email, messages]
    dashboards[dashboards<br/>customer, provider, admin stats]
    admin[admin<br/>users, providers, coupons, blogs, audit]
  end

  subgraph Shared
    validate[Zod validation]
    authmw[authenticate / authorize / requireRoles]
    money[decimal.js money helpers]
    errors[AppError taxonomy]
    audit[audit writer]
  end

  subgraph Data
    models[Sequelize models]
    repo[module repositories]
    db[(MySQL / SQLite)]
  end

  app --> routes
  routes --> Modules
  Modules --> Shared
  Modules --> repo --> models --> db
```

Every module follows the same layers:

```
*.routes.js     HTTP wiring, permissions, validation
*.validators.js Zod schemas for body/query/params
*.service.js    business rules, transactions, serializers
*.repository.js queries and eager-loading
```

Routes never hold business rules; services never read `req`; repositories never decide authorization.

## 3. Request lifecycle

```mermaid
sequenceDiagram
  participant C as Client
  participant E as Express
  participant M as Middleware
  participant R as Router
  participant S as Service
  participant DB as MySQL

  C->>E: HTTPS request
  E->>M: request-context (X-Request-Id)
  M->>M: helmet, CORS, body limits, rate limit
  M->>M: authenticate (Bearer JWT)
  M->>M: authorize(permission) / requireRoles
  M->>M: validate(zod)
  M->>R: validated request
  R->>S: service call with req.user
  S->>DB: transaction / queries
  DB-->>S: rows
  S-->>R: domain object
  R-->>E: success(res, {message,data,meta})
  E-->>C: {success, message, data, meta}
```

Errors take the same path. `errorHandler` converts `AppError`, Zod, Sequelize constraint errors and Multer errors into the standard failure envelope with a stable `code`; unexpected errors return `INTERNAL_ERROR` plus the request id.

## 4. Response envelope

Every API response is one of:

```json
{ "success": true,  "message": "…", "data": { }, "meta": { "page": 1, "limit": 20, "total": 57 } }
{ "success": false, "message": "…", "code": "MACHINE_CODE", "errors": [{ "field": "email", "message": "…" }] }
```

`meta` is present on paginated collections. HTTP status codes stay meaningful (200/201/204, 400, 401, 403, 404, 409, 413, 422, 429, 503).

## 5. Cross-cutting concerns

| Concern | Implementation |
| --- | --- |
| Money | `decimal.js`; BDT amounts stored as `DECIMAL(12,2)` and serialized as strings |
| IDs | Auto-increment BIGINT internally; bookings have public references (`PTK-…`) |
| Time | UTC in the database; dates rendered in the user's locale |
| Logging | Pino structured logs with request id; no tokens or passwords logged |
| Rate limits | Global API limiter, stricter auth limiter, write limiter on money/booking endpoints |
| Uploads | Multer, MIME allow-list (JPEG/PNG/WEBP/PDF), 5 MB default, served from `/uploads` |
| Ownership | Services resolve the caller's provider profile; a provider can only touch their own inventory, bookings and finance |
| Audit | Admin decisions and financial transitions write `audit_logs` with actor, IP and request id |
| i18n | SPA dictionaries for English and Bangla; backend stores canonical English enum values |

## 6. Related diagrams

- ER model: [DATABASE_DESIGN.md](DATABASE_DESIGN.md)
- Booking state machine and transaction flow: [BOOKING_WORKFLOW.md](BOOKING_WORKFLOW.md)
- Access/refresh rotation: [AUTHENTICATION.md](AUTHENTICATION.md)
- Payment sequence: [PAYMENT_WORKFLOW.md](PAYMENT_WORKFLOW.md)
- Deployment topology and queue degradation: [LOAD_BALANCING.md](LOAD_BALANCING.md)
