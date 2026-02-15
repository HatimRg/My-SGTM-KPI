import { useState, useEffect, useMemo, useCallback, memo, useRef } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import { dashboardService, projectService } from '../../services/api'
import { cachedApiCall, invalidateCache } from '../../utils/apiCache'
import {
  Users,
  FolderKanban,
  AlertTriangle,
  GraduationCap,
  ClipboardCheck,
  Truck,
  TrendingUp,
  TrendingDown,
  ArrowUpRight,
  ArrowDownRight,
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
import { useAuthStore } from '../../store/authStore'
import ThemeSelector from '../../components/dashboard/ThemeSelector'
import SafetyTheme from '../../components/dashboard/themes/SafetyTheme'
import TrainingTheme from '../../components/dashboard/themes/TrainingTheme'
import ComplianceTheme from '../../components/dashboard/themes/ComplianceTheme'
import PpeTheme from '../../components/dashboard/themes/PpeTheme'
import EnvironmentalTheme from '../../components/dashboard/themes/EnvironmentalTheme'
import DeviationTheme from '../../components/dashboard/themes/DeviationTheme'
import MonthlyReportTheme from '../../components/dashboard/themes/MonthlyReportTheme'
import { getCurrentWeek } from '../../utils/weekHelper'
import { getProjectLabel, sortProjects } from '../../utils/projectList'
import YearPicker from '../../components/ui/YearPicker'
import WeekPicker from '../../components/ui/WeekPicker'

const COLORS = ['#dc2626', '#f59e0b', '#16a34a', '#3b82f6', '#8b5cf6', '#ec4899', '#14b8a6']

const tooltipPortal = typeof document !== 'undefined' ? document.body : null
const tooltipWrapperStyle = { zIndex: 9999, pointerEvents: 'none' }

export default function AdminDashboard() {
  const t = useTranslation()
  const { user } = useAuthStore()
  const [data, setData] = useState(null)
  const [loading, setLoading] = useState(true)
  const [safetyPerformance, setSafetyPerformance] = useState(null)
  const [safetyLoading, setSafetyLoading] = useState(false)
  const [environmentalMonthly, setEnvironmentalMonthly] = useState(null)
  const [environmentalLoading, setEnvironmentalLoading] = useState(false)
  const [year, setYear] = useState(getCurrentWeek().year)
  const [compareYear, setCompareYear] = useState(getCurrentWeek().year - 1)
  const [compareData, setCompareData] = useState(null)
  const [activeTheme, setActiveTheme] = useState('overview')
  const [focusPole, setFocusPole] = useState('')
  const [poles, setPoles] = useState([])
  const [focusProjectId, setFocusProjectId] = useState('all')
  const [focusWeek, setFocusWeek] = useState('all')
  const [focusMonth, setFocusMonth] = useState('all')
  const [selectedWeek, setSelectedWeek] = useState(null)
  const [selectedStatusProject, setSelectedStatusProject] = useState('all')
  const [selectedStatusWeek, setSelectedStatusWeek] = useState(null)
  const weekStatusScrollRef = useRef(null)
  const navigate = useNavigate()

  // Memoize fetch function to prevent recreation on every render
  const fetchDashboardData = useCallback(async () => {
    try {
      setLoading(true)
      const params = { year }
      if (focusPole) params.pole = focusPole
      if (focusProjectId !== 'all') params.project_id = focusProjectId
      if (focusWeek !== 'all') params.week = focusWeek
      // Use cached API call with 30 second cache
      const response = await cachedApiCall(
        dashboardService.getAdminDashboard,
        '/dashboard/admin',
        params,
        30000 // 30 seconds cache
      )
      setData(response.data.data)
    } catch (error) {
      toast.error(t('dashboard.loadFailed') || t('errors.failedToLoad'))
    } finally {
      setLoading(false)
    }
  }, [year, focusPole, focusProjectId, focusWeek])

  const fetchEnvironmentalMonthly = useCallback(async () => {
    try {
      setEnvironmentalLoading(true)
      const params = { year }
      if (focusPole) params.pole = focusPole
      if (focusProjectId !== 'all') params.project_id = focusProjectId
      if (focusMonth !== 'all') params.month = focusMonth

      const response = await cachedApiCall(
        dashboardService.getEnvironmentalMonthly,
        '/dashboard/environmental-monthly',
        params,
        30000,
      )
      setEnvironmentalMonthly(response.data.data)
    } catch (error) {
      setEnvironmentalMonthly(null)
      toast.error(t('dashboard.loadFailed') || t('errors.failedToLoad'))
    } finally {
      setEnvironmentalLoading(false)
    }
  }, [year, focusPole, focusProjectId, focusMonth])

  const fetchPoles = useCallback(async () => {
    try {
      const res = await projectService.getPoles()
      const values = res.data?.data?.poles || res.data?.poles || []
      setPoles(Array.isArray(values) ? values : [])
    } catch (e) {
      setPoles([])
    }
  }, [])

  const getReportStatusLabel = useCallback((status) => {
    const s = String(status || '').trim()
    if (!s) return t('common.unknown')
    const map = {
      approved: 'status.approved',
      submitted: 'status.pending',
      rejected: 'status.rejected',
      draft: 'status.draft',
      partial: 'status.partial',
      missing: 'status.missing',
      not_submitted: 'status.notSubmitted',
      pending: 'status.pending',
    }

    const key = map[s]
    if (!key) return t('common.unknown')
    return t(key)
  }, [t])

  const fetchCompareData = useCallback(async () => {
    if (!compareYear) {
      setCompareData(null)
      return
    }
    try {
      const response = await cachedApiCall(
        dashboardService.getAdminDashboard,
        '/dashboard/admin',
        { year: compareYear },
        30000
      )
      setCompareData(response.data.data ?? null)
    } catch (error) {
      console.error('Failed to load comparison dashboard data', error)
      toast.error(t('dashboard.compareLoadFailed') ?? t('errors.failedToLoad'))
    }
  }, [compareYear])

  const fetchSafetyPerformance = useCallback(async () => {
    try {
      setSafetyLoading(true)
      const params = { year }
      if (focusPole) params.pole = focusPole
      if (focusProjectId !== 'all') params.project_id = focusProjectId
      if (focusWeek !== 'all') params.week = focusWeek

      const response = await cachedApiCall(
        dashboardService.getSafetyPerformance,
        '/dashboard/safety-performance',
        params,
        30000
      )
      setSafetyPerformance(response.data.data)
    } catch (error) {
      toast.error(t('dashboard.loadFailed') || t('errors.failedToLoad'))
    } finally {
      setSafetyLoading(false)
    }
  }, [year, focusPole, focusProjectId, focusWeek])

  useEffect(() => {
    fetchDashboardData()
    fetchCompareData()
  }, [fetchDashboardData, fetchCompareData])

  useEffect(() => {
    if (activeTheme !== 'safety') return
    fetchSafetyPerformance()
  }, [activeTheme, fetchSafetyPerformance])

  useEffect(() => {
    if (activeTheme !== 'environmental') return
    fetchEnvironmentalMonthly()
  }, [activeTheme, fetchEnvironmentalMonthly])

  useEffect(() => {
    fetchPoles()
  }, [fetchPoles])

  useEffect(() => {
    setCompareYear(year - 1)
  }, [year])

  const weekPickerValue = useMemo(() => {
    if (focusWeek === 'all') return ''
    const n = Number(focusWeek)
    if (!Number.isFinite(n) || n < 1) return ''
    return `${year}-W${String(n).padStart(2, '0')}`
  }, [focusWeek, year])

  const handleWeekChange = useCallback(
    (weekKey) => {
      const raw = String(weekKey || '')
      if (!raw) {
        setFocusWeek('all')
        return
      }

      const m = raw.match(/^(\d{4})-W(\d{2})$/)
      if (!m) return

      const pickedYear = Number(m[1])
      const pickedWeek = Number(m[2])
      if (!Number.isFinite(pickedYear) || !Number.isFinite(pickedWeek)) return

      setFocusWeek(pickedWeek)

      // Behavior 1: sync dashboard year to picked year, but never jump into a future year.
      const currentCalendarYear = new Date().getFullYear()
      if (pickedYear <= currentCalendarYear) {
        setYear(pickedYear)
      }
    },
    [setFocusWeek, setYear],
  )

  // Memoize expensive data transformations (must be before any early returns!)
  const stats = useMemo(() => data?.stats ?? {}, [data?.stats])
  const kpiSummary = useMemo(() => data?.kpi_summary ?? {}, [data?.kpi_summary])
  const weeklyTrends = useMemo(() => data?.weekly_trends ?? [], [data?.weekly_trends])
  const projectPerformance = useMemo(() => data?.project_performance ?? [], [data?.project_performance])
  const weeklyStatus = useMemo(() => data?.weekly_status ?? [], [data?.weekly_status])
  const projects = useMemo(() => data?.projects ?? [], [data?.projects])

  useEffect(() => {
    if (!weekStatusScrollRef.current) return
    if (!Array.isArray(weeklyStatus) || weeklyStatus.length === 0) return
    requestAnimationFrame(() => {
      if (!weekStatusScrollRef.current) return
      weekStatusScrollRef.current.scrollTo({ left: weekStatusScrollRef.current.scrollWidth, behavior: 'auto' })
    })
  }, [weeklyStatus, year])

  const filteredWeeklyTrends = useMemo(() => {
    if (focusWeek === 'all') return weeklyTrends
    return weeklyTrends.filter((week) => week.week === focusWeek)
  }, [weeklyTrends, focusWeek])

  const filteredProjectPerformance = useMemo(() => {
    if (focusProjectId === 'all') return projectPerformance
    const pid = Number(focusProjectId)
    if (Number.isNaN(pid)) return projectPerformance
    return (projectPerformance || []).filter((p) => Number(p.id) === pid)
  }, [projectPerformance, focusProjectId])

  const yoyIndicator = useCallback((currentValue, previousValue, { higherIsBetter }) => {
    const current = Number(currentValue ?? 0)
    const previous = Number(previousValue ?? 0)
    if (current === previous) return null

    const improved = higherIsBetter ? current > previous : current < previous
    const percent = previous === 0 ? 100 : Math.abs(((current - previous) / previous) * 100)
    const rounded = percent >= 10 ? Math.round(percent) : Math.round(percent * 10) / 10

    const Icon = current > previous ? ArrowUpRight : ArrowDownRight
    const colorClass = improved
      ? 'bg-green-50 text-green-700 dark:bg-green-900/30 dark:text-green-300'
      : 'bg-red-50 text-red-700 dark:bg-red-900/30 dark:text-red-300'

    return (
      <span className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[11px] font-semibold ${colorClass}`}>
        <Icon className="w-3.5 h-3.5" />
        {rounded}%
      </span>
    )
  }, [])
  
  // Real data from specific tables
  const trainingData = useMemo(() => data?.training_data || {}, [data?.training_data])
  const awarenessData = useMemo(() => data?.awareness_data || {}, [data?.awareness_data])
  const sorData = useMemo(() => data?.sor_data || {}, [data?.sor_data])
  const permitData = useMemo(() => data?.permit_data || {}, [data?.permit_data])
  const inspectionData = useMemo(() => data?.inspection_data || {}, [data?.inspection_data])

  const visibleProjects = useMemo(() => {
    const list = Array.isArray(projects) ? projects : []
    if (!focusPole) return list
    return list.filter((p) => p?.pole === focusPole)
  }, [projects, focusPole])

  const projectListPreference = user?.project_list_preference || 'code'
  const visibleProjectsSorted = useMemo(() => {
    return sortProjects(visibleProjects, projectListPreference)
  }, [visibleProjects, projectListPreference])

  useEffect(() => {
    if (focusProjectId === 'all') return
    const ok = visibleProjects.some((p) => String(p.id) === String(focusProjectId))
    if (!ok) {
      setFocusProjectId('all')
    }
  }, [visibleProjects, focusProjectId])

  useEffect(() => {
    if (selectedStatusProject === 'all') return
    const ok = visibleProjects.some((p) => String(p.id) === String(selectedStatusProject))
    if (!ok) {
      setSelectedStatusProject('all')
    }
  }, [visibleProjects, selectedStatusProject])

  const filteredTrainingData = useMemo(() => {
    if (focusWeek === 'all') return trainingData
    const wk = Number(focusWeek)
    if (Number.isNaN(wk)) return trainingData

    const byWeekRaw = Array.isArray(trainingData?.by_week) ? trainingData.by_week : []
    const byWeek = byWeekRaw.filter((w) => Number(w.week_number) === wk)

    const total = byWeek.reduce((sum, r) => sum + Number(r?.count ?? 0), 0)
    const totalParticipants = byWeek.reduce((sum, r) => sum + Number(r?.participants ?? 0), 0)
    const totalHours = byWeek.reduce((sum, r) => sum + Number(r?.hours ?? 0), 0)

    return {
      ...trainingData,
      total,
      total_participants: totalParticipants,
      total_hours: totalHours,
      by_week: byWeek,
    }
  }, [trainingData, focusWeek])

  const filteredInspectionData = useMemo(() => {
    if (focusWeek === 'all') return inspectionData
    const wk = Number(focusWeek)
    if (Number.isNaN(wk)) return inspectionData

    const byWeekRaw = Array.isArray(inspectionData?.by_week) ? inspectionData.by_week : []
    const byWeek = byWeekRaw.filter((w) => Number(w.week_number) === wk)
    const total = byWeek.reduce((sum, r) => sum + Number(r?.count ?? 0), 0)

    return {
      ...inspectionData,
      stats: {
        ...(inspectionData?.stats || {}),
        total,
      },
      by_week: byWeek,
    }
  }, [inspectionData, focusWeek])

  const filteredAwarenessData = useMemo(() => {
    if (focusWeek === 'all') return awarenessData
    const wk = Number(focusWeek)
    if (Number.isNaN(wk)) return awarenessData

    const byWeekRaw = Array.isArray(awarenessData?.by_week) ? awarenessData.by_week : []
    const byWeek = byWeekRaw.filter((w) => Number(w.week_number) === wk)

    const total = byWeek.reduce((sum, r) => sum + Number(r?.count ?? 0), 0)
    const totalParticipants = byWeek.reduce((sum, r) => sum + Number(r?.participants ?? 0), 0)
    const totalHours = byWeek.reduce((sum, r) => sum + Number(r?.hours ?? 0), 0)

    return {
      ...awarenessData,
      total,
      total_participants: totalParticipants,
      total_hours: totalHours,
      by_week: byWeek,
    }
  }, [awarenessData, focusWeek])

  const focusedKpiSummary = useMemo(() => {
    const base = kpiSummary || {}

    // Prefer real trainings/participants/hours from Trainings table when available
    const withRealTraining = {
      ...base,
      total_trainings: trainingData?.total ?? base.total_trainings ?? 0,
      employees_trained: trainingData?.total_participants ?? base.employees_trained ?? 0,
      total_training_hours: trainingData?.total_hours ?? base.total_training_hours ?? 0,
      total_inspections: inspectionData?.stats?.total ?? base.total_inspections ?? 0,
    }

    // Week focus: derive summary from the filtered weekly trends (and filtered training table aggregates)
    if (focusWeek !== 'all') {
      const rows = Array.isArray(filteredWeeklyTrends) ? filteredWeeklyTrends : []
      const sum = (key) => rows.reduce((acc, r) => acc + Number(r?.[key] ?? 0), 0)
      const avg = (key) => {
        if (rows.length === 0) return 0
        const values = rows.map((r) => Number(r?.[key] ?? 0))
        return values.reduce((a, b) => a + b, 0) / values.length
      }

      return {
        ...withRealTraining,
        total_accidents: sum('accidents'),
        fatal_accidents: sum('fatal_accidents'),
        serious_accidents: sum('serious_accidents'),
        minor_accidents: sum('minor_accidents'),
        total_inspections: filteredInspectionData?.stats?.total ?? sum('inspections'),
        total_near_misses: sum('near_misses'),
        total_work_permits: sum('work_permits'),
        avg_tf: avg('tf'),
        avg_tg: avg('tg'),
        avg_hse_compliance: avg('hse_compliance'),
        avg_medical_compliance: avg('medical_compliance'),
        total_water_consumption: sum('water'),
        total_electricity_consumption: sum('electricity'),
        // Override training metrics with week-filtered Training table aggregates
        total_trainings: filteredTrainingData?.total ?? 0,
        employees_trained: filteredTrainingData?.total_participants ?? 0,
        total_training_hours: filteredTrainingData?.total_hours ?? 0,
      }
    }

    // Project focus (best-effort from project performance rows; other metrics remain year-based)
    if (focusProjectId !== 'all') {
      const row = Array.isArray(filteredProjectPerformance) ? filteredProjectPerformance[0] : null
      if (row) {
        return {
          ...withRealTraining,
          total_accidents: Number(row.total_accidents ?? 0),
          total_trainings: Number(row.total_trainings ?? 0),
          avg_tf: Number(row.avg_tf ?? 0),
          avg_tg: Number(row.avg_tg ?? 0),
        }
      }
    }

    return withRealTraining
  }, [
    kpiSummary,
    trainingData,
    inspectionData,
    filteredTrainingData,
    filteredInspectionData,
    filteredWeeklyTrends,
    focusWeek,
    focusProjectId,
    filteredProjectPerformance,
  ])

  const handleWeeklyChartClick = useCallback((chartState) => {
    if (!chartState || !chartState.activeLabel) return
    const label = chartState.activeLabel
    const point = filteredWeeklyTrends.find((w) => w.week_label === label)
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
  }, [filteredWeeklyTrends, year, navigate])
  
  // Memoize year options to prevent recreation
  const yearOptions = useMemo(() => {
    return [...Array(6)].map((_, i) => getCurrentWeek().year + 1 - i)
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
            <YearPicker
              value={year}
              onChange={(y) => {
                const n = Number(y)
                if (!Number.isFinite(n)) return
                setYear(n)
              }}
              className="min-w-[96px]"
              minYear={Math.min(...yearOptions)}
              maxYear={Math.max(...yearOptions)}
            />
          </div>
        </div>
      </div>

      {/* Theme Selector */}
      <ThemeSelector activeTheme={activeTheme} onThemeChange={setActiveTheme} user={user} />

      {/* Theme Focus Filters */}
      {activeTheme !== 'monthly_report' && (
        <div className="rounded-lg border border-gray-200 dark:border-gray-700 bg-white/70 dark:bg-gray-900/40 px-3 py-3">
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3">
            <div className="space-y-1">
              <label className="text-xs font-medium text-gray-600 dark:text-gray-300">{t('filters.pole')}</label>
              <select
                value={focusPole}
                onChange={(e) => setFocusPole(e.target.value)}
                className="input w-full"
              >
                <option value="">{t('common.allPoles')}</option>
                {poles.map((p) => (
                  <option key={p} value={p}>
                    {p}
                  </option>
                ))}
              </select>
            </div>

            <div className="space-y-1">
              <label className="text-xs font-medium text-gray-600 dark:text-gray-300">{t('common.project')}</label>
              <select
                value={focusProjectId}
                onChange={(e) => setFocusProjectId(e.target.value)}
                className="input w-full"
              >
                <option value="all">{t('common.allProjects')}</option>
                {visibleProjectsSorted.map((p) => (
                  <option key={p.id} value={p.id}>
                    {getProjectLabel(p)}
                  </option>
                ))}
              </select>
            </div>

            {activeTheme !== 'ppe' && activeTheme !== 'environmental' && (
              <div className="space-y-1">
                <label className="text-xs font-medium text-gray-600 dark:text-gray-300">{t('common.week') || t('common.weekAbbrev')}</label>
                <WeekPicker
                  value={weekPickerValue}
                  onChange={handleWeekChange}
                  placeholder={t('common.all')}
                  className="w-full"
                />
              </div>
            )}

            {activeTheme === 'environmental' && (
              <div className="space-y-1">
                <label className="text-xs font-medium text-gray-600 dark:text-gray-300">{t('dashboard.monthlyReport.month')}</label>
                <select
                  value={focusMonth}
                  onChange={(e) => setFocusMonth(e.target.value)}
                  className="input w-full"
                >
                  <option value="all">{t('common.all')}</option>
                  <option value="1">{t('months.january')}</option>
                  <option value="2">{t('months.february')}</option>
                  <option value="3">{t('months.march')}</option>
                  <option value="4">{t('months.april')}</option>
                  <option value="5">{t('months.may')}</option>
                  <option value="6">{t('months.june')}</option>
                  <option value="7">{t('months.july')}</option>
                  <option value="8">{t('months.august')}</option>
                  <option value="9">{t('months.september')}</option>
                  <option value="10">{t('months.october')}</option>
                  <option value="11">{t('months.november')}</option>
                  <option value="12">{t('months.december')}</option>
                </select>
              </div>
            )}
          </div>
        </div>
      )}

      {/* Theme Content */}
      {activeTheme === 'safety' && (
        <SafetyTheme 
          kpiSummary={focusedKpiSummary} 
          weeklyTrends={filteredWeeklyTrends} 
          projectPerformance={filteredProjectPerformance} 
          safetyPerformance={safetyPerformance}
          safetyLoading={safetyLoading}
        />
      )}
      {activeTheme === 'training' && (
        <TrainingTheme 
          kpiSummary={focusedKpiSummary} 
          weeklyTrends={filteredWeeklyTrends} 
          projectPerformance={filteredProjectPerformance} 
          trainingData={filteredTrainingData}
          awarenessData={filteredAwarenessData}
        />
      )}
      {activeTheme === 'compliance' && (
        <ComplianceTheme 
          kpiSummary={focusedKpiSummary} 
          weeklyTrends={filteredWeeklyTrends} 
          inspectionData={inspectionData}
          regulatoryWatch={data?.regulatory_watch}
        />
      )}
      {activeTheme === 'ppe' && (
        <PpeTheme year={year} projectId={focusProjectId} pole={focusPole} />
      )}
      {activeTheme === 'deviations' && (
        <DeviationTheme year={year} projects={projects} projectId={focusProjectId} week={focusWeek} pole={focusPole} />
      )}

      {activeTheme === 'environmental' && (
        <EnvironmentalTheme 
          data={environmentalMonthly}
          loading={environmentalLoading}
        />
      )}

      {activeTheme === 'monthly_report' && (
        <MonthlyReportTheme user={user} focusPole={focusPole} />
      )}

      {/* Overview Theme (existing content) */}
      {activeTheme === 'overview' && (
        <>
      {/* Stats Grid */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        <StatCard
          title={t('dashboard.totalProjects')}
          value={stats.total_projects ?? 0}
          subtitle={`${stats.active_projects ?? 0} ${t('dashboard.activeLabel')}`}
          icon={FolderKanban}
          color="blue"
        />
        <StatCard
          title={t('dashboard.totalUsers')}
          value={stats.total_users ?? 0}
          subtitle={`${stats.active_users ?? 0} ${t('dashboard.activeLabel')}`}
          icon={Users}
          color="green"
        />
        <StatCard
          title={t('dashboard.activeMachines')}
          value={stats.active_machines ?? 0}
          subtitle={t('dashboard.activeMachinesSubtitle')}
          icon={Truck}
          color="amber"
        />
        <StatCard
          title={t('dashboard.totalReports')}
          value={stats.total_reports ?? 0}
          subtitle={t('dashboard.inYear', { year })}
          icon={FileText}
          color="purple"
        />
      </div>

      {/* KPI Summary Cards */}
      <div className="grid grid-cols-2 lg:grid-cols-5 gap-4">
        <KpiCard
          title={t('dashboard.safety.totalAccidents')}
          value={focusedKpiSummary.total_accidents ?? 0}
          icon={AlertTriangle}
          color={focusedKpiSummary.total_accidents > 0 ? 'red' : 'green'}
          trend={focusedKpiSummary.fatal_accidents > 0 ? `${focusedKpiSummary.fatal_accidents} ${t('dashboard.safety.fatal')}` : t('dashboard.safety.noFatalities')}
        />
        <KpiCard
          title={t('dashboard.training.totalTrainings')}
          value={focusedKpiSummary.total_trainings ?? 0}
          icon={GraduationCap}
          color="blue"
          trend={`${focusedKpiSummary.employees_trained ?? 0} ${t('dashboard.training.employeesTrained')}`}
        />
        <KpiCard
          title={t('dashboard.compliance.totalInspections')}
          value={focusedKpiSummary.total_inspections ?? 0}
          icon={ClipboardCheck}
          color="green"
        />
        <KpiCard
          title={t('dashboard.avgTf')}
          value={Number(focusedKpiSummary.avg_tf ?? 0).toFixed(2)}
          icon={TrendingDown}
          color="amber"
          trend={t('dashboard.rates.frequencyRate')}
        />
        <KpiCard
          title={t('dashboard.avgTg')}
          value={Number(focusedKpiSummary.avg_tg ?? 0).toFixed(2)}
          icon={TrendingUp}
          color="purple"
          trend={t('dashboard.rates.severityRate')}
        />
      </div>

      {/* Charts Row */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Weekly Trends Chart */}
        <div className="card">
          <div className="card-header">
            <h3 className="font-semibold text-gray-900 dark:text-gray-100">{t('dashboard.weeklyKpiTrends')}</h3>
          </div>
          <div className="card-body">
            <div className="h-80">
              <ResponsiveContainer width="100%" height="100%">
                <LineChart data={filteredWeeklyTrends} onClick={handleWeeklyChartClick}>
                  <CartesianGrid strokeDasharray="3 3" stroke="#f0f0f0" className="dark:opacity-20" />
                  <XAxis dataKey="week_label" tick={{ fontSize: 10 }} interval="preserveStartEnd" />
                  <YAxis tick={{ fontSize: 12 }} />
                  <Tooltip 
                    labelFormatter={(label) => `${t('dashboard.weekPrefix')} ${label.replace('S', '')}`}
                    allowEscapeViewBox={{ x: true, y: true }}
                    portal={tooltipPortal}
                    wrapperStyle={tooltipWrapperStyle}
                  />
                  <Legend />
                  <Line
                    type="monotone"
                    dataKey="accidents"
                    stroke="#dc2626"
                    strokeWidth={2}
                    dot={{ fill: '#dc2626', r: 3 }}
                    name={t('dashboard.accidents')}
                  />
                  <Line
                    type="monotone"
                    dataKey="trainings"
                    stroke="#3b82f6"
                    strokeWidth={2}
                    dot={{ fill: '#3b82f6', r: 3 }}
                    name={t('dashboard.training.totalTrainings')}
                  />
                  <Line
                    type="monotone"
                    dataKey="inspections"
                    stroke="#16a34a"
                    strokeWidth={2}
                    dot={{ fill: '#16a34a', r: 3 }}
                    name={t('dashboard.inspections')}
                  />
                </LineChart>
              </ResponsiveContainer>
            </div>
            {selectedWeek && (
              <div className="mt-4 text-xs text-gray-600 dark:text-gray-300">
                <div className="flex items-center justify-between mb-1">
                  <p className="font-semibold">{t('dashboard.detailsForWeek', { week: selectedWeek.week_label })}</p>
                  <button
                    type="button"
                    onClick={() => navigate('/admin/kpi')}
                    className="btn-secondary btn-sm"
                  >
                    {t('dashboard.viewKpiReports')}
                  </button>
                </div>
                <div className="grid grid-cols-3 gap-4">
                  <div>
                    <p className="text-gray-500 dark:text-gray-400">{t('dashboard.accidents')}</p>
                    <p className="font-semibold">{selectedWeek.accidents ?? 0}</p>
                  </div>
                  <div>
                    <p className="text-gray-500 dark:text-gray-400">{t('dashboard.training.totalTrainings')}</p>
                    <p className="font-semibold">{selectedWeek.trainings ?? 0}</p>
                  </div>
                  <div>
                    <p className="text-gray-500 dark:text-gray-400">{t('dashboard.inspections')}</p>
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
            <h3 className="font-semibold text-gray-900 dark:text-gray-100">{t('dashboard.tfTgRates')}</h3>
          </div>
          <div className="card-body">
            <div className="h-80">
              <ResponsiveContainer width="100%" height="100%">
                <ComposedChart data={filteredWeeklyTrends}>
                  <CartesianGrid strokeDasharray="3 3" stroke="#f0f0f0" className="dark:opacity-20" />
                  <XAxis dataKey="week_label" tick={{ fontSize: 10 }} interval="preserveStartEnd" />
                  <YAxis 
                    yAxisId="left" 
                    tick={{ fontSize: 12 }} 
                    stroke="#f59e0b"
                    label={{ value: t('dashboard.rates.frequencyRate'), angle: -90, position: 'insideLeft', style: { fill: '#f59e0b' } }}
                  />
                  <YAxis 
                    yAxisId="right" 
                    orientation="right" 
                    tick={{ fontSize: 12 }} 
                    stroke="#8b5cf6"
                    label={{ value: t('dashboard.rates.severityRate'), angle: 90, position: 'insideRight', style: { fill: '#8b5cf6' } }}
                  />
                  <Tooltip 
                    labelFormatter={(label) => `${t('dashboard.weekPrefix')} ${label.replace('S', '')}`}
                    formatter={(value, name) => [Number(value).toFixed(4), name]}
                    allowEscapeViewBox={{ x: true, y: true }}
                    portal={tooltipPortal}
                    wrapperStyle={tooltipWrapperStyle}
                  />
                  <Legend />
                  <Bar yAxisId="left" dataKey="tf" fill="#f59e0b" name={t('dashboard.rates.frequencyRate')} radius={[4, 4, 0, 0]} />
                  <Bar yAxisId="right" dataKey="tg" fill="#8b5cf6" name={t('dashboard.rates.severityRate')} radius={[4, 4, 0, 0]} />
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
                {visibleProjectsSorted.map((project) => (
                  <option key={project.id} value={project.id}>
                    {getProjectLabel(project)}
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

                  const approvedCount = weekData?.approved_count ?? 0
                  const submittedCount = weekData?.submitted_count ?? 0
                  const draftCount = weekData?.draft_count ?? 0
                  const totalProjects = weekData?.total_projects ?? 0

                  if (totalProjects <= 0) {
                    return null
                  }

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

                      const projectLabel = proj.project_name || proj.project_code
                      const projectTitle = proj.project_name && proj.project_code
                        ? `${proj.project_name} (${proj.project_code})`
                        : (proj.project_name || proj.project_code || '')

                      return (
                        <div
                          key={proj.project_id}
                          className="flex items-center justify-between gap-2 bg-gray-800 rounded px-2 py-1.5"
                        >
                          <span className="truncate font-medium" title={projectTitle}>{projectLabel}</span>
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
      {compareData && (
        <div className="card mt-6">
          <div className="card-header">
            <h3 className="font-semibold text-gray-900 dark:text-gray-100">
              {t('dashboard.yearOverYearSummary', { year, compareYear })}
            </h3>
          </div>
          <div className="card-body grid grid-cols-1 md:grid-cols-4 gap-4 text-sm">
            <div>
              <p className="text-gray-500 dark:text-gray-400 flex items-center gap-2">
                <span>{t('dashboard.safety.totalAccidents')}</span>
                {yoyIndicator(
                  focusedKpiSummary.total_accidents,
                  compareData?.kpi_summary?.total_accidents,
                  { higherIsBetter: false }
                )}
              </p>
              <p className="font-semibold text-gray-900 dark:text-gray-100">
                {focusedKpiSummary.total_accidents ?? 0} <span className="text-xs text-gray-400">({year})</span>
              </p>
              <p className="text-xs text-gray-500 dark:text-gray-400">
                {compareData?.kpi_summary?.total_accidents ?? 0} ({compareYear})
              </p>
            </div>
            <div>
              <p className="text-gray-500 dark:text-gray-400 flex items-center gap-2">
                <span>{t('dashboard.training.totalTrainings')}</span>
                {yoyIndicator(
                  focusedKpiSummary.total_trainings,
                  compareData?.training_data?.total ?? compareData?.kpi_summary?.total_trainings,
                  { higherIsBetter: true }
                )}
              </p>
              <p className="font-semibold text-gray-900 dark:text-gray-100">
                {focusedKpiSummary.total_trainings ?? 0} <span className="text-xs text-gray-400">({year})</span>
              </p>
              <p className="text-xs text-gray-500 dark:text-gray-400">
                {compareData?.training_data?.total ?? compareData?.kpi_summary?.total_trainings ?? 0} ({compareYear})
              </p>
            </div>
            <div>
              <p className="text-gray-500 dark:text-gray-400 flex items-center gap-2">
                <span>{t('dashboard.inspections')}</span>
                {yoyIndicator(
                  focusedKpiSummary.total_inspections,
                  compareData?.inspection_data?.stats?.total ?? compareData?.kpi_summary?.total_inspections,
                  { higherIsBetter: true }
                )}
              </p>
              <p className="font-semibold text-gray-900 dark:text-gray-100">
                {focusedKpiSummary.total_inspections ?? 0} <span className="text-xs text-gray-400">({year})</span>
              </p>
              <p className="text-xs text-gray-500 dark:text-gray-400">
                {compareData?.inspection_data?.stats?.total ?? compareData?.kpi_summary?.total_inspections ?? 0} ({compareYear})
              </p>
            </div>
            <div>
              <p className="text-gray-500 dark:text-gray-400 flex items-center gap-2">
                <span>{t('dashboard.tfTgRates')}</span>
                {yoyIndicator(
                  Number(focusedKpiSummary.avg_tf ?? 0) + Number(focusedKpiSummary.avg_tg ?? 0),
                  Number(compareData?.kpi_summary?.avg_tf ?? 0) + Number(compareData?.kpi_summary?.avg_tg ?? 0),
                  { higherIsBetter: false }
                )}
              </p>
              <p className="font-semibold text-gray-900 dark:text-gray-100">
                {Number(focusedKpiSummary.avg_tf ?? 0).toFixed(2)} / {Number(focusedKpiSummary.avg_tg ?? 0).toFixed(2)}
                <span className="text-xs text-gray-400"> ({year})</span>
              </p>
              <p className="text-xs text-gray-500 dark:text-gray-400">
                {Number(compareData?.kpi_summary?.avg_tf ?? 0).toFixed(2)} / {Number(compareData?.kpi_summary?.avg_tg ?? 0).toFixed(2)} ({compareYear})
              </p>
            </div>
          </div>
        </div>
      )}

      {/* Project Performance Table */}
      <div className="card">
        <div className="card-header flex items-center justify-between">
          <h3 className="font-semibold text-gray-900 dark:text-gray-100">{t('dashboard.projectPerformance')}</h3>
          <Link to="/admin/projects" className="text-sm text-hse-primary hover:underline">
            {t('dashboard.viewAllProjects')}
          </Link>
        </div>

        {filteredProjectPerformance.length === 0 ? (
          <div className="p-6 text-center text-sm text-gray-500 dark:text-gray-400">
            {t('dashboard.noProjectData')}
          </div>
        ) : (
          <>
            {/* Mobile cards */}
            <div className="space-y-3 p-4 md:hidden">
              {filteredProjectPerformance.slice(0, 5).map((project) => (
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
                        <span className="font-semibold">{t('dashboard.reports')}:</span> {project.reports_count}
                      </p>
                      <p>
                        <span className="font-semibold">{t('dashboard.training.totalTrainings')}:</span> {project.total_trainings}
                      </p>
                    </div>
                  </div>

                  <div className="mt-3 flex items-center justify-between text-[11px] text-gray-600 dark:text-gray-300">
                    <span>
                      {t('dashboard.accidents')}{': '}
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
                    <th>{t('common.project')}</th>
                    <th>{t('dashboard.reports')}</th>
                    <th>{t('dashboard.accidents')}</th>
                    <th>{t('dashboard.training.totalTrainings')}</th>
                    <th>{t('dashboard.avgTf')}</th>
                    <th>{t('dashboard.avgTg')}</th>
                  </tr>
                </thead>
                <tbody>
                  {filteredProjectPerformance.slice(0, 5).map((project) => (
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
                    {report.project?.name || t('common.unknown')}
                  </p>
                  <p className="text-sm text-gray-500 dark:text-gray-400">
                    {report.report_month}/{report.report_year} • {t('common.submittedBy')}: {report.submitter?.name || t('common.unknown')}
                  </p>
                </div>
                <span className={`badge ${
                  report.status === 'approved' ? 'badge-success' :
                  report.status === 'submitted' ? 'badge-warning' :
                  report.status === 'rejected' ? 'badge-danger' : 'badge-info'
                }`}>
                  {getReportStatusLabel(report.status)}
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
