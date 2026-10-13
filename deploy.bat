@echo off
setlocal
rem ---------------------------------------------------------------------------
rem Windows wrapper for deploy.sh - builds the game and publishes it to the VPS
rem (nginx, https://synarteum.com). Runs through Git Bash (ssh/scp/tar).
rem
rem Usage (from a terminal in the repo root):
rem   deploy.bat
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

"%BASH%" "%SCRIPT_DIR%deploy.sh" %*
exit /b %ERRORLEVEL%
