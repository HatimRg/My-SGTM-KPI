import { memo } from 'react'
import { useTranslation } from '../../i18n'
import {
  Shield,
  Activity,
  HardHat,
  GraduationCap,
  ClipboardCheck,
  AlertTriangle,
  Leaf,
  FileText
} from 'lucide-react'

const HSE_THEMES = [
  {
    id: 'overview',
    nameKey: 'dashboard.themes.overview',
    icon: Activity,
    gradient: 'from-purple-500 to-purple-700'
  },
  {
    id: 'safety',
    nameKey: 'dashboard.themes.safety',
    icon: Shield,
    gradient: 'from-red-500 to-red-700'
  },
  {
    id: 'training',
    nameKey: 'dashboard.themes.training',
    icon: GraduationCap,
    gradient: 'from-blue-500 to-blue-700'
  },
  {
    id: 'compliance',
    nameKey: 'dashboard.themes.compliance',
    icon: ClipboardCheck,
    gradient: 'from-green-500 to-green-700'
  },
  {
    id: 'ppe',
    nameKey: 'dashboard.themes.ppe',
    icon: HardHat,
    gradient: 'from-slate-500 to-slate-700'
  },
  {
    id: 'deviations',
    nameKey: 'dashboard.themes.deviations',
    icon: AlertTriangle,
    gradient: 'from-amber-500 to-amber-700'
  },
  {
    id: 'environmental',
    nameKey: 'dashboard.themes.environmental',
    icon: Leaf,
    gradient: 'from-emerald-500 to-emerald-700'
  },
  {
    id: 'monthly_report',
    nameKey: 'dashboard.themes.monthly_report',
    icon: FileText,
    gradient: 'from-sky-600 to-sky-800',
    adminOnly: true,
  }
]

const ThemeSelector = memo(function ThemeSelector({ activeTheme, onThemeChange, user }) {
  const t = useTranslation()
  const isStrictAdmin = String(user?.role || '') === 'admin'
  
  return (
    <div className="relative mb-4">
      <div className="flex items-center justify-center gap-1 flex-wrap">
        {HSE_THEMES.filter((theme) => {
          if (!theme.adminOnly) return true
          return isStrictAdmin
        }).map((theme) => {
          const Icon = theme.icon
          const isActive = activeTheme === theme.id
          
          return (
            <button
              key={theme.id}
              onClick={() => onThemeChange(theme.id)}
              className={`flex items-center gap-1.5 px-3 py-2 rounded-lg border transition-all duration-200 ${
                isActive
                  ? `bg-gradient-to-r ${theme.gradient} text-white border-transparent shadow-md`
                  : 'bg-white dark:bg-gray-800 border-gray-200 dark:border-gray-700 text-gray-600 dark:text-gray-300 hover:border-gray-300 dark:hover:border-gray-600 hover:shadow-sm'
              }`}
            >
              <Icon className={`w-4 h-4 ${isActive ? 'text-white' : ''}`} />
              <span className={`font-medium text-xs ${isActive ? 'text-white' : ''}`}>
                {t(theme.nameKey)}
              </span>
            </button>
          )
        })}
      </div>
    </div>
  )
})

export default ThemeSelector
export { HSE_THEMES }
