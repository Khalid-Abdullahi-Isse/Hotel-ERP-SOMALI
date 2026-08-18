# Hotel ERP API plan

## 1. Purpose

This document is the implementation and acceptance plan for the Hotel ERP API and
its Next.js client. Swagger/OpenAPI is the canonical machine-readable contract.
The API must be secure, tenant-isolated, predictable under retries and concurrent
requests, and fast enough for front-desk work.

The initial architecture remains a modular NestJS monolith backed by PostgreSQL.
It provides one transaction boundary for reservations, stays, charges, payments,
invoices, housekeeping, and audit records without premature microservices.

## 2. Delivery principles

1. PostgreSQL is the final authority for money, booking overlap, tenant boundaries,
   uniqueness, and workflow invariants.
2. NestJS provides authorization, validation, orchestration, friendly errors,
   auditing, and the OpenAPI contract.
3. The frontend never makes security decisions; UI permission checks only improve
   usability.
4. A timed-out or retried mutation must not silently create duplicate business data.
5. Every production request is traceable by request ID and measurable by route.
6. Money is represented by decimal strings and dates use explicit formats.
7. Large or slow work is processed asynchronously instead of holding an HTTP request.
8. Backward-compatible API and database changes are preferred.

## 3. Current-state baseline

| Area                               | Current state              | Required action                               |
| ---------------------------------- | -------------------------- | --------------------------------------------- |
| Auth, users, roles                 | Implemented and tested     | Align web token transport and frontend types  |
| Hotel, floors, room types, rooms   | Implemented and tested     | Reconcile pagination and naming with frontend |
| Guests, availability, reservations | Implemented and tested     | Add frontend workflows later                  |
| Front desk/check-in/out            | Core stay flow implemented | Add board/arrival/departure views later       |
| Services and charges               | Implemented and tested     | Connect posted folio to Phase 6 invoices      |
| Payments, refunds, invoices        | Implemented and tested     | Add frontend workflows later                  |
| Expenses                           | Implemented and tested     | Add frontend workflows later                  |
| Housekeeping and maintenance       | Implemented and tested     | Add frontend boards later                     |
| Dashboard and reports              | Core reads implemented     | Add exports and frontend integration later    |
| Audit review                       | Implemented and tested     | Add frontend search later                     |

The original backend product phases 1–10 are complete. The remaining items in this
document that mention a frontend, asynchronous exports, external alert delivery, or a
hosting provider are post-V1 integration/deployment choices, not unfinished core
backend modules. See the Phase 9 and Phase 10 completion reports for measured release
evidence and explicit deployment-owner actions.

Before new business modules, verify that documented endpoints are actually mounted,
present in generated OpenAPI, and reachable through an end-to-end smoke test.

## 4. Public API shape

- Base path: `/api/v1`
- Media type: `application/json`
- IDs: UUID v4 strings
- Dates: `YYYY-MM-DD` in the hotel's configured timezone
- Timestamps: ISO 8601 UTC, for example `2026-08-17T12:30:00.000Z`
- Money: nonnegative or signed decimal strings, for example `"125.50"`
- Currency: ISO 4217 uppercase code such as `USD` or `SOS`
- Enum values: uppercase backend values everywhere
- Request body limit: 1 MiB by default; explicit exceptions for import endpoints
- Unknown request properties: rejected
- Maximum normal page size: 100

### 4.1 Success envelopes

Single-resource endpoints return the resource directly. List endpoints return:

```json
{
  "data": [],
  "pagination": {
    "page": 1,
    "pageSize": 20,
    "total": 0,
    "pageCount": 0
  }
}
```

Use offset pagination for bounded hotel configuration and operational lists. Use
cursor pagination for audit logs, payments, and other append-heavy tables once
their data size warrants it. Never expose an unbounded list.

### 4.2 Error envelope

```json
{
  "statusCode": 409,
  "code": "ROOM_ALREADY_BOOKED",
  "message": "One or more selected rooms are no longer available.",
  "details": {},
  "requestId": "req_01...",
  "timestamp": "2026-08-17T12:30:00.000Z",
  "path": "/api/v1/reservations"
}
```

Every operation documents its expected `400`, `401`, `403`, `404`, `409`, `422`,
and `429` responses. Production `500` responses never expose stack traces, SQL,
credentials, or internal object names.

### 4.3 HTTP behavior

- `200`: successful read/update/action
- `201`: created resource or new authentication session
- `202`: accepted background job
- `204`: successful operation with no response body, used sparingly
- `400`: malformed syntax or DTO validation
- `401`: missing, expired, or invalid authentication
- `403`: authenticated but not permitted
- `404`: resource absent in the authenticated hotel; cross-hotel IDs also return 404
- `409`: workflow, uniqueness, idempotency, or concurrency conflict
- `422`: syntactically valid request that violates a detailed business validation rule
- `429`: rate limited, with `Retry-After`

## 5. Authentication and browser integration

### 5.1 Target model

Support two explicit clients:

1. The first-party Next.js web application uses `Secure`, `HttpOnly`, `SameSite`
   cookies behind one public origin. JavaScript cannot read either token.
2. Swagger, approved integrations, and a future mobile client use bearer access
   tokens. Refresh behavior for non-browser clients is documented separately.

Do not store tokens in `localStorage` or `sessionStorage`. The web flow must either
use a same-origin proxy/BFF or allow the NestJS guard to read a short-lived access
cookie. Choose and record one approach before implementation; do not mix accidental
cookie and bearer behavior across screens.

### 5.2 Session rules

- Access lifetime: 15 minutes initially
- Refresh session: 7 days initially
- Refresh rotation: one-time use with replay detection
- Login limit: 5 attempts/minute/IP plus account lockout
- Refresh limit: 10 attempts/minute/IP/session
- Password reset, deactivation, role change, and logout-all revoke affected sessions
- Concurrent refreshes in browser tabs are coordinated so legitimate parallel calls
  do not revoke the whole session
- ADMIN and sensitive finance actions require MFA before production finance rollout

### 5.3 CSRF and origin controls

If cookies authenticate protected routes, every state-changing request must pass a
central CSRF defense, strict configured-origin validation, and JSON content-type
validation. `SameSite` is defense in depth, not the only control. State-changing
behavior is never implemented with `GET`.

### 5.4 Authorization

- `hotelId` always comes from the verified session, never body, path, or query input
- Endpoint permissions use the backend permission keys as the canonical list
- OpenAPI documents the required permission for every protected operation
- Sensitive record existence is not disclosed across hotel boundaries
- Role/permission changes are audited with old and new values

## 6. Request lifecycle and reliability

Every request follows this order:

1. Edge/load-balancer request-size and abuse checks
2. Trusted-proxy resolution and request-ID validation/generation
3. Security headers and CORS/origin handling
4. Route and authentication rate limits
5. Authentication and active-session lookup
6. Permission and hotel-scope enforcement
7. DTO validation and canonicalization
8. Idempotency lookup for protected mutations
9. Service transaction/business logic
10. Audit record in the same transaction when the action changes business state
11. Consistent response mapping and duration metrics

### 6.1 Request IDs

- Accept a valid `X-Request-Id` with a strict length/character limit or generate one
- Return it in `X-Request-Id` and the error body
- Include it in logs, audit metadata where useful, jobs, and downstream calls
- Never trust arbitrary unbounded client header content

### 6.2 Timeouts

| Operation              |      Server budget |
| ---------------------- | -----------------: |
| Normal read            |          2 seconds |
| Normal mutation        |          3 seconds |
| Availability/dashboard |          5 seconds |
| Database statement     | Below route budget |
| Report/export          |     Background job |

Propagate cancellation where supported. A client disconnect does not replace
transaction correctness: once a financial commit starts, it must complete or roll
back safely.

### 6.3 Idempotency

Require `Idempotency-Key` for:

- reservation creation
- check-in and check-out
- charge creation or voiding
- payment, refund, and expense posting/reversal
- invoice creation/issue/void
- external webhooks and imports

Store `(hotelId, user/client, route, key, requestHash, status, response, expiresAt)`.
The same key and payload returns the saved result. The same key with a different
payload returns `409 IDEMPOTENCY_KEY_REUSED`. Concurrent claims allow only one
execution. Keep financial idempotency records long enough for reconciliation.

### 6.4 Concurrency

- Reservation overlap remains protected by PostgreSQL exclusion constraints
- Multi-row workflows use deterministic lock ordering
- Retry serialization/deadlock failures a small bounded number of times with jitter
- Use a version/ETag or `updatedAt` precondition for editable configuration records
- Return `409 RESOURCE_CHANGED` instead of silently overwriting a newer edit
- Never automatically retry a non-idempotent frontend mutation

## 7. Performance and capacity targets

Initial service-level objectives under expected production load:

| Category               |    p50 |    p95 |    p99 |
| ---------------------- | -----: | -----: | -----: |
| Auth and normal reads  | 100 ms | 300 ms | 750 ms |
| Normal writes          | 150 ms | 500 ms |  1.5 s |
| Availability/dashboard | 250 ms | 700 ms |    2 s |

Initial availability target: 99.9% monthly, excluding planned maintenance. Final
capacity numbers require expected hotel count, concurrent staff, and peak request
rate.

### 7.1 Performance rules

- Keep one bounded Prisma query plan per common endpoint; eliminate N+1 queries
- Select only response fields and use relation includes deliberately
- Review slow queries with `EXPLAIN (ANALYZE, BUFFERS)` using production-like data
- Monitor database pool wait, query time, lock time, and transaction retries
- Add indexes for measured filter/order combinations, not speculative single columns
- Cache stable reference data such as floors, active room types, services, and payment
  methods with short TTLs and explicit invalidation
- Keep immediate session revocation initially; optimize the per-request session query
  only after measuring it
- If needed, introduce a short authorization cache with explicit invalidation on
  logout, deactivation, password reset, and role changes
- Apply response compression at the trusted proxy for suitable payloads

### 7.2 Frontend request policy

- One central generated or typed API client
- One in-flight refresh operation shared by concurrent requests
- At most one automatic request retry after successful authentication refresh
- Debounce searches and cancel superseded requests
- Cache reads with explicit stale times and invalidate only affected query keys
- No automatic mutation retry without an idempotency key
- Present validation, permission, conflict, timeout, offline, and server errors distinctly

## 8. Complete endpoint roadmap

All paths below are relative to `/api/v1`. Exact request and response DTOs must be
present in OpenAPI before frontend integration.

### 8.1 Platform and authentication

| Method | Path                  | Purpose                                 | Access                   |
| ------ | --------------------- | --------------------------------------- | ------------------------ |
| GET    | `/health/live`        | Process liveness                        | Public/internal          |
| GET    | `/health/ready`       | Database readiness                      | Public/internal          |
| POST   | `/auth/login`         | Start session                           | Public, throttled        |
| POST   | `/auth/refresh`       | Rotate refresh and access credentials   | Public-cookie, throttled |
| GET    | `/auth/me`            | Current user and effective permissions  | Authenticated            |
| GET    | `/auth/sessions`      | List the user's active devices/sessions | Authenticated            |
| DELETE | `/auth/sessions/:id`  | Revoke one owned session                | Authenticated            |
| POST   | `/auth/logout`        | Revoke current session                  | Authenticated            |
| POST   | `/auth/logout-all`    | Revoke all sessions                     | Authenticated            |
| POST   | `/auth/mfa/setup`     | Start MFA enrollment                    | Authenticated            |
| POST   | `/auth/mfa/confirm`   | Confirm MFA enrollment                  | Authenticated            |
| POST   | `/auth/mfa/challenge` | Complete login/step-up challenge        | Authenticated/pending    |

Password recovery should only be added when a secure email/SMS delivery channel and
token lifecycle are defined. Until then, ADMIN reset remains the controlled path.

### 8.2 Users, roles, and hotel configuration

Keep the existing user and role endpoints. Add consistent pagination/filters to
`GET /users` and audit every administrative mutation.

| Domain     | Endpoints                                                                                                                                                                   |
| ---------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Users      | `POST /users`, `GET /users`, `GET/PATCH/DELETE /users/:id`, `PATCH /users/:id/restore`, `PATCH /users/:id/unlock`, `POST /users/:id/reset-password`, `PUT /users/:id/roles` |
| Roles      | `GET/POST /roles`, `GET /roles/permissions`, `PATCH/DELETE /roles/:id`, `PUT /roles/:id/permissions`                                                                        |
| Hotel      | `GET/PATCH /hotels/current`                                                                                                                                                 |
| Floors     | `GET/POST /floors`, `GET/PATCH/DELETE /floors/:id`                                                                                                                          |
| Room types | `GET/POST /room-types`, `GET/PATCH/DELETE /room-types/:id`, `PATCH /room-types/:id/restore`                                                                                 |

### 8.3 Rooms, guests, availability, and reservations

Keep and contract-test the existing Phase 3–4 endpoints:

| Domain        | Endpoints                                                                                                                                                                                                                       |
| ------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Rooms         | `GET/POST /rooms`, `GET/PATCH/DELETE /rooms/:id`, `PATCH /rooms/:id/status`, `PATCH /rooms/:id/restore`                                                                                                                         |
| Guests        | `GET/POST /guests`, `GET/PATCH /guests/:id`                                                                                                                                                                                     |
| Guest history | `GET /guests/:id/reservations`, `GET /guests/:id/payments`                                                                                                                                                                      |
| Availability  | `GET /availability/rooms`                                                                                                                                                                                                       |
| Reservations  | `GET/POST /reservations`, `GET/PATCH /reservations/:id`, `PUT /reservations/:id/rooms`, `PATCH /reservations/:id/discount`, `POST /reservations/:id/confirm`, `POST /reservations/:id/cancel`, `POST /reservations/:id/no-show` |

Reservation list filters include booking number, guest search, status, arrival/departure
date range, room, source when added, and pagination. Availability is advisory;
reservation creation always rechecks inside its transaction.

### 8.4 Front desk and stays

| Method | Path                          | Purpose                                   | Permission         |
| ------ | ----------------------------- | ----------------------------------------- | ------------------ |
| GET    | `/front-desk/board`           | Today's room/guest/cleaning/balance board | `reservation.view` |
| GET    | `/front-desk/arrivals`        | Expected and overdue arrivals             | `reservation.view` |
| GET    | `/front-desk/departures`      | Expected and overdue departures           | `reservation.view` |
| POST   | `/reservations/:id/check-in`  | Validate and check in atomically          | `check_in.create`  |
| POST   | `/reservations/:id/check-out` | Settle/validate and check out atomically  | `check_out.create` |

Check-in requires a confirmed reservation, valid arrival policy, assigned active
rooms, and no conflicting occupancy. It marks rooms occupied and appends reservation
history/audit atomically. Phase 5 check-out finalizes room charges, marks the
reservation checked out, and marks rooms dirty in one transaction. Payment settlement
and invoice creation are Phase 6; housekeeping tasks are Phase 7.

### 8.5 Services and charges

| Method           | Path                        | Purpose                             | Permission                           |
| ---------------- | --------------------------- | ----------------------------------- | ------------------------------------ |
| GET/POST         | `/services`                 | List/create service catalog entries | view / `service.manage`              |
| GET/PATCH/DELETE | `/services/:id`             | Read/update/deactivate service      | view / `service.manage`              |
| PATCH            | `/services/:id/restore`     | Restore service                     | `service.manage`                     |
| GET              | `/reservations/:id/charges` | Posted charge history               | `charge.view`                        |
| GET              | `/reservations/:id/folio`   | Current room/service/discount folio | `charge.view`                        |
| POST             | `/reservations/:id/charges` | Post service/other charge           | `charge.create`                      |
| POST             | `/charges/:id/void`         | Void with reason; never delete      | manager-authorized charge permission |

Room charges are generated from reservation price snapshots. Manual price and
discount permissions remain separate. Voids create compensating state and audit
records; financial history is never physically deleted.

### 8.6 Payments, refunds, and invoices

| Method       | Path                         | Purpose                         | Permission                            |
| ------------ | ---------------------------- | ------------------------------- | ------------------------------------- |
| GET/POST     | `/payment-methods`           | List/create hotel methods       | view / manager config                 |
| PATCH/DELETE | `/payment-methods/:id`       | Update/deactivate method        | manager config                        |
| POST         | `/payments`                  | Post an idempotent payment      | `payment.create`                      |
| GET          | `/payments/:id`              | Payment receipt/detail          | `payment.view`                        |
| POST         | `/payments/:id/refunds`      | Full or partial refund          | `payment.refund` + MFA/step-up        |
| GET          | `/reservations/:id/payments` | Reservation payments/refunds    | `payment.view`                        |
| POST         | `/reservations/:id/invoice`  | Create and issue invoice        | `invoice.create`                      |
| GET          | `/invoices`                  | Filter invoices and balances    | `invoice.view`                        |
| GET          | `/invoices/:id`              | Invoice with items and payments | `invoice.view`                        |
| POST         | `/invoices/:id/void`         | Void with reason                | manager-authorized invoice permission |

Payment/refund endpoints require idempotency. Refund totals cannot exceed the
completed original payment. Invoice totals are derived server-side from charges,
discounts, and payments. The client never submits an authoritative balance.

### 8.7 Expenses

| Method       | Path                      | Purpose                    | Permission                            |
| ------------ | ------------------------- | -------------------------- | ------------------------------------- |
| GET/POST     | `/expense-categories`     | List/create categories     | view / manager config                 |
| PATCH/DELETE | `/expense-categories/:id` | Update/deactivate category | manager config                        |
| GET/POST     | `/expenses`               | Filter list/post expense   | `expense.view` / `expense.create`     |
| GET          | `/expenses/:id`           | Expense detail             | `expense.view`                        |
| POST         | `/expenses/:id/reverse`   | Reverse with reason        | manager-authorized expense permission |

Expenses are posted or reversed, never deleted. Store decimal amount, currency
policy, category, payment method, business date, reference, actor, and audit event.

### 8.8 Housekeeping and maintenance

| Method    | Path                                 | Purpose                               | Permission                |
| --------- | ------------------------------------ | ------------------------------------- | ------------------------- |
| GET       | `/housekeeping/tasks`                | Filter board by status/floor/assignee | `housekeeping.view`       |
| GET/PATCH | `/housekeeping/tasks/:id`            | Read/update assignment/notes          | view / update             |
| POST      | `/housekeeping/tasks/:id/start`      | Begin cleaning                        | `housekeeping.update`     |
| POST      | `/housekeeping/tasks/:id/complete`   | Complete and release room             | `housekeeping.update`     |
| GET/POST  | `/maintenance/requests`              | Filter/create requests                | `maintenance.view/create` |
| GET/PATCH | `/maintenance/requests/:id`          | Read/update assignment/notes          | view / update             |
| POST      | `/maintenance/requests/:id/start`    | Start work                            | `maintenance.update`      |
| POST      | `/maintenance/requests/:id/complete` | Complete with optional cost           | `maintenance.update`      |

Housekeeping and room status transitions occur in one transaction. Maintenance
cannot make a reserved/occupied room unavailable without an explicit conflict
workflow. Completion does not silently mark a room available if housekeeping is
still required.

### 8.9 Dashboard, reports, audits, and jobs

| Method | Path                            | Purpose                           | Permission             |
| ------ | ------------------------------- | --------------------------------- | ---------------------- |
| GET    | `/dashboard/summary`            | Current hotel operational summary | `dashboard.view`       |
| GET    | `/reports/occupancy`            | Occupancy report                  | `report.view`          |
| GET    | `/reports/revenue`              | Revenue/payment report            | `report.view`          |
| GET    | `/reports/expenses`             | Expense report                    | `report.view`          |
| GET    | `/reports/reservations`         | Reservation report                | `report.view`          |
| GET    | `/reports/payments`             | Payment and refund report         | `report.view`          |
| GET    | `/reports/outstanding-balances` | Unpaid/partial balances           | `report.view`          |
| POST   | `/reports/:report/export`       | Queue CSV/PDF export              | `report.view`          |
| GET    | `/audit-logs`                   | Cursor-paginated audit search     | `audit.view`           |
| GET    | `/audit-logs/:id`               | Audit detail                      | `audit.view`           |
| GET    | `/jobs/:id`                     | Job status and result metadata    | owning user/permission |

Dashboard endpoints are purpose-built read models, not a burst of dozens of list
requests. Include `generatedAt` and use a short cache. Report filters always include
hotel scope and explicit business-date boundaries.

## 9. OpenAPI and frontend contract workflow

1. Each controller operation has a stable `operationId`, tag, summary, permission,
   request DTO, success schema, and named error responses.
2. Add cookie and bearer security schemes explicitly.
3. Generate and validate `openapi.json` in CI.
4. Run an OpenAPI breaking-change check against the target branch.
5. Generate frontend API types/client from the approved contract.
6. Keep small UI adapters only for presentation, never parallel handwritten API types.
7. Contract tests verify representative generated-client requests against NestJS.
8. Production Swagger UI and raw specifications are disabled or access-controlled.

Immediate reconciliation items:

- login `identifier` versus frontend `email`
- `fullName`/`roles[]` versus frontend `name`/single role
- backend permission keys such as `room.view` versus frontend `rooms.read`
- `pagination.pageSize/pageCount` versus frontend `meta.limit/totalPages`
- `/api/v1` base path consistency across README, environment, browser, and SSR calls
- uppercase enum values versus lowercase UI-only enum types

## 10. Observability and operations

### 10.1 Logs and metrics

Log one structured completion event per request with request ID, route template,
method, status, duration, authenticated hotel/user IDs when allowed, and database
timing. Never log tokens, cookies, passwords, identity documents, full payment
references, or unfiltered request bodies.

Track:

- request count, errors, and latency by route/status
- authentication failures, locks, refresh replays, and permission denials
- database pool utilization, query duration, locks, deadlocks, and retries
- idempotency hits/conflicts/in-progress requests
- reservation conflicts and payment/refund failures
- job queue depth, age, attempts, and failures
- readiness, process restarts, CPU, memory, and event-loop delay

Alert on sustained SLO breaches, elevated `5xx`, database saturation, backup age,
unusual authentication failures, refresh replay spikes, and failed financial jobs.

### 10.2 Production safeguards

- TLS everywhere and `Secure` cookies
- explicit CORS allow-list; never wildcard with credentials
- explicit trusted-proxy configuration
- application database role cannot alter schema, triggers, or audit logs
- reviewed migrations using expand/migrate/contract sequencing
- nightly encrypted backups and monthly clean restore drills
- health endpoints do not expose secrets or detailed dependency internals
- separate production secrets and rotation procedure
- dependency, container, and OpenAPI security checks in CI

## 11. Test strategy and release gates

Every module requires:

- unit tests for calculations and transition rules
- DTO validation and OpenAPI schema tests
- permission matrix tests for ADMIN, MANAGER, STAFF, and a custom role
- cross-hotel ID tests returning non-disclosing responses
- transaction rollback and database-constraint tests
- concurrent-request tests for race-sensitive mutations
- idempotency replay and mismatched-payload tests where applicable
- audit content tests proving secrets and prohibited PII are absent
- frontend contract/adaptor tests
- browser happy path, expired session, permission denial, and conflict behavior

Release gates:

1. formatting, lint, type-check, Prisma validation, and production builds pass
2. unit, integration, end-to-end, database integrity, and contract suites pass
3. no unreviewed OpenAPI breaking change
4. dependency scan has no unresolved critical/high production vulnerability
5. migrations apply to a production-like copy and rollback/forward recovery is documented
6. load test meets the route SLOs at expected peak and a defined safety multiplier
7. backup restore and smoke tests pass before first production launch

## 12. Phased implementation roadmap

### Phase 0: Contract and request foundation

- Register and smoke-test all existing modules
- Export the real OpenAPI document and compare it with backend docs/frontend calls
- Decide and implement the first-party cookie/BFF authentication transport
- Align auth, user, permissions, enums, errors, and pagination
- Add request IDs, error metadata, body limits, timeouts, trusted proxy handling,
  centralized CSRF/origin checks, and Swagger production policy
- Generate the frontend client/types

**Exit:** Login, refresh, SSR `/auth/me`, logout, rooms, guests, availability, and
reservations work end-to-end without handwritten contract mismatches.

### Phase 1: Reservation integration and front desk

- Connect the existing guest/reservation frontend screens to the real API
- Implement front-desk board, arrivals, departures, check-in, settlement quote,
  and check-out
- Add reservation idempotency and concurrency/load tests

**Exit:** A STAFF user can complete booking through check-out safely, including
two-user conflicts and browser retries.

### Phase 2: Folio, services, payments, and invoices

- Implement service catalog, charges, voids, payment methods, payments, refunds,
  invoices, receipts, and outstanding balances
- Add MFA/step-up for refund and sensitive manager actions
- Add durable financial idempotency and reconciliation tests

**Exit:** Financial totals reconcile from immutable/voidable records; duplicate
submissions and over-refunds are impossible.

### Phase 3: Housekeeping and maintenance

- Implement task boards, assignment, transitions, and room-status synchronization
- Create housekeeping work automatically on check-out
- Add maintenance availability and conflict rules

**Exit:** Room state remains consistent across stay, cleaning, and maintenance races.

### Phase 4: Expenses, dashboard, reports, and audit review

- Implement expense workflows and reversals
- Implement optimized dashboard read models
- Implement report queries, asynchronous exports, job status, and audit search

**Exit:** Management screens use real, permission-filtered data and large exports do
not block request workers.

### Phase 5: Production hardening

- Establish production capacity and load profiles
- Tune measured queries and pool sizes
- Add shared rate limiting/cache/queue only where measurements justify them
- Complete alerts, runbooks, backup restore, secret rotation, penetration testing,
  and disaster-recovery rehearsal

**Exit:** All release gates pass at expected peak load plus the agreed safety margin.

## 13. Decisions required before Phase 0 closes

1. Web-only versus future mobile/external API clients
2. Same-origin reverse proxy versus dedicated Next.js BFF
3. Expected hotel count, rooms per hotel, concurrent employees, and peak requests
4. One currency per hotel versus multi-currency transactions and exchange rates
5. Required payment methods/providers and whether external webhooks are involved
6. Check-in/out time, early/late policy, deposits, and unpaid checkout policy
7. Tax/service-charge rules and invoice legal requirements
8. Reservation source/channel requirements
9. MFA delivery method and recovery process
10. Data retention, audit retention, RPO, and RTO targets

Until these decisions are recorded, implementations should not invent irreversible
financial, identity, or deployment behavior.
