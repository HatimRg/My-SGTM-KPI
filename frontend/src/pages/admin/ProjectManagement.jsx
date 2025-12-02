import { useState, useEffect } from 'react'
import { Link } from 'react-router-dom'
import { projectService, userService } from '../../services/api'
import { Modal, DatePicker, ConfirmDialog, Select } from '../../components/ui'
import {
  FolderKanban,
  Plus,
  Search,
  Filter,
  Edit,
  Trash2,
  X,
  Loader2,
  MapPin,
  Calendar,
  Users,
  Eye
} from 'lucide-react'
import toast from 'react-hot-toast'

export default function ProjectManagement() {
  const [projects, setProjects] = useState([])
  const [users, setUsers] = useState([])
  const [loading, setLoading] = useState(true)
  const [search, setSearch] = useState('')
  const [statusFilter, setStatusFilter] = useState('')
  const [modalOpen, setModalOpen] = useState(false)
  const [editingProject, setEditingProject] = useState(null)
  const [formData, setFormData] = useState({
    name: '',
    code: '',
    description: '',
    location: '',
    start_date: '',
    end_date: '',
    status: 'active',
    budget: '',
    client_name: '',
    user_ids: []
  })
  const [saving, setSaving] = useState(false)
  const [pagination, setPagination] = useState({ current_page: 1, last_page: 1 })
  const [confirmProject, setConfirmProject] = useState(null)

  useEffect(() => {
    fetchProjects()
    fetchUsers()
  }, [search, statusFilter])

  const fetchProjects = async (page = 1) => {
    try {
      setLoading(true)
      const response = await projectService.getAll({
        page,
        search,
        status: statusFilter,
        per_page: 10
      })
      setProjects(response.data.data || [])
      setPagination(response.data.meta || { current_page: 1, last_page: 1 })
    } catch (error) {
      toast.error('Failed to load projects')
    } finally {
      setLoading(false)
    }
  }

  const fetchUsers = async () => {
    try {
      const response = await userService.getAll({ per_page: 100, role: 'responsable' })
      setUsers(response.data.data || [])
    } catch (error) {
      console.error('Failed to load users')
    }
  }

  const openModal = (project = null) => {
    if (project) {
      setEditingProject(project)
      setFormData({
        name: project.name,
        code: project.code,
        description: project.description || '',
        location: project.location || '',
        start_date: project.start_date?.split('T')[0] || '',
        end_date: project.end_date?.split('T')[0] || '',
        status: project.status,
        budget: project.budget || '',
        client_name: project.client_name || '',
        user_ids: project.users?.map(u => u.id) || []
      })
    } else {
      setEditingProject(null)
      setFormData({
        name: '',
        code: '',
        description: '',
        location: '',
        start_date: '',
        end_date: '',
        status: 'active',
        budget: '',
        client_name: '',
        user_ids: []
      })
    }
    setModalOpen(true)
  }

  const closeModal = () => {
    setModalOpen(false)
    setEditingProject(null)
  }

  const handleSubmit = async (e) => {
    e.preventDefault()
    setSaving(true)

    try {
      if (editingProject) {
        await projectService.update(editingProject.id, formData)
        toast.success('Project updated successfully')
      } else {
        await projectService.create(formData)
        toast.success('Project created successfully')
      }
      closeModal()
      fetchProjects()
    } catch (error) {
      const message = error.response?.data?.message || 'Failed to save project'
      toast.error(message)
    } finally {
      setSaving(false)
    }
  }

  const handleDelete = (project) => {
    setConfirmProject(project)
  }

  const confirmDeleteProject = async () => {
    if (!confirmProject) return

    try {
      await projectService.delete(confirmProject.id)
      toast.success('Project deleted successfully')
      fetchProjects()
    } catch (error) {
      toast.error(error.response?.data?.message || 'Failed to delete project')
    } finally {
      setConfirmProject(null)
    }
  }

  const handleUserToggle = (userId) => {
    setFormData(prev => ({
      ...prev,
      user_ids: prev.user_ids.includes(userId)
        ? prev.user_ids.filter(id => id !== userId)
        : [...prev.user_ids, userId]
    }))
  }

  const statusColors = {
    active: 'badge-success',
    completed: 'badge-info',
    on_hold: 'badge-warning',
    cancelled: 'badge-danger'
  }

  return (
    <div className="space-y-6 animate-fade-in">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-gray-900 dark:text-gray-100">Project Management</h1>
          <p className="text-gray-500 dark:text-gray-400 mt-1">Manage projects and assign responsible users</p>
        </div>
        <button onClick={() => openModal()} className="btn-primary flex items-center gap-2">
          <Plus className="w-4 h-4" />
          Add Project
        </button>
      </div>

      {/* Filters */}
      <div className="card p-4">
        <div className="flex flex-col sm:flex-row gap-4">
          <div className="flex-1 relative">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
            <input
              type="text"
              placeholder="Search projects..."
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              className="input pl-10"
            />
          </div>
          <div className="flex items-center gap-2">
            <Filter className="w-4 h-4 text-gray-400" />
            <Select
              value={statusFilter}
              onChange={(e) => setStatusFilter(e.target.value)}
              className="w-40"
            >
              <option value="">All Status</option>
              <option value="active">Active</option>
              <option value="completed">Completed</option>
              <option value="on_hold">On Hold</option>
              <option value="cancelled">Cancelled</option>
            </Select>
          </div>
        </div>
      </div>

      {/* Projects Grid */}
      {loading ? (
        <div className="flex items-center justify-center h-64">
          <Loader2 className="w-8 h-8 animate-spin text-hse-primary" />
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
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
                  <span className={`badge ${statusColors[project.status]}`}>
                    {project.status.replace('_', ' ')}
                  </span>
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
                        {new Date(project.start_date).toLocaleDateString()}
                        {project.end_date && ` - ${new Date(project.end_date).toLocaleDateString()}`}
                      </span>
                    </div>
                  )}
                  <div className="flex items-center gap-2 text-gray-500 dark:text-gray-400">
                    <Users className="w-4 h-4" />
                    <span>{project.users?.length || 0} assigned users</span>
                  </div>
                </div>

                <div className="flex items-center justify-between mt-4 pt-4 border-t border-gray-100 dark:border-gray-700">
                  <div className="flex -space-x-2">
                    {project.users?.slice(0, 3).map((user) => (
                      <div
                        key={user.id}
                        className="w-8 h-8 bg-hse-secondary rounded-full flex items-center justify-center border-2 border-white dark:border-gray-800"
                        title={user.name}
                      >
                        <span className="text-white text-xs font-medium">
                          {user.name.charAt(0)}
                        </span>
                      </div>
                    ))}
                    {project.users?.length > 3 && (
                      <div className="w-8 h-8 bg-gray-200 dark:bg-gray-600 rounded-full flex items-center justify-center border-2 border-white dark:border-gray-800">
                        <span className="text-gray-600 dark:text-gray-300 text-xs font-medium">
                          +{project.users.length - 3}
                        </span>
                      </div>
                    )}
                  </div>
                  <div className="flex items-center gap-1">
                    <Link
                      to={`/admin/projects/${project.id}`}
                      className="p-2 hover:bg-gray-100 dark:hover:bg-gray-700 rounded-lg"
                      title="View"
                    >
                      <Eye className="w-4 h-4 text-gray-600 dark:text-gray-400" />
                    </Link>
                    <button
                      onClick={() => openModal(project)}
                      className="p-2 hover:bg-gray-100 dark:hover:bg-gray-700 rounded-lg"
                      title="Edit"
                    >
                      <Edit className="w-4 h-4 text-gray-600 dark:text-gray-400" />
                    </button>
                    <button
                      onClick={() => handleDelete(project)}
                      className="p-2 hover:bg-gray-100 dark:hover:bg-gray-700 rounded-lg"
                      title="Delete"
                    >
                      <Trash2 className="w-4 h-4 text-red-600" />
                    </button>
                  </div>
                </div>
              </div>
            </div>
          ))}
        </div>
      )}

      {/* Pagination */}
      {pagination.last_page > 1 && (
        <div className="flex items-center justify-between">
          <p className="text-sm text-gray-500">
            Page {pagination.current_page} of {pagination.last_page}
          </p>
          <div className="flex gap-2">
            <button
              onClick={() => fetchProjects(pagination.current_page - 1)}
              disabled={pagination.current_page === 1}
              className="btn-secondary text-sm"
            >
              Previous
            </button>
            <button
              onClick={() => fetchProjects(pagination.current_page + 1)}
              disabled={pagination.current_page === pagination.last_page}
              className="btn-secondary text-sm"
            >
              Next
            </button>
          </div>
        </div>
      )}

      {/* Project Modal */}
      <Modal
        isOpen={modalOpen}
        onClose={closeModal}
        title={editingProject ? 'Modifier le projet' : 'Nouveau projet'}
        size="lg"
      >
        <form onSubmit={handleSubmit} className="space-y-4">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div>
              <label className="label">Nom du projet *</label>
              <input
                type="text"
                value={formData.name}
                onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                className="input"
                required
              />
            </div>
            <div>
              <label className="label">Code projet *</label>
              <input
                type="text"
                value={formData.code}
                onChange={(e) => setFormData({ ...formData, code: e.target.value.toUpperCase() })}
                className="input"
                required
                placeholder="ex: SGTM-001"
              />
            </div>
          </div>

          <div>
            <label className="label">Description</label>
            <textarea
              value={formData.description}
              onChange={(e) => setFormData({ ...formData, description: e.target.value })}
              className="input"
              rows={3}
            />
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div>
              <label className="label">Localisation</label>
              <input
                type="text"
                value={formData.location}
                onChange={(e) => setFormData({ ...formData, location: e.target.value })}
                className="input"
              />
            </div>
            <div>
              <label className="label">Nom du client</label>
              <input
                type="text"
                value={formData.client_name}
                onChange={(e) => setFormData({ ...formData, client_name: e.target.value })}
                className="input"
              />
            </div>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            <div>
              <label className="label">Date de début</label>
              <DatePicker
                value={formData.start_date}
                onChange={(val) => setFormData({ ...formData, start_date: val })}
              />
            </div>
            <div>
              <label className="label">Date de fin</label>
              <DatePicker
                value={formData.end_date}
                onChange={(val) => setFormData({ ...formData, end_date: val })}
              />
            </div>
            <div>
              <label className="label">Statut</label>
              <Select
                value={formData.status}
                onChange={(e) => setFormData({ ...formData, status: e.target.value })}
              >
                <option value="active">Actif</option>
                <option value="completed">Terminé</option>
                <option value="on_hold">En pause</option>
                <option value="cancelled">Annulé</option>
              </Select>
            </div>
          </div>

          <div>
            <label className="label">Budget</label>
            <input
              type="number"
              value={formData.budget}
              onChange={(e) => setFormData({ ...formData, budget: e.target.value })}
              className="input"
              placeholder="0.00"
              step="0.01"
            />
          </div>

          <div>
            <label className="label">Assigner des responsables</label>
            <div className="max-h-40 overflow-y-auto border border-gray-200 dark:border-gray-600 rounded-lg p-2 space-y-1 bg-white dark:bg-gray-700">
              {users.map((user) => (
                <label
                  key={user.id}
                  className="flex items-center gap-2 p-2 hover:bg-gray-50 dark:hover:bg-gray-600 rounded cursor-pointer"
                >
                  <input
                    type="checkbox"
                    checked={formData.user_ids.includes(user.id)}
                    onChange={() => handleUserToggle(user.id)}
                    className="w-4 h-4 text-hse-primary border-gray-300 dark:border-gray-500 rounded focus:ring-hse-primary"
                  />
                  <span className="text-sm text-gray-900 dark:text-gray-100">{user.name}</span>
                  <span className="text-xs text-gray-400">({user.email})</span>
                </label>
              ))}
            </div>
          </div>

          <div className="flex flex-col-reverse sm:flex-row justify-end gap-3 pt-4">
            <button type="button" onClick={closeModal} className="btn-secondary w-full sm:w-auto">
              Annuler
            </button>
            <button type="submit" disabled={saving} className="btn-primary w-full sm:w-auto">
              {saving ? (
                <span className="flex items-center justify-center gap-2">
                  <Loader2 className="w-4 h-4 animate-spin" />
                  Enregistrement...
                </span>
              ) : (
                editingProject ? 'Mettre à jour' : 'Créer le projet'
              )}
            </button>
          </div>
        </form>
      </Modal>

      <ConfirmDialog
        isOpen={!!confirmProject}
        title="Confirm deletion"
        message={
          confirmProject
            ? `Are you sure you want to delete ${confirmProject.name}?`
            : ''
        }
        confirmLabel="Delete"
        cancelLabel="Cancel"
        variant="danger"
        onConfirm={confirmDeleteProject}
        onCancel={() => setConfirmProject(null)}
      />
    </div>
  )
}
