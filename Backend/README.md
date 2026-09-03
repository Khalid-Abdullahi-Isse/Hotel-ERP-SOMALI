# Somali Hotel ERP Backend

Backend foundation, security, rooms, reservations, transaction-safe hotel stays,
finance, operations, and reporting for a focused hotel ERP: NestJS 11,
PostgreSQL 18, Prisma 7, REST, Swagger, JWT authentication, rotating refresh
sessions, ADMIN-controlled users/roles, structured logging, Docker, and a
database-first V1 domain model.

## Prerequisites

- Node.js 24 (Node 22 LTS is also suitable for production)
- Docker with Compose

## Local setup

Use the Docker host ports below to avoid collisions with other local services already using the default ports.

```bash
cp .env.example .env
npm ci
docker compose up -d postgres redis
npm run db:deploy
npm run prisma:generate
npm run bootstrap:admin
npm run start:dev
```

On PowerShell, use `Copy-Item .env.example .env` instead of `cp`.

Safe local ports for the Docker stack:

- API: `http://localhost:3005/api/v1/health/live`
- Readiness: `http://localhost:3005/api/v1/health/ready`
- Swagger: `http://localhost:3005/docs`
- Postgres: `localhost:5433`
- Redis: `localhost:6380`

If you run the backend outside Docker, keep the local `.env` values aligned with these host ports:

- `PORT=3005`
- `DATABASE_URL=postgresql://hotel_erp:change_me@localhost:5433/hotel_erp?schema=public`
- `REDIS_URL=redis://127.0.0.1:6380`

Do not reuse `3001`, `5432`, or `6379` while this stack is active because those ports are already commonly occupied and trigger the `EADDRINUSE` startup failure.

## Postman

Import the complete collection and local environment from [`postman/`](postman/README.md).
The collection covers every controller route and includes a stateful end-to-end hotel stay.

## Commands

```bash
npm run build
npm run lint
npm run format:check
npm run prisma:validate
npm run test:e2e
npm audit --audit-level=high
docker compose up --build
```

Never commit `.env`. The checked-in `.env.example` contains placeholders only.
Production secrets must come from the deployment platform's secret store.

## First hotel and administrator

Set the six `BOOTSTRAP_*` variables documented at the bottom of `.env.example`,
then run `npm run bootstrap:admin`. The command is idempotent: rerunning it checks
the same hotel/admin and refreshes the system permission mappings without resetting
the administrator password.

## Realistic test data

After bootstrapping a new, otherwise empty hotel, load a large time-relative
dataset with:

```bash
npm run seed:realistic
```

This creates 96 rooms plus thousands of guests, reservations, folio charges,
invoices, payments, expenses, housekeeping tasks, maintenance records, employees,
and audit events. The command refuses to run when the hotel already contains
reservations; it never deletes or overwrites existing operational records.

## Implemented scope

- Authentication: login, refresh, logout, logout-all, current user
- Argon2id password hashing and temporary account lockout
- 15-minute access JWT and rotating seven-day refresh session
- Roles: `ADMIN`, `MANAGER`, combined `STAFF`, plus ADMIN-created custom roles
- ADMIN-only user and role management
- Audited user deactivation instead of destructive deletion
- PostgreSQL-enforced cross-hotel isolation and last-admin protection
- Tenant-scoped hotel and floor management
- Central room-type pricing such as Standard USD 100 and Luxury USD 200
- Room inventory, pagination, filters, safe deactivation, and controlled statuses
- STAFF room visibility without configuration or price-entry permission
- Guest records with strong and weak duplicate detection
- Central room availability by date, capacity, type, and floor
- Atomic single-room and multi-room reservations with PostgreSQL overlap protection
- Automatic reservation price snapshots and manager/admin-only discounts
- Atomic and idempotent check-in/check-out with actual stay timestamps
- Controlled service pricing, immutable extra charges, retained void history, and folios
- Checkout-generated room charges and automatic `OCCUPIED` to `DIRTY` handoff
- Idempotent deposits, partial/final payments, serialized refunds, and issued invoices
- Configurable payment methods and expense categories with retained reversal history
- Automatic checkout housekeeping tasks and atomic room cleaning transitions
- Conflict-safe room maintenance reporting and completion
- Hotel-timezone dashboard, management reports, and protected audit review
- Measured load harness with no premature Redis/cache/queue dependency
- Authenticated operational metrics, request IDs, body limits, and request timeouts
- Least-privilege production database roles and hardened production Compose overlay
- Tested backup/restore scripts and clean-database migration rehearsal

See [Phase 10 report](docs/phase-10-report.md), [Phase 9 report](docs/phase-9-report.md),
[deployment runbook](docs/deployment.md), [security review](docs/security-review.md),
[Phase 8 report](docs/phase-8-report.md), [Phase 7 report](docs/phase-7-report.md),
[Phase 6 report](docs/phase-6-report.md), [Phase 5 report](docs/phase-5-report.md),
[Phase 4 report](docs/phase-4-report.md), [Phase 3 report](docs/phase-3-report.md),
[Phase 2 report](docs/phase-2-report.md),
[security](docs/security.md), [architecture](docs/architecture.md),
[database design](docs/database.md), and [operations](docs/operations.md).
