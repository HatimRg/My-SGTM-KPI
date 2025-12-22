@echo off
title HSE KPI Tracker - Cleanup Auto-Start
color 0C
echo ========================================
echo    HSE KPI Tracker - Cleanup Auto-Start
echo ========================================
echo.

echo This will remove all auto-start configurations
echo You need to run this as Administrator!
echo.

:: Check if running as administrator
net session >nul 2>&1
if %ERRORLEVEL% NEQ 0 (
    echo [ERROR] Please run this script as Administrator!
    pause
    exit /b 1
)

echo [1] Removing startup shortcut...
set STARTUP_FOLDER=%APPDATA%\Microsoft\Windows\Start Menu\Programs\Startup
set SHORTCUT_PATH=%STARTUP_FOLDER%\HSE-KPI-Tracker.lnk

if exist "%SHORTCUT_PATH%" (
    del "%SHORTCUT_PATH%"
    echo [SUCCESS] Startup shortcut removed
) else (
    echo [INFO] No startup shortcut found
)

echo.
echo [2] Removing Windows Service...
powershell -Command "try { $svc = Get-Service -Name 'HSEKPITracker' -ErrorAction SilentlyContinue; if ($svc) { Stop-Service -Name 'HSEKPITracker' -Force -ErrorAction SilentlyContinue; sc.exe delete HSEKPITracker | Out-Null; Write-Host '[SUCCESS] Windows Service removed' } else { Write-Host '[INFO] Windows Service not found or already removed' } } catch { Write-Host '[INFO] Windows Service not found or already removed' }"

echo.
echo [3] Removing monitoring task...
schtasks /delete /tn "HSE KPI Monitor" /f >nul 2>&1
if %ERRORLEVEL% EQU 0 (
    echo [SUCCESS] Monitoring task removed
) else (
    echo [INFO] No monitoring task found
)

echo.
echo [4] Removing firewall rule...
netsh advfirewall firewall delete rule name="HSE KPI Tracker" >nul 2>&1
if %ERRORLEVEL% EQU 0 (
    echo [SUCCESS] Firewall rule removed
) else (
    echo [INFO] No firewall rule found
)

echo.
echo [5] Stopping current server processes...
setlocal EnableExtensions EnableDelayedExpansion
set "PID="
for /f "tokens=5" %%p in ('netstat -ano ^| findstr ":8000" ^| findstr "LISTENING"') do set "PID=%%p"
if defined PID (
    taskkill /F /PID !PID! >nul 2>&1
    if !errorlevel! EQU 0 (
        echo [INFO] Stopped PID !PID! (port 8000)
    ) else (
        echo [INFO] Failed to stop PID !PID! (port 8000)
    )
) else (
    echo [INFO] No process listening on port 8000
)

echo.
echo ========================================
echo Cleanup Complete!
echo ========================================
echo.
echo All auto-start configurations have been removed.
echo Your HSE KPI Tracker will NOT start automatically on reboot.
echo.
echo To re-enable: Run setup-autostart.bat
echo.
pause
