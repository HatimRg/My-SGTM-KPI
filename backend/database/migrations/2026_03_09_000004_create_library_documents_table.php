<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        Schema::create('library_documents', function (Blueprint $table) {
            $table->id();
            $table->foreignId('folder_id')->nullable()->constrained('library_folders')->nullOnDelete();

            $table->string('title', 255);
            $table->string('original_name', 255)->nullable();
            $table->string('file_path');
            $table->string('thumbnail_path')->nullable();
            $table->string('file_type', 20);
            $table->string('mime_type', 120)->nullable();
            $table->unsignedBigInteger('size_bytes')->nullable();

            $table->foreignId('uploaded_by')->nullable()->constrained('users')->nullOnDelete();

            $table->string('status', 30)->default('processing');
            $table->string('language', 10)->nullable();
            $table->text('error_message')->nullable();

            $table->timestamps();

            $table->index(['folder_id', 'created_at']);
            $table->index(['file_type']);
            $table->index(['status']);
        });
    }

    public function down(): void
    {
        Schema::dropIfExists('library_documents');
    }
};
