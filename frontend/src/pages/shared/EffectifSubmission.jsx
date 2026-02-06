import { useCallback, useEffect, useMemo, useState } from 'react'
import {
  LineChart,
  Line,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
} from 'recharts'
import toast from 'react-hot-toast'
import DatePicker from '../../components/ui/DatePicker'
import Select from '../../components/ui/Select'
import { useLanguage } from '../../i18n'
import { useProjectStore } from '../../store/projectStore'
import { getProjectLabel, sortProjects } from '../../utils/projectList'
import { dailyEffectifService } from '../../services/api'
import { useAuthStore } from '../../store/authStore'

const tooltipPortal = typeof document !== 'undefined' ? document.body : null
const tooltipWrapperStyle = { zIndex: 9999, pointerEvents: 'none' }

export default function EffectifSubmission() {
  const { t } = useLanguage()

  const formatDate = useCallback((value) => {
    if (!value) return '-'
    const raw = String(value)
    const datePart = raw.split('T')[0]
    const d = new Date(`${datePart}T00:00:00`)
    if (Number.isNaN(d.getTime())) return datePart
    const dd = String(d.getDate()).padStart(2, '0')
    const mm = String(d.getMonth() + 1).padStart(2, '0')
    const yyyy = String(d.getFullYear())
    return `${dd}/${mm}/${yyyy}`
  }, [])

  const { user } = useAuthStore()
  const { fetchProjects } = useProjectStore()

  const [projects, setProjects] = useState([])
  const [loadingProjects, setLoadingProjects] = useState(false)

  const [projectId, setProjectId] = useState('')
  const [entryDate, setEntryDate] = useState(() => {
    const d = new Date()
    const y = d.getFullYear()
    const m = String(d.getMonth() + 1).padStart(2, '0')
    const day = String(d.getDate()).padStart(2, '0')
    return `${y}-${m}-${day}`
  })

  const [effectif, setEffectif] = useState('')
  const [loadingEntry, setLoadingEntry] = useState(false)
  const [saving, setSaving] = useState(false)

  const [historyFromDate, setHistoryFromDate] = useState('')
  const [historyToDate, setHistoryToDate] = useState('')
  const [historyEntries, setHistoryEntries] = useState([])
  const [loadingHistory, setLoadingHistory] = useState(false)

  const projectListPreference = user?.project_list_preference || 'code'

  useEffect(() => {
    let mounted = true
    const load = async () => {
      setLoadingProjects(true)
      try {
        const list = await fetchProjects({}, { force: true })
        if (!mounted) return
        setProjects(Array.isArray(list) ? list : [])
      } catch {
        if (!mounted) return
        setProjects([])
        toast.error(t('effectif.loadProjectsFailed'))
      } finally {
        if (mounted) setLoadingProjects(false)
      }
    }
    load()
    return () => {
      mounted = false
    }
  }, [fetchProjects, t])

  const sortedProjects = useMemo(() => {
    return sortProjects(projects, projectListPreference)
  }, [projects, projectListPreference])

  const selectedProject = useMemo(() => {
    if (!projectId) return null
    return sortedProjects.find((p) => String(p.id) === String(projectId)) ?? null
  }, [sortedProjects, projectId])

  useEffect(() => {
    if (!projectId || !entryDate) {
      setEffectif('')
      return
    }

    let mounted = true
    const loadEntry = async () => {
      setLoadingEntry(true)
      try {
        const res = await dailyEffectifService.entry({ project_id: projectId, entry_date: entryDate })
        if (!mounted) return
        const entry = res.data?.data?.entry
        setEffectif(entry?.effectif != null ? String(entry.effectif) : '')
      } catch {
        if (!mounted) return
        setEffectif('')
      } finally {
        if (mounted) setLoadingEntry(false)
      }
    }

    loadEntry()
    return () => {
      mounted = false
    }
  }, [projectId, entryDate])

  const fetchHistory = useCallback(async () => {
    if (!projectId) {
      setHistoryEntries([])
      return
    }

    setLoadingHistory(true)
    try {
      const params = { project_id: projectId }
      if (historyFromDate) params.from_date = historyFromDate
      if (historyToDate) params.to_date = historyToDate

      const res = await dailyEffectifService.list(params)
      const entries = res.data?.data?.entries ?? []
      setHistoryEntries(Array.isArray(entries) ? entries : [])
    } catch {
      setHistoryEntries([])
      toast.error(t('effectif.loadFailed'))
    } finally {
      setLoadingHistory(false)
    }
  }, [projectId, historyFromDate, historyToDate, t])

  useEffect(() => {
    fetchHistory()
  }, [fetchHistory])

  const handleSave = async () => {
    if (!projectId) {
      toast.error(t('effectif.projectRequired'))
      return
    }
    if (!entryDate) {
      toast.error(t('effectif.dateRequired'))
      return
    }

    const parsed = effectif === '' ? null : Number(effectif)
    if (parsed === null || Number.isNaN(parsed) || parsed < 0) {
      toast.error(t('effectif.effectifInvalid'))
      return
    }

    setSaving(true)
    try {
      await dailyEffectifService.upsert({ project_id: projectId, entry_date: entryDate, effectif: parsed })
      toast.success(t('effectif.saveSuccess'))
      fetchHistory()
    } catch {
      toast.error(t('effectif.saveFailed'))
    } finally {
      setSaving(false)
    }
  }

  const chartData = useMemo(() => {
    const rows = Array.isArray(historyEntries) ? historyEntries : []
    const sorted = [...rows].sort((a, b) => String(a?.entry_date ?? '').localeCompare(String(b?.entry_date ?? '')))
    return sorted.map((r) => ({
      entry_date: String(r?.entry_date ?? ''),
      effectif: Number(r?.effectif ?? 0),
    }))
  }, [historyEntries])

  return (
    <div className="space-y-6 animate-fade-in">
      <div>
        <div className="text-xs text-gray-500 dark:text-gray-400 mb-1">{t('nav.dashboard')} / {t('effectif.title')}</div>
        <h1 className="text-2xl font-bold text-gray-900 dark:text-gray-100">{t('effectif.title')}</h1>
        <p className="text-gray-500 dark:text-gray-400 mt-1">{t('effectif.subtitleHr')}</p>
      </div>

      <div className="card p-4">
        <div className="text-sm font-semibold text-gray-900 dark:text-gray-100">{t('effectif.whySubmitTitle')}</div>
        <div className="text-sm text-gray-600 dark:text-gray-400 mt-1">{t('effectif.whySubmitBody')}</div>
      </div>

      <div className="card p-4">
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          <div>
            <label className="label">{t('effectif.project')}</label>
            <Select value={projectId} onChange={(e) => setProjectId(e.target.value)} disabled={loadingProjects}>
              <option value="">{t('common.select')}</option>
              {sortedProjects.map((p) => (
                <option key={p.id} value={String(p.id)}>
                  {getProjectLabel(p)}
                </option>
              ))}
            </Select>
          </div>

          <div>
            <label className="label">{t('effectif.date')}</label>
            <DatePicker value={entryDate} onChange={(val) => setEntryDate(val)} placeholder={t('effectif.date')} />
          </div>

          <div>
            <label className="label">{t('effectif.effectif')}</label>
            <input
              type="number"
              min="0"
              step="1"
              className="input"
              value={effectif}
              onChange={(e) => setEffectif(e.target.value)}
              disabled={!projectId || !entryDate || loadingEntry}
              placeholder={t('effectif.effectifPlaceholder')}
            />
            {loadingEntry ? <div className="text-xs text-gray-500 dark:text-gray-400 mt-1">{t('common.loading')}</div> : null}
          </div>
        </div>

        <div className="flex justify-end mt-4">
          <button type="button" className="btn-primary" onClick={handleSave} disabled={saving || loadingProjects}>
            {saving ? t('common.saving') : t('common.save')}
          </button>
        </div>
      </div>

      <div className="card p-4">
        <div className="flex flex-col sm:flex-row sm:items-end gap-4">
          <div className="flex-1">
            <div className="text-sm font-semibold text-gray-900 dark:text-gray-100">{t('effectif.subtitleAnalytics')}</div>
            <div className="text-xs text-gray-500 dark:text-gray-400 mt-1">{t('effectif.project')} : {selectedProject ? getProjectLabel(selectedProject) : '-'}</div>
          </div>

          <div className="w-full sm:w-40">
            <label className="label text-xs">{t('effectif.fromDate')}</label>
            <DatePicker value={historyFromDate} onChange={(val) => setHistoryFromDate(val)} placeholder={t('effectif.fromDate')} />
          </div>

          <div className="w-full sm:w-40">
            <label className="label text-xs">{t('effectif.toDate')}</label>
            <DatePicker value={historyToDate} onChange={(val) => setHistoryToDate(val)} placeholder={t('effectif.toDate')} />
          </div>

          <button type="button" className="btn-secondary w-full sm:w-auto" onClick={fetchHistory} disabled={loadingHistory || !projectId}>
            {loadingHistory ? t('common.loading') : t('common.refresh')}
          </button>
        </div>

        <div className="h-64 mt-4">
          {loadingHistory ? (
            <div className="flex items-center justify-center h-full text-gray-500 dark:text-gray-400">{t('common.loading')}</div>
          ) : chartData.length > 0 ? (
            <ResponsiveContainer width="100%" height="100%">
              <LineChart data={chartData}>
                <CartesianGrid strokeDasharray="3 3" className="dark:opacity-20" />
                <XAxis dataKey="entry_date" tick={{ fontSize: 12 }} className="dark:text-gray-400" tickFormatter={formatDate} />
                <YAxis tick={{ fontSize: 12 }} className="dark:text-gray-400" />
                <Tooltip
                  labelFormatter={(v) => formatDate(v)}
                  allowEscapeViewBox={{ x: true, y: true }}
                  portal={tooltipPortal}
                  wrapperStyle={tooltipWrapperStyle}
                />
                <Line type="monotone" dataKey="effectif" stroke="#16a34a" name={t('effectif.effectif')} strokeWidth={2} dot={false} />
              </LineChart>
            </ResponsiveContainer>
          ) : (
            <div className="flex items-center justify-center h-full text-gray-500 dark:text-gray-400">{projectId ? t('common.noData') : t('effectif.projectRequired')}</div>
          )}
        </div>

        <div className="mt-4 overflow-x-auto">
          <table className="table w-full">
            <thead>
              <tr>
                <th>{t('effectif.date')}</th>
                <th>{t('effectif.effectif')}</th>
              </tr>
            </thead>
            <tbody>
              {(Array.isArray(historyEntries) ? historyEntries : []).slice(0, 50).map((e) => (
                <tr key={`${e?.project_id ?? ''}-${String(e?.entry_date ?? '')}`}>
                  <td>{formatDate(e?.entry_date)}</td>
                  <td>{e?.effectif ?? '-'}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  )
}
