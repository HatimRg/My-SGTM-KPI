<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Support\Facades\DB;

return new class extends Migration
{
    public function up(): void
    {
        // 1) Expand enum to allow transitional values
        DB::statement("ALTER TABLE users MODIFY COLUMN role ENUM('admin', 'hse_manager', 'responsable', 'user', 'supervisor', 'hr', 'dev', 'animateur') DEFAULT 'hse_manager'");

        // 2) Migrate old roles
        // - Previous 'responsable' becomes 'hse_manager'
        DB::table('users')->where('role', 'responsable')->update(['role' => 'hse_manager']);

        // - Remove animateur by mapping it to user (closest in-app behavior historically)
        DB::table('users')->where('role', 'animateur')->update(['role' => 'user']);

        // 3) Remove deprecated role from enum
        DB::statement("ALTER TABLE users MODIFY COLUMN role ENUM('admin', 'hse_manager', 'responsable', 'user', 'supervisor', 'hr', 'dev') DEFAULT 'hse_manager'");
    }

    public function down(): void
    {
        // Restore legacy enum and values (best-effort)
        DB::statement("ALTER TABLE users MODIFY COLUMN role ENUM('admin', 'responsable', 'user', 'supervisor', 'animateur', 'hr') DEFAULT 'responsable'");

        // Map hse_manager back to responsable
        DB::table('users')->where('role', 'hse_manager')->update(['role' => 'responsable']);

        // Note: Cannot reliably restore which 'user' were previously 'animateur'
        // so we do not remap 'user' back.
    }
};
