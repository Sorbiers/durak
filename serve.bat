@echo off
setlocal
rem ---------------------------------------------------------------------------
rem Builds the game and serves it on this computer, then opens it in the browser.
rem Usage: double-click, or run serve.bat from a terminal. Ctrl+C stops the server.
rem ---------------------------------------------------------------------------
cd /d "%~dp0"

where npm >nul 2>nul
if errorlevel 1 (
  echo ERROR: Node.js not found. Install it from https://nodejs.org
  exit /b 1
)

if not exist node_modules call npm install || exit /b 1
call npm run build || exit /b 1
call npm run preview -- --open
exit /b %ERRORLEVEL%
