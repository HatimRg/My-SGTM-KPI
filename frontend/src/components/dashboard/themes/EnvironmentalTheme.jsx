import { memo, useMemo } from 'react'
import { useTranslation } from '../../../i18n'
import {
  Droplets,
  Zap,
  Volume2,
  FileCheck,
  AlertTriangle,
  GraduationCap
} from 'lucide-react'
import {
  AreaChart,
  Area,
  LineChart,
  Line,
  ComposedChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
  Legend
} from 'recharts'

const COLORS = {
  water: '#0ea5e9',
  electricity: '#eab308',
  hse: '#22c55e',
  medical: '#8b5cf6',
  training: '#f59e0b',
  nearMiss: '#ef4444'
}

const tooltipPortal = typeof document !== 'undefined' ? document.body : null
const tooltipWrapperStyle = { zIndex: 9999, pointerEvents: 'none' }

const MetricCard = memo(function MetricCard({ title, value, icon: Icon, color, trend, unit }) {
  const colors = {
    blue: 'border-blue-200 bg-blue-50 dark:border-blue-700 dark:bg-blue-900/50 text-blue-600 dark:text-blue-400',
    yellow: 'border-yellow-200 bg-yellow-50 dark:border-yellow-700 dark:bg-yellow-900/50 text-yellow-600 dark:text-yellow-400',
    green: 'border-green-200 bg-green-50 dark:border-green-700 dark:bg-green-900/50 text-green-600 dark:text-green-400',
    purple: 'border-purple-200 bg-purple-50 dark:border-purple-700 dark:bg-purple-900/50 text-purple-600 dark:text-purple-400',
  }

  return (
    <div className={`rounded-xl border-2 p-4 ${colors[color]}`}>
      <div className="flex items-center gap-2 mb-2">
        <Icon className="w-5 h-5" />
        <span className="text-sm font-medium text-gray-600 dark:text-gray-300">{title}</span>
      </div>
      <p className="text-2xl font-bold text-gray-900 dark:text-gray-100">
        {value}<span className="text-sm font-normal ml-1">{unit}</span>
      </p>
      {trend && <p className="text-xs text-gray-500 dark:text-gray-400 mt-1">{trend}</p>}
    </div>
  )
})

const EnvironmentalTheme = memo(function EnvironmentalTheme({ data, loading }) {
  const t = useTranslation()

  const monthLabel = useMemo(() => ({
    1: t('months.january'),
    2: t('months.february'),
    3: t('months.march'),
    4: t('months.april'),
    5: t('months.may'),
    6: t('months.june'),
    7: t('months.july'),
    8: t('months.august'),
    9: t('months.september'),
    10: t('months.october'),
    11: t('months.november'),
    12: t('months.december'),
  }), [t])

  const series = useMemo(() => {
    const rows = Array.isArray(data?.series) ? data.series : []
    return rows.map((r) => ({
      month: r.month,
      month_label: monthLabel[r.month] ?? String(r.month),
      noise_avg: Number(r.noise_avg ?? 0),
      water_total: Number(r.water_total ?? 0),
      electricity_total: Number(r.electricity_total ?? 0),
      lux_avg: Number(r.lux_avg ?? 0),
      lux_compliance_rate: Number(r.lux_compliance_rate ?? 0),
      lux_count: Number(r.lux_count ?? 0),
    }))
  }, [data, monthLabel])

  const stats = useMemo(() => {
    const s = data?.stats || {}
    return {
      noise_avg: Number(s.noise_avg ?? 0),
      water_total: Number(s.water_total ?? 0),
      electricity_total: Number(s.electricity_total ?? 0),
      lux_avg: Number(s.lux_avg ?? 0),
      lux_compliance_rate: Number(s.lux_compliance_rate ?? 0),
      lux_count: Number(s.lux_count ?? 0),
    }
  }, [data])

  const envMetrics = useMemo(() => {
    const monthsWithLux = series.filter((r) => Number(r.lux_count ?? 0) > 0).length
    const coverage = series.length > 0 ? Math.round((monthsWithLux * 100) / series.length) : 0
    return {
      waterConsumption: stats.water_total,
      electricityUsage: stats.electricity_total,
      noiseMonitoring: stats.noise_avg,
      luxAvg: stats.lux_avg,
      luxComplianceRate: stats.lux_compliance_rate,
      luxCount: stats.lux_count,
      luxCoverageRate: coverage,
    }
  }, [series, stats])

  // Resource consumption trends from real data
  const consumptionTrends = useMemo(() => {
    return series.map((r) => ({
      month: r.month_label,
      water: r.water_total ?? 0,
      electricity: r.electricity_total ?? 0,
    }))
  }, [series])

  // Compliance trends from real data
  const complianceTrends = useMemo(() => {
    return series.map((r) => ({
      month: r.month_label,
      lux_avg: r.lux_avg ?? 0,
      lux_compliance_rate: r.lux_compliance_rate ?? 0,
    }))
  }, [series])

  // Safety trends from real data
  const safetyTrends = useMemo(() => {
    return series.map((r) => ({
      month: r.month_label,
      noise_avg: r.noise_avg ?? 0,
    }))
  }, [series])

  const lightingInsights = useMemo(() => {
    return series.map((r) => ({
      month: r.month_label,
      lux_count: r.lux_count ?? 0,
      lux_compliance_rate: r.lux_compliance_rate ?? 0,
    }))
  }, [series])

  // Compliance KPIs progress - LIVE DATA
  const complianceKPIs = useMemo(() => [
    { name: t('dashboard.environmental.luxComplianceRate'), current: Math.round(envMetrics.luxComplianceRate), target: 95, color: COLORS.hse },
    { name: t('dashboard.environmental.luxDataCoverage'), current: Math.round(envMetrics.luxCoverageRate), target: 100, color: COLORS.medical }
  ], [t, envMetrics])

  const hasAnyData = useMemo(() => series.some((r) => {
    return (
      Number(r.noise_avg ?? 0) > 0 ||
      Number(r.water_total ?? 0) > 0 ||
      Number(r.electricity_total ?? 0) > 0 ||
      Number(r.lux_avg ?? 0) > 0 ||
      Number(r.lux_compliance_rate ?? 0) > 0
    )
  }), [series])

  return (
    <div className="space-y-6 animate-fade-in">
      {loading && (
        <div className="text-sm text-gray-500 dark:text-gray-400">{t('common.loading')}</div>
      )}
      {!loading && !hasAnyData && (
        <div className="text-sm text-gray-500 dark:text-gray-400">{t('common.noData')}</div>
      )}
      {/* Environmental Metrics Grid - LIVE DATA */}
      <div className="grid grid-cols-2 lg:grid-cols-3 gap-4">
        <MetricCard
          title={t('dashboard.environmental.noiseMonitoring')}
          value={Number(envMetrics.noiseMonitoring ?? 0).toFixed(1)}
          icon={Volume2}
          color="purple"
          unit="dB"
          trend={t('dashboard.environmental.yearToDate')}
        />
        <MetricCard
          title={t('dashboard.environmental.waterConsumption')}
          value={envMetrics.waterConsumption.toLocaleString()}
          icon={Droplets}
          color="blue"
          unit="m³"
          trend={t('dashboard.environmental.yearToDate')}
        />
        <MetricCard
          title={t('dashboard.environmental.electricityUsage')}
          value={envMetrics.electricityUsage.toLocaleString()}
          icon={Zap}
          color="yellow"
          unit="kWh"
          trend={t('dashboard.environmental.yearToDate')}
        />
      </div>

      {/* Charts Grid - LIVE DATA */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Compliance Trends */}
        <div className="card">
          <div className="card-header">
            <h3 className="font-semibold text-gray-900 dark:text-gray-100">{t('dashboard.environmental.lightingTrends')}</h3>
          </div>
          <div className="card-body">
            <div className="h-64">
              <ResponsiveContainer width="100%" height="100%">
                <LineChart data={complianceTrends}>
                  <CartesianGrid strokeDasharray="3 3" stroke="#f0f0f0" className="dark:opacity-20" />
                  <XAxis dataKey="month" tick={{ fontSize: 11 }} />
                  <YAxis yAxisId="left" tick={{ fontSize: 11 }} domain={[0, 100]} />
                  <YAxis yAxisId="right" orientation="right" tick={{ fontSize: 11 }} />
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
                    yAxisId="left"
                    dataKey="lux_compliance_rate" 
                    stroke={COLORS.hse} 
                    strokeWidth={2}
                    dot={{ fill: COLORS.hse, r: 3 }}
                    name={t('dashboard.environmental.luxComplianceRate')}
                  />
                  <Line 
                    type="monotone" 
                    yAxisId="right"
                    dataKey="lux_avg" 
                    stroke={COLORS.medical} 
                    strokeWidth={2}
                    dot={{ fill: COLORS.medical, r: 3 }}
                    name={t('dashboard.environmental.luxAverage')}
                  />
                </LineChart>
              </ResponsiveContainer>
            </div>
          </div>
        </div>

        {/* Resource Consumption - Water vs Electricity */}
        <div className="card">
          <div className="card-header">
            <h3 className="font-semibold text-gray-900 dark:text-gray-100">{t('dashboard.environmental.waterVsElectricity')}</h3>
          </div>
          <div className="card-body">
            <div className="h-64">
              <ResponsiveContainer width="100%" height="100%">
                <ComposedChart data={consumptionTrends}>
                  <CartesianGrid strokeDasharray="3 3" stroke="#f0f0f0" className="dark:opacity-20" />
                  <XAxis dataKey="month" tick={{ fontSize: 11 }} />
                  <YAxis 
                    yAxisId="left" 
                    tick={{ fontSize: 11 }} 
                    stroke={COLORS.water}
                  />
                  <YAxis 
                    yAxisId="right" 
                    orientation="right" 
                    tick={{ fontSize: 11 }} 
                    stroke={COLORS.electricity}
                  />
                  <Tooltip 
                    contentStyle={{ backgroundColor: '#1f2937', border: 'none', borderRadius: '8px' }}
                    labelStyle={{ color: '#f3f4f6' }}
                    allowEscapeViewBox={{ x: true, y: true }}
                    portal={tooltipPortal}
                    wrapperStyle={tooltipWrapperStyle}
                  />
                  <Legend />
                  <Bar yAxisId="left" dataKey="water" fill={COLORS.water} name={`${t('dashboard.environmental.waterConsumption')} (m³)`} radius={[4, 4, 0, 0]} />
                  <Line yAxisId="right" type="monotone" dataKey="electricity" stroke={COLORS.electricity} strokeWidth={2} name={`${t('dashboard.environmental.electricityUsage')} (kWh)`} />
                </ComposedChart>
              </ResponsiveContainer>
            </div>
          </div>
        </div>

        {/* Safety Trends - Near Misses, Accidents, Inspections */}
        <div className="card">
          <div className="card-header">
            <h3 className="font-semibold text-gray-900 dark:text-gray-100">{t('dashboard.environmental.noiseTrends')}</h3>
          </div>
          <div className="card-body">
            <div className="h-64">
              <ResponsiveContainer width="100%" height="100%">
                <AreaChart data={safetyTrends}>
                  <CartesianGrid strokeDasharray="3 3" stroke="#f0f0f0" className="dark:opacity-20" />
                  <XAxis dataKey="month" tick={{ fontSize: 11 }} />
                  <YAxis tick={{ fontSize: 11 }} />
                  <Tooltip 
                    contentStyle={{ backgroundColor: '#1f2937', border: 'none', borderRadius: '8px' }}
                    labelStyle={{ color: '#f3f4f6' }}
                    allowEscapeViewBox={{ x: true, y: true }}
                    portal={tooltipPortal}
                    wrapperStyle={tooltipWrapperStyle}
                  />
                  <Legend />
                  <Area type="monotone" dataKey="noise_avg" stroke={COLORS.medical} fill={COLORS.medical} fillOpacity={0.35} name={t('dashboard.environmental.noiseMonitoring')} />
                </AreaChart>
              </ResponsiveContainer>
            </div>
          </div>
        </div>

        {/* Compliance Progress Bars */}
        <div className="card">
          <div className="card-header">
            <h3 className="font-semibold text-gray-900 dark:text-gray-100">{t('dashboard.environmental.lightingSummary')}</h3>
          </div>
          <div className="card-body">
            <div className="h-64">
              <ResponsiveContainer width="100%" height="100%">
                <ComposedChart data={lightingInsights}>
                  <CartesianGrid strokeDasharray="3 3" stroke="#f0f0f0" className="dark:opacity-20" />
                  <XAxis dataKey="month" tick={{ fontSize: 11 }} />
                  <YAxis yAxisId="left" tick={{ fontSize: 11 }} allowDecimals={false} />
                  <YAxis yAxisId="right" orientation="right" tick={{ fontSize: 11 }} domain={[0, 100]} />
                  <Tooltip
                    contentStyle={{ backgroundColor: '#1f2937', border: 'none', borderRadius: '8px' }}
                    labelStyle={{ color: '#f3f4f6' }}
                    allowEscapeViewBox={{ x: true, y: true }}
                    portal={tooltipPortal}
                    wrapperStyle={tooltipWrapperStyle}
                  />
                  <Legend />
                  <Bar
                    yAxisId="left"
                    dataKey="lux_count"
                    fill={COLORS.medical}
                    name={t('dashboard.environmental.luxMeasurements')}
                    radius={[4, 4, 0, 0]}
                  />
                  <Line
                    yAxisId="right"
                    type="monotone"
                    dataKey="lux_compliance_rate"
                    stroke={COLORS.hse}
                    strokeWidth={2}
                    dot={{ fill: COLORS.hse, r: 3 }}
                    name={t('dashboard.environmental.luxComplianceRate')}
                  />
                </ComposedChart>
              </ResponsiveContainer>
            </div>
          </div>
        </div>
      </div>
    </div>
  )
})

export default EnvironmentalTheme
