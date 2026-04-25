# TLS-Erneuerung fuer rezept.krinulovic.ch

Verbindlicher Ablauf bei Ablauf bzw. mind. 30 Tage davor.

## Vorbereitung
- Aktuelle Restlaufzeit pruefen:
  - `openssl x509 -in C:\nginx\ssl\rezept.krinulovic.ch\fullchain.pem -noout -enddate`

## 1. Neuen Privatekey + CSR erzeugen
```
powershell.exe -File deploy\openssl\generate-csr.ps1
```
Erzeugt `privkey.pem` und `request.csr` unter `C:\nginx\ssl\rezept.krinulovic.ch\`.

## 2. CSR signieren lassen
- CSR (`request.csr`) an die zustaendige CA uebermitteln.
- Erhaltenes Zertifikat **inklusive Zwischenzertifikat** als `fullchain.pem` ablegen.
- Pfad: `C:\nginx\ssl\rezept.krinulovic.ch\fullchain.pem`

## 3. Validieren
- Verifikation: `openssl x509 -in fullchain.pem -noout -dates -subject -issuer`
- Key-Match:
  ```
  openssl rsa -in privkey.pem -modulus -noout | openssl md5
  openssl x509 -in fullchain.pem -modulus -noout | openssl md5
  ```
  Beide MD5-Werte muessen gleich sein.

## 4. Reload Nginx
- Konfigurationstest: `C:\nginx\nginx.exe -t -c conf\nginx.conf`
- Reload: `C:\nginx\nginx.exe -s reload`

## 5. Smoke-Test
- `Invoke-WebRequest https://rezept.krinulovic.ch/api/health -UseBasicParsing` -> 200
- Browsertest auf Smartphone und Desktop.

## Rollback
- Vorheriges Zertifikatspaar als `fullchain.pem.bak` und `privkey.pem.bak` aufbewahren.
- Bei Fehler: zurueckspielen und Nginx erneut reloaden.
