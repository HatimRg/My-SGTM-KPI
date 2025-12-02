# HSE KPI Tracker - WLAN Server Launcher (PowerShell)
# Run with: powershell -ExecutionPolicy Bypass -File "start-servers - WLAN.ps1"
# This script hosts the app over your local network (WLAN)

$Host.UI.RawUI.WindowTitle = "HSE KPI Tracker - WLAN Server"
$projectRoot = Split-Path -Parent $MyInvocation.MyCommand.Path

Write-Host ""
Write-Host "============================================" -ForegroundColor Cyan
Write-Host "   HSE KPI Tracker - WLAN Server" -ForegroundColor Cyan
Write-Host "============================================" -ForegroundColor Cyan
Write-Host ""

# Get WLAN IP Address
Write-Host "[1/5] Detecting WLAN IP Address..." -ForegroundColor Yellow
$wlanIP = (Get-NetIPAddress -AddressFamily IPv4 | Where-Object { 
    $_.InterfaceAlias -match "Wi-Fi|WLAN|Wireless" -and $_.IPAddress -notmatch "^169\." 
} | Select-Object -First 1).IPAddress

if (-not $wlanIP) {
    # Fallback: get any non-loopback IPv4
    $wlanIP = (Get-NetIPAddress -AddressFamily IPv4 | Where-Object { 
        $_.IPAddress -notmatch "^127\." -and $_.IPAddress -notmatch "^169\." 
    } | Select-Object -First 1).IPAddress
}

if (-not $wlanIP) {
    $wlanIP = "localhost"
    Write-Host "      Could not detect WLAN IP. Using localhost." -ForegroundColor Red
} else {
    Write-Host "      WLAN IP: $wlanIP" -ForegroundColor Green
}
Write-Host ""

# Step 2: Kill existing processes
Write-Host "[2/5] Closing existing servers..." -ForegroundColor Yellow
Get-Process -Name "node" -ErrorAction SilentlyContinue | Stop-Process -Force -ErrorAction SilentlyContinue
Get-Process -Name "php" -ErrorAction SilentlyContinue | Stop-Process -Force -ErrorAction SilentlyContinue
Write-Host "      Done." -ForegroundColor Green
Write-Host ""

Start-Sleep -Seconds 2

# Step 3: Start Backend Server (exposed on 0.0.0.0)
Write-Host "[3/5] Starting Laravel Backend Server (WLAN)..." -ForegroundColor Yellow
$backendPath = Join-Path $projectRoot "backend"
Start-Process -FilePath "cmd.exe" -ArgumentList "/k", "cd /d `"$backendPath`" && php artisan serve --host=0.0.0.0 --port=8000" -WindowStyle Normal
Write-Host "      Backend starting on http://${wlanIP}:8000" -ForegroundColor Green
Write-Host ""

Start-Sleep -Seconds 3

# Step 4: Start Frontend Server (exposed on 0.0.0.0)
Write-Host "[4/5] Starting Vite Frontend Server (WLAN)..." -ForegroundColor Yellow
$frontendPath = Join-Path $projectRoot "frontend"
Start-Process -FilePath "cmd.exe" -ArgumentList "/k", "cd /d `"$frontendPath`" && npm run dev -- --host 0.0.0.0" -WindowStyle Normal
Write-Host "      Frontend starting on http://${wlanIP}:5173" -ForegroundColor Green
Write-Host ""

Start-Sleep -Seconds 3

# Step 5: Open browser
Write-Host "[5/5] Opening browser..." -ForegroundColor Yellow
Start-Process "http://localhost:5173"
Start-Process "http://localhost/phpmyadmin5.2.3/index.php"
Write-Host ""

Write-Host "============================================" -ForegroundColor Green
Write-Host "   WLAN Servers Started Successfully!" -ForegroundColor Green
Write-Host "============================================" -ForegroundColor Green
Write-Host ""
Write-Host "   LOCAL ACCESS:" -ForegroundColor Yellow
Write-Host "   Frontend: " -NoNewline; Write-Host "http://localhost:5173" -ForegroundColor Cyan
Write-Host "   Backend:  " -NoNewline; Write-Host "http://localhost:8000" -ForegroundColor Cyan
Write-Host ""
Write-Host "   NETWORK ACCESS (for other devices):" -ForegroundColor Yellow
Write-Host "   Frontend: " -NoNewline; Write-Host "http://${wlanIP}:5173" -ForegroundColor Magenta
Write-Host "   Backend:  " -NoNewline; Write-Host "http://${wlanIP}:8000" -ForegroundColor Magenta
Write-Host ""
Write-Host "   Demo Credentials:" -ForegroundColor Yellow
Write-Host "   - Admin: admin@hse-kpi.com / password123"
Write-Host "   - User:  mohammed.alami@hse-kpi.com / password123"
Write-Host ""
Write-Host "   NOTE: Make sure Windows Firewall allows" -ForegroundColor DarkYellow
Write-Host "         connections on ports 5173 and 8000" -ForegroundColor DarkYellow
Write-Host ""
Write-Host "============================================" -ForegroundColor Cyan
Write-Host ""
Write-Host "Press any key to close this window..."
Write-Host "(Servers will keep running in their windows)"
$null = $Host.UI.RawUI.ReadKey("NoEcho,IncludeKeyDown")
