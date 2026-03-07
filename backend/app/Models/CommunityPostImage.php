<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Factories\HasFactory;
use Illuminate\Database\Eloquent\Model;

class CommunityPostImage extends Model
{
    use HasFactory;

    protected $fillable = [
        'post_id',
        'file_path',
        'thumbnail_path',
        'sort_order',
        'original_name',
        'mime_type',
        'size_bytes',
    ];

    public function post()
    {
        return $this->belongsTo(CommunityPost::class, 'post_id');
    }
}
