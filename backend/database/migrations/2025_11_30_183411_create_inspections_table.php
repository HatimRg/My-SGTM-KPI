<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

class CreateInspectionsTable extends Migration
{
    /**
     * Run the migrations.
     *
     * @return void
     */
    public function up()
    {
        Schema::create('inspections', function (Blueprint $table) {
            $table->id();
            $table->foreignId('project_id')->constrained()->onDelete('cascade');
            $table->foreignId('created_by')->constrained('users')->onDelete('cascade');
            $table->date('inspection_date');
            $table->string('nature'); // sst, environment, third_party, equipment, other
            $table->string('nature_other')->nullable(); // if nature is 'other'
            $table->enum('type', ['internal', 'external'])->default('internal');
            $table->string('location')->nullable();
            $table->date('start_date');
            $table->date('end_date')->nullable();
            $table->string('zone')->nullable();
            $table->string('inspector');
            $table->string('enterprise')->nullable();
            $table->enum('status', ['open', 'closed'])->default('open');
            $table->integer('week_number');
            $table->integer('week_year');
            $table->text('notes')->nullable();
            $table->timestamps();
            $table->softDeletes();
            
            $table->index(['project_id', 'week_number', 'week_year']);
        });
    }

    /**
     * Reverse the migrations.
     *
     * @return void
     */
    public function down()
    {
        Schema::dropIfExists('inspections');
    }
}
