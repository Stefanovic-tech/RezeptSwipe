@echo off
setlocal ENABLEDELAYEDEXPANSION

rem ===========================================================================
rem  RezeptSwipe - Dev-Starter
rem  Erwartet:
rem    - Node.js (>= 18) im PATH
rem    - XAMPP / MySQL laeuft auf 127.0.0.1:3306 (siehe .env)
rem    - .env vorhanden im Projektverzeichnis
rem ===========================================================================

cd /d "%~dp0"

title RezeptSwipe Dev (Port 3015)

echo.
echo === RezeptSwipe Dev-Setup ===
echo Working dir: %CD%
echo.

if not exist ".env" (
  echo [FEHLER] .env nicht gefunden. Bitte zuerst .env.example nach .env kopieren.
  echo.
  pause
  exit /b 1
)

where node >nul 2>nul
if errorlevel 1 (
  echo [FEHLER] Node.js nicht im PATH gefunden. Bitte Node.js ^>= 18 installieren.
  echo.
  pause
  exit /b 1
)

if not exist "node_modules" (
  echo [1/5] node_modules fehlt - installiere Dependencies ...
  call npm install
  if errorlevel 1 (
    echo [FEHLER] npm install fehlgeschlagen.
    pause
    exit /b 1
  )
) else (
  echo [1/5] Dependencies vorhanden - ueberspringe npm install.
)

echo.
echo [2/5] Pruefe MySQL auf 127.0.0.1:3306 ...
powershell -NoProfile -Command "$c = New-Object System.Net.Sockets.TcpClient; try { $c.Connect('127.0.0.1', 3306); $c.Close(); exit 0 } catch { exit 1 }"
if errorlevel 1 (
  echo [WARNUNG] MySQL auf 127.0.0.1:3306 nicht erreichbar.
  echo           Starte XAMPP / MySQL und druecke eine Taste, um fortzufahren.
  pause
)

echo.
echo [3/5] Wende Migrationen an ...
call npm run migrate:baseline
call npm run migrate
if errorlevel 1 (
  echo [FEHLER] Migrationen fehlgeschlagen. Bitte Logs pruefen.
  pause
  exit /b 1
)

echo.
echo [4/5] Fuelle recipe_cache auf ^(idempotent, mind. 8 Fallback-Rezepte^) ...
call npm run seed
if errorlevel 1 (
  echo [FEHLER] Seed fehlgeschlagen. Bitte Logs pruefen.
  pause
  exit /b 1
)

echo.
echo [5/5] Starte Next.js Dev-Server auf http://localhost:3015 ...
echo Mit Strg+C beenden.
echo.
call npm run dev

endlocal
