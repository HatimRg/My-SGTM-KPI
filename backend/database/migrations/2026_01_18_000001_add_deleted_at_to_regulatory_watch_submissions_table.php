<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        Schema::table('regulatory_watch_submissions', function (Blueprint $table) {
            if (!Schema::hasColumn('regulatory_watch_submissions', 'deleted_at')) {
                $table->softDeletes();
            }
        });
    }

    public function down(): void
    {
        Schema::table('regulatory_watch_submissions', function (Blueprint $table) {
            if (Schema::hasColumn('regulatory_watch_submissions', 'deleted_at')) {
                $table->dropSoftDeletes();
            }
        });
    }
};
