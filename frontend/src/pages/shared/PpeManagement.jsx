import { useEffect, useMemo, useRef, useState } from 'react'
import api, { ppeService, projectService, workerService } from '../../services/api'
import { useLanguage } from '../../i18n'
import { useAuthStore } from '../../store/authStore'
import Modal from '../../components/ui/Modal'
import Select from '../../components/ui/Select'
import DatePicker from '../../components/ui/DatePicker'
import { Shield, PlusCircle, Pencil, Trash2, Search, Loader2, PackagePlus, Upload, FileSpreadsheet, ChevronDown, ClipboardCheck, X } from 'lucide-react'
import toast from 'react-hot-toast'

export default function PpeManagement() {
  const { t } = useLanguage()
  const { user } = useAuthStore()

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

  const [projects, setProjects] = useState([])
  const [loadingProjects, setLoadingProjects] = useState(true)
  const [selectedProjectId, setSelectedProjectId] = useState('')

  const canSelectAllProjects =
    user?.role === 'admin' ||
    user?.role === 'dev' ||
    user?.role === 'hse_manager' ||
    user?.role === 'regional_hse_manager' ||
    user?.role === 'hse_director'
  const isAllProjectsSelected = selectedProjectId === 'all'
  const hasSpecificProjectSelected = Boolean(selectedProjectId) && !isAllProjectsSelected

  const [items, setItems] = useState([])
  const [loadingItems, setLoadingItems] = useState(true)
  const [search, setSearch] = useState('')
  const [debouncedSearch, setDebouncedSearch] = useState('')

  const [editOpen, setEditOpen] = useState(false)
  const [editingItem, setEditingItem] = useState(null)
  const [savingItem, setSavingItem] = useState(false)
  const [itemForm, setItemForm] = useState({ name: '' })

  const [confirmDelete, setConfirmDelete] = useState(null)
  const [deleting, setDeleting] = useState(false)

  const [restockOpen, setRestockOpen] = useState(false)
  const [restocking, setRestocking] = useState(false)
  const [restockForm, setRestockForm] = useState({ ppe_item_id: '', ppe_other: '', quantity: 1, low_stock_threshold: '' })

  const [issueOpen, setIssueOpen] = useState(false)
  const [issuing, setIssuing] = useState(false)
  const [issueForm, setIssueForm] = useState({ worker_query: '', worker_id: '', worker_label: '', ppe_item_id: '', ppe_other: '', quantity: 1, received_at: '' })
  const [workerSearching, setWorkerSearching] = useState(false)
  const [workerResults, setWorkerResults] = useState([])
  const workerSearchReq = useRef(0)

  const [distributeMenuOpen, setDistributeMenuOpen] = useState(false)
  const distributeMenuRef = useRef(null)

  const [bulkModalOpen, setBulkModalOpen] = useState(false)
  const [bulkFile, setBulkFile] = useState(null)
  const [bulkUploading, setBulkUploading] = useState(false)
  const bulkInputRef = useRef(null)

  const isStrictAdmin = user?.role === 'admin' || user?.role === 'dev'

  const [pendingValidationOpen, setPendingValidationOpen] = useState(false)
  const [pendingValidationPoles, setPendingValidationPoles] = useState([])
  const [pendingValidationPole, setPendingValidationPole] = useState('')
  const [pendingValidationProjectId, setPendingValidationProjectId] = useState('')
  const [pendingValidationItemId, setPendingValidationItemId] = useState('')
  const [pendingValidationItems, setPendingValidationItems] = useState([])
  const [pendingValidationCatalog, setPendingValidationCatalog] = useState([])
  const [pendingValidationCatalogLoading, setPendingValidationCatalogLoading] = useState(false)

  const filteredProjectsForPendingValidation = useMemo(() => {
    if (!pendingValidationPole) return projects
    // Some project list payloads may omit pole; in that case just return all.
    const hasPoleField = projects.some((p) => p && Object.prototype.hasOwnProperty.call(p, 'pole'))
    if (!hasPoleField) return projects
    return projects.filter((p) => String(p.pole ?? '') === String(pendingValidationPole))
  }, [pendingValidationPole, projects])

  const openPendingValidation = async () => {
    try {
      setPendingValidationOpen(true)
      setPendingValidationPole('')
      setPendingValidationProjectId('')
      setPendingValidationItemId('')
      setPendingValidationItems([])
      setPendingValidationCatalog([])
      setPendingValidationCatalogLoading(true)
      const res = await projectService.getPoles()
      const list = res?.data?.data?.poles ?? res?.data?.poles ?? []
      setPendingValidationPoles(Array.isArray(list) ? list : [])

      const itemsRes = await ppeService.getItems({})
      const payload = itemsRes?.data?.data ?? itemsRes?.data ?? []
      setPendingValidationCatalog(Array.isArray(payload) ? payload : [])
    } catch {
      setPendingValidationPoles([])
      setPendingValidationCatalog([])
    }

    setPendingValidationCatalogLoading(false)
  }

  const addPendingValidationItem = () => {
    if (!pendingValidationItemId) return
    const match = pendingValidationCatalog.find((it) => String(it.id) === String(pendingValidationItemId))
    if (!match) return
    setPendingValidationItems((prev) => {
      if (prev.some((x) => String(x.id) === String(match.id))) return prev
      return [...prev, { id: match.id, name: match.name }]
    })
    setPendingValidationItemId('')
  }

  const removePendingValidationItem = (id) => {
    setPendingValidationItems((prev) => prev.filter((x) => String(x.id) !== String(id)))
  }

  const viewPendingValidationReport = () => {
    if (!pendingValidationProjectId) {
      toast.error(t('ppe.pendingValidation.projectRequired'))
      return
    }
    if (pendingValidationItems.length === 0) {
      toast.error(t('ppe.pendingValidation.itemsRequired'))
      return
    }

    const itemIds = pendingValidationItems.map((x) => x.id).join(',')
    const url = `/admin/ppe/pending-validation-report?project_id=${encodeURIComponent(String(pendingValidationProjectId))}&item_ids=${encodeURIComponent(itemIds)}`
    window.open(url, '_blank', 'noopener,noreferrer')
  }

  useEffect(() => {
    const id = setTimeout(() => setDebouncedSearch(search.trim()), 300)
    return () => clearTimeout(id)
  }, [search])

  useEffect(() => {
    const handleClickOutside = (e) => {
      const target = e.target
      if (!distributeMenuRef.current || !(target instanceof Node)) return
      if (!distributeMenuRef.current.contains(target)) {
        setDistributeMenuOpen(false)
      }
    }
    document.addEventListener('mousedown', handleClickOutside)
    return () => document.removeEventListener('mousedown', handleClickOutside)
  }, [])

  useEffect(() => {
    const loadProjects = async () => {
      try {
        setLoadingProjects(true)
        const list = await projectService.getAllList({ status: 'active' })
        setProjects(Array.isArray(list) ? list : [])
        if (!selectedProjectId && Array.isArray(list) && list.length === 1) {
          setSelectedProjectId(String(list[0].id))
        }
      } catch (e) {
        setProjects([])
        toast.error(e.response?.data?.message ?? t('errors.somethingWentWrong'))
      } finally {
        setLoadingProjects(false)
      }
    }

    loadProjects()
  }, [])

  const loadItems = async () => {
    try {
      setLoadingItems(true)
      if (!selectedProjectId) {
        setItems([])
        return
      }

      const res = await ppeService.getItems({
        project_id: hasSpecificProjectSelected ? Number(selectedProjectId) : undefined,
        search: debouncedSearch ? debouncedSearch : undefined,
      })
      setItems(res.data?.data ?? [])
    } catch (e) {
      setItems([])
      toast.error(e.response?.data?.message ?? t('errors.somethingWentWrong'))
    } finally {
      setLoadingItems(false)
    }
  }

  useEffect(() => {
    loadItems()
  }, [debouncedSearch, selectedProjectId])

  const openCreate = () => {
    setEditingItem(null)
    setItemForm({ name: '' })
    setEditOpen(true)
  }

  const openEdit = (item) => {
    setEditingItem(item)
    setItemForm({ name: item?.name ?? '' })
    setEditOpen(true)
  }

  const closeEdit = () => {
    setEditOpen(false)
    setEditingItem(null)
    setItemForm({ name: '' })
  }

  const saveItem = async (e) => {
    e.preventDefault()
    try {
      setSavingItem(true)
      const payload = {
        id: editingItem?.id,
        name: itemForm.name,
      }
      await ppeService.upsertItem(payload)
      toast.success(t('success.saved'))
      closeEdit()
      await loadItems()
    } catch (e2) {
      toast.error(e2.response?.data?.message ?? t('errors.somethingWentWrong'))
    } finally {
      setSavingItem(false)
    }
  }

  const requestDelete = (item) => {
    setConfirmDelete(item)
  }

  const doDelete = async () => {
    if (!confirmDelete) return
    try {
      setDeleting(true)
      await ppeService.deleteItem(confirmDelete.id)
      toast.success(t('success.deleted'))
      setConfirmDelete(null)
      await loadItems()
    } catch (e) {
      toast.error(e.response?.data?.message ?? t('errors.somethingWentWrong'))
    } finally {
      setDeleting(false)
    }
  }

  const openIssue = () => {
    if (!hasSpecificProjectSelected) {
      toast.error(t('ppe.projectRequired'))
      return
    }
    setIssueOpen(true)
    setIssueForm({ worker_query: '', worker_id: '', worker_label: '', ppe_item_id: '', ppe_other: '', quantity: 1, received_at: '' })
    setWorkerResults([])
  }

  const closeIssue = () => {
    setIssueOpen(false)
    setIssueForm({ worker_query: '', worker_id: '', worker_label: '', ppe_item_id: '', ppe_other: '', quantity: 1, received_at: '' })
    setWorkerResults([])
  }

  const searchWorkers = async (q) => {
    const query = String(q ?? '').trim()
    if (!query) {
      setWorkerResults([])
      return
    }

    const reqId = ++workerSearchReq.current
    try {
      setWorkerSearching(true)
      const res = await workerService.getAll({
        search: query,
        project_id: hasSpecificProjectSelected ? Number(selectedProjectId) : undefined,
        is_active: true,
        per_page: 10,
      })
      if (reqId !== workerSearchReq.current) return
      const data = res.data?.data?.data ?? []
      setWorkerResults(Array.isArray(data) ? data : [])
    } catch {
      if (reqId !== workerSearchReq.current) return
      setWorkerResults([])
    } finally {
      if (reqId === workerSearchReq.current) setWorkerSearching(false)
    }
  }

  useEffect(() => {
    const id = setTimeout(() => {
      searchWorkers(issueForm.worker_query)
    }, 350)
    return () => clearTimeout(id)
  }, [issueForm.worker_query])

  const issueToWorker = async (e) => {
    e.preventDefault()
    if (!issueForm.worker_id) {
      toast.error(t('ppe.issue.chooseWorker'))
      return
    }

    if (!issueForm.ppe_item_id && !issueForm.ppe_other.trim()) {
      toast.error(t('ppe.issue.chooseItem'))
      return
    }

    try {
      setIssuing(true)
      const payload = {
        worker_id: Number(issueForm.worker_id),
        ppe_item_id: issueForm.ppe_item_id ? Number(issueForm.ppe_item_id) : undefined,
        ppe_name: !issueForm.ppe_item_id ? issueForm.ppe_other.trim() : undefined,
        quantity: Number(issueForm.quantity ?? 1),
        received_at: issueForm.received_at,
      }
      await ppeService.issueToWorker(payload)
      toast.success(t('ppe.issue.success'))
      closeIssue()
      await loadItems()
    } catch (e2) {
      toast.error(e2.response?.data?.message ?? t('errors.somethingWentWrong'))
    } finally {
      setIssuing(false)
    }
  }

  const canManage = Boolean(user)

  const itemsSorted = useMemo(() => {
    return [...items].sort((a, b) => String(a.name ?? '').localeCompare(String(b.name ?? '')))
  }, [items])

  const openBulkImport = () => {
    if (!hasSpecificProjectSelected) {
      toast.error(t('ppe.projectRequired'))
      return
    }
    setBulkFile(null)
    if (bulkInputRef.current) bulkInputRef.current.value = ''
    setBulkModalOpen(true)
  }

  const handleDownloadTemplate = async () => {
    try {
      const res = await ppeService.downloadMassTemplate()
      const filename = extractFilename(res.headers?.['content-disposition']) ?? 'ppe_issues_mass_template.xlsx'
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
      const res = await ppeService.massImport({ excel: bulkFile })
      const payload = res.data?.data ?? res.data

      const imported = payload?.imported ?? 0
      const updated = payload?.updated ?? 0
      const errors = payload?.errors ?? []
      const failedRowsUrl = payload?.failed_rows_url

      toast.success(t('common.importSummary', { imported, updated }))
      if (Array.isArray(errors) && errors.length > 0) {
        toast.error(t('common.importIssues', { count: errors.length }))
      }

      if (failedRowsUrl) {
        try {
          await downloadFromUrl(failedRowsUrl, 'ppe_issues_failed_rows.xlsx')
        } catch {
          // ignore
        }
      }

      setBulkModalOpen(false)
      setBulkFile(null)
      if (bulkInputRef.current) bulkInputRef.current.value = ''
      await loadItems()
    } catch (e) {
      toast.error(e.response?.data?.message ?? t('common.importFailed'))
    } finally {
      setBulkUploading(false)
    }
  }

  return (
    <div className="space-y-4">
      <div className="card p-4 overflow-visible">
        <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-3">
          <div className="min-w-0">
            <div className="flex items-center gap-2">
              <Shield className="w-5 h-5 text-hse-primary" />
              <h1 className="text-lg font-semibold text-gray-900 dark:text-gray-100">{t('ppe.title')}</h1>
            </div>
            <div className="text-sm text-gray-600 dark:text-gray-300 mt-1">{t('ppe.subtitle')}</div>
          </div>

          <div className="flex flex-wrap gap-2">
            <div className="relative" ref={distributeMenuRef}>
              <button
                type="button"
                className="btn-outline btn-sm flex items-center gap-2"
                onClick={() => setDistributeMenuOpen((v) => !v)}
                disabled={!canManage}
              >
                <PackagePlus className="w-4 h-4" />
                {t('ppe.issue.button')}
                <ChevronDown className="w-4 h-4" />
              </button>

              {distributeMenuOpen && (
                <div className="absolute right-0 mt-2 w-56 rounded-lg border border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-900 shadow-lg z-50 overflow-hidden">
                  <button
                    type="button"
                    className="w-full text-left px-4 py-2 text-sm hover:bg-gray-50 dark:hover:bg-gray-800"
                    onClick={() => {
                      setDistributeMenuOpen(false)
                      openIssue()
                    }}
                  >
                    {t('ppe.issue.menuManual')}
                  </button>
                  <button
                    type="button"
                    className="w-full text-left px-4 py-2 text-sm hover:bg-gray-50 dark:hover:bg-gray-800"
                    onClick={() => {
                      setDistributeMenuOpen(false)
                      openBulkImport()
                    }}
                  >
                    {t('ppe.issue.menuImport')}
                  </button>
                </div>
              )}
            </div>

            {isStrictAdmin && (
              <button
                type="button"
                className="btn-outline btn-sm flex items-center gap-2"
                onClick={openPendingValidation}
              >
                <ClipboardCheck className="w-4 h-4" />
                {t('ppe.pendingValidation.button')}
              </button>
            )}
            <button type="button" className="btn-primary btn-sm flex items-center gap-2" onClick={openCreate} disabled={!canManage}>
              <PlusCircle className="w-4 h-4" />
              {t('ppe.items.add')}
            </button>
          </div>
        </div>
      </div>

      <div className="card p-3">
        <div className="flex flex-col md:flex-row md:items-center gap-2">
          <div className="w-full md:max-w-md">
            <label className="label text-xs">{t('ppe.project')}</label>
            <Select
              value={selectedProjectId}
              onChange={(e) => setSelectedProjectId(e.target.value)}
              disabled={loadingProjects}
            >
              <option value="">{t('common.select')}</option>
              {canSelectAllProjects && <option value="all">{t('common.allProjects')}</option>}
              {projects.map((p) => (
                <option key={p.id} value={p.id}>
                  {p.code ? `${p.code} - ${p.name}` : p.name}
                </option>
              ))}
            </Select>
          </div>

          <div className="flex-1" />

          <div className="flex flex-wrap gap-2">
            <button
              type="button"
              className="btn-outline btn-sm"
              onClick={() => {
                if (!hasSpecificProjectSelected) {
                  toast.error(t('ppe.projectRequired'))
                  return
                }
                setRestockForm({ ppe_item_id: '', ppe_other: '', quantity: 1, low_stock_threshold: '' })
                setRestockOpen(true)
              }}
              disabled={!canManage}
            >
              {t('ppe.restock.button')}
            </button>
          </div>
        </div>
      </div>

      <div className="card p-3 overflow-visible">
        <div className="flex flex-col md:flex-row md:items-center gap-2">
          <div className="relative w-full md:max-w-md">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
            <input
              className="input pl-9 py-1.5 text-sm"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder={t('common.search')}
            />
          </div>
        </div>
      </div>

      <div className="card overflow-hidden">
        {!selectedProjectId ? (
          <div className="p-6 text-sm text-gray-600 dark:text-gray-300">{t('ppe.projectRequired')}</div>
        ) : loadingItems ? (
          <div className="p-6 flex items-center justify-center">
            <Loader2 className="w-6 h-6 animate-spin text-hse-primary" />
          </div>
        ) : itemsSorted.length === 0 ? (
          <div className="p-6 text-sm text-gray-600 dark:text-gray-300">{t('common.noData')}</div>
        ) : (
          <div className="overflow-x-auto">
            <table className="min-w-full text-sm">
              <thead>
                <tr className="border-b border-gray-200 dark:border-gray-700 text-left">
                  <th className="py-3 px-4 font-medium text-gray-500 dark:text-gray-400">{t('ppe.items.name')}</th>
                  <th className="py-3 px-4 font-medium text-gray-500 dark:text-gray-400">{t('ppe.items.stock')}</th>
                  <th className="py-3 px-4 font-medium text-gray-500 dark:text-gray-400">{t('ppe.items.threshold')}</th>
                  <th className="py-3 px-4 font-medium text-gray-500 dark:text-gray-400">{t('common.actions')}</th>
                </tr>
              </thead>
              <tbody>
                {itemsSorted.map((it) => (
                  <tr key={it.id} className="border-b border-gray-100 dark:border-gray-800">
                    <td className="py-3 px-4 text-gray-900 dark:text-gray-100">{it.name}</td>
                    <td className="py-3 px-4 text-gray-700 dark:text-gray-200 font-mono">{it.stock_quantity ?? 0}</td>
                    <td className="py-3 px-4 text-gray-700 dark:text-gray-200 font-mono">{it.low_stock_threshold ?? 0}</td>
                    <td className="py-3 px-4">
                      <div className="flex flex-wrap gap-2">
                        <button type="button" className="btn-outline btn-sm flex items-center gap-2" onClick={() => openEdit(it)}>
                          <Pencil className="w-4 h-4" />
                          {t('common.edit')}
                        </button>
                        <button type="button" className="btn-danger btn-sm flex items-center gap-2" onClick={() => requestDelete(it)}>
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

      {editOpen && (
        <Modal isOpen={editOpen} onClose={closeEdit} title={editingItem ? t('ppe.items.edit') : t('ppe.items.add')} size="lg">
          <form onSubmit={saveItem} className="space-y-4">
            <div>
              <label className="label">{t('ppe.items.name')}</label>
              <input className="input" value={itemForm.name} onChange={(e) => setItemForm((p) => ({ ...p, name: e.target.value }))} required />
            </div>
            <div className="flex justify-end gap-2">
              <button type="button" className="btn-secondary" onClick={closeEdit}>
                {t('common.cancel')}
              </button>
              <button type="submit" className="btn-primary" disabled={savingItem}>
                {savingItem ? t('common.saving') : t('common.save')}
              </button>
            </div>
          </form>
        </Modal>
      )}

      {bulkModalOpen && (
        <Modal isOpen={bulkModalOpen} onClose={() => setBulkModalOpen(false)} title={t('common.import')} size="lg">
          <div className="space-y-4">
            <div className="flex items-center gap-2 text-sm text-gray-700 dark:text-gray-200">
              <FileSpreadsheet className="w-4 h-4 text-hse-primary" />
              <div>{t('ppe.note')}</div>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
              <button type="button" onClick={handleDownloadTemplate} className="btn-secondary" disabled={bulkUploading}>
                {t('common.downloadTemplate')}
              </button>

              <label className="flex items-center justify-between border-2 border-dashed border-gray-300 dark:border-gray-600 rounded-lg px-3 py-2 text-xs cursor-pointer hover:border-hse-primary hover:bg-hse-primary/5">
                <div className="flex items-center gap-2">
                  <Upload className="w-4 h-4 text-gray-500" />
                  <span className="text-gray-700 dark:text-gray-200">{bulkFile ? bulkFile.name : t('common.chooseFile')}</span>
                </div>
                <input
                  ref={bulkInputRef}
                  type="file"
                  accept=".xlsx,.xls"
                  className="hidden"
                  onChange={(e) => setBulkFile(e.target.files?.[0] ?? null)}
                />
              </label>
            </div>

            <div className="flex justify-end gap-2">
              <button type="button" className="btn-secondary" onClick={() => setBulkModalOpen(false)} disabled={bulkUploading}>
                {t('common.cancel')}
              </button>
              <button type="button" className="btn-primary" onClick={handleBulkImport} disabled={bulkUploading}>
                {bulkUploading ? t('common.importing') : t('common.import')}
              </button>
            </div>
          </div>
        </Modal>
      )}

      {pendingValidationOpen && (
        <Modal
          isOpen={pendingValidationOpen}
          onClose={() => setPendingValidationOpen(false)}
          title={t('ppe.pendingValidation.title')}
          size="xl"
        >
          <div className="space-y-4">
            <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
              <div>
                <label className="label text-xs">{t('ppe.pendingValidation.pole')}</label>
                <Select
                  value={pendingValidationPole}
                  onChange={(e) => {
                    const next = e.target.value
                    setPendingValidationPole(next)
                    setPendingValidationProjectId('')
                  }}
                >
                  <option value="">{t('common.select')}</option>
                  {pendingValidationPoles.map((p) => (
                    <option key={String(p)} value={String(p)}>
                      {String(p)}
                    </option>
                  ))}
                </Select>
              </div>

              <div>
                <label className="label text-xs">{t('ppe.pendingValidation.project')}</label>
                <Select value={pendingValidationProjectId} onChange={(e) => setPendingValidationProjectId(e.target.value)}>
                  <option value="">{t('common.select')}</option>
                  {filteredProjectsForPendingValidation.map((p) => (
                    <option key={p.id} value={p.id}>
                      {p.code ? `${p.code} - ${p.name}` : p.name}
                    </option>
                  ))}
                </Select>
              </div>
            </div>

            <div>
              <label className="label text-xs">{t('ppe.pendingValidation.articles')}</label>
              <div className="flex flex-col md:flex-row gap-2">
                <Select value={pendingValidationItemId} onChange={(e) => setPendingValidationItemId(e.target.value)}>
                  <option value="">{t('common.select')}</option>
                  {pendingValidationCatalogLoading && (
                    <option value="" disabled>
                      {t('common.loading')}
                    </option>
                  )}
                  {pendingValidationCatalog
                    .slice()
                    .sort((a, b) => String(a?.name ?? '').localeCompare(String(b?.name ?? '')))
                    .map((it) => (
                    <option key={it.id} value={it.id}>
                      {it.name}
                    </option>
                    ))}
                </Select>
                <button type="button" className="btn-secondary" onClick={addPendingValidationItem}>
                  {t('common.add')}
                </button>
              </div>
            </div>

            {pendingValidationItems.length > 0 && (
              <div className="rounded-lg border border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-900 p-3">
                <div className="text-xs font-semibold text-gray-700 dark:text-gray-200 mb-2">{t('ppe.pendingValidation.selected')}</div>
                <div className="flex flex-wrap gap-2">
                  {pendingValidationItems.map((x) => (
                    <div
                      key={String(x.id)}
                      className="inline-flex items-center gap-2 px-3 py-1.5 rounded-full text-xs border border-gray-200 dark:border-gray-700 bg-gray-50 dark:bg-gray-800"
                    >
                      <span className="text-gray-800 dark:text-gray-100">{x.name}</span>
                      <button
                        type="button"
                        className="p-1 rounded-full hover:bg-gray-200/60 dark:hover:bg-gray-700"
                        onClick={() => removePendingValidationItem(x.id)}
                        aria-label={t('common.remove')}
                      >
                        <X className="w-3.5 h-3.5" />
                      </button>
                    </div>
                  ))}
                </div>
              </div>
            )}

            <div className="flex justify-end gap-2">
              <button type="button" className="btn-secondary" onClick={() => setPendingValidationOpen(false)}>
                {t('common.cancel')}
              </button>
              <button type="button" className="btn-primary" onClick={viewPendingValidationReport}>
                {t('ppe.pendingValidation.viewReport')}
              </button>
            </div>
          </div>
        </Modal>
      )}

      {restockOpen && (
        <Modal isOpen={restockOpen} onClose={() => setRestockOpen(false)} title={t('ppe.restock.title')} size="lg">
          <form
            onSubmit={async (e) => {
              e.preventDefault()
              if (!hasSpecificProjectSelected) {
                toast.error(t('ppe.projectRequired'))
                return
              }
              if (!restockForm.ppe_item_id && !restockForm.ppe_other.trim()) {
                toast.error(t('ppe.restock.chooseItem'))
                return
              }
              try {
                setRestocking(true)
                await ppeService.restock({
                  project_id: Number(selectedProjectId),
                  ppe_item_id: restockForm.ppe_item_id ? Number(restockForm.ppe_item_id) : undefined,
                  ppe_name: !restockForm.ppe_item_id ? restockForm.ppe_other.trim() : undefined,
                  quantity: Number(restockForm.quantity ?? 1),
                  low_stock_threshold:
                    String(restockForm.low_stock_threshold ?? '').trim() !== ''
                      ? Number(restockForm.low_stock_threshold)
                      : undefined,
                })
                toast.success(t('success.saved'))
                setRestockOpen(false)
                await loadItems()
              } catch (e2) {
                toast.error(e2.response?.data?.message ?? t('errors.somethingWentWrong'))
              } finally {
                setRestocking(false)
              }
            }}
            className="space-y-4"
          >
            <div>
              <label className="label">{t('ppe.restock.item')}</label>
              <Select
                value={restockForm.ppe_item_id}
                onChange={(e) => setRestockForm((p) => ({ ...p, ppe_item_id: e.target.value, ppe_other: '' }))}
              >
                <option value="">{t('ppe.issue.other')}</option>
                {itemsSorted.map((it) => (
                  <option key={it.id} value={it.id}>
                    {it.name} ({it.stock_quantity ?? 0})
                  </option>
                ))}
              </Select>

              {!restockForm.ppe_item_id && (
                <div className="mt-2">
                  <label className="label text-xs">{t('ppe.issue.otherSpecify')}</label>
                  <input
                    className="input"
                    value={restockForm.ppe_other}
                    onChange={(e) => setRestockForm((p) => ({ ...p, ppe_other: e.target.value }))}
                    placeholder={t('ppe.issue.otherPlaceholder')}
                  />
                </div>
              )}
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
              <div>
                <label className="label">{t('ppe.restock.quantity')}</label>
                <input
                  type="number"
                  min={1}
                  className="input"
                  value={restockForm.quantity}
                  onChange={(e) => setRestockForm((p) => ({ ...p, quantity: e.target.value }))}
                  required
                />
              </div>
              <div>
                <label className="label">{t('ppe.restock.threshold')}</label>
                <input
                  type="number"
                  min={0}
                  className="input"
                  value={restockForm.low_stock_threshold}
                  onChange={(e) => setRestockForm((p) => ({ ...p, low_stock_threshold: e.target.value }))}
                  placeholder={t('ppe.restock.thresholdPlaceholder')}
                />
              </div>
            </div>

            <div className="flex justify-end gap-2">
              <button type="button" className="btn-secondary" onClick={() => setRestockOpen(false)}>
                {t('common.cancel')}
              </button>
              <button type="submit" className="btn-primary" disabled={restocking}>
                {restocking ? t('common.saving') : t('ppe.restock.submit')}
              </button>
            </div>
          </form>
        </Modal>
      )}

      {confirmDelete && (
        <Modal isOpen={!!confirmDelete} onClose={() => setConfirmDelete(null)} title={t('common.confirm')} size="md">
          <div className="space-y-4">
            <div className="text-sm text-gray-700 dark:text-gray-200">
              {t('ppe.items.confirmDelete', { name: confirmDelete.name })}
            </div>
            <div className="flex justify-end gap-2">
              <button type="button" className="btn-secondary" onClick={() => setConfirmDelete(null)}>
                {t('common.cancel')}
              </button>
              <button type="button" className="btn-danger" onClick={doDelete} disabled={deleting}>
                {deleting ? t('common.deleting') : t('common.delete')}
              </button>
            </div>
          </div>
        </Modal>
      )}

      {issueOpen && (
        <Modal isOpen={issueOpen} onClose={closeIssue} title={t('ppe.issue.title')} size="xl">
          <form onSubmit={issueToWorker} className="space-y-4">
            <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
              <div className="md:col-span-2">
                <label className="label">{t('ppe.issue.worker')}</label>
                <input
                  className="input"
                  value={issueForm.worker_query}
                  onChange={(e) =>
                    setIssueForm((p) => ({ ...p, worker_query: e.target.value, worker_id: '', worker_label: '' }))
                  }
                  placeholder={t('ppe.issue.workerSearchPlaceholder')}
                />
                {issueForm.worker_query.trim() && !issueForm.worker_id && (
                  <div className="mt-2 rounded-lg border border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-900 overflow-hidden">
                    {workerSearching ? (
                      <div className="px-3 py-2 text-xs text-gray-500">...</div>
                    ) : workerResults.length === 0 ? (
                      <div className="px-3 py-2 text-xs text-gray-500">{t('common.noData')}</div>
                    ) : (
                      <div className="max-h-56 overflow-auto">
                        {workerResults.map((w) => (
                          <button
                            key={w.id}
                            type="button"
                            className="w-full text-left px-3 py-2 text-sm hover:bg-gray-50 dark:hover:bg-gray-800"
                            onClick={() => {
                              setIssueForm((p) => ({
                                ...p,
                                worker_id: String(w.id),
                                worker_label: `${w.full_name}${w.cin ? ` (${w.cin})` : ''}`,
                                worker_query: `${w.full_name}${w.cin ? ` (${w.cin})` : ''}`,
                              }))
                              setWorkerResults([])
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

              <div>
                <label className="label">{t('ppe.issue.item')}</label>
                <Select
                  value={issueForm.ppe_item_id}
                  onChange={(e) => setIssueForm((p) => ({ ...p, ppe_item_id: e.target.value, ppe_other: '' }))}
                >
                  <option value="">{t('ppe.issue.other')}</option>
                  {itemsSorted.map((it) => (
                    <option key={it.id} value={it.id}>
                      {it.name} ({it.stock_quantity ?? 0})
                    </option>
                  ))}
                </Select>
                {!issueForm.ppe_item_id && (
                  <div className="mt-2">
                    <label className="label text-xs">{t('ppe.issue.otherSpecify')}</label>
                    <input
                      className="input"
                      value={issueForm.ppe_other}
                      onChange={(e) => setIssueForm((p) => ({ ...p, ppe_other: e.target.value }))}
                      placeholder={t('ppe.issue.otherPlaceholder')}
                    />
                  </div>
                )}
              </div>

              <div>
                <label className="label">{t('ppe.issue.quantity')}</label>
                <input
                  type="number"
                  min={1}
                  className="input"
                  value={issueForm.quantity}
                  onChange={(e) => setIssueForm((p) => ({ ...p, quantity: e.target.value }))}
                  required
                />
              </div>

              <div>
                <label className="label">{t('ppe.issue.receivedAt')}</label>
                <DatePicker value={issueForm.received_at} onChange={(v) => setIssueForm((p) => ({ ...p, received_at: v }))} required />
              </div>
            </div>

            <div className="flex justify-end gap-2">
              <button type="button" className="btn-secondary" onClick={closeIssue}>
                {t('common.cancel')}
              </button>
              <button type="submit" className="btn-primary" disabled={issuing}>
                {issuing ? t('common.saving') : t('ppe.issue.submit')}
              </button>
            </div>
          </form>
        </Modal>
      )}

      <div className="text-xs text-gray-500 dark:text-gray-400">
        {t('ppe.note')}
      </div>
    </div>
  )
}
