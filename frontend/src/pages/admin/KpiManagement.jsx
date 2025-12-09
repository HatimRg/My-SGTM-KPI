import { useState, useEffect } from 'react'
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
  FileSpreadsheet
} from 'lucide-react'
import { kpiService, projectService, exportService } from '../../services/api'
import { useLanguage } from '../../i18n'
import { Modal } from '../../components/ui'
import DailyKpiPreview from '../../components/kpi/DailyKpiPreview'
import toast from 'react-hot-toast'

export default function KpiManagement() {
  const { t } = useLanguage()
  const location = useLocation()
  const [reports, setReports] = useState([])
  const [projects, setProjects] = useState([])
  const [loading, setLoading] = useState(true)
  const [selectedReport, setSelectedReport] = useState(null)
  const [dailySnapshots, setDailySnapshots] = useState([])
  const [loadingDetails, setLoadingDetails] = useState(false)
  const [showRejectModal, setShowRejectModal] = useState(false)
  const [rejectReason, setRejectReason] = useState('')
  const [actionLoading, setActionLoading] = useState(null)
  
  // Export modal state
  const [showExportModal, setShowExportModal] = useState(false)
  const [exportLoading, setExportLoading] = useState(false)
  const [exportParams, setExportParams] = useState({
    project_id: '',
    week: new Date().getWeek ? new Date().getWeek() : Math.ceil((new Date() - new Date(new Date().getFullYear(), 0, 1)) / 604800000),
    year: new Date().getFullYear()
  })
  
  const [filters, setFilters] = useState({
    status: '',
    project_id: '',
    search: '',
    week: '',
    year: '',
  })

  const visibleReports = reports.filter((report) => report.status !== 'draft')

  // Initialize filters from URL params (week/year) on first mount
  useEffect(() => {
    const params = new URLSearchParams(location.search)
    const week = params.get('week') || ''
    const year = params.get('year') || ''
    if (week || year) {
      setFilters((prev) => ({
        ...prev,
        week,
        year,
      }))
    }
  }, [location.search])

  useEffect(() => {
    loadData()
  }, [filters])

  const loadData = async () => {
    try {
      setLoading(true)
      const [reportsRes, projectsRes] = await Promise.all([
        kpiService.getAll(filters),
        projectService.getAll()
      ])
      console.log('KPI Reports API response:', reportsRes.data)
      const reportsData = reportsRes.data.data || reportsRes.data || []
      setReports(Array.isArray(reportsData) ? reportsData : [])
      setProjects(projectsRes.data.data || projectsRes.data || [])
    } catch (error) {
      console.error('Error loading KPI data:', error)
      console.error('Error details:', error.response?.data || error.message)
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
      toast.error('Veuillez entrer un motif de rejet')
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
      setSelectedReport(data.report || data)
      setDailySnapshots(data.daily_snapshots || [])
    } catch (error) {
      console.error('Failed to load report details:', error)
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

  // Generate week options (1-53)
  const weekOptions = Array.from({ length: 53 }, (_, i) => i + 1)
  
  // Generate year options (current year -2 to +1)
  const currentYear = new Date().getFullYear()
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
            Gestion des Rapports KPI
          </h1>
          <p className="text-gray-500 dark:text-gray-400 mt-1">Approuver ou rejeter les rapports soumis</p>
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
        <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
          {/* Search */}
          <div className="relative">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
            <input
              type="text"
              placeholder="Rechercher..."
              value={filters.search}
              onChange={(e) => setFilters({ ...filters, search: e.target.value })}
              className="input pl-10"
            />
          </div>

          {/* Status Filter */}
          <select
            value={filters.status}
            onChange={(e) => setFilters({ ...filters, status: e.target.value })}
            className="input"
          >
            <option value="">Tous les statuts</option>
            <option value="submitted">En attente</option>
            <option value="approved">Approuvé</option>
            <option value="rejected">Rejeté</option>
          </select>

          {/* Project Filter */}
          <select
            value={filters.project_id}
            onChange={(e) => setFilters({ ...filters, project_id: e.target.value })}
            className="input"
          >
            <option value="">Tous les projets</option>
            {projects.map((project) => (
              <option key={project.id} value={project.id}>
                {project.name}
              </option>
            ))}
          </select>

          {/* Refresh Button */}
          <button
            onClick={loadData}
            className="btn-secondary flex items-center justify-center gap-2"
          >
            <Filter className="w-4 h-4" />
            Actualiser
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
            <p className="text-gray-500 dark:text-gray-400">Aucun rapport trouvé</p>
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
                        {report.project?.name || 'N/A'}
                      </p>
                      <p className="text-xs text-gray-500 dark:text-gray-400">
                        {report.submitter?.name || 'N/A'}
                      </p>
                      <p className="mt-1 text-xs text-gray-600 dark:text-gray-300 flex items-center gap-1">
                        <Calendar className="w-3 h-3 text-gray-400" />
                        <span>
                          {report.week_number
                            ? `Sem. ${report.week_number} - ${report.report_year}`
                            : `${report.report_month}/${report.report_year}`}
                        </span>
                      </p>
                      <p className="text-xs text-gray-500 dark:text-gray-400">
                        {new Date(report.created_at).toLocaleDateString('fr-FR')}
                      </p>
                    </div>
                    <div className="text-right">
                      {getStatusBadge(report.status)}
                    </div>
                  </div>

                  <div className="mt-3 flex items-center justify-end gap-2">
                    {report.status === 'submitted' && (
                      <>
                        <button
                          onClick={() => handleApprove(report.id)}
                          disabled={actionLoading === report.id}
                          className="px-2 py-1 text-xs rounded-md bg-green-50 dark:bg-green-900/30 text-green-700 dark:text-green-300"
                        >
                          {actionLoading === report.id ? (
                            <Loader2 className="w-4 h-4 animate-spin" />
                          ) : (
                            <span>Approuver</span>
                          )}
                        </button>
                        <button
                          onClick={() => openRejectModal(report)}
                          disabled={actionLoading === report.id}
                          className="px-2 py-1 text-xs rounded-md bg-red-50 dark:bg-red-900/30 text-red-700 dark:text-red-300"
                        >
                          Rejeter
                        </button>
                      </>
                    )}
                    <button
                      onClick={() => handleViewReport(report)}
                      className="px-2 py-1 text-xs rounded-md bg-gray-50 dark:bg-gray-900 text-gray-700 dark:text-gray-200 flex items-center gap-1"
                    >
                      <Eye className="w-4 h-4" />
                      <span>Voir</span>
                    </button>
                  </div>
                </div>
              ))}
            </div>

            <div className="hidden md:block overflow-x-auto">
              <table className="w-full">
                <thead className="bg-gray-50 dark:bg-gray-800 border-b border-gray-200 dark:border-gray-700">
                  <tr>
                    <th className="text-left px-4 py-3 text-xs font-medium text-gray-500 dark:text-gray-400 uppercase">Projet</th>
                    <th className="text-left px-4 py-3 text-xs font-medium text-gray-500 dark:text-gray-400 uppercase">Soumis par</th>
                    <th className="text-left px-4 py-3 text-xs font-medium text-gray-500 dark:text-gray-400 uppercase">Période</th>
                    <th className="text-left px-4 py-3 text-xs font-medium text-gray-500 dark:text-gray-400 uppercase">Date</th>
                    <th className="text-left px-4 py-3 text-xs font-medium text-gray-500 dark:text-gray-400 uppercase">Statut</th>
                    <th className="text-right px-4 py-3 text-xs font-medium text-gray-500 dark:text-gray-400 uppercase">Actions</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-200 dark:divide-gray-700">
                  {visibleReports.map((report) => (
                    <tr key={report.id} className="hover:bg-gray-50 dark:hover:bg-gray-700/50">
                      <td className="px-4 py-4">
                        <div className="flex items-center gap-2">
                          <Building2 className="w-4 h-4 text-gray-400" />
                          <span className="font-medium text-gray-900 dark:text-gray-100">
                            {report.project?.name || 'N/A'}
                          </span>
                        </div>
                      </td>
                      <td className="px-4 py-4">
                        <div className="flex items-center gap-2">
                          <User className="w-4 h-4 text-gray-400" />
                          <span className="text-gray-600 dark:text-gray-300">
                            {report.submitter?.name || 'N/A'}
                          </span>
                        </div>
                      </td>
                      <td className="px-4 py-4">
                        <div className="flex items-center gap-2">
                          <Calendar className="w-4 h-4 text-gray-400" />
                          <span className="text-gray-600">
                            {report.week_number 
                              ? `Sem. ${report.week_number} - ${report.report_year}`
                              : `${report.report_month}/${report.report_year}`
                            }
                          </span>
                        </div>
                      </td>
                      <td className="px-4 py-4 text-gray-500 dark:text-gray-400 text-sm">
                        {new Date(report.created_at).toLocaleDateString('fr-FR')}
                      </td>
                      <td className="px-4 py-4">
                        {getStatusBadge(report.status)}
                      </td>
                      <td className="px-4 py-4">
                        <div className="flex items-center justify-end gap-2">
                          {report.status === 'submitted' && (
                            <>
                              <button
                                onClick={() => handleApprove(report.id)}
                                disabled={actionLoading === report.id}
                                className="p-2 text-green-600 dark:text-green-400 hover:bg-green-50 dark:hover:bg-green-900/30 rounded-lg transition-colors"
                                title="Approuver"
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
                                title="Rejeter"
                              >
                                <X className="w-5 h-5" />
                              </button>
                            </>
                          )}
                          <button
                            onClick={() => handleViewReport(report)}
                            className="p-2 text-gray-600 hover:bg-gray-100 rounded-lg transition-colors"
                            title="Voir détails"
                          >
                            <Eye className="w-5 h-5" />
                          </button>
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

      {/* Reject Modal */}
      <Modal
        isOpen={showRejectModal}
        onClose={() => { setShowRejectModal(false); setRejectReason(''); setSelectedReport(null) }}
        title="Rejeter le rapport"
        size="sm"
      >
        <div className="space-y-4">
          <p className="text-gray-600 dark:text-gray-300 text-sm">
            Projet: <strong>{selectedReport?.project?.name}</strong><br />
            Période: <strong>
              {selectedReport?.week_number 
                ? `Semaine ${selectedReport.week_number} - ${selectedReport.report_year}`
                : `${selectedReport?.report_month}/${selectedReport?.report_year}`
              }
            </strong>
          </p>
          <div className="bg-amber-50 dark:bg-amber-900/30 border border-amber-200 dark:border-amber-700 rounded-lg p-3">
            <p className="text-amber-800 dark:text-amber-300 text-sm">
              ⚠️ Le rapport sera remis en <strong>brouillon</strong> pour permettre au soumetteur de corriger et resoumettre.
            </p>
          </div>
          <div>
            <label className="label">Motif du rejet *</label>
            <textarea
              value={rejectReason}
              onChange={(e) => setRejectReason(e.target.value)}
              className="input"
              rows={3}
              placeholder="Entrez le motif du rejet..."
            />
          </div>
          <div className="flex flex-col-reverse sm:flex-row gap-3 justify-end pt-2">
            <button
              onClick={() => { setShowRejectModal(false); setRejectReason(''); setSelectedReport(null) }}
              className="btn-secondary w-full sm:w-auto"
            >
              Annuler
            </button>
            <button
              onClick={handleReject}
              disabled={actionLoading}
              className="btn-primary bg-red-600 hover:bg-red-700 w-full sm:w-auto"
            >
              {actionLoading ? (
                <Loader2 className="w-4 h-4 animate-spin mx-auto" />
              ) : (
                'Rejeter'
              )}
            </button>
          </div>
        </div>
      </Modal>

      {/* View Report Modal */}
      <Modal
        isOpen={!!selectedReport && !showRejectModal}
        onClose={() => { setSelectedReport(null); setDailySnapshots([]); }}
        title="Détails du rapport"
        size="lg"
      >
        {selectedReport && (
            <div className="space-y-4">
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <p className="text-sm text-gray-500 dark:text-gray-400">Projet</p>
                  <p className="font-medium dark:text-gray-100">{selectedReport.project?.name || 'N/A'}</p>
                </div>
                <div>
                  <p className="text-sm text-gray-500 dark:text-gray-400">Soumis par</p>
                  <p className="font-medium dark:text-gray-100">{selectedReport.submitter?.name || 'N/A'}</p>
                </div>
                <div>
                  <p className="text-sm text-gray-500 dark:text-gray-400">Période</p>
                  <p className="font-medium">
                    {selectedReport.week_number 
                      ? `Semaine ${selectedReport.week_number} (${new Date(selectedReport.start_date).toLocaleDateString('fr-FR')} - ${new Date(selectedReport.end_date).toLocaleDateString('fr-FR')})`
                      : `${selectedReport.report_month}/${selectedReport.report_year}`
                    }
                  </p>
                </div>
                <div>
                  <p className="text-sm text-gray-500 dark:text-gray-400">Statut</p>
                  {getStatusBadge(selectedReport.status)}
                </div>
              </div>

              <hr />

              {/* 1-2. Effectif & Induction */}
              <div className="bg-blue-50 dark:bg-blue-900/20 rounded-lg p-4">
                <h4 className="text-sm font-semibold text-blue-900 mb-3">1-2. Effectif & Induction</h4>
                <div className="grid grid-cols-2 gap-3">
                  <div className="bg-white dark:bg-gray-900 p-3 rounded-lg border border-blue-200 dark:border-blue-800">
                    <p className="text-xs text-gray-500 dark:text-gray-400">1. Effectif</p>
                    <p className="text-lg font-bold text-blue-600">{selectedReport.hours_worked || 0}</p>
                  </div>
                  <div className="bg-white dark:bg-gray-900 p-3 rounded-lg border border-blue-200 dark:border-blue-800">
                    <p className="text-xs text-gray-500 dark:text-gray-400">2. Induction</p>
                    <p className="text-lg font-bold text-blue-600">{selectedReport.employees_trained || 0}</p>
                  </div>
                </div>
              </div>

              {/* 3-4. Observations & Sensibilisation */}
              <div className="bg-amber-50 dark:bg-amber-900/20 rounded-lg p-4">
                <h4 className="text-sm font-semibold text-amber-900 mb-3">3-4. Observations & Sensibilisation</h4>
                <div className="grid grid-cols-2 gap-3">
                  <div className="bg-white dark:bg-gray-900 p-3 rounded-lg border border-amber-200 dark:border-amber-700">
                    <p className="text-xs text-gray-500 dark:text-gray-400">3. Relevé des écarts</p>
                    <p className="text-lg font-bold text-amber-600">{selectedReport.unsafe_conditions_reported || 0}</p>
                  </div>
                  <div className="bg-white dark:bg-gray-900 p-3 rounded-lg border border-amber-200 dark:border-amber-700">
                    <p className="text-xs text-gray-500 dark:text-gray-400">4. Nombre de Sensibilisation</p>
                    <p className="text-lg font-bold text-amber-600">{selectedReport.toolbox_talks || 0}</p>
                  </div>
                </div>
              </div>

              {/* 5-8. Accidents & Incidents */}
              <div className="bg-red-50 dark:bg-red-900/20 rounded-lg p-4">
                <h4 className="text-sm font-semibold text-red-900 mb-3">5-8. Accidents & Incidents</h4>
                <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
                  <div className="bg-white dark:bg-gray-900 p-3 rounded-lg border border-amber-200 dark:border-amber-700">
                    <p className="text-xs text-gray-500 dark:text-gray-400">5. Presqu'accident</p>
                    <p className="text-lg font-bold text-amber-600">{selectedReport.near_misses || 0}</p>
                  </div>
                  <div className="bg-white dark:bg-gray-900 p-3 rounded-lg border border-green-200 dark:border-green-700">
                    <p className="text-xs text-gray-500 dark:text-gray-400">6. Premiers soins</p>
                    <p className="text-lg font-bold text-green-600">{selectedReport.first_aid_cases || 0}</p>
                  </div>
                  <div className="bg-white dark:bg-gray-900 p-3 rounded-lg border border-red-300 dark:border-red-700">
                    <p className="text-xs text-gray-500 dark:text-gray-400">7. Accident</p>
                    <p className="text-lg font-bold text-red-600">{selectedReport.accidents || 0}</p>
                  </div>
                  <div className="bg-white dark:bg-gray-900 p-3 rounded-lg border border-orange-200 dark:border-orange-700">
                    <p className="text-xs text-gray-500 dark:text-gray-400">8. Nombre de jours d'arrêt</p>
                    <p className="text-lg font-bold text-orange-600">{selectedReport.lost_workdays || 0}</p>
                  </div>
                </div>
              </div>

              {/* 9-11. Inspections & Indicateurs */}
              <div className="bg-gray-50 dark:bg-gray-900 rounded-lg p-4">
                <h4 className="text-sm font-semibold text-gray-900 dark:text-gray-100 mb-3">9-11. Inspections & Indicateurs</h4>
                <div className="grid grid-cols-3 gap-3">
                  <div className="bg-white dark:bg-gray-900 p-3 rounded-lg border dark:border-gray-700">
                    <p className="text-xs text-gray-500 dark:text-gray-400">9. Nombre d'Inspections</p>
                    <p className="text-lg font-bold text-gray-700 dark:text-gray-100">{selectedReport.inspections_completed || 0}</p>
                  </div>
                  <div className="bg-white dark:bg-gray-900 p-3 rounded-lg border dark:border-gray-700">
                    <p className="text-xs text-gray-500 dark:text-gray-400">10. TG (Taux de Gravité)</p>
                    <p className="text-lg font-bold text-gray-700 dark:text-gray-100">{selectedReport.tg_value || 0}</p>
                  </div>
                  <div className="bg-white dark:bg-gray-900 p-3 rounded-lg border dark:border-gray-700">
                    <p className="text-xs text-gray-500 dark:text-gray-400">11. TF (Taux de Fréquence)</p>
                    <p className="text-lg font-bold text-gray-700 dark:text-gray-100">{selectedReport.tf_value || 0}</p>
                  </div>
                </div>
              </div>

              {/* 12-14. Formation, Permis & Discipline */}
              <div className="bg-purple-50 dark:bg-purple-900/20 rounded-lg p-4">
                <h4 className="text-sm font-semibold text-purple-900 mb-3">12-14. Formation, Permis & Discipline</h4>
                <div className="grid grid-cols-3 gap-3">
                  <div className="bg-white dark:bg-gray-900 p-3 rounded-lg border border-purple-200 dark:border-purple-700">
                    <p className="text-xs text-gray-500 dark:text-gray-400">12. Heures de formation</p>
                    <p className="text-lg font-bold text-purple-600">{selectedReport.training_hours || 0}h</p>
                  </div>
                  <div className="bg-white dark:bg-gray-900 p-3 rounded-lg border border-purple-200 dark:border-purple-700">
                    <p className="text-xs text-gray-500 dark:text-gray-400">13. Permis de travail</p>
                    <p className="text-lg font-bold text-purple-600">{selectedReport.work_permits || 0}</p>
                  </div>
                  <div className="bg-white dark:bg-gray-900 p-3 rounded-lg border border-purple-200 dark:border-purple-700">
                    <p className="text-xs text-gray-500 dark:text-gray-400">14. Mesures disciplinaires</p>
                    <p className="text-lg font-bold text-purple-600">{selectedReport.corrective_actions || 0}</p>
                  </div>
                </div>
              </div>

              {/* 15-17. Conformité & Suivi */}
              <div className="bg-green-50 dark:bg-green-900/20 rounded-lg p-4">
                <h4 className="text-sm font-semibold text-green-900 mb-3">15-17. Conformité & Suivi</h4>
                <div className="grid grid-cols-3 gap-3">
                  <div className="bg-white dark:bg-gray-900 p-3 rounded-lg border border-green-200 dark:border-green-700">
                    <p className="text-xs text-gray-500 dark:text-gray-400">15. Taux conformité HSE</p>
                    <p className="text-lg font-bold text-green-600">{selectedReport.ppe_compliance_rate || 0}%</p>
                  </div>
                  <div className="bg-white dark:bg-gray-900 p-3 rounded-lg border border-green-200 dark:border-green-700">
                    <p className="text-xs text-gray-500 dark:text-gray-400">16. Taux conformité médecine</p>
                    <p className="text-lg font-bold text-green-600">{selectedReport.medical_compliance_rate || 0}%</p>
                  </div>
                  <div className="bg-white dark:bg-gray-900 p-3 rounded-lg border border-green-200 dark:border-green-700">
                    <p className="text-xs text-gray-500 dark:text-gray-400">17. Suivi du bruit</p>
                    <p className="text-lg font-bold text-green-600">{selectedReport.noise_monitoring || 0} dB</p>
                  </div>
                </div>
              </div>

              {/* 18-19. Consommation d'énergie */}
              <div className="bg-cyan-50 dark:bg-cyan-900/20 rounded-lg p-4">
                <h4 className="text-sm font-semibold text-cyan-900 mb-3">18-19. Consommation d'énergie</h4>
                <div className="grid grid-cols-2 gap-3">
                  <div className="bg-white dark:bg-gray-900 p-3 rounded-lg border border-cyan-200 dark:border-cyan-700">
                    <p className="text-xs text-gray-500 dark:text-gray-400">18. Consommation : Eau</p>
                    <p className="text-lg font-bold text-cyan-600">{selectedReport.water_consumption || 0} m³</p>
                  </div>
                  <div className="bg-white dark:bg-gray-900 p-3 rounded-lg border border-cyan-200 dark:border-cyan-700">
                    <p className="text-xs text-gray-500 dark:text-gray-400">19. Consommation : Électricité</p>
                    <p className="text-lg font-bold text-cyan-600">{selectedReport.electricity_consumption || 0} kWh</p>
                  </div>
                </div>
              </div>

              {selectedReport.rejection_reason && (
                <div className="bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-700 rounded-lg p-4">
                  <p className="text-sm font-medium text-red-800 dark:text-red-200 mb-1">⚠️ Précédemment rejeté</p>
                  <p className="text-red-700 dark:text-red-300 text-sm">{selectedReport.rejection_reason}</p>
                  {selectedReport.rejected_at && (
                    <p className="text-red-600 dark:text-red-300 text-xs mt-2">
                      Rejeté le {new Date(selectedReport.rejected_at).toLocaleDateString('fr-FR')}
                    </p>
                  )}
                </div>
              )}

              {selectedReport.notes && (
                <div>
                  <p className="text-sm text-gray-500 dark:text-gray-400 mb-1">Notes</p>
                  <p className="bg-gray-50 dark:bg-gray-900 p-3 rounded-lg text-gray-700 dark:text-gray-100">{selectedReport.notes}</p>
                </div>
              )}

              {/* Daily Snapshots */}
              {loadingDetails ? (
                <div className="flex items-center justify-center py-4">
                  <Loader2 className="w-5 h-5 animate-spin text-gray-400" />
                  <span className="ml-2 text-sm text-gray-500 dark:text-gray-400">Chargement des données journalières...</span>
                </div>
              ) : (
                <DailyKpiPreview dailySnapshots={dailySnapshots} />
              )}

              {selectedReport.status === 'submitted' && (
                <div className="flex gap-3 pt-4 border-t dark:border-gray-700">
                  <button
                    onClick={() => handleApprove(selectedReport.id)}
                    disabled={actionLoading}
                    className="btn-primary flex-1 flex items-center justify-center gap-2"
                  >
                    <Check className="w-4 h-4" />
                    Approuver
                  </button>
                  <button
                    onClick={() => {
                      setShowRejectModal(true)
                    }}
                    className="btn-secondary flex-1 flex items-center justify-center gap-2 text-red-600 dark:text-red-400 border-red-200 dark:border-red-700 hover:bg-red-50 dark:hover:bg-red-900/30"
                  >
                    <X className="w-4 h-4" />
                    Rejeter
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
              {projects.map((project) => (
                <option key={project.id} value={project.id}>
                  {project.name} ({project.code})
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
              <select
                value={exportParams.week}
                onChange={(e) => setExportParams({ ...exportParams, week: parseInt(e.target.value) })}
                className="input w-full"
              >
                {weekOptions.map((week) => (
                  <option key={week} value={week}>
                    {t('hseExport.week')} {week}
                  </option>
                ))}
              </select>
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                {t('hseExport.year')} *
              </label>
              <select
                value={exportParams.year}
                onChange={(e) => setExportParams({ ...exportParams, year: parseInt(e.target.value) })}
                className="input w-full"
              >
                {yearOptions.map((year) => (
                  <option key={year} value={year}>
                    {year}
                  </option>
                ))}
              </select>
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
