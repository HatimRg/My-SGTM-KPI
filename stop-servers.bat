@echo off
title HSE KPI Tracker - Stop Servers
color 0C

echo ============================================
echo    HSE KPI Tracker - Stopping Servers
echo ============================================
echo.

setlocal EnableExtensions EnableDelayedExpansion

set "PID="
for /f "tokens=5" %%p in ('netstat -ano ^| findstr ":5173" ^| findstr "LISTENING"') do set "PID=%%p"
echo Closing Vite (port 5173)...
if defined PID (
    taskkill /F /PID !PID! >nul 2>&1
    if !errorlevel! EQU 0 (
        echo   [OK] Stopped PID !PID!.
    ) else (
        echo   [--] Failed to stop PID !PID!.
    )
) else (
    echo   [--] No process listening on port 5173.
)

echo.
set "PID="
for /f "tokens=5" %%p in ('netstat -ano ^| findstr ":8000" ^| findstr "LISTENING"') do set "PID=%%p"
echo Closing Laravel (port 8000)...
if defined PID (
    taskkill /F /PID !PID! >nul 2>&1
    if !errorlevel! EQU 0 (
        echo   [OK] Stopped PID !PID!.
    ) else (
        echo   [--] Failed to stop PID !PID!.
    )
) else (
    echo   [--] No process listening on port 8000.
)

echo.
echo ============================================
echo    All servers stopped.
echo ============================================
echo.
pause
