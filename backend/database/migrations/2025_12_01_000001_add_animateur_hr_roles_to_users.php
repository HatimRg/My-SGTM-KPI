<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Support\Facades\DB;

return new class extends Migration
{
    public function up(): void
    {
        DB::statement("ALTER TABLE users MODIFY COLUMN role ENUM('admin', 'responsable', 'user', 'supervisor', 'animateur', 'hr') DEFAULT 'responsable'");
    }

    public function down(): void
    {
        // Revert to previous enum without animateur/hr
        DB::statement("ALTER TABLE users MODIFY COLUMN role ENUM('admin', 'responsable', 'user', 'supervisor') DEFAULT 'responsable'");
    }
};
