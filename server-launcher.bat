@echo off
title HSE KPI Tracker Server Launcher
color 0A
echo ========================================
echo    HSE KPI Tracker Auto Launcher
echo ========================================
echo.

:: Configuration
set LARAVEL_PORT=8000
set APACHE_PORT=80
set MAX_RETRIES=5
set RETRY_DELAY=10
set HEALTH_CHECK_DELAY=5

:: Log file
set LOG_FILE=server-launcher.log

echo [%date% %time%] Starting HSE KPI Tracker Server Launcher >> %LOG_FILE%

:: Function to check if service is running
:check_service
setlocal
set SERVICE_NAME=%1
set PORT=%2

netstat -ano | findstr ":%与服务器的连接" 侦听" 
if %ERRORLEVEL% EQU 0 (
    echo [OK] %SERVICE_NAME% is running on port %PORT%
    echo [%date% %time%] [OK] %SERVICE_NAME% is running on port %PORT% >> %LOG_FILE%
    exit /b 0
) else (
    echo [FAIL] %SERVICE_NAME% is not running on port %PORT%
    echo [%date% %time%] [FAIL] %SERVICE_NAME% is not running on port %PORT% >> %LOG_FILE%
    exit /b 1
)

:: Function to start Laravel server
:start_laravel
echo.
echo ========================================
echo Starting Laravel Server...
echo ========================================
echo [%date% %time%] Starting Laravel Server... >> %LOG_FILE%

cd /d "c:\My-SGTM-KPI\backend"

:: Kill existing Laravel processes
taskkill /F /IM php.exe >nul 2>&1

:: Ensure storage link exists for public file access (SOR images, etc.)
echo Ensuring storage link exists...
echo [%date% %time%] Ensuring storage link exists... >> %LOG_FILE%
if not exist "public\storage" (
    php artisan storage:link
    echo [OK] Storage link created
    echo [%date% %time%] [OK] Storage link created >> %LOG_FILE%
) else (
    echo [INFO] Storage link already exists
    echo [%date% %time%] [INFO] Storage link already exists >> %LOG_FILE%
)

:: Start Laravel server
start "Laravel Server" /MIN php artisan serve --host=0.0.0.0 --port=%LARAVEL_PORT%

:: Wait for Laravel to start
timeout /t %HEALTH_CHECK_DELAY% /nobreak >nul

:: Check if Laravel is running
call :check_service "Laravel" %LARAVEL_PORT%
if %ERRORLEVEL% EQU 0 (
    echo Laravel Server started successfully!
    echo [%date% %time%] Laravel Server started successfully! >> %LOG_FILE%
    goto :start_apache
) else (
    echo Failed to start Laravel Server. Retrying...
    echo [%date% %time%] Failed to start Laravel Server. Retrying... >> %LOG_FILE%
    timeout /t %RETRY_DELAY% /nobreak >nul
    goto :start_laravel
)

:: Function to start Apache server
:start_apache
echo.
echo ========================================
echo Starting Apache Server...
echo ========================================
echo [%date% %time%] Starting Apache Server... >> %LOG_FILE%

:: Kill existing Apache processes
taskkill /F /IM httpd.exe >nul 2>&1

:: Start Apache server
start "Apache Server" /MIN C:\xampp\apache\bin\httpd.exe

:: Wait for Apache to start
timeout /t %HEALTH_CHECK_DELAY% /nobreak >nul

:: Check if Apache is running
call :check_service "Apache" %APACHE_PORT%
if %ERRORLEVEL% EQU 0 (
    echo Apache Server started successfully!
    echo [%date% %time%] Apache Server started successfully! >> %LOG_FILE%
    goto :health_check
) else (
    echo Failed to start Apache Server. Retrying...
    echo [%date% %time%] Failed to start Apache Server. Retrying... >> %LOG_FILE%
    timeout /t %RETRY_DELAY% /nobreak >nul
    goto :start_apache
)

:: Function to perform health checks
:health_check
echo.
echo ========================================
echo Performing Health Checks...
echo ========================================
echo [%date% %time%] Performing Health Checks... >> %LOG_FILE%

:: Check Laravel API health
echo Checking Laravel API health...
powershell -Command "try { $response = Invoke-WebRequest -Uri 'http://localhost:%LARAVEL_PORT%/api' -UseBasicParsing -TimeoutSec 10; if ($response.StatusCode -eq 200) { Write-Host '[OK] Laravel API is healthy'; echo [%date% %time%] [OK] Laravel API is healthy >> %LOG_FILE% } else { Write-Host '[FAIL] Laravel API returned status code:' $response.StatusCode; echo [%date% %time%] [FAIL] Laravel API returned status code: $response.StatusCode >> %LOG_FILE%; exit 1 } } catch { Write-Host '[FAIL] Laravel API health check failed:' $_.Exception.Message; echo [%date% %time%] [FAIL] Laravel API health check failed: $_.Exception.Message >> %LOG_FILE%; exit 1 }"

if %ERRORLEVEL% NEQ 0 (
    echo Laravel API health check failed. Restarting services...
    echo [%date% %time%] Laravel API health check failed. Restarting services... >> %LOG_FILE%
    goto :start_laravel
)

:: Check Frontend health
echo Checking Frontend health...
powershell -Command "try { $response = Invoke-WebRequest -Uri 'http://localhost:%LARAVEL_PORT%/' -UseBasicParsing -TimeoutSec 10; if ($response.StatusCode -eq 200) { Write-Host '[OK] Frontend is healthy'; echo [%date% %time%] [OK] Frontend is healthy >> %LOG_FILE% } else { Write-Host '[FAIL] Frontend returned status code:' $response.StatusCode; echo [%date% %time%] [FAIL] Frontend returned status code: $response.StatusCode >> %LOG_FILE%; exit 1 } } catch { Write-Host '[FAIL] Frontend health check failed:' $_.Exception.Message; echo [%date% %time%] [FAIL] Frontend health check failed: $_.Exception.Message >> %LOG_FILE%; exit 1 }"

if %ERRORLEVEL% NEQ 0 (
    echo Frontend health check failed. Restarting services...
    echo [%date% %time%] Frontend health check failed. Restarting services... >> %LOG_FILE%
    goto :start_laravel
)

:: Check Apache health (if needed)
echo Checking Apache health...
powershell -Command "try { $response = Invoke-WebRequest -Uri 'http://localhost:%APACHE_PORT%/' -UseBasicParsing -TimeoutSec 10; if ($response.StatusCode -eq 200) { Write-Host '[OK] Apache is healthy'; echo [%date% %time%] [OK] Apache is healthy >> %LOG_FILE% } else { Write-Host '[WARN] Apache returned status code:' $response.StatusCode; echo [%date% %time%] [WARN] Apache returned status code: $response.StatusCode >> %LOG_FILE% } } catch { Write-Host '[WARN] Apache health check failed:' $_.Exception.Message; echo [%date% %time%] [WARN] Apache health check failed: $_.Exception.Message >> %LOG_FILE% }"

echo.
echo ========================================
echo Server Status: HEALTHY
echo ========================================
echo Laravel API: http://localhost:%LARAVEL_PORT%/api
echo Frontend: http://localhost:%LARAVEL_PORT%/
echo Apache: http://localhost:%APACHE_PORT%/
echo Public: http://16.171.8.116:%LARAVEL_PORT%/
echo.
echo [%date% %time%] Server Status: HEALTHY >> %LOG_FILE%
echo [%date% %time%] Laravel API: http://localhost:%LARAVEL_PORT%/api >> %LOG_FILE%
echo [%date% %time%] Frontend: http://localhost:%LARAVEL_PORT%/ >> %LOG_FILE%
echo [%date% %time%] Apache: http://localhost:%APACHE_PORT%/ >> %LOG_FILE%
echo [%date% %time%] Public: http://16.171.8.116:%LARAVEL_PORT%/ >> %LOG_FILE%

:: Monitoring loop
:monitor
echo.
echo Monitoring server health... (Press Ctrl+C to stop)
echo [%date% %time%] Monitoring server health... >> %LOG_FILE%

timeout /t 30 /nobreak >nul

:: Check Laravel API
powershell -Command "try { $response = Invoke-WebRequest -Uri 'http://localhost:%LARAVEL_PORT%/api' -UseBasicParsing -TimeoutSec 5; if ($response.StatusCode -ne 200) { exit 1 } } catch { exit 1 }"

if %ERRORLEVEL% NEQ 0 (
    echo.
    echo ========================================
    echo ALERT: Laravel API is down! Restarting...
    echo ========================================
    echo [%date% %time%] ALERT: Laravel API is down! Restarting... >> %LOG_FILE%
    goto :start_laravel
)

:: Check Frontend
powershell -Command "try { $response = Invoke-WebRequest -Uri 'http://localhost:%LARAVEL_PORT%/' -UseBasicParsing -TimeoutSec 5; if ($response.StatusCode -ne 200) { exit 1 } } catch { exit 1 }"

if %ERRORLEVEL% NEQ 0 (
    echo.
    echo ========================================
    echo ALERT: Frontend is down! Restarting...
    echo ========================================
    echo [%date% %time%] ALERT: Frontend is down! Restarting... >> %LOG_FILE%
    goto :start_laravel
)

goto :monitor

:: Cleanup on exit
:cleanup
echo.
echo ========================================
echo Server Launcher Stopped
echo ========================================
echo [%date% %time%] Server Launcher Stopped >> %LOG_FILE%
pause
exit /b 0
