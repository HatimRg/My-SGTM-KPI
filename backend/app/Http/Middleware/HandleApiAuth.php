<?php

namespace App\Http\Middleware;

use Closure;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\Auth;
use Symfony\Component\HttpFoundation\Response;

class HandleApiAuth
{
    /**
     * Handle an incoming request.
     *
     * @param  \Illuminate\Http\Request  $request
     * @param  \Closure(\Illuminate\Http\Request): (\Symfony\Component\HttpFoundation\Response)  $next
     * @return \Symfony\Component\HttpFoundation\Response
     */
    public function handle(Request $request, Closure $next): Response
    {
        // Try to authenticate with Sanctum token
        if ($request->bearerToken()) {
            try {
                $user = Auth::guard('sanctum')->user();
                if ($user) {
                    Auth::setUser($user);
                    return $next($request);
                }
            } catch (\Exception $e) {
                // Token invalid, continue to 401 response
            }
        }
        
        // No valid authentication, return 401 instead of 500
        return response()->json([
            'success' => false,
            'message' => 'Unauthenticated. Please login to access this resource.',
            'data' => null
        ], 401);
    }
}
