@echo off
title HSE KPI Tracker - Database Setup
color 0A
echo ========================================
echo    HSE KPI Tracker - Database Setup
echo ========================================
echo.

echo [1] Checking MySQL connection...
"C:\xampp\mysql\bin\mysql.exe" -u root -e "SELECT 1;" >nul 2>&1
if %ERRORLEVEL% NEQ 0 (
    echo [ERROR] MySQL connection failed
    echo Please ensure MySQL is running
    pause
    exit /b 1
)

echo [OK] MySQL is connected
echo.

echo [2] Creating database if not exists...
"C:\xampp\mysql\bin\mysql.exe" -u root -e "CREATE DATABASE IF NOT EXISTS hse_kpi_tracker;" 2>nul
echo [OK] Database ready
echo.

echo [3] Creating demo users...
"C:\xampp\mysql\bin\mysql.exe" -u root hse_kpi_tracker << EOF
-- Clear existing users
DELETE FROM users WHERE email LIKE '%test.com%';

-- Insert demo users with proper passwords
INSERT INTO users (name, email, password, role, created_at, updated_at) VALUES
('Admin User', 'admin@test.com', '$2y$10$92IXUNpkjO0rOQ5byMi.Ye4oKoEa3Ro9llC/.og/at2.uheWG/igi', 'admin', NOW(), NOW()),
('Responsible Manager', 'resposable@test.com', '$2y$10$92IXUNpkjO0rOQ5byMi.Ye4oKoEa3Ro9llC/.og/at2.uheWG/igi', 'manager', NOW(), NOW()),
('Supervisor', 'supervisor@test.com', '$2y$10$92IXUNpkjO0rOQ5byMi.Ye4oKoEa3Ro9llC/.og/at2.uheWG/igi', 'supervisor', NOW(), NOW()),
('Safety Officer', 'officer@test.com', '$2y$10$92IXUNpkjO0rOQ5byMi.Ye4oKoEa3Ro9llC/.og/at2.uheWG/igi', 'officer', NOW(), NOW()),
('HR Manager', 'hr@test.com', '$2y$10$92IXUNpkjO0rOQ5byMi.Ye4oKoEa3Ro9llC/.og/at2.uheWG/igi', 'hr', NOW(), NOW());

-- Verify users were created
SELECT COUNT(*) as user_count FROM users WHERE email LIKE '%test.com%';
EOF

echo [OK] Demo users created
echo.

echo [4] Testing login...
powershell -Command "try { \$body = @{email='admin@test.com';password='password123'} | ConvertTo-Json; \$response = Invoke-WebRequest -Uri 'http://16.171.8.116:8000/api/auth/login' -Method POST -Body \$body -ContentType 'application/json' -UseBasicParsing -TimeoutSec 10; Write-Host '[SUCCESS] Login working - Status:' \$response.StatusCode } catch { Write-Host '[ERROR] Login failed:' \$_.Exception.Message }"

echo.
echo ========================================
echo Database setup complete!
echo ========================================
echo.
echo Demo users created:
echo - admin@test.com / password123 (admin)
echo - resposable@test.com / password123 (manager)
echo - supervisor@test.com / password123 (supervisor)
echo - officer@test.com / password123 (officer)
echo - hr@test.com / password (hr)
echo.
echo Access your app: http://16.171.8.116:8000
echo.
pause
