@echo off
TITLE PHP Magic Installer
echo ========================================
echo   Pterodactyl-alt: PHP Magic Installer
echo ========================================
echo.
echo [DEBUG] Entering Step 0...

set "PHP_DIR=C:\php"
set "PHP_URL=https://windows.php.net/downloads/releases/archives/php-8.3.30-Win32-vs16-x64.zip"

:: 1. Download Requirements
echo [1/4] Checking requirements...

:: Check PHP
if exist "%PHP_DIR%\php.exe" goto :CHECK_NODE
if exist "php.zip" goto :CHECK_NODE
echo [INFO] PHP missing. Downloading...
curl -L -o "php.zip" "%PHP_URL%"

:CHECK_NODE
:: Check Node.js
node -v >nul 2>&1
if not errorlevel 1 goto :CHECK_MARIA
if exist "node.msi" goto :CHECK_MARIA
echo [INFO] Node.js missing. Downloading...
curl -L -o "node.msi" "https://nodejs.org/dist/v22.11.0/node-v22.11.0-x64.msi"

:CHECK_MARIA
:: Check MariaDB
sc query MariaDB >nul 2>&1
if not errorlevel 1 goto :INSTALL_START
if exist "mariadb.msi" goto :INSTALL_START
echo [INFO] MariaDB missing. Downloading...
curl -L -o "mariadb.msi" "https://archive.mariadb.org/mariadb-11.4.2/winx64-packages/mariadb-11.4.2-winx64.msi"

:INSTALL_START
echo [DEBUG] All checks passed. Starting installation...

:: 2. Install PHP
if exist "%PHP_DIR%\php.exe" goto :INSTALL_NODE
echo [2/4] Extracting PHP to %PHP_DIR%...
if not exist "%PHP_DIR%" mkdir "%PHP_DIR%"
powershell -Command "Expand-Archive -Path 'php.zip' -DestinationPath '%PHP_DIR%' -Force"
if exist "php.zip" del "php.zip"

:INSTALL_NODE
:: 3. Install Node.js
node -v >nul 2>&1
if not errorlevel 1 echo [SKIP] Node.js already installed.
if not errorlevel 1 goto :CONFIGURE
echo [3/4] Installing Node.js (Passive)...
start /wait msiexec /i node.msi /passive /norestart
if exist "node.msi" del "node.msi"

:CONFIGURE
:: 4. Configure php.ini
echo [4/4] Auto-configuring php.ini...
cd /d "%PHP_DIR%"
if not exist "php.ini" copy "php.ini-development" "php.ini"

powershell -Command "$i = Get-Content php.ini; $i = $i -replace ';extension_dir = \"ext\"', 'extension_dir = \"ext\"'; $i = $i -replace ';extension=curl', 'extension=curl'; $i = $i -replace ';extension=fileinfo', 'extension=fileinfo'; $i = $i -replace ';extension=gd', 'extension=gd'; $i = $i -replace ';extension=mbstring', 'extension=mbstring'; $i = $i -replace ';extension=openssl', 'extension=openssl'; $i = $i -replace ';extension=pdo_mysql', 'extension=pdo_mysql'; $i = $i -replace ';extension=pdo_sqlite', 'extension=pdo_sqlite'; $i = $i -replace ';extension=sqlite3', 'extension=sqlite3'; $i = $i -replace ';extension=sodium', 'extension=sodium'; $i = $i -replace ';extension=zip', 'extension=zip'; Set-Content php.ini $i"

echo [OK] PHP Configured.
echo ========================================
echo   PHP Step Complete!
echo ========================================
