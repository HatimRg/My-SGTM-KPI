import { useMemo, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { Key, Eye, EyeOff, Loader2, ShieldCheck } from 'lucide-react'
import toast from 'react-hot-toast'
import { useAuthStore } from '../../store/authStore'
import { useLanguage } from '../../i18n'
import PasswordStrength, { checkPasswordAgainstPolicy, getPasswordPolicy } from '../../components/ui/PasswordStrength'

function roleHomePath(role) {
  if (role === 'admin' || role === 'pole_director' || role === 'works_director' || role === 'hse_director' || role === 'hr_director') {
    return '/admin'
  }
  if (role === 'user' || role === 'animateur') return '/sor'
  if (role === 'supervisor') return '/supervisor'
  if (role === 'hr') return '/hr'
  return '/dashboard'
}

export default function ForceChangePasswordPage() {
  const navigate = useNavigate()
  const { t } = useLanguage()
  const { user, changePassword } = useAuthStore()

  const policy = useMemo(() => getPasswordPolicy(user?.role), [user?.role])

  const [form, setForm] = useState({
    current_password: '',
    password: '',
    password_confirmation: '',
  })

  const [show, setShow] = useState({ current: false, next: false, confirm: false })
  const [saving, setSaving] = useState(false)

  const onSubmit = async (e) => {
    e.preventDefault()

    if (!form.current_password) {
      toast.error(t('auth.passwordRequired'))
      return
    }

    if (form.password !== form.password_confirmation) {
      toast.error(t('profile.passwordMismatch'))
      return
    }

    if (!checkPasswordAgainstPolicy(form.password, policy).ok) {
      toast.error(t('auth.passwordPolicy.invalid'))
      return
    }

    setSaving(true)
    try {
      await changePassword(form.current_password, form.password, form.password_confirmation)
      toast.success(t('success.passwordChanged'))
      navigate(roleHomePath(user?.role), { replace: true })
    } catch (error) {
      toast.error(error.response?.data?.message || t('errors.failedToSave'))
    } finally {
      setSaving(false)
    }
  }

  return (
    <div className="animate-fade-in">
      <div className="bg-white dark:bg-gray-800 rounded-2xl shadow-xl p-8 border border-gray-100 dark:border-gray-700">
        <div className="text-center mb-8">
          <div className="inline-flex items-center justify-center w-16 h-16 rounded-full bg-gradient-to-br from-sgtm-orange to-hse-primary mb-4 shadow-lg">
            <ShieldCheck className="w-8 h-8 text-white" />
          </div>
          <h2 className="text-2xl font-bold text-gray-900 dark:text-gray-100">{t('auth.forceChangePassword.title')}</h2>
          <p className="text-gray-600 dark:text-gray-300 mt-2">{t('auth.forceChangePassword.subtitle')}</p>
        </div>

        <form onSubmit={onSubmit} className="space-y-4">
          <div>
            <label className="label">{t('auth.currentPassword')}</label>
            <div className="relative">
              <Key className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
              <input
                type={show.current ? 'text' : 'password'}
                value={form.current_password}
                onChange={(e) => setForm((prev) => ({ ...prev, current_password: e.target.value }))}
                className="input pl-10 pr-10"
                required
                autoComplete="current-password"
              />
              <button
                type="button"
                onClick={() => setShow((prev) => ({ ...prev, current: !prev.current }))}
                className="absolute right-3 top-1/2 -translate-y-1/2"
                aria-label={show.current ? t('auth.hidePassword') : t('auth.showPassword')}
              >
                {show.current ? <EyeOff className="w-4 h-4 text-gray-400" /> : <Eye className="w-4 h-4 text-gray-400" />}
              </button>
            </div>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div>
              <label className="label">{t('auth.newPassword')}</label>
              <div className="relative">
                <Key className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
                <input
                  type={show.next ? 'text' : 'password'}
                  value={form.password}
                  onChange={(e) => setForm((prev) => ({ ...prev, password: e.target.value }))}
                  className="input pl-10 pr-10"
                  required
                  minLength={policy.minLength}
                  autoComplete="new-password"
                />
                <button
                  type="button"
                  onClick={() => setShow((prev) => ({ ...prev, next: !prev.next }))}
                  className="absolute right-3 top-1/2 -translate-y-1/2"
                  aria-label={show.next ? t('auth.hidePassword') : t('auth.showPassword')}
                >
                  {show.next ? <EyeOff className="w-4 h-4 text-gray-400" /> : <Eye className="w-4 h-4 text-gray-400" />}
                </button>
              </div>
            </div>

            <div>
              <label className="label">{t('auth.confirmPassword')}</label>
              <div className="relative">
                <Key className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
                <input
                  type={show.confirm ? 'text' : 'password'}
                  value={form.password_confirmation}
                  onChange={(e) => setForm((prev) => ({ ...prev, password_confirmation: e.target.value }))}
                  className="input pl-10 pr-10"
                  required
                  minLength={policy.minLength}
                  autoComplete="new-password"
                />
                <button
                  type="button"
                  onClick={() => setShow((prev) => ({ ...prev, confirm: !prev.confirm }))}
                  className="absolute right-3 top-1/2 -translate-y-1/2"
                  aria-label={show.confirm ? t('auth.hidePassword') : t('auth.showPassword')}
                >
                  {show.confirm ? <EyeOff className="w-4 h-4 text-gray-400" /> : <Eye className="w-4 h-4 text-gray-400" />}
                </button>
              </div>
            </div>
          </div>

          <PasswordStrength password={form.password} role={user?.role} />

          <button type="submit" disabled={saving} className="btn-primary w-full py-3">
            {saving ? (
              <span className="flex items-center justify-center gap-2">
                <Loader2 className="w-5 h-5 animate-spin" />
                {t('common.saving')}
              </span>
            ) : (
              t('auth.forceChangePassword.submit')
            )}
          </button>
        </form>
      </div>
    </div>
  )
}
