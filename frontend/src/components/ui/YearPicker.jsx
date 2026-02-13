import { useEffect, useMemo, useRef, useState } from 'react'
import { createPortal } from 'react-dom'
import { Calendar, ChevronLeft, ChevronRight } from 'lucide-react'

const clamp = (v, min, max) => Math.max(min, Math.min(max, v))

const parseYear = (value) => {
  const raw = String(value ?? '').trim()
  if (!raw) return null
  const y = Number(raw)
  if (!Number.isFinite(y)) return null
  return Math.trunc(y)
}

export default function YearPicker({ value, onChange, placeholder, className = '', required = false, disabled = false, minYear = 2000, maxYear = 2100 }) {
  const selectedYear = parseYear(value)

  const [isOpen, setIsOpen] = useState(false)
  const [cursorYear, setCursorYear] = useState(() => selectedYear ?? new Date().getFullYear())
  const [popoverPos, setPopoverPos] = useState({ top: 0, left: 0, placement: 'bottom' })
  const containerRef = useRef(null)
  const triggerRef = useRef(null)
  const popoverRef = useRef(null)
  const rafRef = useRef(null)

  useEffect(() => {
    if (selectedYear) setCursorYear(selectedYear)
  }, [selectedYear])

  useEffect(() => {
    const handleClickOutside = (e) => {
      const inContainer = containerRef.current && containerRef.current.contains(e.target)
      const inPopover = popoverRef.current && popoverRef.current.contains(e.target)
      if (!inContainer && !inPopover) setIsOpen(false)
    }
    const handleKeyDown = (e) => {
      if (e.key === 'Escape') setIsOpen(false)
    }
    if (isOpen) {
      document.addEventListener('mousedown', handleClickOutside)
      document.addEventListener('keydown', handleKeyDown)
    }
    return () => {
      document.removeEventListener('mousedown', handleClickOutside)
      document.removeEventListener('keydown', handleKeyDown)
    }
  }, [isOpen])

  useEffect(() => {
    if (!isOpen) return

    const updatePosition = () => {
      const rect = triggerRef.current?.getBoundingClientRect()
      if (!rect) return

      const width = 256
      const padding = 8

      let left = rect.left
      if (left + width > window.innerWidth - padding) {
        left = Math.max(padding, window.innerWidth - width - padding)
      }

      const top = rect.bottom + 4
      setPopoverPos((prev) => {
        if (prev.top === top && prev.left === left && prev.placement === 'bottom') return prev
        return { top, left, placement: 'bottom' }
      })
    }

    updatePosition()

    const scheduleUpdate = () => {
      if (rafRef.current) return
      rafRef.current = requestAnimationFrame(() => {
        rafRef.current = null
        updatePosition()
      })
    }

    window.addEventListener('resize', scheduleUpdate)
    window.addEventListener('scroll', scheduleUpdate, { capture: true, passive: true })

    return () => {
      window.removeEventListener('resize', scheduleUpdate)
      window.removeEventListener('scroll', scheduleUpdate, true)
      if (rafRef.current) {
        cancelAnimationFrame(rafRef.current)
        rafRef.current = null
      }
    }
  }, [isOpen])

  useEffect(() => {
    if (!isOpen) return
    const rect = triggerRef.current?.getBoundingClientRect()
    const popRect = popoverRef.current?.getBoundingClientRect()
    if (!rect || !popRect) return

    const padding = 8
    const topbarSafeTop = 72
    const overBottom = popRect.bottom > window.innerHeight - padding
    if (overBottom) {
      const top = Math.max(topbarSafeTop, rect.top - popRect.height - 4)
      setPopoverPos((p) => ({ ...p, top, placement: 'top' }))
    }
  }, [isOpen, cursorYear])

  const rangeStart = useMemo(() => {
    const span = 12
    const half = Math.floor(span / 2)
    const base = cursorYear - half
    return clamp(base, minYear, Math.max(minYear, maxYear - (span - 1)))
  }, [cursorYear, minYear, maxYear])

  const years = useMemo(() => Array.from({ length: 12 }, (_, i) => rangeStart + i), [rangeStart])

  return (
    <div ref={containerRef} className={`relative ${className}`}>
      <div
        onClick={() => !disabled && setIsOpen(!isOpen)}
        ref={triggerRef}
        className={`input flex items-center justify-between cursor-pointer ${disabled ? 'opacity-50 cursor-not-allowed' : ''}`}
      >
        <span className={value ? 'text-gray-900 dark:text-gray-100' : 'text-gray-400 dark:text-gray-500'}>
          {selectedYear ? String(selectedYear) : (placeholder ?? '—')}
        </span>
        <Calendar className="w-4 h-4 text-gray-400" />
      </div>
      <input type="hidden" value={value ?? ''} required={required} />

      {isOpen &&
        createPortal(
          <div
            ref={popoverRef}
            style={{ top: popoverPos.top, left: popoverPos.left, width: 256 }}
            className="fixed z-[9999] max-h-[calc(100vh-96px)] overflow-auto bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-lg shadow-lg p-2"
          >
            <div className="flex items-center justify-between mb-2">
              <button type="button" onClick={() => setCursorYear((y) => y - 12)} className="p-1 hover:bg-gray-100 dark:hover:bg-gray-700 rounded">
                <ChevronLeft className="w-4 h-4 text-gray-600 dark:text-gray-400" />
              </button>
              <div className="font-medium text-sm text-gray-900 dark:text-gray-100">
                {years[0]} - {years[years.length - 1]}
              </div>
              <button type="button" onClick={() => setCursorYear((y) => y + 12)} className="p-1 hover:bg-gray-100 dark:hover:bg-gray-700 rounded">
                <ChevronRight className="w-4 h-4 text-gray-600 dark:text-gray-400" />
              </button>
            </div>

            <div className="grid grid-cols-3 gap-1">
              {years.map((y) => {
                const active = selectedYear === y
                return (
                  <button
                    key={y}
                    type="button"
                    onClick={() => {
                      onChange(String(y))
                      setIsOpen(false)
                    }}
                    className={`py-2 text-xs rounded transition-colors
                      ${active ? 'bg-hse-primary text-white' : 'text-gray-700 dark:text-gray-300 hover:bg-gray-100 dark:hover:bg-gray-700'}`}
                  >
                    {y}
                  </button>
                )
              })}
            </div>
          </div>,
          document.body,
        )}
    </div>
  )
}
