import React from 'react'

export default function FilterBar({ children, className = '' }) {
  return (
    <div className={`bg-white/80 dark:bg-gray-800 border border-gray-200/80 dark:border-gray-700 rounded-2xl p-4 shadow-sm ${className}`}>
      {children}
    </div>
  )
}
