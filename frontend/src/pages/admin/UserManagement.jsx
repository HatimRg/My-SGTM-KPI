import { useState, useEffect, useMemo, useRef } from 'react'
import { userService, projectService } from '../../services/api'
import { useLanguage } from '../../i18n'
import { useAuthStore } from '../../store/authStore'
import { Modal, ConfirmDialog, Select, PasswordStrength, getPasswordPolicy, checkPasswordAgainstPolicy } from '../../components/ui'
import { getProjectLabel, sortProjects } from '../../utils/projectList'
import {
  Users,
  Plus,
  Upload,
  Search,
  Filter,
  MoreVertical,
  Edit,
  Trash2,
  UserCheck,
  UserX,
  X,
  Loader2,
  Mail,
  Phone,
  Shield,
  FolderKanban
} from 'lucide-react'
import toast from 'react-hot-toast'

export default function UserManagement() {
  const { t } = useLanguage()
  const { user } = useAuthStore()
  const [users, setUsers] = useState([])
  const [projects, setProjects] = useState([])
  const [loading, setLoading] = useState(true)
  const [search, setSearch] = useState('')
  const [roleFilter, setRoleFilter] = useState('')
  const [projectFilter, setProjectFilter] = useState('')
  const [poleFilter, setPoleFilter] = useState('')
  const [poles, setPoles] = useState([])
  const [modalOpen, setModalOpen] = useState(false)
  const [editingUser, setEditingUser] = useState(null)
  const [formData, setFormData] = useState({
    name: '',
    email: '',
    password: '',
    role: 'hse_manager',
    pole: '',
    phone: '',
    project_ids: []
  })
  const [saving, setSaving] = useState(false)
  const [pagination, setPagination] = useState({ current_page: 1, last_page: 1 })
  const [confirmUser, setConfirmUser] = useState(null)

  const [bulkOpen, setBulkOpen] = useState(false)
  const [bulkFile, setBulkFile] = useState(null)
  const [bulkUploading, setBulkUploading] = useState(false)
  const bulkRef = useRef(null)
  const bulkInputRef = useRef(null)

  const projectListPreference = user?.project_list_preference ?? 'code'
  const sortedProjects = useMemo(() => {
    return sortProjects(projects, projectListPreference)
  }, [projects, projectListPreference])

  const passwordPolicy = useMemo(() => getPasswordPolicy(formData.role), [formData.role])

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
    return t('users.saveError')
  }

  const buildUserPayload = (data, isEdit) => {
    const normalizedProjectIds = Array.isArray(data.project_ids)
      ? data.project_ids.map((id) => Number(id)).filter((id) => Number.isFinite(id))
      : []

    const isPoleScopedRole = data.role === 'pole_director' || data.role === 'regional_hse_manager'

    const payload = {
      ...data,
      name: (data.name ?? '').trim(),
      email: (data.email ?? '').trim(),
      phone: (data.phone ?? '').trim() || null,
      pole: isPoleScopedRole ? ((data.pole ?? '').trim() || null) : null,
      project_ids: isPoleScopedRole ? [] : normalizedProjectIds,
    }

    if (isEdit && !payload.password) {
      delete payload.password
    }

    return payload
  }

  useEffect(() => {
    fetchUsers()
    fetchProjects()
  }, [search, roleFilter, projectFilter, poleFilter])

  useEffect(() => {
    const fetchPoles = async () => {
      try {
        const res = await projectService.getPoles()
        const values = res.data?.data?.poles ?? res.data?.poles ?? []
        setPoles(Array.isArray(values) ? values : [])
      } catch (e) {
        setPoles([])
      }
    }
    fetchPoles()
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
      const res = await userService.downloadTemplate()
      const filename = extractFilename(res.headers?.['content-disposition']) ?? 'SGTM-Users-Template.xlsx'
      downloadBlob(res.data, filename)
    } catch (e) {
      toast.error(t('users.bulk.downloadTemplateFailed'))
    }
  }

  const handleBulkImport = async () => {
    if (!bulkFile) {
      toast.error(t('users.bulk.chooseFile'))
      return
    }

    try {
      setBulkUploading(true)
      const form = new FormData()
      form.append('file', bulkFile)
      const res = await userService.bulkImport(form)
      const payload = res.data?.data ?? {}
      const imported = payload.imported ?? 0
      const updated = payload.updated ?? 0
      const errors = payload.errors ?? []
      toast.success(t('users.bulk.importSummary', { imported, updated }))
      if (errors.length > 0) toast.error(t('users.bulk.importIssues', { count: errors.length }))
      setBulkFile(null)
      setBulkOpen(false)
      fetchUsers()
    } catch (e) {
      toast.error(e.response?.data?.message ?? t('users.bulk.importFailed'))
    } finally {
      setBulkUploading(false)
    }
  }

  const fetchUsers = async (page = 1) => {
    try {
      setLoading(true)
      const response = await userService.getAll({
        page,
        search,
        role: roleFilter,
        project_id: projectFilter,
        pole: poleFilter,
        per_page: 10
      })
      setUsers(response.data.data ?? [])
      setPagination(response.data.meta ?? { current_page: 1, last_page: 1 })
    } catch (error) {
      toast.error(t('users.loadError'))
    } finally {
      setLoading(false)
    }
  }

  const fetchProjects = async () => {
    try {
      const list = await projectService.getAllList({ status: 'active' })
      setProjects(list)
    } catch (error) {
      console.error('Failed to load projects')
    }
  }

  const openModal = (user = null) => {
    if (user) {
      setEditingUser(user)
      setFormData({
        name: user.name,
        email: user.email,
        password: '',
        role: user.role,
        pole: user.pole ?? '',
        phone: user.phone ?? '',
        project_ids: (user.role === 'pole_director' || user.role === 'regional_hse_manager') ? [] : (user.projects?.map(p => p.id) ?? [])
      })
    } else {
      setEditingUser(null)
      setFormData({
        name: '',
        email: '',
        password: '',
        role: 'hse_manager',
        pole: '',
        phone: '',
        project_ids: []
      })
    }
    setModalOpen(true)
  }

  const closeModal = () => {
    setModalOpen(false)
    setEditingUser(null)
  }

  const handleSubmit = async (e) => {
    e.preventDefault()

    const payload = buildUserPayload(formData, !!editingUser)
    if (payload.password) {
      if (!checkPasswordAgainstPolicy(payload.password, passwordPolicy).ok) {
        toast.error(t('auth.passwordPolicy.invalid'))
        return
      }
    }

    setSaving(true)

    try {
      if (editingUser) {
        await userService.update(editingUser.id, payload)
        toast.success(t('users.updateSuccess'))
      } else {
        await userService.create(payload)
        toast.success(t('users.createSuccess'))
      }
      closeModal()
      fetchUsers()
    } catch (error) {
      toast.error(getErrorMessage(error))
    } finally {
      setSaving(false)
    }
  }

  const handleDelete = (user) => {
    setConfirmUser(user)
  }

  const confirmDeleteUser = async () => {
    if (!confirmUser) return

    try {
      await userService.delete(confirmUser.id)
      toast.success(t('users.deleteSuccess'))
      fetchUsers()
    } catch (error) {
      toast.error(error.response?.data?.message ?? t('users.deleteError'))
    } finally {
      setConfirmUser(null)
    }
  }

  const handleToggleStatus = async (user) => {
    try {
      await userService.toggleStatus(user.id)
      toast.success(user.is_active ? t('users.deactivateSuccess') : t('users.activateSuccess'))
      fetchUsers()
    } catch (error) {
      toast.error(error.response?.data?.message ?? t('users.statusError'))
    }
  }

  const handleProjectToggle = (projectId) => {
    setFormData(prev => ({
      ...prev,
      project_ids: prev.project_ids.includes(projectId)
        ? prev.project_ids.filter(id => id !== projectId)
        : [...prev.project_ids, projectId]
    }))
  }

  return (
    <div className="space-y-6 animate-fade-in">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-gray-900 dark:text-gray-100">{t('users.title')}</h1>
          <p className="text-gray-500 dark:text-gray-400 mt-1">{t('users.subtitle')}</p>
        </div>
        <div className="flex items-center gap-2">
          <div ref={bulkRef} className="relative">
            <button
              type="button"
              onClick={() => setBulkOpen((v) => !v)}
              className="btn-secondary flex items-center gap-2"
            >
              <Upload className="w-4 h-4" />
              Massive Add
            </button>
            {bulkOpen && (
              <div className="absolute right-0 mt-2 w-80 bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-xl shadow-xl p-4 z-50">
                <div className="space-y-3">
                  <button
                    type="button"
                    onClick={handleDownloadTemplate}
                    className="btn-secondary w-full"
                  >
                    Download Template
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
                            Select XLSX file
                          </div>
                          <div className="text-xs text-gray-500 dark:text-gray-400 truncate">
                            {bulkFile ? bulkFile.name : 'Choose the filled template (.xlsx)'}
                          </div>
                        </div>
                        <div className="text-xs font-semibold px-2 py-1 rounded-md bg-orange-50 text-orange-700 dark:bg-orange-900/30 dark:text-orange-300">
                          Browse
                        </div>
                      </div>
                    </button>

                    {bulkFile && (
                      <div className="flex items-center justify-between gap-3">
                        <div className="text-xs text-gray-600 dark:text-gray-300 truncate">
                          Selected: <span className="font-semibold">{bulkFile.name}</span>
                        </div>
                        <button
                          type="button"
                          onClick={() => {
                            setBulkFile(null)
                            if (bulkInputRef.current) bulkInputRef.current.value = ''
                          }}
                          className="text-xs font-semibold text-gray-500 hover:text-gray-900 dark:text-gray-400 dark:hover:text-gray-100"
                        >
                          Clear
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
                        Uploading...
                      </span>
                    ) : (
                      'Upload'
                    )}
                  </button>
                </div>
              </div>
            )}
          </div>

          <button onClick={() => openModal()} className="btn-primary flex items-center gap-2">
            <Plus className="w-4 h-4" />
            {t('users.addUser')}
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
              placeholder={t('users.searchPlaceholder')}
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              className="input pl-10"
            />
          </div>
          <div className="flex flex-col sm:flex-row sm:flex-wrap sm:items-center gap-2">
            <Filter className="hidden sm:block w-4 h-4 text-gray-400" />
            <Select
              value={poleFilter}
              onChange={(e) => {
                setPoleFilter(e.target.value)
                setProjectFilter('')
              }}
              className="w-full sm:w-40"
            >
              <option value="">{t('common.allPoles')}</option>
              {poles.map((p) => (
                <option key={p} value={p}>
                  {p}
                </option>
              ))}
            </Select>
            <Select
              value={projectFilter}
              onChange={(e) => setProjectFilter(e.target.value)}
              className="w-full sm:w-44"
            >
              <option value="">{t('common.allProjects')}</option>
              {(poleFilter ? sortedProjects.filter((p) => p?.pole === poleFilter) : sortedProjects).map((project) => (
                <option key={project.id} value={project.id}>
                  {getProjectLabel(project)}
                </option>
              ))}
            </Select>
            <Select
              value={roleFilter}
              onChange={(e) => setRoleFilter(e.target.value)}
              className="w-full sm:w-40"
            >
              <option value="">{t('users.allRoles')}</option>
              <option value="admin">{t('users.roles.admin')}</option>
              <option value="consultation">{t('users.roles.consultation')}</option>
              <option value="pole_director">{t('users.roles.pole_director')}</option>
              <option value="works_director">{t('users.roles.works_director')}</option>
              <option value="hse_director">{t('users.roles.hse_director')}</option>
              <option value="hr_director">{t('users.roles.hr_director')}</option>
              <option value="hse_manager">{t('users.roles.hse_manager')}</option>
              <option value="regional_hse_manager">{t('users.roles.regional_hse_manager')}</option>
              <option value="responsable">{t('users.roles.responsable')}</option>
              <option value="supervisor">{t('users.roles.supervisor')}</option>
              <option value="user">{t('users.roles.user')}</option>
              <option value="hr">{t('users.roles.hr')}</option>
            </Select>
          </div>
        </div>
      </div>

      {/* Users Table */}
      <div className="card">
        {loading ? (
          <div className="p-4 space-y-3">
            <div className="hidden md:block space-y-2 animate-pulse">
              {Array.from({ length: 6 }, (_, i) => (
                <div
                  key={i}
                  className="h-12 rounded-md bg-gray-100 dark:bg-gray-800"
                />
              ))}
            </div>
            <div className="md:hidden space-y-3 animate-pulse">
              {Array.from({ length: 4 }, (_, i) => (
                <div
                  key={i}
                  className="h-20 rounded-lg bg-gray-100 dark:bg-gray-800"
                />
              ))}
            </div>
          </div>
        ) : (
          <>
            {/* Mobile cards */}
            <div className="space-y-3 md:hidden">
              {users.map((user) => (
                <div
                  key={user.id}
                  className="border border-gray-200 dark:border-gray-700 rounded-lg p-3 bg-white dark:bg-gray-800"
                >
                  <div className="flex items-start justify-between gap-3">
                    <div className="flex items-center gap-3">
                      <div className="w-10 h-10 bg-hse-primary rounded-full flex items-center justify-center">
                        <span className="text-white font-semibold">
                          {user.name.charAt(0).toUpperCase()}
                        </span>
                      </div>
                      <div>
                        <p className="font-medium text-gray-900 dark:text-gray-100">{user.name}</p>
                        <p className="text-xs text-gray-500 dark:text-gray-400">{user.email}</p>
                      </div>
                    </div>
                    <div className="flex flex-col items-end gap-1 text-xs">
                      <span className={`badge ${user.role === 'admin' ? 'badge-info' : 'badge-success'}`}>
                        {user.role}
                      </span>
                      <span className={`badge ${user.is_active ? 'badge-success' : 'badge-danger'}`}>
                        {user.is_active ? t('users.status.active') : t('users.status.inactive')}
                      </span>
                    </div>
                  </div>

                  <div className="mt-3 flex items-center justify-between text-[11px] text-gray-600 dark:text-gray-300">
                    <div className="flex items-center gap-1">
                      <FolderKanban className="w-3 h-3 text-gray-400 dark:text-gray-500" />
                      <span>{user.projects?.length ?? 0}</span>
                    </div>
                    <div className="flex items-center gap-1">
                      <button
                        onClick={() => openModal(user)}
                        className="p-1.5 rounded-md hover:bg-gray-100 dark:hover:bg-gray-700"
                        title={t('common.edit')}
                      >
                        <Edit className="w-4 h-4 text-gray-600 dark:text-gray-200" />
                      </button>
                      <button
                        onClick={() => handleToggleStatus(user)}
                        className="p-1.5 rounded-md hover:bg-gray-100 dark:hover:bg-gray-700"
                        title={user.is_active ? t('users.deactivate') : t('users.activate')}
                      >
                        {user.is_active ? (
                          <UserX className="w-4 h-4 text-amber-600" />
                        ) : (
                          <UserCheck className="w-4 h-4 text-green-600" />
                        )}
                      </button>
                      <button
                        onClick={() => handleDelete(user)}
                        className="p-1.5 rounded-md hover:bg-red-50 dark:hover:bg-red-900/30"
                        title={t('common.delete')}
                      >
                        <Trash2 className="w-4 h-4 text-red-600" />
                      </button>
                    </div>
                  </div>
                </div>
              ))}
            </div>

            {/* Desktop table */}
            <div className="hidden md:block overflow-x-auto">
              <table className="table">
                <thead>
                  <tr>
                    <th>{t('users.table.user')}</th>
                    <th>{t('users.table.role')}</th>
                    <th>{t('users.table.projects')}</th>
                    <th>{t('users.table.status')}</th>
                    <th>{t('users.table.actions')}</th>
                  </tr>
                </thead>
                <tbody>
                  {users.map((user) => (
                    <tr key={user.id}>
                      <td>
                        <div className="flex items-center gap-3">
                          <div className="w-10 h-10 bg-hse-primary rounded-full flex items-center justify-center">
                            <span className="text-white font-semibold">
                              {user.name.charAt(0).toUpperCase()}
                            </span>
                          </div>
                          <div>
                            <p className="font-medium text-gray-900 dark:text-gray-100">{user.name}</p>
                            <p className="text-sm text-gray-500 dark:text-gray-400">{user.email}</p>
                          </div>
                        </div>
                      </td>
                      <td>
                        <span className={`badge ${user.role === 'admin' ? 'badge-info' : 'badge-success'}`}>
                          {user.role}
                        </span>
                      </td>
                      <td>
                        <div className="flex items-center gap-1">
                          <FolderKanban className="w-4 h-4 text-gray-400 dark:text-gray-500" />
                          <span className="text-gray-700 dark:text-gray-300">{user.projects?.length ?? 0}</span>
                        </div>
                      </td>
                      <td>
                        <span className={`badge ${user.is_active ? 'badge-success' : 'badge-danger'}`}>
                          {user.is_active ? t('users.status.active') : t('users.status.inactive')}
                        </span>
                      </td>
                      <td>
                        <div className="flex items-center gap-2">
                          <button
                            onClick={() => openModal(user)}
                            className="p-2 hover:bg-gray-100 rounded-lg"
                            title={t('common.edit')}
                          >
                            <Edit className="w-4 h-4 text-gray-600" />
                          </button>
                          <button
                            onClick={() => handleToggleStatus(user)}
                            className="p-2 hover:bg-gray-100 rounded-lg"
                            title={user.is_active ? t('users.deactivate') : t('users.activate')}
                          >
                            {user.is_active ? (
                              <UserX className="w-4 h-4 text-amber-600" />
                            ) : (
                              <UserCheck className="w-4 h-4 text-green-600" />
                            )}
                          </button>
                          <button
                            onClick={() => handleDelete(user)}
                            className="p-2 hover:bg-gray-100 rounded-lg"
                            title={t('common.delete')}
                          >
                            <Trash2 className="w-4 h-4 text-red-600" />
                          </button>
                        </div>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </>
        )}

        {/* Pagination */}
        {pagination.last_page > 1 && (
          <div className="flex items-center justify-between p-4 border-t border-gray-100">
            <p className="text-sm text-gray-500">
              {t('common.page')} {pagination.current_page} {t('common.of')} {pagination.last_page}
            </p>
            <div className="flex gap-2">
              <button
                onClick={() => fetchUsers(pagination.current_page - 1)}
                disabled={pagination.current_page === 1}
                className="btn-secondary text-sm"
              >
                {t('common.previous')}
              </button>
              <button
                onClick={() => fetchUsers(pagination.current_page + 1)}
                disabled={pagination.current_page === pagination.last_page}
                className="btn-secondary text-sm"
              >
                {t('common.next')}
              </button>
            </div>
          </div>
        )}
      </div>

      {/* User Modal */}
      <Modal
        isOpen={modalOpen}
        onClose={closeModal}
        title={editingUser ? t('users.editUser') : t('users.createUser')}
        size="md"
      >
        <form onSubmit={handleSubmit} className="space-y-4">
          <div>
            <label className="label">{t('users.form.fullName')}</label>
            <input
              type="text"
              value={formData.name}
              onChange={(e) => setFormData({ ...formData, name: e.target.value })}
              className="input"
              required
            />
          </div>

          <div>
            <label className="label">{t('users.form.email')}</label>
            <input
              type="email"
              value={formData.email}
              onChange={(e) => setFormData({ ...formData, email: e.target.value })}
              className="input"
              required
            />
          </div>

          <div>
            <label className="label">
              {t('users.form.password')} {editingUser && `(${t('users.form.passwordHint')})`}
            </label>
            <input
              type="password"
              value={formData.password}
              onChange={(e) => setFormData({ ...formData, password: e.target.value })}
              className="input"
              {...(!editingUser && { required: true })}
              minLength={passwordPolicy.minLength}
            />
            <PasswordStrength password={formData.password} role={formData.role} />
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div>
              <label className="label">{t('users.form.role')}</label>
              <Select
                value={formData.role}
                onChange={(e) => {
                  const nextRole = e.target.value
                  const nextRoleIsPoleScoped = nextRole === 'pole_director' || nextRole === 'regional_hse_manager'
                  setFormData((prev) => ({
                    ...prev,
                    role: nextRole,
                    pole: nextRoleIsPoleScoped ? prev.pole : '',
                    project_ids: nextRoleIsPoleScoped ? [] : prev.project_ids,
                  }))
                }}
              >
                <>
                  <option value="hse_manager">{t('users.roles.hse_manager')}</option>
                  <option value="regional_hse_manager">{t('users.roles.regional_hse_manager')}</option>
                  <option value="responsable">{t('users.roles.responsable')}</option>
                  <option value="supervisor">{t('users.roles.supervisor')}</option>
                  <option value="user">{t('users.roles.user')}</option>
                  <option value="hr">{t('users.roles.hr')}</option>
                  <option value="admin">{t('users.roles.admin')}</option>
                  <option value="consultation">{t('users.roles.consultation')}</option>
                  <option value="pole_director">{t('users.roles.pole_director')}</option>
                  <option value="works_director">{t('users.roles.works_director')}</option>
                  <option value="hse_director">{t('users.roles.hse_director')}</option>
                  <option value="hr_director">{t('users.roles.hr_director')}</option>
                </>
              </Select>
            </div>
            <div>
              <label className="label">{t('users.form.phone')}</label>
              <input
                type="tel"
                value={formData.phone}
                onChange={(e) => setFormData({ ...formData, phone: e.target.value })}
                className="input"
              />
            </div>
          </div>

          {(formData.role === 'pole_director' || formData.role === 'regional_hse_manager') && (
            <div>
              <label className="label">{t('users.form.pole')}</label>
              <Select
                value={formData.pole}
                onChange={(e) => setFormData({ ...formData, pole: e.target.value })}
                required
              >
                <option value="">{t('users.form.selectPole')}</option>
                {poles.map((p) => (
                  <option key={p} value={p}>
                    {p}
                  </option>
                ))}
              </Select>
            </div>
          )}

          {formData.role !== 'pole_director' && formData.role !== 'regional_hse_manager' && (
            <div>
              <label className="label">{t('users.form.assignProjects')}</label>
              <div className="max-h-40 overflow-y-auto border border-gray-200 dark:border-gray-600 rounded-lg p-2 space-y-1 bg-white dark:bg-gray-700">
                {sortedProjects.map((project) => (
                  <label
                    key={project.id}
                    className="flex items-center gap-2 p-2 hover:bg-gray-50 dark:hover:bg-gray-600 rounded cursor-pointer"
                  >
                    <input
                      type="checkbox"
                      checked={formData.project_ids.includes(project.id)}
                      onChange={() => handleProjectToggle(project.id)}
                      className="w-4 h-4 text-hse-primary border-gray-300 dark:border-gray-500 rounded focus:ring-hse-primary"
                    />
                    <span className="text-sm text-gray-900 dark:text-gray-100">{getProjectLabel(project)}</span>
                  </label>
                ))}
              </div>
            </div>
          )}

          <div className="flex flex-col-reverse sm:flex-row justify-end gap-3 pt-4">
            <button type="button" onClick={closeModal} className="btn-secondary w-full sm:w-auto">
              {t('common.cancel')}
            </button>
            <button type="submit" disabled={saving} className="btn-primary w-full sm:w-auto">
              {saving ? (
                <span className="flex items-center justify-center gap-2">
                  <Loader2 className="w-4 h-4 animate-spin" />
                  {t('common.saving')}
                </span>
              ) : (
                editingUser ? t('users.updateUser') : t('users.createUserBtn')
              )}
            </button>
          </div>
        </form>
      </Modal>

      <ConfirmDialog
        isOpen={!!confirmUser}
        title={t('common.confirm')}
        message={
          confirmUser
            ? t('users.deleteConfirm', { name: confirmUser.name })
            : ''
        }
        confirmLabel={t('common.delete')}
        cancelLabel={t('common.cancel')}
        variant="danger"
        onConfirm={confirmDeleteUser}
        onCancel={() => setConfirmUser(null)}
      />
    </div>
  )
}
