import { useState, useEffect } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import { useAuthStore } from '../../store/authStore'
import { useLanguage } from '../../i18n'
import { Mail, Lock, Eye, EyeOff, Loader2, Shield } from 'lucide-react'
import appLogo from '../../App_Logo.png'
import sgtmLogo from '../../SGTM_Logo.jpg'
import toast from 'react-hot-toast'

export default function LoginPage() {
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [showPassword, setShowPassword] = useState(false)
  const [errors, setErrors] = useState({})
  const [isAnimating, setIsAnimating] = useState(false)
  const [mounted, setMounted] = useState(false)
  
  const { login, isLoading } = useAuthStore()
  const { t } = useLanguage()
  const navigate = useNavigate()

  // Mount animation
  useEffect(() => {
    setMounted(true)
  }, [])

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
      setIsAnimating(true)
      const result = await login(email, password)
      
      toast.success(t('auth.loginSuccess'))
      
      // Wait for animation then redirect
      setTimeout(() => {
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
      }, 1200)
    } catch (error) {
      setIsAnimating(false)
      const message = error.response?.data?.message ?? t('auth.invalidCredentials')
      toast.error(message)
      
      if (error.response?.status === 422) {
        setErrors(error.response.data.errors ?? {})
      }
    }
  }

  return (
    <div className={`transition-all duration-500 ${mounted ? 'opacity-100 translate-y-0' : 'opacity-0 translate-y-4'}`}>
      {/* Mobile logo - 2x bigger */}
      <div className="lg:hidden text-center mb-8">
        <div className="inline-flex items-center justify-center gap-6">
          <img 
            src={appLogo} 
            alt="App Logo" 
            width={112}
            height={112}
            loading="eager"
            decoding="async"
            fetchPriority="high"
            className="w-28 h-28 object-contain animate-float"
          />
          <span className="text-3xl text-gray-300 font-light">/</span>
          <img 
            src={sgtmLogo} 
            alt="SGTM Logo" 
            width={112}
            height={112}
            loading="eager"
            decoding="async"
            fetchPriority="high"
            className="w-28 h-28 object-contain animate-float-delayed"
          />
        </div>
      </div>

      <div className={`bg-white dark:bg-gray-800 rounded-2xl shadow-xl p-8 border border-gray-100 dark:border-gray-700 transition-all duration-300 ${isAnimating ? 'scale-95 opacity-50' : 'scale-100 opacity-100'}`}>
        {/* Decorative top bar */}
        <div className="absolute top-0 left-0 right-0 h-1 bg-gradient-to-r from-sgtm-orange via-hse-primary to-sgtm-orange rounded-t-2xl" />
        
        <div className="text-center mb-8">
          <div className="inline-flex items-center justify-center w-16 h-16 rounded-full bg-gradient-to-br from-sgtm-orange to-hse-primary mb-4 shadow-lg animate-pulse-slow">
            <Shield className="w-8 h-8 text-white" />
          </div>
          <h2 className="text-2xl font-bold text-gray-900 dark:text-gray-100">{t('auth.welcomeBack')}</h2>
          <p className="text-gray-600 dark:text-gray-300 mt-2">{t('auth.signInToContinue')}</p>
        </div>

        <form onSubmit={handleSubmit} className="space-y-6">
          {/* Email field */}
          <div className="group">
            <label htmlFor="email" className="label">
              {t('auth.email')}
            </label>
            <div className="relative">
              <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none transition-colors group-focus-within:text-hse-primary">
                <Mail className="h-5 w-5 text-gray-400 dark:text-gray-500 group-focus-within:text-hse-primary transition-colors" />
              </div>
              <input
                id="email"
                type="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                className={`input pl-10 border-gray-300 dark:border-gray-600 transition-all duration-200 focus:ring-2 focus:ring-hse-primary/20 focus:border-hse-primary ${errors.email ? 'input-error border-red-500' : ''}`}
                placeholder="you@example.com"
                autoComplete="email"
                disabled={isAnimating}
              />
            </div>
            {errors.email && (
              <p className="mt-1 text-sm text-red-500 dark:text-red-400 animate-shake">{errors.email}</p>
            )}
          </div>

          {/* Password field */}
          <div className="group">
            <label htmlFor="password" className="label">
              {t('auth.password')}
            </label>
            <div className="relative">
              <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
                <Lock className="h-5 w-5 text-gray-400 dark:text-gray-500 group-focus-within:text-hse-primary transition-colors" />
              </div>
              <input
                id="password"
                type={showPassword ? 'text' : 'password'}
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                className={`input pl-10 pr-10 border-gray-300 dark:border-gray-600 transition-all duration-200 focus:ring-2 focus:ring-hse-primary/20 focus:border-hse-primary ${errors.password ? 'input-error border-red-500' : ''}`}
                placeholder="••••••••"
                autoComplete="current-password"
                disabled={isAnimating}
              />
              <button
                type="button"
                onClick={() => setShowPassword(!showPassword)}
                className="absolute inset-y-0 right-0 pr-3 flex items-center transition-transform hover:scale-110"
                disabled={isAnimating}
                aria-label={showPassword ? t('auth.hidePassword') : t('auth.showPassword')}
              >
                {showPassword ? (
                  <EyeOff className="h-5 w-5 text-gray-400 dark:text-gray-500 hover:text-gray-600 dark:hover:text-gray-400 transition-colors" />
                ) : (
                  <Eye className="h-5 w-5 text-gray-400 dark:text-gray-500 hover:text-gray-600 dark:hover:text-gray-400 transition-colors" />
                )}
              </button>
            </div>
            {errors.password && (
              <p className="mt-1 text-sm text-red-500 dark:text-red-400 animate-shake">{errors.password}</p>
            )}
          </div>

          {/* Forgot password link */}
          <div className="flex items-center justify-between">
            <label className="flex items-center cursor-pointer group">
              <input
                type="checkbox"
                className="w-4 h-4 text-hse-primary border-gray-300 dark:border-gray-600 rounded focus:ring-hse-primary dark:bg-gray-700 transition-transform group-hover:scale-110"
                disabled={isAnimating}
              />
              <span className="ml-2 text-sm text-gray-600 dark:text-gray-400 group-hover:text-gray-900 dark:group-hover:text-gray-200 transition-colors">{t('auth.rememberMe')}</span>
            </label>
            <Link
              to="/forgot-password"
              className="text-sm font-medium text-sgtm-orange-dark hover:text-sgtm-orange dark:text-sgtm-orange-light dark:hover:text-sgtm-orange underline-offset-2 hover:underline"
            >
              {t('auth.forgotPassword')}
            </Link>
          </div>

          {/* Submit button */}
          <button
            type="submit"
            disabled={isLoading || isAnimating}
            className="btn-primary w-full py-3 text-base relative overflow-hidden group transition-all duration-300 hover:shadow-lg hover:shadow-hse-primary/25 active:scale-[0.98]"
          >
            <span className="relative z-10 flex items-center justify-center gap-2">
              {isLoading || isAnimating ? (
                <>
                  <Loader2 className="w-5 h-5 animate-spin" />
                  {t('common.loading')}
                </>
              ) : (
                <>
                  {t('auth.signIn')}
                  <span className="group-hover:translate-x-1 transition-transform">→</span>
                </>
              )}
            </span>
            <div className="absolute inset-0 bg-gradient-to-r from-transparent via-white/20 to-transparent -translate-x-full group-hover:translate-x-full transition-transform duration-700" />
          </button>
        </form>
      </div>

      <p className="mt-6 text-center text-sm text-gray-500 dark:text-gray-400">
        © {new Date().getFullYear()} {t('common.companyName')} {t('common.appName')}.
      </p>
    </div>
  )
}
