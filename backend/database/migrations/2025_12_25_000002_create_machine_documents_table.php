<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

class CreateMachineDocumentsTable extends Migration
{
    public function up()
    {
        Schema::create('machine_documents', function (Blueprint $table) {
            $table->id();
            $table->foreignId('machine_id')->constrained('machines')->cascadeOnDelete();
            $table->string('document_key');
            $table->string('document_label');
            $table->date('start_date')->nullable();
            $table->date('expiry_date')->nullable();
            $table->string('file_path')->nullable();
            $table->unsignedBigInteger('file_size')->nullable();
            $table->foreignId('uploaded_by')->nullable()->constrained('users')->nullOnDelete();
            $table->timestamps();

            $table->index(['machine_id', 'document_key']);
            $table->index('expiry_date');
        });
    }

    public function down()
    {
        Schema::dropIfExists('machine_documents');
    }
}
