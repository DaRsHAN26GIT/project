@echo off
cd /d "%~dp0"
where node >nul 2>nul
if errorlevel 1 (
  echo Install Node.js LTS from https://nodejs.org/ and restart this window.
  pause
  exit /b 1
)
echo Installing RuralClass dependencies from the lockfile...
call npm.cmd ci
if errorlevel 1 (
  echo Installation failed. Read the error above.
  pause
  exit /b 1
)
echo Open http://localhost:3000 after the server says Ready.
call npm.cmd run dev
pause
