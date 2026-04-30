@echo off
TITLE Final Setup
echo ========================================
echo   Finishing Pterodactyl-alt Setup
echo ========================================
echo.

cd ..

:: 1. Generate APP_KEY if not set
echo [1/3] Checking Application Key...
findstr /C:"APP_KEY=base64:" .env >nul
if %errorlevel% == 0 (
    echo [SKIP] App Key is already set.
) else (
    echo [OK] Generating new Application Key...
    php artisan key:generate --force
)

:: 1.5 Create Admin User
echo [1.5/3] Creating Admin Account...
php artisan p:user:make --email="%ADMIN_EMAIL%" --username="%ADMIN_USER%" --name-first="Admin" --name-last="User" --password="%ADMIN_PASS%" --admin=1 --no-interaction

:: 2. Storage Link
echo [2/3] Linking storage folder...
if not exist public\storage (
    php artisan storage:link
) else (
    echo [SKIP] Storage is already linked.
)

:: 3. Clear Cache
echo [3/3] Optimizing and clearing cache...
php artisan view:clear
php artisan config:clear

echo.
echo ========================================
echo   All Done! You can now run start.bat
echo ========================================
pause
