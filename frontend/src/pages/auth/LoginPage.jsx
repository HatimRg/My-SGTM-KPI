import { useState } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import { useAuthStore } from '../../store/authStore'
import { useLanguage } from '../../i18n'
import { Mail, Lock, Eye, EyeOff, Loader2 } from 'lucide-react'
import appLogo from '../../App_Logo.png'
import sgtmLogo from '../../SGTM_Logo.jpg'
import toast from 'react-hot-toast'

export default function LoginPage() {
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [showPassword, setShowPassword] = useState(false)
  const [errors, setErrors] = useState({})
  
  const { login, isLoading } = useAuthStore()
  const { t } = useLanguage()
  const navigate = useNavigate()

  const handleSubmit = async (e) => {
    e.preventDefault()
    setErrors({})

    // Basic validation
    const newErrors = {}
    if (!email) newErrors.email = t('auth.emailRequired')
    if (!password) newErrors.password = t('auth.passwordRequired')
    
    if (Object.keys(newErrors).length > 0) {
      setErrors(newErrors)
      return
    }

    try {
      const result = await login(email, password)
      toast.success(t('auth.loginSuccess'))
      
      // Redirect based on role
      const role = result.user.role
      if (role === 'admin') {
        navigate('/admin')
      } else if (role === 'user' || role === 'animateur') {
        navigate('/sor')
      } else if (role === 'supervisor') {
        navigate('/supervisor')
      } else if (role === 'hr') {
        navigate('/hr')
      } else {
        navigate('/dashboard')
      }
    } catch (error) {
      const message = error.response?.data?.message || t('auth.invalidCredentials')
      toast.error(message)
      
      if (error.response?.status === 422) {
        setErrors(error.response.data.errors || {})
      }
    }
  }

  return (
    <div className="animate-fade-in">
      {/* Mobile logo - 2x bigger */}
      <div className="lg:hidden text-center mb-8">
        <div className="inline-flex items-center justify-center gap-6">
          <img 
            src={appLogo} 
            alt="App Logo" 
            className="w-28 h-28 object-contain"
          />
          <span className="text-3xl text-gray-300 font-light">/</span>
          <img 
            src={sgtmLogo} 
            alt="SGTM Logo" 
            className="w-28 h-28 object-contain"
          />
        </div>
      </div>

      <div className="bg-white dark:bg-gray-800 rounded-2xl shadow-xl p-8 border border-gray-100 dark:border-gray-700">
        <div className="text-center mb-8">
          <h2 className="text-2xl font-bold text-gray-900 dark:text-gray-100">{t('auth.welcomeBack')}</h2>
          <p className="text-gray-500 dark:text-gray-400 mt-2">{t('auth.signInToContinue')}</p>
        </div>

        <form onSubmit={handleSubmit} className="space-y-6">
          {/* Email field */}
          <div>
            <label htmlFor="email" className="label">
              {t('auth.email')}
            </label>
            <div className="relative">
              <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
                <Mail className="h-5 w-5 text-gray-400 dark:text-gray-500" />
              </div>
              <input
                id="email"
                type="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                className={`input pl-10 border-gray-300 dark:border-gray-600 ${errors.email ? 'input-error' : ''}`}
                placeholder="you@example.com"
                autoComplete="email"
              />
            </div>
            {errors.email && (
              <p className="mt-1 text-sm text-red-500 dark:text-red-400">{errors.email}</p>
            )}
          </div>

          {/* Password field */}
          <div>
            <label htmlFor="password" className="label">
              {t('auth.password')}
            </label>
            <div className="relative">
              <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
                <Lock className="h-5 w-5 text-gray-400 dark:text-gray-500" />
              </div>
              <input
                id="password"
                type={showPassword ? 'text' : 'password'}
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                className={`input pl-10 pr-10 border-gray-300 dark:border-gray-600 ${errors.password ? 'input-error' : ''}`}
                placeholder="••••••••"
                autoComplete="current-password"
              />
              <button
                type="button"
                onClick={() => setShowPassword(!showPassword)}
                className="absolute inset-y-0 right-0 pr-3 flex items-center"
              >
                {showPassword ? (
                  <EyeOff className="h-5 w-5 text-gray-400 dark:text-gray-500 hover:text-gray-600 dark:hover:text-gray-400" />
                ) : (
                  <Eye className="h-5 w-5 text-gray-400 dark:text-gray-500 hover:text-gray-600 dark:hover:text-gray-400" />
                )}
              </button>
            </div>
            {errors.password && (
              <p className="mt-1 text-sm text-red-500 dark:text-red-400">{errors.password}</p>
            )}
          </div>

          {/* Forgot password link */}
          <div className="flex items-center justify-between">
            <label className="flex items-center">
              <input
                type="checkbox"
                className="w-4 h-4 text-hse-primary border-gray-300 dark:border-gray-600 rounded focus:ring-hse-primary dark:bg-gray-700"
              />
              <span className="ml-2 text-sm text-gray-600 dark:text-gray-400">{t('auth.rememberMe')}</span>
            </label>
            <Link
              to="/forgot-password"
              className="text-sm font-medium text-hse-primary hover:text-sgtm-orange-dark dark:text-sgtm-orange-light dark:hover:text-sgtm-orange"
            >
              {t('auth.forgotPassword')}
            </Link>
          </div>

          {/* Submit button */}
          <button
            type="submit"
            disabled={isLoading}
            className="btn-primary w-full py-3 text-base"
          >
            {isLoading ? (
              <span className="flex items-center justify-center gap-2">
                <Loader2 className="w-5 h-5 animate-spin" />
                {t('common.loading')}
              </span>
            ) : (
              t('auth.signIn')
            )}
          </button>
        </form>

        {/* Demo credentials */}
        <div className="mt-6 p-4 bg-gray-50 dark:bg-gray-700/50 rounded-lg border border-gray-200 dark:border-gray-600">
          <p className="text-xs font-medium text-gray-500 dark:text-gray-400 mb-2">{t('auth.demoCredentials')}:</p>
          <div className="space-y-1 text-xs text-gray-600 dark:text-gray-300">
            <p><strong>{t('auth.admin')}:</strong> admin@hse-kpi.com / password123</p>
            <p><strong>{t('auth.user')}:</strong> mohammed.alami@hse-kpi.com / password123</p>
          </div>
        </div>
      </div>

      <p className="mt-6 text-center text-sm text-gray-500 dark:text-gray-400">
        © {new Date().getFullYear()} {t('common.companyName')} {t('common.appName')}.
      </p>
    </div>
  )
}
