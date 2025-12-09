@echo off
title HSE KPI Tracker - Load Test
color 0E
echo ========================================
echo    HSE KPI Tracker - Load Test
echo ========================================
echo.
echo This will simulate 30 concurrent users:
echo - 10 users checking data
echo - 10 users inserting data  
echo - 10 users editing data
echo.
echo Test duration: 60 seconds
echo Target: http://16.171.8.116:8000
echo.
echo Press Ctrl+C to cancel the test
echo.
pause

echo Starting load test...
echo.

powershell -ExecutionPolicy Bypass -File "load-test.ps1"

echo.
echo Load test completed!
echo.
pause
