<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        Schema::table('regulatory_watch_submissions', function (Blueprint $table) {
            if (!Schema::hasColumn('regulatory_watch_submissions', 'week_year')) {
                $table->unsignedSmallInteger('week_year')->nullable()->after('submitted_at');
            }

            if (!Schema::hasColumn('regulatory_watch_submissions', 'week_number')) {
                $table->unsignedTinyInteger('week_number')->nullable()->after('week_year');
            }
        });

        $indexName = 'rws_proj_week_idx';
        $existingIndex = DB::select(
            'SHOW INDEX FROM regulatory_watch_submissions WHERE Key_name = ?',
            [$indexName]
        );

        if (count($existingIndex) === 0) {
            Schema::table('regulatory_watch_submissions', function (Blueprint $table) use ($indexName) {
                $table->index(['project_id', 'week_year', 'week_number'], $indexName);
            });
        }
    }

    public function down(): void
    {
        $indexName = 'rws_proj_week_idx';
        $existingIndex = DB::select(
            'SHOW INDEX FROM regulatory_watch_submissions WHERE Key_name = ?',
            [$indexName]
        );

        if (count($existingIndex) > 0) {
            Schema::table('regulatory_watch_submissions', function (Blueprint $table) use ($indexName) {
                $table->dropIndex($indexName);
            });
        }

        Schema::table('regulatory_watch_submissions', function (Blueprint $table) {
            $columns = [];
            if (Schema::hasColumn('regulatory_watch_submissions', 'week_year')) {
                $columns[] = 'week_year';
            }
            if (Schema::hasColumn('regulatory_watch_submissions', 'week_number')) {
                $columns[] = 'week_number';
            }

            if (count($columns) > 0) {
                $table->dropColumn($columns);
            }
        });
    }
};
