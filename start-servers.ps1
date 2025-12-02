# HSE KPI Tracker - Server Launcher (PowerShell)
# Run with: powershell -ExecutionPolicy Bypass -File start-servers.ps1

$Host.UI.RawUI.WindowTitle = "HSE KPI Tracker - Server Launcher"
$projectRoot = Split-Path -Parent $MyInvocation.MyCommand.Path

Write-Host ""
Write-Host "============================================" -ForegroundColor Cyan
Write-Host "   HSE KPI Tracker - Server Launcher" -ForegroundColor Cyan
Write-Host "============================================" -ForegroundColor Cyan
Write-Host ""

# Step 1: Kill existing processes
Write-Host "[1/4] Closing existing servers..." -ForegroundColor Yellow
Get-Process -Name "node" -ErrorAction SilentlyContinue | Stop-Process -Force -ErrorAction SilentlyContinue
Get-Process -Name "php" -ErrorAction SilentlyContinue | Stop-Process -Force -ErrorAction SilentlyContinue
Write-Host "      Done." -ForegroundColor Green
Write-Host ""

Start-Sleep -Seconds 2

# Step 2: Start Backend Server
Write-Host "[2/4] Starting Laravel Backend Server..." -ForegroundColor Yellow
$backendPath = Join-Path $projectRoot "backend"
Start-Process -FilePath "cmd.exe" -ArgumentList "/k", "cd /d `"$backendPath`" && php artisan serve" -WindowStyle Normal
Write-Host "      Backend starting on http://localhost:8000" -ForegroundColor Green
Write-Host ""

Start-Sleep -Seconds 3

# Step 3: Start Frontend Server
Write-Host "[3/4] Starting Vite Frontend Server..." -ForegroundColor Yellow
$frontendPath = Join-Path $projectRoot "frontend"
Start-Process -FilePath "cmd.exe" -ArgumentList "/k", "cd /d `"$frontendPath`" && npm run dev" -WindowStyle Normal
Write-Host "      Frontend starting on http://localhost:5173" -ForegroundColor Green
Write-Host ""

Start-Sleep -Seconds 3

# Step 4: Open browser
Write-Host "[4/4] Opening browser..." -ForegroundColor Yellow
Start-Process "http://localhost:5173"
Write-Host ""

Write-Host "============================================" -ForegroundColor Green
Write-Host "   All servers started successfully!" -ForegroundColor Green
Write-Host "============================================" -ForegroundColor Green
Write-Host ""
Write-Host "   Frontend: " -NoNewline; Write-Host "http://localhost:5173" -ForegroundColor Cyan
Write-Host "   Backend:  " -NoNewline; Write-Host "http://localhost:8000" -ForegroundColor Cyan
Write-Host ""
Write-Host "   Demo Credentials:" -ForegroundColor Yellow
Write-Host "   - Admin: admin@hse-kpi.com / password123"
Write-Host "   - User:  mohammed.alami@hse-kpi.com / password123"
Write-Host ""
Write-Host "============================================" -ForegroundColor Cyan
Write-Host ""
Write-Host "Press any key to close this window..."
Write-Host "(Servers will keep running in their windows)"
$null = $Host.UI.RawUI.ReadKey("NoEcho,IncludeKeyDown")
