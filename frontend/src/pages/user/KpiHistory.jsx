import { useState, useEffect, useMemo } from 'react'
import { kpiService, exportService, projectService } from '../../services/api'
import { useProjectStore } from '../../store/projectStore'
import { useLanguage } from '../../i18n'
import { useAuthStore } from '../../store/authStore'
import { Modal, ConfirmDialog, Select } from '../../components/ui'
import DatePicker from '../../components/ui/DatePicker'
import DailyKpiPreview from '../../components/kpi/DailyKpiPreview'
import { getProjectLabel, sortProjects } from '../../utils/projectList'
import {
  FileText,
  Search,
  Filter,
  Eye,
  Edit,
  Trash2,
  Calendar,
  CheckCircle,
  XCircle,
  Clock,
  Loader2,
  X,
  FileSpreadsheet,
} from 'lucide-react'
import toast from 'react-hot-toast'

export default function KpiHistory() {
  const { t } = useLanguage()
  const { user } = useAuthStore()

  const [reports, setReports] = useState([])
  const { projects, fetchProjects } = useProjectStore()
  const [loading, setLoading] = useState(true)
  const [filters, setFilters] = useState({
    project_id: '',
    pole: '',
    status: '',
    year: new Date().getFullYear()
  })
  const [pagination, setPagination] = useState({ current_page: 1, last_page: 1 })
  const [selectedReport, setSelectedReport] = useState(null)
  const [dailySnapshots, setDailySnapshots] = useState([])
  const [loadingDetails, setLoadingDetails] = useState(false)
  const [confirmReport, setConfirmReport] = useState(null)

  const [filterFromDate, setFilterFromDate] = useState('')
  const [filterToDate, setFilterToDate] = useState('')
  const [exporting, setExporting] = useState(false)

  const projectListPreference = user?.project_list_preference ?? 'code'
  const sortedProjects = useMemo(() => {
    return sortProjects(projects, projectListPreference)
  }, [projects, projectListPreference])

  const [poles, setPoles] = useState([])

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

  const visibleProjects = useMemo(() => {
    const list = Array.isArray(sortedProjects) ? sortedProjects : []
    if (!filters.pole) return list
    return list.filter((p) => p?.pole === filters.pole)
  }, [sortedProjects, filters.pole])

  useEffect(() => {
    fetchProjects({ per_page: 100 }).catch(() => {
      // Errors are logged in the store
    })
  }, [fetchProjects])

  useEffect(() => {
    fetchReports()
  }, [filters])

  const fetchReports = async (page = 1) => {
    try {
      setLoading(true)
      const response = await kpiService.getAll({
        page,
        ...filters,
        per_page: 10
      })
      setReports(response.data.data || [])
      setPagination(response.data.meta || { current_page: 1, last_page: 1 })
    } catch (error) {
      toast.error(t('kpi.historyPage.loadFailed'))
    } finally {
      setLoading(false)
    }
  }

  const handleViewReport = async (report) => {
    setLoadingDetails(true)
    setSelectedReport(report) // Show modal immediately with basic data
    setDailySnapshots([])
    
    try {
      const response = await kpiService.getById(report.id)
      const data = response.data.data
      // Update with full data including daily snapshots
      setSelectedReport(data.report || data)
      setDailySnapshots(data.daily_snapshots || [])
    } catch (error) {
      console.error('Failed to load report details:', error)
    } finally {
      setLoadingDetails(false)
    }
  }

  const handleDelete = (report) => {
    if (report.status !== 'draft') {
      toast.error(t('kpi.historyPage.onlyDraftDeletable'))
      return
    }
    setConfirmReport(report)
  }

  const confirmDeleteReport = async () => {
    if (!confirmReport) return

    try {
      await kpiService.delete(confirmReport.id)
      toast.success(t('kpi.historyPage.deleteSuccess'))
      fetchReports()
    } catch (error) {
      toast.error(t('errors.failedToDelete'))
    } finally {
      setConfirmReport(null)
    }
  }

  const formatPeriod = (report) => {
    if (report?.week_number) {
      return t('dashboard.weekLabel', { week: report.week_number, year: report.report_year })
    }
    if (report?.report_month && report?.report_year) {
      return `${report.report_month}/${report.report_year}`
    }
    return ''
  }

  const statusIcons = {
    draft: <FileText className="w-4 h-4 text-gray-500" />,
    submitted: <Clock className="w-4 h-4 text-amber-500" />,
    approved: <CheckCircle className="w-4 h-4 text-green-500" />,
    rejected: <XCircle className="w-4 h-4 text-red-500" />
  }

  const statusColors = {
    draft: 'badge-info',
    submitted: 'badge-warning',
    approved: 'badge-success',
    rejected: 'badge-danger'
  }

  const filteredReports = useMemo(() => {
    if (!Array.isArray(reports)) return []
    if (!filterFromDate && !filterToDate) return reports

    return reports.filter((report) => {
      // Prefer start_date if available, otherwise fall back to created_at
      let dateStr = ''
      if (report.start_date) {
        dateStr = report.start_date.substring(0, 10)
      } else if (report.created_at) {
        const d = new Date(report.created_at)
        if (!Number.isNaN(d.getTime())) {
          dateStr = d.toISOString().substring(0, 10)
        }
      }

      if (filterFromDate && (!dateStr || dateStr < filterFromDate)) return false
      if (filterToDate && (!dateStr || dateStr > filterToDate)) return false
      return true
    })
  }, [reports, filterFromDate, filterToDate])

  const handleExportKpiHistory = async () => {
    try {
      setExporting(true)
      const params = {
        project_id: filters.project_id ? filters.project_id : undefined,
        status: filters.status ? filters.status : undefined,
        year: filters.year ? filters.year : undefined,
      }
      if (filterFromDate) params.from_date = filterFromDate
      if (filterToDate) params.to_date = filterToDate

      const response = await exportService.exportKpiHistory(params)
      const blob = new Blob([response.data], {
        type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
      })
      const url = window.URL.createObjectURL(blob)
      const a = document.createElement('a')
      a.href = url
      a.download = `kpi_history_${filters.year}.xlsx`
      a.click()
      window.URL.revokeObjectURL(url)
    } catch (error) {
      console.error('Error exporting KPI history:', error)
      toast.error(t('kpi.historyPage.exportFailed'))
    } finally {
      setExporting(false)
    }
  }

  return (
    <div className="space-y-6 animate-fade-in">
      {/* Header */}
      <div>
        <div className="text-xs text-gray-500 dark:text-gray-400 mb-1">
          {t('nav.dashboard')} / {t('kpi.history')}
        </div>
        <h1 className="text-2xl font-bold text-gray-900 dark:text-gray-100">{t('kpi.history')}</h1>
        <p className="text-gray-500 dark:text-gray-400 mt-1">{t('kpi.historyPage.subtitle')}</p>
      </div>

      {/* Filters */}
      <div className="card p-4">
        <div className="flex flex-col sm:flex-row flex-wrap gap-4">
          <div className="w-full sm:w-44">
            <Select
              value={filters.pole}
              onChange={(e) => setFilters({ ...filters, pole: e.target.value, project_id: '' })}
            >
              <option value="">{t('common.allPoles')}</option>
              {poles.map((p) => (
                <option key={p} value={p}>
                  {p}
                </option>
              ))}
            </Select>
          </div>
          <div className="w-full sm:flex-1 sm:min-w-[180px]">
            <Select
              value={filters.project_id}
              onChange={(e) => setFilters({ ...filters, project_id: e.target.value })}
            >
              <option value="">{t('common.allProjects')}</option>
              {visibleProjects.map((project) => (
                <option key={project.id} value={project.id}>
                  {getProjectLabel(project)}
                </option>
              ))}
            </Select>
          </div>
          <div className="w-full sm:w-40">
            <Select
              value={filters.status}
              onChange={(e) => setFilters({ ...filters, status: e.target.value })}
            >
              <option value="">{t('common.all')}</option>
              <option value="draft">{t('kpi.status.draft')}</option>
              <option value="submitted">{t('kpi.status.submitted')}</option>
              <option value="approved">{t('kpi.status.approved')}</option>
              <option value="rejected">{t('kpi.status.rejected')}</option>
            </Select>
          </div>
          <div className="w-full sm:w-32">
            <Select
              value={filters.year}
              onChange={(e) => setFilters({ ...filters, year: e.target.value })}
            >
              {[...Array(5)].map((_, i) => {
                const y = new Date().getFullYear() - i
                return <option key={y} value={y}>{y}</option>
              })}
            </Select>
          </div>
          <div className="w-full sm:w-40">
            <DatePicker
              value={filterFromDate}
              onChange={(val) => setFilterFromDate(val)}
              placeholder="From date"
            />
          </div>
          <div className="w-full sm:w-40">
            <DatePicker
              value={filterToDate}
              onChange={(val) => setFilterToDate(val)}
              placeholder="To date"
            />
          </div>
          <button
            type="button"
            onClick={handleExportKpiHistory}
            disabled={exporting || filteredReports.length === 0}
            className="btn-secondary flex items-center justify-center gap-2 text-sm w-full sm:w-auto"
          >
            <FileSpreadsheet className="w-4 h-4" />
            <span>{t('dashboard.exportExcel')}</span>
          </button>
        </div>
      </div>

      {/* Reports Table */}
      <div className="card">
        {loading ? (
          <div className="p-4 space-y-4">
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
        ) : filteredReports.length === 0 ? (
          <div className="p-12 text-center">
            <FileText className="w-12 h-12 text-gray-300 dark:text-gray-600 mx-auto mb-4" />
            <h3 className="text-lg font-medium text-gray-900 dark:text-gray-100 mb-2">No reports found</h3>
            <p className="text-gray-500 dark:text-gray-400">Try adjusting your filters or submit a new KPI report.</p>
          </div>
        ) : (
          <>
            {/* Mobile cards */}
            <div className="space-y-3 md:hidden">
              {filteredReports.map((report) => (
                <div
                  key={report.id}
                  className="border border-gray-200 dark:border-gray-700 rounded-lg p-3 bg-white dark:bg-gray-800"
                >
                  <div className="flex items-start justify-between gap-3">
                    <div>
                      <p className="font-medium text-gray-900 dark:text-gray-100">
                        {report.project?.name || 'Unknown'}
                      </p>
                      {report.project?.code && (
                        <p className="text-xs text-gray-500 dark:text-gray-400">
                          {report.project.code}
                        </p>
                      )}
                      <div className="mt-2 flex items-center gap-2 text-xs text-gray-600 dark:text-gray-300">
                        <Calendar className="w-3 h-3 text-gray-400" />
                        <span>
                          {formatPeriod(report)}
                        </span>
                      </div>
                    </div>
                    <div className="flex flex-col items-end gap-1">
                      <div className="flex items-center gap-1 text-xs">
                        {statusIcons[report.status]}
                        <span className={`badge ${statusColors[report.status]}`}>
                          {report.status}
                        </span>
                      </div>
                      <div className="mt-1 flex flex-wrap gap-1 justify-end text-[11px] text-gray-600 dark:text-gray-300">
                        <span className={report.accidents > 0 ? 'text-red-600 dark:text-red-400 font-semibold' : 'text-green-600'}>
                          {report.accidents} acc.
                        </span>
                        <span className="px-1.5 py-0.5 rounded-full bg-blue-50 dark:bg-blue-900/30 text-blue-700 dark:text-blue-300">
                          {report.trainings_conducted} tr.
                        </span>
                        <span className="px-1.5 py-0.5 rounded-full bg-emerald-50 dark:bg-emerald-900/30 text-emerald-700 dark:text-emerald-300">
                          {report.inspections_completed} insp.
                        </span>
                      </div>
                    </div>
                  </div>

                  <div className="mt-3 flex items-center justify-between">
                    <button
                      onClick={() => handleViewReport(report)}
                      className="inline-flex items-center gap-1 text-xs text-hse-primary hover:underline"
                      title="View Details"
                    >
                      <Eye className="w-4 h-4" />
                      <span>View details</span>
                    </button>
                    {report.status === 'draft' && (
                      <div className="flex items-center gap-2">
                        <button
                          className="p-1.5 rounded-md hover:bg-gray-100 dark:hover:bg-gray-700"
                          title="Edit"
                        >
                          <Edit className="w-4 h-4 text-gray-600 dark:text-gray-300" />
                        </button>
                        <button
                          onClick={() => handleDelete(report)}
                          className="p-1.5 rounded-md hover:bg-red-50 dark:hover:bg-red-900/30"
                          title="Delete"
                        >
                          <Trash2 className="w-4 h-4 text-red-600" />
                        </button>
                      </div>
                    )}
                  </div>
                </div>
              ))}
            </div>

            {/* Desktop table */}
            <div className="hidden md:block overflow-x-auto">
              <table className="table w-full">
                <thead>
                  <tr>
                    <th>Project</th>
                    <th>Week / Year</th>
                    <th>Accidents</th>
                    <th>Trainings</th>
                    <th>Inspections</th>
                    <th>Status</th>
                    <th>Actions</th>
                  </tr>
                </thead>
                <tbody>
                  {filteredReports.map((report) => (
                    <tr key={report.id}>
                      <td>
                        <div>
                          <p className="font-medium">{report.project?.name || 'Unknown'}</p>
                          <p className="text-xs text-gray-500">{report.project?.code}</p>
                        </div>
                      </td>
                      <td>
                        <div className="flex items-center gap-2">
                          <Calendar className="w-4 h-4 text-gray-400" />
                          <span>{formatPeriod(report)}</span>
                        </div>
                      </td>
                      <td>
                        <span className={report.accidents > 0 ? 'text-red-600 font-semibold' : 'text-green-600'}>
                          {report.accidents}
                        </span>
                      </td>
                      <td>{report.trainings_conducted}</td>
                      <td>{report.inspections_completed}</td>
                      <td>
                        <div className="flex items-center gap-2">
                          {statusIcons[report.status]}
                          <span className={`badge ${statusColors[report.status]}`}>
                            {report.status}
                          </span>
                        </div>
                      </td>
                      <td>
                        <div className="flex items-center gap-1">
                          <button
                            onClick={() => handleViewReport(report)}
                            className="p-2 hover:bg-gray-100 rounded-lg"
                            title="View Details"
                          >
                            <Eye className="w-4 h-4 text-gray-600" />
                          </button>
                          {report.status === 'draft' && (
                            <>
                              <button
                                className="p-2 hover:bg-gray-100 rounded-lg"
                                title="Edit"
                              >
                                <Edit className="w-4 h-4 text-gray-600" />
                              </button>
                              <button
                                onClick={() => handleDelete(report)}
                                className="p-2 hover:bg-gray-100 rounded-lg"
                                title="Delete"
                              >
                                <Trash2 className="w-4 h-4 text-red-600" />
                              </button>
                            </>
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

        {/* Pagination */}
        {pagination.last_page > 1 && (
          <div className="flex items-center justify-between p-4 border-t border-gray-100">
            <p className="text-sm text-gray-500">
              Page {pagination.current_page} of {pagination.last_page}
            </p>
            <div className="flex gap-2">
              <button
                onClick={() => fetchReports(pagination.current_page - 1)}
                disabled={pagination.current_page === 1}
                className="btn-secondary text-sm"
              >
                Previous
              </button>
              <button
                onClick={() => fetchReports(pagination.current_page + 1)}
                disabled={pagination.current_page === pagination.last_page}
                className="btn-secondary text-sm"
              >
                Next
              </button>
            </div>
          </div>
        )}
      </div>

      {/* Report Detail Modal */}
      <Modal
        isOpen={!!selectedReport}
        onClose={() => setSelectedReport(null)}
        title={selectedReport?.project?.name || 'Détails du rapport'}
        size="lg"
      >
        {selectedReport && (
          <div className="space-y-6">
            <div className="flex items-center justify-between">
              <p className="text-sm text-gray-500 dark:text-gray-400">
                {formatPeriod(selectedReport)}
              </p>
              <span className={`badge ${statusColors[selectedReport.status]}`}>
                {selectedReport.status}
              </span>
            </div>

            {/* Accidents */}
            <div>
              <h4 className="font-semibold text-gray-900 dark:text-gray-100 mb-3">Indicateurs d'accidents</h4>
              <div className="grid grid-cols-2 sm:grid-cols-3 gap-4">
                <MetricItem label="Total" value={selectedReport.accidents} danger={selectedReport.accidents > 0} />
                <MetricItem label="Mortels" value={selectedReport.accidents_fatal} danger={selectedReport.accidents_fatal > 0} />
                <MetricItem label="Graves" value={selectedReport.accidents_serious} />
                <MetricItem label="Mineurs" value={selectedReport.accidents_minor} />
                <MetricItem label="Presqu'accidents" value={selectedReport.near_misses} />
                <MetricItem label="Premiers soins" value={selectedReport.first_aid_cases} />
              </div>
            </div>

            {/* Training */}
            <div>
              <h4 className="font-semibold text-gray-900 dark:text-gray-100 mb-3">Indicateurs de formation</h4>
              <div className="grid grid-cols-2 sm:grid-cols-3 gap-4">
                <MetricItem label="Réalisées" value={selectedReport.trainings_conducted} />
                <MetricItem label="Planifiées" value={selectedReport.trainings_planned} />
                <MetricItem label="Employés" value={selectedReport.employees_trained} />
                <MetricItem label="Heures" value={selectedReport.training_hours} />
                <MetricItem label="Sensibilisations" value={selectedReport.toolbox_talks} />
              </div>
            </div>

            {/* Inspections */}
            <div>
              <h4 className="font-semibold text-gray-900 dark:text-gray-100 mb-3">Indicateurs d'inspection</h4>
              <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
                <MetricItem label="Réalisées" value={selectedReport.inspections_completed} />
                <MetricItem label="Planifiées" value={selectedReport.inspections_planned} />
                <MetricItem label="Écarts ouverts" value={selectedReport.findings_open} />
                <MetricItem label="Écarts fermés" value={selectedReport.findings_closed} />
              </div>
            </div>

            {/* Rates */}
            <div>
              <h4 className="font-semibold text-gray-900 dark:text-gray-100 mb-3">Taux de sécurité</h4>
              <div className="grid grid-cols-2 gap-4">
                <MetricItem label="TF" value={Number(selectedReport.tf_value).toFixed(4)} />
                <MetricItem label="TG" value={Number(selectedReport.tg_value).toFixed(4)} />
                <MetricItem label="Heures travaillées" value={Number(selectedReport.hours_worked).toLocaleString()} />
                <MetricItem label="Jours perdus" value={selectedReport.lost_workdays} />
              </div>
            </div>

            {selectedReport.notes && (
              <div>
                <h4 className="font-semibold text-gray-900 dark:text-gray-100 mb-2">Notes</h4>
                <p className="text-gray-600 dark:text-gray-300 text-sm bg-gray-50 dark:bg-gray-700 p-3 rounded-lg">
                  {selectedReport.notes}
                </p>
              </div>
            )}

            {/* Daily Snapshots */}
            {loadingDetails ? (
              <div className="flex items-center justify-center py-4">
                <Loader2 className="w-5 h-5 animate-spin text-gray-400" />
                <span className="ml-2 text-sm text-gray-500">Chargement des données journalières...</span>
              </div>
            ) : (
              <DailyKpiPreview dailySnapshots={dailySnapshots} />
            )}

            <div className="pt-4 border-t border-gray-200 dark:border-gray-700">
              <button
                onClick={() => { setSelectedReport(null); setDailySnapshots([]); }}
                className="btn-secondary w-full"
              >
                Fermer
              </button>
            </div>
          </div>
        )}
      </Modal>

      <ConfirmDialog
        isOpen={!!confirmReport}
        title="Confirm deletion"
        message="Are you sure you want to delete this report?"
        confirmLabel="Delete"
        cancelLabel="Cancel"
        variant="danger"
        onConfirm={confirmDeleteReport}
        onCancel={() => setConfirmReport(null)}
      />
    </div>
  )
}

function MetricItem({ label, value, danger = false }) {
  return (
    <div className="bg-gray-50 dark:bg-gray-700 rounded-lg p-3">
      <p className="text-xs text-gray-500 dark:text-gray-400 mb-1">{label}</p>
      <p className={`text-lg font-semibold ${danger ? 'text-red-600 dark:text-red-400' : 'text-gray-900 dark:text-gray-100'}`}>
        {value}
      </p>
    </div>
  )
}
