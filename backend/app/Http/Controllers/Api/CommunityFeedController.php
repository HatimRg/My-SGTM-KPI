<?php

namespace App\Http\Controllers\Api;

use App\Http\Controllers\Controller;
use App\Models\CommunityPost;
use App\Models\CommunityPostComment;
use App\Models\CommunityPostHashtag;
use App\Models\CommunityPostImage;
use App\Models\CommunityPostReaction;
use App\Models\User;
use App\Services\CommunityModerationService;
use App\Services\NotificationService;
use Carbon\Carbon;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Storage;

class CommunityFeedController extends Controller
{
    public function showImage(Request $request, CommunityPostImage $image)
    {
        $disk = Storage::disk('public');
        $path = (string) $image->file_path;

        if ($path === '' || !$disk->exists($path)) {
            return response()->json([
                'success' => false,
                'message' => 'Not found',
            ], 404);
        }

        $fullPath = $disk->path($path);
        $mime = $image->mime_type ?: $disk->mimeType($path) ?: 'application/octet-stream';

        $originalName = (string) ($image->original_name ?: basename($path));
        $download = (bool) $request->boolean('download', false);

        if ($download) {
            return response()->download($fullPath, $originalName, [
                'Content-Type' => $mime,
                'Cache-Control' => 'private, max-age=3600',
            ]);
        }

        return response()->file($fullPath, [
            'Content-Type' => $mime,
            'Cache-Control' => 'private, max-age=3600',
        ]);
    }

    public function listReactions(Request $request, CommunityPost $post)
    {
        $validated = $request->validate([
            'reaction_type' => 'nullable|string',
        ]);

        $allowed = config('community_feed.reaction_types', []);
        $type = $validated['reaction_type'] ?? null;
        if ($type !== null && $type !== '' && !in_array($type, $allowed, true)) {
            return $this->error('Invalid reaction type.', 422);
        }

        $query = CommunityPostReaction::query()
            ->where('post_id', $post->id)
            ->with('user:id,name')
            ->latest();

        if ($type !== null && $type !== '') {
            $query->where('reaction_type', $type);
        }

        $items = $query
            ->get()
            ->map(fn (CommunityPostReaction $r) => [
                'id' => $r->id,
                'reaction_type' => $r->reaction_type,
                'created_at' => $r->created_at,
                'user' => [
                    'id' => $r->user?->id,
                    'name' => $r->user?->name,
                ],
            ])
            ->values();

        return $this->success(['items' => $items]);
    }

    public function index(Request $request)
    {
        $now = now();
        $query = CommunityPost::query()
            ->with([
                'user:id,name,role',
                'project:id,name',
                'images:id,post_id,file_path,sort_order,original_name',
                'hashtags:id,post_id,tag_original,tag_normalized',
                'comments' => fn ($q) => $q->with('user:id,name')->latest()->limit(20),
            ])
            ->withCount(['comments', 'reactions'])
            ->where('status', 'published')
            ->orderByRaw(
                '(CASE WHEN is_featured = 1 AND featured_from IS NOT NULL AND featured_until IS NOT NULL AND ? BETWEEN featured_from AND featured_until THEN 0 ELSE 1 END) ASC',
                [$now]
            )
            ->latest();

        if ($request->filled('category') && $request->category !== 'all') {
            $query->where('category', $request->category);
        }

        if ($request->filled('project_id')) {
            $query->where('project_id', (int) $request->project_id);
        }

        if ($request->filled('author_id')) {
            $query->where('user_id', (int) $request->author_id);
        }

        $search = trim((string) $request->query('search', ''));
        if ($search !== '') {
            $normalized = CommunityModerationService::normalize($search);
            $query->where(function ($q) use ($normalized) {
                $q->where('body_normalized', 'like', "%{$normalized}%")
                    ->orWhereHas('user', fn ($uq) => $uq->whereRaw('LOWER(name) LIKE ?', ["%{$normalized}%"]))
                    ->orWhereHas('project', fn ($pq) => $pq->whereRaw('LOWER(name) LIKE ?', ["%{$normalized}%"]))
                    ->orWhereHas('hashtags', fn ($hq) => $hq->where('tag_normalized', 'like', "%{$normalized}%"));
            });
        }

        $posts = $query->paginate((int) $request->query('per_page', 20));
        $userId = (int) $request->user()->id;

        $posts->getCollection()->transform(function (CommunityPost $post) use ($userId) {
            $reactionSummary = $post->reactions()
                ->select('reaction_type', DB::raw('COUNT(*) as count'))
                ->groupBy('reaction_type')
                ->pluck('count', 'reaction_type');

            $myReaction = $post->reactions()->where('user_id', $userId)->value('reaction_type');

            return [
                'id' => $post->id,
                'category' => $post->category,
                'body_raw' => $post->body_raw,
                'body_normalized' => $post->body_normalized,
                'created_at' => $post->created_at,
                'is_featured' => (bool) $post->is_featured,
                'featured_from' => $post->featured_from,
                'featured_until' => $post->featured_until,
                'user' => [
                    'id' => $post->user?->id,
                    'full_name' => $post->user?->name,
                    'role' => $post->user?->role,
                    'project' => $post->project?->name,
                ],
                'images' => $post->images->map(fn ($img) => [
                    'id' => $img->id,
                    'url' => "/api/community-feed/images/{$img->id}",
                    'name' => $img->original_name,
                ])->values(),
                'hashtags' => $post->hashtags->map(fn ($h) => [
                    'original' => $h->tag_original,
                    'normalized' => $h->tag_normalized,
                ])->values(),
                'comments_count' => (int) $post->comments_count,
                'comments' => $post->comments->map(fn ($c) => [
                    'id' => $c->id,
                    'user_id' => $c->user_id,
                    'author' => $c->user?->name,
                    'body_raw' => $c->body_raw,
                    'created_at' => $c->created_at,
                ])->values(),
                'reactions_count' => (int) $post->reactions_count,
                'reactions' => $reactionSummary,
                'my_reaction' => $myReaction,
            ];
        });

        return $this->paginated($posts);
    }

    public function storePost(Request $request)
    {
        $user = $request->user();
        if (!in_array($user->role, config('community_feed.publisher_roles', []), true)) {
            return $this->error('You are not allowed to publish posts.', 403);
        }

        $validated = $request->validate([
            'category' => 'required|string|in:good-practice,initiative,improvement,learning',
            'body_raw' => 'required|string|max:5000',
            'project_id' => 'nullable|integer|exists:projects,id',
            'images' => 'nullable|array|max:6',
            'images.*' => 'image|max:6144',
        ]);

        $blocked = CommunityModerationService::detectBlockedTerms($validated['body_raw']);
        if (!empty($blocked)) {
            return response()->json([
                'success' => false,
                'message' => 'This content is not allowed.',
                'errors' => [
                    'body_raw' => ['This content is not allowed.'],
                    'blocked_terms' => $blocked,
                ],
            ], 422);
        }

        $post = DB::transaction(function () use ($validated, $user) {
            $body = (string) $validated['body_raw'];
            $normalizedBody = CommunityModerationService::normalize($body);

            $post = CommunityPost::create([
                'user_id' => $user->id,
                'project_id' => $validated['project_id'] ?? null,
                'category' => $validated['category'],
                'body_raw' => $body,
                'body_normalized' => $normalizedBody,
                'status' => 'published',
            ]);

            preg_match_all('/#[\p{L}\p{N}_-]+/u', $body, $matches);
            $tags = collect($matches[0] ?? [])->unique()->values();
            foreach ($tags as $tagOriginal) {
                $tagNormalized = '#' . preg_replace('/\s+/u', '', CommunityModerationService::normalize(ltrim((string) $tagOriginal, '#')));
                CommunityPostHashtag::create([
                    'post_id' => $post->id,
                    'tag_original' => (string) $tagOriginal,
                    'tag_normalized' => $tagNormalized,
                ]);
            }

            $files = $validated['images'] ?? [];
            foreach ($files as $index => $file) {
                $path = $file->store('community-feed', 'public');
                $post->images()->create([
                    'file_path' => $path,
                    'sort_order' => $index,
                    'original_name' => $file->getClientOriginalName(),
                    'mime_type' => $file->getClientMimeType(),
                    'size_bytes' => $file->getSize(),
                ]);
            }

            return $post;
        });

        return $this->success(['id' => $post->id], 'Post created', 201);
    }

    public function deletePost(Request $request, CommunityPost $post)
    {
        $user = $request->user();
        if (!$user) {
            return $this->error('Unauthorized', 401);
        }

        $isAuthor = (int) $post->user_id === (int) $user->id;
        $canModerate = $user->isAdminLike();
        if (!$isAuthor && !$canModerate) {
            return $this->error('Forbidden', 403);
        }

        $post->delete();

        return $this->success(['deleted' => true], 'Post deleted');
    }

    public function addComment(Request $request, CommunityPost $post)
    {
        $user = $request->user();
        if ($user->comments_banned_until && Carbon::parse($user->comments_banned_until)->isFuture()) {
            $daysLeft = max(1, now()->diffInDays(Carbon::parse($user->comments_banned_until), false));

            NotificationService::sendToUser(
                $user,
                'community_comment_ban_notice',
                'Commenting temporarily disabled',
                "{$daysLeft} day(s) is left to be able to comment."
            );

            return $this->error("{$daysLeft} day(s) is left to be able to comment.", 403, ['days_left' => $daysLeft]);
        }

        $validated = $request->validate([
            'body_raw' => 'required|string|max:2000',
        ]);

        $blocked = CommunityModerationService::detectBlockedTerms($validated['body_raw']);
        if (!empty($blocked)) {
            $bannedUntil = now()->addDays(3);
            $user->forceFill(['comments_banned_until' => $bannedUntil])->save();

            $adminIds = User::query()
                ->whereIn('role', ['admin', 'dev', 'consultation'])
                ->pluck('id')
                ->values()
                ->all();

            if (!empty($adminIds)) {
                NotificationService::sendToUsers(
                    $adminIds,
                    'community_comment_flagged',
                    'Community feed moderation alert',
                    "User {$user->name} posted a blocked comment and was banned for 3 days.",
                    [
                        'data' => [
                            'post_id' => $post->id,
                            'user_id' => $user->id,
                            'blocked_terms' => $blocked,
                            'comment' => $validated['body_raw'],
                        ],
                        'action_url' => '/community-feed',
                    ]
                );
            }

            NotificationService::sendToUser(
                $user,
                'community_comment_banned',
                'Comment ban applied',
                'Blocked language detected in your comment. Commenting is disabled for 3 days.',
                [
                    'data' => ['blocked_terms' => $blocked],
                    'action_url' => '/community-feed',
                ]
            );

            return response()->json([
                'success' => false,
                'message' => 'This content is not allowed.',
                'errors' => [
                    'body_raw' => ['This content is not allowed.'],
                    'blocked_terms' => $blocked,
                    'days_left' => 3,
                ],
            ], 422);
        }

        $comment = CommunityPostComment::create([
            'post_id' => $post->id,
            'user_id' => $user->id,
            'body_raw' => $validated['body_raw'],
            'body_normalized' => CommunityModerationService::normalize($validated['body_raw']),
            'status' => 'published',
        ]);

        return $this->success([
            'id' => $comment->id,
            'user_id' => $comment->user_id,
            'author' => $user->name,
            'body_raw' => $comment->body_raw,
            'created_at' => $comment->created_at,
        ], 'Comment added', 201);
    }

    public function deleteComment(Request $request, CommunityPostComment $comment)
    {
        $user = $request->user();
        if (!$user) {
            return $this->error('Unauthorized', 401);
        }

        $isAuthor = (int) $comment->user_id === (int) $user->id;
        $canModerate = $user->isAdminLike();
        if (!$isAuthor && !$canModerate) {
            return $this->error('Forbidden', 403);
        }

        $comment->delete();

        return $this->success(['deleted' => true], 'Comment deleted');
    }

    public function react(Request $request, CommunityPost $post)
    {
        $validated = $request->validate([
            'reaction_type' => 'required|string',
        ]);

        $allowed = config('community_feed.reaction_types', []);
        $reactionType = $validated['reaction_type'];
        if (!in_array($reactionType, $allowed, true)) {
            return $this->error('Invalid reaction type.', 422);
        }

        $reaction = CommunityPostReaction::query()
            ->where('post_id', $post->id)
            ->where('user_id', $request->user()->id)
            ->first();

        if ($reaction && $reaction->reaction_type === $reactionType) {
            $reaction->delete();
            return $this->success(['removed' => true], 'Reaction removed');
        }

        if ($reaction) {
            $reaction->update(['reaction_type' => $reactionType]);
        } else {
            CommunityPostReaction::create([
                'post_id' => $post->id,
                'user_id' => $request->user()->id,
                'reaction_type' => $reactionType,
            ]);
        }

        return $this->success(['removed' => false], 'Reaction updated');
    }
}
