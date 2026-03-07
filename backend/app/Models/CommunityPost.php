<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Factories\HasFactory;
use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\SoftDeletes;

class CommunityPost extends Model
{
    use HasFactory, SoftDeletes;

    protected $fillable = [
        'user_id',
        'project_id',
        'category',
        'body_raw',
        'body_normalized',
        'status',
        'is_featured',
    ];

    protected $casts = [
        'is_featured' => 'boolean',
    ];

    public function user()
    {
        return $this->belongsTo(User::class);
    }

    public function project()
    {
        return $this->belongsTo(Project::class);
    }

    public function images()
    {
        return $this->hasMany(CommunityPostImage::class, 'post_id')->orderBy('sort_order');
    }

    public function comments()
    {
        return $this->hasMany(CommunityPostComment::class, 'post_id')->where('status', 'published')->latest();
    }

    public function reactions()
    {
        return $this->hasMany(CommunityPostReaction::class, 'post_id');
    }

    public function hashtags()
    {
        return $this->hasMany(CommunityPostHashtag::class, 'post_id');
    }
}
