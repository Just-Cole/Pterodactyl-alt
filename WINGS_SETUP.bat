@echo off
set "RUNTIME_DIR=C:\ptero\runtime"
mkdir %RUNTIME_DIR% 2>nul
TITLE Wings Setup - DEBUG MODE
echo ========================================
echo   Pterodactyl-alt: WINGS AUTO-LINK
echo ========================================

:: 2. Ensure Core Runtimes exist
echo [1/4] Ensuring Core Runtimes exist (Speed Boost)...
set "RUNTIME_DIR=C:\ptero\runtime"
if not exist "%RUNTIME_DIR%" mkdir "%RUNTIME_DIR%"

:: Cleanup broken folders
if exist "%RUNTIME_DIR%\java21" if not exist "%RUNTIME_DIR%\java21\bin\java.exe" rmdir /s /q "%RUNTIME_DIR%\java21"
if exist "%RUNTIME_DIR%\java25" if not exist "%RUNTIME_DIR%\java25\bin\java.exe" rmdir /s /q "%RUNTIME_DIR%\java25"

:: Java 21
if not exist "%RUNTIME_DIR%\java21" (
    echo [+] Downloading Java 21...
    powershell -Command "Start-BitsTransfer -Source 'https://github.com/adoptium/temurin21-binaries/releases/download/jdk-21.0.2+13/OpenJDK21U-jdk_x64_windows_hotspot_21.0.2_13.zip' -Destination 'j21.zip'"
    powershell -Command "Expand-Archive -Path 'j21.zip' -DestinationPath '%RUNTIME_DIR%\java21_tmp' -Force"
    powershell -Command "Move-Item -Path '%RUNTIME_DIR%\java21_tmp\jdk*' -Destination '%RUNTIME_DIR%\java21' -Force"
    rmdir /s /q "%RUNTIME_DIR%\java21_tmp"
    del j21.zip
)

:: Java 25
if not exist "%RUNTIME_DIR%\java25" (
    echo [+] Downloading Java 25...
    powershell -Command "Start-BitsTransfer -Source 'https://download.java.net/java/GA/jdk25/bd75d5f9689641da8e1daabeccb5528b/36/GPL/openjdk-25_windows-x64_bin.zip' -Destination 'j25.zip'"
    powershell -Command "Expand-Archive -Path 'j25.zip' -DestinationPath '%RUNTIME_DIR%\java25_tmp' -Force"
    powershell -Command "Move-Item -Path '%RUNTIME_DIR%\java25_tmp\jdk*' -Destination '%RUNTIME_DIR%\java25' -Force"
    rmdir /s /q "%RUNTIME_DIR%\java25_tmp"
    del j25.zip
)

:: SteamCMD
if not exist "%RUNTIME_DIR%\steamcmd" (
    echo [+] Downloading SteamCMD...
    mkdir "%RUNTIME_DIR%\steamcmd"
    powershell -Command "Start-BitsTransfer -Source 'https://steamcdn-a.akamaihd.net/client/installer/steamcmd.zip' -Destination 'steam.zip'"
    powershell -Command "Expand-Archive -Path 'steam.zip' -DestinationPath '%RUNTIME_DIR%\steamcmd' -Force"
    del steam.zip
)
echo [OK] Downloads complete.
echo.
echo ========================================
echo   RUNTIME VERIFICATION STATUS
echo ========================================

if exist "%RUNTIME_DIR%\java21\bin\java.exe" ( echo [INSTALLED] Java 21 ) else ( echo [ MISSING ] Java 21 )
if exist "%RUNTIME_DIR%\java25\bin\java.exe" ( echo [INSTALLED] Java 25 ) else ( echo [ MISSING ] Java 25 )
if exist "%RUNTIME_DIR%\steamcmd\steamcmd.exe" ( echo [INSTALLED] SteamCMD ) else ( echo [ MISSING ] SteamCMD )

echo ========================================
echo.

echo [3/4] Running Panel Magic...
php node_magic.php
php egg_transformer.php

echo [4/4] Installing Daemon...
cd daemon
call npm install
cd ..

echo ========================================
echo   SETUP COMPLETE!
echo ========================================
pause
