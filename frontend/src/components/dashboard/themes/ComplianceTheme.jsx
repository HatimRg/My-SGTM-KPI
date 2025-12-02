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
  RadarChart,
  PolarGrid,
  PolarAngleAxis,
  PolarRadiusAxis,
  Radar,
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

const ComplianceTheme = memo(function ComplianceTheme({ kpiSummary, weeklyTrends, projectPerformance }) {
  const t = useTranslation()

  // Compliance metrics
  const complianceMetrics = useMemo(() => ({
    totalInspections: kpiSummary?.total_inspections || 0,
    hseCompliance: Number(kpiSummary?.avg_hse_compliance || 0).toFixed(1),
    medicalCompliance: kpiSummary?.medical_compliance || 85,
    auditScore: kpiSummary?.audit_score || 88
  }), [kpiSummary])

  // Compliance trends data
  const complianceTrends = useMemo(() => {
    return weeklyTrends?.map(w => ({
      week: w.week_label,
      inspections: w.inspections || 0
    })) || []
  }, [weeklyTrends])

  // Compliance radar data
  const radarData = useMemo(() => [
    { subject: 'HSE', value: Number(complianceMetrics.hseCompliance) || 0, fullMark: 100 },
    { subject: 'Medical', value: complianceMetrics.medicalCompliance, fullMark: 100 },
    { subject: 'Inspections', value: 90, fullMark: 100 },
    { subject: 'Documentation', value: 88, fullMark: 100 },
    { subject: 'Training', value: 92, fullMark: 100 },
    { subject: 'Equipment', value: 85, fullMark: 100 }
  ], [complianceMetrics])

  // Audit findings (simulated)
  const auditFindings = useMemo(() => {
    return weeklyTrends?.slice(0, 8).map((w, i) => ({
      week: w.week_label,
      critical: Math.floor(Math.random() * 2),
      major: Math.floor(Math.random() * 4),
      minor: Math.floor(Math.random() * 8) + 2
    })) || []
  }, [weeklyTrends])

  // Compliance by project
  const complianceByProject = useMemo(() => {
    return projectPerformance?.slice(0, 6).map(p => ({
      name: p.name?.length > 12 ? p.name.substring(0, 12) + '...' : p.name,
      compliance: Math.min(100, 70 + Math.floor(Math.random() * 30))
    })) || []
  }, [projectPerformance])

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
          title={t('dashboard.compliance.auditScore')}
          value={`${complianceMetrics.auditScore}%`}
          icon={FileCheck}
          color="amber"
          trend={t('dashboard.compliance.latestAudit')}
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

        {/* Compliance Radar */}
        <div className="card">
          <div className="card-header">
            <h3 className="font-semibold text-gray-900 dark:text-gray-100">{t('dashboard.compliance.complianceRadar')}</h3>
          </div>
          <div className="card-body">
            <div className="h-64">
              <ResponsiveContainer width="100%" height="100%">
                <RadarChart data={radarData}>
                  <PolarGrid stroke="#e5e7eb" className="dark:opacity-30" />
                  <PolarAngleAxis 
                    dataKey="subject" 
                    tick={{ fill: '#6b7280', fontSize: 11 }} 
                  />
                  <PolarRadiusAxis 
                    angle={90} 
                    domain={[0, 100]} 
                    tick={{ fill: '#9ca3af', fontSize: 9 }}
                  />
                  <Radar 
                    name="Compliance" 
                    dataKey="value" 
                    stroke="#16a34a" 
                    fill="#16a34a" 
                    fillOpacity={0.5} 
                  />
                  <Tooltip 
                    contentStyle={{ backgroundColor: '#1f2937', border: 'none', borderRadius: '8px' }}
                    labelStyle={{ color: '#f3f4f6' }}
                  />
                </RadarChart>
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
                  <XAxis dataKey="week" tick={{ fontSize: 11 }} />
                  <YAxis allowDecimals={false} tick={{ fontSize: 11 }} />
                  <Tooltip 
                    contentStyle={{ backgroundColor: '#1f2937', border: 'none', borderRadius: '8px' }}
                    labelStyle={{ color: '#f3f4f6' }}
                  />
                  <Legend />
                  <Bar dataKey="critical" stackId="a" fill={COLORS.critical} name="Critical" />
                  <Bar dataKey="major" stackId="a" fill={COLORS.major} name="Major" />
                  <Bar dataKey="minor" stackId="a" fill={COLORS.minor} name="Minor" radius={[4, 4, 0, 0]} />
                </BarChart>
              </ResponsiveContainer>
            </div>
          </div>
        </div>

        {/* Compliance by Project */}
        <div className="card">
          <div className="card-header">
            <h3 className="font-semibold text-gray-900 dark:text-gray-100">{t('dashboard.compliance.complianceByProject')}</h3>
          </div>
          <div className="card-body">
            <div className="h-64">
              <ResponsiveContainer width="100%" height="100%">
                <BarChart data={complianceByProject}>
                  <CartesianGrid strokeDasharray="3 3" stroke="#f0f0f0" className="dark:opacity-20" />
                  <XAxis dataKey="name" tick={{ fontSize: 9 }} angle={-45} textAnchor="end" height={60} />
                  <YAxis domain={[0, 100]} tick={{ fontSize: 11 }} />
                  <Tooltip 
                    contentStyle={{ backgroundColor: '#1f2937', border: 'none', borderRadius: '8px' }}
                    labelStyle={{ color: '#f3f4f6' }}
                    formatter={(value) => [`${value}%`, 'Compliance']}
                  />
                  <Bar 
                    dataKey="compliance" 
                    fill="#16a34a" 
                    radius={[4, 4, 0, 0]}
                    name="Compliance %"
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

export default ComplianceTheme
