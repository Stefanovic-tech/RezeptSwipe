# Smoke-Test fuer rezept.krinulovic.ch
param(
    [string]$Url = "https://rezept.krinulovic.ch/api/health",
    [int]$Attempts = 10,
    [int]$DelaySec = 3
)

$ErrorActionPreference = "Stop"

for ($i = 1; $i -le $Attempts; $i++) {
    try {
        $r = Invoke-WebRequest -Uri $Url -UseBasicParsing -TimeoutSec 10
        if ($r.StatusCode -eq 200) {
            Write-Host "[smoke] OK ($i/$Attempts): $Url"
            $body = $r.Content
            if ($body -notmatch '"status":"ok"') {
                Write-Warning "[smoke] Unerwartete Antwort: $body"
                exit 1
            }
            exit 0
        } else {
            Write-Warning "[smoke] Status $($r.StatusCode) ($i/$Attempts)"
        }
    } catch {
        Write-Warning "[smoke] Fehler ($i/$Attempts): $_"
    }
    Start-Sleep -Seconds $DelaySec
}

Write-Error "[smoke] App nach $Attempts Versuchen nicht erreichbar."
exit 1
