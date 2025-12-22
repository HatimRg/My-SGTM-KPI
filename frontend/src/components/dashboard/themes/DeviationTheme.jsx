import { memo, useEffect, useMemo, useState } from 'react'
import { useTranslation } from '../../../i18n'
import { dashboardService } from '../../../services/api'
import {
  AlertTriangle,
  Clock,
  CheckCircle2,
  Timer,
} from 'lucide-react'
import {
  AreaChart,
  Area,
  BarChart,
  Bar,
  PieChart,
  Pie,
  Cell,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
  Legend
} from 'recharts'

const COLORS = {
  open: '#dc2626',
  in_progress: '#f59e0b',
  closed: '#16a34a',
  overdue: '#7c3aed',
  trend: '#3b82f6',
}

const MetricCard = memo(function MetricCard({ title, value, icon: Icon, color, subtitle }) {
  const colors = {
    red: 'border-red-200 bg-red-50 dark:border-red-700 dark:bg-red-900/50 text-red-600 dark:text-red-400',
    amber: 'border-amber-200 bg-amber-50 dark:border-amber-700 dark:bg-amber-900/50 text-amber-600 dark:text-amber-400',
    green: 'border-green-200 bg-green-50 dark:border-green-700 dark:bg-green-900/50 text-green-600 dark:text-green-400',
    purple: 'border-purple-200 bg-purple-50 dark:border-purple-700 dark:bg-purple-900/50 text-purple-600 dark:text-purple-400',
    blue: 'border-blue-200 bg-blue-50 dark:border-blue-700 dark:bg-blue-900/50 text-blue-600 dark:text-blue-400',
  }

  return (
    <div className={`rounded-xl border-2 p-4 ${colors[color]}`}>
      <div className="flex items-center gap-2 mb-2">
        <Icon className="w-5 h-5" />
        <span className="text-sm font-medium text-gray-600 dark:text-gray-300">{title}</span>
      </div>
      <p className="text-2xl font-bold text-gray-900 dark:text-gray-100">{value}</p>
      {subtitle && <p className="text-xs text-gray-500 dark:text-gray-400 mt-1">{subtitle}</p>}
    </div>
  )
})

const DeviationTheme = memo(function DeviationTheme({ year, projects, projectId = 'all', week = 'all' }) {
  const t = useTranslation()
  const [loading, setLoading] = useState(true)
  const [charts, setCharts] = useState(null)

  const avgCloseDisplay = useMemo(() => {
    const avgDays = charts?.avg_close_days
    if (avgDays === null || avgDays === undefined) return '—'
    const days = Number(avgDays)
    if (Number.isNaN(days)) return '—'
    if (days < 2) {
      const totalMinutes = Math.max(0, Math.round(days * 24 * 60))
      const hh = Math.floor(totalMinutes / 60)
      const mm = totalMinutes % 60
      return `${hh.toString().padStart(2, '0')}h${mm.toString().padStart(2, '0')}min`
    }
    const rounded = Math.round(days * 10) / 10
    const asText = Number.isInteger(rounded) ? String(rounded) : rounded.toFixed(1)
    return `${asText}d`
  }, [charts?.avg_close_days])

  useEffect(() => {
    let mounted = true
    const fetchCharts = async () => {
      setLoading(true)
      try {
        const params = { year }
        if (projectId !== 'all') params.project_id = projectId
        if (week !== 'all') params.week = week

        const res = await dashboardService.getSorCharts(params)
        if (!mounted) return
        setCharts(res.data.data)
      } finally {
        if (mounted) setLoading(false)
      }
    }

    fetchCharts()
    return () => {
      mounted = false
    }
  }, [year, projectId, week])

  const stats = charts?.stats ?? {}
  const byStatus = charts?.by_status ?? []
  const byCategory = charts?.by_category ?? []
  const byWeek = charts?.by_week ?? []

  const statusPie = useMemo(() => {
    const labelFor = (s) => {
      if (s === 'open') return t('dashboard.deviations.status.open')
      if (s === 'in_progress') return t('dashboard.deviations.status.inProgress')
      if (s === 'closed') return t('dashboard.deviations.status.closed')
      return s
    }

    const colorFor = (s) => {
      if (s === 'open') return COLORS.open
      if (s === 'in_progress') return COLORS.in_progress
      if (s === 'closed') return COLORS.closed
      return COLORS.trend
    }

    return byStatus
      .map((x) => ({ name: labelFor(x.status), value: x.count, color: colorFor(x.status) }))
      .filter((x) => x.value > 0)
  }, [byStatus, t])

  const categoryBars = useMemo(() => {
    return byCategory
      .slice(0, 10)
      .map((x) => ({
        category: (x.label ?? x.category ?? '').toString().slice(0, 28),
        count: x.count ?? 0,
      }))
  }, [byCategory])

  return (
    <div className="space-y-6 animate-fade-in">
      {/* Metrics */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        <MetricCard
          title={t('dashboard.deviations.total')}
          value={stats.total ?? 0}
          icon={AlertTriangle}
          color="blue"
          subtitle={t('dashboard.deviations.yearContext', { year })}
        />
        <MetricCard
          title={t('dashboard.deviations.open')}
          value={stats.open ?? 0}
          icon={Clock}
          color="red"
          subtitle={t('dashboard.deviations.inProgressAndOpen')}
        />
        <MetricCard
          title={t('dashboard.deviations.closed')}
          value={stats.closed ?? 0}
          icon={CheckCircle2}
          color="green"
          subtitle={t('dashboard.deviations.closedSubtitle')}
        />
        <MetricCard
          title={t('dashboard.deviations.avgCloseDays')}
          value={avgCloseDisplay}
          icon={Timer}
          color="purple"
          subtitle={t('dashboard.deviations.avgCloseSubtitle')}
        />
      </div>

      {/* Charts */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <div className="card">
          <div className="card-header">
            <h3 className="font-semibold text-gray-900 dark:text-gray-100">{t('dashboard.deviations.trend')}</h3>
          </div>
          <div className="card-body">
            <div className="h-64">
              <ResponsiveContainer width="100%" height="100%">
                <AreaChart data={byWeek}>
                  <defs>
                    <linearGradient id="devTrendGradient" x1="0" y1="0" x2="0" y2="1">
                      <stop offset="5%" stopColor={COLORS.trend} stopOpacity={0.8} />
                      <stop offset="95%" stopColor={COLORS.trend} stopOpacity={0.1} />
                    </linearGradient>
                  </defs>
                  <CartesianGrid strokeDasharray="3 3" stroke="#f0f0f0" className="dark:opacity-20" />
                  <XAxis dataKey="week_label" tick={{ fontSize: 11 }} />
                  <YAxis allowDecimals={false} tick={{ fontSize: 11 }} />
                  <Tooltip
                    contentStyle={{ backgroundColor: '#1f2937', border: 'none', borderRadius: '8px' }}
                    labelStyle={{ color: '#f3f4f6' }}
                  />
                  <Area
                    type="monotone"
                    dataKey="count"
                    stroke={COLORS.trend}
                    fill="url(#devTrendGradient)"
                    name={t('dashboard.deviations.total')}
                  />
                </AreaChart>
              </ResponsiveContainer>
            </div>
            {loading && <div className="text-xs text-gray-400 mt-2">{t('common.loading')}</div>}
          </div>
        </div>

        <div className="card">
          <div className="card-header">
            <h3 className="font-semibold text-gray-900 dark:text-gray-100">{t('dashboard.deviations.byStatus')}</h3>
          </div>
          <div className="card-body">
            <div className="h-64">
              {statusPie.length > 0 ? (
                <ResponsiveContainer width="100%" height="100%">
                  <PieChart>
                    <Pie
                      data={statusPie}
                      cx="50%"
                      cy="50%"
                      innerRadius={50}
                      outerRadius={80}
                      paddingAngle={5}
                      dataKey="value"
                      label={({ name, value }) => `${name}: ${value}`}
                    >
                      {statusPie.map((entry, i) => (
                        <Cell key={`cell-${i}`} fill={entry.color} />
                      ))}
                    </Pie>
                    <Tooltip />
                    <Legend />
                  </PieChart>
                </ResponsiveContainer>
              ) : (
                <div className="flex items-center justify-center h-full text-gray-400">
                  {t('common.noData')}
                </div>
              )}
            </div>
          </div>
        </div>

        <div className="card lg:col-span-2">
          <div className="card-header">
            <h3 className="font-semibold text-gray-900 dark:text-gray-100">{t('dashboard.deviations.byCategory')}</h3>
          </div>
          <div className="card-body">
            <div className="h-72">
              {categoryBars.length > 0 ? (
                <ResponsiveContainer width="100%" height="100%">
                  <BarChart data={categoryBars}>
                    <CartesianGrid strokeDasharray="3 3" stroke="#f0f0f0" className="dark:opacity-20" />
                    <XAxis dataKey="category" tick={{ fontSize: 10 }} interval={0} />
                    <YAxis allowDecimals={false} tick={{ fontSize: 11 }} />
                    <Tooltip
                      contentStyle={{ backgroundColor: '#1f2937', border: 'none', borderRadius: '8px' }}
                      labelStyle={{ color: '#f3f4f6' }}
                    />
                    <Bar dataKey="count" fill={COLORS.trend} name={t('dashboard.deviations.total')} radius={[4, 4, 0, 0]} />
                  </BarChart>
                </ResponsiveContainer>
              ) : (
                <div className="flex items-center justify-center h-full text-gray-400">{t('common.noData')}</div>
              )}
            </div>
          </div>
        </div>
      </div>
    </div>
  )
})

export default DeviationTheme
