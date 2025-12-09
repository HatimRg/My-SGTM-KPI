@echo off
title HSE KPI Tracker - Firewall Setup
color 0A
echo ========================================
echo    HSE KPI Tracker - Firewall Setup
echo ========================================
echo.

echo This script will create a firewall rule to allow port 8000
echo You need to run this as Administrator!
echo.

netsh advfirewall firewall delete rule name="HSE KPI Tracker" >nul 2>&1

echo Creating firewall rule for port 8000...
netsh advfirewall firewall add rule name="HSE KPI Tracker" dir=in action=allow protocol=TCP localport=8000 profile=any

if %ERRORLEVEL% EQU 0 (
    echo.
    echo [SUCCESS] Firewall rule created successfully!
    echo Port 8000 is now open for inbound connections.
) else (
    echo.
    echo [ERROR] Failed to create firewall rule.
    echo Please run this script as Administrator.
)

echo.
echo Testing connection after firewall setup...
powershell -Command "try { $response = Invoke-WebRequest -Uri 'http://16.171.8.116:8000/' -UseBasicParsing -TimeoutSec 5; Write-Host 'Connection test: SUCCESS (Status:' $response.StatusCode ')' } catch { Write-Host 'Connection test: FAILED -' $_.Exception.Message }"

echo.
pause
