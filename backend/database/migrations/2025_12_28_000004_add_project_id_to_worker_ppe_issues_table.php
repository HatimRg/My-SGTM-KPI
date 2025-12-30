<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Schema;

class AddProjectIdToWorkerPpeIssuesTable extends Migration
{
    public function up(): void
    {
        Schema::table('worker_ppe_issues', function (Blueprint $table) {
            $table->foreignId('project_id')->nullable()->after('worker_id')->constrained('projects')->nullOnDelete();
            $table->index(['project_id', 'received_at']);
        });

        // Backfill project_id from worker.project_id for existing rows.
        DB::table('worker_ppe_issues')
            ->join('workers', 'workers.id', '=', 'worker_ppe_issues.worker_id')
            ->whereNull('worker_ppe_issues.project_id')
            ->update(['worker_ppe_issues.project_id' => DB::raw('workers.project_id')]);
    }

    public function down(): void
    {
        Schema::table('worker_ppe_issues', function (Blueprint $table) {
            $table->dropForeign(['project_id']);
            $table->dropIndex(['project_id', 'received_at']);
            $table->dropColumn('project_id');
        });
    }
}
