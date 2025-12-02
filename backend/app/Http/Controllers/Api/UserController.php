<?php

namespace App\Http\Controllers\Api;

use App\Http\Controllers\Controller;
use App\Models\User;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\Hash;
use Illuminate\Validation\Rule;

class UserController extends Controller
{
    /**
     * Get all users with pagination and filters
     */
    public function index(Request $request)
    {
        $query = User::query()->with('projects');

        // Search filter
        if ($search = $request->get('search')) {
            $query->where(function ($q) use ($search) {
                $q->where('name', 'like', "%{$search}%")
                  ->orWhere('email', 'like', "%{$search}%");
            });
        }

        // Role filter
        if ($role = $request->get('role')) {
            $query->where('role', $role);
        }

        // Status filter
        if ($request->has('is_active')) {
            $query->where('is_active', $request->boolean('is_active'));
        }

        // Project filter
        if ($projectId = $request->get('project_id')) {
            $query->whereHas('projects', function ($q) use ($projectId) {
                $q->where('projects.id', $projectId);
            });
        }

        // Sorting
        $sortBy = $request->get('sort_by', 'created_at');
        $sortOrder = $request->get('sort_order', 'desc');
        $query->orderBy($sortBy, $sortOrder);

        $perPage = $request->get('per_page', 15);
        $users = $query->paginate($perPage);

        return $this->paginated($users);
    }

    /**
     * Create a new user
     */
    public function store(Request $request)
    {
        $request->validate([
            'name' => 'required|string|max:255',
            'email' => 'required|email|unique:users,email',
            'password' => 'required|string|min:8',
            'role' => 'required|in:admin,responsable,sor,supervisor,animateur,hr,user',
            'phone' => 'nullable|string|max:20',
            'is_active' => 'boolean',
            'project_ids' => 'nullable|array',
            'project_ids.*' => 'exists:projects,id',
        ]);

        $user = User::create([
            'name' => $request->name,
            'email' => $request->email,
            'password' => Hash::make($request->password),
            'role' => $request->role,
            'phone' => $request->phone,
            'is_active' => $request->get('is_active', true),
        ]);

        // Assign projects if provided
        if ($request->has('project_ids')) {
            $user->projects()->sync($request->project_ids);
        }

        $user->load('projects');

        return $this->success($user, 'User created successfully', 201);
    }

    /**
     * Get a specific user
     */
    public function show(User $user)
    {
        $user->load('projects', 'kpiReports');

        return $this->success($user);
    }

    /**
     * Update a user
     */
    public function update(Request $request, User $user)
    {
        $request->validate([
            'name' => 'sometimes|string|max:255',
            'email' => ['sometimes', 'email', Rule::unique('users')->ignore($user->id)],
            'password' => 'nullable|string|min:8',
            'role' => 'sometimes|in:admin,responsable,sor,supervisor,animateur,hr,user',
            'phone' => 'nullable|string|max:20',
            'is_active' => 'boolean',
            'project_ids' => 'nullable|array',
            'project_ids.*' => 'exists:projects,id',
        ]);

        $data = $request->only(['name', 'email', 'role', 'phone', 'is_active']);

        if ($request->filled('password')) {
            $data['password'] = Hash::make($request->password);
        }

        $user->update($data);

        // Update project assignments if provided
        if ($request->has('project_ids')) {
            $user->projects()->sync($request->project_ids);
        }

        $user->load('projects');

        return $this->success($user, 'User updated successfully');
    }

    /**
     * Delete a user
     */
    public function destroy(User $user)
    {
        // Prevent self-deletion
        if ($user->id === auth()->id()) {
            return $this->error('You cannot delete your own account', 403);
        }

        $user->delete();

        return $this->success(null, 'User deleted successfully');
    }

    /**
     * Toggle user active status
     */
    public function toggleStatus(User $user)
    {
        if ($user->id === auth()->id()) {
            return $this->error('You cannot deactivate your own account', 403);
        }

        $user->update(['is_active' => !$user->is_active]);

        return $this->success($user, 'User status updated successfully');
    }

    /**
     * Assign projects to user
     */
    public function assignProjects(Request $request, User $user)
    {
        $request->validate([
            'project_ids' => 'required|array',
            'project_ids.*' => 'exists:projects,id',
        ]);

        $user->projects()->sync($request->project_ids);
        $user->load('projects');

        return $this->success($user, 'Projects assigned successfully');
    }

    /**
     * Get user statistics
     */
    public function statistics()
    {
        $stats = [
            'total' => User::count(),
            'admins' => User::admins()->count(),
            'responsables' => User::responsables()->count(),
            'active' => User::active()->count(),
            'inactive' => User::where('is_active', false)->count(),
        ];

        return $this->success($stats);
    }
}
