<?php

namespace App\Http\Controllers\Api;

use App\Http\Controllers\Controller;
use App\Models\Notification;
use App\Services\NotificationService;
use Illuminate\Http\Request;

class NotificationController extends Controller
{
    /**
     * Get user notifications with filters
     */
    public function index(Request $request)
    {
        $user = $request->user();
        
        $query = Notification::with('project')
            ->where('user_id', $user->id);

        // Filter by read status
        if ($request->get('unread_only')) {
            $query->unread();
        }

        // Filter by project
        if ($request->has('project_id') && $request->project_id) {
            $query->where('project_id', $request->project_id);
        }

        // Filter by type
        if ($request->has('type') && $request->type) {
            $query->where('type', $request->type);
        }

        $notifications = $query->latest()->paginate($request->get('per_page', 20));

        return $this->paginated($notifications);
    }

    /**
     * Get unread count (optionally by project)
     */
    public function unreadCount(Request $request)
    {
        $userId = $request->user()->id;
        $projectId = $request->project_id;

        // Single optimized query to get both total count and counts by type
        $query = Notification::where('user_id', $userId)
            ->whereNull('read_at')
            ->selectRaw('type, count(*) as count')
            ->groupBy('type');

        if ($projectId) {
            $query->where('project_id', $projectId);
        }

        $byType = $query->pluck('count', 'type');
        $count = $byType->sum();

        return $this->success([
            'count' => $count,
            'by_type' => $byType,
        ]);
    }

    /**
     * Mark notification as read
     */
    public function markAsRead(Notification $notification)
    {
        if ($notification->user_id !== auth()->id()) {
            return $this->error('Unauthorized', 403);
        }

        $notification->markAsRead();

        return $this->success(null, 'Notification marked as read');
    }

    /**
     * Mark all notifications as read (optionally by project)
     */
    public function markAllAsRead(Request $request)
    {
        $query = Notification::where('user_id', $request->user()->id)->unread();

        if ($request->has('project_id') && $request->project_id) {
            $query->where('project_id', $request->project_id);
        }

        $query->update(['read_at' => now()]);

        return $this->success(null, 'All notifications marked as read');
    }

    /**
     * Delete a notification
     */
    public function destroy(Notification $notification)
    {
        if ($notification->user_id !== auth()->id()) {
            return $this->error('Unauthorized', 403);
        }

        $notification->delete();

        return $this->success(null, 'Notification deleted');
    }

    /**
     * Delete all read notifications
     */
    public function deleteRead(Request $request)
    {
        Notification::where('user_id', $request->user()->id)
            ->read()
            ->delete();

        return $this->success(null, 'Read notifications deleted');
    }

    /**
     * Send a notification (admin only)
     */
    public function send(Request $request)
    {
        $user = $request->user();
        if (!$user->isAdmin()) {
            return $this->error('Unauthorized', 403);
        }

        $validated = $request->validate([
            'target' => 'required|in:user,project,all',
            'user_id' => 'required_if:target,user|exists:users,id',
            'project_id' => 'required_if:target,project|exists:projects,id',
            'title' => 'required|string|max:255',
            'message' => 'required|string|max:1000',
            'type' => 'nullable|string|max:50',
        ]);

        $type = $validated['type'] ?? Notification::TYPE_INFO;

        if ($validated['target'] === 'user') {
            $targetUser = \App\Models\User::find($validated['user_id']);
            NotificationService::sendToUser($targetUser, $type, $validated['title'], $validated['message']);
        } elseif ($validated['target'] === 'project') {
            $project = \App\Models\Project::find($validated['project_id']);
            NotificationService::sendToProject($project, $type, $validated['title'], $validated['message']);
        } else {
            NotificationService::broadcast($type, $validated['title'], $validated['message']);
        }

        return $this->success(null, 'Notification sent successfully');
    }
}
