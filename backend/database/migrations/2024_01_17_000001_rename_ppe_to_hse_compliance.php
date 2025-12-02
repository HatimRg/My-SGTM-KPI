<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        if (Schema::hasColumn('kpi_reports', 'ppe_compliance_rate')) {
            Schema::table('kpi_reports', function (Blueprint $table) {
                $table->renameColumn('ppe_compliance_rate', 'hse_compliance_rate');
            });
        }
    }

    public function down(): void
    {
        if (Schema::hasColumn('kpi_reports', 'hse_compliance_rate')) {
            Schema::table('kpi_reports', function (Blueprint $table) {
                $table->renameColumn('hse_compliance_rate', 'ppe_compliance_rate');
            });
        }
    }
};
