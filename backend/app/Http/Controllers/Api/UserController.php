<?php

namespace App\Http\Controllers\Api;

use App\Http\Controllers\Controller;
use App\Exports\UsersTemplateExport;
use App\Imports\UsersImport;
use App\Models\User;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Log;
use Illuminate\Validation\Rule;
use Maatwebsite\Excel\Facades\Excel;

class UserController extends Controller
{
    /**
     * Get all users with pagination and filters
     */
    public function index(Request $request)
    {
        $query = User::query()->with('projects');

        // Hide dev users from normal admin views/statistics
        $query->where('role', '!=', User::ROLE_DEV);

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

        if (($pole = $request->get('pole')) !== null && $pole !== '') {
            $query->whereHas('projects', function ($q) use ($pole) {
                $q->where('projects.pole', $pole);
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
            'role' => 'required|in:admin,hse_manager,responsable,supervisor,hr,user,dev,pole_director,works_director,hse_director,hr_director',
            'pole' => 'nullable|string|max:255|required_if:role,pole_director',
            'phone' => 'nullable|string|max:20',
            'is_active' => 'boolean',
            'project_ids' => 'nullable|array',
            'project_ids.*' => 'exists:projects,id',
        ]);

        $user = User::create([
            'name' => $request->name,
            'email' => $request->email,
            'password' => $request->password, // Will be hashed by model mutator
            'role' => $request->role,
            'pole' => $request->role === User::ROLE_POLE_DIRECTOR ? $request->pole : null,
            'phone' => $request->phone,
            'is_active' => $request->get('is_active', true),
        ]);

        // Assign projects if provided
        if ($request->has('project_ids') && $request->role !== User::ROLE_POLE_DIRECTOR) {
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
            'role' => 'sometimes|in:admin,hse_manager,responsable,supervisor,hr,user,dev,pole_director,works_director,hse_director,hr_director',
            'pole' => 'nullable|string|max:255|required_if:role,pole_director',
            'phone' => 'nullable|string|max:20',
            'is_active' => 'boolean',
            'project_ids' => 'nullable|array',
            'project_ids.*' => 'exists:projects,id',
        ]);

        $data = $request->only(['name', 'email', 'role', 'phone', 'is_active', 'pole']);

        if ($request->has('role') && $request->role !== User::ROLE_POLE_DIRECTOR) {
            $data['pole'] = null;
        }

        if ($request->filled('password')) {
            $data['password'] = $request->password; // Will be hashed by model mutator
        }

        $user->update($data);

        // Update project assignments if provided
        if ($request->has('project_ids')) {
            $roleAfterUpdate = $request->has('role') ? $request->role : $user->role;
            if ($roleAfterUpdate === User::ROLE_POLE_DIRECTOR) {
                $user->projects()->detach();
            } else {
                $user->projects()->sync($request->project_ids);
            }
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
        if ($user->role === User::ROLE_POLE_DIRECTOR) {
            return $this->error('Pole Director users are scoped by pole and cannot be assigned individual projects.', 422);
        }

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
            'total' => User::where('role', '!=', User::ROLE_DEV)->count(),
            'admins' => User::where('role', '!=', User::ROLE_DEV)->admins()->count(),
            'hse_managers' => User::where('role', '!=', User::ROLE_DEV)->hseManagers()->count(),
            'responsables' => User::where('role', '!=', User::ROLE_DEV)->responsables()->count(),
            'active' => User::where('role', '!=', User::ROLE_DEV)->active()->count(),
            'inactive' => User::where('role', '!=', User::ROLE_DEV)->where('is_active', false)->count(),
        ];

        return $this->success($stats);
    }

    public function downloadTemplate(Request $request)
    {
        try {
            $user = $request->user();

            if (!class_exists(\ZipArchive::class) || !extension_loaded('zip')) {
                return $this->error('XLSX export requires PHP zip extension (ZipArchive). Please enable/install php-zip on the server.', 422);
            }
            $filename = 'SGTM-Users-Template.xlsx';

            $allRoles = array_keys((array) config('roles.roles', []));
            $roleOptions = $allRoles;

            // Keep dev role hidden from non-dev users
            if (!$user || !$user->isDev()) {
                $roleOptions = array_values(array_filter($roleOptions, fn ($r) => $r !== User::ROLE_DEV));
            }

            // Keep admin role hidden from non-admin users (directors are admin-like but not admin)
            if (!$user || $user->role !== User::ROLE_ADMIN) {
                $roleOptions = array_values(array_filter($roleOptions, fn ($r) => $r !== User::ROLE_ADMIN));
            }

            return Excel::download(new UsersTemplateExport(200, $roleOptions), $filename);
        } catch (\Throwable $e) {
            Log::error('Users template generation failed', [
                'error' => $e->getMessage(),
                'trace' => $e->getTraceAsString(),
            ]);
            return $this->error('Failed to generate users template: ' . $e->getMessage(), 422);
        }
    }

    public function bulkImport(Request $request)
    {
        @ini_set('max_execution_time', '300');
        @ini_set('memory_limit', '512M');

        if (!class_exists(\ZipArchive::class) || !extension_loaded('zip')) {
            return $this->error('XLSX import requires PHP zip extension (ZipArchive). Please enable/install php-zip on the server.', 422);
        }

        $request->validate([
            'file' => 'required|file|mimes:xlsx,xls|max:20480',
        ]);

        $import = new UsersImport();

        try {
            DB::beginTransaction();
            Excel::import($import, $request->file('file'));
            DB::commit();
        } catch (\Throwable $e) {
            DB::rollBack();
            Log::error('Users bulk import failed', [
                'error' => $e->getMessage(),
                'trace' => $e->getTraceAsString(),
            ]);
            return $this->error('Failed to import users: ' . $e->getMessage(), 422);
        }

        return $this->success([
            'imported' => $import->getImportedCount(),
            'updated' => $import->getUpdatedCount(),
            'errors' => $import->getErrors(),
        ], 'Users imported');
    }
}
