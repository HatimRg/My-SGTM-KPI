import { useLanguage } from '../../i18n'
import { Table, ChevronDown, ChevronUp } from 'lucide-react'
import { useState } from 'react'

// Note: This component can access t() for translations if needed

// KPI field definitions
const KPI_FIELDS = [
  { key: 'effectif', label: 'Effectif', labelEn: 'Workforce', unit: '' },
  { key: 'induction', label: 'Induction', labelEn: 'Induction', unit: '' },
  { key: 'releve_ecarts', label: 'Relevé des écarts', labelEn: 'Deviations', unit: '' },
  { key: 'sensibilisation', label: 'Sensibilisation', labelEn: 'Awareness', unit: '' },
  { key: 'presquaccident', label: 'Presqu\'accident', labelEn: 'Near Miss', unit: '' },
  { key: 'premiers_soins', label: 'Premiers soins', labelEn: 'First Aid', unit: '' },
  { key: 'accidents', label: 'Accident', labelEn: 'Accident', unit: '' },
  { key: 'jours_arret', label: 'Jours d\'arrêt', labelEn: 'Lost Days', unit: '' },
  { key: 'heures_travaillees', label: 'Heures travaillées', labelEn: 'Hours Worked', unit: 'h' },
  { key: 'inspections', label: 'Inspections', labelEn: 'Inspections', unit: '' },
  { key: 'heures_formation', label: 'Heures formation', labelEn: 'Training Hours', unit: 'h' },
  { key: 'permis_travail', label: 'Permis de travail', labelEn: 'Work Permits', unit: '' },
  { key: 'mesures_disciplinaires', label: 'Mesures disc.', labelEn: 'Disciplinary', unit: '' },
  { key: 'conformite_hse', label: 'Conformité HSE', labelEn: 'HSE Compliance', unit: '%' },
  { key: 'conformite_medicale', label: 'Conformité Méd.', labelEn: 'Medical Compl.', unit: '%' },
  { key: 'suivi_bruit', label: 'Bruit', labelEn: 'Noise', unit: 'dB' },
  { key: 'consommation_eau', label: 'Eau', labelEn: 'Water', unit: 'm³' },
  { key: 'consommation_electricite', label: 'Électricité', labelEn: 'Electricity', unit: 'kWh' },
]

const DAY_NAMES = {
  fr: { Saturday: 'Sam', Sunday: 'Dim', Monday: 'Lun', Tuesday: 'Mar', Wednesday: 'Mer', Thursday: 'Jeu', Friday: 'Ven' },
  en: { Saturday: 'Sat', Sunday: 'Sun', Monday: 'Mon', Tuesday: 'Tue', Wednesday: 'Wed', Thursday: 'Thu', Friday: 'Fri' }
}

export default function DailyKpiPreview({ dailySnapshots = [] }) {
  const { t, language } = useLanguage()
  const [isExpanded, setIsExpanded] = useState(false)

  if (!dailySnapshots || dailySnapshots.length === 0) {
    return null
  }

  // Format date for display - use UTC to avoid timezone issues
  const formatDate = (dateStr) => {
    // Parse as local date to avoid timezone shift
    const [year, month, day] = dateStr.split('-').map(Number)
    return `${String(day).padStart(2, '0')}/${String(month).padStart(2, '0')}`
  }

  // Get day name
  const getDayName = (dayName) => {
    return DAY_NAMES[language]?.[dayName] ?? dayName?.slice(0, 3) ?? ''
  }

  // Format value
  const formatValue = (value, unit) => {
    if (value === null || value === undefined || value === '') return '-'
    if (value === 0) return '0'
    return `${value}${unit ? ` ${unit}` : ''}`
  }

  return (
    <div className="bg-white dark:bg-gray-800 rounded-lg border border-gray-200 dark:border-gray-700 overflow-hidden">
      {/* Header */}
      <div 
        className="flex items-center justify-between p-3 bg-gray-50 dark:bg-gray-900 cursor-pointer"
        onClick={() => setIsExpanded(!isExpanded)}
      >
        <div className="flex items-center gap-2">
          <Table className="w-4 h-4 text-hse-primary" />
          <span className="font-medium text-sm text-gray-700 dark:text-gray-300">
            {t('kpi.dailyKpi.dailyData')}
          </span>
          <span className="px-2 py-0.5 text-xs bg-hse-primary/10 text-hse-primary rounded-full">
            {dailySnapshots.length} {t('kpi.dailyKpi.days')}
          </span>
        </div>
        <div className="p-1 rounded bg-gray-200 dark:bg-gray-700">
          {isExpanded ? <ChevronUp className="w-4 h-4" /> : <ChevronDown className="w-4 h-4" />}
        </div>
      </div>

      {/* Table */}
      {isExpanded && (
        <div className="overflow-x-auto">
          <table className="min-w-full text-xs">
            <thead>
              <tr className="bg-gray-100 dark:bg-gray-800">
                <th className="sticky left-0 z-10 bg-gray-100 dark:bg-gray-800 text-left py-2 px-2 font-medium text-gray-600 dark:text-gray-400 border-b border-gray-200 dark:border-gray-700">
                  {t('kpi.dailyKpi.indicator')}
                </th>
                {dailySnapshots.map((snap, i) => (
                  <th key={i} className="text-center py-2 px-2 font-medium text-gray-600 dark:text-gray-400 border-b border-gray-200 dark:border-gray-700 min-w-[60px]">
                    <div>{getDayName(snap.day_name)}</div>
                    <div className="text-[10px] font-normal text-gray-500">{formatDate(snap.entry_date)}</div>
                  </th>
                ))}
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-100 dark:divide-gray-800">
              {KPI_FIELDS.map((field) => (
                <tr key={field.key} className="hover:bg-gray-50 dark:hover:bg-gray-800/50">
                  <td className="sticky left-0 z-10 bg-white dark:bg-gray-800 py-1.5 px-2 font-medium text-gray-600 dark:text-gray-400 border-r border-gray-100 dark:border-gray-700">
                    {language === 'fr' ? field.label : field.labelEn}
                  </td>
                  {dailySnapshots.map((snap, i) => (
                    <td key={i} className="text-center py-1.5 px-2 text-gray-700 dark:text-gray-300">
                      {formatValue(snap[field.key], field.unit)}
                    </td>
                  ))}
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  )
}
