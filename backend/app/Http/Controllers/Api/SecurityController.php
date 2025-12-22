<?php

namespace App\Http\Controllers\Api;

use App\Http\Controllers\Controller;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\Cache;
use Illuminate\Support\Facades\File;

class SecurityController extends Controller
{
    /**
     * Get security dashboard stats
     */
    public function dashboard(Request $request)
    {
        // Get recent security events from cache
        $events = $this->getRecentEvents();
        
        // Count by type
        $byType = collect($events)->groupBy('type')->map->count();
        
        // Count by IP
        $byIp = collect($events)->groupBy('ip')->map->count()->sortDesc()->take(10);
        
        // Get blocked IPs
        $blockedIps = $this->getBlockedIps();
        
        // Get threat scores
        $threatScores = $this->getThreatScores();
        
        return $this->success([
            'total_events' => count($events),
            'events_by_type' => $byType,
            'top_offending_ips' => $byIp,
            'blocked_ips' => $blockedIps,
            'threat_scores' => $threatScores,
            'recent_events' => array_slice($events, 0, 50),
        ]);
    }
    
    /**
     * Get security log entries
     */
    public function logs(Request $request)
    {
        $logFile = storage_path('logs/security-' . date('Y-m-d') . '.log');
        
        if (!File::exists($logFile)) {
            return $this->success([
                'logs' => [],
                'message' => 'No security logs for today'
            ]);
        }
        
        $content = File::get($logFile);
        $lines = array_filter(explode("\n", $content));
        $lines = array_slice(array_reverse($lines), 0, 100); // Last 100 entries
        
        return $this->success([
            'logs' => $lines,
            'file' => basename($logFile),
        ]);
    }
    
    /**
     * Unblock an IP address
     */
    public function unblockIp(Request $request)
    {
        $request->validate([
            'ip' => 'required|ip',
        ]);
        
        $ip = $request->ip;
        Cache::forget("security:blocked:{$ip}");
        Cache::forget("security:threat:{$ip}");
        
        return $this->success(null, "IP {$ip} has been unblocked");
    }
    
    /**
     * Block an IP address manually
     */
    public function blockIp(Request $request)
    {
        $request->validate([
            'ip' => 'required|ip',
            'duration' => 'nullable|integer|min:1|max:1440', // max 24 hours
        ]);
        
        $ip = $request->ip;
        $duration = $request->duration ?? 60; // Default 60 minutes
        
        Cache::put("security:blocked:{$ip}", true, now()->addMinutes($duration));
        
        return $this->success(null, "IP {$ip} has been blocked for {$duration} minutes");
    }
    
    /**
     * Get recent security events from cache
     */
    protected function getRecentEvents(): array
    {
        $events = [];
        $keys = Cache::get('security:event_keys', []);
        
        // Alternative: scan cache for security events
        // This is a simplified approach - in production, use Redis SCAN or database
        $cachePrefix = 'security:events:';
        
        // Get events from last 24 hours
        $startTime = now()->subDay()->timestamp;
        
        foreach (range($startTime, now()->timestamp, 60) as $timestamp) {
            for ($i = 0; $i < 10; $i++) {
                $pattern = $cachePrefix . $timestamp . ':';
                // This is a workaround - in production use proper event storage
            }
        }
        
        return $events;
    }
    
    /**
     * Get list of blocked IPs
     */
    protected function getBlockedIps(): array
    {
        // Note: This requires Redis SCAN or database storage for production
        // For file-based cache, we'll read from the security log
        $blocked = [];
        
        $logFile = storage_path('logs/security-' . date('Y-m-d') . '.log');
        if (File::exists($logFile)) {
            $content = File::get($logFile);
            preg_match_all('/IP blocked: ([\d\.]+)/', $content, $matches);
            $blocked = array_unique($matches[1] ?? []);
        }
        
        return array_values($blocked);
    }
    
    /**
     * Get threat scores
     */
    protected function getThreatScores(): array
    {
        // Similar limitation as above - need proper storage for production
        return [];
    }
}
