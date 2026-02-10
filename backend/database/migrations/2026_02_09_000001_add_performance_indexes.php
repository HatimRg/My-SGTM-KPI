<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;
use Illuminate\Support\Facades\DB;

return new class extends Migration
{
    /**
     * Performance optimization indexes for 150-200+ concurrent users.
     */
    public function up(): void
    {
        // Helper to check if index exists
        $indexExists = function ($table, $indexName) {
            $indexes = DB::select("SHOW INDEX FROM `{$table}` WHERE Key_name = ?", [$indexName]);
            return count($indexes) > 0;
        };

        // Workers table - frequently filtered by project_id
        Schema::table('workers', function (Blueprint $table) use ($indexExists) {
            if (!$indexExists('workers', 'workers_project_id_index')) {
                $table->index('project_id', 'workers_project_id_index');
            }
            if (!$indexExists('workers', 'workers_project_active_index')) {
                $table->index(['project_id', 'is_active'], 'workers_project_active_index');
            }
            if (!$indexExists('workers', 'workers_entreprise_index')) {
                $table->index(['entreprise'], 'workers_entreprise_index');
            }
            if (!$indexExists('workers', 'workers_fonction_index')) {
                $table->index(['fonction'], 'workers_fonction_index');
            }
        });

        // Worker trainings - frequently filtered by worker_id and expiry
        Schema::table('worker_trainings', function (Blueprint $table) use ($indexExists) {
            if (!$indexExists('worker_trainings', 'worker_trainings_worker_id_index')) {
                $table->index('worker_id', 'worker_trainings_worker_id_index');
            }
            if (!$indexExists('worker_trainings', 'worker_trainings_worker_expiry_index')) {
                $table->index(['worker_id', 'expiry_date'], 'worker_trainings_worker_expiry_index');
            }
        });

        // Worker qualifications - frequently filtered by worker_id and expiry
        Schema::table('worker_qualifications', function (Blueprint $table) use ($indexExists) {
            if (!$indexExists('worker_qualifications', 'worker_qualifications_worker_id_index')) {
                $table->index('worker_id', 'worker_qualifications_worker_id_index');
            }
            if (!$indexExists('worker_qualifications', 'worker_qualifications_worker_expiry_index')) {
                $table->index(['worker_id', 'expiry_date'], 'worker_qualifications_worker_expiry_index');
            }
        });

        // Worker medical aptitudes - frequently filtered by worker_id and expiry
        Schema::table('worker_medical_aptitudes', function (Blueprint $table) use ($indexExists) {
            if (!$indexExists('worker_medical_aptitudes', 'worker_medical_aptitudes_worker_id_index')) {
                $table->index('worker_id', 'worker_medical_aptitudes_worker_id_index');
            }
            if (!$indexExists('worker_medical_aptitudes', 'worker_medical_aptitudes_worker_expiry_index')) {
                $table->index(['worker_id', 'expiry_date'], 'worker_medical_aptitudes_worker_expiry_index');
            }
        });

        // Worker sanctions - frequently filtered by worker_id
        Schema::table('worker_sanctions', function (Blueprint $table) use ($indexExists) {
            if (!$indexExists('worker_sanctions', 'worker_sanctions_worker_id_index')) {
                $table->index('worker_id', 'worker_sanctions_worker_id_index');
            }
        });

        // HSE Events - frequently filtered for dashboard queries
        Schema::table('hse_events', function (Blueprint $table) use ($indexExists) {
            if (!$indexExists('hse_events', 'hse_events_year_project_index')) {
                $table->index(['event_year', 'project_id'], 'hse_events_year_project_index');
            }
            if (!$indexExists('hse_events', 'hse_events_year_week_index')) {
                $table->index(['event_year', 'week_number'], 'hse_events_year_week_index');
            }
            if (!$indexExists('hse_events', 'hse_events_pole_index')) {
                $table->index('pole', 'hse_events_pole_index');
            }
        });

        // SOR Reports - frequently filtered for analytics
        Schema::table('sor_reports', function (Blueprint $table) use ($indexExists) {
            if (!$indexExists('sor_reports', 'sor_reports_project_status_index')) {
                $table->index(['project_id', 'status'], 'sor_reports_project_status_index');
            }
            if (!$indexExists('sor_reports', 'sor_reports_category_index')) {
                $table->index('category', 'sor_reports_category_index');
            }
        });

        // Projects - frequently filtered by pole
        Schema::table('projects', function (Blueprint $table) use ($indexExists) {
            if (!$indexExists('projects', 'projects_pole_index')) {
                $table->index('pole', 'projects_pole_index');
            }
        });

        // PPE Issues - frequently filtered by worker_id
        Schema::table('worker_ppe_issues', function (Blueprint $table) use ($indexExists) {
            if (!$indexExists('worker_ppe_issues', 'worker_ppe_issues_worker_id_index')) {
                $table->index('worker_id', 'worker_ppe_issues_worker_id_index');
            }
        });

        // Monthly KPI Measurements - frequently filtered for dashboard
        Schema::table('monthly_kpi_measurements', function (Blueprint $table) use ($indexExists) {
            if (!$indexExists('monthly_kpi_measurements', 'monthly_kpi_year_month_project_index')) {
                $table->index(['year', 'month', 'project_id'], 'monthly_kpi_year_month_project_index');
            }
            if (!$indexExists('monthly_kpi_measurements', 'monthly_kpi_year_indicator_index')) {
                $table->index(['year', 'indicator'], 'monthly_kpi_year_indicator_index');
            }
        });

        // Lighting Measurements - frequently filtered for dashboard
        Schema::table('lighting_measurements', function (Blueprint $table) use ($indexExists) {
            if (!$indexExists('lighting_measurements', 'lighting_year_month_project_index')) {
                $table->index(['year', 'month', 'project_id'], 'lighting_year_month_project_index');
            }
        });

        // Regulatory Watch Submissions - frequently filtered for compliance
        Schema::table('regulatory_watch_submissions', function (Blueprint $table) use ($indexExists) {
            if (!$indexExists('regulatory_watch_submissions', 'regulatory_watch_year_project_index')) {
                $table->index(['week_year', 'project_id'], 'regulatory_watch_year_project_index');
            }
        });
    }

    public function down(): void
    {
        Schema::table('workers', function (Blueprint $table) {
            $table->dropIndex('workers_project_id_index');
            $table->dropIndex('workers_project_active_index');
            $table->dropIndex('workers_entreprise_index');
            $table->dropIndex('workers_fonction_index');
        });

        Schema::table('worker_trainings', function (Blueprint $table) {
            $table->dropIndex('worker_trainings_worker_id_index');
            $table->dropIndex('worker_trainings_worker_expiry_index');
        });

        Schema::table('worker_qualifications', function (Blueprint $table) {
            $table->dropIndex('worker_qualifications_worker_id_index');
            $table->dropIndex('worker_qualifications_worker_expiry_index');
        });

        Schema::table('worker_medical_aptitudes', function (Blueprint $table) {
            $table->dropIndex('worker_medical_aptitudes_worker_id_index');
            $table->dropIndex('worker_medical_aptitudes_worker_expiry_index');
        });

        Schema::table('worker_sanctions', function (Blueprint $table) {
            $table->dropIndex('worker_sanctions_worker_id_index');
        });

        Schema::table('hse_events', function (Blueprint $table) {
            $table->dropIndex('hse_events_year_project_index');
            $table->dropIndex('hse_events_year_week_index');
            $table->dropIndex('hse_events_pole_index');
        });

        Schema::table('sor_reports', function (Blueprint $table) {
            $table->dropIndex('sor_reports_project_status_index');
            $table->dropIndex('sor_reports_category_index');
        });

        Schema::table('projects', function (Blueprint $table) {
            $table->dropIndex('projects_pole_index');
        });

        Schema::table('worker_ppe_issues', function (Blueprint $table) {
            $table->dropIndex('worker_ppe_issues_worker_id_index');
        });

        Schema::table('monthly_kpi_measurements', function (Blueprint $table) {
            $table->dropIndex('monthly_kpi_year_month_project_index');
            $table->dropIndex('monthly_kpi_year_indicator_index');
        });

        Schema::table('lighting_measurements', function (Blueprint $table) {
            $table->dropIndex('lighting_year_month_project_index');
        });

        Schema::table('regulatory_watch_submissions', function (Blueprint $table) {
            $table->dropIndex('regulatory_watch_year_project_index');
        });
    }
};
