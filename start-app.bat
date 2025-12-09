@echo off
title HSE KPI Tracker - IP Setup
color 0A
echo ========================================
echo    HSE KPI Tracker Server Setup
echo ========================================
echo.
echo Starting server on IP: 16.171.8.116:8000
echo.

cd /d "c:\My-SGTM-KPI\backend"

echo Stopping any existing PHP processes...
taskkill /F /IM php.exe >nul 2>&1

echo Starting Laravel server...
php artisan serve --host=0.0.0.0 --port=8000

echo.
echo Server stopped.
pause
