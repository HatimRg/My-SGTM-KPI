@echo off
title HSE KPI Tracker - Auto-Start Setup
color 0A
echo ========================================
echo    HSE KPI Tracker - Auto-Start Setup
echo ========================================
echo.

echo This will set up HSE KPI Tracker to start automatically on Windows boot
echo You need to run this as Administrator!
echo.

:: Check if running as administrator
net session >nul 2>&1
if %ERRORLEVEL% NEQ 0 (
    echo [ERROR] Please run this script as Administrator!
    echo Right-click the script and select "Run as administrator"
    pause
    exit /b 1
)

echo [1] Setting up Windows Firewall rule...
netsh advfirewall firewall delete rule name="HSE KPI Tracker" >nul 2>&1
netsh advfirewall firewall add rule name="HSE KPI Tracker" dir=in action=allow protocol=TCP localport=8000 profile=any

if %ERRORLEVEL% EQU 0 (
    echo [SUCCESS] Firewall rule created
) else (
    echo [ERROR] Failed to create firewall rule
)

echo.
echo [2] Creating startup shortcut...
set STARTUP_FOLDER=%APPDATA%\Microsoft\Windows\Start Menu\Programs\Startup
set SHORTCUT_PATH=%STARTUP_FOLDER%\HSE-KPI-Tracker.lnk
set TARGET_PATH=%~dp0run-server.bat

echo Creating shortcut in startup folder...
echo Set WshShell = CreateObject("WScript.Shell") > "%TEMP%\CreateShortcut.vbs"
echo Set oShortcut = WshShell.CreateShortcut("%SHORTCUT_PATH%") >> "%TEMP%\CreateShortcut.vbs"
echo oShortcut.TargetPath = "%TARGET_PATH%" >> "%TEMP%\CreateShortcut.vbs"
echo oShortcut.WorkingDirectory = "%~dp0backend" >> "%TEMP%\CreateShortcut.vbs"
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
echo [3] Setting up Windows Service (optional)...
echo Installing as Windows Service for better reliability...
powershell -ExecutionPolicy Bypass -File "%~dp0install-service.ps1"

echo.
echo [4] Creating monitoring task scheduler...
echo Setting up task to restart server if it crashes...

schtasks /delete /tn "HSE KPI Monitor" /f >nul 2>&1

schtasks /create /tn "HSE KPI Monitor" /tr "powershell -ExecutionPolicy Bypass -File \"%~dp0server-monitor.ps1\"" /sc minute /mo 5 /ru "SYSTEM" /rl highest /f

if %ERRORLEVEL% EQU 0 (
    echo [SUCCESS] Monitoring task created (checks every 5 minutes)
) else (
    echo [ERROR] Failed to create monitoring task
)

echo.
echo ========================================
echo Auto-Start Setup Complete!
echo ========================================
echo.
echo Setup methods installed:
echo 1. [x] Firewall rule for port 8000
echo 2. [x] Startup folder shortcut
echo 3. [x] Windows Service (if successful)
echo 4. [x] Task Scheduler monitor
echo.
echo Your HSE KPI Tracker will now:
echo - Start automatically when Windows boots
echo - Restart automatically if it crashes
echo - Be accessible on http://16.171.8.116:8000
echo.
echo To test: Restart your computer and check if the app starts
echo.
echo To remove: Run cleanup-autostart.bat
echo.
pause
