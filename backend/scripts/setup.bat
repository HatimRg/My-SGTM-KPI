@echo off
chcp 65001 >nul
echo ==========================================
echo QR System Setup Tool
echo Python Dependencies + LibreOffice
echo ==========================================
echo.

REM Get the script directory
set "SCRIPT_DIR=%~dp0"
set "REQUIREMENTS=%SCRIPT_DIR%requirements.txt"

REM ==========================================
REM Check Python
REM ==========================================
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

REM ==========================================
REM Install Python Dependencies
REM ==========================================
if not exist "%REQUIREMENTS%" (
    echo [ERROR] requirements.txt not found at: %REQUIREMENTS%"
    pause
    exit /b 1
)

echo [INFO] Installing Python dependencies...
python -m pip install --upgrade pip >nul
python -m pip install -r "%REQUIREMENTS%"
if errorlevel 1 (
    echo [ERROR] Failed to install Python dependencies
    pause
    exit /b 1
)
echo [OK] Python dependencies installed
echo.

REM ==========================================
REM Check / Download LibreOffice
REM ==========================================
echo [INFO] Checking for LibreOffice...

REM Check common paths
set "SOFFICE_FOUND=0"
set "SOFFICE_PATH=""

if exist "C:\Program Files\LibreOffice\program\soffice.exe" (
    set "SOFFICE_FOUND=1"
    set "SOFFICE_PATH=C:\Program Files\LibreOffice\program\soffice.exe"
)
if exist "C:\Program Files (x86)\LibreOffice\program\soffice.exe" (
    set "SOFFICE_FOUND=1"
    set "SOFFICE_PATH=C:\Program Files (x86)\LibreOffice\program\soffice.exe"
)

REM Check PATH
where soffice >nul 2>&1
if not errorlevel 1 (
    set "SOFFICE_FOUND=1"
    for /f "delims=" %%i in ('where soffice') do set "SOFFICE_PATH=%%i"
)

if "%SOFFICE_FOUND%"=="1" (
    echo [OK] LibreOffice found at: %SOFFICE_PATH%
    goto :LIBREOFFICE_DONE
)

echo [WARNING] LibreOffice not found
echo.
echo Would you like to download and install LibreOffice? (Required for PDF generation)
echo [1] Yes - Download and install (recommended)
echo [2] No - Skip (you'll need to install manually)
echo.
set /p choice="Enter choice (1 or 2): "

if "%choice%"=="1" (
    echo.
    echo [INFO] Downloading LibreOffice...
    echo This may take a few minutes depending on your connection.
    echo.
    
    REM Create download directory
    set "DOWNLOAD_DIR=%SCRIPT_DIR%downloads"
    if not exist "%DOWNLOAD_DIR%" mkdir "%DOWNLOAD_DIR%"
    
    REM LibreOffice 24.2.7 portable (Windows x64) - smaller download
    set "LIBO_URL=https://download.documentfoundation.org/libreoffice/stable/24.2.7/win/x86_64/LibreOffice_24.2.7_Win_x86-64.msi"
    set "LIBO_FILE=%DOWNLOAD_DIR%\LibreOffice_24.2.7_Win_x86-64.msi"
    
    echo Downloading from: %LIBO_URL%
    echo Saving to: %LIBO_FILE%
    echo.
    
    REM Use PowerShell to download
    powershell -Command "& {$ProgressPreference='SilentlyContinue'; Invoke-WebRequest -Uri '%LIBO_URL%' -OutFile '%LIBO_FILE%'}"
    
    if not exist "%LIBO_FILE%" (
        echo [ERROR] Download failed
        echo Please download manually from: https://www.libreoffice.org/download/download/
        pause
        goto :LIBREOFFICE_DONE
    )
    
    echo [OK] Download complete
    echo.
    echo [INFO] Installing LibreOffice...
    echo This will take a few minutes...
    echo.
    
    REM Install silently
    msiexec /i "%LIBO_FILE%" /qn /norestart
    
    if errorlevel 1 (
        echo [ERROR] Installation failed (may require admin privileges)
        echo Please run this script as Administrator or install manually
        pause
    ) else (
        echo [OK] LibreOffice installed successfully!
    )
) else (
    echo [INFO] Skipping LibreOffice installation
    echo Note: PDF generation will not work without LibreOffice
    echo Download manually from: https://www.libreoffice.org/download/download/
)

:LIBREOFFICE_DONE
echo.

REM ==========================================
REM Final Status
REM ==========================================
echo ==========================================
echo Setup Complete!
echo ==========================================
echo.
echo Python packages installed:
python -m pip list | findstr -i "qrcode pillow pptx"
echo.

REM Check soffice again
where soffice >nul 2>&1
if not errorlevel 1 (
    echo LibreOffice: [OK] Installed and available
    where soffice
) else (
    echo LibreOffice: [NOT FOUND] - Install manually for PDF generation
)

echo.
echo Environment variable to set (optional):
echo set SDS_LIBREOFFICE_BIN=path\to\soffice.exe
echo.
pause
