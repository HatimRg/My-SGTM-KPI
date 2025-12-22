<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

class CreateSubcontractorOpeningDocumentsTable extends Migration
{
    public function up()
    {
        if (Schema::hasTable('subcontractor_opening_documents')) {
            return;
        }

        Schema::create('subcontractor_opening_documents', function (Blueprint $table) {
            $table->id();
            $table->foreignId('subcontractor_opening_id')->constrained('subcontractor_openings')->onDelete('cascade');
            $table->string('document_key');
            $table->string('document_label');
            $table->date('start_date')->nullable();
            $table->date('expiry_date')->nullable();
            $table->string('file_path')->nullable();
            $table->unsignedBigInteger('file_size')->nullable();
            $table->unsignedBigInteger('compressed_size')->nullable();
            $table->boolean('was_compressed')->default(false);
            $table->foreignId('uploaded_by')->nullable()->constrained('users');
            $table->timestamps();

            $table->unique(['subcontractor_opening_id', 'document_key'], 'sub_open_docs_opening_key_uq');
            $table->index(['document_key']);
        });
    }

    public function down()
    {
        Schema::dropIfExists('subcontractor_opening_documents');
    }
}
