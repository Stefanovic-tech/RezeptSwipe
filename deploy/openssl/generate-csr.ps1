# Erzeugt Privatekey + CSR fuer rezept.krinulovic.ch via OpenSSL.
# Voraussetzung: OpenSSL ist im PATH oder uebergebt -OpenSslPath
param(
    [string]$OutDir = "C:\nginx\ssl\rezept.krinulovic.ch",
    [string]$OpenSslPath = "openssl"
)

$ErrorActionPreference = "Stop"

if (-not (Test-Path $OutDir)) {
    New-Item -ItemType Directory -Path $OutDir -Force | Out-Null
}

$cnf = Join-Path $PSScriptRoot "openssl-rezept.cnf"
$key = Join-Path $OutDir "privkey.pem"
$csr = Join-Path $OutDir "request.csr"

Write-Host "Erzeuge Private Key: $key"
& $OpenSslPath genrsa -out $key 4096
if ($LASTEXITCODE -ne 0) { throw "openssl genrsa failed" }

Write-Host "Erzeuge CSR: $csr"
& $OpenSslPath req -new -key $key -out $csr -config $cnf
if ($LASTEXITCODE -ne 0) { throw "openssl req failed" }

Write-Host "Fertig. CSR an die CA uebermitteln und das ausgegebene Zertifikat als '$OutDir\fullchain.pem' speichern."
Write-Host "Erwartete Datei (nach Erhalt des Zertifikats):"
Write-Host "  $OutDir\fullchain.pem (vollstaendige Chain inkl. Zwischenzertifikate)"
Write-Host "  $OutDir\privkey.pem"
