import { Building2, Calendar, Hash } from 'lucide-react'
import { useMemo } from 'react'
import { useAuthStore } from '../../store/authStore'
import { 
  getAllWeeksForYear, 
  getWeekDates, 
  getCurrentWeek,
  formatDate 
} from '../../utils/weekHelper'
import Select from '../ui/Select'
import { getProjectLabel, sortProjects } from '../../utils/projectList'

export default function StepProjectInfo({ formData, updateFormData, projects, t, poles, selectedPole, onPoleChange }) {
  const { user } = useAuthStore()
  // Get current week info
  const currentWeek = useMemo(() => getCurrentWeek(), [])

  const projectListPreference = user?.project_list_preference ?? 'code'
  const filteredProjects = useMemo(() => {
    const list = Array.isArray(projects) ? projects : []
    if (!selectedPole) return list
    return list.filter((p) => p?.pole === selectedPole)
  }, [projects, selectedPole])
  const sortedProjects = useMemo(() => {
    return sortProjects(filteredProjects, projectListPreference)
  }, [filteredProjects, projectListPreference])
  
  // Get all weeks for the selected year
  const weeks = useMemo(() => {
    const year = formData.report_year || new Date().getFullYear()
    return getAllWeeksForYear(year)
  }, [formData.report_year])

  // Handle week number change (Saturday-Friday weeks)
  const handleWeekChange = (weekNum) => {
    const year = formData.report_year || new Date().getFullYear()
    const dates = getWeekDates(weekNum, year)
    
    updateFormData('week_number', weekNum)
    updateFormData('start_date', formatDate(dates.start))
    updateFormData('end_date', formatDate(dates.end))
    updateFormData('report_date', formatDate(dates.start))
    updateFormData('report_month', dates.start.getMonth() + 1)
  }

  // Handle year change
  const handleYearChange = (year) => {
    updateFormData('report_year', parseInt(year))
    // Reset week selection when year changes
    updateFormData('week_number', '')
    updateFormData('start_date', '')
    updateFormData('end_date', '')
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center gap-3 mb-6">
        <div className="w-12 h-12 bg-hse-primary/10 rounded-xl flex items-center justify-center">
          <Building2 className="w-6 h-6 text-hse-primary" />
        </div>
        <div>
          <h2 className="text-xl font-bold text-gray-900 dark:text-gray-100">{t('kpi.projectInfo.title')}</h2>
          <p className="text-gray-500 dark:text-gray-400 text-sm">{t('kpi.projectInfo.selectProject')}</p>
        </div>
      </div>

      {/* Project Selection */}
      <div>
        {Array.isArray(poles) && poles.length > 0 && (
          <div className="mb-3">
            <label className="label">Pole</label>
            <Select
              value={selectedPole}
              onChange={(e) => onPoleChange?.(e.target.value)}
            >
              <option value="">All</option>
              {poles.map((p) => (
                <option key={p} value={p}>
                  {p}
                </option>
              ))}
            </Select>
          </div>
        )}

        <label className="label">{t('projects.projectName')} *</label>
        <Select
          value={formData.project_id}
          onChange={(e) => updateFormData('project_id', e.target.value)}
        >
          <option value="">{t('kpi.projectInfo.selectProject')}</option>
          {sortedProjects.map((project) => (
            <option key={project.id} value={project.id}>
              {getProjectLabel(project)}
            </option>
          ))}
        </Select>
      </div>

      {/* Report Period */}
      <div className="bg-gray-50 dark:bg-gray-700/50 rounded-xl p-6">
        <h3 className="font-semibold text-gray-900 dark:text-gray-100 mb-4 flex items-center gap-2">
          <Calendar className="w-5 h-5 text-hse-primary" />
          {t('kpi.projectInfo.reportPeriod')}
        </h3>
        
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mb-4">
          {/* Year */}
          <div>
            <label className="label">{t('kpi.reportYear')}</label>
            <Select
              value={formData.report_year}
              onChange={(e) => handleYearChange(e.target.value)}
            >
              {[...Array(5)].map((_, i) => {
                const year = new Date().getFullYear() - 2 + i
                return <option key={year} value={year}>{year}</option>
              })}
            </Select>
          </div>

          {/* Week Number (1-52, Sat-Fri) */}
          <div>
            <label className="label flex items-center gap-2">
              <Hash className="w-4 h-4" />
              {t('kpi.projectInfo.weekNumber')} * (Sam-Ven)
            </label>
            <Select
              value={formData.week_number ?? ''}
              onChange={(e) => handleWeekChange(parseInt(e.target.value))}
            >
              <option value="">-- Sélectionner --</option>
              {weeks.map((week) => (
                <option 
                  key={week.week} 
                  value={week.week}
                  className={week.week === currentWeek.week && week.year === currentWeek.year ? 'font-bold' : ''}
                >
                  S{String(week.week).padStart(2, '0')} - {week.year}
                  {week.week === currentWeek.week && week.year === currentWeek.year ? ` (${t('kpi.projectInfo.currentWeek')})` : ''}
                </option>
              ))}
            </Select>
          </div>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          {/* Start Date (Saturday, read-only) */}
          <div>
            <label className="label">{t('kpi.projectInfo.startDate')} (Samedi)</label>
            <div className="input bg-gray-100 dark:bg-gray-600 cursor-not-allowed flex items-center text-sm">
              <span className="text-gray-900 dark:text-gray-100">
                {formData.start_date ?? ''}
              </span>
            </div>
          </div>

          {/* End Date (Friday, read-only) */}
          <div>
            <label className="label">{t('kpi.projectInfo.endDate')} (Vendredi)</label>
            <div className="input bg-gray-100 dark:bg-gray-600 cursor-not-allowed flex items-center text-sm">
              <span className="text-gray-900 dark:text-gray-100">
                {formData.end_date ?? ''}
              </span>
            </div>
          </div>
        </div>

        {/* Week Summary */}
        {formData.start_date && formData.end_date && (
          <div className="mt-4 p-3 bg-hse-primary/10 rounded-lg">
            <p className="text-sm text-hse-primary font-medium">
              📅 Semaine {formData.week_number}: {new Date(formData.start_date).toLocaleDateString('fr-FR')} - {new Date(formData.end_date).toLocaleDateString('fr-FR')}
            </p>
          </div>
        )}
      </div>

      {/* Selected Project Summary */}
      {formData.project_id && (
        <div className="mt-6 p-4 bg-blue-50 dark:bg-blue-900/30 border border-blue-200 dark:border-blue-700 rounded-xl">
          <h4 className="font-medium text-blue-900 dark:text-blue-300 mb-2">{t('projects.projectDetails')}</h4>
          {(() => {
            const project = projects.find(p => p.id === parseInt(formData.project_id))
            if (!project) return null
            return (
              <div className="grid grid-cols-2 gap-4 text-sm">
                <div>
                  <span className="text-blue-600 dark:text-blue-400">{t('projects.projectName')}:</span>
                  <p className="font-medium text-blue-900 dark:text-blue-200">{project.name}</p>
                </div>
                <div>
                  <span className="text-blue-600 dark:text-blue-400">{t('projects.projectCode')}:</span>
                  <p className="font-medium text-blue-900 dark:text-blue-200">{project.code}</p>
                </div>
                <div>
                  <span className="text-blue-600 dark:text-blue-400">{t('projects.location')}:</span>
                  <p className="font-medium text-blue-900 dark:text-blue-200">{project.location ?? ''}</p>
                </div>
                <div>
                  <span className="text-blue-600 dark:text-blue-400">{t('projects.clientName')}:</span>
                  <p className="font-medium text-blue-900 dark:text-blue-200">{project.client_name ?? ''}</p>
                </div>
              </div>
            )
          })()}
        </div>
      )}
    </div>
  )
}
