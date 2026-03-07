<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        Schema::create('community_posts', function (Blueprint $table) {
            $table->id();
            $table->foreignId('user_id')->constrained('users')->cascadeOnDelete();
            $table->foreignId('project_id')->nullable()->constrained('projects')->nullOnDelete();
            $table->string('category', 50);
            $table->longText('body_raw');
            $table->longText('body_normalized')->nullable();
            $table->string('status', 30)->default('published');
            $table->boolean('is_featured')->default(false);
            $table->softDeletes();
            $table->timestamps();

            $table->index(['project_id', 'category']);
            $table->index(['status', 'created_at']);
        });

        Schema::create('community_post_images', function (Blueprint $table) {
            $table->id();
            $table->foreignId('post_id')->constrained('community_posts')->cascadeOnDelete();
            $table->string('file_path');
            $table->string('thumbnail_path')->nullable();
            $table->unsignedSmallInteger('sort_order')->default(0);
            $table->string('original_name')->nullable();
            $table->string('mime_type', 120)->nullable();
            $table->unsignedBigInteger('size_bytes')->nullable();
            $table->timestamps();

            $table->index(['post_id', 'sort_order']);
        });

        Schema::create('community_post_comments', function (Blueprint $table) {
            $table->id();
            $table->foreignId('post_id')->constrained('community_posts')->cascadeOnDelete();
            $table->foreignId('user_id')->constrained('users')->cascadeOnDelete();
            $table->longText('body_raw');
            $table->longText('body_normalized')->nullable();
            $table->string('status', 30)->default('published');
            $table->softDeletes();
            $table->timestamps();

            $table->index(['post_id', 'created_at']);
        });

        Schema::create('community_post_reactions', function (Blueprint $table) {
            $table->id();
            $table->foreignId('post_id')->constrained('community_posts')->cascadeOnDelete();
            $table->foreignId('user_id')->constrained('users')->cascadeOnDelete();
            $table->string('reaction_type', 30);
            $table->timestamps();

            $table->unique(['post_id', 'user_id']);
            $table->index(['post_id', 'reaction_type']);
        });

        Schema::create('community_post_hashtags', function (Blueprint $table) {
            $table->id();
            $table->foreignId('post_id')->constrained('community_posts')->cascadeOnDelete();
            $table->string('tag_original', 100);
            $table->string('tag_normalized', 100);
            $table->timestamps();

            $table->index(['post_id', 'tag_normalized']);
            $table->index(['tag_normalized']);
        });

        Schema::table('users', function (Blueprint $table) {
            $table->timestamp('comments_banned_until')->nullable()->after('is_active');
        });
    }

    public function down(): void
    {
        Schema::table('users', function (Blueprint $table) {
            if (Schema::hasColumn('users', 'comments_banned_until')) {
                $table->dropColumn('comments_banned_until');
            }
        });

        Schema::dropIfExists('community_post_hashtags');
        Schema::dropIfExists('community_post_reactions');
        Schema::dropIfExists('community_post_comments');
        Schema::dropIfExists('community_post_images');
        Schema::dropIfExists('community_posts');
    }
};
