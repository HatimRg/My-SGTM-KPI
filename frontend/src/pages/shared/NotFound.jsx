import { Link } from 'react-router-dom'
import { Home, ArrowLeft, AlertCircle } from 'lucide-react'
import { useLanguage } from '../../i18n'

export default function NotFound() {
  const { t, language } = useLanguage()
  
  const description = language === 'fr'
    ? 'Désolé, la page que vous recherchez n\'existe pas ou a été déplacée.'
    : 'Sorry, the page you\'re looking for doesn\'t exist or has been moved.'

  return (
    <div className="min-h-screen bg-gray-50 flex items-center justify-center p-4">
      <div className="text-center animate-fade-in">
        <div className="w-24 h-24 bg-red-100 rounded-full flex items-center justify-center mx-auto mb-6">
          <AlertCircle className="w-12 h-12 text-red-500" />
        </div>
        
        <h1 className="text-6xl font-bold text-gray-900 mb-4">404</h1>
        <h2 className="text-2xl font-semibold text-gray-700 mb-2">{t('errors.pageNotFound')}</h2>
        <p className="text-gray-500 mb-8 max-w-md mx-auto">
          {description}
        </p>
        
        <div className="flex items-center justify-center gap-4">
          <button
            onClick={() => window.history.back()}
            className="btn-secondary flex items-center gap-2"
          >
            <ArrowLeft className="w-4 h-4" />
            {t('errors.goBack')}
          </button>
          <Link to="/" className="btn-primary flex items-center gap-2">
            <Home className="w-4 h-4" />
            {t('errors.goHome')}
          </Link>
        </div>
      </div>
    </div>
  )
}
