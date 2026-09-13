param([string]$BackupDirectory = ".\backups")

$ErrorActionPreference = "Stop"
$env:BACKUP_DIR = $BackupDirectory
& node (Join-Path $PSScriptRoot "backup.mjs")
if ($LASTEXITCODE -ne 0) { exit $LASTEXITCODE }
