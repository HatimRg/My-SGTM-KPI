import { memo, useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { useTranslation } from '../../../i18n'
import { dashboardService } from '../../../services/api'
import toast from 'react-hot-toast'
import {
  BarChart,
  Bar,
  LineChart,
  Line,
  XAxis,
  YAxis,
  CartesianGrid,
  ResponsiveContainer,
  ComposedChart,
  Customized,
} from 'recharts'
import JSZip from 'jszip'
import { Download, Loader2 } from 'lucide-react'
import { Tooltip } from 'recharts'

const SGTM_COLORS = {
  orange: '#F2A93B',
  white: '#FFFFFF',
  gray: '#8C8C8C',
  darkGray: '#5A5A5A',
  deepOrange: '#C97A00',
  statusGood: '#4CAF50',
  statusBad: '#D9534F',
}

const CHART_THEME = {
  grid: '#3A3A3A',
  axis: '#B5B5B5',
  label: '#FFFFFF',
  tooltipBg: '#1F1F1F',
}

const safeNumber = (v) => {
  const n = Number(v ?? 0)
  return Number.isFinite(n) ? n : 0
}

const payloadValue = (payload, key) => {
  const arr = Array.isArray(payload) ? payload : []
  const found = arr.find((x) => x?.dataKey === key)
  return found?.value
}

const fmtInt = (v) => String(Math.round(safeNumber(v)))
const fmt2 = (v) => safeNumber(v).toFixed(2)
const fmtPct2 = (v) => `${safeNumber(v).toFixed(2)}%`

const makeBottomLegend = (items, { textColor = CHART_THEME.label } = {}) => {
  const normalized = Array.isArray(items) ? items : []

  return ({ width, height }) => {
    const safeWidth = safeNumber(width)
    const safeHeight = safeNumber(height)

    const iconW = 18
    const iconH = 10
    const gap = 18
    const y = Math.max(8, safeHeight - 22)

    const estimatedItemWidth = (label) => iconW + 8 + Math.min(220, Math.max(40, String(label || '').length * 7))
    const totalWidth = normalized.reduce((acc, item) => acc + estimatedItemWidth(item?.label) + gap, 0)
    const startX = Math.max(8, (safeWidth - totalWidth) / 2)

    let cursorX = startX

    return (
      <g transform={`translate(0, 0)`}>
        {normalized.map((item, idx) => {
          const color = String(item?.color || '#111827')
          const label = String(item?.label || '')
          const type = String(item?.type || 'box')
          const w = estimatedItemWidth(label)
          const x = cursorX
          cursorX += w + gap

          return (
            <g key={`${type}-${idx}`} transform={`translate(${x}, ${y})`}>
              {type === 'line' ? (
                <g>
                  <line x1="0" y1={iconH / 2} x2={iconW} y2={iconH / 2} stroke={color} strokeWidth={2} />
                  <circle cx={iconW / 2} cy={iconH / 2} r={2.5} fill={color} />
                </g>
              ) : (
                <rect x="0" y="0" width={iconW} height={iconH} rx="2" fill={color} />
              )}
              <text x={iconW + 8} y={iconH - 1} fontSize="12" fill={textColor}>
                {label}
              </text>
            </g>
          )
        })}
      </g>
    )
  }
}

const svgToPngBlob = async (svgElement, { scale = 5, background = '#ffffff', maxCanvasSize = 8192, title } = {}) => {
  const serializer = new XMLSerializer()

  const svgForExport = svgElement.cloneNode(true)
  if (String(background).toLowerCase() === '#ffffff') {
    const darkStroke = '#2E2E2E'
    svgForExport
      .querySelectorAll(
        [
          'path[stroke="#FFFFFF"]',
          'path[stroke="#ffffff"]',
          'circle[stroke="#FFFFFF"]',
          'circle[stroke="#ffffff"]',
          'circle[fill="#FFFFFF"]',
          'circle[fill="#ffffff"]',
          'text[fill="#FFFFFF"]',
          'text[fill="#ffffff"]',
          'tspan[fill="#FFFFFF"]',
          'tspan[fill="#ffffff"]',
        ].join(',')
      )
      .forEach((el) => {
        const stroke = el.getAttribute('stroke')
        const fill = el.getAttribute('fill')
        if (stroke && stroke.toLowerCase() === '#ffffff') el.setAttribute('stroke', darkStroke)
        if (fill && fill.toLowerCase() === '#ffffff') el.setAttribute('fill', darkStroke)
      })
  }

  const raw = serializer.serializeToString(svgForExport)

  const svg = raw.includes('xmlns=')
    ? raw
    : raw.replace('<svg', '<svg xmlns="http://www.w3.org/2000/svg"')

  const encoded = `data:image/svg+xml;charset=utf-8,${encodeURIComponent(svg)}`

  const img = new Image()
  img.decoding = 'async'
  img.crossOrigin = 'anonymous'

  const width = svgElement.clientWidth || svgElement.getBoundingClientRect().width || 1200
  const height = svgElement.clientHeight || svgElement.getBoundingClientRect().height || 600

  const dpr = window.devicePixelRatio || 1
  let pixelScale = Math.max(1, safeNumber(scale) * dpr)

  const maxDim = Math.max(512, safeNumber(maxCanvasSize))
  const largest = Math.max(width * pixelScale, height * pixelScale)
  if (largest > maxDim) {
    pixelScale = pixelScale * (maxDim / largest)
  }

  await new Promise((resolve, reject) => {
    img.onload = resolve
    img.onerror = reject
    img.src = encoded
  })

  const titleText = String(title || '').trim()
  const headerHeightCssPx = titleText ? 40 : 0
  const headerHeight = Math.round(headerHeightCssPx * pixelScale)

  const canvas = document.createElement('canvas')
  canvas.width = Math.round(width * pixelScale)
  canvas.height = Math.round(height * pixelScale) + headerHeight

  const ctx = canvas.getContext('2d')
  if (!ctx) {
    throw new Error('Canvas not supported')
  }

  ctx.fillStyle = background
  ctx.fillRect(0, 0, canvas.width, canvas.height)

  if (titleText) {
    ctx.save()
    ctx.scale(pixelScale, pixelScale)
    ctx.fillStyle = '#1F1F1F'
    ctx.font = '700 16px system-ui, -apple-system, Segoe UI, Roboto, Arial'
    ctx.textBaseline = 'middle'
    ctx.fillText(titleText, 12, headerHeightCssPx / 2)
    ctx.strokeStyle = '#F2A93B'
    ctx.globalAlpha = 0.9
    ctx.lineWidth = 2
    ctx.beginPath()
    ctx.moveTo(12, headerHeightCssPx - 4)
    ctx.lineTo(Math.max(12, (width - 12)), headerHeightCssPx - 4)
    ctx.stroke()
    ctx.restore()
  }

  ctx.setTransform(pixelScale, 0, 0, pixelScale, 0, headerHeight)
  ctx.imageSmoothingEnabled = true
  ctx.imageSmoothingQuality = 'high'
  ctx.drawImage(img, 0, 0, width, height)

  return new Promise((resolve) => {
    canvas.toBlob((blob) => resolve(blob), 'image/png', 1)
  })
}

const htmlToPngBlob = async (html, { width = 1200, height = 800, scale = 2, background = '#ffffff', maxCanvasSize = 8192, title } = {}) => {
  const htmlString = String(html || '')
  const safeWidth = Math.max(300, Math.round(safeNumber(width)))
  const safeHeight = Math.max(300, Math.round(safeNumber(height)))

  const svg = `
<svg xmlns="http://www.w3.org/2000/svg" width="${safeWidth}" height="${safeHeight}">
  <foreignObject x="0" y="0" width="100%" height="100%">
    <div xmlns="http://www.w3.org/1999/xhtml">${htmlString}</div>
  </foreignObject>
</svg>`.trim()

  const encoded = `data:image/svg+xml;charset=utf-8,${encodeURIComponent(svg)}`

  const img = new Image()
  img.decoding = 'async'
  img.crossOrigin = 'anonymous'

  await new Promise((resolve, reject) => {
    img.onload = resolve
    img.onerror = reject
    img.src = encoded
  })

  const titleText = String(title || '').trim()
  const headerHeightCssPx = titleText ? 40 : 0
  const dpr = window.devicePixelRatio || 1
  let pixelScale = Math.max(1, safeNumber(scale) * dpr)

  const maxDim = Math.max(512, safeNumber(maxCanvasSize))
  const largest = Math.max(safeWidth * pixelScale, (safeHeight + headerHeightCssPx) * pixelScale)
  if (largest > maxDim) {
    pixelScale = pixelScale * (maxDim / largest)
  }

  const headerHeight = Math.round(headerHeightCssPx * pixelScale)

  const canvas = document.createElement('canvas')
  canvas.width = Math.round(safeWidth * pixelScale)
  canvas.height = Math.round(safeHeight * pixelScale) + headerHeight

  const ctx = canvas.getContext('2d')
  if (!ctx) {
    throw new Error('Canvas not supported')
  }

  ctx.fillStyle = background
  ctx.fillRect(0, 0, canvas.width, canvas.height)

  if (titleText) {
    ctx.save()
    ctx.scale(pixelScale, pixelScale)
    ctx.fillStyle = '#1F1F1F'
    ctx.font = '700 16px system-ui, -apple-system, Segoe UI, Roboto, Arial'
    ctx.textBaseline = 'middle'
    ctx.fillText(titleText, 12, headerHeightCssPx / 2)
    ctx.strokeStyle = '#F2A93B'
    ctx.globalAlpha = 0.9
    ctx.lineWidth = 2
    ctx.beginPath()
    ctx.moveTo(12, headerHeightCssPx - 4)
    ctx.lineTo(Math.max(12, (safeWidth - 12)), headerHeightCssPx - 4)
    ctx.stroke()
    ctx.restore()
  }

  ctx.setTransform(pixelScale, 0, 0, pixelScale, 0, headerHeight)
  ctx.imageSmoothingEnabled = true
  ctx.imageSmoothingQuality = 'high'
  ctx.drawImage(img, 0, 0, safeWidth, safeHeight)

  return new Promise((resolve) => {
    canvas.toBlob((blob) => resolve(blob), 'image/png', 1)
  })
}

const downloadBlob = (blob, filename) => {
  const url = window.URL.createObjectURL(blob)
  const a = document.createElement('a')
  a.href = url
  a.download = filename
  a.click()
  window.URL.revokeObjectURL(url)
}

const MonthlyReportTheme = memo(function MonthlyReportTheme({ user, focusPole }) {
  const t = useTranslation()
  const [isDarkMode, setIsDarkMode] = useState(() =>
    typeof document !== 'undefined' ? document.documentElement.classList.contains('dark') : false
  )
  const [isPrinting, setIsPrinting] = useState(false)
  useEffect(() => {
    if (typeof document === 'undefined') return
    const el = document.documentElement
    const update = () => setIsDarkMode(el.classList.contains('dark'))
    update()

    const obs = new MutationObserver(update)
    obs.observe(el, { attributes: true, attributeFilter: ['class'] })
    return () => obs.disconnect()
  }, [])

  useEffect(() => {
    if (typeof window === 'undefined') return

    const before = () => setIsPrinting(true)
    const after = () => setIsPrinting(false)

    window.addEventListener('beforeprint', before)
    window.addEventListener('afterprint', after)

    return () => {
      window.removeEventListener('beforeprint', before)
      window.removeEventListener('afterprint', after)
    }
  }, [])

  const trendStroke = isDarkMode ? SGTM_COLORS.white : '#2E2E2E'
  const [month, setMonth] = useState(() => {
    const now = new Date()
    const m = String(now.getMonth() + 1).padStart(2, '0')
    return `${now.getFullYear()}-${m}`
  })
  const [projectId, setProjectId] = useState('')
  const [loading, setLoading] = useState(false)
  const [exporting, setExporting] = useState(false)
  const [payload, setPayload] = useState(null)

  const chartRefs = useRef({})

  const isAdmin = String(user?.role || '') === 'admin'

  const fetchSummary = useCallback(async () => {
    if (!isAdmin) return
    setLoading(true)
    try {
      const params = { month }
      if (String(projectId || '').trim() !== '') params.project_id = projectId
      const res = await dashboardService.getMonthlyReportSummary(params)
      setPayload(res.data?.data ?? null)
    } catch (e) {
      setPayload(null)
      toast.error(t('dashboard.monthlyReport.loadFailed') || t('errors.failedToLoad'))
    } finally {
      setLoading(false)
    }
  }, [isAdmin, month, projectId, t])

  useEffect(() => {
    fetchSummary()
  }, [fetchSummary])

  const labels = payload?.labels ?? []
  const sections = payload?.sections ?? {}

  const normalizedFocusPole = String(focusPole || '').trim()
  const filteredPoles = useMemo(() => {
    if (normalizedFocusPole === '') return labels
    return labels.filter((p) => String(p) === normalizedFocusPole)
  }, [labels, normalizedFocusPole])

  const showSinglePole = filteredPoles.length <= 1
  const xAxisAngle = showSinglePole ? 0 : -20
  const xAxisHeight = showSinglePole ? 30 : 60
  const xAxisTextAnchor = showSinglePole ? 'middle' : 'end'

  const legendTextColor = isPrinting ? '#111827' : (isDarkMode ? CHART_THEME.label : '#111827')
  const projectOptions = useMemo(() => {
    const list = Array.isArray(payload?.projects) ? payload.projects : []
    return list
      .slice()
      .sort((a, b) => String(a?.name || '').localeCompare(String(b?.name || '')))
  }, [payload?.projects])

  const veilleRows = useMemo(() => {
    const dsSst = sections?.veille?.datasets?.[0]
    const dsEnv = sections?.veille?.datasets?.[1]
    const valuesSst = Array.isArray(dsSst?.data) ? dsSst.data : []
    const valuesEnv = Array.isArray(dsEnv?.data) ? dsEnv.data : []
    return filteredPoles.map((pole) => {
      const idx = labels.indexOf(pole)
      return {
        pole,
        score_sst: safeNumber(valuesSst[idx]),
        score_environment: safeNumber(valuesEnv[idx]),
      }
    })
  }, [filteredPoles, labels, sections?.veille])

  const sorRows = useMemo(() => {
    const d0 = sections?.sor?.datasets?.[0]
    const d1 = sections?.sor?.datasets?.[1]
    const totals = Array.isArray(d0?.data) ? d0.data : []
    const closure = Array.isArray(d1?.data) ? d1.data : []
    return filteredPoles.map((pole) => {
      const idx = labels.indexOf(pole)
      return { pole, total: safeNumber(totals[idx]), closurePct: safeNumber(closure[idx]) }
    })
  }, [filteredPoles, labels, sections?.sor])

  const sorSubRows = useMemo(() => {
    const d0 = sections?.sor_subcontractors?.datasets?.[0]
    const d1 = sections?.sor_subcontractors?.datasets?.[1]
    const totals = Array.isArray(d0?.data) ? d0.data : []
    const closure = Array.isArray(d1?.data) ? d1.data : []
    return filteredPoles.map((pole) => {
      const idx = labels.indexOf(pole)
      return { pole, total: safeNumber(totals[idx]), closurePct: safeNumber(closure[idx]) }
    })
  }, [filteredPoles, labels, sections?.sor_subcontractors])

  const durationRows = useMemo(() => {
    const ds = sections?.closure_duration?.datasets?.[0]
    const values = Array.isArray(ds?.data) ? ds.data : []
    return filteredPoles.map((pole) => {
      const idx = labels.indexOf(pole)
      return { pole, avgHours: safeNumber(values[idx]) }
    })
  }, [filteredPoles, labels, sections?.closure_duration])

  const durationSubRows = useMemo(() => {
    const ds = sections?.closure_duration_subcontractors?.datasets?.[0]
    const values = Array.isArray(ds?.data) ? ds.data : []
    return filteredPoles.map((pole) => {
      const idx = labels.indexOf(pole)
      return { pole, avgHours: safeNumber(values[idx]) }
    })
  }, [filteredPoles, labels, sections?.closure_duration_subcontractors])

  const trainingsRows = useMemo(() => {
    const d0 = sections?.trainings?.datasets?.[0]
    const d1 = sections?.trainings?.datasets?.[1]
    const counts = Array.isArray(d0?.data) ? d0.data : []
    const hours = Array.isArray(d1?.data) ? d1.data : []
    return filteredPoles.map((pole) => {
      const idx = labels.indexOf(pole)
      return { pole, count: safeNumber(counts[idx]), hours: safeNumber(hours[idx]) }
    })
  }, [filteredPoles, labels, sections?.trainings])

  const awarenessRows = useMemo(() => {
    const d0 = sections?.awareness?.datasets?.[0]
    const d1 = sections?.awareness?.datasets?.[1]
    const counts = Array.isArray(d0?.data) ? d0.data : []
    const hours = Array.isArray(d1?.data) ? d1.data : []
    return filteredPoles.map((pole) => {
      const idx = labels.indexOf(pole)
      return { pole, count: safeNumber(counts[idx]), hours: safeNumber(hours[idx]) }
    })
  }, [filteredPoles, labels, sections?.awareness])

  const medicalRows = useMemo(() => {
    const ds = sections?.medical?.datasets?.[0]
    const values = Array.isArray(ds?.data) ? ds.data : []
    return filteredPoles.map((pole) => {
      const idx = labels.indexOf(pole)
      return { pole, pct: safeNumber(values[idx]) }
    })
  }, [filteredPoles, labels, sections?.medical])

  const tooltipDark = {
    contentStyle: { backgroundColor: CHART_THEME.tooltipBg, border: `1px solid ${CHART_THEME.grid}`, borderRadius: 10, maxWidth: 400 },
    labelStyle: { color: CHART_THEME.label, fontWeight: 700 },
    itemStyle: { color: CHART_THEME.label },
    allowEscapeViewBox: { x: true, y: true },
    wrapperStyle: { zIndex: 9999, pointerEvents: 'none' },
  }

  const axisCommon = {
    tick: { fontSize: 11, fill: CHART_THEME.axis },
    axisLine: { stroke: CHART_THEME.axis, opacity: 0.7 },
    tickLine: { stroke: CHART_THEME.axis, opacity: 0.5 },
  }

  const gridStyle = { stroke: CHART_THEME.grid, opacity: 0.65 }

  const renderPoleProjectTooltip = (pole, items, valueGetter, { maxRows = 12 } = {}) => {
    const list = Array.isArray(items) ? items : []
    const rows = list
      .slice()
      .sort((a, b) => safeNumber(valueGetter(b)) - safeNumber(valueGetter(a)))
      .slice(0, maxRows)

    return (
      <div className="space-y-2">
        <div className="text-xs font-semibold text-slate-200">{t('dashboard.monthlyReport.pole')}: {pole}</div>
        {rows.length === 0 ? (
          <div className="text-xs text-slate-300">{t('common.noData')}</div>
        ) : (
          <div className="max-h-56 overflow-auto pr-1">
            {rows.map((r) => (
              <div key={String(r.project_id)} className="grid grid-cols-[1fr_auto] items-center gap-3 text-xs text-slate-200">
                <div className="min-w-0 truncate">{r.project_name} ({r.project_code})</div>
                <div className="text-right font-semibold tabular-nums">{safeNumber(valueGetter(r))}</div>
              </div>
            ))}
          </div>
        )}
      </div>
    )
  }

  const sectionTitle = useCallback((key) => {
    const label = t(`dashboard.monthlyReport.sections.${key}`)
    return label
  }, [t])

  const handleExportZip = useCallback(async () => {
    if (!payload) {
      toast.error(t('dashboard.monthlyReport.noDataToExport') || t('common.noData'))
      return
    }

    const refs = chartRefs.current || {}
    const entries = [...Object.entries(refs), ['F_subcontractor_documents', null]]

    if (entries.length === 0) {
      toast.error(t('dashboard.monthlyReport.noChartsFound') || t('common.noData'))
      return
    }

    setExporting(true)
    try {
      const zip = new JSZip()
      const folder = zip.folder(`monthly_report_${month}`)

      const exportTitleByKey = {
        A_veille_reglementaire: sectionTitle('veille'),
        B_deviations_closure: sectionTitle('sor'),
        C_closure_duration: sectionTitle('closure_duration'),
        D_trainings: sectionTitle('trainings'),
        E_awareness_sessions: sectionTitle('awareness'),
        F_subcontractor_documents: sectionTitle('subcontractors'),
        G_medical_conformity: sectionTitle('medical'),
        H_deviations_closure_subcontractors: sectionTitle('sor_subcontractors'),
        I_closure_duration_subcontractors: sectionTitle('closure_duration_subcontractors'),
      }

      for (const [key, el] of entries) {
        if (!el && key !== 'F_subcontractor_documents') continue

        let blob = null
        const title = exportTitleByKey[key] || key

        if (key === 'F_subcontractor_documents') {
          const rows = (filteredPoles || []).flatMap((pole) => {
            const list = sections?.subcontractors?.by_pole?.[pole]
            const items = Array.isArray(list) ? list : []
            if (items.length === 0) {
              return [
                {
                  pole,
                  contractor: '',
                  project: '',
                  uploaded: '',
                  completion: t('common.noData'),
                },
              ]
            }

            return items.map((r) => ({
              pole,
              contractor: String(r?.contractor_name || ''),
              project: String(r?.project_name || ''),
              uploaded: `${fmtInt(r?.uploaded_docs_count)}/${fmtInt(r?.required_docs_count)}`,
              completion: `${safeNumber(r?.completion_pct).toFixed(1)}%`,
            }))
          })

          const rowHeight = 28
          const headerHeight = 70
          const safeRows = Math.max(1, rows.length)
          const exportHeight = Math.min(2400, headerHeight + safeRows * rowHeight + 40)
          const exportWidth = 1200

          const escapeHtml = (s) => String(s)
            .replaceAll('&', '&amp;')
            .replaceAll('<', '&lt;')
            .replaceAll('>', '&gt;')
            .replaceAll('"', '&quot;')
            .replaceAll("'", '&#39;')

          const html = `
            <div style="font-family: system-ui, -apple-system, Segoe UI, Roboto, Arial; color: #111827; background: #ffffff; padding: 16px;">
              <div style="font-size: 12px; color: #6B7280; margin-bottom: 10px;">${escapeHtml(t('dashboard.monthlyReport.subcontractorHelp'))}</div>
              <table style="width: 100%; border-collapse: collapse; font-size: 12px;">
                <thead>
                  <tr>
                    <th style="text-align: left; padding: 8px 10px; border-bottom: 2px solid #E5E7EB;">${escapeHtml(t('dashboard.monthlyReport.pole'))}</th>
                    <th style="text-align: left; padding: 8px 10px; border-bottom: 2px solid #E5E7EB;">${escapeHtml(t('dashboard.monthlyReport.contractor'))}</th>
                    <th style="text-align: left; padding: 8px 10px; border-bottom: 2px solid #E5E7EB;">${escapeHtml(t('dashboard.monthlyReport.project'))}</th>
                    <th style="text-align: left; padding: 8px 10px; border-bottom: 2px solid #E5E7EB;">${escapeHtml(t('dashboard.monthlyReport.uploadedDocs'))}</th>
                    <th style="text-align: left; padding: 8px 10px; border-bottom: 2px solid #E5E7EB;">${escapeHtml(t('dashboard.monthlyReport.completion'))}</th>
                  </tr>
                </thead>
                <tbody>
                  ${rows.map((r, idx) => `
                    <tr>
                      <td style="padding: 7px 10px; border-bottom: 1px solid #F3F4F6; font-weight: ${idx === 0 || rows[idx - 1]?.pole !== r.pole ? '600' : '400'};">${escapeHtml(r.pole)}</td>
                      <td style="padding: 7px 10px; border-bottom: 1px solid #F3F4F6;">${escapeHtml(r.contractor)}</td>
                      <td style="padding: 7px 10px; border-bottom: 1px solid #F3F4F6;">${escapeHtml(r.project)}</td>
                      <td style="padding: 7px 10px; border-bottom: 1px solid #F3F4F6; font-variant-numeric: tabular-nums;">${escapeHtml(r.uploaded)}</td>
                      <td style="padding: 7px 10px; border-bottom: 1px solid #F3F4F6; font-variant-numeric: tabular-nums; font-weight: 700;">${escapeHtml(r.completion)}</td>
                    </tr>
                  `).join('')}
                </tbody>
              </table>
            </div>
          `

          blob = await htmlToPngBlob(html, {
            width: exportWidth,
            height: exportHeight,
            scale: 2,
            background: '#ffffff',
            maxCanvasSize: 8192,
            title,
          })
        } else {
          const svg = el?.querySelector('svg')
          if (!svg) continue

          blob = await svgToPngBlob(svg, {
            scale: 5,
            background: '#ffffff',
            maxCanvasSize: 8192,
            title,
          })
        }
        if (!blob) continue

        const filename = `${key}.png`
        folder.file(filename, blob)
      }

      const zipBlob = await zip.generateAsync({ type: 'blob', compression: 'DEFLATE' })
      downloadBlob(zipBlob, `monthly_report_${month}_charts.zip`)
      toast.success(t('dashboard.monthlyReport.exportSuccess') || t('common.exportSuccess'))
    } catch (e) {
      toast.error(t('dashboard.monthlyReport.exportFailed') || t('common.exportFailed'))
    } finally {
      setExporting(false)
    }
  }, [filteredPoles, month, payload, sectionTitle, sections, t])

  if (!isAdmin) {
    return (
      <div className="card">
        <div className="card-body">
          <div className="text-sm text-gray-600 dark:text-gray-300">{t('dashboard.monthlyReport.adminOnly')}</div>
        </div>
      </div>
    )
  }

  return (
    <div className="space-y-6 animate-fade-in">
      <div className="card">
        <div className="card-body">
          <div className="flex flex-col gap-3">
            <div className="min-w-0">
              <div className="text-sm font-semibold text-gray-900 dark:text-gray-100">{t('dashboard.monthlyReport.title')}</div>
              <div className="text-xs text-gray-500 dark:text-gray-400">{t('dashboard.monthlyReport.subtitle')}</div>
            </div>

            <div className="flex flex-wrap gap-3 items-end">
              <div className="flex flex-col gap-1 min-w-[180px] flex-1 sm:flex-none">
                <label className="text-xs font-medium text-gray-600 dark:text-gray-300">{t('dashboard.monthlyReport.month')}</label>
                <input
                  type="month"
                  value={month}
                  onChange={(e) => setMonth(e.target.value)}
                  className="w-full sm:w-auto px-3 py-2 rounded-lg border border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-900 text-gray-900 dark:text-gray-100 text-sm"
                />
              </div>

              <div className="flex flex-col gap-1 min-w-[200px] flex-[2] sm:flex-none">
                <label className="text-xs font-medium text-gray-600 dark:text-gray-300">{t('dashboard.monthlyReport.filterProject')}</label>
                <select
                  value={projectId}
                  onChange={(e) => setProjectId(e.target.value)}
                  className="w-full sm:w-[260px] max-w-full px-3 py-2 rounded-lg border border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-900 text-gray-900 dark:text-gray-100 text-sm"
                >
                  <option value="">{t('common.allProjects')}</option>
                  {projectOptions.map((p) => (
                    <option key={String(p.id)} value={String(p.id)}>
                      {p.name} ({p.code})
                    </option>
                  ))}
                </select>
              </div>

              <button
                onClick={handleExportZip}
                disabled={exporting || loading}
                className="inline-flex items-center justify-center gap-2 px-3 py-2 rounded-lg border border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-900 text-gray-700 dark:text-gray-200 hover:bg-gray-50 dark:hover:bg-gray-800 text-sm font-medium whitespace-nowrap"
              >
                {exporting ? <Loader2 className="w-4 h-4 animate-spin" /> : <Download className="w-4 h-4" />}
                {t('dashboard.monthlyReport.exportZip')}
              </button>
            </div>
          </div>
        </div>
      </div>

      {loading && (
        <div className="card">
          <div className="card-body">
            <div className="flex items-center gap-2 text-sm text-gray-600 dark:text-gray-300">
              <Loader2 className="w-4 h-4 animate-spin" />
              {t('common.loading')}
            </div>
          </div>
        </div>
      )}

      {!loading && (!payload || labels.length === 0) && (
        <div className="card">
          <div className="card-body">
            <div className="text-sm text-gray-600 dark:text-gray-300">{t('common.noData')}</div>
          </div>
        </div>
      )}

      {!loading && payload && filteredPoles.length > 0 && (
        <div className={`grid grid-cols-1 ${normalizedFocusPole ? '' : 'lg:grid-cols-2'} gap-6`}>
          <div className="card overflow-visible" ref={(el) => { chartRefs.current['A_veille_reglementaire'] = el }}>
            <div className="card-header">
              <h3 className="font-semibold text-gray-900 dark:text-gray-100">{sectionTitle('veille')}</h3>
            </div>
            <div className="card-body">
              <div className="h-72">
                <ResponsiveContainer width="100%" height="100%">
                  <BarChart data={veilleRows} margin={{ top: 10, right: 18, left: 8, bottom: 70 }}>
                    <CartesianGrid strokeDasharray="3 3" stroke={gridStyle.stroke} opacity={gridStyle.opacity} />
                    <XAxis dataKey="pole" angle={xAxisAngle} textAnchor={xAxisTextAnchor} height={xAxisHeight} {...axisCommon} />
                    <YAxis domain={[0, 100]} {...axisCommon} />
                    <Tooltip
                      {...tooltipDark}
                      content={({ active, payload: p, label }) => {
                        if (!active || !p || p.length === 0) return null
                        const pole = String(label || '')
                        const list = sections?.veille?.by_pole_projects?.[pole]
                        return (
                          <div style={tooltipDark.contentStyle}>
                            <div style={tooltipDark.labelStyle}>{t('dashboard.monthlyReport.veilleTooltipTitle')} - {pole}</div>
                            <div className="text-xs text-slate-200 mt-1">SST: {fmtPct2(payloadValue(p, 'score_sst'))}</div>
                            <div className="text-xs text-slate-200">ENV: {fmtPct2(payloadValue(p, 'score_environment'))}</div>
                            <div className="text-[11px] text-slate-300 mt-2">SST</div>
                            <div className="mt-2">{renderPoleProjectTooltip(pole, list, (r) => r?.score_sst)}</div>
                            <div className="text-[11px] text-slate-300 mt-2">ENV</div>
                            <div className="mt-2">{renderPoleProjectTooltip(pole, list, (r) => r?.score_environment)}</div>
                          </div>
                        )
                      }}
                    />
                    <Bar dataKey="score_sst" name="Veille SST %" fill={SGTM_COLORS.orange} radius={[6, 6, 0, 0]} />
                    <Bar dataKey="score_environment" name="Veille Environnement %" fill={SGTM_COLORS.darkGray} radius={[6, 6, 0, 0]} />
                    <Customized
                      component={makeBottomLegend(
                        [
                          { type: 'box', color: SGTM_COLORS.orange, label: 'Veille SST %' },
                          { type: 'box', color: SGTM_COLORS.darkGray, label: 'Veille Environnement %' },
                        ],
                        { textColor: legendTextColor }
                      )}
                    />
                  </BarChart>
                </ResponsiveContainer>
              </div>
            </div>
          </div>

          <div className="card overflow-visible" ref={(el) => { chartRefs.current['B_deviations_closure'] = el }}>
            <div className="card-header">
              <h3 className="font-semibold text-gray-900 dark:text-gray-100">{sectionTitle('sor')}</h3>
            </div>
            <div className="card-body">
              <div className="h-72">
                <ResponsiveContainer width="100%" height="100%">
                  <ComposedChart data={sorRows} margin={{ top: 10, right: 22, left: 8, bottom: 70 }}>
                    <CartesianGrid strokeDasharray="3 3" stroke={gridStyle.stroke} opacity={gridStyle.opacity} />
                    <XAxis dataKey="pole" angle={xAxisAngle} textAnchor={xAxisTextAnchor} height={xAxisHeight} {...axisCommon} />
                    <YAxis yAxisId="left" allowDecimals={false} {...axisCommon} />
                    <YAxis yAxisId="right" orientation="right" domain={[0, 100]} {...axisCommon} />
                    <Tooltip
                      {...tooltipDark}
                      content={({ active, payload: p, label }) => {
                        if (!active || !p || p.length === 0) return null
                        const pole = String(label || '')
                        const list = sections?.sor?.by_pole_projects?.[pole]
                        const total = payloadValue(p, 'total')
                        const closure = payloadValue(p, 'closurePct')
                        return (
                          <div style={tooltipDark.contentStyle}>
                            <div style={tooltipDark.labelStyle}>{t('dashboard.monthlyReport.deviationTooltipTitle')} - {pole}</div>
                            <div className="text-xs text-slate-200 mt-1">{t('dashboard.monthlyReport.totalDeviations')}: {fmtInt(total)}</div>
                            <div className="text-xs text-slate-200">{t('dashboard.monthlyReport.closureRate')}: {fmtPct2(closure)}</div>
                            <div className="mt-2">{renderPoleProjectTooltip(pole, list, (r) => r?.total)}</div>
                          </div>
                        )
                      }}
                    />
                    <Bar yAxisId="left" dataKey="total" name={t('dashboard.monthlyReport.totalDeviations')} fill={SGTM_COLORS.orange} radius={[6, 6, 0, 0]} />
                    <Line yAxisId="right" type="monotone" dataKey="closurePct" name={t('dashboard.monthlyReport.closureRate')} stroke={trendStroke} strokeWidth={2} dot={{ r: 3, fill: trendStroke }} />
                    <Customized
                      component={makeBottomLegend(
                        [
                          { type: 'box', color: SGTM_COLORS.orange, label: t('dashboard.monthlyReport.totalDeviations') },
                          { type: 'line', color: trendStroke, label: t('dashboard.monthlyReport.closureRate') },
                        ],
                        { textColor: legendTextColor }
                      )}
                    />
                  </ComposedChart>
                </ResponsiveContainer>
              </div>
            </div>
          </div>

          <div className="card overflow-visible" ref={(el) => { chartRefs.current['C_closure_duration'] = el }}>
            <div className="card-header">
              <h3 className="font-semibold text-gray-900 dark:text-gray-100">{sectionTitle('closure_duration')}</h3>
            </div>
            <div className="card-body">
              <div className="h-72">
                <ResponsiveContainer width="100%" height="100%">
                  <BarChart data={durationRows} margin={{ top: 10, right: 18, left: 8, bottom: 70 }}>
                    <CartesianGrid strokeDasharray="3 3" stroke={gridStyle.stroke} opacity={gridStyle.opacity} />
                    <XAxis dataKey="pole" angle={xAxisAngle} textAnchor={xAxisTextAnchor} height={xAxisHeight} {...axisCommon} />
                    <YAxis {...axisCommon} />
                    <Tooltip
                      {...tooltipDark}
                      formatter={(value) => [`${safeNumber(value).toFixed(2)} ${t('common.hourShort')}`, t('dashboard.monthlyReport.avgHours')]}
                    />
                    <Bar dataKey="avgHours" name={t('dashboard.monthlyReport.avgHours')} fill={SGTM_COLORS.orange} radius={[6, 6, 0, 0]} />
                    <Customized
                      component={makeBottomLegend(
                        [{ type: 'box', color: SGTM_COLORS.orange, label: t('dashboard.monthlyReport.avgHours') }],
                        { textColor: legendTextColor }
                      )}
                    />
                  </BarChart>
                </ResponsiveContainer>
              </div>
            </div>
          </div>

          <div className="card overflow-visible" ref={(el) => { chartRefs.current['D_trainings'] = el }}>
            <div className="card-header">
              <h3 className="font-semibold text-gray-900 dark:text-gray-100">{sectionTitle('trainings')}</h3>
            </div>
            <div className="card-body">
              <div className="h-72">
                <ResponsiveContainer width="100%" height="100%">
                  <ComposedChart data={trainingsRows} margin={{ top: 10, right: 22, left: 8, bottom: 70 }}>
                    <CartesianGrid strokeDasharray="3 3" stroke={gridStyle.stroke} opacity={gridStyle.opacity} />
                    <XAxis dataKey="pole" angle={xAxisAngle} textAnchor={xAxisTextAnchor} height={xAxisHeight} {...axisCommon} />
                    <YAxis yAxisId="left" allowDecimals={false} {...axisCommon} />
                    <YAxis yAxisId="right" orientation="right" {...axisCommon} />
                    <Tooltip
                      {...tooltipDark}
                      content={({ active, payload: p, label }) => {
                        if (!active || !p || p.length === 0) return null
                        const pole = String(label || '')
                        const list = sections?.trainings?.by_pole_projects?.[pole]
                        const count = payloadValue(p, 'count')
                        const hours = payloadValue(p, 'hours')
                        return (
                          <div style={tooltipDark.contentStyle}>
                            <div style={tooltipDark.labelStyle}>{t('dashboard.monthlyReport.trainingsTooltipTitle')} - {pole}</div>
                            <div className="text-xs text-slate-200 mt-1">{t('dashboard.monthlyReport.trainingsCount')}: {fmtInt(count)}</div>
                            <div className="text-xs text-slate-200">{t('dashboard.monthlyReport.hours')}: {fmt2(hours)}</div>
                            <div className="mt-2">{renderPoleProjectTooltip(pole, list, (r) => r?.count)}</div>
                            <div className="mt-2">{renderPoleProjectTooltip(pole, list, (r) => r?.hours)}</div>
                          </div>
                        )
                      }}
                    />
                    <Bar yAxisId="left" dataKey="count" name={t('dashboard.monthlyReport.trainingsCount')} fill={SGTM_COLORS.orange} radius={[6, 6, 0, 0]} />
                    <Line yAxisId="right" type="monotone" dataKey="hours" name={t('dashboard.monthlyReport.hours')} stroke={trendStroke} strokeWidth={2} dot={{ r: 3, fill: trendStroke }} />
                    <Customized
                      component={makeBottomLegend(
                        [
                          { type: 'box', color: SGTM_COLORS.orange, label: t('dashboard.monthlyReport.trainingsCount') },
                          { type: 'line', color: trendStroke, label: t('dashboard.monthlyReport.hours') },
                        ],
                        { textColor: legendTextColor }
                      )}
                    />
                  </ComposedChart>
                </ResponsiveContainer>
              </div>
            </div>
          </div>

          <div className="card overflow-visible" ref={(el) => { chartRefs.current['E_awareness_sessions'] = el }}>
            <div className="card-header">
              <h3 className="font-semibold text-gray-900 dark:text-gray-100">{sectionTitle('awareness')}</h3>
            </div>
            <div className="card-body">
              <div className="h-72">
                <ResponsiveContainer width="100%" height="100%">
                  <ComposedChart data={awarenessRows} margin={{ top: 10, right: 22, left: 8, bottom: 70 }}>
                    <CartesianGrid strokeDasharray="3 3" stroke={gridStyle.stroke} opacity={gridStyle.opacity} />
                    <XAxis dataKey="pole" angle={xAxisAngle} textAnchor={xAxisTextAnchor} height={xAxisHeight} {...axisCommon} />
                    <YAxis yAxisId="left" allowDecimals={false} {...axisCommon} />
                    <YAxis yAxisId="right" orientation="right" {...axisCommon} />
                    <Tooltip
                      {...tooltipDark}
                      content={({ active, payload: p, label }) => {
                        if (!active || !p || p.length === 0) return null
                        const pole = String(label || '')
                        const list = sections?.awareness?.by_pole_projects?.[pole]
                        const count = payloadValue(p, 'count')
                        const hours = payloadValue(p, 'hours')
                        return (
                          <div style={tooltipDark.contentStyle}>
                            <div style={tooltipDark.labelStyle}>{t('dashboard.monthlyReport.awarenessTooltipTitle')} - {pole}</div>
                            <div className="text-xs text-slate-200 mt-1">{t('dashboard.monthlyReport.sessionsCount')}: {fmtInt(count)}</div>
                            <div className="text-xs text-slate-200">{t('dashboard.monthlyReport.hours')}: {fmt2(hours)}</div>
                            <div className="mt-2">{renderPoleProjectTooltip(pole, list, (r) => r?.count)}</div>
                            <div className="mt-2">{renderPoleProjectTooltip(pole, list, (r) => r?.hours)}</div>
                          </div>
                        )
                      }}
                    />
                    <Bar yAxisId="left" dataKey="count" name={t('dashboard.monthlyReport.sessionsCount')} fill={SGTM_COLORS.orange} radius={[6, 6, 0, 0]} />
                    <Line yAxisId="right" type="monotone" dataKey="hours" name={t('dashboard.monthlyReport.hours')} stroke={trendStroke} strokeWidth={2} dot={{ r: 3, fill: trendStroke }} />
                    <Customized
                      component={makeBottomLegend(
                        [
                          { type: 'box', color: SGTM_COLORS.orange, label: t('dashboard.monthlyReport.sessionsCount') },
                          { type: 'line', color: trendStroke, label: t('dashboard.monthlyReport.hours') },
                        ],
                        { textColor: legendTextColor }
                      )}
                    />
                  </ComposedChart>
                </ResponsiveContainer>
              </div>
            </div>
          </div>

          <div className="card overflow-visible" ref={(el) => { chartRefs.current['G_medical_conformity'] = el }}>
            <div className="card-header">
              <h3 className="font-semibold text-gray-900 dark:text-gray-100">{sectionTitle('medical')}</h3>
            </div>
            <div className="card-body">
              <div className="h-72">
                <ResponsiveContainer width="100%" height="100%">
                  <BarChart data={medicalRows} margin={{ top: 10, right: 18, left: 8, bottom: 70 }}>
                    <CartesianGrid strokeDasharray="3 3" stroke={gridStyle.stroke} opacity={gridStyle.opacity} />
                    <XAxis dataKey="pole" angle={xAxisAngle} textAnchor={xAxisTextAnchor} height={xAxisHeight} {...axisCommon} />
                    <YAxis domain={[0, 100]} {...axisCommon} />
                    <Tooltip
                      {...tooltipDark}
                      formatter={(value) => [`${safeNumber(value).toFixed(2)}%`, t('dashboard.monthlyReport.medicalConformity')]}
                    />
                    <Bar dataKey="pct" name={t('dashboard.monthlyReport.medicalConformity')} fill={SGTM_COLORS.orange} radius={[6, 6, 0, 0]} />
                    <Customized
                      component={makeBottomLegend(
                        [{ type: 'box', color: SGTM_COLORS.orange, label: t('dashboard.monthlyReport.medicalConformity') }],
                        { textColor: legendTextColor }
                      )}
                    />
                  </BarChart>
                </ResponsiveContainer>
              </div>
            </div>
          </div>

          {/* Subcontractors section is list-heavy; exported as chart not included here (can be added later if you want a dedicated chart). */}
          <div className="card lg:col-span-2">
            <div className="card-header">
              <h3 className="font-semibold text-gray-900 dark:text-gray-100">{sectionTitle('subcontractors')}</h3>
            </div>
            <div className="card-body">
              <div className="text-xs text-gray-500 dark:text-gray-400 mb-3">
                {t('dashboard.monthlyReport.subcontractorHelp')}
              </div>

              <div className="overflow-auto">
                <table className="min-w-[900px] w-full text-sm">
                  <thead>
                    <tr className="text-left text-xs text-gray-500 dark:text-gray-400">
                      <th className="py-2 pr-4">{t('dashboard.monthlyReport.pole')}</th>
                      <th className="py-2 pr-4">{t('dashboard.monthlyReport.contractor')}</th>
                      <th className="py-2 pr-4">{t('dashboard.monthlyReport.project')}</th>
                      <th className="py-2 pr-4">{t('dashboard.monthlyReport.uploadedDocs')}</th>
                      <th className="py-2 pr-4">{t('dashboard.monthlyReport.completion')}</th>
                    </tr>
                  </thead>
                  <tbody>
                    {filteredPoles.flatMap((pole) => {
                      const rows = sections?.subcontractors?.by_pole?.[pole] || []
                      if (!Array.isArray(rows) || rows.length === 0) {
                        return [
                          (
                            <tr key={`empty-${pole}`} className="border-t border-gray-100 dark:border-gray-800">
                              <td className="py-2 pr-4 font-medium text-gray-800 dark:text-gray-200">{pole}</td>
                              <td colSpan={4} className="py-2 pr-4 text-gray-500 dark:text-gray-400">{t('common.noData')}</td>
                            </tr>
                          ),
                        ]
                      }

                      return rows.map((r, idx) => (
                        <tr key={`${pole}-${r.subcontractor_opening_id}`} className="border-t border-gray-100 dark:border-gray-800">
                          {idx === 0 ? (
                            <td
                              rowSpan={rows.length}
                              className="py-2 pr-4 font-medium text-gray-800 dark:text-gray-200 align-top"
                            >
                              {pole}
                            </td>
                          ) : null}
                          <td className="py-2 pr-4 text-gray-700 dark:text-gray-300">{r.contractor_name}</td>
                          <td className="py-2 pr-4 text-gray-700 dark:text-gray-300">{r.project_name}</td>
                          <td className="py-2 pr-4 tabular-nums">
                            {safeNumber(r.uploaded_docs_count)}/{safeNumber(r.required_docs_count)}
                          </td>
                          <td className="py-2 pr-4 tabular-nums font-semibold">{safeNumber(r.completion_pct).toFixed(1)}%</td>
                        </tr>
                      ))
                    })}
                  </tbody>
                </table>
              </div>
            </div>
          </div>

          <div className="card overflow-visible" ref={(el) => { chartRefs.current['H_deviations_closure_subcontractors'] = el }}>
            <div className="card-header">
              <h3 className="font-semibold text-gray-900 dark:text-gray-100">{sectionTitle('sor_subcontractors')}</h3>
            </div>
            <div className="card-body">
              <div className="h-72">
                <ResponsiveContainer width="100%" height="100%">
                  <ComposedChart data={sorSubRows} margin={{ top: 10, right: 22, left: 8, bottom: 70 }}>
                    <CartesianGrid strokeDasharray="3 3" stroke={gridStyle.stroke} opacity={gridStyle.opacity} />
                    <XAxis dataKey="pole" angle={xAxisAngle} textAnchor={xAxisTextAnchor} height={xAxisHeight} {...axisCommon} />
                    <YAxis yAxisId="left" allowDecimals={false} {...axisCommon} />
                    <YAxis yAxisId="right" orientation="right" domain={[0, 100]} {...axisCommon} />
                    <Tooltip
                      {...tooltipDark}
                      content={({ active, payload: p, label }) => {
                        if (!active || !p || p.length === 0) return null
                        const pole = String(label || '')
                        const list = sections?.sor_subcontractors?.by_pole_projects?.[pole]
                        const total = payloadValue(p, 'total')
                        const closure = payloadValue(p, 'closurePct')
                        return (
                          <div style={tooltipDark.contentStyle}>
                            <div style={tooltipDark.labelStyle}>{t('dashboard.monthlyReport.deviationTooltipTitle')} - {pole}</div>
                            <div className="text-xs text-slate-200 mt-1">{t('dashboard.monthlyReport.totalDeviations')}: {fmtInt(total)}</div>
                            <div className="text-xs text-slate-200">{t('dashboard.monthlyReport.closureRate')}: {fmtPct2(closure)}</div>
                            <div className="mt-2">{renderPoleProjectTooltip(pole, list, (r) => r?.total)}</div>
                          </div>
                        )
                      }}
                    />
                    <Bar yAxisId="left" dataKey="total" name={t('dashboard.monthlyReport.totalDeviations')} fill={SGTM_COLORS.orange} radius={[6, 6, 0, 0]} />
                    <Line yAxisId="right" type="monotone" dataKey="closurePct" name={t('dashboard.monthlyReport.closureRate')} stroke={trendStroke} strokeWidth={2} dot={{ r: 3, fill: trendStroke }} />
                    <Customized
                      component={makeBottomLegend(
                        [
                          { type: 'box', color: SGTM_COLORS.orange, label: t('dashboard.monthlyReport.totalDeviations') },
                          { type: 'line', color: trendStroke, label: t('dashboard.monthlyReport.closureRate') },
                        ],
                        { textColor: legendTextColor }
                      )}
                    />
                  </ComposedChart>
                </ResponsiveContainer>
              </div>
            </div>
          </div>

          <div className="card overflow-visible" ref={(el) => { chartRefs.current['I_closure_duration_subcontractors'] = el }}>
            <div className="card-header">
              <h3 className="font-semibold text-gray-900 dark:text-gray-100">{sectionTitle('closure_duration_subcontractors')}</h3>
            </div>
            <div className="card-body">
              <div className="h-72">
                <ResponsiveContainer width="100%" height="100%">
                  <BarChart data={durationSubRows} margin={{ top: 10, right: 18, left: 8, bottom: 70 }}>
                    <CartesianGrid strokeDasharray="3 3" stroke={gridStyle.stroke} opacity={gridStyle.opacity} />
                    <XAxis dataKey="pole" angle={xAxisAngle} textAnchor={xAxisTextAnchor} height={xAxisHeight} {...axisCommon} />
                    <YAxis {...axisCommon} />
                    <Tooltip
                      {...tooltipDark}
                      formatter={(value) => [`${safeNumber(value).toFixed(2)} ${t('common.hourShort')}`, t('dashboard.monthlyReport.avgHours')]}
                    />
                    <Bar dataKey="avgHours" name={t('dashboard.monthlyReport.avgHours')} fill={SGTM_COLORS.orange} radius={[6, 6, 0, 0]} />
                    <Customized
                      component={makeBottomLegend(
                        [{ type: 'box', color: SGTM_COLORS.orange, label: t('dashboard.monthlyReport.avgHours') }],
                        { textColor: legendTextColor }
                      )}
                    />
                  </BarChart>
                </ResponsiveContainer>
              </div>
            </div>
          </div>

        </div>
      )}
    </div>
  )
})

export default MonthlyReportTheme
