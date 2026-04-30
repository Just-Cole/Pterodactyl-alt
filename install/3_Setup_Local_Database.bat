@echo off
TITLE Local MariaDB Setup
echo ========================================
echo   Configuring Local MariaDB Database
echo ========================================
echo.

cd ..

:: 1. Install MariaDB MSI
echo [1/3] Installing MariaDB (Passive)...
start /wait msiexec /i install\mariadb.msi /passive /norestart SERVICENAME=MariaDB PASSWORD=%DB_PASS%
del install\mariadb.msi

:: 2. Create the 'panel' database
echo [2/3] Creating 'panel' database...
:: We use the newly installed mariadb client to create the DB
"C:\Program Files\MariaDB 11.4\bin\mariadb.exe" -u root -p%DB_PASS% -e "CREATE DATABASE IF NOT EXISTS panel;"

:: 3. Run Migrations
echo [3/3] Running database migrations...
php artisan migrate --force --seed

echo.
echo ========================================
echo   Local MariaDB is Ready!
echo ========================================
pause
