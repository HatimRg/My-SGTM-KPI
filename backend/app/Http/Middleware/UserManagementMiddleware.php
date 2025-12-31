<?php

namespace App\Http\Middleware;

use Closure;
use Illuminate\Http\Request;
use Symfony\Component\HttpFoundation\Response;

class UserManagementMiddleware
{
    public function handle(Request $request, Closure $next): Response
    {
        $user = $request->user();

        if (!$user || !($user->isAdminLike() || $user->isHseManager() || $user->isResponsable())) {
            return response()->json([
                'success' => false,
                'message' => 'Access denied. User management privileges required.',
            ], 403);
        }

        return $next($request);
    }
}
