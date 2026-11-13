@echo off
setlocal
rem ---------------------------------------------------------------------------
rem Runs the game with shared tables on this computer, for the home network:
rem the table server in a window of its own, and the game beside it, on a fixed
rem port, opened in the browser at this computer's address on the network.
rem Open the game at that address and the invite links work for everyone on
rem the same network.
rem
rem   network-local.bat               start (double-click works too)
rem   network-local.bat firewall      let the home network reach the game:
rem                                   adds a Windows Firewall rule for the port,
rem                                   for this network only. Asks for administrator.
rem   network-local.bat firewall-off  removes that rule
rem
rem Ctrl+C stops the game; close the "Durak tables" window to stop the table server.
rem ---------------------------------------------------------------------------
cd /d "%~dp0"

rem The game's port on this computer. The firewall rule is for this port.
set "PORT=5190"
set "RULE=Durak local game"

if /i "%~1"=="firewall" goto firewall
if /i "%~1"=="firewall-off" goto firewall
if not "%~1"=="" (
  echo Usage: network-local.bat [firewall ^| firewall-off]
  exit /b 1
)

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

rem This computer's address on the network: the adapter that has a gateway.
set "LAN="
for /f "usebackq delims=" %%I in (`powershell -NoProfile -Command "(Get-NetIPConfiguration | Where-Object { $_.IPv4DefaultGateway -and $_.NetAdapter.Status -eq 'Up' } | Select-Object -First 1).IPv4Address.IPAddress"`) do set "LAN=%%I"
if not defined LAN (
  echo No network found: the game will be at http://localhost:%PORT%/ on this computer only.
  set "LAN=localhost"
)

echo.
echo   The game:  http://%LAN%:%PORT%/
echo   Open it at that address, here and on the other devices. If they cannot
echo   reach it, run once:  network-local.bat firewall
echo.

rem The table server stays on this computer only: the game passes the requests on to it.
start "Durak tables" cmd /c "npm run net"
rem The browser, once the game has had a moment to start.
start "" /min cmd /c "timeout /t 4 /nobreak >nul & start http://%LAN%:%PORT%/"
call npm run dev -- --host --port %PORT% --strictPort
exit /b %ERRORLEVEL%

:firewall
net session >nul 2>nul
if errorlevel 1 (
  echo Asking for administrator rights...
  powershell -NoProfile -Command "Start-Process -Verb RunAs -FilePath '%~f0' -ArgumentList '%~1'"
  exit /b
)
netsh advfirewall firewall delete rule name="%RULE%" >nul 2>nul
if /i "%~1"=="firewall-off" (
  echo Firewall rule "%RULE%" removed.
) else (
  rem Only this port, only incoming, and only from addresses on the same network.
  netsh advfirewall firewall add rule name="%RULE%" dir=in action=allow protocol=TCP localport=%PORT% remoteip=localsubnet
  echo Firewall rule "%RULE%": port %PORT% is open to this network.
)
pause
exit /b 0
