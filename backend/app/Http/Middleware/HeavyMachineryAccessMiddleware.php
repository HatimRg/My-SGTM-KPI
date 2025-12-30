<?php

namespace App\Http\Middleware;

use Closure;
use Illuminate\Http\Request;
use Symfony\Component\HttpFoundation\Response;

class HeavyMachineryAccessMiddleware
{
    public function handle(Request $request, Closure $next): Response
    {
        $user = $request->user();
        if (!$user) {
            return response()->json([
                'success' => false,
                'message' => 'Unauthorized',
            ], 401);
        }

        $role = (string) $user->role;
        if ($role === 'hr' || $role === 'hr_director') {
            return response()->json([
                'success' => false,
                'message' => 'Access denied.',
            ], 403);
        }

        return $next($request);
    }
}
