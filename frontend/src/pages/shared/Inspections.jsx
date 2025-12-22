import { useState, useEffect, useMemo } from 'react'
import { projectService, inspectionService, exportService } from '../../services/api'
import { useAuthStore } from '../../store/authStore'
import { useLanguage } from '../../i18n'
import ConfirmDialog from '../../components/ui/ConfirmDialog'
import DatePicker from '../../components/ui/DatePicker'
import Select from '../../components/ui/Select'
import { getProjectLabel, sortProjects } from '../../utils/projectList'
import {
  ClipboardCheck,
  Plus,
  Trash2,
  Edit2,
  Calendar,
  Loader2,
  X,
  Building2,
  MapPin,
  User,
  Search,
  Filter,
  CheckCircle,
  Clock,
  FileSpreadsheet
} from 'lucide-react'
import toast from 'react-hot-toast'

const NATURE_OPTIONS = [
  { value: 'sst', labelKey: 'sst' },
  { value: 'environment', labelKey: 'environment' },
  { value: 'third_party', labelKey: 'thirdParty' },
  { value: 'equipment', labelKey: 'equipment' },
  { value: 'other', labelKey: 'other' },
]

// Helper to format date
const formatDate = (dateStr) => {
  if (!dateStr) return '-'
  const date = dateStr.substring(0, 10)
  const [year, month, day] = date.split('-')
  return `${day}/${month}/${year}`
}

export default function Inspections() {
  const { t } = useLanguage()
  const { user } = useAuthStore()
  
  // State
  const [projects, setProjects] = useState([])
  const [inspections, setInspections] = useState([])
  const [loading, setLoading] = useState(true)
  const [exporting, setExporting] = useState(false)
  const [projectZones, setProjectZones] = useState([])
  
  // Filters
  const [selectedProject, setSelectedProject] = useState(null)
  const [filterStatus, setFilterStatus] = useState('')
  const [filterNature, setFilterNature] = useState('')
  const [searchTerm, setSearchTerm] = useState('')
  
  // Modal state
  const [showModal, setShowModal] = useState(false)
  const [editingInspection, setEditingInspection] = useState(null)
  const [formData, setFormData] = useState(getEmptyFormData())
  const [saving, setSaving] = useState(false)
  const [confirmInspection, setConfirmInspection] = useState(null)

  const projectListPreference = user?.project_list_preference ?? 'code'
  const sortedProjects = useMemo(() => {
    return sortProjects(projects, projectListPreference)
  }, [projects, projectListPreference])

  function getEmptyFormData() {
    return {
      project_id: '',
      inspection_date: new Date().toISOString().split('T')[0],
      nature: 'sst',
      nature_other: '',
      type: 'internal',
      location: '',
      start_date: new Date().toISOString().split('T')[0],
      end_date: '',
      zone: '',
      inspector: user?.name ?? '',
      enterprise: '',
      status: 'open',
      notes: '',
    }
  }

  useEffect(() => {
    fetchProjects()
  }, [])

  useEffect(() => {
    const handleKeyDown = (e) => {
      if (e.key === 'Escape' && showModal) {
        handleCloseModal()
      }
    }
    if (!showModal) return
    document.addEventListener('keydown', handleKeyDown)
    return () => document.removeEventListener('keydown', handleKeyDown)
  }, [showModal])

  useEffect(() => {
    if (selectedProject) {
      fetchInspections()
      fetchProjectZones(selectedProject.id)
    }
  }, [selectedProject, filterStatus, filterNature])

  const fetchProjects = async () => {
    try {
      const response = await projectService.getAll({ per_page: 100 })
      const projectList = response.data.data ?? []
      setProjects(projectList)
      
      if (projectList.length === 1) {
        setSelectedProject(projectList[0])
      }
    } catch (error) {
      console.error('Error fetching projects:', error)
    } finally {
      setLoading(false)
    }
  }

  const fetchInspections = async () => {
    if (!selectedProject) return
    
    setLoading(true)
    try {
      const params = {
        project_id: selectedProject.id,
        per_page: 100,
      }
      if (filterStatus) params.status = filterStatus
      if (filterNature) params.nature = filterNature
      
      const response = await inspectionService.getAll(params)
      const payload = response.data
      const data = payload.data ?? payload
      const items = Array.isArray(data) ? data : (data?.data ?? [])
      setInspections(items)
    } catch (error) {
      console.error('Error fetching inspections:', error)
    } finally {
      setLoading(false)
    }
  }

  const fetchProjectZones = async (projectId) => {
    try {
      const response = await projectService.getZones(projectId)
      setProjectZones(response.data?.data?.zones ?? [])
    } catch (error) {
      console.error('Error fetching zones:', error)
      setProjectZones([])
    }
  }

  const handleOpenModal = (inspection = null) => {
    if (inspection) {
      setEditingInspection(inspection)
      setFormData({
        project_id: inspection.project_id.toString(),
        inspection_date: inspection.inspection_date,
        nature: inspection.nature,
        nature_other: inspection.nature_other ?? '',
        type: inspection.type,
        location: inspection.location ?? '',
        start_date: inspection.start_date,
        end_date: inspection.end_date ?? '',
        zone: inspection.zone ?? '',
        inspector: inspection.inspector,
        enterprise: inspection.enterprise ?? '',
        status: inspection.status,
        notes: inspection.notes ?? '',
      })
      // Fetch zones for the inspection's project
      fetchProjectZones(inspection.project_id)
    } else {
      setEditingInspection(null)
      setFormData({
        ...getEmptyFormData(),
        project_id: selectedProject?.id?.toString() ?? '',
        inspector: user?.name ?? '',
      })
    }
    setShowModal(true)
  }

  const handleCloseModal = () => {
    setShowModal(false)
    setEditingInspection(null)
    setFormData(getEmptyFormData())
  }

  const handleSubmit = async (e) => {
    e.preventDefault()
    setSaving(true)

    try {
      const data = {
        ...formData,
        project_id: parseInt(formData.project_id),
      }

      if (editingInspection) {
        await inspectionService.update(editingInspection.id, data)
        toast.success(t('inspections.updated'))
      } else {
        await inspectionService.create(data)
        toast.success(t('inspections.created'))
      }
      
      handleCloseModal()
      fetchInspections()
    } catch (error) {
      console.error('Error saving inspection:', error)
      toast.error(t('errors.somethingWentWrong'))
    } finally {
      setSaving(false)
    }
  }

  const handleDelete = (inspection) => {
    setConfirmInspection(inspection)
  }

  const confirmDeleteInspection = async () => {
    if (!confirmInspection) return

    try {
      await inspectionService.delete(confirmInspection.id)
      toast.success(t('inspections.deleted'))
      fetchInspections()
    } catch (error) {
      toast.error(t('errors.somethingWentWrong'))
    } finally {
      setConfirmInspection(null)
    }
  }

  const handleProjectChange = (projectId) => {
    const project = projects.find(p => p.id === parseInt(projectId))
    setSelectedProject(project)
    setFormData(prev => ({ ...prev, project_id: projectId, zone: '' }))
    if (project) {
      fetchProjectZones(project.id)
    }
  }

  // Filter inspections by search
  const filteredInspections = inspections.filter(insp => {
    if (!searchTerm) return true
    const search = searchTerm.toLowerCase()
    return (
      insp.inspector?.toLowerCase().includes(search) ||
      insp.location?.toLowerCase().includes(search) ||
      insp.zone?.toLowerCase().includes(search) ||
      insp.enterprise?.toLowerCase().includes(search) ||
      insp.notes?.toLowerCase().includes(search)
    )
  })

  const getNatureLabel = (nature, natureOther) => {
    if (nature === 'other' && natureOther) return natureOther
    return t(`inspections.natures.${nature}`)
  }

  const handleExportInspections = async () => {
    if (!selectedProject) {
      toast.error(t('inspections.selectProjectFirst'))
      return
    }

    try {
      setExporting(true)
      const params = {
        project_id: selectedProject.id,
      }
      if (filterStatus) params.status = filterStatus
      if (filterNature) params.nature = filterNature

      const response = await exportService.exportInspections(params)
      const blob = new Blob([response.data], {
        type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
      })
      const url = window.URL.createObjectURL(blob)
      const a = document.createElement('a')
      a.href = url
      const projectCode = selectedProject.code || selectedProject.id
      a.download = `inspections_${projectCode}.xlsx`
      a.click()
      window.URL.revokeObjectURL(url)
    } catch (error) {
      console.error('Error exporting inspections:', error)
      toast.error(t('errors.somethingWentWrong'))
    } finally {
      setExporting(false)
    }
  }

  if (loading && !selectedProject) {
    return (
      <div className="flex items-center justify-center h-64">
        <Loader2 className="w-8 h-8 animate-spin text-hse-primary" />
      </div>
    )
  }

  return (
    <div className="space-y-6 p-6">
      {/* Header */}
      <div className="flex items-center gap-4">
        <div className="w-12 h-12 bg-blue-100 dark:bg-blue-900/50 rounded-xl flex items-center justify-center">
          <ClipboardCheck className="w-6 h-6 text-blue-600 dark:text-blue-400" />
        </div>
        <div>
          <div className="text-xs text-gray-500 dark:text-gray-400 mb-1">
            {t('nav.dashboard')} / {t('inspections.title')}
          </div>
          <h1 className="text-2xl font-bold text-gray-900 dark:text-gray-100">
            {t('inspections.pageTitle')}
          </h1>
          <p className="text-gray-500 dark:text-gray-400 mt-1">
            {t('inspections.pageSubtitle')}
          </p>
        </div>
      </div>

      {/* Filters */}
      <div className="card p-4">
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-5 gap-4">
          {/* Project Select */}
          <div>
            <label className="label">{t('inspections.project')}</label>
            <Select
              value={selectedProject?.id ?? ''}
              onChange={(e) => handleProjectChange(e.target.value)}
            >
              <option value="">{t('inspections.selectProject')}</option>
              {sortedProjects.map(project => (
                <option key={project.id} value={project.id}>
                  {getProjectLabel(project)}
                </option>
              ))}
            </Select>
          </div>

          {/* Status Filter */}
          <div>
            <label className="label">{t('inspections.status')}</label>
            <Select
              value={filterStatus}
              onChange={(e) => setFilterStatus(e.target.value)}
            >
              <option value="">{t('common.all')}</option>
              <option value="open">{t('inspections.statusOpen')}</option>
              <option value="closed">{t('inspections.statusClosed')}</option>
            </Select>
          </div>

          {/* Nature Filter */}
          <div>
            <label className="label">{t('inspections.nature')}</label>
            <Select
              value={filterNature}
              onChange={(e) => setFilterNature(e.target.value)}
            >
              <option value="">{t('common.all')}</option>
              {NATURE_OPTIONS.map(opt => (
                <option key={opt.value} value={opt.value}>
                  {t(`inspections.natures.${opt.labelKey}`)}
                </option>
              ))}
            </Select>
          </div>

          {/* Search */}
          <div>
            <label className="label">{t('common.search')}</label>
            <div className="relative">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
              <input
                type="text"
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                placeholder={t('inspections.searchPlaceholder')}
                className="input pl-10"
              />
            </div>
          </div>

          {/* Add Button */}
          <div className="flex items-end">
            <button
              onClick={() => handleOpenModal()}
              disabled={!selectedProject}
              className="btn-primary flex items-center gap-2 w-full justify-center"
            >
              <Plus className="w-4 h-4" />
              {t('inspections.newInspection')}
            </button>
          </div>
        </div>
      </div>

      {/* Inspections List */}
      {selectedProject ? (
        <div className="card">
          <div className="card-header flex items-center justify-between">
            <h3 className="font-semibold text-gray-900 dark:text-gray-100">
              {t('inspections.listTitle')} ({filteredInspections.length})
            </h3>
            <button
              type="button"
              onClick={handleExportInspections}
              disabled={exporting || filteredInspections.length === 0}
              className="btn-secondary flex items-center gap-2 text-sm"
            >
              <FileSpreadsheet className="w-4 h-4" />
              <span>{t('dashboard.exportExcel')}</span>
            </button>
          </div>
          <div className="overflow-x-auto">
            {loading ? (
              <div className="flex items-center justify-center h-32">
                <Loader2 className="w-6 h-6 animate-spin text-hse-primary" />
              </div>
            ) : filteredInspections.length > 0 ? (
              <>
                {/* Mobile cards */}
                <div className="space-y-3 md:hidden">
                  {filteredInspections.map(inspection => (
                    <div
                      key={inspection.id}
                      className="border border-gray-200 dark:border-gray-700 rounded-lg p-3 bg-white dark:bg-gray-800"
                    >
                      <div className="flex items-start justify-between gap-3">
                        <div>
                          <p className="text-sm font-medium text-gray-900 dark:text-gray-100">
                            {formatDate(inspection.inspection_date)}
                          </p>
                          <p className="mt-1 text-xs text-gray-600 dark:text-gray-300">
                            {getNatureLabel(inspection.nature, inspection.nature_other)}
                          </p>
                          <p className="mt-1 text-xs text-gray-600 dark:text-gray-300">
                            {(inspection.location ?? '')} · {(inspection.zone ?? '')}
                          </p>
                          <p className="mt-1 text-xs text-gray-500 dark:text-gray-400">
                            {t('inspections.inspector')}: {inspection.inspector}
                          </p>
                        </div>
                        <div className="text-right text-xs text-gray-600 dark:text-gray-300 space-y-1">
                          <span className={`inline-flex items-center gap-1 badge ${inspection.type === 'internal' ? 'badge-info' : 'badge-warning'}`}>
                            {t(`inspections.types.${inspection.type}`)}
                          </span>
                          <span className={`inline-flex items-center gap-1 badge ${inspection.status === 'open' ? 'badge-warning' : 'badge-success'}`}>
                            {inspection.status === 'open' ? (
                              <>
                                <Clock className="w-3 h-3" />
                                {t('inspections.statusOpen')}
                              </>
                            ) : (
                              <>
                                <CheckCircle className="w-3 h-3" />
                                {t('inspections.statusClosed')}
                              </>
                            )}
                          </span>
                        </div>
                      </div>

                      <div className="mt-3 flex items-center justify-end gap-2">
                        <button
                          onClick={() => handleOpenModal(inspection)}
                          className="px-2 py-1 text-xs rounded-md bg-gray-50 dark:bg-gray-900 text-gray-700 dark:text-gray-200"
                          title={t('common.edit')}
                        >
                          {t('common.edit')}
                        </button>
                        <button
                          onClick={() => handleDelete(inspection)}
                          className="px-2 py-1 text-xs rounded-md bg-red-50 dark:bg-red-900/30 text-red-600"
                          title={t('common.delete')}
                        >
                          {t('common.delete')}
                        </button>
                      </div>
                    </div>
                  ))}
                </div>

                {/* Desktop table */}
                <div className="hidden md:block">
                  <table className="table">
                    <thead>
                      <tr>
                        <th>{t('inspections.date')}</th>
                        <th>{t('inspections.nature')}</th>
                        <th>{t('inspections.type')}</th>
                        <th>{t('inspections.location')}</th>
                        <th>{t('inspections.zone')}</th>
                        <th>{t('inspections.inspector')}</th>
                        <th>{t('inspections.status')}</th>
                        <th>{t('common.actions')}</th>
                      </tr>
                    </thead>
                    <tbody>
                      {filteredInspections.map(inspection => (
                        <tr key={inspection.id}>
                          <td className="whitespace-nowrap">
                            {formatDate(inspection.inspection_date)}
                          </td>
                          <td>
                            <span className="text-sm">
                              {getNatureLabel(inspection.nature, inspection.nature_other)}
                            </span>
                          </td>
                          <td>
                            <span className={`badge ${inspection.type === 'internal' ? 'badge-info' : 'badge-warning'}`}>
                              {t(`inspections.types.${inspection.type}`)}
                            </span>
                          </td>
                          <td>{inspection.location ?? ''}</td>
                          <td>{inspection.zone ?? ''}</td>
                          <td>{inspection.inspector}</td>
                          <td>
                            <span className={`badge ${inspection.status === 'open' ? 'badge-warning' : 'badge-success'}`}>
                              {inspection.status === 'open' ? (
                                <><Clock className="w-3 h-3 mr-1" />{t('inspections.statusOpen')}</>
                              ) : (
                                <><CheckCircle className="w-3 h-3 mr-1" />{t('inspections.statusClosed')}</>
                              )}
                            </span>
                          </td>
                          <td>
                            <div className="flex items-center gap-1">
                              <button
                                onClick={() => handleOpenModal(inspection)}
                                className="p-1.5 hover:bg-gray-100 dark:hover:bg-gray-700 rounded"
                                title={t('common.edit')}
                              >
                                <Edit2 className="w-4 h-4 text-gray-500" />
                              </button>
                              <button
                                onClick={() => handleDelete(inspection)}
                                className="p-1.5 hover:bg-red-50 dark:hover:bg-red-900/20 rounded"
                                title={t('common.delete')}
                              >
                                <Trash2 className="w-4 h-4 text-red-500" />
                              </button>
                            </div>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </>
            ) : (
              <div className="text-center py-12 text-gray-500 dark:text-gray-400">
                <ClipboardCheck className="w-12 h-12 mx-auto mb-3 opacity-50" />
                <p>{t('inspections.noInspections')}</p>
              </div>
            )}
          </div>
        </div>
      ) : (
        <div className="card p-12 text-center text-gray-500 dark:text-gray-400">
          <ClipboardCheck className="w-16 h-16 mx-auto mb-4 opacity-50" />
          <p>{t('inspections.selectProjectFirst')}</p>
        </div>
      )}

      {/* Modal */}
      {showModal && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
          <div className="bg-white dark:bg-gray-800 rounded-2xl w-full max-w-2xl max-h-[90vh] overflow-y-auto">
            <div className="sticky top-0 z-[200] bg-white dark:bg-gray-800 border-b dark:border-gray-700 px-6 py-4 flex items-center justify-between">
              <h2 className="text-xl font-bold dark:text-gray-100">
                {editingInspection ? t('inspections.editInspection') : t('inspections.newInspection')}
              </h2>
              <button onClick={handleCloseModal} className="p-2 hover:bg-gray-100 dark:hover:bg-gray-700 rounded-lg">
                <X className="w-5 h-5" />
              </button>
            </div>
            
            <form onSubmit={handleSubmit} className="p-6 space-y-4">
              {/* Project & Date */}
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="label">{t('inspections.project')} *</label>
                  <Select
                    value={formData.project_id}
                    onChange={(e) => handleProjectChange(e.target.value)}
                    required
                  >
                    <option value="">{t('inspections.selectProject')}</option>
                    {sortedProjects.map(project => (
                      <option key={project.id} value={project.id}>
                        {getProjectLabel(project)}
                      </option>
                    ))}
                  </Select>
                </div>
                <div>
                  <label className="label">{t('inspections.date')} *</label>
                  <DatePicker
                    value={formData.inspection_date}
                    onChange={(val) => setFormData({ ...formData, inspection_date: val })}
                    required
                  />
                </div>
              </div>

              {/* Nature */}
              <div>
                <label className="label">{t('inspections.nature')} *</label>
                <Select
                  value={formData.nature}
                  onChange={(e) => setFormData({ ...formData, nature: e.target.value })}
                  required
                >
                  {NATURE_OPTIONS.map(opt => (
                    <option key={opt.value} value={opt.value}>
                      {t(`inspections.natures.${opt.labelKey}`)}
                    </option>
                  ))}
                </Select>
              </div>

              {/* Nature Other */}
              {formData.nature === 'other' && (
                <div>
                  <label className="label">{t('inspections.natureOther')} *</label>
                  <input
                    type="text"
                    value={formData.nature_other}
                    onChange={(e) => setFormData({ ...formData, nature_other: e.target.value })}
                    className="input"
                    placeholder={t('inspections.natureOtherPlaceholder')}
                    required
                  />
                </div>
              )}

              {/* Type Toggle */}
              <div>
                <label className="label">{t('inspections.type')} *</label>
                <div className="flex gap-4">
                  <label className="flex items-center gap-2 cursor-pointer">
                    <input
                      type="radio"
                      name="type"
                      value="internal"
                      checked={formData.type === 'internal'}
                      onChange={(e) => setFormData({ ...formData, type: e.target.value })}
                      className="w-4 h-4 text-hse-primary"
                    />
                    <span>{t('inspections.types.internal')}</span>
                  </label>
                  <label className="flex items-center gap-2 cursor-pointer">
                    <input
                      type="radio"
                      name="type"
                      value="external"
                      checked={formData.type === 'external'}
                      onChange={(e) => setFormData({ ...formData, type: e.target.value })}
                      className="w-4 h-4 text-hse-primary"
                    />
                    <span>{t('inspections.types.external')}</span>
                  </label>
                </div>
              </div>

              {/* Location & Zone */}
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="label">{t('inspections.location')}</label>
                  <input
                    type="text"
                    value={formData.location}
                    onChange={(e) => setFormData({ ...formData, location: e.target.value })}
                    className="input"
                    placeholder={t('inspections.locationPlaceholder')}
                  />
                </div>
                <div>
                  <label className="label">{t('inspections.zone')}</label>
                  <Select
                    value={formData.zone}
                    onChange={(e) => setFormData({ ...formData, zone: e.target.value })}
                    disabled={projectZones.length === 0}
                  >
                    <option value="">{t('common.select')}...</option>
                    {projectZones.map((zone, idx) => (
                      <option key={idx} value={zone}>{zone}</option>
                    ))}
                  </Select>
                </div>
              </div>

              {/* Start & End Date */}
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="label">{t('inspections.startDate')} *</label>
                  <DatePicker
                    value={formData.start_date}
                    onChange={(val) => setFormData({ ...formData, start_date: val })}
                    required
                  />
                </div>
                <div>
                  <label className="label">{t('inspections.endDate')}</label>
                  <DatePicker
                    value={formData.end_date}
                    onChange={(val) => setFormData({ ...formData, end_date: val })}
                  />
                </div>
              </div>

              {/* Inspector & Enterprise */}
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="label">{t('inspections.inspector')} *</label>
                  <input
                    type="text"
                    value={formData.inspector}
                    onChange={(e) => setFormData({ ...formData, inspector: e.target.value })}
                    className="input"
                    required
                  />
                </div>
                <div>
                  <label className="label">{t('inspections.enterprise')}</label>
                  <input
                    type="text"
                    value={formData.enterprise}
                    onChange={(e) => setFormData({ ...formData, enterprise: e.target.value })}
                    className="input"
                    placeholder={t('inspections.enterprisePlaceholder')}
                  />
                </div>
              </div>

              {/* Status Toggle */}
              <div>
                <label className="label">{t('inspections.status')} *</label>
                <div className="flex gap-4">
                  <label className="flex items-center gap-2 cursor-pointer">
                    <input
                      type="radio"
                      name="status"
                      value="open"
                      checked={formData.status === 'open'}
                      onChange={(e) => setFormData({ ...formData, status: e.target.value })}
                      className="w-4 h-4 text-hse-primary"
                    />
                    <span className="flex items-center gap-1">
                      <Clock className="w-4 h-4 text-amber-500" />
                      {t('inspections.statusOpen')}
                    </span>
                  </label>
                  <label className="flex items-center gap-2 cursor-pointer">
                    <input
                      type="radio"
                      name="status"
                      value="closed"
                      checked={formData.status === 'closed'}
                      onChange={(e) => setFormData({ ...formData, status: e.target.value })}
                      className="w-4 h-4 text-hse-primary"
                    />
                    <span className="flex items-center gap-1">
                      <CheckCircle className="w-4 h-4 text-green-500" />
                      {t('inspections.statusClosed')}
                    </span>
                  </label>
                </div>
              </div>

              {/* Notes */}
              <div>
                <label className="label">{t('inspections.notes')}</label>
                <textarea
                  value={formData.notes}
                  onChange={(e) => setFormData({ ...formData, notes: e.target.value })}
                  className="input"
                  rows={3}
                  placeholder={t('inspections.notesPlaceholder')}
                />
              </div>

              {/* Actions */}
              <div className="flex justify-end gap-3 pt-4 border-t dark:border-gray-700">
                <button type="button" onClick={handleCloseModal} className="btn-outline">
                  {t('common.cancel')}
                </button>
                <button type="submit" disabled={saving} className="btn-primary flex items-center gap-2">
                  {saving && <Loader2 className="w-4 h-4 animate-spin" />}
                  {editingInspection ? t('common.save') : t('inspections.create')}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      <ConfirmDialog
        isOpen={!!confirmInspection}
        title={t('common.confirm')}
        message={t('inspections.confirmDelete')}
        confirmLabel={t('common.delete')}
        cancelLabel={t('common.cancel')}
        variant="danger"
        onConfirm={confirmDeleteInspection}
        onCancel={() => setConfirmInspection(null)}
      />
    </div>
  )
}
