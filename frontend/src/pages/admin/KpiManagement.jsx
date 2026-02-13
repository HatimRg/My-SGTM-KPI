import { useState, useEffect, useMemo } from 'react'
import { useLocation } from 'react-router-dom'
import { 
  ClipboardList, 
  Check, 
  X, 
  Eye,
  Search,
  Filter,
  Calendar,
  Building2,
  User,
  Clock,
  AlertTriangle,
  CheckCircle,
  XCircle,
  Loader2,
  Download,
  FileSpreadsheet,
  Trash2
} from 'lucide-react'
import { kpiService, projectService, exportService } from '../../services/api'
import { useLanguage } from '../../i18n'
import { useAuthStore } from '../../store/authStore'
import { Modal, ConfirmDialog } from '../../components/ui'
import WeekPicker from '../../components/ui/WeekPicker'
import YearPicker from '../../components/ui/YearPicker'
import DailyKpiPreview from '../../components/kpi/DailyKpiPreview'
import toast from 'react-hot-toast'
import { getCurrentWeek } from '../../utils/weekHelper'
import { getProjectLabel, sortProjects } from '../../utils/projectList'

export default function KpiManagement() {
  const { t, language } = useLanguage()
  const { user } = useAuthStore()
  const location = useLocation()

  const pad2 = (n) => String(Math.max(0, Math.trunc(Number(n) || 0))).padStart(2, '0')
  const toWeekKey = (year, week) => {
    const y = String(year ?? '').trim()
    const w = String(week ?? '').trim()
    if (!y || !w) return ''
    return `${y}-W${pad2(w)}`
  }
  const parseWeekKey = (value) => {
    const raw = String(value ?? '').trim()
    const m = raw.match(/^(\d{4})-W(\d{2})$/)
    if (!m) return null
    const weekYear = m[1]
    const week = String(Number(m[2]))
    return { weekYear, week }
  }
  const [reports, setReports] = useState([])
  const [projects, setProjects] = useState([])
  const [loading, setLoading] = useState(true)
  const [selectedReport, setSelectedReport] = useState(null)
  const [dailySnapshots, setDailySnapshots] = useState([])
  const [loadingDetails, setLoadingDetails] = useState(false)
  const [showRejectModal, setShowRejectModal] = useState(false)
  const [rejectReason, setRejectReason] = useState('')
  const [actionLoading, setActionLoading] = useState(null)
  const [confirmDeleteReport, setConfirmDeleteReport] = useState(null)
  
  // Export modal state
  const [showExportModal, setShowExportModal] = useState(false)
  const [exportLoading, setExportLoading] = useState(false)
  const [exportParams, setExportParams] = useState({
    project_id: '',
    week: getCurrentWeek().week,
    year: getCurrentWeek().year,
  })
  
  const [filters, setFilters] = useState({
    status: '',
    project_id: '',
    pole: '',
    search: '',
    week: '',
    year: '',
  })

  const [poles, setPoles] = useState([])

  const [searchInput, setSearchInput] = useState('')

  const projectListPreference = user?.project_list_preference ?? 'code'
  const sortedProjects = useMemo(() => {
    return sortProjects(projects, projectListPreference)
  }, [projects, projectListPreference])

  const locale = language === 'fr' ? 'fr-FR' : 'en-US'
  const formatDate = (value) => {
    if (!value) return t('common.unknown')
    return new Date(value).toLocaleDateString(locale)
  }

  const canDeleteReport = (report) => {
    if (!report) return false
    if (!isApproverAdminLike) return false
    return report.status !== 'draft'
  }

  const requestDeleteReport = (report) => {
    if (!canDeleteReport(report)) return
    setConfirmDeleteReport(report)
  }

  const confirmDelete = async () => {
    if (!confirmDeleteReport?.id) return
    try {
      setActionLoading(confirmDeleteReport.id)
      await kpiService.delete(confirmDeleteReport.id)
      toast.success(t('kpi.historyPage.deleteSuccess'))
      setConfirmDeleteReport(null)
      loadData()
    } catch (error) {
      toast.error(error.response?.data?.message ?? t('errors.failedToDelete'))
    } finally {
      setActionLoading(null)
    }
  }

  const effectiveRole = user?.role
  const isHseManager = effectiveRole === 'hse_manager' || effectiveRole === 'regional_hse_manager'
  const isApproverAdminLike =
    effectiveRole === 'admin' ||
    effectiveRole === 'consultation' ||
    effectiveRole === 'dev' ||
    effectiveRole === 'pole_director' ||
    effectiveRole === 'works_director' ||
    effectiveRole === 'hse_director' ||
    effectiveRole === 'hr_director'

  const canApproveReport = (report) => {
    if (!report) return false
    if (report.status !== 'submitted') return false
    if (isApproverAdminLike) return true
    if (isHseManager && report?.submitter?.role === 'responsable') return true
    return false
  }

  const visibleReports = reports.filter((report) => report.status !== 'draft')

  // Initialize filters from URL params (week/year) on first mount
  useEffect(() => {
    const params = new URLSearchParams(location.search)
    const week = params.get('week') ?? ''
    const year = params.get('year') ?? ''
    if (week || year) {
      setFilters((prev) => ({
        ...prev,
        week: week || prev.week,
        year: year || prev.year,
      }))
    }
  }, [location.search])

  useEffect(() => {
    const timeoutId = setTimeout(() => {
      setFilters((prev) => (prev.search === searchInput ? prev : { ...prev, search: searchInput }))
    }, 300)
    return () => clearTimeout(timeoutId)
  }, [searchInput])

  useEffect(() => {
    loadData()
  }, [filters])

  useEffect(() => {
    const fetchPoles = async () => {
      try {
        const res = await projectService.getPoles()
        const values = res.data?.data?.poles ?? res.data?.poles ?? []
        setPoles(Array.isArray(values) ? values : [])
      } catch (e) {
        setPoles([])
      }
    }
    fetchPoles()
  }, [])

  const loadData = async () => {
    try {
      setLoading(true)
      const [reportsRes, projectsRes] = await Promise.all([
        kpiService.getAll(filters),
        projectService.getAllList({ status: 'active' })
      ])
      const reportsData = reportsRes.data.data || reportsRes.data || []
      setReports(Array.isArray(reportsData) ? reportsData : [])
      setProjects(Array.isArray(projectsRes) ? projectsRes : [])
    } catch (error) {
      console.error('Error loading KPI data:', error)
      toast.error(t('errors.somethingWentWrong'))
    } finally {
      setLoading(false)
    }
  }

  const handleApprove = async (id) => {
    try {
      setActionLoading(id)
      await kpiService.approve(id)
      toast.success(t('kpi.reportApproved'))
      loadData()
    } catch (error) {
      console.error('Error approving report:', error)
      toast.error(t('errors.somethingWentWrong'))
    } finally {
      setActionLoading(null)
    }
  }

  const handleReject = async () => {
    if (!selectedReport || !rejectReason.trim()) {
      toast.error(t('kpi.management.rejectReasonRequired'))
      return
    }
    
    try {
      setActionLoading(selectedReport.id)
      await kpiService.reject(selectedReport.id, rejectReason)
      toast.success(t('kpi.reportRejected'))
      setShowRejectModal(false)
      setRejectReason('')
      setSelectedReport(null)
      loadData()
    } catch (error) {
      console.error('Error rejecting report:', error)
      toast.error(t('errors.somethingWentWrong'))
    } finally {
      setActionLoading(null)
    }
  }

  const handleViewReport = async (report) => {
    setLoadingDetails(true)
    setSelectedReport(report)
    setDailySnapshots([])
    
    try {
      const response = await kpiService.getById(report.id)
      const data = response.data.data
      setSelectedReport(data.report ?? data)
      setDailySnapshots(data.daily_snapshots ?? [])
    } catch (error) {
      console.error('Failed to load report details:', error)
      toast.error(t('kpi.management.loadDetailsFailed') ?? t('errors.failedToLoad'))
    } finally {
      setLoadingDetails(false)
    }
  }

  const openRejectModal = (report) => {
    setSelectedReport(report)
    setShowRejectModal(true)
  }

  // HSE Weekly Export handler
  const handleExportHseWeekly = async () => {
    if (!exportParams.project_id) {
      toast.error(t('hseExport.noProject'))
      return
    }
    if (!exportParams.week || !exportParams.year) {
      toast.error(t('hseExport.noWeek'))
      return
    }

    try {
      setExportLoading(true)
      const response = await exportService.exportHseWeekly({
        project_id: exportParams.project_id,
        week: exportParams.week,
        year: exportParams.year
      })
      
      // Create download link
      const url = window.URL.createObjectURL(new Blob([response.data]))
      const link = document.createElement('a')
      link.href = url
      const project = projects.find(p => p.id == exportParams.project_id)
      const filename = `HSE_Report_${project?.code || 'project'}_S${String(exportParams.week).padStart(2, '0')}_${exportParams.year}.xlsx`
      link.setAttribute('download', filename)
      document.body.appendChild(link)
      link.click()
      link.remove()
      window.URL.revokeObjectURL(url)
      
      toast.success(t('hseExport.success'))
      setShowExportModal(false)
    } catch (error) {
      console.error('Export error:', error)
      toast.error(error.response?.data?.message || t('hseExport.error'))
    } finally {
      setExportLoading(false)
    }
  }

  // Generate week options (1-52)
  const weekOptions = Array.from({ length: 52 }, (_, i) => i + 1)
  
  // Generate year options (current year -2 to +1)
  const currentYear = getCurrentWeek().year
  const yearOptions = [currentYear - 2, currentYear - 1, currentYear, currentYear + 1]

  const getStatusBadge = (status) => {
    const styles = {
      draft: 'bg-gray-100 text-gray-700 dark:bg-gray-800 dark:text-gray-200',
      submitted: 'bg-amber-100 text-amber-700 dark:bg-amber-900/40 dark:text-amber-200',
      approved: 'bg-green-100 text-green-700 dark:bg-green-900/40 dark:text-green-200',
      rejected: 'bg-red-100 text-red-700 dark:bg-red-900/40 dark:text-red-200'
    }
    const icons = {
      draft: Clock,
      submitted: AlertTriangle,
      approved: CheckCircle,
      rejected: XCircle
    }
    const Icon = icons[status] || Clock
    
    return (
      <span className={`inline-flex items-center gap-1 px-2 py-1 rounded-full text-xs font-medium ${styles[status] || styles.draft}`}>
        <Icon className="w-3 h-3" />
        {t(`kpi.status.${status}`)}
      </span>
    )
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-gray-900 dark:text-gray-100 flex items-center gap-2">
            <ClipboardList className="w-7 h-7 text-hse-primary" />
            {t('kpi.management.title')}
          </h1>
          <p className="text-gray-500 dark:text-gray-400 mt-1">{t('kpi.management.subtitle')}</p>
        </div>
        <button
          onClick={() => setShowExportModal(true)}
          className="btn-primary flex items-center gap-2"
        >
          <FileSpreadsheet className="w-4 h-4" />
          {t('hseExport.exportButton')}
        </button>
      </div>

      {/* Filters */}
      <div className="bg-white dark:bg-gray-800 rounded-xl shadow-sm border border-gray-200 dark:border-gray-700 p-4">
        <div className="grid grid-cols-1 md:grid-cols-7 gap-4">
          {/* Search */}
          <div className="relative">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
            <input
              type="text"
              placeholder={t('kpi.management.searchPlaceholder')}
              value={searchInput}
              onChange={(e) => setSearchInput(e.target.value)}
              className="input pl-10"
            />
          </div>

          {/* Week Filter */}
          <div className="flex gap-2">
            <div className="flex-1">
              <WeekPicker
                value={filters.week && filters.year ? toWeekKey(filters.year, filters.week) : ''}
                onChange={(key) => {
                  const parsed = parseWeekKey(key)
                  if (!parsed) return
                  setFilters((prev) => ({ ...prev, year: parsed.weekYear, week: parsed.week }))
                }}
                placeholder={t('common.all')}
                className="w-full"
              />
            </div>
            <button
              type="button"
              className="btn-secondary"
              onClick={() => setFilters((prev) => ({ ...prev, week: '', year: '' }))}
              title={t('common.all')}
            >
              <X className="w-4 h-4" />
            </button>
          </div>

          {/* Year Filter */}
          <div className="flex gap-2">
            <div className="flex-1">
              <YearPicker
                value={filters.year}
                onChange={(y) => setFilters((prev) => ({ ...prev, year: String(y ?? '') }))}
                placeholder={t('common.all')}
                className="w-full"
              />
            </div>
            <button
              type="button"
              className="btn-secondary"
              onClick={() => setFilters((prev) => ({ ...prev, year: '' }))}
              disabled={!filters.year}
              aria-label={t('common.all')}
              title={t('common.all')}
            >
              <X className="w-4 h-4" />
            </button>
          </div>

          {/* Status Filter */}
          <select
            value={filters.status}
            onChange={(e) => setFilters({ ...filters, status: e.target.value })}
            className="input"
          >
            <option value="">{t('kpi.management.allStatuses')}</option>
            <option value="submitted">{t('kpi.management.statusSubmitted')}</option>
            <option value="approved">{t('kpi.status.approved')}</option>
            <option value="rejected">{t('kpi.status.rejected')}</option>
          </select>

          <select
            value={filters.pole}
            onChange={(e) => setFilters({ ...filters, pole: e.target.value, project_id: '' })}
            className="input"
          >
            <option value="">{t('common.allPoles')}</option>
            {poles.map((p) => (
              <option key={p} value={p}>
                {p}
              </option>
            ))}
          </select>

          {/* Project Filter */}
          <select
            value={filters.project_id}
            onChange={(e) => setFilters({ ...filters, project_id: e.target.value })}
            className="input"
          >
            <option value="">{t('common.allProjects')}</option>
            {(filters.pole ? sortedProjects.filter((p) => p?.pole === filters.pole) : sortedProjects).map((project) => (
              <option key={project.id} value={project.id}>
                {getProjectLabel(project)}
              </option>
            ))}
          </select>

          {/* Refresh Button */}
          <button
            onClick={loadData}
            className="btn-secondary flex items-center justify-center gap-2"
          >
            <Filter className="w-4 h-4" />
            {t('common.refresh')}
          </button>
        </div>
      </div>

      {/* Reports Table */}
      <div className="bg-white dark:bg-gray-800 rounded-xl shadow-sm border border-gray-200 dark:border-gray-700 overflow-hidden">
        {loading ? (
          <div className="p-4 space-y-3">
            <div className="hidden md:block space-y-2 animate-pulse">
              {Array.from({ length: 5 }, (_, i) => (
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
        ) : visibleReports.length === 0 ? (
          <div className="text-center py-12">
            <ClipboardList className="w-12 h-12 text-gray-300 dark:text-gray-600 mx-auto mb-3" />
            <p className="text-gray-500 dark:text-gray-400">{t('kpi.noReports')}</p>
          </div>
        ) : (
          <>
            <div className="space-y-3 px-4 py-4 md:hidden">
              {visibleReports.map((report) => (
                <div
                  key={report.id}
                  className="border border-gray-200 dark:border-gray-700 rounded-lg p-3 bg-white dark:bg-gray-800"
                >
                  <div className="flex items-start justify-between gap-3">
                    <div>
                      <p className="font-medium text-gray-900 dark:text-gray-100">
                        {report.project?.name || t('common.unknown')}
                      </p>
                      <p className="text-xs text-gray-500 dark:text-gray-400">
                        {report.submitter?.name || t('common.unknown')}
                      </p>
                      <p className="mt-1 text-xs text-gray-600 dark:text-gray-300 flex items-center gap-1">
                        <Calendar className="w-3 h-3 text-gray-400" />
                        <span>
                          {report.week_number
                            ? t('dashboard.weekLabel', { week: report.week_number, year: report.report_year })
                            : `${report.report_month}/${report.report_year}`}
                        </span>
                      </p>
                      <p className="text-xs text-gray-500 dark:text-gray-400">
                        {formatDate(report.created_at)}
                      </p>
                    </div>
                    <div className="text-right">
                      {getStatusBadge(report.status)}
                    </div>
                  </div>

                  <div className="mt-3 flex items-center justify-end gap-2">
                    {canApproveReport(report) && (
                      <>
                        <button
                          onClick={() => handleApprove(report.id)}
                          disabled={actionLoading === report.id}
                          className="px-2 py-1 text-xs rounded-md bg-green-50 dark:bg-green-900/30 text-green-700 dark:text-green-300"
                        >
                          {actionLoading === report.id ? (
                            <Loader2 className="w-4 h-4 animate-spin" />
                          ) : (
                            <span>{t('kpi.approve')}</span>
                          )}
                        </button>
                        <button
                          onClick={() => openRejectModal(report)}
                          disabled={actionLoading === report.id}
                          className="px-2 py-1 text-xs rounded-md bg-red-50 dark:bg-red-900/30 text-red-700 dark:text-red-300"
                        >
                          {t('kpi.reject')}
                        </button>
                      </>
                    )}
                    <button
                      onClick={() => handleViewReport(report)}
                      className="px-2 py-1 text-xs rounded-md bg-gray-50 dark:bg-gray-900 text-gray-700 dark:text-gray-200 flex items-center gap-1"
                    >
                      <Eye className="w-4 h-4" />
                      <span>{t('common.view')}</span>
                    </button>
                    {canDeleteReport(report) && (
                      <button
                        onClick={() => requestDeleteReport(report)}
                        disabled={actionLoading === report.id}
                        className="px-2 py-1 text-xs rounded-md bg-red-50 dark:bg-red-900/30 text-red-700 dark:text-red-300 flex items-center gap-1"
                      >
                        <Trash2 className="w-4 h-4" />
                        <span>{t('common.delete')}</span>
                      </button>
                    )}
                  </div>
                </div>
              ))}
            </div>

            <div className="hidden md:block overflow-x-auto">
              <table className="w-full">
                <thead className="bg-gray-50 dark:bg-gray-800 border-b border-gray-200 dark:border-gray-700">
                  <tr>
                    <th className="text-left px-4 py-3 text-xs font-medium text-gray-500 dark:text-gray-400 uppercase">{t('common.project')}</th>
                    <th className="text-left px-4 py-3 text-xs font-medium text-gray-500 dark:text-gray-400 uppercase">{t('kpi.management.submittedBy')}</th>
                    <th className="text-left px-4 py-3 text-xs font-medium text-gray-500 dark:text-gray-400 uppercase">{t('kpi.management.period')}</th>
                    <th className="text-left px-4 py-3 text-xs font-medium text-gray-500 dark:text-gray-400 uppercase">{t('kpi.management.date')}</th>
                    <th className="text-left px-4 py-3 text-xs font-medium text-gray-500 dark:text-gray-400 uppercase">{t('common.status')}</th>
                    <th className="text-right px-4 py-3 text-xs font-medium text-gray-500 dark:text-gray-400 uppercase">{t('common.actions')}</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-200 dark:divide-gray-700">
                  {visibleReports.map((report) => (
                    <tr key={report.id} className="hover:bg-gray-50 dark:hover:bg-gray-700/50">
                      <td className="px-4 py-4">
                        <div className="flex items-center gap-2">
                          <Building2 className="w-4 h-4 text-gray-400" />
                          <span className="font-medium text-gray-900 dark:text-gray-100">
                            {report.project?.name || t('common.unknown')}
                          </span>
                        </div>
                      </td>
                      <td className="px-4 py-4">
                        <div className="flex items-center gap-2">
                          <User className="w-4 h-4 text-gray-400" />
                          <span className="text-gray-600 dark:text-gray-300">
                            {report.submitter?.name || t('common.unknown')}
                          </span>
                        </div>
                      </td>
                      <td className="px-4 py-4">
                        <div className="flex items-center gap-2">
                          <Calendar className="w-4 h-4 text-gray-400" />
                          <span className="text-gray-600">
                            {report.week_number 
                              ? t('dashboard.weekLabel', { week: report.week_number, year: report.report_year })
                              : `${report.report_month}/${report.report_year}`
                            }
                          </span>
                        </div>
                      </td>
                      <td className="px-4 py-4 text-gray-500 dark:text-gray-400 text-sm">
                        {formatDate(report.created_at)}
                      </td>
                      <td className="px-4 py-4">
                        {getStatusBadge(report.status)}
                      </td>
                      <td className="px-4 py-4">
                        <div className="flex items-center justify-end gap-2">
                          {canApproveReport(report) && (
                            <>
                              <button
                                onClick={() => handleApprove(report.id)}
                                disabled={actionLoading === report.id}
                                className="p-2 text-green-600 dark:text-green-400 hover:bg-green-50 dark:hover:bg-green-900/30 rounded-lg transition-colors"
                                title={t('kpi.approve')}
                              >
                                {actionLoading === report.id ? (
                                  <Loader2 className="w-5 h-5 animate-spin" />
                                ) : (
                                  <Check className="w-5 h-5" />
                                )}
                              </button>
                              <button
                                onClick={() => openRejectModal(report)}
                                disabled={actionLoading === report.id}
                                className="p-2 text-red-600 dark:text-red-400 hover:bg-red-50 dark:hover:bg-red-900/30 rounded-lg transition-colors"
                                title={t('kpi.reject')}
                              >
                                <X className="w-5 h-5" />
                              </button>
                            </>
                          )}
                          <button
                            onClick={() => handleViewReport(report)}
                            className="p-2 text-gray-600 hover:bg-gray-100 rounded-lg transition-colors"
                            title={t('kpi.management.viewDetails')}
                          >
                            <Eye className="w-5 h-5" />
                          </button>
                          {canDeleteReport(report) && (
                            <button
                              onClick={() => requestDeleteReport(report)}
                              disabled={actionLoading === report.id}
                              className="p-2 text-red-600 dark:text-red-400 hover:bg-red-50 dark:hover:bg-red-900/30 rounded-lg transition-colors"
                              title={t('common.delete')}
                            >
                              {actionLoading === report.id ? <Loader2 className="w-5 h-5 animate-spin" /> : <Trash2 className="w-5 h-5" />}
                            </button>
                          )}
                        </div>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </>
        )}
      </div>

      <ConfirmDialog
        isOpen={!!confirmDeleteReport}
        title={t('common.delete')}
        message={t('kpi.confirmDelete')}
        confirmLabel={t('common.delete')}
        cancelLabel={t('common.cancel')}
        variant="danger"
        onConfirm={confirmDelete}
        onCancel={() => setConfirmDeleteReport(null)}
      />

      {/* Reject Modal */}
      <Modal
        isOpen={showRejectModal}
        onClose={() => { setShowRejectModal(false); setRejectReason(''); setSelectedReport(null) }}
        title={t('kpi.management.rejectTitle')}
        size="sm"
      >
        <div className="space-y-4">
          <p className="text-gray-600 dark:text-gray-300 text-sm">
            {t('common.project')}: <strong>{selectedReport?.project?.name}</strong><br />
            {t('kpi.management.period')}: <strong>
              {selectedReport?.week_number 
                ? t('dashboard.weekLabel', { week: selectedReport.week_number, year: selectedReport.report_year })
                : `${selectedReport?.report_month}/${selectedReport?.report_year}`
              }
            </strong>
          </p>
          <div className="bg-amber-50 dark:bg-amber-900/30 border border-amber-200 dark:border-amber-700 rounded-lg p-3">
            <p className="text-amber-800 dark:text-amber-300 text-sm">
              {t('kpi.management.rejectWarningBefore')}{' '}<strong>{t('kpi.status.draft')}</strong>{' '}{t('kpi.management.rejectWarningAfter')}
            </p>
          </div>
          <div>
            <label className="label">{t('kpi.rejectionReason')} *</label>
            <textarea
              value={rejectReason}
              onChange={(e) => setRejectReason(e.target.value)}
              className="input"
              rows={3}
              placeholder={t('kpi.management.rejectReasonPlaceholder')}
            />
          </div>
          <div className="flex flex-col-reverse sm:flex-row gap-3 justify-end pt-2">
            <button
              onClick={() => { setShowRejectModal(false); setRejectReason(''); setSelectedReport(null) }}
              className="btn-secondary w-full sm:w-auto"
            >
              {t('common.cancel')}
            </button>
            <button
              onClick={handleReject}
              disabled={actionLoading}
              className="btn-primary bg-red-600 hover:bg-red-700 w-full sm:w-auto"
            >
              {actionLoading ? (
                <Loader2 className="w-4 h-4 animate-spin mx-auto" />
              ) : (
                t('kpi.reject')
              )}
            </button>
          </div>
        </div>
      </Modal>

      {/* View Report Modal */}
      <Modal
        isOpen={!!selectedReport && !showRejectModal}
        onClose={() => { setSelectedReport(null); setDailySnapshots([]); }}
        title={t('kpi.management.detailsTitle')}
        size="lg"
      >
        {selectedReport && (
            <div className="space-y-4">
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <p className="text-sm text-gray-500 dark:text-gray-400">{t('common.project')}</p>
                  <p className="font-medium dark:text-gray-100">{selectedReport.project?.name ?? ''}</p>
                </div>
                <div>
                  <p className="text-sm text-gray-500 dark:text-gray-400">{t('kpi.management.submittedBy')}</p>
                  <p className="font-medium dark:text-gray-100">{selectedReport.submitter?.name ?? ''}</p>
                </div>
                <div>
                  <p className="text-sm text-gray-500 dark:text-gray-400">{t('kpi.management.period')}</p>
                  <p className="font-medium">
                    {selectedReport.week_number 
                      ? `${t('dashboard.weekLabel', { week: selectedReport.week_number, year: selectedReport.report_year })} (${formatDate(selectedReport.start_date)} - ${formatDate(selectedReport.end_date)})`
                      : `${selectedReport.report_month}/${selectedReport.report_year}`
                    }
                  </p>
                </div>
                <div>
                  <p className="text-sm text-gray-500 dark:text-gray-400">{t('common.status')}</p>
                  {getStatusBadge(selectedReport.status)}
                </div>
              </div>

              <hr />

              {/* 1-2. Effectif & Induction */}
              <div className="bg-blue-50 dark:bg-blue-900/20 rounded-lg p-4">
                <h4 className="text-sm font-semibold text-blue-900 mb-3">{t('kpi.management.sections.effectifInduction')}</h4>
                <div className="grid grid-cols-2 gap-3">
                  <div className="bg-white dark:bg-gray-900 p-3 rounded-lg border border-blue-200 dark:border-blue-800">
                    <p className="text-xs text-gray-500 dark:text-gray-400">1. {t('kpi.weekly.effectif')}</p>
                    <p className="text-lg font-bold text-blue-600">{selectedReport.hours_worked ?? 0}</p>
                  </div>
                  <div className="bg-white dark:bg-gray-900 p-3 rounded-lg border border-blue-200 dark:border-blue-800">
                    <p className="text-xs text-gray-500 dark:text-gray-400">2. {t('kpi.weekly.induction')}</p>
                    <p className="text-lg font-bold text-blue-600">{selectedReport.employees_trained ?? 0}</p>
                  </div>
                </div>
              </div>

              {/* 3-4. Observations & Sensibilisation */}
              <div className="bg-amber-50 dark:bg-amber-900/20 rounded-lg p-4">
                <h4 className="text-sm font-semibold text-amber-900 mb-3">{t('kpi.management.sections.observationsAwareness')}</h4>
                <div className="grid grid-cols-2 gap-3">
                  <div className="bg-white dark:bg-gray-900 p-3 rounded-lg border border-amber-200 dark:border-amber-700">
                    <p className="text-xs text-gray-500 dark:text-gray-400">3. {t('kpi.weekly.ecarts')}</p>
                    <p className="text-lg font-bold text-amber-600">{selectedReport.unsafe_conditions_reported ?? 0}</p>
                  </div>
                  <div className="bg-white dark:bg-gray-900 p-3 rounded-lg border border-amber-200 dark:border-amber-700">
                    <p className="text-xs text-gray-500 dark:text-gray-400">4. {t('kpi.weekly.sensibilisation')}</p>
                    <p className="text-lg font-bold text-amber-600">{selectedReport.toolbox_talks ?? 0}</p>
                  </div>
                </div>
              </div>

              {/* 5-8. Accidents & Incidents */}
              <div className="bg-red-50 dark:bg-red-900/20 rounded-lg p-4">
                <h4 className="text-sm font-semibold text-red-900 mb-3">{t('kpi.management.sections.accidentsIncidents')}</h4>
                <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
                  <div className="bg-white dark:bg-gray-900 p-3 rounded-lg border border-amber-200 dark:border-amber-700">
                    <p className="text-xs text-gray-500 dark:text-gray-400">5. {t('kpi.weekly.presquAccident')}</p>
                    <p className="text-lg font-bold text-amber-600">{selectedReport.near_misses ?? 0}</p>
                  </div>
                  <div className="bg-white dark:bg-gray-900 p-3 rounded-lg border border-green-200 dark:border-green-700">
                    <p className="text-xs text-gray-500 dark:text-gray-400">6. {t('kpi.weekly.premiersSoins')}</p>
                    <p className="text-lg font-bold text-green-600">{selectedReport.first_aid_cases ?? 0}</p>
                  </div>
                  <div className="bg-white dark:bg-gray-900 p-3 rounded-lg border border-red-300 dark:border-red-700">
                    <p className="text-xs text-gray-500 dark:text-gray-400">7. {t('kpi.weekly.accident')}</p>
                    <p className="text-lg font-bold text-red-600">{selectedReport.accidents ?? 0}</p>
                  </div>
                  <div className="bg-white dark:bg-gray-900 p-3 rounded-lg border border-orange-200 dark:border-orange-700">
                    <p className="text-xs text-gray-500 dark:text-gray-400">8. {t('kpi.weekly.joursArret')}</p>
                    <p className="text-lg font-bold text-orange-600">{selectedReport.lost_workdays ?? 0}</p>
                  </div>
                </div>
              </div>

              {/* 9-11. Inspections & Indicateurs */}
              <div className="bg-gray-50 dark:bg-gray-900 rounded-lg p-4">
                <h4 className="text-sm font-semibold text-gray-900 dark:text-gray-100 mb-3">{t('kpi.management.sections.inspectionsIndicators')}</h4>
                <div className="grid grid-cols-3 gap-3">
                  <div className="bg-white dark:bg-gray-900 p-3 rounded-lg border dark:border-gray-700">
                    <p className="text-xs text-gray-500 dark:text-gray-400">9. {t('kpi.weekly.inspections')}</p>
                    <p className="text-lg font-bold text-gray-700 dark:text-gray-100">{selectedReport.inspections_completed ?? 0}</p>
                  </div>
                  <div className="bg-white dark:bg-gray-900 p-3 rounded-lg border dark:border-gray-700">
                    <p className="text-xs text-gray-500 dark:text-gray-400">10. {t('kpi.weekly.tauxGravite')}</p>
                    <p className="text-lg font-bold text-gray-700 dark:text-gray-100">{selectedReport.tg_value ?? 0}</p>
                  </div>
                  <div className="bg-white dark:bg-gray-900 p-3 rounded-lg border dark:border-gray-700">
                    <p className="text-xs text-gray-500 dark:text-gray-400">11. {t('kpi.weekly.tauxFrequence')}</p>
                    <p className="text-lg font-bold text-gray-700 dark:text-gray-100">{selectedReport.tf_value ?? 0}</p>
                  </div>
                </div>
              </div>

              {/* 12-14. Formation, Permis & Discipline */}
              <div className="bg-purple-50 dark:bg-purple-900/20 rounded-lg p-4">
                <h4 className="text-sm font-semibold text-purple-900 mb-3">{t('kpi.management.sections.trainingPermitsDiscipline')}</h4>
                <div className="grid grid-cols-3 gap-3">
                  <div className="bg-white dark:bg-gray-900 p-3 rounded-lg border border-purple-200 dark:border-purple-700">
                    <p className="text-xs text-gray-500 dark:text-gray-400">12. {t('kpi.weekly.heuresFormation')}</p>
                    <p className="text-lg font-bold text-purple-600">{selectedReport.training_hours ?? 0}h</p>
                  </div>
                  <div className="bg-white dark:bg-gray-900 p-3 rounded-lg border border-purple-200 dark:border-purple-700">
                    <p className="text-xs text-gray-500 dark:text-gray-400">13. {t('kpi.weekly.permisTravail')}</p>
                    <p className="text-lg font-bold text-purple-600">{selectedReport.work_permits ?? 0}</p>
                  </div>
                  <div className="bg-white dark:bg-gray-900 p-3 rounded-lg border border-purple-200 dark:border-purple-700">
                    <p className="text-xs text-gray-500 dark:text-gray-400">14. {t('kpi.weekly.mesuresDisciplinaires')}</p>
                    <p className="text-lg font-bold text-purple-600">{selectedReport.corrective_actions ?? 0}</p>
                  </div>
                </div>
              </div>

              {/* 15-17. Conformité & Suivi */}
              <div className="bg-green-50 dark:bg-green-900/20 rounded-lg p-4">
                <h4 className="text-sm font-semibold text-green-900 mb-3">{t('kpi.management.sections.complianceMonitoring')}</h4>
                <div className="grid grid-cols-3 gap-3">
                  <div className="bg-white dark:bg-gray-900 p-3 rounded-lg border border-green-200 dark:border-green-700">
                    <p className="text-xs text-gray-500 dark:text-gray-400">15. {t('kpi.weekly.conformiteHSE')}</p>
                    <p className="text-lg font-bold text-green-600">{selectedReport.ppe_compliance_rate ?? 0}%</p>
                  </div>
                  <div className="bg-white dark:bg-gray-900 p-3 rounded-lg border border-green-200 dark:border-green-700">
                    <p className="text-xs text-gray-500 dark:text-gray-400">16. {t('kpi.weekly.conformiteMedecine')}</p>
                    <p className="text-lg font-bold text-green-600">{selectedReport.medical_compliance_rate ?? 0}%</p>
                  </div>
                  <div className="bg-white dark:bg-gray-900 p-3 rounded-lg border border-green-200 dark:border-green-700">
                    <p className="text-xs text-gray-500 dark:text-gray-400">17. {t('kpi.weekly.suiviBruit')}</p>
                    <p className="text-lg font-bold text-green-600">{selectedReport.noise_monitoring ?? 0} dB</p>
                  </div>
                </div>
              </div>

              {/* 18-19. Consommation d'énergie */}
              <div className="bg-cyan-50 dark:bg-cyan-900/20 rounded-lg p-4">
                <h4 className="text-sm font-semibold text-cyan-900 mb-3">{t('kpi.management.sections.energyConsumption')}</h4>
                <div className="grid grid-cols-2 gap-3">
                  <div className="bg-white dark:bg-gray-900 p-3 rounded-lg border border-cyan-200 dark:border-cyan-700">
                    <p className="text-xs text-gray-500 dark:text-gray-400">18. {t('kpi.weekly.consoEau')}</p>
                    <p className="text-lg font-bold text-cyan-600">{selectedReport.water_consumption ?? 0} m³</p>
                  </div>
                  <div className="bg-white dark:bg-gray-900 p-3 rounded-lg border border-cyan-200 dark:border-cyan-700">
                    <p className="text-xs text-gray-500 dark:text-gray-400">19. {t('kpi.weekly.consoElectricite')}</p>
                    <p className="text-lg font-bold text-cyan-600">{selectedReport.electricity_consumption ?? 0} kWh</p>
                  </div>
                </div>
              </div>

              {selectedReport.rejection_reason && (
                <div className="bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-700 rounded-lg p-4">
                  <p className="text-sm font-medium text-red-800 dark:text-red-200 mb-1">{t('kpi.management.previouslyRejected')}</p>
                  <p className="text-red-700 dark:text-red-300 text-sm">{selectedReport.rejection_reason}</p>
                  {selectedReport.rejected_at && (
                    <p className="text-red-600 dark:text-red-300 text-xs mt-2">
                      {t('kpi.management.rejectedOn', { date: formatDate(selectedReport.rejected_at) })}
                    </p>
                  )}
                </div>
              )}

              {selectedReport.notes && (
                <div>
                  <p className="text-sm text-gray-500 dark:text-gray-400 mb-1">{t('kpi.notes')}</p>
                  <p className="bg-gray-50 dark:bg-gray-900 p-3 rounded-lg text-gray-700 dark:text-gray-100">{selectedReport.notes}</p>
                </div>
              )}

              {/* Daily Snapshots */}
              {loadingDetails ? (
                <div className="flex items-center justify-center py-4">
                  <Loader2 className="w-5 h-5 animate-spin text-gray-400" />
                  <span className="ml-2 text-sm text-gray-500 dark:text-gray-400">{t('kpi.dailyKpi.loadingDaily')}</span>
                </div>
              ) : (
                <DailyKpiPreview dailySnapshots={dailySnapshots} />
              )}

              {canApproveReport(selectedReport) && (
                <div className="flex gap-3 pt-4 border-t dark:border-gray-700">
                  <button
                    onClick={() => handleApprove(selectedReport.id)}
                    disabled={actionLoading}
                    className="btn-primary flex-1 flex items-center justify-center gap-2"
                  >
                    <Check className="w-4 h-4" />
                    {t('kpi.approve')}
                  </button>
                  <button
                    onClick={() => {
                      setShowRejectModal(true)
                    }}
                    className="btn-secondary flex-1 flex items-center justify-center gap-2 text-red-600 dark:text-red-400 border-red-200 dark:border-red-700 hover:bg-red-50 dark:hover:bg-red-900/30"
                  >
                    <X className="w-4 h-4" />
                    {t('kpi.reject')}
                  </button>
                </div>
              )}
            </div>
        )}
      </Modal>

      {/* HSE Weekly Export Modal */}
      <Modal
        isOpen={showExportModal}
        onClose={() => setShowExportModal(false)}
        title={t('hseExport.title')}
      >
        <div className="space-y-4">
          <div className="flex items-center gap-3 p-4 bg-blue-50 dark:bg-blue-900/20 rounded-lg">
            <FileSpreadsheet className="w-8 h-8 text-blue-600 dark:text-blue-400" />
            <div>
              <p className="font-medium text-blue-900 dark:text-blue-100">{t('hseExport.exportButton')}</p>
              <p className="text-sm text-blue-700 dark:text-blue-300">
                {t('hseExport.description')}
              </p>
            </div>
          </div>

          {/* Project Selection */}
          <div>
            <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
              {t('hseExport.selectProject')} *
            </label>
            <select
              value={exportParams.project_id}
              onChange={(e) => setExportParams({ ...exportParams, project_id: e.target.value })}
              className="input w-full"
            >
              <option value="">{t('hseExport.selectProject')}</option>
              {sortedProjects.map((project) => (
                <option key={project.id} value={project.id}>
                  {getProjectLabel(project)}
                </option>
              ))}
            </select>
          </div>

          {/* Week and Year Selection */}
          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                {t('hseExport.week')} *
              </label>
              <WeekPicker
                value={toWeekKey(exportParams.year, exportParams.week)}
                onChange={(key) => {
                  const parsed = parseWeekKey(key)
                  if (!parsed) return
                  setExportParams((prev) => ({ ...prev, year: parseInt(parsed.weekYear), week: parseInt(parsed.week) }))
                }}
                className="w-full"
                required
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                {t('hseExport.year')} *
              </label>
              <YearPicker
                value={exportParams.year}
                onChange={(y) => setExportParams((prev) => ({ ...prev, year: parseInt(y) }))}
                className="w-full"
                required
              />
            </div>
          </div>

          {/* Info about sheets */}
          <div className="text-xs text-gray-500 dark:text-gray-400 bg-gray-50 dark:bg-gray-800 p-3 rounded-lg">
            <p className="font-medium mb-1">{t('hseExport.sheets.projectInfo')}:</p>
            <div className="grid grid-cols-2 gap-1">
              <span>• {t('hseExport.sheets.projectInfo')}</span>
              <span>• {t('hseExport.sheets.hseReporting')}</span>
              <span>• {t('hseExport.sheets.incidents')}</span>
              <span>• {t('hseExport.sheets.deviationsSgtm')}</span>
              <span>• {t('hseExport.sheets.deviationsSt')}</span>
              <span>• {t('hseExport.sheets.categories')}</span>
              <span>• {t('hseExport.sheets.certifications')}</span>
              <span>• {t('hseExport.sheets.personnel')}</span>
              <span>• {t('hseExport.sheets.training')}</span>
              <span>• {t('hseExport.sheets.inspections')}</span>
              <span>• {t('hseExport.sheets.workPermits')}</span>
            </div>
          </div>

          {/* Action Buttons */}
          <div className="flex gap-3 pt-4 border-t dark:border-gray-700">
            <button
              onClick={() => setShowExportModal(false)}
              className="btn-secondary flex-1"
              disabled={exportLoading}
            >
              {t('common.cancel')}
            </button>
            <button
              onClick={handleExportHseWeekly}
              disabled={exportLoading || !exportParams.project_id}
              className="btn-primary flex-1 flex items-center justify-center gap-2"
            >
              {exportLoading ? (
                <>
                  <Loader2 className="w-4 h-4 animate-spin" />
                  {t('hseExport.exporting')}
                </>
              ) : (
                <>
                  <Download className="w-4 h-4" />
                  {t('hseExport.exportButton')}
                </>
              )}
            </button>
          </div>
        </div>
      </Modal>
    </div>
  )
}
