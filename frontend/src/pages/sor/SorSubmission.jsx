import { useState, useEffect, useCallback, useMemo } from 'react'
import { useLanguage } from '../../i18n'
import { useAuthStore } from '../../store/authStore'
import api, { sorService, projectService, exportService, workerService } from '../../services/api'
import { getProjectLabel, sortProjects } from '../../utils/projectList'
import { DatePicker, TimePicker, Modal } from '../../components/ui'
import ConfirmDialog from '../../components/ui/ConfirmDialog'
import AutocompleteInput from '../../components/ui/AutocompleteInput'
import {
  AlertTriangle,
  Plus,
  Search,
  Filter,
  Calendar,
  Clock,
  MapPin,
  User,
  Building2,
  Camera,
  CheckCircle,
  XCircle,
  Loader2,
  ChevronDown,
  Eye,
  Edit,
  Trash2,
  X,
  Pin,
  ClipboardCheck,
  FileText,
  FileSpreadsheet,
  Upload
} from 'lucide-react'
import toast from 'react-hot-toast'

// Categories from Page 5
const CATEGORIES = [
  'nettoyage_rangement',
  'protection_chute',
  'echafaudage',
  'epi',
  'excavations',
  'levage',
  'methode_travail',
  'manutention',
  'vehicule_transport',
  'outils_equipements',
  'chute_trebuchement',
  'electricite',
  'protection_incendie',
  'communication_attitude',
  'acces_passage',
  'formation_toolbox',
  'inspection_evaluation',
  'documentation_hse',
  'gestion_sous_traitants',
  'autre',
]

 const sorPhotoBlobUrlCache = new Map()
 const SOR_PHOTO_CACHE_MAX = 50

 const normalizeSorPhotoPath = (url) => {
   let path = url?.replace(/^https?:\/\/[^/]+/, '')
   if (!path) return null

   if (path.startsWith('/api/')) {
     path = path.replace(/^\/api\//, '/')
   } else if (path === '/api') {
     path = '/'
   }
   return path
 }

 const getSorPhotoBlobUrl = async (url) => {
   const path = normalizeSorPhotoPath(url)
   if (!path) return null

   const cached = sorPhotoBlobUrlCache.get(path)
   if (cached) {
     sorPhotoBlobUrlCache.delete(path)
     sorPhotoBlobUrlCache.set(path, cached)
     return cached
   }

   const response = await api.get(path, { responseType: 'blob' })
   const objectUrl = window.URL.createObjectURL(response.data)
   sorPhotoBlobUrlCache.set(path, objectUrl)

   while (sorPhotoBlobUrlCache.size > SOR_PHOTO_CACHE_MAX) {
     const firstKey = sorPhotoBlobUrlCache.keys().next().value
     const firstUrl = sorPhotoBlobUrlCache.get(firstKey)
     if (firstUrl) window.URL.revokeObjectURL(firstUrl)
     sorPhotoBlobUrlCache.delete(firstKey)
   }

   return objectUrl
 }

export default function SorSubmission() {
  const { t, language } = useLanguage()
  const { user } = useAuthStore()
  const [bulkModalOpen, setBulkModalOpen] = useState(false)
  const [bulkFile, setBulkFile] = useState(null)
  const [bulkUploading, setBulkUploading] = useState(false)
  const [loading, setLoading] = useState(true)
  const [submitting, setSubmitting] = useState(false)
  const [reports, setReports] = useState([])
  const [projects, setProjects] = useState([])
  const [projectZones, setProjectZones] = useState([])
  const [companies, setCompanies] = useState([])
  const [showForm, setShowForm] = useState(false)
  const [editingReport, setEditingReport] = useState(null)
  const [viewingReport, setViewingReport] = useState(null)
  const [filters, setFilters] = useState({
    project_id: '',
    status: '',
    category: '',
  })

  // New workflow states
  const [showCorrectivePrompt, setShowCorrectivePrompt] = useState(false)
  const [pendingReport, setPendingReport] = useState(null)
  const [showCorrectiveModal, setShowCorrectiveModal] = useState(false)
  const [correctiveData, setCorrectiveData] = useState({
    corrective_action: '',
    corrective_action_date: new Date().toISOString().split('T')[0],
    corrective_action_time: '',
    corrective_action_photo: null,
  })
  const [correctivePhotoPreview, setCorrectivePhotoPreview] = useState(null)
  const [pinnedReports, setPinnedReports] = useState([])
  const [formStep, setFormStep] = useState(1) // 1 = Problem, 2 = Corrective Action
  const [exporting, setExporting] = useState(false)

  const [confirmDeleteReport, setConfirmDeleteReport] = useState(null)

  const extractFilename = (contentDisposition) => {
    if (!contentDisposition) return null
    const match = /filename\*=UTF-8''([^;]+)|filename="?([^";]+)"?/i.exec(contentDisposition)
    const value = decodeURIComponent(match?.[1] ?? match?.[2] ?? '')
    return value !== '' ? value : null
  }

  const normalizeApiPath = (url) => {
    let path = String(url || '').replace(/^https?:\/\/[^/]+/i, '')
    if (!path) return null
    if (path.startsWith('/api/')) {
      path = path.replace(/^\/api\//, '/')
    } else if (path === '/api') {
      path = '/'
    }
    return path
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

  const downloadFromUrl = async (url, fallbackFilename) => {
    const path = normalizeApiPath(url)
    if (!path) return
    const res = await api.get(path, { responseType: 'blob' })
    const filename = extractFilename(res.headers?.['content-disposition']) ?? fallbackFilename
    downloadBlob(res.data, filename)
  }

  const openBulkImport = () => {
    setBulkFile(null)
    setBulkModalOpen(true)
  }

  const handleDownloadTemplate = async () => {
    try {
      const res = await sorService.downloadTemplate()
      const filename = extractFilename(res.headers?.['content-disposition']) ?? 'SGTM-SOR-Template.xlsx'
      downloadBlob(res.data, filename)
    } catch (e) {
      toast.error(e.response?.data?.message ?? t('common.downloadTemplateFailed'))
    }
  }

  const handleBulkImport = async () => {
    if (!bulkFile) {
      toast.error(t('common.chooseFile'))
      return
    }

    try {
      setBulkUploading(true)
      const form = new FormData()
      form.append('file', bulkFile)
      const res = await sorService.bulkImport(form)
      const payload = res.data?.data ?? {}
      const imported = payload.imported ?? 0
      const updated = payload.updated ?? 0
      const errors = payload.errors ?? []
      const failedRowsUrl = payload.failed_rows_url
      toast.success(t('common.importSummary', { imported, updated }))
      if (errors.length > 0) toast.error(t('common.importIssues', { count: errors.length }))
      if (failedRowsUrl) {
        try {
          await downloadFromUrl(failedRowsUrl, 'sor_reports_failed_rows.xlsx')
        } catch {
          // ignore
        }
      }
      setBulkFile(null)
      setBulkModalOpen(false)
      fetchData()
      fetchPinnedReports()
    } catch (e) {
      toast.error(e.response?.data?.message ?? t('common.importFailed'))
    } finally {
      setBulkUploading(false)
    }
  }

  const projectListPreference = user?.project_list_preference ?? 'code'
  const sortedProjects = useMemo(() => {
    return sortProjects(projects, projectListPreference)
  }, [projects, projectListPreference])

  const [formData, setFormData] = useState({
    project_id: '',
    company: '',
    observation_date: new Date().toISOString().split('T')[0],
    observation_time: '',
    zone: '',
    supervisor: user?.name ?? '',
    non_conformity: '',
    photo: null,
    category: '',
    responsible_person: '',
    corrective_action: '',
    corrective_action_date: '',
    corrective_action_time: '',
    corrective_action_photo: null,
  })

  const [photoPreview, setPhotoPreview] = useState(null)
  const [viewProblemPhotoUrl, setViewProblemPhotoUrl] = useState(null)
  const [viewCorrectivePhotoUrl, setViewCorrectivePhotoUrl] = useState(null)

  const dateLocale = language === 'fr' ? 'fr-FR' : 'en-GB'

  const formatDate = useCallback((value) => {
    if (!value) return ''
    try {
      return new Date(value).toLocaleDateString(dateLocale)
    } catch {
      return ''
    }
  }, [dateLocale])

  const getCategoryLabel = useCallback((key) => {
    if (!key) return ''
    return t(`sor.categories.${key}`)
  }, [t])

  const handleDeleteReport = (report) => {
    setConfirmDeleteReport(report)
  }

  const confirmDelete = async () => {
    if (!confirmDeleteReport?.id) return
    try {
      await sorService.delete(confirmDeleteReport.id)
      toast.success(t('common.saved'))
      fetchData()
      fetchPinnedReports()
    } catch (error) {
      console.error('Failed to delete SOR report', error)
      toast.error(t('errors.failedToDelete') ?? t('common.error'))
    } finally {
      setConfirmDeleteReport(null)
    }
  }

  // ESC key handler for all modals
  useEffect(() => {
    const handleKeyDown = (e) => {
      if (e.key === 'Escape') {
        if (showForm) { setShowForm(false); resetForm() }
        if (showCorrectivePrompt) { setShowCorrectivePrompt(false); resetCorrectiveData(); resetForm() }
        if (showCorrectiveModal) { setShowCorrectiveModal(false); resetCorrectiveData(); setPendingReport(null) }
        if (viewingReport) { setViewingReport(null) }
      }
    }
    document.addEventListener('keydown', handleKeyDown)
    return () => document.removeEventListener('keydown', handleKeyDown)
  }, [showForm, showCorrectivePrompt, showCorrectiveModal, viewingReport])

  useEffect(() => {
    let cancelled = false

    const load = async () => {
      setViewProblemPhotoUrl(null)
      setViewCorrectivePhotoUrl(null)

      if (!viewingReport) return

      try {
        if (viewingReport.photo_view_url) {
          const url = await getSorPhotoBlobUrl(viewingReport.photo_view_url)
          if (!cancelled) setViewProblemPhotoUrl(url)
        }
      } catch (e) {
        console.error('Error loading problem photo:', e)
      }

      try {
        if (viewingReport.corrective_action_photo_view_url) {
          const url = await getSorPhotoBlobUrl(viewingReport.corrective_action_photo_view_url)
          if (!cancelled) setViewCorrectivePhotoUrl(url)
        }
      } catch (e) {
        console.error('Error loading corrective photo:', e)
      }
    }

    load()

    return () => {
      cancelled = true
    }
  }, [viewingReport])

  useEffect(() => {
    return () => {
      for (const url of sorPhotoBlobUrlCache.values()) {
        try {
          window.URL.revokeObjectURL(url)
        } catch {
          // ignore
        }
      }
      sorPhotoBlobUrlCache.clear()
    }
  }, [])

  useEffect(() => {
    fetchData()
  }, [filters])

  useEffect(() => {
    fetchProjects()
    fetchPinnedReports()
  }, [])

  // Fetch zones when form opens with a project selected
  useEffect(() => {
    if (showForm && formData.project_id) {
      fetchProjectZones(formData.project_id)
    }
  }, [showForm])

  const fetchProjects = async () => {
    try {
      const [projectsRes, companiesRes] = await Promise.all([
        projectService.getAll({ per_page: 100 }),
        workerService.getEntreprises()
      ])
      
      const projectList = projectsRes.data.data ?? []
      setProjects(projectList)
      setCompanies(companiesRes.data.data ?? [])
      
      // Auto-select project if user has only one and fetch its zones
      if (projectList.length === 1) {
        const projectId = projectList[0].id.toString()
        setFormData(prev => ({ ...prev, project_id: projectId }))
        fetchProjectZones(projectId)
      }
    } catch (error) {
      console.error('Error fetching projects:', error)
    }
  }

  const fetchPinnedReports = async () => {
    try {
      const response = await sorService.getPinned()
      setPinnedReports(response.data.data ?? [])
    } catch (error) {
      console.error('Error fetching pinned reports:', error)
    }
  }

  const fetchProjectZones = async (projectId) => {
    if (!projectId) {
      setProjectZones([])
      return
    }
    try {
      const response = await projectService.getZones(projectId)
      setProjectZones(response.data?.data?.zones ?? [])
    } catch (error) {
      console.error('Error fetching project zones:', error)
      setProjectZones([])
    }
  }

  const fetchData = async () => {
    setLoading(true)
    try {
      const params = {}
      if (filters.project_id) params.project_id = filters.project_id
      if (filters.status) params.status = filters.status
      if (filters.category) params.category = filters.category

      const response = await sorService.getAll(params)
      setReports(response.data.data ?? [])
    } catch (error) {
      console.error('Error fetching SOR reports:', error)
      toast.error(t('errors.fetchFailed'))
    } finally {
      setLoading(false)
    }
  }

  const handleInputChange = (field, value) => {
    setFormData(prev => ({ ...prev, [field]: value }))
    
    // Fetch zones when project changes
    if (field === 'project_id') {
      fetchProjectZones(value)
      setFormData(prev => ({ ...prev, zone: '' })) // Reset zone when project changes
    }
  }

  const handlePhotoChange = (e) => {
    const file = e.target.files[0]
    if (file) {
      setFormData(prev => ({ ...prev, photo: file }))
      const reader = new FileReader()
      reader.onloadend = () => setPhotoPreview(reader.result)
      reader.readAsDataURL(file)
    }
  }

  const handlePhotoDrop = (e) => {
    e.preventDefault()
    e.stopPropagation()
    const file = e.dataTransfer?.files?.[0]
    if (!file) return
    if (!file.type?.startsWith('image/')) {
      toast.error(t('errors.invalidFileType'))
      return
    }
    setFormData(prev => ({ ...prev, photo: file }))
    const reader = new FileReader()
    reader.onloadend = () => setPhotoPreview(reader.result)
    reader.readAsDataURL(file)
  }

  const resetForm = () => {
    setFormData({
      project_id: projects.length === 1 ? projects[0].id.toString() : '',
      company: '',
      observation_date: new Date().toISOString().split('T')[0],
      observation_time: '',
      zone: '',
      supervisor: user?.name ?? '',
      non_conformity: '',
      photo: null,
      category: '',
      responsible_person: '',
      corrective_action: '',
      corrective_action_date: '',
      corrective_action_time: '',
      corrective_action_photo: null,
    })
    setPhotoPreview(null)
    setCorrectivePhotoPreview(null)
    setEditingReport(null)
  }

  // Handle problem form submission - shows corrective action prompt
  const handleSubmitProblem = async (e) => {
    e.preventDefault()
    
    if (!formData.project_id || !formData.observation_date || !formData.non_conformity || !formData.category) {
      toast.error(t('sor.fillRequired'))
      return
    }

    if (editingReport) {
      // Direct update for editing
      setSubmitting(true)
      try {
        await sorService.update(editingReport.id, formData)
        toast.success(t('sor.updateSuccess'))
        resetForm()
        setShowForm(false)
        fetchData()
        fetchPinnedReports()
      } catch (error) {
        const message = error.response?.data?.message || t('errors.somethingWentWrong')
        toast.error(message)
      } finally {
        setSubmitting(false)
      }
    } else {
      // Show corrective action prompt for new reports
      setShowForm(false)
      setShowCorrectivePrompt(true)
    }
  }

  // Submit with corrective action (close immediately)
  const handleSubmitWithCorrective = async () => {
    // Validate form data before submission
    if (!formData.project_id || !formData.observation_date || !formData.non_conformity || !formData.category) {
      toast.error(t('sor.fillRequired'))
      setShowCorrectivePrompt(false)
      setShowForm(true)
      return
    }
    
    setSubmitting(true)
    try {
      const data = {
        ...formData,
        ...correctiveData,
        submit_corrective_action: true,
      }
      await sorService.create(data)
      toast.success(t('sor.createClosedSuccess'))
      resetForm()
      resetCorrectiveData()
      setShowCorrectivePrompt(false)
      setFormStep(1)
      fetchData()
      fetchPinnedReports()
    } catch (error) {
      console.error('SOR submit error:', error.response?.data)
      const errors = error.response?.data?.errors
      if (errors) {
        const firstError = Object.values(errors)[0]
        toast.error(Array.isArray(firstError) ? firstError[0] : firstError)
      } else {
        toast.error(error.response?.data?.message || t('errors.somethingWentWrong'))
      }
    } finally {
      setSubmitting(false)
    }
  }

  // Submit for later (pin the SOR)
  const handleSubmitLater = async () => {
    // Validate form data before submission
    if (!formData.project_id || !formData.observation_date || !formData.non_conformity || !formData.category) {
      toast.error(t('sor.fillRequired'))
      setShowCorrectivePrompt(false)
      setShowForm(true)
      return
    }
    
    setSubmitting(true)
    try {
      const data = {
        ...formData,
        submit_later: true,
      }
      console.log('Submitting SOR data:', data)
      await sorService.create(data)
      toast.success(t('sor.createPinnedSuccess'))
      resetForm()
      setShowCorrectivePrompt(false)
      setFormStep(1)
      fetchData()
      fetchPinnedReports()
    } catch (error) {
      console.error('SOR submit later error:', error.response?.data)
      const errors = error.response?.data?.errors
      if (errors) {
        const firstError = Object.values(errors)[0]
        toast.error(Array.isArray(firstError) ? firstError[0] : firstError)
      } else {
        toast.error(error.response?.data?.message || t('errors.somethingWentWrong'))
      }
    } finally {
      setSubmitting(false)
    }
  }

  // Submit corrective action for a pinned report
  const handleSubmitCorrectiveAction = async (e) => {
    e.preventDefault()
    if (!correctiveData.corrective_action) {
      toast.error(t('sor.correctiveRequired'))
      return
    }

    setSubmitting(true)
    try {
      await sorService.submitCorrectiveAction(pendingReport.id, correctiveData)
      toast.success(t('sor.correctiveSubmitted'))
      resetCorrectiveData()
      setPendingReport(null)
      setShowCorrectiveModal(false)
      fetchData()
      fetchPinnedReports()
    } catch (error) {
      const message = error.response?.data?.message || t('errors.somethingWentWrong')
      toast.error(message)
    } finally {
      setSubmitting(false)
    }
  }

  const resetCorrectiveData = () => {
    setCorrectiveData({
      corrective_action: '',
      corrective_action_date: new Date().toISOString().split('T')[0],
      corrective_action_time: '',
      corrective_action_photo: null,
    })
    setCorrectivePhotoPreview(null)
  }

  const handleCorrectivePhotoChange = (e) => {
    const file = e.target.files[0]
    if (file) {
      setCorrectiveData(prev => ({ ...prev, corrective_action_photo: file }))
      const reader = new FileReader()
      reader.onloadend = () => setCorrectivePhotoPreview(reader.result)
      reader.readAsDataURL(file)
    }
  }

  const handleCorrectivePhotoDrop = (e) => {
    e.preventDefault()
    e.stopPropagation()
    const file = e.dataTransfer?.files?.[0]
    if (!file) return
    if (!file.type?.startsWith('image/')) {
      toast.error(t('errors.invalidFileType'))
      return
    }
    setCorrectiveData(prev => ({ ...prev, corrective_action_photo: file }))
    const reader = new FileReader()
    reader.onloadend = () => setCorrectivePhotoPreview(reader.result)
    reader.readAsDataURL(file)
  }

  const openCorrectiveModal = (report) => {
    setPendingReport(report)
    setCorrectiveData({
      corrective_action: report?.corrective_action ?? '',
      corrective_action_date: report?.corrective_action_date
        ? report.corrective_action_date.split('T')[0]
        : new Date().toISOString().split('T')[0],
      corrective_action_time: report?.corrective_action_time ?? '',
      corrective_action_photo: null,
    })
    setCorrectivePhotoPreview(null)
    setShowCorrectiveModal(true)
  }

  const handleEdit = (report) => {
    // Fetch zones for the report's project
    fetchProjectZones(report.project_id)
    
    setFormData({
      project_id: report.project_id,
      company: report.company ?? '',
      observation_date: report.observation_date?.split('T')[0] ?? '',
      observation_time: report.observation_time ?? '',
      zone: report.zone ?? '',
      supervisor: report.supervisor ?? '',
      non_conformity: report.non_conformity ?? '',
      photo: null,
      category: report.category ?? '',
      responsible_person: report.responsible_person ?? '',
      corrective_action: report.corrective_action ?? '',
      corrective_action_date: report.corrective_action_date
        ? report.corrective_action_date.split('T')[0]
        : '',
      corrective_action_time: report.corrective_action_time ?? '',
      corrective_action_photo: null,
    })
    setCorrectivePhotoPreview(null)
    setEditingReport(report)
    setShowForm(true)
  }

  const handleProblemPhotoDrop = (e) => {
    handlePhotoDrop(e)
  }

  const handleUnifiedCorrectivePhotoChange = (e) => {
    const file = e.target.files[0]
    if (file) {
      setFormData(prev => ({ ...prev, corrective_action_photo: file }))
      const reader = new FileReader()
      reader.onloadend = () => setCorrectivePhotoPreview(reader.result)
      reader.readAsDataURL(file)
    }
  }

  const handleUnifiedCorrectivePhotoDrop = (e) => {
    e.preventDefault()
    e.stopPropagation()
    const file = e.dataTransfer?.files?.[0]
    if (!file) return
    if (!file.type?.startsWith('image/')) {
      toast.error(t('errors.invalidFileType'))
      return
    }
    setFormData(prev => ({ ...prev, corrective_action_photo: file }))
    const reader = new FileReader()
    reader.onloadend = () => setCorrectivePhotoPreview(reader.result)
    reader.readAsDataURL(file)
  }

  const handleMarkAsClosed = (report) => {
    // Open corrective action modal to require corrective action before closing
    setPendingReport(report)
    resetCorrectiveData()
    setShowCorrectiveModal(true)
  }

  const getStatusBadge = (status) => {
    const styles = {
      open: 'bg-red-100 text-red-700',
      in_progress: 'bg-amber-100 text-amber-700',
      closed: 'bg-green-100 text-green-700',
    }
    const labels = {
      open: t('sor.status.open'),
      in_progress: t('sor.status.inProgress'),
      closed: t('sor.status.closed'),
    }
    return (
      <span className={`px-2 py-1 rounded-full text-xs font-medium ${styles[status]}`}>
        {labels[status]}
      </span>
    )
  }

  const handleExportSor = async () => {
    try {
      setExporting(true)
      const params = {}
      if (filters.project_id) params.project_id = filters.project_id
      if (filters.status) params.status = filters.status
      if (filters.category) params.category = filters.category

      const response = await exportService.exportDeviations(params)
      const blob = new Blob([response.data], {
        type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
      })
      const url = window.URL.createObjectURL(blob)
      const a = document.createElement('a')
      a.href = url
      a.download = 'deviations.xlsx'
      a.click()
      window.URL.revokeObjectURL(url)
    } catch (error) {
      console.error('Error exporting deviations:', error)
      toast.error(t('errors.somethingWentWrong'))
    } finally {
      setExporting(false)
    }
  }

  return (
    <div className="p-6 max-w-7xl mx-auto">
      {/* Header */}
      <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-4 mb-6">
        <div>
          <h1 className="text-2xl font-bold text-gray-900 dark:text-gray-100 flex items-center gap-2">
            <AlertTriangle className="w-7 h-7 text-amber-500" />
            {t('sor.title')}
          </h1>
          <p className="text-gray-500 dark:text-gray-400 mt-1">{t('sor.subtitle')}</p>
        </div>

      {bulkModalOpen && (
        <Modal isOpen={bulkModalOpen} onClose={() => setBulkModalOpen(false)} title="Massive Add" size="xl">
          <div className="space-y-4">
            <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
              <button type="button" onClick={handleDownloadTemplate} className="btn-secondary flex items-center justify-center gap-2">
                <FileSpreadsheet className="w-4 h-4" />
                <span>{t('common.downloadTemplate') ?? 'Download template'}</span>
              </button>

              <label className="flex items-center justify-between border-2 border-dashed border-gray-300 dark:border-gray-600 rounded-lg px-3 py-2 text-xs cursor-pointer hover:border-hse-primary hover:bg-hse-primary/5">
                <div className="flex items-center gap-2">
                  <Upload className="w-4 h-4 text-gray-500" />
                  <span className="text-gray-700 dark:text-gray-200">
                    {bulkFile ? bulkFile.name : (t('common.chooseFile') ?? 'Choose Excel file')}
                  </span>
                </div>
                <input
                  type="file"
                  accept=".xlsx,.xls"
                  className="hidden"
                  onChange={(e) => setBulkFile(e.target.files?.[0] ?? null)}
                />
              </label>

              <button type="button" onClick={handleBulkImport} disabled={bulkUploading || !bulkFile} className="btn-primary">
                {bulkUploading ? (t('common.loading') ?? 'Importing...') : (t('common.import') ?? 'Import')}
              </button>
            </div>
          </div>
        </Modal>
      )}
        <button
          onClick={(e) => {
            // Ctrl+Click reserved for future "Massive Add" modal
            if (e?.ctrlKey) {
              openBulkImport()
              return
            }
            resetForm()
            setShowForm(true)
          }}
          className="btn btn-primary flex items-center gap-2"
        >
          <Plus className="w-5 h-5" />
          {t('sor.addNew')}
        </button>
      </div>

      {/* Pinned Reports Section */}
      {pinnedReports.length > 0 && (
        <div className="bg-amber-50 dark:bg-amber-900/20 border border-amber-200 dark:border-amber-700 rounded-xl p-4 mb-6">
          <div className="flex items-center gap-2 mb-3">
            <Pin className="w-5 h-5 text-amber-600 dark:text-amber-400" />
            <h3 className="font-semibold text-amber-800 dark:text-amber-300">{t('sor.pendingCorrective')}</h3>
            <span className="bg-amber-200 dark:bg-amber-700 text-amber-800 dark:text-amber-100 text-xs font-bold px-2 py-0.5 rounded-full">{pinnedReports.length}</span>
          </div>
          <div className="grid gap-2">
            {pinnedReports.map(report => (
              <div key={report.id} className="bg-white dark:bg-gray-800 rounded-lg p-3 flex items-center justify-between border border-amber-100 dark:border-gray-700">
                <div className="flex-1">
                  <div className="flex items-center gap-2">
                    <span className="font-medium dark:text-gray-100">{report.project?.name}</span>
                    <span className="text-xs text-gray-500 dark:text-gray-400">
                      {formatDate(report.observation_date)}
                    </span>
                  </div>
                  <p className="text-sm text-gray-600 dark:text-gray-400 truncate max-w-md">{report.non_conformity}</p>
                </div>
                <button
                  onClick={() => openCorrectiveModal(report)}
                  className="btn btn-primary btn-sm flex items-center gap-1"
                >
                  <ClipboardCheck className="w-4 h-4" />
                  {t('sor.addCorrective')}
                </button>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Filters */}
      <div className="bg-white dark:bg-gray-800 rounded-xl shadow-sm border dark:border-gray-700 p-4 mb-6">
        <div className="grid grid-cols-1 md:grid-cols-5 gap-4">
          <div>
            <label className="label">{t('sor.project')}</label>
            <select
              value={filters.project_id}
              onChange={(e) => setFilters(prev => ({ ...prev, project_id: e.target.value }))}
              className="input"
            >
              <option value="">{t('common.all')}</option>
              {sortedProjects.map(project => (
                <option key={project.id} value={project.id}>{getProjectLabel(project)}</option>
              ))}
            </select>
          </div>
          <div>
            <label className="label">{t('sor.status.label')}</label>
            <select
              value={filters.status}
              onChange={(e) => setFilters(prev => ({ ...prev, status: e.target.value }))}
              className="input"
            >
              <option value="">{t('common.all')}</option>
              <option value="open">{t('sor.status.open')}</option>
              <option value="in_progress">{t('sor.status.inProgress')}</option>
              <option value="closed">{t('sor.status.closed')}</option>
            </select>
          </div>
          <div>
            <label className="label">{t('sor.category')}</label>
            <select
              value={filters.category}
              onChange={(e) => setFilters(prev => ({ ...prev, category: e.target.value }))}
              className="input"
            >
              <option value="">{t('common.all')}</option>
              {CATEGORIES.map((key) => (
                <option key={key} value={key}>{getCategoryLabel(key)}</option>
              ))}
            </select>
          </div>
          <div className="flex items-end gap-2">
            <button
              onClick={() => setFilters({ project_id: '', status: '', category: '' })}
              className="btn btn-outline w-full"
              type="button"
            >
              {t('common.reset')}
            </button>
            <button
              type="button"
              onClick={handleExportSor}
              disabled={exporting || reports.length === 0}
              className="btn-secondary w-full flex items-center justify-center gap-2 text-sm"
            >
              <FileSpreadsheet className="w-4 h-4" />
              <span>{t('dashboard.exportExcel')}</span>
            </button>
          </div>
        </div>
      </div>

      {/* Reports Table */}
      <div className="bg-white dark:bg-gray-800 rounded-xl shadow-sm border dark:border-gray-700 overflow-hidden">
        {loading ? (
          <div className="flex items-center justify-center py-12">
            <Loader2 className="w-8 h-8 animate-spin text-hse-primary" />
          </div>
        ) : reports.length === 0 ? (
          <div className="text-center py-12">
            <AlertTriangle className="w-12 h-12 text-gray-300 dark:text-gray-600 mx-auto mb-4" />
            <p className="text-gray-500 dark:text-gray-400">{t('sor.noReports')}</p>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full">
              <thead className="bg-gray-50 dark:bg-gray-900 border-b dark:border-gray-700">
                <tr>
                  <th className="px-4 py-3 text-left text-xs font-semibold text-gray-600 dark:text-gray-400 uppercase">{t('sor.date')}</th>
                  <th className="px-4 py-3 text-left text-xs font-semibold text-gray-600 dark:text-gray-400 uppercase">{t('sor.project')}</th>
                  <th className="px-4 py-3 text-left text-xs font-semibold text-gray-600 dark:text-gray-400 uppercase">{t('sor.zone')}</th>
                  <th className="px-4 py-3 text-left text-xs font-semibold text-gray-600 dark:text-gray-400 uppercase">{t('sor.category')}</th>
                  <th className="px-4 py-3 text-left text-xs font-semibold text-gray-600 dark:text-gray-400 uppercase">{t('sor.nonConformity')}</th>
                  <th className="px-4 py-3 text-left text-xs font-semibold text-gray-600 dark:text-gray-400 uppercase">{t('sor.status.label')}</th>
                  <th className="px-4 py-3 text-center text-xs font-semibold text-gray-600 dark:text-gray-400 uppercase">{t('common.actions')}</th>
                </tr>
              </thead>
              <tbody className="divide-y dark:divide-gray-700">
                {reports.map((report) => (
                  <tr key={report.id} className="hover:bg-gray-50 dark:hover:bg-gray-700/50">
                    <td className="px-4 py-3 text-sm dark:text-gray-300">
                      {formatDate(report.observation_date)}
                    </td>
                    <td className="px-4 py-3 text-sm font-medium dark:text-gray-100">{report.project?.name}</td>
                    <td className="px-4 py-3 text-sm dark:text-gray-300">{report.zone ?? ''}</td>
                    <td className="px-4 py-3 text-sm">
                      <span className="px-2 py-1 bg-gray-100 dark:bg-gray-700 dark:text-gray-300 rounded text-xs">
                        {getCategoryLabel(report.category) || report.category}
                      </span>
                    </td>
                    <td className="px-4 py-3 text-sm max-w-xs truncate dark:text-gray-300">{report.non_conformity}</td>
                    <td className="px-4 py-3">{getStatusBadge(report.status)}</td>
                    <td className="px-4 py-3">
                      <div className="flex items-center justify-center gap-1">
                        <button
                          onClick={() => setViewingReport(report)}
                          className="p-1.5 text-gray-500 dark:text-gray-400 hover:text-blue-600 hover:bg-blue-50 dark:hover:bg-blue-900/30 rounded"
                          title={t('common.view')}
                        >
                          <Eye className="w-4 h-4" />
                        </button>
                        <button
                          onClick={() => handleEdit(report)}
                          className="p-1.5 text-gray-500 dark:text-gray-400 hover:text-amber-600 hover:bg-amber-50 dark:hover:bg-amber-900/30 rounded"
                          title={t('common.edit')}
                        >
                          <Edit className="w-4 h-4" />
                        </button>
                        {report.status !== 'closed' && (
                          <button
                            onClick={() => handleMarkAsClosed(report)}
                            className="p-1.5 text-gray-500 dark:text-gray-400 hover:text-green-600 hover:bg-green-50 dark:hover:bg-green-900/30 rounded"
                            title={t('sor.markClosed')}
                          >
                            <CheckCircle className="w-4 h-4" />
                          </button>
                        )}

                        <button
                          onClick={() => handleDeleteReport(report)}
                          className="p-1.5 text-gray-500 dark:text-gray-400 hover:text-red-600 hover:bg-red-50 dark:hover:bg-red-900/30 rounded"
                          title={t('common.delete')}
                        >
                          <Trash2 className="w-4 h-4" />
                        </button>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {/* Form Modal */}
      <Modal
        isOpen={showForm}
        onClose={() => {
          setShowForm(false)
          resetForm()
        }}
        title={editingReport ? t('sor.editReport') : t('sor.newReport')}
        size="xl"
      >
            <form onSubmit={handleSubmitProblem} className="space-y-6">
              {/* Project & Company */}
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div>
                  <label className="label">{t('sor.project')} *</label>
                  <select
                    value={formData.project_id}
                    onChange={(e) => handleInputChange('project_id', e.target.value)}
                    className="input"
                    required
                  >
                    <option value="">{t('sor.selectProject')}</option>
                    {sortedProjects.map(project => (
                      <option key={project.id} value={project.id}>{getProjectLabel(project)}</option>
                    ))}
                  </select>
                </div>
                <div>
                  <label className="label">{t('sor.company')}</label>
                  <AutocompleteInput
                    value={formData.company}
                    onChange={(value) => handleInputChange('company', value)}
                    suggestions={companies}
                    placeholder="SGTM, Sous-traitant..."
                    defaultValue="SGTM"
                    icon={<Building2 className="w-4 h-4" />}
                  />
                </div>
              </div>

              {/* Date, Time, Zone */}
              <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                <div>
                  <label className="label flex items-center gap-2">
                    <Calendar className="w-4 h-4" />
                    {t('sor.date')} *
                  </label>
                  <DatePicker
                    value={formData.observation_date}
                    onChange={(val) => handleInputChange('observation_date', val)}
                    required
                  />
                </div>
                <div>
                  <label className="label flex items-center gap-2">
                    <Clock className="w-4 h-4" />
                    {t('sor.time')}
                  </label>
                  <TimePicker
                    value={formData.observation_time}
                    onChange={(val) => handleInputChange('observation_time', val)}
                  />
                </div>
                <div>
                  <label className="label flex items-center gap-2">
                    <MapPin className="w-4 h-4" />
                    {t('sor.zone')}
                  </label>
                  <AutocompleteInput
                    value={formData.zone}
                    onChange={(value) => handleInputChange('zone', value)}
                    suggestions={projectZones}
                    placeholder={t('sor.zonePlaceholder') || 'Zone de travail...'}
                    disabled={!formData.project_id}
                  />
                </div>
              </div>

              {/* Supervisor */}
              <div>
                <label className="label flex items-center gap-2">
                  <User className="w-4 h-4" />
                  {t('sor.supervisor')}
                </label>
                <input
                  type="text"
                  value={formData.supervisor}
                  onChange={(e) => handleInputChange('supervisor', e.target.value)}
                  className="input"
                  placeholder={t('sor.supervisorPlaceholder')}
                />
              </div>

              {/* Non-Conformity */}
              <div>
                <label className="label">{t('sor.nonConformity')} *</label>
                <textarea
                  value={formData.non_conformity}
                  onChange={(e) => handleInputChange('non_conformity', e.target.value)}
                  className="input min-h-[100px]"
                  placeholder={t('sor.nonConformityPlaceholder')}
                  required
                />
              </div>

              {/* Photo Upload */}
              <div>
                <label className="label flex items-center gap-2">
                  <Camera className="w-4 h-4" />
                  {t('sor.photo')}
                </label>
                <label
                  className="flex items-center justify-center border-2 border-dashed border-gray-300 dark:border-gray-600 rounded-lg p-4 cursor-pointer hover:border-hse-primary hover:bg-hse-primary/5 transition-colors"
                  onDragOver={(e) => e.preventDefault()}
                  onDrop={handleProblemPhotoDrop}
                >
                  <input
                    type="file"
                    accept="image/*"
                    onChange={handlePhotoChange}
                    className="hidden"
                  />
                  {photoPreview ? (
                    <div className="flex items-center gap-3">
                      <img src={photoPreview} alt="Preview" className="w-12 h-12 object-cover rounded" />
                      <span className="text-sm text-gray-600 dark:text-gray-400">{t('sor.changePhoto')}</span>
                    </div>
                  ) : (
                    <div className="text-center">
                      <Camera className="w-8 h-8 mx-auto text-gray-400 mb-2" />
                      <p className="text-sm text-gray-500 dark:text-gray-400">{t('sor.uploadPhoto')}</p>
                    </div>
                  )}
                </label>
              </div>

              {/* Category */}
              <div>
                <label className="label">{t('sor.category')} *</label>
                <select
                  value={formData.category}
                  onChange={(e) => handleInputChange('category', e.target.value)}
                  className="input"
                  required
                >
                  <option value="">{t('sor.selectCategory')}</option>
                  {CATEGORIES.map((key) => (
                    <option key={key} value={key}>{getCategoryLabel(key)}</option>
                  ))}
                </select>
              </div>

              {/* Responsible Person */}
              <div>
                <label className="label">{t('sor.responsiblePerson')}</label>
                <input
                  type="text"
                  value={formData.responsible_person}
                  onChange={(e) => handleInputChange('responsible_person', e.target.value)}
                  className="input"
                  placeholder={t('sor.responsiblePersonPlaceholder')}
                />
              </div>

              {/* Corrective Action (edit mode only) */}
              {editingReport && (
                <div className="bg-green-50 dark:bg-green-900/20 border border-green-200 dark:border-green-800 rounded-lg p-4 space-y-4">
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    <div>
                      <label className="label">{t('sor.correctiveDate')}</label>
                      <DatePicker
                        value={formData.corrective_action_date}
                        onChange={(val) => handleInputChange('corrective_action_date', val)}
                      />
                    </div>
                    <div>
                      <label className="label">{t('sor.correctiveTime')}</label>
                      <TimePicker
                        value={formData.corrective_action_time}
                        onChange={(val) => handleInputChange('corrective_action_time', val)}
                      />
                    </div>
                  </div>

                  <div>
                    <label className="label">{t('sor.correctiveAction')}</label>
                    <textarea
                      value={formData.corrective_action}
                      onChange={(e) => handleInputChange('corrective_action', e.target.value)}
                      className="input min-h-[80px]"
                      placeholder={t('sor.correctiveActionPlaceholder')}
                    />
                  </div>

                  <div>
                    <label className="label">{t('sor.correctivePhoto')}</label>
                    <label
                      className="flex items-center justify-center border-2 border-dashed border-green-200 dark:border-green-800 rounded-lg p-3 cursor-pointer hover:border-hse-primary transition-colors bg-white/60 dark:bg-gray-900/20"
                      onDragOver={(e) => e.preventDefault()}
                      onDrop={handleUnifiedCorrectivePhotoDrop}
                    >
                      <input
                        type="file"
                        accept="image/*"
                        onChange={handleUnifiedCorrectivePhotoChange}
                        className="hidden"
                      />
                      {correctivePhotoPreview ? (
                        <div className="flex items-center gap-3">
                          <img src={correctivePhotoPreview} alt="Preview" className="w-12 h-12 object-cover rounded" />
                          <span className="text-sm text-gray-600 dark:text-gray-400">{t('sor.changePhoto')}</span>
                        </div>
                      ) : (
                        <>
                          <Camera className="w-5 h-5 text-gray-400 mr-2" />
                          <span className="text-sm text-gray-500 dark:text-gray-400">{t('sor.uploadPhoto')}</span>
                        </>
                      )}
                    </label>
                  </div>
                </div>
              )}

              {/* Submit */}
              <div className="flex justify-end gap-3 pt-4 border-t">
                <button
                  type="button"
                  onClick={() => { setShowForm(false); resetForm() }}
                  className="btn btn-outline"
                >
                  {t('common.cancel')}
                </button>
                <button
                  type="submit"
                  disabled={submitting}
                  className="btn btn-primary flex items-center gap-2"
                >
                  {submitting ? (
                    <>
                      <Loader2 className="w-4 h-4 animate-spin" />
                      {t('common.saving')}
                    </>
                  ) : (
                    <>
                      <CheckCircle className="w-4 h-4" />
                      {editingReport ? t('common.update') : t('common.submit')}
                    </>
                  )}
                </button>
              </div>
            </form>
      </Modal>

      {/* View Modal */}
      <Modal
        isOpen={!!viewingReport}
        onClose={() => setViewingReport(null)}
        title={t('sor.viewReport')}
        size="lg"
      >
            {viewingReport && (
              <div className="space-y-4">
                <div className="flex items-center justify-between">
                  <span className="text-gray-500 dark:text-gray-400">{t('sor.status.label')}</span>
                  {getStatusBadge(viewingReport.status)}
                </div>

                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <span className="text-gray-500 dark:text-gray-400 text-sm">{t('sor.project')}</span>
                    <p className="font-medium dark:text-gray-100">{viewingReport.project?.name}</p>
                  </div>
                  <div>
                    <span className="text-gray-500 dark:text-gray-400 text-sm">{t('sor.company')}</span>
                    <p className="font-medium dark:text-gray-100">{viewingReport.company ?? ''}</p>
                  </div>
                  <div>
                    <span className="text-gray-500 dark:text-gray-400 text-sm">{t('sor.date')}</span>
                    <p className="font-medium dark:text-gray-100">{formatDate(viewingReport.observation_date)}</p>
                  </div>
                  <div>
                    <span className="text-gray-500 dark:text-gray-400 text-sm">{t('sor.time')}</span>
                    <p className="font-medium dark:text-gray-100">{viewingReport.observation_time ?? ''}</p>
                  </div>
                  <div>
                    <span className="text-gray-500 dark:text-gray-400 text-sm">{t('sor.zone')}</span>
                    <p className="font-medium dark:text-gray-100">{viewingReport.zone ?? ''}</p>
                  </div>
                  <div>
                    <span className="text-gray-500 dark:text-gray-400 text-sm">{t('sor.supervisor')}</span>
                    <p className="font-medium dark:text-gray-100">{viewingReport.supervisor ?? ''}</p>
                  </div>
                </div>

                <div>
                  <span className="text-gray-500 dark:text-gray-400 text-sm">{t('sor.category')}</span>
                  <p className="font-medium dark:text-gray-100">{getCategoryLabel(viewingReport.category) || viewingReport.category}</p>
                </div>

                <div>
                  <span className="text-gray-500 dark:text-gray-400 text-sm">{t('sor.nonConformity')}</span>
                  <p className="font-medium bg-gray-50 dark:bg-gray-700 dark:text-gray-100 p-3 rounded-lg">{viewingReport.non_conformity}</p>
                </div>

                {viewProblemPhotoUrl && (
                  <div>
                    <span className="text-gray-500 dark:text-gray-400 text-sm">{t('sor.photo')}</span>
                    <img
                      src={viewProblemPhotoUrl}
                      alt="Non-conformity"
                      className="mt-2 rounded-lg max-h-64 object-contain border dark:border-gray-600 cursor-pointer hover:opacity-90"
                      onClick={() => window.open(viewProblemPhotoUrl, '_blank')}
                    />
                  </div>
                )}

                <div>
                  <span className="text-gray-500 dark:text-gray-400 text-sm">{t('sor.responsiblePerson')}</span>
                  <p className="font-medium dark:text-gray-100">{viewingReport.responsible_person ?? ''}</p>
                </div>

                {viewingReport.corrective_action && (
                  <div className="bg-green-50 dark:bg-green-900/20 border border-green-200 dark:border-green-800 rounded-lg p-4">
                    <span className="text-green-700 dark:text-green-400 text-sm font-medium">{t('sor.correctiveAction')}</span>
                    <p className="font-medium text-green-800 dark:text-green-200 mt-1">{viewingReport.corrective_action}</p>

                    {viewingReport.corrective_action_date && (
                      <p className="text-sm text-green-600 dark:text-green-400 mt-2">
                        {t('sor.correctiveDate')}: {formatDate(viewingReport.corrective_action_date)}
                        {viewingReport.corrective_action_time && ` ${t('common.at')} ${viewingReport.corrective_action_time}`}
                      </p>
                    )}

                    {viewingReport.closer_name && (
                      <p className="text-sm text-green-600 dark:text-green-400 mt-1">
                        {t('sor.closedBy')}: <span className="font-medium">{viewingReport.closer_name}</span>
                      </p>
                    )}

                    {viewCorrectivePhotoUrl && (
                      <div className="mt-3">
                        <img
                          src={viewCorrectivePhotoUrl}
                          alt="Corrective action"
                          className="rounded-lg max-h-48 object-contain border border-green-200 dark:border-green-700 cursor-pointer hover:opacity-90"
                          onClick={() => window.open(viewCorrectivePhotoUrl, '_blank')}
                        />
                      </div>
                    )}
                  </div>
                )}

                <div className="flex justify-end gap-3 pt-4 border-t dark:border-gray-700">
                  <button
                    onClick={() => setViewingReport(null)}
                    className="btn btn-outline"
                  >
                    {t('common.close')}
                  </button>
                  {viewingReport.status === 'closed' && viewingReport.corrective_action && (
                    <button
                      onClick={() => { handleEdit(viewingReport); setViewingReport(null) }}
                      className="btn btn-outline"
                    >
                      {t('sor.editCorrective')}
                    </button>
                  )}
                  <button
                    onClick={() => { handleEdit(viewingReport); setViewingReport(null) }}
                    className="btn btn-primary"
                  >
                    {t('common.edit')}
                  </button>
                </div>
              </div>
            )}
      </Modal>

      {/* Corrective Action Prompt Modal */}
      <Modal
        isOpen={showCorrectivePrompt}
        onClose={() => { setShowCorrectivePrompt(false); resetCorrectiveData(); resetForm() }}
        title={t('sor.correctivePromptTitle')}
        size="md"
      >
            <div className="space-y-6">
              <div className="text-center mb-6">
                <div className="w-16 h-16 bg-amber-100 dark:bg-amber-900/50 rounded-full flex items-center justify-center mx-auto mb-4">
                  <ClipboardCheck className="w-8 h-8 text-amber-600 dark:text-amber-400" />
                </div>
                <h2 className="text-xl font-bold mb-2 dark:text-gray-100">{t('sor.correctivePromptTitle')}</h2>
                <p className="text-gray-600 dark:text-gray-400">{t('sor.correctivePromptMessage')}</p>
              </div>

              {/* Corrective Action Form */}
              <div className="space-y-4 mb-6">
                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <label className="label">{t('sor.correctiveDate')}</label>
                    <DatePicker
                      value={correctiveData.corrective_action_date}
                      onChange={(val) => setCorrectiveData(prev => ({ ...prev, corrective_action_date: val }))}
                    />
                  </div>
                  <div>
                    <label className="label">{t('sor.correctiveTime')}</label>
                    <TimePicker
                      value={correctiveData.corrective_action_time}
                      onChange={(val) => setCorrectiveData(prev => ({ ...prev, corrective_action_time: val }))}
                    />
                  </div>
                </div>
                <div>
                  <label className="label">{t('sor.correctiveAction')} *</label>
                  <textarea
                    value={correctiveData.corrective_action}
                    onChange={(e) => setCorrectiveData(prev => ({ ...prev, corrective_action: e.target.value }))}
                    className="input min-h-[80px]"
                    placeholder={t('sor.correctiveActionPlaceholder')}
                  />
                </div>
                <div>
                  <label className="label">{t('sor.correctivePhoto')}</label>
                  <label
                    className="flex items-center justify-center border-2 border-dashed border-gray-300 dark:border-gray-600 rounded-lg p-3 cursor-pointer hover:border-hse-primary transition-colors"
                    onDragOver={(e) => e.preventDefault()}
                    onDrop={handleCorrectivePhotoDrop}
                  >
                    <input
                      type="file"
                      accept="image/*"
                      onChange={handleCorrectivePhotoChange}
                      className="hidden"
                    />
                    {correctivePhotoPreview ? (
                      <div className="flex items-center gap-3">
                        <img src={correctivePhotoPreview} alt="Preview" className="w-12 h-12 object-cover rounded" />
                        <span className="text-sm text-gray-600 dark:text-gray-400">{t('sor.changePhoto')}</span>
                      </div>
                    ) : (
                      <>
                        <Camera className="w-5 h-5 text-gray-400 mr-2" />
                        <span className="text-sm text-gray-500 dark:text-gray-400">{t('sor.uploadPhoto')}</span>
                      </>
                    )}
                  </label>
                </div>
              </div>

              <div className="flex gap-3">
                <button
                  onClick={() => { setShowCorrectivePrompt(false); resetCorrectiveData(); resetForm() }}
                  className="btn btn-outline flex-1"
                  disabled={submitting}
                >
                  {t('common.cancel')}
                </button>
                <button
                  onClick={handleSubmitLater}
                  className="btn bg-amber-500 hover:bg-amber-600 text-white flex-1 flex items-center justify-center gap-2"
                  disabled={submitting}
                >
                  {submitting ? <Loader2 className="w-4 h-4 animate-spin" /> : <Pin className="w-4 h-4" />}
                  {t('sor.submitLater')}
                </button>
                <button
                  onClick={handleSubmitWithCorrective}
                  className="btn btn-primary flex-1 flex items-center justify-center gap-2"
                  disabled={submitting || !correctiveData.corrective_action}
                >
                  {submitting ? <Loader2 className="w-4 h-4 animate-spin" /> : <CheckCircle className="w-4 h-4" />}
                  {t('sor.submitAndClose')}
                </button>
              </div>
            </div>
      </Modal>

      {/* Corrective Action Modal for Pinned Reports */}
      <Modal
        isOpen={showCorrectiveModal && !!pendingReport}
        onClose={() => { setShowCorrectiveModal(false); resetCorrectiveData(); setPendingReport(null) }}
        title={t('sor.addCorrectiveTitle')}
        size="lg"
      >
            {pendingReport && (
              <>
                {/* Problem Summary */}
                <div className="p-4 bg-gray-50 dark:bg-gray-900 border border-gray-200 dark:border-gray-700 rounded-lg">
                  <h4 className="font-medium text-sm text-gray-500 dark:text-gray-400 mb-2">{t('sor.problemSummary')}</h4>
                  <div className="space-y-1">
                    <p className="text-sm dark:text-gray-300"><span className="font-medium">{t('sor.project')}:</span> {pendingReport.project?.name}</p>
                    <p className="text-sm dark:text-gray-300"><span className="font-medium">{t('sor.date')}:</span> {formatDate(pendingReport.observation_date)}</p>
                    <p className="text-sm dark:text-gray-300"><span className="font-medium">{t('sor.category')}:</span> {getCategoryLabel(pendingReport.category) || pendingReport.category}</p>
                    <p className="text-sm text-gray-700 dark:text-gray-400 mt-2">{pendingReport.non_conformity}</p>
                  </div>
                </div>

                <form onSubmit={handleSubmitCorrectiveAction} className="space-y-4">
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="label">{t('sor.correctiveDate')}</label>
                  <DatePicker
                    value={correctiveData.corrective_action_date}
                    onChange={(val) => setCorrectiveData(prev => ({ ...prev, corrective_action_date: val }))}
                  />
                </div>
                <div>
                  <label className="label">{t('sor.correctiveTime')}</label>
                  <TimePicker
                    value={correctiveData.corrective_action_time}
                    onChange={(val) => setCorrectiveData(prev => ({ ...prev, corrective_action_time: val }))}
                  />
                </div>
              </div>
              <div>
                <label className="label">{t('sor.correctiveAction')} *</label>
                <textarea
                  value={correctiveData.corrective_action}
                  onChange={(e) => setCorrectiveData(prev => ({ ...prev, corrective_action: e.target.value }))}
                  className="input min-h-[80px]"
                  placeholder={t('sor.correctiveActionPlaceholder')}
                  required
                />
              </div>
              <div>
                <label className="label">{t('sor.correctivePhoto')}</label>
                <label
                  className="flex items-center justify-center border-2 border-dashed border-gray-300 dark:border-gray-600 rounded-lg p-3 cursor-pointer hover:border-hse-primary transition-colors"
                  onDragOver={(e) => e.preventDefault()}
                  onDrop={handleCorrectivePhotoDrop}
                >
                  <input
                    type="file"
                    accept="image/*"
                    onChange={handleCorrectivePhotoChange}
                    className="hidden"
                  />
                  {correctivePhotoPreview ? (
                    <div className="flex items-center gap-3">
                      <img src={correctivePhotoPreview} alt="Preview" className="w-12 h-12 object-cover rounded" />
                      <span className="text-sm text-gray-600 dark:text-gray-400">{t('sor.changePhoto')}</span>
                    </div>
                  ) : (
                    <>
                      <Camera className="w-5 h-5 text-gray-400 mr-2" />
                      <span className="text-sm text-gray-500 dark:text-gray-400">{t('sor.uploadPhoto')}</span>
                    </>
                  )}
                </label>
              </div>

              <div className="flex justify-end gap-3 pt-4 border-t">
                <button
                  type="button"
                  onClick={() => { setShowCorrectiveModal(false); resetCorrectiveData(); setPendingReport(null) }}
                  className="btn btn-outline"
                >
                  {t('common.cancel')}
                </button>
                <button
                  type="submit"
                  disabled={submitting}
                  className="btn btn-primary flex items-center gap-2"
                >
                  {submitting ? (
                    <>
                      <Loader2 className="w-4 h-4 animate-spin" />
                      {t('common.saving')}
                    </>
                  ) : (
                    <>
                      <CheckCircle className="w-4 h-4" />
                      {t('sor.submitAndClose')}
                    </>
                  )}
                </button>
              </div>
            </form>
              </>
            )}
      </Modal>

      <ConfirmDialog
        isOpen={!!confirmDeleteReport}
        title={t('common.delete')}
        message={t('common.confirmDelete')}
        confirmLabel={t('common.delete')}
        cancelLabel={t('common.cancel')}
        onConfirm={confirmDelete}
        onCancel={() => setConfirmDeleteReport(null)}
      />
    </div>
  )
}
