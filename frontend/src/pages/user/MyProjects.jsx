import { useState, useEffect } from 'react'
import { Link, useLocation } from 'react-router-dom'
import { projectService } from '../../services/api'
import { useLanguage } from '../../i18n'
import { useAuthStore } from '../../store/authStore'
import { useDevStore, DEV_PROJECT_SCOPE } from '../../store/devStore'
import ZonesManager from '../../components/zones/ZonesManager'
import {
  FolderKanban,
  MapPin,
  Calendar,
  Users,
  Eye,
  PlusCircle,
  Loader2,
  TrendingUp,
  Settings2
} from 'lucide-react'
import toast from 'react-hot-toast'

export default function MyProjects({ showKpiButton = true }) {
  const { t, language } = useLanguage()
  const { user } = useAuthStore()
  const { projectScope } = useDevStore()
  const location = useLocation()
  const [projects, setProjects] = useState([])
  const [loading, setLoading] = useState(true)
  const [zonesModalOpen, setZonesModalOpen] = useState(false)
  const [selectedProject, setSelectedProject] = useState(null)
  
  // Check if user is responsable (HSE Manager)
  const isResponsable = user?.role === 'responsable' || user?.role === 'admin'
  
  // Determine base path based on current route (for SOR users vs regular users)
  const isSorRoute = location.pathname.startsWith('/sor')
  const projectDetailPath = isSorRoute ? '/sor/projects' : '/projects'
  
  const openZonesManager = (project) => {
    setSelectedProject(project)
    setZonesModalOpen(true)
  }

  useEffect(() => {
    fetchProjects()
  }, [projectScope])

  const fetchProjects = async () => {
    try {
      setLoading(true)
      const params = { per_page: 50 }
      if (user?.role === 'dev' && projectScope === DEV_PROJECT_SCOPE.ASSIGNED) {
        params.scope = 'assigned'
      }
      const response = await projectService.getAll(params)
      setProjects(response.data.data || [])
    } catch (error) {
      toast.error('Failed to load projects')
    } finally {
      setLoading(false)
    }
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

  return (
    <div className="space-y-6 animate-fade-in">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-gray-900 dark:text-gray-100">{t('nav.myProjects')}</h1>
          <p className="text-gray-500 dark:text-gray-400 mt-1">
            {showKpiButton ? t('projects.assignedForKpi') : t('projects.assignedToYou')}
          </p>
        </div>
      </div>

      {/* Projects Grid */}
      {projects.length === 0 ? (
        <div className="card p-12 text-center">
          <FolderKanban className="w-12 h-12 text-gray-300 dark:text-gray-600 mx-auto mb-4" />
          <h3 className="text-lg font-medium text-gray-900 dark:text-gray-100 mb-2">No projects assigned</h3>
          <p className="text-gray-500 dark:text-gray-400">
            Contact your administrator to get assigned to projects.
          </p>
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-2 gap-6">
          {projects.map((project) => (
            <div key={project.id} className="card hover:shadow-md transition-shadow">
              <div className="p-6">
                <div className="flex items-start justify-between mb-4">
                  <div className="flex items-center gap-3">
                    <div className="w-12 h-12 bg-hse-primary/10 rounded-lg flex items-center justify-center">
                      <FolderKanban className="w-6 h-6 text-hse-primary" />
                    </div>
                    <div>
                      <h3 className="font-semibold text-gray-900 dark:text-gray-100">{project.name}</h3>
                      <p className="text-sm text-gray-500 dark:text-gray-400">{project.code}</p>
                    </div>
                  </div>
                  <div className="flex flex-col items-end gap-1">
                    <span className={`badge ${statusColors[project.status]}`}>
                      {project.status.replace('_', ' ')}
                    </span>
                    {project.pole && (
                      <span className="text-[11px] px-2 py-0.5 rounded-full bg-gray-100 text-gray-700 dark:bg-gray-700 dark:text-gray-200">
                        {project.pole}
                      </span>
                    )}
                  </div>
                </div>

                {project.description && (
                  <p className="text-sm text-gray-600 dark:text-gray-300 mb-4 line-clamp-2">
                    {project.description}
                  </p>
                )}

                <div className="space-y-2 text-sm">
                  {project.location && (
                    <div className="flex items-center gap-2 text-gray-500 dark:text-gray-400">
                      <MapPin className="w-4 h-4" />
                      <span>{project.location}</span>
                    </div>
                  )}
                  {project.start_date && (
                    <div className="flex items-center gap-2 text-gray-500 dark:text-gray-400">
                      <Calendar className="w-4 h-4" />
                      <span>
                        Started {new Date(project.start_date).toLocaleDateString()}
                      </span>
                    </div>
                  )}
                </div>

                {/* KPI Summary if available */}
                {project.kpi_summary && (
                  <div className="mt-4 p-3 bg-gray-50 dark:bg-gray-700/50 rounded-lg">
                    <div className="grid grid-cols-3 gap-2 text-center">
                      <div>
                        <p className="text-lg font-bold text-gray-900 dark:text-gray-100">
                          {project.kpi_summary.total_accidents ?? 0}
                        </p>
                        <p className="text-xs text-gray-500 dark:text-gray-400">Accidents</p>
                      </div>
                      <div>
                        <p className="text-lg font-bold text-gray-900 dark:text-gray-100">
                          {project.kpi_summary.total_trainings ?? 0}
                        </p>
                        <p className="text-xs text-gray-500 dark:text-gray-400">Trainings</p>
                      </div>
                      <div>
                        <p className="text-lg font-bold text-gray-900 dark:text-gray-100">
                          {project.kpi_summary.total_inspections ?? 0}
                        </p>
                        <p className="text-xs text-gray-500 dark:text-gray-400">Inspections</p>
                      </div>
                    </div>
                  </div>
                )}

                <div className="flex items-center justify-between gap-2 mt-4 pt-4 border-t border-gray-100 dark:border-gray-700">
                  <div className="flex items-center gap-2">
                    <Link
                      to={`${projectDetailPath}/${project.id}`}
                      className="btn-outline btn-sm flex items-center gap-1 text-xs whitespace-nowrap"
                    >
                      <Eye className="w-3 h-3" />
                      {t('common.viewDetails')}
                    </Link>
                    {isResponsable && (
                      <button
                        onClick={() => openZonesManager(project)}
                        className="btn-sm flex items-center gap-1 text-xs whitespace-nowrap bg-amber-50 text-amber-700 hover:bg-amber-100 dark:bg-amber-900/30 dark:text-amber-400 dark:hover:bg-amber-900/50 border border-amber-200 dark:border-amber-800 rounded-lg"
                      >
                        <Settings2 className="w-3 h-3" />
                        Zones
                      </button>
                    )}
                  </div>
                  {showKpiButton && (
                    <Link
                      to={`/kpi/submit/${project.id}`}
                      className="btn-primary btn-sm flex items-center gap-1 text-xs whitespace-nowrap"
                    >
                      <PlusCircle className="w-3 h-3" />
                      {t('kpi.submitKpi')}
                    </Link>
                  )}
                </div>
              </div>
            </div>
          ))}
        </div>
      )}

      {/* Zones Manager Modal */}
      <ZonesManager
        projectId={selectedProject?.id}
        projectName={selectedProject?.name}
        isOpen={zonesModalOpen}
        onClose={() => {
          setZonesModalOpen(false)
          setSelectedProject(null)
        }}
      />
    </div>
  )
}
