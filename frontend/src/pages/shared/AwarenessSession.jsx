import { useEffect, useMemo, useState } from 'react'
import { useLanguage } from '../../i18n'
import { useAuthStore } from '../../store/authStore'
import api, { awarenessService, exportService } from '../../services/api'
import { useProjectStore } from '../../store/projectStore'
import DatePicker from '../../components/ui/DatePicker'
import Select from '../../components/ui/Select'
import ConfirmDialog from '../../components/ui/ConfirmDialog'
import Modal from '../../components/ui/Modal'
import { Search, X, Filter, ChevronDown, ChevronUp, Plus, Check, FileSpreadsheet, Trash2, Upload } from 'lucide-react'
import toast from 'react-hot-toast'
import { getWeekFromDate } from '../../utils/weekHelper'
import { getProjectLabel, sortProjects } from '../../utils/projectList'

// Duration options in minutes (15 min increments from 15 to 60)
const DURATION_OPTIONS = [15, 30, 45, 60]
const SESSIONS_PER_PAGE = 10

export default function AwarenessSession() {
  const { t } = useLanguage()
  const { user } = useAuthStore()
  const { projects, isLoading: loadingProjects, fetchProjects } = useProjectStore()

  const [bulkModalOpen, setBulkModalOpen] = useState(false)
  const [bulkFile, setBulkFile] = useState(null)
  const [bulkUploading, setBulkUploading] = useState(false)

  const projectListPreference = user?.project_list_preference ?? 'code'
  const sortedProjects = useMemo(() => {
    return sortProjects(projects, projectListPreference)
  }, [projects, projectListPreference])

  const [sessions, setSessions] = useState([])
  const [loadingSessions, setLoadingSessions] = useState(false)

  const [projectId, setProjectId] = useState('')
  const [date, setDate] = useState('')
  const [byName, setByName] = useState('')
  const [themeSearch, setThemeSearch] = useState('')
  const [selectedTheme, setSelectedTheme] = useState('')
  const [otherTheme, setOtherTheme] = useState('')
  const [duration, setDuration] = useState(15)
  const [participants, setParticipants] = useState('')

  const [filterProjectId, setFilterProjectId] = useState('')
  const [filterWeek, setFilterWeek] = useState('')
  const [filterFromDate, setFilterFromDate] = useState('')
  const [filterToDate, setFilterToDate] = useState('')
  const [formExpanded, setFormExpanded] = useState(false)
  const [currentPage, setCurrentPage] = useState(1)
  const [exporting, setExporting] = useState(false)

  const [confirmDeleteSession, setConfirmDeleteSession] = useState(null)

  useEffect(() => {
    if (user?.name) {
      setByName(user.name)
    }
  }, [user?.name])

  const extractFilename = (contentDisposition) => {
    if (!contentDisposition) return null
    const match = /filename\*=UTF-8''([^;]+)|filename="?([^";]+)"?/i.exec(contentDisposition)
    const value = decodeURIComponent(match?.[1] ?? match?.[2] ?? '')
    return value !== '' ? value : null
  }

  const normalizeApiPath = (url) => {
    let path = String(url || '').replace(/^https?:\/\/[^/]+/i, '')
    if (!path) return null
    if (path.startsWith('/api/')) {
      path = path.replace(/^\/api\//, '/')
    } else if (path === '/api') {
      path = '/'
    }
    return path
  }

  const downloadBlob = (blob, filename) => {
    const url = URL.createObjectURL(blob)
    const a = document.createElement('a')
    a.href = url
    a.download = filename ?? 'template.xlsx'
    document.body.appendChild(a)
    a.click()
    a.remove()
    setTimeout(() => URL.revokeObjectURL(url), 5000)
  }

  const downloadFromUrl = async (url, fallbackFilename) => {
    const path = normalizeApiPath(url)
    if (!path) return
    const res = await api.get(path, { responseType: 'blob' })
    const filename = extractFilename(res.headers?.['content-disposition']) ?? fallbackFilename
    downloadBlob(res.data, filename)
  }

  const openBulkImport = () => {
    setBulkFile(null)
    setBulkModalOpen(true)
  }

  const handleDownloadTemplate = async () => {
    try {
      const res = await awarenessService.downloadTemplate()
      const filename = extractFilename(res.headers?.['content-disposition']) ?? 'SGTM-Awareness-Template.xlsx'
      downloadBlob(res.data, filename)
    } catch (e) {
      toast.error(e.response?.data?.message ?? t('common.downloadTemplateFailed'))
    }
  }

  const handleBulkImport = async () => {
    if (!bulkFile) {
      toast.error(t('common.chooseFile'))
      return
    }

    try {
      setBulkUploading(true)
      const form = new FormData()
      form.append('file', bulkFile)
      const res = await awarenessService.bulkImport(form)
      const payload = res.data?.data ?? {}
      const imported = payload.imported ?? 0
      const updated = payload.updated ?? 0
      const errors = payload.errors ?? []
      const failedRowsUrl = payload.failed_rows_url
      toast.success(t('common.importSummary', { imported, updated }))
      if (errors.length > 0) toast.error(t('common.importIssues', { count: errors.length }))
      if (failedRowsUrl) {
        try {
          await downloadFromUrl(failedRowsUrl, 'awareness_sessions_failed_rows.xlsx')
        } catch {
          // ignore
        }
      }
      setBulkFile(null)
      setBulkModalOpen(false)
      fetchSessions()
    } catch (e) {
      toast.error(e.response?.data?.message ?? t('common.importFailed'))
    } finally {
      setBulkUploading(false)
    }
  }

  useEffect(() => {
    const loadProjects = async () => {
      try {
        const list = await fetchProjects()
        if (list.length === 1) {
          setProjectId(list[0].id)
        }
      } catch (error) {
        console.error('Failed to load projects', error)
      }
    }
    loadProjects()
  }, [fetchProjects])

  useEffect(() => {
    fetchSessions()
  }, [filterProjectId, filterWeek])

  const fetchSessions = async () => {
    try {
      setLoadingSessions(true)
      const params = {}
      if (filterProjectId) params.project_id = filterProjectId
      if (filterWeek) params.week = filterWeek
      const res = await awarenessService.getAll(params)
      setSessions(res.data?.data ?? res.data ?? [])
    } catch (error) {
      console.error('Failed to load awareness sessions', error)
    } finally {
      setLoadingSessions(false)
    }
  }

  // Get themes from i18n
  const themes = useMemo(() => {
    const list = t('awareness.themes')
    return Array.isArray(list) ? list : []
  }, [t])

  const filteredThemes = useMemo(() => {
    if (!themeSearch) return themes
    const search = themeSearch.toLowerCase()
    return themes.filter((th) => th.toLowerCase().includes(search))
  }, [themes, themeSearch])

  const participantsNumber = parseInt(participants, 10)
  const durationHours = duration / 60
  const sessionHours = durationHours * participantsNumber

  const filteredSessionsList = useMemo(() => {
    if (!Array.isArray(sessions)) return []
    return sessions.filter((s) => {
      const dateStr = s.date ? s.date.substring(0, 10) : ''
      if (filterFromDate && (!dateStr || dateStr < filterFromDate)) return false
      if (filterToDate && (!dateStr || dateStr > filterToDate)) return false
      return true
    })
  }, [sessions, filterFromDate, filterToDate])

  const totalPages = Math.max(1, Math.ceil((filteredSessionsList.length ?? 0) / SESSIONS_PER_PAGE))

  const paginatedSessions = useMemo(() => {
    if (!Array.isArray(filteredSessionsList)) return []
    const start = (currentPage - 1) * SESSIONS_PER_PAGE
    return filteredSessionsList.slice(start, start + SESSIONS_PER_PAGE)
  }, [filteredSessionsList, currentPage])

  useEffect(() => {
    setCurrentPage(1)
  }, [filterProjectId, filterWeek])

  const handleExportAwareness = async () => {
    try {
      setExporting(true)
      const params = {}
      if (filterProjectId) params.project_id = filterProjectId
      if (filterWeek) params.week = filterWeek
      if (filterFromDate) params.from_date = filterFromDate
      if (filterToDate) params.to_date = filterToDate

      const response = await exportService.exportAwareness(params)
      const blob = new Blob([response.data], {
        type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
      })
      const url = window.URL.createObjectURL(blob)
      const a = document.createElement('a')
      a.href = url
      a.download = 'awareness_sessions.xlsx'
      a.click()
      window.URL.revokeObjectURL(url)
    } catch (error) {
      console.error('Error exporting awareness sessions:', error)
      // Reuse generic error message
      toast.error(t('errors.somethingWentWrong') ?? t('common.exportFailed'))
    } finally {
      setExporting(false)
    }
  }

  const handleSubmit = (e) => {
    e.preventDefault()
    if (!projectId || !date || !selectedTheme || !participantsNumber) return
    if (selectedTheme === 'Other' && !otherTheme.trim()) return

    const { week, year } = getWeekFromDate(date)

    const payload = {
      project_id: projectId,
      date,
      week_number: week,
      week_year: year,
      by_name: byName,
      theme: selectedTheme === 'Other' ? otherTheme : selectedTheme,
      duration_minutes: duration,
      participants: participantsNumber,
      session_hours: sessionHours,
    }

    awarenessService
      .create(payload)
      .then(() => {
        toast.success(t('awareness.created') ?? 'Session saved')
        setDate('')
        setThemeSearch('')
        setSelectedTheme('')
        setOtherTheme('')
        setDuration(15)
        setParticipants('')
        fetchSessions()
      })
      .catch((error) => {
        console.error('Failed to create awareness session', error)
        const message = error.response?.data?.message ?? t('errors.somethingWentWrong') ?? 'Failed to save session'
        toast.error(message)
      })
  }

  const handleDeleteSession = (session) => {
    setConfirmDeleteSession(session)
  }

  const confirmDelete = async () => {
    if (!confirmDeleteSession?.id) return
    try {
      await awarenessService.delete(confirmDeleteSession.id)
      toast.success(t('common.saved') ?? 'Saved')
      fetchSessions()
    } catch (error) {
      console.error('Failed to delete awareness session', error)
      toast.error(t('errors.failedToDelete') ?? t('common.error') ?? 'Error')
    } finally {
      setConfirmDeleteSession(null)
    }
  }

  return (
    <div className="max-w-5xl mx-auto space-y-6 animate-fade-in">
      <div>
        <div className="text-xs text-gray-500 dark:text-gray-400 mb-1">
          {t('nav.dashboard')} / {t('awareness.navLabel')}
        </div>

      {bulkModalOpen && (
        <Modal isOpen={bulkModalOpen} onClose={() => setBulkModalOpen(false)} title="Massive Add" size="xl">
          <div className="space-y-4">
            <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
              <button type="button" onClick={handleDownloadTemplate} className="btn-secondary flex items-center justify-center gap-2">
                <FileSpreadsheet className="w-4 h-4" />
                <span>{t('common.downloadTemplate') ?? 'Download template'}</span>
              </button>

              <label className="flex items-center justify-between border-2 border-dashed border-gray-300 dark:border-gray-600 rounded-lg px-3 py-2 text-xs cursor-pointer hover:border-hse-primary hover:bg-hse-primary/5">
                <div className="flex items-center gap-2">
                  <Upload className="w-4 h-4 text-gray-500" />
                  <span className="text-gray-700 dark:text-gray-200">
                    {bulkFile ? bulkFile.name : (t('common.chooseFile') ?? 'Choose Excel file')}
                  </span>
                </div>
                <input
                  type="file"
                  accept=".xlsx,.xls"
                  className="hidden"
                  onChange={(e) => setBulkFile(e.target.files?.[0] ?? null)}
                />
              </label>

              <button type="button" onClick={handleBulkImport} disabled={bulkUploading || !bulkFile} className="btn-primary">
                {bulkUploading ? (t('common.loading') ?? 'Importing...') : (t('common.import') ?? 'Import')}
              </button>
            </div>
          </div>
        </Modal>
      )}
        <h1 className="text-2xl font-bold text-gray-900 dark:text-gray-100">{t('awareness.pageTitle')}</h1>
        <p className="text-gray-500 dark:text-gray-400 mt-1">{t('awareness.pageSubtitle')}</p>
      </div>

      {/* Collapsible Form */}
      <div className="card">
        <button
          type="button"
          onClick={(e) => {
            if (e?.ctrlKey) {
              openBulkImport()
              return
            }
            setFormExpanded(!formExpanded)
          }}
          className="w-full p-4 flex items-center justify-between text-left hover:bg-gray-50 dark:hover:bg-gray-800 transition-colors rounded-xl"
        >
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 bg-hse-primary/10 rounded-lg flex items-center justify-center">
              <Plus className="w-5 h-5 text-hse-primary" />
            </div>
            <div>
              <h3 className="font-semibold text-gray-900 dark:text-gray-100">{t('awareness.addSession')}</h3>
              <p className="text-sm text-gray-500 dark:text-gray-400">{t('awareness.clickToExpand')}</p>
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
              <label className="label">{t('awareness.project')}</label>
              <Select
                value={projectId}
                onChange={(e) => setProjectId(e.target.value)}
                disabled={loadingProjects || projects.length === 1}
                required
              >
                <option value="">
                  {loadingProjects ? t('common.loading') : t('awareness.selectProject')}
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
              <label className="label">{t('awareness.date')}</label>
              <DatePicker value={date} onChange={setDate} required />
            </div>

            {/* By */}
            <div>
              <label className="label">{t('awareness.by')}</label>
              <input
                type="text"
                className="input bg-gray-50 dark:bg-gray-800"
                value={byName}
                readOnly
              />
            </div>

            {/* Theme with search */}
            <div className="space-y-2">
              <label className="label">{t('awareness.theme')}</label>
              <div className="relative">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
                <input
                  type="text"
                  className="input pl-9"
                  placeholder={t('awareness.searchTheme')}
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
                {filteredThemes.map((theme, idx) => (
                  <button
                    key={idx}
                    type="button"
                    onClick={() => setSelectedTheme(theme)}
                    className={`w-full text-left px-3 py-2.5 text-sm flex items-center justify-between gap-2 transition-colors ${
                      selectedTheme === theme
                        ? 'bg-hse-primary/10 text-hse-primary font-medium border-l-4 border-hse-primary'
                        : 'text-gray-700 dark:text-gray-200 hover:bg-gray-50 dark:hover:bg-gray-700/50 border-l-4 border-transparent'
                    }`}
                  >
                    <span>{theme}</span>
                    {selectedTheme === theme && (
                      <Check className="w-4 h-4 text-hse-primary flex-shrink-0" />
                    )}
                  </button>
                ))}
                {/* Other option */}
                <button
                  type="button"
                  onClick={() => setSelectedTheme('Other')}
                  className={`w-full text-left px-3 py-2.5 text-sm flex items-center justify-between gap-2 transition-colors ${
                    selectedTheme === 'Other'
                      ? 'bg-hse-primary/10 text-hse-primary font-medium border-l-4 border-hse-primary'
                      : 'text-gray-700 dark:text-gray-200 hover:bg-gray-50 dark:hover:bg-gray-700/50 border-l-4 border-transparent'
                  }`}
                >
                  <span className="font-medium">{t('awareness.other')}</span>
                  {selectedTheme === 'Other' && (
                    <Check className="w-4 h-4 text-hse-primary flex-shrink-0" />
                  )}
                </button>
              </div>
              {selectedTheme === 'Other' && (
                <div className="pt-2">
                  <label className="label text-sm">{t('awareness.otherTheme')}</label>
                  <input
                    type="text"
                    placeholder={t('awareness.otherTheme')}
                    className="input"
                    value={otherTheme}
                    onChange={(e) => setOtherTheme(e.target.value)}
                    required
                  />
                </div>
              )}
            </div>

            {/* Duration Slider */}
            <div>
              <label className="label">{t('awareness.duration')}</label>
              <div className="space-y-3">
                <input
                  type="range"
                  min="15"
                  max="60"
                  step="15"
                  value={duration}
                  onChange={(e) => setDuration(parseInt(e.target.value, 10))}
                  className="w-full h-2 bg-gray-200 dark:bg-gray-700 rounded-lg appearance-none cursor-pointer accent-hse-primary"
                />
                <div className="flex justify-between text-xs text-gray-500 dark:text-gray-400">
                  {DURATION_OPTIONS.map((opt) => (
                    <span
                      key={opt}
                      className={`${duration === opt ? 'text-hse-primary font-semibold' : ''}`}
                    >
                      {opt} min
                    </span>
                  ))}
                </div>
                <div className="text-center">
                  <span className="inline-block px-4 py-1 bg-hse-primary/10 text-hse-primary rounded-full text-sm font-medium">
                    {duration} {t('awareness.minutes')}
                  </span>
                </div>
              </div>
            </div>

            {/* Participants & Session Hours */}
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div>
                <label className="label">{t('awareness.participants')}</label>
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
                <label className="label">{t('awareness.sessionHours')}</label>
                <div className="input bg-gray-50 dark:bg-gray-800 flex items-center justify-between">
                  <span className="font-semibold text-hse-primary">
                    {Number.isFinite(sessionHours) ? sessionHours.toFixed(2) : 0}
                  </span>
                  <span className="text-xs text-gray-400 ml-2">{t('awareness.hoursUnit')}</span>
                </div>
              </div>
            </div>

            {/* Actions */}
            <div className="flex justify-end gap-3 pt-4 border-t border-gray-200 dark:border-gray-700">
              <button
                type="submit"
                className="btn-primary"
                disabled={!projectId || !date || !participantsNumber || !selectedTheme || (selectedTheme === 'Other' && !otherTheme)}
              >
                {t('awareness.submit')}
              </button>
            </div>
          </form>
        )}
      </div>

      {/* Sessions list */}
      <div className="card p-6 space-y-4">
        <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-4">
          <h2 className="text-lg font-semibold text-gray-900 dark:text-gray-100 flex items-center gap-2">
            <Filter className="w-4 h-4 text-hse-primary" />
            {t('awareness.listTitle')}
          </h2>
          <div className="flex flex-wrap md:flex-nowrap items-center gap-3">
            <Select
              value={filterProjectId}
              onChange={(e) => setFilterProjectId(e.target.value)}
              className="h-10 text-sm min-w-[140px]"
            >
              <option value="">{t('awareness.allProjects')}</option>
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
              <option value="">{t('awareness.allWeeks')}</option>
              {Array.from({ length: 52 }, (_, i) => i + 1).map((w) => (
                <option key={w} value={w}>
                  {t('awareness.weekLabel').replace('{{week}}', w)}
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
              onClick={handleExportAwareness}
              disabled={exporting || sessions.length === 0}
              className="btn-secondary flex items-center gap-2 text-sm"
            >
              <FileSpreadsheet className="w-4 h-4" />
              <span>{t('dashboard.exportExcel')}</span>
            </button>
          </div>
        </div>

        {loadingSessions ? (
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
        ) : sessions.length === 0 ? (
          <div className="py-12 text-center">
            <div className="inline-flex items-center justify-center w-12 h-12 rounded-full bg-hse-primary/10 mb-3">
              <Filter className="w-5 h-5 text-hse-primary" />
            </div>
            <p className="text-sm font-medium text-gray-900 dark:text-gray-100">
              {t('awareness.noSessions')}
            </p>
          </div>
        ) : (
          <>
            {/* Mobile cards */}
            <div className="space-y-3 md:hidden">
              {paginatedSessions.map((s) => (
                <div
                  key={s.id}
                  className="border border-gray-200 dark:border-gray-700 rounded-lg p-3 bg-white dark:bg-gray-800"
                >
                  <div className="flex items-start justify-between gap-3">
                    <div>
                      <p className="font-medium text-gray-900 dark:text-gray-100">
                        {s.project?.name ?? ''}
                      </p>
                      <p className="text-xs text-gray-500 dark:text-gray-400 mt-1">
                        {s.date ? s.date.substring(0, 10) : ''}
                      </p>
                      <p className="mt-1 text-xs text-gray-600 dark:text-gray-300">
                        {s.by_name ?? ''}
                      </p>
                    </div>

                    <div className="text-right text-xs text-gray-600 dark:text-gray-300 space-y-1">
                      <p className="font-medium truncate max-w-[140px]">
                        {s.theme}
                      </p>
                      <p>
                        {s.duration_minutes} min
                      </p>
                      <div className="flex justify-end">
                        <button
                          type="button"
                          onClick={() => handleDeleteSession(s)}
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
                      {t('awareness.participants')}: {s.participants}
                    </span>
                    <span className="px-1.5 py-0.5 rounded-full bg-hse-primary/10 text-hse-primary">
                      {t('awareness.sessionHours')}: {s.session_hours}
                    </span>
                  </div>
                </div>
              ))}
            </div>

            {/* Desktop table */}
            <div className="hidden md:block overflow-x-auto">
              <table className="min-w-full text-sm">
                <thead>
                  <tr className="border-b border-gray-200 dark:border-gray-700 text-left">
                    <th className="py-2 pr-4 font-medium text-gray-500 dark:text-gray-400">{t('awareness.colDate')}</th>
                    <th className="py-2 pr-4 font-medium text-gray-500 dark:text-gray-400">{t('awareness.colProject')}</th>
                    <th className="py-2 pr-4 font-medium text-gray-500 dark:text-gray-400">{t('awareness.colBy')}</th>
                    <th className="py-2 pr-4 font-medium text-gray-500 dark:text-gray-400">{t('awareness.colTheme')}</th>
                    <th className="py-2 pr-4 font-medium text-gray-500 dark:text-gray-400">{t('awareness.colDuration')}</th>
                    <th className="py-2 pr-4 font-medium text-gray-500 dark:text-gray-400">{t('awareness.colParticipants')}</th>
                    <th className="py-2 pr-4 font-medium text-gray-500 dark:text-gray-400">{t('awareness.colHours')}</th>
                    <th className="py-2 pr-4 font-medium text-gray-500 dark:text-gray-400">{t('common.actions') ?? 'Actions'}</th>
                  </tr>
                </thead>
                <tbody>
                  {paginatedSessions.map((s) => (
                    <tr key={s.id} className="border-b border-gray-100 dark:border-gray-800">
                      <td className="py-2 pr-4 text-gray-900 dark:text-gray-100 text-xs">
                        {s.date ? s.date.substring(0, 10) : ''}
                      </td>
                      <td className="py-2 pr-4 text-gray-900 dark:text-gray-100">
                        {s.project?.name ?? ''}
                      </td>
                      <td className="py-2 pr-4 text-gray-700 dark:text-gray-200">
                        {s.by_name ?? ''}
                      </td>
                      <td className="py-2 pr-4 text-gray-700 dark:text-gray-200 max-w-xs truncate">
                        {s.theme}
                      </td>
                      <td className="py-2 pr-4 text-gray-700 dark:text-gray-200">
                        {s.duration_minutes} min
                      </td>
                      <td className="py-2 pr-4 text-gray-700 dark:text-gray-200">
                        {s.participants}
                      </td>
                      <td className="py-2 pr-4 text-gray-700 dark:text-gray-200">
                        {s.session_hours}
                      </td>
                      <td className="py-2 pr-4 text-gray-700 dark:text-gray-200">
                        <button
                          type="button"
                          onClick={() => handleDeleteSession(s)}
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

        {!loadingSessions && sessions.length > 0 && totalPages > 1 && (
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
                {t('common.previous') ?? 'Previous'}
              </button>
              <button
                type="button"
                onClick={() => setCurrentPage((p) => Math.min(totalPages, p + 1))}
                disabled={currentPage === totalPages}
                className="btn-secondary text-sm disabled:opacity-50 disabled:cursor-not-allowed"
              >
                {t('common.next') ?? 'Next'}
              </button>
            </div>
          </div>
        )}
      </div>

      <ConfirmDialog
        isOpen={!!confirmDeleteSession}
        title={t('common.delete') ?? 'Delete'}
        message={t('common.confirmDelete') ?? 'Are you sure you want to delete this record?'}
        confirmLabel={t('common.delete') ?? 'Delete'}
        cancelLabel={t('common.cancel') ?? 'Cancel'}
        onConfirm={confirmDelete}
        onCancel={() => setConfirmDeleteSession(null)}
      />
    </div>
  )
}
