<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Schema;

class CreatePpeItemsTable extends Migration
{
    public function up(): void
    {
        Schema::create('ppe_items', function (Blueprint $table) {
            $table->id();
            $table->string('name', 255);
            $table->unsignedInteger('stock_quantity')->default(0);
            $table->boolean('is_system')->default(false);
            $table->foreignId('created_by')->nullable()->constrained('users')->nullOnDelete();
            $table->timestamps();

            $table->unique('name');
            $table->index('is_system');
        });

        $defaults = [
            'Casque de sécurité',
            'Lunettes de protection',
            'Masque de soudage',
            'masque faciel',
            'Bouchons d’oreilles',
            'Casque antibruit',
            'Masque antipoussière',
            'Masque respiratoire à cartouches',
            'Gants de travail',
            'Gants de protection chimique',
            'Gants isolants électriques',
            'Chaussures de sécurité',
            'Bottes de sécurité',
            'Gilet haute visibilité',
            'Combinaison de travail',
            'Combinaison imperméable',
            'Harnais de sécurité',
            'Tablier de soudage',
        ];

        $now = now();
        foreach ($defaults as $name) {
            DB::table('ppe_items')->updateOrInsert(
                ['name' => $name],
                ['stock_quantity' => 0, 'is_system' => true, 'created_at' => $now, 'updated_at' => $now]
            );
        }
    }

    public function down(): void
    {
        Schema::dropIfExists('ppe_items');
    }
}
