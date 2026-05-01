@echo off
SETLOCAL EnableDelayedExpansion
TITLE Pterodactyl-alt Master Auto-Installer
echo ========================================
echo   Pterodactyl-alt: MASTER AUTO-INSTALLER
echo ========================================
echo.

:: 1. Initialize Defaults
set "CUR_EMAIL=admin@example.com"
set "CUR_USER=admin"
set "CUR_PASS=password"
set "CUR_DB_PASS=password"

:: 2. Load ONLY from Cache (The installer's memory)
if exist .installer_cache (
    for /f "usebackq tokens=1* delims==" %%A in (".installer_cache") do (
        if "%%A"=="ADMIN_EMAIL" set "CUR_EMAIL=%%B"
        if "%%A"=="ADMIN_USER" set "CUR_USER=%%B"
        if "%%A"=="ADMIN_PASS" set "CUR_PASS=%%B"
        if "%%A"=="DB_PASS" set "CUR_DB_PASS=%%B"
    )
)

echo Please provide your setup info. 
echo Press [ENTER] to keep the [current] value.
echo.

set /p ADMIN_EMAIL="Admin Email [!CUR_EMAIL!]: "
if "!ADMIN_EMAIL!"=="" set "ADMIN_EMAIL=!CUR_EMAIL!"

set /p ADMIN_USER="Admin Username [!CUR_USER!]: "
if "!ADMIN_USER!"=="" set "ADMIN_USER=!CUR_USER!"

set /p ADMIN_PASS="Admin Password [!CUR_PASS!]: "
if "!ADMIN_PASS!"=="" set "ADMIN_PASS=!CUR_PASS!"

echo.
set /p dbchoice="Use Local Database (SQLite)? [y/n]: "

if /i "%dbchoice%" neq "y" (
    set /p DB_PASS="MySQL Root Password [!CUR_DB_PASS!]: "
    if "!DB_PASS!"=="" set "DB_PASS=!CUR_DB_PASS!"
)

:: Save settings to cache (so the installer remembers NEXT time)
(
    echo ADMIN_EMAIL=!ADMIN_EMAIL!
    echo ADMIN_USER=!ADMIN_USER!
    echo ADMIN_PASS=!ADMIN_PASS!
    echo DB_PASS=!DB_PASS!
) > .installer_cache

echo.
echo Starting full automation...

:: --- STEP 0 ---
echo [DEBUG] Calling Step 0...
pushd "%~dp0install"
call 0_Install_PHP.bat
popd
if %errorlevel% neq 0 goto :ERROR

:: --- STEP 1 ---
echo [DEBUG] Calling Step 1...
pushd "%~dp0install"
call 1_Setup_PHP_Path.bat
popd
if %errorlevel% neq 0 goto :ERROR

:: --- STEP 2 ---
echo [DEBUG] Calling Step 2...
pushd "%~dp0install"
call 2_Install_Dependencies.bat
popd
if %errorlevel% neq 0 goto :ERROR

:: --- STEP 3 ---
echo [DEBUG] Calling Step 3...
pushd "%~dp0install"
call 3_Setup_Local_Database.bat
popd
if %errorlevel% neq 0 goto :ERROR

:: --- STEP 4 ---
echo [DEBUG] Calling Step 4...
pushd "%~dp0install"
call 4_Finish_Setup.bat
popd
if %errorlevel% neq 0 goto :ERROR

echo.
echo ========================================
echo   INSTALLATION COMPLETE!
echo   Run 'start.bat' to launch the Panel.
echo ========================================
pause
exit /b

:ERROR
echo.
echo ========================================
echo   [!] INSTALLATION FAILED
echo ========================================
pause
exit /b
