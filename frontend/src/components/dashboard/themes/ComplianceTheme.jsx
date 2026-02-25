import { memo, useMemo } from 'react'
import { useTranslation } from '../../../i18n'
import {
  ClipboardCheck,
  Shield,
  HeartPulse,
  FileCheck
} from 'lucide-react'
import {
  AreaChart,
  Area,
  BarChart,
  Bar,
  LineChart,
  Line,
  XAxis,
  YAxis,
  CartesianGrid,
  ResponsiveContainer
} from 'recharts'
import { Tooltip } from 'recharts'

const COLORS = {
  compliance: '#16a34a',
  critical: '#dc2626',
  major: '#f59e0b',
  minor: '#3b82f6'
}

const MetricCard = memo(function MetricCard({ title, value, icon: Icon, color, trend }) {
  const colors = {
    green: 'border-green-200 bg-green-50 dark:border-green-700 dark:bg-green-900/50 text-green-600 dark:text-green-400',
    blue: 'border-blue-200 bg-blue-50 dark:border-blue-700 dark:bg-blue-900/50 text-blue-600 dark:text-blue-400',
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

const ComplianceTheme = memo(function ComplianceTheme({ kpiSummary, weeklyTrends, inspectionData, regulatoryWatch }) {
  const t = useTranslation()

  const weekShortPrefix = t('dashboard.weekShortPrefix')

  const translateOr = (key, fallback) => {
    const value = t(key)
    return value === key ? fallback : value
  }

  // Compliance metrics
  const complianceMetrics = useMemo(() => {
    const totalInspections = inspectionData?.stats?.total ?? kpiSummary?.total_inspections ?? 0
    const openInspections = inspectionData?.stats?.open ?? 0
    const hseCompliance = Number(regulatoryWatch?.avg_overall_score ?? 0).toFixed(1)
    const medicalCompliance = Number(kpiSummary?.avg_medical_compliance ?? 0).toFixed(1)

    return {
      totalInspections,
      openInspections,
      hseCompliance,
      medicalCompliance,
    }
  }, [kpiSummary, inspectionData, regulatoryWatch])

  // Inspections trend data
  const inspectionTrends = useMemo(() => {
    const byWeek = Array.isArray(inspectionData?.by_week) ? inspectionData.by_week : []
    if (byWeek.length > 0) {
      return byWeek.map((w) => ({
        week: `${weekShortPrefix}${w.week_number}`,
        inspections: w.count ?? 0,
      }))
    }

    return (weeklyTrends ?? []).map((w) => ({
      week: w.week_label,
      inspections: w.inspections ?? 0,
    }))
  }, [inspectionData, weeklyTrends])

  const inspectionsByNature = useMemo(() => {
    const rows = Array.isArray(inspectionData?.by_nature) ? inspectionData.by_nature : []
    return rows.map((item) => ({
      nature: item.nature,
      label: translateOr(`dashboard.compliance.inspectionNature.${item.nature}`, item.label ?? item.nature),
      count: item.count ?? 0,
    }))
  }, [inspectionData, t])

  const regulatoryWatchTrends = useMemo(() => {
    const rows = Array.isArray(regulatoryWatch?.by_week) ? regulatoryWatch.by_week : []
    if (rows.length > 0) {
      return rows.map((r) => ({
        week: `${weekShortPrefix}${r.week_number}`,
        score: r.avg_overall_score ?? 0,
      }))
    }

    return (weeklyTrends ?? []).map((w) => ({
      week: w.week_label,
      score: w.hse_compliance ?? 0,
    }))
  }, [regulatoryWatch, weeklyTrends])

  const medicalAptitudeTrends = useMemo(() => {
    return (weeklyTrends ?? []).map((w) => ({
      week: w.week_label,
      percent: w.medical_compliance ?? 0,
    }))
  }, [weeklyTrends])

  
  return (
    <div className="space-y-6 animate-fade-in">
      {/* Compliance Metrics Grid */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        <MetricCard
          title={t('dashboard.compliance.totalInspections')}
          value={complianceMetrics.totalInspections}
          icon={ClipboardCheck}
          color="green"
          trend={t('dashboard.compliance.completedThisYear')}
        />
        <MetricCard
          title={t('dashboard.compliance.hseCompliance')}
          value={`${complianceMetrics.hseCompliance}%`}
          icon={Shield}
          color="blue"
          trend={t('dashboard.compliance.avgScore')}
        />
        <MetricCard
          title={t('dashboard.compliance.medicalCompliance')}
          value={`${complianceMetrics.medicalCompliance}%`}
          icon={HeartPulse}
          color="purple"
          trend={t('dashboard.compliance.healthChecks')}
        />
        <MetricCard
          title={t('dashboard.compliance.openInspections')}
          value={complianceMetrics.openInspections}
          icon={FileCheck}
          color="amber"
        />
      </div>

      {/* Charts Grid */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Inspection Trends */}
        <div className="card">
          <div className="card-header">
            <h3 className="font-semibold text-gray-900 dark:text-gray-100">{t('dashboard.compliance.inspectionTrends')}</h3>
          </div>
          <div className="card-body">
            <div className="h-64">
              <ResponsiveContainer width="100%" height="100%">
                <AreaChart data={inspectionTrends}>
                  <defs>
                    <linearGradient id="complianceGradient" x1="0" y1="0" x2="0" y2="1">
                      <stop offset="5%" stopColor="#16a34a" stopOpacity={0.8}/>
                      <stop offset="95%" stopColor="#16a34a" stopOpacity={0.1}/>
                    </linearGradient>
                  </defs>
                  <CartesianGrid strokeDasharray="3 3" stroke="#f0f0f0" className="dark:opacity-20" />
                  <XAxis dataKey="week" tick={{ fontSize: 11 }} />
                  <YAxis allowDecimals={false} tick={{ fontSize: 11 }} />
                  <Tooltip allowEscapeViewBox={{ x: true, y: true }} wrapperStyle={{ zIndex: 9999 }} />
                  <Area 
                    type="monotone" 
                    dataKey="inspections" 
                    stroke="#16a34a" 
                    fill="url(#complianceGradient)" 
                    name={t('dashboard.compliance.totalInspections')}
                  />
                </AreaChart>
              </ResponsiveContainer>
            </div>
          </div>
        </div>

        {/* Inspections by Nature */}
        <div className="card">
          <div className="card-header">
            <h3 className="font-semibold text-gray-900 dark:text-gray-100">{t('dashboard.compliance.inspectionsByNature')}</h3>
          </div>
          <div className="card-body">
            <div className="h-64">
              <ResponsiveContainer width="100%" height="100%">
                <BarChart data={inspectionsByNature}>
                  <CartesianGrid strokeDasharray="3 3" stroke="#f0f0f0" className="dark:opacity-20" />
                  <XAxis dataKey="label" tick={{ fontSize: 11 }} />
                  <YAxis allowDecimals={false} tick={{ fontSize: 11 }} />
                  <Tooltip allowEscapeViewBox={{ x: true, y: true }} wrapperStyle={{ zIndex: 9999 }} />
                  <Bar dataKey="count" fill={COLORS.compliance} name={t('dashboard.compliance.totalInspections')} radius={[4, 4, 0, 0]} />
                </BarChart>
              </ResponsiveContainer>
            </div>
          </div>
        </div>

        {/* Regulatory Watch Trend */}
        {regulatoryWatchTrends.length > 0 && (
          <div className="card">
            <div className="card-header">
              <h3 className="font-semibold text-gray-900 dark:text-gray-100">{t('dashboard.compliance.regulatoryWatchTrend')}</h3>
            </div>
            <div className="card-body">
              <div className="h-64">
                <ResponsiveContainer width="100%" height="100%">
                  <LineChart data={regulatoryWatchTrends}>
                    <CartesianGrid strokeDasharray="3 3" stroke="#f0f0f0" className="dark:opacity-20" />
                    <XAxis dataKey="week" tick={{ fontSize: 11 }} />
                    <YAxis tick={{ fontSize: 11 }} domain={[0, 100]} />
                    <Tooltip
                      contentStyle={{ backgroundColor: '#1f2937', border: 'none', borderRadius: '8px' }}
                      labelStyle={{ color: '#f3f4f6' }}
                      allowEscapeViewBox={{ x: true, y: true }}
                      wrapperStyle={{ zIndex: 9999 }}
                      formatter={(value) => [`${value}%`, t('dashboard.compliance.regulatoryWatchScore')]}
                    />
                    <Line
                      type="monotone"
                      dataKey="score"
                      stroke="#3b82f6"
                      strokeWidth={2}
                      dot={false}
                      name={t('dashboard.compliance.regulatoryWatchScore')}
                    />
                  </LineChart>
                </ResponsiveContainer>
              </div>
            </div>
          </div>
        )}

        {/* Medical Aptitude Trend */}
        {medicalAptitudeTrends.length > 0 && (
          <div className="card">
            <div className="card-header">
              <h3 className="font-semibold text-gray-900 dark:text-gray-100">{t('dashboard.compliance.medicalAptitudeTrend')}</h3>
            </div>
            <div className="card-body">
              <div className="h-64">
                <ResponsiveContainer width="100%" height="100%">
                  <LineChart data={medicalAptitudeTrends}>
                    <CartesianGrid strokeDasharray="3 3" stroke="#f0f0f0" className="dark:opacity-20" />
                    <XAxis dataKey="week" tick={{ fontSize: 11 }} />
                    <YAxis tick={{ fontSize: 11 }} domain={[0, 100]} />
                    <Tooltip
                      contentStyle={{ backgroundColor: '#1f2937', border: 'none', borderRadius: '8px' }}
                      labelStyle={{ color: '#f3f4f6' }}
                      allowEscapeViewBox={{ x: true, y: true }}
                      wrapperStyle={{ zIndex: 9999 }}
                      formatter={(value) => [`${value}%`, t('dashboard.compliance.aptitudePercent')]}
                    />
                    <Line
                      type="monotone"
                      dataKey="percent"
                      stroke="#a855f7"
                      strokeWidth={2}
                      dot={false}
                      name={t('dashboard.compliance.aptitudePercent')}
                    />
                  </LineChart>
                </ResponsiveContainer>
              </div>
            </div>
          </div>
        )}

              </div>
    </div>
  )
})

export default ComplianceTheme
