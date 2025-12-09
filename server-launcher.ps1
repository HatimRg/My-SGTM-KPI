# HSE KPI Tracker Server Launcher
# Auto-restart and monitoring script

param(
    [string]$ServerIP = "16.171.8.116",
    [int]$LaravelPort = 8000,
    [int]$ApachePort = 80,
    [int]$MaxRetries = 5,
    [int]$RetryDelay = 10,
    [int]$HealthCheckDelay = 5,
    [int]$MonitorInterval = 30
)

# Configuration
$LogFile = "server-launcher.log"
$BackendPath = "c:\My-SGTM-KPI\backend"
$ApachePath = "C:\xampp\apache\bin\httpd.exe"

# Colors for console output
$Colors = @{
    'Green' = 'Green'
    'Red' = 'Red'
    'Yellow' = 'Yellow'
    'Cyan' = 'Cyan'
    'White' = 'White'
}

function Write-Log {
    param([string]$Message, [string]$Level = 'INFO')
    $Timestamp = Get-Date -Format "yyyy-MM-dd HH:mm:ss"
    $LogMessage = "[$Timestamp] [$Level] $Message"
    Add-Content -Path $LogFile -Value $LogMessage
    
    $Color = switch ($Level) {
        'INFO' { $Colors.White }
        'OK' { $Colors.Green }
        'WARN' { $Colors.Yellow }
        'ERROR' { $Colors.Red }
        default { $Colors.White }
    }
    
    Write-Host $Message -ForegroundColor $Color
}

function Test-Port {
    param([int]$Port)
    try {
        $Connection = Test-NetConnection -ComputerName localhost -Port $Port -InformationLevel Quiet
        return $Connection
    }
    catch {
        return $false
    }
}

function Stop-Service {
    param([string]$ProcessName)
    try {
        $Processes = Get-Process -Name $ProcessName -ErrorAction SilentlyContinue
        if ($Processes) {
            $Processes | Stop-Process -Force
            Write-Log "Stopped existing $ProcessName processes" 'INFO'
        }
    }
    catch {
        Write-Log "Error stopping $ProcessName : $($_.Exception.Message)" 'ERROR'
    }
}

function Start-LaravelServer {
    Write-Log "Starting Laravel Server on port $LaravelPort..." 'INFO'
    
    # Stop existing Laravel processes
    Stop-Service -ProcessName "php"
    
    # Change to backend directory
    Set-Location $BackendPath
    
    # Ensure storage link exists for public file access
    Write-Log "Ensuring storage link exists..." 'INFO'
    $StorageLinkPath = Join-Path $BackendPath "public\storage"
    if (-not (Test-Path $StorageLinkPath)) {
        Start-Process -FilePath "php" -ArgumentList "artisan", "storage:link" -Wait -NoNewWindow
        Write-Log "Storage link created" 'OK'
    } else {
        # Check if it's a proper symlink, if not recreate it
        $Item = Get-Item $StorageLinkPath -ErrorAction SilentlyContinue
        if ($Item -and $Item.Attributes -notmatch "ReparsePoint") {
            Remove-Item $StorageLinkPath -Force -Recurse -ErrorAction SilentlyContinue
            Start-Process -FilePath "php" -ArgumentList "artisan", "storage:link" -Wait -NoNewWindow
            Write-Log "Storage link recreated" 'OK'
        } else {
            Write-Log "Storage link already exists" 'INFO'
        }
    }
    
    # Start Laravel server
    $LaravelProcess = Start-Process -FilePath "php" -ArgumentList "artisan", "serve", "--host=0.0.0.0", "--port=$LaravelPort" -PassThru -WindowStyle Hidden
    
    # Wait for server to start
    Start-Sleep -Seconds $HealthCheckDelay
    
    # Check if server is running
    if (Test-Port -Port $LaravelPort) {
        Write-Log "Laravel Server started successfully!" 'OK'
        return $true
    } else {
        Write-Log "Failed to start Laravel Server" 'ERROR'
        return $false
    }
}

function Start-ApacheServer {
    Write-Log "Starting Apache Server on port $ApachePort..." 'INFO'
    
    # Stop existing Apache processes
    Stop-Service -ProcessName "httpd"
    
    # Start Apache server
    if (Test-Path $ApachePath) {
        $ApacheProcess = Start-Process -FilePath $ApachePath -PassThru -WindowStyle Hidden
        
        # Wait for server to start
        Start-Sleep -Seconds $HealthCheckDelay
        
        # Check if server is running
        if (Test-Port -Port $ApachePort) {
            Write-Log "Apache Server started successfully!" 'OK'
            return $true
        } else {
            Write-Log "Apache Server started but port check failed (may be normal)" 'WARN'
            return $true
        }
    } else {
        Write-Log "Apache executable not found at $ApachePath" 'ERROR'
        return $false
    }
}

function Test-Health {
    param([string]$Url, [string]$ServiceName)
    
    try {
        $Response = Invoke-WebRequest -Uri $Url -UseBasicParsing -TimeoutSec 10
        if ($Response.StatusCode -eq 200) {
            Write-Log "$ServiceName is healthy" 'OK'
            return $true
        } else {
            Write-Log "$ServiceName returned status code: $($Response.StatusCode)" 'ERROR'
            return $false
        }
    }
    catch {
        Write-Log "$ServiceName health check failed: $($_.Exception.Message)" 'ERROR'
        return $false
    }
}

function Start-Services {
    $RetryCount = 0
    
    while ($RetryCount -lt $MaxRetries) {
        Write-Log "Attempt $($RetryCount + 1) of $MaxRetries" 'INFO'
        
        # Start Laravel
        $LaravelStarted = Start-LaravelServer
        if (-not $LaravelStarted) {
            $RetryCount++
            Write-Log "Retrying in $RetryDelay seconds..." 'WARN'
            Start-Sleep -Seconds $RetryDelay
            continue
        }
        
        # Start Apache
        $ApacheStarted = Start-ApacheServer
        if (-not $ApacheStarted) {
            $RetryCount++
            Write-Log "Retrying in $RetryDelay seconds..." 'WARN'
            Start-Sleep -Seconds $RetryDelay
            continue
        }
        
        # Health checks
        Write-Log "Performing health checks..." 'INFO'
        
        $LaravelHealthy = Test-Health -Url "http://${ServerIP}:${LaravelPort}/api" -ServiceName "Laravel API"
        $FrontendHealthy = Test-Health -Url "http://${ServerIP}:${LaravelPort}/" -ServiceName "Frontend"
        
        if ($LaravelHealthy -and $FrontendHealthy) {
            Write-Log "All services are healthy!" 'OK'
            return $true
        } else {
            Write-Log "Health checks failed. Restarting services..." 'ERROR'
            $RetryCount++
            Start-Sleep -Seconds $RetryDelay
        }
    }
    
    Write-Log "Failed to start services after $MaxRetries attempts" 'ERROR'
    return $false
}

function Monitor-Services {
    Write-Log "Starting service monitoring (Press Ctrl+C to stop)..." 'INFO'
    
    while ($true) {
        Start-Sleep -Seconds $MonitorInterval
        
        Write-Log "Performing health check..." 'INFO'
        
        $LaravelHealthy = Test-Health -Url "http://${ServerIP}:${LaravelPort}/api" -ServiceName "Laravel API"
        $FrontendHealthy = Test-Health -Url "http://${ServerIP}:${LaravelPort}/" -ServiceName "Frontend"
        
        if (-not $LaravelHealthy -or -not $FrontendHealthy) {
            Write-Log "Service health check failed! Restarting services..." 'ERROR'
            Start-Services
        }
    }
}

# Main execution
try {
    Write-Log "========================================" 'INFO'
    Write-Log "HSE KPI Tracker Server Launcher" 'INFO'
    Write-Log "========================================" 'INFO'
    Write-Log "Laravel Port: $LaravelPort" 'INFO'
    Write-Log "Apache Port: $ApachePort" 'INFO'
    Write-Log "Monitor Interval: $MonitorInterval seconds" 'INFO'
    Write-Log "========================================" 'INFO'
    
    # Start services
    if (Start-Services) {
        Write-Log "========================================" 'OK'
        Write-Log "Server Status: HEALTHY" 'OK'
        Write-Log "========================================" 'OK'
        Write-Log "Laravel API: http://${ServerIP}:${LaravelPort}/api" 'INFO'
        Write-Log "Frontend: http://${ServerIP}:${LaravelPort}/" 'INFO'
        Write-Log "Apache: http://localhost:${ApachePort}/" 'INFO'
        Write-Log "Public: http://${ServerIP}:${LaravelPort}/" 'INFO'
        Write-Log "========================================" 'OK'
        
        # Start monitoring
        Monitor-Services
    } else {
        Write-Log "Failed to start services. Exiting..." 'ERROR'
        exit 1
    }
}
catch {
    Write-Log "Fatal error: $($_.Exception.Message)" 'ERROR'
    exit 1
}
finally {
    Write-Log "Server Launcher stopped" 'INFO'
}
