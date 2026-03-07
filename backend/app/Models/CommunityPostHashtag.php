<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Factories\HasFactory;
use Illuminate\Database\Eloquent\Model;

class CommunityPostHashtag extends Model
{
    use HasFactory;

    protected $fillable = [
        'post_id',
        'tag_original',
        'tag_normalized',
    ];

    public function post()
    {
        return $this->belongsTo(CommunityPost::class, 'post_id');
    }
}
