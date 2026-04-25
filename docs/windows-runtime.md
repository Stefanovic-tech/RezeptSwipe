# Windows Server Runtime fuer RezeptSwipe

Dokumentiert den Produktivbetrieb auf einem Windows Server mit Nginx, PM2 und MySQL.

## Pfad-Konvention

| Zweck                  | Pfad                                                |
|------------------------|-----------------------------------------------------|
| App-Root               | `C:\apps\rezeptswipe`                               |
| App Logs               | `C:\apps\rezeptswipe\logs\`                         |
| PM2 Logrotate Logs     | `C:\Users\<dienstkonto>\.pm2\logs\`                 |
| Nginx Root             | `C:\nginx\`                                         |
| Nginx Site Configs     | `C:\nginx\conf\sites-enabled\`                      |
| Nginx Logs             | `C:\nginx\logs\`                                    |
| TLS Zertifikate        | `C:\nginx\ssl\rezept.krinulovic.ch\`                |
| MySQL Data             | systemstandard (`C:\ProgramData\MySQL\...`)         |
| Backups (Server)       | extern, ueber Server-Backup (siehe Plan)            |

## Initial-Setup (einmalig)

1. Repository nach `C:\apps\rezeptswipe` klonen.
2. `.env` mit Production-Werten anlegen (siehe `.env.production.example`).
   - **Wichtig:** `AUTH_SECRET` als Random-String mit >= 32 Zeichen.
   - `COOKIE_SECURE=1` zwingend.
3. MySQL-User + Datenbank vorbereiten (eingeschraenkter App-User):
   ```sql
   CREATE DATABASE rezeptswipe CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;
   CREATE USER 'rezeptswipe'@'127.0.0.1' IDENTIFIED BY '...';
   GRANT SELECT, INSERT, UPDATE, DELETE, CREATE, ALTER, DROP, INDEX, REFERENCES,
         CREATE TEMPORARY TABLES, LOCK TABLES, EXECUTE
     ON rezeptswipe.* TO 'rezeptswipe'@'127.0.0.1';
   FLUSH PRIVILEGES;
   ```
4. `npm ci` und `npm run build` fuehren initial gegen `.env` aus.
5. Migrationen ausfuehren: `npm run migrate`.
6. Seed: `npm run seed`.
7. Initialen Admin anlegen: `BOOTSTRAP_ADMIN_PASSWORD=...` setzen, `npm run bootstrap`.
8. PM2 + Service einmalig: `powershell deploy\setup-windows-service.ps1` (als Administrator).
9. Nginx-Site verlinken (siehe unten) und reloaden.

## PM2 Betrieb

- Status: `pm2 status`
- Logs: `pm2 logs rezeptswipe`
- Restart: `pm2 restart rezeptswipe`
- Reload (zero-downtime): `pm2 reload rezeptswipe`
- Stop: `pm2 stop rezeptswipe`
- Speichern: `pm2 save` (nach jeder Strukturaenderung wichtig fuer Auto-Restart).
- Autostart erfolgt ueber den durch `pm2-service-install` registrierten Windows-Dienst `PM2`.

### Logrotation

`pm2-logrotate` rotiert taeglich um 03:00 Uhr, 50MB max. Datei, 14 Aufbewahrung, gzipped.
Werte siehe `deploy\setup-windows-service.ps1`. Nginx-Logs werden zusaetzlich vom OS rotiert
(IIS-Logrotate bzw. `logrotateWin`).

### Restart-Strategie

- `autorestart: true` und `max_memory_restart: 512M` in `ecosystem.config.cjs`.
- PM2 Service startet die App nach Server-Reboot automatisch.
- Bei Crash schreibt PM2 in `pm2-error.log`; Sentry alarmiert ausserdem.

## Nginx

- Sites Enable: Datei aus `deploy\nginx\rezept.krinulovic.ch.conf` nach
  `C:\nginx\conf\sites-enabled\` kopieren.
- In `nginx.conf` muss am Ende des `http { ... }` Blocks die Zeile stehen:
  ```
  include sites-enabled/*.conf;
  ```
- Konfigurationstest: `C:\nginx\nginx.exe -t`
- Reload: `C:\nginx\nginx.exe -s reload`
- Stoppen/Starten: `nssm` Service oder `nginx.exe -s stop` / `nginx.exe`.

## Updates / Deployment

Standardablauf (per RDP, Powershell als App-Service-User):

```powershell
cd C:\apps\rezeptswipe
.\deploy\deploy.ps1
```

Das Skript fuehrt `git pull`, `npm ci`, Migrationen, Build und `pm2 reload` aus und ruft
am Ende den Smoke-Test auf.

## Healthcheck

- Lokal:  `Invoke-WebRequest http://127.0.0.1:3015/api/health -UseBasicParsing`
- Public: `Invoke-WebRequest https://rezept.krinulovic.ch/api/health -UseBasicParsing`

Erwartete Antwort: `{"status":"ok","db":true}`.

## Restore aus Server-Backup

- Backups werden serverweit gezogen (DB, App-Code, Nginx, TLS, PM2-Konfig).
- Vorgehensweise:
  1. Server aus letztem konsistentem Backup wiederherstellen.
  2. MySQL-Datenverzeichnis und Konfig pruefen.
  3. App: `C:\apps\rezeptswipe` pruefen (`pm2 status`, ggf. `pm2 resurrect`).
  4. Nginx-Service starten, `nginx -t` testen, reloaden.
  5. Smoke-Test ausfuehren.
- App-spezifische, separate DB-Backups sind bewusst nicht Teil dieses Setups (siehe Plan).
