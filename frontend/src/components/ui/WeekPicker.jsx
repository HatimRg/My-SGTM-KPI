import { useEffect, useMemo, useRef, useState } from 'react'
import { createPortal } from 'react-dom'
import { Calendar, ChevronLeft, ChevronRight } from 'lucide-react'
import { useLanguage } from '../../i18n'
import { formatDateShort, getAllWeeksForYear, getCurrentWeek } from '../../utils/weekHelper'

const pad2 = (n) => String(Math.max(0, Math.trunc(n))).padStart(2, '0')

const parseWeekKey = (value) => {
  const raw = String(value || '')
  const m = raw.match(/^(\d{4})-W(\d{2})$/)
  if (!m) return null
  const weekYear = Number(m[1])
  const week = Number(m[2])
  if (!Number.isFinite(weekYear) || !Number.isFinite(week) || week < 1 || week > 52) return null
  return { weekYear, week }
}

export default function WeekPicker({ value, onChange, placeholder, className = '', required = false, disabled = false }) {
  const { t, language } = useLanguage()
  const [isOpen, setIsOpen] = useState(false)
  const [cursorYear, setCursorYear] = useState(() => {
    const cur = getCurrentWeek()
    return Number.isFinite(cur?.year) ? cur.year : new Date().getFullYear()
  })
  const [popoverPos, setPopoverPos] = useState({ top: 0, left: 0, placement: 'bottom' })
  const containerRef = useRef(null)
  const triggerRef = useRef(null)
  const popoverRef = useRef(null)
  const rafRef = useRef(null)

  useEffect(() => {
    const parsed = parseWeekKey(value)
    if (!parsed) return

    setCursorYear(parsed.weekYear)
  }, [value])

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

      const width = 360
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

  const weeks = useMemo(() => getAllWeeksForYear(cursorYear), [cursorYear])

  const displayValue = useMemo(() => {
    const parsed = parseWeekKey(value)
    if (!parsed) return ''
    return `W${pad2(parsed.week)} ${parsed.weekYear}`
  }, [value])

  const locale = language === 'fr' ? 'fr-FR' : 'en-US'

  return (
    <div ref={containerRef} className={`relative ${className}`}>
      <div
        onClick={() => !disabled && setIsOpen(!isOpen)}
        ref={triggerRef}
        className={`input flex items-center justify-between cursor-pointer ${disabled ? 'opacity-50 cursor-not-allowed' : ''}`}
      >
        <span className={value ? 'text-gray-900 dark:text-gray-100' : 'text-gray-400 dark:text-gray-500'}>
          {displayValue || placeholder || t('datePicker.select')}
        </span>
        <Calendar className="w-4 h-4 text-gray-400" />
      </div>
      <input type="hidden" value={value ?? ''} required={required} />

      {isOpen &&
        createPortal(
          <div
            ref={popoverRef}
            style={{ top: popoverPos.top, left: popoverPos.left, width: 360 }}
            className="fixed z-[9999] max-h-[calc(100vh-96px)] overflow-auto bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-lg shadow-lg p-2"
          >
            <div className="flex items-center justify-between mb-2">
              <button type="button" onClick={() => setCursorYear((y) => y - 1)} className="p-1 hover:bg-gray-100 dark:hover:bg-gray-700 rounded">
                <ChevronLeft className="w-4 h-4 text-gray-600 dark:text-gray-400" />
              </button>
              <div className="font-medium text-sm text-gray-900 dark:text-gray-100">
                {cursorYear}
              </div>
              <button type="button" onClick={() => setCursorYear((y) => y + 1)} className="p-1 hover:bg-gray-100 dark:hover:bg-gray-700 rounded">
                <ChevronRight className="w-4 h-4 text-gray-600 dark:text-gray-400" />
              </button>
            </div>

            <div className="space-y-1">
              {weeks.map((w) => {
                const key = `${w.year}-W${pad2(w.week)}`
                const active = String(value) === key
                const label = `W${pad2(w.week)} (${formatDateShort(w.start_date)} - ${formatDateShort(w.end_date)})`

                return (
                  <button
                    key={key}
                    type="button"
                    onClick={() => {
                      onChange(key)
                      setIsOpen(false)
                    }}
                    className={`w-full flex items-center justify-between gap-3 rounded-lg px-2 py-2 border transition-colors
                      ${active ? 'bg-hse-primary border-hse-primary text-white' : 'bg-transparent border-transparent hover:bg-gray-50 dark:hover:bg-gray-700 text-gray-700 dark:text-gray-200'}`}
                  >
                    <span className={`text-sm font-semibold ${active ? 'text-white' : 'text-gray-900 dark:text-gray-100'}`}>
                      W{pad2(w.week)}
                    </span>
                    <span className={`text-xs ${active ? 'text-white' : 'text-gray-500 dark:text-gray-400'}`}>
                      {label}
                    </span>
                  </button>
                )
              })}
            </div>

            <div className="mt-2 pt-2 border-t border-gray-200 dark:border-gray-700">
              <button
                type="button"
                onClick={() => {
                  const cur = getCurrentWeek()
                  const key = cur ? `${cur.year}-W${pad2(cur.week)}` : ''
                  if (key) onChange(key)
                  setIsOpen(false)
                }}
                className="w-full text-xs text-hse-primary hover:underline"
              >
                {t('datePicker.today')}
              </button>
            </div>
          </div>,
          document.body,
        )}
    </div>
  )
}
