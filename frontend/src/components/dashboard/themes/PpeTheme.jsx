import { memo, useEffect, useMemo, useState } from 'react'
import { useTranslation } from '../../../i18n'
import { dashboardService, ppeService } from '../../../services/api'
import {
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
} from 'recharts'
import toast from 'react-hot-toast'

const COLORS = [
  '#3b82f6',
  '#22c55e',
  '#f59e0b',
  '#ef4444',
  '#8b5cf6',
  '#06b6d4',
  '#ec4899',
  '#14b8a6',
  '#f97316',
  '#84cc16',
  '#0ea5e9',
  '#a855f7',
]

const tooltipPortal = typeof document !== 'undefined' ? document.body : null
const tooltipWrapperStyle = { zIndex: 9999, pointerEvents: 'none' }

const TooltipContent = memo(function TooltipContent({ active, payload, label, t, poleLabelByKey }) {
  if (!active || !payload || payload.length === 0) return null

  const first = payload[0]
  const dataKey = String(first?.dataKey ?? '')
  const poleKey = dataKey.includes('__p_') ? dataKey.split('__p_')[0] : ''
  const poleLabel = poleLabelByKey?.[poleKey] ?? ''
  const title = poleLabel ? `${label} • ${poleLabel}` : label

  const visible = payload.filter((p) => Number(p?.value ?? 0) > 0)

  return (
    <div className="bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-lg p-3 shadow-lg">
      <p className="font-semibold text-gray-900 dark:text-gray-100 text-sm mb-2">{title}</p>
      <div className="space-y-1">
        {visible.map((p) => (
          <div key={p.dataKey} className="flex items-center justify-between gap-3">
            <div className="flex items-center gap-2">
              <span
                className="inline-block w-2.5 h-2.5 rounded"
                style={{ backgroundColor: p.color }}
              />
              <span className="text-xs text-gray-700 dark:text-gray-200">{p.name}</span>
            </div>
            <span className="text-xs font-semibold text-gray-900 dark:text-gray-100">{p.value}</span>
          </div>
        ))}
      </div>
      <p className="mt-2 text-[11px] text-gray-500 dark:text-gray-400">
        {t('ppe.analytics.tooltipHint')}
      </p>
    </div>
  )
})

const PpeTheme = memo(function PpeTheme({ year, projectId, pole }) {
  const t = useTranslation()

  const poleKey = (value) => String(value ?? '').trim().toLowerCase().replace(/[^a-z0-9]+/g, '_') || 'unknown'

  const [loading, setLoading] = useState(true)
  const [items, setItems] = useState([])
  const [selectedItemIds, setSelectedItemIds] = useState([])
  const [duration, setDuration] = useState('year')
  const [month, setMonth] = useState(() => new Date().getMonth() + 1)
  const [week, setWeek] = useState('')
  const [rows, setRows] = useState([])

  useEffect(() => {
    const loadItems = async () => {
      try {
        const res = await ppeService.getItems()
        const list = res.data?.data ?? res.data ?? []
        const normalized = Array.isArray(list) ? list : []
        setItems(normalized)
        setSelectedItemIds(normalized.map((x) => x.id))
      } catch (e) {
        setItems([])
        setSelectedItemIds([])
      }
    }
    loadItems()
  }, [])

  useEffect(() => {
    const load = async () => {
      try {
        setLoading(true)
        const params = {
          year,
          duration,
          item_ids: selectedItemIds,
        }
        if (pole) params.pole = pole
        if (projectId && projectId !== 'all') params.project_id = projectId
        if (duration === 'month') params.month = month
        if (duration === 'week') params.week = week

        const res = await dashboardService.getPpeConsumptionAnalytics(params)
        const dataRows = res.data?.data?.rows ?? []
        setRows(Array.isArray(dataRows) ? dataRows : [])
      } catch (e) {
        toast.error(t('errors.failedToLoad'))
        setRows([])
      } finally {
        setLoading(false)
      }
    }

    // For week duration, require a week
    if (duration === 'week' && (!week || String(week).trim() === '')) {
      setRows([])
      setLoading(false)
      return
    }

    // For no items selected, show empty
    if (!selectedItemIds || selectedItemIds.length === 0) {
      setRows([])
      setLoading(false)
      return
    }

    load()
  }, [year, duration, month, week, selectedItemIds, projectId, pole, t])

  const itemOptions = useMemo(() => {
    return (items ?? []).map((it) => ({ id: it.id, name: it.name }))
  }, [items])

  const selectedItemIdSet = useMemo(() => new Set(selectedItemIds.map((x) => Number(x))), [selectedItemIds])

  const filteredRows = useMemo(() => {
    if (!rows || rows.length === 0) return []
    return rows.filter((r) => selectedItemIdSet.has(Number(r.item_id)))
  }, [rows, selectedItemIdSet])

  const projectsSorted = useMemo(() => {
    const totals = new Map()
    for (const r of filteredRows) {
      const pid = Number(r.project_id)
      const q = Number(r.quantity ?? 0)
      totals.set(pid, (totals.get(pid) ?? 0) + q)
    }

    const list = Array.from(totals.entries()).map(([projectId, total]) => {
      const row = filteredRows.find((x) => Number(x.project_id) === Number(projectId))
      const name = row?.project_code ? `${row.project_code}` : (row?.project_name ?? `#${projectId}`)
      return { projectId, total, name }
    })

    list.sort((a, b) => b.total - a.total)
    return list
  }, [filteredRows])

  const projectColor = useMemo(() => {
    const map = new Map()
    projectsSorted.forEach((p, idx) => {
      map.set(p.projectId, COLORS[idx % COLORS.length])
    })
    return map
  }, [projectsSorted])

  const polesSorted = useMemo(() => {
    const set = new Set()
    for (const r of filteredRows) {
      set.add(String(r.pole ?? ''))
    }
    const list = Array.from(set.values())
    list.sort((a, b) => a.localeCompare(b))
    return list
  }, [filteredRows])

  const poleLabelByKey = useMemo(() => {
    const map = {}
    for (const poleName of polesSorted) {
      map[poleKey(poleName)] = poleName
    }
    return map
  }, [polesSorted])

  const chartData = useMemo(() => {
    // X axis: PPE item
    // For each item, we create multiple stacked bars (one per pole). Each stack is projects.
    const byItem = new Map()

    for (const r of filteredRows) {
      const itemId = Number(r.item_id)
      const itemName = r.item_name
      if (!byItem.has(itemId)) {
        byItem.set(itemId, {
          item_id: itemId,
          label: itemName,
          item_name: itemName,
          byPole: new Map(),
        })
      }

      const entry = byItem.get(itemId)
      const poleName = String(r.pole ?? '')
      if (!entry.byPole.has(poleName)) {
        entry.byPole.set(poleName, new Map())
      }

      const pid = Number(r.project_id)
      const qty = Number(r.quantity ?? 0)
      const poleMap = entry.byPole.get(poleName)
      poleMap.set(pid, (poleMap.get(pid) ?? 0) + qty)
    }

    const items = Array.from(byItem.values())
    items.sort((a, b) => String(a.item_name || '').localeCompare(String(b.item_name || '')))

    return items.map((it) => {
      const obj = {
        label: it.label,
        item_name: it.item_name,
      }

      for (const [poleName, projectMap] of it.byPole.entries()) {
        const pk = poleKey(poleName)
        for (const [pid, qty] of projectMap.entries()) {
          obj[`${pk}__p_${pid}`] = qty
        }
      }

      return obj
    })
  }, [filteredRows])

  const projectSeries = useMemo(() => {
    // We must render one Bar per (pole, project) so that each pole becomes its own stacked column.
    return polesSorted.flatMap((poleName) => {
      const pk = poleKey(poleName)
      return projectsSorted.map((p) => ({
        key: `${pk}__p_${p.projectId}`,
        stackId: pk,
        poleLabel: poleName,
        name: p.name,
        color: projectColor.get(p.projectId) ?? '#3b82f6',
      }))
    })
  }, [polesSorted, projectsSorted, projectColor])

  const toggleAll = (checked) => {
    if (checked) {
      setSelectedItemIds(itemOptions.map((x) => x.id))
    } else {
      setSelectedItemIds([])
    }
  }

  const allSelected = selectedItemIds.length > 0 && selectedItemIds.length === itemOptions.length

  return (
    <div className="space-y-4">
      <div className="card">
        <div className="card-header flex flex-col gap-3 lg:flex-row lg:items-center lg:justify-between">
          <div>
            <h3 className="font-semibold text-gray-900 dark:text-gray-100">{t('ppe.analytics.title')}</h3>
            <p className="text-sm text-gray-500 dark:text-gray-400">{t('ppe.analytics.subtitle')}</p>
          </div>

          <div className="flex flex-wrap items-center gap-2">
            <select
              value={duration}
              onChange={(e) => setDuration(e.target.value)}
              className="bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-md px-2 py-1 text-sm"
            >
              <option value="year">{t('ppe.analytics.duration.year')}</option>
              <option value="month">{t('ppe.analytics.duration.month')}</option>
              <option value="week">{t('ppe.analytics.duration.week')}</option>
            </select>

            {duration === 'month' && (
              <input
                type="number"
                min={1}
                max={12}
                value={month}
                onChange={(e) => setMonth(Number(e.target.value))}
                className="w-20 bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-md px-2 py-1 text-sm"
              />
            )}

            {duration === 'week' && (
              <input
                type="number"
                min={1}
                max={52}
                value={week}
                onChange={(e) => setWeek(e.target.value)}
                placeholder="1-52"
                className="w-20 bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-md px-2 py-1 text-sm"
              />
            )}
          </div>
        </div>

        <div className="p-4 border-t border-gray-100 dark:border-gray-700">
          <div className="flex items-center justify-between mb-2">
            <span className="text-sm font-medium text-gray-700 dark:text-gray-200">{t('ppe.analytics.filters.items')}</span>
            <label className="flex items-center gap-2 text-sm text-gray-600 dark:text-gray-300">
              <input
                type="checkbox"
                checked={allSelected}
                onChange={(e) => toggleAll(e.target.checked)}
              />
              {t('ppe.analytics.filters.selectAll')}
            </label>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-2 max-h-40 overflow-y-auto pr-1">
            {itemOptions.map((it) => {
              const checked = selectedItemIdSet.has(Number(it.id))
              return (
                <label key={it.id} className="flex items-center gap-2 text-sm text-gray-700 dark:text-gray-200">
                  <input
                    type="checkbox"
                    checked={checked}
                    onChange={(e) => {
                      const next = new Set(selectedItemIdSet)
                      if (e.target.checked) next.add(Number(it.id))
                      else next.delete(Number(it.id))
                      setSelectedItemIds(Array.from(next.values()))
                    }}
                  />
                  {it.name}
                </label>
              )
            })}
          </div>
        </div>
      </div>

      <div className="card">
        <div className="card-header">
          <h4 className="font-semibold text-gray-900 dark:text-gray-100">{t('ppe.analytics.chartTitle')}</h4>
        </div>

        <div className="p-4">
          <div className="h-[520px]">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart
                data={chartData}
                margin={{ top: 10, right: 20, left: 10, bottom: 90 }}
                barCategoryGap={18}
              >
                <CartesianGrid strokeDasharray="3 3" />
                <XAxis
                  dataKey="label"
                  interval={0}
                  angle={-45}
                  textAnchor="end"
                  height={90}
                  tick={{ fontSize: 11 }}
                />
                <YAxis
                  tick={{ fontSize: 11 }}
                  width={60}
                  label={{ value: t('ppe.analytics.yAxis'), angle: -90, position: 'insideLeft' }}
                />
                <Tooltip
                  shared={false}
                  allowEscapeViewBox={{ x: true, y: true }}
                  portal={tooltipPortal}
                  wrapperStyle={tooltipWrapperStyle}
                  content={(props) => (
                    <TooltipContent {...props} t={t} poleLabelByKey={poleLabelByKey} />
                  )}
                />

                {projectSeries.map((s) => (
                  <Bar
                    key={s.key}
                    dataKey={s.key}
                    stackId={s.stackId}
                    fill={s.color}
                    name={s.name}
                    isAnimationActive={false}
                  />
                ))}
              </BarChart>
            </ResponsiveContainer>
          </div>

          {!loading && chartData.length === 0 && (
            <div className="text-sm text-gray-500 dark:text-gray-400 mt-2">
              {t('ppe.analytics.noData')}
            </div>
          )}

          {loading && (
            <div className="text-sm text-gray-500 dark:text-gray-400 mt-2">
              {t('common.loading')}
            </div>
          )}
        </div>
      </div>
    </div>
  )
})

export default PpeTheme
