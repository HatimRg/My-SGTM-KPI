<?php

namespace App\Http\Controllers\Api;

use App\Http\Controllers\Controller;
use App\Exports\UsersTemplateExport;
use App\Imports\UsersImport;
use App\Models\User;
use App\Support\PasswordPolicy;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Log;
use Illuminate\Validation\Rule;
use Maatwebsite\Excel\Facades\Excel;

class UserController extends Controller
{
    private function isUserManagementAdmin(User $actor): bool
    {
        return $actor->isAdminLike();
    }

    private function assertCanManageUser(User $actor, User $target)
    {
        if ($this->isUserManagementAdmin($actor)) {
            return;
        }

        if (!$actor->isHseManager()) {
            abort(403, 'Access denied. User management privileges required.');
        }

        // HSE managers can manage themselves
        if ($actor->id === $target->id) {
            return;
        }

        // HSE managers can only manage a restricted set of roles
        if (!in_array((string) $target->role, User::HSE_MANAGER_CREATABLE_ROLES, true)) {
            abort(403, 'Access denied. You cannot manage this user role.');
        }

        $visibleProjectIds = $actor->visibleProjectIds();
        if ($visibleProjectIds === null) {
            return;
        }

        $hasSharedProject = $target->projects()->whereIn('projects.id', $visibleProjectIds)->exists();
        if (!$hasSharedProject) {
            abort(403, 'Access denied. You cannot manage users outside your projects.');
        }
    }

    private function assertProjectIdsAreVisibleToActor(User $actor, array $projectIds)
    {
        if ($this->isUserManagementAdmin($actor)) {
            return;
        }

        $visibleProjectIds = $actor->visibleProjectIds();
        if ($visibleProjectIds === null) {
            return;
        }

        $allowed = collect($visibleProjectIds)->map(fn ($id) => (int) $id)->all();
        foreach ($projectIds as $id) {
            if (!in_array((int) $id, $allowed, true)) {
                abort(403, 'Access denied. One or more selected projects are outside your scope.');
            }
        }
    }

    private function getAllowedRolesForActor(User $actor): array
    {
        if ($this->isUserManagementAdmin($actor)) {
            // Directors are admin-like but should not be able to create admin/dev users.
            if ($actor->role !== User::ROLE_ADMIN && !$actor->isDev()) {
                return [
                    'hse_manager',
                    'regional_hse_manager',
                    'responsable',
                    'supervisor',
                    'hr',
                    'user',
                    'pole_director',
                    'works_director',
                    'hse_director',
                    'hr_director',
                ];
            }

            return [
                'admin',
                'consultation',
                'hse_manager',
                'regional_hse_manager',
                'responsable',
                'supervisor',
                'hr',
                'user',
                'dev',
                'pole_director',
                'works_director',
                'hse_director',
                'hr_director',
            ];
        }

        if ($actor->isHseManager()) {
            return User::HSE_MANAGER_CREATABLE_ROLES;
        }

        return [];
    }

    /**
     * Get all users with pagination and filters
     */
    public function index(Request $request)
    {
        $actor = $request->user();
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

        // Scope for non-admin user management (HSE manager)
        if ($actor && !$this->isUserManagementAdmin($actor)) {
            if ($actor->isHseManager()) {
                $visibleProjectIds = $actor->visibleProjectIds();
                if ($visibleProjectIds === null) {
                    // no-op
                } elseif (count($visibleProjectIds) === 0) {
                    $query->whereRaw('1 = 0');
                } else {
                    $query->where(function ($q) use ($visibleProjectIds, $actor) {
                        $q->whereKey($actor->id)
                          ->orWhere(function ($q2) use ($visibleProjectIds) {
                              $q2->whereIn('role', User::HSE_MANAGER_CREATABLE_ROLES)
                                 ->whereHas('projects', function ($qp) use ($visibleProjectIds) {
                                     $qp->whereIn('projects.id', $visibleProjectIds);
                                 });
                          });
                    });
                }
            }
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
        $actor = $request->user();
        $role = $request->input('role');

        $allowedRoles = $actor ? $this->getAllowedRolesForActor($actor) : [];
        if (!$actor || count($allowedRoles) === 0) {
            return $this->error('Access denied. User management privileges required.', 403);
        }

        $request->validate([
            'name' => 'required|string|max:255',
            'email' => 'required|email|unique:users,email',
            'password' => PasswordPolicy::rulesForRole($role, true, false),
            'role' => ['required', Rule::in($allowedRoles)],
            'pole' => 'nullable|string|max:255|required_if:role,pole_director,regional_hse_manager',
            'phone' => 'nullable|string|max:20',
            'is_active' => 'boolean',
            'project_ids' => 'nullable|array',
            'project_ids.*' => 'exists:projects,id',
        ]);

        $projectIds = in_array($request->role, [User::ROLE_POLE_DIRECTOR, User::ROLE_REGIONAL_HSE_MANAGER], true)
            ? []
            : (array) $request->get('project_ids', []);
        $this->assertProjectIdsAreVisibleToActor($actor, $projectIds);

        $user = User::create([
            'name' => $request->name,
            'email' => $request->email,
            'password' => $request->password, // Will be hashed by model mutator
            'must_change_password' => true,
            'role' => $request->role,
            'pole' => in_array($request->role, [User::ROLE_POLE_DIRECTOR, User::ROLE_REGIONAL_HSE_MANAGER], true) ? $request->pole : null,
            'phone' => $request->phone,
            'preferred_language' => $request->role === User::ROLE_CONSULTATION ? 'fr' : null,
            'is_active' => $request->get('is_active', true),
            'created_by' => $actor->id,
        ]);

        // Assign projects if provided
        if ($request->has('project_ids') && !in_array($request->role, [User::ROLE_POLE_DIRECTOR, User::ROLE_REGIONAL_HSE_MANAGER], true)) {
            $user->projects()->sync($projectIds);
        }

        $user->load('projects');

        return $this->success($user, 'User created successfully', 201);
    }

    /**
     * Get a specific user
     */
    public function show(User $user)
    {
        $actor = request()->user();
        if ($actor) {
            $this->assertCanManageUser($actor, $user);
        }
        $user->load('projects', 'kpiReports');

        return $this->success($user);
    }

    /**
     * Update a user
     */
    public function update(Request $request, User $user)
    {
        $actor = $request->user();
        if ($actor) {
            $this->assertCanManageUser($actor, $user);
        }

        $role = $request->has('role') ? $request->input('role') : $user->role;
        $allowedRoles = $actor ? $this->getAllowedRolesForActor($actor) : [];

        if ($actor && $actor->isHseManager() && $actor->id === $user->id) {
            // Allow an HSE manager to keep their own role unchanged without validation issues.
            $allowedRoles = array_values(array_unique(array_merge($allowedRoles, [User::ROLE_HSE_MANAGER])));
        }

        if ($actor && $actor->isRegionalHseManager() && $actor->id === $user->id) {
            $allowedRoles = array_values(array_unique(array_merge($allowedRoles, [User::ROLE_REGIONAL_HSE_MANAGER])));
        }
        $request->validate([
            'name' => 'sometimes|string|max:255',
            'email' => ['sometimes', 'email', Rule::unique('users')->ignore($user->id)],
            'password' => PasswordPolicy::rulesForRole($role, false, false),
            'role' => ['sometimes', Rule::in($allowedRoles)],
            'pole' => 'nullable|string|max:255|required_if:role,pole_director,regional_hse_manager',
            'phone' => 'nullable|string|max:20',
            'is_active' => 'boolean',
            'project_ids' => 'nullable|array',
            'project_ids.*' => 'exists:projects,id',
        ]);

        $data = $request->only(['name', 'email', 'role', 'phone', 'is_active', 'pole']);

        if ($request->has('role') && $request->role === User::ROLE_CONSULTATION) {
            $data['preferred_language'] = 'fr';
        }

        if ($request->has('role') && !in_array($request->role, [User::ROLE_POLE_DIRECTOR, User::ROLE_REGIONAL_HSE_MANAGER], true)) {
            $data['pole'] = null;
        }

        if ($request->filled('password')) {
            $data['password'] = $request->password; // Will be hashed by model mutator
            $data['must_change_password'] = true;
        }

        $user->update($data);

        // Update project assignments if provided
        if ($request->has('project_ids')) {
            $roleAfterUpdate = $request->has('role') ? $request->role : $user->role;
            if (in_array($roleAfterUpdate, [User::ROLE_POLE_DIRECTOR, User::ROLE_REGIONAL_HSE_MANAGER], true)) {
                $user->projects()->detach();
            } else {
                $projectIds = (array) $request->get('project_ids', []);
                if ($actor) {
                    $this->assertProjectIdsAreVisibleToActor($actor, $projectIds);
                }
                $user->projects()->sync($projectIds);
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
        $actor = request()->user();
        if ($actor) {
            $this->assertCanManageUser($actor, $user);
        }

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
        if (in_array($user->role, [User::ROLE_POLE_DIRECTOR, User::ROLE_REGIONAL_HSE_MANAGER], true)) {
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
