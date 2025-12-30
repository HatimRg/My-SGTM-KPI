<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Factories\HasFactory;
use Illuminate\Database\Eloquent\Model;

class PpeProjectStock extends Model
{
    use HasFactory;

    protected $table = 'ppe_project_stocks';

    protected $fillable = [
        'project_id',
        'ppe_item_id',
        'stock_quantity',
        'low_stock_threshold',
        'low_stock_notified_at',
    ];

    protected $casts = [
        'stock_quantity' => 'integer',
        'low_stock_threshold' => 'integer',
        'low_stock_notified_at' => 'datetime',
    ];

    public function project()
    {
        return $this->belongsTo(Project::class);
    }

    public function ppeItem()
    {
        return $this->belongsTo(PpeItem::class, 'ppe_item_id');
    }
}
