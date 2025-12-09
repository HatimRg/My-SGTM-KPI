@echo off
title HSE KPI Tracker - Server Diagnostics
color 0E
echo ========================================
echo    HSE KPI Tracker Server Diagnostics
echo ========================================
echo.

echo [1] Checking if server is running...
netstat -ano | findstr :8000
echo.

echo [2] Testing local connection...
powershell -Command "try { $response = Invoke-WebRequest -Uri 'http://localhost:8000/' -UseBasicParsing -TimeoutSec 5; Write-Host 'Local: SUCCESS (Status:' $response.StatusCode ')' } catch { Write-Host 'Local: FAILED -' $_.Exception.Message }"
echo.

echo [3] Testing external IP connection...
powershell -Command "try { $response = Invoke-WebRequest -Uri 'http://16.171.8.116:8000/' -UseBasicParsing -TimeoutSec 5; Write-Host 'External IP: SUCCESS (Status:' $response.StatusCode ')' } catch { Write-Host 'External IP: FAILED -' $_.Exception.Message }"
echo.

echo [4] Checking firewall status for port 8000...
netsh advfirewall firewall show rule name="HSE KPI Tracker" >nul 2>&1
if %ERRORLEVEL% EQU 0 (
    echo Firewall rule exists
) else (
    echo No firewall rule found - this might be the issue!
)
echo.

echo [5] Server URLs:
echo   Local:    http://localhost:8000/
echo   External: http://16.171.8.116:8000/
echo   API:      http://16.171.8.116:8000/api
echo.

echo [6] Recommendations:
echo   - If external IP test failed, check Windows Firewall
echo   - Try clearing browser cache (Ctrl+F5)
echo   - Check if port 8000 is open in your network
echo   - Run this script as Administrator if needed
echo.

pause
