# Security- und Betriebs-Checkliste

Verbindliche Mindeststandards fuer RezeptSwipe gem. Plan.

## Auth und Sessions

- [x] Argon2id fuer Passwort-Hashes (`@/lib/hash.ts`).
- [x] Recovery-Codes statt E-Mail-Reset; nur Hash gespeichert; einmalig nutzbar.
- [x] Access Token JWT (HS256) mit `15 Minuten` Lebensdauer (`ACCESS_TOKEN_TTL_MIN`).
- [x] Refresh Token in DB gehasht (sha256), `14 Tage` (`REFRESH_TOKEN_TTL_DAYS`), Rotation bei Refresh.
- [x] Reuse-Detection: bei vorgewiesenem widerrufenem Refresh werden alle Sessions des Users invalidiert.
- [x] HttpOnly + SameSite=Lax + Secure (Prod via `COOKIE_SECURE=1`).
- [x] Passwortwechsel widerruft alle Sessions, Admin-Reset ebenso.
- [x] Sessions pro Geraet sichtbar und einzeln widerrufbar (`/profil`).

## Rate-Limits

- [x] Login: 5 Versuche / 15 Minuten je IP+Username (`rateLimitLogin`).
- [x] Invite: 10 Versuche / 15 Minuten je IP (`rateLimitInvite`), greift bei Registrierung **und** Code-Einloesung.
- [x] Bucket-Persistenz in `rate_limit_buckets` (DB) -> ueberlebt Restarts und mehrere Instanzen.

## Eingaben & Validierung

- [x] Alle API-Routes nutzen `zod`-Schemata.
- [x] Whitelist fuer Username (`a-zA-Z0-9._-`, 3-32 Zeichen).
- [x] Mindestpasswortlaenge 8 Zeichen, max. 200.
- [x] Invites werden serverseitig in einer Transaktion mit `FOR UPDATE` eingeloest.

## Daten- und Zugriffsschutz

- [x] DB-User in Prod: minimal noetige Rechte (siehe `docs/windows-runtime.md`).
- [x] Foreign Keys + Cascade definiert; `users.current_household_id` => Set Null.
- [x] Admin-Aktionen werden in `admin_audit_log` mit Akteur, Ziel und Meta protokolliert.
- [x] Hard-Delete eines Users entfernt verwaiste Haushalte.

## Transport & Header

- [x] Nginx erzwingt HTTPS, HSTS, X-Content-Type-Options, X-Frame-Options, Referrer-Policy.
- [x] Cookies in Prod als `Secure` (durch `COOKIE_SECURE=1`).

## Secret-Handling

- [x] Secrets ausschliesslich in `.env` (Server) bzw. `.env.production` (Vorlage in Repo).
- [x] `AUTH_SECRET` zwingend min. 32 Zufallszeichen, je Server eindeutig.
- [x] `GEMINI_API_KEY`, `SENTRY_DSN` ebenfalls nur in `.env`.
- [x] Rotation: bei Verdacht
  1. Neuen `AUTH_SECRET` erzeugen und in `.env` setzen.
  2. `pm2 reload rezeptswipe --update-env`.
  3. Folge: alle Access Tokens werden serverseitig sofort ungueltig (Signaturpruefung schlaegt fehl), Refresh Tokens werden bei naechstem Refresh ungueltig (Signatur unabhaengig, aber DB-Lookup laeuft mit, daher Logout sicherstellen via `UPDATE refresh_sessions SET revoked_at = NOW()`).

## Logs & Monitoring

- [x] PM2-Logs (`logs/pm2-out.log`, `logs/pm2-error.log`), 14 Tage Retention durch `pm2-logrotate`.
- [x] Nginx-Logs unter `C:\nginx\logs\` (Access + Error).
- [x] Application-Errors gehen ueber `console.error` in PM2-Logs **und** koennen optional an Sentry gemeldet werden (`SENTRY_DSN`).
- [x] Healthcheck-Endpoint `/api/health` mit DB-Check fuer externes Uptime-Monitoring.

## Backups und Restore

- [x] Backup-Strategie: vollstaendiges Server-Backup deckt MySQL, App, Nginx, TLS, PM2 ab.
- [x] App-spezifische DB-Backups sind explizit kein Bestandteil; bei Restore Server-Backup einspielen.
- [x] Restore-Test vor Live-Gang einmal dokumentiert durchfuehren (siehe `docs/windows-runtime.md`).

## Smoke-Tests

- [x] `deploy\smoke-test.ps1` laeuft am Ende jedes Deploys.
- Manuell:
  - [ ] Login mit Bootstrap-Admin
  - [ ] Erstellung Invite-Code
  - [ ] Registrierung neuer Account ueber Invite
  - [ ] Swipe Like/Pass mit Filtern
  - [ ] Kochen-Session: Kandidat akzeptieren -> Einkaufsliste enthaelt Zutaten
  - [ ] Einkaufsliste: Item haken, polling >= 5s sichtbar in zweitem Browser
  - [ ] Logout setzt Cookies zurueck und Refresh wird widerrufen
  - [ ] Admin: Banflag funktioniert, gebannter User kann sich nicht einloggen
  - [ ] Recovery-Code Reset funktioniert
  - [ ] HTTPS Cert nicht abgelaufen (Browser zeigt gueltiges Zertifikat)

## Datenschutz

- [x] Keine E-Mails erforderlich, keine PII ausser Username + Last-Login + IP.
- [x] Letzte Loeschmoeglichkeit: Admin-Loeschung loescht User + verwaiste Haushalte hart.

## Updates der Geheimnisse

| Element                | Wann rotieren                                | Wie                                  |
|------------------------|----------------------------------------------|--------------------------------------|
| `AUTH_SECRET`          | bei Verdacht / mind. jaehrlich               | `.env` aendern + `pm2 reload`        |
| TLS-Zertifikat         | mind. 30 Tage vor Ablauf                     | `deploy\openssl\renew-checklist.md` |
| DB-Passwort App-User   | bei Verdacht / mind. jaehrlich               | `.env` + MySQL `ALTER USER`          |
| Bootstrap-Invite-Code  | nach Anlegen des ersten Users                | Im UI als Owner widerrufen           |
| `GEMINI_API_KEY`       | bei Leak                                     | Google Console + `.env`              |

## Vor Live-Gang

- [ ] `BOOTSTRAP_ADMIN_PASSWORD` setzen, `npm run bootstrap` ausfuehren, dann Variable wieder leeren.
- [ ] `BOOTSTRAP_FORCE_RESET_DB=0` und `BOOTSTRAP_INVITE_CODE` leer (oder produktiver Code).
- [ ] `COOKIE_SECURE=1` und `APP_BASE_URL=https://rezept.krinulovic.ch` im `.env`.
- [ ] DSGVO-/Datenschutztexte auf `/datenschutz` und `/impressum` finalisieren.
- [ ] Recovery-Codes-Vorlage drucken/sichern.
