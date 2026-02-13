import { useEffect, useMemo, useRef, useState } from 'react'
import { createPortal } from 'react-dom'
import { ChevronLeft, ChevronRight, Calendar } from 'lucide-react'
import { useLanguage } from '../../i18n'

const pad2 = (n) => String(Math.max(0, Math.trunc(n))).padStart(2, '0')

const parseMonthKey = (value) => {
  const raw = String(value || '')
  const m = raw.match(/^(\d{4})-(\d{2})$/)
  if (!m) return null
  const y = Number(m[1])
  const mo = Number(m[2])
  if (!Number.isFinite(y) || !Number.isFinite(mo) || mo < 1 || mo > 12) return null
  return { year: y, month: mo }
}

const toMonthKey = (year, month) => `${year}-${pad2(month)}`

export default function MonthPicker({ value, onChange, placeholder, className = '', required = false, disabled = false, defaultYear }) {
  const { t, language } = useLanguage()
  const [isOpen, setIsOpen] = useState(false)
  const [viewYear, setViewYear] = useState(() => {
    const parsed = parseMonthKey(value)
    const fallbackYear = Number(defaultYear)
    return parsed?.year ?? (Number.isFinite(fallbackYear) ? fallbackYear : new Date().getFullYear())
  })
  const [popoverPos, setPopoverPos] = useState({ top: 0, left: 0, placement: 'bottom' })
  const containerRef = useRef(null)
  const triggerRef = useRef(null)
  const popoverRef = useRef(null)
  const rafRef = useRef(null)

  useEffect(() => {
    const parsed = parseMonthKey(value)
    if (parsed?.year) setViewYear(parsed.year)
  }, [value])

  useEffect(() => {
    const parsed = parseMonthKey(value)
    if (parsed?.year) return
    const y = Number(defaultYear)
    if (!Number.isFinite(y)) return
    setViewYear(y)
  }, [defaultYear, value])

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

      const width = 272
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
  }, [isOpen, viewYear])

  const monthsShort = t('datePicker.months')
  const monthsFull = t('datePicker.monthsFull')

  const items = useMemo(() => {
    return Array.from({ length: 12 }, (_, i) => ({
      month: i + 1,
      label: monthsShort?.[i] ?? String(i + 1),
    }))
  }, [monthsShort])

  const formatDisplayValue = () => {
    const parsed = parseMonthKey(value)
    if (!parsed) return ''
    const locale = language === 'fr' ? 'fr-FR' : 'en-US'
    const d = new Date(parsed.year, parsed.month - 1, 1)
    try {
      return d.toLocaleDateString(locale, { month: 'long', year: 'numeric' })
    } catch {
      return `${monthsFull?.[parsed.month - 1] ?? parsed.month} ${parsed.year}`
    }
  }

  const handleSelect = (month) => {
    onChange(toMonthKey(viewYear, month))
    setIsOpen(false)
  }

  const selected = parseMonthKey(value)

  return (
    <div ref={containerRef} className={`relative ${className}`}>
      <div
        onClick={() => !disabled && setIsOpen(!isOpen)}
        ref={triggerRef}
        className={`input flex items-center justify-between cursor-pointer ${disabled ? 'opacity-50 cursor-not-allowed' : ''}`}
      >
        <span className={value ? 'text-gray-900 dark:text-gray-100' : 'text-gray-400 dark:text-gray-500'}>
          {formatDisplayValue() ?? placeholder ?? t('datePicker.select')}
        </span>
        <Calendar className="w-4 h-4 text-gray-400" />
      </div>
      <input type="hidden" value={value ?? ''} required={required} />

      {isOpen &&
        createPortal(
          <div
            ref={popoverRef}
            style={{ top: popoverPos.top, left: popoverPos.left, width: 272 }}
            className="fixed z-[9999] max-h-[calc(100vh-96px)] overflow-auto bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-lg shadow-lg p-2"
          >
            <div className="flex items-center justify-between mb-2">
              <button type="button" onClick={() => setViewYear((y) => y - 1)} className="p-1 hover:bg-gray-100 dark:hover:bg-gray-700 rounded">
                <ChevronLeft className="w-4 h-4 text-gray-600 dark:text-gray-400" />
              </button>
              <div className="font-medium text-sm text-gray-900 dark:text-gray-100">{viewYear}</div>
              <button type="button" onClick={() => setViewYear((y) => y + 1)} className="p-1 hover:bg-gray-100 dark:hover:bg-gray-700 rounded">
                <ChevronRight className="w-4 h-4 text-gray-600 dark:text-gray-400" />
              </button>
            </div>

            <div className="grid grid-cols-3 gap-1">
              {items.map((m) => {
                const isSelected = selected?.year === viewYear && selected?.month === m.month
                return (
                  <button
                    key={m.month}
                    type="button"
                    onClick={() => handleSelect(m.month)}
                    className={`py-2 text-xs rounded transition-colors
                      ${isSelected ? 'bg-hse-primary text-white' : 'text-gray-700 dark:text-gray-300 hover:bg-gray-100 dark:hover:bg-gray-700'}`}
                  >
                    {m.label}
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
