import { useState, useEffect, useMemo, useCallback, memo, useRef } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import { dashboardService, exportService } from '../../services/api'
import { cachedApiCall, invalidateCache } from '../../utils/apiCache'
import {
  Users,
  FolderKanban,
  AlertTriangle,
  GraduationCap,
  ClipboardCheck,
  TrendingUp,
  TrendingDown,
  Calendar,
  FileSpreadsheet,
  FileText,
  Loader2,
  Shield,
  Activity,
  Target,
  Leaf,
  ChevronLeft,
  ChevronRight
} from 'lucide-react'
import {
  LineChart,
  Line,
  BarChart,
  Bar,
  ComposedChart,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
  Legend,
  PieChart,
  Pie,
  Cell,
  AreaChart,
  Area,
  RadarChart,
  PolarGrid,
  PolarAngleAxis,
  PolarRadiusAxis,
  Radar
} from 'recharts'
import toast from 'react-hot-toast'
import { useTranslation } from '../../i18n'
import ThemeSelector from '../../components/dashboard/ThemeSelector'
import SafetyTheme from '../../components/dashboard/themes/SafetyTheme'
import TrainingTheme from '../../components/dashboard/themes/TrainingTheme'
import ComplianceTheme from '../../components/dashboard/themes/ComplianceTheme'
import EnvironmentalTheme from '../../components/dashboard/themes/EnvironmentalTheme'
import { getCurrentWeek } from '../../utils/weekHelper'

const COLORS = ['#dc2626', '#f59e0b', '#16a34a', '#3b82f6', '#8b5cf6', '#ec4899', '#14b8a6']

export default function AdminDashboard() {
  const t = useTranslation()
  const [data, setData] = useState(null)
  const [loading, setLoading] = useState(true)
  const [year, setYear] = useState(new Date().getFullYear())
  const [compareYear, setCompareYear] = useState(new Date().getFullYear() - 1)
  const [compareSummary, setCompareSummary] = useState(null)
  const [exporting, setExporting] = useState(false)
  const [activeTheme, setActiveTheme] = useState('overview')
  const [selectedWeek, setSelectedWeek] = useState(null)
  const [selectedStatusProject, setSelectedStatusProject] = useState('all')
  const [selectedStatusWeek, setSelectedStatusWeek] = useState(null)
  const weekStatusScrollRef = useRef(null)
  const navigate = useNavigate()

  // Memoize fetch function to prevent recreation on every render
  const fetchDashboardData = useCallback(async () => {
    try {
      setLoading(true)
      // Use cached API call with 30 second cache
      const response = await cachedApiCall(
        dashboardService.getAdminDashboard,
        '/dashboard/admin',
        { year },
        30000 // 30 seconds cache
      )
      setData(response.data.data)
    } catch (error) {
      toast.error('Failed to load dashboard data')
    } finally {
      setLoading(false)
    }
  }, [year])

  const fetchCompareData = useCallback(async () => {
    if (!compareYear) {
      setCompareSummary(null)
      return
    }
    try {
      const response = await cachedApiCall(
        dashboardService.getAdminDashboard,
        '/dashboard/admin',
        { year: compareYear },
        30000
      )
      setCompareSummary(response.data.data?.kpi_summary || {})
    } catch (error) {
      console.error('Failed to load comparison dashboard data', error)
    }
  }, [compareYear])

  useEffect(() => {
    fetchDashboardData()
    fetchCompareData()
  }, [fetchDashboardData, fetchCompareData])

  useEffect(() => {
    setCompareYear(year - 1)
  }, [year])

  // Memoize export handler
  const handleExport = useCallback(async (type) => {
    setExporting(true)
    try {
      const response = type === 'excel' 
        ? await exportService.exportExcel({ year })
        : await exportService.exportPdf({ year })
      
      const blob = new Blob([response.data], {
        type: type === 'excel' 
          ? 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet'
          : 'application/pdf'
      })
      
      const url = window.URL.createObjectURL(blob)
      const a = document.createElement('a')
      a.href = url
      a.download = `kpi_report_${year}.${type === 'excel' ? 'xlsx' : 'pdf'}`
      a.click()
      window.URL.revokeObjectURL(url)
      toast.success(`Report exported successfully`)
    } catch (error) {
      toast.error('Failed to export report')
    } finally {
      setExporting(false)
    }
  }, [year])

  // Memoize expensive data transformations (must be before any early returns!)
  const stats = useMemo(() => data?.stats || {}, [data?.stats])
  const kpiSummary = useMemo(() => data?.kpi_summary || {}, [data?.kpi_summary])
  const weeklyTrends = useMemo(() => data?.weekly_trends || [], [data?.weekly_trends])
  const projectPerformance = useMemo(() => data?.project_performance || [], [data?.project_performance])
  const weeklyStatus = useMemo(() => data?.weekly_status || [], [data?.weekly_status])
  const projects = useMemo(() => data?.projects || [], [data?.projects])
  
  // Real data from specific tables
  const trainingData = useMemo(() => data?.training_data || {}, [data?.training_data])
  const awarenessData = useMemo(() => data?.awareness_data || {}, [data?.awareness_data])
  const sorData = useMemo(() => data?.sor_data || {}, [data?.sor_data])
  const permitData = useMemo(() => data?.permit_data || {}, [data?.permit_data])

  const handleWeeklyChartClick = useCallback((chartState) => {
    if (!chartState || !chartState.activeLabel) return
    const label = chartState.activeLabel
    const point = weeklyTrends.find((w) => w.week_label === label)
    if (point) {
      setSelectedWeek(point)
      const params = new URLSearchParams()

      // Try to determine week number from point or label
      let weekValue = point.week
      if (!weekValue && typeof label === 'string') {
        const numeric = parseInt(label.replace(/\D/g, ''), 10)
        if (!Number.isNaN(numeric)) {
          weekValue = numeric
        }
      }
      if (weekValue) params.set('week', weekValue)

      const yearValue = point.year || year
      if (yearValue) params.set('year', yearValue)

      navigate(`/admin/kpi?${params.toString()}`)
    }
  }, [weeklyTrends, year, navigate])
  
  // Memoize year options to prevent recreation
  const yearOptions = useMemo(() => {
    return [...Array(5)].map((_, i) => new Date().getFullYear() - i)
  }, [])

  // Loading state (after all hooks)
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
          <h1 className="text-2xl font-bold text-gray-900 dark:text-gray-100">{t('dashboard.adminTitle')}</h1>
          <p className="text-gray-500 dark:text-gray-400 mt-1">{t('dashboard.overview')}</p>
        </div>
        <div className="flex items-center gap-3">
          {/* Year selector */}
          <div className="flex items-center gap-2 bg-white dark:bg-gray-800 rounded-lg border border-gray-200 dark:border-gray-700 px-3 py-2">
            <Calendar className="w-4 h-4 text-gray-400" />
            <select
              value={year}
              onChange={(e) => setYear(Number(e.target.value))}
              className="bg-transparent border-none focus:ring-0 text-sm font-medium dark:text-gray-200"
            >
              {yearOptions.map((y) => (
                <option key={y} value={y}>{y}</option>
              ))}
            </select>
          </div>
          
          {/* Export buttons */}
          <div className="flex items-center gap-2">
            <button
              onClick={() => handleExport('excel')}
              disabled={exporting}
              className="btn-secondary flex items-center gap-2"
            >
              <FileSpreadsheet className="w-4 h-4" />
              <span className="hidden sm:inline">Excel</span>
            </button>
            <button
              onClick={() => handleExport('pdf')}
              disabled={exporting}
              className="btn-secondary flex items-center gap-2"
            >
              <FileText className="w-4 h-4" />
              <span className="hidden sm:inline">PDF</span>
            </button>
          </div>
        </div>
      </div>

      {/* Theme Selector */}
      <ThemeSelector activeTheme={activeTheme} onThemeChange={setActiveTheme} />

      {/* Theme Content */}
      {activeTheme === 'safety' && (
        <SafetyTheme 
          kpiSummary={kpiSummary} 
          weeklyTrends={weeklyTrends} 
          projectPerformance={projectPerformance} 
        />
      )}
      {activeTheme === 'training' && (
        <TrainingTheme 
          kpiSummary={kpiSummary} 
          weeklyTrends={weeklyTrends} 
          projectPerformance={projectPerformance}
          trainingData={trainingData}
          awarenessData={awarenessData}
        />
      )}
      {activeTheme === 'compliance' && (
        <ComplianceTheme 
          kpiSummary={kpiSummary} 
          weeklyTrends={weeklyTrends} 
          projectPerformance={projectPerformance}
          inspectionData={data?.inspection_data}
          sorData={sorData}
        />
      )}
      {activeTheme === 'environmental' && (
        <EnvironmentalTheme 
          kpiSummary={kpiSummary} 
          weeklyTrends={weeklyTrends} 
        />
      )}

      {/* Overview Theme (existing content) */}
      {activeTheme === 'overview' && (
        <>
      {/* Stats Grid */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        <StatCard
          title="Total Projects"
          value={stats.total_projects || 0}
          subtitle={`${stats.active_projects || 0} active`}
          icon={FolderKanban}
          color="blue"
        />
        <StatCard
          title="Total Users"
          value={stats.total_users || 0}
          subtitle={`${stats.active_users || 0} active`}
          icon={Users}
          color="green"
        />
        <StatCard
          title="Pending Reports"
          value={stats.pending_reports || 0}
          subtitle="Awaiting approval"
          icon={ClipboardCheck}
          color="amber"
        />
        <StatCard
          title="Total Reports"
          value={stats.total_reports || 0}
          subtitle={`In ${year}`}
          icon={FileText}
          color="purple"
        />
      </div>

      {/* KPI Summary Cards */}
      <div className="grid grid-cols-2 lg:grid-cols-5 gap-4">
        <KpiCard
          title="Total Accidents"
          value={kpiSummary.total_accidents || 0}
          icon={AlertTriangle}
          color={kpiSummary.total_accidents > 0 ? 'red' : 'green'}
          trend={kpiSummary.fatal_accidents > 0 ? `${kpiSummary.fatal_accidents} fatal` : 'No fatalities'}
        />
        <KpiCard
          title="Trainings"
          value={kpiSummary.total_trainings || 0}
          icon={GraduationCap}
          color="blue"
          trend={`${kpiSummary.employees_trained || 0} trained`}
        />
        <KpiCard
          title="Inspections"
          value={kpiSummary.total_inspections || 0}
          icon={ClipboardCheck}
          color="green"
        />
        <KpiCard
          title="Avg TF Rate"
          value={Number(kpiSummary.avg_tf || 0).toFixed(2)}
          icon={TrendingDown}
          color="amber"
          trend="Frequency Rate"
        />
        <KpiCard
          title="Avg TG Rate"
          value={Number(kpiSummary.avg_tg || 0).toFixed(2)}
          icon={TrendingUp}
          color="purple"
          trend="Severity Rate"
        />
      </div>

      {/* Charts Row */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Weekly Trends Chart */}
        <div className="card">
          <div className="card-header">
            <h3 className="font-semibold text-gray-900 dark:text-gray-100">Weekly KPI Trends</h3>
          </div>
          <div className="card-body">
            <div className="h-80">
              <ResponsiveContainer width="100%" height="100%">
                <LineChart data={weeklyTrends} onClick={handleWeeklyChartClick}>
                  <CartesianGrid strokeDasharray="3 3" stroke="#f0f0f0" className="dark:opacity-20" />
                  <XAxis dataKey="week_label" tick={{ fontSize: 10 }} interval="preserveStartEnd" />
                  <YAxis tick={{ fontSize: 12 }} />
                  <Tooltip 
                    labelFormatter={(label) => `Week ${label.replace('S', '')}`}
                  />
                  <Legend />
                  <Line
                    type="monotone"
                    dataKey="accidents"
                    stroke="#dc2626"
                    strokeWidth={2}
                    dot={{ fill: '#dc2626', r: 3 }}
                    name="Accidents"
                  />
                  <Line
                    type="monotone"
                    dataKey="trainings"
                    stroke="#3b82f6"
                    strokeWidth={2}
                    dot={{ fill: '#3b82f6', r: 3 }}
                    name="Trainings"
                  />
                  <Line
                    type="monotone"
                    dataKey="inspections"
                    stroke="#16a34a"
                    strokeWidth={2}
                    dot={{ fill: '#16a34a', r: 3 }}
                    name="Inspections"
                  />
                </LineChart>
              </ResponsiveContainer>
            </div>
            {selectedWeek && (
              <div className="mt-4 text-xs text-gray-600 dark:text-gray-300">
                <div className="flex items-center justify-between mb-1">
                  <p className="font-semibold">Details for {selectedWeek.week_label}</p>
                  <button
                    type="button"
                    onClick={() => navigate('/admin/kpi')}
                    className="btn-secondary btn-sm"
                  >
                    View KPI reports
                  </button>
                </div>
                <div className="grid grid-cols-3 gap-4">
                  <div>
                    <p className="text-gray-500 dark:text-gray-400">Accidents</p>
                    <p className="font-semibold">{selectedWeek.accidents ?? 0}</p>
                  </div>
                  <div>
                    <p className="text-gray-500 dark:text-gray-400">Trainings</p>
                    <p className="font-semibold">{selectedWeek.trainings ?? 0}</p>
                  </div>
                  <div>
                    <p className="text-gray-500 dark:text-gray-400">Inspections</p>
                    <p className="font-semibold">{selectedWeek.inspections ?? 0}</p>
                  </div>
                </div>
              </div>
            )}
          </div>
        </div>

        {/* TF/TG Rates Chart with Dual Y-Axis */}
        <div className="card">
          <div className="card-header">
            <h3 className="font-semibold text-gray-900 dark:text-gray-100">TF & TG Rates</h3>
          </div>
          <div className="card-body">
            <div className="h-80">
              <ResponsiveContainer width="100%" height="100%">
                <ComposedChart data={weeklyTrends}>
                  <CartesianGrid strokeDasharray="3 3" stroke="#f0f0f0" className="dark:opacity-20" />
                  <XAxis dataKey="week_label" tick={{ fontSize: 10 }} interval="preserveStartEnd" />
                  <YAxis 
                    yAxisId="left" 
                    tick={{ fontSize: 12 }} 
                    stroke="#f59e0b"
                    label={{ value: 'TF Rate', angle: -90, position: 'insideLeft', style: { fill: '#f59e0b' } }}
                  />
                  <YAxis 
                    yAxisId="right" 
                    orientation="right" 
                    tick={{ fontSize: 12 }} 
                    stroke="#8b5cf6"
                    label={{ value: 'TG Rate', angle: 90, position: 'insideRight', style: { fill: '#8b5cf6' } }}
                  />
                  <Tooltip 
                    labelFormatter={(label) => `Week ${label.replace('S', '')}`}
                    formatter={(value, name) => [Number(value).toFixed(4), name]}
                  />
                  <Legend />
                  <Bar yAxisId="left" dataKey="tf" fill="#f59e0b" name="TF Rate" radius={[4, 4, 0, 0]} />
                  <Bar yAxisId="right" dataKey="tg" fill="#8b5cf6" name="TG Rate" radius={[4, 4, 0, 0]} />
                </ComposedChart>
              </ResponsiveContainer>
            </div>
          </div>
        </div>
      </div>

      {/* Submission Status - Weekly Overview (reused from UserDashboard) */}
      {weeklyStatus.filter((week) => week.total_projects > 0).length > 0 && (
        <div className="card mt-6">
          <div className="card-header flex items-center justify-between">
            <h3 className="font-semibold text-gray-900 dark:text-gray-100">{t('dashboard.submissionStatus')}</h3>
            <div className="flex items-center gap-2">
              <select
                value={selectedStatusProject}
                onChange={(e) => setSelectedStatusProject(e.target.value)}
                className="bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-600 rounded-lg px-3 py-1.5 text-sm font-medium dark:text-gray-200 focus:ring-2 focus:ring-hse-primary"
              >
                <option value="all">{t('common.allProjects')}</option>
                {projects.map((project) => (
                  <option key={project.id} value={project.id}>
                    {project.code} - {project.name}
                  </option>
                ))}
              </select>
            </div>
          </div>
          <div className="p-4">
            <div className="relative">
              <button
                type="button"
                onClick={() => weekStatusScrollRef.current?.scrollBy({ left: -300, behavior: 'smooth' })}
                className="absolute left-0 top-1/2 -translate-y-1/2 z-10 bg-white/90 dark:bg-gray-700/90 hover:bg-white dark:hover:bg-gray-600 shadow-lg rounded-full p-2 border dark:border-gray-600"
              >
                <ChevronLeft className="w-5 h-5 text-gray-600 dark:text-gray-300" />
              </button>

              <button
                type="button"
                onClick={() => weekStatusScrollRef.current?.scrollBy({ left: 300, behavior: 'smooth' })}
                className="absolute right-0 top-1/2 -translate-y-1/2 z-10 bg-white/90 dark:bg-gray-700/90 hover:bg-white dark:hover:bg-gray-600 shadow-lg rounded-full p-2 border dark:border-gray-600"
              >
                <ChevronRight className="w-5 h-5 text-gray-600 dark:text-gray-300" />
              </button>

              <div
                ref={weekStatusScrollRef}
                className="flex gap-2 overflow-x-auto scroll-smooth px-10 py-3 scrollbar-thin scrollbar-thumb-gray-300 scrollbar-track-gray-100"
                style={{ scrollbarWidth: 'thin' }}
              >
                {(() => {
                  const currentWeekInfo = getCurrentWeek()
                  const maxWeek = year < currentWeekInfo.year ? 52 : currentWeekInfo.week
                  return Array.from({ length: maxWeek }, (_, i) => i + 1)
                })().map((weekNum) => {
                  const weekData = weeklyStatus.find((w) => w.week === weekNum)
                  const currentWeekInfo = getCurrentWeek()
                  const isPast = year < currentWeekInfo.year || (year === currentWeekInfo.year && weekNum < currentWeekInfo.week)
                  const isCurrent = weekNum === currentWeekInfo.week && year === currentWeekInfo.year

                  let status = 'not_submitted'
                  const projectsInfo = weekData?.projects || []

                  if (selectedStatusProject === 'all') {
                    status = weekData?.status || 'not_submitted'
                  } else {
                    const projectData = projectsInfo.find((p) => p.project_id === parseInt(selectedStatusProject))
                    status = projectData?.status || 'not_submitted'
                  }

                  const approvedCount = weekData?.approved_count || 0
                  const submittedCount = weekData?.submitted_count || 0
                  const draftCount = weekData?.draft_count || 0
                  const totalProjects = weekData?.total_projects || 1

                  let partialGradient = ''
                  if (status === 'partial' && totalProjects > 0) {
                    const colors = []
                    if (approvedCount > 0) colors.push('rgb(34, 197, 94)')
                    if (submittedCount > 0) colors.push('rgb(251, 191, 36)')
                    if (draftCount > 0) colors.push('rgb(96, 165, 250)')
                    const notSubmitted = totalProjects - approvedCount - submittedCount - draftCount
                    if (notSubmitted > 0) colors.push('rgb(254, 202, 202)')
                    partialGradient = colors.length > 1 ? `linear-gradient(135deg, ${colors.join(', ')})` : ''
                  }

                  return (
                    <div
                      key={`admin-week-${year}-${weekNum}`}
                      data-week={weekNum}
                      className={`relative flex-shrink-0 w-14 p-2 rounded-lg text-center transition-all cursor-pointer ${
                        selectedStatusWeek === weekNum ? 'ring-2 ring-gray-900 ring-offset-2 scale-110' : ''
                      } ${
                        isCurrent && selectedStatusWeek !== weekNum ? 'ring-2 ring-hse-primary ring-offset-2' : ''
                      } ${
                        status === 'approved'
                          ? 'bg-green-500 text-white'
                          : status === 'partial'
                          ? 'text-white'
                          : status === 'submitted'
                          ? 'bg-amber-400 text-white'
                          : status === 'draft'
                          ? 'bg-blue-400 text-white'
                          : isPast
                          ? 'bg-red-100 text-red-600 hover:bg-red-200'
                          : 'bg-gray-100 text-gray-500'
                      }`}
                      style={status === 'partial' && partialGradient ? { background: partialGradient } : {}}
                      onClick={() => setSelectedStatusWeek(selectedStatusWeek === weekNum ? null : weekNum)}
                    >
                      <p className="text-xs font-medium">
                        {t('dashboard.weekShortPrefix')}
                        {weekNum}
                      </p>
                      {selectedStatusProject === 'all' && totalProjects > 1 ? (
                        <p className="text-xs font-bold mt-0.5">
                          {approvedCount + submittedCount}/{totalProjects}
                        </p>
                      ) : (
                        <p className="text-lg font-bold mt-0.5">
                          {status === 'approved'
                            ? '✓'
                            : status === 'partial'
                            ? '◐'
                            : status === 'submitted'
                            ? '⏳'
                            : status === 'draft'
                            ? '📝'
                            : isPast
                            ? '!'
                            : '-'}
                        </p>
                      )}
                    </div>
                  )
                })}
              </div>
            </div>

            {selectedStatusWeek && (() => {
              const weekData = weeklyStatus.find((w) => w.week === selectedStatusWeek)
              const projectsInfo = weekData?.projects || []
              const currentWeekInfo = getCurrentWeek()
              const isCurrentWeek = selectedStatusWeek === currentWeekInfo.week && year === currentWeekInfo.year
              const isPastWeek = year < currentWeekInfo.year || (year === currentWeekInfo.year && selectedStatusWeek < currentWeekInfo.week)

              if (projectsInfo.length === 0) return null

              return (
                <div className="mt-3 p-3 bg-gray-900 text-white text-xs rounded-lg shadow-xl">
                  <div className="flex items-center justify-between border-b border-gray-700 pb-2 mb-2">
                    <p className="font-semibold">
                      {t('dashboard.weekDetailsTitle').replace('{{week}}', selectedStatusWeek)}
                      {isCurrentWeek && (
                        <span className="ml-2 text-hse-primary">({t('dashboard.currentWeekLabel')})</span>
                      )}
                    </p>
                    <button
                      type="button"
                      onClick={() => setSelectedStatusWeek(null)}
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
                        <div
                          key={proj.project_id}
                          className="flex items-center justify-between gap-2 bg-gray-800 rounded px-2 py-1.5"
                        >
                          <span className="truncate font-medium">{proj.project_code}</span>
                          <span
                            className={`flex-shrink-0 px-1.5 py-0.5 rounded text-[10px] font-medium ${
                              proj.status === 'approved'
                                ? 'bg-green-500'
                                : proj.status === 'submitted'
                                ? 'bg-amber-400'
                                : proj.status === 'draft'
                                ? 'bg-blue-400'
                                : showAsMissing
                                ? 'bg-red-400'
                                : 'bg-gray-500'
                            }`}
                          >
                            {proj.status === 'approved'
                              ? t('status.approved')
                              : proj.status === 'submitted'
                              ? t('status.pending')
                              : proj.status === 'draft'
                              ? t('status.draft')
                              : showAsMissing
                              ? t('status.missing')
                              : t('status.notSubmitted')}
                          </span>
                        </div>
                      )
                    })}
                  </div>
                </div>
              )
            })()}

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
      )}

      {/* Year-over-year summary */}
      {compareSummary && (
        <div className="card mt-6">
          <div className="card-header">
            <h3 className="font-semibold text-gray-900 dark:text-gray-100">
              Year-over-year summary ({year} vs {compareYear})
            </h3>
          </div>
          <div className="card-body grid grid-cols-1 md:grid-cols-4 gap-4 text-sm">
            <div>
              <p className="text-gray-500 dark:text-gray-400">Total accidents</p>
              <p className="font-semibold text-gray-900 dark:text-gray-100">
                {kpiSummary.total_accidents ?? 0} <span className="text-xs text-gray-400">({year})</span>
              </p>
              <p className="text-xs text-gray-500 dark:text-gray-400">
                {compareSummary.total_accidents ?? 0} ({compareYear})
              </p>
            </div>
            <div>
              <p className="text-gray-500 dark:text-gray-400">Trainings</p>
              <p className="font-semibold text-gray-900 dark:text-gray-100">
                {kpiSummary.total_trainings ?? 0} <span className="text-xs text-gray-400">({year})</span>
              </p>
              <p className="text-xs text-gray-500 dark:text-gray-400">
                {compareSummary.total_trainings ?? 0} ({compareYear})
              </p>
            </div>
            <div>
              <p className="text-gray-500 dark:text-gray-400">Inspections</p>
              <p className="font-semibold text-gray-900 dark:text-gray-100">
                {kpiSummary.total_inspections ?? 0} <span className="text-xs text-gray-400">({year})</span>
              </p>
              <p className="text-xs text-gray-500 dark:text-gray-400">
                {compareSummary.total_inspections ?? 0} ({compareYear})
              </p>
            </div>
            <div>
              <p className="text-gray-500 dark:text-gray-400">Avg TF / TG</p>
              <p className="font-semibold text-gray-900 dark:text-gray-100">
                {(Number(kpiSummary.avg_tf) || 0).toFixed(2)} / {(Number(kpiSummary.avg_tg) || 0).toFixed(2)}
                <span className="text-xs text-gray-400"> ({year})</span>
              </p>
              <p className="text-xs text-gray-500 dark:text-gray-400">
                {(Number(compareSummary.avg_tf) || 0).toFixed(2)} / {(Number(compareSummary.avg_tg) || 0).toFixed(2)} ({compareYear})
              </p>
            </div>
          </div>
        </div>
      )}

      {/* Project Performance Table */}
      <div className="card">
        <div className="card-header flex items-center justify-between">
          <h3 className="font-semibold text-gray-900 dark:text-gray-100">Project Performance</h3>
          <Link to="/admin/projects" className="text-sm text-hse-primary hover:underline">
            View all projects
          </Link>
        </div>

        {projectPerformance.length === 0 ? (
          <div className="p-6 text-center text-sm text-gray-500 dark:text-gray-400">
            No project data available.
          </div>
        ) : (
          <>
            {/* Mobile cards */}
            <div className="space-y-3 p-4 md:hidden">
              {projectPerformance.slice(0, 5).map((project) => (
                <div
                  key={project.id}
                  className="border border-gray-200 dark:border-gray-700 rounded-lg p-3 bg-white dark:bg-gray-800"
                >
                  <div className="flex items-start justify-between gap-3">
                    <div>
                      <p className="font-medium text-gray-900 dark:text-gray-100">{project.name}</p>
                      <p className="text-xs text-gray-500 dark:text-gray-400">{project.code}</p>
                    </div>
                    <div className="text-right text-xs text-gray-600 dark:text-gray-300 space-y-1">
                      <p>
                        <span className="font-semibold">Reports:</span> {project.reports_count}
                      </p>
                      <p>
                        <span className="font-semibold">Trainings:</span> {project.total_trainings}
                      </p>
                    </div>
                  </div>

                  <div className="mt-3 flex items-center justify-between text-[11px] text-gray-600 dark:text-gray-300">
                    <span>
                      Accidents:{' '}
                      <span className={project.total_accidents > 0 ? 'text-red-600 dark:text-red-400 font-semibold' : 'text-green-600 dark:text-green-400'}>
                        {project.total_accidents}
                      </span>
                    </span>
                    <span>
                      TF: {Number(project.avg_tf).toFixed(2)} • TG: {Number(project.avg_tg).toFixed(2)}
                    </span>
                  </div>
                </div>
              ))}
            </div>

            {/* Desktop table */}
            <div className="hidden md:block overflow-x-auto">
              <table className="table">
                <thead>
                  <tr>
                    <th>Project</th>
                    <th>Reports</th>
                    <th>Accidents</th>
                    <th>Trainings</th>
                    <th>Avg TF</th>
                    <th>Avg TG</th>
                  </tr>
                </thead>
                <tbody>
                  {projectPerformance.slice(0, 5).map((project) => (
                    <tr key={project.id}>
                      <td>
                        <div>
                          <p className="font-medium dark:text-gray-100">{project.name}</p>
                          <p className="text-xs text-gray-500 dark:text-gray-400">{project.code}</p>
                        </div>
                      </td>
                      <td>{project.reports_count}</td>
                      <td>
                        <span className={project.total_accidents > 0 ? 'text-red-600 dark:text-red-400 font-semibold' : 'text-green-600 dark:text-green-400'}>
                          {project.total_accidents}
                        </span>
                      </td>
                      <td>{project.total_trainings}</td>
                      <td>{Number(project.avg_tf).toFixed(2)}</td>
                      <td>{Number(project.avg_tg).toFixed(2)}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </>
        )}
      </div>

      {/* Recent Reports */}
      <div className="card">
        <div className="card-header">
          <h3 className="font-semibold text-gray-900 dark:text-gray-100">{t('dashboard.recentSubmissions')}</h3>
        </div>
        <div className="divide-y divide-gray-100 dark:divide-gray-700">
          {data?.recent_reports?.filter((report) => report.status !== 'draft').slice(0, 5).map((report) => (
            <div key={report.id} className="p-4 hover:bg-gray-50 dark:hover:bg-gray-700/50">
              <div className="flex items-center justify-between">
                <div>
                  <p className="font-medium text-gray-900 dark:text-gray-100">
                    {report.project?.name || 'Unknown Project'}
                  </p>
                  <p className="text-sm text-gray-500 dark:text-gray-400">
                    {report.report_month}/{report.report_year} • Submitted by {report.submitter?.name}
                  </p>
                </div>
                <span className={`badge ${
                  report.status === 'approved' ? 'badge-success' :
                  report.status === 'submitted' ? 'badge-warning' :
                  report.status === 'rejected' ? 'badge-danger' : 'badge-info'
                }`}>
                  {report.status}
                </span>
              </div>
            </div>
          ))}
        </div>
      </div>
        </>
      )}
    </div>
  )
}

const StatCard = memo(function StatCard({ title, value, subtitle, icon: Icon, color }) {
  const colors = {
    blue: 'bg-blue-50 text-blue-600',
    green: 'bg-green-50 text-green-600',
    amber: 'bg-amber-50 text-amber-600',
    purple: 'bg-purple-50 text-purple-600',
    red: 'bg-red-50 text-red-600',
  }

  return (
    <div className="stat-card">
      <div className="flex items-start justify-between">
        <div>
          <p className="text-sm text-gray-500 dark:text-gray-400">{title}</p>
          <p className="text-2xl font-bold text-gray-900 dark:text-gray-100 mt-1">{value}</p>
          <p className="text-xs text-gray-400 dark:text-gray-500 mt-1">{subtitle}</p>
        </div>
        <div className={`p-3 rounded-lg ${colors[color]}`}>
          <Icon className="w-5 h-5" />
        </div>
      </div>
    </div>
  )
})

const KpiCard = memo(function KpiCard({ title, value, icon: Icon, color, trend }) {
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
      {trend && <p className="text-xs text-gray-500 dark:text-gray-400 mt-1">{trend}</p>}
    </div>
  )
})
