import { useState, useEffect } from 'react'
import { useParams, Link, useLocation } from 'react-router-dom'
import { projectService } from '../../services/api'
import { useAuthStore } from '../../store/authStore'
import { useLanguage } from '../../i18n'
import MemberManagement from '../../components/MemberManagement'
import ZonesManager from '../../components/zones/ZonesManager'
import {
  FolderKanban,
  MapPin,
  Calendar,
  ArrowLeft,
  Loader2,
  AlertTriangle,
  GraduationCap,
  ClipboardCheck,
  TrendingUp,
  Download,
  Users,
} from 'lucide-react'
import {
  LineChart,
  Line,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
  Legend
} from 'recharts'
import toast from 'react-hot-toast'

const tooltipPortal = typeof document !== 'undefined' ? document.body : null
const tooltipWrapperStyle = { zIndex: 9999, pointerEvents: 'none' }

export default function ProjectDetails() {
  const { id } = useParams()
  const location = useLocation()
  const { t, language } = useLanguage()
  const [project, setProject] = useState(null)
  const [trends, setTrends] = useState([])
  const [loading, setLoading] = useState(true)
  const [zonesOpen, setZonesOpen] = useState(false)
  const { isAdmin, user } = useAuthStore()
  
  // Check if this is an HSE Officer route
  const isSorRoute = location.pathname.startsWith('/sor')
  const isHseOfficer = user?.role === 'user'
  const canManageTeam = isAdmin() || user?.role === 'hse_manager' || user?.role === 'responsable'
  const canManageZones = isAdmin() || user?.role === 'hse_manager' || user?.role === 'responsable'

  useEffect(() => {
    fetchProject()
  }, [id])

  const fetchProject = async () => {
    try {
      setLoading(true)
      const [projectRes, trendsRes] = await Promise.all([
        projectService.getById(id),
        projectService.getKpiTrends(id, 12)
      ])
      setProject(projectRes.data.data)
      setTrends(trendsRes.data.data || [])
    } catch (error) {
      toast.error(t('projects.loadFailed'))
    } finally {
      setLoading(false)
    }
  }

  const locale = language === 'en' ? 'en-GB' : 'fr-FR'

  const monthLabel = (year, month) => {
    const y = Number(year)
    const m = Number(month)
    if (!y || !m) return ''
    const d = new Date(y, m - 1, 1)
    return d.toLocaleString(locale, { month: 'short' })
  }

  const formatTrends = () => {
    const weekPrefix = t('common.weekAbbrev')
    return trends.map(t => ({
      ...t,
      week: t.week_number ? `${weekPrefix}${String(t.week_number).padStart(2, '0')}` : monthLabel(t.report_year, t.report_month),
      tf: Number(t.tf_value).toFixed(2),
      tg: Number(t.tg_value).toFixed(2)
    }))
  }

  const statusColors = {
    active: 'badge-success',
    completed: 'badge-info',
    on_hold: 'badge-warning',
    cancelled: 'badge-danger'
  }

  if (loading) {
    return (
      <div className="flex items-center justify-center h-96">
        <Loader2 className="w-8 h-8 animate-spin text-hse-primary" />
      </div>
    )
  }

  if (!project) {
    return (
      <div className="text-center py-12">
        <h2 className="text-xl font-semibold text-gray-900">{t('projects.notFound')}</h2>
        <Link to={isAdmin() ? '/admin/projects' : '/my-projects'} className="btn-primary mt-4">
          {t('projects.backToProjects')}
        </Link>
      </div>
    )
  }

  const kpiSummary = project.kpi_summary || {}

  return (
    <div className="space-y-6 animate-fade-in">
      {/* Back button */}
      <Link
        to={isAdmin() ? '/admin/projects' : (isSorRoute ? '/sor/projects' : '/my-projects')}
        className="inline-flex items-center gap-2 text-gray-600 dark:text-gray-400 hover:text-gray-900 dark:hover:text-gray-100"
      >
        <ArrowLeft className="w-4 h-4" />
        {t('projects.backToProjects')}
      </Link>

      {/* Project Header */}
      <div className="card p-6">
        <div className="flex flex-col md:flex-row md:items-start md:justify-between gap-4">
          <div className="flex items-start gap-4">
            <div className="w-16 h-16 bg-hse-primary/10 rounded-xl flex items-center justify-center">
              <FolderKanban className="w-8 h-8 text-hse-primary" />
            </div>
            <div>
              <div className="flex items-center gap-3">
                <h1 className="text-2xl font-bold text-gray-900 dark:text-gray-100">{project.name}</h1>
                <span className={`badge ${statusColors[project.status]}`}>
                  {t(`projects.${project.status}`) ?? project.status.replace('_', ' ')}
                </span>
                {project.pole && (
                  <span className="text-[11px] px-2 py-0.5 rounded-full bg-gray-100 text-gray-700 dark:bg-gray-700 dark:text-gray-200">
                    {project.pole}
                  </span>
                )}
              </div>
              <p className="text-gray-500 dark:text-gray-400 mt-1">{project.code}</p>
              {project.description && (
                <p className="text-gray-600 dark:text-gray-300 mt-2 max-w-2xl">{project.description}</p>
              )}
            </div>
          </div>
          
          {!isAdmin() && (
            isHseOfficer || isSorRoute ? (
              <Link to="/sor" className="btn-primary">
                {t('sor.submitDeviation')}
              </Link>
            ) : (
              <Link to={`/kpi/submit/${project.id}`} className="btn-primary">
                {t('kpi.submitKpi')}
              </Link>
            )
          )}
        </div>

        <div className="flex items-center justify-between gap-3 mt-4">
          <div className="flex flex-wrap items-center gap-2">
            {(Array.isArray(project.zones) ? project.zones : []).slice(0, 6).map((zone) => (
              <span
                key={zone}
                className="text-xs px-2 py-1 rounded-full bg-amber-50 text-amber-800 dark:bg-amber-900/30 dark:text-amber-200"
              >
                {zone}
              </span>
            ))}
            {(Array.isArray(project.zones) ? project.zones : []).length > 6 && (
              <span className="text-xs text-gray-500 dark:text-gray-400">
                +{(project.zones?.length ?? 0) - 6}
              </span>
            )}
            {(Array.isArray(project.zones) ? project.zones : []).length === 0 && (
              <span className="text-xs text-gray-500 dark:text-gray-400">{t('common.noData')}</span>
            )}
          </div>

          {canManageZones && (
            <button type="button" className="btn-secondary" onClick={() => setZonesOpen(true)}>
              {t('projects.manageZones')}
            </button>
          )}
        </div>

        <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mt-6 pt-6 border-t border-gray-100 dark:border-gray-700">
          {project.location && (
            <div className="flex items-center gap-2 text-gray-600 dark:text-gray-300">
              <MapPin className="w-4 h-4 text-gray-400" />
              <span className="text-sm">{project.location}</span>
            </div>
          )}
          {project.start_date && (
            <div className="flex items-center gap-2 text-gray-600 dark:text-gray-300">
              <Calendar className="w-4 h-4 text-gray-400" />
              <span className="text-sm">
                {new Date(project.start_date).toLocaleDateString(locale)}
                {project.end_date && ` - ${new Date(project.end_date).toLocaleDateString(locale)}`}
              </span>
            </div>
          )}
          <div className="flex items-center gap-2 text-gray-600 dark:text-gray-300">
            <Users className="w-4 h-4 text-gray-400" />
            <span className="text-sm">{t('projects.assignedUsersCount', { count: project.users?.length ?? 0 })}</span>
          </div>
          {project.client_name && (
            <div className="text-sm text-gray-600 dark:text-gray-300">
              <span className="text-gray-400">{t('projects.clientLabel')}</span> {project.client_name}
            </div>
          )}
        </div>
      </div>

      {/* Member Management - For HSE Managers and Admins */}
      {canManageTeam && project && (
        <MemberManagement projectId={project.id} projectName={project.name} />
      )}

      {project && (
        <ZonesManager
          projectId={project.id}
          projectName={project.name}
          isOpen={zonesOpen}
          onClose={() => setZonesOpen(false)}
        />
      )}

      {/* KPI Summary Cards */}
      <div className="grid grid-cols-2 lg:grid-cols-6 gap-4">
        <SummaryCard
          title={t('projects.summary.accidents')}
          value={kpiSummary.total_accidents ?? 0}
          icon={AlertTriangle}
          color={kpiSummary.total_accidents > 0 ? 'red' : 'green'}
        />
        <SummaryCard
          title={t('projects.summary.trainings')}
          value={kpiSummary.total_trainings ?? 0}
          icon={GraduationCap}
          color="blue"
        />
        <SummaryCard
          title={t('projects.summary.inspections')}
          value={kpiSummary.total_inspections ?? 0}
          icon={ClipboardCheck}
          color="green"
        />
        <SummaryCard
          title={t('projects.summary.hoursWorked')}
          value={Number(kpiSummary.total_hours_worked ?? 0).toLocaleString()}
          icon={TrendingUp}
          color="purple"
        />
        <SummaryCard
          title={t('projects.summary.avgTf')}
          value={Number(kpiSummary.avg_tf ?? 0).toFixed(2)}
          icon={TrendingUp}
          color="amber"
        />
        <SummaryCard
          title={t('projects.summary.avgTg')}
          value={Number(kpiSummary.avg_tg ?? 0).toFixed(2)}
          icon={TrendingUp}
          color="purple"
        />
      </div>

      {/* Charts */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Monthly KPI Trends */}
        <div className="card">
          <div className="card-header">
            <h3 className="font-semibold text-gray-900 dark:text-gray-100">{t('projects.charts.kpiTrends')}</h3>
          </div>
          <div className="card-body">
            <div className="h-80">
              {trends.length > 0 ? (
                <ResponsiveContainer width="100%" height="100%">
                  <LineChart data={formatTrends()}>
                    <CartesianGrid strokeDasharray="3 3" stroke="#f0f0f0" />
                    <XAxis dataKey="week" tick={{ fontSize: 12 }} />
                    <YAxis tick={{ fontSize: 12 }} />
                    <Tooltip
                      allowEscapeViewBox={{ x: true, y: true }}
                      portal={tooltipPortal}
                      wrapperStyle={tooltipWrapperStyle}
                    />
                    <Legend />
                    <Line type="monotone" dataKey="accidents" stroke="#dc2626" name={t('projects.metrics.accidents')} />
                    <Line type="monotone" dataKey="trainings_conducted" stroke="#3b82f6" name={t('projects.metrics.trainings')} />
                    <Line type="monotone" dataKey="inspections_completed" stroke="#16a34a" name={t('projects.metrics.inspections')} />
                  </LineChart>
                </ResponsiveContainer>
              ) : (
                <div className="flex items-center justify-center h-full text-gray-500 dark:text-gray-400">
                  {t('common.noData')}
                </div>
              )}
            </div>
          </div>
        </div>

        {/* TF/TG Trends */}
        <div className="card">
          <div className="card-header">
            <h3 className="font-semibold text-gray-900 dark:text-gray-100">{t('projects.charts.tfTgTrends')}</h3>
          </div>
          <div className="card-body">
            <div className="h-80">
              {trends.length > 0 ? (
                <ResponsiveContainer width="100%" height="100%">
                  <LineChart data={formatTrends()}>
                    <CartesianGrid strokeDasharray="3 3" className="dark:opacity-20" />
                    <XAxis dataKey="week" tick={{ fontSize: 12 }} className="dark:text-gray-400" />
                    <YAxis tick={{ fontSize: 12 }} className="dark:text-gray-400" />
                    <Tooltip
                      allowEscapeViewBox={{ x: true, y: true }}
                      portal={tooltipPortal}
                      wrapperStyle={tooltipWrapperStyle}
                    />
                    <Legend />
                    <Line type="monotone" dataKey="tf" stroke="#f59e0b" name={t('projects.metrics.tfRate')} />
                    <Line type="monotone" dataKey="tg" stroke="#8b5cf6" name={t('projects.metrics.tgRate')} />
                  </LineChart>
                </ResponsiveContainer>
              ) : (
                <div className="flex items-center justify-center h-full text-gray-500 dark:text-gray-400">
                  {t('common.noData')}
                </div>
              )}
            </div>
          </div>
        </div>
      </div>

      {/* Assigned Users */}
      {project.users && project.users.length > 0 && (
        <div className="card">
          <div className="card-header">
            <h3 className="font-semibold text-gray-900 dark:text-gray-100">{t('projects.assignedTeamMembers')}</h3>
          </div>
          <div className="p-6">
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
              {project.users.map((user) => (
                <div key={user.id} className="flex items-center gap-3 p-3 bg-gray-50 dark:bg-gray-700 rounded-lg">
                  <div className="w-10 h-10 bg-hse-primary rounded-full flex items-center justify-center">
                    <span className="text-white font-semibold">
                      {user.name.charAt(0).toUpperCase()}
                    </span>
                  </div>
                  <div>
                    <p className="font-medium text-gray-900 dark:text-gray-100">{user.name}</p>
                    <p className="text-sm text-gray-500 dark:text-gray-400">{t(`roles.${user.role}`) ?? user.role}</p>
                  </div>
                </div>
              ))}
            </div>
          </div>
        </div>
      )}

      {/* Recent Reports */}
      {project.kpiReports && project.kpiReports.length > 0 && (
        <div className="card">
          <div className="card-header">
            <h3 className="font-semibold text-gray-900 dark:text-gray-100">{t('projects.recentKpiReports')}</h3>
          </div>
          <div className="overflow-x-auto">
            <table className="table">
              <thead>
                <tr>
                  <th>{t('projects.period')}</th>
                  <th>{t('projects.metrics.accidents')}</th>
                  <th>{t('projects.metrics.trainings')}</th>
                  <th>{t('projects.metrics.inspections')}</th>
                  <th>TF</th>
                  <th>TG</th>
                  <th>{t('projects.status')}</th>
                </tr>
              </thead>
              <tbody>
                {project.kpiReports.map((report) => (
                  <tr key={report.id}>
                    <td>{monthLabel(report.report_year, report.report_month)} {report.report_year}</td>
                    <td className={report.accidents > 0 ? 'text-red-600 font-semibold' : ''}>
                      {report.accidents}
                    </td>
                    <td>{report.trainings_conducted}</td>
                    <td>{report.inspections_completed}</td>
                    <td>{Number(report.tf_value).toFixed(2)}</td>
                    <td>{Number(report.tg_value).toFixed(2)}</td>
                    <td>
                      <span className={`badge ${
                        report.status === 'approved' ? 'badge-success' :
                        report.status === 'submitted' ? 'badge-warning' :
                        report.status === 'rejected' ? 'badge-danger' : 'badge-info'
                      }`}>
                        {t(`kpi.status.${report.status}`) ?? report.status}
                      </span>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}
    </div>
  )
}

function SummaryCard({ title, value, icon: Icon, color }) {
  const colors = {
    red: 'border-red-200 bg-red-50 dark:border-red-700 dark:bg-red-900/50',
    green: 'border-green-200 bg-green-50 dark:border-green-700 dark:bg-green-900/50',
    blue: 'border-blue-200 bg-blue-50 dark:border-blue-700 dark:bg-blue-900/50',
    amber: 'border-amber-200 bg-amber-50 dark:border-amber-700 dark:bg-amber-900/50',
    purple: 'border-purple-200 bg-purple-50 dark:border-purple-700 dark:bg-purple-900/50',
  }

  const iconColors = {
    red: 'text-red-600 dark:text-red-400',
    green: 'text-green-600 dark:text-green-400',
    blue: 'text-blue-600 dark:text-blue-400',
    amber: 'text-amber-600 dark:text-amber-400',
    purple: 'text-purple-600 dark:text-purple-400',
  }

  return (
    <div className={`rounded-xl border-2 p-4 ${colors[color]}`}>
      <div className="flex items-center gap-2 mb-2">
        <Icon className={`w-4 h-4 ${iconColors[color]}`} />
        <span className="text-xs font-medium text-gray-600 dark:text-gray-300">{title}</span>
      </div>
      <p className="text-xl font-bold text-gray-900 dark:text-gray-100">{value}</p>
    </div>
  )
}
