@echo off
title HSE KPI Tracker - Stop Servers
color 0C

echo ============================================
echo    HSE KPI Tracker - Stopping Servers
echo ============================================
echo.

echo Closing Node.js processes (Vite/npm)...
taskkill /F /IM node.exe >nul 2>&1
if %errorlevel%==0 (
    echo   [OK] Node processes stopped.
) else (
    echo   [--] No Node processes found.
)

echo.
echo Closing PHP processes (Laravel)...
taskkill /F /IM php.exe >nul 2>&1
if %errorlevel%==0 (
    echo   [OK] PHP processes stopped.
) else (
    echo   [--] No PHP processes found.
)

echo.
echo ============================================
echo    All servers stopped.
echo ============================================
echo.
pause
