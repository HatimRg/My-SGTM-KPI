<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        Schema::table('community_posts', function (Blueprint $table) {
            $table->timestamp('featured_from')->nullable()->after('is_featured');
            $table->timestamp('featured_until')->nullable()->after('featured_from');

            $table->index(['is_featured', 'featured_from', 'featured_until']);
        });
    }

    public function down(): void
    {
        Schema::table('community_posts', function (Blueprint $table) {
            if (Schema::hasColumn('community_posts', 'featured_until')) {
                $table->dropIndex(['is_featured', 'featured_from', 'featured_until']);
                $table->dropColumn(['featured_from', 'featured_until']);
            }
        });
    }
};
