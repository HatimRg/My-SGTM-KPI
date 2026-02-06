import { Fragment, memo, useEffect, useMemo, useState } from 'react'
import { useTranslation } from '../../../i18n'
import { dashboardService } from '../../../services/api'
import {
  AlertTriangle,
  Clock,
  CheckCircle2,
  Timer,
  Layers,
  Grid3X3,
  Users,
} from 'lucide-react'
import {
  BarChart,
  Bar,
  Cell,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
  Legend,
  LabelList,
  Treemap,
  ScatterChart,
  Scatter,
  ZAxis,
} from 'recharts'

const COLORS = {
  open: '#dc2626',
  in_progress: '#f59e0b',
  closed: '#16a34a',
  overdue: '#7c3aed',
  trend: '#3b82f6',
  neutral: '#64748b',
  resolved: '#16a34a',
  unresolved: '#dc2626',
}

const POLE_PALETTE = ['#2563eb', '#7c3aed', '#f59e0b', '#10b981', '#ef4444', '#06b6d4', '#a855f7', '#84cc16']

const tooltipPortal = typeof document !== 'undefined' ? document.body : null
const tooltipWrapperStyle = { zIndex: 9999, pointerEvents: 'none' }

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

const DeviationTheme = memo(function DeviationTheme({ year, projects: _projects, projectId = 'all', week = 'all', pole = '' }) {
  const t = useTranslation()
  const [loading, setLoading] = useState(true)
  const [kpis, setKpis] = useState(null)
  const [projectTreemap, setProjectTreemap] = useState(null)
  const [themeAvgResolution, setThemeAvgResolution] = useState(null)
  const [themeResolutionBox, setThemeResolutionBox] = useState(null)
  const [themeUnresolvedCount, setThemeUnresolvedCount] = useState(null)
  const [themeResolvedUnresolved, setThemeResolvedUnresolved] = useState(null)
  const [themeBubble, setThemeBubble] = useState(null)
  const [userThemeAvgResolution, setUserThemeAvgResolution] = useState(null)
  const [poleThemeUnresolvedRate, setPoleThemeUnresolvedRate] = useState(null)

  const hourUnit = t('common.hourShort') ?? 'h'
  const dayUnit = t('common.dayShort') ?? 'd'

  const formatHours = (value) => {
    if (value === null || value === undefined) return '—'
    const v = Number(value)
    if (Number.isNaN(v)) return '—'
    if (v < 48) return `${Math.round(v * 10) / 10}${hourUnit}`
    const days = Math.round((v / 24) * 10) / 10
    return `${days}${dayUnit}`
  }

  const poleColor = useMemo(() => {
    const map = new Map()
    const hash = (s) => {
      const str = String(s ?? '')
      let h = 0
      for (let i = 0; i < str.length; i += 1) {
        h = ((h << 5) - h) + str.charCodeAt(i)
        h |= 0
      }
      return Math.abs(h)
    }

    const poles = [
      ...(new Set([
        ...((themeBubble?.items ?? []).map((x) => x?.pole).filter(Boolean)),
        ...((poleThemeUnresolvedRate?.rows ?? []).map((x) => x?.pole).filter(Boolean)),
      ])),
    ]
    poles.forEach((p) => {
      const idx = hash(p) % POLE_PALETTE.length
      map.set(p, POLE_PALETTE[idx])
    })
    return (p) => {
      const key = p && String(p).trim() !== '' ? String(p) : '—'
      if (!map.has(key)) {
        const idx = hash(key) % POLE_PALETTE.length
        map.set(key, POLE_PALETTE[idx])
      }
      return map.get(key)
    }
  }, [themeBubble?.items, poleThemeUnresolvedRate?.rows])

  useEffect(() => {
    let mounted = true
    const fetchCharts = async () => {
      setLoading(true)
      try {
        const params = { year }
        if (pole) params.pole = pole
        if (projectId !== 'all') params.project_id = projectId
        if (week !== 'all') params.week = week

        const [
          rKpis,
          rProjectTreemap,
          rThemeAvgResolution,
          rThemeResolutionBox,
          rThemeUnresolvedCount,
          rThemeResolvedUnresolved,
          rThemeBubble,
          rUserThemeAvgResolution,
          rPoleThemeUnresolvedRate,
        ] = await Promise.all([
          dashboardService.getSorAnalyticsKpis(params),
          dashboardService.getSorProjectTreemap(params),
          dashboardService.getSorThemeAvgResolution(params),
          dashboardService.getSorThemeResolutionBox(params),
          dashboardService.getSorThemeUnresolvedCount(params),
          dashboardService.getSorThemeResolvedUnresolved(params),
          dashboardService.getSorThemeBubble(params),
          dashboardService.getSorUserThemeAvgResolution(params),
          dashboardService.getSorPoleThemeUnresolvedRate(params),
        ])

        if (!mounted) return
        setKpis(rKpis.data.data)
        setProjectTreemap(rProjectTreemap.data.data)
        setThemeAvgResolution(rThemeAvgResolution.data.data)
        setThemeResolutionBox(rThemeResolutionBox.data.data)
        setThemeUnresolvedCount(rThemeUnresolvedCount.data.data)
        setThemeResolvedUnresolved(rThemeResolvedUnresolved.data.data)
        setThemeBubble(rThemeBubble.data.data)
        setUserThemeAvgResolution(rUserThemeAvgResolution.data.data)
        setPoleThemeUnresolvedRate(rPoleThemeUnresolvedRate.data.data)
      } finally {
        if (mounted) setLoading(false)
      }
    }

    fetchCharts()
    return () => {
      mounted = false
    }
  }, [year, projectId, week, pole])

  const tileTotal = kpis?.total ?? 0
  const tileUnresolvedPct = kpis?.unresolved_pct ?? 0
  const tileAvgResolution = kpis?.avg_resolution_hours
  const worstTheme = kpis?.worst_theme
  const worstProject = kpis?.worst_project
  const worstUser = kpis?.highest_avg_resolution_user

  const treemapData = useMemo(() => {
    const items = projectTreemap?.items ?? []
    return items.map((x) => ({
      name: x.name,
      size: x.count ?? 0,
      pole: x.pole ?? '—',
      count: x.count ?? 0,
    }))
  }, [projectTreemap?.items])

  const avgResolutionBars = useMemo(() => {
    const items = themeAvgResolution?.items ?? []
    return items
      .filter((x) => x?.avg_hours !== null && x?.avg_hours !== undefined)
      .map((x) => ({
        theme: (x.theme ?? '').toString().slice(0, 28),
        theme_full: x.theme,
        avg_hours: Number(x.avg_hours ?? 0),
        count: x.count ?? 0,
      }))
  }, [themeAvgResolution?.items])

  const avgResolutionMax = useMemo(() => {
    const max = Math.max(0, ...(avgResolutionBars.map((x) => x.avg_hours)))
    return max > 0 ? max : 1
  }, [avgResolutionBars])

  const unresolvedBars = useMemo(() => {
    const items = themeUnresolvedCount?.items ?? []
    return items.map((x) => ({
      theme: (x.theme ?? '').toString().slice(0, 28),
      theme_full: x.theme,
      count: x.count ?? 0,
    }))
  }, [themeUnresolvedCount?.items])

  const resolvedUnresolvedBars = useMemo(() => {
    const items = themeResolvedUnresolved?.items ?? []
    return items.map((x) => ({
      theme: (x.theme ?? '').toString().slice(0, 26),
      theme_full: x.theme,
      resolved: x.resolved ?? 0,
      unresolved: x.unresolved ?? 0,
      total: x.total ?? 0,
    }))
  }, [themeResolvedUnresolved?.items])

  const bubbleData = useMemo(() => {
    const items = themeBubble?.items ?? []
    return items
      .filter((x) => x?.avg_hours !== null && x?.avg_hours !== undefined)
      .map((x) => ({
        theme: (x.theme ?? '').toString().slice(0, 26),
        theme_full: x.theme,
        avg_hours: Number(x.avg_hours ?? 0),
        count: Number(x.count ?? 0),
        pole: x.pole ?? '—',
      }))
  }, [themeBubble?.items])

  const poleTotals = useMemo(() => {
    const items = themeBubble?.items ?? []
    const bucket = new Map()
    items.forEach((x) => {
      const p = x?.pole && String(x.pole).trim() !== '' ? String(x.pole) : '—'
      const count = Number(x?.count ?? 0)
      const avg = Number(x?.avg_hours ?? 0)
      if (!bucket.has(p)) {
        bucket.set(p, { pole: p, total: 0, _weightedHours: 0 })
      }
      const row = bucket.get(p)
      row.total += count
      row._weightedHours += count * avg
    })

    return Array.from(bucket.values())
      .map((r) => ({
        pole: r.pole,
        total: r.total,
        avg_hours: r.total > 0 ? (r._weightedHours / r.total) : 0,
      }))
      .sort((a, b) => b.total - a.total)
  }, [themeBubble?.items])

  const boxRows = useMemo(() => {
    const items = themeResolutionBox?.items ?? []
    return items
      .filter((x) => x && x.count > 0)
      .map((x) => ({
        theme: (x.theme ?? '').toString().slice(0, 26),
        theme_full: x.theme,
        count: x.count,
        min: Number(x.min ?? 0),
        q1: Number(x.q1 ?? 0),
        median: Number(x.median ?? 0),
        q3: Number(x.q3 ?? 0),
        max: Number(x.max ?? 0),
      }))
  }, [themeResolutionBox?.items])

  const boxScaleMax = useMemo(() => {
    const max = Math.max(0, ...(boxRows.map((x) => x.max)))
    return max > 0 ? max : 1
  }, [boxRows])

  const heatColor = (value, max, base) => {
    if (value === null || value === undefined) return 'transparent'
    const v = Number(value)
    if (Number.isNaN(v) || v <= 0) return 'transparent'
    const ratio = Math.min(1, Math.max(0, v / Math.max(1, max)))
    const alpha = 0.15 + ratio * 0.85
    return `rgba(${base[0]}, ${base[1]}, ${base[2]}, ${alpha})`
  }

  return (
    <div className="space-y-6 animate-fade-in">
      <div className="grid grid-cols-2 lg:grid-cols-5 gap-4">
        <MetricCard
          title={t('dashboard.deviations.total')}
          value={tileTotal}
          icon={AlertTriangle}
          color="blue"
          subtitle={t('dashboard.deviations.yearContext', { year })}
        />
        <MetricCard
          title={t('dashboard.deviations.analytics.unresolvedPct')}
          value={`${tileUnresolvedPct}%`}
          icon={Clock}
          color="red"
          subtitle={t('dashboard.deviations.analytics.unresolvedSubtitle')}
        />
        <MetricCard
          title={t('dashboard.deviations.analytics.avgResolution')}
          value={tileAvgResolution === null || tileAvgResolution === undefined ? '—' : formatHours(tileAvgResolution)}
          icon={CheckCircle2}
          color="green"
          subtitle={t('dashboard.deviations.analytics.avgResolutionSubtitle')}
        />
        <MetricCard
          title={t('dashboard.deviations.analytics.worstTheme')}
          value={worstTheme?.label ?? '—'}
          icon={Timer}
          color="purple"
          subtitle={worstTheme ? `${formatHours(worstTheme.avg_resolution_hours)} · ${worstTheme.unresolved ?? 0}` : '—'}
        />
        <MetricCard
          title={t('dashboard.deviations.analytics.worstProject')}
          value={worstProject?.name ?? (worstProject?.code ?? '—')}
          icon={Layers}
          color="amber"
          subtitle={worstUser ? `${worstUser.name} · ${formatHours(worstUser.avg_resolution_hours)}` : '—'}
        />
      </div>
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <div className="card">
          <div className="card-header">
            <h3 className="font-semibold text-gray-900 dark:text-gray-100">{t('dashboard.deviations.analytics.poleTotals')}</h3>
          </div>
          <div className="card-body">
            <div className="h-[420px]">
              {poleTotals.length > 0 ? (
                <ResponsiveContainer width="100%" height="100%">
                  <BarChart
                    data={poleTotals}
                    layout="vertical"
                    margin={{ left: 12, right: 92, top: 10, bottom: 10 }}
                    barCategoryGap={14}
                  >
                    <CartesianGrid strokeDasharray="3 3" stroke="#f0f0f0" className="dark:opacity-20" />
                    <XAxis type="number" tick={{ fontSize: 11 }} />
                    <YAxis type="category" dataKey="pole" width={92} tick={{ fontSize: 11 }} />
                    <Tooltip
                      contentStyle={{ backgroundColor: '#1f2937', border: 'none', borderRadius: '8px' }}
                      labelStyle={{ color: '#f3f4f6' }}
                      allowEscapeViewBox={{ x: true, y: true }}
                      portal={tooltipPortal}
                      wrapperStyle={tooltipWrapperStyle}
                      formatter={(value) => [value, t('dashboard.deviations.analytics.count')]}
                    />
                    <Bar dataKey="total" radius={[0, 6, 6, 0]} barSize={38}>
                      {poleTotals.map((entry) => (
                        <Cell key={entry.pole} fill={poleColor(entry.pole)} />
                      ))}
                      <LabelList dataKey="total" position="right" offset={8} fill="#111827" fontSize={11} />
                    </Bar>
                  </BarChart>
                </ResponsiveContainer>
              ) : (
                <div className="flex items-center justify-center h-full text-gray-400">{t('common.noData')}</div>
              )}
            </div>
          </div>
        </div>

        <div className="card">
          <div className="card-header">
            <h3 className="font-semibold text-gray-900 dark:text-gray-100">{t('dashboard.deviations.analytics.projectTreemap')}</h3>
          </div>
          <div className="card-body">
            <div className="h-[420px]">
              {treemapData.length > 0 ? (
                <ResponsiveContainer width="100%" height="100%">
                  <Treemap
                    data={treemapData}
                    dataKey="size"
                    nameKey="name"
                    stroke="#ffffff"
                    fill="#93c5fd"
                    content={({ depth, x, y, width, height, name, payload }) => {
                      const p = payload?.pole
                      const count = payload?.count
                      const fill = poleColor(p)
                      const show = width > 70 && height > 28
                      return (
                        <g>
                          <rect x={x} y={y} width={width} height={height} style={{ fill, stroke: '#ffffff', strokeWidth: 2 }} />
                          {show && (
                            <text x={x + 6} y={y + 18} fill="#ffffff" fontSize={11} fontWeight={700}>
                              {String(name).slice(0, 18)}
                            </text>
                          )}
                          {show && (
                            <text x={x + 6} y={y + 34} fill="#ffffff" fontSize={11}>
                              {count}
                            </text>
                          )}
                        </g>
                      )
                    }}
                  />
                </ResponsiveContainer>
              ) : (
                <div className="flex items-center justify-center h-full text-gray-400">{t('common.noData')}</div>
              )}
            </div>
          </div>
        </div>

        <div className="card">
          <div className="card-header">
            <h3 className="font-semibold text-gray-900 dark:text-gray-100">{t('dashboard.deviations.analytics.themeAvgResolution')}</h3>
          </div>
          <div className="card-body">
            <div className="h-80">
              {avgResolutionBars.length > 0 ? (
                <ResponsiveContainer width="100%" height="100%">
                  <BarChart data={avgResolutionBars} layout="vertical" margin={{ left: 10, right: 20, top: 10, bottom: 10 }}>
                    <CartesianGrid strokeDasharray="3 3" stroke="#f0f0f0" className="dark:opacity-20" />
                    <XAxis type="number" tick={{ fontSize: 11 }} />
                    <YAxis type="category" dataKey="theme" width={160} tick={{ fontSize: 11 }} />
                    <Tooltip
                      contentStyle={{ backgroundColor: '#1f2937', border: 'none', borderRadius: '8px' }}
                      labelStyle={{ color: '#f3f4f6' }}
                      allowEscapeViewBox={{ x: true, y: true }}
                      portal={tooltipPortal}
                      wrapperStyle={tooltipWrapperStyle}
                      formatter={(value, name, props) => [formatHours(value), t('dashboard.deviations.analytics.hours')]}
                      labelFormatter={(label, payload) => payload?.[0]?.payload?.theme_full ?? label}
                    />
                    <Bar dataKey="avg_hours" radius={[0, 6, 6, 0]}>
                      {avgResolutionBars.map((entry) => {
                        const ratio = Math.min(1, Math.max(0, entry.avg_hours / avgResolutionMax))
                        const r = Math.round(22 + ratio * 220)
                        const g = Math.round(163 - ratio * 120)
                        const b = Math.round(74 - ratio * 40)
                        return <Cell key={entry.theme_full} fill={`rgb(${r}, ${g}, ${b})`} />
                      })}
                      <LabelList dataKey="avg_hours" position="right" formatter={(v) => formatHours(v)} fill="#111827" fontSize={11} />
                    </Bar>
                  </BarChart>
                </ResponsiveContainer>
              ) : (
                <div className="flex items-center justify-center h-full text-gray-400">{t('common.noData')}</div>
              )}
            </div>
          </div>
        </div>

        <div className="card lg:col-span-2">
          <div className="card-header">
            <h3 className="font-semibold text-gray-900 dark:text-gray-100">{t('dashboard.deviations.analytics.themeResolutionBox')}</h3>
          </div>
          <div className="card-body">
            <div className="space-y-2">
              {boxRows.length === 0 ? (
                <div className="flex items-center justify-center h-72 text-gray-400">{t('common.noData')}</div>
              ) : (
                <div className="space-y-2">
                  {boxRows.map((r) => {
                    const left = (r.min / boxScaleMax) * 100
                    const right = (r.max / boxScaleMax) * 100
                    const bLeft = (r.q1 / boxScaleMax) * 100
                    const bRight = (r.q3 / boxScaleMax) * 100
                    const med = (r.median / boxScaleMax) * 100
                    return (
                      <div key={r.theme_full} className="grid grid-cols-[220px_1fr] gap-3 items-center">
                        <div className="text-[11px] text-gray-700 dark:text-gray-200 whitespace-nowrap overflow-hidden text-ellipsis" title={r.theme_full}>{r.theme}</div>
                        <div className="relative h-7">
                          <div className="absolute inset-y-0 left-0 right-0 bg-gray-50 dark:bg-white/5 rounded" />
                          <div className="absolute top-1/2 h-[2px] bg-gray-300 dark:bg-white/20" style={{ left: `${left}%`, right: `${100 - right}%`, transform: 'translateY(-50%)' }} />
                          <div className="absolute top-1/2 w-[2px] bg-gray-400 dark:bg-white/40" style={{ left: `${left}%`, height: '10px', transform: 'translate(-50%, -50%)' }} />
                          <div className="absolute top-1/2 w-[2px] bg-gray-400 dark:bg-white/40" style={{ left: `${right}%`, height: '10px', transform: 'translate(-50%, -50%)' }} />
                          <div className="absolute top-1/2 bg-blue-500/70 dark:bg-blue-400/70 rounded" style={{ left: `${bLeft}%`, width: `${Math.max(0, bRight - bLeft)}%`, height: '14px', transform: 'translateY(-50%)' }} />
                          <div className="absolute top-1/2 w-[2px] bg-white" style={{ left: `${med}%`, height: '14px', transform: 'translate(-50%, -50%)' }} />
                          <div className="absolute -top-0.5 right-0 text-[10px] text-gray-500 dark:text-gray-400">{formatHours(r.median)}</div>
                        </div>
                      </div>
                    )
                  })}
                </div>
              )}
            </div>
          </div>
        </div>

        <div className="card">
          <div className="card-header">
            <h3 className="font-semibold text-gray-900 dark:text-gray-100">{t('dashboard.deviations.analytics.unresolvedByTheme')}</h3>
          </div>
          <div className="card-body">
            <div className="h-80">
              {unresolvedBars.length > 0 ? (
                <ResponsiveContainer width="100%" height="100%">
                  <BarChart data={unresolvedBars} layout="vertical" margin={{ left: 10, right: 20, top: 10, bottom: 10 }}>
                    <CartesianGrid strokeDasharray="3 3" stroke="#f0f0f0" className="dark:opacity-20" />
                    <XAxis type="number" tick={{ fontSize: 11 }} />
                    <YAxis type="category" dataKey="theme" width={170} tick={{ fontSize: 11 }} />
                    <Tooltip
                      contentStyle={{ backgroundColor: '#1f2937', border: 'none', borderRadius: '8px' }}
                      labelStyle={{ color: '#f3f4f6' }}
                      allowEscapeViewBox={{ x: true, y: true }}
                      portal={tooltipPortal}
                      wrapperStyle={tooltipWrapperStyle}
                      labelFormatter={(label, payload) => payload?.[0]?.payload?.theme_full ?? label}
                    />
                    <Bar dataKey="count" fill={COLORS.unresolved} radius={[0, 6, 6, 0]}>
                      <LabelList dataKey="count" position="right" fill="#111827" fontSize={11} />
                    </Bar>
                  </BarChart>
                </ResponsiveContainer>
              ) : (
                <div className="flex items-center justify-center h-full text-gray-400">{t('common.noData')}</div>
              )}
            </div>
          </div>
        </div>

        <div className="card">
          <div className="card-header">
            <h3 className="font-semibold text-gray-900 dark:text-gray-100">{t('dashboard.deviations.analytics.resolvedVsUnresolved')}</h3>
          </div>
          <div className="card-body">
            <div className="h-80">
              {resolvedUnresolvedBars.length > 0 ? (
                <ResponsiveContainer width="100%" height="100%">
                  <BarChart data={resolvedUnresolvedBars} layout="vertical" margin={{ left: 10, right: 20, top: 10, bottom: 10 }}>
                    <CartesianGrid strokeDasharray="3 3" stroke="#f0f0f0" className="dark:opacity-20" />
                    <XAxis type="number" tick={{ fontSize: 11 }} />
                    <YAxis type="category" dataKey="theme" width={170} tick={{ fontSize: 11 }} />
                    <Tooltip
                      contentStyle={{ backgroundColor: '#1f2937', border: 'none', borderRadius: '8px' }}
                      labelStyle={{ color: '#f3f4f6' }}
                      allowEscapeViewBox={{ x: true, y: true }}
                      portal={tooltipPortal}
                      wrapperStyle={tooltipWrapperStyle}
                      labelFormatter={(label, payload) => payload?.[0]?.payload?.theme_full ?? label}
                    />
                    <Legend />
                    <Bar dataKey="unresolved" stackId="a" fill={COLORS.unresolved} name={t('dashboard.deviations.analytics.unresolved')} />
                    <Bar dataKey="resolved" stackId="a" fill={COLORS.resolved} name={t('dashboard.deviations.analytics.resolved')} />
                  </BarChart>
                </ResponsiveContainer>
              ) : (
                <div className="flex items-center justify-center h-full text-gray-400">{t('common.noData')}</div>
              )}
            </div>
          </div>
        </div>

        <div className="card lg:col-span-2">
          <div className="card-header">
            <h3 className="font-semibold text-gray-900 dark:text-gray-100">{t('dashboard.deviations.analytics.themeBubble')}</h3>
          </div>
          <div className="card-body">
            <div className="h-96">
              {bubbleData.length > 0 ? (
                <ResponsiveContainer width="100%" height="100%">
                  <ScatterChart margin={{ top: 10, right: 20, left: 10, bottom: 10 }}>
                    <CartesianGrid strokeDasharray="3 3" stroke="#f0f0f0" className="dark:opacity-20" />
                    <XAxis type="number" dataKey="avg_hours" name={t('dashboard.deviations.analytics.avgResolution')} tick={{ fontSize: 11 }} />
                    <YAxis type="category" dataKey="theme" name={t('dashboard.deviations.analytics.theme')} width={220} tick={{ fontSize: 11 }} />
                    <ZAxis type="number" dataKey="count" range={[80, 600]} />
                    <Tooltip
                      cursor={{ strokeDasharray: '3 3' }}
                      contentStyle={{ backgroundColor: '#1f2937', border: 'none', borderRadius: '8px' }}
                      labelStyle={{ color: '#f3f4f6' }}
                      allowEscapeViewBox={{ x: true, y: true }}
                      portal={tooltipPortal}
                      wrapperStyle={tooltipWrapperStyle}
                      formatter={(value, name, props) => {
                        if (name === 'avg_hours') return [formatHours(value), t('dashboard.deviations.analytics.avgResolution')]
                        if (name === 'count') return [value, t('dashboard.deviations.analytics.count')]
                        return [value, name]
                      }}
                      labelFormatter={(label, payload) => payload?.[0]?.payload?.theme_full ?? label}
                    />
                    <Scatter name={t('dashboard.deviations.analytics.theme')} data={bubbleData} fill={COLORS.trend}>
                      {bubbleData.map((entry) => (
                        <Cell key={entry.theme_full} fill={poleColor(entry.pole)} />
                      ))}
                    </Scatter>
                  </ScatterChart>
                </ResponsiveContainer>
              ) : (
                <div className="flex items-center justify-center h-full text-gray-400">{t('common.noData')}</div>
              )}
            </div>
          </div>
        </div>

        <div className="card lg:col-span-2">
          <div className="card-header">
            <h3 className="font-semibold text-gray-900 dark:text-gray-100">{t('dashboard.deviations.analytics.userThemeHeatmap')}</h3>
          </div>
          <div className="card-body">
            <div className="overflow-x-auto">
                {(() => {
                  const themes = userThemeAvgResolution?.themes ?? []
                  const rows = userThemeAvgResolution?.rows ?? []
                  const values = rows.flatMap((r) => themes.map((th) => Number(r?.values?.[th.key] ?? 0))).filter((v) => v > 0)
                  const max = Math.max(0, ...values)
                  if (themes.length === 0 || rows.length === 0) {
                    return <div className="flex items-center justify-center h-72 text-gray-400">{t('common.noData')}</div>
                  }
                  return (
                    <div className="grid min-w-full" style={{ gridTemplateColumns: `220px repeat(${themes.length}, minmax(72px, 1fr))` }}>
                      <div className="text-xs font-semibold text-gray-600 dark:text-gray-300 p-2"><Users className="w-4 h-4 inline-block mr-1" />{t('dashboard.deviations.analytics.user')}</div>
                      {themes.map((th) => (
                        <div key={th.key} className="text-[11px] font-semibold text-gray-600 dark:text-gray-300 p-2 text-center" title={th.label}>{String(th.label).slice(0, 12)}</div>
                      ))}
                      {rows.map((r) => (
                        <Fragment key={r.user_id}>
                          <div className="text-[11px] text-gray-700 dark:text-gray-200 p-2 whitespace-nowrap overflow-hidden text-ellipsis" title={r.user}>{r.user}</div>
                          {themes.map((th) => {
                            const v = r?.values?.[th.key]
                            const bg = heatColor(v, max, [220, 38, 38])
                            return (
                              <div
                                key={`${r.user_id}-${th.key}`}
                                className="text-[11px] font-semibold text-gray-900 dark:text-gray-100 p-2 text-center border border-gray-100 dark:border-white/10"
                                style={{ backgroundColor: bg }}
                                title={`${r.user} · ${th.label}: ${formatHours(v)}`}
                              >
                                {v ? formatHours(v) : ''}
                              </div>
                            )
                          })}
                        </Fragment>
                      ))}
                    </div>
                  )
                })()}
            </div>
          </div>
        </div>

        <div className="card lg:col-span-2">
          <div className="card-header">
            <h3 className="font-semibold text-gray-900 dark:text-gray-100">{t('dashboard.deviations.analytics.poleThemeHeatmap')}</h3>
          </div>
          <div className="card-body">
            <div className="overflow-x-auto">
                {(() => {
                  const themes = poleThemeUnresolvedRate?.themes ?? []
                  const rows = poleThemeUnresolvedRate?.rows ?? []
                  const values = rows.flatMap((r) => themes.map((th) => Number(r?.values?.[th.key] ?? 0))).filter((v) => v > 0)
                  const max = Math.max(0, ...values)
                  if (themes.length === 0 || rows.length === 0) {
                    return <div className="flex items-center justify-center h-72 text-gray-400">{t('common.noData')}</div>
                  }
                  return (
                    <div className="grid" style={{ gridTemplateColumns: `220px repeat(${themes.length}, minmax(64px, 1fr))` }}>
                      <div className="text-xs font-semibold text-gray-600 dark:text-gray-300 p-2"><Grid3X3 className="w-4 h-4 inline-block mr-1" />{t('dashboard.deviations.analytics.pole')}</div>
                      {themes.map((th) => (
                        <div key={th.key} className="text-[11px] font-semibold text-gray-600 dark:text-gray-300 p-2 text-center" title={th.label}>{String(th.label).slice(0, 12)}</div>
                      ))}
                      {rows.map((r) => (
                        <Fragment key={r.pole}>
                          <div className="text-[11px] font-semibold p-2 whitespace-nowrap overflow-hidden text-ellipsis" style={{ color: poleColor(r.pole) }} title={r.pole}>{r.pole}</div>
                          {themes.map((th) => {
                            const v = r?.values?.[th.key]
                            const bg = heatColor(v, max, [220, 38, 38])
                            return (
                              <div
                                key={`${r.pole}-${th.key}`}
                                className="text-[11px] font-semibold text-gray-900 dark:text-gray-100 p-2 text-center border border-gray-100 dark:border-white/10"
                                style={{ backgroundColor: bg }}
                                title={`${r.pole} · ${th.label}: ${v ?? 0}%`}
                              >
                                {v ? `${v}%` : ''}
                              </div>
                            )
                          })}
                        </Fragment>
                      ))}
                    </div>
                  )
                })()}
            </div>
          </div>
        </div>
      </div>
    </div>
  )
})

export default DeviationTheme
