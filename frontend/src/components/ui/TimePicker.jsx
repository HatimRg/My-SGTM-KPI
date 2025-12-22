import { useState, useRef, useEffect } from 'react'
import { Clock, ChevronUp, ChevronDown } from 'lucide-react'

export default function TimePicker({ value, onChange, placeholder = 'HH:MM', className = '', disabled = false }) {
  const [isOpen, setIsOpen] = useState(false)
  const containerRef = useRef(null)
  
  const [hours, setHours] = useState(() => {
    if (value) return parseInt(value.split(':')[0])
    return new Date().getHours()
  })
  const [minutes, setMinutes] = useState(() => {
    if (value) return parseInt(value.split(':')[1])
    return Math.floor(new Date().getMinutes() / 5) * 5 // Round to nearest 5
  })

  useEffect(() => {
    if (value) {
      const [h, m] = value.split(':')
      const hNum = Number.parseInt(h, 10)
      const mNum = Number.parseInt(m, 10)
      setHours(Number.isFinite(hNum) ? hNum : 0)
      setMinutes(Number.isFinite(mNum) ? mNum : 0)
    }
  }, [value])

  useEffect(() => {
    const handleClickOutside = (e) => {
      if (containerRef.current && !containerRef.current.contains(e.target)) setIsOpen(false)
    }
    const handleKeyDown = (e) => { if (e.key === 'Escape') setIsOpen(false) }
    if (isOpen) {
      document.addEventListener('mousedown', handleClickOutside)
      document.addEventListener('keydown', handleKeyDown)
    }
    return () => {
      document.removeEventListener('mousedown', handleClickOutside)
      document.removeEventListener('keydown', handleKeyDown)
    }
  }, [isOpen])

  const formatTime = (h, m) => `${String(h).padStart(2, '0')}:${String(m).padStart(2, '0')}`

  const handleTimeChange = (newHours, newMinutes) => {
    const h = Math.max(0, Math.min(23, newHours))
    const m = Math.max(0, Math.min(59, newMinutes))
    setHours(h)
    setMinutes(m)
    onChange(formatTime(h, m))
  }

  const incrementHours = () => handleTimeChange((hours + 1) % 24, minutes)
  const decrementHours = () => handleTimeChange((hours - 1 + 24) % 24, minutes)
  const incrementMinutes = () => handleTimeChange(hours, (minutes + 5) % 60)
  const decrementMinutes = () => handleTimeChange(hours, (minutes - 5 + 60) % 60)

  const quickTimes = ['06:00', '08:00', '10:00', '12:00', '14:00', '16:00', '18:00']

  return (
    <div ref={containerRef} className={`relative ${className}`}>
      <div
        onClick={() => !disabled && setIsOpen(!isOpen)}
        className={`input flex items-center justify-between cursor-pointer ${disabled ? 'opacity-50 cursor-not-allowed' : ''}`}
      >
        <span className={value ? 'text-gray-900 dark:text-gray-100' : 'text-gray-400 dark:text-gray-500'}>
          {value || placeholder}
        </span>
        <Clock className="w-4 h-4 text-gray-400" />
      </div>

      {isOpen && (
        <div className="absolute z-[100] mt-1 bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-lg shadow-lg p-3 w-56">
          {/* Time spinner */}
          <div className="flex items-center justify-center gap-3 mb-3">
            {/* Hours */}
            <div className="flex flex-col items-center">
              <button type="button" onClick={incrementHours} className="p-1 hover:bg-gray-100 dark:hover:bg-gray-700 rounded">
                <ChevronUp className="w-4 h-4 text-gray-600 dark:text-gray-400" />
              </button>
              <div className="w-11 h-11 flex items-center justify-center bg-gray-100 dark:bg-gray-700 rounded-lg">
                <span className="text-xl font-bold text-gray-900 dark:text-gray-100">{String(hours).padStart(2, '0')}</span>
              </div>
              <button type="button" onClick={decrementHours} className="p-1 hover:bg-gray-100 dark:hover:bg-gray-700 rounded">
                <ChevronDown className="w-4 h-4 text-gray-600 dark:text-gray-400" />
              </button>
            </div>

            <span className="text-xl font-bold text-gray-900 dark:text-gray-100">:</span>

            {/* Minutes */}
            <div className="flex flex-col items-center">
              <button type="button" onClick={incrementMinutes} className="p-1 hover:bg-gray-100 dark:hover:bg-gray-700 rounded">
                <ChevronUp className="w-4 h-4 text-gray-600 dark:text-gray-400" />
              </button>
              <div className="w-11 h-11 flex items-center justify-center bg-gray-100 dark:bg-gray-700 rounded-lg">
                <span className="text-xl font-bold text-gray-900 dark:text-gray-100">{String(minutes).padStart(2, '0')}</span>
              </div>
              <button type="button" onClick={decrementMinutes} className="p-1 hover:bg-gray-100 dark:hover:bg-gray-700 rounded">
                <ChevronDown className="w-4 h-4 text-gray-600 dark:text-gray-400" />
              </button>
            </div>
          </div>

          {/* Quick select */}
          <div className="border-t border-gray-200 dark:border-gray-700 pt-2">
            <div className="flex flex-wrap gap-1 justify-center">
              {quickTimes.map(time => (
                <button
                  key={time}
                  type="button"
                  onClick={() => { onChange(time); setIsOpen(false) }}
                  className={`px-2 py-1 text-xs rounded transition-colors
                    ${value === time 
                      ? 'bg-hse-primary text-white' 
                      : 'bg-gray-100 dark:bg-gray-700 text-gray-700 dark:text-gray-300 hover:bg-gray-200 dark:hover:bg-gray-600'}`}
                >
                  {time}
                </button>
              ))}
            </div>
          </div>

          {/* Confirm button */}
          <div className="mt-2 pt-2 border-t border-gray-200 dark:border-gray-700">
            <button
              type="button"
              onClick={() => {
                onChange(formatTime(hours, minutes))
                setIsOpen(false)
              }}
              className="w-full py-1.5 bg-hse-primary text-white rounded-lg hover:bg-hse-primary/90 transition-colors text-sm font-medium"
            >
              OK
            </button>
          </div>
        </div>
      )}
    </div>
  )
}
