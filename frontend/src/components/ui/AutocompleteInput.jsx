import { useState, useEffect, useRef } from 'react'
import { Search, X, ChevronDown } from 'lucide-react'

/**
 * AutocompleteInput - A text input with autocomplete suggestions
 * 
 * @param {string} value - Current value
 * @param {function} onChange - Called when value changes
 * @param {array} suggestions - Array of suggestion strings
 * @param {string} placeholder - Input placeholder
 * @param {string} defaultValue - Default value if none exists (e.g., "SGTM")
 * @param {boolean} required - Whether the field is required
 * @param {string} className - Additional CSS classes
 * @param {boolean} disabled - Whether the input is disabled
 * @param {React.ReactNode} icon - Optional icon to display
 */
export default function AutocompleteInput({
  value = '',
  onChange,
  suggestions = [],
  placeholder = '',
  defaultValue = '',
  required = false,
  className = '',
  disabled = false,
  icon = null,
}) {
  const [inputValue, setInputValue] = useState(value)
  const [showSuggestions, setShowSuggestions] = useState(false)
  const [filteredSuggestions, setFilteredSuggestions] = useState([])
  const [highlightedIndex, setHighlightedIndex] = useState(-1)
  const inputRef = useRef(null)
  const containerRef = useRef(null)

  // Sync input value with prop
  useEffect(() => {
    setInputValue(value)
  }, [value])

  // Filter suggestions based on input
  useEffect(() => {
    if (!inputValue.trim()) {
      // Show all suggestions when input is empty (up to 10)
      setFilteredSuggestions(suggestions.slice(0, 10))
    } else {
      const query = inputValue.toLowerCase()
      const filtered = suggestions
        .filter(s => s.toLowerCase().includes(query))
        .sort((a, b) => {
          // Prioritize suggestions that start with the query
          const aStarts = a.toLowerCase().startsWith(query)
          const bStarts = b.toLowerCase().startsWith(query)
          if (aStarts && !bStarts) return -1
          if (!aStarts && bStarts) return 1
          return a.localeCompare(b)
        })
        .slice(0, 10)
      setFilteredSuggestions(filtered)
    }
    setHighlightedIndex(-1)
  }, [inputValue, suggestions])

  // Handle click outside to close suggestions
  useEffect(() => {
    const handleClickOutside = (e) => {
      if (containerRef.current && !containerRef.current.contains(e.target)) {
        setShowSuggestions(false)
      }
    }
    document.addEventListener('mousedown', handleClickOutside)
    return () => document.removeEventListener('mousedown', handleClickOutside)
  }, [])

  const handleInputChange = (e) => {
    const newValue = e.target.value
    setInputValue(newValue)
    onChange(newValue)
    setShowSuggestions(true)
  }

  const handleSelectSuggestion = (suggestion) => {
    setInputValue(suggestion)
    onChange(suggestion)
    setShowSuggestions(false)
    inputRef.current?.focus()
  }

  const handleKeyDown = (e) => {
    if (!showSuggestions || filteredSuggestions.length === 0) {
      if (e.key === 'ArrowDown') {
        setShowSuggestions(true)
      }
      return
    }

    switch (e.key) {
      case 'ArrowDown':
        e.preventDefault()
        setHighlightedIndex(prev => 
          prev < filteredSuggestions.length - 1 ? prev + 1 : prev
        )
        break
      case 'ArrowUp':
        e.preventDefault()
        setHighlightedIndex(prev => prev > 0 ? prev - 1 : -1)
        break
      case 'Enter':
        e.preventDefault()
        if (highlightedIndex >= 0 && filteredSuggestions[highlightedIndex]) {
          handleSelectSuggestion(filteredSuggestions[highlightedIndex])
        }
        break
      case 'Escape':
        setShowSuggestions(false)
        break
      case 'Tab':
        setShowSuggestions(false)
        break
    }
  }

  const handleFocus = () => {
    setShowSuggestions(true)
  }

  const handleClear = () => {
    setInputValue('')
    onChange('')
    inputRef.current?.focus()
  }

  // Add default value to suggestions if not present
  const allSuggestions = defaultValue && !suggestions.includes(defaultValue)
    ? [defaultValue, ...suggestions]
    : suggestions

  return (
    <div ref={containerRef} className="relative">
      <div className="relative">
        {icon && (
          <div className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400 pointer-events-none">
            {icon}
          </div>
        )}
        <input
          ref={inputRef}
          type="text"
          value={inputValue}
          onChange={handleInputChange}
          onKeyDown={handleKeyDown}
          onFocus={handleFocus}
          placeholder={placeholder}
          required={required}
          disabled={disabled}
          className={`input ${icon ? 'pl-10' : ''} ${inputValue && !disabled ? 'pr-16' : 'pr-8'} ${className}`}
        />
        <div className="absolute right-2 top-1/2 -translate-y-1/2 flex items-center gap-1">
          {inputValue && !disabled && (
            <button
              type="button"
              onClick={handleClear}
              className="p-1 hover:bg-gray-100 dark:hover:bg-gray-700 rounded"
            >
              <X className="w-3.5 h-3.5 text-gray-400" />
            </button>
          )}
          <ChevronDown 
            className={`w-4 h-4 text-gray-400 transition-transform ${showSuggestions ? 'rotate-180' : ''}`} 
          />
        </div>
      </div>

      {/* Suggestions dropdown */}
      {showSuggestions && filteredSuggestions.length > 0 && (
        <div className="absolute z-50 w-full mt-1 bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-lg shadow-lg max-h-60 overflow-y-auto">
          {filteredSuggestions.map((suggestion, index) => {
            const isHighlighted = index === highlightedIndex
            const isDefault = suggestion === defaultValue
            
            return (
              <button
                key={suggestion}
                type="button"
                onClick={() => handleSelectSuggestion(suggestion)}
                className={`w-full px-3 py-2 text-left text-sm flex items-center justify-between
                  ${isHighlighted 
                    ? 'bg-hse-primary/10 text-hse-primary' 
                    : 'text-gray-700 dark:text-gray-300 hover:bg-gray-100 dark:hover:bg-gray-700'
                  }
                  ${index === 0 ? 'rounded-t-lg' : ''}
                  ${index === filteredSuggestions.length - 1 ? 'rounded-b-lg' : ''}
                `}
              >
                <span className={isDefault ? 'font-medium' : ''}>
                  {suggestion}
                </span>
                {isDefault && (
                  <span className="text-xs px-1.5 py-0.5 bg-hse-primary/10 text-hse-primary rounded">
                    défaut
                  </span>
                )}
              </button>
            )
          })}
        </div>
      )}

      {/* Show "no matches" message when typing but no results */}
      {showSuggestions && inputValue && filteredSuggestions.length === 0 && (
        <div className="absolute z-50 w-full mt-1 bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-lg shadow-lg p-3">
          <p className="text-sm text-gray-500 dark:text-gray-400">
            Nouvelle valeur: <span className="font-medium text-gray-700 dark:text-gray-200">{inputValue}</span>
          </p>
          <p className="text-xs text-gray-400 mt-1">Appuyez sur Entrée ou cliquez ailleurs pour confirmer</p>
        </div>
      )}
    </div>
  )
}
