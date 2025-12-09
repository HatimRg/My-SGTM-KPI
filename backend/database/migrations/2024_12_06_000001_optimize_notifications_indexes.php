<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        Schema::table('notifications', function (Blueprint $table) {
            // Composite index for unread count by type query
            $table->index(['user_id', 'read_at', 'type'], 'notifications_user_unread_type_index');
            
            // Index for created_at for faster ordering
            $table->index(['user_id', 'created_at'], 'notifications_user_created_index');
        });
    }

    public function down(): void
    {
        Schema::table('notifications', function (Blueprint $table) {
            $table->dropIndex('notifications_user_unread_type_index');
            $table->dropIndex('notifications_user_created_index');
        });
    }
};
