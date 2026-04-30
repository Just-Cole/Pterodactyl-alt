@echo off
TITLE PHP Path Setup
echo ========================================
echo   Adding C:\php to Windows System Path
echo ========================================
echo.

:: Check for Administrator privileges
net session >nul 2>&1
if %errorLevel% == 0 (
    echo [OK] Running as Administrator.
) else (
    echo [ERROR] Please right-click this file and select "Run as Administrator".
    pause
    exit /b
)

:: Use PowerShell to add C:\php to the Machine Path
powershell -Command "[Environment]::SetEnvironmentVariable('Path', [Environment]::GetEnvironmentVariable('Path', 'Machine') + ';C:\php', 'Machine')"

if %errorLevel% == 0 (
    echo.
    echo [SUCCESS] C:\php has been added to your System Path!
    echo [NOTE] Please restart any open terminal windows for the change to take effect.
) else (
    echo.
    echo [ERROR] Failed to update path.
)

pause
