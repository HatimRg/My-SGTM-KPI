<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        Schema::table('kpi_reports', function (Blueprint $table) {
            // Taux de conformité par rapport à la médecine de travail
            $table->decimal('medical_compliance_rate', 5, 2)->default(0)->after('hse_compliance_rate');
            
            // Suivi du bruit (niveau en dB ou nombre de mesures)
            $table->decimal('noise_monitoring', 10, 2)->default(0)->after('medical_compliance_rate');
            
            // Consommation d'énergie - Eau (en m³)
            $table->decimal('water_consumption', 15, 2)->default(0)->after('noise_monitoring');
            
            // Consommation d'énergie - Électricité (en kWh)
            $table->decimal('electricity_consumption', 15, 2)->default(0)->after('water_consumption');
            
            // Permis de travail (separate from trainings_conducted)
            $table->unsignedInteger('work_permits')->default(0)->after('electricity_consumption');
        });
    }

    public function down(): void
    {
        Schema::table('kpi_reports', function (Blueprint $table) {
            $table->dropColumn([
                'medical_compliance_rate',
                'noise_monitoring',
                'water_consumption',
                'electricity_consumption',
                'work_permits'
            ]);
        });
    }
};
