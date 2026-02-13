import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import toast from 'react-hot-toast'
import api, { heavyMachineryService, projectService } from '../../../services/api'
import { useLanguage } from '../../../i18n'
import { useAuthStore } from '../../../store/authStore'
import Select from '../../../components/ui/Select'
import FilterBar from '../../../components/ui/filters/FilterBar'
import FilterSelect from '../../../components/ui/filters/FilterSelect'
import Modal from '../../../components/ui/Modal'
import DatePicker from '../../../components/ui/DatePicker'
import { getProjectLabel, sortProjects } from '../../../utils/projectList'
import {
  PlusCircle,
  ChevronDown,
  RefreshCw,
  Search,
  Loader2,
  Truck,
  FileText,
  Users,
  ClipboardCheck,
  Upload,
  Download,
  Eye,
  Trash2,
  Pencil,
  Image as ImageIcon,
} from 'lucide-react'

const MACHINE_IMAGE_BLOB_CACHE_MAX = 50
const machineImageBlobCache = new Map()

export default function ViewMachines() {
  const { t, language } = useLanguage()
  const { user, token } = useAuthStore()

  const MachineImage = ({ machineId, updatedAt, alt, className }) => {
    const [src, setSrc] = useState(null)

    useEffect(() => {
      if (!machineId || !token) {
        setSrc(null)
        return
      }

      let cancelled = false
      const v = updatedAt ? encodeURIComponent(String(updatedAt)) : ''
      const url = `/api/heavy-machinery/machines/${machineId}/image${v ? `?v=${v}` : ''}`

      const cacheKey = `${token}::${machineId}::${v}`
      const cached = machineImageBlobCache.get(cacheKey)

      if (cached?.objectUrl) {
        setSrc(cached.objectUrl)
        return () => {
          cancelled = true
        }
      }

      if (cached?.pending) {
        cached.pending
          .then((objectUrl) => {
            if (!cancelled) setSrc(objectUrl)
          })
          .catch(() => {
            if (!cancelled) setSrc(null)
          })

        return () => {
          cancelled = true
        }
      }

      const pending = (async () => {
        const res = await fetch(url, {
          headers: {
            Authorization: `Bearer ${token}`,
          },
        })
        if (!res.ok) throw new Error(`image fetch failed: ${res.status}`)
        const blob = await res.blob()
        return URL.createObjectURL(blob)
      })()

      machineImageBlobCache.set(cacheKey, { pending })

      ;(async () => {
        try {
          const objectUrl = await pending
          machineImageBlobCache.set(cacheKey, { objectUrl })

          while (machineImageBlobCache.size > MACHINE_IMAGE_BLOB_CACHE_MAX) {
            const firstKey = machineImageBlobCache.keys().next().value
            const first = machineImageBlobCache.get(firstKey)
            machineImageBlobCache.delete(firstKey)
            if (first?.objectUrl) URL.revokeObjectURL(first.objectUrl)
          }

          if (!cancelled) setSrc(objectUrl)
        } catch {
          machineImageBlobCache.delete(cacheKey)
          if (!cancelled) setSrc(null)
        }
      })()

      return () => {
        cancelled = true
      }
    }, [machineId, token, updatedAt])

    if (!src) return null
    return <img src={src} alt={alt} className={className} loading="lazy" />
  }

  const [machines, setMachines] = useState([])
  const [loadingMachines, setLoadingMachines] = useState(false)
  const [search, setSearch] = useState('')

  // Advanced filters are managed from the Filters dropdown button (search is kept outside).
  const [filtersOpen, setFiltersOpen] = useState(false)
  const filtersButtonRef = useRef(null)
  const filtersMenuRef = useRef(null)
  const [selectedPole, setSelectedPole] = useState('')
  const [selectedProjectId, setSelectedProjectId] = useState('')
  const [selectedMachineType, setSelectedMachineType] = useState('')
  const [selectedStatus, setSelectedStatus] = useState('')

  const [projects, setProjects] = useState([])
  const projectListPreference = user?.project_list_preference ?? 'code'
  const sortedProjects = useMemo(() => {
    return sortProjects(projects, projectListPreference)
  }, [projects, projectListPreference])

  const poles = useMemo(() => {
    const set = new Set()
    for (const p of sortedProjects) {
      const pole = String(p?.pole ?? '').trim()
      if (pole) set.add(pole)
    }
    return Array.from(set).sort((a, b) => a.localeCompare(b))
  }, [sortedProjects])

  const visibleProjects = useMemo(() => {
    if (!selectedPole) return sortedProjects
    return sortedProjects.filter((p) => String(p?.pole ?? '') === String(selectedPole))
  }, [sortedProjects, selectedPole])

  const [createOpen, setCreateOpen] = useState(false)
  const [creating, setCreating] = useState(false)
  const [createSerialOpen, setCreateSerialOpen] = useState(false)
  const [createSerial, setCreateSerial] = useState('')
  const [createExistingMachineId, setCreateExistingMachineId] = useState(null)
  const [checkingSerial, setCheckingSerial] = useState(false)
  const [addMenuOpen, setAddMenuOpen] = useState(false)
  const addMenuRef = useRef(null)
  const [createData, setCreateData] = useState({
    serial_number: '',
    internal_code: '',
    machine_type: '',
    brand: '',
    model: '',
    project_id: '',
    is_active: true,
    image: null,
  })

  const [detailsOpen, setDetailsOpen] = useState(false)
  const [activeMachineId, setActiveMachineId] = useState(null)
  const [detailsLoading, setDetailsLoading] = useState(false)
  const [detailsTab, setDetailsTab] = useState('documents')
  const [details, setDetails] = useState(null)

  const [editOpen, setEditOpen] = useState(false)
  const [editSaving, setEditSaving] = useState(false)
  const [editData, setEditData] = useState({
    serial_number: '',
    internal_code: '',
    machine_type: '',
    brand: '',
    model: '',
    project_id: '',
    is_active: true,
    image: null,
  })

  const [imageModalOpen, setImageModalOpen] = useState(false)

  const [docModalOpen, setDocModalOpen] = useState(false)
  const [docSaving, setDocSaving] = useState(false)
  const [docEditing, setDocEditing] = useState(null)
  const [docForm, setDocForm] = useState({
    document_key: '',
    document_label: '',
    start_date: '',
    expiry_date: '',
    file: null,
  })

  const [inspectionModalOpen, setInspectionModalOpen] = useState(false)
  const [inspectionSaving, setInspectionSaving] = useState(false)
  const [inspectionForm, setInspectionForm] = useState({
    start_date: '',
    end_date: '',
    file: null,
  })

  const [operatorQuery, setOperatorQuery] = useState('')
  const [operatorResults, setOperatorResults] = useState([])
  const [operatorSearching, setOperatorSearching] = useState(false)
  const [operatorSelectedId, setOperatorSelectedId] = useState('')
  const [operatorSelectedLabel, setOperatorSelectedLabel] = useState('')

  const [bulkModalOpen, setBulkModalOpen] = useState(false)

  const [activePreview, setActivePreview] = useState(null)
  const [previewUrl, setPreviewUrl] = useState(null)
  const [previewLoading, setPreviewLoading] = useState(false)

  const [bulkFile, setBulkFile] = useState(null)
  const [bulkUploading, setBulkUploading] = useState(false)
  const bulkInputRef = useRef(null)

  const [documentKeys, setDocumentKeys] = useState([])
  const [machineTypes, setMachineTypes] = useState([])

  const [createMachineTypeChoice, setCreateMachineTypeChoice] = useState('')
  const [editMachineTypeChoice, setEditMachineTypeChoice] = useState('')

  useEffect(() => {
    const onClick = (e) => {
      const target = e.target
      if (!addMenuRef.current || !(target instanceof Node)) return
      if (!addMenuRef.current.contains(target)) {
        setAddMenuOpen(false)
      }
    }

    document.addEventListener('mousedown', onClick)
    return () => document.removeEventListener('mousedown', onClick)
  }, [])

  const fetchDocumentKeys = useCallback(async () => {
    try {
      const res = await heavyMachineryService.getDocumentKeys()
      const list = res.data?.data ?? []
      setDocumentKeys(Array.isArray(list) ? list : [])
    } catch (e) {
      setDocumentKeys([])
    }
  }, [])

  const fetchMachineTypes = useCallback(async () => {
    try {
      const res = await heavyMachineryService.getMachineTypes()
      const list = res.data?.data ?? []
      const normalized = Array.isArray(list)
        ? list
            .filter((v) => v && typeof v === 'object')
            .map((v) => ({
              value: String(v.value ?? ''),
              label: String(v.label ?? ''),
            }))
            .filter((v) => v.value.trim() !== '' && v.label.trim() !== '')
        : []
      setMachineTypes(normalized)
    } catch (e) {
      setMachineTypes([])
    }
  }, [language])

  const machineTypeValueSet = useMemo(() => {
    const s = new Set()
    for (const mt of machineTypes) {
      if (mt?.value) s.add(mt.value)
    }
    return s
  }, [machineTypes])

  const getMachineTypeLabel = useCallback(
    (m) => {
      if (!m) return ''
      const lang = language === 'en' ? 'en' : 'fr'
      const label = lang === 'en' ? m.machine_type_label_en : m.machine_type_label_fr
      if (label) return label

      const key = m.machine_type_key ?? m.machine_type
      if (!key) return ''
      const found = machineTypes.find((opt) => opt.value === key)
      return found?.label ?? String(m.machine_type ?? '')
    },
    [language, machineTypes],
  )

  const extractFilename = (contentDisposition) => {
    if (!contentDisposition) return null
    const match = /filename\*=UTF-8''([^;]+)|filename="?([^";]+)"?/i.exec(contentDisposition)
    const value = decodeURIComponent(match?.[1] ?? match?.[2] ?? '')
    return value !== '' ? value : null
  }

  const addDaysToDate = (dateStr, days) => {
    if (!dateStr) return ''
    const d = new Date(`${dateStr}T00:00:00`)
    if (Number.isNaN(d.getTime())) return ''
    d.setDate(d.getDate() + days)
    const yyyy = d.getFullYear()
    const mm = String(d.getMonth() + 1).padStart(2, '0')
    const dd = String(d.getDate()).padStart(2, '0')
    return `${yyyy}-${mm}-${dd}`
  }

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

  const handleDownloadTemplate = async () => {
    try {
      const res = await heavyMachineryService.downloadMachinesTemplate()
      const filename = extractFilename(res.headers?.['content-disposition']) ?? 'SGTM-Machines-Template.xlsx'
      downloadBlob(res.data, filename)
    } catch (e) {
      toast.error(t('heavyMachinery.viewMachines.bulk.downloadTemplateFailed'))
    }
  }

  const openBulkImport = () => {
    setBulkModalOpen(true)
  }

  const handleBulkImport = async () => {
    if (!bulkFile) {
      toast.error(t('heavyMachinery.viewMachines.bulk.chooseFile'))
      return
    }

    try {
      setBulkUploading(true)
      const form = new FormData()
      form.append('file', bulkFile)
      const res = await heavyMachineryService.importMachines(form)
      const payload = res.data?.data ?? {}
      const imported = payload.imported ?? 0
      const updated = payload.updated ?? 0
      const errors = payload.errors ?? []
      const failedRowsUrl = payload.failed_rows_url
      toast.success(t('heavyMachinery.viewMachines.bulk.importSummary', { imported, updated }))
      if (errors.length > 0) toast.error(t('heavyMachinery.viewMachines.bulk.importIssues', { count: errors.length }))

      if (failedRowsUrl) {
        try {
          await downloadFromUrl(failedRowsUrl, 'machines_failed_rows.xlsx')
        } catch {
          // ignore
        }
      }

      setBulkFile(null)
      if (bulkInputRef.current) bulkInputRef.current.value = ''
      fetchMachines()
    } catch (e) {
      toast.error(e.response?.data?.message ?? t('heavyMachinery.viewMachines.bulk.importFailed'))
    } finally {
      setBulkUploading(false)
    }
  }

  const fetchProjects = useCallback(async () => {
    try {
      const list = await projectService.getAllList({ status: 'active' })
      setProjects(Array.isArray(list) ? list : [])
    } catch (e) {
      setProjects([])
    }
  }, [])

  const fetchMachines = useCallback(async () => {
    try {
      setLoadingMachines(true)
      const res = await heavyMachineryService.getMachines()
      const payload = res.data?.data ?? []
      setMachines(Array.isArray(payload) ? payload : [])
    } catch (e) {
      toast.error(e.response?.data?.message ?? t('errors.failedToLoad') ?? 'Failed to load')
      setMachines([])
    } finally {
      setLoadingMachines(false)
    }
  }, [t])

  useEffect(() => {
    fetchProjects()
    fetchMachines()
    fetchDocumentKeys()
    fetchMachineTypes()
  }, [fetchProjects, fetchMachines, fetchDocumentKeys, fetchMachineTypes])

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
    // Reset project if it is no longer compatible with pole filter
    if (!selectedPole) return
    if (!selectedProjectId) return
    const stillVisible = visibleProjects.some((p) => String(p.id) === String(selectedProjectId))
    if (!stillVisible) setSelectedProjectId('')
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [selectedPole])

  useEffect(() => {
    return () => {
      if (previewUrl) URL.revokeObjectURL(previewUrl)
    }
  }, [previewUrl])

  const filteredMachines = useMemo(() => {
    let list = Array.isArray(machines) ? machines : []

    if (selectedPole) {
      list = list.filter((m) => String(m?.project?.pole ?? '') === String(selectedPole))
    }
    if (selectedProjectId) {
      list = list.filter((m) => String(m?.project_id ?? m?.project?.id ?? '') === String(selectedProjectId))
    }
    if (selectedMachineType) {
      list = list.filter((m) => String(m?.machine_type_key ?? m?.machine_type ?? '') === String(selectedMachineType))
    }
    if (selectedStatus === 'active') {
      list = list.filter((m) => !!m?.is_active)
    } else if (selectedStatus === 'inactive') {
      list = list.filter((m) => !m?.is_active)
    }

    const q = search.trim().toLowerCase()
    if (!q) return list

    return list.filter((m) => {
      const hay = [
        m.serial_number,
        m.internal_code,
        m.machine_type,
        m.machine_type_label_fr,
        m.machine_type_label_en,
        m.brand,
        m.model,
        m.project?.name,
      ]
        .filter(Boolean)
        .join(' ')
        .toLowerCase()
      return hay.includes(q)
    })
  }, [machines, search, selectedMachineType, selectedPole, selectedProjectId, selectedStatus])

  const openCreate = () => {
    setCreateData({
      serial_number: '',
      internal_code: '',
      machine_type: '',
      brand: '',
      model: '',
      project_id: '',
      is_active: true,
      image: null,
    })
    setCreateMachineTypeChoice('')
    setCreateSerial('')
    setCreateExistingMachineId(null)
    setCreateSerialOpen(true)
  }

  const handleCheckSerial = async () => {
    const serial = createSerial.trim()
    if (!serial) return

    try {
      setCheckingSerial(true)

      const res = await heavyMachineryService.globalSearch(serial)
      const found = res.data?.data?.machine ?? null

      if (found?.id) {
        const typeKey = found.machine_type_key ?? found.machine_type ?? ''
        const inList = typeKey && machineTypeValueSet.has(typeKey)

        setCreateExistingMachineId(found.id)
        setCreateMachineTypeChoice(machineTypes.length > 0 ? (inList ? typeKey : '') : '')
        setCreateData({
          serial_number: found.serial_number ?? serial,
          internal_code: found.internal_code ?? '',
          machine_type: inList ? typeKey : '',
          brand: found.brand ?? '',
          model: found.model ?? '',
          project_id: found.project_id ? String(found.project_id) : '',
          is_active: found.is_active !== undefined ? !!found.is_active : true,
          image: null,
        })
      } else {
        setCreateExistingMachineId(null)
        setCreateMachineTypeChoice('')
        setCreateData({
          serial_number: serial,
          internal_code: '',
          machine_type: '',
          brand: '',
          model: '',
          project_id: '',
          is_active: true,
          image: null,
        })
      }

      setCreateSerialOpen(false)
      setCreateOpen(true)
    } catch (e) {
      toast.error(e.response?.data?.message ?? t('errors.somethingWentWrong'))
    } finally {
      setCheckingSerial(false)
    }
  }

  const openEdit = () => {
    const m = details?.machine
    if (!m) return

    const typeKey = m.machine_type_key ?? m.machine_type ?? ''
    const inList = typeKey && machineTypeValueSet.has(typeKey)

    setEditData({
      serial_number: m.serial_number ?? '',
      internal_code: m.internal_code ?? '',
      machine_type: inList ? typeKey : '',
      brand: m.brand ?? '',
      model: m.model ?? '',
      project_id: m.project_id ? String(m.project_id) : '',
      is_active: !!m.is_active,
      image: null,
    })
    setEditMachineTypeChoice(inList ? typeKey : '')
    setEditOpen(true)
  }

  const handleCreate = async (e) => {
    e.preventDefault()

    try {
      setCreating(true)

      if (createExistingMachineId) {
        const payload = {
          serial_number: createData.serial_number,
          internal_code: createData.internal_code?.trim() ? createData.internal_code.trim() : null,
          machine_type: createData.machine_type,
          brand: createData.brand,
          model: createData.model?.trim() ? createData.model.trim() : null,
          project_id: createData.project_id ? Number(createData.project_id) : null,
          is_active: !!createData.is_active,
        }

        await heavyMachineryService.updateMachine(createExistingMachineId, payload)

        if (createData.image) {
          const form = new FormData()
          form.append('image', createData.image)
          await heavyMachineryService.uploadMachineImage(createExistingMachineId, form)
        }

        toast.success(t('common.success'))
        setCreateOpen(false)
        setCreateExistingMachineId(null)
        fetchMachines()
        fetchMachineTypes()
        return
      }

      const form = new FormData()
      form.append('serial_number', createData.serial_number)
      if (createData.internal_code?.trim()) form.append('internal_code', createData.internal_code.trim())
      form.append('machine_type', createData.machine_type)
      form.append('brand', createData.brand)
      if (createData.model?.trim()) form.append('model', createData.model.trim())
      if (createData.project_id) form.append('project_id', createData.project_id)
      form.append('is_active', createData.is_active ? '1' : '0')
      if (createData.image) form.append('image', createData.image)

      await heavyMachineryService.createMachine(form)
      toast.success(t('heavyMachinery.viewMachines.form.created'))
      setCreateOpen(false)
      fetchMachines()
      fetchMachineTypes()
    } catch (e2) {
      toast.error(e2.response?.data?.message ?? t('heavyMachinery.viewMachines.form.saveFailed'))
    } finally {
      setCreating(false)
    }
  }

  const refreshDetails = async (machineId) => {
    if (!machineId) return
    try {
      setDetailsLoading(true)
      const res = await heavyMachineryService.getMachine(machineId)
      setDetails(res.data?.data ?? null)
    } catch (e) {
      toast.error(e.response?.data?.message ?? t('errors.failedToLoad') ?? 'Failed to load')
      setDetails(null)
    } finally {
      setDetailsLoading(false)
    }
  }

  const openDetails = async (machineId) => {
    setActiveMachineId(machineId)
    setDetailsOpen(true)
    setDetailsTab('documents')
    setOperatorQuery('')
    setOperatorResults([])
    setOperatorSelectedId('')
    setOperatorSelectedLabel('')
    await refreshDetails(machineId)
  }

  const closeDetails = () => {
    setDetailsOpen(false)
    setActiveMachineId(null)
    setDetails(null)
    setDetailsTab('documents')
  }

  const openPreview = async (item) => {
    if (!item?.file_view_url) return

    try {
      setActivePreview(item)
      setPreviewLoading(true)

      if (previewUrl) {
        URL.revokeObjectURL(previewUrl)
        setPreviewUrl(null)
      }

      const path = normalizeApiPath(item.file_view_url)
      const res = await api.get(path, { responseType: 'blob' })
      const url = URL.createObjectURL(res.data)
      setPreviewUrl(url)
    } catch (e) {
      toast.error(e.response?.data?.message ?? t('errors.somethingWentWrong') ?? 'Failed to preview')
      setActivePreview(null)
    } finally {
      setPreviewLoading(false)
    }
  }

  const closePreview = () => {
    setActivePreview(null)
    setPreviewLoading(false)
    if (previewUrl) {
      URL.revokeObjectURL(previewUrl)
      setPreviewUrl(null)
    }
  }

  const handleDownloadFile = async (item, fallbackName = 'document.pdf') => {
    if (!item?.file_download_url) return

    try {
      const path = normalizeApiPath(item.file_download_url)
      const res = await api.get(path, { responseType: 'blob' })
      const filenameFromHeader = extractFilename(res.headers?.['content-disposition'])
      const filename = filenameFromHeader ?? fallbackName
      downloadBlob(res.data, filename)
    } catch (e) {
      toast.error(e.response?.data?.message ?? t('errors.somethingWentWrong') ?? 'Failed to download')
    }
  }

  const openDocModal = (doc = null) => {
    setDocEditing(doc)
    const key = doc?.document_key ?? ''
    const label = doc?.document_label ?? ''
    const keyLabel = documentKeys.find((k) => k.key === key)?.label
    const start = doc?.start_date ?? ''
    const expiry = doc?.expiry_date ?? ''
    const autoExpiry = !expiry && start ? addYearsToDate(start, 1) : expiry
    setDocForm({
      document_key: key,
      document_label: label || keyLabel || '',
      start_date: start,
      expiry_date: autoExpiry,
      file: null,
    })
    setDocModalOpen(true)
  }

  const handleDocSave = async (e) => {
    e.preventDefault()
    if (!activeMachineId) return
    if (!docForm.document_key.trim()) return
    if (!docForm.file && !docEditing) {
      toast.error(t('heavyMachinery.viewMachines.documents.choosePdf'))
      return
    }

    try {
      setDocSaving(true)
      const form = new FormData()
      form.append('document_key', docForm.document_key.trim())
      if (docForm.start_date) form.append('start_date', docForm.start_date)
      if (docForm.expiry_date) form.append('expiry_date', docForm.expiry_date)
      if (docForm.file) form.append('file', docForm.file)

      if (docEditing?.id) {
        await heavyMachineryService.updateDocument(activeMachineId, docEditing.id, form)
      } else {
        await heavyMachineryService.upsertDocument(activeMachineId, form)
      }

      toast.success(t('heavyMachinery.viewMachines.documents.uploaded'))
      setDocModalOpen(false)
      setDocEditing(null)
      await refreshDetails(activeMachineId)
    } catch (e2) {
      toast.error(e2.response?.data?.message ?? t('heavyMachinery.viewMachines.documents.uploadFailed'))
    } finally {
      setDocSaving(false)
    }
  }

  const handleDeleteDocument = async (doc) => {
    if (!activeMachineId || !doc?.id) return
    const ok = window.confirm(t('common.delete'))
    if (!ok) return
    try {
      await heavyMachineryService.deleteDocument(activeMachineId, doc.id)
      toast.success(t('common.success'))
      await refreshDetails(activeMachineId)
    } catch (e) {
      toast.error(e.response?.data?.message ?? t('errors.somethingWentWrong') ?? 'Failed')
    }
  }

  const openInspectionModal = () => {
    setInspectionForm({
      start_date: '',
      end_date: '',
      file: null,
    })
    setInspectionModalOpen(true)
  }

  const handleInspectionSave = async (e) => {
    e.preventDefault()
    if (!activeMachineId) return
    if (!inspectionForm.file) {
      toast.error(t('heavyMachinery.viewMachines.inspections.choosePdf'))
      return
    }

    try {
      setInspectionSaving(true)
      const form = new FormData()
      if (inspectionForm.start_date) form.append('start_date', inspectionForm.start_date)
      if (inspectionForm.end_date) form.append('end_date', inspectionForm.end_date)
      form.append('file', inspectionForm.file)
      await heavyMachineryService.upsertInspection(activeMachineId, form)
      toast.success(t('heavyMachinery.viewMachines.inspections.uploaded'))
      setInspectionModalOpen(false)
      await refreshDetails(activeMachineId)
    } catch (e2) {
      toast.error(e2.response?.data?.message ?? t('heavyMachinery.viewMachines.inspections.uploadFailed'))
    } finally {
      setInspectionSaving(false)
    }
  }

  const handleDeleteInspection = async (inspection) => {
    if (!activeMachineId || !inspection?.id) return
    const ok = window.confirm(t('heavyMachinery.viewMachines.inspections.deleteConfirm'))
    if (!ok) return
    try {
      await heavyMachineryService.deleteInspection(activeMachineId, inspection.id)
      toast.success(t('heavyMachinery.viewMachines.inspections.deleted'))
      await refreshDetails(activeMachineId)
    } catch (e) {
      toast.error(e.response?.data?.message ?? t('heavyMachinery.viewMachines.inspections.deleteFailed'))
    }
  }

  const operatorProjectId = details?.machine?.project_id

  const searchOperators = useCallback(async () => {
    if (!operatorProjectId) return

    try {
      setOperatorSearching(true)
      const res = await heavyMachineryService.searchWorkers({
        project_id: operatorProjectId,
        q: operatorQuery.trim() ? operatorQuery.trim() : undefined,
        limit: 20,
      })
      const list = res.data?.data ?? []
      setOperatorResults(Array.isArray(list) ? list : [])
    } catch (e) {
      setOperatorResults([])
      toast.error(e.response?.data?.message ?? t('errors.failedToLoad') ?? 'Failed to load')
    } finally {
      setOperatorSearching(false)
    }
  }, [operatorProjectId, operatorQuery])

  useEffect(() => {
    if (!detailsOpen || !operatorProjectId) return
    if (!operatorQuery.trim()) {
      setOperatorResults([])
      setOperatorSelectedId('')
      return
    }
    const timer = setTimeout(() => {
      searchOperators()
    }, 350)
    return () => clearTimeout(timer)
  }, [detailsOpen, operatorProjectId, operatorQuery, searchOperators])

  const handleAssignOperator = async () => {
    if (!activeMachineId || !operatorSelectedId) return
    try {
      await heavyMachineryService.addOperator(activeMachineId, operatorSelectedId)
      toast.success(t('heavyMachinery.viewMachines.operators.assigned'))
      setOperatorQuery('')
      setOperatorResults([])
      setOperatorSelectedId('')
      await refreshDetails(activeMachineId)
    } catch (e) {
      toast.error(e.response?.data?.message ?? t('heavyMachinery.viewMachines.operators.assignFailed'))
    }
  }

  const handleRemoveOperator = async (workerId) => {
    if (!activeMachineId) return
    try {
      await heavyMachineryService.removeOperator(activeMachineId, workerId)
      toast.success(t('heavyMachinery.viewMachines.operators.removed'))
      await refreshDetails(activeMachineId)
    } catch (e) {
      toast.error(e.response?.data?.message ?? t('heavyMachinery.viewMachines.operators.removeFailed'))
    }
  }

  const handleEditSave = async (e) => {
    e.preventDefault()
    if (!activeMachineId) return

    try {
      setEditSaving(true)

      const payload = {
        serial_number: editData.serial_number,
        internal_code: editData.internal_code?.trim() ? editData.internal_code.trim() : null,
        machine_type: editData.machine_type,
        brand: editData.brand,
        model: editData.model?.trim() ? editData.model.trim() : null,
        project_id: editData.project_id ? Number(editData.project_id) : null,
        is_active: !!editData.is_active,
      }

      await heavyMachineryService.updateMachine(activeMachineId, payload)

      if (editData.image) {
        const form = new FormData()
        form.append('image', editData.image)
        await heavyMachineryService.uploadMachineImage(activeMachineId, form)
      }

      toast.success(t('common.success'))
      setEditOpen(false)
      await refreshDetails(activeMachineId)
      fetchMachines()
      fetchMachineTypes()
    } catch (e2) {
      toast.error(e2.response?.data?.message ?? t('errors.somethingWentWrong') ?? 'Failed')
    } finally {
      setEditSaving(false)
    }
  }

  const getMachineImageSrc = (machineId, updatedAt) => {
    if (!machineId) return null
    const v = updatedAt ? encodeURIComponent(String(updatedAt)) : ''
    return `/api/heavy-machinery/machines/${machineId}/image${v ? `?v=${v}` : ''}`
  }

  const handleDeleteMachine = async () => {
    if (!activeMachineId) return
    const ok = window.confirm(
      t('heavyMachinery.viewMachines.delete.confirmProfessional') ??
        "Please delete this machine only if it was added by mistake. If the machine still exists but is no longer in your project, set it to INACTIVE instead.\n\nDo you want to delete it now?",
    )
    if (!ok) return
    try {
      await heavyMachineryService.deleteMachine(activeMachineId)
      toast.success(t('heavyMachinery.viewMachines.delete.success'))
      closeDetails()
      fetchMachines()
    } catch (e) {
      toast.error(e.response?.data?.message ?? t('heavyMachinery.viewMachines.delete.failed'))
    }
  }

  return (
    <div className="space-y-6 animate-fade-in">
      <div>
        <h1 className="text-2xl font-bold text-gray-900 dark:text-gray-100">{t('heavyMachinery.title')}</h1>
        <p className="text-gray-500 dark:text-gray-400 mt-1">{t('heavyMachinery.viewMachines.title')}</p>
      </div>

      <div className="card p-4 overflow-visible">
        <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-3">
          <div className="relative flex-1">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
            <input
              type="text"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder={t('heavyMachinery.viewMachines.searchPlaceholder')}
              className="input pl-9"
            />
          </div>

          <div className="flex gap-2">
            <div className="relative" ref={filtersMenuRef}>
              <button
                type="button"
                ref={filtersButtonRef}
                onClick={() => setFiltersOpen((v) => !v)}
                className="btn-secondary flex items-center gap-2"
              >
                {t('common.filters') ?? 'Filters'}
                <ChevronDown className={`w-4 h-4 transition ${filtersOpen ? 'rotate-180' : ''}`} />
              </button>

              {filtersOpen && (
                <div className="absolute right-0 mt-2 w-[340px] max-w-[90vw] rounded-2xl border border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-900 shadow-lg z-50 overflow-hidden">
                  <div className="p-3">
                    <FilterBar className="p-3">
                      <div className="grid grid-cols-1 gap-3">
                        <FilterSelect
                          label={t('common.pole') ?? 'Pole'}
                          value={selectedPole}
                          onChange={setSelectedPole}
                        >
                          <option value="">{t('common.all') ?? 'All'}</option>
                          {poles.map((p) => (
                            <option key={p} value={p}>{p}</option>
                          ))}
                        </FilterSelect>

                        <FilterSelect
                          label={t('common.project') ?? t('projects.title') ?? 'Project'}
                          value={selectedProjectId}
                          onChange={setSelectedProjectId}
                        >
                          <option value="">{t('common.all') ?? 'All'}</option>
                          {visibleProjects.map((p) => (
                            <option key={p.id} value={String(p.id)}>
                              {getProjectLabel(p)}
                            </option>
                          ))}
                        </FilterSelect>

                        <FilterSelect
                          label={t('heavyMachinery.viewMachines.form.machineType') ?? 'Machine type'}
                          value={selectedMachineType}
                          onChange={setSelectedMachineType}
                        >
                          <option value="">{t('common.all') ?? 'All'}</option>
                          {machineTypes.map((opt) => (
                            <option key={opt.value} value={opt.value}>{opt.label}</option>
                          ))}
                        </FilterSelect>

                        <FilterSelect
                          label={t('common.status') ?? 'Status'}
                          value={selectedStatus}
                          onChange={setSelectedStatus}
                        >
                          <option value="">{t('common.all') ?? 'All'}</option>
                          <option value="active">{t('common.active') ?? 'Active'}</option>
                          <option value="inactive">{t('common.inactive') ?? 'Inactive'}</option>
                        </FilterSelect>
                      </div>
                    </FilterBar>
                  </div>

                  <div className="px-4 py-3 border-t border-gray-200 dark:border-gray-700 flex items-center justify-between gap-2">
                    <button
                      type="button"
                      className="btn-outline"
                      onClick={() => {
                        setSelectedPole('')
                        setSelectedProjectId('')
                        setSelectedMachineType('')
                        setSelectedStatus('')
                      }}
                    >
                      {t('common.reset') ?? 'Reset'}
                    </button>
                    <button type="button" className="btn-primary" onClick={() => setFiltersOpen(false)}>
                      {t('common.apply') ?? 'Apply'}
                    </button>
                  </div>
                </div>
              )}
            </div>

            <button
              type="button"
              onClick={fetchMachines}
              className="btn-secondary flex items-center gap-2"
              disabled={loadingMachines}
            >
              {loadingMachines ? <Loader2 className="w-4 h-4 animate-spin" /> : <RefreshCw className="w-4 h-4" />}
              {t('heavyMachinery.viewMachines.refresh')}
            </button>
            <div className="relative" ref={addMenuRef}>
              <button
                type="button"
                onClick={() => setAddMenuOpen((v) => !v)}
                className="btn-primary flex items-center gap-2"
              >
                <PlusCircle className="w-4 h-4" />
                {t('heavyMachinery.viewMachines.addMachine')}
                <ChevronDown className="w-4 h-4" />
              </button>

              {addMenuOpen && (
                <div className="absolute right-0 mt-2 w-56 rounded-lg border border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-900 shadow-lg z-50 overflow-hidden">
                  <button
                    type="button"
                    className="w-full text-left px-4 py-2 text-sm hover:bg-gray-50 dark:hover:bg-gray-800"
                    onClick={() => {
                      setAddMenuOpen(false)
                      openCreate()
                    }}
                  >
                    {t('common.create')}
                  </button>
                  <button
                    type="button"
                    className="w-full text-left px-4 py-2 text-sm hover:bg-gray-50 dark:hover:bg-gray-800"
                    onClick={() => {
                      setAddMenuOpen(false)
                      openBulkImport()
                    }}
                  >
                    {t('heavyMachinery.viewMachines.bulk.title')}
                  </button>
                </div>
              )}
            </div>
          </div>
        </div>
      </div>

      {loadingMachines ? (
        <div className="flex items-center justify-center py-10">
          <Loader2 className="w-6 h-6 animate-spin text-hse-primary" />
        </div>
      ) : filteredMachines.length === 0 ? (
        <div className="card p-8 text-center">
          <Truck className="w-10 h-10 text-gray-300 dark:text-gray-700 mx-auto mb-3" />
          <p className="text-sm font-medium text-gray-700 dark:text-gray-200">
            {t('heavyMachinery.viewMachines.emptyTitle')}
          </p>
          <p className="text-xs text-gray-500 dark:text-gray-400 mt-1">
            {t('heavyMachinery.viewMachines.emptyHelp')}
          </p>
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-4">
          {filteredMachines.map((m) => (
            <div
              key={m.id}
              role="button"
              tabIndex={0}
              onClick={() => openDetails(m.id)}
              onKeyDown={(e) => {
                if (e.key === 'Enter') openDetails(m.id)
              }}
              className="card p-4 text-left hover:shadow-md transition-shadow cursor-pointer"
            >
              {m.image_url && (
                <div className="mb-3">
                  <div className="w-full h-40 rounded-lg border border-gray-200 dark:border-gray-700 bg-gray-50 dark:bg-gray-800 overflow-hidden">
                    <MachineImage machineId={m.id} updatedAt={m.updated_at} alt={m.serial_number} className="w-full h-full object-cover" />
                  </div>
                </div>
              )}

              <div className="flex items-start justify-between gap-3">
                <div className="min-w-0">
                  <p className="font-semibold text-gray-900 dark:text-gray-100 truncate">
                    {m.internal_code ? `${m.internal_code} · ${m.serial_number}` : m.serial_number}
                  </p>
                  <p className="text-xs text-gray-500 dark:text-gray-400 mt-1 truncate">
                    {getMachineTypeLabel(m) + (m.brand ? ` · ${m.brand}` : '') + (m.model ? ` · ${m.model}` : '')}
                  </p>
                  <p className="text-xs text-gray-500 dark:text-gray-400 mt-1 truncate">{m.project?.name ?? '-'}</p>
                </div>

                <span
                  className={`inline-flex items-center px-2 py-0.5 rounded-full text-[11px] ${
                    m.is_active
                      ? 'bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-200'
                      : 'bg-gray-100 text-gray-700 dark:bg-gray-800 dark:text-gray-300'
                  }`}
                >
                  {m.is_active ? t('common.active') : t('common.inactive')}
                </span>
              </div>
            </div>
          ))}
        </div>
      )}

      {bulkModalOpen && (
        <Modal isOpen={bulkModalOpen} onClose={() => setBulkModalOpen(false)} title={t('heavyMachinery.viewMachines.bulk.title')} size="xl">
          <div className="space-y-4">
            <p className="text-sm text-gray-600 dark:text-gray-300">{t('heavyMachinery.viewMachines.bulk.help')}</p>

            <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
              <button type="button" onClick={handleDownloadTemplate} className="btn-secondary">
                {t('heavyMachinery.viewMachines.bulk.downloadTemplate')}
              </button>

              <label className="flex items-center justify-between border-2 border-dashed border-gray-300 dark:border-gray-600 rounded-lg px-3 py-2 text-xs cursor-pointer hover:border-hse-primary hover:bg-hse-primary/5">
                <div className="flex items-center gap-2">
                  <Upload className="w-4 h-4 text-gray-500" />
                  <span className="text-gray-700 dark:text-gray-200">
                    {bulkFile ? bulkFile.name : t('heavyMachinery.viewMachines.bulk.chooseFile')}
                  </span>
                </div>
                <input
                  ref={bulkInputRef}
                  type="file"
                  accept=".xlsx,.xls"
                  className="hidden"
                  onChange={(e) => setBulkFile(e.target.files?.[0] ?? null)}
                />
              </label>

              <button type="button" onClick={handleBulkImport} disabled={bulkUploading || !bulkFile} className="btn-primary">
                {bulkUploading ? t('heavyMachinery.viewMachines.bulk.importing') : t('heavyMachinery.viewMachines.bulk.import')}
              </button>
            </div>
          </div>
        </Modal>
      )}

      {createSerialOpen && (
        <Modal
          isOpen={createSerialOpen}
          onClose={() => setCreateSerialOpen(false)}
          title={t('heavyMachinery.viewMachines.form.createSerialTitle')}
          size="md"
        >
          <form
            onSubmit={(e) => {
              e.preventDefault()
              handleCheckSerial()
            }}
            className="space-y-4"
          >
            <div>
              <label className="label text-xs">{t('heavyMachinery.viewMachines.machine.serial')}</label>
              <input className="input" value={createSerial} onChange={(e) => setCreateSerial(e.target.value)} />
            </div>

            <div className="flex justify-end gap-2 pt-2 border-t border-gray-100 dark:border-gray-700">
              <button type="button" className="btn-outline" onClick={() => setCreateSerialOpen(false)}>
                {t('common.cancel')}
              </button>
              <button type="submit" className="btn-primary flex items-center gap-2" disabled={checkingSerial || !createSerial.trim()}>
                {checkingSerial && <Loader2 className="w-4 h-4 animate-spin" />}
                {t('heavyMachinery.viewMachines.form.checkSerial')}
              </button>
            </div>
          </form>
        </Modal>
      )}

      {createOpen && (
        <Modal
          isOpen={createOpen}
          onClose={() => setCreateOpen(false)}
          title={t('heavyMachinery.viewMachines.form.createTitle')}
          size="xl"
        >
          <form onSubmit={handleCreate} className="space-y-4">
            <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
              <div>
                <label className="label text-xs">{t('heavyMachinery.viewMachines.machine.serial')}</label>
                <input
                  className="input"
                  value={createData.serial_number}
                  readOnly
                  required
                />
              </div>
              <div>
                <label className="label text-xs">{t('heavyMachinery.viewMachines.machine.internal')}</label>
                <input
                  className="input"
                  value={createData.internal_code}
                  onChange={(e) => setCreateData((p) => ({ ...p, internal_code: e.target.value }))}
                />
              </div>

              <div>
                <label className="label text-xs">{t('heavyMachinery.viewMachines.machine.type')}</label>
                {machineTypes.length > 0 ? (
                  <div className="space-y-2">
                    <Select
                      value={createMachineTypeChoice}
                      onChange={(e) => {
                        const v = e.target.value
                        setCreateMachineTypeChoice(v)
                        setCreateData((p) => ({ ...p, machine_type: v }))
                      }}
                      required
                    >
                      <option value="">{t('common.select')}</option>
                      {machineTypes.map((mt) => (
                        <option key={mt.value} value={mt.value}>
                          {mt.label}
                        </option>
                      ))}
                    </Select>
                  </div>
                ) : (
                  <input
                    className="input"
                    value={createData.machine_type}
                    onChange={(e) => setCreateData((p) => ({ ...p, machine_type: e.target.value }))}
                    required
                  />
                )}
              </div>
              <div>
                <label className="label text-xs">{t('heavyMachinery.viewMachines.machine.brand')}</label>
                <input
                  className="input"
                  value={createData.brand}
                  onChange={(e) => setCreateData((p) => ({ ...p, brand: e.target.value }))}
                  required
                />
              </div>

              <div>
                <label className="label text-xs">{t('heavyMachinery.viewMachines.machine.model')}</label>
                <input
                  className="input"
                  value={createData.model}
                  onChange={(e) => setCreateData((p) => ({ ...p, model: e.target.value }))}
                />
              </div>
              <div>
                <label className="label text-xs">{t('heavyMachinery.viewMachines.machine.project')}</label>
                <Select
                  value={createData.project_id}
                  onChange={(e) => setCreateData((p) => ({ ...p, project_id: e.target.value }))}
                >
                  <option value="">{t('common.none')}</option>
                  {sortedProjects.map((p) => (
                    <option key={p.id} value={p.id}>
                      {getProjectLabel(p)}
                    </option>
                  ))}
                </Select>
              </div>
            </div>

            <div
              className={`flex items-center justify-between rounded-lg border p-3 ${
                createData.is_active
                  ? 'border-green-200 bg-green-50 dark:border-green-900/40 dark:bg-green-900/10'
                  : 'border-gray-200 bg-gray-50 dark:border-gray-700 dark:bg-gray-800'
              }`}
            >
              <div>
                <div className="text-sm font-medium text-gray-900 dark:text-gray-100">{t('heavyMachinery.viewMachines.machine.active')}</div>
                <div className="text-xs text-gray-600 dark:text-gray-300">{createData.is_active ? t('common.active') : t('common.inactive')}</div>
              </div>

              <button
                type="button"
                role="switch"
                aria-checked={!!createData.is_active}
                onClick={() => setCreateData((p) => ({ ...p, is_active: !p.is_active }))}
                className={`relative inline-flex h-6 w-11 items-center rounded-full transition-colors ${
                  createData.is_active ? 'bg-green-600' : 'bg-gray-300 dark:bg-gray-600'
                }`}
              >
                <span
                  className={`inline-block h-5 w-5 transform rounded-full bg-white transition ${
                    createData.is_active ? 'translate-x-5' : 'translate-x-1'
                  }`}
                />
              </button>
            </div>

            <div>
              <label className="label text-xs">{t('heavyMachinery.viewMachines.form.image')}</label>
              <label className="flex items-center justify-between border-2 border-dashed border-gray-300 dark:border-gray-600 rounded-lg px-3 py-2 text-xs cursor-pointer hover:border-hse-primary hover:bg-hse-primary/5">
                <div className="flex items-center gap-2">
                  <ImageIcon className="w-4 h-4 text-gray-500" />
                  <span className="text-gray-700 dark:text-gray-200">
                    {createData.image ? createData.image.name : t('heavyMachinery.viewMachines.form.chooseImage')}
                  </span>
                </div>
                <input
                  type="file"
                  accept="image/*"
                  className="hidden"
                  onChange={(e) => setCreateData((p) => ({ ...p, image: e.target.files?.[0] ?? null }))}
                />
              </label>
              <p className="text-[11px] text-gray-500 dark:text-gray-400 mt-1">
                {t('heavyMachinery.viewMachines.form.chooseImage')}
              </p>
            </div>

            <div className="flex justify-end gap-2 pt-2 border-t border-gray-100 dark:border-gray-700">
              <button type="button" className="btn-outline" onClick={() => setCreateOpen(false)}>
                {t('common.cancel')}
              </button>
              <button
                type="submit"
                className="btn-primary flex items-center gap-2"
                disabled={
                  creating ||
                  !createData.serial_number.trim() ||
                  !createData.machine_type.trim() ||
                  !createData.brand.trim()
                }
              >
                {creating && <Loader2 className="w-4 h-4 animate-spin" />}
                {createExistingMachineId ? t('common.save') : t('common.create')}
              </button>
            </div>
          </form>
        </Modal>
      )}

      {detailsOpen && (
        <Modal
          isOpen={detailsOpen}
          onClose={closeDetails}
          title={t('heavyMachinery.viewMachines.details')}
          size="full"
        >
          {detailsLoading || !details ? (
            <div className="flex items-center justify-center py-10">
              <Loader2 className="w-6 h-6 animate-spin text-hse-primary" />
            </div>
          ) : (
            <div className="space-y-4">
              <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
                <div className="w-full rounded-xl border border-gray-200 dark:border-gray-700 bg-gray-50 dark:bg-gray-800 overflow-hidden">
                  {details.machine?.image_url ? (
                    <button
                      type="button"
                      className="w-full"
                      onClick={() => setImageModalOpen(true)}
                      title={t('common.view')}
                    >
                      <MachineImage
                        machineId={details.machine?.id}
                        updatedAt={details.machine?.updated_at}
                        alt={details.machine?.serial_number ?? 'machine'}
                        className="w-full h-72 object-contain"
                      />
                    </button>
                  ) : (
                    <div className="w-full h-72 flex items-center justify-center text-sm text-gray-500">
                      {t('common.noData')}
                    </div>
                  )}
                </div>

                <div className="min-w-0 flex flex-col justify-between gap-3">
                  <div className="min-w-0">
                    <p className="text-xs text-gray-500 dark:text-gray-400">{details.machine?.project?.name ?? '-'}</p>
                    <h3 className="text-xl font-bold text-gray-900 dark:text-gray-100 truncate">
                      {details.machine?.internal_code
                        ? `${details.machine.internal_code} · ${details.machine.serial_number}`
                        : details.machine?.serial_number}
                    </h3>
                    <p className="text-sm text-gray-600 dark:text-gray-300 mt-1">
                      {getMachineTypeLabel(details.machine) +
                        (details.machine?.brand ? ` · ${details.machine.brand}` : '') +
                        (details.machine?.model ? ` · ${details.machine.model}` : '')}
                    </p>
                  </div>

                  <div className="flex flex-wrap gap-2">
                    <button type="button" className="btn-secondary flex items-center gap-2" onClick={openEdit}>
                      <Pencil className="w-4 h-4" />
                      {t('common.edit')}
                    </button>
                    <button
                      type="button"
                      className="btn-secondary flex items-center gap-2"
                      onClick={() => refreshDetails(activeMachineId)}
                      disabled={detailsLoading}
                    >
                      {detailsLoading ? <Loader2 className="w-4 h-4 animate-spin" /> : <RefreshCw className="w-4 h-4" />}
                      {t('common.refresh')}
                    </button>
                    <button
                      type="button"
                      className="btn-outline btn-sm flex items-center gap-2 text-red-600 dark:text-red-400 border-red-200 dark:border-red-800 hover:bg-red-50 dark:hover:bg-red-900/20"
                      onClick={handleDeleteMachine}
                    >
                      <Trash2 className="w-4 h-4" />
                      {t('common.delete')}
                    </button>
                  </div>
                </div>
              </div>

              <div className="border-b border-gray-200 dark:border-gray-700">
                <div className="flex gap-2 -mb-px">
                  <button
                    type="button"
                    onClick={() => setDetailsTab('documents')}
                    className={`px-3 py-2 text-sm border rounded-t-lg flex items-center gap-2 ${
                      detailsTab === 'documents'
                        ? 'bg-white dark:bg-gray-900 border-gray-200 dark:border-gray-700 border-b-white dark:border-b-gray-900 text-hse-primary'
                        : 'border-transparent text-gray-600 dark:text-gray-300 hover:text-gray-900 dark:hover:text-gray-100'
                    }`}
                  >
                    <FileText className="w-4 h-4" />
                    {t('heavyMachinery.viewMachines.tabs.documents')}
                  </button>
                  <button
                    type="button"
                    onClick={() => setDetailsTab('operators')}
                    className={`px-3 py-2 text-sm border rounded-t-lg flex items-center gap-2 ${
                      detailsTab === 'operators'
                        ? 'bg-white dark:bg-gray-900 border-gray-200 dark:border-gray-700 border-b-white dark:border-b-gray-900 text-hse-primary'
                        : 'border-transparent text-gray-600 dark:text-gray-300 hover:text-gray-900 dark:hover:text-gray-100'
                    }`}
                  >
                    <Users className="w-4 h-4" />
                    {t('heavyMachinery.viewMachines.tabs.operators')}
                  </button>
                  <button
                    type="button"
                    onClick={() => setDetailsTab('inspections')}
                    className={`px-3 py-2 text-sm border rounded-t-lg flex items-center gap-2 ${
                      detailsTab === 'inspections'
                        ? 'bg-white dark:bg-gray-900 border-gray-200 dark:border-gray-700 border-b-white dark:border-b-gray-900 text-hse-primary'
                        : 'border-transparent text-gray-600 dark:text-gray-300 hover:text-gray-900 dark:hover:text-gray-100'
                    }`}
                  >
                    <ClipboardCheck className="w-4 h-4" />
                    {t('heavyMachinery.viewMachines.tabs.inspections')}
                  </button>
                </div>
              </div>

              {detailsTab === 'documents' && (
                <div className="space-y-3">
                  <div className="flex justify-end">
                    <button type="button" className="btn-primary flex items-center gap-2" onClick={() => openDocModal(null)}>
                      <PlusCircle className="w-4 h-4" />
                      {t('heavyMachinery.viewMachines.documents.add')}
                    </button>
                  </div>

                  <div className="overflow-x-auto">
                    <table className="min-w-full text-xs">
                      <thead>
                        <tr className="border-b border-gray-200 dark:border-gray-700 text-left">
                          <th className="py-2 pr-3 font-medium text-gray-500 dark:text-gray-400">{t('heavyMachinery.viewMachines.documents.label')}</th>
                          <th className="py-2 pr-3 font-medium text-gray-500 dark:text-gray-400">{t('heavyMachinery.viewMachines.documents.startDate')}</th>
                          <th className="py-2 pr-3 font-medium text-gray-500 dark:text-gray-400">{t('heavyMachinery.viewMachines.documents.expiryDate')}</th>
                          <th className="py-2 pr-3 font-medium text-gray-500 dark:text-gray-400">{t('common.actions')}</th>
                        </tr>
                      </thead>
                      <tbody>
                        {(details.documents ?? []).map((d) => (
                          <tr key={d.id} className="border-b border-gray-100 dark:border-gray-800">
                            <td className="py-2 pr-3 text-gray-900 dark:text-gray-100">
                              <div className="font-medium">{d.document_label}</div>
                              <div className="text-[11px] text-gray-500 dark:text-gray-400">{d.document_key}</div>
                            </td>
                            <td className="py-2 pr-3 text-gray-700 dark:text-gray-200">{d.start_date ?? ''}</td>
                            <td className="py-2 pr-3 text-gray-700 dark:text-gray-200">{d.expiry_date ?? ''}</td>
                            <td className="py-2 pr-3">
                              <div className="flex flex-wrap gap-2">
                                {d.file_view_url && (
                                  <button
                                    type="button"
                                    className="btn-outline btn-sm flex items-center gap-2"
                                    onClick={() => openPreview(d)}
                                  >
                                    <Eye className="w-4 h-4" />
                                    {t('common.view')}
                                  </button>
                                )}
                                {d.file_download_url && (
                                  <button
                                    type="button"
                                    className="btn-outline btn-sm flex items-center gap-2"
                                    onClick={() => handleDownloadFile(d, `${d.document_key ?? 'document'}.pdf`)}
                                  >
                                    <Download className="w-4 h-4" />
                                    {t('common.download')}
                                  </button>
                                )}
                                <button
                                  type="button"
                                  className="btn-outline btn-sm flex items-center gap-2"
                                  onClick={() => openDocModal(d)}
                                >
                                  <Upload className="w-4 h-4" />
                                  {t('heavyMachinery.viewMachines.documents.replace')}
                                </button>
                                <button
                                  type="button"
                                  className="btn-outline btn-sm flex items-center gap-2 text-red-600 dark:text-red-400"
                                  onClick={() => handleDeleteDocument(d)}
                                >
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
                </div>
              )}

              {detailsTab === 'operators' && (
                <div className="space-y-4">
                  {!details.machine?.project_id ? (
                    <div className="card p-4 text-sm text-gray-600 dark:text-gray-300">
                      {t('heavyMachinery.viewMachines.operators.helpNoProject')}
                    </div>
                  ) : (
                    <>
                      <div className="card p-4 space-y-3">
                        <div className="grid grid-cols-1 md:grid-cols-3 gap-3 items-start">
                          <div className="md:col-span-2">
                            <input
                              className="input"
                              value={operatorQuery}
                              onChange={(e) => {
                                setOperatorQuery(e.target.value)
                                setOperatorSelectedId('')
                                setOperatorSelectedLabel('')
                              }}
                              placeholder={t('heavyMachinery.viewMachines.operators.searchPlaceholder')}
                            />

                            {operatorQuery.trim() && !operatorSelectedId && (
                              <div className="mt-2 rounded-lg border border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-900 overflow-hidden">
                                {operatorSearching ? (
                                  <div className="px-3 py-2 text-xs text-gray-500">...</div>
                                ) : operatorResults.length === 0 ? (
                                  <div className="px-3 py-2 text-xs text-gray-500">{t('common.noData')}</div>
                                ) : (
                                  <div className="max-h-56 overflow-auto">
                                    {operatorResults.map((w) => (
                                      <button
                                        key={w.id}
                                        type="button"
                                        className="w-full text-left px-3 py-2 text-sm hover:bg-gray-50 dark:hover:bg-gray-800"
                                        onClick={() => {
                                          setOperatorSelectedId(String(w.id))
                                          setOperatorSelectedLabel(`${w.full_name}${w.cin ? ` (${w.cin})` : ''}`)
                                          setOperatorQuery(`${w.full_name}${w.cin ? ` (${w.cin})` : ''}`)
                                          setOperatorResults([])
                                        }}
                                      >
                                        <div className="font-medium text-gray-900 dark:text-gray-100">{w.full_name}</div>
                                        <div className="text-[11px] text-gray-500 dark:text-gray-400">
                                          {w.cin ?? ''} {w.fonction ? `· ${w.fonction}` : ''}
                                        </div>
                                      </button>
                                    ))}
                                  </div>
                                )}
                              </div>
                            )}
                          </div>

                          <div className="flex gap-2">
                            <button
                              type="button"
                              className="btn-primary w-full"
                              disabled={!operatorSelectedId}
                              onClick={handleAssignOperator}
                            >
                              {t('heavyMachinery.viewMachines.operators.assign')}
                            </button>
                          </div>
                        </div>

                        {operatorSelectedId && operatorSelectedLabel && (
                          <div className="text-xs text-gray-600 dark:text-gray-300">
                            {t('common.selected')}: {operatorSelectedLabel}
                          </div>
                        )}
                      </div>

                      <div className="card p-4">
                        <div className="overflow-x-auto">
                          <table className="min-w-full text-xs">
                            <thead>
                              <tr className="border-b border-gray-200 dark:border-gray-700 text-left">
                                <th className="py-2 pr-3 font-medium text-gray-500 dark:text-gray-400">{t('heavyMachinery.viewMachines.tabs.operators')}</th>
                                <th className="py-2 pr-3 font-medium text-gray-500 dark:text-gray-400">CIN</th>
                                <th className="py-2 pr-3 font-medium text-gray-500 dark:text-gray-400">{t('common.actions')}</th>
                              </tr>
                            </thead>
                            <tbody>
                              {(details.operators ?? []).map((op) => (
                                <tr key={op.id} className="border-b border-gray-100 dark:border-gray-800">
                                  <td className="py-2 pr-3 text-gray-900 dark:text-gray-100">
                                    <a
                                      href={`/workers?worker_id=${op.id}`}
                                      className="text-hse-primary hover:underline"
                                      target="_blank"
                                      rel="noreferrer"
                                    >
                                      {op.full_name}
                                    </a>
                                  </td>
                                  <td className="py-2 pr-3 text-gray-700 dark:text-gray-200 font-mono">{op.cin ?? ''}</td>
                                  <td className="py-2 pr-3">
                                    <button
                                      type="button"
                                      className="btn-outline btn-sm text-red-600 dark:text-red-400"
                                      onClick={() => handleRemoveOperator(op.id)}
                                    >
                                      {t('heavyMachinery.viewMachines.operators.remove')}
                                    </button>
                                  </td>
                                </tr>
                              ))}
                            </tbody>
                          </table>
                        </div>
                      </div>
                    </>
                  )}
                </div>
              )}

              {detailsTab === 'inspections' && (
                <div className="space-y-3">
                  <div className="flex justify-end">
                    <button type="button" className="btn-primary flex items-center gap-2" onClick={openInspectionModal}>
                      <PlusCircle className="w-4 h-4" />
                      {t('heavyMachinery.viewMachines.inspections.add')}
                    </button>
                  </div>

                  <div className="overflow-x-auto">
                    <table className="min-w-full text-xs">
                      <thead>
                        <tr className="border-b border-gray-200 dark:border-gray-700 text-left">
                          <th className="py-2 pr-3 font-medium text-gray-500 dark:text-gray-400">#</th>
                          <th className="py-2 pr-3 font-medium text-gray-500 dark:text-gray-400">{t('heavyMachinery.viewMachines.inspections.startDate')}</th>
                          <th className="py-2 pr-3 font-medium text-gray-500 dark:text-gray-400">{t('heavyMachinery.viewMachines.inspections.endDate')}</th>
                          <th className="py-2 pr-3 font-medium text-gray-500 dark:text-gray-400">{t('common.actions')}</th>
                        </tr>
                      </thead>
                      <tbody>
                        {(details.inspections ?? []).map((i) => (
                          <tr key={i.id} className="border-b border-gray-100 dark:border-gray-800">
                            <td className="py-2 pr-3 text-gray-900 dark:text-gray-100">
                              v{i.version ?? 1}
                            </td>
                            <td className="py-2 pr-3 text-gray-700 dark:text-gray-200">{i.start_date ?? ''}</td>
                            <td className="py-2 pr-3 text-gray-700 dark:text-gray-200">{i.end_date ?? ''}</td>
                            <td className="py-2 pr-3">
                              <div className="flex flex-wrap gap-2">
                                {i.file_view_url && (
                                  <button type="button" className="btn-outline btn-sm flex items-center gap-2" onClick={() => openPreview(i)}>
                                    <Eye className="w-4 h-4" />
                                    {t('common.view')}
                                  </button>
                                )}
                                {i.file_download_url && (
                                  <button
                                    type="button"
                                    className="btn-outline btn-sm flex items-center gap-2"
                                    onClick={() => handleDownloadFile(i, `inspection_${i.id}.pdf`)}
                                  >
                                    <Download className="w-4 h-4" />
                                    {t('common.download')}
                                  </button>
                                )}
                                <button
                                  type="button"
                                  className="btn-outline btn-sm flex items-center gap-2 text-red-600 dark:text-red-400"
                                  onClick={() => handleDeleteInspection(i)}
                                >
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
                </div>
              )}
            </div>
          )}
        </Modal>
      )}

      {editOpen && (
        <Modal isOpen={editOpen} onClose={() => setEditOpen(false)} title={t('common.edit')} size="xl">
          <form onSubmit={handleEditSave} className="space-y-4">
            <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
              <div>
                <label className="label text-xs">{t('heavyMachinery.viewMachines.machine.serial')}</label>
                <input
                  className="input"
                  value={editData.serial_number}
                  onChange={(e) => setEditData((p) => ({ ...p, serial_number: e.target.value }))}
                  required
                />
              </div>
              <div>
                <label className="label text-xs">{t('heavyMachinery.viewMachines.machine.internal')}</label>
                <input
                  className="input"
                  value={editData.internal_code}
                  onChange={(e) => setEditData((p) => ({ ...p, internal_code: e.target.value }))}
                />
              </div>

              <div>
                <label className="label text-xs">{t('heavyMachinery.viewMachines.machine.type')}</label>
                {machineTypes.length > 0 ? (
                  <div className="space-y-2">
                    <Select
                      value={editMachineTypeChoice}
                      onChange={(e) => {
                        const v = e.target.value
                        setEditMachineTypeChoice(v)
                        setEditData((p) => ({ ...p, machine_type: v }))
                      }}
                      required
                    >
                      <option value="">{t('common.select')}</option>
                      {machineTypes.map((mt) => (
                        <option key={mt.value} value={mt.value}>
                          {mt.label}
                        </option>
                      ))}
                    </Select>
                  </div>
                ) : (
                  <input
                    className="input"
                    value={editData.machine_type}
                    onChange={(e) => setEditData((p) => ({ ...p, machine_type: e.target.value }))}
                    required
                  />
                )}
              </div>
              <div>
                <label className="label text-xs">{t('heavyMachinery.viewMachines.machine.brand')}</label>
                <input
                  className="input"
                  value={editData.brand}
                  onChange={(e) => setEditData((p) => ({ ...p, brand: e.target.value }))}
                  required
                />
              </div>

              <div>
                <label className="label text-xs">{t('heavyMachinery.viewMachines.machine.model')}</label>
                <input
                  className="input"
                  value={editData.model}
                  onChange={(e) => setEditData((p) => ({ ...p, model: e.target.value }))}
                />
              </div>
              <div>
                <label className="label text-xs">{t('heavyMachinery.viewMachines.machine.project')}</label>
                <Select value={editData.project_id} onChange={(e) => setEditData((p) => ({ ...p, project_id: e.target.value }))}>
                  <option value="">{t('common.none')}</option>
                  {sortedProjects.map((p) => (
                    <option key={p.id} value={p.id}>
                      {getProjectLabel(p)}
                    </option>
                  ))}
                </Select>
              </div>
            </div>

            <div
              className={`flex items-center justify-between rounded-lg border p-3 ${
                editData.is_active
                  ? 'border-green-200 bg-green-50 dark:border-green-900/40 dark:bg-green-900/10'
                  : 'border-gray-200 bg-gray-50 dark:border-gray-700 dark:bg-gray-800'
              }`}
            >
              <div>
                <div className="text-sm font-medium text-gray-900 dark:text-gray-100">{t('heavyMachinery.viewMachines.machine.active')}</div>
                <div className="text-xs text-gray-600 dark:text-gray-300">{editData.is_active ? t('common.active') : t('common.inactive')}</div>
              </div>

              <button
                type="button"
                role="switch"
                aria-checked={!!editData.is_active}
                onClick={() => setEditData((p) => ({ ...p, is_active: !p.is_active }))}
                className={`relative inline-flex h-6 w-11 items-center rounded-full transition-colors ${
                  editData.is_active ? 'bg-green-600' : 'bg-gray-300 dark:bg-gray-600'
                }`}
              >
                <span
                  className={`inline-block h-5 w-5 transform rounded-full bg-white transition ${
                    editData.is_active ? 'translate-x-5' : 'translate-x-1'
                  }`}
                />
              </button>
            </div>

            <div>
              <label className="label text-xs">{t('heavyMachinery.viewMachines.form.image')}</label>
              <label className="flex items-center justify-between border-2 border-dashed border-gray-300 dark:border-gray-600 rounded-lg px-3 py-2 text-xs cursor-pointer hover:border-hse-primary hover:bg-hse-primary/5">
                <div className="flex items-center gap-2">
                  <ImageIcon className="w-4 h-4 text-gray-500" />
                  <span className="text-gray-700 dark:text-gray-200">{editData.image ? editData.image.name : t('common.select')}</span>
                </div>
                <input
                  type="file"
                  accept="image/*"
                  className="hidden"
                  onChange={(e) => setEditData((p) => ({ ...p, image: e.target.files?.[0] ?? null }))}
                />
              </label>
            </div>

            <div className="flex justify-end gap-2 pt-2 border-t border-gray-100 dark:border-gray-700">
              <button type="button" className="btn-outline" onClick={() => setEditOpen(false)}>
                {t('common.cancel')}
              </button>
              <button type="submit" className="btn-primary flex items-center gap-2" disabled={editSaving}>
                {editSaving && <Loader2 className="w-4 h-4 animate-spin" />}
                {t('common.save')}
              </button>
            </div>
          </form>
        </Modal>
      )}

      {imageModalOpen && details?.machine?.image_url && (
        <Modal isOpen={imageModalOpen} onClose={() => setImageModalOpen(false)} title={t('common.view')} size="xl">
          <div className="w-full h-[70vh] rounded-lg border border-gray-200 dark:border-gray-700 bg-gray-50 dark:bg-gray-900 overflow-hidden flex items-center justify-center">
            <MachineImage
              machineId={details.machine?.id}
              updatedAt={details.machine?.updated_at}
              alt={details.machine?.serial_number ?? 'machine'}
              className="max-w-full max-h-full object-contain"
            />
          </div>
        </Modal>
      )}

      {docModalOpen && (
        <Modal
          isOpen={docModalOpen}
          onClose={() => {
            setDocModalOpen(false)
            setDocEditing(null)
          }}
          title={t('heavyMachinery.viewMachines.documents.uploadTitle', { label: docForm.document_label || '-' })}
          size="xl"
        >
          <form onSubmit={handleDocSave} className="space-y-4">
            <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
              <div>
                <label className="label text-xs">{t('heavyMachinery.viewMachines.documents.key')}</label>
                {documentKeys.length > 0 ? (
                  <Select
                    value={docForm.document_key}
                    disabled={!!docEditing?.id}
                    onChange={(e) => {
                      const nextKey = e.target.value
                      const nextLabel = documentKeys.find((k) => k.key === nextKey)?.label ?? ''
                      setDocForm((p) => ({
                        ...p,
                        document_key: nextKey,
                        document_label: nextLabel,
                      }))
                    }}
                    required
                  >
                    <option value="">{t('common.select')}</option>
                    {documentKeys.map((k) => (
                      <option key={k.key} value={k.key}>
                        {k.label}
                      </option>
                    ))}
                  </Select>
                ) : (
                  <input
                    className="input"
                    value={docForm.document_key}
                    disabled={!!docEditing?.id}
                    onChange={(e) => setDocForm((p) => ({ ...p, document_key: e.target.value }))}
                    required
                  />
                )}
              </div>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
              <div>
                <label className="label text-xs">{t('heavyMachinery.viewMachines.documents.startDate')}</label>
                <DatePicker
                  value={docForm.start_date}
                  onChange={(v) =>
                    setDocForm((p) => {
                      const prevAuto = p.start_date ? addYearsToDate(p.start_date, 1) : ''
                      const nextAuto = v ? addYearsToDate(v, 1) : ''
                      const shouldAuto = !p.expiry_date || p.expiry_date === prevAuto
                      return {
                        ...p,
                        start_date: v,
                        expiry_date: shouldAuto ? nextAuto : p.expiry_date,
                      }
                    })
                  }
                />
              </div>
              <div>
                <label className="label text-xs">{t('heavyMachinery.viewMachines.documents.expiryDate')}</label>
                <DatePicker value={docForm.expiry_date} onChange={(v) => setDocForm((p) => ({ ...p, expiry_date: v }))} />
              </div>
            </div>

            <div>
              <label className="label text-xs">{t('heavyMachinery.viewMachines.documents.file')}</label>
              <label className="flex items-center justify-between border-2 border-dashed border-gray-300 dark:border-gray-600 rounded-lg px-3 py-2 text-xs cursor-pointer hover:border-hse-primary hover:bg-hse-primary/5">
                <div className="flex items-center gap-2">
                  <FileText className="w-4 h-4 text-gray-500" />
                  <span className="text-gray-700 dark:text-gray-200">
                    {docForm.file ? docForm.file.name : t('heavyMachinery.viewMachines.documents.choosePdf')}
                  </span>
                </div>
                <input
                  type="file"
                  accept="application/pdf"
                  onChange={(e) => setDocForm((p) => ({ ...p, file: e.target.files?.[0] ?? null }))}
                  className="hidden"
                />
              </label>
            </div>

            <div className="flex justify-end gap-2 pt-2 border-t border-gray-100 dark:border-gray-700">
              <button type="button" className="btn-outline" onClick={() => setDocModalOpen(false)}>
                {t('common.cancel')}
              </button>
              <button type="submit" className="btn-primary flex items-center gap-2" disabled={docSaving}>
                {docSaving && <Loader2 className="w-4 h-4 animate-spin" />}
                {t('common.save')}
              </button>
            </div>
          </form>
        </Modal>
      )}

      {inspectionModalOpen && (
        <Modal
          isOpen={inspectionModalOpen}
          onClose={() => setInspectionModalOpen(false)}
          title={t('heavyMachinery.viewMachines.inspections.uploadTitle')}
          size="xl"
        >
          <form onSubmit={handleInspectionSave} className="space-y-4">
            <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
              <div>
                <label className="label text-xs">{t('heavyMachinery.viewMachines.inspections.startDate')}</label>
                <DatePicker
                  value={inspectionForm.start_date}
                  onChange={(v) =>
                    setInspectionForm((p) => {
                      const prevAuto = p.start_date ? addDaysToDate(p.start_date, 7) : ''
                      const nextAuto = v ? addDaysToDate(v, 7) : ''
                      const shouldAuto = !p.end_date || p.end_date === prevAuto
                      return {
                        ...p,
                        start_date: v,
                        end_date: shouldAuto ? nextAuto : p.end_date,
                      }
                    })
                  }
                />
              </div>
              <div>
                <label className="label text-xs">{t('heavyMachinery.viewMachines.inspections.endDate')}</label>
                <DatePicker value={inspectionForm.end_date} onChange={(v) => setInspectionForm((p) => ({ ...p, end_date: v }))} />
              </div>
            </div>

            <div>
              <label className="label text-xs">{t('heavyMachinery.viewMachines.inspections.file')}</label>
              <label className="flex items-center justify-between border-2 border-dashed border-gray-300 dark:border-gray-600 rounded-lg px-3 py-2 text-xs cursor-pointer hover:border-hse-primary hover:bg-hse-primary/5">
                <div className="flex items-center gap-2">
                  <FileText className="w-4 h-4 text-gray-500" />
                  <span className="text-gray-700 dark:text-gray-200">
                    {inspectionForm.file ? inspectionForm.file.name : t('heavyMachinery.viewMachines.inspections.choosePdf')}
                  </span>
                </div>
                <input
                  type="file"
                  accept="application/pdf"
                  onChange={(e) => setInspectionForm((p) => ({ ...p, file: e.target.files?.[0] ?? null }))}
                  className="hidden"
                />
              </label>
            </div>

            <div className="flex justify-end gap-2 pt-2 border-t border-gray-100 dark:border-gray-700">
              <button type="button" className="btn-outline" onClick={() => setInspectionModalOpen(false)}>
                {t('common.cancel')}
              </button>
              <button type="submit" className="btn-primary flex items-center gap-2" disabled={inspectionSaving}>
                {inspectionSaving && <Loader2 className="w-4 h-4 animate-spin" />}
                {t('common.save')}
              </button>
            </div>
          </form>
        </Modal>
      )}

      {activePreview && (
        <Modal
          isOpen={!!activePreview}
          onClose={closePreview}
          title={t('common.view')}
          size="xl"
        >
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
            <div className="flex justify-end">
              <button
                type="button"
                onClick={() => handleDownloadFile(activePreview, 'file.pdf')}
                className="btn-primary inline-flex items-center gap-2 text-sm"
              >
                <Download className="w-4 h-4" />
                {t('common.download')}
              </button>
            </div>
          </div>
        </Modal>
      )}
    </div>
  )
}
