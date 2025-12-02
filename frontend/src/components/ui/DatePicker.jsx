import { useState, useRef, useEffect } from 'react'
import { Calendar, ChevronLeft, ChevronRight } from 'lucide-react'
import { useLanguage } from '../../i18n'

export default function DatePicker({ value, onChange, placeholder, className = '', required = false, disabled = false }) {
  const { t, language } = useLanguage()
  const [isOpen, setIsOpen] = useState(false)
  const [viewDate, setViewDate] = useState(() => (value ? new Date(value) : new Date()))
  const [viewMode, setViewMode] = useState('days') // 'days' | 'months'
  const containerRef = useRef(null)
  
  const days = t('datePicker.days')
  const months = t('datePicker.months')
  const monthsFull = t('datePicker.monthsFull')

  useEffect(() => {
    const handleClickOutside = (e) => {
      if (containerRef.current && !containerRef.current.contains(e.target)) setIsOpen(false)
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

  const getDaysInMonth = (date) => {
    const year = date.getFullYear()
    const month = date.getMonth()
    const firstDay = new Date(year, month, 1)
    const lastDay = new Date(year, month + 1, 0)
    const days = []
    const prevMonth = new Date(year, month, 0)

    for (let i = firstDay.getDay() - 1; i >= 0; i--) {
      days.push({ date: new Date(year, month - 1, prevMonth.getDate() - i), isCurrentMonth: false })
    }

    for (let i = 1; i <= lastDay.getDate(); i++) {
      days.push({ date: new Date(year, month, i), isCurrentMonth: true })
    }

    const totalCells = 42 // 6 rows of 7 days to always show full month
    const remaining = totalCells - days.length
    for (let i = 1; i <= Math.max(0, remaining); i++) {
      days.push({ date: new Date(year, month + 1, i), isCurrentMonth: false })
    }

    return days.slice(0, totalCells)
  }

  const formatDateValue = (date) => {
    const year = date.getFullYear()
    const month = String(date.getMonth() + 1).padStart(2, '0')
    const day = String(date.getDate()).padStart(2, '0')
    return `${year}-${month}-${day}`
  }

  const handleDateSelect = (date) => {
    onChange(formatDateValue(date))
    setIsOpen(false)
    setViewMode('days')
  }

  const handleMonthSelect = (monthIndex) => {
    setViewDate(new Date(viewDate.getFullYear(), monthIndex, 1))
    setViewMode('days')
  }

  const isToday = (date) => date.toDateString() === new Date().toDateString()
  const isSelected = (date) => value && formatDateValue(date) === value

  const formatDisplayValue = () => {
    if (!value) return ''
    const [y, m, d] = value.split('-').map(Number)
    if (!y || !m || !d) return ''
    const locale = language === 'fr' ? 'fr-FR' : 'en-US'
    const date = new Date(y, m - 1, d)
    return date.toLocaleDateString(locale, { day: '2-digit', month: '2-digit', year: 'numeric' })
  }

  return (
    <div ref={containerRef} className={`relative ${className}`}>
      <div
        onClick={() => !disabled && setIsOpen(!isOpen)}
        className={`input flex items-center justify-between cursor-pointer ${disabled ? 'opacity-50 cursor-not-allowed' : ''}`}
      >
        <span className={value ? 'text-gray-900 dark:text-gray-100' : 'text-gray-400 dark:text-gray-500'}>
          {formatDisplayValue() || placeholder || t('datePicker.select')}
        </span>
        <Calendar className="w-4 h-4 text-gray-400" />
      </div>
      <input type="hidden" value={value || ''} required={required} />

      {isOpen && (
        <div className="absolute z-[100] mt-1 bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-lg shadow-lg p-2 w-64">
          <div className="flex items-center justify-between mb-2">
            <button type="button" onClick={() => setViewDate(prev => new Date(prev.getFullYear() - (viewMode === 'months' ? 1 : 0), prev.getMonth() - (viewMode === 'days' ? 1 : 0), 1))} className="p-1 hover:bg-gray-100 dark:hover:bg-gray-700 rounded">
              <ChevronLeft className="w-4 h-4 text-gray-600 dark:text-gray-400" />
            </button>
            <button 
              type="button" 
              onClick={() => setViewMode(viewMode === 'days' ? 'months' : 'days')}
              className="font-medium text-sm text-gray-900 dark:text-gray-100 hover:text-hse-primary dark:hover:text-hse-primary px-2 py-0.5 rounded hover:bg-gray-100 dark:hover:bg-gray-700"
            >
              {monthsFull[viewDate.getMonth()]} {viewDate.getFullYear()}
            </button>
            <button type="button" onClick={() => setViewDate(prev => new Date(prev.getFullYear() + (viewMode === 'months' ? 1 : 0), prev.getMonth() + (viewMode === 'days' ? 1 : 0), 1))} className="p-1 hover:bg-gray-100 dark:hover:bg-gray-700 rounded">
              <ChevronRight className="w-4 h-4 text-gray-600 dark:text-gray-400" />
            </button>
          </div>

          {viewMode === 'months' ? (
            <div className="grid grid-cols-3 gap-1">
              {months.map((month, i) => (
                <button
                  key={month}
                  type="button"
                  onClick={() => handleMonthSelect(i)}
                  className={`py-2 text-xs rounded transition-colors
                    ${viewDate.getMonth() === i ? 'bg-hse-primary text-white' : 'text-gray-700 dark:text-gray-300 hover:bg-gray-100 dark:hover:bg-gray-700'}`}
                >
                  {month}
                </button>
              ))}
            </div>
          ) : (
            <>
              <div className="grid grid-cols-7 gap-0.5 mb-1">
                {days.map(day => (
                  <div key={day} className="text-center text-[10px] font-medium text-gray-500 dark:text-gray-400 py-0.5">{day}</div>
                ))}
              </div>
              <div className="grid grid-cols-7 gap-0.5">
                {getDaysInMonth(viewDate).map((day, i) => (
                  <button
                    key={i}
                    type="button"
                    onClick={() => handleDateSelect(day.date)}
                    className={`p-1.5 text-xs rounded transition-colors
                      ${!day.isCurrentMonth ? 'text-gray-300 dark:text-gray-600' : 'text-gray-900 dark:text-gray-100'}
                      ${isToday(day.date) ? 'ring-1 ring-hse-primary' : ''}
                      ${isSelected(day.date) ? 'bg-hse-primary text-white' : 'hover:bg-gray-100 dark:hover:bg-gray-700'}`}
                  >
                    {day.date.getDate()}
                  </button>
                ))}
              </div>
            </>
          )}
          <div className="mt-2 pt-2 border-t border-gray-200 dark:border-gray-700">
            <button type="button" onClick={() => handleDateSelect(new Date())} className="w-full text-xs text-hse-primary hover:underline">
              {t('datePicker.today')}
            </button>
          </div>
        </div>
      )}
    </div>
  )
}
