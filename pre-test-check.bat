@echo off
title HSE KPI Tracker - Pre-Test Check
color 0A
echo ========================================
echo    HSE KPI Tracker - Pre-Test Check
echo ========================================
echo.

echo [1] Checking if server is running...
netstat -ano | findstr :8000 | findstr LISTENING >nul
if %ERRORLEVEL% EQU 0 (
    echo [OK] Server is listening on port 8000
) else (
    echo [ERROR] Server is not running on port 8000
    echo Please start the server first using run-server.bat
    pause
    exit /b 1
)

echo.
echo [2] Testing API endpoint...
powershell -Command "try { $response = Invoke-WebRequest -Uri 'http://16.171.8.116:8000/api' -UseBasicParsing -TimeoutSec 10; if ($response.StatusCode -eq 200) { Write-Host '[OK] API endpoint is accessible' } else { Write-Host '[ERROR] API returned status:' $response.StatusCode; exit 1 } } catch { Write-Host '[ERROR] API not accessible:' $_.Exception.Message; exit 1 }"

if %ERRORLEVEL% NEQ 0 (
    echo.
    echo API endpoint is not accessible. Please check:
    echo 1. Server is running
    echo 2. Firewall allows port 8000
    echo 3. Network connectivity
    pause
    exit /b 1
)

echo.
echo [3] Testing login...
powershell -Command "try { $body = @{email='admin@test.com';password='password123'} | ConvertTo-Json; $response = Invoke-WebRequest -Uri 'http://16.171.8.116:8000/api/auth/login' -Method POST -Body $body -ContentType 'application/json' -UseBasicParsing -TimeoutSec 10; if ($response.StatusCode -eq 200) { Write-Host '[OK] Login is working' } else { Write-Host '[ERROR] Login failed with status:' $response.StatusCode; exit 1 } } catch { Write-Host '[ERROR] Login failed:' $_.Exception.Message; exit 1 }"

if %ERRORLEVEL% NEQ 0 (
    echo.
    echo Login is not working. Please check:
    echo 1. Database connection
    echo 2. User accounts exist
    echo 3. Laravel configuration
    pause
    exit /b 1
)

echo.
echo [4] Checking database connection...
powershell -Command "try { $response = Invoke-WebRequest -Uri 'http://16.171.8.116:8000/api/projects' -UseBasicParsing -TimeoutSec 10; if ($response.StatusCode -eq 200) { Write-Host '[OK] Database connection is working' } else { Write-Host '[ERROR] Database query failed with status:' $response.StatusCode; exit 1 } } catch { Write-Host '[ERROR] Database connection failed:' $_.Exception.Message; exit 1 }"

if %ERRORLEVEL% NEQ 0 (
    echo.
    echo Database connection is not working. Please check:
    echo 1. MySQL server is running
    echo 2. Database credentials in .env
    echo 3. Database exists
    pause
    exit /b 1
)

echo.
echo ========================================
echo All checks passed! Ready for load test.
echo ========================================
echo.
echo Server is healthy and ready for testing.
echo.
echo Press any key to start the load test...
pause >nul

echo.
echo Starting load test...
call run-load-test.bat
