param(
  [Parameter(Mandatory = $true)]
  [string]$DestinationDirectory
)

$ErrorActionPreference = 'Stop'
$destination = [System.IO.Path]::GetFullPath($DestinationDirectory)
New-Item -ItemType Directory -Path $destination -Force | Out-Null
$stamp = Get-Date -Format 'yyyyMMdd-HHmmss'
$fileName = "hotel-erp-$stamp.dump"
$containerFile = "/tmp/$fileName"
$destinationFile = Join-Path $destination $fileName
$postgresContainer = (docker compose ps -q postgres).Trim()
if (-not $postgresContainer) { throw 'The PostgreSQL container is not running.' }

try {
  docker compose exec -T postgres pg_dump `
    --username hotel_erp --dbname hotel_erp `
    --format custom --no-owner --no-acl --file $containerFile
  if ($LASTEXITCODE -ne 0) { throw 'pg_dump failed.' }
  docker cp "${postgresContainer}:$containerFile" $destinationFile
  if ($LASTEXITCODE -ne 0) { throw 'Copying the backup from the container failed.' }
  if ((Get-Item -LiteralPath $destinationFile).Length -eq 0) { throw 'The backup is empty.' }
  Write-Output $destinationFile
}
finally {
  docker compose exec -T postgres rm -f $containerFile 2>$null
}
