import { Component } from 'react'
import { Home, RefreshCw, AlertTriangle, XCircle, WifiOff, ShieldX } from 'lucide-react'

const getErrorContent = (error, language = 'fr') => {
  const errorString = error?.toString() ?? ''
  
  let errorCode = '500'
  let icon = XCircle
  let iconColor = 'text-red-500'
  let bgColor = 'from-red-500 to-red-600'
  let title = language === 'fr' ? 'Erreur Inattendue' : 'Unexpected Error'
  let description = language === 'fr'
    ? 'Une erreur s\'est produite. Veuillez réessayer ou contacter l\'administrateur.'
    : 'An error occurred. Please try again or contact the administrator.'
  
  if (errorString.includes('403') || errorString.includes('Forbidden')) {
    errorCode = '403'
    icon = ShieldX
    iconColor = 'text-orange-500'
    bgColor = 'from-orange-500 to-orange-600'
    title = language === 'fr' ? 'Accès Refusé' : 'Access Denied'
    description = language === 'fr'
      ? 'Vous n\'avez pas les permissions nécessaires pour accéder à cette ressource.'
      : 'You don\'t have permission to access this resource.'
  } else if (errorString.includes('Network') || errorString.includes('fetch')) {
    errorCode = 'NET'
    icon = WifiOff
    iconColor = 'text-blue-500'
    bgColor = 'from-blue-500 to-blue-600'
    title = language === 'fr' ? 'Connexion Perdue' : 'Connection Lost'
    description = language === 'fr'
      ? 'Impossible de contacter le serveur. Vérifiez votre connexion internet.'
      : 'Unable to reach the server. Check your internet connection.'
  }
  
  return { errorCode, icon, iconColor, bgColor, title, description }
}

class ErrorBoundary extends Component {
  constructor(props) {
    super(props)
    this.state = { hasError: false, error: null, errorInfo: null }
  }

  static getDerivedStateFromError(error) {
    return { hasError: true, error }
  }

  componentDidCatch(error, errorInfo) {
    this.setState({ errorInfo })
    const ctx = this.props?.context
    const name = this.props?.name || 'ErrorBoundary'
    try {
      console.groupCollapsed(`[${name}] React render error`)
      if (ctx) console.log('context', ctx)
      console.error(error)
      console.log('componentStack', errorInfo?.componentStack)
      console.groupEnd()
    } catch (e) {
      console.error('Error caught by boundary:', error, errorInfo, ctx, e)
    }
  }

  handleReload = () => {
    window.location.reload()
  }

  handleGoHome = () => {
    window.location.href = '/'
  }

  render() {
    if (this.state.hasError) {
      const language = localStorage.getItem('hse-kpi-language') || 'fr'
      const { errorCode, icon: Icon, iconColor, bgColor, title, description } = getErrorContent(
        this.state.error,
        language
      )

      return (
        <div className="min-h-screen bg-gradient-to-b from-gray-50 to-gray-100 dark:from-gray-900 dark:to-gray-950 flex items-center justify-center p-6">
          <div className="text-center max-w-md mx-auto">
            {/* Icon */}
            <div className="relative inline-flex items-center justify-center mb-8">
              <div className="absolute w-32 h-32 rounded-full bg-red-100 dark:bg-red-900/20 animate-ping opacity-20" />
              <div className={`relative w-24 h-24 rounded-2xl bg-gradient-to-br ${bgColor} shadow-2xl flex items-center justify-center`}>
                <Icon className="w-12 h-12 text-white" strokeWidth={1.5} />
              </div>
            </div>
            
            {/* Error Code Badge */}
            <div className="inline-flex items-center gap-2 px-3 py-1 bg-red-100 dark:bg-red-900/40 rounded-full mb-4">
              <AlertTriangle className="w-3.5 h-3.5 text-red-600 dark:text-red-400" />
              <span className="text-xs font-semibold text-red-700 dark:text-red-300 uppercase tracking-wide">
                {language === 'fr' ? 'Erreur' : 'Error'} {errorCode}
              </span>
            </div>
            
            {/* Title */}
            <h1 className="text-3xl md:text-4xl font-bold text-gray-900 dark:text-white mb-4">
              {title}
            </h1>
            
            {/* Description */}
            <p className="text-gray-600 dark:text-gray-400 mb-8 leading-relaxed">
              {description}
            </p>
            
            {/* Buttons */}
            <div className="flex flex-col sm:flex-row items-center justify-center gap-3">
              <button
                onClick={this.handleReload}
                className="group w-full sm:w-auto px-6 py-3 bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-xl font-medium text-gray-700 dark:text-gray-200 hover:border-gray-300 dark:hover:border-gray-600 hover:shadow-lg transition-all flex items-center justify-center gap-2"
              >
                <RefreshCw className="w-4 h-4 group-hover:rotate-180 transition-transform duration-500" />
                {language === 'fr' ? 'Réessayer' : 'Try Again'}
              </button>
              <button
                onClick={this.handleGoHome}
                className={`w-full sm:w-auto px-6 py-3 bg-gradient-to-r ${bgColor} rounded-xl font-medium text-white shadow-lg hover:shadow-xl transition-all flex items-center justify-center gap-2`}
              >
                <Home className="w-4 h-4" />
                {language === 'fr' ? 'Accueil' : 'Home'}
              </button>
            </div>
            
            {/* Technical Details */}
            {this.state.error && (
              <details className="mt-10 text-left">
                <summary className="cursor-pointer text-sm text-gray-500 dark:text-gray-400 hover:text-gray-700 dark:hover:text-gray-300 text-center">
                  {language === 'fr' ? 'Détails techniques' : 'Technical details'}
                </summary>
                <pre className="mt-3 p-4 bg-gray-900 text-red-400 text-xs rounded-lg overflow-x-auto max-h-32 overflow-y-auto">
                  {this.state.error.toString()}
                  {this.state.errorInfo?.componentStack}
                </pre>
              </details>
            )}
          </div>
        </div>
      )
    }

    return this.props.children
  }
}

export default ErrorBoundary
