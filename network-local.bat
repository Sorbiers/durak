@echo off
setlocal
rem ---------------------------------------------------------------------------
rem Runs the game with shared tables on this computer: the table server in a
rem window of its own, and the game beside it, opened in the browser.
rem
rem Usage: double-click, or run network-local.bat from a terminal.
rem Ctrl+C stops the game; close the "Durak tables" window to stop the table server.
rem A second player on this computer: the same address with guest.localhost
rem in place of localhost.
rem ---------------------------------------------------------------------------
cd /d "%~dp0"

where npm >nul 2>nul
if errorlevel 1 (
  echo ERROR: Node.js not found. Install it from https://nodejs.org
  exit /b 1
)

if not exist network.env (
  echo network.env not found: copying network.env.example
  copy /y network.env.example network.env >nul || exit /b 1
)

rem network.env gives the table server its port and limits
for /f "usebackq eol=# tokens=1,* delims==" %%A in ("network.env") do set "%%A=%%B"

if /i not "%NETWORK%"=="on" (
  echo network.env has NETWORK=%NETWORK%: set NETWORK=on to get the Invite tab.
  exit /b 1
)
rem the count of finished games is for the server only
set "NETWORK_STATS="

if not exist node_modules call npm install || exit /b 1

start "Durak tables" cmd /c "npm run net"
call npm run dev -- --open
exit /b %ERRORLEVEL%
