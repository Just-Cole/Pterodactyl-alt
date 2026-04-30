@echo off
TITLE Pterodactyl-alt Master Auto-Installer
echo ========================================
echo   Pterodactyl-alt: MASTER AUTO-INSTALLER
echo ========================================
echo.

:: 1. Check for Administrator privileges
net session >nul 2>&1
if %errorLevel% == 0 (
    echo [OK] Running as Administrator.
) else (
    echo [ERROR] Please right-click this file and select "Run as Administrator".
    pause
    exit /b
)

echo.
echo This will completely set up Pterodactyl-alt. 
echo Please provide the following info for your Admin Account:
echo.
set /p ADMIN_EMAIL="Enter Admin Email: "
set /p ADMIN_USER="Enter Admin Username: "
set /p ADMIN_PASS="Enter Admin Password: "
echo.
echo [STEP 3] Database Choice
set /p dbchoice="Do you want to use a Local Database (SQLite)? [y/n]: "

if /i "%dbchoice%" neq "y" (
    set /p DB_PASS="Enter a password for the MySQL Root user: "
)

echo.
echo Starting full automation...
pause

echo [STEP 0] Installing PHP and Node.js...
call install\0_Install_PHP.bat
if %errorlevel% neq 0 goto :ERROR

echo [STEP 1] Setting up Windows Path...
call install\1_Setup_PHP_Path.bat
if %errorlevel% neq 0 goto :ERROR

echo [STEP 2] Installing Project Dependencies...
call install\2_Install_Dependencies.bat
if %errorlevel% neq 0 goto :ERROR

echo.
echo [STEP 3] Database Choice
set /p dbchoice="Do you want to use a Local Database (SQLite)? [y/n]: "

if /i "%dbchoice%"=="y" (
    echo [STEP 3] Setting up Local SQLite...
    call install\3_Setup_Local_Database.bat
    if %errorlevel% neq 0 goto :ERROR
) else (
    echo [STEP 3] Skipping Local DB. Please configure .env manually for MySQL.
)

echo [STEP 4] Finishing Setup...
call install\4_Finish_Setup.bat
if %errorlevel% neq 0 goto :ERROR

echo.
echo ========================================
echo   INSTALLATION COMPLETE!
echo.
echo   1. Close this window.
echo   2. Run 'start.bat' to launch the Panel.
echo ========================================
pause
exit /b

:ERROR
echo.
echo ========================================
echo   [!] INSTALLATION FAILED
echo ========================================
echo.
echo Something went wrong during the last step.
echo Please check the following:
echo   1. Are you connected to the internet?
echo   2. Did you run this script as Administrator?
echo   3. Is another program using the files in this folder?
echo.
echo You can try running the failed step manually 
echo from the 'install/' folder to see more details.
echo ========================================
pause
exit /b
