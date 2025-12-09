# Install HSE KPI Tracker as Windows Service
# Requires administrator privileges

param(
    [string]$ServiceName = "HSEKPITracker",
    [string]$DisplayName = "HSE KPI Tracker Service",
    [string]$Description = "HSE KPI Tracker Web Application Server with Auto-Restart"
)

# Check if running as administrator
if (-NOT ([Security.Principal.WindowsPrincipal] [Security.Principal.WindowsIdentity]::GetCurrent()).IsInRole([Security.Principal.WindowsBuiltInRole] "Administrator")) {
    Write-Host "Please run this script as Administrator!" -ForegroundColor Red
    Write-Host "Right-click the script and select 'Run as Administrator'" -ForegroundColor Yellow
    pause
    exit 1
}

$ScriptPath = Join-Path $PSScriptRoot "server-launcher.ps1"
$ServicePath = "powershell.exe -ExecutionPolicy Bypass -File `"$ScriptPath`""

Write-Host "Installing HSE KPI Tracker as Windows Service..." -ForegroundColor Green

# Remove existing service if it exists
try {
    $ExistingService = Get-Service -Name $ServiceName -ErrorAction SilentlyContinue
    if ($ExistingService) {
        Write-Host "Removing existing service..." -ForegroundColor Yellow
        Stop-Service -Name $ServiceName -Force
        Remove-Service -Name $ServiceName
        Write-Host "Existing service removed." -ForegroundColor Green
    }
}
catch {
    Write-Host "Error removing existing service: $($_.Exception.Message)" -ForegroundColor Red
}

# Install new service
try {
    New-Service -Name $ServiceName -DisplayName $DisplayName -Description $Description -BinaryPathName $ServicePath -StartupType Automatic
    Write-Host "Service installed successfully!" -ForegroundColor Green
    
    # Start the service
    Start-Service -Name $ServiceName
    Write-Host "Service started!" -ForegroundColor Green
    
    Write-Host ""
    Write-Host "Service Management:" -ForegroundColor Cyan
    Write-Host "Start:   Start-Service $ServiceName" -ForegroundColor White
    Write-Host "Stop:    Stop-Service $ServiceName" -ForegroundColor White
    Write-Host "Status:  Get-Service $ServiceName" -ForegroundColor White
    Write-Host "Remove:  Remove-Service $ServiceName" -ForegroundColor White
    Write-Host ""
    Write-Host "Or manage via services.msc" -ForegroundColor Yellow
}
catch {
    Write-Host "Error installing service: $($_.Exception.Message)" -ForegroundColor Red
}

pause
