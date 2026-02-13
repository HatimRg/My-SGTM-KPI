import { Fragment, memo, useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { createPortal } from 'react-dom'
import { useTranslation } from '../../../i18n'
import { MonthPicker, WeekPicker } from '../../../components/ui'
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
  LabelList,
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

const clamp = (v, min, max) => Math.max(min, Math.min(max, v))

const payloadValue = (payload, key) => {
  const arr = Array.isArray(payload) ? payload : []
  const found = arr.find((x) => x?.dataKey === key)
  return found?.value
}

const fmtInt = (v) => String(Math.round(safeNumber(v)))
const fmt2 = (v) => safeNumber(v).toFixed(2)
const fmtPct2 = (v) => `${safeNumber(v).toFixed(2)}%`

const getISOWeekInfo = (date) => {
  const d = new Date(Date.UTC(date.getFullYear(), date.getMonth(), date.getDate()))
  const dayNum = d.getUTCDay() || 7
  d.setUTCDate(d.getUTCDate() + 4 - dayNum)
  const weekYear = d.getUTCFullYear()
  const yearStart = new Date(Date.UTC(weekYear, 0, 1))
  const week = Math.ceil((((d - yearStart) / 86400000) + 1) / 7)
  return { weekYear, week }
}

const pad2 = (n) => String(Math.max(0, Math.trunc(n))).padStart(2, '0')

const toIsoWeekKey = (date) => {
  const { weekYear, week } = getISOWeekInfo(date)
  return `${weekYear}-W${pad2(week)}`
}

const WeekRangePicker = memo(function WeekRangePicker({ weekStart, weekEnd, onChangeStart, onChangeEnd, labelStart, labelEnd }) {
  return (
    <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
      <div className="flex flex-col gap-1">
        <div className="text-xs font-medium text-gray-600 dark:text-gray-300">{labelStart}</div>
        <WeekPicker value={weekStart} onChange={onChangeStart} className="w-full" />
      </div>
      <div className="flex flex-col gap-1">
        <div className="text-xs font-medium text-gray-600 dark:text-gray-300">{labelEnd}</div>
        <WeekPicker value={weekEnd} onChange={onChangeEnd} className="w-full" />
      </div>
    </div>
  )
})

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

const renderTopLabelWithBg = ({
  formatter = (v) => v,
  fontSize = 10,
  fontWeight = 600,
  textColor = CHART_THEME.label,
  bgColor = '#FFFFFF',
  bgOpacity = 0.92,
  paddingX = 4,
  paddingY = 2,
  offsetY = 8,
} = {}) => {
  const estimateTextWidth = (text, fs) => {
    const s = String(text ?? '')
    return s.length * fs * 0.62
  }

  return (props) => {
    const { x, y, width, value } = props
    if (value === undefined || value === null) return null
    const text = String(formatter(value))
    if (text.trim() === '' || text === '0' || text === '0.00') {
      // keep zeros visible for TF/TG; don't early-return
    }

    const cx = safeNumber(x) + safeNumber(width) / 2
    const labelY = safeNumber(y) - offsetY
    const w = estimateTextWidth(text, fontSize) + paddingX * 2
    const h = fontSize + paddingY * 2

    return (
      <g>
        <rect x={cx - w / 2} y={labelY - fontSize - paddingY} width={w} height={h} rx={4} fill={bgColor} opacity={bgOpacity} />
        <text
          x={cx}
          y={labelY}
          fill={textColor}
          fontSize={fontSize}
          fontWeight={fontWeight}
          textAnchor="middle"
          dominantBaseline="auto"
        >
          {text}
        </text>
      </g>
    )
  }
}

const renderSmartBarLabel = (trendDataKey, valueThreshold = 20, topMargin = 150) => {
  return (props) => {
    const { x, y, width, height, value, payload } = props
    if (value === undefined || value === null || value === 0) return null

    const barValue = safeNumber(value)
    const trendValue = safeNumber(payload?.[trendDataKey])

    const hasTrendValue = trendValue > 0
    const barIsNearTop = y < topMargin
    const isCloseInValue = hasTrendValue && Math.abs(barValue - trendValue) < valueThreshold
    const isOverlapping = barIsNearTop || isCloseInValue

    const labelX = x + width / 2
    const labelY = isOverlapping ? y + Math.min(height / 2, 20) : y - 8
    const textAnchor = 'middle'
    const dominantBaseline = isOverlapping ? 'middle' : 'auto'

    const text = String(barValue)
    const showBg = !isOverlapping
    const paddingX = 4
    const paddingY = 2
    const bgW = text.length * 10 * 0.62 + paddingX * 2
    const bgH = 10 + paddingY * 2

    return (
      <g>
        {showBg ? (
          <rect
            x={labelX - bgW / 2}
            y={labelY - 10 - paddingY}
            width={bgW}
            height={bgH}
            rx={4}
            fill="#FFFFFF"
            opacity={0.92}
          />
        ) : null}
        <text
          x={labelX}
          y={labelY}
          fill={showBg ? '#111827' : CHART_THEME.label}
          fontSize={10}
          fontWeight={600}
          textAnchor={textAnchor}
          dominantBaseline={dominantBaseline}
        >
          {text}
        </text>
      </g>
    )
  }
}

const renderSmartBarLabelPct = (trendDataKey, valueThreshold = 20, topMargin = 150) => {
  return (props) => {
    const { x, y, width, height, value, payload } = props
    if (value === undefined || value === null || value === 0) return null

    const barValue = safeNumber(value)
    const trendValue = safeNumber(payload?.[trendDataKey])

    const hasTrendValue = trendValue > 0
    const barIsNearTop = y < topMargin
    const isCloseInValue = hasTrendValue && Math.abs(barValue - trendValue) < valueThreshold
    const isOverlapping = barIsNearTop || isCloseInValue

    const labelX = x + width / 2
    const labelY = isOverlapping ? y + Math.min(height / 2, 20) : y - 8
    const textAnchor = 'middle'
    const dominantBaseline = isOverlapping ? 'middle' : 'auto'

    const text = String(safeNumber(barValue).toFixed(1))
    const showBg = !isOverlapping
    const paddingX = 4
    const paddingY = 2
    const bgW = text.length * 10 * 0.62 + paddingX * 2
    const bgH = 10 + paddingY * 2

    return (
      <g>
        {showBg ? (
          <rect
            x={labelX - bgW / 2}
            y={labelY - 10 - paddingY}
            width={bgW}
            height={bgH}
            rx={4}
            fill="#FFFFFF"
            opacity={0.92}
          />
        ) : null}
        <text
          x={labelX}
          y={labelY}
          fill={showBg ? '#111827' : CHART_THEME.label}
          fontSize={10}
          fontWeight={600}
          textAnchor={textAnchor}
          dominantBaseline={dominantBaseline}
        >
          {text}
        </text>
      </g>
    )
  }
}

const makeCollisionBarLabels = ({
  barKey,
  lineKey,
  barAxisId = 'left',
  lineAxisId = 'right',
  formatter = (v) => v,
  lineLabelFormatter = (v) => v,
  fontSize = 10,
  fontWeight = 600,
  fill = CHART_THEME.label,
  collisionYPx = 14,
  lineLabelFontSize = 9,
  lineLabelOffset = 12,
  dotRadius = 3,
  dotBuffer = 4,
  lineStrokeBuffer = 4,
} = {}) => {
  const estimateTextWidth = (text, fs) => {
    const s = String(text ?? '')
    return s.length * fs * 0.62
  }

  const rectsIntersect = (a, b) => {
    if (!a || !b) return false
    return !(a.x2 < b.x1 || a.x1 > b.x2 || a.y2 < b.y1 || a.y1 > b.y2)
  }

  const clamp = (v, min, max) => Math.max(min, Math.min(max, v))

  const distPointToSegment = (px, py, x1, y1, x2, y2) => {
    const dx = x2 - x1
    const dy = y2 - y1
    if (dx === 0 && dy === 0) return Math.hypot(px - x1, py - y1)
    const t = clamp(((px - x1) * dx + (py - y1) * dy) / (dx * dx + dy * dy), 0, 1)
    const cx = x1 + t * dx
    const cy = y1 + t * dy
    return Math.hypot(px - cx, py - cy)
  }

  return ({ data, xAxisMap, yAxisMap }) => {
    const rows = Array.isArray(data) ? data : []
    const xAxis = xAxisMap ? Object.values(xAxisMap)[0] : null
    const xScale = xAxis?.scale
    const xBandwidth = typeof xScale?.bandwidth === 'function' ? xScale.bandwidth() : 0

    const yBar = yAxisMap?.[barAxisId]?.scale
    const yLine = yAxisMap?.[lineAxisId]?.scale

    if (!xScale || !yBar || !yLine) return null

    const zeroY = yBar(0)

    const centers = rows.map((row) => {
      const category = row?.pole
      const x0 = xScale(category)
      const cx = Number.isFinite(x0) ? x0 + xBandwidth / 2 : NaN
      const y = yLine(safeNumber(row?.[lineKey]))
      return { cx, y }
    })

    return (
      <g>
        {rows.map((row, idx) => {
          const category = row?.pole
          const x0 = xScale(category)
          if (!Number.isFinite(x0)) return null

          const barValue = safeNumber(row?.[barKey])
          if (!barValue) return null

          const lineValue = safeNumber(row?.[lineKey])

          const cx = x0 + xBandwidth / 2
          const barTopY = yBar(barValue)
          const barHeight = Math.max(0, zeroY - barTopY)

          const linePointY = yLine(lineValue)
          const lineLabelY = linePointY - lineLabelOffset

          const barText = formatter(barValue)
          const barTextWidth = estimateTextWidth(barText, fontSize)
          const barHalfW = barTextWidth / 2
          const barHalfH = fontSize / 2

          const lineText = lineLabelFormatter(lineValue)
          const lineTextWidth = estimateTextWidth(lineText, lineLabelFontSize)
          const lineLabelBox = Number.isFinite(lineLabelY)
            ? {
              x1: cx - lineTextWidth / 2,
              x2: cx + lineTextWidth / 2,
              y1: lineLabelY - lineLabelFontSize,
              y2: lineLabelY + 2,
            }
            : null

          const dotBox = Number.isFinite(linePointY)
            ? {
              x1: cx - (dotRadius + dotBuffer),
              x2: cx + (dotRadius + dotBuffer),
              y1: linePointY - (dotRadius + dotBuffer),
              y2: linePointY + (dotRadius + dotBuffer),
            }
            : null

          const prev = centers[idx - 1]
          const curr = centers[idx]
          const next = centers[idx + 1]
          const segments = []
          if (prev && Number.isFinite(prev.cx) && Number.isFinite(prev.y) && Number.isFinite(curr?.cx) && Number.isFinite(curr?.y)) {
            segments.push([prev.cx, prev.y, curr.cx, curr.y])
          }
          if (next && Number.isFinite(next.cx) && Number.isFinite(next.y) && Number.isFinite(curr?.cx) && Number.isFinite(curr?.y)) {
            segments.push([curr.cx, curr.y, next.cx, next.y])
          }

          const collides = (labelY) => {
            const box = {
              x1: cx - barHalfW,
              x2: cx + barHalfW,
              y1: labelY - barHalfH,
              y2: labelY + barHalfH,
            }

            if (rectsIntersect(box, lineLabelBox)) return true
            if (rectsIntersect(box, dotBox)) return true

            const centerY = labelY
            const sampleDx = Math.max(1, Math.min(barHalfW, barHalfW * 0.85))
            const sampleXs = [cx, cx - sampleDx, cx + sampleDx]
            for (const [x1, y1, x2, y2] of segments) {
              for (const sx of sampleXs) {
                const d = distPointToSegment(sx, centerY, x1, y1, x2, y2)
                if (d <= lineStrokeBuffer) return true
              }
            }

            if (Number.isFinite(linePointY) && Math.abs(centerY - linePointY) <= collisionYPx) return true
            if (Number.isFinite(lineLabelY) && Math.abs(centerY - lineLabelY) <= collisionYPx) return true

            return false
          }

          const aboveY = barTopY - 8
          const insideStartY = barTopY + Math.min(barHeight / 2, 20)
          const barBottomY = barTopY + barHeight
          const minInsideY = barTopY + 14
          const maxInsideY = Math.min(barBottomY - 14, zeroY - 8)
          const stepPx = 3

          let labelY = insideStartY
          let dominantBaseline = 'middle'
          let showBg = false

          if (!collides(aboveY)) {
            labelY = aboveY
            dominantBaseline = 'auto'
            showBg = true
          } else if (Number.isFinite(minInsideY) && Number.isFinite(maxInsideY) && minInsideY <= maxInsideY) {
            let found = false
            const start = clamp(insideStartY, minInsideY, maxInsideY)
            for (let yTry = start; yTry <= maxInsideY; yTry += stepPx) {
              if (!collides(yTry)) {
                labelY = yTry
                dominantBaseline = 'middle'
                showBg = false
                found = true
                break
              }
            }

            if (!found) {
              for (let yTry = start; yTry >= minInsideY; yTry -= stepPx) {
                if (!collides(yTry)) {
                  labelY = yTry
                  dominantBaseline = 'middle'
                  showBg = false
                  found = true
                  break
                }
              }
            }

            if (!found) {
              labelY = insideStartY
              dominantBaseline = 'middle'
              showBg = false
            }
          } else {
            const clamped = clamp(insideStartY, barTopY + 8, zeroY - 8)
            labelY = clamped
            dominantBaseline = 'middle'
            showBg = false
          }

          if (labelY > zeroY - 6) {
            labelY = zeroY - 6
            dominantBaseline = 'auto'
            showBg = true
          }

          const bgPadX = 4
          const bgPadY = 2
          const bgW = barTextWidth + bgPadX * 2
          const bgH = fontSize + bgPadY * 2
          const bgX = cx - bgW / 2
          const bgY = labelY - fontSize - bgPadY

          return (
            <g key={`${String(category)}-${idx}`}>
              {showBg ? (
                <rect x={bgX} y={bgY} width={bgW} height={bgH} rx={4} fill="#FFFFFF" opacity={0.92} />
              ) : null}
              <text
                x={cx}
                y={labelY}
                fill={showBg ? '#111827' : fill}
                fontSize={fontSize}
                fontWeight={fontWeight}
                textAnchor="middle"
                dominantBaseline={dominantBaseline}
              >
                {barText}
              </text>
            </g>
          )
        })}
      </g>
    )
  }
}

const wrapCanvasText = (ctx, text, maxWidth) => {
  const raw = String(text ?? '').trim()
  if (!raw) return []
  const safeMax = Math.max(40, safeNumber(maxWidth))

  const words = raw.split(/\s+/g)
  const lines = []
  let current = ''

  for (const w of words) {
    const test = current ? `${current} ${w}` : w
    const width = ctx.measureText(test).width
    if (width <= safeMax) {
      current = test
      continue
    }

    if (current) lines.push(current)
    current = w

    if (ctx.measureText(current).width > safeMax) {
      let chunk = ''
      for (const ch of String(w)) {
        const next = chunk + ch
        if (ctx.measureText(next).width <= safeMax || !chunk) {
          chunk = next
        } else {
          lines.push(chunk)
          chunk = ch
        }
      }
      current = chunk
    }
  }

  if (current) lines.push(current)
  return lines
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
  const headerPaddingX = 12
  const headerPaddingY = 10
  const headerLineHeight = 18
  const headerTextMaxWidth = Math.max(40, safeNumber(width) - headerPaddingX * 2)

  const canvas = document.createElement('canvas')
  canvas.width = Math.round(width * pixelScale)

  const ctx0 = canvas.getContext('2d')
  if (!ctx0) {
    throw new Error('Canvas not supported')
  }

  let headerHeightCssPx = 0
  let wrappedLines = []
  if (titleText) {
    ctx0.save()
    ctx0.scale(pixelScale, pixelScale)
    ctx0.font = '700 16px system-ui, -apple-system, Segoe UI, Roboto, Arial'
    wrappedLines = wrapCanvasText(ctx0, titleText, headerTextMaxWidth)
    ctx0.restore()

    const textBlockH = wrappedLines.length * headerLineHeight
    headerHeightCssPx = Math.max(40, headerPaddingY * 2 + textBlockH + 8)
  }

  const headerHeight = Math.round(headerHeightCssPx * pixelScale)
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
    ctx.textBaseline = 'top'
    const startY = headerPaddingY
    wrappedLines.forEach((line, i) => {
      ctx.fillText(line, headerPaddingX, startY + i * headerLineHeight)
    })
    ctx.strokeStyle = '#F2A93B'
    ctx.globalAlpha = 0.9
    ctx.lineWidth = 2
    ctx.beginPath()
    ctx.moveTo(headerPaddingX, headerHeightCssPx - 4)
    ctx.lineTo(Math.max(headerPaddingX, (width - headerPaddingX)), headerHeightCssPx - 4)
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
  const headerPaddingX = 12
  const headerPaddingY = 10
  const headerLineHeight = 18
  const headerTextMaxWidth = Math.max(40, safeNumber(safeWidth) - headerPaddingX * 2)
  const dpr = window.devicePixelRatio || 1
  let pixelScale = Math.max(1, safeNumber(scale) * dpr)

  const maxDim = Math.max(512, safeNumber(maxCanvasSize))
  const largest = Math.max(safeWidth * pixelScale, safeHeight * pixelScale)
  if (largest > maxDim) {
    pixelScale = pixelScale * (maxDim / largest)
  }

  const canvas = document.createElement('canvas')
  canvas.width = Math.round(safeWidth * pixelScale)

  const ctx0 = canvas.getContext('2d')
  if (!ctx0) {
    throw new Error('Canvas not supported')
  }

  let headerHeightCssPx = 0
  let wrappedLines = []
  if (titleText) {
    ctx0.save()
    ctx0.scale(pixelScale, pixelScale)
    ctx0.font = '700 16px system-ui, -apple-system, Segoe UI, Roboto, Arial'
    wrappedLines = wrapCanvasText(ctx0, titleText, headerTextMaxWidth)
    ctx0.restore()

    const textBlockH = wrappedLines.length * headerLineHeight
    headerHeightCssPx = Math.max(40, headerPaddingY * 2 + textBlockH + 8)
  }

  const headerHeight = Math.round(headerHeightCssPx * pixelScale)
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
    ctx.textBaseline = 'top'
    const startY = headerPaddingY
    wrappedLines.forEach((line, i) => {
      ctx.fillText(line, headerPaddingX, startY + i * headerLineHeight)
    })
    ctx.strokeStyle = '#F2A93B'
    ctx.globalAlpha = 0.9
    ctx.lineWidth = 2
    ctx.beginPath()
    ctx.moveTo(headerPaddingX, headerHeightCssPx - 4)
    ctx.lineTo(Math.max(headerPaddingX, (safeWidth - headerPaddingX)), headerHeightCssPx - 4)
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
  const filterStorageKey = 'monthly_report_theme_filters_v1'
  const [month, setMonth] = useState(() => {
    const now = new Date()
    const m = String(now.getMonth() + 1).padStart(2, '0')
    return `${now.getFullYear()}-${m}`
  })
  const [projectId, setProjectId] = useState('')
  const [loading, setLoading] = useState(false)
  const [exporting, setExporting] = useState(false)
  const [payload, setPayload] = useState(null)

  // Week range filter state
  const [useWeekRange, setUseWeekRange] = useState(false)
  const [weekStart, setWeekStart] = useState(() => {
    return toIsoWeekKey(new Date())
  })
  const [weekEnd, setWeekEnd] = useState(() => {
    return toIsoWeekKey(new Date())
  })

  const [selectedPole, setSelectedPole] = useState('')

  useEffect(() => {
    if (typeof window === 'undefined') return
    try {
      const raw = window.localStorage.getItem(filterStorageKey)
      if (!raw) return
      const parsed = JSON.parse(raw)

      if (typeof parsed?.useWeekRange === 'boolean') setUseWeekRange(parsed.useWeekRange)
      if (typeof parsed?.month === 'string') setMonth(parsed.month)
      if (typeof parsed?.weekStart === 'string') setWeekStart(parsed.weekStart)
      if (typeof parsed?.weekEnd === 'string') setWeekEnd(parsed.weekEnd)
      if (typeof parsed?.projectId === 'string') setProjectId(parsed.projectId)

      const lockedPole = String(focusPole || '').trim()
      if (lockedPole === '' && typeof parsed?.selectedPole === 'string') {
        setSelectedPole(parsed.selectedPole)
      }
    } catch (e) {
    }
  }, [focusPole])

  useEffect(() => {
    if (typeof window === 'undefined') return
    return () => {
      try {
        window.localStorage.removeItem(filterStorageKey)
      } catch (e) {
      }
    }
  }, [filterStorageKey])

  useEffect(() => {
    if (typeof window === 'undefined') return
    try {
      const lockedPole = String(focusPole || '').trim()
      const payloadToStore = {
        useWeekRange,
        month,
        weekStart,
        weekEnd,
        projectId,
        selectedPole: lockedPole ? '' : selectedPole,
      }
      window.localStorage.setItem(filterStorageKey, JSON.stringify(payloadToStore))
    } catch (e) {
    }
  }, [focusPole, month, projectId, selectedPole, useWeekRange, weekEnd, weekStart])

  const chartRefs = useRef({})

  const isAdmin = String(user?.role || '') === 'admin'

  const fetchSummary = useCallback(async () => {
    if (!isAdmin) return
    setLoading(true)
    try {
      const params = {}
      if (useWeekRange) {
        params.week_start = weekStart
        params.week_end = weekEnd
      } else {
        params.month = month
      }
      if (String(projectId || '').trim() !== '') params.project_id = projectId
      params.refresh = 1
      const res = await dashboardService.getMonthlyReportSummary(params)
      setPayload(res.data?.data ?? null)
    } catch (e) {
      setPayload(null)
      toast.error(t('dashboard.monthlyReport.loadFailed') || t('errors.failedToLoad'))
    } finally {
      setLoading(false)
    }
  }, [isAdmin, month, projectId, t, useWeekRange, weekStart, weekEnd])

  useEffect(() => {
    fetchSummary()
  }, [fetchSummary])

  const labels = payload?.labels ?? []
  const sections = payload?.sections ?? {}

  const normalizedFocusPole = String(focusPole || '').trim()
  const normalizedSelectedPole = String(selectedPole || '').trim()
  const filteredPoles = useMemo(() => {
    if (normalizedFocusPole === '') return labels
    return labels.filter((p) => String(p) === normalizedFocusPole)
  }, [labels, normalizedFocusPole])

  const displayedPoles = useMemo(() => {
    if (normalizedFocusPole !== '') return filteredPoles
    if (normalizedSelectedPole === '') return labels
    return labels.filter((p) => String(p) === normalizedSelectedPole)
  }, [filteredPoles, labels, normalizedFocusPole, normalizedSelectedPole])

  const showSinglePole = displayedPoles.length <= 1
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
    return displayedPoles.map((pole) => {
      const idx = labels.indexOf(pole)
      return {
        pole,
        score_sst: safeNumber(valuesSst[idx]),
        score_environment: safeNumber(valuesEnv[idx]),
      }
    })
  }, [displayedPoles, labels, sections?.veille])

  const sorRows = useMemo(() => {
    const d0 = sections?.sor?.datasets?.[0]
    const d1 = sections?.sor?.datasets?.[1]
    const totals = Array.isArray(d0?.data) ? d0.data : []
    const closure = Array.isArray(d1?.data) ? d1.data : []
    return displayedPoles.map((pole) => {
      const idx = labels.indexOf(pole)
      return { pole, total: safeNumber(totals[idx]), closurePct: safeNumber(closure[idx]) }
    })
  }, [displayedPoles, labels, sections?.sor])

  const sorSubRows = useMemo(() => {
    const d0 = sections?.sor_subcontractors?.datasets?.[0]
    const d1 = sections?.sor_subcontractors?.datasets?.[1]
    const totals = Array.isArray(d0?.data) ? d0.data : []
    const closure = Array.isArray(d1?.data) ? d1.data : []
    return displayedPoles.map((pole) => {
      const idx = labels.indexOf(pole)
      return { pole, total: safeNumber(totals[idx]), closurePct: safeNumber(closure[idx]) }
    })
  }, [displayedPoles, labels, sections?.sor_subcontractors])

  const durationRows = useMemo(() => {
    const ds = sections?.closure_duration?.datasets?.[0]
    const values = Array.isArray(ds?.data) ? ds.data : []
    return displayedPoles.map((pole) => {
      const idx = labels.indexOf(pole)
      return { pole, avgHours: safeNumber(values[idx]) }
    })
  }, [displayedPoles, labels, sections?.closure_duration])

  const durationSubRows = useMemo(() => {
    const ds = sections?.closure_duration_subcontractors?.datasets?.[0]
    const values = Array.isArray(ds?.data) ? ds.data : []
    return displayedPoles.map((pole) => {
      const idx = labels.indexOf(pole)
      return { pole, avgHours: safeNumber(values[idx]) }
    })
  }, [displayedPoles, labels, sections?.closure_duration_subcontractors])

  const trainingsRows = useMemo(() => {
    const d0 = sections?.trainings?.datasets?.[0]
    const d1 = sections?.trainings?.datasets?.[1]
    const counts = Array.isArray(d0?.data) ? d0.data : []
    const hours = Array.isArray(d1?.data) ? d1.data : []
    return displayedPoles.map((pole) => {
      const idx = labels.indexOf(pole)
      return { pole, count: safeNumber(counts[idx]), hours: safeNumber(hours[idx]) }
    })
  }, [displayedPoles, labels, sections?.trainings])

  const awarenessRows = useMemo(() => {
    const d0 = sections?.awareness?.datasets?.[0]
    const d1 = sections?.awareness?.datasets?.[1]
    const counts = Array.isArray(d0?.data) ? d0.data : []
    const hours = Array.isArray(d1?.data) ? d1.data : []
    return displayedPoles.map((pole) => {
      const idx = labels.indexOf(pole)
      return { pole, count: safeNumber(counts[idx]), hours: safeNumber(hours[idx]) }
    })
  }, [displayedPoles, labels, sections?.awareness])

  const medicalRows = useMemo(() => {
    const ds = sections?.medical?.datasets?.[0]
    const values = Array.isArray(ds?.data) ? ds.data : []
    return displayedPoles.map((pole) => {
      const idx = labels.indexOf(pole)
      return { pole, pct: safeNumber(values[idx]) }
    })
  }, [displayedPoles, labels, sections?.medical])

  // TF/TG comparison data
  const tfTgRows = useMemo(() => {
    const d0 = sections?.tf_tg?.datasets?.[0]
    const d1 = sections?.tf_tg?.datasets?.[1]
    const tfValues = Array.isArray(d0?.data) ? d0.data : []
    const tgValues = Array.isArray(d1?.data) ? d1.data : []
    return displayedPoles.map((pole) => {
      const idx = labels.indexOf(pole)
      const byPole = sections?.tf_tg?.by_pole?.[pole] || {}
      return {
        pole,
        tf: safeNumber(tfValues[idx]),
        tg: safeNumber(tgValues[idx]),
        accidents: safeNumber(byPole.accidents),
        lostDays: safeNumber(byPole.lost_days),
        hours: safeNumber(byPole.hours),
      }
    })
  }, [displayedPoles, labels, sections?.tf_tg])

  // Accidents vs Incidents data
  const accidentsIncidentsRows = useMemo(() => {
    const d0 = sections?.accidents_incidents?.datasets?.[0]
    const d1 = sections?.accidents_incidents?.datasets?.[1]
    const accValues = Array.isArray(d0?.data) ? d0.data : []
    const incValues = Array.isArray(d1?.data) ? d1.data : []
    return displayedPoles.map((pole) => {
      const idx = labels.indexOf(pole)
      return {
        pole,
        accidents: safeNumber(accValues[idx]),
        incidents: safeNumber(incValues[idx]),
      }
    })
  }, [displayedPoles, labels, sections?.accidents_incidents])

  // PPE consumption data
  const ppeConsumptionData = useMemo(() => {
    const itemNames = sections?.ppe_consumption?.item_names || {}
    const itemIds = sections?.ppe_consumption?.item_ids || []
    const byPole = sections?.ppe_consumption?.by_pole || {}

    const rows = displayedPoles.map((pole) => {
      const poleItems = byPole[pole] || {}
      const row = { pole }
      itemIds.forEach((id) => {
        row[`item_${id}`] = safeNumber(poleItems[id])
      })
      return row
    })

    return { rows, itemNames, itemIds }
  }, [displayedPoles, sections?.ppe_consumption])

  // Heavy machinery data
  const machineryRows = useMemo(() => {
    const d0 = sections?.machinery?.datasets?.[0]
    const d1 = sections?.machinery?.datasets?.[1]
    const counts = Array.isArray(d0?.data) ? d0.data : []
    const completions = Array.isArray(d1?.data) ? d1.data : []
    return displayedPoles.map((pole) => {
      const idx = labels.indexOf(pole)
      return {
        pole,
        count: safeNumber(counts[idx]),
        avgCompletion: safeNumber(completions[idx]),
      }
    })
  }, [displayedPoles, labels, sections?.machinery])

  // Inspections data
  const inspectionsRows = useMemo(() => {
    const d0 = sections?.inspections?.datasets?.[0]
    const counts = Array.isArray(d0?.data) ? d0.data : []
    return displayedPoles.map((pole) => {
      const idx = labels.indexOf(pole)
      return {
        pole,
        count: safeNumber(counts[idx]),
      }
    })
  }, [displayedPoles, labels, sections?.inspections])

  const tooltipDark = {
    contentStyle: { backgroundColor: CHART_THEME.tooltipBg, border: `1px solid ${CHART_THEME.grid}`, borderRadius: 10, maxWidth: 320, padding: 10, lineHeight: 1.2 },
    labelStyle: { color: CHART_THEME.label, fontWeight: 700 },
    itemStyle: { color: CHART_THEME.label },
    allowEscapeViewBox: { x: false, y: false },
    wrapperStyle: { zIndex: 99999, pointerEvents: 'none' },
    isAnimationActive: false,
  }

  const makeSmartTooltip = useCallback((renderContent, { side = 'auto', tooltipWidth = 320, gutter = 16, estimatedHeight = 220, containerKey = '' } = {}) => {
    return ({ active, payload, label, coordinate, viewBox }) => {
      if (!active || !payload || payload.length === 0) return null

      const chartWidth = viewBox?.width || 500
      const mouseX = coordinate?.x || 0
      const mouseY = coordinate?.y || 0

      const safeKey = String(containerKey || '').trim()
      const containerEl = safeKey ? chartRefs.current?.[safeKey] : null
      const rect = containerEl?.getBoundingClientRect ? containerEl.getBoundingClientRect() : null

      const hasViewport = typeof window !== 'undefined' && typeof window.innerWidth === 'number' && typeof window.innerHeight === 'number'
      const viewportW = hasViewport ? window.innerWidth : 1200
      const viewportH = hasViewport ? window.innerHeight : 800

      const baseX = rect ? rect.left + mouseX : mouseX
      const baseY = rect ? rect.top + mouseY : mouseY

      const desiredSide = side === 'auto'
        ? (mouseX + tooltipWidth + gutter > chartWidth ? 'left' : 'right')
        : side

      const rawX = desiredSide === 'left'
        ? baseX - tooltipWidth - gutter
        : baseX + gutter

      const rawY = baseY - 12

      const left = clamp(rawX, 8, Math.max(8, viewportW - tooltipWidth - 8))
      const top = clamp(rawY, 8, Math.max(8, viewportH - estimatedHeight - 8))

      const node = (
        <div
          style={{
            ...tooltipDark.contentStyle,
            position: 'fixed',
            left,
            top,
            width: tooltipWidth,
            zIndex: 999999,
            pointerEvents: 'none',
          }}
        >
          {renderContent({ active, payload, label })}
        </div>
      )

      if (typeof document !== 'undefined' && document.body) {
        return createPortal(node, document.body)
      }

      return node
    }
  }, [tooltipDark.contentStyle])

  const axisCommon = {
    tick: { fontSize: 11, fill: CHART_THEME.axis },
    axisLine: { stroke: CHART_THEME.axis, opacity: 0.7 },
    tickLine: { stroke: CHART_THEME.axis, opacity: 0.5 },
  }

  const gridStyle = { stroke: CHART_THEME.grid, opacity: 0.65 }

  const renderPoleProjectTooltip = (pole, items, valueGetter, { maxRows = 12 } = {}) => {
    const list = Array.isArray(items) ? items : []
    const safeMaxRows = Math.max(0, Math.min(12, safeNumber(maxRows)))
    const rows = list
      .slice()
      .sort((a, b) => safeNumber(valueGetter(b)) - safeNumber(valueGetter(a)))
      .slice(0, safeMaxRows)

    const remaining = Math.max(0, list.length - rows.length)

    return (
      <div className="space-y-1">
        <div className="text-xs font-semibold text-slate-200 leading-tight">{t('dashboard.monthlyReport.pole')}: {pole}</div>
        {rows.length === 0 ? (
          <div className="text-xs text-slate-300">{t('common.noData')}</div>
        ) : (
          <>
            {rows.map((r) => (
              <div key={String(r.project_id)} className="grid grid-cols-[1fr_auto] items-center gap-2 text-xs text-slate-200 leading-tight">
                <div className="min-w-0 truncate">{r.project_name} ({r.project_code})</div>
                <div className="text-right font-semibold tabular-nums">{safeNumber(valueGetter(r))}</div>
              </div>
            ))}
            {remaining > 0 ? (
              <div className="text-[10px] text-slate-300 leading-tight">+{remaining} {t('common.more') || 'more'}</div>
            ) : null}
          </>
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
        J_tf_tg: sectionTitle('tf_tg'),
        K_accidents_incidents: sectionTitle('accidents_incidents'),
        L_ppe_consumption: sectionTitle('ppe_consumption'),
        M_machinery: sectionTitle('machinery'),
        N_inspections: sectionTitle('inspections'),
      }

      for (const [key, el] of entries) {
        if (!el && key !== 'F_subcontractor_documents') continue

        let blob = null
        const title = exportTitleByKey[key] || key

        if (key === 'F_subcontractor_documents') {
          const rows = (displayedPoles || []).flatMap((pole) => {
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
  }, [displayedPoles, month, payload, sectionTitle, sections, t])

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
          <div className="flex flex-col gap-4">
            <div className="min-w-0">
              <div className="text-sm font-semibold text-gray-900 dark:text-gray-100">{t('dashboard.monthlyReport.title')}</div>
              <div className="text-xs text-gray-500 dark:text-gray-400">{t('dashboard.monthlyReport.subtitle')}</div>
            </div>

            <div className="flex flex-col gap-3">
              <div className="flex flex-col lg:flex-row lg:items-end gap-3">
                <div className="inline-flex p-1 rounded-2xl bg-gray-100/80 dark:bg-gray-800 border border-gray-200/80 dark:border-gray-700 shadow-sm w-fit">
                  <button
                    onClick={() => setUseWeekRange(false)}
                    className={`px-3 py-2 rounded-xl text-sm font-semibold transition ${!useWeekRange ? 'bg-sgtm-orange text-white shadow' : 'text-gray-600 dark:text-gray-300 hover:bg-white/60 dark:hover:bg-gray-900/40 hover:text-sgtm-orange-dark dark:hover:text-sgtm-orange-light'}`}
                  >
                    {t('dashboard.monthlyReport.useMonth')}
                  </button>
                  <button
                    onClick={() => setUseWeekRange(true)}
                    className={`px-3 py-2 rounded-xl text-sm font-semibold transition ${useWeekRange ? 'bg-sgtm-orange text-white shadow' : 'text-gray-600 dark:text-gray-300 hover:bg-white/60 dark:hover:bg-gray-900/40 hover:text-sgtm-orange-dark dark:hover:text-sgtm-orange-light'}`}
                  >
                    {t('dashboard.monthlyReport.useWeekRange')}
                  </button>
                </div>

                <div className="flex-1">
                  {!useWeekRange ? (
                    <div className="flex flex-col gap-1">
                      <div className="text-xs font-medium text-gray-600 dark:text-gray-300">{t('dashboard.monthlyReport.month')}</div>
                      <MonthPicker value={month} onChange={setMonth} className="w-full" />
                    </div>
                  ) : (
                    <WeekRangePicker
                      weekStart={weekStart}
                      weekEnd={weekEnd}
                      onChangeStart={setWeekStart}
                      onChangeEnd={setWeekEnd}
                      labelStart={t('dashboard.monthlyReport.weekStart')}
                      labelEnd={t('dashboard.monthlyReport.weekEnd')}
                    />
                  )}
                </div>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-3 gap-3 items-end">
                {normalizedFocusPole === '' ? (
                  <div className="flex flex-col gap-1">
                    <label className="text-xs font-medium text-gray-600 dark:text-gray-300">{t('dashboard.monthlyReport.pole') || t('common.pole') || 'Pole'}</label>
                    <select
                      value={selectedPole}
                      onChange={(e) => setSelectedPole(e.target.value)}
                      className="w-full px-3 py-2 rounded-xl border border-gray-200/80 dark:border-gray-700 bg-white/80 dark:bg-gray-900 text-gray-900 dark:text-gray-100 text-sm shadow-sm hover:bg-white dark:hover:bg-gray-900 focus:outline-none focus:ring-2 focus:ring-primary-500"
                    >
                      <option value="">{t('common.allPoles') || t('common.all') || 'All'}</option>
                      {labels.map((p) => (
                        <option key={String(p)} value={String(p)}>
                          {String(p)}
                        </option>
                      ))}
                    </select>
                  </div>
                ) : null}

                <div className="flex flex-col gap-1">
                  <label className="text-xs font-medium text-gray-600 dark:text-gray-300">{t('dashboard.monthlyReport.filterProject')}</label>
                  <select
                    value={projectId}
                    onChange={(e) => setProjectId(e.target.value)}
                    className="w-full max-w-full px-3 py-2 rounded-xl border border-gray-200/80 dark:border-gray-700 bg-white/80 dark:bg-gray-900 text-gray-900 dark:text-gray-100 text-sm shadow-sm hover:bg-white dark:hover:bg-gray-900 focus:outline-none focus:ring-2 focus:ring-primary-500"
                  >
                    <option value="">{t('common.allProjects')}</option>
                    {projectOptions.map((p) => (
                      <option key={String(p.id)} value={String(p.id)}>
                        {p.name} ({p.code})
                      </option>
                    ))}
                  </select>
                </div>

                <div className="md:justify-self-end">
                  <button
                    onClick={handleExportZip}
                    disabled={exporting || loading}
                    className="inline-flex items-center justify-center gap-2 px-4 py-2 rounded-xl border border-gray-200/80 dark:border-gray-700 bg-white/80 dark:bg-gray-900 text-gray-700 dark:text-gray-200 hover:bg-white dark:hover:bg-gray-900 text-sm font-semibold whitespace-nowrap shadow-sm focus:outline-none focus:ring-2 focus:ring-primary-500 w-full md:w-auto"
                  >
                    {exporting ? <Loader2 className="w-4 h-4 animate-spin" /> : <Download className="w-4 h-4" />}
                    {t('dashboard.monthlyReport.exportZip')}
                  </button>
                </div>
              </div>
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

      {!loading && payload && displayedPoles.length > 0 && (
        <div className={`grid grid-cols-1 ${normalizedFocusPole ? '' : 'lg:grid-cols-2'} gap-6`}>
          <div className="card overflow-visible" ref={(el) => { chartRefs.current['A_veille_reglementaire'] = el }}>
            <div className="card-header">
              <h3 className="font-semibold text-gray-900 dark:text-gray-100">{sectionTitle('veille')}</h3>
            </div>
            <div className="card-body">
              <div className="h-72">
                <ResponsiveContainer width="100%" height="100%">
                  <BarChart data={veilleRows} margin={{ top: 35, right: 18, left: 8, bottom: 70 }}>
                    <CartesianGrid strokeDasharray="3 3" stroke={gridStyle.stroke} opacity={gridStyle.opacity} />
                    <XAxis dataKey="pole" angle={xAxisAngle} textAnchor={xAxisTextAnchor} height={xAxisHeight} {...axisCommon} />
                    <YAxis domain={[0, 100]} {...axisCommon} />
                    <Tooltip
                      {...tooltipDark}
                      content={makeSmartTooltip(({ payload: p, label }) => {
                        const pole = String(label || '')
                        const list = sections?.veille?.by_pole_projects?.[pole]
                        return (
                          <>
                            <div style={tooltipDark.labelStyle}>{t('dashboard.monthlyReport.veilleTooltipTitle')} - {pole}</div>
                            <div className="text-xs text-slate-200 mt-1">SST: {fmtPct2(payloadValue(p, 'score_sst'))}</div>
                            <div className="text-xs text-slate-200">ENV: {fmtPct2(payloadValue(p, 'score_environment'))}</div>
                            <div className="text-[11px] text-slate-300 mt-2">SST</div>
                            <div className="mt-2">{renderPoleProjectTooltip(pole, list, (r) => r?.score_sst)}</div>
                            <div className="text-[11px] text-slate-300 mt-2">ENV</div>
                            <div className="mt-2">{renderPoleProjectTooltip(pole, list, (r) => r?.score_environment)}</div>
                          </>
                        )
                      }, { side: 'right', containerKey: 'A_veille_reglementaire' })}
                    />
                    <Bar dataKey="score_sst" name="Veille SST %" fill={SGTM_COLORS.orange} radius={[6, 6, 0, 0]}>
                      <LabelList dataKey="score_sst" position="top" fill={CHART_THEME.label} fontSize={10} fontWeight={600} formatter={(v) => `${safeNumber(v).toFixed(0)}%`} />
                    </Bar>
                    <Bar dataKey="score_environment" name="Veille Environnement %" fill={SGTM_COLORS.darkGray} radius={[6, 6, 0, 0]}>
                      <LabelList dataKey="score_environment" position="top" fill={CHART_THEME.label} fontSize={10} fontWeight={600} formatter={(v) => `${safeNumber(v).toFixed(0)}%`} />
                    </Bar>
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
              <h3 className="font-semibold text-sm leading-snug whitespace-normal break-words pr-2 print:pr-4 max-w-[95%] print:max-w-[92%] text-gray-900 dark:text-gray-100">{sectionTitle('sor')}</h3>
            </div>
            <div className="card-body">
              <div className="h-72">
                <ResponsiveContainer width="100%" height="100%">
                  <ComposedChart data={sorRows} margin={{ top: 35, right: 22, left: 8, bottom: 70 }}>
                    <CartesianGrid strokeDasharray="3 3" stroke={gridStyle.stroke} opacity={gridStyle.opacity} />
                    <XAxis dataKey="pole" angle={xAxisAngle} textAnchor={xAxisTextAnchor} height={xAxisHeight} {...axisCommon} />
                    <YAxis yAxisId="left" allowDecimals={false} {...axisCommon} />
                    <YAxis yAxisId="right" orientation="right" domain={[0, 100]} {...axisCommon} />
                    <Tooltip
                      {...tooltipDark}
                      content={makeSmartTooltip(({ payload: p, label }) => {
                        const pole = String(label || '')
                        const list = sections?.sor?.by_pole_projects?.[pole]
                        const total = payloadValue(p, 'total')
                        const closure = payloadValue(p, 'closurePct')
                        return (
                          <>
                            <div style={tooltipDark.labelStyle}>{t('dashboard.monthlyReport.deviationTooltipTitle')} - {pole}</div>
                            <div className="text-xs text-slate-200 mt-1">{t('dashboard.monthlyReport.totalDeviations')}: {fmtInt(total)}</div>
                            <div className="text-xs text-slate-200">{t('dashboard.monthlyReport.closureRate')}: {fmtPct2(closure)}</div>
                            <div className="mt-2">{renderPoleProjectTooltip(pole, list, (r) => r?.total)}</div>
                          </>
                        )
                      }, { side: 'left', containerKey: 'B_deviations_closure' })}
                    />
                    <Bar yAxisId="left" dataKey="total" name={t('dashboard.monthlyReport.totalDeviations')} fill={SGTM_COLORS.orange} radius={[6, 6, 0, 0]}>
                    </Bar>
                    <Line yAxisId="right" type="monotone" dataKey="closurePct" name={t('dashboard.monthlyReport.closureRate')} stroke={trendStroke} strokeWidth={2} dot={{ r: 3, fill: trendStroke }}>
                      <LabelList dataKey="closurePct" position="top" offset={12} fill={trendStroke} fontSize={9} fontWeight={600} formatter={(v) => `${safeNumber(v).toFixed(0)}%`} />
                    </Line>
                    <Customized component={makeCollisionBarLabels({ barKey: 'total', lineKey: 'closurePct', barAxisId: 'left', lineAxisId: 'right', formatter: (v) => fmtInt(v) })} />
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
                  <BarChart data={durationRows} margin={{ top: 35, right: 18, left: 8, bottom: 70 }}>
                    <CartesianGrid strokeDasharray="3 3" stroke={gridStyle.stroke} opacity={gridStyle.opacity} />
                    <XAxis dataKey="pole" angle={xAxisAngle} textAnchor={xAxisTextAnchor} height={xAxisHeight} {...axisCommon} />
                    <YAxis {...axisCommon} />
                    <Tooltip
                      {...tooltipDark}
                      content={makeSmartTooltip(({ payload: p, label }) => {
                        const pole = String(label || '')
                        const avg = payloadValue(p, 'avgHours')
                        const list = sections?.closure_duration?.by_pole_projects?.[pole]
                        const getProjectAvg = (r) => {
                          const v = r?.avg_hours ?? r?.avgHours ?? r?.avg_hours_count ?? r?.hours ?? r?.value
                          return safeNumber(v)
                        }
                        return (
                          <>
                            <div style={tooltipDark.labelStyle}>{sectionTitle('closure_duration')} - {pole}</div>
                            <div className="text-xs text-slate-200 mt-1">{t('dashboard.monthlyReport.avgHours')}: {safeNumber(avg).toFixed(2)} {t('common.hourShort')}</div>
                            {Array.isArray(list) ? (
                              <div className="mt-2">{renderPoleProjectTooltip(pole, list, getProjectAvg, { maxRows: 8 })}</div>
                            ) : null}
                          </>
                        )
                      }, { side: 'right', estimatedHeight: 180, containerKey: 'C_closure_duration' })}
                    />
                    <Bar dataKey="avgHours" name={t('dashboard.monthlyReport.avgHours')} fill={SGTM_COLORS.orange} radius={[6, 6, 0, 0]}>
                      <LabelList dataKey="avgHours" position="top" fill={CHART_THEME.label} fontSize={10} fontWeight={600} formatter={(v) => safeNumber(v).toFixed(1)} />
                    </Bar>
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
                  <ComposedChart data={trainingsRows} margin={{ top: 35, right: 22, left: 8, bottom: 70 }}>
                    <CartesianGrid strokeDasharray="3 3" stroke={gridStyle.stroke} opacity={gridStyle.opacity} />
                    <XAxis dataKey="pole" angle={xAxisAngle} textAnchor={xAxisTextAnchor} height={xAxisHeight} {...axisCommon} />
                    <YAxis yAxisId="left" allowDecimals={false} {...axisCommon} />
                    <YAxis yAxisId="right" orientation="right" {...axisCommon} />
                    <Tooltip
                      {...tooltipDark}
                      content={makeSmartTooltip(({ payload: p, label }) => {
                        const pole = String(label || '')
                        const list = sections?.trainings?.by_pole_projects?.[pole]
                        const count = payloadValue(p, 'count')
                        const hours = payloadValue(p, 'hours')
                        return (
                          <>
                            <div style={tooltipDark.labelStyle}>{t('dashboard.monthlyReport.trainingsTooltipTitle')} - {pole}</div>
                            <div className="text-xs text-slate-200 mt-1">{t('dashboard.monthlyReport.trainingsCount')}: {fmtInt(count)}</div>
                            <div className="text-xs text-slate-200">{t('dashboard.monthlyReport.hours')}: {fmt2(hours)}</div>
                            <div className="mt-2">{renderPoleProjectTooltip(pole, list, (r) => r?.count)}</div>
                            <div className="mt-2">{renderPoleProjectTooltip(pole, list, (r) => r?.hours)}</div>
                          </>
                        )
                      }, { side: 'left', containerKey: 'D_trainings' })}
                    />
                    <Bar yAxisId="left" dataKey="count" name={t('dashboard.monthlyReport.trainingsCount')} fill={SGTM_COLORS.orange} radius={[6, 6, 0, 0]}>
                    </Bar>
                    <Line yAxisId="right" type="monotone" dataKey="hours" name={t('dashboard.monthlyReport.hours')} stroke={trendStroke} strokeWidth={2} dot={{ r: 3, fill: trendStroke }}>
                      <LabelList dataKey="hours" position="top" offset={12} fill={trendStroke} fontSize={9} fontWeight={600} formatter={(v) => safeNumber(v).toFixed(0)} />
                    </Line>
                    <Customized component={makeCollisionBarLabels({ barKey: 'count', lineKey: 'hours', barAxisId: 'left', lineAxisId: 'right', formatter: (v) => fmtInt(v) })} />
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
              <h3 className="font-semibold text-sm leading-snug whitespace-normal break-words pr-2 print:pr-4 max-w-[95%] print:max-w-[92%] text-gray-900 dark:text-gray-100">{sectionTitle('awareness')}</h3>
            </div>
            <div className="card-body">
              <div className="h-72">
                <ResponsiveContainer width="100%" height="100%">
                  <ComposedChart data={awarenessRows} margin={{ top: 35, right: 22, left: 8, bottom: 70 }}>
                    <CartesianGrid strokeDasharray="3 3" stroke={gridStyle.stroke} opacity={gridStyle.opacity} />
                    <XAxis dataKey="pole" angle={xAxisAngle} textAnchor={xAxisTextAnchor} height={xAxisHeight} {...axisCommon} />
                    <YAxis yAxisId="left" allowDecimals={false} {...axisCommon} />
                    <YAxis yAxisId="right" orientation="right" {...axisCommon} />
                    <Tooltip
                      {...tooltipDark}
                      content={makeSmartTooltip(({ payload: p, label }) => {
                        const pole = String(label || '')
                        const list = sections?.awareness?.by_pole_projects?.[pole]
                        const count = payloadValue(p, 'count')
                        const hours = payloadValue(p, 'hours')
                        return (
                          <>
                            <div style={tooltipDark.labelStyle}>{t('dashboard.monthlyReport.awarenessTooltipTitle')} - {pole}</div>
                            <div className="text-xs text-slate-200 mt-1">{t('dashboard.monthlyReport.sessionsCount')}: {fmtInt(count)}</div>
                            <div className="text-xs text-slate-200">{t('dashboard.monthlyReport.hours')}: {fmt2(hours)}</div>
                            <div className="mt-2">{renderPoleProjectTooltip(pole, list, (r) => r?.count)}</div>
                            <div className="mt-2">{renderPoleProjectTooltip(pole, list, (r) => r?.hours)}</div>
                          </>
                        )
                      }, { side: 'right', containerKey: 'E_awareness_sessions' })}
                    />
                    <Bar yAxisId="left" dataKey="count" name={t('dashboard.monthlyReport.sessionsCount')} fill={SGTM_COLORS.orange} radius={[6, 6, 0, 0]}>
                    </Bar>
                    <Line yAxisId="right" type="monotone" dataKey="hours" name={t('dashboard.monthlyReport.hours')} stroke={trendStroke} strokeWidth={2} dot={{ r: 3, fill: trendStroke }}>
                      <LabelList dataKey="hours" position="top" offset={12} fill={trendStroke} fontSize={9} fontWeight={600} formatter={(v) => safeNumber(v).toFixed(0)} />
                    </Line>
                    <Customized component={makeCollisionBarLabels({ barKey: 'count', lineKey: 'hours', barAxisId: 'left', lineAxisId: 'right', formatter: (v) => fmtInt(v) })} />
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
                  <BarChart data={medicalRows} margin={{ top: 35, right: 18, left: 8, bottom: 70 }}>
                    <CartesianGrid strokeDasharray="3 3" stroke={gridStyle.stroke} opacity={gridStyle.opacity} />
                    <XAxis dataKey="pole" angle={xAxisAngle} textAnchor={xAxisTextAnchor} height={xAxisHeight} {...axisCommon} />
                    <YAxis domain={[0, 100]} {...axisCommon} />
                    <Tooltip
                      {...tooltipDark}
                      content={makeSmartTooltip(({ payload: p, label }) => {
                        const pole = String(label || '')
                        const pct = payloadValue(p, 'pct')
                        const list = sections?.medical?.by_pole_projects?.[pole]
                        const getProjectPct = (r) => {
                          const v = r?.pct ?? r?.percentage ?? r?.value ?? r?.score
                          return safeNumber(v)
                        }
                        return (
                          <>
                            <div style={tooltipDark.labelStyle}>{sectionTitle('medical')} - {pole}</div>
                            <div className="text-xs text-slate-200 mt-1">{t('dashboard.monthlyReport.medicalConformity')}: {safeNumber(pct).toFixed(2)}%</div>
                            {Array.isArray(list) ? (
                              <div className="mt-2">{renderPoleProjectTooltip(pole, list, getProjectPct, { maxRows: 8 })}</div>
                            ) : null}
                          </>
                        )
                      }, { side: 'left', estimatedHeight: 180, containerKey: 'G_medical_conformity' })}
                    />
                    <Bar dataKey="pct" name={t('dashboard.monthlyReport.medicalConformity')} fill={SGTM_COLORS.orange} radius={[6, 6, 0, 0]}>
                      <LabelList dataKey="pct" position="top" fill={CHART_THEME.label} fontSize={10} fontWeight={600} formatter={(v) => `${safeNumber(v).toFixed(0)}%`} />
                    </Bar>
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
                    {displayedPoles.flatMap((pole) => {
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
              <h3 className="font-semibold text-sm leading-snug whitespace-normal break-words pr-2 print:pr-4 max-w-[95%] print:max-w-[92%] text-gray-900 dark:text-gray-100">{sectionTitle('sor_subcontractors')}</h3>
            </div>
            <div className="card-body">
              <div className="h-72">
                <ResponsiveContainer width="100%" height="100%">
                  <ComposedChart data={sorSubRows} margin={{ top: 35, right: 22, left: 8, bottom: 70 }}>
                    <CartesianGrid strokeDasharray="3 3" stroke={gridStyle.stroke} opacity={gridStyle.opacity} />
                    <XAxis dataKey="pole" angle={xAxisAngle} textAnchor={xAxisTextAnchor} height={xAxisHeight} {...axisCommon} />
                    <YAxis yAxisId="left" allowDecimals={false} {...axisCommon} />
                    <YAxis yAxisId="right" orientation="right" domain={[0, 100]} {...axisCommon} />
                    <Tooltip
                      {...tooltipDark}
                      content={makeSmartTooltip(({ payload: p, label }) => {
                        const pole = String(label || '')
                        const list = sections?.sor_subcontractors?.by_pole_projects?.[pole]
                        const total = payloadValue(p, 'total')
                        const closure = payloadValue(p, 'closurePct')
                        return (
                          <>
                            <div style={tooltipDark.labelStyle}>{t('dashboard.monthlyReport.deviationTooltipTitle')} - {pole}</div>
                            <div className="text-xs text-slate-200 mt-1">{t('dashboard.monthlyReport.totalDeviations')}: {fmtInt(total)}</div>
                            <div className="text-xs text-slate-200">{t('dashboard.monthlyReport.closureRate')}: {fmtPct2(closure)}</div>
                            <div className="mt-2">{renderPoleProjectTooltip(pole, list, (r) => r?.total)}</div>
                          </>
                        )
                      }, { side: 'right', containerKey: 'H_deviations_closure_subcontractors' })}
                    />
                    <Bar yAxisId="left" dataKey="total" name={t('dashboard.monthlyReport.totalDeviations')} fill={SGTM_COLORS.orange} radius={[6, 6, 0, 0]}>
                    </Bar>
                    <Line yAxisId="right" type="monotone" dataKey="closurePct" name={t('dashboard.monthlyReport.closureRate')} stroke={trendStroke} strokeWidth={2} dot={{ r: 3, fill: trendStroke }}>
                      <LabelList dataKey="closurePct" position="top" offset={12} fill={trendStroke} fontSize={9} fontWeight={600} formatter={(v) => `${safeNumber(v).toFixed(0)}%`} />
                    </Line>
                    <Customized component={makeCollisionBarLabels({ barKey: 'total', lineKey: 'closurePct', barAxisId: 'left', lineAxisId: 'right', formatter: (v) => fmtInt(v) })} />
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
                  <BarChart data={durationSubRows} margin={{ top: 35, right: 18, left: 8, bottom: 70 }}>
                    <CartesianGrid strokeDasharray="3 3" stroke={gridStyle.stroke} opacity={gridStyle.opacity} />
                    <XAxis dataKey="pole" angle={xAxisAngle} textAnchor={xAxisTextAnchor} height={xAxisHeight} {...axisCommon} />
                    <YAxis {...axisCommon} />
                    <Tooltip
                      {...tooltipDark}
                      content={makeSmartTooltip(({ payload: p, label }) => {
                        const pole = String(label || '')
                        const avg = payloadValue(p, 'avgHours')
                        const list = sections?.closure_duration_subcontractors?.by_pole_projects?.[pole]
                        const getProjectAvg = (r) => {
                          const v = r?.avg_hours ?? r?.avgHours ?? r?.hours ?? r?.value
                          return safeNumber(v)
                        }
                        return (
                          <>
                            <div style={tooltipDark.labelStyle}>{sectionTitle('closure_duration_subcontractors')} - {pole}</div>
                            <div className="text-xs text-slate-200 mt-1">{t('dashboard.monthlyReport.avgHours')}: {safeNumber(avg).toFixed(2)} {t('common.hourShort')}</div>
                            {Array.isArray(list) ? (
                              <div className="mt-2">{renderPoleProjectTooltip(pole, list, getProjectAvg, { maxRows: 8 })}</div>
                            ) : null}
                          </>
                        )
                      }, { side: 'left', estimatedHeight: 180, containerKey: 'I_closure_duration_subcontractors' })}
                    />
                    <Bar dataKey="avgHours" name={t('dashboard.monthlyReport.avgHours')} fill={SGTM_COLORS.orange} radius={[6, 6, 0, 0]}>
                      <LabelList dataKey="avgHours" position="top" fill={CHART_THEME.label} fontSize={10} fontWeight={600} formatter={(v) => safeNumber(v).toFixed(1)} />
                    </Bar>
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

          {/* J. TF/TG Comparison by Pole */}
          <div className="card overflow-visible" ref={(el) => { chartRefs.current['J_tf_tg'] = el }}>
            <div className="card-header">
              <h3 className="font-semibold text-gray-900 dark:text-gray-100">{sectionTitle('tf_tg')}</h3>
            </div>
            <div className="card-body">
              <div className="h-72">
                <ResponsiveContainer width="100%" height="100%">
                  <BarChart data={tfTgRows} margin={{ top: 35, right: 18, left: 8, bottom: 70 }}>
                    <CartesianGrid strokeDasharray="3 3" stroke={gridStyle.stroke} opacity={gridStyle.opacity} />
                    <XAxis dataKey="pole" angle={xAxisAngle} textAnchor={xAxisTextAnchor} height={xAxisHeight} {...axisCommon} />
                    <YAxis {...axisCommon} />
                    <Tooltip
                      {...tooltipDark}
                      content={makeSmartTooltip(({ payload: p, label }) => {
                        const pole = String(label || '')
                        const list = sections?.tf_tg?.by_pole_projects?.[pole]
                        const tf = payloadValue(p, 'tf')
                        const tg = payloadValue(p, 'tg')
                        return (
                          <>
                            <div style={tooltipDark.labelStyle}>{t('dashboard.monthlyReport.tfTgTooltipTitle')} - {pole}</div>
                            <div className="text-xs text-slate-200 mt-1">{t('dashboard.monthlyReport.tf')}: {fmt2(tf)}</div>
                            <div className="text-xs text-slate-200">{t('dashboard.monthlyReport.tg')}: {fmt2(tg)}</div>
                            <div className="mt-2">
                              {renderPoleProjectTooltip(pole, list, (r) => r?.tf, { maxRows: 8 })}
                            </div>
                          </>
                        )
                      }, { side: 'right', containerKey: 'J_tf_tg' })}
                    />
                    <Bar dataKey="tf" name={t('dashboard.monthlyReport.tf')} fill={SGTM_COLORS.orange} radius={[6, 6, 0, 0]}>
                      <LabelList dataKey="tf" content={renderTopLabelWithBg({ formatter: (v) => safeNumber(v).toFixed(2), textColor: '#111827' })} />
                    </Bar>
                    <Bar dataKey="tg" name={t('dashboard.monthlyReport.tg')} fill={SGTM_COLORS.deepOrange} radius={[6, 6, 0, 0]}>
                      <LabelList dataKey="tg" content={renderTopLabelWithBg({ formatter: (v) => safeNumber(v).toFixed(2), textColor: '#111827' })} />
                    </Bar>
                    <Customized
                      component={makeBottomLegend(
                        [
                          { type: 'box', color: SGTM_COLORS.orange, label: t('dashboard.monthlyReport.tf') },
                          { type: 'box', color: SGTM_COLORS.deepOrange, label: t('dashboard.monthlyReport.tg') },
                        ],
                        { textColor: legendTextColor }
                      )}
                    />
                  </BarChart>
                </ResponsiveContainer>
              </div>
            </div>
          </div>

          {/* K. Accidents vs Incidents by Pole */}
          <div className="card overflow-visible" ref={(el) => { chartRefs.current['K_accidents_incidents'] = el }}>
            <div className="card-header">
              <h3 className="font-semibold text-gray-900 dark:text-gray-100">{sectionTitle('accidents_incidents')}</h3>
            </div>
            <div className="card-body">
              <div className="h-72">
                <ResponsiveContainer width="100%" height="100%">
                  <BarChart data={accidentsIncidentsRows} margin={{ top: 35, right: 18, left: 8, bottom: 70 }}>
                    <CartesianGrid strokeDasharray="3 3" stroke={gridStyle.stroke} opacity={gridStyle.opacity} />
                    <XAxis dataKey="pole" angle={xAxisAngle} textAnchor={xAxisTextAnchor} height={xAxisHeight} {...axisCommon} />
                    <YAxis allowDecimals={false} {...axisCommon} />
                    <Tooltip
                      {...tooltipDark}
                      content={makeSmartTooltip(({ payload: p, label }) => {
                        const pole = String(label || '')
                        const list = sections?.accidents_incidents?.by_pole_projects?.[pole]
                        const accidents = payloadValue(p, 'accidents')
                        const incidents = payloadValue(p, 'incidents')
                        return (
                          <>
                            <div style={tooltipDark.labelStyle}>{t('dashboard.monthlyReport.accidentsIncidentsTooltipTitle')} - {pole}</div>
                            <div className="text-xs text-slate-200 mt-1">{t('dashboard.monthlyReport.accidents')}: {fmtInt(accidents)}</div>
                            <div className="text-xs text-slate-200">{t('dashboard.monthlyReport.incidents')}: {fmtInt(incidents)}</div>
                            <div className="mt-2">
                              {renderPoleProjectTooltip(pole, list, (r) => r?.accidents + r?.incidents, { maxRows: 8 })}
                            </div>
                          </>
                        )
                      }, { side: 'left', containerKey: 'K_accidents_incidents' })}
                    />
                    <Bar dataKey="accidents" name={t('dashboard.monthlyReport.accidents')} fill={SGTM_COLORS.statusBad} radius={[6, 6, 0, 0]}>
                      <LabelList dataKey="accidents" position="top" fill={CHART_THEME.label} fontSize={10} fontWeight={600} />
                    </Bar>
                    <Bar dataKey="incidents" name={t('dashboard.monthlyReport.incidents')} fill={SGTM_COLORS.orange} radius={[6, 6, 0, 0]}>
                      <LabelList dataKey="incidents" position="top" fill={CHART_THEME.label} fontSize={10} fontWeight={600} />
                    </Bar>
                    <Customized
                      component={makeBottomLegend(
                        [
                          { type: 'box', color: SGTM_COLORS.statusBad, label: t('dashboard.monthlyReport.accidents') },
                          { type: 'box', color: SGTM_COLORS.orange, label: t('dashboard.monthlyReport.incidents') },
                        ],
                        { textColor: legendTextColor }
                      )}
                    />
                  </BarChart>
                </ResponsiveContainer>
              </div>
            </div>
          </div>

          {/* L. PPE Consumption by Pole (Stacked) */}
          <div className="card overflow-visible" ref={(el) => { chartRefs.current['L_ppe_consumption'] = el }}>
            <div className="card-header">
              <h3 className="font-semibold text-gray-900 dark:text-gray-100">{sectionTitle('ppe_consumption')}</h3>
            </div>
            <div className="card-body">
              <div className="h-72">
                <ResponsiveContainer width="100%" height="100%">
                  <BarChart data={ppeConsumptionData.rows} margin={{ top: 35, right: 18, left: 8, bottom: 70 }}>
                    <CartesianGrid strokeDasharray="3 3" stroke={gridStyle.stroke} opacity={gridStyle.opacity} />
                    <XAxis dataKey="pole" angle={xAxisAngle} textAnchor={xAxisTextAnchor} height={xAxisHeight} {...axisCommon} />
                    <YAxis allowDecimals={false} {...axisCommon} />
                    <Tooltip
                      {...tooltipDark}
                      content={makeSmartTooltip(({ payload: p, label }) => {
                        const pole = String(label || '')
                        const list = sections?.ppe_consumption?.by_pole_projects?.[pole]
                        return (
                          <>
                            <div style={tooltipDark.labelStyle}>{t('dashboard.monthlyReport.ppeTooltipTitle')} - {pole}</div>
                            <div className="mt-2 space-y-1">
                              {p.filter((item) => safeNumber(item.value) > 0).map((item) => (
                                <div key={item.dataKey} className="flex items-center justify-between gap-3 text-xs text-slate-200">
                                  <span className="flex items-center gap-2">
                                    <span className="w-2.5 h-2.5 rounded" style={{ backgroundColor: item.color }} />
                                    {item.name}
                                  </span>
                                  <span className="font-semibold">{fmtInt(item.value)}</span>
                                </div>
                              ))}
                            </div>
                            {Array.isArray(list) && list.length > 0 && (
                              <div className="mt-2 pt-2 border-t border-gray-600">
                                <div className="text-[11px] text-slate-400 mb-1">{t('dashboard.monthlyReport.project')}</div>
                                {list.slice(0, 6).map((r) => (
                                  <div key={r.project_id} className="text-xs text-slate-300">{r.project_name}</div>
                                ))}
                                {list.length > 6 && <div className="text-xs text-slate-400">... +{list.length - 6}</div>}
                              </div>
                            )}
                          </>
                        )
                      }, { side: 'right', containerKey: 'L_ppe_consumption' })}
                    />
                    {ppeConsumptionData.itemIds.map((id, idx) => {
                      const colors = [SGTM_COLORS.orange, SGTM_COLORS.deepOrange, SGTM_COLORS.statusGood, SGTM_COLORS.gray, SGTM_COLORS.darkGray, '#6366F1', '#EC4899', '#14B8A6']
                      return (
                        <Bar
                          key={id}
                          dataKey={`item_${id}`}
                          name={ppeConsumptionData.itemNames[id] || `Item ${id}`}
                          stackId="ppe"
                          fill={colors[idx % colors.length]}
                        />
                      )
                    })}
                  </BarChart>
                </ResponsiveContainer>
              </div>
            </div>
          </div>

          {/* M. Heavy Machinery Count and Document Completion by Pole */}
          <div className="card overflow-visible" ref={(el) => { chartRefs.current['M_machinery'] = el }}>
            <div className="card-header">
              <h3 className="font-semibold text-gray-900 dark:text-gray-100">{sectionTitle('machinery')}</h3>
            </div>
            <div className="card-body">
              <div className="h-72">
                <ResponsiveContainer width="100%" height="100%">
                  <ComposedChart data={machineryRows} margin={{ top: 35, right: 22, left: 8, bottom: 70 }}>
                    <CartesianGrid strokeDasharray="3 3" stroke={gridStyle.stroke} opacity={gridStyle.opacity} />
                    <XAxis dataKey="pole" angle={xAxisAngle} textAnchor={xAxisTextAnchor} height={xAxisHeight} {...axisCommon} />
                    <YAxis yAxisId="left" allowDecimals={false} {...axisCommon} />
                    <YAxis yAxisId="right" orientation="right" domain={[0, 100]} {...axisCommon} />
                    <Tooltip
                      {...tooltipDark}
                      content={makeSmartTooltip(({ payload: p, label }) => {
                        const pole = String(label || '')
                        const list = sections?.machinery?.by_pole_projects?.[pole]
                        const count = payloadValue(p, 'count')
                        const completion = payloadValue(p, 'avgCompletion')
                        return (
                          <>
                            <div style={tooltipDark.labelStyle}>{t('dashboard.monthlyReport.machineryTooltipTitle')} - {pole}</div>
                            <div className="text-xs text-slate-200 mt-1">{t('dashboard.monthlyReport.machineCount')}: {fmtInt(count)}</div>
                            <div className="text-xs text-slate-200">{t('dashboard.monthlyReport.avgCompletion')}: {fmtPct2(completion)}</div>
                            <div className="mt-2">
                              {renderPoleProjectTooltip(pole, list, (r) => r?.machine_count, { maxRows: 8 })}
                            </div>
                          </>
                        )
                      }, { side: 'left', containerKey: 'M_machinery' })}
                    />
                    <Bar yAxisId="left" dataKey="count" name={t('dashboard.monthlyReport.machineCount')} fill={SGTM_COLORS.orange} radius={[6, 6, 0, 0]}>
                    </Bar>
                    <Line yAxisId="right" type="monotone" dataKey="avgCompletion" name={t('dashboard.monthlyReport.avgCompletion')} stroke={trendStroke} strokeWidth={2} dot={{ r: 3, fill: trendStroke }}>
                      <LabelList dataKey="avgCompletion" position="top" offset={12} fill={trendStroke} fontSize={9} fontWeight={600} formatter={(v) => `${safeNumber(v).toFixed(0)}%`} />
                    </Line>
                    <Customized component={makeCollisionBarLabels({ barKey: 'count', lineKey: 'avgCompletion', barAxisId: 'left', lineAxisId: 'right', formatter: (v) => fmtInt(v) })} />
                    <Customized
                      component={makeBottomLegend(
                        [
                          { type: 'box', color: SGTM_COLORS.orange, label: t('dashboard.monthlyReport.machineCount') },
                          { type: 'line', color: trendStroke, label: t('dashboard.monthlyReport.avgCompletion') },
                        ],
                        { textColor: legendTextColor }
                      )}
                    />
                  </ComposedChart>
                </ResponsiveContainer>
              </div>
            </div>
          </div>

          {/* N. Inspections Count by Pole */}
          <div className="card overflow-visible" ref={(el) => { chartRefs.current['N_inspections'] = el }}>
            <div className="card-header">
              <h3 className="font-semibold text-gray-900 dark:text-gray-100">{sectionTitle('inspections')}</h3>
            </div>
            <div className="card-body">
              <div className="h-72">
                <ResponsiveContainer width="100%" height="100%">
                  <BarChart data={inspectionsRows} margin={{ top: 35, right: 22, left: 8, bottom: 70 }}>
                    <CartesianGrid strokeDasharray="3 3" stroke={gridStyle.stroke} opacity={gridStyle.opacity} />
                    <XAxis dataKey="pole" angle={xAxisAngle} textAnchor={xAxisTextAnchor} height={xAxisHeight} {...axisCommon} />
                    <YAxis allowDecimals={false} {...axisCommon} />
                    <Tooltip
                      {...tooltipDark}
                      content={makeSmartTooltip(({ payload: p, label }) => {
                        const pole = String(label || '')
                        const list = sections?.inspections?.by_pole_projects?.[pole]
                        const count = payloadValue(p, 'count')
                        return (
                          <>
                            <div style={tooltipDark.labelStyle}>{t('dashboard.monthlyReport.inspectionsTooltipTitle')} - {pole}</div>
                            <div className="text-xs text-slate-200 mt-1">{t('common.total')}: {fmtInt(count)}</div>
                            <div className="mt-2">
                              {renderPoleProjectTooltip(pole, list, (r) => r?.count, { maxRows: 8 })}
                            </div>
                          </>
                        )
                      }, { side: 'right', containerKey: 'N_inspections' })}
                    />
                    <Bar dataKey="count" name={t('common.total')} fill={SGTM_COLORS.orange} radius={[6, 6, 0, 0]}>
                      <LabelList dataKey="count" position="top" fill={CHART_THEME.label} fontSize={11} fontWeight={600} />
                    </Bar>
                    <Customized
                      component={makeBottomLegend(
                        [{ type: 'box', color: SGTM_COLORS.orange, label: t('common.total') }],
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
