import { memo, useMemo } from 'react'
import { useTranslation } from '../../../i18n'
import {
  GraduationCap,
  Users,
  Clock,
  CheckCircle,
  TrendingUp
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
  hse: '#3b82f6',
  technical: '#8b5cf6',
  softSkills: '#ec4899',
  compliance: '#14b8a6'
}

const MetricCard = memo(function MetricCard({ title, value, icon: Icon, color, trend }) {
  const colors = {
    blue: 'border-blue-200 bg-blue-50 dark:border-blue-700 dark:bg-blue-900/50 text-blue-600 dark:text-blue-400',
    green: 'border-green-200 bg-green-50 dark:border-green-700 dark:bg-green-900/50 text-green-600 dark:text-green-400',
    purple: 'border-purple-200 bg-purple-50 dark:border-purple-700 dark:bg-purple-900/50 text-purple-600 dark:text-purple-400',
    amber: 'border-amber-200 bg-amber-50 dark:border-amber-700 dark:bg-amber-900/50 text-amber-600 dark:text-amber-400',
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

const TrainingTheme = memo(function TrainingTheme({ kpiSummary, weeklyTrends, projectPerformance, trainingData, awarenessData }) {
  const t = useTranslation()

  // Training metrics from real data
  const trainingMetrics = useMemo(() => {
    const totalTrainings = trainingData?.total ?? kpiSummary?.total_trainings ?? 0
    const employeesTrained = trainingData?.total_participants ?? kpiSummary?.employees_trained ?? 0
    const trainingHours = trainingData?.total_hours ?? kpiSummary?.total_training_hours ?? kpiSummary?.training_hours ?? 0
    const plannedTrainings = kpiSummary?.total_trainings_planned ?? 0

    const completionRate = plannedTrainings > 0
      ? Math.round((totalTrainings / plannedTrainings) * 100)
      : null

    return {
      totalTrainings,
      employeesTrained,
      trainingHours,
      completionRate,
    }
  }, [kpiSummary, trainingData])

  // Awareness metrics from real data
  const awarenessMetrics = useMemo(() => ({
    totalSessions: awarenessData?.total ?? 0,
    totalParticipants: awarenessData?.total_participants ?? 0,
    totalHours: awarenessData?.total_hours ?? 0,
  }), [awarenessData])

  // Training trends by week (real data)
  const trainingTrends = useMemo(() => {
    if (trainingData?.by_week?.length > 0) {
      return trainingData.by_week.map(w => ({
        week: 'S' + w.week_number,
        trainings: w.count ?? 0,
        participants: w.participants ?? 0
      }))
    }
    return (weeklyTrends ?? []).map(w => ({
      week: w.week_label,
      trainings: w.trainings ?? 0
    }))
  }, [weeklyTrends, trainingData])

  // Training by theme (real data from database)
  const trainingByTheme = useMemo(() => {
    if (trainingData?.by_theme?.length > 0) {
      const themeColors = ['#3b82f6', '#8b5cf6', '#ec4899', '#14b8a6', '#f59e0b', '#ef4444', '#10b981', '#6366f1']
      return trainingData.by_theme.slice(0, 8).map((item, i) => ({
        name: item.theme?.length > 20 ? item.theme.substring(0, 20) + '...' : item.theme,
        fullName: item.theme,
        value: item.count,
        participants: item.participants ?? 0,
        color: themeColors[i % themeColors.length]
      }))
    }
    return []
  }, [trainingData])

  // Training by duration (real data)
  const trainingByDuration = useMemo(() => {
    if (trainingData?.by_duration?.length > 0) {
      return trainingData.by_duration.map(item => ({
        duration: item.duration,
        count: item.count,
        participants: item.participants ?? 0
      }))
    }
    return []
  }, [trainingData])

  // Awareness by theme (real data)
  const awarenessByTheme = useMemo(() => {
    if (awarenessData?.by_theme?.length > 0) {
      const themeColors = ['#16a34a', '#0ea5e9', '#f97316', '#a855f7', '#eab308', '#06b6d4', '#84cc16', '#d946ef']
      return awarenessData.by_theme.slice(0, 8).map((item, i) => ({
        name: item.theme?.length > 20 ? item.theme.substring(0, 20) + '...' : item.theme,
        fullName: item.theme,
        value: item.count,
        participants: item.participants ?? 0,
        color: themeColors[i % themeColors.length]
      }))
    }
    return []
  }, [awarenessData])

  // Training by type (internal vs external)
  const trainingByType = useMemo(() => {
    if (trainingData?.by_type?.length > 0) {
      return trainingData.by_type.map(item => ({
        name: item.type === 'internal' ? t('dashboard.training.internal') : t('dashboard.training.external'),
        value: item.count,
        color: item.type === 'internal' ? '#3b82f6' : '#8b5cf6'
      }))
    }
    return []
  }, [trainingData, t])

  return (
    <div className="space-y-6 animate-fade-in">
      {/* TBM (Awareness) Stats Row */}
      {awarenessMetrics.totalSessions > 0 && (
        <div>
          <div className="mb-3">
            <h3 className="text-sm font-semibold text-gray-700 dark:text-gray-200">
              {t('dashboard.training.sections.awareness') || 'TBT/TBM'}
            </h3>
          </div>
          <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
            <MetricCard
              title={t('dashboard.training.totalAwareness')}
              value={awarenessMetrics.totalSessions}
              icon={Users}
              color="green"
              trend={`${awarenessMetrics.totalParticipants} participants`}
            />
            <MetricCard
              title={t('dashboard.training.awarenessParticipants')}
              value={awarenessMetrics.totalParticipants}
              icon={Users}
              color="purple"
            />
            <MetricCard
              title={t('dashboard.training.awarenessHours')}
              value={Math.round(awarenessMetrics.totalHours ?? 0)}
              icon={Clock}
              color="amber"
            />
          </div>
        </div>
      )}

      {/* TBM (Awareness) Charts */}
      {awarenessByTheme.length > 0 && (
        <div>
          <div className="mb-3">
            <h3 className="text-sm font-semibold text-gray-700 dark:text-gray-200">
              {t('dashboard.training.sections.awarenessCharts') || 'TBT/TBM Charts'}
            </h3>
          </div>
          <div className="grid grid-cols-1 gap-6">
            {/* Awareness Sessions by Theme (TBT/TBM) */}
            <div className="card">
              <div className="card-header">
                <h3 className="font-semibold text-gray-900 dark:text-gray-100">{t('dashboard.training.awarenessByTheme')}</h3>
              </div>
              <div className="card-body">
                <div className="h-72">
                  <ResponsiveContainer width="100%" height="100%">
                    <BarChart data={awarenessByTheme} layout="vertical" margin={{ left: 10, right: 20 }}>
                      <CartesianGrid strokeDasharray="3 3" stroke="#f0f0f0" className="dark:opacity-20" />
                      <XAxis type="number" allowDecimals={false} tick={{ fontSize: 11 }} />
                      <YAxis
                        type="category"
                        dataKey="name"
                        tick={{ fontSize: 10 }}
                        width={120}
                      />
                      <Tooltip
                        contentStyle={{ backgroundColor: '#1f2937', border: 'none', borderRadius: '8px' }}
                        labelStyle={{ color: '#f3f4f6' }}
                        formatter={(value, name, props) => [
                          `${value} ${t('dashboard.training.metrics.sessions') || 'sessions'} (${props.payload.participants} ${t('dashboard.training.metrics.participants') || 'participants'})`,
                          t('dashboard.training.metrics.sessions') || 'Sessions'
                        ]}
                      />
                      <Bar dataKey="value" radius={[0, 4, 4, 0]}>
                        {awarenessByTheme.map((entry, index) => (
                          <Cell key={`cell-${index}`} fill={entry.color} />
                        ))}
                      </Bar>
                    </BarChart>
                  </ResponsiveContainer>
                </div>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Training Metrics Grid */}
      <div>
        <div className="mb-3">
          <h3 className="text-sm font-semibold text-gray-700 dark:text-gray-200">
            {t('dashboard.training.sections.training') || 'Training'}
          </h3>
        </div>
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
          <MetricCard
            title={t('dashboard.training.totalTrainings')}
            value={trainingMetrics.totalTrainings}
            icon={GraduationCap}
            color="blue"
            trend={t('dashboard.training.sessionsCompleted')}
          />
          <MetricCard
            title={t('dashboard.training.employeesTrained')}
            value={trainingMetrics.employeesTrained}
            icon={Users}
            color="green"
            trend={t('dashboard.training.uniqueAttendees')}
          />
          <MetricCard
            title={t('dashboard.training.trainingHours')}
            value={trainingMetrics.trainingHours}
            icon={Clock}
            color="purple"
            trend={t('dashboard.training.totalHoursDelivered')}
          />
          <MetricCard
            title={t('dashboard.training.completionRate')}
            value={trainingMetrics.completionRate !== null ? `${trainingMetrics.completionRate}%` : '—'}
            icon={CheckCircle}
            color="amber"
            trend={`${t('dashboard.training.target')}: 95%`}
          />
        </div>
      </div>

      {/* Training Charts Grid */}
      <div>
        <div className="mb-3">
          <h3 className="text-sm font-semibold text-gray-700 dark:text-gray-200">
            {t('dashboard.training.sections.trainingCharts') || 'Training Charts'}
          </h3>
        </div>
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Training Trends */}
        <div className="card">
          <div className="card-header">
            <h3 className="font-semibold text-gray-900 dark:text-gray-100">{t('dashboard.training.trainingTrends')}</h3>
          </div>
          <div className="card-body">
            <div className="h-64">
              <ResponsiveContainer width="100%" height="100%">
                <AreaChart data={trainingTrends}>
                  <defs>
                    <linearGradient id="trainingGradient" x1="0" y1="0" x2="0" y2="1">
                      <stop offset="5%" stopColor="#3b82f6" stopOpacity={0.8}/>
                      <stop offset="95%" stopColor="#3b82f6" stopOpacity={0.1}/>
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
                    dataKey="trainings" 
                    stroke="#3b82f6" 
                    fill="url(#trainingGradient)" 
                    name={t('dashboard.training.metrics.sessions') || 'Sessions'}
                  />
                </AreaChart>
              </ResponsiveContainer>
            </div>
          </div>
        </div>

        {/* Training by Theme (Real Data) */}
        <div className="card">
          <div className="card-header">
            <h3 className="font-semibold text-gray-900 dark:text-gray-100">{t('dashboard.training.trainingByTheme')}</h3>
          </div>
          <div className="card-body">
            <div className="h-72">
              {trainingByTheme.length > 0 ? (
                <ResponsiveContainer width="100%" height="100%">
                  <BarChart data={trainingByTheme} layout="vertical" margin={{ left: 10, right: 20 }}>
                    <CartesianGrid strokeDasharray="3 3" stroke="#f0f0f0" className="dark:opacity-20" />
                    <XAxis type="number" allowDecimals={false} tick={{ fontSize: 11 }} />
                    <YAxis 
                      type="category" 
                      dataKey="name" 
                      tick={{ fontSize: 10 }} 
                      width={120}
                    />
                    <Tooltip 
                      contentStyle={{ backgroundColor: '#1f2937', border: 'none', borderRadius: '8px' }}
                      labelStyle={{ color: '#f3f4f6' }}
                      formatter={(value, name, props) => [
                        `${value} ${t('dashboard.training.metrics.sessions') || 'sessions'} (${props.payload.participants} ${t('dashboard.training.metrics.participants') || 'participants'})`,
                        t('dashboard.training.metrics.sessions') || 'Sessions'
                      ]}
                    />
                    <Bar dataKey="value" radius={[0, 4, 4, 0]}>
                      {trainingByTheme.map((entry, index) => (
                        <Cell key={`cell-${index}`} fill={entry.color} />
                      ))}
                    </Bar>
                  </BarChart>
                </ResponsiveContainer>
              ) : (
                <div className="flex items-center justify-center h-full text-gray-400">
                  <div className="text-center">
                    <GraduationCap className="w-12 h-12 mx-auto mb-2 opacity-50" />
                    <p className="font-medium">{t('dashboard.training.noTrainingData')}</p>
                  </div>
                </div>
              )}
            </div>
          </div>
        </div>

        {/* Training by Duration (Real Data) */}
        <div className="card">
          <div className="card-header">
            <h3 className="font-semibold text-gray-900 dark:text-gray-100">{t('dashboard.training.trainingByDuration')}</h3>
          </div>
          <div className="card-body">
            <div className="h-64">
              {trainingByDuration.length > 0 ? (
                <ResponsiveContainer width="100%" height="100%">
                  <BarChart data={trainingByDuration}>
                    <CartesianGrid strokeDasharray="3 3" stroke="#f0f0f0" className="dark:opacity-20" />
                    <XAxis dataKey="duration" tick={{ fontSize: 11 }} />
                    <YAxis allowDecimals={false} tick={{ fontSize: 11 }} />
                    <Tooltip 
                      contentStyle={{ backgroundColor: '#1f2937', border: 'none', borderRadius: '8px' }}
                      labelStyle={{ color: '#f3f4f6' }}
                      formatter={(value, name) => [
                        value,
                        name === 'count'
                          ? (t('dashboard.training.metrics.sessions') || 'Sessions')
                          : (t('dashboard.training.metrics.participants') || 'Participants')
                      ]}
                    />
                    <Bar dataKey="count" fill="#8b5cf6" radius={[4, 4, 0, 0]} name={t('dashboard.training.metrics.sessions') || 'Sessions'} />
                  </BarChart>
                </ResponsiveContainer>
              ) : (
                <div className="flex items-center justify-center h-full text-gray-400">
                  <p className="font-medium">{t('dashboard.training.noTrainingData')}</p>
                </div>
              )}
            </div>
          </div>
        </div>

        {/* Training Type (Internal vs External) */}
        <div className="card">
          <div className="card-header">
            <h3 className="font-semibold text-gray-900 dark:text-gray-100">{t('dashboard.training.trainingByType')}</h3>
          </div>
          <div className="card-body">
            <div className="h-64">
              {trainingByType.length > 0 ? (
                <ResponsiveContainer width="100%" height="100%">
                  <PieChart>
                    <Pie
                      data={trainingByType}
                      cx="50%"
                      cy="45%"
                      innerRadius={40}
                      outerRadius={70}
                      paddingAngle={5}
                      dataKey="value"
                      label={({ value }) => value}
                      labelLine={false}
                    >
                      {trainingByType.map((entry, index) => (
                        <Cell key={`cell-${index}`} fill={entry.color} />
                      ))}
                    </Pie>
                    <Tooltip formatter={(value, name) => [value, name]} />
                    <Legend 
                      verticalAlign="bottom" 
                      height={36}
                      formatter={(value) => <span className="text-sm">{value}</span>}
                    />
                  </PieChart>
                </ResponsiveContainer>
              ) : (
                <div className="flex items-center justify-center h-full text-gray-400">
                  <p className="font-medium">{t('dashboard.training.noTrainingData')}</p>
                </div>
              )}
            </div>
          </div>
        </div>
        </div>
      </div>
    </div>
  )
})

export default TrainingTheme
