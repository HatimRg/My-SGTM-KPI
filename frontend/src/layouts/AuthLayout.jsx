import { useState, useEffect } from 'react'
import { Outlet } from 'react-router-dom'
import { useLanguage } from '../i18n'
import useThemeStore from '../stores/themeStore'
import { Sun, Moon } from 'lucide-react'
import appLogo from '../App_Logo.png'
import sgtmLogo from '../SGTM_Logo.jpg'
import loginBackground from '../login-background.jpg'
import LanguageSwitcher from '../components/LanguageSwitcher'
import api from '../services/api'

export default function AuthLayout() {
  const { t, language } = useLanguage()
  const { isDark, toggleTheme } = useThemeStore()
  const [stats, setStats] = useState({
    hse_compliance: 0,
    training_hours: 0,
    fatal_accidents: 0,
    year: new Date().getFullYear()
  })

  useEffect(() => {
    const isLarge = typeof window !== 'undefined' && window.matchMedia && window.matchMedia('(min-width: 1024px)').matches
    if (!isLarge) return

    const link = document.createElement('link')
    link.rel = 'preload'
    link.as = 'image'
    link.href = loginBackground
    link.setAttribute('fetchpriority', 'high')
    document.head.appendChild(link)

    const appLogoLink = document.createElement('link')
    appLogoLink.rel = 'preload'
    appLogoLink.as = 'image'
    appLogoLink.href = appLogo
    appLogoLink.setAttribute('fetchpriority', 'high')
    document.head.appendChild(appLogoLink)

    const sgtmLogoLink = document.createElement('link')
    sgtmLogoLink.rel = 'preload'
    sgtmLogoLink.as = 'image'
    sgtmLogoLink.href = sgtmLogo
    sgtmLogoLink.setAttribute('fetchpriority', 'high')
    document.head.appendChild(sgtmLogoLink)

    return () => {
      if (link.parentNode) {
        link.parentNode.removeChild(link)
      }

      if (appLogoLink.parentNode) {
        appLogoLink.parentNode.removeChild(appLogoLink)
      }

      if (sgtmLogoLink.parentNode) {
        sgtmLogoLink.parentNode.removeChild(sgtmLogoLink)
      }
    }
  }, [])

  useEffect(() => {
    const fetchStats = async () => {
      try {
        const response = await api.get('/public-stats')
        if (response.data?.data) {
          setStats(response.data.data)
        }
      } catch (error) {
        console.log('Could not fetch public stats')
      }
    }
    fetchStats()
  }, [])
  
  // Bilingual tagline
  const tagline = language === 'fr' 
    ? { line1: 'Surveiller. Suivre.', line2: 'Améliorer la Sécurité.' }
    : { line1: 'Monitor. Track.', line2: 'Improve Safety.' }
  
  const description = language === 'fr'
    ? 'Système complet de suivi des KPI HSE pour gérer les indicateurs de santé, sécurité et environnement sur tous vos projets.'
    : 'Comprehensive HSE KPI tracking system for managing health, safety, and environmental metrics across all your projects.'

  return (
    <div className="min-h-screen flex">
      {/* Left side - Branding */}
      <div
        className="hidden lg:flex lg:w-1/2 bg-sgtm-gray relative overflow-hidden"
        style={{
          backgroundImage: `url(${loginBackground})`,
          backgroundSize: 'cover',
          backgroundPosition: 'center',
        }}
      >
        <div className="absolute inset-0 bg-gradient-to-br from-sgtm-gray-dark/70 to-sgtm-gray/90" />
        <div className="relative z-10 flex flex-col justify-between p-12 text-white">
          <div>
            <div className="flex items-center gap-6">
              <img 
                src={appLogo} 
                alt="App Logo" 
                className="w-24 h-24 object-contain"
              />
              <span className="text-4xl text-white/40 font-light">/</span>
              <img 
                src={sgtmLogo} 
                alt="SGTM Logo" 
                className="w-24 h-24 object-contain"
              />
            </div>
          </div>
          
          <div className="space-y-8">
            <div>
              <h2 className="text-4xl font-bold leading-tight">
                {tagline.line1}<br />
                {tagline.line2}
              </h2>
              <p className="mt-4 text-lg text-white/80 max-w-md">
                {description}
              </p>
            </div>
            
            <div className="grid grid-cols-3 gap-6">
              <div className="bg-white/10 backdrop-blur-sm rounded-xl p-4">
                <div className="text-3xl font-bold">{stats.hse_compliance != null ? `${stats.hse_compliance}%` : ''}</div>
                <div className="text-sm text-white/70">{language === 'fr' ? 'Conformité HSE' : 'HSE Compliance'}</div>
              </div>
              <div className="bg-white/10 backdrop-blur-sm rounded-xl p-4">
                <div className="text-3xl font-bold">{stats.training_hours != null ? stats.training_hours.toLocaleString() : ''}</div>
                <div className="text-sm text-white/70">{language === 'fr' ? 'Heures Formation' : 'Training Hours'}</div>
              </div>
              <div className="bg-white/10 backdrop-blur-sm rounded-xl p-4">
                <div className="text-3xl font-bold">{stats.fatal_accidents}</div>
                <div className="text-sm text-white/70">{language === 'fr' ? `Accidents Mortels ${stats.year}` : `Fatal Accidents ${stats.year}`}</div>
              </div>
            </div>
          </div>
          
          <div className="text-sm text-white/60">
            © {new Date().getFullYear()} {t('common.companyName')}.
          </div>
        </div>
        
        {/* Decorative elements */}
        <div className="absolute -bottom-20 -right-20 w-96 h-96 bg-white/5 rounded-full" />
        <div className="absolute top-20 -right-10 w-64 h-64 bg-white/5 rounded-full" />
      </div>

      {/* Right side - Auth form */}
      <div className="flex-1 flex items-center justify-center p-8 bg-gray-50 dark:bg-gray-900 relative">
        {/* Top controls - Language & Theme */}
        <div className="absolute top-4 right-4 flex items-center gap-2">
          <LanguageSwitcher />
          <button
            onClick={toggleTheme}
            className="p-2 rounded-lg bg-white dark:bg-gray-800 shadow-md hover:shadow-lg transition-all border border-gray-200 dark:border-gray-700"
            title={isDark ? 'Light Mode' : 'Dark Mode'}
          >
            {isDark ? (
              <Sun className="w-5 h-5 text-yellow-500" />
            ) : (
              <Moon className="w-5 h-5 text-gray-600" />
            )}
          </button>
        </div>
        
        <main id="main-content" className="w-full max-w-md pt-12" aria-label={t('auth.login')}>
          <Outlet />
        </main>
      </div>
    </div>
  )
}
