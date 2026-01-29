import { useState, useEffect, useRef } from 'react'
import { Link } from 'react-router-dom'
import { projectService, userService } from '../../services/api'
import { Modal, DatePicker, ConfirmDialog, Select } from '../../components/ui'
import AutocompleteInput from '../../components/ui/AutocompleteInput'
import { useLanguage } from '../../i18n'
import { useAuthStore } from '../../store/authStore'
import ZonesManager from '../../components/zones/ZonesManager'
import {
  FolderKanban,
  Plus,
  Upload,
  Search,
  Filter,
  Edit,
  Trash2,
  X,
  Loader2,
  MapPin,
  Calendar,
  Users,
  Eye,
  Settings2
} from 'lucide-react'
import toast from 'react-hot-toast'

export default function ProjectManagement() {
  const { t } = useLanguage()
  const { user } = useAuthStore()
  const canManageZones =
    user?.role === 'admin' ||
    user?.role === 'responsable' ||
    user?.role === 'hse_manager' ||
    user?.role === 'works_director' ||
    user?.role === 'hse_director' ||
    user?.role === 'hr_director' ||
    user?.role === 'pole_director'
  const [projects, setProjects] = useState([])
  const [users, setUsers] = useState([])
  const [loading, setLoading] = useState(true)
  const [search, setSearch] = useState('')
  const [debouncedSearch, setDebouncedSearch] = useState('')
  const [statusFilter, setStatusFilter] = useState('')
  const [poleFilter, setPoleFilter] = useState('')
  const [modalOpen, setModalOpen] = useState(false)
  const [editingProject, setEditingProject] = useState(null)
  const [poleSuggestions, setPoleSuggestions] = useState([])
  const [bulkOpen, setBulkOpen] = useState(false)
  const [bulkFile, setBulkFile] = useState(null)
  const [bulkUploading, setBulkUploading] = useState(false)
  const bulkRef = useRef(null)
  const bulkInputRef = useRef(null)
  const [zonesModalOpen, setZonesModalOpen] = useState(false)
  const [selectedProjectForZones, setSelectedProjectForZones] = useState(null)
  const [formData, setFormData] = useState({
    name: '',
    code: '',
    description: '',
    location: '',
    start_date: '',
    end_date: '',
    status: 'active',
    pole: '',
    client_name: '',
    user_ids: []
  })
  const [saving, setSaving] = useState(false)
  const [pagination, setPagination] = useState({ current_page: 1, last_page: 1 })
  const [confirmProject, setConfirmProject] = useState(null)

  useEffect(() => {
    const id = setTimeout(() => {
      setDebouncedSearch(search.trim())
    }, 350)
    return () => clearTimeout(id)
  }, [search])

  useEffect(() => {
    fetchProjects(1, debouncedSearch)
  }, [debouncedSearch, statusFilter, poleFilter])

  useEffect(() => {
    fetchUsers()
  }, [])

  useEffect(() => {
    fetchPoleSuggestions()
  }, [])

  useEffect(() => {
    const handleClickOutside = (e) => {
      if (bulkRef.current && !bulkRef.current.contains(e.target)) {
        setBulkOpen(false)
      }
    }
    document.addEventListener('mousedown', handleClickOutside)
    return () => document.removeEventListener('mousedown', handleClickOutside)
  }, [])

  const fetchPoleSuggestions = async () => {
    try {
      const res = await projectService.getPoles()
      const values = res.data?.data?.poles ?? res.data?.poles ?? []
      setPoleSuggestions(Array.isArray(values) ? values : [])
    } catch (e) {
      setPoleSuggestions([])
    }
  }

  const openZonesManager = (project) => {
    setSelectedProjectForZones(project)
    setZonesModalOpen(true)
  }

  const extractFilename = (contentDisposition) => {
    if (!contentDisposition) return null
    const match = /filename\*=UTF-8''([^;]+)|filename="?([^";]+)"?/i.exec(contentDisposition)
    const value = decodeURIComponent(match?.[1] ?? match?.[2] ?? '')
    return value !== '' ? value : null
  }

  const downloadBlob = (blob, filename) => {
    const url = URL.createObjectURL(blob)
    const a = document.createElement('a')
    a.href = url
    a.download = filename ?? 'template.xlsx'
    document.body.appendChild(a)
    a.click()
    a.remove()
    setTimeout(() => URL.revokeObjectURL(url), 5000)
  }

  const handleDownloadTemplate = async () => {
    try {
      const res = await projectService.downloadTemplate()
      const filename = extractFilename(res.headers?.['content-disposition']) ?? 'SGTM-Projects-Template.xlsx'
      downloadBlob(res.data, filename)
    } catch (e) {
      toast.error(t('projects.bulk.downloadTemplateFailed'))
    }
  }

  const handleManagementExport = async () => {
    try {
      const year = new Date().getFullYear()
      const res = await projectService.managementExport({ year })
      const filename =
        extractFilename(res.headers?.['content-disposition']) ??
        `SGTM-Project-Management-Export_${year}.xlsx`
      downloadBlob(res.data, filename)
    } catch (e) {
      toast.error(t('errors.exportFailed'))
    }
  }

  const handleBulkImport = async () => {
    if (!bulkFile) {
      toast.error(t('projects.bulk.chooseFile'))
      return
    }

    try {
      setBulkUploading(true)
      const form = new FormData()
      form.append('file', bulkFile)
      const res = await projectService.bulkImport(form)
      const payload = res.data?.data ?? {}
      const imported = payload.imported ?? 0
      const updated = payload.updated ?? 0
      const errors = payload.errors ?? []
      const failedRowsUrl = payload.failed_rows_url
      toast.success(t('projects.bulk.importSummary', { imported, updated }))
      if (errors.length > 0) {
        toast.error(t('projects.bulk.importIssues', { count: errors.length }))
      }

      if (failedRowsUrl) {
        try {
          const r = await fetch(failedRowsUrl)
          const blob = await r.blob()
          downloadBlob(blob, 'projects_failed_rows.xlsx')
        } catch {
          // ignore
        }
      }
      setBulkFile(null)
      setBulkOpen(false)
      fetchProjects()
      fetchPoleSuggestions()
    } catch (e) {
      toast.error(e.response?.data?.message ?? t('projects.bulk.importFailed'))
    } finally {
      setBulkUploading(false)
    }
  }

  const fetchProjects = async (page = 1, searchOverride = search) => {
    try {
      setLoading(true)
      const response = await projectService.getAll({
        page,
        search: searchOverride,
        status: statusFilter,
        pole: poleFilter ? poleFilter : undefined,
        per_page: 10
      })
      setProjects(response.data.data ?? [])
      setPagination(response.data.meta ?? { current_page: 1, last_page: 1 })
    } catch (error) {
      toast.error(t('errors.failedToLoad'))
    } finally {
      setLoading(false)
    }
  }

  const fetchUsers = async () => {
    try {
      const response = await userService.getAll({ per_page: 100, role: 'responsable' })
      setUsers(response.data.data ?? [])
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
        description: project.description ?? '',
        location: project.location ?? '',
        start_date: project.start_date?.split('T')[0] ?? '',
        end_date: project.end_date?.split('T')[0] ?? '',
        status: project.status,
        pole: project.pole ?? '',
        client_name: project.client_name ?? '',
        user_ids: project.users?.map(u => u.id) ?? []
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
        pole: '',
        client_name: '',
        user_ids: []
      })
    }
    fetchPoleSuggestions()
    setModalOpen(true)
  }

  const closeModal = () => {
    setModalOpen(false)
    setEditingProject(null)
  }

  const buildProjectPayload = (data) => {
    const normalizedUserIds = Array.isArray(data.user_ids)
      ? data.user_ids.map((id) => Number(id)).filter((id) => Number.isFinite(id))
      : []

    const payload = {
      ...data,
      name: (data.name ?? '').trim(),
      code: (data.code ?? '').trim(),
      start_date: data.start_date ? data.start_date : null,
      end_date: data.end_date ? data.end_date : null,
      status: data.status ? data.status : 'active',
      pole: (data.pole ?? '').trim() || null,
      client_name: (data.client_name ?? '').trim() || null,
      location: (data.location ?? '').trim() || null,
      description: (data.description ?? '').trim() || null,
      user_ids: normalizedUserIds,
    }

    return payload
  }

  const getErrorMessage = (error) => {
    const responseData = error?.response?.data

    const candidates = [
      responseData?.errors,
      responseData?.data?.errors,
      responseData?.error?.errors,
    ]

    for (const errors of candidates) {
      if (errors && typeof errors === 'object') {
        const keys = Object.keys(errors)
        if (keys.length > 0) {
          const firstKey = keys[0]
          const firstValue = errors[firstKey]
          const firstMessage = Array.isArray(firstValue) ? firstValue[0] : firstValue
          if (typeof firstMessage === 'string' && firstMessage.trim() !== '') return firstMessage
        }
      }
    }

    const message = responseData?.message ?? responseData?.data?.message
    if (typeof message === 'string' && message.trim() !== '') return message
    return t('errors.failedToSave')
  }

  const handleSubmit = async (e) => {
    e.preventDefault()
    setSaving(true)

    try {
      const payload = buildProjectPayload(formData)
      if (editingProject) {
        await projectService.update(editingProject.id, payload)
        toast.success(t('projects.projectUpdated'))
      } else {
        await projectService.create(payload)
        toast.success(t('projects.projectCreated'))
      }
      closeModal()
      fetchProjects()
    } catch (error) {
      toast.error(getErrorMessage(error))
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
      toast.success(t('projects.projectDeleted'))
      fetchProjects()
    } catch (error) {
      toast.error(error.response?.data?.message ?? t('errors.failedToDelete'))
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

  const statusLabel = (status) => {
    const s = String(status || '').trim()
    if (!s) return ''
    const key = `projects.${s}`
    const value = t(key)
    return value === key ? s.replace(/_/g, ' ') : value
  }

  return (
    <div className="space-y-6 animate-fade-in">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-gray-900 dark:text-gray-100">{t('projects.projectList')}</h1>
          <p className="text-gray-500 dark:text-gray-400 mt-1">{t('projects.assignedUsers')}</p>
        </div>
        <div className="flex items-center gap-2">
          {user?.role === 'admin' && (
            <button
              type="button"
              onClick={handleManagementExport}
              className="btn-secondary flex items-center gap-2"
            >
              <FolderKanban className="w-4 h-4" />
              {t('common.export')}
            </button>
          )}
          <div ref={bulkRef} className="relative">
            <button
              type="button"
              onClick={() => setBulkOpen((v) => !v)}
              className="btn-secondary flex items-center gap-2"
            >
              <Upload className="w-4 h-4" />
              {t('common.import')}
            </button>
            {bulkOpen && (
              <div className="absolute right-0 mt-2 w-80 bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-xl shadow-xl p-4 z-50">
                <div className="space-y-3">
                  <button
                    type="button"
                    onClick={handleDownloadTemplate}
                    className="btn-secondary w-full"
                  >
                    {t('common.downloadTemplate')}
                  </button>

                  <div className="space-y-2">
                    <input
                      ref={bulkInputRef}
                      type="file"
                      accept=".xlsx,.xls"
                      onChange={(e) => setBulkFile(e.target.files?.[0] ?? null)}
                      className="hidden"
                    />

                    <button
                      type="button"
                      onClick={() => bulkInputRef.current?.click()}
                      className="w-full rounded-lg border border-dashed border-gray-300 dark:border-gray-600 px-3 py-3 text-left hover:bg-gray-50 dark:hover:bg-gray-700/50 transition"
                    >
                      <div className="flex items-center justify-between gap-3">
                        <div className="min-w-0">
                          <div className="text-sm font-semibold text-gray-900 dark:text-gray-100">
                            {t('common.chooseFile')}
                          </div>
                          <div className="text-xs text-gray-500 dark:text-gray-400 truncate">
                            {bulkFile ? bulkFile.name : `${t('common.chooseFile')} (.xlsx)`}
                          </div>
                        </div>
                        <div className="text-xs font-semibold px-2 py-1 rounded-md bg-orange-50 text-orange-700 dark:bg-orange-900/30 dark:text-orange-300">
                          {t('common.chooseFile')}
                        </div>
                      </div>
                    </button>

                    {bulkFile && (
                      <div className="flex items-center justify-between gap-3">
                        <div className="text-xs text-gray-600 dark:text-gray-300 truncate">
                          {t('common.selected')}: <span className="font-semibold">{bulkFile.name}</span>
                        </div>
                        <button
                          type="button"
                          onClick={() => {
                            setBulkFile(null)
                            if (bulkInputRef.current) bulkInputRef.current.value = ''
                          }}
                          className="text-xs font-semibold text-gray-500 hover:text-gray-900 dark:text-gray-400 dark:hover:text-gray-100"
                        >
                          {t('common.clear')}
                        </button>
                      </div>
                    )}
                  </div>

                  <button
                    type="button"
                    onClick={handleBulkImport}
                    disabled={bulkUploading || !bulkFile}
                    className="btn-primary w-full"
                  >
                    {bulkUploading ? (
                      <span className="flex items-center justify-center gap-2">
                        <Loader2 className="w-4 h-4 animate-spin" />
                        {t('common.loading')}
                      </span>
                    ) : (
                      t('common.upload')
                    )}
                  </button>
                </div>
              </div>
            )}
          </div>

          <button onClick={() => openModal()} className="btn-primary flex items-center gap-2">
            <Plus className="w-4 h-4" />
            {t('projects.newProject')}
          </button>
        </div>
      </div>

      {/* Filters */}
      <div className="card p-4">
        <div className="flex flex-col sm:flex-row gap-4">
          <div className="flex-1 relative">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
            <input
              type="text"
              placeholder={t('common.search')}
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              className="input pl-10"
            />
          </div>
          <div className="flex flex-col sm:flex-row sm:flex-wrap sm:items-center gap-2">
            <Filter className="hidden sm:block w-4 h-4 text-gray-400" />
            <Select
              value={statusFilter}
              onChange={(e) => setStatusFilter(e.target.value)}
              className="w-full sm:w-40"
            >
              <option value="">{t('common.all')}</option>
              <option value="active">{statusLabel('active')}</option>
              <option value="completed">{statusLabel('completed')}</option>
              <option value="on_hold">{statusLabel('on_hold')}</option>
              <option value="cancelled">{statusLabel('cancelled')}</option>
            </Select>
            <Select
              value={poleFilter}
              onChange={(e) => setPoleFilter(e.target.value)}
              className="w-full sm:w-40"
            >
              <option value="">{t('common.allPoles')}</option>
              {poleSuggestions.map((p) => (
                <option key={p} value={p}>{p}</option>
              ))}
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
                  <div className="flex flex-col items-end gap-1">
                    <span className={`badge ${statusColors[project.status]}`}>
                      {statusLabel(project.status)}
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
                        {new Date(project.start_date).toLocaleDateString()}
                        {project.end_date && ` - ${new Date(project.end_date).toLocaleDateString()}`}
                      </span>
                    </div>
                  )}
                  <div className="flex items-center gap-2 text-gray-500 dark:text-gray-400">
                    <Users className="w-4 h-4" />
                    <span>{project.users?.length ?? 0} {t('projects.assignedUsers')}</span>
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
                      title={t('common.view')}
                    >
                      <Eye className="w-4 h-4 text-gray-600 dark:text-gray-400" />
                    </Link>
                    {canManageZones && (
                      <button
                        type="button"
                        onClick={() => openZonesManager(project)}
                        className="p-2 hover:bg-amber-50 dark:hover:bg-amber-900/20 rounded-lg"
                        title={t('projects.manageZones')}
                      >
                        <Settings2 className="w-4 h-4 text-amber-600 dark:text-amber-400" />
                      </button>
                    )}
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
            <label className="label">Pole</label>
            <AutocompleteInput
              value={formData.pole}
              onChange={(value) => setFormData({ ...formData, pole: value })}
              suggestions={poleSuggestions}
              placeholder="Pole..."
              className="w-full"
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
        title="Confirm"
        message={confirmProject ? `Are you sure you want to delete ${confirmProject.name}?` : ''}
        confirmLabel="Delete"
        cancelLabel="Cancel"
        variant="danger"
        onConfirm={confirmDeleteProject}
        onCancel={() => setConfirmProject(null)}
      />

      <ZonesManager
        projectId={selectedProjectForZones?.id}
        projectName={selectedProjectForZones?.name}
        isOpen={zonesModalOpen}
        onClose={() => {
          setZonesModalOpen(false)
          setSelectedProjectForZones(null)
        }}
      />
    </div>
  )
 }
