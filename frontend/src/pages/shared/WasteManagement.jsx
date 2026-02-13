import { useEffect, useMemo, useState } from 'react'
import { useLanguage } from '../../i18n'
import { useAuthStore } from '../../store/authStore'
import { projectService, wasteExportService } from '../../services/api'
import { DatePicker } from '../../components/ui'
import Modal from '../../components/ui/Modal'
import ConfirmDialog from '../../components/ui/ConfirmDialog'
import { sortProjects } from '../../utils/projectList'
import { Trash2, Plus, Edit2, Loader2 } from 'lucide-react'
import toast from 'react-hot-toast'

const WASTE_TYPES = [
  { key: 'banales', value: 'banales' },
  { key: 'betons', value: 'bétons' },
  { key: 'liquides_sanitaires', value: 'liquides sanitaires' },
  { key: 'melange_banales', value: 'mélange banales' },
  { key: 'ferraile', value: 'ferraile' },
  { key: 'huiles_usees', value: 'huiles usées' },
  { key: 'solides_dangereux', value: 'solides dangereux' },
  { key: 'medicaux', value: 'médicaux' },
  { key: 'autre', value: 'autre' },
]

const TRANSPORT_METHODS = [
  { key: 'benne_satellite', value: 'benne satellite' },
  { key: 'camion_hydrocureur', value: 'camion hydrocureur' },
  { key: 'camion_plateau', value: 'camion plateau' },
  { key: 'camion_8x4', value: 'camion 8x4' },
  { key: 'camion_citerne', value: 'camion citerne' },
  { key: 'camion_ampliroll', value: 'camion ampliroll' },
  { key: 'remorque_a_benne', value: 'remorque à benne' },
  { key: 'autre', value: 'autre' },
]

const TREATMENTS = [
  { key: 'decharge', value: 'décharge' },
  { key: 'incineration', value: 'incinération' },
  { key: 'recyclage', value: 'recyclage' },
  { key: 'pretraitement_incineration', value: 'prétraitement + incinération' },
  { key: 'recyclage_sur_chantier', value: 'recyclage sur chantier' },
  { key: 'traitement_physico_chimique', value: 'traitement physico-chimique' },
  { key: 'regeneration_huiles_usees', value: 'régénération (huiles usées)' },
  { key: 'valorisation', value: 'valorisation (ferraile / mélange)' },
  { key: 'stockage_temporaire', value: 'stockage temporaire (dangereux / médicaux)' },
  { key: 'neutralisation', value: 'neutralisation (dangereux)' },
  { key: 'autre', value: 'autre' },
]

export default function WasteManagement() {
  const { t } = useLanguage()
  const { user } = useAuthStore()

  const [projects, setProjects] = useState([])
  const [items, setItems] = useState([])
  const [meta, setMeta] = useState({ current_page: 1, last_page: 1, per_page: 50, total: 0 })
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)

  const [selectedProjectId, setSelectedProjectId] = useState('')
  const [tabWasteType, setTabWasteType] = useState('')
  const [dateFrom, setDateFrom] = useState('')
  const [dateTo, setDateTo] = useState('')
  const [plateSearch, setPlateSearch] = useState('')
  const [includeArchived, setIncludeArchived] = useState(false)
  const [page, setPage] = useState(1)

  const [showModal, setShowModal] = useState(false)
  const [editing, setEditing] = useState(null)
  const [confirmDelete, setConfirmDelete] = useState(null)

  const projectListPreference = user?.project_list_preference ?? 'code'
  const sortedProjects = useMemo(() => sortProjects(projects, projectListPreference), [projects, projectListPreference])
  const projectLabelById = useMemo(() => {
    const map = new Map()
    ;(projects ?? []).forEach((p) => {
      map.set(String(p.id), p.code ? `${p.code} - ${p.name}` : p.name)
    })
    return map
  }, [projects])

  const getEmptyForm = () => ({
    project_id: '',
    date: new Date().toISOString().split('T')[0],
    waste_type: '',
    waste_type_other: '',
    quantity: '',
    trips_count: '',
    transport_method: '',
    transport_method_other: '',
    plate_number: '',
    treatment: '',
    treatment_other: '',
  })

  const [formData, setFormData] = useState(getEmptyForm())

  useEffect(() => {
    const fetchProjects = async () => {
      try {
        const res = await projectService.getAll({ per_page: 200 })
        const list = res.data?.data ?? []
        setProjects(Array.isArray(list) ? list : [])
      } catch {
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
        per_page: 50,
        page,
      }
      if (selectedProjectId) params.project_id = selectedProjectId
      if (tabWasteType) params.waste_type = tabWasteType
      if (dateFrom) params.date_from = dateFrom
      if (dateTo) params.date_to = dateTo
      if (plateSearch) params.search = plateSearch
      if (includeArchived) params.include_archived = true

      const res = await wasteExportService.getAll(params)
      const payload = res.data
      const rows = Array.isArray(payload?.data) ? payload.data : []
      setItems(rows)
      setMeta(payload?.meta ?? { current_page: 1, last_page: 1, per_page: 50, total: rows.length })
    } catch {
      setItems([])
      setMeta({ current_page: 1, last_page: 1, per_page: 50, total: 0 })
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    fetchItems()
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [selectedProjectId, tabWasteType, dateFrom, dateTo, plateSearch, includeArchived, page])

  useEffect(() => {
    setPage(1)
  }, [selectedProjectId, tabWasteType, dateFrom, dateTo, plateSearch, includeArchived])

  const openCreate = () => {
    setEditing(null)
    setFormData({
      ...getEmptyForm(),
      project_id: selectedProjectId || '',
      waste_type: tabWasteType || '',
    })
    setShowModal(true)
  }

  const openEdit = (row) => {
    setEditing(row)
    setFormData({
      project_id: String(row.project_id ?? ''),
      date: row.date?.substring(0, 10) ?? new Date().toISOString().split('T')[0],
      waste_type: row.waste_type ?? '',
      waste_type_other: row.waste_type_other ?? '',
      quantity: row.quantity ?? '',
      trips_count: row.trips_count ?? '',
      transport_method: row.transport_method ?? '',
      transport_method_other: row.transport_method_other ?? '',
      plate_number: row.plate_number ?? '',
      treatment: row.treatment ?? '',
      treatment_other: row.treatment_other ?? '',
    })
    setShowModal(true)
  }

  const closeModal = () => {
    setShowModal(false)
    setEditing(null)
    setFormData(getEmptyForm())
  }

  const validateForm = () => {
    const errors = []
    if (!formData.project_id) errors.push(t('wasteManagement.validation.projectRequired'))
    if (!formData.date) errors.push(t('wasteManagement.validation.dateRequired'))
    if (!formData.waste_type) errors.push(t('wasteManagement.validation.wasteTypeRequired'))
    if (formData.waste_type === 'autre' && !String(formData.waste_type_other || '').trim()) {
      errors.push(t('wasteManagement.validation.wasteTypeOtherRequired'))
    }
    if (formData.quantity === '' || !Number.isFinite(Number(formData.quantity)) || Number(formData.quantity) <= 0) {
      errors.push(t('wasteManagement.validation.quantityRequired'))
    }
    if (formData.trips_count === '' || !Number.isFinite(Number(formData.trips_count)) || Number(formData.trips_count) < 1) {
      errors.push(t('wasteManagement.validation.tripsCountRequired'))
    }
    if (!formData.transport_method) errors.push(t('wasteManagement.validation.transportMethodRequired'))
    if (formData.transport_method === 'autre' && !String(formData.transport_method_other || '').trim()) {
      errors.push(t('wasteManagement.validation.transportMethodOtherRequired'))
    }
    if (!String(formData.plate_number || '').trim()) errors.push(t('wasteManagement.validation.plateNumberRequired'))
    if (!formData.treatment) errors.push(t('wasteManagement.validation.treatmentRequired'))
    if (formData.treatment === 'autre' && !String(formData.treatment_other || '').trim()) {
      errors.push(t('wasteManagement.validation.treatmentOtherRequired'))
    }
    return errors
  }

  const submit = async (e) => {
    e.preventDefault()
    const errors = validateForm()
    if (errors.length > 0) {
      toast.error(errors[0])
      return
    }

    setSaving(true)
    try {
      const payload = {
        project_id: parseInt(formData.project_id),
        date: formData.date,
        waste_type: formData.waste_type,
        waste_type_other: formData.waste_type === 'autre' ? String(formData.waste_type_other || '').trim() : null,
        quantity: Number(formData.quantity),
        trips_count: parseInt(formData.trips_count),
        transport_method: formData.transport_method,
        transport_method_other: formData.transport_method === 'autre' ? String(formData.transport_method_other || '').trim() : null,
        plate_number: String(formData.plate_number || '').trim(),
        treatment: formData.treatment,
        treatment_other: formData.treatment === 'autre' ? String(formData.treatment_other || '').trim() : null,
      }

      if (editing?.id) {
        await wasteExportService.update(editing.id, payload)
        toast.success(t('wasteManagement.toasts.updated'))
      } else {
        await wasteExportService.create(payload)
        toast.success(t('wasteManagement.toasts.created'))
      }

      closeModal()
      fetchItems()
    } catch (e) {
      toast.error(e.response?.data?.message ?? t('errors.somethingWentWrong'))
    } finally {
      setSaving(false)
    }
  }

  const confirmArchive = (row) => setConfirmDelete(row)

  const doArchive = async () => {
    if (!confirmDelete?.id) return
    setSaving(true)
    try {
      await wasteExportService.delete(confirmDelete.id)
      toast.success(t('wasteManagement.toasts.deleted'))
      setConfirmDelete(null)
      fetchItems()
    } catch (e) {
      toast.error(e.response?.data?.message ?? t('errors.somethingWentWrong'))
    } finally {
      setSaving(false)
    }
  }

  const formatDate = (d) => {
    if (!d) return '-'
    const s = String(d).substring(0, 10)
    const [y, m, day] = s.split('-')
    if (!y || !m || !day) return s
    return `${day}/${m}/${y}`
  }

  const displayProject = (row) => {
    const id = row?.project_id
    if (!id) return '-'
    return projectLabelById.get(String(id)) ?? row?.project?.name ?? row?.project_name ?? '-'
  }

  const displayWasteType = (row) => {
    if (!row?.waste_type) return '-'
    if (row.waste_type === 'autre') {
      return row.waste_type_other ? `${t('wasteManagement.wasteTypes.autre')} (${row.waste_type_other})` : t('wasteManagement.wasteTypes.autre')
    }

    const match = WASTE_TYPES.find((x) => x.value === row.waste_type)
    if (!match) return row.waste_type
    return t(`wasteManagement.wasteTypes.${match.key}`)
  }

  const displayTransportMethod = (row) => {
    if (!row?.transport_method) return '-'
    if (row.transport_method === 'autre') {
      return row.transport_method_other ? `${t('wasteManagement.transportMethods.autre')} (${row.transport_method_other})` : t('wasteManagement.transportMethods.autre')
    }
    const match = TRANSPORT_METHODS.find((x) => x.value === row.transport_method)
    if (!match) return row.transport_method
    return t(`wasteManagement.transportMethods.${match.key}`)
  }

  const displayTreatment = (row) => {
    if (!row?.treatment) return '-'
    if (row.treatment === 'autre') {
      return row.treatment_other ? `${t('wasteManagement.treatments.autre')} (${row.treatment_other})` : t('wasteManagement.treatments.autre')
    }
    const match = TREATMENTS.find((x) => x.value === row.treatment)
    if (!match) return row.treatment
    return t(`wasteManagement.treatments.${match.key}`)
  }

  const tabs = useMemo(() => {
    const all = [{ key: 'all', value: '', label: t('wasteManagement.tabs.all') }]
    return all.concat(WASTE_TYPES.filter((x) => x.key !== 'autre').map((x) => ({
      key: x.key,
      value: x.value,
      label: t(`wasteManagement.wasteTypes.${x.key}`),
    })))
  }, [t])

  return (
    <div className="max-w-7xl mx-auto p-6 space-y-6">
      <div className="flex items-center justify-between gap-3">
        <div className="flex items-center gap-3">
          <div className="p-2 bg-gray-50 rounded-lg">
            <Trash2 className="w-6 h-6 text-gray-700" />
          </div>
          <div>
            <h1 className="text-xl font-bold text-gray-900 dark:text-gray-100">{t('wasteManagement.title')}</h1>
            <p className="text-sm text-gray-500 dark:text-gray-400">{t('wasteManagement.subtitle')}</p>
          </div>
        </div>

        <button onClick={openCreate} className="btn-primary flex items-center gap-2">
          <Plus className="w-4 h-4" />
          {t('wasteManagement.actions.add')}
        </button>
      </div>

      <div className="bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-2xl p-4">
        <div className="grid grid-cols-1 md:grid-cols-6 gap-3">
          <div className="md:col-span-2">
            <label className="label">{t('projects.title')}</label>
            <select className="input" value={selectedProjectId} onChange={(e) => setSelectedProjectId(e.target.value)}>
              <option value="">{t('common.all')}</option>
              {sortedProjects.map((p) => (
                <option key={p.id} value={String(p.id)}>
                  {p.code ? `${p.code} - ${p.name}` : p.name}
                </option>
              ))}
            </select>
          </div>

          <div>
            <label className="label">{t('wasteManagement.filters.dateFrom')}</label>
            <DatePicker value={dateFrom} onChange={setDateFrom} className="w-full" />
          </div>

          <div>
            <label className="label">{t('wasteManagement.filters.dateTo')}</label>
            <DatePicker value={dateTo} onChange={setDateTo} className="w-full" />
          </div>

          <div className="md:col-span-2">
            <label className="label">{t('wasteManagement.filters.plateSearch')}</label>
            <input
              className="input"
              value={plateSearch}
              onChange={(e) => setPlateSearch(e.target.value)}
              placeholder={t('wasteManagement.filters.plateSearchPlaceholder')}
            />
          </div>

          <div className="md:col-span-2 flex items-center gap-2">
            <input
              id="waste-include-archived"
              type="checkbox"
              checked={includeArchived}
              onChange={(e) => setIncludeArchived(e.target.checked)}
            />
            <label htmlFor="waste-include-archived" className="text-sm text-gray-700 dark:text-gray-200">
              {t('wasteManagement.filters.includeArchived')}
            </label>
          </div>
        </div>
      </div>

      <div className="bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-2xl overflow-hidden">
        <div className="px-4 py-3 border-b border-gray-200 dark:border-gray-700 flex items-center justify-between gap-3">
          <div className="flex flex-wrap gap-2">
            {tabs.map((tab) => {
              const active = tabWasteType === tab.value
              return (
                <button
                  key={tab.key}
                  type="button"
                  onClick={() => setTabWasteType(tab.value)}
                  className={active ? 'btn-primary' : 'btn-outline'}
                >
                  {tab.label}
                </button>
              )
            })}
          </div>

          {loading && (
            <div className="text-sm text-gray-500 flex items-center gap-2">
              <Loader2 className="w-4 h-4 animate-spin" />
              <span>{t('common.loading')}</span>
            </div>
          )}
        </div>

        <div className="overflow-x-auto">
          <table className="min-w-full text-sm">
            <thead className="bg-gray-50 dark:bg-gray-900">
              <tr>
                <th className="text-left px-4 py-2">{t('wasteManagement.table.date')}</th>
                <th className="text-left px-4 py-2">{t('wasteManagement.table.project')}</th>
                <th className="text-left px-4 py-2">{t('wasteManagement.table.wasteType')}</th>
                <th className="text-left px-4 py-2">{t('wasteManagement.table.quantity')}</th>
                <th className="text-left px-4 py-2">{t('wasteManagement.table.tripsCount')}</th>
                <th className="text-left px-4 py-2">{t('wasteManagement.table.transportMethod')}</th>
                <th className="text-left px-4 py-2">{t('wasteManagement.table.plateNumber')}</th>
                <th className="text-left px-4 py-2">{t('wasteManagement.table.treatment')}</th>
                <th className="text-right px-4 py-2">{t('common.actions')}</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-100 dark:divide-gray-700">
              {items.map((row) => {
                const canEdit = !!row.can_edit
                const canDelete = !!row.can_delete
                return (
                  <tr key={row.id} className={row.deleted_at ? 'opacity-60' : ''}>
                    <td className="px-4 py-2">{formatDate(row.date)}</td>
                    <td className="px-4 py-2">{displayProject(row)}</td>
                    <td className="px-4 py-2">{displayWasteType(row)}</td>
                    <td className="px-4 py-2">{row.quantity ?? '-'}</td>
                    <td className="px-4 py-2">{row.trips_count ?? '-'}</td>
                    <td className="px-4 py-2">{displayTransportMethod(row)}</td>
                    <td className="px-4 py-2">{row.plate_number ?? '-'}</td>
                    <td className="px-4 py-2">{displayTreatment(row)}</td>
                    <td className="px-4 py-2">
                      <div className="flex justify-end gap-2">
                        {canEdit && (
                          <button className="btn-secondary" onClick={() => openEdit(row)}>
                            <Edit2 className="w-4 h-4" />
                          </button>
                        )}
                        {canDelete && (
                          <button className="btn-secondary" onClick={() => confirmArchive(row)}>
                            <Trash2 className="w-4 h-4" />
                          </button>
                        )}
                      </div>
                    </td>
                  </tr>
                )
              })}

              {!loading && items.length === 0 && (
                <tr>
                  <td colSpan="9" className="px-4 py-10 text-center text-gray-500">
                    {t('wasteManagement.emptyState')}
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>

        <div className="px-4 py-3 border-t border-gray-200 dark:border-gray-700 flex items-center justify-between">
          <div className="text-sm text-gray-600 dark:text-gray-300">
            {t('wasteManagement.pagination.total', { total: meta.total ?? 0 })}
          </div>
          <div className="flex items-center gap-2">
            <button
              type="button"
              className="btn-outline"
              disabled={page <= 1 || loading}
              onClick={() => setPage((p) => Math.max(1, p - 1))}
            >
              {t('wasteManagement.pagination.prev')}
            </button>
            <div className="text-sm text-gray-600 dark:text-gray-300">
              {t('wasteManagement.pagination.pageOf', { page: meta.current_page ?? page, last: meta.last_page ?? 1 })}
            </div>
            <button
              type="button"
              className="btn-outline"
              disabled={(meta.current_page ?? page) >= (meta.last_page ?? 1) || loading}
              onClick={() => setPage((p) => p + 1)}
            >
              {t('wasteManagement.pagination.next')}
            </button>
          </div>
        </div>
      </div>

      <Modal
        isOpen={showModal}
        onClose={closeModal}
        title={editing?.id ? t('wasteManagement.modal.editTitle') : t('wasteManagement.modal.createTitle')}
        size="lg"
      >
        <form onSubmit={submit} className="space-y-4">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div>
              <label className="label">{t('projects.title')}</label>
              <select
                className="input"
                value={formData.project_id}
                onChange={(e) => setFormData((s) => ({ ...s, project_id: e.target.value }))}
              >
                <option value="">{t('common.select')}</option>
                {sortedProjects.map((p) => (
                  <option key={p.id} value={String(p.id)}>
                    {p.code ? `${p.code} - ${p.name}` : p.name}
                  </option>
                ))}
              </select>
            </div>

            <div>
              <label className="label">{t('wasteManagement.form.date')}</label>
              <DatePicker
                value={formData.date}
                onChange={(val) => setFormData((s) => ({ ...s, date: val }))}
                className="w-full"
              />
            </div>

            <div>
              <label className="label">{t('wasteManagement.form.wasteType')}</label>
              <select
                className="input"
                value={formData.waste_type}
                onChange={(e) => setFormData((s) => ({ ...s, waste_type: e.target.value }))}
              >
                <option value="">{t('common.select')}</option>
                {WASTE_TYPES.map((x) => (
                  <option key={x.key} value={x.value}>
                    {t(`wasteManagement.wasteTypes.${x.key}`)}
                  </option>
                ))}
              </select>
            </div>

            {formData.waste_type === 'autre' && (
              <div>
                <label className="label">{t('wasteManagement.form.wasteTypeOther')}</label>
                <input
                  className="input"
                  value={formData.waste_type_other}
                  onChange={(e) => setFormData((s) => ({ ...s, waste_type_other: e.target.value }))}
                />
              </div>
            )}

            <div>
              <label className="label">{t('wasteManagement.form.quantity')}</label>
              <input
                className="input"
                type="number"
                step="0.001"
                min="0"
                value={formData.quantity}
                onChange={(e) => setFormData((s) => ({ ...s, quantity: e.target.value }))}
              />
            </div>

            <div>
              <label className="label">{t('wasteManagement.form.tripsCount')}</label>
              <input
                className="input"
                type="number"
                min="1"
                value={formData.trips_count}
                onChange={(e) => setFormData((s) => ({ ...s, trips_count: e.target.value }))}
              />
            </div>

            <div>
              <label className="label">{t('wasteManagement.form.transportMethod')}</label>
              <select
                className="input"
                value={formData.transport_method}
                onChange={(e) => setFormData((s) => ({ ...s, transport_method: e.target.value }))}
              >
                <option value="">{t('common.select')}</option>
                {TRANSPORT_METHODS.map((x) => (
                  <option key={x.key} value={x.value}>
                    {t(`wasteManagement.transportMethods.${x.key}`)}
                  </option>
                ))}
              </select>
            </div>

            {formData.transport_method === 'autre' && (
              <div>
                <label className="label">{t('wasteManagement.form.transportMethodOther')}</label>
                <input
                  className="input"
                  value={formData.transport_method_other}
                  onChange={(e) => setFormData((s) => ({ ...s, transport_method_other: e.target.value }))}
                />
              </div>
            )}

            <div>
              <label className="label">{t('wasteManagement.form.plateNumber')}</label>
              <input
                className="input"
                value={formData.plate_number}
                onChange={(e) => setFormData((s) => ({ ...s, plate_number: e.target.value }))}
              />
            </div>

            <div>
              <label className="label">{t('wasteManagement.form.treatment')}</label>
              <select
                className="input"
                value={formData.treatment}
                onChange={(e) => setFormData((s) => ({ ...s, treatment: e.target.value }))}
              >
                <option value="">{t('common.select')}</option>
                {TREATMENTS.map((x) => (
                  <option key={x.key} value={x.value}>
                    {t(`wasteManagement.treatments.${x.key}`)}
                  </option>
                ))}
              </select>
            </div>

            {formData.treatment === 'autre' && (
              <div>
                <label className="label">{t('wasteManagement.form.treatmentOther')}</label>
                <input
                  className="input"
                  value={formData.treatment_other}
                  onChange={(e) => setFormData((s) => ({ ...s, treatment_other: e.target.value }))}
                />
              </div>
            )}
          </div>

          <div className="flex justify-end gap-3 pt-4 border-t border-gray-200 dark:border-gray-700">
            <button type="button" className="btn-outline" onClick={closeModal} disabled={saving}>
              {t('common.cancel')}
            </button>
            <button type="submit" className="btn-primary" disabled={saving}>
              {saving ? t('common.saving') : t('common.save')}
            </button>
          </div>
        </form>
      </Modal>

      <ConfirmDialog
        isOpen={!!confirmDelete}
        title={t('wasteManagement.delete.title')}
        message={t('wasteManagement.delete.message')}
        confirmLabel={t('common.delete')}
        cancelLabel={t('common.cancel')}
        onConfirm={doArchive}
        onCancel={() => setConfirmDelete(null)}
      />
    </div>
  )
}
