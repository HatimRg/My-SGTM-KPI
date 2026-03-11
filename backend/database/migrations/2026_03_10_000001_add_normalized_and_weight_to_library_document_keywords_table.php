<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        Schema::table('library_document_keywords', function (Blueprint $table) {
            $table->string('keyword_normalized', 255)->nullable()->after('keyword');
            $table->unsignedSmallInteger('weight')->default(0)->after('keyword_normalized');

            $table->index(['keyword_normalized']);
            $table->index(['document_id', 'weight']);
        });
    }

    public function down(): void
    {
        Schema::table('library_document_keywords', function (Blueprint $table) {
            $table->dropIndex(['keyword_normalized']);
            $table->dropIndex(['document_id', 'weight']);

            $table->dropColumn(['keyword_normalized', 'weight']);
        });
    }
};
