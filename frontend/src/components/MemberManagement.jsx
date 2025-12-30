import { useState, useEffect, useRef } from 'react'
import { projectService } from '../services/api'
import { useLanguage } from '../i18n'
import { useAuthStore } from '../store/authStore'
import ConfirmDialog from './ui/ConfirmDialog'
import Select from './ui/Select'
import PasswordStrength, { checkPasswordAgainstPolicy, getPasswordPolicy } from './ui/PasswordStrength'
import {
  Users,
  UserPlus,
  Upload,
  UserMinus,
  Edit2,
  Loader2,
  X,
  Search,
  Phone,
  Mail,
  CreditCard,
  Check,
  ChevronDown
} from 'lucide-react'
import toast from 'react-hot-toast'

export default function MemberManagement({ projectId, projectName }) {
  const { t } = useLanguage()
  const { user: currentUser } = useAuthStore()

  const creatableRoles =
    currentUser?.role === 'hse_manager'
      ? ['responsable', 'supervisor', 'user']
      : currentUser?.role === 'responsable'
        ? ['supervisor', 'user']
        : ['supervisor']
  
  // Combined members list
  const [allMembers, setAllMembers] = useState([])
  const [loading, setLoading] = useState(true)
  const [searchTerm, setSearchTerm] = useState('')
  
  // Create/Edit modal
  const [showCreateModal, setShowCreateModal] = useState(false)
  const [editingMember, setEditingMember] = useState(null)
  const [saving, setSaving] = useState(false)
  
  // Add existing HSE Officers modal
  const [showAddModal, setShowAddModal] = useState(false)
  const [availableOfficers, setAvailableOfficers] = useState([])
  const [selectedOfficers, setSelectedOfficers] = useState([])
  const [addingMembers, setAddingMembers] = useState(false)
  const [addSearchTerm, setAddSearchTerm] = useState('')
  
  // Dropdown for add options
  const [showAddDropdown, setShowAddDropdown] = useState(false)

  const [bulkOpen, setBulkOpen] = useState(false)
  const [bulkFile, setBulkFile] = useState(null)
  const [bulkUploading, setBulkUploading] = useState(false)
  const bulkRef = useRef(null)
  const bulkInputRef = useRef(null)
  
  const [formData, setFormData] = useState({
    name: '',
    email: '',
    cin: '',
    role: 'supervisor',
    phone: '',
    password: '',
  })

  const [confirmMember, setConfirmMember] = useState(null)

  useEffect(() => {
    fetchAllMembers()
  }, [projectId])

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

  const handleDownloadTeamTemplate = async () => {
    try {
      const res = await projectService.downloadTeamTemplate(projectId)
      const filename = extractFilename(res.headers?.['content-disposition']) ?? `SGTM-Project-Team-Template-${projectId}.xlsx`
      downloadBlob(res.data, filename)
    } catch (e) {
      toast.error(e.response?.data?.message ?? t('errors.somethingWentWrong'))
    }
  }

  const handleBulkImportTeam = async () => {
    if (!bulkFile) {
      toast.error('Please choose a file')
      return
    }
    try {
      setBulkUploading(true)
      const form = new FormData()
      form.append('file', bulkFile)
      const res = await projectService.importTeam(projectId, form)
      const payload = res.data?.data ?? {}
      const added = payload.added_count ?? 0
      const errors = payload.errors ?? []
      toast.success(`Added: ${added}`)
      if (errors.length > 0) toast.error(`${errors.length} row(s) had issues`)
      setBulkFile(null)
      setBulkOpen(false)
      fetchAllMembers()
    } catch (e) {
      toast.error(e.response?.data?.message ?? t('errors.somethingWentWrong'))
    } finally {
      setBulkUploading(false)
    }
  }

  const fetchAllMembers = async () => {
    try {
      setLoading(true)
      const [manageable, team] = await Promise.all([
        projectService.getMembers(projectId).catch(() => ({ data: { data: [] } })),
        projectService.getTeam(projectId).catch(() => ({ data: { data: [] } }))
      ])
      
      // Combine both lists, avoiding duplicates
      const manageableData = manageable.data.data ?? []
      const teamData = team.data.data ?? []
      
      const memberMap = new Map()
      
      // Add manageable members (responsable, supervisor, animateur)
      manageableData.forEach(m => {
        memberMap.set(m.id, { ...m, canEdit: true, canRemove: true })
      })
      
      // Add team members (HSE Officers) - mark as team member
      teamData.forEach(m => {
        if (!memberMap.has(m.id)) {
          memberMap.set(m.id, { ...m, isTeamMember: true, canEdit: false, canRemove: true })
        }
      })
      
      setAllMembers(Array.from(memberMap.values()))
    } catch (error) {
      console.error('Failed to load members:', error)
    } finally {
      setLoading(false)
    }
  }

  const fetchAvailableOfficers = async () => {
    try {
      const res = await projectService.getAvailableOfficers(projectId)
      setAvailableOfficers(res.data.data ?? [])
    } catch (error) {
      console.error('Failed to load available officers:', error)
    }
  }

  // Open create modal for new member
  const handleOpenCreateModal = (member = null) => {
    setShowAddDropdown(false)
    if (member && member.canEdit) {
      setEditingMember(member)
      setFormData({
        name: member.name,
        email: member.email,
        cin: member.cin ?? '',
        role: member.role,
        phone: member.phone ?? '',
        password: '',
      })
    } else {
      setEditingMember(null)
      setFormData({
        name: '',
        email: '',
        cin: '',
        role: creatableRoles[0] ?? 'supervisor',
        phone: '',
        password: '',
      })
    }
    setShowCreateModal(true)
  }

  // Open add existing users modal
  const handleOpenAddModal = async () => {
    setShowAddDropdown(false)
    setSelectedOfficers([])
    setAddSearchTerm('')
    await fetchAvailableOfficers()
    setShowAddModal(true)
  }

  const handleCloseCreateModal = () => {
    setShowCreateModal(false)
    setEditingMember(null)
    setFormData({ name: '', email: '', cin: '', role: creatableRoles[0] ?? 'supervisor', phone: '', password: '' })
  }

  const handleSubmitCreate = async (e) => {
    e.preventDefault()

    if (formData.password) {
      const policy = getPasswordPolicy(formData.role)
      if (!checkPasswordAgainstPolicy(formData.password, policy).ok) {
        toast.error(t('auth.passwordPolicy.invalid'))
        return
      }
    }

    setSaving(true)

    try {
      if (editingMember) {
        await projectService.updateMember(projectId, editingMember.id, formData)
        toast.success(t('members.updateSuccess'))
      } else {
        const res = await projectService.createMember(projectId, formData)
        if (res.data.data?.merged) {
          toast.success(t('members.createMerged'))
        } else {
          toast.success(t('members.createSuccess'))
        }
      }
      handleCloseCreateModal()
      fetchAllMembers()
    } catch (error) {
      toast.error(error.response?.data?.message ?? t('errors.somethingWentWrong'))
    } finally {
      setSaving(false)
    }
  }

  const handleAddOfficers = async () => {
    if (selectedOfficers.length === 0) return
    
    setAddingMembers(true)
    try {
      await projectService.addTeamMembers(projectId, selectedOfficers)
      toast.success(t('projects.membersAdded', { count: selectedOfficers.length }))
      setShowAddModal(false)
      setSelectedOfficers([])
      fetchAllMembers()
    } catch (error) {
      toast.error(error.response?.data?.message ?? t('errors.somethingWentWrong'))
    } finally {
      setAddingMembers(false)
    }
  }

  const handleRemoveMember = (member) => {
    setConfirmMember(member)
  }

  const confirmRemoveMember = async () => {
    if (!confirmMember) return

    try {
      if (confirmMember.isTeamMember) {
        await projectService.removeTeamMember(projectId, confirmMember.id)
        toast.success(t('projects.memberRemoved'))
      } else {
        const res = await projectService.removeMember(projectId, confirmMember.id)
        toast.success(t('members.removeSuccess'))
        if (res.data.data?.deactivated) {
          toast.info(t('members.removeWarning'))
        }
      }
      fetchAllMembers()
    } catch (error) {
      toast.error(error.response?.data?.message ?? t('errors.somethingWentWrong'))
    } finally {
      setConfirmMember(null)
    }
  }

  const toggleOfficerSelection = (officerId) => {
    setSelectedOfficers(prev => 
      prev.includes(officerId) 
        ? prev.filter(id => id !== officerId)
        : [...prev, officerId]
    )
  }

  const filteredMembers = allMembers.filter(member => {
    if (!searchTerm) return true
    const search = searchTerm.toLowerCase()
    return (
      member.name?.toLowerCase().includes(search) ||
      member.email?.toLowerCase().includes(search) ||
      member.cin?.toLowerCase().includes(search)
    )
  })

  const filteredOfficers = availableOfficers.filter(officer =>
    officer.name.toLowerCase().includes(addSearchTerm.toLowerCase()) ||
    officer.email.toLowerCase().includes(addSearchTerm.toLowerCase())
  )

  const getRoleBadgeClass = (role) => {
    switch (role) {
      case 'responsable': return 'badge-success'
      case 'supervisor': return 'badge-info'
      case 'user': return 'badge-secondary'
      default: return 'badge-secondary'
    }
  }

  const totalMembers = allMembers.length

  return (
    <div className="card">
      <div className="card-header flex items-center justify-between">
        <div className="flex items-center gap-2">
          <Users className="w-5 h-5 text-hse-primary" />
          <h3 className="font-semibold text-gray-900 dark:text-gray-100">
            {t('projects.teamMembers')}
          </h3>
          <span className="badge badge-info">{totalMembers}</span>
        </div>
        
        {/* Add Member Dropdown */}
        <div ref={bulkRef} className="relative">
          <button
            onClick={() => setShowAddDropdown(!showAddDropdown)}
            className="btn-primary btn-sm flex items-center gap-2"
          >
            <UserPlus className="w-4 h-4" />
            {t('members.addMember')}
            <ChevronDown className="w-4 h-4" />
          </button>
          
          {showAddDropdown && (
            <>
              <div 
                className="fixed inset-0 z-10" 
                onClick={() => setShowAddDropdown(false)} 
              />
              <div className="absolute right-0 mt-2 w-56 bg-white dark:bg-gray-800 rounded-lg shadow-lg border border-gray-200 dark:border-gray-700 z-20">
                <button
                  onClick={handleOpenAddModal}
                  className="w-full px-4 py-3 text-left hover:bg-gray-50 dark:hover:bg-gray-700 rounded-t-lg flex items-center gap-3"
                >
                  <Users className="w-4 h-4 text-gray-500" />
                  <div>
                    <p className="font-medium text-sm">{t('projects.addToTeam')}</p>
                    <p className="text-xs text-gray-500">{t('projects.selectOfficers')}</p>
                  </div>
                </button>
                <button
                  onClick={() => {
                    setShowAddDropdown(false)
                    setBulkOpen(true)
                  }}
                  className="w-full px-4 py-3 text-left hover:bg-gray-50 dark:hover:bg-gray-700 flex items-center gap-3 border-t border-gray-200 dark:border-gray-700"
                >
                  <Upload className="w-4 h-4 text-gray-500" />
                  <div>
                    <p className="font-medium text-sm">Massive Add</p>
                    <p className="text-xs text-gray-500">Import XLSX</p>
                  </div>
                </button>
                <button
                  onClick={() => handleOpenCreateModal()}
                  className="w-full px-4 py-3 text-left hover:bg-gray-50 dark:hover:bg-gray-700 rounded-b-lg flex items-center gap-3 border-t border-gray-200 dark:border-gray-700"
                >
                  <UserPlus className="w-4 h-4 text-gray-500" />
                  <div>
                    <p className="font-medium text-sm">{t('members.newMember')}</p>
                    <p className="text-xs text-gray-500">{t('members.subtitle')}</p>
                  </div>
                </button>
              </div>
            </>
          )}

          {bulkOpen && (
            <>
              <div className="fixed inset-0 z-10" onClick={() => setBulkOpen(false)} />
              <div className="absolute right-0 mt-2 w-80 bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-xl shadow-xl p-4 z-20">
                <div className="space-y-3">
                  <button
                    type="button"
                    onClick={handleDownloadTeamTemplate}
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
                    onClick={handleBulkImportTeam}
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
            </>
          )}
        </div>
      </div>

      <div className="card-body">
        {/* Search */}
        {totalMembers > 0 && (
          <div className="mb-4">
            <div className="relative">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
              <input
                type="text"
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                placeholder={t('common.search')}
                className="input pl-10"
              />
            </div>
          </div>
        )}

        {loading ? (
          <div className="flex items-center justify-center py-8">
            <Loader2 className="w-6 h-6 animate-spin text-hse-primary" />
          </div>
        ) : filteredMembers.length > 0 ? (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3">
            {filteredMembers.map((member) => (
              <div
                key={member.id}
                className="flex items-center justify-between p-3 bg-gray-50 dark:bg-gray-800 rounded-lg border border-gray-200 dark:border-gray-700"
              >
                <div className="flex items-center gap-3 min-w-0">
                  <div className="w-10 h-10 bg-teal-100 dark:bg-teal-900 rounded-full flex items-center justify-center flex-shrink-0">
                    <span className="text-teal-600 dark:text-teal-400 font-semibold">
                      {member.name?.charAt(0).toUpperCase()}
                    </span>
                  </div>
                  <div className="min-w-0">
                    <p className="font-medium text-gray-900 dark:text-gray-100 truncate">{member.name}</p>
                    <div className="flex items-center gap-2">
                      <span className={`badge badge-xs ${getRoleBadgeClass(member.role)}`}>
                        {t(`users.roles.${member.role}`)}
                      </span>
                      {member.cin && (
                        <span className="text-xs text-gray-500 font-mono">{member.cin}</span>
                      )}
                    </div>
                  </div>
                </div>
                <div className="flex items-center gap-1 flex-shrink-0">
                  {member.canEdit && (
                    <button
                      onClick={() => handleOpenCreateModal(member)}
                      className="p-2 hover:bg-gray-200 dark:hover:bg-gray-700 rounded-lg transition-colors"
                      title={t('common.edit')}
                    >
                      <Edit2 className="w-4 h-4 text-gray-500" />
                    </button>
                  )}
                  {member.canRemove && member.id !== currentUser?.id && (
                    <button
                      onClick={() => handleRemoveMember(member)}
                      className="p-2 hover:bg-red-50 dark:hover:bg-red-900/20 rounded-lg transition-colors"
                      title={t('projects.removeFromTeam')}
                    >
                      <UserMinus className="w-4 h-4 text-red-500" />
                    </button>
                  )}
                </div>
              </div>
            ))}
          </div>
        ) : (
          <div className="text-center py-8 text-gray-500 dark:text-gray-400">
            <Users className="w-12 h-12 mx-auto mb-3 opacity-50" />
            <p>{t('projects.noTeamMembers')}</p>
          </div>
        )}
      </div>

      {/* Create/Edit Member Modal */}
      {showCreateModal && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
          <div className="bg-white dark:bg-gray-800 rounded-xl shadow-xl w-full max-w-lg max-h-[90vh] flex flex-col">
            <div className="sticky top-0 z-[200] p-4 border-b border-gray-200 dark:border-gray-700 flex items-center justify-between bg-white dark:bg-gray-800">
              <h3 className="text-lg font-semibold text-gray-900 dark:text-gray-100">
                {editingMember ? t('members.editMember') : t('members.newMember')}
              </h3>
              <button onClick={handleCloseCreateModal} className="p-2 hover:bg-gray-100 dark:hover:bg-gray-700 rounded-lg">
                <X className="w-5 h-5" />
              </button>
            </div>

            <form onSubmit={handleSubmitCreate} className="flex-1 overflow-y-auto p-4 space-y-4">
              <div>
                <label className="label">{t('users.form.fullName')} *</label>
                <input
                  type="text"
                  value={formData.name}
                  onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                  className="input"
                  required
                />
              </div>

              <div>
                <label className="label">{t('users.form.cin')} *</label>
                <div className="relative">
                  <CreditCard className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
                  <input
                    type="text"
                    value={formData.cin}
                    onChange={(e) => setFormData({ ...formData, cin: e.target.value })}
                    className="input pl-10"
                    placeholder={t('users.form.cinPlaceholder')}
                    required
                  />
                </div>
              </div>

              <div>
                <label className="label">{t('users.form.email')} *</label>
                <div className="relative">
                  <Mail className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
                  <input
                    type="email"
                    value={formData.email}
                    onChange={(e) => setFormData({ ...formData, email: e.target.value })}
                    className="input pl-10"
                    required
                  />
                </div>
              </div>

              <div>
                <label className="label">{t('users.form.role')} *</label>
                <Select
                  value={formData.role}
                  onChange={(e) => setFormData({ ...formData, role: e.target.value })}
                  required
                >
                  {creatableRoles.map(role => (
                    <option key={role} value={role}>{t(`users.roles.${role}`)}</option>
                  ))}
                </Select>
              </div>

              <div>
                <label className="label">{t('users.form.phone')}</label>
                <div className="relative">
                  <Phone className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
                  <input
                    type="tel"
                    value={formData.phone}
                    onChange={(e) => setFormData({ ...formData, phone: e.target.value })}
                    className="input pl-10"
                  />
                </div>
              </div>

              <div>
                <label className="label">
                  {t('users.form.password')}{' '}
                  {editingMember && `(${t('users.form.passwordHint')})`}
                </label>
                <input
                  type="password"
                  value={formData.password}
                  onChange={(e) => setFormData({ ...formData, password: e.target.value })}
                  className="input"
                  {...(!editingMember && { required: true })}
                  minLength={getPasswordPolicy(formData.role).minLength}
                />
                <PasswordStrength password={formData.password} role={formData.role} />
              </div>

              {!editingMember && (
                <div className="p-3 bg-blue-50 dark:bg-blue-900/20 rounded-lg text-sm text-blue-700 dark:text-blue-300">
                  <p>{t('members.cinInfo')}</p>
                </div>
              )}

              <div className="flex justify-end gap-3 pt-4 border-t dark:border-gray-700">
                <button type="button" onClick={handleCloseCreateModal} className="btn-outline">
                  {t('common.cancel')}
                </button>
                <button type="submit" disabled={saving} className="btn-primary flex items-center gap-2">
                  {saving && <Loader2 className="w-4 h-4 animate-spin" />}
                  {editingMember ? t('common.save') : t('members.addMember')}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Add Existing Users Modal */}
      {showAddModal && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
          <div className="bg-white dark:bg-gray-800 rounded-xl shadow-xl w-full max-w-lg max-h-[80vh] flex flex-col">
            <div className="sticky top-0 z-[200] p-4 border-b border-gray-200 dark:border-gray-700 flex items-center justify-between bg-white dark:bg-gray-800">
              <h3 className="text-lg font-semibold text-gray-900 dark:text-gray-100">
                {t('projects.selectOfficers')}
              </h3>
              <button onClick={() => setShowAddModal(false)} className="p-2 hover:bg-gray-100 dark:hover:bg-gray-700 rounded-lg">
                <X className="w-5 h-5" />
              </button>
            </div>
            
            <div className="p-4 border-b border-gray-200 dark:border-gray-700">
              <div className="relative">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
                <input
                  type="text"
                  value={addSearchTerm}
                  onChange={(e) => setAddSearchTerm(e.target.value)}
                  placeholder={t('common.search')}
                  className="input pl-10"
                />
              </div>
            </div>

            <div className="flex-1 overflow-y-auto p-4">
              {filteredOfficers.length > 0 ? (
                <div className="space-y-2">
                  {filteredOfficers.map((officer) => (
                    <div
                      key={officer.id}
                      onClick={() => toggleOfficerSelection(officer.id)}
                      className={`flex items-center gap-3 p-3 rounded-lg cursor-pointer transition-colors ${
                        selectedOfficers.includes(officer.id)
                          ? 'bg-hse-primary/10 border-2 border-hse-primary'
                          : 'bg-gray-50 dark:bg-gray-700 border-2 border-transparent hover:border-gray-300'
                      }`}
                    >
                      <div className={`w-5 h-5 rounded border-2 flex items-center justify-center ${
                        selectedOfficers.includes(officer.id) ? 'bg-hse-primary border-hse-primary' : 'border-gray-300'
                      }`}>
                        {selectedOfficers.includes(officer.id) && <Check className="w-3 h-3 text-white" />}
                      </div>
                      <div className="w-10 h-10 bg-teal-100 dark:bg-teal-900 rounded-full flex items-center justify-center">
                        <span className="text-teal-600 dark:text-teal-400 font-semibold">
                          {officer.name.charAt(0).toUpperCase()}
                        </span>
                      </div>
                      <div>
                        <p className="font-medium text-gray-900 dark:text-gray-100">{officer.name}</p>
                        <p className="text-xs text-gray-500">{officer.email}</p>
                      </div>
                    </div>
                  ))}
                </div>
              ) : (
                <div className="text-center py-8 text-gray-500">
                  <Users className="w-12 h-12 mx-auto mb-3 opacity-50" />
                  <p>{t('projects.noAvailableOfficers')}</p>
                </div>
              )}
            </div>

            <div className="p-4 border-t border-gray-200 dark:border-gray-700 flex items-center justify-between">
              <span className="text-sm text-gray-500">
                {selectedOfficers.length} {t('common.selected')}
              </span>
              <div className="flex gap-2">
                <button onClick={() => setShowAddModal(false)} className="btn-outline">
                  {t('common.cancel')}
                </button>
                <button
                  onClick={handleAddOfficers}
                  disabled={selectedOfficers.length === 0 || addingMembers}
                  className="btn-primary flex items-center gap-2"
                >
                  {addingMembers ? <Loader2 className="w-4 h-4 animate-spin" /> : <UserPlus className="w-4 h-4" />}
                  {t('projects.addSelected')}
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      <ConfirmDialog
        isOpen={!!confirmMember}
        title={t('common.confirm')}
        message={
          confirmMember
            ? (confirmMember.isTeamMember
                ? t('projects.confirmRemoveMember', { name: confirmMember.name })
                : t('members.removeConfirm', { name: confirmMember.name })
              )
            : ''
        }
        confirmLabel={t('projects.removeFromTeam')}
        cancelLabel={t('common.cancel')}
        variant="danger"
        onConfirm={confirmRemoveMember}
        onCancel={() => setConfirmMember(null)}
      />
    </div>
  )
}
