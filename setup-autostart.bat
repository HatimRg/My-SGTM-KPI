@echo off
title HSE KPI Tracker - Auto-Start Setup
color 0A
echo ========================================
echo    HSE KPI Tracker - Auto-Start Setup
echo ========================================
echo.

echo This will set up HSE KPI Tracker to start automatically on Windows boot.
echo.
echo Options:
echo   --firewall   Add Windows Firewall rule for port 8000 (requires admin)
echo   --service    Install Windows Service (requires admin)
echo   --monitor    Create Task Scheduler monitor (requires admin)
echo.

set "DO_FIREWALL=0"
set "DO_SERVICE=0"
set "DO_MONITOR=0"
if /I "%~1"=="--firewall" set "DO_FIREWALL=1"
if /I "%~1"=="--service" set "DO_SERVICE=1"
if /I "%~1"=="--monitor" set "DO_MONITOR=1"
if /I "%~2"=="--firewall" set "DO_FIREWALL=1"
if /I "%~2"=="--service" set "DO_SERVICE=1"
if /I "%~2"=="--monitor" set "DO_MONITOR=1"
if /I "%~3"=="--firewall" set "DO_FIREWALL=1"
if /I "%~3"=="--service" set "DO_SERVICE=1"
if /I "%~3"=="--monitor" set "DO_MONITOR=1"

set "IS_ADMIN=0"
net session >nul 2>&1
if %ERRORLEVEL% EQU 0 set "IS_ADMIN=1"

echo [1] Creating startup shortcut...
set STARTUP_FOLDER=%APPDATA%\Microsoft\Windows\Start Menu\Programs\Startup
set SHORTCUT_PATH=%STARTUP_FOLDER%\HSE-KPI-Tracker.lnk
set TARGET_PATH=%~dp0autostart-app.bat

if not exist "%TARGET_PATH%" (
    echo [ERROR] Missing "%TARGET_PATH%"
    pause
    exit /b 1
)

echo Creating shortcut in startup folder...
echo Set WshShell = CreateObject("WScript.Shell") > "%TEMP%\CreateShortcut.vbs"
echo Set oShortcut = WshShell.CreateShortcut("%SHORTCUT_PATH%") >> "%TEMP%\CreateShortcut.vbs"
echo oShortcut.TargetPath = "%TARGET_PATH%" >> "%TEMP%\CreateShortcut.vbs"
echo oShortcut.WorkingDirectory = "%~dp0" >> "%TEMP%\CreateShortcut.vbs"
echo oShortcut.Description = "HSE KPI Tracker Server" >> "%TEMP%\CreateShortcut.vbs"
echo oShortcut.Save >> "%TEMP%\CreateShortcut.vbs"

cscript //nologo "%TEMP%\CreateShortcut.vbs"
del "%TEMP%\CreateShortcut.vbs"

if exist "%SHORTCUT_PATH%" (
    echo [SUCCESS] Startup shortcut created
) else (
    echo [ERROR] Failed to create startup shortcut
)

echo.
if "%DO_FIREWALL%"=="1" (
    echo [2] Setting up Windows Firewall rule...
    if "%IS_ADMIN%"=="0" (
        echo [SKIP] Firewall requires admin. Re-run as Administrator.
    ) else (
        netsh advfirewall firewall delete rule name="HSE KPI Tracker" >nul 2>&1
        netsh advfirewall firewall add rule name="HSE KPI Tracker" dir=in action=allow protocol=TCP localport=8000 profile=any
        if %ERRORLEVEL% EQU 0 (
            echo [SUCCESS] Firewall rule created
        ) else (
            echo [ERROR] Failed to create firewall rule
        )
    )
    echo.
)

if "%DO_SERVICE%"=="1" (
    echo [3] Installing Windows Service...
    if "%IS_ADMIN%"=="0" (
        echo [SKIP] Service install requires admin. Re-run as Administrator.
    ) else if not exist "%~dp0install-service.ps1" (
        echo [SKIP] Missing install-service.ps1
    ) else (
        powershell -ExecutionPolicy Bypass -File "%~dp0install-service.ps1"
    )
    echo.
)

if "%DO_MONITOR%"=="1" (
    echo [4] Creating monitoring task scheduler...
    if "%IS_ADMIN%"=="0" (
        echo [SKIP] Task Scheduler creation requires admin. Re-run as Administrator.
    ) else (
        schtasks /delete /tn "HSE KPI Monitor" /f >nul 2>&1
        schtasks /create /tn "HSE KPI Monitor" /tr "cmd.exe /c \"\"%~dp0autostart-app.bat\"\"" /sc minute /mo 5 /ru "SYSTEM" /rl highest /f
        if %ERRORLEVEL% EQU 0 (
            echo [SUCCESS] Monitoring task created (checks every 5 minutes)
        ) else (
            echo [ERROR] Failed to create monitoring task
        )
    )
    echo.
)

echo.
echo ========================================
echo Auto-Start Setup Complete!
echo ========================================
echo.
echo Setup methods installed:
echo 1. [x] Startup folder shortcut (autostart-app.bat)
if "%DO_FIREWALL%"=="1" echo 2. [x] Firewall rule for port 8000
if "%DO_SERVICE%"=="1" echo 3. [x] Windows Service (uses autostart-app.bat)
if "%DO_MONITOR%"=="1" echo 4. [x] Task Scheduler monitor (monitors autostart-app.bat)
echo.
echo Your HSE KPI Tracker will now:
echo - Start automatically when Windows boots
echo - Start automatically if it crashes
echo.
echo To test: Restart your computer and check if the app starts.
echo.
echo To remove: Run cleanup-autostart.bat
echo.
echo Note: Login credentials removed for security
echo       Please use your own credentials to login
echo.
pause
