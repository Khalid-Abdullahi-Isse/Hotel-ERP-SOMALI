# Phase 2 completion report

## Simple summary

The backend can now securely identify users and decide what they are allowed to
do. One employee can use the combined `STAFF` role for reception, cashier, and
housekeeping work. Only an `ADMIN` can manage users and roles.

## What was delivered

### Authentication

- Email-or-username login
- Argon2id password hashing
- 15-minute access token
- Seven-day refresh session
- Automatic refresh-token rotation
- Reused-token detection and session revocation
- Logout-current and logout-all
- Five-attempt, 15-minute account lockout
- Generic login failures that do not reveal whether an account exists

### Roles and permissions

- `ADMIN`: all permissions and all user/role administration
- `MANAGER`: operational and management access without user/role administration
- `STAFF`: combined receptionist, cashier, check-in/out, housekeeping, and basic
  maintenance permissions
- ADMIN-created custom roles
- PostgreSQL rejection of cross-hotel role assignments
- Permanent protection for the three built-in roles

### User administration

- ADMIN-only create, list, view, update, role assignment, unlock, password reset,
  deactivate, and restore
- Deactivation immediately revokes every user session
- No physical deletion of users, preserving reservation/payment/audit history
- Protection against removing the last active ADMIN

### Security and auditing

- HttpOnly refresh cookies with Origin checks
- Strict JWT issuer, audience, algorithm, and expiry validation
- Rate limits on login and refresh
- Password/token redaction in structured logs
- Audits for login, failed login, lockout, logout, user changes, password reset,
  role changes, and permission changes
- Safe translation of common Prisma/database errors

## Verification evidence

- TypeScript build: passed
- ESLint: passed
- Formatting: passed
- Prisma schema validation: passed
- Three migrations applied successfully
- Unit tests: 4 passed
- PostgreSQL/HTTP integration tests: 15 passed
- Total automated tests: 19 passed
- Dependency audit: 0 known vulnerabilities
- Bootstrap executed twice: first run created one admin; second run created none
- Production Docker image: built successfully with OpenSSL and Argon2
- Container security: runs as non-root user `hotel-api` (UID 1001)
- Container smoke test: liveness `ok`, readiness `ok`, database `up`, Swagger HTTP 200

Important tested cases include concurrent duplicate user creation, refresh-token
replay, seven-day expiry, STAFF/MANAGER denial of ADMIN routes, account lockout,
cross-hotel attacks, immediate deactivation, audit secret exclusion, system-role
protection, and last-admin protection.

## How to start

1. Copy `.env.example` to `.env` and replace every placeholder secret.
2. Start PostgreSQL: `docker compose up -d postgres`.
3. Apply migrations: `npm run db:deploy`.
4. Set the six `BOOTSTRAP_*` variables described in `.env.example`.
5. Create the first hotel/admin: `npm run bootstrap:admin`.
6. Start the API: `npm run start:dev`.
7. Open Swagger at `http://localhost:3005/docs`.

The development database was left empty after testing, ready for the real hotel
bootstrap. No test credentials remain.
