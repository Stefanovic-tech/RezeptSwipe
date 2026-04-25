# Initial-Setup fuer RezeptSwipe als Windows-Dienst via PM2 + pm2-windows-service.
# Einmalig auf dem Server als Administrator ausfuehren.

param(
    [string]$AppRoot = "C:\apps\rezeptswipe"
)

$ErrorActionPreference = "Stop"

if (-not (Test-Path $AppRoot)) {
    throw "AppRoot $AppRoot existiert nicht. Erst Repo nach $AppRoot klonen und .env hinterlegen."
}
Set-Location $AppRoot

Write-Host "[setup] PM2 global installieren"
npm install -g pm2 pm2-windows-service pm2-logrotate
if ($LASTEXITCODE -ne 0) { throw "pm2 install failed" }

Write-Host "[setup] PM2 als Windows-Dienst registrieren"
pm2-service-install -n PM2
if ($LASTEXITCODE -ne 0) {
    Write-Host "[setup] Service evtl. bereits installiert. Weiter."
}

Write-Host "[setup] App initial starten"
pm2 start ecosystem.config.cjs --only rezeptswipe
if ($LASTEXITCODE -ne 0) { throw "pm2 start failed" }

Write-Host "[setup] PM2 Logrotate konfigurieren"
pm2 set pm2-logrotate:max_size 50M
pm2 set pm2-logrotate:retain 14
pm2 set pm2-logrotate:compress true
pm2 set pm2-logrotate:rotateInterval "0 3 * * *"

Write-Host "[setup] PM2 process list speichern (fuer Autostart)"
pm2 save

Write-Host "[setup] FERTIG. Healthcheck pruefen:"
Write-Host "  Invoke-WebRequest http://127.0.0.1:3015/api/health -UseBasicParsing"
Write-Host "  Invoke-WebRequest https://rezept.krinulovic.ch/api/health -UseBasicParsing"
