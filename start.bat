@echo off
TITLE Pterodactyl-alt: Master Launcher
echo ========================================
echo   Starting Pterodactyl-alt Ecosystem
echo ========================================
echo.

:: 1. Start the Node (Wings) in a new window
echo [1/2] Launching Windows Node (Wings)...
:: Use 'cmd /k' so the window stays open even if it crashes, allowing us to see the error.
start "Pterodactyl-alt: Node" cmd /k "cd daemon && npx nodemon index.js"

:: 2. Start the Panel in this window
echo [2/2] Launching Web Panel...
echo Panel will be available at: http://127.0.0.1:8000
echo.
php artisan serve
pause
