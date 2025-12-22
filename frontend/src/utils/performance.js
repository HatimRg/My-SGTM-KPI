/**
 * Performance monitoring utilities
 */

/**
 * Measure component render time
 */
export function measureRenderTime(componentName) {
  const startTime = performance.now()
  
  return () => {
    const endTime = performance.now()
    const renderTime = endTime - startTime
    
    if (import.meta.env.DEV) {
      console.log(`[Performance] ${componentName} rendered in ${renderTime.toFixed(2)}ms`)
    }
    
    return renderTime
  }
}

/**
 * Measure API call time
 */
export async function measureApiCall(apiFunction, label) {
  const startTime = performance.now()
  
  try {
    const result = await apiFunction()
    const endTime = performance.now()
    const duration = endTime - startTime
    
    if (import.meta.env.DEV) {
      console.log(`[API] ${label} completed in ${duration.toFixed(2)}ms`)
    }
    
    return { result, duration }
  } catch (error) {
    const endTime = performance.now()
    const duration = endTime - startTime
    
    if (import.meta.env.DEV) {
      console.error(`[API] ${label} failed after ${duration.toFixed(2)}ms`, error)
    }
    
    throw error
  }
}

/**
 * Log performance metrics
 */
export function logPerformanceMetrics() {
  if (import.meta.env.DEV && window.performance) {
    const navigation = performance.getEntriesByType('navigation')[0]
    
    if (navigation) {
      console.group('[Performance Metrics]')
      console.log(`DNS Lookup: ${navigation.domainLookupEnd - navigation.domainLookupStart}ms`)
      console.log(`TCP Connection: ${navigation.connectEnd - navigation.connectStart}ms`)
      console.log(`Request Time: ${navigation.responseStart - navigation.requestStart}ms`)
      console.log(`Response Time: ${navigation.responseEnd - navigation.responseStart}ms`)
      console.log(`DOM Processing: ${navigation.domComplete - navigation.domLoading}ms`)
      console.log(`Total Load Time: ${navigation.loadEventEnd - navigation.fetchStart}ms`)
      console.groupEnd()
    }
  }
}

/**
 * Create a performance observer for long tasks
 */
export function observeLongTasks(threshold = 50) {
  if ('PerformanceObserver' in window) {
    try {
      const observer = new PerformanceObserver((list) => {
        for (const entry of list.getEntries()) {
          if (entry.duration > threshold) {
            console.warn(`[Performance] Long task detected: ${entry.duration.toFixed(2)}ms`)
          }
        }
      })
      
      observer.observe({ entryTypes: ['longtask'] })
      return observer
    } catch (e) {
      // Long task API not supported
      return null
    }
  }
  return null
}

/**
 * Measure bundle size impact
 */
export function logBundleSize() {
  if (import.meta.env.DEV && window.performance) {
    const resources = performance.getEntriesByType('resource')
    const jsResources = resources.filter(r => r.name.endsWith('.js'))
    const cssResources = resources.filter(r => r.name.endsWith('.css'))
    
    const totalJsSize = jsResources.reduce((acc, r) => acc + (r.transferSize ?? 0), 0)
    const totalCssSize = cssResources.reduce((acc, r) => acc + (r.transferSize ?? 0), 0)
    
    console.group('[Bundle Size]')
    console.log(`JavaScript: ${(totalJsSize / 1024).toFixed(2)} KB`)
    console.log(`CSS: ${(totalCssSize / 1024).toFixed(2)} KB`)
    console.log(`Total: ${((totalJsSize + totalCssSize) / 1024).toFixed(2)} KB`)
    console.groupEnd()
  }
}

/**
 * Check if user is on slow connection
 */
export function isSlowConnection() {
  if ('connection' in navigator) {
    const connection = navigator.connection || navigator.mozConnection || navigator.webkitConnection
    return connection && (connection.effectiveType === 'slow-2g' || connection.effectiveType === '2g')
  }
  return false
}

/**
 * Adaptive loading based on connection speed
 */
export function shouldLoadHeavyResources() {
  if (isSlowConnection()) {
    return false
  }
  
  // Check if user has data saver enabled
  if ('connection' in navigator) {
    const connection = navigator.connection || navigator.mozConnection || navigator.webkitConnection
    if (connection && connection.saveData) {
      return false
    }
  }
  
  return true
}
