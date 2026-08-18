# Architecture

## Decision

Use one modular NestJS application and one PostgreSQL database. Prisma provides
typed queries and migrations. PostgreSQL remains the source of truth and enforces
critical constraints even when writes race or bypass NestJS.

## Why

This is inexpensive to host, straightforward to back up, and easy for a small
team to understand. Domain modules will remain separated inside the monolith, so
they can evolve independently without operational microservice overhead.

## Module boundaries

The current application contains cross-cutting infrastructure, Phase 2 security,
and Phase 3 room inventory:

- `config`: fail-fast environment parsing
- `prisma`: one shared database client and lifecycle
- `common`: consistent errors and cross-cutting utilities
- `health`: liveness and database readiness
- `auth`: passwords, JWT access tokens, seven-day refresh sessions and guards
- `users`: ADMIN-only hotel user lifecycle
- `roles`: ADMIN-only roles and permission mappings
- `audit-logs`: transaction-aware append-only security audit records
- `hotels`: current-hotel settings, always derived from the authenticated tenant
- `floors`: hotel floor structure and safe empty-floor deletion
- `room-types`: capacity and the central default nightly price catalog
- `rooms`: tenant-scoped inventory, filters, inherited prices, and controlled status changes
- `guests`: tenant-scoped guest identity, search, and duplicate detection
- `availability`: the single definition of date, capacity, maintenance, and overlap eligibility
- `reservations`: serializable booking transactions, price snapshots, status history, and discounts

The application now includes all V1 business modules: stays, services, charges,
payments, invoices, expenses, housekeeping, maintenance, dashboard, reports, and
protected audit review. Modules may call another module's exported service, never
reach into its private repository. Multi-step workflows use a Prisma transaction and
write their audit record in the same transaction.

## Advantages

- Low infrastructure and maintenance cost
- One ACID transaction boundary for hotel workflows
- Centralized validation, logging, errors, and API documentation
- Database protections survive application bugs and concurrent requests

## Trade-offs

- PostgreSQL exclusion constraints and triggers are custom migration SQL and are
  not expressible in Prisma Schema Language.
- One process scales as a unit. This is appropriate for V1 and can be measured
  before introducing caches or queues.
- The initial schema is broad, but endpoint implementation remains phased.

## Security baseline

- Helmet secure headers and an explicit CORS allow-list
- Strict DTO validation: unknown properties are rejected
- Global rate limiting (100 requests/minute; auth routes will receive tighter
  limits in Phase 2)
- JSON logs with authorization, cookies, passwords, and tokens redacted
- Generic 500 responses so PostgreSQL errors and stack traces are not exposed
- Non-root application container and localhost-only development port bindings
- No credentials in source-controlled files

Authentication uses short-lived access JWTs plus rotating, hashed refresh tokens.
Every protected request checks the user and session in PostgreSQL, providing
immediate deactivation and logout without Redis.
