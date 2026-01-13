<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Support\Facades\DB;

return new class extends Migration
{
    public function up(): void
    {
        DB::statement("ALTER TABLE users MODIFY COLUMN role ENUM('admin', 'hse_manager', 'regional_hse_manager', 'responsable', 'user', 'supervisor', 'hr', 'dev', 'pole_director', 'works_director', 'hse_director', 'hr_director') DEFAULT 'hse_manager'");
    }

    public function down(): void
    {
        DB::statement("ALTER TABLE users MODIFY COLUMN role ENUM('admin', 'hse_manager', 'responsable', 'user', 'supervisor', 'hr', 'dev', 'pole_director', 'works_director', 'hse_director', 'hr_director') DEFAULT 'hse_manager'");
    }
};
