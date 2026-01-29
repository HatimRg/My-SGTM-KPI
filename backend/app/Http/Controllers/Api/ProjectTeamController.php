<?php

namespace App\Http\Controllers\Api;

use App\Http\Controllers\Controller;
use App\Exports\ProjectTeamFailedRowsExport;
use App\Exports\ProjectTeamTemplateExport;
use App\Imports\ProjectTeamImport;
use App\Models\Project;
use App\Models\User;
use App\Services\NotificationService;
use App\Support\PasswordPolicy;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Log;
use Illuminate\Support\Facades\Storage;
use Maatwebsite\Excel\Excel as ExcelFormat;
use Maatwebsite\Excel\Facades\Excel;

class ProjectTeamController extends Controller
{
    /**
     * Get team members for a project
     */
    public function index(Request $request, Project $project)
    {
        $user = $request->user();

        // Check if user has access to this project
        if (!$user->canAccessProject($project)) {
            return $this->error('Access denied', 403);
        }

        $teamMembers = $project->teamMembers()
            ->get()
            ->map(function ($member) {
                $addedByUser = $member->pivot->added_by ? User::find($member->pivot->added_by) : null;
                return [
                    'id' => $member->id,
                    'name' => $member->name,
                    'email' => $member->email,
                    'role' => $member->role,
                    'added_by' => $member->pivot->added_by,
                    'added_by_name' => $addedByUser->name ?? null,
                    'added_at' => $member->pivot->created_at,
                ];
            });

        return $this->success($teamMembers);
    }

    /**
     * Get available HSE Officers to add to team
     */
    public function available(Request $request, Project $project)
    {
        $user = $request->user();

        // Only HSE Managers assigned to project or admins can view available officers
        if (!$user->canAccessProject($project)) {
            return $this->error('Access denied', 403);
        }

        // Get HSE Officers not already in the team
        $existingTeamIds = $project->teamMembers()->pluck('users.id')->toArray();
        
        $availableOfficers = User::hseOfficers()
            ->active()
            ->whereNotIn('id', $existingTeamIds)
            ->select('id', 'name', 'email')
            ->orderBy('name')
            ->get();

        return $this->success($availableOfficers);
    }

    /**
     * Add a team member to project
     */
    public function store(Request $request, Project $project)
    {
        $user = $request->user();

        // Only HSE Managers assigned to project or admins can add team members
        if (!$user->hasGlobalProjectScope() && !$user->isAdminLike()) {
            if (!$user->isHseManager() && !$user->isResponsable()) {
                return $this->error('Only HSE Managers can manage team members', 403);
            }
        }

        if (!$user->canAccessProject($project)) {
            return $this->error('You are not assigned to this project', 403);
        }

        $request->validate([
            'user_id' => 'required|exists:users,id',
        ]);

        $officer = User::find($request->user_id);

        // Verify the user is an HSE Officer
        if (!$officer->isUser()) {
            return $this->error('Only HSE Officers can be added to teams', 422);
        }

        // Check if already in team
        if ($project->teamMembers()->where('users.id', $officer->id)->exists()) {
            return $this->error('This user is already in the team', 422);
        }

        // Add to team
        $project->teamMembers()->attach($officer->id, [
            'added_by' => $user->id,
        ]);

        // Notify the HSE Officer
        NotificationService::sendToUser(
            $officer,
            'Ajouté à l\'équipe projet',
            "Vous avez été ajouté à l'équipe du projet {$project->name} par {$user->name}",
            'project_assigned',
            ['project_id' => $project->id],
            $project->id,
            "/sor/projects/{$project->id}"
        );

        return $this->success([
            'id' => $officer->id,
            'name' => $officer->name,
            'email' => $officer->email,
            'role' => $officer->role,
            'added_by' => $user->id,
            'added_by_name' => $user->name,
            'added_at' => now(),
        ], 'Team member added successfully');
    }

    /**
     * Remove a team member from project
     */
    public function destroy(Request $request, Project $project, User $teamMember)
    {
        $user = $request->user();

        // Only HSE Managers assigned to project or admins can remove team members
        if (!$user->hasGlobalProjectScope() && !$user->isAdminLike()) {
            if (!$user->isHseManager() && !$user->isResponsable()) {
                return $this->error('Only HSE Managers can manage team members', 403);
            }
        }

        if (!$user->canAccessProject($project)) {
            return $this->error('You are not assigned to this project', 403);
        }

        // Check if user is in team
        if (!$project->teamMembers()->where('users.id', $teamMember->id)->exists()) {
            return $this->error('This user is not in the team', 404);
        }

        // Remove from team
        $project->teamMembers()->detach($teamMember->id);

        // Notify the HSE Officer
        NotificationService::sendToUser(
            $teamMember,
            'Retiré de l\'équipe projet',
            "Vous avez été retiré de l'équipe du projet {$project->name}",
            'info',
            ['project_id' => $project->id],
            $project->id
        );

        return $this->success(null, 'Team member removed successfully');
    }

    /**
     * Bulk add team members
     */
    public function bulkAdd(Request $request, Project $project)
    {
        $user = $request->user();

        // Only HSE Managers assigned to project or admins can add team members
        if (!$user->hasGlobalProjectScope() && !$user->isAdminLike()) {
            if (!$user->isHseManager() && !$user->isResponsable()) {
                return $this->error('Only HSE Managers can manage team members', 403);
            }
        }

        if (!$user->canAccessProject($project)) {
            return $this->error('You are not assigned to this project', 403);
        }

        $request->validate([
            'user_ids' => 'required|array|min:1',
            'user_ids.*' => 'exists:users,id',
        ]);

        $addedCount = 0;
        $existingTeamIds = $project->teamMembers()->pluck('users.id')->toArray();

        foreach ($request->user_ids as $userId) {
            $officer = User::find($userId);
            
            // Skip if not HSE Officer or already in team
            if (!$officer || !$officer->isUser() || in_array($userId, $existingTeamIds)) {
                continue;
            }

            $project->teamMembers()->attach($userId, [
                'added_by' => $user->id,
            ]);

            // Notify the HSE Officer
            NotificationService::sendToUser(
                $officer,
                'Ajouté à l\'équipe projet',
                "Vous avez été ajouté à l'équipe du projet {$project->name} par {$user->name}",
                'project_assigned',
                ['project_id' => $project->id],
                $project->id,
                "/sor/projects/{$project->id}"
            );

            $addedCount++;
        }

        return $this->success([
            'added_count' => $addedCount,
        ], "{$addedCount} team member(s) added successfully");
    }

    public function downloadTemplate(Request $request, Project $project)
    {
        $user = $request->user();

        if (!$user->hasGlobalProjectScope() && !$user->isAdminLike()) {
            if (!$user->isHseManager() && !$user->isResponsable()) {
                return $this->error('Only HSE Managers can manage team members', 403);
            }
        }

        if (!$user->canAccessProject($project)) {
            return $this->error('You are not assigned to this project', 403);
        }

        try {
            if (!class_exists(\ZipArchive::class) || !extension_loaded('zip')) {
                return $this->error('XLSX export requires PHP zip extension (ZipArchive). Please enable/install php-zip on the server.', 422);
            }

            $lang = (string) ($request->get('lang') ?: ($user->preferred_language ?? 'fr'));

            $filename = 'SGTM-Project-Team-Template-' . ($project->code ?: $project->id) . '.xlsx';
            return Excel::download(new ProjectTeamTemplateExport(200, $lang), $filename);
        } catch (\Throwable $e) {
            Log::error('Project team template generation failed', [
                'project_id' => $project->id,
                'error' => $e->getMessage(),
                'trace' => $e->getTraceAsString(),
            ]);
            return $this->error('Failed to generate team template: ' . $e->getMessage(), 422);
        }
    }

    public function bulkImport(Request $request, Project $project)
    {
        $user = $request->user();

        if (!$user) {
            return $this->error('Unauthorized', 401);
        }

        if (!$user->isAdminLike()) {
            if (!$user->isHseManager() && !$user->isResponsable()) {
                return $this->error('Only HSE Managers can manage team members', 403);
            }
        }

        if (!$user->canAccessProject($project)) {
            return $this->error('You are not assigned to this project', 403);
        }

        @ini_set('max_execution_time', '300');
        @ini_set('memory_limit', '512M');

        if (!class_exists(\ZipArchive::class) || !extension_loaded('zip')) {
            return $this->error('XLSX import requires PHP zip extension (ZipArchive). Please enable/install php-zip on the server.', 422);
        }

        $request->validate([
            'file' => 'required|file|mimes:xlsx,xls|max:20480',
        ]);

        $import = new ProjectTeamImport($project, (int) $user->id);

        try {
            DB::beginTransaction();
            Excel::import($import, $request->file('file'));
            DB::commit();
        } catch (\Throwable $e) {
            DB::rollBack();
            Log::error('Project team bulk import failed', [
                'project_id' => $project->id,
                'error' => $e->getMessage(),
                'trace' => $e->getTraceAsString(),
            ]);
            return $this->error('Failed to import team members: ' . $e->getMessage(), 422);
        }

        $errors = $import->getErrors();
        $failedRowsUrl = null;
        if (!empty($errors)) {
            $lang = (string) ($request->get('lang') ?: ($user->preferred_language ?? 'fr'));
            $filename = 'project_team_failed_rows_' . now()->format('Ymd_His') . '.xlsx';
            $path = 'imports/failed_rows/' . $filename;
            $contents = Excel::raw(new ProjectTeamFailedRowsExport($errors, $lang), ExcelFormat::XLSX);
            Storage::disk('public')->put($path, $contents);
            $failedRowsUrl = '/api/imports/failed-rows/' . $filename;
        }

        return $this->success([
            'added_count' => $import->getAddedCount(),
            'failed_count' => count($errors),
            'failed_rows_url' => $failedRowsUrl,
            'errors' => $errors,
        ], 'Team members imported');
    }

    /**
     * Create a new user and add to project team
     * Only responsable can create: responsable, supervisor, animateur
     */
    public function createUser(Request $request, Project $project)
    {
        $user = $request->user();

        if (!$user) {
            return $this->error('Unauthorized', 401);
        }

        // Only responsables assigned to project can create users
        if (!$user->isAdminLike() && !$user->isHseManager() && !$user->isResponsable()) {
            return $this->error('Only HSE Managers can create users', 403);
        }

        if (!$user->canAccessProject($project)) {
            return $this->error('You are not assigned to this project', 403);
        }

        $allowedRoles = $user->isAdminLike()
            ? [User::ROLE_RESPONSABLE, User::ROLE_SUPERVISOR, User::ROLE_USER]
            : ($user->isHseManager() ? User::HSE_MANAGER_CREATABLE_ROLES : User::RESPONSABLE_CREATABLE_ROLES);

        $request->validate([
            'name' => 'required|string|max:255',
            'email' => 'required|email|max:255',
            'cin' => 'required|string|max:50',
            'role' => 'required|in:responsable,supervisor,user',
            'phone' => 'nullable|string|max:20',
            'password' => PasswordPolicy::rulesForRole($request->input('role'), false, false),
        ]);

        if (!in_array($request->role, $allowedRoles, true)) {
            return $this->error('Access denied', 403);
        }

        // Check if CIN already exists
        $existingUser = User::where('cin', $request->cin)->first();

        if ($existingUser) {
            // CIN exists - merge by adding user to this project
            // Check if already in project
            if ($project->users->contains($existingUser->id)) {
                return $this->error('User with this CIN is already assigned to this project', 422);
            }

            // Update user info if needed
            $existingUser->update([
                'name' => $request->name,
                'email' => $request->email,
                'phone' => $request->phone,
                'role' => $request->role,
                'is_active' => true, // Reactivate if was inactive
            ]);

            // Add to project
            $project->users()->attach($existingUser->id, [
                'assigned_at' => now(),
            ]);

            // Notify the user
            NotificationService::sendToUser(
                $existingUser,
                'Affecté à un nouveau projet',
                "Vous avez été affecté au projet {$project->name} par {$user->name}",
                'project_assigned',
                ['project_id' => $project->id],
                $project->id
            );

            return $this->success([
                'user' => $existingUser,
                'merged' => true,
            ], 'Existing user found with this CIN and added to project');
        }

        // Check if email already exists
        if (User::where('email', $request->email)->exists()) {
            return $this->error('A user with this email already exists', 422);
        }

        if (!$request->filled('password')) {
            return $this->error('Password required for new user', 422);
        }

        $newUser = User::create([
            'name' => $request->name,
            'email' => $request->email,
            'cin' => $request->cin,
            'password' => $request->password,
            'must_change_password' => true,
            'role' => $request->role,
            'phone' => $request->phone,
            'is_active' => true,
            'created_by' => $user->id,
        ]);

        // Add to project
        $project->users()->attach($newUser->id, [
            'assigned_at' => now(),
        ]);

        return $this->success([
            'user' => $newUser,
            'merged' => false,
        ], 'New user created and added to project', 201);
    }

    /**
     * Get team members that the responsable can manage (responsable, supervisor, animateur)
     */
    public function manageable(Request $request, Project $project)
    {
        $user = $request->user();

        if (!$user) {
            return $this->error('Unauthorized', 401);
        }

        // Only responsables assigned to project can view
        if (!$user->isHseManager() && !$user->isResponsable() && !$user->isAdminLike()) {
            return $this->error('Access denied', 403);
        }

        if (!$user->canAccessProject($project)) {
            return $this->error('Access denied', 403);
        }

        $members = $project->users()
            ->whereIn('role', $user->isHseManager() ? User::HSE_MANAGER_CREATABLE_ROLES : User::RESPONSABLE_CREATABLE_ROLES)
            ->get()
            ->map(function ($member) {
                return [
                    'id' => $member->id,
                    'name' => $member->name,
                    'email' => $member->email,
                    'cin' => $member->cin,
                    'role' => $member->role,
                    'phone' => $member->phone,
                    'is_active' => $member->is_active,
                    'created_by' => $member->created_by,
                    'assigned_at' => $member->pivot->assigned_at,
                ];
            });

        return $this->success($members);
    }

    /**
     * Remove a user from project (not delete, just unassign)
     */
    public function removeFromProject(Request $request, Project $project, User $member)
    {
        $user = $request->user();

        if (!$user) {
            return $this->error('Unauthorized', 401);
        }

        // Only responsables assigned to project or admins
        if (!$user->isAdminLike()) {
            if (!$user->isHseManager() && !$user->isResponsable()) {
                return $this->error('Only HSE Managers can manage users', 403);
            }
        }

        if (!$user->canAccessProject($project)) {
            return $this->error('You are not assigned to this project', 403);
        }

        // Check if user is in project
        if (!$project->users->contains($member->id)) {
            return $this->error('This user is not assigned to this project', 404);
        }

        // Don't allow removing yourself
        if ($member->id === $user->id) {
            return $this->error('You cannot remove yourself from the project', 422);
        }

        // Remove from project
        $project->users()->detach($member->id);

        // Check if user has any remaining project access
        if (!$member->hasProjectAccess()) {
            // Deactivate user if no project affiliation
            $member->update(['is_active' => false]);
        }

        // Notify the user
        NotificationService::sendToUser(
            $member,
            'Retiré du projet',
            "Vous avez été retiré du projet {$project->name}",
            'info',
            ['project_id' => $project->id],
            $project->id
        );

        return $this->success([
            'removed' => true,
            'deactivated' => !$member->hasProjectAccess(),
        ], 'User removed from project');
    }

    /**
     * Update a team member's info
     */
    public function updateMember(Request $request, Project $project, User $member)
    {
        $user = $request->user();

        if (!$user) {
            return $this->error('Unauthorized', 401);
        }

        // Only responsables assigned to project or admins
        if (!$user->isAdminLike()) {
            if (!$user->isHseManager() && !$user->isResponsable()) {
                return $this->error('Only HSE Managers can manage users', 403);
            }
        }

        if (!$user->canAccessProject($project)) {
            return $this->error('You are not assigned to this project', 403);
        }

        // Check if user is in project
        if (!$project->users->contains($member->id)) {
            return $this->error('This user is not assigned to this project', 404);
        }

        $allowedRoles = $user->isAdminLike()
            ? [User::ROLE_RESPONSABLE, User::ROLE_SUPERVISOR, User::ROLE_USER]
            : ($user->isHseManager() ? User::HSE_MANAGER_CREATABLE_ROLES : User::RESPONSABLE_CREATABLE_ROLES);

        $request->validate([
            'name' => 'sometimes|string|max:255',
            'email' => 'sometimes|email|max:255|unique:users,email,' . $member->id,
            'cin' => 'sometimes|string|max:50|unique:users,cin,' . $member->id,
            'role' => 'sometimes|in:responsable,supervisor,user',
            'phone' => 'nullable|string|max:20',
            'password' => PasswordPolicy::rulesForRole($request->has('role') ? $request->input('role') : $member->role, false, false),
        ]);

        if ($request->filled('role') && !in_array($request->role, $allowedRoles, true)) {
            return $this->error('Access denied', 403);
        }

        $data = $request->only(['name', 'email', 'cin', 'role', 'phone']);

        if ($request->filled('password')) {
            $data['password'] = $request->password;
            $data['must_change_password'] = true;
        }

        $member->update($data);

        return $this->success($member, 'User updated successfully');
    }
}
