<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Schema;

class CreatePpeProjectStocksTable extends Migration
{
    public function up(): void
    {
        Schema::create('ppe_project_stocks', function (Blueprint $table) {
            $table->id();
            $table->foreignId('project_id')->constrained('projects')->onDelete('cascade');
            $table->foreignId('ppe_item_id')->constrained('ppe_items')->onDelete('cascade');
            $table->unsignedInteger('stock_quantity')->default(0);
            $table->unsignedInteger('low_stock_threshold')->default(0);
            $table->timestamp('low_stock_notified_at')->nullable();
            $table->timestamps();

            $table->unique(['project_id', 'ppe_item_id']);
            $table->index(['project_id', 'stock_quantity']);
        });

        // Initialize per-project stock rows for existing projects and PPE items.
        $projects = DB::table('projects')->select('id')->get();
        $items = DB::table('ppe_items')->select('id')->get();
        $now = now();

        foreach ($projects as $project) {
            foreach ($items as $item) {
                DB::table('ppe_project_stocks')->updateOrInsert(
                    ['project_id' => $project->id, 'ppe_item_id' => $item->id],
                    ['stock_quantity' => 0, 'low_stock_threshold' => 0, 'created_at' => $now, 'updated_at' => $now]
                );
            }
        }
    }

    public function down(): void
    {
        Schema::dropIfExists('ppe_project_stocks');
    }
}
