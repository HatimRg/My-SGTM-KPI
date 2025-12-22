import { useState, useEffect } from 'react'
import { useParams, Link, useLocation } from 'react-router-dom'
import { projectService } from '../../services/api'
import { useAuthStore } from '../../store/authStore'
import { useLanguage } from '../../i18n'
import MemberManagement from '../../components/MemberManagement'
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

export default function ProjectDetails() {
  const { id } = useParams()
  const location = useLocation()
  const { t } = useLanguage()
  const [project, setProject] = useState(null)
  const [trends, setTrends] = useState([])
  const [loading, setLoading] = useState(true)
  const { isAdmin, user } = useAuthStore()
  
  // Check if this is an HSE Officer route
  const isSorRoute = location.pathname.startsWith('/sor')
  const isHseOfficer = user?.role === 'user'
  const isHseManager = user?.role === 'responsable'
  const canManageTeam = isAdmin() || isHseManager

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
      toast.error('Failed to load project details')
    } finally {
      setLoading(false)
    }
  }

  const monthNames = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec']

  const formatTrends = () => {
    return trends.map(t => ({
      ...t,
      month: monthNames[t.report_month - 1],
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
        <h2 className="text-xl font-semibold text-gray-900">Project not found</h2>
        <Link to={isAdmin() ? '/admin/projects' : '/my-projects'} className="btn-primary mt-4">
          Back to Projects
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
                  {project.status.replace('_', ' ')}
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
                {new Date(project.start_date).toLocaleDateString()}
                {project.end_date && ` - ${new Date(project.end_date).toLocaleDateString()}`}
              </span>
            </div>
          )}
          <div className="flex items-center gap-2 text-gray-600 dark:text-gray-300">
            <Users className="w-4 h-4 text-gray-400" />
            <span className="text-sm">{project.users?.length ?? 0} assigned users</span>
          </div>
          {project.client_name && (
            <div className="text-sm text-gray-600 dark:text-gray-300">
              <span className="text-gray-400">Client:</span> {project.client_name}
            </div>
          )}
        </div>
      </div>

      {/* Member Management - For HSE Managers and Admins */}
      {canManageTeam && project && (
        <MemberManagement projectId={project.id} projectName={project.name} />
      )}

      {/* KPI Summary Cards */}
      <div className="grid grid-cols-2 lg:grid-cols-6 gap-4">
        <SummaryCard
          title="Accidents"
          value={kpiSummary.total_accidents ?? 0}
          icon={AlertTriangle}
          color={kpiSummary.total_accidents > 0 ? 'red' : 'green'}
        />
        <SummaryCard
          title="Trainings"
          value={kpiSummary.total_trainings ?? 0}
          icon={GraduationCap}
          color="blue"
        />
        <SummaryCard
          title="Inspections"
          value={kpiSummary.total_inspections ?? 0}
          icon={ClipboardCheck}
          color="green"
        />
        <SummaryCard
          title="Hours Worked"
          value={Number(kpiSummary.total_hours_worked ?? 0).toLocaleString()}
          icon={TrendingUp}
          color="purple"
        />
        <SummaryCard
          title="Avg TF"
          value={Number(kpiSummary.avg_tf ?? 0).toFixed(2)}
          icon={TrendingUp}
          color="amber"
        />
        <SummaryCard
          title="Avg TG"
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
            <h3 className="font-semibold text-gray-900 dark:text-gray-100">Monthly KPI Trends</h3>
          </div>
          <div className="card-body">
            <div className="h-80">
              {trends.length > 0 ? (
                <ResponsiveContainer width="100%" height="100%">
                  <LineChart data={formatTrends()}>
                    <CartesianGrid strokeDasharray="3 3" stroke="#f0f0f0" />
                    <XAxis dataKey="month" tick={{ fontSize: 12 }} />
                    <YAxis tick={{ fontSize: 12 }} />
                    <Tooltip />
                    <Legend />
                    <Line type="monotone" dataKey="accidents" stroke="#dc2626" name="Accidents" />
                    <Line type="monotone" dataKey="trainings_conducted" stroke="#3b82f6" name="Trainings" />
                    <Line type="monotone" dataKey="inspections_completed" stroke="#16a34a" name="Inspections" />
                  </LineChart>
                </ResponsiveContainer>
              ) : (
                <div className="flex items-center justify-center h-full text-gray-500 dark:text-gray-400">
                  No data available
                </div>
              )}
            </div>
          </div>
        </div>

        {/* TF/TG Trends */}
        <div className="card">
          <div className="card-header">
            <h3 className="font-semibold text-gray-900 dark:text-gray-100">TF & TG Rate Trends</h3>
          </div>
          <div className="card-body">
            <div className="h-80">
              {trends.length > 0 ? (
                <ResponsiveContainer width="100%" height="100%">
                  <LineChart data={formatTrends()}>
                    <CartesianGrid strokeDasharray="3 3" className="dark:opacity-20" />
                    <XAxis dataKey="month" tick={{ fontSize: 12 }} className="dark:text-gray-400" />
                    <YAxis tick={{ fontSize: 12 }} className="dark:text-gray-400" />
                    <Tooltip />
                    <Legend />
                    <Line type="monotone" dataKey="tf" stroke="#f59e0b" name="TF Rate" />
                    <Line type="monotone" dataKey="tg" stroke="#8b5cf6" name="TG Rate" />
                  </LineChart>
                </ResponsiveContainer>
              ) : (
                <div className="flex items-center justify-center h-full text-gray-500 dark:text-gray-400">
                  No data available
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
            <h3 className="font-semibold text-gray-900 dark:text-gray-100">Assigned Team Members</h3>
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
                    <p className="text-sm text-gray-500 dark:text-gray-400 capitalize">{user.role}</p>
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
            <h3 className="font-semibold text-gray-900 dark:text-gray-100">Recent KPI Reports</h3>
          </div>
          <div className="overflow-x-auto">
            <table className="table">
              <thead>
                <tr>
                  <th>Period</th>
                  <th>Accidents</th>
                  <th>Trainings</th>
                  <th>Inspections</th>
                  <th>TF</th>
                  <th>TG</th>
                  <th>Status</th>
                </tr>
              </thead>
              <tbody>
                {project.kpiReports.map((report) => (
                  <tr key={report.id}>
                    <td>{monthNames[report.report_month - 1]} {report.report_year}</td>
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
                        {report.status}
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
