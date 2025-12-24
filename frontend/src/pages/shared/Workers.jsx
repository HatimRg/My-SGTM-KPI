import { useState, useEffect, useMemo, useRef } from 'react'
import { workerService, projectService } from '../../services/api'
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
  Download,
  Upload,
  Loader2,
  X,
  Pen,
  FileSpreadsheet,
  Building2,
  CreditCard,
  HardHat,
  CheckCircle,
  Trash2
} from 'lucide-react'
import toast from 'react-hot-toast'

export default function Workers() {
  const { t } = useLanguage()
  const { user } = useAuthStore()
  const fileInputRef = useRef(null)

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
  }, [])

  useEffect(() => {
    fetchWorkers()
  }, [currentPage, debouncedSearchTerm, selectedProject, selectedEntreprise, selectedFonction, selectedPole])

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
      const [projectsRes, entreprisesRes, fonctionsRes, statsRes] = await Promise.all([
        projectService.getAllList({ status: 'active' }),
        workerService.getEntreprises(),
        workerService.getFonctions(),
        workerService.getStatistics(),
      ])
      // Filter projects user has access to
      setProjects(Array.isArray(projectsRes) ? projectsRes : [])
      setEntreprises(entreprisesRes.data.data ?? [])
      setFonctions(fonctionsRes.data.data ?? [])
      setStatistics(statsRes.data.data)
    } catch (error) {
      console.error('Failed to load initial data:', error)
    }
  }

  const fetchWorkers = async () => {
    try {
      setLoading(true)
      const params = {
        page: currentPage,
        per_page: perPage,
        search: debouncedSearchTerm ? debouncedSearchTerm : undefined,
        pole: selectedPole ? selectedPole : undefined,
        project_id: selectedProject ? selectedProject : undefined,
        entreprise: selectedEntreprise ? selectedEntreprise : undefined,
        fonction: selectedFonction ? selectedFonction : undefined,
        is_active: true, // Only show active workers
      }
      const res = await workerService.getAll(params)
      const payload = res.data
      const data = payload.data ?? payload
      const items = Array.isArray(data) ? data : (data?.data ?? [])
      const meta = payload.meta ?? data.meta ?? data
      setWorkers(prev => (currentPage === 1 ? items : [...prev, ...items]))
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
  const physicalAptitudeCount = statistics?.aptitude_physique ?? 0

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
      fetchInitialData() // Refresh stats
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
      fetchInitialData()
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
      fetchInitialData()
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
        project_id: selectedProject ? selectedProject : undefined,
        entreprise: selectedEntreprise ? selectedEntreprise : undefined,
        fonction: selectedFonction ? selectedFonction : undefined,
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
      fetchWorkers()
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
                <p className="text-xs text-gray-500 dark:text-gray-400">Induction HSE</p>
                <p className="text-xl font-bold text-gray-900 dark:text-white">{inductionHseCount}</p>
              </div>
            </div>

            <div className="card p-3 flex items-center gap-3">
              <div className="p-2.5 bg-purple-100 dark:bg-purple-900/50 rounded-lg">
                <HardHat className="w-5 h-5 text-purple-600 dark:text-purple-400" />
              </div>
              <div>
                <p className="text-xs text-gray-500 dark:text-gray-400">Work at height</p>
                <p className="text-xl font-bold text-gray-900 dark:text-white">{workAtHeightCount}</p>
              </div>
            </div>

            <div className="card p-3 flex items-center gap-3">
              <div className="p-2.5 bg-amber-100 dark:bg-amber-900/50 rounded-lg">
                <Users className="w-5 h-5 text-amber-600 dark:text-amber-400" />
              </div>
              <div>
                <p className="text-xs text-gray-500 dark:text-gray-400">Physical aptitude</p>
                <p className="text-xl font-bold text-gray-900 dark:text-white">{physicalAptitudeCount}</p>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Filters */}
      <div className="card p-3">
        <div className="grid grid-cols-1 md:grid-cols-12 gap-2 items-center">
          <div className="relative md:col-span-3">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
            <input
              type="text"
              value={searchTerm}
              onChange={(e) => { setSearchTerm(e.target.value); setCurrentPage(1); }}
              placeholder={t('common.search')}
              className="input pl-9 py-1.5 text-sm"
            />
          </div>
          <div className="md:col-span-2">
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
          <div className="md:col-span-3">
            <Select
              value={selectedProject}
              onChange={(e) => { setSelectedProject(e.target.value); setCurrentPage(1); }}
              className="py-1.5 text-sm"
            >
              <option value="">{t('workers.allProjects')}</option>
              {visibleProjects.map(p => (
                <option key={p.id} value={p.id}>{getProjectLabel(p)}</option>
              ))}
            </Select>
          </div>
          <div className="md:col-span-2">
            <Select
              value={selectedEntreprise}
              onChange={(e) => { setSelectedEntreprise(e.target.value); setCurrentPage(1); }}
              className="py-1.5 text-sm"
            >
              <option value="">{t('workers.allEntreprises')}</option>
              {entreprises.map(e => (
                <option key={e} value={e}>{e}</option>
              ))}
            </Select>
          </div>
          <div className="md:col-span-2">
            <Select
              value={selectedFonction}
              onChange={(e) => { setSelectedFonction(e.target.value); setCurrentPage(1); }}
              className="py-1.5 text-sm"
            >
              <option value="">{t('workers.allFonctions')}</option>
              {fonctions.map(f => (
                <option key={f} value={f}>{f}</option>
              ))}
            </Select>
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
          <table className="w-full text-xs">
            <thead>
              <tr className="bg-gray-50 dark:bg-gray-800 border-b border-gray-200 dark:border-gray-700">
                <th className="w-8 px-2 py-2">
                  <input
                    type="checkbox"
                    checked={selectAll}
                    onChange={toggleSelectAll}
                    className="w-3.5 h-3.5 rounded border-gray-300 dark:border-gray-600 text-hse-primary focus:ring-hse-primary"
                  />
                </th>
                <th className="px-2 py-2 text-left font-semibold text-gray-700 dark:text-gray-300">{t('workers.nom')}</th>
                <th className="px-2 py-2 text-left font-semibold text-gray-700 dark:text-gray-300">{t('workers.prenom')}</th>
                <th className="px-2 py-2 text-left font-semibold text-gray-700 dark:text-gray-300">{t('workers.cin')}</th>
                <th className="px-2 py-2 text-left font-semibold text-gray-700 dark:text-gray-300">{t('workers.fonction')}</th>
                <th className="px-2 py-2 text-left font-semibold text-gray-700 dark:text-gray-300">{t('workers.entreprise')}</th>
                <th className="px-2 py-2 text-left font-semibold text-gray-700 dark:text-gray-300">{t('workers.projet')}</th>
                <th className="px-2 py-2 text-left font-semibold text-gray-700 dark:text-gray-300">{t('workers.dateEntree')}</th>
                <th className="px-2 py-2 text-center font-semibold text-gray-700 dark:text-gray-300 w-16">{t('common.actions')}</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-100 dark:divide-gray-700">
              {workers.map((worker) => (
                <tr key={worker.id} className="hover:bg-gray-50 dark:hover:bg-gray-800/50">
                  <td className="px-2 py-1.5">
                    <input
                      type="checkbox"
                      checked={selectedWorkers.includes(worker.id)}
                      onChange={() => toggleWorkerSelection(worker.id)}
                      className="w-3.5 h-3.5 rounded border-gray-300 dark:border-gray-600 text-hse-primary focus:ring-hse-primary"
                    />
                  </td>
                  <td className="px-2 py-1.5 font-medium text-gray-900 dark:text-white">{worker.nom}</td>
                  <td className="px-2 py-1.5 text-gray-700 dark:text-gray-300">{worker.prenom}</td>
                  <td className="px-2 py-1.5 font-mono text-gray-600 dark:text-gray-400">{worker.cin?.toUpperCase()}</td>
                  <td className="px-2 py-1.5 text-gray-700 dark:text-gray-300">{worker.fonction ?? ''}</td>
                  <td className="px-2 py-1.5 text-gray-700 dark:text-gray-300">{worker.entreprise ?? ''}</td>
                  <td className="px-2 py-1.5 text-gray-700 dark:text-gray-300">{worker.project?.name ?? ''}</td>
                  <td className="px-2 py-1.5 text-gray-600 dark:text-gray-400">{formatDate(worker.date_entree)}</td>
                  <td className="px-2 py-1.5">
                    <div className="flex items-center justify-center gap-0.5">
                      <button
                        onClick={() => handleOpenModal(worker)}
                        className="p-1 hover:bg-gray-100 dark:hover:bg-gray-700 rounded"
                        title={t('common.edit')}
                      >
                        <Pen className="w-3.5 h-3.5 text-gray-500 dark:text-gray-400" />
                      </button>
                      <button
                        onClick={() => handleDeactivate(worker)}
                        className="p-1 hover:bg-red-100 dark:hover:bg-red-900/30 rounded"
                        title={t('workers.deactivate')}
                      >
                        <Trash2 className="w-3.5 h-3.5 text-red-500 dark:text-red-400" />
                      </button>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
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
