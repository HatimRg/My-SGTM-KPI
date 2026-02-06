<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        Schema::table('notifications', function (Blueprint $table) {
            $table->foreignId('sent_by')->nullable()->after('user_id')->constrained('users')->nullOnDelete();
            $table->string('urgency', 20)->nullable()->after('type');
            $table->string('dedupe_key', 64)->nullable()->after('urgency');

            $table->index('sent_by');
            $table->index(['type', 'urgency']);
            $table->unique(['user_id', 'dedupe_key'], 'notifications_user_dedupe_unique');
        });
    }

    public function down(): void
    {
        Schema::table('notifications', function (Blueprint $table) {
            $table->dropUnique('notifications_user_dedupe_unique');
            $table->dropIndex(['sent_by']);
            $table->dropIndex(['type', 'urgency']);

            $table->dropForeign(['sent_by']);
            $table->dropColumn(['sent_by', 'urgency', 'dedupe_key']);
        });
    }
};
