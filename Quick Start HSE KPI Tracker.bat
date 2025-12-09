@echo off
title HSE KPI Tracker - Quick Start
color 0A
echo ========================================
echo    HSE KPI Tracker - Quick Start
echo ========================================
echo.
echo Starting HSE KPI Tracker server...
echo Server will be available at: http://16.171.8.116:8000
echo.

cd /d "c:\My-SGTM-KPI\backend"

:: Kill any existing PHP processes
taskkill /F /IM php.exe >nul 2>&1

:: Start the server
echo Starting Laravel server...
start "HSE KPI Tracker" /MIN php artisan serve --host=0.0.0.0 --port=8000

:: Wait a moment for server to start
timeout /t 5 /nobreak >nul

:: Test if server is working
powershell -Command "try { $response = Invoke-WebRequest -Uri 'http://localhost:8000/' -UseBasicParsing -TimeoutSec 5; if ($response.StatusCode -eq 200) { Write-Host '[SUCCESS] Server is running!' -ForegroundColor Green; Write-Host 'Access your app at: http://16.171.8.116:8000' -ForegroundColor Cyan } else { Write-Host '[ERROR] Server failed to start properly' -ForegroundColor Red } } catch { Write-Host '[ERROR] Server failed to start' -ForegroundColor Red }"

echo.
echo Press any key to open the app in your browser...
pause >nul

start http://16.171.8.116:8000

echo.
echo Server is running in the background.
echo To stop the server, close the PHP window or run taskkill /F /IM php.exe
echo.
pause
