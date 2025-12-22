<?php

namespace App\Http\Middleware;

use Closure;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\Cache;
use Illuminate\Support\Facades\Log;
use Symfony\Component\HttpFoundation\Response;

class SecurityMonitor
{
    // Rate limiting thresholds (tuned for production stability)
    const MAX_REQUESTS_PER_MINUTE = 300;
    const MAX_REQUESTS_PER_SECOND = 30;
    const BLOCK_DURATION_MINUTES = 1;
    
    // SQL injection patterns
    const SQL_INJECTION_PATTERNS = [
        // NOTE: Do not treat every single quote as SQLi, to allow natural language text.
        // Use more targeted patterns that match typical SQL injection payloads.
        '/((\%3D)|(=))[^\n]*((\%27)|(\')|(\-\-)|(\%3B)|(;))/i',
        '/\w*((\%27)|(\'))((\%6F)|o|(\%4F))((\%72)|r|(\%52))/i',
        '/((\%27)|(\'))union/i',
        '/exec(\s|\+)+(s|x)p\w+/i',
        '/union(\s+)select/i',
        '/select(\s+).*(\s+)from/i',
        '/insert(\s+)into/i',
        '/delete(\s+)from/i',
        '/drop(\s+)table/i',
        '/update(\s+).*(\s+)set/i',
        '/load_file/i',
        '/into(\s+)outfile/i',
        '/into(\s+)dumpfile/i',
        '/benchmark\s*\(/i',
        '/sleep\s*\(/i',
        '/waitfor\s+delay/i',
    ];
    
    // XSS patterns
    const XSS_PATTERNS = [
        '/<script[^>]*>.*?<\/script>/is',
        '/javascript\s*:/i',
        '/on\w+\s*=/i',
        '/<iframe/i',
        '/<object/i',
        '/<embed/i',
        '/<svg[^>]*onload/i',
    ];
    
    // Path traversal patterns
    const PATH_TRAVERSAL_PATTERNS = [
        '/\.\.\//i',
        '/\.\.\\\/i',
        '/%2e%2e%2f/i',
        '/%2e%2e\//i',
        '/\.%2e\//i',
        '/%2e\.\//i',
    ];

    public function handle(Request $request, Closure $next): Response
    {
        $ip = $request->ip();
        $userAgent = $request->userAgent() ?? 'Unknown';
        $isProd = app()->environment('production');
        
        // In non-production environments, skip rate-limiting/IP-block logic so
        // developers and automated tests are not throttled. Keep it only in prod.
        if ($isProd) {
            // Check if IP is blocked
            if ($this->isBlocked($ip)) {
                $this->logSecurityEvent('blocked_request', $ip, $request, 'IP is currently blocked');
                return response()->json(['error' => 'Too many requests. Please try again later.'], 429);
            }

            // Rate limiting check
            if ($this->isRateLimitExceeded($ip)) {
                $this->blockIp($ip);
                $this->logSecurityEvent('ddos_detected', $ip, $request, 'Rate limit exceeded - possible DDoS');
                return response()->json(['error' => 'Too many requests. Please try again later.'], 429);
            }
        }
        
        // Check for SQL injection
        if ($this->detectSqlInjection($request)) {
            $this->incrementThreatScore($ip, 10);
            $this->logSecurityEvent('sql_injection_attempt', $ip, $request, 'SQL injection pattern detected');
            return response()->json(['error' => 'Invalid request.'], 400);
        }
        
        // Check for XSS
        if ($this->detectXss($request)) {
            $this->incrementThreatScore($ip, 5);
            $this->logSecurityEvent('xss_attempt', $ip, $request, 'XSS pattern detected');
            return response()->json(['error' => 'Invalid request.'], 400);
        }
        
        // Check for path traversal
        if ($this->detectPathTraversal($request)) {
            $this->incrementThreatScore($ip, 10);
            $this->logSecurityEvent('path_traversal_attempt', $ip, $request, 'Path traversal pattern detected');
            return response()->json(['error' => 'Invalid request.'], 400);
        }
        
        // Check for suspicious user agents (bots, scanners)
        if ($this->isSuspiciousUserAgent($userAgent)) {
            $this->incrementThreatScore($ip, 2);
            $this->logSecurityEvent('suspicious_user_agent', $ip, $request, "Suspicious UA: {$userAgent}");
        }
        
        // Check threat score and block if too high
        if ($this->getThreatScore($ip) >= 50) {
            $this->blockIp($ip);
            $this->logSecurityEvent('threat_score_exceeded', $ip, $request, 'Threat score exceeded threshold');
            return response()->json(['error' => 'Access denied.'], 403);
        }
        
        // Track request for rate limiting only in production
        if ($isProd) {
            $this->trackRequest($ip);
        }
        
        return $next($request);
    }
    
    /**
     * Check if IP is currently blocked
     */
    protected function isBlocked(string $ip): bool
    {
        return Cache::has("security:blocked:{$ip}");
    }
    
    /**
     * Block an IP address
     */
    protected function blockIp(string $ip): void
    {
        Cache::put("security:blocked:{$ip}", true, now()->addMinutes(self::BLOCK_DURATION_MINUTES));
        Log::channel('security')->warning("IP blocked: {$ip}");
    }
    
    /**
     * Check if rate limit is exceeded
     */
    protected function isRateLimitExceeded(string $ip): bool
    {
        $minuteKey = "security:rate:{$ip}:minute";
        $secondKey = "security:rate:{$ip}:second";
        
        $minuteCount = Cache::get($minuteKey, 0);
        $secondCount = Cache::get($secondKey, 0);
        
        return $minuteCount > self::MAX_REQUESTS_PER_MINUTE || 
               $secondCount > self::MAX_REQUESTS_PER_SECOND;
    }
    
    /**
     * Track request for rate limiting
     */
    protected function trackRequest(string $ip): void
    {
        $minuteKey = "security:rate:{$ip}:minute";
        $secondKey = "security:rate:{$ip}:second";
        
        // Increment minute counter
        if (Cache::has($minuteKey)) {
            Cache::increment($minuteKey);
        } else {
            Cache::put($minuteKey, 1, 60);
        }
        
        // Increment second counter
        if (Cache::has($secondKey)) {
            Cache::increment($secondKey);
        } else {
            Cache::put($secondKey, 1, 1);
        }
    }
    
    /**
     * Detect SQL injection attempts
     */
    protected function detectSqlInjection(Request $request): bool
    {
        $inputs = $this->getAllInputs($request);
        
        foreach ($inputs as $value) {
            if (!is_string($value)) continue;
            
            foreach (self::SQL_INJECTION_PATTERNS as $pattern) {
                if (preg_match($pattern, $value)) {
                    return true;
                }
            }
        }
        
        return false;
    }
    
    /**
     * Detect XSS attempts
     */
    protected function detectXss(Request $request): bool
    {
        $inputs = $this->getAllInputs($request);
        
        foreach ($inputs as $value) {
            if (!is_string($value)) continue;
            
            foreach (self::XSS_PATTERNS as $pattern) {
                if (preg_match($pattern, $value)) {
                    return true;
                }
            }
        }
        
        return false;
    }
    
    /**
     * Detect path traversal attempts
     */
    protected function detectPathTraversal(Request $request): bool
    {
        $path = $request->path();
        $inputs = $this->getAllInputs($request);
        
        // Check URL path
        foreach (self::PATH_TRAVERSAL_PATTERNS as $pattern) {
            if (preg_match($pattern, $path)) {
                return true;
            }
        }
        
        // Check inputs
        foreach ($inputs as $value) {
            if (!is_string($value)) continue;
            
            foreach (self::PATH_TRAVERSAL_PATTERNS as $pattern) {
                if (preg_match($pattern, $value)) {
                    return true;
                }
            }
        }
        
        return false;
    }
    
    /**
     * Check for suspicious user agents
     */
    protected function isSuspiciousUserAgent(string $userAgent): bool
    {
        $suspiciousPatterns = [
            '/sqlmap/i',
            '/nikto/i',
            '/nessus/i',
            '/nmap/i',
            '/masscan/i',
            '/zgrab/i',
            '/gobuster/i',
            '/dirbuster/i',
            '/burpsuite/i',
            '/acunetix/i',
            '/havij/i',
            '/w3af/i',
            '/wpscan/i',
            '/joomscan/i',
        ];
        
        foreach ($suspiciousPatterns as $pattern) {
            if (preg_match($pattern, $userAgent)) {
                return true;
            }
        }
        
        return false;
    }
    
    /**
     * Get all request inputs
     */
    protected function getAllInputs(Request $request): array
    {
        $inputs = array_merge(
            $request->all(),
            $request->query(),
            [$request->path()]
        );
        
        return $this->flattenArray($inputs);
    }
    
    /**
     * Flatten nested array
     */
    protected function flattenArray(array $array): array
    {
        $result = [];
        
        array_walk_recursive($array, function($value) use (&$result) {
            $result[] = $value;
        });
        
        return $result;
    }
    
    /**
     * Get threat score for IP
     */
    protected function getThreatScore(string $ip): int
    {
        return Cache::get("security:threat:{$ip}", 0);
    }
    
    /**
     * Increment threat score for IP
     */
    protected function incrementThreatScore(string $ip, int $amount): void
    {
        $key = "security:threat:{$ip}";
        $score = Cache::get($key, 0) + $amount;
        Cache::put($key, $score, now()->addHours(1));
    }
    
    /**
     * Log security event
     */
    protected function logSecurityEvent(string $type, string $ip, Request $request, string $message): void
    {
        $logData = [
            'type' => $type,
            'ip' => $ip,
            'user_agent' => $request->userAgent(),
            'url' => $request->fullUrl(),
            'method' => $request->method(),
            'message' => $message,
            'timestamp' => now()->toIso8601String(),
        ];
        
        // Log to security channel
        Log::channel('security')->warning("Security Event: {$type}", $logData);
        
        // Also store in database for dashboard (optional)
        Cache::put(
            "security:events:" . now()->timestamp . ":" . uniqid(),
            $logData,
            now()->addDays(7)
        );
    }
}
