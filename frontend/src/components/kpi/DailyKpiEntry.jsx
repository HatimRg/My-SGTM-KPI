import { useState, useEffect, useCallback } from 'react'
import { useLanguage } from '../../i18n'
import { dailyKpiService } from '../../services/api'
import {
  Download,
  Upload,
  Edit3,
  Check,
  Loader2,
  FileSpreadsheet,
  Table,
  ChevronDown,
  ChevronUp,
  RefreshCw
} from 'lucide-react'
import toast from 'react-hot-toast'

// KPI field definitions
const KPI_FIELDS = [
  { key: 'effectif', label: 'Effectif', labelEn: 'Workforce', formula: 'MAX', unit: '', editable: true },
  { key: 'induction', label: 'Induction', labelEn: 'Induction', formula: 'SUM', unit: '', editable: true },

  { key: 'releve_ecarts', label: 'Relevé des écarts', labelEn: 'Deviations', formula: 'SUM', unit: '', editable: false },
  { key: 'sensibilisation', label: 'Sensibilisation', labelEn: 'Awareness', formula: 'SUM', unit: '', editable: false },
  { key: 'presquaccident', label: "Presqu'accident", labelEn: 'Near Miss', formula: 'SUM', unit: '', editable: false },
  { key: 'premiers_soins', label: 'Premiers soins', labelEn: 'First Aid', formula: 'SUM', unit: '', editable: false },
  { key: 'accidents', label: 'Accident', labelEn: 'Accident', formula: 'SUM', unit: '', editable: false },
  { key: 'jours_arret', label: "Jours d'arrêt", labelEn: 'Lost Days', formula: 'SUM', unit: '', editable: false },
  { key: 'heures_travaillees', label: 'Heures travaillées', labelEn: 'Hours Worked', formula: 'SUM', unit: 'h', editable: false },
  { key: 'inspections', label: 'Inspections', labelEn: 'Inspections', formula: 'SUM', unit: '', editable: false },
  { key: 'heures_formation', label: 'Heures formation', labelEn: 'Training Hours', formula: 'SUM', unit: 'h', editable: false },
  { key: 'permis_travail', label: 'Permis de travail', labelEn: 'Work Permits', formula: 'SUM', unit: '', editable: false },
  { key: 'mesures_disciplinaires', label: 'Mesures disc.', labelEn: 'Disciplinary', formula: 'SUM', unit: '', editable: false },
  { key: 'conformite_hse', label: 'Conformité HSE', labelEn: 'HSE Compliance', formula: 'AVG', unit: '%', editable: false },
  { key: 'conformite_medicale', label: 'Conformité Méd.', labelEn: 'Medical Compl.', formula: 'AVG', unit: '%', editable: false },
]

const DAY_NAMES = {
  fr: { Saturday: 'Sam', Sunday: 'Dim', Monday: 'Lun', Tuesday: 'Mar', Wednesday: 'Mer', Thursday: 'Jeu', Friday: 'Ven' },
  en: { Saturday: 'Sat', Sunday: 'Sun', Monday: 'Mon', Tuesday: 'Tue', Wednesday: 'Wed', Thursday: 'Thu', Friday: 'Fri' }
}

export default function DailyKpiEntry({ projectId, weekNumber, year, onDataConfirmed }) {
  const { t, language } = useLanguage()
  const [activeTab, setActiveTab] = useState('download')
  const [weekDates, setWeekDates] = useState([])
  const [dailyData, setDailyData] = useState([])
  const [aggregates, setAggregates] = useState({})
  const [loading, setLoading] = useState(false)
  const [uploading, setUploading] = useState(false)
  const [isExpanded, setIsExpanded] = useState(true)
  const [hasExistingData, setHasExistingData] = useState(false)

  // Initialize empty data for a day
  const createEmptyDay = useCallback((date, dayName) => ({
    entry_date: date,
    day_name: dayName,
    ...KPI_FIELDS.reduce((acc, field) => ({ ...acc, [field.key]: '' }), {})
  }), [])

  // Calculate aggregates from daily data
  const calculateAggregates = useCallback((data) => {
    const newAggregates = {}
    
    KPI_FIELDS.forEach(field => {
      const values = data
        .map(d => d[field.key])
        .filter(v => v !== '' && v !== null && v !== undefined)
        .map(v => parseFloat(v))
        .filter(v => !isNaN(v))
      
      if (values.length === 0) {
        newAggregates[field.key] = 0
        return
      }
      
      switch (field.formula) {
        case 'MAX':
          newAggregates[field.key] = Math.max(...values)
          break
        case 'AVG':
          newAggregates[field.key] = Math.round((values.reduce((a, b) => a + b, 0) / values.length) * 100) / 100
          break
        case 'SUM':
        default:
          newAggregates[field.key] = Math.round(values.reduce((a, b) => a + b, 0) * 100) / 100
      }
    })
    
    return newAggregates
  }, [])

  const [autoFillData, setAutoFillData] = useState(null)

  // Fetch week dates and auto-fill values
  useEffect(() => {
    const fetchData = async () => {
      if (!projectId || !weekNumber || !year) return

      try {
        // Get week dates
        const datesResponse = await dailyKpiService.getWeekDates({ week_number: weekNumber, year })
        const { days } = datesResponse.data.data
        setWeekDates(days)

        // Get auto-fill values from system data
        const autoFillResponse = await dailyKpiService.getAutoFillValues({
          project_id: projectId,
          week_number: weekNumber,
          year
        })
        setAutoFillData(autoFillResponse.data.data)

        // Get existing data
        const aggResponse = await dailyKpiService.getWeekAggregates({
          project_id: projectId,
          week_number: weekNumber,
          year
        })
        const { aggregates: agg, daily_entries, has_data } = aggResponse.data.data
        
        if (has_data && daily_entries?.length > 0) {
          setHasExistingData(true)
          setAggregates(agg)
          
          // Merge existing entries with week dates
          const mergedData = days.map(day => {
            const existing = daily_entries.find(e => e.entry_date === day.date)
            if (existing) {
              return {
                entry_date: day.date,
                day_name: day.day_name,
                ...KPI_FIELDS.reduce((acc, field) => ({
                  ...acc,
                  [field.key]: existing[field.key] ?? ''
                }), {})
              }
            }
            return createEmptyDay(day.date, day.day_name)
          })
          setDailyData(mergedData)
        } else {
          // Initialize with auto-fill values
          const autoFilledDays = days.map(day => {
            const autoValues = autoFillResponse.data.data?.daily_values?.find(
              v => v.entry_date === day.date
            )?.auto_values || {}
            
            return {
              entry_date: day.date,
              day_name: day.day_name,
              ...KPI_FIELDS.reduce((acc, field) => ({
                ...acc,
                [field.key]: autoValues[field.key] ?? ''
              }), {})
            }
          })
          setDailyData(autoFilledDays)
          setAggregates(calculateAggregates(autoFilledDays))
        }
      } catch (error) {
        console.error('Failed to fetch data:', error)
      }
    }

    fetchData()
  }, [projectId, weekNumber, year, createEmptyDay, calculateAggregates])

  // Apply auto-fill values from system data
  const handleApplyAutoFill = () => {
    if (!autoFillData?.daily_values) return

    const getNextValue = (day, autoValues, key) => {
      if (Object.prototype.hasOwnProperty.call(autoValues, key) && autoValues[key] !== null && autoValues[key] !== undefined) {
        return autoValues[key]
      }
      if (day[key] !== null && day[key] !== undefined) {
        return day[key]
      }
      return ''
    }

    const updatedData = dailyData.map(day => {
      const autoValues = autoFillData.daily_values.find(
        v => v.entry_date === day.entry_date
      )?.auto_values || {}

      return {
        ...day,
        releve_ecarts: getNextValue(day, autoValues, 'releve_ecarts'),
        sensibilisation: getNextValue(day, autoValues, 'sensibilisation'),
        heures_formation: getNextValue(day, autoValues, 'heures_formation'),
        permis_travail: getNextValue(day, autoValues, 'permis_travail'),
        inspections: getNextValue(day, autoValues, 'inspections'),
        mesures_disciplinaires: getNextValue(day, autoValues, 'mesures_disciplinaires'),
        conformite_hse: getNextValue(day, autoValues, 'conformite_hse'),
      }
    })

    setDailyData(updatedData)
    setAggregates(calculateAggregates(updatedData))
    toast.success(t('kpi.dailyKpi.systemDataApplied'))
  }

  // Download Excel template
  const handleDownloadTemplate = async () => {
    setLoading(true)
    try {
      const response = await dailyKpiService.downloadTemplate({
        project_id: projectId,
        week_number: weekNumber,
        year
      })
      
      const blob = new Blob([response.data], {
        type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet'
      })
      const url = window.URL.createObjectURL(blob)
      const a = document.createElement('a')
      a.href = url
      a.download = `KPI_Journalier_S${weekNumber}_${year}.xlsx`
      a.click()
      window.URL.revokeObjectURL(url)
      
      toast.success(t('kpi.dailyKpi.templateDownloaded'))
      
      // Auto-switch to import tab after download
      setActiveTab('upload')
    } catch (error) {
      console.error('Download failed:', error)
      toast.error(t('kpi.dailyKpi.downloadFailed'))
    } finally {
      setLoading(false)
    }
  }

  // Handle file upload - directly populate the table
  const handleFileUpload = async (e) => {
    const file = e.target.files?.[0]
    if (!file) return

    setUploading(true)
    try {
      const formData = new FormData()
      formData.append('file', file)
      formData.append('project_id', projectId)
      formData.append('week_number', weekNumber)
      formData.append('year', year)

      const response = await dailyKpiService.parseTemplate(formData)
      const { daily_entries, aggregates: agg } = response.data.data
      
      // Directly populate the table (no double preview)
      const mergedData = weekDates.map(day => {
        const imported = daily_entries.find(e => e.entry_date === day.date)
        if (imported) {
          return {
            entry_date: day.date,
            day_name: day.day_name,
            ...KPI_FIELDS.reduce((acc, field) => ({
              ...acc,
              [field.key]: imported[field.key] ?? ''
            }), {})
          }
        }
        return createEmptyDay(day.date, day.day_name)
      })
      
      setDailyData(mergedData)
      setAggregates(agg)
      setActiveTab('manual') // Switch to manual tab to show the table
      
      toast.success(t('kpi.dailyKpi.dataImported'))
    } catch (error) {
      console.error('Upload failed:', error)
      toast.error(t('kpi.dailyKpi.parseFailed'))
    } finally {
      setUploading(false)
      e.target.value = ''
    }
  }

  // Update cell value
  const handleCellChange = (dayIndex, fieldKey, value) => {
    const newData = [...dailyData]
    if (!newData[dayIndex] && weekDates?.[dayIndex]) {
      newData[dayIndex] = createEmptyDay(weekDates[dayIndex].date, weekDates[dayIndex].day_name)
    }
    const raw = Number(value)
    const numValue = value === '' ? '' : (Number.isFinite(raw) ? raw : 0)
    
    newData[dayIndex] = {
      ...newData[dayIndex],
      [fieldKey]: numValue
    }
    
    setDailyData(newData)
    setAggregates(calculateAggregates(newData))
  }

  // Save and confirm data
  const handleConfirmData = async () => {
    setLoading(true)
    try {
      const editableFields = KPI_FIELDS.filter((f) => f.editable)
      const entriesToSave = dailyData
        .map((day) => {
          const entry = { entry_date: day.entry_date }
          for (const field of editableFields) {
            entry[field.key] = day[field.key]
          }
          return entry
        })
        .filter((day) => editableFields.some((field) => day[field.key] !== '' && day[field.key] !== null && day[field.key] !== undefined))

      if (entriesToSave.length === 0) {
        toast.error(t('kpi.dailyKpi.noDataToSave'))
        setLoading(false)
        return
      }

      const response = await dailyKpiService.bulkSave({
        project_id: projectId,
        week_number: weekNumber,
        year,
        entries: entriesToSave
      })

      const { aggregates: finalAggregates } = response.data.data
      setAggregates(finalAggregates)
      setHasExistingData(true)

      // Refresh auto-filled read-only daily values from the system.
      try {
        const autoRes = await dailyKpiService.getAutoFillValues({
          project_id: projectId,
          week_number: weekNumber,
          year,
        })
        const dailyValues = autoRes.data?.data?.daily_values || []

        if (Array.isArray(weekDates) && weekDates.length > 0) {
          setDailyData((prev) => {
            return weekDates.map((day, dayIndex) => {
              const existing = prev?.[dayIndex] || createEmptyDay(day.date, day.day_name)
              const autoForDay = dailyValues.find((v) => v.entry_date === day.date)?.auto_values || {}

              const merged = { ...existing }
              for (const field of KPI_FIELDS) {
                if (field.editable) continue
                if (autoForDay[field.key] !== undefined && autoForDay[field.key] !== null) {
                  merged[field.key] = autoForDay[field.key]
                }
              }
              return merged
            })
          })
        }
      } catch {
        // ignore
      }
      
      if (onDataConfirmed) {
        onDataConfirmed(finalAggregates)
      }
      
      toast.success(t('kpi.dailyKpi.dataSaved'))
    } catch (error) {
      console.error('Save failed:', error)
      toast.error(t('kpi.dailyKpi.saveFailed'))
    } finally {
      setLoading(false)
    }
  }

  // Format value for display
  const formatValue = (value, unit) => {
    if (value === null || value === undefined || value === '') return '-'
    if (value === 0) return '0'
    return `${value}${unit ? ` ${unit}` : ''}`
  }

  return (
    <div className="bg-white dark:bg-gray-800 rounded-xl shadow-sm border border-gray-200 dark:border-gray-700 mb-6 overflow-hidden">
      {/* Header */}
      <div 
        className="flex items-center justify-between p-4 bg-gradient-to-r from-hse-primary/5 to-transparent cursor-pointer hover:bg-gray-50 dark:hover:bg-gray-700/50 transition-colors"
        onClick={() => setIsExpanded(!isExpanded)}
      >
        <div className="flex items-center gap-3">
          <div className="p-2 bg-hse-primary/10 rounded-lg">
            <Table className="w-5 h-5 text-hse-primary" />
          </div>
          <div>
            <h3 className="font-semibold text-gray-900 dark:text-gray-100">
              {t('kpi.dailyKpi.title')}
            </h3>
            <p className="text-sm text-gray-500 dark:text-gray-400">
              {t('kpi.dailyKpi.subtitle')}
            </p>
          </div>
        </div>
        <div className="flex items-center gap-3">
          {hasExistingData && (
            <span className="px-2.5 py-1 text-xs font-medium bg-green-100 text-green-700 dark:bg-green-900/50 dark:text-green-300 rounded-full">
              ✓ {t('kpi.dailyKpi.hasData')}
            </span>
          )}
          <div className="p-1.5 rounded-full bg-gray-100 dark:bg-gray-700">
            {isExpanded ? <ChevronUp className="w-4 h-4" /> : <ChevronDown className="w-4 h-4" />}
          </div>
        </div>
      </div>

      {isExpanded && (
        <div className="p-4 space-y-4 border-t border-gray-100 dark:border-gray-700">
          {/* Tab buttons */}
          <div className="flex flex-wrap gap-2">
            <button
              onClick={() => setActiveTab('download')}
              className={`flex items-center gap-2 px-4 py-2.5 rounded-lg text-sm font-medium transition-all ${
                activeTab === 'download'
                  ? 'bg-hse-primary text-white shadow-md'
                  : 'bg-gray-100 dark:bg-gray-700 text-gray-600 dark:text-gray-300 hover:bg-gray-200 dark:hover:bg-gray-600'
              }`}
            >
              <Download className="w-4 h-4" />
              <span className="hidden sm:inline">{t('kpi.dailyKpi.download')}</span>
            </button>
            <button
              onClick={() => setActiveTab('upload')}
              className={`flex items-center gap-2 px-4 py-2.5 rounded-lg text-sm font-medium transition-all ${
                activeTab === 'upload'
                  ? 'bg-hse-primary text-white shadow-md'
                  : 'bg-gray-100 dark:bg-gray-700 text-gray-600 dark:text-gray-300 hover:bg-gray-200 dark:hover:bg-gray-600'
              }`}
            >
              <Upload className="w-4 h-4" />
              <span className="hidden sm:inline">{t('kpi.dailyKpi.import')}</span>
            </button>
            <button
              onClick={() => setActiveTab('manual')}
              className={`flex items-center gap-2 px-4 py-2.5 rounded-lg text-sm font-medium transition-all ${
                activeTab === 'manual'
                  ? 'bg-hse-primary text-white shadow-md'
                  : 'bg-gray-100 dark:bg-gray-700 text-gray-600 dark:text-gray-300 hover:bg-gray-200 dark:hover:bg-gray-600'
              }`}
            >
              <Edit3 className="w-4 h-4" />
              <span className="hidden sm:inline">{t('kpi.dailyKpi.entry')}</span>
            </button>
          </div>

          {/* Download Tab */}
          {activeTab === 'download' && (
            <div className="text-center py-8 space-y-4">
              <div className="inline-flex p-4 bg-green-50 dark:bg-green-900/20 rounded-full">
                <FileSpreadsheet className="w-12 h-12 text-green-500" />
              </div>
              <div>
                <h4 className="font-medium text-gray-900 dark:text-gray-100">
                  {t('kpi.dailyKpi.downloadTemplate')}
                </h4>
                <p className="text-sm text-gray-500 dark:text-gray-400 mt-1 max-w-sm mx-auto">
                  {t('kpi.dailyKpi.downloadDesc')}
                </p>
              </div>
              <button
                onClick={handleDownloadTemplate}
                disabled={loading || !projectId || !weekNumber}
                className="btn-primary inline-flex items-center gap-2 px-6"
              >
                {loading ? <Loader2 className="w-4 h-4 animate-spin" /> : <Download className="w-4 h-4" />}
                {t('kpi.dailyKpi.download')}
              </button>
            </div>
          )}

          {/* Upload Tab */}
          {activeTab === 'upload' && (
            <div className="text-center py-8 space-y-4">
              <div className="inline-flex p-4 bg-blue-50 dark:bg-blue-900/20 rounded-full">
                <Upload className="w-12 h-12 text-blue-500" />
              </div>
              <div>
                <h4 className="font-medium text-gray-900 dark:text-gray-100">
                  {t('kpi.dailyKpi.importFile')}
                </h4>
                <p className="text-sm text-gray-500 dark:text-gray-400 mt-1 max-w-sm mx-auto">
                  {t('kpi.dailyKpi.importDesc')}
                </p>
              </div>
              <label className="btn-primary inline-flex items-center gap-2 px-6 cursor-pointer">
                {uploading ? <Loader2 className="w-4 h-4 animate-spin" /> : <Upload className="w-4 h-4" />}
                {t('kpi.dailyKpi.selectFile')}
                <input
                  type="file"
                  accept=".xlsx,.xls"
                  onChange={handleFileUpload}
                  className="hidden"
                  disabled={uploading}
                />
              </label>
            </div>
          )}

          {/* Manual Entry Tab */}
          {activeTab === 'manual' && weekDates.length > 0 && (
            <div className="space-y-4">
              {/* Responsive Table */}
              <div className="overflow-x-auto -mx-4 px-4">
                <div className="inline-block min-w-full align-middle">
                  <table className="min-w-full text-sm">
                    <thead>
                      <tr className="bg-gray-50 dark:bg-gray-900">
                        <th className="sticky left-0 z-10 bg-gray-50 dark:bg-gray-900 text-left py-3 px-3 font-semibold text-gray-700 dark:text-gray-300 border-b border-gray-200 dark:border-gray-700 min-w-[160px]">
                          {t('kpi.dailyKpi.indicator')}
                        </th>
                        {weekDates.map((day, i) => (
                          <th key={i} className="text-center py-3 px-2 font-medium text-gray-600 dark:text-gray-400 border-b border-gray-200 dark:border-gray-700 min-w-[70px]">
                            <div className="font-semibold text-gray-800 dark:text-gray-200">
                              {DAY_NAMES[language]?.[day.day_name] || day.day_name?.slice(0, 3)}
                            </div>
                            <div className="text-[10px] text-gray-500 font-normal">{day.display}</div>
                          </th>
                        ))}
                        <th className="text-center py-3 px-3 font-semibold text-hse-primary bg-hse-primary/5 border-b border-gray-200 dark:border-gray-700 min-w-[80px]">
                          {t('kpi.dailyKpi.total')}
                        </th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-gray-100 dark:divide-gray-800">
                      {KPI_FIELDS.map((field, fieldIndex) => (
                        <tr key={field.key} className="hover:bg-gray-50/50 dark:hover:bg-gray-800/50 transition-colors">
                          <td className="sticky left-0 z-10 bg-white dark:bg-gray-800 py-2 px-3 font-medium text-gray-700 dark:text-gray-300 text-xs border-r border-gray-100 dark:border-gray-700">
                            {language === 'fr' ? field.label : field.labelEn}
                          </td>
                          {weekDates.map((day, dayIndex) => (
                            <td key={dayIndex} className="py-1.5 px-1">
                              {field.editable ? (
                                <input
                                  type="number"
                                  step={field.formula === 'AVG' || field.key.includes('heures') ? '0.1' : '1'}
                                  min="0"
                                  value={dailyData?.[dayIndex]?.[field.key] ?? ''}
                                  onChange={(e) => handleCellChange(dayIndex, field.key, e.target.value)}
                                  className="w-full text-center py-1.5 px-1 text-sm border border-gray-200 dark:border-gray-600 rounded-md bg-white dark:bg-gray-700 focus:ring-2 focus:ring-hse-primary/30 focus:border-hse-primary transition-all"
                                  placeholder="-"
                                />
                              ) : (
                                <div className="w-full text-center py-1.5 px-1 text-sm text-gray-700 dark:text-gray-300">
                                  {formatValue(dailyData?.[dayIndex]?.[field.key] ?? '', field.unit)}
                                </div>
                              )}
                            </td>
                          ))}
                          <td className="py-2 px-3 text-center font-semibold text-hse-primary bg-hse-primary/5">
                            {formatValue(aggregates[field.key], field.unit)}
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </div>

              {/* Action buttons */}
              <div className="flex flex-col sm:flex-row items-center justify-between gap-3 pt-4 border-t border-gray-200 dark:border-gray-700">
                <div className="flex flex-col gap-1">
                  <p className="text-xs text-gray-500 dark:text-gray-400">
                    * {t('kpi.dailyKpi.formulaInfo')}
                  </p>
                  <p className="text-xs text-gray-500 dark:text-gray-400">
                    * {t('kpi.dailyKpi.workHoursFormula')}
                  </p>
                </div>
                <div className="flex flex-col sm:flex-row gap-2 w-full sm:w-auto">
                  <button
                    onClick={handleApplyAutoFill}
                    disabled={!autoFillData}
                    className="btn-secondary flex items-center gap-2 px-4 w-full sm:w-auto justify-center"
                  >
                    <RefreshCw className="w-4 h-4" />
                    {t('kpi.dailyKpi.autoFill')}
                  </button>
                  <button
                    onClick={handleConfirmData}
                    disabled={loading}
                    className="btn-primary flex items-center gap-2 px-6 w-full sm:w-auto justify-center"
                  >
                    {loading ? <Loader2 className="w-4 h-4 animate-spin" /> : <Check className="w-4 h-4" />}
                    {t('kpi.dailyKpi.confirm')}
                  </button>
                </div>
              </div>
            </div>
          )}
        </div>
      )}
    </div>
  )
}
