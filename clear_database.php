<?php
/**
 * Database Table Cleaner - Simple GUI
 * Run this file directly in browser: http://localhost/My%20SGTM%20KPI%202/clear_database.php
 */

// Load Laravel environment
require __DIR__ . '/backend/vendor/autoload.php';
$app = require_once __DIR__ . '/backend/bootstrap/app.php';
$app->make('Illuminate\Contracts\Console\Kernel')->bootstrap();

use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Schema;

// Security: Only allow in local environment
if (!in_array($_SERVER['REMOTE_ADDR'], ['127.0.0.1', '::1'])) {
    die('Access denied. This tool only works on localhost.');
}

$message = '';
$messageType = '';

// Handle form submission
if ($_SERVER['REQUEST_METHOD'] === 'POST' && isset($_POST['tables'])) {
    $tablesToClear = $_POST['tables'];
    $cleared = [];
    $errors = [];
    
    // Disable foreign key checks
    DB::statement('SET FOREIGN_KEY_CHECKS=0');
    
    foreach ($tablesToClear as $table) {
        try {
            DB::table($table)->truncate();
            $cleared[] = $table;
        } catch (Exception $e) {
            $errors[] = "$table: " . $e->getMessage();
        }
    }
    
    // Re-enable foreign key checks
    DB::statement('SET FOREIGN_KEY_CHECKS=1');
    
    if (count($cleared) > 0) {
        $message = "Cleared " . count($cleared) . " table(s): " . implode(', ', $cleared);
        $messageType = 'success';
    }
    if (count($errors) > 0) {
        $message .= ($message ? '<br>' : '') . "Errors: " . implode(', ', $errors);
        $messageType = count($cleared) > 0 ? 'warning' : 'error';
    }
}

// Get all tables
$tables = DB::select('SHOW TABLES');
$dbName = DB::getDatabaseName();
$tableKey = "Tables_in_$dbName";

// Categorize tables
$systemTables = ['migrations', 'password_resets', 'failed_jobs', 'personal_access_tokens', 'cache', 'sessions', 'jobs'];
$userTables = [];
$dataTables = [];

foreach ($tables as $table) {
    $tableName = $table->$tableKey;
    if (in_array($tableName, $systemTables)) {
        continue; // Skip system tables
    } elseif (in_array($tableName, ['users', 'projects', 'project_user', 'project_teams'])) {
        $userTables[] = $tableName;
    } else {
        $dataTables[] = $tableName;
    }
}
?>
<!DOCTYPE html>
<html lang="en">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>SGTM KPI - Database Cleaner</title>
    <style>
        * {
            margin: 0;
            padding: 0;
            box-sizing: border-box;
        }
        body {
            font-family: 'Segoe UI', Tahoma, Geneva, Verdana, sans-serif;
            background: linear-gradient(135deg, #1F2937 0%, #111827 100%);
            min-height: 100vh;
            padding: 40px 20px;
            color: #F9FAFB;
        }
        .container {
            max-width: 800px;
            margin: 0 auto;
        }
        .header {
            text-align: center;
            margin-bottom: 30px;
        }
        .header h1 {
            font-size: 2rem;
            color: #F59E0B;
            margin-bottom: 10px;
        }
        .header p {
            color: #9CA3AF;
            font-size: 0.9rem;
        }
        .warning-banner {
            background: #7F1D1D;
            border: 1px solid #DC2626;
            border-radius: 8px;
            padding: 15px;
            margin-bottom: 25px;
            text-align: center;
        }
        .warning-banner strong {
            color: #FCA5A5;
        }
        .card {
            background: #374151;
            border-radius: 12px;
            padding: 25px;
            margin-bottom: 20px;
            box-shadow: 0 4px 6px rgba(0, 0, 0, 0.3);
        }
        .card h2 {
            font-size: 1.1rem;
            color: #F59E0B;
            margin-bottom: 15px;
            padding-bottom: 10px;
            border-bottom: 1px solid #4B5563;
        }
        .checkbox-grid {
            display: grid;
            grid-template-columns: repeat(auto-fill, minmax(200px, 1fr));
            gap: 10px;
        }
        .checkbox-item {
            display: flex;
            align-items: center;
            padding: 10px 15px;
            background: #1F2937;
            border-radius: 6px;
            cursor: pointer;
            transition: all 0.2s;
        }
        .checkbox-item:hover {
            background: #4B5563;
        }
        .checkbox-item input {
            margin-right: 10px;
            width: 18px;
            height: 18px;
            accent-color: #F59E0B;
        }
        .checkbox-item label {
            cursor: pointer;
            font-size: 0.9rem;
        }
        .checkbox-item.danger label {
            color: #FCA5A5;
        }
        .actions {
            display: flex;
            gap: 15px;
            justify-content: center;
            margin-top: 30px;
        }
        .btn {
            padding: 12px 30px;
            border: none;
            border-radius: 8px;
            font-size: 1rem;
            font-weight: 600;
            cursor: pointer;
            transition: all 0.2s;
        }
        .btn-danger {
            background: #DC2626;
            color: white;
        }
        .btn-danger:hover {
            background: #B91C1C;
        }
        .btn-secondary {
            background: #4B5563;
            color: white;
        }
        .btn-secondary:hover {
            background: #6B7280;
        }
        .btn-select {
            background: #F59E0B;
            color: #1F2937;
        }
        .btn-select:hover {
            background: #D97706;
        }
        .message {
            padding: 15px;
            border-radius: 8px;
            margin-bottom: 20px;
            text-align: center;
        }
        .message.success {
            background: #065F46;
            border: 1px solid #10B981;
        }
        .message.error {
            background: #7F1D1D;
            border: 1px solid #DC2626;
        }
        .message.warning {
            background: #78350F;
            border: 1px solid #F59E0B;
        }
        .select-buttons {
            display: flex;
            gap: 10px;
            margin-bottom: 15px;
        }
        .select-buttons button {
            padding: 6px 12px;
            font-size: 0.8rem;
            border-radius: 4px;
        }
        .table-count {
            font-size: 0.8rem;
            color: #9CA3AF;
            margin-left: 5px;
        }
    </style>
</head>
<body>
    <div class="container">
        <div class="header">
            <h1>🗄️ SGTM KPI Database Cleaner</h1>
            <p>Select tables to clear (truncate) their data</p>
        </div>

        <div class="warning-banner">
            <strong>⚠️ WARNING:</strong> This action is IRREVERSIBLE! All data in selected tables will be permanently deleted.
        </div>

        <?php if ($message): ?>
            <div class="message <?= $messageType ?>">
                <?= $message ?>
            </div>
        <?php endif; ?>

        <form method="POST" id="clearForm">
            <!-- Data Tables -->
            <div class="card">
                <h2>📊 Data Tables <span class="table-count">(<?= count($dataTables) ?> tables)</span></h2>
                <div class="select-buttons">
                    <button type="button" class="btn btn-select" onclick="selectAll('data')">Select All</button>
                    <button type="button" class="btn btn-secondary" onclick="deselectAll('data')">Deselect All</button>
                </div>
                <div class="checkbox-grid" id="data-tables">
                    <?php foreach ($dataTables as $table): ?>
                        <div class="checkbox-item">
                            <input type="checkbox" name="tables[]" value="<?= $table ?>" id="<?= $table ?>">
                            <label for="<?= $table ?>"><?= $table ?></label>
                        </div>
                    <?php endforeach; ?>
                </div>
            </div>

            <!-- User/Project Tables -->
            <div class="card">
                <h2>👥 User & Project Tables <span class="table-count">(<?= count($userTables) ?> tables)</span></h2>
                <div class="select-buttons">
                    <button type="button" class="btn btn-select" onclick="selectAll('user')">Select All</button>
                    <button type="button" class="btn btn-secondary" onclick="deselectAll('user')">Deselect All</button>
                </div>
                <div class="checkbox-grid" id="user-tables">
                    <?php foreach ($userTables as $table): ?>
                        <div class="checkbox-item danger">
                            <input type="checkbox" name="tables[]" value="<?= $table ?>" id="<?= $table ?>">
                            <label for="<?= $table ?>"><?= $table ?></label>
                        </div>
                    <?php endforeach; ?>
                </div>
            </div>

            <div class="actions">
                <button type="button" class="btn btn-secondary" onclick="selectAllTables()">Select All Tables</button>
                <button type="button" class="btn btn-secondary" onclick="deselectAllTables()">Deselect All</button>
                <button type="submit" class="btn btn-danger" onclick="return confirmDelete()">🗑️ Delete Selected</button>
            </div>
        </form>
    </div>

    <script>
        function selectAll(type) {
            const container = document.getElementById(type + '-tables');
            container.querySelectorAll('input[type="checkbox"]').forEach(cb => cb.checked = true);
        }
        
        function deselectAll(type) {
            const container = document.getElementById(type + '-tables');
            container.querySelectorAll('input[type="checkbox"]').forEach(cb => cb.checked = false);
        }
        
        function selectAllTables() {
            document.querySelectorAll('input[type="checkbox"]').forEach(cb => cb.checked = true);
        }
        
        function deselectAllTables() {
            document.querySelectorAll('input[type="checkbox"]').forEach(cb => cb.checked = false);
        }
        
        function confirmDelete() {
            const checked = document.querySelectorAll('input[type="checkbox"]:checked');
            if (checked.length === 0) {
                alert('Please select at least one table to delete.');
                return false;
            }
            
            const tableNames = Array.from(checked).map(cb => cb.value).join(', ');
            return confirm(`Are you sure you want to DELETE ALL DATA from these ${checked.length} table(s)?\n\n${tableNames}\n\nThis action cannot be undone!`);
        }
    </script>
</body>
</html>
