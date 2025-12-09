# SGTM HSE KPI Tracker - Security Monitor
# This script monitors security logs in real-time

param(
    [switch]$Tail,
    [int]$Lines = 50,
    [switch]$Stats
)

$LogPath = "C:\My-SGTM-KPI\backend\storage\logs"
$SecurityLog = Join-Path $LogPath "security-$(Get-Date -Format 'yyyy-MM-dd').log"

Write-Host "========================================" -ForegroundColor Cyan
Write-Host "  SGTM Security Monitor" -ForegroundColor Cyan
Write-Host "========================================" -ForegroundColor Cyan
Write-Host ""

if ($Stats) {
    Write-Host "[SECURITY STATISTICS]" -ForegroundColor Yellow
    Write-Host ""
    
    if (Test-Path $SecurityLog) {
        $content = Get-Content $SecurityLog -Raw
        
        # Count events by type
        $sqlInjection = ([regex]::Matches($content, 'sql_injection_attempt')).Count
        $xss = ([regex]::Matches($content, 'xss_attempt')).Count
        $pathTraversal = ([regex]::Matches($content, 'path_traversal_attempt')).Count
        $ddos = ([regex]::Matches($content, 'ddos_detected')).Count
        $blocked = ([regex]::Matches($content, 'blocked_request')).Count
        $suspicious = ([regex]::Matches($content, 'suspicious_user_agent')).Count
        
        Write-Host "Today's Security Events:" -ForegroundColor White
        Write-Host "  SQL Injection Attempts: $sqlInjection" -ForegroundColor $(if($sqlInjection -gt 0){'Red'}else{'Green'})
        Write-Host "  XSS Attempts: $xss" -ForegroundColor $(if($xss -gt 0){'Red'}else{'Green'})
        Write-Host "  Path Traversal Attempts: $pathTraversal" -ForegroundColor $(if($pathTraversal -gt 0){'Red'}else{'Green'})
        Write-Host "  DDoS Detections: $ddos" -ForegroundColor $(if($ddos -gt 0){'Red'}else{'Green'})
        Write-Host "  Blocked Requests: $blocked" -ForegroundColor $(if($blocked -gt 0){'Yellow'}else{'Green'})
        Write-Host "  Suspicious User Agents: $suspicious" -ForegroundColor $(if($suspicious -gt 0){'Yellow'}else{'Green'})
        
        # Extract blocked IPs
        $blockedIps = [regex]::Matches($content, 'IP blocked: ([\d\.]+)') | ForEach-Object { $_.Groups[1].Value } | Select-Object -Unique
        
        if ($blockedIps.Count -gt 0) {
            Write-Host ""
            Write-Host "Blocked IPs:" -ForegroundColor Red
            $blockedIps | ForEach-Object { Write-Host "  - $_" -ForegroundColor Red }
        }
        
        # Top offending IPs
        $ips = [regex]::Matches($content, '"ip":"([\d\.]+)"') | ForEach-Object { $_.Groups[1].Value }
        $topIps = $ips | Group-Object | Sort-Object Count -Descending | Select-Object -First 5
        
        if ($topIps.Count -gt 0) {
            Write-Host ""
            Write-Host "Top Offending IPs:" -ForegroundColor Yellow
            $topIps | ForEach-Object { Write-Host "  $($_.Name): $($_.Count) events" -ForegroundColor Yellow }
        }
    } else {
        Write-Host "No security log found for today." -ForegroundColor Green
        Write-Host "This is good - no security events recorded!" -ForegroundColor Green
    }
    
    exit 0
}

if ($Tail) {
    Write-Host "[REAL-TIME MONITORING]" -ForegroundColor Yellow
    Write-Host "Watching: $SecurityLog" -ForegroundColor Gray
    Write-Host "Press Ctrl+C to stop..." -ForegroundColor Gray
    Write-Host ""
    
    if (Test-Path $SecurityLog) {
        Get-Content $SecurityLog -Tail 10 -Wait | ForEach-Object {
            if ($_ -match 'sql_injection') {
                Write-Host $_ -ForegroundColor Red
            } elseif ($_ -match 'xss_attempt') {
                Write-Host $_ -ForegroundColor Red
            } elseif ($_ -match 'ddos_detected') {
                Write-Host $_ -ForegroundColor Red
            } elseif ($_ -match 'blocked') {
                Write-Host $_ -ForegroundColor Yellow
            } else {
                Write-Host $_ -ForegroundColor White
            }
        }
    } else {
        Write-Host "Waiting for security log to be created..." -ForegroundColor Gray
        while (-not (Test-Path $SecurityLog)) {
            Start-Sleep -Seconds 5
        }
        Get-Content $SecurityLog -Tail 10 -Wait
    }
} else {
    Write-Host "[RECENT SECURITY EVENTS]" -ForegroundColor Yellow
    Write-Host ""
    
    if (Test-Path $SecurityLog) {
        Get-Content $SecurityLog -Tail $Lines | ForEach-Object {
            if ($_ -match 'sql_injection|xss_attempt|path_traversal') {
                Write-Host $_ -ForegroundColor Red
            } elseif ($_ -match 'ddos_detected|threat_score') {
                Write-Host $_ -ForegroundColor Red
            } elseif ($_ -match 'blocked') {
                Write-Host $_ -ForegroundColor Yellow
            } elseif ($_ -match 'suspicious') {
                Write-Host $_ -ForegroundColor Yellow
            } else {
                Write-Host $_ -ForegroundColor White
            }
        }
    } else {
        Write-Host "No security log found for today." -ForegroundColor Green
    }
}

Write-Host ""
Write-Host "========================================" -ForegroundColor Cyan
Write-Host "Usage:" -ForegroundColor Gray
Write-Host "  .\security-monitor.ps1 -Stats    # Show statistics" -ForegroundColor Gray
Write-Host "  .\security-monitor.ps1 -Tail     # Real-time monitoring" -ForegroundColor Gray
Write-Host "  .\security-monitor.ps1 -Lines 100 # Show last 100 lines" -ForegroundColor Gray
Write-Host "========================================" -ForegroundColor Cyan
