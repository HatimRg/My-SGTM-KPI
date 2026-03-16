<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        Schema::table('library_documents', function (Blueprint $table) {
            $table->boolean('is_sds')->default(false)->after('folder_id');
            $table->string('sds_public_token', 128)->nullable()->after('is_sds');
            $table->json('sds_pictograms')->nullable()->after('sds_public_token');

            $table->string('sds_qr_pdf_path')->nullable()->after('sds_pictograms');
            $table->string('sds_tag_pdf_path')->nullable()->after('sds_qr_pdf_path');

            $table->index(['is_sds']);
            $table->unique('sds_public_token');
        });
    }

    public function down(): void
    {
        Schema::table('library_documents', function (Blueprint $table) {
            $table->dropUnique(['sds_public_token']);
            $table->dropIndex(['is_sds']);

            $table->dropColumn('sds_tag_pdf_path');
            $table->dropColumn('sds_qr_pdf_path');
            $table->dropColumn('sds_pictograms');
            $table->dropColumn('sds_public_token');
            $table->dropColumn('is_sds');
        });
    }
};
