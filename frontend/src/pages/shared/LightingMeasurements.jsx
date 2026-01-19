import { useEffect, useMemo, useState } from 'react'
import { useLanguage } from '../../i18n'
import { useAuthStore } from '../../store/authStore'
import { projectService, lightingMeasurementService } from '../../services/api'
import Modal from '../../components/ui/Modal'
import ConfirmDialog from '../../components/ui/ConfirmDialog'
import { sortProjects } from '../../utils/projectList'
import { Sun, Plus, Edit2, Trash2, Loader2 } from 'lucide-react'
import toast from 'react-hot-toast'

export default function LightingMeasurements() {
  const { t } = useLanguage()
  const { user } = useAuthStore()

  const [projects, setProjects] = useState([])
  const [items, setItems] = useState([])
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)

  const [selectedProjectId, setSelectedProjectId] = useState('')
  const [yearFilter, setYearFilter] = useState('')
  const [monthFilter, setMonthFilter] = useState('')

  const [showModal, setShowModal] = useState(false)
  const [editing, setEditing] = useState(null)
  const [confirmDelete, setConfirmDelete] = useState(null)

  const projectListPreference = user?.project_list_preference ?? 'code'
  const sortedProjects = useMemo(() => sortProjects(projects, projectListPreference), [projects, projectListPreference])

  const getEmptyForm = () => ({
    project_id: '',
    measured_at: new Date().toISOString().split('T')[0],
    location: '',
    lux_value: '',
    threshold: '',
    notes: '',
  })

  const [formData, setFormData] = useState(getEmptyForm())

  useEffect(() => {
    const fetchProjects = async () => {
      try {
        const res = await projectService.getAll({ per_page: 200 })
        const list = res.data?.data ?? []
        setProjects(Array.isArray(list) ? list : [])
      } catch (e) {
        setProjects([])
      } finally {
        setLoading(false)
      }
    }
    fetchProjects()
  }, [])

  const fetchItems = async () => {
    setLoading(true)
    try {
      const params = { per_page: 100 }
      if (selectedProjectId) params.project_id = selectedProjectId
      if (yearFilter) params.year = yearFilter
      if (monthFilter) params.month = monthFilter

      const res = await lightingMeasurementService.getAll(params)
      const payload = res.data
      const data = payload?.data ?? payload
      const rows = Array.isArray(data) ? data : (data?.data ?? [])
      setItems(rows)
    } catch (e) {
      setItems([])
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    fetchItems()
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [selectedProjectId, yearFilter, monthFilter])

  const openCreate = () => {
    setEditing(null)
    setFormData({
      ...getEmptyForm(),
      project_id: selectedProjectId || '',
    })
    setShowModal(true)
  }

  const openEdit = (row) => {
    setEditing(row)
    setFormData({
      project_id: String(row.project_id ?? ''),
      measured_at: row.measured_at?.substring(0, 10) ?? new Date().toISOString().split('T')[0],
      location: row.location ?? '',
      lux_value: row.lux_value ?? '',
      threshold: row.threshold ?? '',
      notes: row.notes ?? '',
    })
    setShowModal(true)
  }

  const closeModal = () => {
    setShowModal(false)
    setEditing(null)
    setFormData(getEmptyForm())
  }

  const submit = async (e) => {
    e.preventDefault()
    setSaving(true)
    try {
      const payload = {
        project_id: parseInt(formData.project_id),
        measured_at: formData.measured_at,
        location: formData.location,
        lux_value: Number(formData.lux_value),
        threshold: formData.threshold === '' ? null : Number(formData.threshold),
        notes: formData.notes || null,
      }

      if (editing?.id) {
        await lightingMeasurementService.update(editing.id, payload)
      } else {
        await lightingMeasurementService.create(payload)
      }

      toast.success(t('common.saved') ?? 'Saved')
      closeModal()
      fetchItems()
    } catch (e) {
      toast.error(t('common.error') ?? 'Error')
    } finally {
      setSaving(false)
    }
  }

  const confirmArchive = (row) => setConfirmDelete(row)

  const doArchive = async () => {
    if (!confirmDelete?.id) return
    setSaving(true)
    try {
      await lightingMeasurementService.delete(confirmDelete.id)
      toast.success(t('common.saved') ?? 'Saved')
      setConfirmDelete(null)
      fetchItems()
    } catch (e) {
      toast.error(t('common.error') ?? 'Error')
    } finally {
      setSaving(false)
    }
  }

  const formatDate = (d) => {
    if (!d) return '-'
    const s = d.substring(0, 10)
    const [y, m, day] = s.split('-')
    return `${day}/${m}/${y}`
  }

  return (
    <div className="max-w-7xl mx-auto p-6 space-y-6">
      <div className="flex items-center justify-between gap-3">
        <div className="flex items-center gap-3">
          <div className="p-2 bg-amber-50 rounded-lg">
            <Sun className="w-6 h-6 text-amber-600" />
          </div>
          <div>
            <h1 className="text-xl font-bold text-gray-900 dark:text-gray-100">{t('lightingMeasurements.pageTitle') ?? 'Lighting Measurements (Lux)'}</h1>
            <p className="text-sm text-gray-500 dark:text-gray-400">{t('lightingMeasurements.pageSubtitle') ?? 'Location + lux value + optional threshold compliance'}</p>
          </div>
        </div>

        <button onClick={openCreate} className="btn-primary flex items-center gap-2">
          <Plus className="w-4 h-4" />
          {t('common.new') ?? 'New'}
        </button>
      </div>

      <div className="bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-2xl p-4">
        <div className="grid grid-cols-1 md:grid-cols-5 gap-3">
          <div>
            <label className="label">{t('projects.title') ?? 'Project'}</label>
            <select className="input" value={selectedProjectId} onChange={(e) => setSelectedProjectId(e.target.value)}>
              <option value="">{t('common.all') ?? 'All'}</option>
              {sortedProjects.map((p) => (
                <option key={p.id} value={String(p.id)}>
                  {p.code ? `${p.code} - ${p.name}` : p.name}
                </option>
              ))}
            </select>
          </div>

          <div>
            <label className="label">Year</label>
            <input className="input" type="number" value={yearFilter} onChange={(e) => setYearFilter(e.target.value)} placeholder="2026" />
          </div>

          <div>
            <label className="label">Month</label>
            <input className="input" type="number" min="1" max="12" value={monthFilter} onChange={(e) => setMonthFilter(e.target.value)} placeholder="1-12" />
          </div>
        </div>
      </div>

      <div className="bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-2xl overflow-hidden">
        <div className="px-4 py-3 border-b border-gray-200 dark:border-gray-700 flex items-center justify-between">
          <div className="text-sm font-semibold text-gray-800 dark:text-gray-200">{t('lightingMeasurements.recordsTitle') ?? 'Records'}</div>
          {loading && (
            <div className="text-sm text-gray-500 flex items-center gap-2">
              <Loader2 className="w-4 h-4 animate-spin" />
              <span>{t('common.loading') ?? 'Loading...'}</span>
            </div>
          )}
        </div>

        <div className="overflow-x-auto">
          <table className="min-w-full text-sm">
            <thead className="bg-gray-50 dark:bg-gray-900">
              <tr>
                <th className="text-left px-4 py-2">Date</th>
                <th className="text-left px-4 py-2">Project</th>
                <th className="text-left px-4 py-2">Location</th>
                <th className="text-left px-4 py-2">Lux</th>
                <th className="text-left px-4 py-2">Threshold</th>
                <th className="text-left px-4 py-2">Compliant</th>
                <th className="text-right px-4 py-2">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-100 dark:divide-gray-700">
              {items.map((row) => (
                <tr key={row.id} className={row.deleted_at ? 'opacity-60' : ''}>
                  <td className="px-4 py-2">{formatDate(row.measured_at)}</td>
                  <td className="px-4 py-2">{row.project?.code ? `${row.project.code} - ${row.project.name}` : (row.project?.name ?? row.project_id)}</td>
                  <td className="px-4 py-2">{row.location}</td>
                  <td className="px-4 py-2">{row.lux_value}</td>
                  <td className="px-4 py-2">{row.threshold ?? '-'}</td>
                  <td className="px-4 py-2">{row.is_compliant === null ? '-' : (row.is_compliant ? 'Yes' : 'No')}</td>
                  <td className="px-4 py-2">
                    <div className="flex justify-end gap-2">
                      <button className="btn-secondary" onClick={() => openEdit(row)}>
                        <Edit2 className="w-4 h-4" />
                      </button>
                      <button className="btn-secondary" onClick={() => confirmArchive(row)}>
                        <Trash2 className="w-4 h-4" />
                      </button>
                    </div>
                  </td>
                </tr>
              ))}
              {!loading && items.length === 0 && (
                <tr>
                  <td colSpan="7" className="px-4 py-10 text-center text-gray-500">{t('lightingMeasurements.noRecords') ?? 'No records'}</td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </div>

      <Modal isOpen={showModal} onClose={closeModal} title={editing ? (t('lightingMeasurements.modal.editTitle') ?? 'Edit lighting measurement') : (t('lightingMeasurements.modal.newTitle') ?? 'New lighting measurement')}>
        <form onSubmit={submit} className="space-y-3">
          <div>
            <label className="label">Project</label>
            <select className="input" value={formData.project_id} onChange={(e) => setFormData((p) => ({ ...p, project_id: e.target.value }))} required>
              <option value="">Select...</option>
              {sortedProjects.map((p) => (
                <option key={p.id} value={String(p.id)}>
                  {p.code ? `${p.code} - ${p.name}` : p.name}
                </option>
              ))}
            </select>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
            <div>
              <label className="label">Date</label>
              <input type="date" className="input" value={formData.measured_at} onChange={(e) => setFormData((p) => ({ ...p, measured_at: e.target.value }))} required />
            </div>
            <div>
              <label className="label">Location</label>
              <input className="input" value={formData.location} onChange={(e) => setFormData((p) => ({ ...p, location: e.target.value }))} required />
            </div>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
            <div>
              <label className="label">Lux value</label>
              <input type="number" step="0.01" min="0" className="input" value={formData.lux_value} onChange={(e) => setFormData((p) => ({ ...p, lux_value: e.target.value }))} required />
            </div>
            <div>
              <label className="label">Threshold (optional)</label>
              <input type="number" step="0.01" min="0" className="input" value={formData.threshold} onChange={(e) => setFormData((p) => ({ ...p, threshold: e.target.value }))} />
            </div>
          </div>

          <div>
            <label className="label">Notes</label>
            <textarea className="input" rows="3" value={formData.notes} onChange={(e) => setFormData((p) => ({ ...p, notes: e.target.value }))} />
          </div>

          <div className="flex justify-end gap-2 pt-2">
            <button type="button" className="btn-secondary" onClick={closeModal}>{t('common.cancel') ?? 'Cancel'}</button>
            <button type="submit" className="btn-primary" disabled={saving}>
              {saving ? <Loader2 className="w-4 h-4 animate-spin" /> : (t('common.save') ?? 'Save')}
            </button>
          </div>
        </form>
      </Modal>

      <ConfirmDialog
        isOpen={!!confirmDelete}
        title="Archive record"
        message="This will archive (soft-delete) the record. Continue?"
        confirmLabel={t('common.confirm') ?? 'Confirm'}
        cancelLabel={t('common.cancel') ?? 'Cancel'}
        onConfirm={doArchive}
        onCancel={() => setConfirmDelete(null)}
      />
    </div>
  )
}
