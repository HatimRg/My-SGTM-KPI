import { useEffect, useMemo, useState } from 'react'
import { useLanguage } from '../../i18n'
import { useAuthStore } from '../../store/authStore'
import { projectService, monthlyKpiMeasurementService } from '../../services/api'
import Modal from '../../components/ui/Modal'
import ConfirmDialog from '../../components/ui/ConfirmDialog'
import YearPicker from '../../components/ui/YearPicker'
import MonthPicker from '../../components/ui/MonthPicker'
import { sortProjects } from '../../utils/projectList'
import { FileText, Plus, Edit2, Trash2, Loader2, Volume2, Droplets, Zap } from 'lucide-react'
import toast from 'react-hot-toast'

const INDICATORS = [
  {
    value: 'noise_monitoring',
    unit: 'dB',
    icon: Volume2,
    activeClass: 'ring-2 ring-blue-500',
    iconClass: 'text-blue-500',
    bgClass: 'bg-blue-50 dark:bg-blue-900/30',
  },
  {
    value: 'water_consumption',
    unit: 'm³',
    icon: Droplets,
    activeClass: 'ring-2 ring-cyan-500',
    iconClass: 'text-cyan-600',
    bgClass: 'bg-cyan-50 dark:bg-cyan-900/30',
  },
  {
    value: 'electricity_consumption',
    unit: 'kWh',
    icon: Zap,
    activeClass: 'ring-2 ring-amber-500',
    iconClass: 'text-amber-600',
    bgClass: 'bg-amber-50 dark:bg-amber-900/30',
  },
]

export default function MonthlyMeasurements() {
  const { t } = useLanguage()
  const { user } = useAuthStore()

  const pad2 = (n) => String(n).padStart(2, '0')
  const toMonthKey = (year, month) => {
    const y = String(year ?? '').trim()
    const m = String(month ?? '').trim()
    if (!y || !m) return ''
    return `${y}-${pad2(m)}`
  }
  const parseMonthKey = (key) => {
    const raw = String(key ?? '').trim()
    const m = raw.match(/^(\d{4})-(\d{2})$/)
    if (!m) return null
    const year = m[1]
    const month = String(Number(m[2]))
    return { year, month }
  }

  const [projects, setProjects] = useState([])
  const [items, setItems] = useState([])
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)

  const [selectedProjectId, setSelectedProjectId] = useState('')
  const [yearFilter, setYearFilter] = useState(String(new Date().getFullYear()))
  const [monthFilter, setMonthFilter] = useState(String(new Date().getMonth() + 1))

  const [activeIndicator, setActiveIndicator] = useState('noise_monitoring')

  const [showModal, setShowModal] = useState(false)
  const [editing, setEditing] = useState(null)
  const [confirmDelete, setConfirmDelete] = useState(null)

  const projectListPreference = user?.project_list_preference ?? 'code'
  const sortedProjects = useMemo(() => sortProjects(projects, projectListPreference), [projects, projectListPreference])

  const getEmptyForm = () => ({
    project_id: '',
    year: String(new Date().getFullYear()),
    month: String(new Date().getMonth() + 1),
    indicator: 'noise_monitoring',
    value: '',
    method: '',
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

      const res = await monthlyKpiMeasurementService.getAll(params)
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
      year: yearFilter || String(new Date().getFullYear()),
      month: monthFilter || String(new Date().getMonth() + 1),
      indicator: activeIndicator,
    })
    setShowModal(true)
  }

  const openEdit = (row) => {
    setEditing(row)
    if (row?.indicator) {
      setActiveIndicator(row.indicator)
    }
    setFormData({
      project_id: String(row.project_id ?? ''),
      year: String(row.year ?? ''),
      month: String(row.month ?? ''),
      indicator: row.indicator ?? 'noise_monitoring',
      value: row.value ?? '',
      method: row.method ?? '',
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
        year: parseInt(formData.year),
        month: parseInt(formData.month),
        indicator: formData.indicator,
        value: Number(formData.value),
        method: formData.method || null,
      }

      if (editing?.id) {
        await monthlyKpiMeasurementService.update(editing.id, {
          value: payload.value,
          method: payload.method,
        })
      } else {
        await monthlyKpiMeasurementService.upsert(payload)
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
      await monthlyKpiMeasurementService.delete(confirmDelete.id)
      toast.success(t('common.saved') ?? 'Saved')
      setConfirmDelete(null)
      fetchItems()
    } catch (e) {
      toast.error(t('common.error') ?? 'Error')
    } finally {
      setSaving(false)
    }
  }

  const indicatorLabel = (val) => {
    const known = INDICATORS.some((i) => i.value === val)
    if (!known) return val
    return t(`monthlyMeasurements.indicators.${val}`) ?? val
  }
  const indicatorUnit = (val) => INDICATORS.find((i) => i.value === val)?.unit ?? ''
  const activeIndicatorMeta = INDICATORS.find((i) => i.value === activeIndicator) ?? INDICATORS[0]
  const visibleItems = items.filter((row) => row.indicator === activeIndicator)

  return (
    <div className="max-w-7xl mx-auto p-6 space-y-6">
      <div className="flex items-center justify-between gap-3">
        <div className="flex items-center gap-3">
          <div className="w-12 h-12 bg-blue-50 dark:bg-blue-900/30 rounded-xl flex items-center justify-center">
            <FileText className="w-6 h-6 text-blue-500" />
          </div>
          <div>
            <h1 className="text-xl font-bold text-gray-900 dark:text-gray-100">{t('monthlyMeasurements.pageTitle') ?? 'Monthly Measurements'}</h1>
            <p className="text-sm text-gray-500 dark:text-gray-400">{t('monthlyMeasurements.pageSubtitle') ?? 'Monthly-only environmental measurements (separated by indicator)'}</p>
          </div>
        </div>

        <button onClick={openCreate} className="btn-primary flex items-center gap-2">
          <Plus className="w-4 h-4" />
          {t('common.new') ?? 'New'}
        </button>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
        {INDICATORS.map((ind) => {
          const Icon = ind.icon
          const isActive = activeIndicator === ind.value
          return (
            <button
              key={ind.value}
              type="button"
              onClick={() => setActiveIndicator(ind.value)}
              className={`text-left border border-gray-200 dark:border-gray-700 rounded-2xl p-4 bg-white dark:bg-gray-800 transition ${isActive ? ind.activeClass : 'hover:bg-gray-50 dark:hover:bg-gray-700/30'}`}
            >
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-3">
                  <div className={`w-10 h-10 rounded-xl flex items-center justify-center ${ind.bgClass}`}>
                    <Icon className={`w-5 h-5 ${ind.iconClass}`} />
                  </div>
                  <div>
                    <div className="text-sm font-semibold text-gray-900 dark:text-gray-100">{indicatorLabel(ind.value)}</div>
                    <div className="text-xs text-gray-500 dark:text-gray-400">{t('monthlyMeasurements.unit') ?? 'Unit'}: {ind.unit}</div>
                  </div>
                </div>
                <div className="text-xs text-gray-500 dark:text-gray-400">{isActive ? (t('monthlyMeasurements.selected') ?? 'Selected') : (t('monthlyMeasurements.select') ?? 'Select')}</div>
              </div>
            </button>
          )
        })}
      </div>

      <div className="bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-2xl p-4">
        <div className="grid grid-cols-1 md:grid-cols-4 gap-3">
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
            <label className="label">{t('monthlyMeasurements.filters.year') ?? 'Year'}</label>
            <YearPicker value={yearFilter} onChange={(y) => setYearFilter(String(y ?? ''))} className="w-full" />
          </div>

          <div>
            <label className="label">{t('monthlyMeasurements.filters.month') ?? 'Month'}</label>
            <MonthPicker
              value={toMonthKey(yearFilter, monthFilter)}
              defaultYear={yearFilter}
              onChange={(key) => {
                const parsed = parseMonthKey(key)
                if (!parsed) return
                setYearFilter(parsed.year)
                setMonthFilter(parsed.month)
              }}
              className="w-full"
            />
          </div>
        </div>
      </div>

      <div className="bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-2xl overflow-hidden">
        <div className="px-4 py-3 border-b border-gray-200 dark:border-gray-700 flex items-center justify-between">
          <div className="text-sm font-semibold text-gray-800 dark:text-gray-200">
            {t('monthlyMeasurements.recordsTitle', { indicator: indicatorLabel(activeIndicatorMeta.value) }) ?? `Records: ${indicatorLabel(activeIndicatorMeta.value)}`}
          </div>
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
                <th className="text-left px-4 py-2">{t('monthlyMeasurements.table.project') ?? 'Project'}</th>
                <th className="text-left px-4 py-2">{t('monthlyMeasurements.table.year') ?? 'Year'}</th>
                <th className="text-left px-4 py-2">{t('monthlyMeasurements.table.month') ?? 'Month'}</th>
                <th className="text-left px-4 py-2">{t('monthlyMeasurements.table.indicator') ?? 'Indicator'}</th>
                <th className="text-left px-4 py-2">{t('monthlyMeasurements.table.value') ?? 'Value'}</th>
                <th className="text-left px-4 py-2">{t('monthlyMeasurements.table.unit') ?? 'Unit'}</th>
                <th className="text-left px-4 py-2">{t('monthlyMeasurements.table.method') ?? 'Method'}</th>
                <th className="text-right px-4 py-2">{t('common.actions') ?? 'Actions'}</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-100 dark:divide-gray-700">
              {visibleItems.map((row) => (
                <tr key={row.id} className={row.deleted_at ? 'opacity-60' : ''}>
                  <td className="px-4 py-2">{row.project?.code ? `${row.project.code} - ${row.project.name}` : (row.project?.name ?? row.project_id)}</td>
                  <td className="px-4 py-2">{row.year}</td>
                  <td className="px-4 py-2">{row.month}</td>
                  <td className="px-4 py-2">{indicatorLabel(row.indicator)}</td>
                  <td className="px-4 py-2">{row.value}</td>
                  <td className="px-4 py-2">{indicatorUnit(row.indicator)}</td>
                  <td className="px-4 py-2">{row.method ?? '-'}</td>
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
                  <td colSpan="8" className="px-4 py-10 text-center text-gray-500">{t('monthlyMeasurements.noRecords') ?? 'No records'}</td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </div>

      <Modal
        isOpen={showModal}
        onClose={closeModal}
        title={editing ? (t('monthlyMeasurements.modal.editTitle') ?? 'Edit monthly measurement') : (t('monthlyMeasurements.modal.newTitle') ?? 'New monthly measurement')}
      >
        <form onSubmit={submit} className="space-y-3">
          <div>
            <label className="label">{t('monthlyMeasurements.fields.project') ?? 'Project'}</label>
            <select className="input" value={formData.project_id} onChange={(e) => setFormData((p) => ({ ...p, project_id: e.target.value }))} required>
              <option value="">{t('monthlyMeasurements.fields.selectProject') ?? 'Select...'}</option>
              {sortedProjects.map((p) => (
                <option key={p.id} value={String(p.id)}>
                  {p.code ? `${p.code} - ${p.name}` : p.name}
                </option>
              ))}
            </select>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
            <div>
              <label className="label">{t('monthlyMeasurements.fields.year') ?? 'Year'}</label>
              <YearPicker
                value={formData.year}
                onChange={(y) => setFormData((p) => ({ ...p, year: String(y ?? '') }))}
                className="w-full"
                required
                disabled={!!editing}
              />
            </div>
            <div>
              <label className="label">{t('monthlyMeasurements.fields.month') ?? 'Month'}</label>
              <MonthPicker
                value={toMonthKey(formData.year, formData.month)}
                defaultYear={formData.year}
                onChange={(key) => {
                  const parsed = parseMonthKey(key)
                  if (!parsed) return
                  setFormData((p) => ({ ...p, year: parsed.year, month: parsed.month }))
                }}
                className="w-full"
                required
                disabled={!!editing}
              />
            </div>
            <div>
              <label className="label">{t('monthlyMeasurements.fields.indicator') ?? 'Indicator'}</label>
              <select
                className="input"
                value={formData.indicator}
                onChange={(e) => setFormData((p) => ({ ...p, indicator: e.target.value }))}
                required
                disabled={!!editing}
              >
                {INDICATORS.map((i) => (
                  <option key={i.value} value={i.value}>{indicatorLabel(i.value)}</option>
                ))}
              </select>
            </div>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
            <div>
              <label className="label">{t('monthlyMeasurements.fields.valueWithUnit', { unit: indicatorUnit(formData.indicator) }) ?? `Value (${indicatorUnit(formData.indicator)})`}</label>
              <input type="number" step="0.01" className="input" value={formData.value} onChange={(e) => setFormData((p) => ({ ...p, value: e.target.value }))} required />
            </div>
            <div>
              <label className="label">{t('monthlyMeasurements.fields.method') ?? 'Method'}</label>
              <input className="input" value={formData.method} onChange={(e) => setFormData((p) => ({ ...p, method: e.target.value }))} />
            </div>
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
        title={t('monthlyMeasurements.archive.title') ?? 'Archive record'}
        message={t('monthlyMeasurements.archive.message') ?? 'This will archive (soft-delete) the record. Continue?'}
        confirmLabel={t('common.confirm') ?? 'Confirm'}
        cancelLabel={t('common.cancel') ?? 'Cancel'}
        onConfirm={doArchive}
        onCancel={() => setConfirmDelete(null)}
      />
    </div>
  )
}
