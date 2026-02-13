import React from 'react'

export default function FilterSelect({ label, value, onChange, children, className = '', selectClassName = '', ...rest }) {
  const id = rest.id || `filter-select-${String(label ?? 'field').toLowerCase().replace(/[^a-z0-9]+/g, '-')}`
  return (
    <div className={`flex flex-col gap-1 ${className}`.trim()}>
      {label ? (
        <label htmlFor={id} className="text-xs font-medium text-gray-700 dark:text-gray-200">{label}</label>
      ) : null}
      <select
        id={id}
        value={value}
        onChange={(e) => onChange?.(e.target.value, e)}
        className={`w-full px-3 py-2 rounded-xl border border-gray-300/70 dark:border-gray-700 bg-white dark:bg-gray-900 text-gray-900 dark:text-gray-100 text-sm shadow-sm hover:bg-gray-50 dark:hover:bg-gray-900 focus:outline-none focus-visible:ring-2 focus-visible:ring-sgtm-orange focus-visible:ring-offset-2 focus-visible:ring-offset-white dark:focus-visible:ring-offset-gray-900 disabled:opacity-60 disabled:cursor-not-allowed ${selectClassName}`}
        {...rest}
      >
        {children}
      </select>
    </div>
  )
}
