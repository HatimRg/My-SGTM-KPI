import { useEffect, useMemo, useRef, useState } from 'react'
import { ppeService, projectService, workerService } from '../../services/api'
import { useLanguage } from '../../i18n'
import { useAuthStore } from '../../store/authStore'
import Modal from '../../components/ui/Modal'
import Select from '../../components/ui/Select'
import DatePicker from '../../components/ui/DatePicker'
import { Shield, PlusCircle, Pencil, Trash2, Search, Loader2, PackagePlus } from 'lucide-react'
import toast from 'react-hot-toast'

export default function PpeManagement() {
  const { t } = useLanguage()
  const { user } = useAuthStore()

  const [projects, setProjects] = useState([])
  const [loadingProjects, setLoadingProjects] = useState(true)
  const [selectedProjectId, setSelectedProjectId] = useState('')

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

  useEffect(() => {
    const id = setTimeout(() => setDebouncedSearch(search.trim()), 300)
    return () => clearTimeout(id)
  }, [search])

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
        project_id: Number(selectedProjectId),
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
    if (!selectedProjectId) {
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
        project_id: selectedProjectId ? Number(selectedProjectId) : undefined,
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

  return (
    <div className="space-y-4">
      <div className="card p-4">
        <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-3">
          <div className="min-w-0">
            <div className="flex items-center gap-2">
              <Shield className="w-5 h-5 text-hse-primary" />
              <h1 className="text-lg font-semibold text-gray-900 dark:text-gray-100">{t('ppe.title')}</h1>
            </div>
            <div className="text-sm text-gray-600 dark:text-gray-300 mt-1">{t('ppe.subtitle')}</div>
          </div>

          <div className="flex flex-wrap gap-2">
            <button type="button" className="btn-outline btn-sm flex items-center gap-2" onClick={openIssue} disabled={!canManage}>
              <PackagePlus className="w-4 h-4" />
              {t('ppe.issue.button')}
            </button>
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
                if (!selectedProjectId) {
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

      {restockOpen && (
        <Modal isOpen={restockOpen} onClose={() => setRestockOpen(false)} title={t('ppe.restock.title')} size="lg">
          <form
            onSubmit={async (e) => {
              e.preventDefault()
              if (!selectedProjectId) {
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
