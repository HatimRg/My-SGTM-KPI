<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

class CreateWorkersTable extends Migration
{
    /**
     * Run the migrations.
     *
     * @return void
     */
    public function up()
    {
        Schema::create('workers', function (Blueprint $table) {
            $table->id();
            $table->string('nom'); // Last name
            $table->string('prenom'); // First name
            $table->string('fonction')->nullable(); // Job title/function
            $table->string('cin')->unique(); // National ID - unique identifier
            $table->date('date_naissance')->nullable(); // Date of birth
            $table->string('entreprise')->nullable(); // Company
            $table->foreignId('project_id')->nullable()->constrained()->nullOnDelete();
            $table->date('date_entree')->nullable(); // Entry date
            $table->boolean('is_active')->default(true);
            $table->foreignId('created_by')->nullable()->constrained('users')->nullOnDelete();
            $table->foreignId('updated_by')->nullable()->constrained('users')->nullOnDelete();
            $table->timestamps();
            
            $table->index('cin');
            $table->index('is_active');
        });
    }

    /**
     * Reverse the migrations.
     *
     * @return void
     */
    public function down()
    {
        Schema::dropIfExists('workers');
    }
}
