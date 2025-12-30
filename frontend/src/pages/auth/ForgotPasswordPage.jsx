import { useState } from 'react'
import { Link } from 'react-router-dom'
import { authService } from '../../services/api'
import { useLanguage } from '../../i18n'
import { Shield, Mail, ArrowLeft, Loader2, CheckCircle } from 'lucide-react'
import toast from 'react-hot-toast'

export default function ForgotPasswordPage() {
  const { t } = useLanguage()
  const [email, setEmail] = useState('')
  const [isLoading, setIsLoading] = useState(false)
  const [isSuccess, setIsSuccess] = useState(false)

  const handleSubmit = async (e) => {
    e.preventDefault()
    
    if (!email) {
      toast.error(t('auth.forgotPasswordPage.emailRequired'))
      return
    }

    setIsLoading(true)
    try {
      await authService.forgotPassword(email)
      setIsSuccess(true)
      toast.success(t('auth.forgotPasswordPage.resetLinkSent'))
    } catch (error) {
      toast.error(error.response?.data?.message || t('errors.failedToSendResetLink'))
    } finally {
      setIsLoading(false)
    }
  }

  if (isSuccess) {
    return (
      <div className="animate-fade-in">
        <div className="bg-white rounded-2xl shadow-xl p-8 border border-gray-100 text-center">
          <div className="w-16 h-16 bg-green-100 rounded-full flex items-center justify-center mx-auto mb-6">
            <CheckCircle className="w-8 h-8 text-green-600" />
          </div>
          <h2 className="text-2xl font-bold text-gray-900 mb-2">{t('auth.forgotPasswordPage.checkEmailTitle')}</h2>
          <p className="text-gray-500 mb-6">
            {t('auth.forgotPasswordPage.checkEmailDescription')}<br />
            <strong className="text-gray-700">{email}</strong>
          </p>
          <Link to="/login" className="btn-primary inline-flex items-center gap-2">
            <ArrowLeft className="w-4 h-4" />
            {t('auth.forgotPasswordPage.backToLogin')}
          </Link>
        </div>
      </div>
    )
  }

  return (
    <div className="animate-fade-in">
      {/* Mobile logo */}
      <div className="lg:hidden text-center mb-8">
        <div className="inline-flex items-center gap-3">
          <div className="w-12 h-12 bg-hse-primary rounded-xl flex items-center justify-center">
            <Shield className="w-7 h-7 text-white" />
          </div>
          <div className="text-left">
            <h1 className="text-xl font-bold text-hse-primary">{t('common.appName')}</h1>
            <p className="text-sm text-gray-500">{t('common.companyName')} {t('auth.forgotPasswordPage.safetyManagement')}</p>
          </div>
        </div>
      </div>

      <div className="bg-white rounded-2xl shadow-xl p-8 border border-gray-100">
        <div className="text-center mb-8">
          <h2 className="text-2xl font-bold text-gray-900">{t('auth.forgotPasswordPage.title')}</h2>
          <p className="text-gray-500 mt-2">
            {t('auth.forgotPasswordPage.subtitle')}
          </p>
        </div>

        <form onSubmit={handleSubmit} className="space-y-6">
          <div>
            <label htmlFor="email" className="label">
              {t('auth.email')}
            </label>
            <div className="relative">
              <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
                <Mail className="h-5 w-5 text-gray-400" />
              </div>
              <input
                id="email"
                type="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                className="input pl-10"
                placeholder={t('auth.emailPlaceholder')}
                autoComplete="email"
              />
            </div>
          </div>

          <button
            type="submit"
            disabled={isLoading}
            className="btn-primary w-full py-3 text-base"
          >
            {isLoading ? (
              <span className="flex items-center justify-center gap-2">
                <Loader2 className="w-5 h-5 animate-spin" />
                {t('auth.forgotPasswordPage.sending')}
              </span>
            ) : (
              t('auth.forgotPasswordPage.submit')
            )}
          </button>

          <Link
            to="/login"
            className="flex items-center justify-center gap-2 text-sm text-gray-600 hover:text-gray-900"
          >
            <ArrowLeft className="w-4 h-4" />
            {t('auth.forgotPasswordPage.backToLogin')}
          </Link>
        </form>
      </div>
    </div>
  )
}
