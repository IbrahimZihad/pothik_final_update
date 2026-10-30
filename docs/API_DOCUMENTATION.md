# API Documentation

Base URL: `/api/v1` (configurable with `API_PREFIX`). Interactive docs: `/api-docs`; machine-readable spec: `/openapi.json`. The OpenAPI document currently covers health probes; this page is the authoritative catalogue.

## Conventions

- **Auth**: send `Authorization: Bearer <accessToken>`. Refresh tokens travel only in the `pothik_refresh` httpOnly cookie.
- **Content type**: `application/json` except document uploads (`multipart/form-data`, field `file`).
- **Pagination**: `?page=1&limit=20`; responses include `meta.page`, `meta.limit`, `meta.total`, `meta.totalPages`, `meta.hasNext`, `meta.hasPrev`.
- **Money**: BDT decimal strings (`"11000.00"`). The server always re-prices from the catalogue; client prices are ignored.
- **Validation**: Zod schemas per endpoint. Failures return `422 VALIDATION_ERROR` with per-field `errors[]`.
- **Idempotency**: payment initiation requires a client-generated `idempotencyKey`; repeating it returns the same payment.

## Response envelope

```json
{ "success": true, "message": "Payment initiated", "data": { "payment": { "id": 12 }, "gatewayUrl": "…" } }
```

```json
{ "success": false, "message": "Payment exceeds the amount due", "code": "PAYMENT_EXCEEDS_DUE", "errors": [] }
```

| Status | Typical codes |
| --- | --- |
| 400 | `BOOKING_INVALID_TRANSITION`, `REVIEW_NOT_ALLOWED`, `INVALID_PAYOUT_AMOUNT` |
| 401 | `UNAUTHORIZED`, `TOKEN_EXPIRED`, `ACCOUNT_SUSPENDED` |
| 403 | `FORBIDDEN`, `PROVIDER_ONLY`, `OWNERSHIP_REQUIRED` |
| 404 | `NOT_FOUND` |
| 409 | `DUPLICATE_RECORD`, `IDEMPOTENCY_CONFLICT`, `INVENTORY_UNAVAILABLE` |
| 413 | `FILE_TOO_LARGE` |
| 422 | `VALIDATION_ERROR` |
| 429 | `RATE_LIMITED` |

## Health

| Method | Path | Access | Purpose |
| --- | --- | --- | --- |
| GET | `/health` | public | Liveness + uptime |
| GET | `/health/live` | public | Process liveness probe |
| GET | `/health/ready` | public | Database readiness (503 when not ready) |

## Authentication (`/auth`)

| Method | Path | Access | Purpose |
| --- | --- | --- | --- |
| POST | `/auth/register` | public | Create an account (`name`, `email`, `phone`, `password`, optional `role` for providers) |
| POST | `/auth/login` | public | Returns access token + sets refresh cookie |
| POST | `/auth/refresh` | cookie | Rotates refresh token, returns new access token |
| POST | `/auth/logout` | cookie | Revokes the refresh session |
| POST | `/auth/verify-email` | public | Consume verification token |
| POST | `/auth/resend-verification` | public | Re-send verification email |
| POST | `/auth/forgot-password` | public | Request reset email (always 200) |
| POST | `/auth/reset-password` | public | Consume reset token |
| GET | `/auth/me` | authenticated | Current user, roles and provider profile |
| PATCH | `/auth/me` | authenticated | Update name, phone, locale, travel preferences |
| POST | `/auth/change-password` | authenticated | Change password and revoke other sessions |

## Public catalogue

| Method | Path | Purpose |
| --- | --- | --- |
| GET | `/destinations`, `/destinations/meta`, `/destinations/:slug` | Destination listing, filter metadata, detail with spots |
| GET | `/packages`, `/packages/:slug` | Package listing and itinerary/departures |
| GET | `/blogs`, `/blogs/:slug` | Published journal posts |
| GET | `/search?q=` | Cross-catalogue search |
| GET | `/hotels`, `/hotels/:slug`, `/hotels/:slug/availability` | Hotels, rooms, date availability |
| GET | `/vehicles`, `/vehicles/:id`, `/vehicles/:id/availability` | Transport catalogue |
| GET | `/vehicle-categories` | Category metadata |
| GET | `/guides`, `/guides/:id`, `/guides/:id/availability` | Guide catalogue |
| GET | `/reviews` | Approved reviews (filters: target, rating, pagination) |

## Custom trip builder (`/trips`)

| Method | Path | Access | Purpose |
| --- | --- | --- | --- |
| GET | `/trips/addons` | public | Add-on service catalogue |
| POST | `/trips/quote` | customer | Server-priced quote for a composition (hotel + vehicle + guide + add-ons) |
| POST | `/trips` | customer | Save a custom trip draft from a quote |
| GET | `/trips`, `/trips/:id` | customer | List / read own trips |
| PATCH | `/trips/:id` | customer | Update a draft |
| DELETE | `/trips/:id` | customer | Delete a draft |

## Bookings

Customer routes (`/bookings`):

| Method | Path | Purpose |
| --- | --- | --- |
| POST | `/bookings` | Create a booking from a composition or custom trip; server re-prices, reserves inventory |
| GET | `/bookings` | List own bookings (status filter, pagination) |
| GET | `/bookings/:reference` | Detail with items, passengers, payments, history |
| POST | `/bookings/:reference/cancel` | Cancel with reason; refund policy applies |

Provider routes (`/provider/bookings`):

| Method | Path | Purpose |
| --- | --- | --- |
| GET | `/provider/bookings` | Reservations for the caller's provider profile only |
| GET | `/provider/bookings/:reference` | Detail, ownership enforced |
| POST | `/provider/bookings/:reference/accept` | Accept a reservation (→ `AWAITING_PAYMENT`/`CONFIRMED`) |
| POST | `/provider/bookings/:reference/reject` | Reject with reason |
| POST | `/provider/bookings/:reference/start` | Mark trip/stay started |
| POST | `/provider/bookings/:reference/complete` | Complete; releases commission for payout |

## Payments, refunds and finance

Customer (`/payments`):

| Method | Path | Purpose |
| --- | --- | --- |
| POST | `/payments` | Initiate payment (`bookingReference`, `method`, `idempotencyKey`) |
| GET | `/payments`, `/payments/:id` | Own payments |
| POST | `/payments/:id/demo-complete` | Sandbox settlement (demo gateway only) |
| POST | `/payments/callback/:gateway[/:result]` | Gateway callback; payload is verified server-side |
| GET | `/payments/refunds` | Own refunds |
| POST | `/payments/refunds` | Request a refund (`bookingReference`, optional amount) |

Provider (`/provider`):

| Method | Path | Purpose |
| --- | --- | --- |
| GET | `/provider/finance` | Earned / requested / approved / paid out / available |
| GET | `/provider/commissions` | Commission ledger |
| GET | `/provider/earnings` | Cleared earnings by item |
| GET | `/provider/payouts` | Own payout requests |
| POST | `/provider/payouts` | Request payout (`amount`, `method`, optional `notes`) |

Admin (`/admin`):

| Method | Path | Purpose |
| --- | --- | --- |
| GET | `/admin/payments` | All payments |
| GET | `/admin/refunds` | Refund queue |
| POST | `/admin/refunds/:id/approve` | Approve refund |
| POST | `/admin/refunds/:id/reject` | Reject refund |
| POST | `/admin/refunds/:id/process` | Mark refund processed (`providerRefundId`) |
| GET | `/admin/commissions`, `/admin/commissions/summary` | Commission ledger and totals |
| GET | `/admin/payouts` | Payout queue |
| POST | `/admin/payouts/:id/approve` | Approve payout |
| POST | `/admin/payouts/:id/reject` | Reject payout |
| POST | `/admin/payouts/:id/paid` | Mark paid (`reference` = bank/bKash transaction) |

## Provider supply management (`/provider`)

| Method | Path | Purpose |
| --- | --- | --- |
| GET/PATCH | `/provider/profile` | Read/update business profile |
| GET/POST | `/provider/documents` | List / upload verification documents |
| GET/POST | `/provider/hotels` | List / create hotels |
| PATCH | `/provider/hotels/:id` | Update own hotel |
| POST | `/provider/hotels/:id/rooms` | Add room |
| PATCH/DELETE | `/provider/rooms/:id` | Update / remove room |
| GET/PUT | `/provider/rooms/:id/availability` | Room calendar |
| GET/POST | `/provider/vehicles` | List / create vehicles |
| PATCH | `/provider/vehicles/:id` | Update vehicle |
| GET/PUT | `/provider/vehicles/:id/availability` | Vehicle calendar |
| GET/POST | `/provider/drivers` | List / add drivers |
| PATCH/DELETE | `/provider/drivers/:id` | Update / remove driver |
| GET/PUT | `/provider/guide` | Guide profile |
| GET/PUT | `/provider/guide/availability` | Guide calendar |

## Reviews and messaging

| Method | Path | Access | Purpose |
| --- | --- | --- | --- |
| POST | `/reviews` | customer | Review a completed booking (verified purchase; one per target) |
| PATCH | `/reviews/:id/reply` | provider | Public reply to a review |
| GET | `/notifications`, `/notifications/unread-count` | authenticated | In-app notifications |
| POST | `/notifications/:id/read`, `/notifications/read-all` | authenticated | Mark read |
| GET/POST | `/messages` | authenticated | Booking-scoped conversation |

## Admin operations (`/admin`)

| Method | Path | Purpose |
| --- | --- | --- |
| GET | `/admin/stats` | Platform overview (revenue series, pipeline, queues) |
| GET | `/admin/users`, `/admin/users/:id` | User directory |
| PATCH | `/admin/users/:id/status` | Activate / suspend |
| PUT | `/admin/users/:id/roles` | Replace roles (cannot remove own last ADMIN) |
| GET | `/admin/providers`, `/admin/providers/:id` | Provider applications and detail |
| PATCH | `/admin/providers/:id/documents/:documentId` | Verify / reject a document |
| POST | `/admin/providers/:id/approve` | Approve or reactivate provider (optional commission rate) |
| POST | `/admin/providers/:id/reject` | Reject application with reason |
| POST | `/admin/providers/:id/suspend` | Suspend provider |
| GET | `/admin/bookings`, `/admin/bookings/:reference` | All bookings |
| GET/POST | `/admin/coupons` | Coupon list / create |
| PATCH/DELETE | `/admin/coupons/:id` | Update / deactivate |
| GET/POST | `/admin/reviews`, `/admin/reviews/:id/moderate` | Review queue / approve-reject |
| GET/POST | `/admin/blogs` | Blog list / create |
| PATCH/DELETE | `/admin/blogs/:id` | Update (publish/archive) / delete |
| POST/PATCH/DELETE | `/admin/destinations…`, `/admin/packages…` | Catalogue management |
| GET | `/admin/audit-logs` | Paginated audit trail |

## Dashboards

| Method | Path | Access |
| --- | --- | --- |
| GET | `/dashboard` | CUSTOMER |
| GET | `/provider/dashboard` | provider roles |

## Examples

### Register and log in

```http
POST /api/v1/auth/register
{ "name": "Ayesha Rahman", "email": "ayesha@example.com", "phone": "01611112222", "password": "Str0ngPass!23" }
```

```http
POST /api/v1/auth/login
{ "email": "ayesha@example.com", "password": "Str0ngPass!23" }
→ 200 { "success": true, "data": { "accessToken": "…", "user": { … } } }
   Set-Cookie: pothik_refresh=…; HttpOnly; SameSite=Lax
```

### Quote and book

```http
POST /api/v1/trips/quote
{ "type": "CUSTOM_TRIP", "composition": { "adults": 2,
  "hotel": { "hotelId": 1, "checkIn": "2026-11-20", "checkOut": "2026-11-22", "rooms": [{ "roomId": 1, "units": 1 }] },
  "vehicle": { "vehicleId": 1, "startDate": "2026-11-20", "endDate": "2026-11-21" } } }
```

```http
POST /api/v1/bookings
{ "type": "CUSTOM_TRIP", "customTripId": 7,
  "contact": { "name": "Ayesha Rahman", "phone": "01611112222", "email": "ayesha@example.com" } }
→ 201 { "success": true, "data": { "reference": "PTK-2F8K1A", "status": "PENDING", … } }
```

### Pay (demo gateway)

```http
POST /api/v1/payments
{ "bookingReference": "PTK-2F8K1A", "method": "bkash", "idempotencyKey": "5f0c…" }
→ 201 { "data": { "payment": { "id": 42, "status": "INITIATED" }, "gatewayUrl": "…" } }

POST /api/v1/payments/42/demo-complete
→ 200 { "data": { "payment": { "status": "SUCCEEDED" }, "bookingStatus": "CONFIRMED" } }
```

### Request and release a payout

```http
POST /api/v1/provider/payouts      (provider)
{ "amount": 9680, "method": "bank", "notes": "October settlement" }

POST /api/v1/admin/payouts/3/approve   (admin)
POST /api/v1/admin/payouts/3/paid      (admin)
{ "reference": "BANK-TXN-99312" }
```

## Rate limits

| Scope | Default |
| --- | --- |
| Global API | 300 requests / 15 min / IP |
| Auth endpoints | 20 requests / 15 min / IP |
| Writes (bookings, payments, payouts, refunds) | Stricter write limiter per IP |

All limits are configurable through `RATE_LIMIT_*` and `AUTH_RATE_LIMIT_MAX`.
