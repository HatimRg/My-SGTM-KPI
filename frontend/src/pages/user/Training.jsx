import { useEffect, useMemo, useState } from 'react'
import { useLanguage } from '../../i18n'
import { useAuthStore } from '../../store/authStore'
import { trainingService, exportService } from '../../services/api'
import { useProjectStore } from '../../store/projectStore'
import DatePicker from '../../components/ui/DatePicker'
import Select from '../../components/ui/Select'
import Modal from '../../components/ui/Modal'
import ConfirmDialog from '../../components/ui/ConfirmDialog'
import { Search, X, Image as ImageIcon, Filter, ChevronDown, ChevronUp, Plus, Check, Download, FileSpreadsheet, Loader2, Trash2 } from 'lucide-react'
import toast from 'react-hot-toast'
import { getWeekFromDate } from '../../utils/weekHelper'
import { getProjectLabel, sortProjects } from '../../utils/projectList'

// Duration keys for i18n lookup
const DURATION_KEYS = [
  '30min',
  '1h',
  '1h30',
  '2h',
  '3h',
  'halfDay',
  '1day',
  '2days',
  '3days',
]

const DURATION_TO_HOURS = {
  '30min': 0.5,
  '1h': 1,
  '1h30': 1.5,
  '2h': 2,
  '3h': 3,
  'halfDay': 12,
  '1day': 24,
  '2days': 48,
  '3days': 72,
}

const TRAININGS_PER_PAGE = 10

// Map old duration labels to new keys (for backward compatibility)
const OLD_LABEL_TO_KEY = {
  '30 Min': '30min',
  '1 H': '1h',
  '1 H 30 Min': '1h30',
  '2 H': '2h',
  '3 H': '3h',
  'Half a day': 'halfDay',
  '1 day': '1day',
  '2 days': '2days',
  '3 days': '3days',
}

export default function Training() {
  const { t } = useLanguage()
  const { user } = useAuthStore()
  const { projects, isLoading: loadingProjects, fetchProjects } = useProjectStore()

  const [trainings, setTrainings] = useState([])
  const [loadingTrainings, setLoadingTrainings] = useState(false)

  const [projectId, setProjectId] = useState('')
  const [date, setDate] = useState('')
  const [isExternal, setIsExternal] = useState(false)
  const [byInternalName, setByInternalName] = useState('')
  const [externalCompany, setExternalCompany] = useState('')
  const [themeSearch, setThemeSearch] = useState('')
  const [selectedTheme, setSelectedTheme] = useState('')
  const [otherTheme, setOtherTheme] = useState('')
  const [duration, setDuration] = useState('')
  const [participants, setParticipants] = useState('')
  const [photoFile, setPhotoFile] = useState(null)
  const [photoPreview, setPhotoPreview] = useState('')
  const [activePhoto, setActivePhoto] = useState(null)
  const [activePhotoUrl, setActivePhotoUrl] = useState('')
  const [loadingPhoto, setLoadingPhoto] = useState(false)

  const [filterProjectId, setFilterProjectId] = useState('')
  const [filterWeek, setFilterWeek] = useState('')
  const [filterFromDate, setFilterFromDate] = useState('')
  const [filterToDate, setFilterToDate] = useState('')
  const [formExpanded, setFormExpanded] = useState(false)
  const [currentPage, setCurrentPage] = useState(1)
  const [exporting, setExporting] = useState(false)

  const [confirmDeleteTraining, setConfirmDeleteTraining] = useState(null)

  const projectListPreference = user?.project_list_preference ?? 'code'
  const sortedProjects = useMemo(() => {
    return sortProjects(projects, projectListPreference)
  }, [projects, projectListPreference])

  useEffect(() => {
    if (user?.name) {
      setByInternalName(user.name)
    }
  }, [user])

  useEffect(() => {
    const loadProjects = async () => {
      try {
        const list = await fetchProjects({ per_page: 50 })
        if (list.length === 1) {
          setProjectId(list[0].id.toString())
        }
      } catch (error) {
        console.error('Failed to load projects for training page', error)
      }
    }

    loadProjects()
  }, [fetchProjects])

  useEffect(() => {
    return () => {
      if (activePhotoUrl) {
        URL.revokeObjectURL(activePhotoUrl)
      }
    }
  }, [activePhotoUrl])

  useEffect(() => {
    fetchTrainings()
  }, [filterProjectId, filterWeek])

  const fetchTrainings = async () => {
    try {
      setLoadingTrainings(true)
      const params = {}
      if (filterProjectId) params.project_id = filterProjectId
      if (filterWeek) params.week = filterWeek
      const response = await trainingService.getAll(params)
      setTrainings(response.data.data ?? [])
    } catch (error) {
      console.error('Failed to load trainings', error)
      toast.error(t('errors.failedToLoad'))
    } finally {
      setLoadingTrainings(false)
    }
  }

  const allThemes = t('training.themes') ?? []

  const filteredThemes = useMemo(() => {
    if (!themeSearch.trim()) return allThemes
    const q = themeSearch.toLowerCase()
    return allThemes.filter(label => label.toLowerCase().includes(q))
  }, [themeSearch, allThemes])

  const participantsNumber = Number(participants)
  const durationHours = DURATION_TO_HOURS[duration] ?? 0
  const trainingHours = durationHours * participantsNumber

  const filteredTrainingsList = useMemo(() => {
    if (!Array.isArray(trainings)) return []
    return trainings.filter((tr) => {
      const dateStr = tr.date ? tr.date.split('T')[0] : ''
      if (filterFromDate && (!dateStr || dateStr < filterFromDate)) return false
      if (filterToDate && (!dateStr || dateStr > filterToDate)) return false
      return true
    })
  }, [trainings, filterFromDate, filterToDate])

  const totalPages = Math.max(1, Math.ceil(((filteredTrainingsList.length ?? 0)) / TRAININGS_PER_PAGE))

  const paginatedTrainings = useMemo(() => {
    if (!Array.isArray(filteredTrainingsList)) return []
    const start = (currentPage - 1) * TRAININGS_PER_PAGE
    return filteredTrainingsList.slice(start, start + TRAININGS_PER_PAGE)
  }, [filteredTrainingsList, currentPage])

  useEffect(() => {
    setCurrentPage(1)
  }, [filterProjectId, filterWeek])

  const handleExportTrainings = async () => {
    try {
      setExporting(true)
      const params = {}
      if (filterProjectId) params.project_id = filterProjectId
      if (filterWeek) params.week = filterWeek
      if (filterFromDate) params.from_date = filterFromDate
      if (filterToDate) params.to_date = filterToDate

      const response = await exportService.exportTrainings(params)
      const blob = new Blob([response.data], {
        type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
      })
      const url = window.URL.createObjectURL(blob)
      const a = document.createElement('a')
      a.href = url
      a.download = 'trainings.xlsx'
      a.click()
      window.URL.revokeObjectURL(url)
    } catch (error) {
      console.error('Error exporting trainings:', error)
      toast.error(t('errors.failedToExport'))
    } finally {
      setExporting(false)
    }
  }

  const handlePhotoChange = (e) => {
    const file = e.target.files?.[0]
    setPhotoFile(file ?? null)

    if (file) {
      const reader = new FileReader()
      reader.onloadend = () => {
        setPhotoPreview(reader.result.toString())
      }
      reader.readAsDataURL(file)
    } else {
      setPhotoPreview('')
    }
  }

  const openPhotoModal = (training) => {
    if (!training?.photo_url) return
    setActivePhoto(training)
    setLoadingPhoto(true)
    if (activePhotoUrl) {
      URL.revokeObjectURL(activePhotoUrl)
      setActivePhotoUrl('')
    }
    trainingService
      .getPhoto(training.id)
      .then((res) => {
        const blob = res.data
        const url = URL.createObjectURL(blob)
        setActivePhotoUrl(url)
      })
      .catch((error) => {
        console.error('Failed to load training photo', error)
        toast.error(t('errors.failedToLoad'))
      })
      .finally(() => {
        setLoadingPhoto(false)
      })
  }

  const handleDeleteTraining = (training) => {
    setConfirmDeleteTraining(training)
  }

  const confirmDelete = async () => {
    if (!confirmDeleteTraining?.id) return
    try {
      await trainingService.delete(confirmDeleteTraining.id)
      toast.success(t('common.saved') ?? 'Saved')
      fetchTrainings()
    } catch (error) {
      console.error('Failed to delete training', error)
      toast.error(t('errors.failedToDelete') ?? t('common.error') ?? 'Error')
    } finally {
      setConfirmDeleteTraining(null)
    }
  }

  const handleSubmit = (e) => {
    e.preventDefault()
    if (!projectId || !date || !duration || !participantsNumber || !selectedTheme || (selectedTheme === 'Other' && !otherTheme)) {
      return
    }

    const { week, year } = getWeekFromDate(date)

    const payload = {
      project_id: projectId,
      date,
      week_number: week,
      week_year: year,
      by_internal: !isExternal,
      by_name: isExternal ? null : byInternalName,
      external_company: isExternal ? externalCompany : null,
      theme: selectedTheme === 'Other' ? otherTheme : selectedTheme,
      duration_label: duration,
      duration_hours: durationHours,
      participants: participantsNumber,
      training_hours: trainingHours,
      photo: photoFile,
    }

    trainingService
      .create(payload)
      .then(() => {
        toast.success(t('training.created'))
        // Reset only form fields, keep filters
        setDate('')
        setIsExternal(false)
        setExternalCompany('')
        setThemeSearch('')
        setSelectedTheme('')
        setOtherTheme('')
        setDuration('')
        setParticipants('')
        setPhotoFile(null)
        setPhotoPreview('')
        fetchTrainings()
      })
      .catch((error) => {
        console.error('Failed to create training', error)
        const message = error.response?.data?.message ?? t('errors.failedToSave')
        toast.error(message)
      })
  }

  return (
    <div className="max-w-5xl mx-auto space-y-6 animate-fade-in">
      <div>
        <div className="text-xs text-gray-500 dark:text-gray-400 mb-1">
          {t('nav.dashboard')} / {t('training.navLabel')}
        </div>
        <h1 className="text-2xl font-bold text-gray-900 dark:text-gray-100">{t('training.pageTitle')}</h1>
        <p className="text-gray-500 dark:text-gray-400 mt-1">{t('training.pageSubtitle')}</p>
      </div>

      {/* Collapsible Form */}
      <div className="card">
        <button
          type="button"
          onClick={() => setFormExpanded(!formExpanded)}
          className="w-full p-4 flex items-center justify-between text-left hover:bg-gray-50 dark:hover:bg-gray-800 transition-colors rounded-xl"
        >
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 bg-hse-primary/10 rounded-lg flex items-center justify-center">
              <Plus className="w-5 h-5 text-hse-primary" />
            </div>
            <div>
              <h3 className="font-semibold text-gray-900 dark:text-gray-100">{t('training.addTraining')}</h3>
              <p className="text-sm text-gray-500 dark:text-gray-400">{t('training.clickToExpand')}</p>
            </div>
          </div>
          {formExpanded ? (
            <ChevronUp className="w-5 h-5 text-gray-400" />
          ) : (
            <ChevronDown className="w-5 h-5 text-gray-400" />
          )}
        </button>

        {formExpanded && (
          <form onSubmit={handleSubmit} className="p-6 pt-2 space-y-6 border-t border-gray-100 dark:border-gray-700">
        {/* Project */}
        <div>
          <label className="label">{t('training.project')}</label>
          <Select
            value={projectId}
            onChange={(e) => setProjectId(e.target.value)}
            disabled={loadingProjects || projects.length === 1}
            required
          >
            <option value="">
              {loadingProjects ? t('common.loading') : t('training.selectProject')}
            </option>
            {sortedProjects.map((p) => (
              <option key={p.id} value={p.id}>
                {getProjectLabel(p)}
              </option>
            ))}
          </Select>
        </div>

        {/* Date */}
        <div>
          <label className="label">{t('training.date')}</label>
          <DatePicker value={date} onChange={setDate} required />
        </div>

        {/* By / External */}
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4 items-end">
          <div>
            <label className="label flex items-center justify-between">
              <span>{t('training.by')}</span>
              <label className="flex items-center gap-2 text-xs cursor-pointer select-none">
                <div
                  onClick={() => setIsExternal(!isExternal)}
                  className={`w-4 h-4 rounded border-2 flex items-center justify-center transition-colors cursor-pointer ${
                    isExternal
                      ? 'bg-hse-primary border-hse-primary'
                      : 'border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-800'
                  }`}
                >
                  {isExternal && (
                    <svg className="w-3 h-3 text-white" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={3}>
                      <path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" />
                    </svg>
                  )}
                </div>
                <span>{t('training.external')}</span>
              </label>
            </label>
            {!isExternal ? (
              <input
                type="text"
                className="input"
                value={byInternalName}
                onChange={(e) => setByInternalName(e.target.value)}
                readOnly
              />
            ) : (
              <input
                type="text"
                className="input"
                value={externalCompany}
                onChange={(e) => setExternalCompany(e.target.value)}
                placeholder={t('training.externalPlaceholder')}
                required
              />
            )}
          </div>
        </div>

        {/* Theme with search */}
        <div className="space-y-2">
          <label className="label">{t('training.theme')}</label>
          <div className="relative mb-2">
            <Search className="w-4 h-4 text-gray-400 absolute left-3 top-1/2 -translate-y-1/2" />
            <input
              type="text"
              className="input pl-9"
              placeholder={t('training.searchTheme')}
              value={themeSearch}
              onChange={(e) => setThemeSearch(e.target.value)}
            />
            {themeSearch && (
              <button
                type="button"
                onClick={() => setThemeSearch('')}
                className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-600"
              >
                <X className="w-4 h-4" />
              </button>
            )}
          </div>

          <div className="max-h-48 overflow-y-auto border border-gray-200 dark:border-gray-700 rounded-lg divide-y divide-gray-100 dark:divide-gray-700 bg-white dark:bg-gray-800">
            {filteredThemes.map((label) => (
              <button
                key={label}
                type="button"
                onClick={() => setSelectedTheme(label)}
                className={`w-full text-left px-3 py-2.5 text-sm flex items-center justify-between gap-2 transition-colors ${
                  selectedTheme === label 
                    ? 'bg-hse-primary/10 text-hse-primary font-medium border-l-4 border-hse-primary' 
                    : 'text-gray-700 dark:text-gray-200 hover:bg-gray-50 dark:hover:bg-gray-700/50 border-l-4 border-transparent'
                }`}
              >
                <span>{label === 'Other' ? t('common.other') : label}</span>
                {selectedTheme === label && (
                  <Check className="w-4 h-4 text-hse-primary flex-shrink-0" />
                )}
              </button>
            ))}
          </div>

          {selectedTheme === 'Other' && (
            <div className="mt-2">
              <label className="label">{t('training.otherTheme')}</label>
              <input
                type="text"
                className="input"
                value={otherTheme}
                onChange={(e) => setOtherTheme(e.target.value)}
                required
              />
            </div>
          )}
        </div>

        {/* Duration & Participants */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          <div>
            <label className="label">{t('training.duration')}</label>
            <Select
              value={duration}
              onChange={(e) => setDuration(e.target.value)}
            >
              <option value="">{t('training.selectDuration')}</option>
              {DURATION_KEYS.map((key) => (
                <option key={key} value={key}>
                  {t(`training.durations.${key}`)}
                </option>
              ))}
            </Select>
          </div>

          <div>
            <label className="label">{t('training.participants')}</label>
            <input
              type="number"
              min="1"
              className="input"
              value={participants}
              onChange={(e) => setParticipants(e.target.value)}
              required
            />
          </div>

          <div>
            <label className="label">{t('training.trainingHours')}</label>
            <div className="input bg-gray-50 dark:bg-gray-800 flex items-center justify-between">
              <span>{Number.isFinite(trainingHours) ? trainingHours : 0}</span>
              <span className="text-xs text-gray-400 ml-2">{t('training.hoursUnit')}</span>
            </div>
          </div>
        </div>

        {/* Photo upload */}
        <div>
          <label className="label flex items-center gap-2">
            <ImageIcon className="w-4 h-4" />
            {t('training.photo')}
          </label>
          <label className="flex items-center justify-center border-2 border-dashed border-gray-300 dark:border-gray-600 rounded-lg p-4 cursor-pointer hover:border-hse-primary hover:bg-hse-primary/5 transition-colors">
            <input
              type="file"
              accept="image/*"
              onChange={handlePhotoChange}
              className="hidden"
            />
            {photoPreview ? (
              <div className="flex items-center gap-3">
                <img src={photoPreview} alt="Preview" className="w-12 h-12 object-cover rounded" />
                <span className="text-sm text-gray-600 dark:text-gray-400">{t('training.changePhoto')}</span>
              </div>
            ) : (
              <div className="text-center">
                <ImageIcon className="w-8 h-8 mx-auto text-gray-400 mb-2" />
                <p className="text-sm text-gray-500 dark:text-gray-400">{t('training.uploadPhoto')}</p>
              </div>
            )}
          </label>
        </div>

        {/* Actions */}
        <div className="flex justify-end gap-3 pt-4 border-t border-gray-200 dark:border-gray-700">
          <button
            type="submit"
            className="btn-primary"
            disabled={!projectId || !date || !duration || !participantsNumber || !selectedTheme || (selectedTheme === 'Other' && !otherTheme)}
          >
            {t('training.submit')}
          </button>
        </div>
          </form>
        )}
      </div>

      {/* Trainings list */}
      <div className="card p-6 space-y-4">
        <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-4">
          <h2 className="text-lg font-semibold text-gray-900 dark:text-gray-100 flex items-center gap-2">
            <Filter className="w-4 h-4 text-hse-primary" />
            {t('training.listTitle')}
          </h2>
          <div className="flex flex-wrap md:flex-nowrap items-center gap-3">
            <Select
              value={filterProjectId}
              onChange={(e) => setFilterProjectId(e.target.value)}
              className="h-10 text-sm min-w-[140px]"
            >
              <option value="">{t('training.allProjects')}</option>
              {sortedProjects.map((p) => (
                <option key={p.id} value={p.id}>
                  {getProjectLabel(p)}
                </option>
              ))}
            </Select>
            <Select
              value={filterWeek}
              onChange={(e) => setFilterWeek(e.target.value)}
              className="h-10 text-sm min-w-[130px]"
            >
              <option value="">{t('training.allWeeks')}</option>
              {Array.from({ length: 52 }, (_, i) => i + 1).map((w) => (
                <option key={w} value={w}>
                  {t('training.weekLabel').replace('{{week}}', w)}
                </option>
              ))}
            </Select>
            <DatePicker
              value={filterFromDate}
              onChange={(val) => { setFilterFromDate(val); setCurrentPage(1) }}
              placeholder="From date"
              className="w-40 h-10"
            />
            <DatePicker
              value={filterToDate}
              onChange={(val) => { setFilterToDate(val); setCurrentPage(1) }}
              placeholder="To date"
              className="w-40 h-10"
            />
            <button
              type="button"
              onClick={handleExportTrainings}
              disabled={exporting || trainings.length === 0}
              className="btn-secondary flex items-center gap-2 text-sm"
            >
              <FileSpreadsheet className="w-4 h-4" />
              <span>{t('dashboard.exportExcel')}</span>
            </button>
          </div>
        </div>

        {loadingTrainings ? (
          <div className="space-y-3 py-4">
            <div className="hidden md:block space-y-2 animate-pulse">
              {Array.from({ length: 4 }, (_, i) => (
                <div
                  key={i}
                  className="h-10 rounded-md bg-gray-100 dark:bg-gray-800"
                />
              ))}
            </div>
            <div className="md:hidden space-y-3 animate-pulse">
              {Array.from({ length: 3 }, (_, i) => (
                <div
                  key={i}
                  className="h-24 rounded-lg bg-gray-100 dark:bg-gray-800"
                />
              ))}
            </div>
          </div>
        ) : trainings.length === 0 ? (
          <div className="py-12 text-center">
            <div className="inline-flex items-center justify-center w-12 h-12 rounded-full bg-hse-primary/10 mb-3">
              <Filter className="w-5 h-5 text-hse-primary" />
            </div>
            <p className="text-sm font-medium text-gray-900 dark:text-gray-100">
              {t('training.noTrainings')}
            </p>
          </div>
        ) : (
          <>
            {/* Mobile cards */}
            <div className="space-y-3 md:hidden">
              {paginatedTrainings.map((tr) => (
                <div
                  key={tr.id}
                  className="border border-gray-200 dark:border-gray-700 rounded-lg p-3 bg-white dark:bg-gray-800"
                >
                  <div className="flex items-start justify-between gap-3">
                    <div>
                      <p className="font-medium text-gray-900 dark:text-gray-100">
                        {tr.project?.name ?? ''}
                      </p>
                      <p className="text-xs text-gray-500 dark:text-gray-400 mt-1">
                        {tr.date ? tr.date.split('T')[0] : ''}
                      </p>
                      <p className="mt-1 text-xs text-gray-600 dark:text-gray-300">
                        {tr.by_internal ? tr.by_name : (tr.external_company ?? '')}
                      </p>
                    </div>
                    <div className="text-right text-xs text-gray-600 dark:text-gray-300 space-y-1">
                      <p className="font-medium truncate max-w-[140px]">
                        {tr.theme}
                      </p>
                      <p>
                        {t(`training.durations.${OLD_LABEL_TO_KEY[tr.duration_label] ?? tr.duration_label}`)}
                      </p>
                      <div className="flex justify-end">
                        <button
                          type="button"
                          onClick={() => handleDeleteTraining(tr)}
                          className="p-1.5 rounded-md hover:bg-red-50 dark:hover:bg-red-900/30"
                          title={t('common.delete') ?? 'Delete'}
                        >
                          <Trash2 className="w-4 h-4 text-red-600" />
                        </button>
                      </div>
                    </div>
                  </div>

                  <div className="mt-3 flex items-center justify-between text-[11px] text-gray-600 dark:text-gray-300">
                    <span className="px-1.5 py-0.5 rounded-full bg-gray-50 dark:bg-gray-900">
                      {t('training.participants')}: {tr.participants}
                    </span>
                    <span className="px-1.5 py-0.5 rounded-full bg-hse-primary/10 text-hse-primary">
                      {t('training.trainingHours')}: {tr.training_hours}
                    </span>
                  </div>

                  {tr.photo_url && (
                    <div className="mt-2 flex justify-end">
                      <button
                        type="button"
                        onClick={() => openPhotoModal(tr)}
                        className="text-[11px] text-hse-primary hover:underline flex items-center gap-1"
                      >
                        <ImageIcon className="w-3 h-3" />
                        {t('training.viewPhoto')}
                      </button>
                    </div>
                  )}
                </div>
              ))}
            </div>

            {/* Desktop table */}
            <div className="hidden md:block overflow-x-auto">
              <table className="min-w-full text-sm">
                <thead>
                  <tr className="border-b border-gray-200 dark:border-gray-700 text-left">
                    <th className="py-2 pr-4 font-medium text-gray-500 dark:text-gray-400">{t('training.colDate')}</th>
                    <th className="py-2 pr-4 font-medium text-gray-500 dark:text-gray-400">{t('training.colProject')}</th>
                    <th className="py-2 pr-4 font-medium text-gray-500 dark:text-gray-400">{t('training.colBy')}</th>
                    <th className="py-2 pr-4 font-medium text-gray-500 dark:text-gray-400">{t('training.colTheme')}</th>
                    <th className="py-2 pr-4 font-medium text-gray-500 dark:text-gray-400">{t('training.colDuration')}</th>
                    <th className="py-2 pr-4 font-medium text-gray-500 dark:text-gray-400">{t('training.colParticipants')}</th>
                    <th className="py-2 pr-4 font-medium text-gray-500 dark:text-gray-400">{t('training.colHours')}</th>
                    <th className="py-2 pr-4 font-medium text-gray-500 dark:text-gray-400">{t('training.colPhoto')}</th>
                    <th className="py-2 pr-4 font-medium text-gray-500 dark:text-gray-400">{t('common.actions') ?? 'Actions'}</th>
                  </tr>
                </thead>
                <tbody>
                  {paginatedTrainings.map((tr) => (
                    <tr key={tr.id} className="border-b border-gray-100 dark:border-gray-800">
                      <td className="py-2 pr-4 text-gray-900 dark:text-gray-100 text-xs">
                        {tr.date ? tr.date.split('T')[0] : ''}
                      </td>
                      <td className="py-2 pr-4 text-gray-900 dark:text-gray-100">
                        {tr.project?.name ?? ''}
                      </td>
                      <td className="py-2 pr-4 text-gray-700 dark:text-gray-200">
                        {tr.by_internal ? tr.by_name : (tr.external_company ?? '')}
                      </td>
                      <td className="py-2 pr-4 text-gray-700 dark:text-gray-200">
                        {tr.theme}
                      </td>
                      <td className="py-2 pr-4 text-gray-700 dark:text-gray-200">
                        {t(`training.durations.${OLD_LABEL_TO_KEY[tr.duration_label] ?? tr.duration_label}`)}
                      </td>
                      <td className="py-2 pr-4 text-gray-700 dark:text-gray-200">
                        {tr.participants}
                      </td>
                      <td className="py-2 pr-4 text-gray-700 dark:text-gray-200">
                        {tr.training_hours}
                      </td>
                      <td className="py-2 pr-4 text-gray-700 dark:text-gray-200">
                        {tr.photo_url ? (
                          <div className="flex items-center gap-2">
                            <button
                              type="button"
                              onClick={() => openPhotoModal(tr)}
                              className="text-xs text-hse-primary hover:underline"
                            >
                              {t('training.viewPhoto')}
                            </button>
                            <a
                              href={tr.photo_url}
                              download
                              className="text-xs text-gray-500 hover:underline"
                            >
                              {t('training.downloadPhoto')}
                            </a>
                          </div>
                        ) : (
                          <span className="text-xs text-gray-400"></span>
                        )}
                      </td>
                      <td className="py-2 pr-4 text-gray-700 dark:text-gray-200">
                        <button
                          type="button"
                          onClick={() => handleDeleteTraining(tr)}
                          className="p-1.5 rounded-md hover:bg-red-50 dark:hover:bg-red-900/30"
                          title={t('common.delete') ?? 'Delete'}
                        >
                          <Trash2 className="w-4 h-4 text-red-600" />
                        </button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </>
        )}

        {!loadingTrainings && trainings.length > 0 && totalPages > 1 && (
          <div className="flex items-center justify-between pt-4 border-t border-gray-100 dark:border-gray-800">
            <p className="text-sm text-gray-500 dark:text-gray-400">
              {t('common.page')} {currentPage} {t('common.of')} {totalPages}
            </p>
            <div className="flex gap-2">
              <button
                type="button"
                onClick={() => setCurrentPage((p) => Math.max(1, p - 1))}
                disabled={currentPage === 1}
                className="btn-secondary text-sm disabled:opacity-50 disabled:cursor-not-allowed"
              >
                {t('common.previous')}
              </button>
              <button
                type="button"
                onClick={() => setCurrentPage((p) => Math.min(totalPages, p + 1))}
                disabled={currentPage === totalPages}
                className="btn-secondary text-sm disabled:opacity-50 disabled:cursor-not-allowed"
              >
                {t('common.next')}
              </button>
            </div>
          </div>
        )}
      </div>

      {activePhoto && (
        <Modal
          isOpen={!!activePhoto}
          onClose={() => {
            setActivePhoto(null)
            if (activePhotoUrl) {
              URL.revokeObjectURL(activePhotoUrl)
              setActivePhotoUrl('')
            }
          }}
          title={t('training.photo')}
          size="xl"
        >
          <div className="space-y-4">
            <div className="flex justify-center">
              {loadingPhoto ? (
                <div className="flex items-center justify-center h-48">
                  <Loader2 className="w-6 h-6 animate-spin text-hse-primary" />
                </div>
              ) : activePhotoUrl ? (
                <img
                  src={activePhotoUrl}
                  alt={t('training.photo')}
                  className="max-h-[70vh] w-auto rounded-lg shadow-md object-contain bg-gray-900/5"
                />
              ) : (
                <div className="text-sm text-gray-500 dark:text-gray-400">
                  {t('errors.failedToLoad')}
                </div>
              )}
            </div>
            <div className="flex justify-end">
              {activePhotoUrl && (
                <a
                  href={activePhotoUrl}
                  download
                  className="btn-primary inline-flex items-center gap-2 text-sm"
                >
                  <Download className="w-4 h-4" />
                  {t('training.downloadPhoto')}
                </a>
              )}
            </div>
          </div>
        </Modal>
      )}

      <ConfirmDialog
        isOpen={!!confirmDeleteTraining}
        title={t('common.delete') ?? 'Delete'}
        message={t('common.confirmDelete') ?? 'Are you sure you want to delete this record?'}
        confirmLabel={t('common.delete') ?? 'Delete'}
        cancelLabel={t('common.cancel') ?? 'Cancel'}
        onConfirm={confirmDelete}
        onCancel={() => setConfirmDeleteTraining(null)}
      />
    </div>
  )
}
