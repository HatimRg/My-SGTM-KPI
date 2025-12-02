@echo off
title HSE KPI Tracker - Server Launcher
color 0A

echo ============================================
echo    HSE KPI Tracker - Server Launcher
echo ============================================
echo.

:: Kill existing processes
echo [1/4] Closing existing servers...
taskkill /F /IM node.exe >nul 2>&1
taskkill /F /IM php.exe >nul 2>&1
echo       Done.
echo.

:: Wait a moment for processes to fully close
timeout /t 2 /nobreak >nul

:: Start Backend Server
echo [2/4] Starting Laravel Backend Server...
start "Backend - Laravel" cmd /k "cd /d %~dp0backend && php artisan serve"
echo       Backend starting on http://localhost:8000
echo.

:: Wait for backend to initialize
timeout /t 3 /nobreak >nul

:: Start Frontend Server
echo [3/4] Starting Vite Frontend Server...
start "Frontend - Vite" cmd /k "cd /d %~dp0frontend && npm run dev"
echo       Frontend starting on http://localhost:5173
echo.

:: Wait for frontend to initialize
timeout /t 3 /nobreak >nul

:: Open browser
echo [4/4] Opening browser...
timeout /t 2 /nobreak >nul
start http://localhost:5173
start http://localhost/phpmyadmin5.2.3/index.php

echo.
echo ============================================
echo    All servers started successfully!
echo ============================================
echo.
echo    Frontend: http://localhost:5173
echo    Backend:  http://localhost:8000
echo.
echo    Demo Credentials:
echo    - Admin: admin@hse-kpi.com / password123
echo    - User:  mohammed.alami@hse-kpi.com / password123
echo.
echo    Press any key to close this window...
echo    (Servers will keep running in their windows)
echo ============================================
pause >nul
