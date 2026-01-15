<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        DB::statement("ALTER TABLE users MODIFY COLUMN role ENUM('admin', 'consultation', 'hse_manager', 'regional_hse_manager', 'responsable', 'user', 'supervisor', 'hr', 'dev', 'pole_director', 'works_director', 'hse_director', 'hr_director') DEFAULT 'hse_manager'");

        Schema::table('users', function (Blueprint $table) {
            if (!Schema::hasColumn('users', 'preferred_language')) {
                $table->string('preferred_language', 10)->nullable()->after('avatar');
            }
        });
    }

    public function down(): void
    {
        Schema::table('users', function (Blueprint $table) {
            if (Schema::hasColumn('users', 'preferred_language')) {
                $table->dropColumn('preferred_language');
            }
        });

        DB::statement("ALTER TABLE users MODIFY COLUMN role ENUM('admin', 'hse_manager', 'regional_hse_manager', 'responsable', 'user', 'supervisor', 'hr', 'dev', 'pole_director', 'works_director', 'hse_director', 'hr_director') DEFAULT 'hse_manager'");
    }
};
