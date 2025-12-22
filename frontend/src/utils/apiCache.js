/**
 * Simple in-memory cache for API responses
 * Helps reduce unnecessary API calls and improve performance
 */

class ApiCache {
  constructor() {
    this.cache = new Map()
    this.timestamps = new Map()
  }

  /**
   * Generate cache key from URL and params
   */
  generateKey(url, params = {}) {
    const sortedParams = Object.keys(params)
      .sort()
      .reduce((acc, key) => {
        acc[key] = params[key]
        return acc
      }, {})
    return `${url}:${JSON.stringify(sortedParams)}`
  }

  /**
   * Get cached data if not expired
   */
  get(url, params = {}, maxAge = 30000) {
    const key = this.generateKey(url, params)
    const timestamp = this.timestamps.get(key)
    
    if (!timestamp || Date.now() - timestamp > maxAge) {
      this.delete(key)
      return null
    }
    
    return this.cache.get(key)
  }

  /**
   * Set cache data
   */
  set(url, params = {}, data) {
    const key = this.generateKey(url, params)
    this.cache.set(key, data)
    this.timestamps.set(key, Date.now())
  }

  /**
   * Delete specific cache entry
   */
  delete(key) {
    this.cache.delete(key)
    this.timestamps.delete(key)
  }

  /**
   * Clear cache by pattern (e.g., all dashboard requests)
   */
  clearPattern(pattern) {
    for (const key of this.cache.keys()) {
      if (key.includes(pattern)) {
        this.delete(key)
      }
    }
  }

  /**
   * Clear all cache
   */
  clear() {
    this.cache.clear()
    this.timestamps.clear()
  }

  /**
   * Get cache stats
   */
  getStats() {
    return {
      size: this.cache.size,
      keys: Array.from(this.cache.keys())
    }
  }
}

export const apiCache = new ApiCache()

/**
 * Wrapper for cacheable API calls
 */
export async function cachedApiCall(apiFunction, cacheKey, params = {}, maxAge = 30000) {
  // Check cache first
  const cached = apiCache.get(cacheKey, params, maxAge)
  if (cached) {
    return Promise.resolve(cached)
  }

  // Make API call
  const response = await apiFunction(params)
  apiCache.set(cacheKey, params, response)
  return response
}

/**
 * Invalidate cache when data changes
 */
export function invalidateCache(patterns = []) {
  if (patterns.length === 0) {
    apiCache.clear()
  } else {
    patterns.forEach(pattern => apiCache.clearPattern(pattern))
  }
}
