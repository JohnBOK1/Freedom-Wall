@echo off
cd /d "%~dp0"
echo =============================================
echo   OPEN ATLAS - GLOBAL FREEDOM WALL
echo =============================================
echo.
where npm >nul 2>nul
if errorlevel 1 (
  echo ERROR: Node.js/npm not found. Install from https://nodejs.org/
  pause
  exit /b 1
)
if not exist node_modules (
  echo Installing project dependencies for the first time...
  call npm install
  if errorlevel 1 (
    echo NPM install failed. Check your internet connection.
    pause
    exit /b 1
  )
)
echo.
echo Open the URL shown below in your browser.
echo Press CTRL+C to stop the website.
echo.
call npm run dev
pause
