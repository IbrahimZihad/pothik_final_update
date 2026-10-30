# Payment, Refund, Commission and Payout Workflow

All amounts are BDT and pass through `decimal.js`. The server never trusts a client amount: it pays the booking's outstanding balance, verifies callback amounts, and computes provider balances from completed bookings.

## 1. Gateway abstraction

`infrastructure/payments/index.js` exposes `getGateway(name)` with three implementations:

| Gateway | Use | Verification |
| --- | --- | --- |
| `demo` | Local development and demos (default). Forbidden in production. | HMAC-SHA256 over `paymentId:amount:bookingReference:result`, constant-time comparison |
| `sslcommerz` | Bangladesh card/MFS acquiring | Redirect session + server-to-server validation API call; store credentials come from env |
| `bkash` | bKash Tokenized Checkout (PGW v1.2.0-beta) | Server-side `execute` call against the bKash API, falling back to a status query; only `transactionStatus === 'Completed'` settles and the returned amount must match |

Adding a gateway means implementing `createSession()` and `verifyCallback()`; the service layer never changes. Each adapter also exposes `isConfigured()`, which `GET /payments/gateways` reports so the checkout UI only offers gateways that have credentials.

bKash specifics:

- `createSession()` grants a cached `id_token`, then calls `/tokenized/checkout/create` with `merchantInvoiceNumber = payment.id`. The returned `paymentID` is stored as `provider_txn_id`, so repeated callbacks resolve to the same payment; the wallet `trxID` stays inside the gateway payload.
- bKash returns the customer to the browser with a GET request carrying `paymentID` and a `status` hint. The hint is never trusted: `verifyCallback()` executes the payment (or queries it if execute reports it is already done) and only reports success when bKash confirms `Completed`. The route answers GET callbacks with a 303 redirect to the booking page (`?payment=success|failed`) instead of raw JSON.
- Credentials are `BKASH_APP_KEY`, `BKASH_APP_SECRET`, `BKASH_USERNAME`, `BKASH_PASSWORD`, with optional `BKASH_SANDBOX` and `BKASH_BASE_URL`. If any credential is missing, initiating a bKash payment fails with `GATEWAY_NOT_CONFIGURED` and the gateway is reported as not configured.

## 2. Payment lifecycle

```mermaid
sequenceDiagram
  participant C as Customer
  participant API as Payment service
  participant G as Gateway
  participant DB as MySQL

  C->>API: POST /payments {bookingReference, method, gateway, idempotencyKey}
  API->>DB: load booking, assert owner and payable status
  API->>DB: find payment by idempotency key
  alt key already used with same amount/booking
    API-->>C: 200 same payment (idempotent)
  else key reused with different details
    API-->>C: 409 IDEMPOTENCY_CONFLICT
  end
  API->>DB: insert payment INITIATED
  API->>G: createSession(payment, booking, callbacks)
  G-->>API: gatewayUrl + provider transaction id
  API->>DB: payment PENDING + gateway payload
  API-->>C: payment + gatewayUrl

  C->>G: pay on gateway page
  G->>API: signed callback (success/fail/cancel)
  API->>G: verifyCallback(payload)
  alt invalid signature or amount/reference mismatch
    API-->>G: 400 PAYMENT_VERIFICATION_FAILED
  else valid
    API->>DB: BEGIN; lock payment + booking
    API->>DB: payment SUCCEEDED, paid_at, verified_at
    API->>DB: apply to booking, confirm if fully paid
    API->>DB: queue refund for overpayment
    API->>DB: COMMIT
    API-->>G: 200 processed
  end
```

Key guarantees:

- **Idempotency** — `payments.idempotency_key` is unique. A retry returns the original payment; concurrent inserts are caught by the unique constraint and resolved to the same row.
- **Backend verification** — callbacks are never trusted; the demo gateway checks an HMAC, SSLCommerz is validated against its validation API, and bKash is confirmed through its execute/status API.
- **Amount integrity** — callback amount must equal the initiated amount; a callback for a cancelled booking is recorded and the money queues as a refund rather than confirming anything.
- **Double settlement safety** — settlement runs in a transaction with `FOR UPDATE`; an already-paid payment returns `alreadySettled` and does not double-credit the booking.
- **Overpayment** — the excess is applied to the booking only up to the due amount; the remainder becomes a refund request automatically.
- **Sandbox completion** — `POST /payments/:id/demo-complete` builds the same signed callback the gateway would send, so the real verification path is exercised in demos and tests.

The frontend never marks a booking paid; it waits for the server response/booking status.

## 3. Refunds

```
REQUESTED → APPROVED → PROCESSED
     └──────────────→ REJECTED
```

| Step | Actor | Effect |
| --- | --- | --- |
| Request | Customer | Validates refundable balance (`paid − refunded`), creates refund, moves a cancelled booking to `REFUND_PENDING` |
| Approve | Admin | `APPROVED`, customer notified |
| Process | Admin | Records `provider_refund_id`; marks payments `REFUNDED`/`PARTIALLY_REFUNDED`; booking → `REFUNDED` when fully refunded |
| Reject | Admin | `REJECTED`; if no other open refund remains, booking returns to `CANCELLED` |

Every admin decision writes an `audit_logs` row (`refund.approved`, `refund.rejected`, `refund.processed`) with actor, IP and request id.

## 4. Commissions

- Commission rates come from the provider override or the platform defaults (`HOTEL_COMMISSION_RATE`, `TRANSPORT_COMMISSION_RATE`, `GUIDE_COMMISSION_RATE`, `PLATFORM_COMMISSION_RATE`).
- On booking creation each item stores `commission_rate`, `commission_amount` and `provider_payable` — a snapshot that never changes.
- A `commissions` row is created per provider item. It is `EARNED` once the booking is confirmed/completed according to the transition, and is the platform's revenue ledger.
- Admin can read the ledger and summary (`/admin/commissions`, `/admin/commissions/summary`).

## 5. Provider earnings and payouts

Provider-visible balance is derived, never stored:

```
earned    = Σ provider_payable of this provider's items on COMPLETED bookings
requested = Σ payouts in REQUESTED
approved  = Σ payouts in APPROVED
paidOut   = Σ payouts in PAID
available = max(0, earned − requested − approved − paidOut)
```

Payout lifecycle:

```
REQUESTED → APPROVED → PAID
     └──────────────→ REJECTED
```

- A provider can request at most `available` (`PAYOUT_EXCEEDS_BALANCE` otherwise).
- Admin approval and settlement require `payouts:approve`; marking paid stores the bank/bKash `reference`.
- Each transition writes an audit row (`payout.approved`, `payout.rejected`, `payout.paid`) and notifies the provider.
- Commission rows stay `EARNED`; the payout ledger is what reduces the available balance.

Verified demo walkthrough (2026-10-30): a completed hotel stay produced ৳11,000 gross → ৳1,320 commission (12%) → ৳9,680 payable. The provider requested ৳9,680, admin approved and marked it paid with reference `BANK-TXN-DEMO-001`; finance then reported earned ৳9,680, paid out ৳9,680, available ৳0, and the payout appeared in both dashboards.

## 6. Operational rules

- `PAYMENT_GATEWAY=demo` is rejected when `NODE_ENV=production`. Allowed values are `demo`, `sslcommerz` and `bkash`.
- Store callback secrets and gateway credentials only in environment variables. bKash uses `BKASH_APP_KEY`, `BKASH_APP_SECRET`, `BKASH_USERNAME`, `BKASH_PASSWORD` (`BKASH_SANDBOX`, `BKASH_BASE_URL` optional).
- Failed gateway sessions mark the payment `FAILED` with a truncated reason; the booking remains payable and the customer can retry with a new idempotency key.
- Payouts are manual on purpose: an admin records the external transfer reference after moving money outside the system.
- Refunds are admin-driven for every gateway; no automatic bKash or SSLCommerz refund API call is made.
- Verification status: the bKash adapter is covered by unit tests with a mocked bKash API and by an integration test that exercises the GET callback and settlement path. It has **not** been run against the bKash sandbox — no sandbox credentials exist in this environment.
