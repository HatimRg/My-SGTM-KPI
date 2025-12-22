@echo off
title HSE KPI Tracker - Server Launcher
color 0A

echo ============================================
echo    HSE KPI Tracker - Server Launcher
echo ============================================
echo.

setlocal EnableExtensions EnableDelayedExpansion

set "ROOT=%~dp0"
if "%ROOT:~-1%"=="\" set "ROOT=%ROOT:~0,-1%"

set "BACKEND_DIR=%ROOT%\backend"
set "FRONTEND_DIR=%ROOT%\frontend"

if not exist "%BACKEND_DIR%\artisan" (
    echo [ERROR] Backend not found: "%BACKEND_DIR%"
    pause
    exit /b 1
)

if not exist "%FRONTEND_DIR%\package.json" (
    echo [ERROR] Frontend not found: "%FRONTEND_DIR%"
    pause
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
    pause
    exit /b 1
)
if not exist "%PHP_EXE%" (
    echo [ERROR] PHP executable not found at: "%PHP_EXE%"
    pause
    exit /b 1
)

set "SKIP_BUILD=0"
if /I "%~1"=="--skip-build" set "SKIP_BUILD=1"

:: If already running, just open the browser
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
        echo Server already running on port %PORT%.
        echo Opening browser...
        start "" "%APP_URL%"
        set "ALREADY_RUNNING=1"
        goto :done
    )

    echo [ERROR] Port %PORT% is already in use by PID !PORT_PID! (!PORT_PROC!).
    echo         Stop that process or change the port in this script.
    pause
    exit /b 1
)

:: Build Frontend (served by Laravel)
if "%SKIP_BUILD%"=="1" (
    echo [1/3] Skipping frontend build (--skip-build)
) else (
    echo [1/3] Building Frontend for production...
    cd /d "%FRONTEND_DIR%"
    if not exist "node_modules" (
        echo Installing dependencies...
        call npm install
        if %ERRORLEVEL% NEQ 0 (
            echo [ERROR] npm install failed
            pause
            exit /b 1
        )
    ) else (
        echo Dependencies already installed, skipping npm install...
    )
    call npm run build
    if %ERRORLEVEL% NEQ 0 (
        echo [ERROR] npm run build failed
        pause
        exit /b 1
    )
    echo       Frontend build completed (served by Laravel on :8000)
)
echo.

:: Start Backend Server
echo [2/3] Starting Laravel Backend Server...
start "Backend - Laravel" cmd /k "cd /d \"%BACKEND_DIR%\" && \"%PHP_EXE%\" artisan serve --host=0.0.0.0 --port=%PORT%"
echo       Backend starting on %APP_URL%
echo.

:: Open browser
echo [3/3] Opening browser...
timeout /t 2 /nobreak >nul
start "" "%APP_URL%"

echo.
echo ============================================
echo    All servers started successfully!
echo ============================================
echo.
echo    App:     %APP_URL%
echo.
echo    Note: Login credentials removed for security
echo    Please use your own credentials to login
echo.
echo    Press any key to close this window...
echo    (Servers will keep running in their windows)
echo ============================================
pause >nul

:done

if defined ALREADY_RUNNING (
    echo.
    echo ============================================
    echo    Already running
    echo ============================================
    echo    App: %APP_URL%
    echo ============================================
    echo Press any key to close this window...
    pause
)
