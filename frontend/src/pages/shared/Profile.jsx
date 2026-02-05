import { useEffect, useMemo, useState } from 'react'
import { useAuthStore } from '../../store/authStore'
import { useLanguage } from '../../i18n'
import useThemeStore from '../../stores/themeStore'
import PasswordStrength, { checkPasswordAgainstPolicy, getPasswordPolicy } from '../../components/ui/PasswordStrength'
import { backupService } from '../../services/api'
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
  const { t, language, setLanguage, languages } = useLanguage()
  const { isDark, toggleTheme } = useThemeStore()

  const passwordPolicy = useMemo(() => getPasswordPolicy(user?.role), [user?.role])
  
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

  const isStrictAdmin = (user?.role ?? '') === 'admin'
  const [backupSettings, setBackupSettings] = useState(null)
  const [backupFrequencyHours, setBackupFrequencyHours] = useState(12)
  const [loadingBackupSettings, setLoadingBackupSettings] = useState(false)
  const [savingBackupSettings, setSavingBackupSettings] = useState(false)
  const [downloadingBackup, setDownloadingBackup] = useState(false)

  const extractFilename = (contentDisposition) => {
    if (!contentDisposition) return null
    const match = /filename\*=UTF-8''([^;]+)|filename="?([^";]+)"?/i.exec(contentDisposition)
    const value = decodeURIComponent(match?.[1] ?? match?.[2] ?? '')
    return value !== '' ? value : null
  }

  const loadBackupSettings = async () => {
    if (!isStrictAdmin) return
    setLoadingBackupSettings(true)
    try {
      const res = await backupService.getSettings()
      const data = res.data?.data ?? res.data
      setBackupSettings(data)
      setBackupFrequencyHours(Number(data?.frequency_hours ?? 12) || 12)
    } catch (error) {
      toast.error(error.response?.data?.message ?? t('errors.failedToLoad'))
      setBackupSettings(null)
    } finally {
      setLoadingBackupSettings(false)
    }
  }

  useEffect(() => {
    loadBackupSettings()
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isStrictAdmin])

  const handleProfileSubmit = async (e) => {
    e.preventDefault()
    setSavingProfile(true)
    
    try {
      await updateProfile(profileData)
      toast.success(t('profile.profileUpdated'))
    } catch (error) {
      toast.error(error.response?.data?.message ?? t('errors.failedToSave'))
    } finally {
      setSavingProfile(false)
    }
  }

  const handlePreferencesSubmit = async () => {
    setSavingPreferences(true)
    try {
      await updateProfile(preferencesData)
      toast.success(t('profile.preferencesUpdated'))
    } catch (error) {
      toast.error(error.response?.data?.message ?? t('errors.failedToSave'))
    } finally {
      setSavingPreferences(false)
    }
  }

  const handlePasswordSubmit = async (e) => {
    e.preventDefault()
    
    if (passwordData.password !== passwordData.password_confirmation) {
      toast.error(t('profile.passwordMismatch'))
      return
    }

    if (!checkPasswordAgainstPolicy(passwordData.password, passwordPolicy).ok) {
      toast.error(t('auth.passwordPolicy.invalid'))
      return
    }
    
    setSavingPassword(true)
    
    try {
      await changePassword(
        passwordData.current_password,
        passwordData.password,
        passwordData.password_confirmation
      )
      toast.success(t('success.passwordChanged'))
      setPasswordData({
        current_password: '',
        password: '',
        password_confirmation: ''
      })
    } catch (error) {
      toast.error(error.response?.data?.message || t('errors.failedToSave'))
    } finally {
      setSavingPassword(false)
    }
  }

  return (
    <div className="max-w-3xl mx-auto space-y-6 animate-fade-in">
      {/* Header */}
      <div>
        <h1 className="text-2xl font-bold text-gray-900 dark:text-gray-100">{t('profile.title')}</h1>
        <p className="text-gray-500 dark:text-gray-400 mt-1">{t('profile.subtitle')}</p>
      </div>

      {/* Profile Info Card */}
      <div className="card">
        <div className="card-header">
          <h3 className="font-semibold text-gray-900 dark:text-gray-100">{t('profile.personalInfo')}</h3>
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
              <label className="label">{t('users.form.fullName')}</label>
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
              <label className="label">{t('users.form.email')}</label>
              <div className="relative">
                <Mail className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
                <input
                  type="email"
                  value={user?.email ?? ''}
                  className="input pl-10 bg-gray-50 dark:bg-gray-900"
                  disabled
                />
              </div>
              <p className="text-xs text-gray-500 dark:text-gray-400 mt-1">{t('profile.emailReadOnly')}</p>
            </div>
            
            <div>
              <label className="label">{t('users.form.phone')}</label>
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
              <label className="label">{t('users.form.role')}</label>
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
                  {t('common.saving')}
                </span>
              ) : (
                <span className="flex items-center gap-2">
                  <Save className="w-4 h-4" />
                  {t('profile.updateProfile')}
                </span>
              )}
            </button>
          </div>
        </form>
      </div>

      {/* Change Password Card */}
      <div className="card">
        <div className="card-header">
          <h3 className="font-semibold text-gray-900 dark:text-gray-100">{t('profile.changePassword')}</h3>
        </div>
        <form onSubmit={handlePasswordSubmit} className="p-6 space-y-4">
          <div>
            <label className="label">{t('auth.currentPassword')}</label>
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
              <label className="label">{t('auth.newPassword')}</label>
              <div className="relative">
                <Key className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
                <input
                  type={showPasswords.new ? 'text' : 'password'}
                  value={passwordData.password}
                  onChange={(e) => setPasswordData({ ...passwordData, password: e.target.value })}
                  className="input pl-10 pr-10"
                  required
                  minLength={passwordPolicy.minLength}
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
              <label className="label">{t('auth.confirmPassword')}</label>
              <div className="relative">
                <Key className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
                <input
                  type={showPasswords.confirm ? 'text' : 'password'}
                  value={passwordData.password_confirmation}
                  onChange={(e) => setPasswordData({ ...passwordData, password_confirmation: e.target.value })}
                  className="input pl-10 pr-10"
                  required
                  minLength={passwordPolicy.minLength}
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

          <PasswordStrength password={passwordData.password} role={user?.role} />

          <div className="flex justify-end">
            <button
              type="submit"
              disabled={savingPassword}
              className="btn-primary"
            >
              {savingPassword ? (
                <span className="flex items-center gap-2">
                  <Loader2 className="w-4 h-4 animate-spin" />
                  {t('common.saving')}
                </span>
              ) : (
                <span className="flex items-center gap-2">
                  <Key className="w-4 h-4" />
                  {t('profile.changePassword')}
                </span>
              )}
            </button>
          </div>
        </form>
      </div>

      {/* Preferences */}
      <div className="card p-6">
        <h3 className="font-semibold text-gray-900 dark:text-gray-100 mb-4">{t('profile.preferencesTitle')}</h3>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <div>
            <label className="label">{t('profile.language')}</label>
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
            <label className="label">{t('profile.projectListPreference')}</label>
            <select
              className="input"
              value={preferencesData.project_list_preference}
              onChange={(e) => setPreferencesData({ ...preferencesData, project_list_preference: e.target.value })}
            >
              <option value="code">{t('profile.projectListByCode')}</option>
              <option value="name">{t('profile.projectListByName')}</option>
            </select>
          </div>
          <div>
            <label className="label">{t('profile.theme')}</label>
            <button
              type="button"
              onClick={toggleTheme}
              className="w-full flex items-center justify-between px-3 py-2 rounded-lg border border-gray-200 dark:border-gray-700 bg-gray-50 dark:bg-gray-900"
            >
              <span className="text-sm text-gray-700 dark:text-gray-200">
                {isDark ? t('common.darkMode') : t('common.lightMode')}
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
                {t('common.saving')}
              </span>
            ) : (
              <span className="flex items-center gap-2">
                <Save className="w-4 h-4" />
                {t('profile.savePreferences')}
              </span>
            )}
          </button>
        </div>
      </div>

      {isStrictAdmin && (
        <div className="card p-6">
          <div className="flex items-start justify-between gap-4">
            <div>
              <h3 className="font-semibold text-gray-900 dark:text-gray-100">{t('profile.backup.title')}</h3>
              <p className="text-sm text-gray-500 dark:text-gray-400 mt-1">{t('profile.backup.subtitle')}</p>
              {!!backupSettings?.last_run_at && (
                <p className="text-xs text-gray-500 dark:text-gray-400 mt-1">
                  {t('profile.backup.lastRun')}: {String(backupSettings.last_run_at)}
                </p>
              )}
              {!!backupSettings?.latest_filename && (
                <p className="text-xs text-gray-500 dark:text-gray-400 mt-1">
                  {t('profile.backup.latestFile')}: {String(backupSettings.latest_filename)}
                </p>
              )}
            </div>
            <button
              type="button"
              onClick={loadBackupSettings}
              disabled={loadingBackupSettings}
              className="btn-secondary"
            >
              {loadingBackupSettings ? t('common.loading') : t('common.refresh')}
            </button>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mt-4">
            <div>
              <label className="label">{t('profile.backup.frequency')}</label>
              <select
                className="input"
                value={backupFrequencyHours}
                onChange={(e) => setBackupFrequencyHours(Number(e.target.value) || 12)}
              >
                <option value={6}>6h</option>
                <option value={12}>12h</option>
                <option value={24}>24h</option>
                <option value={48}>48h</option>
              </select>
            </div>

            <div className="flex items-end justify-end gap-3">
              <button
                type="button"
                className="btn-primary"
                disabled={savingBackupSettings}
                onClick={async () => {
                  setSavingBackupSettings(true)
                  try {
                    await backupService.updateSettings({ frequency_hours: backupFrequencyHours })
                    toast.success(t('success.saved'))
                    await loadBackupSettings()
                  } catch (error) {
                    toast.error(error.response?.data?.message ?? t('errors.failedToSave'))
                  } finally {
                    setSavingBackupSettings(false)
                  }
                }}
              >
                {savingBackupSettings ? t('common.saving') : t('common.save')}
              </button>

              <button
                type="button"
                className="btn-secondary"
                disabled={downloadingBackup}
                onClick={async () => {
                  setDownloadingBackup(true)
                  try {
                    const res = await backupService.downloadLatest()
                    const blob = new Blob([res.data], { type: 'application/zip' })
                    const url = window.URL.createObjectURL(blob)
                    const a = document.createElement('a')
                    a.href = url
                    const filename = extractFilename(res.headers?.['content-disposition']) || 'backup.zip'
                    a.setAttribute('download', filename)
                    document.body.appendChild(a)
                    a.click()
                    a.remove()
                    window.URL.revokeObjectURL(url)
                  } catch (error) {
                    toast.error(error.response?.data?.message ?? t('errors.downloadFailed'))
                  } finally {
                    setDownloadingBackup(false)
                  }
                }}
              >
                {downloadingBackup ? t('common.loading') : t('profile.backup.downloadLatest')}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
