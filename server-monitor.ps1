# HSE KPI Tracker Server Monitor
# Runs every 5 minutes to check if server is running

param(
    [string]$ServerIP = "16.171.8.116",
    [int]$Port = 8000,
    [string]$LogPath = "c:\My-SGTM-KPI\server-monitor.log"
)

function Write-MonitorLog {
    param([string]$Message)
    $Timestamp = Get-Date -Format "yyyy-MM-dd HH:mm:ss"
    Add-Content -Path $LogPath -Value "[$Timestamp] $Message"
}

function Test-ServerHealth {
    try {
        $Response = Invoke-WebRequest -Uri "http://$ServerIP`:$Port/api" -UseBasicParsing -TimeoutSec 10
        if ($Response.StatusCode -eq 200) {
            return $true
        }
    }
    catch {
        return $false
    }
    return $false
}

function Start-Server {
    try {
        Write-MonitorLog "Starting HSE KPI Tracker server..."
        
        # Kill existing PHP processes
        Get-Process -Name "php" -ErrorAction SilentlyContinue | Stop-Process -Force
        
        # Start new server
        Set-Location "c:\My-SGTM-KPI\backend"
        Start-Process -FilePath "php" -ArgumentList "artisan", "serve", "--host=0.0.0.0", "--port=$Port" -WindowStyle Hidden
        
        # Wait for server to start
        Start-Sleep -Seconds 10
        
        if (Test-ServerHealth) {
            Write-MonitorLog "Server started successfully"
            return $true
        } else {
            Write-MonitorLog "Failed to start server"
            return $false
        }
    }
    catch {
        Write-MonitorLog "Error starting server: $($_.Exception.Message)"
        return $false
    }
}

# Main monitoring logic
if (Test-ServerHealth) {
    Write-MonitorLog "Server health check: OK"
} else {
    Write-MonitorLog "Server health check: FAILED - Restarting server"
    Start-Server
}
