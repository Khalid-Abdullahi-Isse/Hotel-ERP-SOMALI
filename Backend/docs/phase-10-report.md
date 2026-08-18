# Phase 10 completion report: production hardening

## Simple summary

The V1 backend now has tested production configuration, monitoring, recovery scripts,
least-privilege database roles, clean dependency scanning, container health checks,
and complete integration coverage. Application work for all ten planned phases is
complete.

Choosing a hosting provider, DNS name, TLS certificate, off-host backup destination,
and alert receiver remains a deployment-owner decision because those are external
accounts, not source-code features.

## Production controls delivered

- Request IDs are generated before body parsing, returned in `X-Request-Id`, included
  in error envelopes, and written to structured logs.
- Request bodies default to 1 MiB and oversized JSON receives a safe `413` response.
- Requests have a configurable 30-second processing timeout.
- Helmet headers, explicit CORS origins, rate limiting, strict DTO validation, and
  generic internal errors remain enabled.
- Production refuses to start unless secure refresh cookies are enabled, Swagger is
  disabled, and the monitoring token has at least 32 characters.
- `GET /api/v1/health/metrics` exposes bounded process/route metrics only with
  `X-Monitoring-Token`.
- The API image runs as UID 1001, uses a read-only root filesystem, has a temporary
  `/tmp`, log rotation, a 512 MiB memory limit, one CPU limit, and a Docker readiness
  health check.
- The production API must use `APP_DATABASE_URL` for the restricted `hotel_erp_app`
  role. The schema owner is reserved for migrations and `hotel_erp_backup` is read-only.
- `deepmerge-ts` is pinned to patched version 8.0.1; both development and pruned
  production dependency scans report zero vulnerabilities.

## Recovery verification

- A custom-format PostgreSQL backup restored into a clean database.
- Restored counts matched: 1 temporary hotel, 100 rooms, and 11 completed migrations.
- The packaged backup/restore scripts repeated the drill successfully with a 147,848
  byte test dump.
- A separate empty database applied all 11 migrations from zero and reported the
  schema up to date.
- Temporary databases, backup, credentials, hotel, and rooms were removed afterward.

## Production-profile verification

- Container health: healthy
- Runtime user: `hotel-api` / UID 1001
- Read-only root filesystem: enabled
- Swagger response: 404
- Trusted CORS origin: allowed; untrusted origin: no CORS grant
- Metrics without/with token: 401 / 200
- Oversized JSON: 413 with matching request ID
- Application schema-create permission: false
- Application table DML permission: true
- Backup table select/insert permission: true / false

## Test result

The final suite contains 38 passing end-to-end tests and 7 passing unit tests. Lint,
formatting, TypeScript build, Prisma validation, migration status, load profiling,
Docker build, health checks, backup restore, and dependency audit pass.

See the deployment runbook and security review before placing real guest data in the
system.
