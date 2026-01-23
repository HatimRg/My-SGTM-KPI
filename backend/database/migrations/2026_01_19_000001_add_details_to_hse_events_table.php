<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        Schema::table('hse_events', function (Blueprint $table) {
            if (!Schema::hasColumn('hse_events', 'details')) {
                $table->json('details')->nullable()->after('location');
            }
        });
    }

    public function down(): void
    {
        Schema::table('hse_events', function (Blueprint $table) {
            if (Schema::hasColumn('hse_events', 'details')) {
                $table->dropColumn('details');
            }
        });
    }
};
