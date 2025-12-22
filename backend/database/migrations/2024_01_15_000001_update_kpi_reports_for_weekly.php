<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        Schema::table('kpi_reports', function (Blueprint $table) {
            // Add week number and date range for weekly reporting (1-52, Sat-Fri weeks)
            $table->unsignedTinyInteger('week_number')->nullable()->after('report_year')->comment('Week 1-52, Saturday to Friday');
            $table->date('start_date')->nullable()->after('week_number');
            $table->date('end_date')->nullable()->after('start_date');
            
            // Add rejection reason field
            $table->text('rejection_reason')->nullable()->after('status');
            $table->timestamp('rejected_at')->nullable()->after('rejection_reason');
            $table->foreignId('rejected_by')->nullable()->after('rejected_at')->constrained('users')->nullOnDelete();
            
            // Add resubmission tracking
            $table->unsignedInteger('submission_count')->default(1)->after('rejected_by');
            $table->timestamp('last_submitted_at')->nullable()->after('submission_count');
        });

        // Drop the unique monthly constraint and add weekly one
        Schema::table('kpi_reports', function (Blueprint $table) {
            $table->dropUnique('unique_monthly_report');
        });

        Schema::table('kpi_reports', function (Blueprint $table) {
            $table->unique(['project_id', 'week_number', 'report_year'], 'unique_weekly_report');
        });
    }

    public function down(): void
    {
        Schema::table('kpi_reports', function (Blueprint $table) {
            $table->dropUnique('unique_weekly_report');
        });

        Schema::table('kpi_reports', function (Blueprint $table) {
            $table->dropColumn([
                'week_number',
                'start_date', 
                'end_date',
                'rejection_reason',
                'rejected_at',
                'rejected_by',
                'submission_count',
                'last_submitted_at'
            ]);
        });

        Schema::table('kpi_reports', function (Blueprint $table) {
            $table->unique(['project_id', 'report_month', 'report_year'], 'unique_monthly_report');
        });
    }
};
