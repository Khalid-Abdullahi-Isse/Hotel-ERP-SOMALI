param()

$ErrorActionPreference = 'Stop'
$appPassword = $env:APP_POSTGRES_PASSWORD
$backupPassword = $env:BACKUP_POSTGRES_PASSWORD
$ownerRole = if ($env:POSTGRES_USER) { $env:POSTGRES_USER } else { 'hotel_erp' }
$database = if ($env:POSTGRES_DB) { $env:POSTGRES_DB } else { 'hotel_erp' }

if (-not $appPassword -or $appPassword.Length -lt 24) {
  throw 'APP_POSTGRES_PASSWORD must contain at least 24 characters.'
}
if (-not $backupPassword -or $backupPassword.Length -lt 24) {
  throw 'BACKUP_POSTGRES_PASSWORD must contain at least 24 characters.'
}
if ($ownerRole -notmatch '^[a-zA-Z_][a-zA-Z0-9_]*$' -or $database -notmatch '^[a-zA-Z_][a-zA-Z0-9_]*$') {
  throw 'POSTGRES_USER and POSTGRES_DB must be simple PostgreSQL identifiers.'
}

function ConvertTo-SqlLiteral([string]$value) {
  return "'" + $value.Replace("'", "''") + "'"
}

$appLiteral = ConvertTo-SqlLiteral $appPassword
$backupLiteral = ConvertTo-SqlLiteral $backupPassword
$sql = @"
SELECT 'CREATE ROLE hotel_erp_app LOGIN' WHERE NOT EXISTS
  (SELECT 1 FROM pg_roles WHERE rolname='hotel_erp_app') \gexec
SELECT 'CREATE ROLE hotel_erp_backup LOGIN' WHERE NOT EXISTS
  (SELECT 1 FROM pg_roles WHERE rolname='hotel_erp_backup') \gexec

ALTER ROLE hotel_erp_app PASSWORD $appLiteral NOSUPERUSER NOCREATEDB NOCREATEROLE NOREPLICATION;
ALTER ROLE hotel_erp_backup PASSWORD $backupLiteral NOSUPERUSER NOCREATEDB NOCREATEROLE NOREPLICATION;

REVOKE CREATE ON SCHEMA public FROM PUBLIC;
GRANT CONNECT ON DATABASE "$database" TO hotel_erp_app, hotel_erp_backup;
GRANT USAGE ON SCHEMA public TO hotel_erp_app, hotel_erp_backup;
GRANT SELECT, INSERT, UPDATE, DELETE ON ALL TABLES IN SCHEMA public TO hotel_erp_app;
GRANT USAGE, SELECT, UPDATE ON ALL SEQUENCES IN SCHEMA public TO hotel_erp_app;
GRANT EXECUTE ON ALL FUNCTIONS IN SCHEMA public TO hotel_erp_app;
GRANT SELECT ON ALL TABLES IN SCHEMA public TO hotel_erp_backup;
GRANT USAGE, SELECT ON ALL SEQUENCES IN SCHEMA public TO hotel_erp_backup;

ALTER DEFAULT PRIVILEGES FOR ROLE "$ownerRole" IN SCHEMA public
  GRANT SELECT, INSERT, UPDATE, DELETE ON TABLES TO hotel_erp_app;
ALTER DEFAULT PRIVILEGES FOR ROLE "$ownerRole" IN SCHEMA public
  GRANT USAGE, SELECT, UPDATE ON SEQUENCES TO hotel_erp_app;
ALTER DEFAULT PRIVILEGES FOR ROLE "$ownerRole" IN SCHEMA public
  GRANT EXECUTE ON FUNCTIONS TO hotel_erp_app;
ALTER DEFAULT PRIVILEGES FOR ROLE "$ownerRole" IN SCHEMA public
  GRANT SELECT ON TABLES TO hotel_erp_backup;
"@

$sql | docker compose exec -T postgres psql `
  --username $ownerRole --dbname $database --set ON_ERROR_STOP=1
if ($LASTEXITCODE -ne 0) { throw 'Production database role configuration failed.' }
Write-Output 'Production database roles configured.'
