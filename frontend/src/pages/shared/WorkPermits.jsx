import { useState, useEffect, useMemo } from 'react'
import { projectService, workPermitService } from '../../services/api'
import { useAuthStore } from '../../store/authStore'
import { useLanguage } from '../../i18n'
import ConfirmDialog from '../../components/ui/ConfirmDialog'
import Modal from '../../components/ui/Modal'
import DatePicker from '../../components/ui/DatePicker'
import Select from '../../components/ui/Select'
import { getProjectLabel, sortProjects } from '../../utils/projectList'
import {
  FileText,
  Plus,
  Trash2,
  Edit2,
  Copy,
  RefreshCw,
  Rocket,
  Calendar,
  ChevronLeft,
  ChevronRight,
  Loader2,
  X,
  Check,
  Building2,
  MapPin,
  User,
  PenLine,
  Shield,
  AlertCircle,
  Search,
  Download
} from 'lucide-react'
import toast from 'react-hot-toast'

const PERMIT_TYPES = [
  { key: 'type_cold', labelKey: 'cold', alwaysChecked: true },
  { key: 'type_work_at_height', labelKey: 'workAtHeight' },
  { key: 'type_hot_work', labelKey: 'hotWork' },
  { key: 'type_confined_spaces', labelKey: 'confinedSpaces' },
  { key: 'type_electrical_isolation', labelKey: 'electricalIsolation' },
  { key: 'type_energized_work', labelKey: 'energizedWork' },
  { key: 'type_excavation', labelKey: 'excavation' },
  { key: 'type_mechanical_isolation', labelKey: 'mechanicalIsolation' },
  { key: 'type_7inch_grinder', labelKey: 'grinder7inch' },
]

// Helper to format date (DD-MM-YYYY)
const formatDate = (dateStr) => {
  if (!dateStr) return '-'
  const date = dateStr.substring(0, 10) // YYYY-MM-DD
  const [year, month, day] = date.split('-')
  return `${day}-${month}-${year}`
}

export default function WorkPermits() {
  const { t } = useLanguage()
  const { user } = useAuthStore()
  
  // State
  const [projects, setProjects] = useState([])
  const [selectedProject, setSelectedProject] = useState(null)
  const [weekNumber, setWeekNumber] = useState(null)
  const [year, setYear] = useState(null)
  const [weekInfo, setWeekInfo] = useState(null)
  const [currentWeekPermits, setCurrentWeekPermits] = useState([])
  const [previousWeekPermits, setPreviousWeekPermits] = useState([])
  const [loading, setLoading] = useState(true)
  const [permitsLoading, setPermitsLoading] = useState(false)
  
  // Modal state
  const [showModal, setShowModal] = useState(false)
  const [editingPermit, setEditingPermit] = useState(null)
  const [formData, setFormData] = useState(getEmptyFormData())
  const [saving, setSaving] = useState(false)
  
  // Copy from previous
  const [selectedToCopy, setSelectedToCopy] = useState([])
  const [copying, setCopying] = useState(false)
  
  // Export
  const [exporting, setExporting] = useState(false)
  const [confirmPermit, setConfirmPermit] = useState(null)

  const projectListPreference = user?.project_list_preference ?? 'code'
  const sortedProjects = useMemo(() => {
    return sortProjects(projects, projectListPreference)
  }, [projects, projectListPreference])
  const [showLaunchConfirm, setShowLaunchConfirm] = useState(false)
  
  // Search
  const [searchPrevious, setSearchPrevious] = useState('')
  const [searchCurrent, setSearchCurrent] = useState('')

  function getEmptyFormData() {
    return {
      type_cold: true,
      type_work_at_height: false,
      type_hot_work: false,
      type_confined_spaces: false,
      type_electrical_isolation: false,
      type_energized_work: false,
      type_excavation: false,
      type_mechanical_isolation: false,
      type_7inch_grinder: false,
      description: '',
      area: '',
      permit_user: '',
      signed_by: '',
      authorizer: '',
      commence_date: '',
      end_date: '',
      enterprise: '',
    }
  }

  useEffect(() => {
    fetchProjects()
    fetchWeekInfo()
  }, [])

  useEffect(() => {
    const handleKeyDown = (e) => {
      if (e.key === 'Escape' && showModal) {
        setShowModal(false)
      }
    }
    if (!showModal) return
    document.addEventListener('keydown', handleKeyDown)
    return () => document.removeEventListener('keydown', handleKeyDown)
  }, [showModal])

  useEffect(() => {
    if (selectedProject && weekNumber && year) {
      fetchPermits()
    }
  }, [selectedProject, weekNumber, year])

  const fetchProjects = async () => {
    try {
      const projectList = await projectService.getAllList({ status: 'active' })
      setProjects(projectList)
      
      // Auto-select if user has only one project
      if (projectList.length === 1) {
        setSelectedProject(projectList[0])
      }
    } catch (error) {
      toast.error('Failed to load projects')
    } finally {
      setLoading(false)
    }
  }

  const fetchWeekInfo = async () => {
    try {
      const res = await workPermitService.getWeekInfo()
      const info = res.data.data
      setWeekNumber(info.current_week)
      setYear(info.current_year)
      setWeekInfo(info)
    } catch (error) {
      console.error('Failed to get week info:', error)
    }
  }

  const fetchPermits = async () => {
    if (!selectedProject) return
    
    setPermitsLoading(true)
    try {
      const res = await workPermitService.getWeekPermits({
        project_id: selectedProject.id,
        week_number: weekNumber,
        year: year,
      })
      const data = res.data.data
      setCurrentWeekPermits(data.current_week.permits ?? [])
      setPreviousWeekPermits(data.previous_week.permits ?? [])
      setWeekInfo({
        ...weekInfo,
        current: data.current_week,
        previous: data.previous_week,
      })
    } catch (error) {
      toast.error('Failed to load permits')
    } finally {
      setPermitsLoading(false)
    }
  }

  const handleWeekChange = (direction) => {
    let newWeek = weekNumber + direction
    let newYear = year
    
    if (newWeek > 52) {
      newWeek = 1
      newYear++
    } else if (newWeek < 1) {
      newWeek = 52
      newYear--
    }
    
    setWeekNumber(newWeek)
    setYear(newYear)
  }

  const handleOpenModal = (permit = null) => {
    if (permit) {
      setEditingPermit(permit)
      setFormData({
        type_cold: permit.type_cold,
        type_work_at_height: permit.type_work_at_height,
        type_hot_work: permit.type_hot_work,
        type_confined_spaces: permit.type_confined_spaces,
        type_electrical_isolation: permit.type_electrical_isolation,
        type_energized_work: permit.type_energized_work,
        type_excavation: permit.type_excavation,
        type_mechanical_isolation: permit.type_mechanical_isolation,
        type_7inch_grinder: permit.type_7inch_grinder,
        description: permit.description ?? '',
        area: permit.area ?? '',
        permit_user: permit.permit_user,
        signed_by: permit.signed_by ?? '',
        authorizer: permit.authorizer ?? '',
        commence_date: permit.commence_date,
        end_date: permit.end_date,
        enterprise: permit.enterprise ?? '',
      })
    } else {
      setEditingPermit(null)
      const weekDates = weekInfo?.current ?? {}
      setFormData({
        ...getEmptyFormData(),
        commence_date: weekDates.start_date ?? '',
        end_date: weekDates.end_date ?? '',
      })
    }
    setShowModal(true)
  }

  const handleSubmit = async (e) => {
    e.preventDefault()
    if (!selectedProject) return

    setSaving(true)
    try {
      if (editingPermit) {
        await workPermitService.update(editingPermit.id, formData)
        toast.success(t('workPermits.updated'))
      } else {
        await workPermitService.create({
          ...formData,
          project_id: selectedProject.id,
          week_number: weekNumber,
          year: year,
        })
        toast.success(t('workPermits.created'))
      }
      setShowModal(false)
      fetchPermits()
    } catch (error) {
      toast.error(error.response?.data?.message || 'Failed to save permit')
    } finally {
      setSaving(false)
    }
  }

  const handleDelete = (permit) => {
    setConfirmPermit(permit)
  }

  const confirmDelete = async () => {
    if (!confirmPermit) return

    try {
      await workPermitService.delete(confirmPermit.id)
      toast.success(t('workPermits.deleted'))
      fetchPermits()
    } catch (error) {
      toast.error('Failed to delete permit')
    } finally {
      setConfirmPermit(null)
    }
  }

  const handleCopySelected = async () => {
    if (selectedToCopy.length === 0) return
    
    setCopying(true)
    try {
      const res = await workPermitService.copyFromPrevious({
        project_id: selectedProject.id,
        week_number: weekNumber,
        year: year,
        permit_ids: selectedToCopy,
      })
      toast.success(t('workPermits.copied', { count: res.data.data.copied_count }))
      setSelectedToCopy([])
      fetchPermits()
    } catch (error) {
      toast.error('Failed to copy permits')
    } finally {
      setCopying(false)
    }
  }

  const handleLaunchWeek = () => {
    setShowLaunchConfirm(true)
  }

  const confirmLaunchWeek = async () => {
    if (!selectedProject || !weekNumber || !year) {
      setShowLaunchConfirm(false)
      return
    }

    try {
      const res = await workPermitService.launchWeek({
        project_id: selectedProject.id,
        week_number: weekNumber,
        year: year,
      })
      toast.success(t('workPermits.weekLaunched', { count: res.data.data.activated_count }))
      fetchPermits()
    } catch (error) {
      toast.error('Failed to launch week')
    } finally {
      setShowLaunchConfirm(false)
    }
  }

  const handleExport = async () => {
    if (!selectedProject || !weekNumber || !year) return
    
    setExporting(true)
    try {
      const response = await workPermitService.export({
        project_id: selectedProject.id,
        week_number: weekNumber,
        year: year,
      })
      
      // Create download link
      const url = window.URL.createObjectURL(new Blob([response.data]))
      const link = document.createElement('a')
      link.href = url
      const weekFormatted = 'S' + String(weekNumber).padStart(2, '0')
      link.setAttribute('download', `Permis_${selectedProject.code}_${weekFormatted}_${year}.xlsx`)
      document.body.appendChild(link)
      link.click()
      link.remove()
      window.URL.revokeObjectURL(url)
      
      toast.success(t('workPermits.exported'))
    } catch (error) {
      console.error('Export error:', error)
      toast.error(t('workPermits.exportError'))
    } finally {
      setExporting(false)
    }
  }

  const toggleSelectToCopy = (permitId) => {
    setSelectedToCopy(prev => 
      prev.includes(permitId) 
        ? prev.filter(id => id !== permitId)
        : [...prev, permitId]
    )
  }

  const getStatusBadge = (status) => {
    const badges = {
      draft: 'badge-warning',
      active: 'badge-success',
      closed: 'badge-info',
      cancelled: 'badge-danger',
    }
    return badges[status] || 'badge-info'
  }

  const getActiveTypes = (permit) => {
    return PERMIT_TYPES.filter(pt => permit[pt.key]).map(pt => t(`workPermits.types.${pt.labelKey}`))
  }

  // Filter permits by search
  const filterPermits = (permits, search) => {
    if (!search.trim()) return permits
    const s = search.toLowerCase()
    return permits.filter(p => 
      p.permit_number?.toLowerCase().includes(s) ||
      p.permit_user?.toLowerCase().includes(s) ||
      p.area?.toLowerCase().includes(s) ||
      p.enterprise?.toLowerCase().includes(s) ||
      p.description?.toLowerCase().includes(s)
    )
  }

  const filteredPreviousPermits = filterPermits(previousWeekPermits, searchPrevious)
  const filteredCurrentPermits = filterPermits(currentWeekPermits, searchCurrent)

  // Select all for previous week
  const handleSelectAll = () => {
    if (selectedToCopy.length === filteredPreviousPermits.length) {
      setSelectedToCopy([])
    } else {
      setSelectedToCopy(filteredPreviousPermits.map(p => p.id))
    }
  }

  const allSelected = filteredPreviousPermits.length > 0 && selectedToCopy.length === filteredPreviousPermits.length

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
      <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-4">
        <div>
          <div className="text-xs text-gray-500 dark:text-gray-400 mb-1">
            {t('nav.dashboard')} / {t('workPermits.title')}
          </div>
          <h1 className="text-2xl font-bold text-gray-900 dark:text-gray-100">
            {t('workPermits.pageTitle')}
          </h1>
          <p className="text-gray-500 dark:text-gray-400 mt-1">
            {t('workPermits.pageSubtitle')}
          </p>
        </div>
      </div>

      {/* Filters */}
      <div className="card p-4">
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {/* Project Select */}
          <div>
            <label className="label">{t('workPermits.project')}</label>
            <Select
              value={selectedProject?.id ?? ''}
              onChange={(e) => {
                const project = projects.find(p => p.id === parseInt(e.target.value))
                setSelectedProject(project)
              }}
            >
              <option value="">{t('workPermits.selectProject')}</option>
              {sortedProjects.map(project => (
                <option key={project.id} value={project.id}>
                  {getProjectLabel(project)}
                </option>
              ))}
            </Select>
          </div>

          {/* Week Navigation */}
          <div>
            <label className="label">{t('workPermits.week')}</label>
            <div className="flex items-center gap-2">
              <button
                onClick={() => handleWeekChange(-1)}
                className="btn-outline p-2"
              >
                <ChevronLeft className="w-5 h-5" />
              </button>
              <div className="flex-1 text-center font-semibold text-lg">
                S{String(weekNumber).padStart(2, '0')} - {year}
              </div>
              <button
                onClick={() => handleWeekChange(1)}
                className="btn-outline p-2"
              >
                <ChevronRight className="w-5 h-5" />
              </button>
            </div>
            {weekInfo?.current && (
              <p className="text-xs text-center text-gray-500 mt-1">
                {weekInfo.current.start_date} → {weekInfo.current.end_date}
              </p>
            )}
          </div>

          {/* Actions */}
          <div className="flex flex-wrap items-end gap-2 md:col-span-2 lg:col-span-1">
            <button
              onClick={() => handleOpenModal()}
              disabled={!selectedProject}
              className="btn-primary flex items-center gap-2 whitespace-nowrap"
            >
              <Plus className="w-4 h-4" />
              {t('workPermits.newPermit')}
            </button>
            <button
              onClick={handleLaunchWeek}
              disabled={!selectedProject || currentWeekPermits.length === 0}
              className="btn-success flex items-center gap-2 whitespace-nowrap"
            >
              <Rocket className="w-4 h-4" />
              {t('workPermits.launchWeek')}
            </button>
            <button
              onClick={handleExport}
              disabled={!selectedProject || currentWeekPermits.length === 0 || exporting}
              className="btn-secondary flex items-center gap-2 whitespace-nowrap"
            >
              {exporting ? <Loader2 className="w-4 h-4 animate-spin" /> : <Download className="w-4 h-4" />}
              {t('workPermits.exportExcel')}
            </button>
          </div>
        </div>
      </div>

      {selectedProject ? (
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          {/* Previous Week Permits */}
          <div className="card">
            <div className="card-header pb-2">
              <div className="flex items-center justify-between mb-2">
                <h3 className="font-semibold text-gray-900 dark:text-gray-100 text-sm">
                  {t('workPermits.previousWeekPermits')}
                  {weekInfo?.previous && (
                    <span className="text-xs font-normal text-gray-500 ml-1">
                      ({weekInfo.previous.week_label})
                    </span>
                  )}
                </h3>
                {selectedToCopy.length > 0 && (
                  <button
                    onClick={handleCopySelected}
                    disabled={copying}
                    className="btn-primary btn-xs flex items-center gap-1"
                  >
                    {copying ? <Loader2 className="w-3 h-3 animate-spin" /> : <Copy className="w-3 h-3" />}
                    {t('workPermits.copySelected')} ({selectedToCopy.length})
                  </button>
                )}
              </div>
              {/* Search & Select All */}
              <div className="flex items-center gap-2">
                <div className="relative flex-1">
                  <input
                    type="text"
                    value={searchPrevious}
                    onChange={(e) => setSearchPrevious(e.target.value)}
                    placeholder={t('common.search')}
                    className="input input-sm pl-8 h-8 text-xs"
                  />
                  <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-gray-400" />
                </div>
                <button
                  onClick={handleSelectAll}
                  disabled={filteredPreviousPermits.length === 0}
                  className={`btn-xs flex items-center gap-1 ${allSelected ? 'btn-primary' : 'btn-outline'}`}
                >
                  <Check className="w-3 h-3" />
                  {allSelected ? t('common.none') : t('common.all')}
                </button>
              </div>
            </div>
            <div className="card-body max-h-[600px] overflow-y-auto pt-2">
              {permitsLoading ? (
                <div className="flex justify-center py-4">
                  <Loader2 className="w-5 h-5 animate-spin text-hse-primary" />
                </div>
              ) : filteredPreviousPermits.length > 0 ? (
                <div className="space-y-2">
                  {filteredPreviousPermits.map(permit => (
                    <div
                      key={permit.id}
                      onClick={() => toggleSelectToCopy(permit.id)}
                      className={`p-2 rounded border cursor-pointer transition-colors ${
                        selectedToCopy.includes(permit.id)
                          ? 'border-hse-primary bg-hse-primary/5'
                          : 'border-gray-200 dark:border-gray-700 hover:bg-gray-50 dark:hover:bg-gray-800'
                      }`}
                    >
                      <div className="flex items-start gap-2">
                        <div className={`w-4 h-4 mt-0.5 rounded border flex-shrink-0 flex items-center justify-center ${
                          selectedToCopy.includes(permit.id)
                            ? 'bg-hse-primary border-hse-primary'
                            : 'border-gray-300 dark:border-gray-600'
                        }`}>
                          {selectedToCopy.includes(permit.id) && <Check className="w-2.5 h-2.5 text-white" />}
                        </div>
                        <div className="flex-1 min-w-0">
                          {/* Header */}
                          <div className="flex items-center gap-1.5 flex-wrap">
                            <span className="font-mono text-xs font-semibold">{permit.permit_number}</span>
                            <span className={`badge badge-xs ${getStatusBadge(permit.status)}`}>
                              {t(`workPermits.status.${permit.status}`)}
                            </span>
                          </div>
                          {/* Description - Most important */}
                          {permit.description && (
                            <p className="text-sm font-medium text-gray-800 dark:text-gray-200 mt-1">{permit.description}</p>
                          )}
                          {/* Info */}
                          <div className="flex flex-wrap items-center gap-x-2 gap-y-0.5 mt-1 text-xs text-gray-500 dark:text-gray-400">
                            <span>{permit.permit_user}</span>
                            {permit.area && <span className="text-gray-400">• {permit.area}</span>}
                            {permit.enterprise && <span className="text-gray-400">• {permit.enterprise}</span>}
                          </div>
                          {/* Permit types */}
                          <div className="flex flex-wrap gap-1 mt-1">
                            {getActiveTypes(permit).map((type, i) => (
                              <span key={i} className="text-[10px] bg-gray-100 dark:bg-gray-700 text-gray-600 dark:text-gray-300 px-1.5 py-0.5 rounded">
                                {type}
                              </span>
                            ))}
                          </div>
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              ) : (
                <div className="text-center py-4 text-gray-500 text-sm">
                  <p>{t('workPermits.noPermits')}</p>
                </div>
              )}
            </div>
          </div>

          {/* Current Week Permits */}
          <div className="card">
            <div className="card-header pb-2">
              <div className="flex items-center justify-between mb-2">
                <h3 className="font-semibold text-gray-900 dark:text-gray-100 text-sm">
                  {t('workPermits.currentWeekPermits')}
                  {weekInfo?.current && (
                    <span className="text-xs font-normal text-gray-500 ml-1">
                      ({weekInfo.current.week_label})
                    </span>
                  )}
                </h3>
                <span className="badge badge-info badge-xs">{filteredCurrentPermits.length}</span>
              </div>
              {/* Search */}
              <div className="relative">
                <input
                  type="text"
                  value={searchCurrent}
                  onChange={(e) => setSearchCurrent(e.target.value)}
                  placeholder={t('common.search')}
                  className="input input-sm pl-8 h-8 text-xs w-full"
                />
                <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-gray-400" />
              </div>
            </div>
            <div className="card-body max-h-[600px] overflow-y-auto pt-2">
              {permitsLoading ? (
                <div className="flex justify-center py-4">
                  <Loader2 className="w-5 h-5 animate-spin text-hse-primary" />
                </div>
              ) : filteredCurrentPermits.length > 0 ? (
                <div className="space-y-2">
                  {filteredCurrentPermits.map(permit => (
                    <div
                      key={permit.id}
                      className="p-2 rounded border border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-800"
                    >
                      <div className="flex items-start justify-between gap-2">
                        <div className="flex-1 min-w-0">
                          {/* Header: Permit number, status */}
                          <div className="flex items-center gap-1.5 flex-wrap">
                            <span className="font-mono text-xs font-semibold">{permit.permit_number}</span>
                            <span className={`badge badge-xs ${getStatusBadge(permit.status)}`}>
                              {t(`workPermits.status.${permit.status}`)}
                            </span>
                          </div>
                          {/* Description - Most important */}
                          {permit.description && (
                            <p className="text-sm font-medium text-gray-800 dark:text-gray-200 mt-1">{permit.description}</p>
                          )}
                          {/* Info row: user, signed by, area, enterprise, dates */}
                          <div className="flex flex-wrap items-center gap-x-3 gap-y-0.5 mt-1 text-xs text-gray-500 dark:text-gray-400">
                            <span className="flex items-center gap-0.5">
                              <User className="w-3 h-3" />
                              {permit.permit_user}
                            </span>
                            {permit.signed_by && (
                              <span className="flex items-center gap-0.5">
                                <PenLine className="w-3 h-3" />
                                {permit.signed_by}
                              </span>
                            )}
                            {permit.authorizer && (
                              <span className="flex items-center gap-0.5">
                                <Shield className="w-3 h-3" />
                                {permit.authorizer}
                              </span>
                            )}
                            {permit.area && (
                              <span className="flex items-center gap-0.5">
                                <MapPin className="w-3 h-3" />
                                {permit.area}
                              </span>
                            )}
                            {permit.enterprise && (
                              <span className="flex items-center gap-0.5">
                                <Building2 className="w-3 h-3" />
                                {permit.enterprise}
                              </span>
                            )}
                            <span className="flex items-center gap-0.5">
                              <Calendar className="w-3 h-3" />
                              {formatDate(permit.commence_date)} → {formatDate(permit.end_date)}
                            </span>
                          </div>
                          {/* Permit types */}
                          <div className="flex flex-wrap gap-1 mt-1">
                            {getActiveTypes(permit).map((type, i) => (
                              <span key={i} className="text-[10px] bg-blue-50 dark:bg-blue-900/30 text-blue-600 dark:text-blue-300 px-1.5 py-0.5 rounded">
                                {type}
                              </span>
                            ))}
                          </div>
                        </div>
                        {/* Actions */}
                        <div className="flex items-center gap-0.5 flex-shrink-0">
                          <button
                            onClick={() => handleOpenModal(permit)}
                            className="p-1.5 hover:bg-gray-100 dark:hover:bg-gray-700 rounded transition-colors"
                            title={t('workPermits.editPermit')}
                          >
                            <Edit2 className="w-3.5 h-3.5 text-gray-500" />
                          </button>
                          <button
                            onClick={() => handleDelete(permit)}
                            className="p-1.5 hover:bg-red-50 dark:hover:bg-red-900/20 rounded transition-colors"
                            title={t('workPermits.deletePermit')}
                          >
                            <Trash2 className="w-3.5 h-3.5 text-red-500" />
                          </button>
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              ) : (
                <div className="text-center py-4 text-gray-500 text-sm">
                  <p>{t('workPermits.noPermits')}</p>
                  <button
                    onClick={() => handleOpenModal()}
                    className="btn-primary btn-sm mt-2"
                  >
                    <Plus className="w-3 h-3 mr-1" />
                    {t('workPermits.newPermit')}
                  </button>
                </div>
              )}
            </div>
          </div>
        </div>
      ) : (
        <div className="card p-12 text-center">
          <AlertCircle className="w-16 h-16 mx-auto mb-4 text-gray-400" />
          <p className="text-gray-500 dark:text-gray-400">{t('workPermits.selectProject')}</p>
        </div>
      )}

      {/* Create/Edit Modal */}
      <Modal
        isOpen={showModal}
        onClose={() => setShowModal(false)}
        title={editingPermit ? t('workPermits.editPermit') : t('workPermits.newPermit')}
        size="lg"
      >
            <form onSubmit={handleSubmit} className="space-y-4">
                {/* Permit Types */}
                <div>
                  <label className="label">{t('workPermits.permitTypes')}</label>
                  <div className="grid grid-cols-2 gap-2">
                    {PERMIT_TYPES.map(pt => (
                      <div key={pt.key} className="flex items-center gap-2">
                        <input
                          type="checkbox"
                          id={pt.key}
                          checked={formData[pt.key]}
                          onChange={(e) => setFormData({ ...formData, [pt.key]: e.target.checked })}
                          disabled={pt.alwaysChecked}
                          className="w-4 h-4 text-hse-primary rounded"
                        />
                        <label htmlFor={pt.key} className="text-sm">
                          {t(`workPermits.types.${pt.labelKey}`)}
                        </label>
                      </div>
                    ))}
                  </div>
                </div>

                {/* Permit User, Signed By & Authorizer */}
                <div className="grid grid-cols-3 gap-4">
                  <div>
                    <label className="label">{t('workPermits.permitUser')} *</label>
                    <input
                      type="text"
                      value={formData.permit_user}
                      onChange={(e) => setFormData({ ...formData, permit_user: e.target.value })}
                      placeholder={t('workPermits.permitUserPlaceholder')}
                      className="input"
                      required
                    />
                  </div>
                  <div>
                    <label className="label">{t('workPermits.signedBy')}</label>
                    <input
                      type="text"
                      value={formData.signed_by}
                      onChange={(e) => setFormData({ ...formData, signed_by: e.target.value })}
                      placeholder={t('workPermits.signedByPlaceholder')}
                      className="input"
                    />
                  </div>
                  <div>
                    <label className="label">{t('workPermits.authorizer')}</label>
                    <input
                      type="text"
                      value={formData.authorizer}
                      onChange={(e) => setFormData({ ...formData, authorizer: e.target.value })}
                      placeholder={t('workPermits.authorizerPlaceholder')}
                      className="input"
                    />
                  </div>
                </div>

                {/* Enterprise */}
                <div>
                  <label className="label">{t('workPermits.enterprise')}</label>
                  <input
                    type="text"
                    value={formData.enterprise}
                    onChange={(e) => setFormData({ ...formData, enterprise: e.target.value })}
                    placeholder={t('workPermits.enterprisePlaceholder')}
                    className="input"
                  />
                </div>

                {/* Area */}
                <div>
                  <label className="label">{t('workPermits.area')}</label>
                  <input
                    type="text"
                    value={formData.area}
                    onChange={(e) => setFormData({ ...formData, area: e.target.value })}
                    placeholder={t('workPermits.areaPlaceholder')}
                    className="input"
                  />
                </div>

                {/* Dates */}
                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <label className="label">{t('workPermits.commenceDate')} *</label>
                    <DatePicker
                      value={formData.commence_date}
                      onChange={(val) => setFormData({ ...formData, commence_date: val })}
                      required
                    />
                  </div>
                  <div>
                    <label className="label">{t('workPermits.endDate')} *</label>
                    <DatePicker
                      value={formData.end_date}
                      onChange={(val) => setFormData({ ...formData, end_date: val })}
                      required
                    />
                  </div>
                </div>

                {/* Description */}
                <div>
                  <label className="label">{t('workPermits.description')}</label>
                  <textarea
                    value={formData.description}
                    onChange={(e) => setFormData({ ...formData, description: e.target.value })}
                    placeholder={t('workPermits.descriptionPlaceholder')}
                    rows={3}
                    className="input"
                  />
                </div>

              <div className="flex justify-end gap-2 pt-4 border-t border-gray-200 dark:border-gray-700">
                <button
                  type="button"
                  onClick={() => setShowModal(false)}
                  className="btn-outline"
                >
                  {t('common.cancel')}
                </button>
                <button
                  type="submit"
                  disabled={saving}
                  className="btn-primary flex items-center gap-2"
                >
                  {saving ? (
                    <Loader2 className="w-4 h-4 animate-spin" />
                  ) : (
                    <Check className="w-4 h-4" />
                  )}
                  {editingPermit ? t('common.update') : t('common.save')}
                </button>
              </div>
            </form>
      </Modal>

      <ConfirmDialog
        isOpen={!!confirmPermit}
        title={t('common.confirm')}
        message={t('workPermits.confirmDelete')}
        confirmLabel={t('common.delete')}
        cancelLabel={t('common.cancel')}
        variant="danger"
        onConfirm={confirmDelete}
        onCancel={() => setConfirmPermit(null)}
      />

      <ConfirmDialog
        isOpen={showLaunchConfirm}
        title={t('common.confirm')}
        message={t('workPermits.launchConfirm')}
        confirmLabel={t('workPermits.launchWeek')}
        cancelLabel={t('common.cancel')}
        variant="primary"
        onConfirm={confirmLaunchWeek}
        onCancel={() => setShowLaunchConfirm(false)}
      />
    </div>
  )
}
