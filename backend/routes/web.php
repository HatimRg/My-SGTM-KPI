<?php

use Illuminate\Support\Facades\Route;

Route::get('/', function () {
    return view('welcome');
});

Route::get('/api', function () {
    return response()->json([
        'name' => 'HSE KPI Tracker API',
        'version' => '1.0.0',
        'status' => 'running'
    ]);
});

// Handle all other routes - serve the frontend (React Router)
Route::get('/{path?}', function () {
    return view('welcome');
})->where('path', '^(?!api|storage).*')->fallback();
