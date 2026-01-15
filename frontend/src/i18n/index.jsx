import { createContext, useContext, useState, useCallback, useEffect } from 'react'
import fr from './translations/fr'
import en from './translations/en'

const translations = { fr, en }

// Default language is French
const DEFAULT_LANGUAGE = 'fr'
const STORAGE_KEY = 'hse-kpi-language'

const normalizeLang = (value) => {
  const raw = String(value || '').trim()
  if (!raw) return ''
  return raw.split(/[-_]/)[0]
}

const LanguageContext = createContext()

export const languages = [
  { code: 'fr', name: 'Français', flag: '🇫🇷' },
  { code: 'en', name: 'English', flag: '🇬🇧' },
]

export function LanguageProvider({ children }) {
  const [language, setLanguageState] = useState(() => {
    // Get saved language from localStorage or use default
    const saved = localStorage.getItem(STORAGE_KEY)
    const normalized = normalizeLang(saved)
    return normalized && translations[normalized] ? normalized : DEFAULT_LANGUAGE
  })

  const setLanguage = useCallback((lang) => {
    const normalized = normalizeLang(lang)
    if (translations[normalized]) {
      setLanguageState(normalized)
      localStorage.setItem(STORAGE_KEY, normalized)
      document.documentElement.lang = normalized
    }
  }, [])

  // Set document language on mount
  useEffect(() => {
    document.documentElement.lang = language
  }, [language])

  // Translation function
  const t = useCallback((key, params = {}) => {
    const keys = key.split('.')
    let value = translations[language]

    for (const k of keys) {
      if (value && typeof value === 'object' && k in value) {
        value = value[k]
      } else {
        // Fallback to French if key not found in current language
        value = translations[DEFAULT_LANGUAGE]
        for (const fallbackKey of keys) {
          if (value && typeof value === 'object' && fallbackKey in value) {
            value = value[fallbackKey]
          } else {
            console.warn(`Translation key not found: ${key}`)
            return key
          }
        }
        break
      }
    }

    // If it's an array, return as-is (for datePicker.days, etc.)
    if (Array.isArray(value)) {
      return value
    }

    if (typeof value !== 'string') {
      console.warn(`Translation key is not a string or array: ${key}`)
      return key
    }

    // Replace parameters in the string
    // Usage: t('greeting', { name: 'John' }) with 'greeting': 'Hello, {name}!'
    return value.replace(/\{(\w+)\}/g, (match, paramKey) => {
      return params[paramKey] !== undefined ? params[paramKey] : match
    })
  }, [language])

  // Get current language info
  const currentLanguage = languages.find(l => l.code === language) || languages[0]

  const value = {
    language,
    setLanguage,
    t,
    currentLanguage,
    languages,
  }

  return (
    <LanguageContext.Provider value={value}>
      {children}
    </LanguageContext.Provider>
  )
}

export function useLanguage() {
  const context = useContext(LanguageContext)
  if (context) {
    return context
  }

  // Fallback: allow components to work even if rendered outside LanguageProvider
  const saved = (() => {
    try {
      return localStorage.getItem(STORAGE_KEY)
    } catch {
      return null
    }
  })()
  const normalizedSaved = normalizeLang(saved)
  const language = normalizedSaved && translations[normalizedSaved] ? normalizedSaved : DEFAULT_LANGUAGE

  const t = (key, params = {}) => {
    const keys = key.split('.')
    let value = translations[language]

    for (const k of keys) {
      if (value && typeof value === 'object' && k in value) {
        value = value[k]
      } else {
        console.warn(`Translation key not found: ${key}`)
        return key
      }
    }

    if (Array.isArray(value)) {
      return value
    }

    if (typeof value !== 'string') {
      console.warn(`Translation key is not a string or array: ${key}`)
      return key
    }

    return value.replace(/\{(\w+)\}/g, (match, paramKey) => {
      return params[paramKey] !== undefined ? params[paramKey] : match
    })
  }

  const currentLanguage = languages.find(l => l.code === language) || languages[0]

  return {
    language,
    setLanguage: () => {},
    t,
    currentLanguage,
    languages,
  }
}

// Shorthand hook for just the translation function
export function useTranslation() {
  const { t } = useLanguage()
  return t
}

export default { LanguageProvider, useLanguage, useTranslation, languages }
