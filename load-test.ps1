# HSE KPI Tracker Load Test
# 30 users: 10 checking, 10 inserting, 10 editing

param(
    [string]$BaseUrl = "http://16.171.8.116:8000",
    [int]$TotalUsers = 30,
    [int]$CheckingUsers = 10,
    [int]$InsertingUsers = 10,
    [int]$EditingUsers = 10,
    [int]$TestDuration = 60
)

# Test data
$LoginCredentials = @{
    "admin@test.com" = "password123"
    "resposable@test.com" = "password123"
    "supervisor@test.com" = "password123"
    "officer@test.com" = "password123"
    "hr@test.com" = "password"
}

# Results tracking
$Results = @{
    TotalRequests = 0
    SuccessfulRequests = 0
    FailedRequests = 0
    ResponseTimes = @()
    Errors = @()
    StartTime = Get-Date
}

function Write-TestLog {
    param([string]$Message, [string]$Level = "INFO")
    $Timestamp = Get-Date -Format "HH:mm:ss"
    $color = switch ($Level) {
        "SUCCESS" { "Green" }
        "ERROR" { "Red" }
        "WARN" { "Yellow" }
        default { "White" }
    }
    Write-Host "[$Timestamp] [$Level] $Message" -ForegroundColor $color
}

function Test-ApiEndpoint {
    param([string]$Url, [string]$Method = "GET", [hashtable]$Body = $null, [string]$Token = $null)
    
    try {
        $Stopwatch = [System.Diagnostics.Stopwatch]::StartNew()
        
        $Headers = @{
            "Content-Type" = "application/json"
            "Accept" = "application/json"
        }
        
        if ($Token) {
            $Headers["Authorization"] = "Bearer $Token"
        }
        
        $Params = @{
            Uri = $Url
            Method = $Method
            Headers = $Headers
            TimeoutSec = 30
        }
        
        if ($Body) {
            $Params["Body"] = $Body | ConvertTo-Json -Depth 10
        }
        
        $Response = Invoke-WebRequest @Params
        $Stopwatch.Stop()
        
        $Results.TotalRequests++
        $Results.SuccessfulRequests++
        $Results.ResponseTimes += $Stopwatch.Elapsed.TotalMilliseconds
        
        return @{
            Success = $true
            StatusCode = $Response.StatusCode
            ResponseTime = $Stopwatch.Elapsed.TotalMilliseconds
            Content = $Response.Content
        }
    }
    catch {
        $Results.TotalRequests++
        $Results.FailedRequests++
        $Results.Errors += @{
            Url = $Url
            Error = $_.Exception.Message
            Timestamp = Get-Date
        }
        
        return @{
            Success = $false
            Error = $_.Exception.Message
        }
    }
}

function Get-AuthToken {
    param([string]$Email, [string]$Password)
    
    $LoginBody = @{
        email = $Email
        password = $Password
    }
    
    $Response = Test-ApiEndpoint -Url "$BaseUrl/api/auth/login" -Method "POST" -Body $LoginBody
    
    if ($Response.Success) {
        $Data = $Response.Content | ConvertFrom-Json
        return $Data.data.token
    }
    
    return $null
}

function Start-CheckingUser {
    param([int]$UserId)
    
    Write-TestLog "Starting checking user $UserId" "INFO"
    
    # Login
    $Email = $LoginCredentials.Keys | Get-Random
    $Token = Get-AuthToken -Email $Email -Password $LoginCredentials[$Email]
    
    if (-not $Token) {
        Write-TestLog "User $UserId failed to login" "ERROR"
        return
    }
    
    $EndTime = (Get-Date).AddSeconds($TestDuration)
    
    while ((Get-Date) -lt $EndTime) {
        # Check dashboard
        $Response = Test-ApiEndpoint -Url "$BaseUrl/api/dashboard/user" -Token $Token
        if (-not $Response.Success) {
            Write-TestLog "Checking user $UserId dashboard failed" "WARN"
        }
        
        # Check projects
        $Response = Test-ApiEndpoint -Url "$BaseUrl/api/projects" -Token $Token
        if (-not $Response.Success) {
            Write-TestLog "Checking user $UserId projects failed" "WARN"
        }
        
        # Check KPI reports
        $Response = Test-ApiEndpoint -Url "$BaseUrl/api/kpi-reports" -Token $Token
        if (-not $Response.Success) {
            Write-TestLog "Checking user $UserId KPI reports failed" "WARN"
        }
        
        Start-Sleep -Milliseconds (Get-Random -Minimum 1000 -Maximum 3000)
    }
}

function Start-InsertingUser {
    param([int]$UserId)
    
    Write-TestLog "Starting inserting user $UserId" "INFO"
    
    # Login as admin
    $Token = Get-AuthToken -Email "admin@test.com" -Password "password123"
    
    if (-not $Token) {
        Write-TestLog "Inserting user $UserId failed to login" "ERROR"
        return
    }
    
    $EndTime = (Get-Date).AddSeconds($TestDuration)
    
    while ((Get-Date) -lt $EndTime) {
        # Insert KPI report
        $KpiData = @{
            project_id = 1
            week = (Get-Date).WeekOfYear
            year = (Get-Date).Year
            total_accidents = (Get-Random -Minimum 0 -Maximum 5)
            total_trainings = (Get-Random -Minimum 10 -Maximum 50)
            total_inspections = (Get-Random -Minimum 5 -Maximum 30)
            tf_rate = (Get-Random -Minimum 0.0 -Maximum 2.0)
            tg_rate = (Get-Random -Minimum 0.0 -Maximum 5.0)
        }
        
        $Response = Test-ApiEndpoint -Url "$BaseUrl/api/kpi-reports" -Method "POST" -Body $KpiData -Token $Token
        if ($Response.Success) {
            Write-TestLog "Inserting user $UserId created KPI report" "SUCCESS"
        } else {
            Write-TestLog "Inserting user $UserId KPI report failed" "WARN"
        }
        
        # Insert training record
        $TrainingData = @{
            project_id = 1
            title = "Safety Training $(Get-Random)"
            date = (Get-Date).ToString("yyyy-MM-dd")
            participants_count = (Get-Random -Minimum 5 -Maximum 25)
            trainer_name = "Trainer $(Get-Random)"
        }
        
        $Response = Test-ApiEndpoint -Url "$BaseUrl/api/trainings" -Method "POST" -Body $TrainingData -Token $Token
        if ($Response.Success) {
            Write-TestLog "Inserting user $UserId created training record" "SUCCESS"
        } else {
            Write-TestLog "Inserting user $UserId training record failed" "WARN"
        }
        
        Start-Sleep -Milliseconds (Get-Random -Minimum 2000 -Maximum 5000)
    }
}

function Start-EditingUser {
    param([int]$UserId)
    
    Write-TestLog "Starting editing user $UserId" "INFO"
    
    # Login as admin
    $Token = Get-AuthToken -Email "admin@test.com" -Password "password123"
    
    if (-not $Token) {
        Write-TestLog "Editing user $UserId failed to login" "ERROR"
        return
    }
    
    $EndTime = (Get-Date).AddSeconds($TestDuration)
    
    while ((Get-Date) -lt $EndTime) {
        # Get a KPI report to edit
        $Response = Test-ApiEndpoint -Url "$BaseUrl/api/kpi-reports" -Token $Token
        
        if ($Response.Success) {
            $KpiReports = $Response.Content | ConvertFrom-Json
            if ($KpiReports.data.Count -gt 0) {
                $RandomReport = $KpiReports.data | Get-Random
                $ReportId = $RandomReport.id
                
                # Edit the KPI report
                $EditData = @{
                    total_accidents = (Get-Random -Minimum 0 -Maximum 5)
                    total_trainings = (Get-Random -Minimum 10 -Maximum 50)
                    total_inspections = (Get-Random -Minimum 5 -Maximum 30)
                }
                
                $EditResponse = Test-ApiEndpoint -Url "$BaseUrl/api/kpi-reports/$ReportId" -Method "PUT" -Body $EditData -Token $Token
                if ($EditResponse.Success) {
                    Write-TestLog "Editing user $UserId updated KPI report $ReportId" "SUCCESS"
                } else {
                    Write-TestLog "Editing user $UserId failed to update KPI report $ReportId" "WARN"
                }
            }
        }
        
        # Edit user profile
        $ProfileData = @{
            name = "Updated User $UserId"
            phone = "123-456-789$UserId"
        }
        
        $ProfileResponse = Test-ApiEndpoint -Url "$BaseUrl/api/auth/profile" -Method "PUT" -Body $ProfileData -Token $Token
        if ($ProfileResponse.Success) {
            Write-TestLog "Editing user $UserId updated profile" "SUCCESS"
        } else {
            Write-TestLog "Editing user $UserId profile update failed" "WARN"
        }
        
        Start-Sleep -Milliseconds (Get-Random -Minimum 1500 -Maximum 4000)
    }
}

# Main test execution
Write-TestLog "Starting HSE KPI Tracker Load Test" "INFO"
$config = "$TotalUsers users ($CheckingUsers checking, $InsertingUsers inserting, $EditingUsers editing)"
Write-TestLog "Configuration: $config" "INFO"
Write-TestLog "Test duration: $TestDuration seconds" "INFO"
Write-TestLog "Base URL: $BaseUrl" "INFO"

# Start user simulations
$Jobs = @()

# Start checking users
for ($i = 1; $i -le $CheckingUsers; $i++) {
    $Jobs += Start-Job -ScriptBlock ${function:Start-CheckingUser} -ArgumentList $i
}

# Start inserting users
for ($i = $CheckingUsers + 1; $i -le ($CheckingUsers + $InsertingUsers); $i++) {
    $Jobs += Start-Job -ScriptBlock ${function:Start-InsertingUser} -ArgumentList $i
}

# Start editing users
for ($i = ($CheckingUsers + $InsertingUsers + 1); $i -le $TotalUsers; $i++) {
    $Jobs += Start-Job -ScriptBlock ${function:Start-EditingUser} -ArgumentList $i
}

Write-TestLog "All $TotalUsers user simulations started" "INFO"

# Wait for all jobs to complete
$Jobs | Wait-Job | Out-Null

# Calculate results
$EndTime = Get-Date
$TotalTestTime = ($EndTime - $Results.StartTime).TotalSeconds

Write-TestLog "Load test completed" "SUCCESS"
Write-TestLog "========================================" "INFO"
Write-TestLog "Test Results:" "INFO"
Write-TestLog "Total Test Time: $([math]::Round($TotalTestTime, 2)) seconds" "INFO"
Write-TestLog "Total Requests: $($Results.TotalRequests)" "INFO"
Write-TestLog "Successful: $($Results.SuccessfulRequests)" "INFO"
Write-TestLog "Failed: $($Results.FailedRequests)" "INFO"
Write-TestLog "Success Rate: $([math]::Round(($Results.SuccessfulRequests / $Results.TotalRequests) * 100, 2))%" "INFO"

if ($Results.ResponseTimes.Count -gt 0) {
    $AvgResponseTime = ($Results.ResponseTimes | Measure-Object -Average).Average
    $MinResponseTime = ($Results.ResponseTimes | Measure-Object -Minimum).Minimum
    $MaxResponseTime = ($Results.ResponseTimes | Measure-Object -Maximum).Maximum
    
    Write-TestLog "Average Response Time: $([math]::Round($AvgResponseTime, 2)) ms" "INFO"
    Write-TestLog "Min Response Time: $([math]::Round($MinResponseTime, 2)) ms" "INFO"
    Write-TestLog "Max Response Time: $([math]::Round($MaxResponseTime, 2)) ms" "INFO"
    Write-TestLog "Requests/Second: $([math]::Round($Results.TotalRequests / $TotalTestTime, 2))" "INFO"
}

if ($Results.Errors.Count -gt 0) {
    Write-TestLog "========================================" "WARN"
    Write-TestLog "Errors encountered:" "WARN"
    $Results.Errors | Select-Object -First 10 | ForEach-Object {
        Write-TestLog "  $($_.Url): $($_.Error)" "WARN"
    }
    if ($Results.Errors.Count -gt 10) {
        Write-TestLog "  ... and $($Results.Errors.Count - 10) more errors" "WARN"
    }
}

# Cleanup
$Jobs | Remove-Job

Write-TestLog "Load test finished" "SUCCESS"
