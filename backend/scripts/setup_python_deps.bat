@echo off
chcp 65001 >nul
echo ==========================================
echo QR System Python Dependencies Setup Tool
echo ==========================================
echo.

REM Check if Python is installed
python --version >nul 2>&1
if errorlevel 1 (
    echo [ERROR] Python is not installed or not in PATH
    echo Please install Python 3.8+ from https://python.org
    pause
    exit /b 1
)

echo [OK] Python detected:
python --version
echo.

REM Get the script directory
set "SCRIPT_DIR=%~dp0"
set "REQUIREMENTS=%SCRIPT_DIR%requirements.txt"

REM Check if requirements.txt exists
if not exist "%REQUIREMENTS%" (
    echo [ERROR] requirements.txt not found at: %REQUIREMENTS%
    pause
    exit /b 1
)

echo [INFO] Installing dependencies from requirements.txt...
echo.

REM Install/upgrade pip first
python -m pip install --upgrade pip

REM Install requirements
python -m pip install -r "%REQUIREMENTS%"

if errorlevel 1 (
    echo.
    echo [ERROR] Failed to install dependencies
    pause
    exit /b 1
)

echo.
echo ==========================================
echo [SUCCESS] All dependencies installed!
echo ==========================================
echo.
echo Installed packages:
python -m pip list | findstr -i "qrcode pillow pptx"
echo.
pause
