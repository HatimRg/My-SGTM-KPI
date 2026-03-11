<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        Schema::table('library_folders', function (Blueprint $table) {
            $table->boolean('is_public')->default(false)->after('created_by');
            $table->index(['is_public']);
        });
    }

    public function down(): void
    {
        Schema::table('library_folders', function (Blueprint $table) {
            $table->dropIndex(['is_public']);
            $table->dropColumn('is_public');
        });
    }
};
