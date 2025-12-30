<?php

namespace App\Http\Controllers\Api;

use App\Http\Controllers\Controller;
use App\Models\User;
use App\Support\PasswordPolicy;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\Auth;
use Illuminate\Support\Facades\Hash;
use Illuminate\Support\Facades\Password;
use Illuminate\Validation\ValidationException;

class AuthController extends Controller
{
    /**
     * Login user and create token
     */
    public function login(Request $request)
    {
        $request->validate([
            'email' => 'required|email',
            'password' => 'required|string|min:6',
        ]);

        $user = User::where('email', $request->email)->first();

        if (!$user || !Hash::check($request->password, $user->password)) {
            return $this->error('The provided credentials are incorrect.', 401);
        }

        if (!$user->is_active) {
            return $this->error('Your account has been deactivated. Please contact administrator.', 403);
        }

        // Revoke previous tokens
        $user->tokens()->delete();

        $token = $user->createToken('auth-token')->plainTextToken;

        return $this->success([
            'user' => [
                'id' => $user->id,
                'name' => $user->name,
                'email' => $user->email,
                'role' => $user->role,
                'pole' => $user->pole,
                'avatar' => $user->avatar,
                'project_list_preference' => $user->project_list_preference ?? 'code',
                'must_change_password' => (bool) $user->must_change_password,
            ],
            'token' => $token,
        ], 'Login successful');
    }

    /**
     * Register new user (Admin only)
     */
    public function register(Request $request)
    {
        $role = $request->input('role');
        $request->validate([
            'name' => 'required|string|max:255',
            'email' => 'required|email|unique:users,email',
            'password' => PasswordPolicy::rulesForRole($role, true, true),
            'role' => 'required|in:admin,hse_manager,responsable,supervisor,hr,user,dev,pole_director,works_director,hse_director,hr_director',
            'phone' => 'nullable|string|max:20',
        ]);

        $user = User::create([
            'name' => $request->name,
            'email' => $request->email,
            'password' => $request->password,
            'must_change_password' => true,
            'role' => $request->role,
            'phone' => $request->phone,
            'is_active' => true,
        ]);

        return $this->success($user, 'User registered successfully', 201);
    }

    /**
     * Logout user (revoke token)
     */
    public function logout(Request $request)
    {
        $request->user()->currentAccessToken()->delete();

        return $this->success(null, 'Logged out successfully');
    }

    /**
     * Get authenticated user
     */
    public function me(Request $request)
    {
        $user = $request->user();
        $user->load('projects');

        return $this->success([
            'id' => $user->id,
            'name' => $user->name,
            'email' => $user->email,
            'role' => $user->role,
            'pole' => $user->pole,
            'phone' => $user->phone,
            'avatar' => $user->avatar,
            'project_list_preference' => $user->project_list_preference ?? 'code',
            'must_change_password' => (bool) $user->must_change_password,
            'is_active' => $user->is_active,
            'projects' => $user->projects,
            'created_at' => $user->created_at,
        ]);
    }

    /**
     * Update user profile
     */
    public function updateProfile(Request $request)
    {
        $user = $request->user();

        $request->validate([
            'name' => 'sometimes|string|max:255',
            'phone' => 'nullable|string|max:20',
            'avatar' => 'nullable|string',
            'project_list_preference' => 'sometimes|in:code,name',
        ]);

        $user->update($request->only(['name', 'phone', 'avatar', 'project_list_preference']));

        $user->refresh();
        $user->load('projects');

        return $this->success([
            'id' => $user->id,
            'name' => $user->name,
            'email' => $user->email,
            'role' => $user->role,
            'pole' => $user->pole,
            'phone' => $user->phone,
            'avatar' => $user->avatar,
            'project_list_preference' => $user->project_list_preference ?? 'code',
            'must_change_password' => (bool) $user->must_change_password,
            'is_active' => $user->is_active,
            'projects' => $user->projects,
            'created_at' => $user->created_at,
        ], 'Profile updated successfully');
    }

    /**
     * Change password
     */
    public function changePassword(Request $request)
    {
        $user = $request->user();
        $request->validate([
            'current_password' => 'required|string',
            'password' => PasswordPolicy::rulesForRole($user?->role, true, true),
        ]);

        if (!Hash::check($request->current_password, $user->password)) {
            return $this->error('Current password is incorrect', 422);
        }

        $user->update([
            'password' => $request->password,
            'must_change_password' => false,
        ]);

        return $this->success(null, 'Password changed successfully');
    }

    /**
     * Send password reset link
     */
    public function forgotPassword(Request $request)
    {
        $request->validate([
            'email' => 'required|email|exists:users,email',
        ]);

        try {
            $status = Password::sendResetLink(
                $request->only('email')
            );

            if ($status === Password::RESET_LINK_SENT) {
                return $this->success(null, 'Password reset link sent to your email');
            }

            return $this->error('Unable to send reset link. Please try again later.', 422);
        } catch (\Exception $e) {
            \Log::error('Password reset email failed: ' . $e->getMessage());
            return $this->error('Email service is currently unavailable. Please contact administrator.', 503);
        }
    }

    /**
     * Reset password
     */
    public function resetPassword(Request $request)
    {
        $request->validate([
            'token' => 'required',
            'email' => 'required|email',
            'password' => 'required|string|min:8|confirmed',
        ]);

        $role = User::where('email', $request->email)->value('role');
        $request->validate([
            'password' => PasswordPolicy::rulesForRole($role, true, true),
        ]);

        $status = Password::reset(
            $request->only('email', 'password', 'password_confirmation', 'token'),
            function ($user, $password) {
                $user->update([
                    'password' => $password,
                    'must_change_password' => false,
                ]);
            }
        );

        if ($status === Password::PASSWORD_RESET) {
            return $this->success(null, 'Password has been reset');
        }

        return $this->error('Unable to reset password', 400);
    }
}
