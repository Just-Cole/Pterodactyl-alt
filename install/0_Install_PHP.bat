@echo off
TITLE PHP Magic Installer
echo ========================================
echo   Pterodactyl-alt: PHP Magic Installer
echo ========================================
echo.

set "PHP_DIR=C:\php"
set "PHP_URL=https://windows.php.net/downloads/releases/archives/php-8.3.30-Win32-vs16-x64.zip"

:: 1. Check if PHP already exists
if exist "%PHP_DIR%\php.exe" (
    echo [SKIP] PHP is already installed at %PHP_DIR%.
    goto :CONFIGURE
)

:: 2. Download Requirements
echo [1/4] Downloading PHP, Node.js, and MariaDB...
powershell -Command "[Net.ServicePointManager]::SecurityProtocol = [Net.SecurityProtocolType]::Tls12; Invoke-WebRequest -Uri '%PHP_URL%' -OutFile 'php.zip'"
powershell -Command "Invoke-WebRequest -Uri 'https://nodejs.org/dist/v22.11.0/node-v22.11.0-x64.msi' -OutFile 'node.msi'"
powershell -Command "Invoke-WebRequest -Uri 'https://archive.mariadb.org/mariadb-11.4.2/winx64-packages/mariadb-11.4.2-winx64.msi' -OutFile 'mariadb.msi'"

:: 3. Install Node.js
echo [2/4] Installing Node.js (Passive)...
start /wait msiexec /i node.msi /passive /norestart
del node.msi

echo [3/4] Extracting PHP to %PHP_DIR%...
if not exist "%PHP_DIR%" mkdir "%PHP_DIR%"
powershell -Command "Expand-Archive -Path 'php.zip' -DestinationPath '%PHP_DIR%' -Force"
del php.zip

:CONFIGURE
:: 4. Configure php.ini
echo [4/4] Auto-configuring php.ini...
cd /d "%PHP_DIR%"
if not exist "php.ini" (
    copy "php.ini-development" "php.ini"
)

:: Use powershell to uncomment extensions
powershell -Command "$i = Get-Content php.ini; $i = $i -replace ';extension_dir = \"ext\"', 'extension_dir = \"ext\"'; $i = $i -replace ';extension=curl', 'extension=curl'; $i = $i -replace ';extension=fileinfo', 'extension=fileinfo'; $i = $i -replace ';extension=gd', 'extension=gd'; $i = $i -replace ';extension=mbstring', 'extension=mbstring'; $i = $i -replace ';extension=openssl', 'extension=openssl'; $i = $i -replace ';extension=pdo_mysql', 'extension=pdo_mysql'; $i = $i -replace ';extension=pdo_sqlite', 'extension=pdo_sqlite'; $i = $i -replace ';extension=sqlite3', 'extension=sqlite3'; $i = $i -replace ';extension=sodium', 'extension=sodium'; $i = $i -replace ';extension=zip', 'extension=zip'; Set-Content php.ini $i"

echo.
echo ========================================
echo   PHP is installed and configured!
echo   NEXT STEP: Run 1_Setup_PHP_Path.bat
echo ========================================
