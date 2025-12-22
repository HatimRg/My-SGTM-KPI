import { memo, useMemo } from 'react'
import { useTranslation } from '../../../i18n'
import {
  Droplets,
  Zap,
  ClipboardCheck,
  Stethoscope,
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

const EnvironmentalTheme = memo(function EnvironmentalTheme({ kpiSummary, weeklyTrends }) {
  const t = useTranslation()

  // Real environmental metrics from KPI data
  const envMetrics = useMemo(() => ({
    waterConsumption: Number(kpiSummary?.total_water_consumption ?? 0),
    electricityUsage: Number(kpiSummary?.total_electricity_consumption ?? 0),
    hseCompliance: Math.round(Number(kpiSummary?.avg_hse_compliance ?? 0)),
    medicalCompliance: Math.round(Number(kpiSummary?.avg_medical_compliance ?? 0)),
    trainingHours: Math.round(Number(kpiSummary?.total_training_hours ?? 0)),
    nearMisses: Number(kpiSummary?.total_near_misses ?? 0),
    workPermits: Number(kpiSummary?.total_work_permits ?? 0)
  }), [kpiSummary])

  // Resource consumption trends from real data
  const consumptionTrends = useMemo(() => {
    return (weeklyTrends ?? []).map((w) => ({
      week: w.week_label,
      water: w.water ?? 0,
      electricity: w.electricity ?? 0,
      training_hours: w.training_hours ?? 0
    }))
  }, [weeklyTrends])

  // Compliance trends from real data
  const complianceTrends = useMemo(() => {
    return (weeklyTrends ?? []).map((w) => ({
      week: w.week_label,
      hse: w.hse_compliance ?? 0,
      medical: w.medical_compliance ?? 0
    }))
  }, [weeklyTrends])

  // Safety trends from real data
  const safetyTrends = useMemo(() => {
    return (weeklyTrends ?? []).map((w) => ({
      week: w.week_label,
      near_misses: w.near_misses ?? 0,
      accidents: w.accidents ?? 0,
      inspections: w.inspections ?? 0
    }))
  }, [weeklyTrends])

  // Compliance KPIs progress - LIVE DATA
  const complianceKPIs = useMemo(() => [
    { name: t('dashboard.environmental.hseCompliance'), current: envMetrics.hseCompliance, target: 95, color: COLORS.hse },
    { name: t('dashboard.environmental.medicalCompliance'), current: envMetrics.medicalCompliance, target: 95, color: COLORS.medical }
  ], [t, envMetrics])

  return (
    <div className="space-y-6 animate-fade-in">
      {/* Environmental Metrics Grid - LIVE DATA */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        <MetricCard
          title={t('dashboard.environmental.hseCompliance')}
          value={envMetrics.hseCompliance}
          icon={ClipboardCheck}
          color="green"
          unit="%"
          trend={t('dashboard.environmental.yearToDate')}
        />
        <MetricCard
          title={t('dashboard.environmental.medicalCompliance')}
          value={envMetrics.medicalCompliance}
          icon={Stethoscope}
          color="purple"
          unit="%"
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
            <h3 className="font-semibold text-gray-900 dark:text-gray-100">{t('dashboard.environmental.complianceTrends')}</h3>
          </div>
          <div className="card-body">
            <div className="h-64">
              <ResponsiveContainer width="100%" height="100%">
                <LineChart data={complianceTrends}>
                  <CartesianGrid strokeDasharray="3 3" stroke="#f0f0f0" className="dark:opacity-20" />
                  <XAxis dataKey="week" tick={{ fontSize: 11 }} />
                  <YAxis tick={{ fontSize: 11 }} domain={[0, 100]} />
                  <Tooltip 
                    contentStyle={{ backgroundColor: '#1f2937', border: 'none', borderRadius: '8px' }}
                    labelStyle={{ color: '#f3f4f6' }}
                  />
                  <Legend />
                  <Line 
                    type="monotone" 
                    dataKey="hse" 
                    stroke={COLORS.hse} 
                    strokeWidth={2}
                    dot={{ fill: COLORS.hse, r: 3 }}
                    name={t('dashboard.environmental.hseCompliance')}
                  />
                  <Line 
                    type="monotone" 
                    dataKey="medical" 
                    stroke={COLORS.medical} 
                    strokeWidth={2}
                    dot={{ fill: COLORS.medical, r: 3 }}
                    name={t('dashboard.environmental.medicalCompliance')}
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
                  <XAxis dataKey="week" tick={{ fontSize: 11 }} />
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
                  />
                  <Legend />
                  <Bar yAxisId="left" dataKey="water" fill={COLORS.water} name="Water (m³)" radius={[4, 4, 0, 0]} />
                  <Line yAxisId="right" type="monotone" dataKey="electricity" stroke={COLORS.electricity} strokeWidth={2} name="Electricity (kWh)" />
                </ComposedChart>
              </ResponsiveContainer>
            </div>
          </div>
        </div>

        {/* Safety Trends - Near Misses, Accidents, Inspections */}
        <div className="card">
          <div className="card-header">
            <h3 className="font-semibold text-gray-900 dark:text-gray-100">{t('dashboard.environmental.safetyTrends')}</h3>
          </div>
          <div className="card-body">
            <div className="h-64">
              <ResponsiveContainer width="100%" height="100%">
                <AreaChart data={safetyTrends}>
                  <CartesianGrid strokeDasharray="3 3" stroke="#f0f0f0" className="dark:opacity-20" />
                  <XAxis dataKey="week" tick={{ fontSize: 11 }} />
                  <YAxis tick={{ fontSize: 11 }} />
                  <Tooltip 
                    contentStyle={{ backgroundColor: '#1f2937', border: 'none', borderRadius: '8px' }}
                    labelStyle={{ color: '#f3f4f6' }}
                  />
                  <Legend />
                  <Area type="monotone" dataKey="inspections" stroke={COLORS.hse} fill={COLORS.hse} fillOpacity={0.6} name={t('dashboard.inspections')} />
                  <Area type="monotone" dataKey="near_misses" stroke={COLORS.training} fill={COLORS.training} fillOpacity={0.6} name={t('dashboard.nearMisses')} />
                  <Area type="monotone" dataKey="accidents" stroke={COLORS.nearMiss} fill={COLORS.nearMiss} fillOpacity={0.6} name={t('dashboard.accidents')} />
                </AreaChart>
              </ResponsiveContainer>
            </div>
          </div>
        </div>

        {/* Compliance Progress Bars */}
        <div className="card">
          <div className="card-header">
            <h3 className="font-semibold text-gray-900 dark:text-gray-100">{t('dashboard.environmental.complianceProgress')}</h3>
          </div>
          <div className="card-body">
            <div className="space-y-6 py-4">
              {complianceKPIs.map((kpi, index) => (
                <div key={index}>
                  <div className="flex justify-between mb-2">
                    <span className="text-sm font-medium text-gray-700 dark:text-gray-300">{kpi.name}</span>
                    <span className="text-sm text-gray-500 dark:text-gray-400">
                      {kpi.current}% / {kpi.target}%
                    </span>
                  </div>
                  <div className="relative h-3 bg-gray-200 dark:bg-gray-700 rounded-full overflow-hidden">
                    <div 
                      className="absolute h-full rounded-full transition-all duration-500"
                      style={{ 
                        width: `${Math.min(kpi.current, 100)}%`, 
                        backgroundColor: kpi.color 
                      }}
                    />
                    <div 
                      className="absolute h-full w-0.5 bg-gray-800 dark:bg-gray-300"
                      style={{ left: `${kpi.target}%` }}
                      title={`Target: ${kpi.target}%`}
                    />
                  </div>
                  <p className="text-xs text-gray-400 dark:text-gray-500 mt-1">
                    {kpi.current >= kpi.target ? `✓ ${t('dashboard.environmental.targetAchieved')}` : `${kpi.target - kpi.current}% ${t('dashboard.environmental.toTarget')}`}
                  </p>
                </div>
              ))}
              
              {/* Additional stats */}
              <div className="mt-6 pt-4 border-t border-gray-200 dark:border-gray-700">
                <div className="grid grid-cols-2 gap-4 text-center">
                  <div>
                    <p className="text-2xl font-bold text-amber-600">{envMetrics.trainingHours.toLocaleString()}</p>
                    <p className="text-xs text-gray-500 dark:text-gray-400">{t('dashboard.environmental.trainingHoursYTD')}</p>
                  </div>
                  <div>
                    <p className="text-2xl font-bold text-red-600">{envMetrics.nearMisses}</p>
                    <p className="text-xs text-gray-500 dark:text-gray-400">{t('dashboard.environmental.nearMissesYTD')}</p>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  )
})

export default EnvironmentalTheme
