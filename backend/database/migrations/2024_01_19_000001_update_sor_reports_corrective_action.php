<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        Schema::table('sor_reports', function (Blueprint $table) {
            // Corrective action fields
            $table->date('corrective_action_date')->nullable()->after('corrective_action');
            $table->time('corrective_action_time')->nullable()->after('corrective_action_date');
            $table->string('corrective_action_photo_path')->nullable()->after('corrective_action_time');
            
            // Pinned status for visibility
            $table->boolean('is_pinned')->default(false)->after('status');
            $table->timestamp('pinned_at')->nullable()->after('is_pinned');
        });
    }

    public function down(): void
    {
        Schema::table('sor_reports', function (Blueprint $table) {
            $table->dropColumn([
                'corrective_action_date',
                'corrective_action_time',
                'corrective_action_photo_path',
                'is_pinned',
                'pinned_at',
            ]);
        });
    }
};
