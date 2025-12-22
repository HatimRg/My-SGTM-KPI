import { ChevronDown } from 'lucide-react'

export default function Select({
  value,
  onChange,
  children,
  className = '',
  wrapperClassName = '',
  disabled = false,
  ...props
}) {
  return (
    <div className={`relative ${wrapperClassName}`}>
      <select
        value={value}
        onChange={onChange}
        disabled={disabled}
        className={`input appearance-none pr-9 ${className}`}
        {...props}
      >
        {children}
      </select>
      <ChevronDown
        className={`pointer-events-none absolute right-3 top-1/2 -translate-y-1/2 w-4 h-4 ${
          disabled ? 'text-gray-300 dark:text-gray-600' : 'text-gray-400 dark:text-gray-500'
        }`}
      />
    </div>
  )
}
