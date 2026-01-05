import { memo, useMemo } from 'react'
import { useTranslation } from '../../../i18n'
import {
  ClipboardCheck,
  Shield,
  HeartPulse,
  FileCheck,
  TrendingUp
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
  Tooltip,
  ResponsiveContainer,
  Legend
} from 'recharts'

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

const ComplianceTheme = memo(function ComplianceTheme({ kpiSummary, weeklyTrends, projectPerformance, inspectionData, sorData, regulatoryWatch }) {
  const t = useTranslation()

  // Compliance metrics
  const complianceMetrics = useMemo(() => {
    const totalInspections = kpiSummary?.total_inspections ?? 0
    const hseCompliance = Number(regulatoryWatch?.avg_overall_score ?? 0).toFixed(1)
    const medicalCompliance = Number(kpiSummary?.avg_medical_compliance ?? 0).toFixed(1)

    const totalSor = sorData?.stats?.total ?? 0
    const closedSor = sorData?.stats?.closed ?? 0
    const auditScore = totalSor > 0 ? Math.round((closedSor / totalSor) * 100) : null

    return {
      totalInspections,
      hseCompliance,
      medicalCompliance,
      auditScore,
    }
  }, [kpiSummary, sorData, regulatoryWatch])

  // Compliance trends data
  const complianceTrends = useMemo(() => {
    return (weeklyTrends ?? []).map(w => ({
      week: w.week_label,
      inspections: w.inspections ?? 0
    }))
  }, [weeklyTrends])

  
  // Audit findings (simulated)
  const auditFindings = useMemo(() => {
    return (sorData?.by_category ?? []).map((item) => ({
      category: item.label ?? item.category,
      count: item.count ?? 0,
    }))
  }, [sorData])

  
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
        {complianceMetrics.auditScore !== null && (
          <MetricCard
            title={t('dashboard.compliance.auditScore')}
            value={`${complianceMetrics.auditScore}%`}
            icon={FileCheck}
            color="amber"
            trend={t('dashboard.compliance.latestAudit')}
          />
        )}
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
                <AreaChart data={complianceTrends}>
                  <defs>
                    <linearGradient id="complianceGradient" x1="0" y1="0" x2="0" y2="1">
                      <stop offset="5%" stopColor="#16a34a" stopOpacity={0.8}/>
                      <stop offset="95%" stopColor="#16a34a" stopOpacity={0.1}/>
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
                    dataKey="inspections" 
                    stroke="#16a34a" 
                    fill="url(#complianceGradient)" 
                    name="Inspections"
                  />
                </AreaChart>
              </ResponsiveContainer>
            </div>
          </div>
        </div>

        
        {/* Audit Findings */}
        <div className="card">
          <div className="card-header">
            <h3 className="font-semibold text-gray-900 dark:text-gray-100">{t('dashboard.compliance.auditFindings')}</h3>
          </div>
          <div className="card-body">
            <div className="h-64">
              <ResponsiveContainer width="100%" height="100%">
                <BarChart data={auditFindings}>
                  <CartesianGrid strokeDasharray="3 3" stroke="#f0f0f0" className="dark:opacity-20" />
                  <XAxis dataKey="category" tick={{ fontSize: 11 }} />
                  <YAxis allowDecimals={false} tick={{ fontSize: 11 }} />
                  <Tooltip 
                    contentStyle={{ backgroundColor: '#1f2937', border: 'none', borderRadius: '8px' }}
                    labelStyle={{ color: '#f3f4f6' }}
                  />
                  <Bar dataKey="count" fill={COLORS.compliance} name={t('dashboard.compliance.findings')} radius={[4, 4, 0, 0]} />
                </BarChart>
              </ResponsiveContainer>
            </div>
          </div>
        </div>

              </div>
    </div>
  )
})

export default ComplianceTheme
