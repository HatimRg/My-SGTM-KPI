<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;
use Illuminate\Support\Facades\DB;

return new class extends Migration
{
    public function up(): void
    {
        // Modify the enum to add 'sor' role
        DB::statement("ALTER TABLE users MODIFY COLUMN role ENUM('admin', 'responsable', 'sor') DEFAULT 'responsable'");
    }

    public function down(): void
    {
        // Revert back to original enum (will fail if any user has 'sor' role)
        DB::statement("ALTER TABLE users MODIFY COLUMN role ENUM('admin', 'responsable') DEFAULT 'responsable'");
    }
};
