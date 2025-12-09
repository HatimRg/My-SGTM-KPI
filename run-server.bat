@echo off
title HSE KPI Tracker Server
color 0A
echo ========================================
echo    HSE KPI Tracker Server
echo ========================================
echo.
echo Server will run on: http://16.171.8.116:8000
echo Press Ctrl+C to stop the server
echo.

cd /d "c:\My-SGTM-KPI\backend"

echo Starting Laravel server...
php artisan serve --host=0.0.0.0 --port=8000

echo.
echo Server stopped.
pause
