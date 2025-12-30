<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

class CreateWorkerPpeIssuesTable extends Migration
{
    public function up(): void
    {
        Schema::create('worker_ppe_issues', function (Blueprint $table) {
            $table->id();
            $table->foreignId('worker_id')->constrained('workers')->onDelete('cascade');
            $table->foreignId('ppe_item_id')->constrained('ppe_items')->onDelete('restrict');
            $table->unsignedInteger('quantity')->default(1);
            $table->date('received_at');
            $table->foreignId('issued_by')->nullable()->constrained('users')->nullOnDelete();
            $table->timestamps();

            $table->index(['worker_id', 'received_at']);
            $table->index('ppe_item_id');
        });
    }

    public function down(): void
    {
        Schema::dropIfExists('worker_ppe_issues');
    }
}
