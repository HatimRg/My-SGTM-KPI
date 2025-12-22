<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;
use Illuminate\Support\Facades\DB;

return new class extends Migration
{
    public function up(): void
    {
        Schema::table('projects', function (Blueprint $table) {
            if (Schema::hasColumn('projects', 'budget') && !Schema::hasColumn('projects', 'pole')) {
                $table->renameColumn('budget', 'pole');
            }
        });

        Schema::table('projects', function (Blueprint $table) {
            if (Schema::hasColumn('projects', 'pole')) {
                $table->string('pole')->nullable()->change();
            }
        });

        if (Schema::hasColumn('projects', 'pole')) {
            DB::table('projects')
                ->whereNull('pole')
                ->orWhere('pole', '')
                ->update(['pole' => null]);
        }
    }

    public function down(): void
    {
        Schema::table('projects', function (Blueprint $table) {
            if (Schema::hasColumn('projects', 'pole') && !Schema::hasColumn('projects', 'budget')) {
                $table->renameColumn('pole', 'budget');
            }
        });
    }
};
