# Operations

## Backup policy

- Automated nightly custom-format `pg_dump` backups
- Encrypt backups at rest and in transit
- Keep 7 daily, 4 weekly, and 12 monthly copies initially
- Store copies outside the database host and restrict access
- Monitor backup age, size, and command exit status
- Perform and document a restore drill at least monthly

A successful backup command is not proof of recoverability. Only a verified
restore into a clean database counts.

## Backup

The tested Windows helper copies the dump out of the container and prints its path:

```powershell
npm run backup -- -DestinationDirectory D:\hotel-backups
```

The equivalent direct command is:

```bash
docker compose exec -T postgres pg_dump \
  --username hotel_erp --dbname hotel_erp \
  --format=custom --no-owner --no-acl > hotel_erp.dump
```

## Restore drill

Create a separate empty database; never test restores over production.

The tested helper only accepts temporary database names beginning with
`hotel_erp_restore_`:

```powershell
npm run restore:drill -- -BackupFile D:\hotel-backups\hotel-erp-YYYYMMDD-HHMMSS.dump
```

```bash
docker compose exec -T postgres createdb --username hotel_erp hotel_erp_restore_test
docker compose exec -T postgres pg_restore \
  --username hotel_erp --dbname hotel_erp_restore_test \
  --clean --if-exists --no-owner --no-acl < hotel_erp.dump
docker compose exec -T postgres psql --username hotel_erp \
  --dbname hotel_erp_restore_test -c "select count(*) from \"Hotel\";"
docker compose exec -T postgres dropdb --username hotel_erp hotel_erp_restore_test
```

After restoring, run smoke queries, migration status, row-count comparisons, and
the application's readiness probe. Record duration to establish RTO. Decide the
acceptable data-loss window (RPO) before production; add WAL archiving only if the
business requires point-in-time recovery.

## Production database credentials

Use separate roles:

- migration role: owns schema and runs reviewed migrations
- application role: CRUD only on required tables/sequences, cannot alter schema,
  triggers, or audit logs
- backup role: read-only permissions required by `pg_dump`

Run `npm run db:roles:production` with separate `APP_POSTGRES_PASSWORD` and
`BACKUP_POSTGRES_PASSWORD` environment variables. Production Compose requires
`APP_DATABASE_URL` and will not fall back to the schema owner.

Rotate credentials, require TLS, restrict network access to application hosts,
and never use the PostgreSQL superuser from the API.
