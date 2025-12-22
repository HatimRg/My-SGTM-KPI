import { useEffect, useMemo, useState } from 'react'
import { useLocation } from 'react-router-dom'
import { workerService, workerTrainingService, projectService } from '../../services/api'
import { useLanguage } from '../../i18n'
import { useAuthStore } from '../../store/authStore'
import DatePicker from '../../components/ui/DatePicker'
import Select from '../../components/ui/Select'
import Modal from '../../components/ui/Modal'
import { getProjectLabel, sortProjects } from '../../utils/projectList'
import {
  Search,
  HardHat,
  PlusCircle,
  FileText,
  AlertTriangle,
  CheckCircle,
  Loader2,
  Download,
  Filter,
  X,
} from 'lucide-react'
import toast from 'react-hot-toast'

const TRAINING_TYPES = [
  { value: 'induction_hse', labelKey: 'qualifiedPersonnel.types.inductionHse' },
  { value: 'aptitude_physique', labelKey: 'qualifiedPersonnel.types.aptitudePhysique' },
  { value: 'travail_en_hauteur', labelKey: 'qualifiedPersonnel.types.travailHauteur' },
  { value: 'elinguage', labelKey: 'qualifiedPersonnel.types.elinguage' },
  { value: 'outillage_electrique', labelKey: 'qualifiedPersonnel.types.outillageElectrique' },
  { value: 'inspecteur_echafaudage', labelKey: 'qualifiedPersonnel.types.inspecteurEchafaudage' },
  { value: 'monteur_echafaudage', labelKey: 'qualifiedPersonnel.types.monteurEchafaudage' },
  { value: 'incendie', labelKey: 'qualifiedPersonnel.types.incendie' },
  { value: 'secourisme', labelKey: 'qualifiedPersonnel.types.secourisme' },
  { value: 'reconnaissance_hse', labelKey: 'qualifiedPersonnel.types.reconnaissanceHse' },
  { value: 'other', labelKey: 'qualifiedPersonnel.types.other' },
]

const TYPE_LABEL_MAP = TRAINING_TYPES.reduce((acc, t) => {
  acc[t.value] = t.labelKey
  return acc
}, {})

const STATUS_STYLES = {
  valid: 'bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-300',
  expiring: 'bg-amber-100 text-amber-700 dark:bg-amber-900/30 dark:text-amber-300',
  expired: 'bg-red-100 text-red-700 dark:bg-red-900/30 dark:text-red-300',
  no_expiry: 'bg-gray-100 text-gray-700 dark:bg-gray-800 dark:text-gray-300',
}

export default function QualifiedPersonnel() {
  const { t } = useLanguage()
  const { user } = useAuthStore()

  const location = useLocation()

  const [projects, setProjects] = useState([])
  const [selectedProject, setSelectedProject] = useState('')
  const [searchTerm, setSearchTerm] = useState('')
  const [workerFilterTrainingType, setWorkerFilterTrainingType] = useState('')
  const [workerFilterTrainingLabel, setWorkerFilterTrainingLabel] = useState('')
  const [otherTrainingLabels, setOtherTrainingLabels] = useState([])

  const projectListPreference = user?.project_list_preference ?? 'code'
  const sortedProjects = useMemo(() => {
    return sortProjects(projects, projectListPreference)
  }, [projects, projectListPreference])

  const [workers, setWorkers] = useState([])
  const [workersPage, setWorkersPage] = useState(1)
  const [workersTotalPages, setWorkersTotalPages] = useState(1)
  const [workersTotalResults, setWorkersTotalResults] = useState(0)
  const [loadingWorkers, setLoadingWorkers] = useState(false)

  const [selectedWorker, setSelectedWorker] = useState(null)

  const [trainings, setTrainings] = useState([])
  const [loadingTrainings, setLoadingTrainings] = useState(false)

  const [trainingType, setTrainingType] = useState('')
  const [trainingLabel, setTrainingLabel] = useState('')
  const [trainingDate, setTrainingDate] = useState('')
  const [expiryDate, setExpiryDate] = useState('')
  const [certificateFile, setCertificateFile] = useState(null)
  const [savingTraining, setSavingTraining] = useState(false)

  const [activeCertificate, setActiveCertificate] = useState(null)

  const [showExpiring, setShowExpiring] = useState(false)
  const [expiringTrainings, setExpiringTrainings] = useState([])
  const [loadingExpiring, setLoadingExpiring] = useState(false)

  const isExpiryBeforeTraining =
    trainingDate && expiryDate && typeof trainingDate === 'string' && typeof expiryDate === 'string'
      ? expiryDate < trainingDate
      : false

  useEffect(() => {
    const loadProjects = async () => {
      try {
        const list = await projectService.getAllList({ status: 'active' })
        setProjects(list)
      } catch (error) {
        console.error('Failed to load projects for qualified personnel page', error)
      }
    }

    loadProjects()
  }, [])

  useEffect(() => {
    const params = new URLSearchParams(location.search)
    const projectId = params.get('project_id')
    const workerId = params.get('worker_id')

    if (projectId) {
      setSelectedProject(projectId)
      setWorkersPage(1)
    }

    if (workerId) {
      workerService
        .getById(workerId)
        .then((res) => {
          const payload = res.data
          const worker = payload.data ?? payload
          setSelectedWorker(worker)
        })
        .catch((error) => {
          console.error('Failed to load worker for qualified personnel deep-link', error)
        })
    }
  }, [location.search])

  useEffect(() => {
    fetchWorkers()
  }, [selectedProject, searchTerm, workerFilterTrainingType, workerFilterTrainingLabel, workersPage])

  useEffect(() => {
    const fetchOtherLabels = async () => {
      try {
        const params = {}
        if (selectedProject) params.project_id = selectedProject
        const res = await workerTrainingService.getOtherLabels(params)
        const payload = res.data
        const labels = payload.data ?? payload
        setOtherTrainingLabels(Array.isArray(labels) ? labels : [])
      } catch (error) {
        console.error('Failed to load other training labels', error)
        setOtherTrainingLabels([])
      }
    }

    fetchOtherLabels()
  }, [selectedProject])

  useEffect(() => {
    if (selectedWorker) {
      fetchWorkerTrainings(selectedWorker.id)
    } else {
      setTrainings([])
    }
  }, [selectedWorker])

  useEffect(() => {
    if (showExpiring) {
      fetchExpiringTrainings()
    }
  }, [showExpiring])

  const fetchWorkers = async () => {
    try {
      setLoadingWorkers(true)
      const params = {
        page: workersPage,
        per_page: 25,
        is_active: true,
      }
      if (selectedProject) params.project_id = selectedProject
      if (searchTerm) params.search = searchTerm
      if (workerFilterTrainingType) params.training_type = workerFilterTrainingType
      if (workerFilterTrainingType === 'other' && workerFilterTrainingLabel) {
        params.training_label = workerFilterTrainingLabel
      }

      const res = await workerService.getAll(params)
      const payload = res.data
      const data = payload.data ?? payload

      const items = Array.isArray(data)
        ? data
        : (Array.isArray(data?.data) ? data.data : [])

      const meta = payload.meta ?? data.meta ?? data

      setWorkers(items)
      setWorkersTotalPages(meta.last_page ?? 1)
      setWorkersTotalResults(meta.total ?? items.length)
      if (!selectedWorker && items.length > 0) {
        setSelectedWorker(items[0])
      }
    } catch (error) {
      console.error('Failed to load workers for qualified personnel', error)
      toast.error(t('errors.somethingWentWrong') ?? 'Failed to load workers')
    } finally {
      setLoadingWorkers(false)
    }
  }

  const fetchWorkerTrainings = async (workerId) => {
    try {
      setLoadingTrainings(true)
      const params = {
        worker_id: workerId,
        per_page: 100,
      }
      const res = await workerTrainingService.getAll(params)
      const payload = res.data
      const data = payload.data ?? payload
      const items = Array.isArray(data) ? data : (data.data ?? [])
      setTrainings(items)
    } catch (error) {
      console.error('Failed to load worker trainings', error)
      toast.error(t('errors.somethingWentWrong') ?? 'Failed to load trainings')
    } finally {
      setLoadingTrainings(false)
    }
  }

  const fetchExpiringTrainings = async () => {
    try {
      setLoadingExpiring(true)
      const params = {
        status: 'expiring_or_expired',
        for_my_projects: true,
        per_page: 100,
      }
      const res = await workerTrainingService.getAll(params)
      const payload = res.data
      const data = payload.data ?? payload
      const items = Array.isArray(data) ? data : (data.data ?? [])
      setExpiringTrainings(items)
    } catch (error) {
      console.error('Failed to load expiring trainings', error)
      toast.error(t('errors.somethingWentWrong') ?? 'Failed to load trainings')
    } finally {
      setLoadingExpiring(false)
    }
  }

  const handleSelectWorker = (worker) => {
    setSelectedWorker(worker)
  }

  const handleCertificateChange = (e) => {
    const file = e.target.files?.[0]
    if (file && file.type !== 'application/pdf') {
      toast.error('PDF only')
      return
    }
    setCertificateFile(file ?? null)
  }

  const handleSaveTraining = async (e) => {
    e.preventDefault()
    if (!selectedWorker) return
    if (!trainingType || !trainingDate) return
    if (trainingType === 'other' && !trainingLabel.trim()) return
    if (isExpiryBeforeTraining) {
      toast.error(t('qualifiedPersonnel.invalidExpiry') ?? "Expiry date can't be before training date")
      return
    }

    setSavingTraining(true)
    try {
      const payload = {
        worker_id: selectedWorker.id,
        training_type: trainingType,
        training_label: trainingType === 'other' ? trainingLabel.trim() : undefined,
        training_date: trainingDate,
        expiry_date: expiryDate ? expiryDate : undefined,
        certificate: certificateFile ? certificateFile : undefined,
      }

      await workerTrainingService.create(payload)
      toast.success(t('qualifiedPersonnel.trainingCreated') ?? 'Worker training saved')

      setTrainingType('')
      setTrainingLabel('')
      setTrainingDate('')
      setExpiryDate('')
      setCertificateFile(null)

      fetchWorkerTrainings(selectedWorker.id)
      if (showExpiring) {
        fetchExpiringTrainings()
      }
    } catch (error) {
      console.error('Failed to save worker training', error)
      const message = error.response?.data?.message ?? t('errors.somethingWentWrong') ?? 'Failed to save training'
      toast.error(message)
    } finally {
      setSavingTraining(false)
    }
  }

  const formatDate = (dateStr) => {
    if (!dateStr) return ''
    return new Date(dateStr).toLocaleDateString('fr-FR')
  }

  const getTypeLabel = (training) => {
    const key = TYPE_LABEL_MAP[training.training_type]
    if (key) return t(key)
    if (training.training_label) return training.training_label
    return training.training_type
  }

  const getStatusLabel = (status) => {
    if (status === 'expiring') return t('qualifiedPersonnel.statusExpiring')
    if (status === 'expired') return t('qualifiedPersonnel.statusExpired')
    if (status === 'no_expiry') return t('qualifiedPersonnel.statusNoExpiry')
    return t('qualifiedPersonnel.statusValid')
  }

  const sortedTrainings = useMemo(() => {
    if (!Array.isArray(trainings)) return []
    return [...trainings].sort((a, b) => {
      if (a.expiry_date && b.expiry_date) {
        return a.expiry_date.localeCompare(b.expiry_date)
      }
      if (a.expiry_date) return -1
      if (b.expiry_date) return 1
      return (b.training_date ?? '').localeCompare(a.training_date ?? '')
    })
  }, [trainings])

  const getTrainingFilterValue = () => {
    if (!workerFilterTrainingType) return ''
    if (workerFilterTrainingType === 'other' && workerFilterTrainingLabel) {
      return `other::${workerFilterTrainingLabel}`
    }
    return workerFilterTrainingType
  }

  const hasWorkersFilters = Boolean(
    selectedProject ||
    searchTerm ||
    workerFilterTrainingType ||
    workerFilterTrainingLabel
  )

  return (
    <div className="space-y-6 animate-fade-in">
      <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-4">
        <div>
          <div className="text-xs text-gray-500 dark:text-gray-400 mb-1">
            {t('nav.dashboard')} / {t('qualifiedPersonnel.navLabel')}
          </div>
          <h1 className="text-2xl font-bold text-gray-900 dark:text-gray-100">
            {t('qualifiedPersonnel.pageTitle')}
          </h1>
          <p className="text-gray-600 dark:text-gray-400">
            {t('qualifiedPersonnel.pageSubtitle')}
          </p>
        </div>
        <div className="flex flex-wrap gap-2 items-center">
          <button
            type="button"
            onClick={() => setShowExpiring((prev) => !prev)}
            className="btn-outline btn-sm flex items-center gap-2"
          >
            <AlertTriangle className="w-4 h-4 text-amber-500" />
            {showExpiring
              ? t('qualifiedPersonnel.viewAllButton')
              : t('qualifiedPersonnel.viewExpiringButton')}
          </button>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
        <div className="space-y-4 lg:col-span-1">
          <div className="card p-3 space-y-3">
            <div className="flex items-center gap-2">
              <HardHat className="w-5 h-5 text-hse-primary" />
              <h2 className="font-semibold text-gray-900 dark:text-gray-100 text-sm">
                {t('qualifiedPersonnel.workerCardTitle')}
              </h2>
            </div>
            <Select
              value={selectedProject}
              onChange={(e) => {
                setSelectedProject(e.target.value)
                setWorkersPage(1)
                setSelectedWorker(null)
                setWorkerFilterTrainingLabel('')
              }}
            >
              <option value="">{t('workers.allProjects')}</option>
              {sortedProjects.map((p) => (
                <option key={p.id} value={p.id}>
                  {getProjectLabel(p)}
                </option>
              ))}
            </Select>

            <Select
              value={getTrainingFilterValue()}
              onChange={(e) => {
                const raw = e.target.value
                if (!raw) {
                  setWorkerFilterTrainingType('')
                  setWorkerFilterTrainingLabel('')
                } else if (raw.startsWith('other::')) {
                  setWorkerFilterTrainingType('other')
                  setWorkerFilterTrainingLabel(raw.slice('other::'.length))
                } else {
                  setWorkerFilterTrainingType(raw)
                  setWorkerFilterTrainingLabel('')
                }
                setWorkersPage(1)
                setSelectedWorker(null)
              }}
              className="py-1.5 text-sm"
            >
              <option value="">{t('qualifiedPersonnel.filters.trainingPlaceholder')}</option>
              {TRAINING_TYPES.filter((tt) => tt.value !== 'other').map((tt) => (
                <option key={tt.value} value={tt.value}>
                  {t(tt.labelKey)}
                </option>
              ))}
              {otherTrainingLabels.length > 0 && (
                <optgroup label={t('qualifiedPersonnel.types.other')}>
                  {otherTrainingLabels.map((label) => (
                    <option key={label} value={`other::${label}`}>
                      {label}
                    </option>
                  ))}
                </optgroup>
              )}
            </Select>
            <div className="relative">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
              <input
                type="text"
                value={searchTerm}
                onChange={(e) => {
                  setSearchTerm(e.target.value)
                  setWorkersPage(1)
                  setSelectedWorker(null)
                }}
                placeholder={t('qualifiedPersonnel.filters.searchPlaceholder')}
                className="input pl-9 py-1.5 text-sm"
              />
            </div>

            {hasWorkersFilters && (
              <div className="text-[11px] text-gray-500 dark:text-gray-400">
                {t('qualifiedPersonnel.filters.resultsCount', { count: workersTotalResults })}
              </div>
            )}
          </div>

          <div className="card p-3 max-h-[520px] overflow-y-auto">
            {loadingWorkers ? (
              <div className="flex items-center justify-center py-8">
                <Loader2 className="w-5 h-5 animate-spin text-hse-primary" />
              </div>
            ) : workers.length === 0 ? (
              <p className="text-xs text-gray-500 dark:text-gray-400 text-center py-4">
                {t('workers.noWorkers')}
              </p>
            ) : (
              <div className="space-y-2">
                {workers.map((worker) => {
                  const isSelected = selectedWorker?.id === worker.id
                  return (
                    <button
                      key={worker.id}
                      type="button"
                      onClick={() => handleSelectWorker(worker)}
                      className={`w-full text-left border rounded-lg px-3 py-2 text-xs transition-colors ${
                        isSelected
                          ? 'border-hse-primary bg-hse-primary/5'
                          : 'border-gray-200 dark:border-gray-700 hover:bg-gray-50 dark:hover:bg-gray-800'
                      }`}
                    >
                      <div className="flex items-center justify-between gap-2">
                        <div>
                          <p className="font-semibold text-gray-900 dark:text-gray-100 text-sm">
                            {worker.prenom} {worker.nom}
                          </p>
                          <p className="text-[11px] text-gray-500 dark:text-gray-400 font-mono">
                            {worker.cin?.toUpperCase()}
                          </p>
                        </div>
                        <div className="text-right text-[11px] text-gray-500 dark:text-gray-400">
                          <p className="truncate max-w-[120px]">
                            {worker.fonction ?? ''}
                          </p>
                          <p className="truncate max-w-[120px]">
                            {worker.project?.name ?? ''}
                          </p>
                        </div>
                      </div>
                    </button>
                  )
                })}
              </div>
            )}

            {workersTotalPages > 1 && (
              <div className="mt-3 flex items-center justify-between text-[11px] text-gray-500 dark:text-gray-400">
                <span>
                  {t('common.page')} {workersPage} {t('common.of')} {workersTotalPages}
                </span>
                <div className="flex gap-1">
                  <button
                    type="button"
                    onClick={() => setWorkersPage((p) => Math.max(1, p - 1))}
                    disabled={workersPage === 1}
                    className="px-2 py-1 rounded border border-gray-300 dark:border-gray-600 disabled:opacity-50 disabled:cursor-not-allowed"
                  >
                    {t('common.previous')}
                  </button>
                  <button
                    type="button"
                    onClick={() => setWorkersPage((p) => Math.min(workersTotalPages, p + 1))}
                    disabled={workersPage === workersTotalPages}
                    className="px-2 py-1 rounded border border-gray-300 dark:border-gray-600 disabled:opacity-50 disabled:cursor-not-allowed"
                  >
                    {t('common.next')}
                  </button>
                </div>
              </div>
            )}
          </div>
        </div>

        <div className="space-y-4 lg:col-span-2">
          {selectedWorker ? (
            <>
              <div className="card p-4 flex flex-col md:flex-row md:items-center md:justify-between gap-3">
                <div className="flex items-center gap-3">
                  <div className="w-10 h-10 rounded-full bg-hse-primary/10 flex items-center justify-center">
                    <HardHat className="w-5 h-5 text-hse-primary" />
                  </div>
                  <div>
                    <p className="font-semibold text-gray-900 dark:text-gray-100">
                      {selectedWorker.prenom} {selectedWorker.nom}
                    </p>
                    <p className="text-xs text-gray-500 dark:text-gray-400 font-mono">
                      {selectedWorker.cin?.toUpperCase()}
                    </p>
                    <p className="text-[11px] text-gray-500 dark:text-gray-400 mt-1">
                      {selectedWorker.fonction ?? ''} · {selectedWorker.entreprise ?? ''} ·{' '}
                      {selectedWorker.project?.name ?? ''}
                    </p>
                  </div>
                </div>
                <button
                  type="button"
                  onClick={() => setSelectedWorker(null)}
                  className="btn-outline btn-sm flex items-center gap-2"
                  title={t('common.unselect')}
                >
                  <X className="w-4 h-4" />
                  {t('common.unselect')}
                </button>
              </div>

              <div className="card p-4 space-y-4 overflow-visible">
                <div className="flex items-center justify-between gap-2">
                  <div className="flex items-center gap-2">
                    <PlusCircle className="w-4 h-4 text-hse-primary" />
                    <h2 className="font-semibold text-gray-900 dark:text-gray-100 text-sm">
                      {t('qualifiedPersonnel.addTrainingTitle')}
                    </h2>
                  </div>
                </div>

                <form onSubmit={handleSaveTraining} className="space-y-4">
                  <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
                    <div>
                      <label className="label text-xs">
                        {t('qualifiedPersonnel.trainingType')}
                      </label>
                      <Select
                        value={trainingType}
                        onChange={(e) => setTrainingType(e.target.value)}
                      >
                        <option value="">{t('common.select')}</option>
                        {TRAINING_TYPES.map((type) => (
                          <option key={type.value} value={type.value}>
                            {t(type.labelKey)}
                          </option>
                        ))}
                      </Select>
                    </div>
                    <div>
                      <label className="label text-xs">
                        {t('qualifiedPersonnel.trainingDate')}
                      </label>
                      <DatePicker
                        value={trainingDate}
                        onChange={setTrainingDate}
                        placeholder={t('qualifiedPersonnel.trainingDate')}
                      />
                    </div>
                    <div>
                      <label className="label text-xs">
                        {t('qualifiedPersonnel.expiryDate')}
                      </label>
                      <DatePicker
                        value={expiryDate}
                        onChange={setExpiryDate}
                        placeholder={t('qualifiedPersonnel.expiryDate')}
                      />
                    </div>
                  </div>

                  {trainingType === 'other' && (
                    <div>
                      <label className="label text-xs">
                        {t('qualifiedPersonnel.trainingLabel')}
                      </label>
                      <input
                        type="text"
                        value={trainingLabel}
                        onChange={(e) => setTrainingLabel(e.target.value)}
                        className="input"
                      />
                    </div>
                  )}

                  <div>
                    <label className="label text-xs">
                      {t('qualifiedPersonnel.certificate')}
                    </label>
                    <label className="flex items-center justify-between border-2 border-dashed border-gray-300 dark:border-gray-600 rounded-lg px-3 py-2 text-xs cursor-pointer hover:border-hse-primary hover:bg-hse-primary/5">
                      <div className="flex items-center gap-2">
                        <FileText className="w-4 h-4 text-gray-500" />
                        <span className="text-gray-700 dark:text-gray-200">
                          {certificateFile
                            ? certificateFile.name
                            : t('qualifiedPersonnel.chooseFile')}
                        </span>
                      </div>
                      <input
                        type="file"
                        accept="application/pdf"
                        onChange={handleCertificateChange}
                        className="hidden"
                      />
                    </label>
                  </div>

                  <div className="flex justify-end gap-2 pt-2 border-t border-gray-100 dark:border-gray-700">
                    <button
                      type="submit"
                      disabled={
                        savingTraining ||
                        !trainingType ||
                        !trainingDate ||
                        (trainingType === 'other' && !trainingLabel.trim()) ||
                        isExpiryBeforeTraining
                      }
                      className="btn-primary flex items-center gap-2 text-sm"
                    >
                      {savingTraining && <Loader2 className="w-4 h-4 animate-spin" />}
                      {t('qualifiedPersonnel.saveTraining')}
                    </button>
                  </div>
                </form>
              </div>

              <div className="card p-4 space-y-3">
                <div className="flex items-center justify-between gap-2">
                  <div className="flex items-center gap-2">
                    <FileText className="w-4 h-4 text-hse-primary" />
                    <h2 className="font-semibold text-gray-900 dark:text-gray-100 text-sm">
                      {t('qualifiedPersonnel.trainingListTitle')}
                    </h2>
                  </div>
                </div>

                {loadingTrainings ? (
                  <div className="flex items-center justify-center py-6">
                    <Loader2 className="w-5 h-5 animate-spin text-hse-primary" />
                  </div>
                ) : sortedTrainings.length === 0 ? (
                  <p className="text-xs text-gray-500 dark:text-gray-400">
                    {t('qualifiedPersonnel.noTrainings')}
                  </p>
                ) : (
                  <div className="overflow-x-auto">
                    <table className="min-w-full text-xs">
                      <thead>
                        <tr className="border-b border-gray-200 dark:border-gray-700 text-left">
                          <th className="py-2 pr-3 font-medium text-gray-500 dark:text-gray-400">
                            {t('qualifiedPersonnel.colType')}
                          </th>
                          <th className="py-2 pr-3 font-medium text-gray-500 dark:text-gray-400">
                            {t('qualifiedPersonnel.colStartDate')}
                          </th>
                          <th className="py-2 pr-3 font-medium text-gray-500 dark:text-gray-400">
                            {t('qualifiedPersonnel.colEndDate')}
                          </th>
                          <th className="py-2 pr-3 font-medium text-gray-500 dark:text-gray-400">
                            {t('common.status')}
                          </th>
                          <th className="py-2 pr-3 font-medium text-gray-500 dark:text-gray-400">
                            {t('qualifiedPersonnel.colCertificate')}
                          </th>
                        </tr>
                      </thead>
                      <tbody>
                        {sortedTrainings.map((tr) => (
                          <tr
                            key={tr.id}
                            className="border-b border-gray-100 dark:border-gray-800"
                          >
                            <td className="py-2 pr-3 text-gray-900 dark:text-gray-100">
                              {getTypeLabel(tr)}
                            </td>
                            <td className="py-2 pr-3 text-gray-700 dark:text-gray-200">
                              {formatDate(tr.training_date)}
                            </td>
                            <td className="py-2 pr-3 text-gray-700 dark:text-gray-200">
                              {formatDate(tr.expiry_date)}
                            </td>
                            <td className="py-2 pr-3">
                              <span
                                className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[11px] ${
                                  STATUS_STYLES[tr.status] ?? STATUS_STYLES.valid
                                }`}
                              >
                                {tr.status === 'expired' && (
                                  <AlertTriangle className="w-3 h-3" />
                                )}
                                {tr.status === 'expiring' && (
                                  <AlertTriangle className="w-3 h-3" />
                                )}
                                {tr.status === 'valid' && (
                                  <CheckCircle className="w-3 h-3" />
                                )}
                                {getStatusLabel(tr.status)}
                              </span>
                            </td>
                            <td className="py-2 pr-3 text-gray-700 dark:text-gray-200">
                              {tr.certificate_url ? (
                                <div className="flex items-center gap-2">
                                  <button
                                    type="button"
                                    onClick={() => setActiveCertificate(tr)}
                                    className="text-[11px] text-hse-primary hover:underline"
                                  >
                                    {t('qualifiedPersonnel.viewCertificate')}
                                  </button>
                                  <a
                                    href={tr.certificate_url}
                                    download
                                    className="text-[11px] text-gray-500 hover:underline flex items-center gap-1"
                                  >
                                    <Download className="w-3 h-3" />
                                    {t('qualifiedPersonnel.downloadCertificate')}
                                  </a>
                                </div>
                              ) : (
                                <span className="text-[11px] text-gray-400">-</span>
                              )}
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                )}
              </div>
            </>
          ) : (
            <div className="card p-6 flex flex-col items-center justify-center text-center gap-3 h-full min-h-[260px]">
              <HardHat className="w-10 h-10 text-gray-300 dark:text-gray-700" />
              <p className="text-sm font-medium text-gray-700 dark:text-gray-200">
                {t('qualifiedPersonnel.noWorkerSelected')}
              </p>
              <p className="text-xs text-gray-500 dark:text-gray-400 max-w-md">
                {t('qualifiedPersonnel.noWorkerSelectedHelp')}
              </p>
            </div>
          )}

          {showExpiring && (
            <div className="card p-4 space-y-3 mt-4">
              <div className="flex items-center justify-between gap-2">
                <div className="flex items-center gap-2">
                  <Filter className="w-4 h-4 text-amber-500" />
                  <h2 className="font-semibold text-gray-900 dark:text-gray-100 text-sm">
                    {t('qualifiedPersonnel.expiringListTitle')}
                  </h2>
                </div>
              </div>

              {loadingExpiring ? (
                <div className="flex items-center justify-center py-6">
                  <Loader2 className="w-5 h-5 animate-spin text-hse-primary" />
                </div>
              ) : expiringTrainings.length === 0 ? (
                <p className="text-xs text-gray-500 dark:text-gray-400">
                  {t('qualifiedPersonnel.noExpiring') ?? t('qualifiedPersonnel.noTrainings')}
                </p>
              ) : (
                <div className="overflow-x-auto">
                  <table className="min-w-full text-xs">
                    <thead>
                      <tr className="border-b border-gray-200 dark:border-gray-700 text-left">
                        <th className="py-2 pr-3 font-medium text-gray-500 dark:text-gray-400">
                          {t('workers.nom')}/{t('workers.prenom')}
                        </th>
                        <th className="py-2 pr-3 font-medium text-gray-500 dark:text-gray-400">
                          {t('workers.cin')}
                        </th>
                        <th className="py-2 pr-3 font-medium text-gray-500 dark:text-gray-400">
                          {t('workers.projet')}
                        </th>
                        <th className="py-2 pr-3 font-medium text-gray-500 dark:text-gray-400">
                          {t('qualifiedPersonnel.colType')}
                        </th>
                        <th className="py-2 pr-3 font-medium text-gray-500 dark:text-gray-400">
                          {t('qualifiedPersonnel.colEndDate')}
                        </th>
                        <th className="py-2 pr-3 font-medium text-gray-500 dark:text-gray-400">
                          {t('common.status')}
                        </th>
                      </tr>
                    </thead>
                    <tbody>
                      {expiringTrainings.map((tr) => (
                        <tr
                          key={tr.id}
                          className="border-b border-gray-100 dark:border-gray-800"
                        >
                          <td className="py-2 pr-3 text-gray-900 dark:text-gray-100">
                            {tr.worker?.prenom} {tr.worker?.nom}
                          </td>
                          <td className="py-2 pr-3 text-gray-700 dark:text-gray-200 font-mono">
                            {tr.worker?.cin?.toUpperCase()}
                          </td>
                          <td className="py-2 pr-3 text-gray-700 dark:text-gray-200">
                            {tr.worker?.project?.name ?? ''}
                          </td>
                          <td className="py-2 pr-3 text-gray-700 dark:text-gray-200">
                            {getTypeLabel(tr)}
                          </td>
                          <td className="py-2 pr-3 text-gray-700 dark:text-gray-200">
                            {formatDate(tr.expiry_date)}
                          </td>
                          <td className="py-2 pr-3">
                            <span
                              className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[11px] ${
                                STATUS_STYLES[tr.status] ?? STATUS_STYLES.valid
                              }`}
                            >
                              {tr.status === 'expired' && (
                                <AlertTriangle className="w-3 h-3" />
                              )}
                              {tr.status === 'expiring' && (
                                <AlertTriangle className="w-3 h-3" />
                              )}
                              {tr.status === 'valid' && (
                                <CheckCircle className="w-3 h-3" />
                              )}
                              {getStatusLabel(tr.status)}
                            </span>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}
            </div>
          )}
        </div>
      </div>

      {activeCertificate && (
        <Modal
          isOpen={!!activeCertificate}
          onClose={() => setActiveCertificate(null)}
          title={t('qualifiedPersonnel.viewCertificate')}
          size="xl"
        >
          <div className="space-y-4">
            <div className="h-[70vh]">
              <iframe
                src={activeCertificate.certificate_url}
                title={t('qualifiedPersonnel.viewCertificate')}
                className="w-full h-full rounded-lg border border-gray-200 dark:border-gray-700 bg-white"
              />
            </div>
            <div className="flex justify-end">
              <a
                href={activeCertificate.certificate_url}
                download
                className="btn-primary inline-flex items-center gap-2 text-sm"
              >
                <Download className="w-4 h-4" />
                {t('qualifiedPersonnel.downloadCertificate')}
              </a>
            </div>
          </div>
        </Modal>
      )}
    </div>
  )
}
