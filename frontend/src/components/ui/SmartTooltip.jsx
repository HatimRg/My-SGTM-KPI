import { useEffect, useLayoutEffect, useMemo, useRef, useState } from 'react'
import { createPortal } from 'react-dom'
import { Tooltip as RechartsTooltip } from 'recharts'

const getDocumentBody = () => (typeof document !== 'undefined' ? document.body : null)

const defaultFormatValue = (value) => {
  if (value === null || value === undefined) return ''
  if (typeof value === 'number' && Number.isFinite(value)) return String(value)
  return String(value)
}

const DefaultTooltipContent = function DefaultTooltipContent({ active, label, payload, contentStyle, labelStyle, itemStyle }) {
  if (!active || !Array.isArray(payload) || payload.length === 0) return null

  const rootStyle = {
    backgroundColor: 'white',
    ...(contentStyle ?? {}),
  }

  const resolvedLabelStyle = {
    ...(labelStyle ?? {}),
  }

  const resolvedItemStyle = {
    ...(itemStyle ?? {}),
  }

  return (
    <div
      className="border border-gray-200 dark:border-gray-700 rounded-lg p-3 shadow-lg"
      style={rootStyle}
    >
      {label !== undefined && label !== null && String(label) !== '' && (
        <p
          className="font-semibold text-gray-900 dark:text-gray-100 text-sm mb-2"
          style={resolvedLabelStyle}
        >
          {String(label)}
        </p>
      )}
      <div className="space-y-1">
        {payload.map((p) => (
          <div key={String(p?.dataKey ?? p?.name ?? Math.random())} className="flex items-center justify-between gap-3">
            <div className="flex items-center gap-2">
              <span
                className="inline-block w-2.5 h-2.5 rounded"
                style={{ backgroundColor: p?.color ?? '#111827' }}
              />
              <span className="text-xs text-gray-700 dark:text-gray-200" style={resolvedItemStyle}>{String(p?.name ?? '')}</span>
            </div>
            <span className="text-xs font-semibold text-gray-900 dark:text-gray-100" style={resolvedItemStyle}>{defaultFormatValue(p?.value)}</span>
          </div>
        ))}
      </div>
    </div>
  )
}

const useMousePosition = () => {
  const [pos, setPos] = useState({ x: 0, y: 0 })

  useEffect(() => {
    const onMove = (e) => {
      setPos({ x: e.clientX, y: e.clientY })
    }
    window.addEventListener('mousemove', onMove, { passive: true })
    return () => window.removeEventListener('mousemove', onMove)
  }, [])

  return pos
}

const SmartTooltipPortal = function SmartTooltipPortal({
  active,
  payload,
  label,
  content,
  contentStyle,
  labelStyle,
  itemStyle,
  maxWidth = 420,
  viewportPadding = 12,
  maxHeightPadding = 12,
}) {
  const mouse = useMousePosition()
  const body = useMemo(() => getDocumentBody(), [])
  const ref = useRef(null)
  const [size, setSize] = useState({ w: 0, h: 0 })

  const rendered = useMemo(() => {
    if (!active) return null

    if (typeof content === 'function') {
      return content({ active, payload, label })
    }

    if (content) {
      const C = content
      return <C active={active} payload={payload} label={label} />
    }

    return (
      <DefaultTooltipContent
        active={active}
        payload={payload}
        label={label}
        contentStyle={contentStyle}
        labelStyle={labelStyle}
        itemStyle={itemStyle}
      />
    )
  }, [active, content, contentStyle, itemStyle, label, labelStyle, payload])

  useLayoutEffect(() => {
    if (!active) return
    if (!ref.current) return

    const rect = ref.current.getBoundingClientRect()
    setSize({ w: rect.width, h: rect.height })
  }, [active, rendered])

  if (!active || !rendered || !body) return null

  const vw = typeof window !== 'undefined' ? window.innerWidth : 0
  const vh = typeof window !== 'undefined' ? window.innerHeight : 0

  const desiredLeft = mouse.x + viewportPadding
  const desiredTop = mouse.y + viewportPadding

  const fitsRight = desiredLeft + size.w + viewportPadding <= vw
  const fitsBottom = desiredTop + size.h + viewportPadding <= vh

  const left = fitsRight ? desiredLeft : Math.max(viewportPadding, mouse.x - size.w - viewportPadding)
  const top = fitsBottom ? desiredTop : Math.max(viewportPadding, mouse.y - size.h - viewportPadding)

  const maxHeight = Math.max(120, vh - maxHeightPadding * 2)

  return createPortal(
    <div
      ref={ref}
      style={{
        position: 'fixed',
        left,
        top,
        zIndex: 99999,
        pointerEvents: 'none',
        maxWidth,
        maxHeight,
        overflow: 'auto',
      }}
    >
      {rendered}
    </div>,
    body
  )
}

export default function SmartTooltip({ content, maxWidth, viewportPadding, maxHeightPadding, ...rest }) {
  return (
    <RechartsTooltip
      {...rest}
      wrapperStyle={{
        ...(rest.wrapperStyle ?? {}),
        position: 'fixed',
        top: 0,
        left: 0,
        width: 0,
        height: 0,
        overflow: 'hidden',
        visibility: 'hidden',
        pointerEvents: 'none',
      }}
      content={(props) => (
        <SmartTooltipPortal
          {...props}
          content={content}
          contentStyle={rest.contentStyle}
          labelStyle={rest.labelStyle}
          itemStyle={rest.itemStyle}
          maxWidth={maxWidth}
          viewportPadding={viewportPadding}
          maxHeightPadding={maxHeightPadding}
        />
      )}
    />
  )
}
