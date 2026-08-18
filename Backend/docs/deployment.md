# Production deployment runbook

## 1. Host and network

Use a supported Linux host with persistent storage, automatic security updates, and
restricted administrator access. Put a trusted HTTPS reverse proxy in front of the
localhost-bound API port. PostgreSQL must not be internet-accessible. Configure DNS,
TLS renewal, firewall rules, and the external monitoring receiver before launch.

## 2. Secrets and environment

Create `.env` from `.env.example`; never commit it. Generate independent random
values for:

- `POSTGRES_PASSWORD` for the migration/schema owner;
- `APP_POSTGRES_PASSWORD` for the runtime API;
- `BACKUP_POSTGRES_PASSWORD` for the read-only backup role;
- `JWT_ACCESS_SECRET` with at least 64 random bytes;
- `MONITORING_TOKEN` with at least 32 random characters.

URL-encode the application password inside `APP_DATABASE_URL`. Set
`AUTH_COOKIE_SECURE=true`, `SWAGGER_ENABLED=false`, the exact HTTPS frontend origin,
and the proxy-hop count. Store the file with owner-only permissions or use the hosting
platform's secret store.

## 3. First deployment

```bash
docker compose up -d postgres
npm ci
npm run db:deploy
npm run db:roles:production
docker compose -f docker-compose.yml -f docker-compose.production.yml up -d --build api
```

`db:roles:production` reads `APP_POSTGRES_PASSWORD` and `BACKUP_POSTGRES_PASSWORD`
from the process environment without placing them in SQL command arguments. Use the
schema-owner URL only for reviewed migrations and bootstrap, never for the API.

Set the `BOOTSTRAP_*` variables, run `npm run bootstrap:admin` once, and remove those
password variables from the environment afterward.

## 4. Release procedure

1. Create and verify a backup before database changes.
2. Run `npm ci`, audit, lint, tests, build, and Prisma validation in CI.
3. Review migration SQL, then run `npm run db:deploy` with the migration role.
4. Build an immutable image and record its digest/version.
5. Recreate the API with the production Compose overlay.
6. Verify live, ready, authenticated login, one hotel read, and metrics.
7. Watch 5xx rate, p95 latency, memory, database connections, and logs during rollout.

Application rollback uses the previously recorded image. Database migrations use a
reviewed forward-fix by default; Prisma does not provide an automatic safe down
migration. Restore a backup only for a declared incident after preserving evidence.

## 5. Monitoring and alerts

- Poll `/api/v1/health/live` and `/api/v1/health/ready` every 30 seconds.
- Poll `/api/v1/health/metrics` with `X-Monitoring-Token`; never put the token in a URL.
- Alert after three consecutive readiness failures, sustained 5xx errors above 1%,
  p95 normal-read latency above 300 ms, dashboard p95 above 700 ms, memory above 85%,
  database connection saturation, or a backup older than 26 hours.
- Forward rotated JSON container logs to the selected durable log service. Redaction
  already covers authorization, cookies, passwords, and tokens.

In-process metrics reset on restart and are intentionally low-cost. The external
monitor/log system is responsible for durable history and notification delivery.

## 6. Backups and recovery

On Windows/local rehearsal:

```powershell
npm run backup -- -DestinationDirectory D:\hotel-backups
npm run restore:drill -- -BackupFile D:\hotel-backups\hotel-erp-YYYYMMDD-HHMMSS.dump
```

Schedule nightly encrypted custom-format dumps, copy them off the database host, and
retain 7 daily, 4 weekly, and 12 monthly backups initially. Run a clean restore drill
monthly. A backup is successful only after restore and smoke verification.

The initial suggested RPO is 24 hours and the target RTO is 4 hours. Hotel ownership
must approve these values; use managed continuous backup/WAL archiving if a smaller
data-loss window is required.

## 7. Secret rotation

Rotate one credential at a time. For the application role, update the PostgreSQL role
password, update `APP_DATABASE_URL` in the secret store, recreate the API, and verify
readiness. Rotate JWT secrets during a planned maintenance window because existing
access tokens become invalid; database-backed refresh sessions can issue new access
tokens after users sign in again. Record the rotation without recording secret values.
