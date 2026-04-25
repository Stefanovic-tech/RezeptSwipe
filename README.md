# RezeptSwipe

Mobile-first Web-App fuer gemeinsames Rezept-Entscheiden, Kochen und Einkaufen
mit Next.js Fullstack, MySQL (Raw SQL), eigener JWT-Auth, Nginx und PM2.

- Public URL (Prod): https://rezept.krinulovic.ch (Port 3015 hinter Nginx-TLS)
- Stack: Next.js 14 + Tailwind, mysql2, argon2, jose, zod
- Daten: MySQL 8.x oder MariaDB >=10.4 (Dev: XAMPP, Prod: Server-MySQL)

## Lokales Setup (Windows mit XAMPP)

```powershell
# Voraussetzung: XAMPP MySQL laeuft auf Port 3306, Node.js LTS installiert

# 1) Abhaengigkeiten
npm install

# 2) Env vorbereiten (Default-Werte aus .env.example funktionieren mit XAMPP)
copy .env.example .env

# 3) DB anlegen + Migrationen
npm run migrate

# 4) Seed-Rezepte einspielen
npm run seed

# 5) Initialer Admin (Passwort vorher in .env setzen, z. B. BOOTSTRAP_ADMIN_PASSWORD=changeMe!)
npm run bootstrap

# 6) Dev-Server (Port 3015)
npm run dev
```

App: http://localhost:3015 -> Login mit `admin` und gewaehltem Passwort.
Invite-Code aus `BOOTSTRAP_INVITE_CODE` ist im Bootstrap angelegt; er kann
ueber den Haushalt-Bereich widerrufen und ein eigener Code erstellt werden.

## Wichtige Skripte

| Skript               | Zweck                                            |
|----------------------|--------------------------------------------------|
| `npm run dev`        | Dev-Server auf 3015                              |
| `npm run build`      | Produktions-Build                                |
| `npm run start`      | Produktions-Server (`next start -p 3015`)        |
| `npm run lint`       | ESLint                                           |
| `npm run typecheck`  | TypeScript ohne Emit                             |
| `npm run migrate`    | Pending Up-Migrationen anwenden                  |
| `npm run migrate:down` | Letzte angewendete Migration zurueckrollen     |
| `npm run migrate:status` | Status aller Migrationen                     |
| `npm run seed`       | Fallback-Rezepte sicherstellen                   |
| `npm run bootstrap`  | Initialen Admin + Haushalt + Invite-Code anlegen |

## Architektur

- **App-Routing:** Next.js App Router unter `src/app/`. Public: `/login`, `/register`, `/forgot`, `/impressum`, `/datenschutz`. Geschuetzt unter `(app)`-Layout: `/swipe`, `/kochen`, `/einkauf`, `/haushalt`, `/profil`, `/admin`.
- **API:** Server-side Route Handler unter `src/app/api/`. Auth via Cookies (Access + Refresh).
- **Auth:** JWT (HS256) Access Token (15min) + DB-persistierte Refresh Sessions (14 Tage) mit Rotation und Reuse-Detection (`src/lib/session.ts`).
- **DB:** Raw SQL ueber `mysql2` Pool (`src/lib/db.ts`). Migrationen unter `migrations/` mit eigenem Runner (`scripts/migrate.mjs`).
- **Mobile-First UI:** 44x44 Touch-Ziele, Bottom-Navigation, Swipe mit Button-Fallback, Polling fuer kollaborative Bereiche (Shopping 5s, Kochsession 10s).
- **Rate-Limits:** Login (5/15min IP+Username), Invite (10/15min IP), persistiert in `rate_limit_buckets`.
- **Audit:** `admin_audit_log` fuer Bann/Entbann, Adminflag, Passwort-Reset, Loeschung.

## Datenmodell (Auszug)

- `users` (admin/banned, current_household_id)
- `refresh_sessions` (token_hash, expires_at, rotated_to_id)
- `user_recovery_codes` (code_hash, used_at)
- `households` + `household_members` (owner/member) + `household_invites` (code_hash) + `household_preferences`
- `recipe_cache` (source, external_id, ingredients_json, steps_json, effort, est_minutes, Diet-Flags)
- `household_recipe_state` (liked/passed pro Haushalt+Rezept)
- `cooking_sessions` + `cooking_session_choices`
- `shopping_lists` + `shopping_list_items`
- `admin_audit_log`
- `rate_limit_buckets`

Vollstaendiges DDL: `migrations/001_initial_schema.up.sql`.

## Production-Deploy

Siehe `docs/windows-runtime.md` (Initial-Setup) und
`docs/security-ops-checklist.md` (Sicherheits- und Betriebsstandards).

Standard-Workflow auf dem Server (Powershell, App-Service-User):

```powershell
cd C:\apps\rezeptswipe
.\deploy\deploy.ps1
```

Das Skript fuehrt `git pull`, `npm ci`, Migrationen, Build, `pm2 reload`,
und Smoke-Test (`/api/health`) aus.

## Mobile-Tauglichkeit

- Layout ab 360px Breite, keine horizontale Scrollbar.
- Touch-Targets >= 44x44 px, sticky Bottom-Navigation.
- Swipe mit Pointer-Events, plus Buttons "Ja"/"Nein" als Fallback.
- Eingabefelder mit `autocomplete`, `inputMode`, `font-size 16px` (kein iOS-Zoom).
- Polling mit Backoff bei Netzfehlern.
- Beide Themes (hell/dunkel) ueber `<ThemeToggle/>` umschaltbar, `prefers-color-scheme` als Default.

## Lizenz / Hinweis

Interne App fuer den Eigenbetrieb auf rezept.krinulovic.ch.
