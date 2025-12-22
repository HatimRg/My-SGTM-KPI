@echo off
title HSE KPI Tracker - Status Check
color 0A
echo ========================================
echo    HSE KPI Tracker - Status Check
echo ========================================
echo.

echo [1] Checking server process...
netstat -ano | findstr :8000 | findstr LISTENING
echo.

echo [2] Testing local connection...
powershell -Command "try { $response = Invoke-WebRequest -Uri 'http://localhost:8000/' -UseBasicParsing -TimeoutSec 5; Write-Host 'Local: SUCCESS (Status:' $response.StatusCode ')' } catch { Write-Host 'Local: FAILED' }"
echo.

echo [3] Testing external connection (optional)...
if not "%EXTERNAL_URL%"=="" (
    powershell -Command "try { $response = Invoke-WebRequest -Uri '%EXTERNAL_URL%' -UseBasicParsing -TimeoutSec 5; Write-Host 'External: SUCCESS (Status:' $response.StatusCode ')' } catch { Write-Host 'External: FAILED' }"
) else (
    echo External: Skipped (set EXTERNAL_URL to enable)
)
echo.

echo [4] Checking Windows Service...
powershell -Command "try { $service = Get-Service -Name 'HSEKPITracker' -ErrorAction SilentlyContinue; Write-Host 'Service Status:' $service.Status } catch { Write-Host 'Service: Not installed' }"
echo.

echo [5] Checking startup shortcut...
set STARTUP_SHORTCUT=%APPDATA%\Microsoft\Windows\Start Menu\Programs\Startup\HSE-KPI-Tracker.lnk
if exist "%STARTUP_SHORTCUT%" (
    echo Startup: Shortcut exists
) else (
    echo Startup: No shortcut found
)
echo.

echo [6] Checking firewall rule...
netsh advfirewall firewall show rule name="HSE KPI Tracker" >nul 2>&1
if %ERRORLEVEL% EQU 0 (
    echo Firewall: Rule exists
) else (
    echo Firewall: No rule found
)
echo.

echo [7] Current connections to your server:
netstat -ano | findstr :8000 | findstr ESTABLISHED
echo.

echo ========================================
echo Server URLs:
echo   Local:    http://localhost:8000/
if not "%EXTERNAL_URL%"=="" echo   External: %EXTERNAL_URL%
echo ========================================
echo.

pause
