/**
 * Debounce function to limit API calls
 * Useful for search inputs, filters, etc.
 */
export function debounce(func, wait = 300) {
  let timeout
  
  return function executedFunction(...args) {
    const later = () => {
      clearTimeout(timeout)
      func(...args)
    }
    
    clearTimeout(timeout)
    timeout = setTimeout(later, wait)
  }
}

/**
 * Throttle function to limit execution rate
 * Useful for scroll events, resize events
 */
export function throttle(func, limit = 100) {
  let inThrottle
  
  return function executedFunction(...args) {
    if (!inThrottle) {
      func(...args)
      inThrottle = true
      setTimeout(() => inThrottle = false, limit)
    }
  }
}

/**
 * Create an AbortController for cancellable requests
 */
export function createAbortController() {
  return new AbortController()
}

/**
 * Abort previous request and create new controller
 */
export function abortAndCreate(previousController) {
  if (previousController) {
    previousController.abort()
  }
  return createAbortController()
}
