import { memo, useMemo } from 'react'
import { useTranslation } from '../../../i18n'
import {
  AlertTriangle,
  Skull,
  TrendingUp,
  TrendingDown,
  Clock,
  Users
} from 'lucide-react'
import {
  AreaChart,
  Area,
  BarChart,
  Bar,
  LineChart,
  Line,
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
  fatal: '#dc2626',
  serious: '#f59e0b',
  minor: '#16a34a',
  tf: '#f59e0b',
  tg: '#8b5cf6'
}

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

const SafetyTheme = memo(function SafetyTheme({ kpiSummary, weeklyTrends, projectPerformance }) {
  const t = useTranslation()

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

  return (
    <div className="space-y-6 animate-fade-in">
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
                  />
                  <Area 
                    type="monotone" 
                    dataKey="accidents" 
                    stroke="#dc2626" 
                    fill="url(#accidentGradient)" 
                    name="Accidents"
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
                    <Tooltip />
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
                  />
                  <Legend />
                  <Line 
                    type="monotone" 
                    dataKey="tf" 
                    stroke={COLORS.tf} 
                    strokeWidth={2}
                    dot={{ fill: COLORS.tf, r: 3 }}
                    name="TF Rate"
                  />
                  <Line 
                    type="monotone" 
                    dataKey="tg" 
                    stroke={COLORS.tg} 
                    strokeWidth={2}
                    dot={{ fill: COLORS.tg, r: 3 }}
                    name="TG Rate"
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
                  />
                  <Bar 
                    dataKey="accidents" 
                    fill="#dc2626" 
                    radius={[0, 4, 4, 0]}
                    name="Accidents"
                  />
                </BarChart>
              </ResponsiveContainer>
            </div>
          </div>
        </div>
      </div>
    </div>
  )
})

export default SafetyTheme
