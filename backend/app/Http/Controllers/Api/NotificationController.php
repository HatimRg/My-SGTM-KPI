<?php

namespace App\Http\Controllers\Api;

use App\Http\Controllers\Controller;
use App\Models\Notification;
use App\Models\Project;
use App\Models\User;
use App\Services\NotificationService;
use Illuminate\Http\Request;
use Illuminate\Validation\Rule;

class NotificationController extends Controller
{
    /**
     * Get user notifications with filters
     */
    public function index(Request $request)
    {
        $user = $request->user();
        if (!$user) {
            return $this->error('Unauthorized', 401);
        }
        
        $query = Notification::with('project')
            ->where('user_id', $user->id);

        // Filter by read status
        if ($request->get('unread_only')) {
            $query->unread();
        }

        // Filter by project
        if ($request->has('project_id') && $request->project_id) {
            $project = Project::findOrFail((int) $request->project_id);
            if (!$user->canAccessProject($project)) {
                return $this->error('Access denied', 403);
            }
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
        $user = $request->user();
        if (!$user) {
            return $this->error('Unauthorized', 401);
        }

        $userId = $user->id;
        $projectId = $request->project_id;

        // Single optimized query to get both total count and counts by type
        $query = Notification::where('user_id', $userId)
            ->whereNull('read_at')
            ->selectRaw('type, count(*) as count')
            ->groupBy('type');

        if ($projectId) {
            $project = Project::findOrFail((int) $projectId);
            if (!$user->canAccessProject($project)) {
                return $this->error('Access denied', 403);
            }
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
        $user = $request->user();
        if (!$user) {
            return $this->error('Unauthorized', 401);
        }

        $query = Notification::where('user_id', $user->id)->unread();

        if ($request->has('project_id') && $request->project_id) {
            $project = Project::findOrFail((int) $request->project_id);
            if (!$user->canAccessProject($project)) {
                return $this->error('Access denied', 403);
            }
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
        $user = $request->user();
        if (!$user) {
            return $this->error('Unauthorized', 401);
        }

        $query = Notification::where('user_id', $user->id)->read();

        if ($request->has('project_id') && $request->project_id) {
            $project = Project::findOrFail((int) $request->project_id);
            if (!$user->canAccessProject($project)) {
                return $this->error('Access denied', 403);
            }
            $query->where('project_id', $request->project_id);
        }

        $query->delete();

        return $this->success(null, 'Read notifications deleted');
    }

    /**
     * Send a notification (admin only)
     */
    public function send(Request $request)
    {
        $user = $request->user();
        if (!$user) {
            return $this->error('Unauthorized', 401);
        }

        if (!$user->isAdminLike()) {
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

        if (!$user->hasGlobalProjectScope() && in_array($validated['target'], ['all', 'user'], true)) {
            return $this->error('Access denied', 403);
        }

        if ($validated['target'] === 'user') {
            $targetUser = \App\Models\User::find($validated['user_id']);
            NotificationService::sendToUser($targetUser, $type, $validated['title'], $validated['message']);
        } elseif ($validated['target'] === 'project') {
            $project = \App\Models\Project::find($validated['project_id']);
            if (!$project) {
                return $this->error('Project not found', 404);
            }
            if (!$user->canAccessProject($project)) {
                return $this->error('Access denied', 403);
            }
            NotificationService::sendToProject($project, $type, $validated['title'], $validated['message']);
        } else {
            NotificationService::broadcast($type, $validated['title'], $validated['message']);
        }

        return $this->success(null, 'Notification sent successfully');
    }

    /**
     * Get unread urgent notifications for polling.
     */
    public function urgentUnread(Request $request)
    {
        $user = $request->user();
        if (!$user) {
            return $this->error('Unauthorized', 401);
        }

        $afterId = $request->get('after_id');
        $limit = (int) $request->get('limit', 20);
        if ($limit <= 0 || $limit > 100) {
            $limit = 20;
        }

        $query = Notification::query()
            ->where('user_id', $user->id)
            ->where('type', Notification::TYPE_URGENT)
            ->whereNull('read_at');

        if ($afterId !== null && $afterId !== '') {
            $query->where('id', '>', (int) $afterId);
        }

        $notifications = $query
            ->orderBy('id', 'asc')
            ->limit($limit)
            ->get();

        $lastId = $notifications->max('id');

        return $this->success([
            'items' => $notifications,
            'last_id' => $lastId,
        ]);
    }

    /**
     * Send an urgent notification (admin-like only).
     */
    public function urgentSend(Request $request)
    {
        $user = $request->user();
        if (!$user) {
            return $this->error('Unauthorized', 401);
        }

        if (!$user->isAdminLike()) {
            return $this->error('Unauthorized', 403);
        }

        if (!$user->hasGlobalProjectScope()) {
            return $this->error('Access denied', 403);
        }

        $allowedRoles = array_keys((array) config('roles.roles', []));

        $validated = $request->validate([
            'target' => 'required|in:user_ids,role,all',
            'user_ids' => 'required_if:target,user_ids|array',
            'user_ids.*' => 'integer|exists:users,id',
            'role' => ['required_if:target,role', 'string', 'max:50', Rule::in($allowedRoles)],
            'message' => 'required|string|max:2000',
            'urgency' => 'required|in:low,medium,high',
            'dedupe_key' => 'nullable|string|max:64',
        ]);

        $targetUserIds = [];
        if ($validated['target'] === 'user_ids') {
            $targetUserIds = collect($validated['user_ids'] ?? [])->map(fn ($id) => (int) $id)->unique()->values()->all();
        } elseif ($validated['target'] === 'role') {
            $targetUserIds = User::query()
                ->where('role', $validated['role'])
                ->where('is_active', true)
                ->pluck('id')
                ->map(fn ($id) => (int) $id)
                ->all();
        } else {
            $targetUserIds = User::query()
                ->where('is_active', true)
                ->pluck('id')
                ->map(fn ($id) => (int) $id)
                ->all();
        }

        $targetUserIds = array_values(array_filter($targetUserIds, fn ($id) => $id !== (int) $user->id));
        if (count($targetUserIds) === 0) {
            return $this->error('No recipients found', 422);
        }

        NotificationService::sendUrgentToUsers(
            $targetUserIds,
            $validated['message'],
            $validated['urgency'],
            (int) $user->id,
            [
                'dedupe_key' => $validated['dedupe_key'] ?? null,
                'title' => 'Urgent notification',
                'icon' => 'alert-triangle',
                'data' => [
                    'forced_visibility_seconds' => 5,
                ],
            ]
        );

        return $this->success(null, 'Urgent notification sent successfully');
    }
}
