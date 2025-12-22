import { useEffect, useCallback } from 'react'
import { createPortal } from 'react-dom'
import { X } from 'lucide-react'

export default function Modal({
  isOpen,
  onClose,
  title,
  children,
  size = 'md', // sm, md, lg, xl, full
  showCloseButton = true,
}) {
  // Handle ESC key to close
  const handleKeyDown = useCallback((e) => {
    if (e.key === 'Escape') {
      onClose()
    }
  }, [onClose])

  useEffect(() => {
    if (isOpen) {
      document.addEventListener('keydown', handleKeyDown)
      document.body.style.overflow = 'hidden'
    }
    return () => {
      document.removeEventListener('keydown', handleKeyDown)
      document.body.style.overflow = 'unset'
    }
  }, [isOpen, handleKeyDown])

  if (!isOpen) return null

  const sizeClasses = {
    sm: 'max-w-sm',
    md: 'max-w-lg',
    lg: 'max-w-2xl',
    xl: 'max-w-4xl',
    full: 'max-w-[95vw]',
  }

  return createPortal(
    <div className="fixed inset-0 z-[9999] overflow-y-auto">
      {/* Backdrop */}
      <div
        className="fixed inset-0 bg-black/50 transition-opacity"
        onClick={onClose}
      />

      {/* Modal container */}
      <div className="flex min-h-full items-center justify-center p-4">
        <div
          className={`relative bg-white dark:bg-gray-800 rounded-xl shadow-xl w-full ${sizeClasses[size]} max-h-[90vh] flex flex-col animate-fade-in overflow-hidden`}
          onClick={(e) => e.stopPropagation()}
        >
          {/* Fixed Header */}
          <div className="sticky top-0 z-[200] flex items-center justify-between p-4 md:p-6 border-b border-gray-200 dark:border-gray-700 shrink-0 bg-white dark:bg-gray-800">
            <h2 className="text-lg md:text-xl font-bold text-gray-900 dark:text-gray-100 pr-8">
              {title}
            </h2>
            {showCloseButton && (
              <button
                onClick={onClose}
                className="absolute top-4 right-4 z-[210] p-2 hover:bg-gray-100 dark:hover:bg-gray-700 rounded-lg transition-colors text-gray-500 dark:text-gray-400 hover:text-gray-700 dark:hover:text-gray-200"
                aria-label="Close"
              >
                <X className="w-5 h-5" />
              </button>
            )}
          </div>

          {/* Scrollable Content */}
          <div className="flex-1 overflow-y-auto overflow-x-hidden p-4 md:p-6">
            {children}
          </div>
        </div>
      </div>
    </div>,
    document.body
  )
}
