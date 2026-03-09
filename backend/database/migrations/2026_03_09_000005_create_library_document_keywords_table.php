<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        Schema::create('library_document_keywords', function (Blueprint $table) {
            $table->id();
            $table->foreignId('document_id')->constrained('library_documents')->cascadeOnDelete();
            $table->string('keyword', 255);
            $table->timestamps();

            $table->index(['document_id']);
            $table->index(['keyword']);
        });
    }

    public function down(): void
    {
        Schema::dropIfExists('library_document_keywords');
    }
};
