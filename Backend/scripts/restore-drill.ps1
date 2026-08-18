param(
  [Parameter(Mandatory = $true)]
  [string]$BackupFile,
  [string]$DatabaseName = 'hotel_erp_restore_drill'
)

$ErrorActionPreference = 'Stop'
if ($DatabaseName -notmatch '^hotel_erp_restore_[a-z0-9_]+$') {
  throw 'DatabaseName must start with hotel_erp_restore_ and contain only lowercase letters, numbers, or underscores.'
}
$backup = (Resolve-Path -LiteralPath $BackupFile).Path
$containerFile = "/tmp/$([System.IO.Path]::GetFileName($backup))"
$postgresContainer = (docker compose ps -q postgres).Trim()
if (-not $postgresContainer) { throw 'The PostgreSQL container is not running.' }

try {
  docker cp $backup "${postgresContainer}:$containerFile"
  if ($LASTEXITCODE -ne 0) { throw 'Copying the backup into the container failed.' }
  docker compose exec -T postgres dropdb --username hotel_erp --if-exists $DatabaseName
  docker compose exec -T postgres createdb --username hotel_erp $DatabaseName
  docker compose exec -T postgres pg_restore `
    --username hotel_erp --dbname $DatabaseName `
    --no-owner --no-acl $containerFile
  if ($LASTEXITCODE -ne 0) { throw 'pg_restore failed.' }
  docker compose exec -T postgres psql --username hotel_erp --dbname $DatabaseName `
    --command 'SELECT count(*) AS completed_migrations FROM "_prisma_migrations" WHERE finished_at IS NOT NULL;'
  if ($LASTEXITCODE -ne 0) { throw 'Restore smoke query failed.' }
}
finally {
  docker compose exec -T postgres dropdb --username hotel_erp --if-exists $DatabaseName 2>$null
  docker compose exec -T postgres rm -f $containerFile 2>$null
}
