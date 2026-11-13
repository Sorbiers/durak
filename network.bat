@echo off
setlocal
rem ---------------------------------------------------------------------------
rem Stops and starts the table server (the game with invited people) on the VPS.
rem Runs network.sh through Git Bash.
rem
rem   network.bat            status: running or not, and the tables in use now
rem   network.bat stop       stop it, and keep it stopped after a reboot
rem   network.bat start      start it
rem   network.bat restart    stop and start: every table is closed
rem   network.bat log        its last 50 log lines
rem ---------------------------------------------------------------------------

set "SCRIPT_DIR=%~dp0"

set "BASH="
if exist "%ProgramFiles%\Git\bin\bash.exe"        set "BASH=%ProgramFiles%\Git\bin\bash.exe"
if not defined BASH if exist "%ProgramFiles(x86)%\Git\bin\bash.exe" set "BASH=%ProgramFiles(x86)%\Git\bin\bash.exe"
if not defined BASH if exist "%LocalAppData%\Programs\Git\bin\bash.exe" set "BASH=%LocalAppData%\Programs\Git\bin\bash.exe"
if not defined BASH for %%I in (bash.exe) do if not defined BASH set "BASH=%%~$PATH:I"

if not defined BASH (
  echo ERROR: Git Bash not found. Install Git for Windows:
  echo        https://git-scm.com/download/win
  exit /b 1
)

"%BASH%" "%SCRIPT_DIR%network.sh" %*
exit /b %ERRORLEVEL%
