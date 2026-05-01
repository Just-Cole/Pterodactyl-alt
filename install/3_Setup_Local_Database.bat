@echo off
SETLOCAL EnableDelayedExpansion
TITLE Local MariaDB Setup
echo ========================================
echo   Configuring Local MariaDB Database
echo ========================================
echo.

:: 1. Check for MariaDB Service
sc query MariaDB >nul 2>&1
if %errorlevel% equ 0 goto :START_SERVICE

:: Install MariaDB
echo [1/3] Installing MariaDB (Passive)...
if not exist "%~dp0mariadb.msi" (
    echo [ERROR] MariaDB Installer missing in /install folder!
    exit /b 1
)
start /wait msiexec /i "%~dp0mariadb.msi" /passive /norestart SERVICENAME=MariaDB PASSWORD=%DB_PASS%

:START_SERVICE
echo Starting MariaDB Service...
net start MariaDB >nul 2>&1

:: Find MariaDB Path
echo Locating MariaDB executable...
set "MARIA_PATH="
for /f "tokens=2* delims=:" %%A in ('sc qc MariaDB ^| findstr BINARY_PATH_NAME') do set "RAW_VAL=%%A"
for /f "tokens=* delims= " %%A in ("!RAW_VAL!") do set "RAW_VAL=%%A"
if "!RAW_VAL:~0,1!"=="""" (
    for /f "tokens=2 delims=""" %%A in ("!RAW_VAL!") do set "MARIA_PATH=%%A"
) else (
    for /f "tokens=1 delims= " %%A in ("!RAW_VAL!") do set "MARIA_PATH=%%A"
)
set "MARIA_BIN=!MARIA_PATH:mariadbd.exe=mariadb.exe!"

if not exist "!MARIA_BIN!" set "MARIA_BIN=C:\Program Files\MariaDB 11.4\bin\mariadb.exe"
if not exist "!MARIA_BIN!" (
    echo [ERROR] Could not find mariadb.exe at !MARIA_BIN!
    exit /b 1
)
echo [OK] Found MariaDB at: !MARIA_BIN!

:: 1.5 Update .env for MySQL and Drivers
echo [1.5/3] Sanitizing and Updating .env...
:: Using variable-based PowerShell to avoid quoting issues
powershell -NoProfile -ExecutionPolicy Bypass -Command "$envPath = '%~dp0..\.env'; $c = Get-Content $envPath; $c = $c -replace 'DB_CONNECTION=.*', 'DB_CONNECTION=mysql'; $c = $c -replace '#?DB_HOST=.*', 'DB_HOST=127.0.0.1'; $c = $c -replace '#?DB_PORT=.*', 'DB_PORT=3306'; $c = $c -replace 'DB_DATABASE=.*', 'DB_DATABASE=panel'; $c = $c -replace 'DB_USERNAME=.*', 'DB_USERNAME=ptero_user'; $c = $c -replace 'DB_PASSWORD=.*', 'DB_PASSWORD=\"%DB_PASS%\"'; $c = $c -replace 'CACHE_DRIVER=.*', 'CACHE_DRIVER=file'; $c = $c -replace 'SESSION_DRIVER=.*', 'SESSION_DRIVER=file'; $c = $c -replace 'QUEUE_CONNECTION=.*', 'QUEUE_CONNECTION=sync'; Set-Content $envPath $c"

:: 2. Create the 'panel' database and dedicated user
echo [2/3] Preparing database and user...
cd /d "%~dp0.."
set "SQL=CREATE DATABASE IF NOT EXISTS panel; CREATE USER IF NOT EXISTS 'ptero_user'@'127.0.0.1' IDENTIFIED BY '%DB_PASS%'; GRANT ALL PRIVILEGES ON panel.* TO 'ptero_user'@'127.0.0.1'; FLUSH PRIVILEGES;"

:: Attempt 1: No password
"!MARIA_BIN!" -u root -e "!SQL!" 2>nul
if not errorlevel 1 goto :MIGRATE

:: Attempt 2: Provided password
"!MARIA_BIN!" -u root -p"%DB_PASS%" -e "!SQL!" 2>nul
if not errorlevel 1 goto :MIGRATE

:: If both fail, stop and inform user
echo.
echo ========================================
echo   [ERROR] DATABASE AUTHENTICATION FAILED
echo ========================================
echo Could not log into MariaDB as 'root'.
echo.
echo Please ensure:
echo 1. Your MariaDB root password is correct.
echo 2. If you don't know the password, please reinstall MariaDB.
echo.
exit /b 1

:MIGRATE
:: 3. Run Migrations
echo [3/3] Running database migrations...

:: Add MariaDB bin to PATH so Laravel can find 'mysql' command
for %%I in ("!MARIA_BIN!") do set "MARIA_DIR=%%~dpI"
set "PATH=!MARIA_DIR!;%PATH%"

php artisan migrate --force --seed

echo.
echo ========================================
echo   Local MariaDB is Ready!
echo ========================================
