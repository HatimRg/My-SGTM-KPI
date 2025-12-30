import { useState, useEffect, useMemo, useRef } from 'react'
import { useLocation, useNavigate } from 'react-router-dom'
import api, {
  workerService,
  projectService,
  workerTrainingService,
  workerQualificationService,
  workerMedicalAptitudeService,
  ppeService,
} from '../../services/api'
import { useLanguage } from '../../i18n'
import { useAuthStore } from '../../store/authStore'
import DatePicker from '../../components/ui/DatePicker'
import ConfirmDialog from '../../components/ui/ConfirmDialog'
import Modal from '../../components/ui/Modal'
import Select from '../../components/ui/Select'
import AutocompleteInput from '../../components/ui/AutocompleteInput'
import { getProjectLabel, sortProjects } from '../../utils/projectList'
import {
  Users,
  UserPlus,
  Search,
  SlidersHorizontal,
  ChevronDown,
  PlusCircle,
  Download,
  Upload,
  Loader2,
  X,
  Pen,
  Pencil,
  Eye,
  FileSpreadsheet,
  FileText,
  Building2,
  CreditCard,
  HardHat,
  CheckCircle,
  ClipboardCheck,
  Trash2,
  Image as ImageIcon,
  Shield,
  PackagePlus,
} from 'lucide-react'
import toast from 'react-hot-toast'

const TRAINING_TYPE_OPTIONS = [
  { value: 'bypassing_safety_controls', labelKey: 'workers.details.trainings.types.bypassing_safety_controls' },
  { value: 'formation_coactivite', labelKey: 'workers.details.trainings.types.formation_coactivite' },
  { value: 'formation_coffrage_decoffrage', labelKey: 'workers.details.trainings.types.formation_coffrage_decoffrage' },
  { value: 'formation_conduite_defensive', labelKey: 'workers.details.trainings.types.formation_conduite_defensive' },
  { value: 'formation_analyse_des_risques', labelKey: 'workers.details.trainings.types.formation_analyse_des_risques' },
  { value: 'formation_elingage_manutention', labelKey: 'workers.details.trainings.types.formation_elingage_manutention' },
  { value: 'formation_ergonomie', labelKey: 'workers.details.trainings.types.formation_ergonomie' },
  { value: 'formation_excavations', labelKey: 'workers.details.trainings.types.formation_excavations' },
  { value: 'formation_outils_electroportatifs', labelKey: 'workers.details.trainings.types.formation_outils_electroportatifs' },
  { value: 'formation_epi', labelKey: 'workers.details.trainings.types.formation_epi' },
  { value: 'formation_environnement', labelKey: 'workers.details.trainings.types.formation_environnement' },
  { value: 'formation_espaces_confines', labelKey: 'workers.details.trainings.types.formation_espaces_confines' },
  { value: 'formation_flagman', labelKey: 'workers.details.trainings.types.formation_flagman' },
  { value: 'formation_jha', labelKey: 'workers.details.trainings.types.formation_jha' },
  { value: 'formation_line_of_fire', labelKey: 'workers.details.trainings.types.formation_line_of_fire' },
  { value: 'formation_manutention_manuelle', labelKey: 'workers.details.trainings.types.formation_manutention_manuelle' },
  { value: 'formation_manutention_mecanique', labelKey: 'workers.details.trainings.types.formation_manutention_mecanique' },
  { value: 'formation_point_chaud', labelKey: 'workers.details.trainings.types.formation_point_chaud' },
  { value: 'formation_produits_chimiques', labelKey: 'workers.details.trainings.types.formation_produits_chimiques' },
  { value: 'formation_risques_electriques', labelKey: 'workers.details.trainings.types.formation_risques_electriques' },
  { value: 'induction_hse', labelKey: 'workers.details.trainings.types.induction_hse' },
  { value: 'travail_en_hauteur', labelKey: 'workers.details.trainings.types.travail_en_hauteur' },
  { value: 'other', labelKey: 'workers.details.trainings.types.other' },
]

const QUALIFICATION_TYPE_OPTIONS = [
  { value: 'elingueur', labelKey: 'workers.details.qualifications.types.elingueur' },
  { value: 'equipier_premiere_intervention', labelKey: 'workers.details.qualifications.types.equipier_premiere_intervention' },
  { value: 'habilitation_electrique', labelKey: 'workers.details.qualifications.types.habilitation_electrique' },
  { value: 'inspecteur_echafaudage', labelKey: 'workers.details.qualifications.types.inspecteur_echafaudage' },
  { value: 'monteur_echafaudage', labelKey: 'workers.details.qualifications.types.monteur_echafaudage' },
  { value: 'monteur_grue_a_tour', labelKey: 'workers.details.qualifications.types.monteur_grue_a_tour' },
  { value: 'operateur_bulldozer', labelKey: 'workers.details.qualifications.types.operateur_bulldozer' },
  { value: 'operateur_chargeuse', labelKey: 'workers.details.qualifications.types.operateur_chargeuse' },
  { value: 'operateur_chariot_elevateur', labelKey: 'workers.details.qualifications.types.operateur_chariot_elevateur' },
  { value: 'operateur_compacteur', labelKey: 'workers.details.qualifications.types.operateur_compacteur' },
  { value: 'operateur_dumper', labelKey: 'workers.details.qualifications.types.operateur_dumper' },
  { value: 'operateur_grue_a_tour', labelKey: 'workers.details.qualifications.types.operateur_grue_a_tour' },
  { value: 'operateur_grue_mobile', labelKey: 'workers.details.qualifications.types.operateur_grue_mobile' },
  { value: 'operateur_niveleuse', labelKey: 'workers.details.qualifications.types.operateur_niveleuse' },
  { value: 'operateur_nacelle', labelKey: 'workers.details.qualifications.types.operateur_nacelle' },
  { value: 'operateur_pelle', labelKey: 'workers.details.qualifications.types.operateur_pelle' },
  { value: 'sst', labelKey: 'workers.details.qualifications.types.sst' },
  { value: 'soudeur', labelKey: 'workers.details.qualifications.types.soudeur' },
  { value: 'utilisation_meule', labelKey: 'workers.details.qualifications.types.utilisation_meule' },
  { value: 'other', labelKey: 'workers.details.qualifications.types.other' },
]

const MEDICAL_EXAM_NATURE_OPTIONS = [
  { value: 'embauche_reintegration', labelKey: 'workers.details.medical.examNatures.embauche_reintegration' },
  { value: 'visite_systematique', labelKey: 'workers.details.medical.examNatures.visite_systematique' },
  { value: 'surveillance_medical_special', labelKey: 'workers.details.medical.examNatures.surveillance_medical_special' },
  { value: 'visite_de_reprise', labelKey: 'workers.details.medical.examNatures.visite_de_reprise' },
  { value: 'visite_spontanee', labelKey: 'workers.details.medical.examNatures.visite_spontanee' },
]

const MEDICAL_ABLE_TO_OPTIONS = [
  { value: 'travaux_en_hauteur', labelKey: 'workers.details.medical.ableToOptions.travaux_en_hauteur' },
  { value: 'travaux_electrique', labelKey: 'workers.details.medical.ableToOptions.travaux_electrique' },
  { value: 'travaux_en_espace_confine', labelKey: 'workers.details.medical.ableToOptions.travaux_en_espace_confine' },
  { value: 'operateur', labelKey: 'workers.details.medical.ableToOptions.operateur' },
  { value: 'travaux_point_chaud', labelKey: 'workers.details.medical.ableToOptions.travaux_point_chaud' },
]

export default function Workers() {
  const { t } = useLanguage()
  const { user } = useAuthStore()
  const location = useLocation()
  const navigate = useNavigate()
  const fileInputRef = useRef(null)
  const fetchWorkersRequestId = useRef(0)

  const workerImageInputRef = useRef(null)

  const getTrainingTypeLabel = (training) => {
    const type = training?.training_type
    if (!type) return '-'

    if (type === 'other') {
      const label = String(training?.training_label ?? '').trim()
      return label || t('workers.details.trainings.types.other')
    }

    const option = TRAINING_TYPE_OPTIONS.find((o) => o.value === type)
    if (option?.labelKey) return t(option.labelKey)
    return String(type)
  }

  const getQualificationTypeLabel = (qualification) => {
    const type = qualification?.qualification_type
    if (!type) return '-'

    if (type === 'other') {
      const label = String(qualification?.qualification_label ?? '').trim()
      return label || t('workers.details.qualifications.types.other')
    }

    const option = QUALIFICATION_TYPE_OPTIONS.find((o) => o.value === type)
    if (option?.labelKey) return t(option.labelKey)
    return String(type)
  }

  const getMedicalExamNatureLabel = (medical) => {
    const nature = medical?.exam_nature
    if (!nature) return '-'
    const option = MEDICAL_EXAM_NATURE_OPTIONS.find((o) => o.value === nature)
    if (option?.labelKey) return t(option.labelKey)
    return String(nature)
  }

  const [detailsOpen, setDetailsOpen] = useState(false)
  const [detailsWorker, setDetailsWorker] = useState(null)
  const [detailsTab, setDetailsTab] = useState('trainings')

  const [workerTrainings, setWorkerTrainings] = useState([])
  const [loadingWorkerTrainings, setLoadingWorkerTrainings] = useState(false)

  const [workerQualifications, setWorkerQualifications] = useState([])
  const [loadingWorkerQualifications, setLoadingWorkerQualifications] = useState(false)

  const [workerMedicalAptitudes, setWorkerMedicalAptitudes] = useState([])
  const [loadingWorkerMedicalAptitudes, setLoadingWorkerMedicalAptitudes] = useState(false)

  const [workerPpeIssues, setWorkerPpeIssues] = useState([])
  const [loadingWorkerPpeIssues, setLoadingWorkerPpeIssues] = useState(false)

  const [ppeProjectItems, setPpeProjectItems] = useState([])
  const [loadingPpeProjectItems, setLoadingPpeProjectItems] = useState(false)

  const [ppeIssueModalOpen, setPpeIssueModalOpen] = useState(false)
  const [ppeIssuing, setPpeIssuing] = useState(false)
  const [ppeIssueForm, setPpeIssueForm] = useState({ ppe_item_id: '', ppe_other: '', quantity: 1, received_at: '' })

  const [trainingModalOpen, setTrainingModalOpen] = useState(false)
  const [trainingSaving, setTrainingSaving] = useState(false)
  const [editingWorkerTraining, setEditingWorkerTraining] = useState(null)
  const [trainingEndTouched, setTrainingEndTouched] = useState(false)
  const [trainingForm, setTrainingForm] = useState({
    training_type: '',
    training_label: '',
    training_date: '',
    expiry_date: '',
    certificate: null,
  })

  const [qualificationModalOpen, setQualificationModalOpen] = useState(false)
  const [qualificationSaving, setQualificationSaving] = useState(false)
  const [editingWorkerQualification, setEditingWorkerQualification] = useState(null)
  const [qualificationEndTouched, setQualificationEndTouched] = useState(false)
  const [qualificationForm, setQualificationForm] = useState({
    qualification_type: '',
    qualification_level: '',
    qualification_label: '',
    start_date: '',
    expiry_date: '',
    certificate: null,
  })

  const [medicalModalOpen, setMedicalModalOpen] = useState(false)
  const [medicalSaving, setMedicalSaving] = useState(false)
  const [editingWorkerMedical, setEditingWorkerMedical] = useState(null)
  const [medicalEndTouched, setMedicalEndTouched] = useState(false)
  const [medicalForm, setMedicalForm] = useState({
    aptitude_status: 'apte',
    exam_nature: '',
    able_to: [],
    exam_date: '',
    expiry_date: '',
    certificate: null,
  })

  const [workerImageUrl, setWorkerImageUrl] = useState(null)
  const [workerImageLoading, setWorkerImageLoading] = useState(false)
  const [workerImageUploading, setWorkerImageUploading] = useState(false)
  const workerImageIsObjectUrl = useRef(false)

  const [activePreview, setActivePreview] = useState(null)
  const [previewUrl, setPreviewUrl] = useState(null)
  const [previewLoading, setPreviewLoading] = useState(false)
  const previewIsObjectUrl = useRef(false)

  // Data
  const [workers, setWorkers] = useState([])
  const [projects, setProjects] = useState([])
  const [entreprises, setEntreprises] = useState([])
  const [fonctions, setFonctions] = useState([])
  const [statistics, setStatistics] = useState(null)
  const [loading, setLoading] = useState(true)

  // Pagination
  const [currentPage, setCurrentPage] = useState(1)
  const [totalPages, setTotalPages] = useState(1)
  const [totalCount, setTotalCount] = useState(0)
  const [perPage] = useState(50)

  // Filters
  const [searchTerm, setSearchTerm] = useState('')
  const [debouncedSearchTerm, setDebouncedSearchTerm] = useState('')
  const [selectedPole, setSelectedPole] = useState('')
  const [selectedProject, setSelectedProject] = useState('')
  const [selectedEntreprise, setSelectedEntreprise] = useState('')
  const [selectedFonction, setSelectedFonction] = useState('')

  // Advanced filters are managed from the Filters dropdown button (search is kept outside).
  const [filtersOpen, setFiltersOpen] = useState(false)
  const filtersButtonRef = useRef(null)
  const filtersMenuRef = useRef(null)

  const [selectedTrainingType, setSelectedTrainingType] = useState('')
  const [selectedTrainingPresence, setSelectedTrainingPresence] = useState('has')
  const [selectedQualificationType, setSelectedQualificationType] = useState('')
  const [selectedQualificationPresence, setSelectedQualificationPresence] = useState('has')
  const [selectedMedicalPresence, setSelectedMedicalPresence] = useState('')
  const [selectedMedicalStatus, setSelectedMedicalStatus] = useState('')
  const [expiredFilter, setExpiredFilter] = useState('')

  const [poles, setPoles] = useState([])

  const projectListPreference = user?.project_list_preference ?? 'code'
  const sortedProjects = useMemo(() => {
    return sortProjects(projects, projectListPreference)
  }, [projects, projectListPreference])

  const visibleProjects = useMemo(() => {
    const list = Array.isArray(sortedProjects) ? sortedProjects : []
    if (!selectedPole) return list
    return list.filter((p) => p?.pole === selectedPole)
  }, [sortedProjects, selectedPole])

  // Selection
  const [selectedWorkers, setSelectedWorkers] = useState([])
  const [selectAll, setSelectAll] = useState(false)

  // Modals
  const [showModal, setShowModal] = useState(false)
  const [showImportModal, setShowImportModal] = useState(false)
  const [editingWorker, setEditingWorker] = useState(null)
  const [saving, setSaving] = useState(false)
  const [importing, setImporting] = useState(false)
  const [importFile, setImportFile] = useState(null)
  const [confirmWorker, setConfirmWorker] = useState(null)
  const [showBulkConfirm, setShowBulkConfirm] = useState(false)

  // Form
  const [formData, setFormData] = useState({
    nom: '',
    prenom: '',
    fonction: '',
    cin: '',
    date_naissance: '',
    entreprise: '',
    project_id: '',
    date_entree: '',
    is_active: true,
  })

  useEffect(() => {
    fetchInitialData()
    fetchStatistics()
  }, [])

  useEffect(() => {
    const params = new URLSearchParams(location.search)
    const workerIdRaw = params.get('worker_id')
    const workerId = workerIdRaw ? String(workerIdRaw).trim() : ''
    if (!workerId) return

    ;(async () => {
      try {
        const res = await workerService.getById(workerId)
        const worker = res.data?.data ?? res.data
        if (worker) {
          await openWorkerDetails(worker)
        }
      } catch (e) {
        // ignore (no toast) to avoid noisy errors when opening from other modules
      } finally {
        const next = new URLSearchParams(location.search)
        next.delete('worker_id')
        navigate({ pathname: location.pathname, search: next.toString() ? `?${next.toString()}` : '' }, { replace: true })
      }
    })()
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  useEffect(() => {
    fetchWorkers()
  }, [
    currentPage,
    debouncedSearchTerm,
    selectedProject,
    selectedEntreprise,
    selectedFonction,
    selectedPole,
    selectedTrainingType,
    selectedTrainingPresence,
    selectedQualificationType,
    selectedQualificationPresence,
    selectedMedicalPresence,
    selectedMedicalStatus,
    expiredFilter,
  ])

  useEffect(() => {
    fetchStatistics()
  }, [
    debouncedSearchTerm,
    selectedProject,
    selectedEntreprise,
    selectedFonction,
    selectedPole,
    selectedTrainingType,
    selectedTrainingPresence,
    selectedQualificationType,
    selectedQualificationPresence,
    selectedMedicalPresence,
    selectedMedicalStatus,
    expiredFilter,
  ])

  // Close the filter dropdown on outside click / ESC.
  useEffect(() => {
    if (!filtersOpen) return

    const onKeyDown = (e) => {
      if (e.key === 'Escape') setFiltersOpen(false)
    }

    const onMouseDown = (e) => {
      const btn = filtersButtonRef.current
      const menu = filtersMenuRef.current
      const target = e.target

      if (btn && btn.contains(target)) return
      if (menu && menu.contains(target)) return
      setFiltersOpen(false)
    }

    document.addEventListener('keydown', onKeyDown)
    document.addEventListener('mousedown', onMouseDown)
    return () => {
      document.removeEventListener('keydown', onKeyDown)
      document.removeEventListener('mousedown', onMouseDown)
    }
  }, [filtersOpen])

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
    if (!selectedPole) return
    const ok = projects.some((p) => String(p.id) === String(selectedProject) && p?.pole === selectedPole)
    if (!ok && selectedProject) {
      setSelectedProject('')
    }
  }, [selectedPole, selectedProject, projects])

  useEffect(() => {
    const timeoutId = setTimeout(() => {
      setDebouncedSearchTerm(searchTerm)
    }, 300)
    return () => clearTimeout(timeoutId)
  }, [searchTerm])

  // Get user's accessible projects
  const fetchInitialData = async () => {
    try {
      const [projectsRes, entreprisesRes, fonctionsRes] = await Promise.all([
        projectService.getAllList({ status: 'active' }),
        workerService.getEntreprises(),
        workerService.getFonctions(),
      ])
      // Filter projects user has access to
      setProjects(Array.isArray(projectsRes) ? projectsRes : [])
      setEntreprises(entreprisesRes.data.data ?? [])
      setFonctions(fonctionsRes.data.data ?? [])
    } catch (error) {
      console.error('Failed to load initial data:', error)
    }
  }

  const fetchStatistics = async () => {
    try {
      const statsParams = {
        search: debouncedSearchTerm ? debouncedSearchTerm : undefined,
        pole: selectedPole ? selectedPole : undefined,
        project_id: selectedProject ? selectedProject : undefined,
        entreprise: selectedEntreprise ? selectedEntreprise : undefined,
        fonction: selectedFonction ? selectedFonction : undefined,
        training_type: selectedTrainingType ? selectedTrainingType : undefined,
        training_presence: selectedTrainingType ? selectedTrainingPresence : undefined,
        qualification_type: selectedQualificationType ? selectedQualificationType : undefined,
        qualification_presence: selectedQualificationType ? selectedQualificationPresence : undefined,
        medical_presence: selectedMedicalPresence ? selectedMedicalPresence : undefined,
        medical_status: selectedMedicalStatus ? selectedMedicalStatus : undefined,
        expired_filter: expiredFilter ? expiredFilter : undefined,
        is_active: true,
      }

      const statsRes = await workerService.getStatistics(statsParams)
      setStatistics(statsRes.data.data)
    } catch (error) {
      // keep existing statistics in UI if refresh fails
    }
  }

  const fetchWorkers = async () => {
    try {
      setLoading(true)
      const requestId = fetchWorkersRequestId.current + 1
      fetchWorkersRequestId.current = requestId
      const params = {
        page: currentPage,
        per_page: perPage,
        search: debouncedSearchTerm ? debouncedSearchTerm : undefined,
        pole: selectedPole ? selectedPole : undefined,
        project_id: selectedProject ? selectedProject : undefined,
        entreprise: selectedEntreprise ? selectedEntreprise : undefined,
        fonction: selectedFonction ? selectedFonction : undefined,
        training_type: selectedTrainingType ? selectedTrainingType : undefined,
        training_presence: selectedTrainingType ? selectedTrainingPresence : undefined,
        qualification_type: selectedQualificationType ? selectedQualificationType : undefined,
        qualification_presence: selectedQualificationType ? selectedQualificationPresence : undefined,
        medical_presence: selectedMedicalPresence ? selectedMedicalPresence : undefined,
        medical_status: selectedMedicalStatus ? selectedMedicalStatus : undefined,
        expired_filter: expiredFilter ? expiredFilter : undefined,
        is_active: true, // Only show active workers
      }
      const res = await workerService.getAll(params)

      if (requestId !== fetchWorkersRequestId.current) {
        return
      }

      const payload = res.data
      const data = payload.data ?? payload
      const items = Array.isArray(data) ? data : (data?.data ?? [])
      const meta = payload.meta ?? data.meta ?? data
      setWorkers(prev => {
        if (currentPage === 1) return items

        const combined = [...prev, ...items]
        const seen = new Set()
        return combined.filter((w) => {
          const id = w?.id
          if (id === null || id === undefined) return true
          const key = String(id)
          if (seen.has(key)) return false
          seen.add(key)
          return true
        })
      })
      setTotalPages(meta.last_page ?? 1)
      setTotalCount(meta.total ?? items.length)
    } catch (error) {
      toast.error(t('errors.somethingWentWrong'))
    } finally {
      setLoading(false)
    }
  }

  // Count HSE team members (function contains 'HSE')
  const hseTeamCount = statistics?.hse_team ?? workers.filter(w => 
    w.fonction?.toLowerCase().includes('hse')
  ).length

  const inductionHseCount = statistics?.induction_hse ?? 0
  const workAtHeightCount = statistics?.travail_en_hauteur ?? 0
  const medicalAptitudeCount = statistics?.medical_aptitude ?? 0

  const handleOpenModal = (worker = null) => {
    if (worker) {
      setEditingWorker(worker)
      setFormData({
        nom: worker.nom ?? '',
        prenom: worker.prenom ?? '',
        fonction: worker.fonction ?? '',
        cin: worker.cin?.toUpperCase() ?? '',
        date_naissance: worker.date_naissance?.split('T')[0] ?? '',
        entreprise: worker.entreprise ?? '',
        project_id: worker.project_id ?? '',
        date_entree: worker.date_entree?.split('T')[0] ?? '',
        is_active: worker.is_active ?? true,
      })
    } else {
      setEditingWorker(null)
      setFormData({
        nom: '',
        prenom: '',
        fonction: '',
        cin: '',
        date_naissance: '',
        entreprise: '',
        project_id: '',
        date_entree: '',
        is_active: true,
      })
    }
    setShowModal(true)
  }

  const handleCloseModal = () => {
    setShowModal(false)
    setEditingWorker(null)
  }

  const handleSubmit = async (e) => {
    e.preventDefault()
    setSaving(true)

    // Always uppercase CIN
    const submitData = {
      ...formData,
      cin: formData.cin?.toUpperCase(),
    }

    try {
      if (editingWorker) {
        await workerService.update(editingWorker.id, submitData)
        toast.success(t('workers.updated'))
      } else {
        const res = await workerService.create(submitData)
        if (res.data.data?.merged) {
          toast.success(t('workers.merged'))
        } else {
          toast.success(t('workers.created'))
        }
      }
      handleCloseModal()
      fetchWorkers()
      fetchStatistics() // Refresh stats
    } catch (error) {
      toast.error(error.response?.data?.message ?? t('errors.somethingWentWrong'))
    } finally {
      setSaving(false)
    }
  }

  const handleDeactivate = (worker) => {
    setConfirmWorker(worker)
  }

  const confirmDeactivate = async () => {
    if (!confirmWorker) return

    try {
      await workerService.delete(confirmWorker.id)
      toast.success(t('workers.deactivated'))
      fetchWorkers()
      fetchStatistics()
    } catch (error) {
      toast.error(t('errors.somethingWentWrong'))
    } finally {
      setConfirmWorker(null)
    }
  }

  const handleBulkDeactivate = () => {
    if (selectedWorkers.length === 0) return
    setShowBulkConfirm(true)
  }

  const confirmBulkDeactivate = async () => {
    if (selectedWorkers.length === 0) {
      setShowBulkConfirm(false)
      return
    }

    try {
      const res = await workerService.bulkDeactivate(selectedWorkers)
      toast.success(t('workers.bulkDeactivated', { count: res.data.data.deactivated_count }))
      setSelectedWorkers([])
      setSelectAll(false)
      fetchWorkers()
      fetchStatistics()
    } catch (error) {
      toast.error(t('errors.somethingWentWrong'))
    } finally {
      setShowBulkConfirm(false)
    }
  }

  const handleDownloadTemplate = async () => {
    try {
      const res = await workerService.downloadTemplate()
      const url = window.URL.createObjectURL(new Blob([res.data]))
      const link = document.createElement('a')
      link.href = url
      link.setAttribute('download', 'workers_template.xlsx')
      document.body.appendChild(link)
      link.click()
      link.remove()
    } catch (error) {
      toast.error(t('errors.somethingWentWrong'))
    }
  }

  const handleExport = async () => {
    try {
      const searchValue = debouncedSearchTerm
        ? debouncedSearchTerm
        : (searchTerm ? searchTerm : undefined)

      const params = {
        pole: selectedPole ? selectedPole : undefined,
        project_id: selectedProject ? selectedProject : undefined,
        entreprise: selectedEntreprise ? selectedEntreprise : undefined,
        fonction: selectedFonction ? selectedFonction : undefined,
        training_type: selectedTrainingType ? selectedTrainingType : undefined,
        training_presence: selectedTrainingType ? selectedTrainingPresence : undefined,
        qualification_type: selectedQualificationType ? selectedQualificationType : undefined,
        qualification_presence: selectedQualificationType ? selectedQualificationPresence : undefined,
        medical_presence: selectedMedicalPresence ? selectedMedicalPresence : undefined,
        medical_status: selectedMedicalStatus ? selectedMedicalStatus : undefined,
        expired_filter: expiredFilter ? expiredFilter : undefined,
        is_active: true, // Match current list behavior (active workers only)
        search: searchValue,
      }
      const res = await workerService.export(params)

      const blob = res.data instanceof Blob ? res.data : new Blob([res.data])
      const url = window.URL.createObjectURL(blob)

      const contentDisposition = res.headers?.['content-disposition'] ?? res.headers?.['Content-Disposition']
      const serverFilenameMatch = contentDisposition?.match(/filename\*=UTF-8''([^;]+)|filename="?([^";]+)"?/i)
      const serverFilenameRaw = serverFilenameMatch?.[1] ?? serverFilenameMatch?.[2]
      const serverFilename = serverFilenameRaw ? decodeURIComponent(serverFilenameRaw) : null

      const filters = []
      if (selectedProject) {
        const projectName = projects.find(p => String(p.id) === String(selectedProject))?.name
        if (projectName) filters.push(projectName)
      }
      if (selectedEntreprise) filters.push(selectedEntreprise)
      if (selectedFonction) filters.push(selectedFonction)
      if (selectedTrainingType) filters.push(`training:${selectedTrainingType}-${selectedTrainingPresence}`)
      if (selectedQualificationType) filters.push(`qualification:${selectedQualificationType}-${selectedQualificationPresence}`)
      if (selectedMedicalPresence) filters.push(`medical:${selectedMedicalPresence}${selectedMedicalStatus ? `-${selectedMedicalStatus}` : ''}`)
      if (expiredFilter) filters.push(`expired:${expiredFilter}`)

      const filterPart = (filters.length ? filters.join(', ') : 'active')
      const now = new Date()
      const dd = String(now.getDate()).padStart(2, '0')
      const mm = String(now.getMonth() + 1).padStart(2, '0')
      const yyyy = String(now.getFullYear())
      const datePart = `${dd}-${mm}-${yyyy}`

      const safeFilterPart = filterPart.replace(/[\\/:*?"<>|]/g, '-').replace(/\s+/g, ' ').trim()
      const isCsv = blob.type?.includes('csv') ? true : Boolean(blob.type?.includes('text/plain'))
      const inferredExt = isCsv ? 'csv' : 'xlsx'
      const fallbackFilename = `Workers_export_(${safeFilterPart})_date(${datePart}).${inferredExt}`
      const filename = serverFilename ?? fallbackFilename

      const link = document.createElement('a')
      link.href = url
      link.setAttribute('download', filename)
      document.body.appendChild(link)
      link.click()
      link.remove()
      toast.success(t('common.exportSuccess'))
    } catch (error) {
      try {
        const blob = error?.response?.data
        if (blob instanceof Blob && blob.type?.includes('application/json')) {
          const text = await blob.text()
          const json = JSON.parse(text)
          toast.error(json?.message ?? t('errors.somethingWentWrong'))
          return
        }
      } catch (e) {
        // ignore parse errors
      }
      toast.error(error.response?.data?.message ?? t('errors.somethingWentWrong'))
    }
  }

  const handleImport = async () => {
    if (!importFile) return

    setImporting(true)
    try {
      const formData = new FormData()
      formData.append('file', importFile)
      if (selectedProject) {
        formData.append('project_id', selectedProject)
      }

      const res = await workerService.import(formData)
      toast.success(t('workers.importSuccess', {
        imported: res.data.data.imported_count,
        merged: res.data.data.merged_count,
      }))
      setShowImportModal(false)
      setImportFile(null)
      setCurrentPage(1)
      setWorkers([])
      fetchInitialData()
    } catch (error) {
      toast.error(error.response?.data?.message ?? t('errors.somethingWentWrong'))
    } finally {
      setImporting(false)
    }
  }

  const toggleWorkerSelection = (workerId) => {
    setSelectedWorkers(prev =>
      prev.includes(workerId)
        ? prev.filter(id => id !== workerId)
        : [...prev, workerId]
    )
  }

  const toggleSelectAll = () => {
    if (selectAll) {
      setSelectedWorkers([])
    } else {
      setSelectedWorkers(workers.map(w => w.id))
    }
    setSelectAll(!selectAll)
  }

  const formatDate = (dateStr) => {
    if (!dateStr) return '-'
    return new Date(dateStr).toLocaleDateString('fr-FR')
  }

  const workerPpeLastIssuedByItemId = useMemo(() => {
    const map = {}
    for (const iss of workerPpeIssues) {
      const itemId = iss?.ppe_item_id ?? iss?.ppe_item?.id ?? iss?.ppeItem?.id
      const receivedAt = iss?.received_at
      if (!itemId || !receivedAt) continue
      if (!map[itemId] || new Date(receivedAt) > new Date(map[itemId])) {
        map[itemId] = receivedAt
      }
    }
    return map
  }, [workerPpeIssues])

  const addYearsToDate = (dateStr, years) => {
    if (!dateStr) return ''
    const d = new Date(`${dateStr}T00:00:00`)
    if (Number.isNaN(d.getTime())) return ''
    d.setFullYear(d.getFullYear() + years)
    const yyyy = d.getFullYear()
    const mm = String(d.getMonth() + 1).padStart(2, '0')
    const dd = String(d.getDate()).padStart(2, '0')
    return `${yyyy}-${mm}-${dd}`
  }

  const normalizeApiPath = (url) => {
    if (!url) return null
    if (typeof url !== 'string') return null
    if (url.startsWith('/api/')) return url.slice(4)
    if (url.startsWith('api/')) return url.slice(3)
    return url
  }

  const closePreview = () => {
    setActivePreview(null)
    setPreviewLoading(false)
    if (previewUrl && previewIsObjectUrl.current) {
      URL.revokeObjectURL(previewUrl)
    }
    previewIsObjectUrl.current = false
    setPreviewUrl(null)
  }

  const openPreviewFromUrl = async (url, meta) => {
    if (!url) return
    try {
      setActivePreview(meta ?? {})
      setPreviewLoading(true)
      if (previewUrl && previewIsObjectUrl.current) {
        URL.revokeObjectURL(previewUrl)
      }
      previewIsObjectUrl.current = false
      setPreviewUrl(null)

      if (typeof url === 'string' && (url.startsWith('http://') || url.startsWith('https://') || url.startsWith('/storage/'))) {
        setPreviewUrl(url)
        return
      }

      const path = normalizeApiPath(url)
      const res = await api.get(path, { responseType: 'blob' })
      const objectUrl = URL.createObjectURL(res.data)
      previewIsObjectUrl.current = true
      setPreviewUrl(objectUrl)
    } catch (e) {
      toast.error(e.response?.data?.message ?? t('errors.somethingWentWrong'))
      setActivePreview(null)
    } finally {
      setPreviewLoading(false)
    }
  }

  useEffect(() => {
    return () => {
      if (previewUrl && previewIsObjectUrl.current) {
        URL.revokeObjectURL(previewUrl)
      }
    }
  }, [previewUrl])

  const fetchDetailsTrainings = async (workerId) => {
    if (!workerId) return
    try {
      setLoadingWorkerTrainings(true)
      const res = await workerTrainingService.getAll({ worker_id: workerId, per_page: 100 })
      const payload = res.data
      const data = payload.data ?? payload
      const items = Array.isArray(data) ? data : (data.data ?? [])
      setWorkerTrainings(Array.isArray(items) ? items : [])
    } catch (e) {
      setWorkerTrainings([])
      toast.error(e.response?.data?.message ?? t('errors.somethingWentWrong'))
    } finally {
      setLoadingWorkerTrainings(false)
    }
  }

  const fetchDetailsQualifications = async (workerId) => {
    if (!workerId) return
    try {
      setLoadingWorkerQualifications(true)
      const res = await workerQualificationService.getAll({ worker_id: workerId, per_page: 100 })
      const payload = res.data
      const data = payload.data ?? payload
      const items = Array.isArray(data) ? data : (data.data ?? [])
      setWorkerQualifications(Array.isArray(items) ? items : [])
    } catch (e) {
      setWorkerQualifications([])
      toast.error(e.response?.data?.message ?? t('errors.somethingWentWrong'))
    } finally {
      setLoadingWorkerQualifications(false)
    }
  }

  const fetchDetailsMedicalAptitudes = async (workerId) => {
    if (!workerId) return
    try {
      setLoadingWorkerMedicalAptitudes(true)
      const res = await workerMedicalAptitudeService.getAll({ worker_id: workerId, per_page: 100 })
      const payload = res.data
      const data = payload.data ?? payload
      const items = Array.isArray(data) ? data : (data.data ?? [])
      setWorkerMedicalAptitudes(Array.isArray(items) ? items : [])
    } catch (e) {
      setWorkerMedicalAptitudes([])
      toast.error(e.response?.data?.message ?? t('errors.somethingWentWrong'))
    } finally {
      setLoadingWorkerMedicalAptitudes(false)
    }
  }

  const fetchDetailsPpeIssues = async (workerId) => {
    if (!workerId) return
    try {
      setLoadingWorkerPpeIssues(true)
      const res = await ppeService.getWorkerIssues(workerId)
      const payload = res.data
      const data = payload.data ?? payload
      const items = Array.isArray(data) ? data : (data.data ?? [])
      setWorkerPpeIssues(Array.isArray(items) ? items : [])
    } catch (e) {
      setWorkerPpeIssues([])
      toast.error(e.response?.data?.message ?? t('errors.somethingWentWrong'))
    } finally {
      setLoadingWorkerPpeIssues(false)
    }
  }

  const fetchPpeProjectItems = async (projectId) => {
    if (!projectId) {
      setPpeProjectItems([])
      return
    }
    try {
      setLoadingPpeProjectItems(true)
      const res = await ppeService.getItems({ project_id: Number(projectId) })
      setPpeProjectItems(res.data?.data ?? [])
    } catch (e) {
      setPpeProjectItems([])
      toast.error(e.response?.data?.message ?? t('errors.somethingWentWrong'))
    } finally {
      setLoadingPpeProjectItems(false)
    }
  }

  const fetchWorkerImage = async (workerId) => {
    if (!workerId) return
    try {
      setWorkerImageLoading(true)

      if (workerImageUrl && workerImageIsObjectUrl.current) {
        URL.revokeObjectURL(workerImageUrl)
        workerImageIsObjectUrl.current = false
      }
      setWorkerImageUrl(null)

      const res = await api.get(`/workers/${workerId}/image`, { responseType: 'blob' })
      const objectUrl = URL.createObjectURL(res.data)
      workerImageIsObjectUrl.current = true
      setWorkerImageUrl(objectUrl)
    } catch (e) {
      setWorkerImageUrl(null)
    } finally {
      setWorkerImageLoading(false)
    }
  }

  const uploadWorkerImage = async (file) => {
    if (!detailsWorker?.id || !file) return
    try {
      setWorkerImageUploading(true)
      const form = new FormData()
      form.append('image', file)
      await api.post(`/workers/${detailsWorker.id}/image`, form, {
        headers: { 'Content-Type': 'multipart/form-data' },
      })
      await fetchWorkerImage(detailsWorker.id)
      toast.success(t('success.saved'))
    } catch (e) {
      toast.error(e.response?.data?.message ?? t('errors.somethingWentWrong'))
    } finally {
      setWorkerImageUploading(false)
    }
  }

  const openWorkerDetails = async (worker) => {
    if (!worker) return
    setDetailsWorker(worker)
    setDetailsOpen(true)
    setDetailsTab('trainings')
    await Promise.all([
      fetchDetailsTrainings(worker.id),
      fetchDetailsQualifications(worker.id),
      fetchDetailsMedicalAptitudes(worker.id),
      fetchDetailsPpeIssues(worker.id),
      fetchPpeProjectItems(worker.project_id ?? worker.project?.id),
      fetchWorkerImage(worker.id),
    ])
  }

  const closeWorkerDetails = () => {
    setDetailsOpen(false)
    setDetailsWorker(null)
    setDetailsTab('trainings')
    setWorkerTrainings([])
    setWorkerQualifications([])
    setWorkerMedicalAptitudes([])
    setWorkerPpeIssues([])
    setPpeProjectItems([])
    setPpeIssueModalOpen(false)
    setPpeIssueForm({ ppe_item_id: '', ppe_other: '', quantity: 1, received_at: '' })
    if (workerImageUrl && workerImageIsObjectUrl.current) {
      URL.revokeObjectURL(workerImageUrl)
    }
    workerImageIsObjectUrl.current = false
    setWorkerImageUrl(null)
    closePreview()
  }

  const openTrainingModal = (training = null) => {
    setEditingWorkerTraining(training)
    setTrainingEndTouched(false)

    if (training) {
      setTrainingForm({
        training_type: training.training_type ?? '',
        training_label: training.training_label ?? '',
        training_date: training.training_date ?? '',
        expiry_date: training.expiry_date ?? '',
        certificate: null,
      })
    } else {
      setTrainingForm({
        training_type: '',
        training_label: '',
        training_date: '',
        expiry_date: '',
        certificate: null,
      })
    }

    setTrainingModalOpen(true)
  }

  const closeTrainingModal = () => {
    setTrainingModalOpen(false)
    setEditingWorkerTraining(null)
    setTrainingEndTouched(false)
    setTrainingForm({ training_type: '', training_label: '', training_date: '', expiry_date: '', certificate: null })
  }

  const handleTrainingFileChange = (e) => {
    const file = e.target.files?.[0]
    if (file && file.type !== 'application/pdf') {
      toast.error(t('workers.details.common.pdfOnly'))
      return
    }
    setTrainingForm((prev) => ({ ...prev, certificate: file ?? null }))
  }

  const openQualificationModal = (qualification = null) => {
    setEditingWorkerQualification(qualification)
    setQualificationEndTouched(false)

    if (qualification) {
      setQualificationForm({
        qualification_type: qualification.qualification_type ?? '',
        qualification_level: qualification.qualification_level ?? '',
        qualification_label: qualification.qualification_label ?? '',
        start_date: qualification.start_date ?? '',
        expiry_date: qualification.expiry_date ?? '',
        certificate: null,
      })
    } else {
      setQualificationForm({
        qualification_type: '',
        qualification_level: '',
        qualification_label: '',
        start_date: '',
        expiry_date: '',
        certificate: null,
      })
    }

    setQualificationModalOpen(true)
  }

  const closeQualificationModal = () => {
    setQualificationModalOpen(false)
    setEditingWorkerQualification(null)
    setQualificationEndTouched(false)
    setQualificationForm({
      qualification_type: '',
      qualification_level: '',
      qualification_label: '',
      start_date: '',
      expiry_date: '',
      certificate: null,
    })
  }

  const handleQualificationFileChange = (e) => {
    const file = e.target.files?.[0]
    if (file && file.type !== 'application/pdf') {
      toast.error(t('workers.details.common.pdfOnly'))
      return
    }
    setQualificationForm((prev) => ({ ...prev, certificate: file ?? null }))
  }

  const saveWorkerQualification = async (e) => {
    e.preventDefault()
    if (!detailsWorker?.id) return
    if (!qualificationForm.qualification_type || !qualificationForm.start_date) return
    if (qualificationForm.qualification_type === 'other' && !String(qualificationForm.qualification_label ?? '').trim()) return
    if (qualificationForm.qualification_type === 'habilitation_electrique' && !String(qualificationForm.qualification_level ?? '').trim()) return

    setQualificationSaving(true)
    try {
      const payload = {
        worker_id: detailsWorker.id,
        qualification_type: qualificationForm.qualification_type,
        qualification_level:
          qualificationForm.qualification_type === 'habilitation_electrique'
            ? String(qualificationForm.qualification_level ?? '').trim()
            : undefined,
        qualification_label:
          qualificationForm.qualification_type === 'other'
            ? String(qualificationForm.qualification_label ?? '').trim()
            : undefined,
        start_date: qualificationForm.start_date,
        expiry_date: qualificationForm.expiry_date ? qualificationForm.expiry_date : undefined,
        certificate: qualificationForm.certificate ? qualificationForm.certificate : undefined,
      }

      if (editingWorkerQualification?.id) {
        await workerQualificationService.update(editingWorkerQualification.id, payload)
      } else {
        await workerQualificationService.create(payload)
      }

      toast.success(t('success.saved'))
      closeQualificationModal()
      await fetchDetailsQualifications(detailsWorker.id)
    } catch (error) {
      toast.error(error.response?.data?.message ?? t('errors.somethingWentWrong'))
    } finally {
      setQualificationSaving(false)
    }
  }

  const removeWorkerQualification = async (qualification) => {
    if (!qualification?.id) return
    try {
      await workerQualificationService.delete(qualification.id)
      toast.success(t('success.deleted'))
      if (detailsWorker?.id) {
        await fetchDetailsQualifications(detailsWorker.id)
      }
    } catch (e) {
      toast.error(e.response?.data?.message ?? t('errors.somethingWentWrong'))
    }
  }

  const openMedicalModal = (medical = null) => {
    setEditingWorkerMedical(medical)
    setMedicalEndTouched(false)

    if (medical) {
      setMedicalForm({
        aptitude_status: medical.aptitude_status ?? 'apte',
        exam_nature: medical.exam_nature ?? '',
        able_to: Array.isArray(medical.able_to) ? medical.able_to : [],
        exam_date: medical.exam_date ?? '',
        expiry_date: medical.expiry_date ?? '',
        certificate: null,
      })
    } else {
      setMedicalForm({
        aptitude_status: 'apte',
        exam_nature: '',
        able_to: [],
        exam_date: '',
        expiry_date: '',
        certificate: null,
      })
    }

    setMedicalModalOpen(true)
  }

  const closeMedicalModal = () => {
    setMedicalModalOpen(false)
    setEditingWorkerMedical(null)
    setMedicalEndTouched(false)
    setMedicalForm({ aptitude_status: 'apte', exam_nature: '', able_to: [], exam_date: '', expiry_date: '', certificate: null })
  }

  const handleMedicalFileChange = (e) => {
    const file = e.target.files?.[0]
    if (file && file.type !== 'application/pdf') {
      toast.error(t('workers.details.common.pdfOnly'))
      return
    }
    setMedicalForm((prev) => ({ ...prev, certificate: file ?? null }))
  }

  const toggleMedicalAbleTo = (value) => {
    setMedicalForm((prev) => {
      const current = Array.isArray(prev.able_to) ? prev.able_to : []
      return current.includes(value)
        ? { ...prev, able_to: current.filter((x) => x !== value) }
        : { ...prev, able_to: [...current, value] }
    })
  }

  const saveWorkerMedical = async (e) => {
    e.preventDefault()
    if (!detailsWorker?.id) return
    if (!medicalForm.exam_nature || !medicalForm.exam_date) return

    setMedicalSaving(true)
    try {
      const payload = {
        worker_id: detailsWorker.id,
        aptitude_status: medicalForm.aptitude_status,
        exam_nature: medicalForm.exam_nature,
        able_to: Array.isArray(medicalForm.able_to) ? medicalForm.able_to : [],
        exam_date: medicalForm.exam_date,
        expiry_date: medicalForm.expiry_date ? medicalForm.expiry_date : undefined,
        certificate: medicalForm.certificate ? medicalForm.certificate : undefined,
      }

      if (editingWorkerMedical?.id) {
        await workerMedicalAptitudeService.update(editingWorkerMedical.id, payload)
      } else {
        await workerMedicalAptitudeService.create(payload)
      }

      toast.success(t('success.saved'))
      closeMedicalModal()
      await fetchDetailsMedicalAptitudes(detailsWorker.id)
      fetchStatistics()
    } catch (error) {
      toast.error(error.response?.data?.message ?? t('errors.somethingWentWrong'))
    } finally {
      setMedicalSaving(false)
    }
  }

  const removeWorkerMedical = async (medical) => {
    if (!medical?.id) return
    try {
      await workerMedicalAptitudeService.delete(medical.id)
      toast.success(t('success.deleted'))
      if (detailsWorker?.id) {
        await fetchDetailsMedicalAptitudes(detailsWorker.id)
      }
      fetchStatistics()
    } catch (e) {
      toast.error(e.response?.data?.message ?? t('errors.somethingWentWrong'))
    }
  }

  const saveWorkerTraining = async (e) => {
    e.preventDefault()
    if (!detailsWorker?.id) return
    if (!trainingForm.training_type || !trainingForm.training_date) return
    if (trainingForm.training_type === 'other' && !String(trainingForm.training_label ?? '').trim()) return

    setTrainingSaving(true)
    try {
      const payload = {
        worker_id: detailsWorker.id,
        training_type: trainingForm.training_type,
        training_label: trainingForm.training_type === 'other' ? String(trainingForm.training_label ?? '').trim() : undefined,
        training_date: trainingForm.training_date,
        expiry_date: trainingForm.expiry_date ? trainingForm.expiry_date : undefined,
        certificate: trainingForm.certificate ? trainingForm.certificate : undefined,
      }

      if (editingWorkerTraining?.id) {
        await workerTrainingService.update(editingWorkerTraining.id, payload)
        toast.success(t('success.saved'))
      } else {
        await workerTrainingService.create(payload)
        toast.success(t('success.saved'))
      }

      closeTrainingModal()
      await fetchDetailsTrainings(detailsWorker.id)
    } catch (error) {
      toast.error(error.response?.data?.message ?? t('errors.somethingWentWrong'))
    } finally {
      setTrainingSaving(false)
    }
  }

  const removeWorkerTraining = async (training) => {
    if (!training?.id) return
    try {
      await workerTrainingService.delete(training.id)
      toast.success(t('success.deleted'))
      if (detailsWorker?.id) {
        await fetchDetailsTrainings(detailsWorker.id)
      }
    } catch (e) {
      toast.error(e.response?.data?.message ?? t('errors.somethingWentWrong'))
    }
  }

  return (
    <div className="space-y-6 animate-fade-in">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-gray-900 dark:text-gray-100">
            {t('workers.title')}
          </h1>
          <p className="text-gray-600 dark:text-gray-400">{t('workers.subtitle')}</p>
        </div>
        <div className="flex flex-wrap gap-2">
          <button onClick={handleDownloadTemplate} className="btn-outline btn-sm flex items-center gap-2">
            <FileSpreadsheet className="w-4 h-4" />
            {t('workers.downloadTemplate')}
          </button>
          <button onClick={() => setShowImportModal(true)} className="btn-outline btn-sm flex items-center gap-2">
            <Upload className="w-4 h-4" />
            {t('workers.import')}
          </button>
          <button onClick={handleExport} className="btn-outline btn-sm flex items-center gap-2">
            <Download className="w-4 h-4" />
            {t('workers.export')}
          </button>
          <button onClick={() => handleOpenModal()} className="btn-primary btn-sm flex items-center gap-2">
            <UserPlus className="w-4 h-4" />
            {t('workers.addWorker')}
          </button>
        </div>
      </div>

      {/* Statistics */}
      {statistics && (
        <div className="space-y-4">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <div className="card p-3 flex items-center gap-3">
            <div className="p-2.5 bg-blue-100 dark:bg-blue-900/50 rounded-lg">
              <Users className="w-5 h-5 text-blue-600 dark:text-blue-400" />
            </div>
            <div>
              <p className="text-xs text-gray-500 dark:text-gray-400">{t('workers.totalWorkers')}</p>
              <p className="text-xl font-bold text-gray-900 dark:text-white">{statistics.active}</p>
            </div>
          </div>
          <div className="card p-3 flex items-center gap-3">
            <div className="p-2.5 bg-orange-100 dark:bg-orange-900/50 rounded-lg">
              <HardHat className="w-5 h-5 text-orange-600 dark:text-orange-400" />
            </div>
            <div>
              <p className="text-xs text-gray-500 dark:text-gray-400">{t('workers.hseTeam')}</p>
              <p className="text-xl font-bold text-gray-900 dark:text-white">{hseTeamCount}</p>
            </div>
          </div>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            <div className="card p-3 flex items-center gap-3">
              <div className="p-2.5 bg-emerald-100 dark:bg-emerald-900/50 rounded-lg">
                <CheckCircle className="w-5 h-5 text-emerald-600 dark:text-emerald-400" />
              </div>
              <div>
                <p className="text-xs text-gray-500 dark:text-gray-400">{t('workers.stats.inductionHse')}</p>
                <p className="text-xl font-bold text-gray-900 dark:text-white">{inductionHseCount}</p>
              </div>
            </div>

            <div className="card p-3 flex items-center gap-3">
              <div className="p-2.5 bg-purple-100 dark:bg-purple-900/50 rounded-lg">
                <HardHat className="w-5 h-5 text-purple-600 dark:text-purple-400" />
              </div>
              <div>
                <p className="text-xs text-gray-500 dark:text-gray-400">{t('workers.stats.workAtHeight')}</p>
                <p className="text-xl font-bold text-gray-900 dark:text-white">{workAtHeightCount}</p>
              </div>
            </div>

            <div className="card p-3 flex items-center gap-3">
              <div className="p-2.5 bg-sky-100 dark:bg-sky-900/50 rounded-lg">
                <CheckCircle className="w-5 h-5 text-sky-600 dark:text-sky-400" />
              </div>
              <div>
                <p className="text-xs text-gray-500 dark:text-gray-400">{t('workers.stats.medicalAptitude')}</p>
                <p className="text-xl font-bold text-gray-900 dark:text-white">{medicalAptitudeCount}</p>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Filters */}
      <div className="card p-3 overflow-visible">
        <div className="flex flex-col md:flex-row md:items-center gap-2">
          <div className="relative w-full md:max-w-md">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
            <input
              type="text"
              value={searchTerm}
              onChange={(e) => { setSearchTerm(e.target.value); setCurrentPage(1); }}
              placeholder={t('common.search')}
              className="input pl-9 py-1.5 text-sm"
            />
          </div>
          <div className="relative">
            <button
              ref={filtersButtonRef}
              type="button"
              onClick={() => setFiltersOpen((v) => !v)}
              className="btn-outline btn-sm flex items-center gap-2"
              aria-haspopup="menu"
              aria-expanded={filtersOpen}
            >
              <SlidersHorizontal className="w-4 h-4" />
              {t('common.filter')}
              <ChevronDown className="w-4 h-4" />
            </button>

            {filtersOpen && (
              <div
                ref={filtersMenuRef}
                role="menu"
                className="absolute right-0 mt-2 w-[min(28rem,calc(100vw-2rem))] z-[60] card overflow-visible p-3 shadow-lg"
              >
                <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                  <div>
                    <label className="label text-xs">{t('workers.filters.pole')}</label>
                    <Select
                      value={selectedPole}
                      onChange={(e) => {
                        setSelectedPole(e.target.value)
                        setSelectedProject('')
                        setCurrentPage(1)
                      }}
                      className="py-1.5 text-sm"
                    >
                      <option value="">{t('common.allPoles')}</option>
                      {poles.map((p) => (
                        <option key={p} value={p}>
                          {p}
                        </option>
                      ))}
                    </Select>
                  </div>

                  <div>
                    <label className="label text-xs">{t('workers.filters.project')}</label>
                    <Select
                      value={selectedProject}
                      onChange={(e) => {
                        setSelectedProject(e.target.value)
                        setCurrentPage(1)
                      }}
                      className="py-1.5 text-sm"
                    >
                      <option value="">{t('workers.allProjects')}</option>
                      {visibleProjects.map((p) => (
                        <option key={p.id} value={p.id}>
                          {getProjectLabel(p)}
                        </option>
                      ))}
                    </Select>
                  </div>

                  <div>
                    <label className="label text-xs">{t('workers.filters.entreprise')}</label>
                    <Select
                      value={selectedEntreprise}
                      onChange={(e) => {
                        setSelectedEntreprise(e.target.value)
                        setCurrentPage(1)
                      }}
                      className="py-1.5 text-sm"
                    >
                      <option value="">{t('workers.allEntreprises')}</option>
                      {entreprises.map((e) => (
                        <option key={e} value={e}>
                          {e}
                        </option>
                      ))}
                    </Select>
                  </div>

                  <div>
                    <label className="label text-xs">{t('workers.filters.fonction')}</label>
                    <Select
                      value={selectedFonction}
                      onChange={(e) => {
                        setSelectedFonction(e.target.value)
                        setCurrentPage(1)
                      }}
                      className="py-1.5 text-sm"
                    >
                      <option value="">{t('workers.allFonctions')}</option>
                      {fonctions.map((f) => (
                        <option key={f} value={f}>
                          {f}
                        </option>
                      ))}
                    </Select>
                  </div>

                  <div className="md:col-span-2 border-t border-gray-200 dark:border-gray-700 pt-3" />

                  <div>
                    <label className="label text-xs">{t('workers.filters.training')}</label>
                    <Select
                      value={selectedTrainingType}
                      onChange={(e) => {
                        setSelectedTrainingType(e.target.value)
                        setCurrentPage(1)
                      }}
                      className="py-1.5 text-sm"
                    >
                      <option value="">{t('common.all')}</option>
                      {TRAINING_TYPE_OPTIONS.filter((o) => o.value !== 'other').map((opt) => (
                        <option key={opt.value} value={opt.value}>
                          {t(opt.labelKey)}
                        </option>
                      ))}
                    </Select>
                  </div>

                  <div>
                    <label className="label text-xs">{t('workers.filters.presence')}</label>
                    <Select
                      value={selectedTrainingPresence}
                      onChange={(e) => {
                        setSelectedTrainingPresence(e.target.value)
                        setCurrentPage(1)
                      }}
                      className="py-1.5 text-sm"
                      disabled={!selectedTrainingType}
                    >
                      <option value="has">{t('workers.filters.with')}</option>
                      <option value="missing">{t('workers.filters.without')}</option>
                    </Select>
                  </div>

                  <div>
                    <label className="label text-xs">{t('workers.filters.qualification')}</label>
                    <Select
                      value={selectedQualificationType}
                      onChange={(e) => {
                        setSelectedQualificationType(e.target.value)
                        setCurrentPage(1)
                      }}
                      className="py-1.5 text-sm"
                    >
                      <option value="">{t('common.all')}</option>
                      {QUALIFICATION_TYPE_OPTIONS.filter((o) => o.value !== 'other').map((opt) => (
                        <option key={opt.value} value={opt.value}>
                          {t(opt.labelKey)}
                        </option>
                      ))}
                    </Select>
                  </div>

                  <div>
                    <label className="label text-xs">{t('workers.filters.presence')}</label>
                    <Select
                      value={selectedQualificationPresence}
                      onChange={(e) => {
                        setSelectedQualificationPresence(e.target.value)
                        setCurrentPage(1)
                      }}
                      className="py-1.5 text-sm"
                      disabled={!selectedQualificationType}
                    >
                      <option value="has">{t('workers.filters.with')}</option>
                      <option value="missing">{t('workers.filters.without')}</option>
                    </Select>
                  </div>

                  <div>
                    <label className="label text-xs">{t('workers.filters.medical')}</label>
                    <Select
                      value={selectedMedicalPresence}
                      onChange={(e) => {
                        setSelectedMedicalPresence(e.target.value)
                        setCurrentPage(1)
                      }}
                      className="py-1.5 text-sm"
                    >
                      <option value="">{t('common.all')}</option>
                      <option value="has">{t('workers.filters.with')}</option>
                      <option value="missing">{t('workers.filters.without')}</option>
                    </Select>
                  </div>

                  <div>
                    <label className="label text-xs">{t('workers.filters.medicalStatus')}</label>
                    <Select
                      value={selectedMedicalStatus}
                      onChange={(e) => {
                        setSelectedMedicalStatus(e.target.value)
                        setCurrentPage(1)
                      }}
                      className="py-1.5 text-sm"
                      disabled={!selectedMedicalPresence || selectedMedicalPresence === 'missing'}
                    >
                      <option value="">{t('common.all')}</option>
                      <option value="apte">{t('workers.details.medical.apte')}</option>
                      <option value="inapte">{t('workers.details.medical.inapte')}</option>
                    </Select>
                  </div>

                  <div className="md:col-span-2">
                    <label className="label text-xs">{t('workers.filters.expired')}</label>
                    <Select
                      value={expiredFilter}
                      onChange={(e) => {
                        setExpiredFilter(e.target.value)
                        setCurrentPage(1)
                      }}
                      className="py-1.5 text-sm"
                    >
                      <option value="">{t('workers.filters.expiredAny')}</option>
                      <option value="only_expired">{t('workers.filters.expiredOnly')}</option>
                      <option value="without_expired">{t('workers.filters.expiredWithout')}</option>
                    </Select>
                  </div>
                </div>

                <div className="flex items-center justify-end gap-2 mt-3 border-t border-gray-200 dark:border-gray-700 pt-3">
                  <button
                    type="button"
                    onClick={() => {
                      setSelectedPole('')
                      setSelectedProject('')
                      setSelectedEntreprise('')
                      setSelectedFonction('')
                      setSelectedTrainingType('')
                      setSelectedTrainingPresence('has')
                      setSelectedQualificationType('')
                      setSelectedQualificationPresence('has')
                      setSelectedMedicalPresence('')
                      setSelectedMedicalStatus('')
                      setExpiredFilter('')
                      setCurrentPage(1)
                    }}
                    className="btn-outline btn-sm"
                  >
                    {t('common.reset')}
                  </button>
                  <button type="button" onClick={() => setFiltersOpen(false)} className="btn-primary btn-sm">
                    {t('common.apply')}
                  </button>
                </div>
              </div>
            )}
          </div>
        </div>
      </div>

      {/* Bulk Actions */}
      {selectedWorkers.length > 0 && (
        <div className="card p-2.5 flex items-center justify-between bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800">
          <div className="flex items-center gap-2">
            <input
              type="checkbox"
              checked={selectAll}
              onChange={toggleSelectAll}
              className="rounded border-red-300 text-red-600 focus:ring-red-500"
            />
            <span className="text-sm font-medium text-red-700 dark:text-red-300">
              {selectedWorkers.length} {t('common.selected')}
            </span>
          </div>
          <button onClick={handleBulkDeactivate} className="btn-danger btn-sm flex items-center gap-1.5 text-xs">
            <Trash2 className="w-3.5 h-3.5" />
            {t('workers.bulkDeactivate')}
          </button>
        </div>
      )}

      {/* Table */}
      <div className="card overflow-hidden">
        {loading ? (
          <div className="flex items-center justify-center py-8">
            <Loader2 className="w-6 h-6 animate-spin text-hse-primary" />
          </div>
        ) : workers.length > 0 ? (
          <div className="overflow-x-auto">
            <table className="min-w-full text-[14px]">
              <thead className="text-[11px] uppercase tracking-wider text-gray-500 dark:text-gray-400">
                <tr className="sticky top-0 z-10 bg-white/95 dark:bg-gray-900/95 backdrop-blur border-b border-gray-200 dark:border-gray-700">
                  <th className="w-12 px-3 py-3">
                    <input
                      type="checkbox"
                      checked={selectAll}
                      onChange={toggleSelectAll}
                      className="w-4 h-4 rounded border-gray-300 dark:border-gray-600 text-hse-primary focus:ring-hse-primary"
                    />
                  </th>
                  <th className="px-3 py-3 text-left font-semibold">{t('workers.nom')}</th>
                  <th className="px-3 py-3 text-left font-semibold">{t('workers.prenom')}</th>
                  <th className="px-3 py-3 text-left font-semibold">{t('workers.cin')}</th>
                  <th className="px-3 py-3 text-left font-semibold">{t('workers.fonction')}</th>
                  <th className="px-3 py-3 text-left font-semibold">{t('workers.entreprise')}</th>
                  <th className="px-3 py-3 text-left font-semibold">{t('workers.projet')}</th>
                  <th className="px-3 py-3 text-left font-semibold whitespace-nowrap">{t('workers.dateEntree')}</th>
                  <th className="px-3 py-3 text-center font-semibold w-24">{t('common.actions')}</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-100 dark:divide-gray-800">
                {workers.map((worker, idx) => (
                  <tr
                    key={worker.id}
                    role="button"
                    tabIndex={0}
                    onClick={(e) => {
                      const target = e.target
                      if (target instanceof Element) {
                        if (target.closest('button') || target.closest('a') || target.closest('input')) return
                      }
                      openWorkerDetails(worker)
                    }}
                    onKeyDown={(e) => {
                      if (e.key === 'Enter') openWorkerDetails(worker)
                    }}
                    className={`${idx % 2 === 0 ? 'bg-white dark:bg-gray-900' : 'bg-gray-50/60 dark:bg-gray-800/30'} hover:bg-hse-primary/5 dark:hover:bg-hse-primary/10 transition-colors cursor-pointer`}
                  >
                    <td className="px-3 py-2.5 align-middle">
                      <input
                        type="checkbox"
                        checked={selectedWorkers.includes(worker.id)}
                        onChange={(e) => {
                          e.stopPropagation()
                          toggleWorkerSelection(worker.id)
                        }}
                        className="w-4 h-4 rounded border-gray-300 dark:border-gray-600 text-hse-primary focus:ring-hse-primary"
                      />
                    </td>
                    <td className="px-3 py-2.5 font-medium text-gray-900 dark:text-gray-100 whitespace-nowrap">{worker.nom}</td>
                    <td className="px-3 py-2.5 text-gray-700 dark:text-gray-200 whitespace-nowrap">{worker.prenom}</td>
                    <td className="px-3 py-2.5 font-mono text-gray-600 dark:text-gray-300 whitespace-nowrap">{worker.cin?.toUpperCase()}</td>
                    <td className="px-3 py-2.5 text-gray-700 dark:text-gray-200">{worker.fonction ?? ''}</td>
                    <td className="px-3 py-2.5 text-gray-700 dark:text-gray-200">{worker.entreprise ?? ''}</td>
                    <td className="px-3 py-2.5 text-gray-700 dark:text-gray-200">{worker.project?.name ?? ''}</td>
                    <td className="px-3 py-2.5 text-gray-600 dark:text-gray-300 whitespace-nowrap">{formatDate(worker.date_entree)}</td>
                    <td className="px-3 py-2.5 align-middle">
                      <div className="flex items-center justify-center gap-1">
                        <button
                          onClick={(e) => {
                            e.stopPropagation()
                            handleOpenModal(worker)
                          }}
                          className="p-2 rounded-lg hover:bg-gray-100 dark:hover:bg-gray-700 border border-transparent hover:border-gray-200 dark:hover:border-gray-600"
                          title={t('common.edit')}
                        >
                          <Pen className="w-4 h-4 text-gray-600 dark:text-gray-300" />
                        </button>
                        <button
                          onClick={(e) => {
                            e.stopPropagation()
                            handleDeactivate(worker)
                          }}
                          className="p-2 rounded-lg hover:bg-red-50 dark:hover:bg-red-900/20 border border-transparent hover:border-red-200 dark:hover:border-red-800"
                          title={t('workers.deactivate')}
                        >
                          <Trash2 className="w-4 h-4 text-red-600 dark:text-red-400" />
                        </button>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        ) : (
          <div className="text-center py-8 text-gray-500 dark:text-gray-400">
            <Users className="w-10 h-10 mx-auto mb-2 opacity-50" />
            <p className="text-sm">{t('workers.noWorkers')}</p>
          </div>
        )}

        {/* Show more */}
        {(workers.length > 0 ? true : totalCount > 0) && (
          <div className="px-3 py-2 border-t border-gray-200 dark:border-gray-700 flex items-center justify-between bg-gray-50 dark:bg-gray-800/50">
            <span className="text-xs text-gray-500 dark:text-gray-400">
              {t('pagination.showing')} {workers.length} {t('pagination.of')} {totalCount} {t('pagination.results')}
            </span>
            {workers.length < totalCount && (
              <button
                onClick={() => setCurrentPage(p => p + 1)}
                className="px-2 py-1 text-xs rounded border border-gray-300 dark:border-gray-600 hover:bg-gray-100 dark:hover:bg-gray-700 text-gray-700 dark:text-gray-300"
              >
                {t('common.showMore')}
              </button>
            )}
          </div>
        )}
      </div>

      {/* Create/Edit Modal */}
      <Modal
        isOpen={showModal}
        onClose={handleCloseModal}
        title={editingWorker ? t('workers.editWorker') : t('workers.newWorker')}
        size="lg"
      >
            <form onSubmit={handleSubmit} className="space-y-4">
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div>
                  <label className="label">{t('workers.nom')} *</label>
                  <input
                    type="text"
                    value={formData.nom}
                    onChange={(e) => setFormData({ ...formData, nom: e.target.value })}
                    className="input"
                    required
                  />
                </div>
                <div>
                  <label className="label">{t('workers.prenom')} *</label>
                  <input
                    type="text"
                    value={formData.prenom}
                    onChange={(e) => setFormData({ ...formData, prenom: e.target.value })}
                    className="input"
                    required
                  />
                </div>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div>
                  <label className="label">{t('workers.cin')} *</label>
                  <div className="relative">
                    <CreditCard className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
                    <input
                      type="text"
                      value={formData.cin}
                      onChange={(e) => setFormData({ ...formData, cin: e.target.value.toUpperCase() })}
                      className="input pl-10 uppercase"
                      placeholder="AB123456"
                      required
                    />
                  </div>
                </div>
                <div>
                  <label className="label">{t('workers.fonction')}</label>
                  <AutocompleteInput
                    value={formData.fonction}
                    onChange={(value) => setFormData({ ...formData, fonction: value })}
                    suggestions={fonctions}
                    placeholder={t('workers.fonctionPlaceholder')}
                    icon={<HardHat className="w-4 h-4" />}
                  />
                </div>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div>
                  <label className="label">{t('workers.dateNaissance')}</label>
                  <DatePicker
                    value={formData.date_naissance}
                    onChange={(date) => setFormData({ ...formData, date_naissance: date })}
                    placeholder={t('workers.selectDate')}
                  />
                  {formData.date_naissance && (() => {
                    const birthDate = new Date(formData.date_naissance)
                    const today = new Date()
                    const age = today.getFullYear() - birthDate.getFullYear()
                    const monthDiff = today.getMonth() - birthDate.getMonth()
                    const actualAge = monthDiff < 0 || (monthDiff === 0 && today.getDate() < birthDate.getDate()) ? age - 1 : age
                    const isUnder18 = actualAge < 18
                    return isUnder18 ? (
                      <p className="text-xs text-red-600 dark:text-red-400 font-semibold mt-1 flex items-center gap-1">
                        <span className="inline-block w-2 h-2 bg-red-500 rounded-full animate-pulse"></span>
                        {t('workers.minAge')}
                      </p>
                    ) : null
                  })()}
                </div>
                <div>
                  <label className="label">{t('workers.dateEntree')}</label>
                  <DatePicker
                    value={formData.date_entree}
                    onChange={(date) => setFormData({ ...formData, date_entree: date })}
                    placeholder={t('workers.selectDate')}
                  />
                </div>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div>
                  <label className="label">{t('workers.entreprise')}</label>
                  <AutocompleteInput
                    value={formData.entreprise}
                    onChange={(value) => setFormData({ ...formData, entreprise: value })}
                    suggestions={entreprises}
                    placeholder={t('workers.entreprisePlaceholder')}
                    defaultValue="SGTM"
                    icon={<Building2 className="w-4 h-4" />}
                  />
                </div>
                <div>
                  <label className="label">{t('workers.projet')}</label>
                  <Select
                    value={formData.project_id}
                    onChange={(e) => setFormData({ ...formData, project_id: e.target.value })}
                  >
                    <option value="">{t('common.select')}</option>
                    {sortedProjects.map(p => (
                      <option key={p.id} value={p.id}>{getProjectLabel(p)}</option>
                    ))}
                  </Select>
                </div>
              </div>

              {/* Status Toggle */}
              <div className="flex items-center justify-between p-3 bg-gray-50 dark:bg-gray-700/50 rounded-lg">
                <div>
                  <label className="font-medium text-gray-900 dark:text-white text-sm">{t('workers.status')}</label>
                  <p className="text-xs text-gray-500 dark:text-gray-400">{t('workers.statusHelp')}</p>
                </div>
                <button
                  type="button"
                  onClick={() => setFormData({ ...formData, is_active: !formData.is_active })}
                  className={`relative inline-flex h-6 w-11 items-center rounded-full transition-colors ${
                    formData.is_active ? 'bg-green-500' : 'bg-gray-300 dark:bg-gray-600'
                  }`}
                >
                  <span
                    className={`inline-block h-4 w-4 transform rounded-full bg-white transition-transform ${
                      formData.is_active ? 'translate-x-6' : 'translate-x-1'
                    }`}
                  />
                </button>
              </div>

              {!editingWorker && (
                <div className="p-3 bg-blue-50 dark:bg-blue-900/30 rounded-lg text-sm text-blue-700 dark:text-blue-300">
                  <p>{t('workers.cinInfo')}</p>
                </div>
              )}

              <div className="flex justify-end gap-3 pt-4 border-t dark:border-gray-700">
                <button type="button" onClick={handleCloseModal} className="btn-outline">
                  {t('common.cancel')}
                </button>
                <button type="submit" disabled={saving} className="btn-primary flex items-center gap-2">
                  {saving && <Loader2 className="w-4 h-4 animate-spin" />}
                  {editingWorker ? t('common.save') : t('workers.addWorker')}
                </button>
              </div>
            </form>
      </Modal>

      {detailsOpen && detailsWorker && (
        <Modal isOpen={detailsOpen} onClose={closeWorkerDetails} title={t('workers.details.title')} size="full">
          <div className="space-y-4">
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
              <div className="min-w-0 flex flex-col justify-between gap-3">
                <div className="min-w-0">
                  <p className="text-xs text-gray-500 dark:text-gray-400">{detailsWorker.project?.name ?? '-'}</p>
                  <h3 className="text-xl font-bold text-gray-900 dark:text-gray-100 truncate">
                    {detailsWorker.prenom} {detailsWorker.nom}
                  </h3>
                  <p className="text-sm text-gray-600 dark:text-gray-300 mt-1">
                    {detailsWorker.fonction ?? '-'}
                  </p>
                  <p className="text-xs text-gray-500 dark:text-gray-400 mt-1 font-mono">
                    {detailsWorker.cin?.toUpperCase() ?? '-'}
                  </p>
                </div>

                <div className="grid grid-cols-1 md:grid-cols-2 gap-2 text-sm">
                  <div className="flex items-center justify-between gap-3">
                    <span className="text-gray-500 dark:text-gray-400">{t('workers.entreprise')}</span>
                    <span className="text-gray-900 dark:text-gray-100 font-medium">{detailsWorker.entreprise ?? '-'}</span>
                  </div>
                  <div className="flex items-center justify-between gap-3">
                    <span className="text-gray-500 dark:text-gray-400">{t('workers.dateEntree')}</span>
                    <span className="text-gray-900 dark:text-gray-100 font-medium">{formatDate(detailsWorker.date_entree)}</span>
                  </div>
                </div>
              </div>

              <div className="w-full rounded-xl border border-gray-200 dark:border-gray-700 bg-gray-50 dark:bg-gray-800 overflow-hidden relative">
                <div className="absolute top-3 right-3 z-10 flex items-center gap-2">
                  <input
                    ref={workerImageInputRef}
                    type="file"
                    accept="image/*"
                    className="hidden"
                    onChange={(e) => {
                      const file = e.target.files?.[0]
                      if (!file) return
                      uploadWorkerImage(file)
                      e.target.value = ''
                    }}
                  />
                  <button
                    type="button"
                    onClick={() => workerImageInputRef.current?.click()}
                    className="btn-outline btn-sm flex items-center gap-2"
                    disabled={workerImageUploading}
                  >
                    {workerImageUploading ? <Loader2 className="w-4 h-4 animate-spin" /> : <PlusCircle className="w-4 h-4" />}
                    {t('workers.details.image.add')}
                  </button>
                </div>

                {workerImageLoading ? (
                  <div className="w-full h-72 flex items-center justify-center">
                    <Loader2 className="w-6 h-6 animate-spin text-hse-primary" />
                  </div>
                ) : workerImageUrl ? (
                  <div className="w-full h-72 flex items-center justify-center p-2">
                    <img src={workerImageUrl} alt="" className="max-w-full max-h-full object-contain" />
                  </div>
                ) : (
                  <div className="w-full h-72 flex flex-col items-center justify-center text-sm text-gray-500 dark:text-gray-400 gap-2">
                    <ImageIcon className="w-8 h-8" />
                    <span>{t('workers.details.noImage')}</span>
                  </div>
                )}
              </div>
            </div>

            <div className="card overflow-hidden">
              <div className="px-4 pt-4 border-b border-gray-200 dark:border-gray-700">
                <div className="flex gap-2 -mb-px flex-wrap">
                  <button
                    type="button"
                    onClick={() => setDetailsTab('trainings')}
                    className={`px-3 py-2 text-sm border rounded-t-lg flex items-center gap-2 ${
                      detailsTab === 'trainings'
                        ? 'bg-white dark:bg-gray-900 border-gray-200 dark:border-gray-700 border-b-white dark:border-b-gray-900 text-hse-primary'
                        : 'border-transparent text-gray-600 dark:text-gray-300 hover:text-gray-900 dark:hover:text-gray-100'
                    }`}
                  >
                    <FileText className="w-4 h-4" />
                    {t('workers.details.tabs.trainings')}
                  </button>
                  <button
                    type="button"
                    onClick={() => setDetailsTab('qualifications')}
                    className={`px-3 py-2 text-sm border rounded-t-lg flex items-center gap-2 ${
                      detailsTab === 'qualifications'
                        ? 'bg-white dark:bg-gray-900 border-gray-200 dark:border-gray-700 border-b-white dark:border-b-gray-900 text-hse-primary'
                        : 'border-transparent text-gray-600 dark:text-gray-300 hover:text-gray-900 dark:hover:text-gray-100'
                    }`}
                  >
                    <ClipboardCheck className="w-4 h-4" />
                    {t('workers.details.tabs.qualifications')}
                  </button>
                  <button
                    type="button"
                    onClick={() => setDetailsTab('medical')}
                    className={`px-3 py-2 text-sm border rounded-t-lg flex items-center gap-2 ${
                      detailsTab === 'medical'
                        ? 'bg-white dark:bg-gray-900 border-gray-200 dark:border-gray-700 border-b-white dark:border-b-gray-900 text-hse-primary'
                        : 'border-transparent text-gray-600 dark:text-gray-300 hover:text-gray-900 dark:hover:text-gray-100'
                    }`}
                  >
                    <CheckCircle className="w-4 h-4" />
                    {t('workers.details.tabs.medical')}
                  </button>

                  <button
                    type="button"
                    onClick={() => setDetailsTab('ppe')}
                    className={`px-3 py-2 text-sm border rounded-t-lg flex items-center gap-2 ${
                      detailsTab === 'ppe'
                        ? 'bg-white dark:bg-gray-900 border-gray-200 dark:border-gray-700 border-b-white dark:border-b-gray-900 text-hse-primary'
                        : 'border-transparent text-gray-600 dark:text-gray-300 hover:text-gray-900 dark:hover:text-gray-100'
                    }`}
                  >
                    <Shield className="w-4 h-4" />
                    {t('ppe.workerTab.title')}
                  </button>
                </div>
              </div>

              <div className="p-4">
                {detailsTab === 'trainings' && (
                  <div className="space-y-3">
                    <div className="flex justify-end">
                      <button type="button" className="btn-primary flex items-center gap-2" onClick={() => openTrainingModal(null)}>
                        <PlusCircle className="w-4 h-4" />
                        {t('common.add')}
                      </button>
                    </div>

                    {loadingWorkerTrainings ? (
                      <div className="flex items-center justify-center py-8">
                        <Loader2 className="w-6 h-6 animate-spin text-hse-primary" />
                      </div>
                    ) : workerTrainings.length === 0 ? (
                      <div className="text-sm text-gray-600 dark:text-gray-300">{t('workers.details.trainings.empty')}</div>
                    ) : (
                      <div className="overflow-x-auto">
                        <table className="min-w-full text-xs">
                          <thead>
                            <tr className="border-b border-gray-200 dark:border-gray-700 text-left">
                              <th className="py-2 pr-3 font-medium text-gray-500 dark:text-gray-400">{t('workers.details.trainings.type')}</th>
                              <th className="py-2 pr-3 font-medium text-gray-500 dark:text-gray-400">{t('workers.details.common.startDate')}</th>
                              <th className="py-2 pr-3 font-medium text-gray-500 dark:text-gray-400">{t('workers.details.common.endDate')}</th>
                              <th className="py-2 pr-3 font-medium text-gray-500 dark:text-gray-400">{t('common.actions')}</th>
                            </tr>
                          </thead>
                          <tbody>
                            {workerTrainings.map((tr) => (
                              <tr key={tr.id} className="border-b border-gray-100 dark:border-gray-800">
                                <td className="py-2 pr-3 text-gray-900 dark:text-gray-100">
                                  <div className="font-medium">{getTrainingTypeLabel(tr)}</div>
                                </td>
                                <td className="py-2 pr-3 text-gray-700 dark:text-gray-200">{formatDate(tr.training_date)}</td>
                                <td className="py-2 pr-3 text-gray-700 dark:text-gray-200">{formatDate(tr.expiry_date)}</td>
                                <td className="py-2 pr-3">
                                  <div className="flex flex-wrap gap-2">
                                    {tr.certificate_url && (
                                      <button
                                        type="button"
                                        className="btn-outline btn-sm flex items-center gap-2"
                                        onClick={() => openPreviewFromUrl(tr.certificate_url, tr)}
                                      >
                                        <Eye className="w-4 h-4" />
                                        {t('common.view')}
                                      </button>
                                    )}
                                    {tr.certificate_url && (
                                      <a
                                        href={tr.certificate_url}
                                        download
                                        className="btn-outline btn-sm flex items-center gap-2"
                                        onClick={(e) => e.stopPropagation()}
                                      >
                                        <Download className="w-4 h-4" />
                                        {t('common.download')}
                                      </a>
                                    )}
                                    <button type="button" className="btn-outline btn-sm flex items-center gap-2" onClick={() => openTrainingModal(tr)}>
                                      <Pencil className="w-4 h-4" />
                                      {t('common.edit')}
                                    </button>
                                    <button type="button" className="btn-danger btn-sm flex items-center gap-2" onClick={() => removeWorkerTraining(tr)}>
                                      <Trash2 className="w-4 h-4" />
                                      {t('common.delete')}
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
                )}

                {detailsTab === 'qualifications' && (
                  <div className="space-y-3">
                    <div className="flex justify-end">
                      <button type="button" className="btn-primary flex items-center gap-2" onClick={() => openQualificationModal(null)}>
                        <PlusCircle className="w-4 h-4" />
                        {t('common.add')}
                      </button>
                    </div>

                    {loadingWorkerQualifications ? (
                      <div className="flex items-center justify-center py-8">
                        <Loader2 className="w-6 h-6 animate-spin text-hse-primary" />
                      </div>
                    ) : workerQualifications.length === 0 ? (
                      <div className="text-sm text-gray-600 dark:text-gray-300">{t('workers.details.qualifications.empty')}</div>
                    ) : (
                      <div className="overflow-x-auto">
                        <table className="min-w-full text-xs">
                          <thead>
                            <tr className="border-b border-gray-200 dark:border-gray-700 text-left">
                              <th className="py-2 pr-3 font-medium text-gray-500 dark:text-gray-400">{t('workers.details.qualifications.type')}</th>
                              <th className="py-2 pr-3 font-medium text-gray-500 dark:text-gray-400">{t('workers.details.common.startDate')}</th>
                              <th className="py-2 pr-3 font-medium text-gray-500 dark:text-gray-400">{t('workers.details.common.endDate')}</th>
                              <th className="py-2 pr-3 font-medium text-gray-500 dark:text-gray-400">{t('common.actions')}</th>
                            </tr>
                          </thead>
                          <tbody>
                            {workerQualifications.map((q) => (
                              <tr key={q.id} className="border-b border-gray-100 dark:border-gray-800">
                                <td className="py-2 pr-3 text-gray-900 dark:text-gray-100">
                                  <div className="font-medium flex items-center gap-2">
                                    <span>{getQualificationTypeLabel(q)}</span>
                                    {q.qualification_type === 'habilitation_electrique' && q.qualification_level ? (
                                      <span className="text-[11px] px-2 py-0.5 rounded-full bg-gray-100 dark:bg-gray-800 text-gray-700 dark:text-gray-200">
                                        {q.qualification_level}
                                      </span>
                                    ) : null}
                                  </div>
                                </td>
                                <td className="py-2 pr-3 text-gray-700 dark:text-gray-200">{formatDate(q.start_date)}</td>
                                <td className="py-2 pr-3 text-gray-700 dark:text-gray-200">{formatDate(q.expiry_date)}</td>
                                <td className="py-2 pr-3">
                                  <div className="flex flex-wrap gap-2">
                                    {q.certificate_url && (
                                      <button
                                        type="button"
                                        className="btn-outline btn-sm flex items-center gap-2"
                                        onClick={() => openPreviewFromUrl(q.certificate_url, q)}
                                      >
                                        <Eye className="w-4 h-4" />
                                        {t('common.view')}
                                      </button>
                                    )}
                                    {q.certificate_url && (
                                      <a
                                        href={q.certificate_url}
                                        download
                                        className="btn-outline btn-sm flex items-center gap-2"
                                        onClick={(e) => e.stopPropagation()}
                                      >
                                        <Download className="w-4 h-4" />
                                        {t('common.download')}
                                      </a>
                                    )}
                                    <button type="button" className="btn-outline btn-sm flex items-center gap-2" onClick={() => openQualificationModal(q)}>
                                      <Pencil className="w-4 h-4" />
                                      {t('common.edit')}
                                    </button>
                                    <button type="button" className="btn-danger btn-sm flex items-center gap-2" onClick={() => removeWorkerQualification(q)}>
                                      <Trash2 className="w-4 h-4" />
                                      {t('common.delete')}
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
                )}

                {detailsTab === 'medical' && (
                  <div className="space-y-3">
                    <div className="flex justify-end">
                      <button type="button" className="btn-primary flex items-center gap-2" onClick={() => openMedicalModal(null)}>
                        <PlusCircle className="w-4 h-4" />
                        {t('common.add')}
                      </button>
                    </div>

                    {loadingWorkerMedicalAptitudes ? (
                      <div className="flex items-center justify-center py-8">
                        <Loader2 className="w-6 h-6 animate-spin text-hse-primary" />
                      </div>
                    ) : workerMedicalAptitudes.length === 0 ? (
                      <div className="text-sm text-gray-600 dark:text-gray-300">{t('workers.details.medical.empty')}</div>
                    ) : (
                      <div className="overflow-x-auto">
                        <table className="min-w-full text-xs">
                          <thead>
                            <tr className="border-b border-gray-200 dark:border-gray-700 text-left">
                              <th className="py-2 pr-3 font-medium text-gray-500 dark:text-gray-400">{t('workers.details.medical.status')}</th>
                              <th className="py-2 pr-3 font-medium text-gray-500 dark:text-gray-400">{t('workers.details.medical.examNature')}</th>
                              <th className="py-2 pr-3 font-medium text-gray-500 dark:text-gray-400">{t('workers.details.common.startDate')}</th>
                              <th className="py-2 pr-3 font-medium text-gray-500 dark:text-gray-400">{t('workers.details.common.endDate')}</th>
                              <th className="py-2 pr-3 font-medium text-gray-500 dark:text-gray-400">{t('common.actions')}</th>
                            </tr>
                          </thead>
                          <tbody>
                            {workerMedicalAptitudes.map((m) => (
                              <tr key={m.id} className="border-b border-gray-100 dark:border-gray-800">
                                <td className="py-2 pr-3 text-gray-900 dark:text-gray-100">
                                  <span
                                    className={`inline-flex items-center px-2 py-0.5 rounded-full text-[11px] font-semibold ${
                                      m.aptitude_status === 'apte'
                                        ? 'bg-green-100 dark:bg-green-900/30 text-green-700 dark:text-green-300'
                                        : 'bg-red-100 dark:bg-red-900/30 text-red-700 dark:text-red-300'
                                    }`}
                                  >
                                    {m.aptitude_status === 'apte'
                                      ? t('workers.details.medical.apte')
                                      : t('workers.details.medical.inapte')}
                                  </span>
                                </td>
                                <td className="py-2 pr-3 text-gray-700 dark:text-gray-200">{getMedicalExamNatureLabel(m)}</td>
                                <td className="py-2 pr-3 text-gray-700 dark:text-gray-200">{formatDate(m.exam_date)}</td>
                                <td className="py-2 pr-3 text-gray-700 dark:text-gray-200">{formatDate(m.expiry_date)}</td>
                                <td className="py-2 pr-3">
                                  <div className="flex flex-wrap gap-2">
                                    {m.certificate_url && (
                                      <button
                                        type="button"
                                        className="btn-outline btn-sm flex items-center gap-2"
                                        onClick={() => openPreviewFromUrl(m.certificate_url, m)}
                                      >
                                        <Eye className="w-4 h-4" />
                                        {t('common.view')}
                                      </button>
                                    )}
                                    {m.certificate_url && (
                                      <a
                                        href={m.certificate_url}
                                        download
                                        className="btn-outline btn-sm flex items-center gap-2"
                                        onClick={(e) => e.stopPropagation()}
                                      >
                                        <Download className="w-4 h-4" />
                                        {t('common.download')}
                                      </a>
                                    )}
                                    <button type="button" className="btn-outline btn-sm flex items-center gap-2" onClick={() => openMedicalModal(m)}>
                                      <Pencil className="w-4 h-4" />
                                      {t('common.edit')}
                                    </button>
                                    <button type="button" className="btn-danger btn-sm flex items-center gap-2" onClick={() => removeWorkerMedical(m)}>
                                      <Trash2 className="w-4 h-4" />
                                      {t('common.delete')}
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
                )}

                {detailsTab === 'ppe' && (
                  <div className="space-y-3">
                    <div className="flex justify-end">
                      <button
                        type="button"
                        className="btn-primary flex items-center gap-2"
                        onClick={() => {
                          if (!detailsWorker?.id) return
                          setPpeIssueForm({
                            ppe_item_id: '',
                            ppe_other: '',
                            quantity: 1,
                            received_at: new Date().toISOString().slice(0, 10),
                          })
                          setPpeIssueModalOpen(true)
                        }}
                      >
                        <PackagePlus className="w-4 h-4" />
                        {t('ppe.workerTab.issueButton')}
                      </button>
                    </div>

                    <div className="card p-3">
                      <div className="text-sm font-semibold text-gray-900 dark:text-gray-100">{t('ppe.workerTab.lastIssuedTitle')}</div>
                      {loadingPpeProjectItems ? (
                        <div className="flex items-center justify-center py-6">
                          <Loader2 className="w-5 h-5 animate-spin text-hse-primary" />
                        </div>
                      ) : ppeProjectItems.length === 0 ? (
                        <div className="text-sm text-gray-600 dark:text-gray-300 mt-2">{t('common.noData')}</div>
                      ) : (
                        <div className="overflow-x-auto mt-2">
                          <table className="min-w-full text-xs">
                            <thead>
                              <tr className="border-b border-gray-200 dark:border-gray-700 text-left">
                                <th className="py-2 pr-3 font-medium text-gray-500 dark:text-gray-400">{t('ppe.workerTab.columns.item')}</th>
                                <th className="py-2 pr-3 font-medium text-gray-500 dark:text-gray-400">{t('ppe.items.stock')}</th>
                                <th className="py-2 pr-3 font-medium text-gray-500 dark:text-gray-400">{t('ppe.workerTab.columns.receivedAt')}</th>
                              </tr>
                            </thead>
                            <tbody>
                              {[...ppeProjectItems]
                                .sort((a, b) => String(a?.name ?? '').localeCompare(String(b?.name ?? '')))
                                .map((it) => (
                                  <tr key={it.id} className="border-b border-gray-100 dark:border-gray-800">
                                    <td className="py-2 pr-3 text-gray-900 dark:text-gray-100">
                                      <div className="font-medium">{it.name}</div>
                                    </td>
                                    <td className="py-2 pr-3 text-gray-700 dark:text-gray-200 font-mono">{it.stock_quantity ?? 0}</td>
                                    <td className="py-2 pr-3 text-gray-700 dark:text-gray-200">
                                      {formatDate(workerPpeLastIssuedByItemId[it.id])}
                                    </td>
                                  </tr>
                                ))}
                            </tbody>
                          </table>
                        </div>
                      )}
                    </div>

                    <div className="card p-3">
                      <div className="text-sm font-semibold text-gray-900 dark:text-gray-100">{t('ppe.workerTab.title')}</div>
                      {loadingWorkerPpeIssues ? (
                        <div className="flex items-center justify-center py-6">
                          <Loader2 className="w-5 h-5 animate-spin text-hse-primary" />
                        </div>
                      ) : workerPpeIssues.length === 0 ? (
                        <div className="text-sm text-gray-600 dark:text-gray-300 mt-2">{t('ppe.workerTab.empty')}</div>
                      ) : (
                        <div className="overflow-x-auto mt-2">
                          <table className="min-w-full text-xs">
                            <thead>
                              <tr className="border-b border-gray-200 dark:border-gray-700 text-left">
                                <th className="py-2 pr-3 font-medium text-gray-500 dark:text-gray-400">{t('ppe.workerTab.columns.item')}</th>
                                <th className="py-2 pr-3 font-medium text-gray-500 dark:text-gray-400">{t('ppe.workerTab.columns.quantity')}</th>
                                <th className="py-2 pr-3 font-medium text-gray-500 dark:text-gray-400">{t('ppe.workerTab.columns.receivedAt')}</th>
                              </tr>
                            </thead>
                            <tbody>
                              {workerPpeIssues.map((iss) => (
                                <tr key={iss.id} className="border-b border-gray-100 dark:border-gray-800">
                                  <td className="py-2 pr-3 text-gray-900 dark:text-gray-100">
                                    <div className="font-medium">{iss.ppe_item?.name ?? iss.ppeItem?.name ?? '-'}</div>
                                  </td>
                                  <td className="py-2 pr-3 text-gray-700 dark:text-gray-200 font-mono">{iss.quantity ?? 1}</td>
                                  <td className="py-2 pr-3 text-gray-700 dark:text-gray-200">{formatDate(iss.received_at)}</td>
                                </tr>
                              ))}
                            </tbody>
                          </table>
                        </div>
                      )}
                    </div>
                  </div>
                )}
              </div>
            </div>
          </div>
        </Modal>
      )}

      {ppeIssueModalOpen && detailsWorker && (
        <Modal
          isOpen={ppeIssueModalOpen}
          onClose={() => setPpeIssueModalOpen(false)}
          title={t('ppe.issue.title')}
          size="lg"
        >
          <form
            onSubmit={async (e) => {
              e.preventDefault()
              if (!detailsWorker?.id) return
              if (!ppeIssueForm.ppe_item_id && !String(ppeIssueForm.ppe_other ?? '').trim()) {
                toast.error(t('ppe.issue.chooseItem'))
                return
              }
              try {
                setPpeIssuing(true)
                await ppeService.issueToWorker({
                  worker_id: Number(detailsWorker.id),
                  ppe_item_id: ppeIssueForm.ppe_item_id ? Number(ppeIssueForm.ppe_item_id) : undefined,
                  ppe_name: !ppeIssueForm.ppe_item_id ? String(ppeIssueForm.ppe_other ?? '').trim() : undefined,
                  quantity: Number(ppeIssueForm.quantity ?? 1),
                  received_at: ppeIssueForm.received_at,
                })
                toast.success(t('ppe.issue.success'))
                setPpeIssueModalOpen(false)
                await Promise.all([
                  fetchDetailsPpeIssues(detailsWorker.id),
                  fetchPpeProjectItems(detailsWorker.project_id ?? detailsWorker.project?.id),
                ])
              } catch (e2) {
                toast.error(e2.response?.data?.message ?? t('errors.somethingWentWrong'))
              } finally {
                setPpeIssuing(false)
              }
            }}
            className="space-y-4"
          >
            <div>
              <label className="label">{t('ppe.issue.item')}</label>
              <Select
                value={ppeIssueForm.ppe_item_id}
                onChange={(e) => setPpeIssueForm((p) => ({ ...p, ppe_item_id: e.target.value, ppe_other: '' }))}
              >
                <option value="">{t('ppe.issue.other')}</option>
                {[...ppeProjectItems]
                  .sort((a, b) => String(a?.name ?? '').localeCompare(String(b?.name ?? '')))
                  .map((it) => (
                    <option key={it.id} value={it.id}>
                      {it.name} ({it.stock_quantity ?? 0})
                    </option>
                  ))}
              </Select>
              {!ppeIssueForm.ppe_item_id && (
                <div className="mt-2">
                  <label className="label text-xs">{t('ppe.issue.otherSpecify')}</label>
                  <input
                    className="input"
                    value={ppeIssueForm.ppe_other}
                    onChange={(e) => setPpeIssueForm((p) => ({ ...p, ppe_other: e.target.value }))}
                    placeholder={t('ppe.issue.otherPlaceholder')}
                  />
                </div>
              )}
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
              <div>
                <label className="label">{t('ppe.issue.quantity')}</label>
                <input
                  type="number"
                  min={1}
                  className="input"
                  value={ppeIssueForm.quantity}
                  onChange={(e) => setPpeIssueForm((p) => ({ ...p, quantity: e.target.value }))}
                  required
                />
              </div>
              <div>
                <label className="label">{t('ppe.issue.receivedAt')}</label>
                <DatePicker value={ppeIssueForm.received_at} onChange={(v) => setPpeIssueForm((p) => ({ ...p, received_at: v }))} required />
              </div>
            </div>

            <div className="flex justify-end gap-2 pt-2 border-t border-gray-100 dark:border-gray-700">
              <button type="button" onClick={() => setPpeIssueModalOpen(false)} className="btn-outline btn-sm">
                {t('common.cancel')}
              </button>
              <button type="submit" disabled={ppeIssuing} className="btn-primary btn-sm flex items-center gap-2 disabled:opacity-50 disabled:cursor-not-allowed">
                {ppeIssuing && <Loader2 className="w-4 h-4 animate-spin" />}
                {t('ppe.issue.submit')}
              </button>
            </div>
          </form>
        </Modal>
      )}

      {qualificationModalOpen && (
        <Modal
          isOpen={qualificationModalOpen}
          onClose={closeQualificationModal}
          title={editingWorkerQualification ? t('common.edit') : t('workers.details.qualifications.addTitle')}
          size="lg"
        >
          <form onSubmit={saveWorkerQualification} className="space-y-4">
            <div>
              <label className="label text-xs">{t('workers.details.qualifications.type')}</label>
              <Select
                value={qualificationForm.qualification_type}
                onChange={(e) => {
                  const next = e.target.value
                  setQualificationForm((prev) => ({ ...prev, qualification_type: next }))
                }}
              >
                <option value="">{t('common.select')}</option>
                {QUALIFICATION_TYPE_OPTIONS.map((opt) => (
                  <option key={opt.value} value={opt.value}>
                    {t(opt.labelKey)}
                  </option>
                ))}
              </Select>
            </div>

            {qualificationForm.qualification_type === 'habilitation_electrique' && (
              <div>
                <label className="label text-xs">{t('workers.details.qualifications.level')}</label>
                <input
                  className="input"
                  value={qualificationForm.qualification_level}
                  onChange={(e) => setQualificationForm((prev) => ({ ...prev, qualification_level: e.target.value }))}
                  placeholder={t('workers.details.qualifications.levelPlaceholder')}
                />
              </div>
            )}

            {qualificationForm.qualification_type === 'other' && (
              <div>
                <label className="label text-xs">{t('workers.details.qualifications.otherLabel')}</label>
                <input
                  className="input"
                  value={qualificationForm.qualification_label}
                  onChange={(e) => setQualificationForm((prev) => ({ ...prev, qualification_label: e.target.value }))}
                />
              </div>
            )}

            <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
              <div>
                <label className="label text-xs">{t('workers.details.common.startDate')}</label>
                <DatePicker
                  value={qualificationForm.start_date}
                  onChange={(value) => {
                    setQualificationForm((prev) => {
                      const next = { ...prev, start_date: value }
                      if (!qualificationEndTouched) {
                        next.expiry_date = value ? addYearsToDate(value, 1) : ''
                      }
                      return next
                    })
                  }}
                  placeholder={t('workers.details.common.startDate')}
                />
              </div>
              <div>
                <label className="label text-xs">{t('workers.details.common.endDate')}</label>
                <DatePicker
                  value={qualificationForm.expiry_date}
                  onChange={(value) => {
                    setQualificationEndTouched(true)
                    setQualificationForm((prev) => ({ ...prev, expiry_date: value }))
                  }}
                  placeholder={t('workers.details.common.endDate')}
                />
                <div className="mt-1 text-[11px] text-gray-500 dark:text-gray-400">
                  {t('workers.details.common.endDateAutoHelp')}
                </div>
              </div>
            </div>

            <div>
              <label className="label text-xs">{t('workers.details.common.file')}</label>
              <label className="flex items-center justify-between border-2 border-dashed border-gray-300 dark:border-gray-600 rounded-lg px-3 py-2 text-xs cursor-pointer hover:border-hse-primary hover:bg-hse-primary/5">
                <div className="flex items-center gap-2">
                  <FileText className="w-4 h-4 text-gray-500" />
                  <span className="text-gray-700 dark:text-gray-200">
                    {qualificationForm.certificate ? qualificationForm.certificate.name : t('workers.details.common.choosePdf')}
                  </span>
                </div>
                <input type="file" accept="application/pdf" onChange={handleQualificationFileChange} className="hidden" />
              </label>
            </div>

            <div className="flex justify-end gap-2 pt-2 border-t border-gray-100 dark:border-gray-700">
              <button type="button" onClick={closeQualificationModal} className="btn-outline btn-sm">
                {t('common.cancel')}
              </button>
              <button
                type="submit"
                disabled={
                  qualificationSaving ||
                  !qualificationForm.qualification_type ||
                  !qualificationForm.start_date ||
                  (qualificationForm.qualification_type === 'other' && !String(qualificationForm.qualification_label ?? '').trim()) ||
                  (qualificationForm.qualification_type === 'habilitation_electrique' && !String(qualificationForm.qualification_level ?? '').trim())
                }
                className="btn-primary btn-sm flex items-center gap-2 disabled:opacity-50 disabled:cursor-not-allowed"
              >
                {qualificationSaving && <Loader2 className="w-4 h-4 animate-spin" />}
                {t('common.save')}
              </button>
            </div>
          </form>
        </Modal>
      )}

      {medicalModalOpen && (
        <Modal
          isOpen={medicalModalOpen}
          onClose={closeMedicalModal}
          title={editingWorkerMedical ? t('common.edit') : t('workers.details.medical.addTitle')}
          size="lg"
        >
          <form onSubmit={saveWorkerMedical} className="space-y-4">
            <div className="flex items-center justify-between p-3 bg-gray-50 dark:bg-gray-700/50 rounded-lg">
              <div>
                <label className="font-medium text-gray-900 dark:text-white text-sm">{t('workers.details.medical.status')}</label>
              </div>
              <button
                type="button"
                onClick={() => setMedicalForm((prev) => ({ ...prev, aptitude_status: prev.aptitude_status === 'apte' ? 'inapte' : 'apte' }))}
                className={`relative inline-flex h-6 w-14 items-center rounded-full transition-colors ${
                  medicalForm.aptitude_status === 'apte' ? 'bg-green-500' : 'bg-red-500'
                }`}
              >
                <span
                  className={`inline-block h-4 w-4 transform rounded-full bg-white transition-transform ${
                    medicalForm.aptitude_status === 'apte' ? 'translate-x-8' : 'translate-x-1'
                  }`}
                />
              </button>
            </div>
            <div className="text-xs text-gray-500 dark:text-gray-400">
              {medicalForm.aptitude_status === 'apte' ? t('workers.details.medical.apte') : t('workers.details.medical.inapte')}
            </div>

            <div>
              <label className="label text-xs">{t('workers.details.medical.examNature')}</label>
              <Select
                value={medicalForm.exam_nature}
                onChange={(e) => setMedicalForm((prev) => ({ ...prev, exam_nature: e.target.value }))}
              >
                <option value="">{t('common.select')}</option>
                {MEDICAL_EXAM_NATURE_OPTIONS.map((opt) => (
                  <option key={opt.value} value={opt.value}>
                    {t(opt.labelKey)}
                  </option>
                ))}
              </Select>
            </div>

            <div>
              <label className="label text-xs">{t('workers.details.medical.ableTo')}</label>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                {MEDICAL_ABLE_TO_OPTIONS.map((opt) => (
                  <label
                    key={opt.value}
                    className="flex items-center gap-2 p-2 rounded-lg border border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-900"
                  >
                    <input
                      type="checkbox"
                      checked={Array.isArray(medicalForm.able_to) && medicalForm.able_to.includes(opt.value)}
                      onChange={() => toggleMedicalAbleTo(opt.value)}
                      className="w-4 h-4 rounded border-gray-300 dark:border-gray-600 text-hse-primary focus:ring-hse-primary"
                    />
                    <span className="text-xs text-gray-700 dark:text-gray-200">{t(opt.labelKey)}</span>
                  </label>
                ))}
              </div>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
              <div>
                <label className="label text-xs">{t('workers.details.common.startDate')}</label>
                <DatePicker
                  value={medicalForm.exam_date}
                  onChange={(value) => {
                    setMedicalForm((prev) => {
                      const next = { ...prev, exam_date: value }
                      if (!medicalEndTouched) {
                        next.expiry_date = value ? addYearsToDate(value, 1) : ''
                      }
                      return next
                    })
                  }}
                  placeholder={t('workers.details.common.startDate')}
                />
              </div>
              <div>
                <label className="label text-xs">{t('workers.details.common.endDate')}</label>
                <DatePicker
                  value={medicalForm.expiry_date}
                  onChange={(value) => {
                    setMedicalEndTouched(true)
                    setMedicalForm((prev) => ({ ...prev, expiry_date: value }))
                  }}
                  placeholder={t('workers.details.common.endDate')}
                />
                <div className="mt-1 text-[11px] text-gray-500 dark:text-gray-400">
                  {t('workers.details.common.endDateAutoHelp')}
                </div>
              </div>
            </div>

            <div>
              <label className="label text-xs">{t('workers.details.common.file')}</label>
              <label className="flex items-center justify-between border-2 border-dashed border-gray-300 dark:border-gray-600 rounded-lg px-3 py-2 text-xs cursor-pointer hover:border-hse-primary hover:bg-hse-primary/5">
                <div className="flex items-center gap-2">
                  <FileText className="w-4 h-4 text-gray-500" />
                  <span className="text-gray-700 dark:text-gray-200">
                    {medicalForm.certificate ? medicalForm.certificate.name : t('workers.details.common.choosePdf')}
                  </span>
                </div>
                <input type="file" accept="application/pdf" onChange={handleMedicalFileChange} className="hidden" />
              </label>
            </div>

            <div className="flex justify-end gap-2 pt-2 border-t border-gray-100 dark:border-gray-700">
              <button type="button" onClick={closeMedicalModal} className="btn-outline btn-sm">
                {t('common.cancel')}
              </button>
              <button
                type="submit"
                disabled={medicalSaving || !medicalForm.exam_nature || !medicalForm.exam_date}
                className="btn-primary btn-sm flex items-center gap-2 disabled:opacity-50 disabled:cursor-not-allowed"
              >
                {medicalSaving && <Loader2 className="w-4 h-4 animate-spin" />}
                {t('common.save')}
              </button>
            </div>
          </form>
        </Modal>
      )}

      {trainingModalOpen && (
        <Modal
          isOpen={trainingModalOpen}
          onClose={closeTrainingModal}
          title={editingWorkerTraining ? t('common.edit') : t('workers.details.trainings.addTitle')}
          size="lg"
        >
          <form onSubmit={saveWorkerTraining} className="space-y-4">
            <div>
              <label className="label text-xs">{t('workers.details.trainings.type')}</label>
              <Select
                value={trainingForm.training_type}
                onChange={(e) => {
                  const next = e.target.value
                  setTrainingForm((prev) => ({ ...prev, training_type: next }))
                }}
              >
                <option value="">{t('common.select')}</option>
                {TRAINING_TYPE_OPTIONS.map((opt) => (
                  <option key={opt.value} value={opt.value}>
                    {t(opt.labelKey)}
                  </option>
                ))}
              </Select>
            </div>

            {trainingForm.training_type === 'other' && (
              <div>
                <label className="label text-xs">{t('workers.details.trainings.otherLabel')}</label>
                <input
                  className="input"
                  value={trainingForm.training_label}
                  onChange={(e) => setTrainingForm((prev) => ({ ...prev, training_label: e.target.value }))}
                />
              </div>
            )}

            <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
              <div>
                <label className="label text-xs">{t('workers.details.common.startDate')}</label>
                <DatePicker
                  value={trainingForm.training_date}
                  onChange={(value) => {
                    setTrainingForm((prev) => {
                      const next = { ...prev, training_date: value }
                      if (!trainingEndTouched) {
                        next.expiry_date = value ? addYearsToDate(value, 1) : ''
                      }
                      return next
                    })
                  }}
                  placeholder={t('workers.details.common.startDate')}
                />
              </div>
              <div>
                <label className="label text-xs">{t('workers.details.common.endDate')}</label>
                <DatePicker
                  value={trainingForm.expiry_date}
                  onChange={(value) => {
                    setTrainingEndTouched(true)
                    setTrainingForm((prev) => ({ ...prev, expiry_date: value }))
                  }}
                  placeholder={t('workers.details.common.endDate')}
                />
                <div className="mt-1 text-[11px] text-gray-500 dark:text-gray-400">
                  {t('workers.details.common.endDateAutoHelp')}
                </div>
              </div>
            </div>

            <div>
              <label className="label text-xs">{t('workers.details.common.file')}</label>
              <label className="flex items-center justify-between border-2 border-dashed border-gray-300 dark:border-gray-600 rounded-lg px-3 py-2 text-xs cursor-pointer hover:border-hse-primary hover:bg-hse-primary/5">
                <div className="flex items-center gap-2">
                  <FileText className="w-4 h-4 text-gray-500" />
                  <span className="text-gray-700 dark:text-gray-200">
                    {trainingForm.certificate ? trainingForm.certificate.name : t('workers.details.common.choosePdf')}
                  </span>
                </div>
                <input type="file" accept="application/pdf" onChange={handleTrainingFileChange} className="hidden" />
              </label>
            </div>

            <div className="flex justify-end gap-2 pt-2 border-t border-gray-100 dark:border-gray-700">
              <button type="button" onClick={closeTrainingModal} className="btn-outline btn-sm">
                {t('common.cancel')}
              </button>
              <button
                type="submit"
                disabled={
                  trainingSaving ||
                  !trainingForm.training_type ||
                  !trainingForm.training_date ||
                  (trainingForm.training_type === 'other' && !String(trainingForm.training_label ?? '').trim())
                }
                className="btn-primary btn-sm flex items-center gap-2 disabled:opacity-50 disabled:cursor-not-allowed"
              >
                {trainingSaving && <Loader2 className="w-4 h-4 animate-spin" />}
                {t('common.save')}
              </button>
            </div>
          </form>
        </Modal>
      )}

      {activePreview && (
        <Modal isOpen={!!activePreview} onClose={closePreview} title={t('common.view')} size="xl">
          <div className="space-y-4">
            <div className="h-[70vh]">
              {previewLoading ? (
                <div className="w-full h-full rounded-lg border border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-900 flex items-center justify-center">
                  <Loader2 className="w-6 h-6 animate-spin text-hse-primary" />
                </div>
              ) : previewUrl ? (
                <iframe
                  src={previewUrl}
                  title={t('common.view')}
                  className="w-full h-full rounded-lg border border-gray-200 dark:border-gray-700 bg-white"
                />
              ) : (
                <div className="w-full h-full rounded-lg border border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-900 flex items-center justify-center text-sm text-gray-500 dark:text-gray-400">
                  {t('errors.somethingWentWrong')}
                </div>
              )}
            </div>
            {typeof activePreview?.certificate_url === 'string' && activePreview.certificate_url && (
              <div className="flex justify-end">
                <a href={activePreview.certificate_url} download className="btn-primary inline-flex items-center gap-2 text-sm">
                  <Download className="w-4 h-4" />
                  {t('common.download')}
                </a>
              </div>
            )}
          </div>
        </Modal>
      )}

      {/* Import Modal */}
      <Modal
        isOpen={showImportModal}
        onClose={() => setShowImportModal(false)}
        title={t('workers.importTitle')}
        size="md"
      >
        <div className="space-y-4">
          <p className="text-sm text-gray-600 dark:text-gray-400">
            {t('workers.importHelp')}
          </p>

          <button
            onClick={handleDownloadTemplate}
            className="w-full btn-outline flex items-center justify-center gap-2"
          >
            <FileSpreadsheet className="w-4 h-4" />
            {t('workers.downloadTemplate')}
          </button>

          <div className="border-2 border-dashed border-gray-300 dark:border-gray-600 rounded-lg p-6 text-center">
            <input
              ref={fileInputRef}
              type="file"
              accept=".xlsx,.xls,.csv"
              onChange={(e) => setImportFile(e.target.files[0])}
              className="hidden"
            />
            {importFile ? (
              <div className="flex items-center justify-center gap-2">
                <FileSpreadsheet className="w-5 h-5 text-green-500" />
                <span className="text-sm font-medium">{importFile.name}</span>
                <button
                  type="button"
                  onClick={() => setImportFile(null)}
                  className="p-1 hover:bg-gray-100 dark:hover:bg-gray-700 rounded"
                >
                  <X className="w-4 h-4" />
                </button>
              </div>
            ) : (
              <button
                type="button"
                onClick={() => fileInputRef.current?.click()}
                className="text-hse-primary hover:underline"
              >
                {t('workers.selectFile')}
              </button>
            )}
          </div>

          <div className="p-3 bg-amber-50 dark:bg-amber-900/20 rounded-lg text-sm text-amber-700 dark:text-amber-300">
            <p>{t('workers.cinInfo')}</p>
          </div>

          <div className="flex justify-end gap-3 pt-4 border-t dark:border-gray-700">
            <button
              type="button"
              onClick={() => {
                setShowImportModal(false)
                setImportFile(null)
              }}
              className="btn-outline"
            >
              {t('common.cancel')}
            </button>
            <button
              type="button"
              onClick={handleImport}
              disabled={!importFile || importing}
              className="btn-primary flex items-center gap-2"
            >
              {importing && <Loader2 className="w-4 h-4 animate-spin" />}
              {t('workers.import')}
            </button>
          </div>
        </div>
      </Modal>
      <ConfirmDialog
        isOpen={!!confirmWorker}
        title={t('common.confirm')}
        message={
          confirmWorker
            ? t('workers.confirmDeactivate', { name: `${confirmWorker.prenom} ${confirmWorker.nom}` })
            : ''
        }
        confirmLabel={t('workers.deactivate')}
        cancelLabel={t('common.cancel')}
        variant="danger"
        onConfirm={confirmDeactivate}
        onCancel={() => setConfirmWorker(null)}
      />

      <ConfirmDialog
        isOpen={showBulkConfirm}
        title={t('common.confirm')}
        message={t('workers.confirmBulkDeactivate', { count: selectedWorkers.length })}
        confirmLabel={t('workers.bulkDeactivate')}
        cancelLabel={t('common.cancel')}
        variant="danger"
        onConfirm={confirmBulkDeactivate}
        onCancel={() => setShowBulkConfirm(false)}
      />
    </div>
  )
}
