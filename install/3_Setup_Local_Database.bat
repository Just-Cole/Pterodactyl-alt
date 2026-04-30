@echo off
TITLE Local Database Setup
echo ========================================
echo   Configuring Local SQLite Database
echo ========================================
echo.

cd ..

:: 1. Create the SQLite file if it doesn't exist
if not exist database\database.sqlite (
    echo [1/3] Creating database.sqlite file...
    type nul > database\database.sqlite
)

:: 2. Update .env file
echo [2/3] Updating .env for SQLite...
:: We use powershell to safely replace the DB settings
powershell -Command "$c = Get-Content .env; $c = $c -replace 'DB_CONNECTION=.*', 'DB_CONNECTION=sqlite'; $c = $c -replace 'DB_HOST=.*', '#DB_HOST=127.0.0.1'; $c = $c -replace 'DB_PORT=.*', '#DB_PORT=3306'; $c = $c -replace 'DB_DATABASE=.*', 'DB_DATABASE=%CD%\database\database.sqlite'; Set-Content .env $c"

:: 3. Run Migrations
echo [3/3] Running database migrations...
php artisan migrate --force --seed

echo.
echo ========================================
echo   Local SQLite Database is Ready!
echo ========================================
pause
