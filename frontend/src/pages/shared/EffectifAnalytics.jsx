import { useCallback, useEffect, useMemo, useState } from 'react'
import {
  LineChart,
  Line,
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  Legend,
  ResponsiveContainer,
} from 'recharts'
import toast from 'react-hot-toast'
import DatePicker from '../../components/ui/DatePicker'
import Select from '../../components/ui/Select'
import { useLanguage } from '../../i18n'
import { dailyEffectifService, projectService } from '../../services/api'
import { useProjectStore } from '../../store/projectStore'
import { getProjectLabel, sortProjects } from '../../utils/projectList'
import { useAuthStore } from '../../store/authStore'

const tooltipPortal = typeof document !== 'undefined' ? document.body : null
const tooltipWrapperStyle = { zIndex: 9999, pointerEvents: 'none' }

export default function EffectifAnalytics() {
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

  const [poles, setPoles] = useState([])
  const [projects, setProjects] = useState([])
  const [loadingFilters, setLoadingFilters] = useState(false)

  const [pole, setPole] = useState('')
  const [projectId, setProjectId] = useState('')
  const [fromDate, setFromDate] = useState('')
  const [toDate, setToDate] = useState('')

  const [series, setSeries] = useState([])
  const [loadingSeries, setLoadingSeries] = useState(false)

  const [historyEntries, setHistoryEntries] = useState([])
  const [loadingHistory, setLoadingHistory] = useState(false)

  const [byProjectRows, setByProjectRows] = useState([])
  const [loadingByProject, setLoadingByProject] = useState(false)

  const projectListPreference = user?.project_list_preference || 'code'

  useEffect(() => {
    let mounted = true
    const load = async () => {
      setLoadingFilters(true)
      try {
        const [polesRes, projectsRes] = await Promise.all([
          projectService.getPoles(),
          fetchProjects({}, { force: true }),
        ])

        if (!mounted) return

        const polesValues = polesRes.data?.data?.poles || polesRes.data?.poles || []
        setPoles(Array.isArray(polesValues) ? polesValues : [])
        setProjects(Array.isArray(projectsRes) ? projectsRes : [])
      } catch {
        if (!mounted) return
        setPoles([])
        setProjects([])
        toast.error(t('effectif.loadFailed'))
      } finally {
        if (mounted) setLoadingFilters(false)
      }
    }

    load()
    return () => {
      mounted = false
    }
  }, [fetchProjects, t])

  const visibleProjects = useMemo(() => {
    const list = sortProjects(projects, projectListPreference)
    if (!pole) return list
    return list.filter((p) => String(p?.pole ?? '') === pole)
  }, [pole, projects, projectListPreference])

  const fetchSeries = useCallback(async () => {
    setLoadingSeries(true)
    try {
      const params = {}
      if (fromDate) params.from_date = fromDate
      if (toDate) params.to_date = toDate
      if (pole) params.pole = pole
      if (projectId) params.project_id = projectId

      const res = await dailyEffectifService.series(params)
      const rows = res.data?.data?.series || []
      setSeries(Array.isArray(rows) ? rows : [])
    } catch {
      setSeries([])
      toast.error(t('effectif.loadFailed'))
    } finally {
      setLoadingSeries(false)
    }
  }, [fromDate, toDate, pole, projectId, t])

  const fetchHistory = useCallback(async () => {
    setLoadingHistory(true)
    try {
      const params = { limit: 200 }
      if (fromDate) params.from_date = fromDate
      if (toDate) params.to_date = toDate
      if (pole) params.pole = pole
      if (projectId) params.project_id = projectId

      const res = await dailyEffectifService.history(params)
      const rows = res.data?.data?.entries || []
      setHistoryEntries(Array.isArray(rows) ? rows : [])
    } catch {
      setHistoryEntries([])
      toast.error(t('effectif.loadFailed'))
    } finally {
      setLoadingHistory(false)
    }
  }, [fromDate, toDate, pole, projectId, t])

  const fetchByProject = useCallback(async () => {
    setLoadingByProject(true)
    try {
      const params = {}
      if (fromDate) params.from_date = fromDate
      if (toDate) params.to_date = toDate
      if (pole) params.pole = pole
      if (projectId) params.project_id = projectId

      const res = await dailyEffectifService.byProject(params)
      const rows = res.data?.data?.projects || []
      setByProjectRows(Array.isArray(rows) ? rows : [])
    } catch {
      setByProjectRows([])
      toast.error(t('effectif.loadFailed'))
    } finally {
      setLoadingByProject(false)
    }
  }, [fromDate, toDate, pole, projectId, t])

  const handleRefresh = useCallback(() => {
    fetchSeries()
    fetchHistory()
    fetchByProject()
  }, [fetchSeries, fetchHistory, fetchByProject])

  useEffect(() => {
    fetchSeries()
  }, [fetchSeries])

  useEffect(() => {
    fetchHistory()
  }, [fetchHistory])

  useEffect(() => {
    fetchByProject()
  }, [fetchByProject])

  const chartData = useMemo(() => {
    return (Array.isArray(series) ? series : []).map((r) => ({
      entry_date: r.entry_date,
      total_effectif: Number(r.total_effectif ?? 0),
    }))
  }, [series])

  const byProjectChartData = useMemo(() => {
    return (Array.isArray(byProjectRows) ? byProjectRows : []).map((r) => {
      const code = String(r?.project_code ?? '').trim()
      const name = String(r?.project_name ?? '').trim()
      const label = code && name ? `${code} - ${name}` : (code || name || String(r?.project_id ?? ''))
      return {
        project: label,
        total_effectif: Number(r?.total_effectif ?? 0),
      }
    })
  }, [byProjectRows])

  useEffect(() => {
    if (pole && projectId) {
      const stillVisible = visibleProjects.some((p) => String(p.id) === String(projectId))
      if (!stillVisible) setProjectId('')
    }
  }, [pole, projectId, visibleProjects])

  return (
    <div className="space-y-6 animate-fade-in">
      <div>
        <div className="text-xs text-gray-500 dark:text-gray-400 mb-1">{t('nav.dashboard')} / {t('effectif.title')}</div>
        <h1 className="text-2xl font-bold text-gray-900 dark:text-gray-100">{t('effectif.title')}</h1>
        <p className="text-gray-500 dark:text-gray-400 mt-1">{t('effectif.subtitleAnalytics')}</p>
      </div>

      <div className="card p-4">
        <div className="flex flex-col sm:flex-row flex-wrap gap-4">
          <div className="w-full sm:w-44">
            <label className="label text-xs">{t('effectif.pole')}</label>
            <Select
              value={pole}
              onChange={(e) => {
                setPole(e.target.value)
                setProjectId('')
              }}
              disabled={loadingFilters}
            >
              <option value="">{t('common.allPoles')}</option>
              {poles.map((p) => (
                <option key={p} value={p}>
                  {p}
                </option>
              ))}
            </Select>
          </div>

          <div className="w-full sm:flex-1 sm:min-w-[180px]">
            <label className="label text-xs">{t('effectif.project')}</label>
            <Select value={projectId} onChange={(e) => setProjectId(e.target.value)} disabled={loadingFilters}>
              <option value="">{t('common.allProjects')}</option>
              {visibleProjects.map((p) => (
                <option key={p.id} value={String(p.id)}>
                  {getProjectLabel(p)}
                </option>
              ))}
            </Select>
          </div>

          <div className="w-full sm:w-40">
            <label className="label text-xs">{t('effectif.fromDate')}</label>
            <DatePicker value={fromDate} onChange={(val) => setFromDate(val)} placeholder={t('effectif.fromDate')} />
          </div>

          <div className="w-full sm:w-40">
            <label className="label text-xs">{t('effectif.toDate')}</label>
            <DatePicker value={toDate} onChange={(val) => setToDate(val)} placeholder={t('effectif.toDate')} />
          </div>

          <div className="w-full sm:w-auto sm:self-end">
            <button
              type="button"
              className="btn-primary"
              onClick={handleRefresh}
              disabled={loadingSeries || loadingHistory || loadingByProject}
            >
              {loadingSeries || loadingHistory || loadingByProject ? t('common.loading') : t('common.refresh')}
            </button>
          </div>
        </div>
      </div>

      <div className="card p-4">
        <div className="h-80">
          {loadingSeries ? (
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
                <Line type="monotone" dataKey="total_effectif" stroke="#16a34a" name={t('effectif.effectif')} strokeWidth={2} dot={false} />
              </LineChart>
            </ResponsiveContainer>
          ) : (
            <div className="flex items-center justify-center h-full text-gray-500 dark:text-gray-400">{t('common.noData')}</div>
          )}
        </div>
      </div>

      <div className="card p-4">
        <div className="text-sm font-semibold text-gray-900 dark:text-gray-100">{t('effectif.effectif')} {t('common.by')} {t('effectif.project')}</div>
        <div className="h-80 mt-3">
          {loadingByProject ? (
            <div className="flex items-center justify-center h-full text-gray-500 dark:text-gray-400">{t('common.loading')}</div>
          ) : byProjectChartData.length > 0 ? (
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={byProjectChartData}>
                <CartesianGrid strokeDasharray="3 3" className="dark:opacity-20" />
                <XAxis dataKey="project" tick={{ fontSize: 11 }} interval={0} angle={-15} textAnchor="end" height={60} />
                <YAxis tick={{ fontSize: 12 }} />
                <Tooltip
                  allowEscapeViewBox={{ x: true, y: true }}
                  portal={tooltipPortal}
                  wrapperStyle={tooltipWrapperStyle}
                />
                <Legend />
                <Bar dataKey="total_effectif" fill="#16a34a" name={t('effectif.effectif')} />
              </BarChart>
            </ResponsiveContainer>
          ) : (
            <div className="flex items-center justify-center h-full text-gray-500 dark:text-gray-400">{t('common.noData')}</div>
          )}
        </div>
      </div>

      <div className="card p-4">
        <div className="text-sm font-semibold text-gray-900 dark:text-gray-100">{t('common.history') ?? 'History'}</div>
        <div className="mt-3 overflow-x-auto">
          <table className="table w-full">
            <thead>
              <tr>
                <th>{t('effectif.date')}</th>
                <th>{t('effectif.project')}</th>
                <th>{t('effectif.effectif')}</th>
              </tr>
            </thead>
            <tbody>
              {loadingHistory ? (
                <tr>
                  <td colSpan={3} className="text-center text-gray-500 dark:text-gray-400">{t('common.loading')}</td>
                </tr>
              ) : (Array.isArray(historyEntries) ? historyEntries : []).length === 0 ? (
                <tr>
                  <td colSpan={3} className="text-center text-gray-500 dark:text-gray-400">{t('common.noData')}</td>
                </tr>
              ) : (
                (Array.isArray(historyEntries) ? historyEntries : []).slice(0, 200).map((e) => (
                  <tr key={`${e?.project_id ?? ''}-${String(e?.entry_date ?? '')}`}>
                    <td>{formatDate(e?.entry_date)}</td>
                    <td>{e?.project?.code ? `${e.project.code} - ${e.project?.name ?? ''}` : (e?.project?.name ?? e?.project_id ?? '-') }</td>
                    <td>{e?.effectif ?? '-'}</td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  )
}
