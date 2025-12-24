import { useState, useEffect, useMemo, useRef } from 'react'
import { Link } from 'react-router-dom'
import { dashboardService, projectService } from '../../services/api'
import { useAuthStore } from '../../store/authStore'
import { useLanguage } from '../../i18n'
import {
  FolderKanban,
  FileText,
  Clock,
  AlertTriangle,
  GraduationCap,
  ClipboardCheck,
  TrendingUp,
  Calendar,
  PlusCircle,
  Loader2,
  CheckCircle,
  XCircle,
  Edit,
  RefreshCw,
  ChevronLeft,
  ChevronRight
} from 'lucide-react'
import {
  LineChart,
  Line,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
  Legend
} from 'recharts'
import toast from 'react-hot-toast'
import { getCurrentWeek } from '../../utils/weekHelper'
import { getProjectLabel, sortProjects } from '../../utils/projectList'
import { useDevStore, DEV_PROJECT_SCOPE } from '../../store/devStore'

export default function UserDashboard() {
  const [data, setData] = useState(null)
  const [loading, setLoading] = useState(true)
  const [year, setYear] = useState(new Date().getFullYear())
  const [selectedProject, setSelectedProject] = useState('all')
  const [selectedPole, setSelectedPole] = useState('')
  const [poles, setPoles] = useState([])
  const [selectedWeekDetails, setSelectedWeekDetails] = useState(null)
  const { user } = useAuthStore()
  const { projectScope } = useDevStore()
  const { t } = useLanguage()
  const weekScrollRef = useRef(null)

  useEffect(() => {
    fetchDashboardData()
  }, [year, selectedProject, selectedPole, projectScope])

  useEffect(() => {
    const fetchPoles = async () => {
      try {
        const params = {}
        if (user?.role === 'dev' && projectScope === DEV_PROJECT_SCOPE.ASSIGNED) {
          params.scope = 'assigned'
        }
        const res = await projectService.getPoles(params)
        const values = res.data?.data?.poles ?? res.data?.poles ?? []
        setPoles(Array.isArray(values) ? values : [])
      } catch (e) {
        setPoles([])
      }
    }
    fetchPoles()
  }, [user?.role, projectScope])

  // Scroll to current week when data loads
  useEffect(() => {
    if (data && weekScrollRef.current) {
      requestAnimationFrame(() => {
        if (!weekScrollRef.current) return
        weekScrollRef.current.scrollTo({ left: weekScrollRef.current.scrollWidth, behavior: 'auto' })
      })
    }
  }, [data, year])

  const fetchDashboardData = async () => {
    try {
      setLoading(true)
      const params = { year }
      if (selectedPole) params.pole = selectedPole
      if (selectedProject !== 'all') params.project_id = selectedProject
      if (user?.role === 'dev' && projectScope === DEV_PROJECT_SCOPE.ASSIGNED) {
        params.scope = 'assigned'
      }
      const response = await dashboardService.getUserDashboard(params)
      setData(response.data.data)
    } catch (error) {
      toast.error(t('errors.failedToLoad'))
    } finally {
      setLoading(false)
    }
  }

  const monthNames = t('datePicker.months')

  const stats = data?.stats ?? {}
  const kpiSummary = data?.kpi_summary ?? {}
  const trainingData = data?.training_data ?? {}
  const inspectionData = data?.inspection_data ?? {}
  const focusedKpiSummary = {
    ...kpiSummary,
    total_trainings: trainingData?.total ?? kpiSummary.total_trainings ?? 0,
    total_inspections: inspectionData?.stats?.total ?? kpiSummary.total_inspections ?? 0,
  }
  const projects = data?.projects ?? []
  const projectListPreference = user?.project_list_preference ?? 'code'
  const sortedProjects = useMemo(() => {
    return sortProjects(projects, projectListPreference)
  }, [projects, projectListPreference])
  const recentReports = data?.recent_reports ?? []

  useEffect(() => {
    if (!selectedPole) return
    if (selectedProject === 'all') return
    const ok = projects.some((p) => String(p.id) === String(selectedProject) && p?.pole === selectedPole)
    if (!ok) {
      setSelectedProject('all')
    }
  }, [selectedPole, selectedProject, projects])

  if (loading) {
    return (
      <div className="flex items-center justify-center h-96">
        <Loader2 className="w-8 h-8 animate-spin text-hse-primary" />
      </div>
    )
  }

  return (
    <div className="space-y-6 animate-fade-in">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-gray-900 dark:text-gray-100">
            {t('dashboard.welcome')}, {user?.name?.split(' ')[0]}!
          </h1>
          <p className="text-gray-500 dark:text-gray-400 mt-1">{t('dashboard.overview')}</p>
        </div>
        <div className="flex items-center gap-3">
          <div className="flex items-center gap-2 bg-white dark:bg-gray-800 rounded-lg border border-gray-200 dark:border-gray-700 px-3 py-2">
            <Calendar className="w-4 h-4 text-gray-400" />
            <select
              value={year}
              onChange={(e) => setYear(Number(e.target.value))}
              className="bg-transparent border-none focus:ring-0 text-sm font-medium dark:text-gray-200"
            >
              {[...Array(5)].map((_, i) => {
                const y = new Date().getFullYear() - i
                return <option key={y} value={y}>{y}</option>
              })}
            </select>
          </div>
          {poles.length > 0 && (
            <div className="flex items-center gap-2 bg-white dark:bg-gray-800 rounded-lg border border-gray-200 dark:border-gray-700 px-3 py-2">
              <select
                value={selectedPole}
                onChange={(e) => {
                  setSelectedPole(e.target.value)
                  setSelectedProject('all')
                }}
                className="bg-transparent border-none focus:ring-0 text-sm font-medium dark:text-gray-200"
              >
                <option value="">{t('common.allPoles')}</option>
                {poles.map((p) => (
                  <option key={p} value={p}>
                    {p}
                  </option>
                ))}
              </select>
            </div>
          )}
          <Link to="/kpi/submit" className="btn-primary flex items-center gap-2">
            <PlusCircle className="w-4 h-4" />
            {t('kpi.submission')}
          </Link>
        </div>
      </div>

      {/* Stats Grid */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        <StatCard
          title={t('nav.myProjects')}
          value={stats.assigned_projects ?? 0}
          icon={FolderKanban}
          color="blue"
        />
        <StatCard
          title={t('dashboard.recentSubmissions')}
          value={stats.reports_submitted ?? 0}
          subtitle={`${year}`}
          icon={FileText}
          color="green"
        />
        <StatCard
          title={t('dashboard.pendingReports')}
          value={stats.pending_approval ?? 0}
          icon={Clock}
          color="amber"
        />
        <StatCard
          title={t('kpi.status.draft')}
          value={stats.draft_reports ?? 0}
          icon={FileText}
          color="purple"
        />
      </div>

      {/* KPI Summary */}
      <div className="grid grid-cols-2 lg:grid-cols-5 gap-4">
        <KpiCard
          title={t('kpi.accidents.title')}
          value={focusedKpiSummary.total_accidents ?? 0}
          icon={AlertTriangle}
          color={focusedKpiSummary.total_accidents > 0 ? 'red' : 'green'}
        />
        <KpiCard
          title={t('kpi.training.title')}
          value={focusedKpiSummary.total_trainings ?? 0}
          icon={GraduationCap}
          color="blue"
        />
        <KpiCard
          title={t('kpi.inspections.title')}
          value={focusedKpiSummary.total_inspections ?? 0}
          icon={ClipboardCheck}
          color="green"
        />
        <KpiCard
          title={t('dashboard.avgTf')}
          value={Number(focusedKpiSummary.avg_tf ?? 0).toFixed(2)}
          icon={TrendingUp}
          color="amber"
        />
        <KpiCard
          title={t('dashboard.avgTg')}
          value={Number(focusedKpiSummary.avg_tg ?? 0).toFixed(2)}
          icon={TrendingUp}
          color="purple"
        />
      </div>

      {/* Projects and Recent Reports */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* My Projects */}
        <div className="card">
          <div className="card-header flex items-center justify-between">
            <h3 className="font-semibold text-gray-900 dark:text-gray-100">{t('nav.myProjects')}</h3>
            <Link to="/my-projects" className="text-sm text-hse-primary hover:underline">
              {t('common.view')}
            </Link>
          </div>
          <div className="divide-y divide-gray-100 dark:divide-gray-700">
            {projects.slice(0, 4).map((project) => (
              <div key={project.id} className="p-4 hover:bg-gray-50 dark:hover:bg-gray-700/50">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-3">
                    <div className="w-10 h-10 bg-hse-primary/10 dark:bg-hse-primary/20 rounded-lg flex items-center justify-center">
                      <FolderKanban className="w-5 h-5 text-hse-primary" />
                    </div>
                    <div>
                      <p className="font-medium text-gray-900 dark:text-gray-100">{project.name}</p>
                      <p className="text-sm text-gray-500 dark:text-gray-400">{project.code}</p>
                    </div>
                  </div>
                  <Link
                    to={`/kpi/submit/${project.id}`}
                    className="btn-outline text-xs py-1 px-3"
                  >
                    {t('kpi.submission')}
                  </Link>
                </div>
              </div>
            ))}
            {projects.length === 0 && (
              <div className="p-8 text-center text-gray-500 dark:text-gray-400">
                {t('projects.noProjects')}
              </div>
            )}
          </div>
        </div>

        {/* Drafts & Rejected (need attention) */}
        {(() => {
          const drafts = recentReports.filter(r => r.status === 'draft')
          if (drafts.length === 0) return null
          return (
            <div className="card border-amber-200 dark:border-amber-700 bg-amber-50/30 dark:bg-amber-900/20">
              <div className="card-header flex items-center justify-between bg-amber-50 dark:bg-amber-900/30 border-b border-amber-200 dark:border-amber-700">
                <h3 className="font-semibold text-amber-900 dark:text-amber-300 flex items-center gap-2">
                  <RefreshCw className="w-4 h-4" />
                  {t('dashboard.draftsToComplete')}
                </h3>
                <span className="bg-amber-100 dark:bg-amber-800 text-amber-800 dark:text-amber-100 text-xs font-medium px-2 py-1 rounded-full">
                  {drafts.length} {drafts.length > 1 ? t('dashboard.draftLabelPlural') : t('dashboard.draftLabel')}
                </span>
              </div>
              <div className="divide-y divide-amber-100 dark:divide-amber-800">
                {drafts.map((report) => (
                  <div key={report.id} className="p-4 hover:bg-amber-50/50 dark:hover:bg-amber-900/30">
                    <div className="flex items-center justify-between">
                      <div>
                        <p className="font-medium text-gray-900 dark:text-gray-100">
                          {report.project?.name}
                        </p>
                        <p className="text-sm text-gray-600 dark:text-gray-400">
                          {report.week_number
                            ? t('dashboard.weekLabel')
                                .replace('{{week}}', report.week_number)
                                .replace('{{year}}', report.report_year)
                            : t('dashboard.monthYearLabel')
                                .replace('{{month}}', monthNames[report.report_month - 1])
                                .replace('{{year}}', report.report_year)
                          }
                        </p>
                        {report.rejection_reason && (
                          <div className="mt-2 p-2 bg-red-50 dark:bg-red-900/30 border border-red-200 dark:border-red-700 rounded text-xs text-red-700 dark:text-red-300">
                            <strong>{t('kpi.rejectionReason')}:</strong> {report.rejection_reason}
                          </div>
                        )}
                      </div>
                      <Link
                        to={`/kpi/edit/${report.id}`}
                        className="btn-primary text-sm py-2 px-4 flex items-center gap-2"
                      >
                        <Edit className="w-4 h-4" />
                        {t('common.edit')}
                      </Link>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )
        })()}

        {/* Recent Reports */}
        <div className="card">
          <div className="card-header flex items-center justify-between">
            <h3 className="font-semibold text-gray-900 dark:text-gray-100">{t('dashboard.recentSubmissions')}</h3>
            <Link to="/kpi/history" className="text-sm text-hse-primary hover:underline">
              {t('common.view')}
            </Link>
          </div>
          <div className="divide-y divide-gray-100 dark:divide-gray-700">
            {recentReports.filter(r => r.status !== 'draft').slice(0, 4).map((report) => (
              <div key={report.id} className="p-4 hover:bg-gray-50 dark:hover:bg-gray-700/50">
                <div className="flex items-center justify-between">
                  <div>
                    <p className="font-medium text-gray-900 dark:text-gray-100">
                      {report.project?.name ?? ''}
                    </p>
                    <p className="text-sm text-gray-500 dark:text-gray-400">
                      {report.week_number
                        ? t('dashboard.weekLabel')
                            .replace('{{week}}', report.week_number)
                            .replace('{{year}}', report.report_year)
                        : t('dashboard.monthYearLabel')
                            .replace('{{month}}', monthNames[report.report_month - 1])
                            .replace('{{year}}', report.report_year)
                      }
                    </p>
                  </div>
                  <div className="flex items-center gap-2">
                    {report.status === 'approved' && (
                      <CheckCircle className="w-5 h-5 text-green-500" />
                    )}
                    {report.status === 'rejected' && (
                      <XCircle className="w-5 h-5 text-red-500" />
                    )}
                    {report.status === 'submitted' && (
                      <Clock className="w-5 h-5 text-amber-500" />
                    )}
                    <span className={`badge ${
                      report.status === 'approved' ? 'badge-success' :
                      report.status === 'submitted' ? 'badge-warning' :
                      report.status === 'rejected' ? 'badge-danger' : 'badge-info'
                    }`}>
                      {t(`kpi.status.${report.status}`)}
                    </span>
                  </div>
                </div>
              </div>
            ))}
            {recentReports.filter(r => r.status !== 'draft').length === 0 && (
              <div className="p-8 text-center text-gray-500 dark:text-gray-400">
                {t('kpi.noReports')}
              </div>
            )}
          </div>
        </div>
      </div>

      {/* Weekly Status - Horizontal Scroll */}
      <div className="card">
        <div className="card-header flex items-center justify-between">
          <h3 className="font-semibold text-gray-900 dark:text-gray-100">{t('dashboard.submissionStatus')}</h3>
          <div className="flex items-center gap-2">
            {/* Project Filter */}
            <select
              value={selectedProject}
              onChange={(e) => setSelectedProject(e.target.value)}
              className="bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-600 rounded-lg px-3 py-1.5 text-sm font-medium dark:text-gray-200 focus:ring-2 focus:ring-hse-primary"
            >
              <option value="all">{t('common.allProjects')}</option>
              {sortedProjects.map(project => (
                <option key={project.id} value={project.id}>{getProjectLabel(project)}</option>
              ))}
            </select>
            {/* Year Filter */}
            <select
              value={year}
              onChange={(e) => setYear(Number(e.target.value))}
              className="bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-600 rounded-lg px-3 py-1.5 text-sm font-medium dark:text-gray-200 focus:ring-2 focus:ring-hse-primary"
            >
              {[...Array(5)].map((_, i) => {
                const y = new Date().getFullYear() - i
                return <option key={y} value={y}>{y}</option>
              })}
            </select>
          </div>
        </div>
        <div className="p-4">
          {/* Scroll Navigation */}
          <div className="relative">
            <button
              onClick={() => weekScrollRef.current?.scrollBy({ left: -300, behavior: 'smooth' })}
              className="absolute left-0 top-1/2 -translate-y-1/2 z-10 bg-white/90 dark:bg-gray-700/90 hover:bg-white dark:hover:bg-gray-600 shadow-lg rounded-full p-2 border dark:border-gray-600"
            >
              <ChevronLeft className="w-5 h-5 text-gray-600 dark:text-gray-300" />
            </button>
            
            <button
              onClick={() => weekScrollRef.current?.scrollBy({ left: 300, behavior: 'smooth' })}
              className="absolute right-0 top-1/2 -translate-y-1/2 z-10 bg-white/90 dark:bg-gray-700/90 hover:bg-white dark:hover:bg-gray-600 shadow-lg rounded-full p-2 border dark:border-gray-600"
            >
              <ChevronRight className="w-5 h-5 text-gray-600 dark:text-gray-300" />
            </button>
            
            {/* Scrollable Week Container */}
            <div 
              ref={weekScrollRef}
              className="flex gap-2 overflow-x-auto scroll-smooth px-10 py-3 scrollbar-thin scrollbar-thumb-gray-300 scrollbar-track-gray-100"
              style={{ scrollbarWidth: 'thin' }}
            >
              {(() => {
                const currentWeekInfo = getCurrentWeek()
                // Only show weeks up to current week for current year, or all 52 for past years
                const maxWeek = year < currentWeekInfo.year ? 52 : currentWeekInfo.week
                return Array.from({ length: maxWeek }, (_, i) => i + 1)
              })().map((weekNum) => {
                const weekData = data?.weekly_status?.find(w => w.week === weekNum)
                const currentWeekInfo = getCurrentWeek()
                const isPast = (year < currentWeekInfo.year) || (year === currentWeekInfo.year && weekNum < currentWeekInfo.week)
                const isCurrent = weekNum === currentWeekInfo.week && year === currentWeekInfo.year
                
                // Get status based on selected project filter
                let status = 'not_submitted'
                let projectsInfo = weekData?.projects ?? []
                
                if (selectedProject === 'all') {
                  status = weekData?.status ?? 'not_submitted'
                } else {
                  const projectData = projectsInfo.find(p => p.project_id === parseInt(selectedProject))
                  status = projectData?.status ?? 'not_submitted'
                }
                
                // Count statuses for multi-project display
                const approvedCount = weekData?.approved_count ?? 0
                const submittedCount = weekData?.submitted_count ?? 0
                const draftCount = weekData?.draft_count ?? 0
                const totalProjects = weekData?.total_projects ?? 0
                
                // Build gradient for partial status based on actual project statuses
                let partialGradient = ''
                if (status === 'partial' && totalProjects > 0) {
                  const colors = []
                  if (approvedCount > 0) colors.push('rgb(34, 197, 94)') // green-500
                  if (submittedCount > 0) colors.push('rgb(251, 191, 36)') // amber-400
                  if (draftCount > 0) colors.push('rgb(96, 165, 250)') // blue-400
                  const notSubmitted = totalProjects - approvedCount - submittedCount - draftCount
                  if (notSubmitted > 0) colors.push('rgb(254, 202, 202)') // red-200
                  partialGradient = colors.length > 1 
                    ? `linear-gradient(135deg, ${colors.join(', ')})` 
                    : ''
                }
                
                return (
                  <div
                    key={`week-${year}-${weekNum}`}
                    data-week={weekNum}
                    className={`relative flex-shrink-0 w-14 p-2 rounded-lg text-center transition-all cursor-pointer ${
                      selectedWeekDetails === weekNum ? 'ring-2 ring-gray-900 ring-offset-2 scale-110' : ''
                    } ${
                      isCurrent && selectedWeekDetails !== weekNum ? 'ring-2 ring-hse-primary ring-offset-2' : ''
                    } ${
                      status === 'approved' ? 'bg-green-500 text-white' :
                      status === 'partial' ? 'text-white' :
                      status === 'submitted' ? 'bg-amber-400 text-white' :
                      status === 'draft' ? 'bg-blue-400 text-white' :
                      isPast ? 'bg-red-100 text-red-600 hover:bg-red-200' :
                      'bg-gray-100 text-gray-500'
                    }`}
                    style={status === 'partial' && partialGradient ? { background: partialGradient } : {}}
                    onClick={() => setSelectedWeekDetails(selectedWeekDetails === weekNum ? null : weekNum)}
                  >
                    <p className="text-xs font-medium">
                      {t('dashboard.weekShortPrefix')}
                      {weekNum}
                    </p>
                    {selectedProject === 'all' && totalProjects > 1 ? (
                      <p className="text-xs font-bold mt-0.5">
                        {approvedCount + submittedCount}/{totalProjects}
                      </p>
                    ) : (
                      <p className="text-lg font-bold mt-0.5">
                        {status === 'approved' ? '✓' : 
                         status === 'partial' ? '◐' :
                         status === 'submitted' ? '⏳' : 
                         status === 'draft' ? '📝' :
                         isPast ? '!' : '-'}
                      </p>
                    )}
                    
                  </div>
                )
              })}
            </div>
          </div>
          
          {/* Week Details Panel - shown when a week is clicked */}
          {selectedWeekDetails && (() => {
            const weekData = data?.weekly_status?.find(w => w.week === selectedWeekDetails)
            const projectsInfo = weekData?.projects || []
            const currentWeekInfo = getCurrentWeek()
            const isCurrentWeek = selectedWeekDetails === currentWeekInfo.week && year === currentWeekInfo.year
            const isPastWeek = (year < currentWeekInfo.year) || (year === currentWeekInfo.year && selectedWeekDetails < currentWeekInfo.week)
            
            if (projectsInfo.length === 0) return null
            
            return (
              <div className="mt-3 p-3 bg-gray-900 text-white text-xs rounded-lg shadow-xl">
                <div className="flex items-center justify-between border-b border-gray-700 pb-2 mb-2">
                  <p className="font-semibold">
                    {t('dashboard.weekDetailsTitle').replace('{{week}}', selectedWeekDetails)}
                    {isCurrentWeek && (
                      <span className="ml-2 text-hse-primary">
                        ({t('dashboard.currentWeekLabel')})
                      </span>
                    )}
                  </p>
                  <button 
                    onClick={() => setSelectedWeekDetails(null)}
                    className="text-gray-400 hover:text-white"
                  >
                    ✕
                  </button>
                </div>
                <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-2">
                  {projectsInfo.map((proj) => {
                    const isNotSubmitted = proj.status === 'not_submitted'
                    const showAsMissing = isNotSubmitted && isPastWeek
                    const showAsNotYet = isNotSubmitted && !isPastWeek
                    
                    return (
                      <div key={proj.project_id} className="flex items-center justify-between gap-2 bg-gray-800 rounded px-2 py-1.5">
                        <span className="truncate font-medium">{proj.project_code}</span>
                        <span className={`flex-shrink-0 px-1.5 py-0.5 rounded text-[10px] font-medium ${
                          proj.status === 'approved' ? 'bg-green-500' :
                          proj.status === 'submitted' ? 'bg-amber-400' :
                          proj.status === 'draft' ? 'bg-blue-400' :
                          showAsMissing ? 'bg-red-400' :
                          'bg-gray-500'
                        }`}>
                          {proj.status === 'approved' ? t('status.approved') :
                           proj.status === 'submitted' ? t('status.pending') :
                           proj.status === 'draft' ? t('status.draft') :
                           showAsMissing ? t('status.missing') :
                           t('status.notSubmitted')}
                        </span>
                      </div>
                    )
                  })}
                </div>
              </div>
            )
          })()}
          
          {/* Legend */}
          <div className="flex flex-wrap items-center justify-center gap-4 pt-4 mt-2 border-t dark:border-gray-700 text-xs text-gray-600 dark:text-gray-400">
            <span className="flex items-center gap-1.5">
              <span className="w-3 h-3 rounded bg-green-500" /> {t('status.approved')}
            </span>
            <span className="flex items-center gap-1.5">
              <span className="w-3 h-3 rounded bg-gradient-to-br from-green-400 to-amber-400" /> {t('status.partial')}
            </span>
            <span className="flex items-center gap-1.5">
              <span className="w-3 h-3 rounded bg-amber-400" /> {t('status.pending')}
            </span>
            <span className="flex items-center gap-1.5">
              <span className="w-3 h-3 rounded bg-blue-400" /> {t('status.draft')}
            </span>
            <span className="flex items-center gap-1.5">
              <span className="w-3 h-3 rounded bg-red-100 border border-red-200" /> {t('status.missing')}
            </span>
            <span className="flex items-center gap-1.5">
              <span className="w-3 h-3 rounded ring-2 ring-hse-primary ring-offset-1" /> {t('dashboard.currentWeekLabel')}
            </span>
          </div>
        </div>
      </div>
    </div>
  )
}

function StatCard({ title, value, subtitle, icon: Icon, color }) {
  const colors = {
    blue: 'bg-blue-50 text-blue-600 dark:bg-blue-900/30 dark:text-blue-400',
    green: 'bg-green-50 text-green-600 dark:bg-green-900/30 dark:text-green-400',
    amber: 'bg-amber-50 text-amber-600 dark:bg-amber-900/30 dark:text-amber-400',
    purple: 'bg-purple-50 text-purple-600 dark:bg-purple-900/30 dark:text-purple-400',
  }

  return (
    <div className="stat-card">
      <div className="flex items-start justify-between">
        <div>
          <p className="text-sm text-gray-500 dark:text-gray-400">{title}</p>
          <p className="text-2xl font-bold text-gray-900 dark:text-gray-100 mt-1">{value}</p>
          {subtitle && <p className="text-xs text-gray-400 dark:text-gray-500 mt-1">{subtitle}</p>}
        </div>
        <div className={`p-3 rounded-lg ${colors[color]}`}>
          <Icon className="w-5 h-5" />
        </div>
      </div>
    </div>
  )
}

function KpiCard({ title, value, icon: Icon, color }) {
  const colors = {
    red: 'border-red-200 bg-red-50 dark:border-red-700 dark:bg-red-900/50',
    green: 'border-green-200 bg-green-50 dark:border-green-700 dark:bg-green-900/50',
    blue: 'border-blue-200 bg-blue-50 dark:border-blue-700 dark:bg-blue-900/50',
    amber: 'border-amber-200 bg-amber-50 dark:border-amber-700 dark:bg-amber-900/50',
    purple: 'border-purple-200 bg-purple-50 dark:border-purple-700 dark:bg-purple-900/50',
  }

  const iconColors = {
    red: 'text-red-600 dark:text-red-400',
    green: 'text-green-600 dark:text-green-400',
    blue: 'text-blue-600 dark:text-blue-400',
    amber: 'text-amber-600 dark:text-amber-400',
    purple: 'text-purple-600 dark:text-purple-400',
  }

  return (
    <div className={`rounded-xl border-2 p-4 ${colors[color]}`}>
      <div className="flex items-center gap-2 mb-2">
        <Icon className={`w-5 h-5 ${iconColors[color]}`} />
        <span className="text-sm font-medium text-gray-600 dark:text-gray-300">{title}</span>
      </div>
      <p className="text-2xl font-bold text-gray-900 dark:text-gray-100">{value}</p>
    </div>
  )
}
