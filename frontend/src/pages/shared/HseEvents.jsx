import { useEffect, useMemo, useState } from 'react'
import { useLanguage } from '../../i18n'
import { useAuthStore } from '../../store/authStore'
import { projectService, hseEventService } from '../../services/api'
import Modal from '../../components/ui/Modal'
import ConfirmDialog from '../../components/ui/ConfirmDialog'
import { sortProjects } from '../../utils/projectList'
import { AlertTriangle, Plus, Edit2, Trash2, Loader2 } from 'lucide-react'
import toast from 'react-hot-toast'

const EVENT_TYPES = [
  { value: 'work_accident' },
  { value: 'incident' },
  { value: 'near_miss' },
  { value: 'first_aid' },
  { value: 'medical_consultation' },
  { value: 'road_accident' },
  { value: 'other' },
]

const SEVERITIES = [
  { value: '' },
  { value: 'minor' },
  { value: 'moderate' },
  { value: 'major' },
  { value: 'critical' },
  { value: 'fatal' },
  { value: 'other' },
]

export default function HseEvents() {
  const { t } = useLanguage()
  const { user } = useAuthStore()

  const typeLabel = (val) => t(`hseEvents.types.${val}`) ?? val
  const severityLabel = (val) => {
    if (!val) return t('common.all') ?? 'All'
    return t(`hseEvents.severities.${val}`) ?? val
  }

  const [projects, setProjects] = useState([])
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)

  const [items, setItems] = useState([])
  const [selectedProjectId, setSelectedProjectId] = useState('')
  const [typeFilter, setTypeFilter] = useState('')
  const [severityFilter, setSeverityFilter] = useState('')
  const [yearFilter, setYearFilter] = useState('')
  const [monthFilter, setMonthFilter] = useState('')
  const [fromDate, setFromDate] = useState('')
  const [toDate, setToDate] = useState('')

  const [showModal, setShowModal] = useState(false)
  const [editing, setEditing] = useState(null)
  const [confirmDelete, setConfirmDelete] = useState(null)

  const projectListPreference = user?.project_list_preference ?? 'code'
  const sortedProjects = useMemo(() => sortProjects(projects, projectListPreference), [projects, projectListPreference])

  const getEmptyForm = () => ({
    project_id: '',
    event_date: new Date().toISOString().split('T')[0],
    type: 'work_accident',
    type_other: '',
    description: '',
    severity: '',
    severity_other: '',
    lost_time: false,
    lost_days: 0,
    location: '',
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
      const params = {
        per_page: 100,
      }
      if (selectedProjectId) params.project_id = selectedProjectId
      if (yearFilter) params.year = yearFilter
      if (monthFilter) params.month = monthFilter
      if (fromDate) params.from_date = fromDate
      if (toDate) params.to_date = toDate

      const res = await hseEventService.getAll(params)
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
  }, [selectedProjectId, yearFilter, monthFilter, fromDate, toDate])

  const openCreate = () => {
    setEditing(null)
    setFormData({
      ...getEmptyForm(),
      project_id: selectedProjectId || '',
    })
    setShowModal(true)
  }

  const openEdit = (row) => {
    const isKnownType = EVENT_TYPES.some((tpe) => tpe.value !== 'other' && tpe.value === row.type)
    const isKnownSeverity = SEVERITIES.some((sev) => sev.value && sev.value !== 'other' && sev.value === row.severity)
    setEditing(row)
    setFormData({
      project_id: String(row.project_id ?? ''),
      event_date: row.event_date?.substring(0, 10) ?? new Date().toISOString().split('T')[0],
      type: isKnownType ? row.type : 'other',
      type_other: isKnownType ? '' : (row.type ?? ''),
      description: row.description ?? '',
      severity: isKnownSeverity ? row.severity : (row.severity ? 'other' : ''),
      severity_other: isKnownSeverity ? '' : (row.severity ?? ''),
      lost_time: !!row.lost_time,
      lost_days: row.lost_days ?? 0,
      location: row.location ?? '',
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
      const resolvedType = formData.type === 'other' ? (formData.type_other || '') : formData.type
      const resolvedSeverity = formData.severity === 'other' ? (formData.severity_other || '') : (formData.severity || '')

      if (!resolvedType) {
        toast.error(t('hseEvents.validation.typeRequired') ?? 'Type is required')
        return
      }
      if (formData.type === 'other' && !formData.type_other) {
        toast.error(t('hseEvents.validation.specifyType') ?? 'Please specify the type')
        return
      }
      if (formData.severity === 'other' && !formData.severity_other) {
        toast.error(t('hseEvents.validation.specifySeverity') ?? 'Please specify the severity')
        return
      }

      const payload = {
        project_id: parseInt(formData.project_id),
        event_date: formData.event_date,
        type: resolvedType,
        description: formData.description || null,
        severity: resolvedSeverity ? resolvedSeverity : null,
        lost_time: !!formData.lost_time,
        lost_days: Number(formData.lost_days) || 0,
        location: formData.location || null,
      }

      if (editing?.id) {
        await hseEventService.update(editing.id, payload)
        toast.success(t('common.saved') ?? 'Saved')
      } else {
        await hseEventService.create(payload)
        toast.success(t('common.saved') ?? 'Saved')
      }

      closeModal()
      fetchItems()
    } catch (err) {
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
      await hseEventService.delete(confirmDelete.id)
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
    if (!d) return t('common.none') ?? '-'
    const s = d.substring(0, 10)
    const [y, m, day] = s.split('-')
    return `${day}/${m}/${y}`
  }

  const visibleItems = useMemo(() => {
    let rows = Array.isArray(items) ? items : []

    if (typeFilter) {
      if (typeFilter === 'other') {
        rows = rows.filter((r) => !EVENT_TYPES.some((tpe) => tpe.value !== 'other' && tpe.value === r.type))
      } else {
        rows = rows.filter((r) => r.type === typeFilter)
      }
    }

    if (severityFilter) {
      if (severityFilter === 'other') {
        rows = rows.filter((r) => r.severity && !SEVERITIES.some((sev) => sev.value && sev.value !== 'other' && sev.value === r.severity))
      } else {
        rows = rows.filter((r) => (r.severity ?? '') === severityFilter)
      }
    }

    return rows
  }, [items, typeFilter, severityFilter])

  return (
    <div className="max-w-7xl mx-auto p-6 space-y-6">
      <div className="flex items-center justify-between gap-3">
        <div className="flex items-center gap-3">
          <div className="p-2 bg-red-50 rounded-lg">
            <AlertTriangle className="w-6 h-6 text-red-500" />
          </div>
          <div>
            <h1 className="text-xl font-bold text-gray-900 dark:text-gray-100">{t('hseEvents.pageTitle') ?? 'Accidents, Incidents & Medical Visits'}</h1>
            <p className="text-sm text-gray-500 dark:text-gray-400">{t('hseEvents.pageSubtitle') ?? 'Register and track HSE events (accidents, incidents, near misses, first aid, road accidents)'}</p>
          </div>
        </div>

        <button onClick={openCreate} className="btn-primary flex items-center gap-2">
          <Plus className="w-4 h-4" />
          {t('common.new') ?? 'New'}
        </button>
      </div>

      <div className="bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-2xl p-4">
        <div className="grid grid-cols-1 md:grid-cols-7 gap-3">
          <div>
            <label className="label">{t('projects.title') ?? 'Project'}</label>
            <select
              className="input"
              value={selectedProjectId}
              onChange={(e) => setSelectedProjectId(e.target.value)}
            >
              <option value="">{t('common.all') ?? 'All'}</option>
              {sortedProjects.map((p) => (
                <option key={p.id} value={String(p.id)}>
                  {p.code ? `${p.code} - ${p.name}` : p.name}
                </option>
              ))}
            </select>
          </div>

          <div>
            <label className="label">{t('hseEvents.filters.type') ?? 'Type'}</label>
            <select className="input" value={typeFilter} onChange={(e) => setTypeFilter(e.target.value)}>
              <option value="">{t('common.all') ?? 'All'}</option>
              {EVENT_TYPES.map((tpe) => (
                <option key={tpe.value} value={tpe.value}>{typeLabel(tpe.value)}</option>
              ))}
            </select>
          </div>

          <div>
            <label className="label">{t('hseEvents.filters.severity') ?? 'Severity'}</label>
            <select className="input" value={severityFilter} onChange={(e) => setSeverityFilter(e.target.value)}>
              {SEVERITIES.map((sev) => (
                <option key={sev.value || 'all'} value={sev.value}>{severityLabel(sev.value)}</option>
              ))}
            </select>
          </div>

          <div>
            <label className="label">{t('hseEvents.filters.year') ?? 'Year'}</label>
            <input className="input" type="number" value={yearFilter} onChange={(e) => setYearFilter(e.target.value)} placeholder={t('hseEvents.placeholders.year') ?? '2026'} />
          </div>

          <div>
            <label className="label">{t('hseEvents.filters.month') ?? 'Month'}</label>
            <input className="input" type="number" min="1" max="12" value={monthFilter} onChange={(e) => setMonthFilter(e.target.value)} placeholder={t('hseEvents.placeholders.month') ?? '1-12'} />
          </div>

          <div>
            <label className="label">{t('hseEvents.filters.from') ?? 'From'}</label>
            <input className="input" type="date" value={fromDate} onChange={(e) => setFromDate(e.target.value)} />
          </div>

          <div>
            <label className="label">{t('hseEvents.filters.to') ?? 'To'}</label>
            <input className="input" type="date" value={toDate} onChange={(e) => setToDate(e.target.value)} />
          </div>
        </div>
      </div>

      <div className="bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-2xl overflow-hidden">
        <div className="px-4 py-3 border-b border-gray-200 dark:border-gray-700 flex items-center justify-between">
          <div className="text-sm font-semibold text-gray-800 dark:text-gray-200">{t('hseEvents.recordsTitle') ?? 'Records'}</div>
          {loading && (
            <div className="text-sm text-gray-500 flex items-center gap-2">
              <Loader2 className="w-4 h-4 animate-spin" />
              {t('common.loading') ?? 'Loading'}
            </div>
          )}
        </div>

        <div className="overflow-x-auto">
          <table className="min-w-full text-sm">
            <thead className="bg-gray-50 dark:bg-gray-900">
              <tr>
                <th className="text-left px-4 py-2">{t('hseEvents.table.date') ?? 'Date'}</th>
                <th className="text-left px-4 py-2">{t('hseEvents.table.project') ?? 'Project'}</th>
                <th className="text-left px-4 py-2">{t('hseEvents.table.type') ?? 'Type'}</th>
                <th className="text-left px-4 py-2">{t('hseEvents.table.severity') ?? 'Severity'}</th>
                <th className="text-left px-4 py-2">{t('hseEvents.table.lostTime') ?? 'Lost time'}</th>
                <th className="text-left px-4 py-2">{t('hseEvents.table.lostDays') ?? 'Lost days'}</th>
                <th className="text-left px-4 py-2">{t('hseEvents.table.location') ?? 'Location'}</th>
                <th className="text-left px-4 py-2">{t('hseEvents.table.description') ?? 'Description'}</th>
                <th className="text-right px-4 py-2">{t('common.actions') ?? 'Actions'}</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-100 dark:divide-gray-700">
              {visibleItems.map((row) => (
                <tr key={row.id} className={row.deleted_at ? 'opacity-60' : ''}>
                  <td className="px-4 py-2">{formatDate(row.event_date)}</td>
                  <td className="px-4 py-2">{row.project?.code ? `${row.project.code} - ${row.project.name}` : (row.project?.name ?? row.project_id)}</td>
                  <td className="px-4 py-2">{typeLabel(row.type)}</td>
                  <td className="px-4 py-2">{row.severity ? severityLabel(row.severity) : (t('common.none') ?? '-')}</td>
                  <td className="px-4 py-2">{row.lost_time ? (t('common.yes') ?? 'Yes') : (t('common.no') ?? 'No')}</td>
                  <td className="px-4 py-2">{row.lost_days ?? 0}</td>
                  <td className="px-4 py-2">{row.location ?? (t('common.none') ?? '-')}</td>
                  <td className="px-4 py-2 max-w-xl">
                    <div className="truncate" title={row.description ?? ''}>
                      {row.description ?? (t('common.none') ?? '-')}
                    </div>
                  </td>
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
              {!loading && visibleItems.length === 0 && (
                <tr>
                  <td colSpan="9" className="px-4 py-10 text-center text-gray-500">{t('hseEvents.noRecords') ?? 'No records'}</td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </div>

      <Modal
        isOpen={showModal}
        onClose={closeModal}
        title={editing ? (t('hseEvents.modal.editTitle') ?? 'Edit HSE Event') : (t('hseEvents.modal.newTitle') ?? 'New HSE Event')}
      >
        <form onSubmit={submit} className="space-y-3">
          <div>
            <label className="label">{t('hseEvents.fields.project') ?? 'Project'}</label>
            <select
              className="input"
              value={formData.project_id}
              onChange={(e) => setFormData((p) => ({ ...p, project_id: e.target.value }))}
              required
            >
              <option value="">{t('hseEvents.fields.selectProject') ?? 'Select...'}</option>
              {sortedProjects.map((p) => (
                <option key={p.id} value={String(p.id)}>
                  {p.code ? `${p.code} - ${p.name}` : p.name}
                </option>
              ))}
            </select>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
            <div>
              <label className="label">{t('hseEvents.fields.date') ?? 'Date'}</label>
              <input type="date" className="input" value={formData.event_date} onChange={(e) => setFormData((p) => ({ ...p, event_date: e.target.value }))} required />
            </div>
            <div>
              <label className="label">{t('hseEvents.fields.type') ?? 'Type'}</label>
              <select className="input" value={formData.type} onChange={(e) => setFormData((p) => ({ ...p, type: e.target.value }))} required>
                {EVENT_TYPES.map((tpe) => (
                  <option key={tpe.value} value={tpe.value}>{typeLabel(tpe.value)}</option>
                ))}
              </select>
            </div>
          </div>

          {formData.type === 'other' && (
            <div>
              <label className="label">{t('hseEvents.fields.specifyType') ?? 'Specify type'}</label>
              <input
                className="input"
                value={formData.type_other}
                onChange={(e) => setFormData((p) => ({ ...p, type_other: e.target.value }))}
                placeholder={t('hseEvents.placeholders.typeOther') ?? 'e.g. property damage'}
                required
              />
            </div>
          )}

          <div>
            <label className="label">{t('hseEvents.fields.description') ?? 'Description'}</label>
            <textarea className="input" value={formData.description} onChange={(e) => setFormData((p) => ({ ...p, description: e.target.value }))} rows="3" />
          </div>

          <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
            <div>
              <label className="label">{t('hseEvents.fields.severity') ?? 'Severity'}</label>
              <select className="input" value={formData.severity} onChange={(e) => setFormData((p) => ({ ...p, severity: e.target.value }))}>
                <option value="">{t('common.select') ?? 'Select'}</option>
                {SEVERITIES.filter((s) => s.value !== '').map((sev) => (
                  <option key={sev.value} value={sev.value}>{severityLabel(sev.value)}</option>
                ))}
              </select>
            </div>
            <div className="flex items-end">
              <label className="flex items-center gap-2 text-sm text-gray-700 dark:text-gray-300">
                <input type="checkbox" checked={!!formData.lost_time} onChange={(e) => setFormData((p) => ({ ...p, lost_time: e.target.checked }))} />
                {t('hseEvents.fields.lostTime') ?? 'Lost time'}
              </label>
            </div>
            <div>
              <label className="label">{t('hseEvents.fields.lostDays') ?? 'Lost days'}</label>
              <input type="number" min="0" className="input" value={formData.lost_days} onChange={(e) => setFormData((p) => ({ ...p, lost_days: e.target.value }))} />
            </div>
          </div>

          {formData.severity === 'other' && (
            <div>
              <label className="label">{t('hseEvents.fields.specifySeverity') ?? 'Specify severity'}</label>
              <input
                className="input"
                value={formData.severity_other}
                onChange={(e) => setFormData((p) => ({ ...p, severity_other: e.target.value }))}
                placeholder={t('hseEvents.placeholders.severityOther') ?? 'e.g. moderate'}
                required
              />
            </div>
          )}

          <div>
            <label className="label">{t('hseEvents.fields.location') ?? 'Location'}</label>
            <input className="input" value={formData.location} onChange={(e) => setFormData((p) => ({ ...p, location: e.target.value }))} />
          </div>

          <div className="flex justify-end gap-2 pt-2">
            <button type="button" className="btn-secondary" onClick={closeModal}>
              {t('common.cancel') ?? 'Cancel'}
            </button>
            <button type="submit" className="btn-primary" disabled={saving}>
              {saving ? <Loader2 className="w-4 h-4 animate-spin" /> : (t('common.save') ?? 'Save')}
            </button>
          </div>
        </form>
      </Modal>

      <ConfirmDialog
        isOpen={!!confirmDelete}
        title={t('hseEvents.archive.title') ?? 'Archive record'}
        message={t('hseEvents.archive.message') ?? 'This will archive (soft-delete) the record. Continue?'}
        confirmLabel={t('common.confirm') ?? 'Confirm'}
        cancelLabel={t('common.cancel') ?? 'Cancel'}
        onConfirm={doArchive}
        onCancel={() => setConfirmDelete(null)}
      />
    </div>
  )
}
