<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        Schema::table('regulatory_watch_submissions', function (Blueprint $table) {
            if (!Schema::hasColumn('regulatory_watch_submissions', 'category')) {
                $table->string('category', 32)->nullable()->after('week_number');
                $table->index(['project_id', 'category', 'submitted_at'], 'rws_proj_cat_submitted_idx');
            }
        });
    }

    public function down(): void
    {
        Schema::table('regulatory_watch_submissions', function (Blueprint $table) {
            if (Schema::hasColumn('regulatory_watch_submissions', 'category')) {
                $table->dropIndex('rws_proj_cat_submitted_idx');
                $table->dropColumn('category');
            }
        });
    }
};
