@echo off
TITLE Dependency Installer
echo ========================================
echo   Installing Project Dependencies
echo ========================================
echo.

:: 1. Install Panel Dependencies (Composer)
echo [1/2] Installing Panel dependencies (PHP)...
cd ..
if exist composer (
    php composer install --no-dev --optimize-autoloader --ignore-platform-req=ext-posix
) else (
    echo [ERROR] composer binary not found in root folder!
    echo Please run the setup commands in the README to download composer first.
)

echo.

:: 2. Install Daemon Dependencies (NPM)
echo [2/2] Installing Daemon dependencies (Node.js)...
cd daemon
call npm install

echo.
echo ========================================
echo   Dependencies installed successfully!
echo ========================================
