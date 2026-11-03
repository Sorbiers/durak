@echo off
setlocal
rem ---------------------------------------------------------------------------
rem Opens the characters' test page, player-states.html: every picture of every opponent, mood
rem by mood, with a test of how one picture dissolves into the next. It runs on the dev server,
rem so a picture added or removed shows at once. Ctrl+C stops the server.
rem Usage: double-click, or run characters.bat from a terminal.
rem ---------------------------------------------------------------------------
cd /d "%~dp0"

where npm >nul 2>nul
if errorlevel 1 (
  echo ERROR: Node.js not found. Install it from https://nodejs.org
  exit /b 1
)

if not exist node_modules call npm install || exit /b 1
call npm run dev -- --open /player-states.html
exit /b %ERRORLEVEL%
