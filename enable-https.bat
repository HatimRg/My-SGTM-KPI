@echo off
title SGTM HSE KPI - Enable HTTPS
color 0A

echo ========================================
echo   SGTM HSE KPI Tracker - HTTPS Setup
echo ========================================
echo.

:: Check if running as admin
net session >nul 2>&1
if %errorLevel% neq 0 (
    echo [ERROR] Please run this script as Administrator!
    echo Right-click and select "Run as administrator"
    pause
    exit /b 1
)

echo [1/4] Checking SSL certificates...
if not exist "C:\My-SGTM-KPI\ssl\server.crt" (
    echo [ERROR] SSL certificates not found!
    echo Please run the certificate generation first.
    pause
    exit /b 1
)
echo [OK] SSL certificates found

echo.
echo [2/4] Backing up Apache config...
copy "C:\xampp\apache\conf\httpd.conf" "C:\xampp\apache\conf\httpd.conf.backup" >nul 2>&1
echo [OK] Backup created

echo.
echo [3/4] Enabling SSL module in Apache...
powershell -Command "(Get-Content 'C:\xampp\apache\conf\httpd.conf') -replace '#LoadModule ssl_module', 'LoadModule ssl_module' | Set-Content 'C:\xampp\apache\conf\httpd.conf'"
powershell -Command "(Get-Content 'C:\xampp\apache\conf\httpd.conf') -replace '#Include conf/extra/httpd-ssl.conf', 'Include conf/extra/httpd-ssl.conf' | Set-Content 'C:\xampp\apache\conf\httpd.conf'"
echo [OK] SSL module enabled

echo.
echo [4/4] Copying SSL configuration...
copy "C:\My-SGTM-KPI\apache-ssl.conf" "C:\xampp\apache\conf\extra\httpd-sgtm-ssl.conf" >nul 2>&1

:: Add include to httpd.conf if not already there
findstr /C:"httpd-sgtm-ssl.conf" "C:\xampp\apache\conf\httpd.conf" >nul 2>&1
if %errorLevel% neq 0 (
    echo Include conf/extra/httpd-sgtm-ssl.conf >> "C:\xampp\apache\conf\httpd.conf"
)
echo [OK] SSL configuration copied

echo.
echo ========================================
echo   HTTPS Setup Complete!
echo ========================================
echo.
echo Next steps:
echo   1. Restart Apache from XAMPP Control Panel
echo   2. Access your app at: https://localhost/
echo   3. Accept the self-signed certificate warning
echo.
echo For production, replace with Let's Encrypt certificates.
echo See HTTPS_SETUP.md for details.
echo.
pause
