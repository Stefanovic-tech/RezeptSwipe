# Deploy-Skript fuer RezeptSwipe (Windows Server, PM2 + Nginx)
# Voraussetzungen:
# - Node.js LTS, npm, pm2, MySQL erreichbar
# - .env (Production) liegt im Repo-Root
# - Initialer Setup: ./deploy/setup-windows-service.ps1 wurde einmal ausgefuehrt

param(
    [string]$AppRoot = "$PSScriptRoot\..",
    [switch]$SkipMigrations,
    [switch]$SkipSeed
)

$ErrorActionPreference = "Stop"
Set-Location $AppRoot

Write-Host "[deploy] cwd: $(Get-Location)"

Write-Host "[deploy] git pull"
& git pull --ff-only
if ($LASTEXITCODE -ne 0) { throw "git pull failed" }

# Windows: laufende Next/Node-Prozesse halten native Module (z. B. argon2*.node)
# offen -> npm ci schlaegt mit EPERM unlink fehl. App kurz stoppen.
Write-Host "[deploy] pm2 stop (Windows: node_modules fuer npm ci freigeben)"
& pm2 stop rezeptswipe 2>&1 | Out-Null
if ($LASTEXITCODE -ne 0) {
    Write-Host "[deploy] pm2 stop meldet Exit $($LASTEXITCODE) (App lief evtl. nicht) — fortfahren."
}

Write-Host "[deploy] npm ci"
& npm ci --no-audit --no-fund
if ($LASTEXITCODE -ne 0) { throw "npm ci failed" }

if (-not $SkipMigrations) {
    Write-Host "[deploy] DB migrations"
    & npm run migrate
    if ($LASTEXITCODE -ne 0) { throw "migrations failed" }
}

if (-not $SkipSeed) {
    Write-Host "[deploy] DB seed"
    & npm run seed
    if ($LASTEXITCODE -ne 0) { throw "seed failed" }
}

Write-Host "[deploy] next build"
& npm run build
if ($LASTEXITCODE -ne 0) { throw "build failed" }

Write-Host "[deploy] pm2 reload (Zero-Downtime)"
& pm2 reload ecosystem.config.cjs --only rezeptswipe --update-env
if ($LASTEXITCODE -ne 0) {
    Write-Host "[deploy] pm2 reload failed; versuche start"
    & pm2 start ecosystem.config.cjs --only rezeptswipe
    if ($LASTEXITCODE -ne 0) { throw "pm2 start failed" }
}

Write-Host "[deploy] pm2 save"
& pm2 save
if ($LASTEXITCODE -ne 0) { throw "pm2 save failed" }

Write-Host "[deploy] Smoke-Test"
& powershell.exe -File "$PSScriptRoot\smoke-test.ps1" -Url "https://rezept.krinulovic.ch/api/health"
if ($LASTEXITCODE -ne 0) {
    Write-Host "[deploy] Smoke-Test FEHLGESCHLAGEN. Bitte pm2 logs pruefen."
    throw "smoke test failed"
}

Write-Host "[deploy] OK"
