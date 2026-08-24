@echo off
setlocal
cd /d "%~dp0"

set "BUNDLED_NODE=C:\Users\Billy\.cache\codex-runtimes\codex-primary-runtime\dependencies\node\bin"
set "BUNDLED_PNPM=C:\Users\Billy\.cache\codex-runtimes\codex-primary-runtime\dependencies\bin\fallback\pnpm.cmd"

if exist "%BUNDLED_PNPM%" (
  set "PATH=%BUNDLED_NODE%;%PATH%"
  set "PNPM_CMD=%BUNDLED_PNPM%"
) else (
  where pnpm >nul 2>nul
  if errorlevel 1 (
    echo [Picseal] pnpm was not found. Install Node.js 22 and pnpm first.
    pause
    exit /b 1
  )
  set "PNPM_CMD=pnpm"
)

start "" "http://localhost:3000"
call "%PNPM_CMD%" run dev --host 127.0.0.1
if errorlevel 1 pause
