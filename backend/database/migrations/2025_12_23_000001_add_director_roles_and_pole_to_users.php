<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        DB::statement("ALTER TABLE users MODIFY COLUMN role ENUM('admin', 'hse_manager', 'responsable', 'user', 'supervisor', 'hr', 'dev', 'pole_director', 'works_director', 'hse_director', 'hr_director') DEFAULT 'hse_manager'");

        Schema::table('users', function (Blueprint $table) {
            if (!Schema::hasColumn('users', 'pole')) {
                $table->string('pole')->nullable()->after('role');
            }
        });
    }

    public function down(): void
    {
        Schema::table('users', function (Blueprint $table) {
            if (Schema::hasColumn('users', 'pole')) {
                $table->dropColumn('pole');
            }
        });

        DB::statement("ALTER TABLE users MODIFY COLUMN role ENUM('admin', 'hse_manager', 'responsable', 'user', 'supervisor', 'hr', 'dev') DEFAULT 'hse_manager'");
    }
};
