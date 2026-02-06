import { memo, useMemo } from 'react'
import { useTranslation } from '../../../i18n'
import {
  AlertTriangle,
  Skull,
  TrendingUp,
  TrendingDown,
  Clock
} from 'lucide-react'
import {
  AreaChart,
  Area,
  BarChart,
  Bar,
  ComposedChart,
  LineChart,
  Line,
  PieChart,
  Pie,
  Cell,
  XAxis,
  YAxis,
  ZAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
  Legend,
  Sankey,
  ScatterChart,
  Scatter
} from 'recharts'

const COLORS = {
  fatal: '#dc2626',
  serious: '#f59e0b',
  minor: '#16a34a',
  tf: '#f59e0b',
  tg: '#8b5cf6'
}

const tooltipPortal = typeof document !== 'undefined' ? document.body : null
const tooltipWrapperStyle = { zIndex: 9999, pointerEvents: 'none' }

const MetricCard = memo(function MetricCard({ title, value, icon: Icon, color, trend }) {
  const colors = {
    red: 'border-red-200 bg-red-50 dark:border-red-700 dark:bg-red-900/50 text-red-600 dark:text-red-400',
    green: 'border-green-200 bg-green-50 dark:border-green-700 dark:bg-green-900/50 text-green-600 dark:text-green-400',
    amber: 'border-amber-200 bg-amber-50 dark:border-amber-700 dark:bg-amber-900/50 text-amber-600 dark:text-amber-400',
    purple: 'border-purple-200 bg-purple-50 dark:border-purple-700 dark:bg-purple-900/50 text-purple-600 dark:text-purple-400',
  }

  return (
    <div className={`rounded-xl border-2 p-4 ${colors[color]}`}>
      <div className="flex items-center gap-2 mb-2">
        <Icon className="w-5 h-5" />
        <span className="text-sm font-medium text-gray-600 dark:text-gray-300">{title}</span>
      </div>
      <p className="text-2xl font-bold text-gray-900 dark:text-gray-100">{value}</p>
      {trend && <p className="text-xs text-gray-500 dark:text-gray-400 mt-1">{trend}</p>}
    </div>
  )
})

const SafetyTheme = memo(function SafetyTheme({ kpiSummary, weeklyTrends, projectPerformance, safetyPerformance, safetyLoading }) {
  const t = useTranslation()

  const normalizeLabel = (value) => {
    if (value === null || value === undefined) return t('common.unknown')
    const s = String(value).trim()
    if (!s) return t('common.unknown')
    if (s.toLowerCase() === 'unknown') return t('common.unknown')
    return s
  }

  const hasSafetyPerformance = !!safetyPerformance?.kpis

  const spKpis = useMemo(() => {
    const k = safetyPerformance?.kpis || {}
    return {
      totalEvents: k.total_events ?? 0,
      severityWeightedIndex: k.severity_weighted_index ?? 0,
      pctSevere: k.pct_severe ?? 0,
      totalVictims: k.total_victims ?? 0,
      totalFatalities: k.total_fatalities ?? 0,
      pctActionsOverdue: k.pct_actions_overdue ?? 0,
      worstProject: k.worst_project ?? null,
      worstLocation: k.worst_location ?? null,
      topActivity: k.top_activity ?? null,
      topRootCause: k.top_root_cause ?? null,
    }
  }, [safetyPerformance])

  const spCharts = useMemo(() => safetyPerformance?.charts || {}, [safetyPerformance])

  const projectHotspots = useMemo(() => {
    const rows = spCharts?.project_hotspots
    if (!Array.isArray(rows)) return []
    return rows.slice(0, 10).map((r) => ({
      ...r,
      project_name: normalizeLabel(r?.project_name),
    }))
  }, [spCharts, t])

  const activityPareto = useMemo(() => {
    const rows = spCharts?.activity_driver
    if (!Array.isArray(rows)) return []
    return rows.slice(0, 10).map((r) => ({
      ...r,
      activity: normalizeLabel(r?.activity),
    }))
  }, [spCharts, t])

  const conditions = useMemo(() => {
    const m = spCharts?.conditions_matrix || {}
    const data = Array.isArray(m.data) ? m.data : []
    const rows = Array.isArray(m.rows) ? m.rows : []
    const cols = Array.isArray(m.cols) ? m.cols : []
    const mappedRows = rows.map((r) => normalizeLabel(r))
    const mappedCols = cols.map((c) => normalizeLabel(c))
    const mappedData = data.map((d) => ({
      ...d,
      ground_condition: normalizeLabel(d?.ground_condition),
      lighting: normalizeLabel(d?.lighting),
    }))
    const max = mappedData.reduce((acc, d) => Math.max(acc, Number(d?.value ?? 0)), 0)
    return { rows: mappedRows, cols: mappedCols, data: mappedData, max }
  }, [spCharts, t])

  const sankeyData = useMemo(() => {
    const cp = spCharts?.cause_path || {}
    const nodes = Array.isArray(cp.nodes) ? cp.nodes : []
    const links = Array.isArray(cp.links) ? cp.links : []
    return {
      nodes: nodes.map((n) => ({ ...n, name: normalizeLabel(n?.name) })),
      links,
    }
  }, [spCharts, t])

  const bubbleData = useMemo(() => {
    const rows = spCharts?.severity_vs_victims
    if (!Array.isArray(rows)) return []
    return rows.map((r) => ({
      severity: Number(r?.severity_score ?? 0),
      victims: Number(r?.victims ?? 0),
      events: Number(r?.events ?? 0),
      activity: normalizeLabel(r?.activity),
    }))
  }, [spCharts, t])

  const actionsHealth = useMemo(() => {
    const rows = spCharts?.actions_health
    if (!Array.isArray(rows)) return []
    return rows.slice(0, 10).map((r) => ({
      ...r,
      type: normalizeLabel(r?.type),
    }))
  }, [spCharts, t])

  // Safety metrics
  const safetyMetrics = useMemo(() => ({
    totalAccidents: kpiSummary?.total_accidents ?? 0,
    fatalAccidents: kpiSummary?.fatal_accidents ?? 0,
    avgTF: Number(kpiSummary?.avg_tf ?? 0).toFixed(2),
    avgTG: Number(kpiSummary?.avg_tg ?? 0).toFixed(2),
    lostWorkdays: kpiSummary?.lost_workdays ?? 0
  }), [kpiSummary])

  // Accident trends data
  const accidentTrends = useMemo(() => {
    return (weeklyTrends ?? []).map(w => ({
      week: w.week_label,
      accidents: w.accidents ?? 0
    }))
  }, [weeklyTrends])

  // Accidents by severity (prefer real serious/minor counts from KPI summary)
  const accidentsBySeverity = useMemo(() => {
    const total = safetyMetrics.totalAccidents
    const fatal = safetyMetrics.fatalAccidents
    const seriousFromSummary = kpiSummary?.serious_accidents
    const minorFromSummary = kpiSummary?.minor_accidents

    const hasSummaryBreakdown = seriousFromSummary !== null && seriousFromSummary !== undefined && minorFromSummary !== null && minorFromSummary !== undefined

    const serious = hasSummaryBreakdown
      ? Number(seriousFromSummary ?? 0)
      : (weeklyTrends ?? []).reduce((sum, w) => sum + Number(w?.serious_accidents ?? 0), 0)

    const minor = hasSummaryBreakdown
      ? Number(minorFromSummary ?? 0)
      : (weeklyTrends ?? []).reduce((sum, w) => sum + Number(w?.minor_accidents ?? 0), 0)

    return [
      { name: t('dashboard.safety.fatal'), value: Number(fatal ?? 0), color: COLORS.fatal },
      { name: t('dashboard.safety.serious'), value: Number(serious ?? 0), color: COLORS.serious },
      { name: t('dashboard.safety.minor'), value: Number(minor ?? 0), color: COLORS.minor }
    ].filter(item => item.value > 0)
  }, [safetyMetrics, t, kpiSummary, weeklyTrends])

  // TF vs TG comparison
  const tfTgData = useMemo(() => {
    return (weeklyTrends ?? []).map(w => ({
      week: w.week_label,
      tf: Number(w.tf ?? 0).toFixed(4),
      tg: Number(w.tg ?? 0).toFixed(4)
    }))
  }, [weeklyTrends])

  // Safety by project
  const safetyByProject = useMemo(() => {
    return (projectPerformance ?? []).slice(0, 6).map(p => ({
      name: p.name?.length > 15 ? p.name.substring(0, 15) + '...' : p.name,
      accidents: p.total_accidents ?? 0
    }))
  }, [projectPerformance])

  const Heatmap = memo(function Heatmap({ data, rows, cols, max }) {
    const getValue = (r, c) => {
      const found = (data || []).find((d) => d.ground_condition === r && d.lighting === c)
      return Number(found?.value ?? 0)
    }

    const colorFor = (v) => {
      if (!max || max <= 0) return 'rgba(220,38,38,0.05)'
      const ratio = Math.max(0, Math.min(1, v / max))
      const alpha = 0.08 + ratio * 0.85
      return `rgba(220,38,38,${alpha})`
    }

    return (
      <div className="w-full overflow-auto">
        <div className="min-w-[640px]">
          <div className="grid" style={{ gridTemplateColumns: `160px repeat(${cols.length}, minmax(80px, 1fr))` }}>
            <div className="text-xs font-medium text-gray-600 dark:text-gray-300 p-2">{t('dashboard.safety.lighting') || 'Lighting'}</div>
            {cols.map((c) => (
              <div key={c} className="text-xs font-medium text-gray-600 dark:text-gray-300 p-2 text-center truncate" title={c}>{c}</div>
            ))}

            {rows.map((r) => (
              <div key={r} className="contents">
                <div className="text-xs font-medium text-gray-700 dark:text-gray-200 p-2 truncate" title={r}>{r}</div>
                {cols.map((c) => {
                  const v = getValue(r, c)
                  return (
                    <div
                      key={`${r}|${c}`}
                      className="p-2 border border-gray-100 dark:border-gray-800"
                      title={`${r} / ${c}: ${v}`}
                    >
                      <div className="w-full h-8 rounded" style={{ background: colorFor(v) }} />
                      <div className="text-[11px] text-gray-600 dark:text-gray-300 mt-1 text-center">{v}</div>
                    </div>
                  )
                })}
              </div>
            ))}
          </div>
        </div>
      </div>
    )
  })

  return (
    <div className="space-y-6 animate-fade-in">
      {safetyLoading && !hasSafetyPerformance && (
        <div className="card">
          <div className="card-body">
            <div className="flex items-center gap-2 text-gray-600 dark:text-gray-300">
              <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-gray-600 dark:border-gray-300" />
              <span className="text-sm">{t('common.loading') || 'Loading...'}</span>
            </div>
          </div>
        </div>
      )}

      {hasSafetyPerformance && (
        <>
          {/* Safety Performance KPI Grid */}
          <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
            <MetricCard
              title={t('dashboard.safety.totalEvents') || 'Total events'}
              value={spKpis.totalEvents}
              icon={AlertTriangle}
              color={spKpis.totalEvents > 0 ? 'amber' : 'green'}
              trend={t('dashboard.safety.yearToDate') || 'Year-to-date'}
            />
            <MetricCard
              title={t('dashboard.safety.severityWeightedIndex') || 'Severity-weighted index'}
              value={spKpis.severityWeightedIndex}
              icon={TrendingUp}
              color={spKpis.severityWeightedIndex > 0 ? 'red' : 'green'}
              trend={spKpis.worstProject ? `${t('dashboard.safety.worstProject') || 'Worst project'}: ${normalizeLabel(spKpis.worstProject.project_name)}` : null}
            />
            <MetricCard
              title={t('dashboard.safety.severeShare') || 'Severe share'}
              value={`${Number(spKpis.pctSevere ?? 0).toFixed(1)}%`}
              icon={Skull}
              color={spKpis.pctSevere > 0 ? 'red' : 'green'}
              trend={spKpis.totalFatalities > 0 ? `${t('dashboard.safety.fatalAccidents') || 'Fatalities'}: ${spKpis.totalFatalities}` : (t('dashboard.safety.noFatalities') || 'No fatalities')}
            />
            <MetricCard
              title={t('dashboard.safety.actionsOverdue') || 'Actions overdue'}
              value={`${Number(spKpis.pctActionsOverdue ?? 0).toFixed(1)}%`}
              icon={Clock}
              color={spKpis.pctActionsOverdue > 0 ? 'amber' : 'green'}
              trend={spKpis.worstLocation ? `${t('dashboard.safety.worstLocation') || 'Worst location'}: ${normalizeLabel(spKpis.worstLocation.location)}` : null}
            />
          </div>

          {/* Charts Grid (Safety Performance) */}
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
            {/* Project hotspots */}
            <div className="card">
              <div className="card-header">
                <h3 className="font-semibold text-gray-900 dark:text-gray-100">{t('dashboard.safety.projectHotspots') || 'Project Hotspots (severity-weighted)'}</h3>
              </div>
              <div className="card-body">
                <div className="h-72">
                  <ResponsiveContainer width="100%" height="100%">
                    <BarChart data={projectHotspots} layout="vertical">
                      <CartesianGrid strokeDasharray="3 3" stroke="#f0f0f0" className="dark:opacity-20" />
                      <XAxis type="number" tick={{ fontSize: 11 }} />
                      <YAxis
                        type="category"
                        dataKey="project_name"
                        tick={{ fontSize: 10 }}
                        width={120}
                      />
                      <Tooltip
                        allowEscapeViewBox={{ x: true, y: true }}
                        portal={tooltipPortal}
                        wrapperStyle={tooltipWrapperStyle}
                      />
                      <Legend />
                      <Bar dataKey="fatal" stackId="a" fill="#dc2626" name={t('dashboard.safety.eventTypes.fatal') || t('dashboard.safety.fatal') || 'Fatal'} />
                      <Bar dataKey="serious" stackId="a" fill="#f59e0b" name={t('dashboard.safety.eventTypes.serious') || t('dashboard.safety.serious') || 'Serious'} />
                      <Bar dataKey="lta" stackId="a" fill="#8b5cf6" name={t('dashboard.safety.eventTypes.lta') || 'LTA'} />
                      <Bar dataKey="medical" stackId="a" fill="#3b82f6" name={t('dashboard.safety.eventTypes.medical') || 'Medical'} />
                      <Bar dataKey="first_aid" stackId="a" fill="#16a34a" name={t('dashboard.safety.eventTypes.firstAid') || 'First aid'} />
                      <Bar dataKey="near_miss" stackId="a" fill="#14b8a6" name={t('dashboard.safety.eventTypes.nearMiss') || 'Near miss'} />
                    </BarChart>
                  </ResponsiveContainer>
                </div>
              </div>
            </div>

            {/* Activity driver Pareto */}
            <div className="card">
              <div className="card-header">
                <h3 className="font-semibold text-gray-900 dark:text-gray-100">{t('dashboard.safety.activityDriver') || 'Activity Driver (Pareto)'}</h3>
              </div>
              <div className="card-body">
                <div className="h-72">
                  <ResponsiveContainer width="100%" height="100%">
                    <ComposedChart data={activityPareto}>
                      <CartesianGrid strokeDasharray="3 3" stroke="#f0f0f0" className="dark:opacity-20" />
                      <XAxis dataKey="activity" tick={{ fontSize: 10 }} interval={0} angle={-20} textAnchor="end" height={60} />
                      <YAxis yAxisId="left" allowDecimals={false} tick={{ fontSize: 11 }} />
                      <YAxis yAxisId="right" orientation="right" domain={[0, 100]} tick={{ fontSize: 11 }} />
                      <Tooltip
                        allowEscapeViewBox={{ x: true, y: true }}
                        portal={tooltipPortal}
                        wrapperStyle={tooltipWrapperStyle}
                      />
                      <Legend />
                      <Bar yAxisId="left" dataKey="count" fill="#dc2626" name={t('dashboard.safety.metrics.count') || 'Count'} />
                      <Line yAxisId="right" type="monotone" dataKey="cumulative_pct" stroke="#3b82f6" strokeWidth={2} dot={{ r: 3 }} name={t('dashboard.safety.metrics.cumulativePct') || 'Cumulative %'} />
                    </ComposedChart>
                  </ResponsiveContainer>
                </div>
              </div>
            </div>

            {/* Conditions heatmap */}
            <div className="card">
              <div className="card-header">
                <h3 className="font-semibold text-gray-900 dark:text-gray-100">{t('dashboard.safety.conditionsMatrix') || 'Conditions Matrix (severity-weighted)'}</h3>
              </div>
              <div className="card-body">
                <Heatmap data={conditions.data} rows={conditions.rows} cols={conditions.cols} max={conditions.max} />
              </div>
            </div>

            {/* Cause path sankey */}
            <div className="card">
              <div className="card-header">
                <h3 className="font-semibold text-gray-900 dark:text-gray-100">{t('dashboard.safety.causePath') || 'Cause Path (Immediate → Root)'}</h3>
              </div>
              <div className="card-body">
                <div className="h-72">
                  {sankeyData.nodes.length > 0 && sankeyData.links.length > 0 ? (
                    <ResponsiveContainer width="100%" height="100%">
                      <Sankey
                        data={sankeyData}
                        nodePadding={18}
                        linkCurvature={0.6}
                        node={{ stroke: '#e5e7eb', strokeWidth: 1 }}
                      >
                        <Tooltip
                          allowEscapeViewBox={{ x: true, y: true }}
                          portal={tooltipPortal}
                          wrapperStyle={tooltipWrapperStyle}
                        />
                      </Sankey>
                    </ResponsiveContainer>
                  ) : (
                    <div className="flex items-center justify-center h-full text-gray-500 dark:text-gray-400 text-sm">
                      {t('common.noData') || 'No data available'}
                    </div>
                  )}
                </div>
              </div>
            </div>

            {/* Bubble: severity vs victims */}
            <div className="card">
              <div className="card-header">
                <h3 className="font-semibold text-gray-900 dark:text-gray-100">{t('dashboard.safety.severityVsVictims') || 'Severity vs Victims (bubble)'}</h3>
              </div>
              <div className="card-body">
                <div className="h-72">
                  <ResponsiveContainer width="100%" height="100%">
                    <ScatterChart>
                      <CartesianGrid strokeDasharray="3 3" stroke="#f0f0f0" className="dark:opacity-20" />
                      <XAxis type="number" dataKey="severity" name={t('dashboard.safety.metrics.severity') || 'Severity'} domain={[1, 6]} tick={{ fontSize: 11 }} />
                      <YAxis type="number" dataKey="victims" name={t('dashboard.safety.metrics.victims') || 'Victims'} allowDecimals={false} tick={{ fontSize: 11 }} />
                      <ZAxis type="number" dataKey="events" range={[80, 600]} name={t('dashboard.safety.metrics.events') || 'Events'} />
                      <Tooltip
                        cursor={{ strokeDasharray: '3 3' }}
                        allowEscapeViewBox={{ x: true, y: true }}
                        portal={tooltipPortal}
                        wrapperStyle={tooltipWrapperStyle}
                      />
                      <Legend />
                      <Scatter name={t('dashboard.safety.metrics.events') || 'Events'} data={bubbleData} fill="#dc2626" />
                    </ScatterChart>
                  </ResponsiveContainer>
                </div>
              </div>
            </div>

            {/* Actions health */}
            <div className="card">
              <div className="card-header">
                <h3 className="font-semibold text-gray-900 dark:text-gray-100">{t('dashboard.safety.actionsHealth') || 'Actions Health'}</h3>
              </div>
              <div className="card-body">
                <div className="h-72">
                  <ResponsiveContainer width="100%" height="100%">
                    <BarChart data={actionsHealth}>
                      <CartesianGrid strokeDasharray="3 3" stroke="#f0f0f0" className="dark:opacity-20" />
                      <XAxis dataKey="type" tick={{ fontSize: 10 }} interval={0} angle={-20} textAnchor="end" height={60} />
                      <YAxis allowDecimals={false} tick={{ fontSize: 11 }} />
                      <Tooltip
                        allowEscapeViewBox={{ x: true, y: true }}
                        portal={tooltipPortal}
                        wrapperStyle={tooltipWrapperStyle}
                      />
                      <Legend />
                      <Bar dataKey="overdue" stackId="a" fill="#f59e0b" name={t('dashboard.safety.actionStatus.overdue') || 'Overdue'} />
                      <Bar dataKey="open" stackId="a" fill="#dc2626" name={t('dashboard.safety.actionStatus.open') || 'Open'} />
                      <Bar dataKey="in_progress" stackId="a" fill="#3b82f6" name={t('dashboard.safety.actionStatus.inProgress') || 'In progress'} />
                      <Bar dataKey="closed" stackId="a" fill="#16a34a" name={t('dashboard.safety.actionStatus.closed') || 'Closed'} />
                    </BarChart>
                  </ResponsiveContainer>
                </div>
              </div>
            </div>
          </div>
        </>
      )}

      {!hasSafetyPerformance && (
        <>
          {/* Safety Metrics Grid */}
          <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
            <MetricCard
              title={t('dashboard.safety.totalAccidents')}
              value={safetyMetrics.totalAccidents}
              icon={AlertTriangle}
              color={safetyMetrics.totalAccidents > 0 ? 'red' : 'green'}
              trend={t('dashboard.safety.yearToDate')}
            />
            <MetricCard
              title={t('dashboard.safety.fatalAccidents')}
              value={safetyMetrics.fatalAccidents}
              icon={Skull}
              color={safetyMetrics.fatalAccidents > 0 ? 'red' : 'green'}
              trend={safetyMetrics.fatalAccidents === 0 ? t('dashboard.safety.noFatalities') : t('dashboard.safety.critical')}
            />
            <MetricCard
              title={t('dashboard.safety.tfRate')}
              value={safetyMetrics.avgTF}
              icon={TrendingUp}
              color="amber"
              trend={t('dashboard.safety.avgFrequencyRate')}
            />
            <MetricCard
              title={t('dashboard.safety.tgRate')}
              value={safetyMetrics.avgTG}
              icon={TrendingDown}
              color="purple"
              trend={t('dashboard.safety.avgSeverityRate')}
            />
          </div>

          {/* Charts Grid */}
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
            {/* Accident Trends */}
            <div className="card">
              <div className="card-header">
                <h3 className="font-semibold text-gray-900 dark:text-gray-100">{t('dashboard.safety.accidentTrends')}</h3>
              </div>
              <div className="card-body">
                <div className="h-64">
                  <ResponsiveContainer width="100%" height="100%">
                    <AreaChart data={accidentTrends}>
                      <defs>
                        <linearGradient id="accidentGradient" x1="0" y1="0" x2="0" y2="1">
                          <stop offset="5%" stopColor="#dc2626" stopOpacity={0.8}/>
                          <stop offset="95%" stopColor="#dc2626" stopOpacity={0.1}/>
                        </linearGradient>
                      </defs>
                      <CartesianGrid strokeDasharray="3 3" stroke="#f0f0f0" className="dark:opacity-20" />
                      <XAxis dataKey="week" tick={{ fontSize: 11 }} />
                      <YAxis allowDecimals={false} tick={{ fontSize: 11 }} />
                      <Tooltip 
                        contentStyle={{ backgroundColor: '#1f2937', border: 'none', borderRadius: '8px' }}
                        labelStyle={{ color: '#f3f4f6' }}
                        allowEscapeViewBox={{ x: true, y: true }}
                        portal={tooltipPortal}
                        wrapperStyle={tooltipWrapperStyle}
                      />
                      <Area 
                        type="monotone" 
                        dataKey="accidents" 
                        stroke="#dc2626" 
                        fill="url(#accidentGradient)" 
                        name={t('dashboard.accidents') || 'Accidents'}
                      />
                    </AreaChart>
                  </ResponsiveContainer>
                </div>
              </div>
            </div>

            {/* Accidents by Severity */}
            <div className="card">
              <div className="card-header">
                <h3 className="font-semibold text-gray-900 dark:text-gray-100">{t('dashboard.safety.accidentsBySeverity')}</h3>
              </div>
              <div className="card-body">
                <div className="h-64">
                  {accidentsBySeverity.length > 0 ? (
                    <ResponsiveContainer width="100%" height="100%">
                      <PieChart>
                        <Pie
                          data={accidentsBySeverity}
                          cx="50%"
                          cy="50%"
                          innerRadius={50}
                          outerRadius={80}
                          paddingAngle={5}
                          dataKey="value"
                          label={({ name, value }) => `${name}: ${value}`}
                        >
                          {accidentsBySeverity.map((entry, index) => (
                            <Cell key={`cell-${index}`} fill={entry.color} />
                          ))}
                        </Pie>
                        <Tooltip
                          allowEscapeViewBox={{ x: true, y: true }}
                          portal={tooltipPortal}
                          wrapperStyle={tooltipWrapperStyle}
                        />
                        <Legend />
                      </PieChart>
                    </ResponsiveContainer>
                  ) : (
                    <div className="flex items-center justify-center h-full text-green-600 dark:text-green-400">
                      <div className="text-center">
                        <AlertTriangle className="w-12 h-12 mx-auto mb-2 opacity-50" />
                        <p className="font-medium">{t('dashboard.safety.noAccidents')}</p>
                        <p className="text-sm text-gray-500">{t('dashboard.safety.greatSafety')}</p>
                      </div>
                    </div>
                  )}
                </div>
              </div>
            </div>

            {/* TF vs TG Rates */}
            <div className="card">
              <div className="card-header">
                <h3 className="font-semibold text-gray-900 dark:text-gray-100">{t('dashboard.safety.tfVsTg')}</h3>
              </div>
              <div className="card-body">
                <div className="h-64">
                  <ResponsiveContainer width="100%" height="100%">
                    <LineChart data={tfTgData}>
                      <CartesianGrid strokeDasharray="3 3" stroke="#f0f0f0" className="dark:opacity-20" />
                      <XAxis dataKey="week" tick={{ fontSize: 11 }} />
                      <YAxis tick={{ fontSize: 11 }} />
                      <Tooltip 
                        contentStyle={{ backgroundColor: '#1f2937', border: 'none', borderRadius: '8px' }}
                        labelStyle={{ color: '#f3f4f6' }}
                        allowEscapeViewBox={{ x: true, y: true }}
                        portal={tooltipPortal}
                        wrapperStyle={tooltipWrapperStyle}
                      />
                      <Legend />
                      <Line 
                        type="monotone" 
                        dataKey="tf" 
                        stroke={COLORS.tf} 
                        strokeWidth={2}
                        dot={{ fill: COLORS.tf, r: 3 }}
                        name={t('dashboard.safety.tfRate') || 'TF Rate'}
                      />
                      <Line 
                        type="monotone" 
                        dataKey="tg" 
                        stroke={COLORS.tg} 
                        strokeWidth={2}
                        dot={{ fill: COLORS.tg, r: 3 }}
                        name={t('dashboard.safety.tgRate') || 'TG Rate'}
                      />
                    </LineChart>
                  </ResponsiveContainer>
                </div>
              </div>
            </div>

            {/* Safety by Project */}
            <div className="card">
              <div className="card-header">
                <h3 className="font-semibold text-gray-900 dark:text-gray-100">{t('dashboard.safety.accidentsByProject')}</h3>
              </div>
              <div className="card-body">
                <div className="h-64">
                  <ResponsiveContainer width="100%" height="100%">
                    <BarChart data={safetyByProject} layout="vertical">
                      <CartesianGrid strokeDasharray="3 3" stroke="#f0f0f0" className="dark:opacity-20" />
                      <XAxis type="number" allowDecimals={false} tick={{ fontSize: 11 }} />
                      <YAxis type="category" dataKey="name" tick={{ fontSize: 10 }} width={100} />
                      <Tooltip 
                        contentStyle={{ backgroundColor: '#1f2937', border: 'none', borderRadius: '8px' }}
                        labelStyle={{ color: '#f3f4f6' }}
                        allowEscapeViewBox={{ x: true, y: true }}
                        portal={tooltipPortal}
                        wrapperStyle={tooltipWrapperStyle}
                      />
                      <Bar 
                        dataKey="accidents" 
                        fill="#dc2626" 
                        radius={[0, 4, 4, 0]}
                        name={t('dashboard.accidents') || 'Accidents'}
                      />
                    </BarChart>
                  </ResponsiveContainer>
                </div>
              </div>
            </div>
          </div>
        </>
      )}
    </div>
  )
})

export default SafetyTheme
