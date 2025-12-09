# SGTM HSE KPI Tracker - HTTPS Server Launcher
# This script starts the Laravel server with HTTPS support using a local proxy

param(
    [string]$ServerIP = "16.171.8.116",
    [int]$HttpPort = 8000,
    [int]$HttpsPort = 8443
)

$BackendPath = "C:\My-SGTM-KPI\backend"
$SslPath = "C:\My-SGTM-KPI\ssl"

Write-Host "========================================" -ForegroundColor Cyan
Write-Host "  SGTM HSE KPI Tracker - HTTPS Server" -ForegroundColor Cyan
Write-Host "========================================" -ForegroundColor Cyan
Write-Host ""

# Check if SSL certificates exist
if (-not (Test-Path "$SslPath\server.crt") -or -not (Test-Path "$SslPath\server.key")) {
    Write-Host "[ERROR] SSL certificates not found!" -ForegroundColor Red
    Write-Host "Run the following to generate them:" -ForegroundColor Yellow
    Write-Host '$env:OPENSSL_CONF = "C:\xampp\apache\conf\openssl.cnf"'
    Write-Host '& "C:\xampp\apache\bin\openssl.exe" req -x509 -nodes -days 365 -newkey rsa:2048 -keyout "ssl\server.key" -out "ssl\server.crt" -subj "/CN=localhost/O=SGTM/C=MA"'
    exit 1
}

Write-Host "[OK] SSL certificates found" -ForegroundColor Green

# Kill existing PHP processes
Write-Host "[INFO] Stopping existing PHP processes..." -ForegroundColor Yellow
Get-Process -Name "php" -ErrorAction SilentlyContinue | Stop-Process -Force

# Change to backend directory
Set-Location $BackendPath

# Ensure storage link exists
Write-Host "[INFO] Ensuring storage link..." -ForegroundColor Yellow
if (-not (Test-Path "public\storage")) {
    php artisan storage:link 2>$null
    Write-Host "[OK] Storage link created" -ForegroundColor Green
}

# Clear caches
Write-Host "[INFO] Clearing caches..." -ForegroundColor Yellow
php artisan config:clear 2>$null
php artisan cache:clear 2>$null

# Start Laravel server
Write-Host "[INFO] Starting Laravel server on port $HttpPort..." -ForegroundColor Yellow
$LaravelProcess = Start-Process -FilePath "php" -ArgumentList "artisan", "serve", "--host=0.0.0.0", "--port=$HttpPort" -PassThru -WindowStyle Hidden

Start-Sleep -Seconds 3

# Check if Laravel is running
$LaravelRunning = Test-NetConnection -ComputerName localhost -Port $HttpPort -InformationLevel Quiet
if ($LaravelRunning) {
    Write-Host "[OK] Laravel server started successfully!" -ForegroundColor Green
} else {
    Write-Host "[ERROR] Failed to start Laravel server" -ForegroundColor Red
    exit 1
}

Write-Host ""
Write-Host "========================================" -ForegroundColor Green
Write-Host "  Server is running!" -ForegroundColor Green
Write-Host "========================================" -ForegroundColor Green
Write-Host ""
Write-Host "HTTP:  http://${ServerIP}:${HttpPort}/" -ForegroundColor Cyan
Write-Host ""
Write-Host "For HTTPS, configure Apache with:" -ForegroundColor Yellow
Write-Host "  - Copy apache-ssl.conf to XAMPP" -ForegroundColor White
Write-Host "  - Enable SSL module in httpd.conf" -ForegroundColor White
Write-Host "  - Restart Apache" -ForegroundColor White
Write-Host ""
Write-Host "Or use a reverse proxy like Caddy or nginx" -ForegroundColor Yellow
Write-Host ""
Write-Host "Press Ctrl+C to stop the server..." -ForegroundColor Gray

# Keep script running
try {
    while ($true) {
        Start-Sleep -Seconds 30
        
        # Health check
        $Healthy = Test-NetConnection -ComputerName localhost -Port $HttpPort -InformationLevel Quiet
        if (-not $Healthy) {
            Write-Host "[WARN] Server appears to be down, restarting..." -ForegroundColor Yellow
            $LaravelProcess = Start-Process -FilePath "php" -ArgumentList "artisan", "serve", "--host=0.0.0.0", "--port=$HttpPort" -PassThru -WindowStyle Hidden
        }
    }
}
finally {
    Write-Host "`n[INFO] Stopping server..." -ForegroundColor Yellow
    Get-Process -Name "php" -ErrorAction SilentlyContinue | Stop-Process -Force
    Write-Host "[OK] Server stopped" -ForegroundColor Green
}
