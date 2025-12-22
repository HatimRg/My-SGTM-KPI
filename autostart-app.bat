@echo off
title HSE KPI Tracker - Autostart
color 0A

echo ============================================
echo    HSE KPI Tracker - Autostart Service
echo ============================================
echo.

setlocal EnableExtensions EnableDelayedExpansion

set "ROOT=%~dp0"
if "%ROOT:~-1%"=="\" set "ROOT=%ROOT:~0,-1%"

set "BACKEND_DIR=%ROOT%\backend"
set "FRONTEND_DIR=%ROOT%\frontend"

if not exist "%BACKEND_DIR%\artisan" (
    echo [ERROR] Backend not found: "%BACKEND_DIR%"
    exit /b 1
)

if not exist "%FRONTEND_DIR%\package.json" (
    echo [ERROR] Frontend not found: "%FRONTEND_DIR%"
    exit /b 1
)

set "PHP_EXE=php"
if exist "C:\xampp\php\php.exe" set "PHP_EXE=C:\xampp\php\php.exe"

set "PORT=8000"
set "APP_URL=http://localhost:%PORT%"

if /I "%PHP_EXE%"=="php" (
    for /f "delims=" %%P in ('where php 2^>nul') do (
        set "PHP_EXE=%%P"
        goto :php_found
    )
)
:php_found
if /I "%PHP_EXE%"=="php" (
    echo [ERROR] PHP executable not found.
    echo         Install PHP or XAMPP (expected: C:\xampp\php\php.exe) or add php.exe to PATH.
    exit /b 1
)
if not exist "%PHP_EXE%" (
    echo [ERROR] PHP executable not found at: "%PHP_EXE%"
    exit /b 1
)

set "DO_BUILD=0"
if /I "%~1"=="--build" set "DO_BUILD=1"

:: If server is already running, do nothing (important for Task Scheduler monitor)
set "PORT_PID="
set "PORT_PROC="
for /f "tokens=5" %%p in ('netstat -ano ^| findstr ":%PORT%" ^| findstr "LISTENING"') do (
    set "PORT_PID=%%p"
)
if defined PORT_PID (
    for /f "tokens=1" %%n in ('tasklist /fi "PID eq !PORT_PID!" /nh 2^>nul') do (
        set "PORT_PROC=%%n"
    )
    if /I "!PORT_PROC!"=="php.exe" (
        echo Server already running on port %PORT% (php.exe). Exiting.
        exit /b 0
    )
    echo [ERROR] Port %PORT% is in use by PID !PORT_PID! (!PORT_PROC!).
    echo         Stop that process or change PORT in this script.
    exit /b 1
)

:: Build Frontend only if explicitly requested
if "%DO_BUILD%"=="1" (
    echo [2/3] Building Frontend for production...
    cd /d "%FRONTEND_DIR%"
    if not exist "node_modules" (
        call npm install
        if %ERRORLEVEL% NEQ 0 (
            echo [ERROR] npm install failed
            exit /b 1
        )
    )
    call npm run build
    if %ERRORLEVEL% NEQ 0 (
        echo [ERROR] npm run build failed
        exit /b 1
    )
    echo       Frontend build completed.
) else (
    echo [2/3] Skipping frontend build (pass --build to enable)
)
echo.

:: Start Backend Server
echo [3/3] Starting Laravel Backend Server...
start "Backend - Laravel" /MIN cmd /k "cd /d \"%BACKEND_DIR%\" && \"%PHP_EXE%\" artisan serve --host=0.0.0.0 --port=%PORT%"
echo       Backend started on %APP_URL%
echo.

echo ============================================
echo    Autostart completed!
echo ============================================
echo.
echo    App running at: %APP_URL%
echo.
echo    To stop: Close the 'Backend - Laravel' window
echo ============================================
timeout /t 5 /nobreak >nul
