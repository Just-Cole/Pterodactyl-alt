@echo off
TITLE Pterodactyl-alt Launcher
echo ========================================
echo   Pterodactyl-alt Windows Launcher
echo ========================================
echo.

:: Check for Panel .env
if not exist .env (
    echo [ERROR] Panel .env file missing! Please configure it first.
    pause
    exit /b
)

:: Check for Daemon .env
if not exist daemon\.env (
    echo [ERROR] Daemon .env file missing!
    echo Creating default daemon\.env...
    echo WINGS_PORT=8080 > daemon\.env
    echo WINGS_TOKEN=changeme >> daemon\.env
    echo PANEL_URL=http://localhost:8000 >> daemon\.env
)

echo Starting Pterodactyl Panel...
start "Pterodactyl Panel" cmd /k "php artisan serve --port=8000"

echo Starting Wings-Win Daemon...
cd daemon
start "Wings-Win Daemon" cmd /k "node index.js"

echo.
echo ========================================
echo   Both services are now starting!
echo   Panel: http://localhost:8000
echo   Daemon: http://localhost:8080
echo ========================================
pause
