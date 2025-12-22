import { useState } from 'react'
import { useAuthStore } from '../../store/authStore'
import { useLanguage } from '../../i18n'
import useThemeStore from '../../stores/themeStore'
import {
  User,
  Mail,
  Phone,
  Shield,
  Key,
  Save,
  Loader2,
  Eye,
  EyeOff,
  Moon,
  Sun,
} from 'lucide-react'
import toast from 'react-hot-toast'

export default function Profile() {
  const { user, updateProfile, changePassword } = useAuthStore()
  const { language, setLanguage, languages } = useLanguage()
  const { isDark, toggleTheme } = useThemeStore()
  
  const [profileData, setProfileData] = useState({
    name: user?.name ?? '',
    phone: user?.phone ?? ''
  })

  const [preferencesData, setPreferencesData] = useState({
    project_list_preference: user?.project_list_preference ?? 'code',
  })
  
  const [passwordData, setPasswordData] = useState({
    current_password: '',
    password: '',
    password_confirmation: ''
  })
  
  const [showPasswords, setShowPasswords] = useState({
    current: false,
    new: false,
    confirm: false
  })
  
  const [savingProfile, setSavingProfile] = useState(false)
  const [savingPassword, setSavingPassword] = useState(false)
  const [savingPreferences, setSavingPreferences] = useState(false)

  const handleProfileSubmit = async (e) => {
    e.preventDefault()
    setSavingProfile(true)
    
    try {
      await updateProfile(profileData)
      toast.success('Profile updated successfully')
    } catch (error) {
      toast.error(error.response?.data?.message ?? 'Failed to update profile')
    } finally {
      setSavingProfile(false)
    }
  }

  const handlePreferencesSubmit = async () => {
    setSavingPreferences(true)
    try {
      await updateProfile(preferencesData)
      toast.success('Preferences updated successfully')
    } catch (error) {
      toast.error(error.response?.data?.message ?? 'Failed to update preferences')
    } finally {
      setSavingPreferences(false)
    }
  }

  const handlePasswordSubmit = async (e) => {
    e.preventDefault()
    
    if (passwordData.password !== passwordData.password_confirmation) {
      toast.error('Passwords do not match')
      return
    }
    
    if (passwordData.password.length < 8) {
      toast.error('Password must be at least 8 characters')
      return
    }
    
    setSavingPassword(true)
    
    try {
      await changePassword(
        passwordData.current_password,
        passwordData.password,
        passwordData.password_confirmation
      )
      toast.success('Password changed successfully')
      setPasswordData({
        current_password: '',
        password: '',
        password_confirmation: ''
      })
    } catch (error) {
      toast.error(error.response?.data?.message || 'Failed to change password')
    } finally {
      setSavingPassword(false)
    }
  }

  return (
    <div className="max-w-3xl mx-auto space-y-6 animate-fade-in">
      {/* Header */}
      <div>
        <h1 className="text-2xl font-bold text-gray-900 dark:text-gray-100">Profile Settings</h1>
        <p className="text-gray-500 dark:text-gray-400 mt-1">Manage your account settings and preferences</p>
      </div>

      {/* Profile Info Card */}
      <div className="card">
        <div className="card-header">
          <h3 className="font-semibold text-gray-900 dark:text-gray-100">Profile Information</h3>
        </div>
        <form onSubmit={handleProfileSubmit} className="p-6 space-y-6">
          {/* Avatar Section */}
          <div className="flex items-center gap-6">
            <div className="w-20 h-20 bg-hse-primary rounded-full flex items-center justify-center">
              <span className="text-white text-2xl font-bold">
                {user?.name?.charAt(0)?.toUpperCase() || 'U'}
              </span>
            </div>
            <div>
              <h4 className="font-medium text-gray-900 dark:text-gray-100">{user?.name}</h4>
              <p className="text-sm text-gray-500 dark:text-gray-400 capitalize flex items-center gap-1">
                <Shield className="w-4 h-4" />
                {user?.role}
              </p>
            </div>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div>
              <label className="label">Full Name</label>
              <div className="relative">
                <User className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
                <input
                  type="text"
                  value={profileData.name}
                  onChange={(e) => setProfileData({ ...profileData, name: e.target.value })}
                  className="input pl-10"
                  required
                />
              </div>
            </div>
            
            <div>
              <label className="label">Email Address</label>
              <div className="relative">
                <Mail className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
                <input
                  type="email"
                  value={user?.email ?? ''}
                  className="input pl-10 bg-gray-50 dark:bg-gray-900"
                  disabled
                />
              </div>
              <p className="text-xs text-gray-500 dark:text-gray-400 mt-1">Email cannot be changed</p>
            </div>
            
            <div>
              <label className="label">Phone Number</label>
              <div className="relative">
                <Phone className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
                <input
                  type="tel"
                  value={profileData.phone}
                  onChange={(e) => setProfileData({ ...profileData, phone: e.target.value })}
                  className="input pl-10"
                  placeholder="+212 6XX XXX XXX"
                />
              </div>
            </div>
            
            <div>
              <label className="label">Role</label>
              <div className="relative">
                <Shield className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
                <input
                  type="text"
                  value={user?.role ?? ''}
                  className="input pl-10 bg-gray-50 dark:bg-gray-900 capitalize"
                  disabled
                />
              </div>
            </div>
          </div>

          <div className="flex justify-end">
            <button type="submit" disabled={savingProfile} className="btn-primary">
              {savingProfile ? (
                <span className="flex items-center gap-2">
                  <Loader2 className="w-4 h-4 animate-spin" />
                  Saving...
                </span>
              ) : (
                <span className="flex items-center gap-2">
                  <Save className="w-4 h-4" />
                  Save Changes
                </span>
              )}
            </button>
          </div>
        </form>
      </div>

      {/* Change Password Card */}
      <div className="card">
        <div className="card-header">
          <h3 className="font-semibold text-gray-900 dark:text-gray-100">Change Password</h3>
        </div>
        <form onSubmit={handlePasswordSubmit} className="p-6 space-y-4">
          <div>
            <label className="label">Current Password</label>
            <div className="relative">
              <Key className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
              <input
                type={showPasswords.current ? 'text' : 'password'}
                value={passwordData.current_password}
                onChange={(e) => setPasswordData({ ...passwordData, current_password: e.target.value })}
                className="input pl-10 pr-10"
                required
              />
              <button
                type="button"
                onClick={() => setShowPasswords({ ...showPasswords, current: !showPasswords.current })}
                className="absolute right-3 top-1/2 -translate-y-1/2"
              >
                {showPasswords.current ? (
                  <EyeOff className="w-4 h-4 text-gray-400" />
                ) : (
                  <Eye className="w-4 h-4 text-gray-400" />
                )}
              </button>
            </div>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div>
              <label className="label">New Password</label>
              <div className="relative">
                <Key className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
                <input
                  type={showPasswords.new ? 'text' : 'password'}
                  value={passwordData.password}
                  onChange={(e) => setPasswordData({ ...passwordData, password: e.target.value })}
                  className="input pl-10 pr-10"
                  required
                  minLength={8}
                />
                <button
                  type="button"
                  onClick={() => setShowPasswords({ ...showPasswords, new: !showPasswords.new })}
                  className="absolute right-3 top-1/2 -translate-y-1/2"
                >
                  {showPasswords.new ? (
                    <EyeOff className="w-4 h-4 text-gray-400" />
                  ) : (
                    <Eye className="w-4 h-4 text-gray-400" />
                  )}
                </button>
              </div>
            </div>
            
            <div>
              <label className="label">Confirm New Password</label>
              <div className="relative">
                <Key className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
                <input
                  type={showPasswords.confirm ? 'text' : 'password'}
                  value={passwordData.password_confirmation}
                  onChange={(e) => setPasswordData({ ...passwordData, password_confirmation: e.target.value })}
                  className="input pl-10 pr-10"
                  required
                  minLength={8}
                />
                <button
                  type="button"
                  onClick={() => setShowPasswords({ ...showPasswords, confirm: !showPasswords.confirm })}
                  className="absolute right-3 top-1/2 -translate-y-1/2"
                >
                  {showPasswords.confirm ? (
                    <EyeOff className="w-4 h-4 text-gray-400" />
                  ) : (
                    <Eye className="w-4 h-4 text-gray-400" />
                  )}
                </button>
              </div>
            </div>
          </div>

          <p className="text-sm text-gray-500 dark:text-gray-400">
            Password must be at least 8 characters long
          </p>

          <div className="flex justify-end">
            <button type="submit" disabled={savingPassword} className="btn-primary">
              {savingPassword ? (
                <span className="flex items-center gap-2">
                  <Loader2 className="w-4 h-4 animate-spin" />
                  Changing...
                </span>
              ) : (
                <span className="flex items-center gap-2">
                  <Key className="w-4 h-4" />
                  Change Password
                </span>
              )}
            </button>
          </div>
        </form>
      </div>

      {/* Preferences */}
      <div className="card p-6">
        <h3 className="font-semibold text-gray-900 dark:text-gray-100 mb-4">Preferences</h3>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <div>
            <label className="label">Language</label>
            <select
              className="input"
              value={language}
              onChange={(e) => setLanguage(e.target.value)}
            >
              {languages.map((lang) => (
                <option key={lang.code} value={lang.code}>
                  {lang.name}
                </option>
              ))}
            </select>
          </div>
          <div>
            <label className="label">Project list preference</label>
            <select
              className="input"
              value={preferencesData.project_list_preference}
              onChange={(e) => setPreferencesData({ ...preferencesData, project_list_preference: e.target.value })}
            >
              <option value="code">By code</option>
              <option value="name">By name</option>
            </select>
          </div>
          <div>
            <label className="label">Theme</label>
            <button
              type="button"
              onClick={toggleTheme}
              className="w-full flex items-center justify-between px-3 py-2 rounded-lg border border-gray-200 dark:border-gray-700 bg-gray-50 dark:bg-gray-900"
            >
              <span className="text-sm text-gray-700 dark:text-gray-200">
                {isDark ? 'Dark mode' : 'Light mode'}
              </span>
              <span className="flex items-center gap-1.5 text-gray-600 dark:text-gray-300">
                {isDark ? <Moon className="w-4 h-4" /> : <Sun className="w-4 h-4" />}
              </span>
            </button>
          </div>
        </div>

        <div className="flex justify-end mt-4">
          <button type="button" onClick={handlePreferencesSubmit} disabled={savingPreferences} className="btn-primary">
            {savingPreferences ? (
              <span className="flex items-center gap-2">
                <Loader2 className="w-4 h-4 animate-spin" />
                Saving...
              </span>
            ) : (
              <span className="flex items-center gap-2">
                <Save className="w-4 h-4" />
                Save Preferences
              </span>
            )}
          </button>
        </div>
      </div>
    </div>
  )
}
