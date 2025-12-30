<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Factories\HasFactory;
use Illuminate\Database\Eloquent\Model;

class PpeItem extends Model
{
    use HasFactory;

    protected $table = 'ppe_items';

    protected $fillable = [
        'name',
        'is_system',
        'created_by',
    ];

    protected $casts = [
        'is_system' => 'boolean',
    ];

    public function creator()
    {
        return $this->belongsTo(User::class, 'created_by');
    }

    public function issues()
    {
        return $this->hasMany(WorkerPpeIssue::class, 'ppe_item_id');
    }
}
