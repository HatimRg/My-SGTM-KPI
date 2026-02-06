<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        Schema::table('projects', function (Blueprint $table) {
            if (!Schema::hasColumn('projects', 'is_grouping')) {
                $table->boolean('is_grouping')->default(false)->after('client_name');
                $table->index('is_grouping');
            }
        });
    }

    public function down(): void
    {
        Schema::table('projects', function (Blueprint $table) {
            if (Schema::hasColumn('projects', 'is_grouping')) {
                $table->dropIndex(['is_grouping']);
                $table->dropColumn('is_grouping');
            }
        });
    }
};
