<?php

namespace App\Http\Middleware;

use Closure;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\Cache;
use Symfony\Component\HttpFoundation\Response;

class CacheApiResponse
{
    /**
     * Cache GET requests for specified duration.
     * 
     * Usage: ->middleware('cache.api:60') for 60 second cache
     */
    public function handle(Request $request, Closure $next, int $minutes = 5): Response
    {
        // Only cache GET requests
        if ($request->method() !== 'GET') {
            return $next($request);
        }

        $shouldBypassCache = $request->boolean('refresh', false) || $request->boolean('no_cache', false);
        
        // Don't cache if user is authenticated (personalized data)
        // But allow caching for dashboard/stats endpoints
        $path = $request->path();
        $cacheablePatterns = [
            'api/public-stats',
            'api/dashboard/admin',
            'api/dashboard/user',
            'api/projects/statistics',
        ];
        
        $isCacheable = false;
        foreach ($cacheablePatterns as $pattern) {
            if (str_contains($path, $pattern)) {
                $isCacheable = true;
                break;
            }
        }
        
        if (!$isCacheable) {
            return $next($request);
        }
        
        // Generate cache key based on URL and user
        $userId = $request->user()?->id ?? 'guest';
        $cacheKey = 'api_cache:' . $userId . ':' . md5($request->fullUrl());

        if ($shouldBypassCache) {
            Cache::forget($cacheKey);
        }
        
        // Return cached response if exists
        if (!$shouldBypassCache && Cache::has($cacheKey)) {
            $cached = Cache::get($cacheKey);
            return response()->json($cached['data'], $cached['status'])
                ->header('X-Cache', 'HIT')
                ->header('X-Cache-TTL', $minutes * 60);
        }
        
        // Get fresh response
        $response = $next($request);
        
        // Only cache successful JSON responses
        if ($response->isSuccessful() && str_contains($response->headers->get('Content-Type', ''), 'json')) {
            $data = json_decode($response->getContent(), true);
            Cache::put($cacheKey, [
                'data' => $data,
                'status' => $response->getStatusCode(),
            ], now()->addMinutes($minutes));
            
            $response->headers->set('X-Cache', 'MISS');
        }
        
        return $response;
    }
}
