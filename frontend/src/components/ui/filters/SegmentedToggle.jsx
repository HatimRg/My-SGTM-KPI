import React from 'react'

export default function SegmentedToggle({ options, value, onChange, className = '' }) {
  const safeOptions = Array.isArray(options) ? options : []

  return (
    <div
      className={`flex flex-wrap sm:inline-flex p-1 rounded-2xl bg-gray-100/80 dark:bg-gray-800 border border-gray-200/80 dark:border-gray-700 shadow-sm w-full sm:w-fit ${className}`}
      role="group"
    >
      {safeOptions.map((opt) => {
        const isActive = String(opt.value) === String(value)
        return (
          <button
            key={String(opt.value)}
            type="button"
            onClick={() => onChange?.(opt.value)}
            aria-pressed={isActive}
            className={`flex-1 sm:flex-initial px-3 py-2 rounded-xl text-sm font-semibold transition focus:outline-none focus-visible:ring-2 focus-visible:ring-sgtm-orange focus-visible:ring-offset-2 focus-visible:ring-offset-white dark:focus-visible:ring-offset-gray-900 ${
              isActive
                ? 'bg-sgtm-orange text-white shadow border border-sgtm-orange'
                : 'bg-transparent text-gray-800 dark:text-gray-100 border border-gray-300/70 dark:border-gray-700 hover:bg-white/60 dark:hover:bg-gray-900/40'
            }`}
          >
            {opt.label}
          </button>
        )
      })}
    </div>
  )
}
