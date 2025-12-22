import { describe, it, expect, beforeEach, vi } from 'vitest'
import { apiCache, cachedApiCall, invalidateCache } from '../apiCache'

describe('ApiCache', () => {
  beforeEach(() => {
    apiCache.clear()
  })

  describe('generateKey', () => {
    it('should generate consistent keys for same URL and params', () => {
      const key1 = apiCache.generateKey('/api/test', { a: 1, b: 2 })
      const key2 = apiCache.generateKey('/api/test', { b: 2, a: 1 })
      expect(key1).toBe(key2)
    })

    it('should generate different keys for different URLs', () => {
      const key1 = apiCache.generateKey('/api/test1', { a: 1 })
      const key2 = apiCache.generateKey('/api/test2', { a: 1 })
      expect(key1).not.toBe(key2)
    })

    it('should generate different keys for different params', () => {
      const key1 = apiCache.generateKey('/api/test', { a: 1 })
      const key2 = apiCache.generateKey('/api/test', { a: 2 })
      expect(key1).not.toBe(key2)
    })
  })

  describe('get and set', () => {
    it('should store and retrieve data', () => {
      const testData = { result: 'test' }
      apiCache.set('/api/test', {}, testData)
      const retrieved = apiCache.get('/api/test', {})
      expect(retrieved).toEqual(testData)
    })

    it('should return null for expired cache', async () => {
      const testData = { result: 'test' }
      apiCache.set('/api/test', {}, testData)
      
      // Wait for cache to expire (1ms maxAge)
      await new Promise(resolve => setTimeout(resolve, 10))
      const retrieved = apiCache.get('/api/test', {}, 1)
      expect(retrieved).toBeNull()
    })

    it('should return cached data within maxAge', () => {
      const testData = { result: 'test' }
      apiCache.set('/api/test', {}, testData)
      const retrieved = apiCache.get('/api/test', {}, 10000)
      expect(retrieved).toEqual(testData)
    })
  })

  describe('clearPattern', () => {
    it('should clear cache entries matching pattern', () => {
      apiCache.set('/api/dashboard', {}, { data: 1 })
      apiCache.set('/api/dashboard/admin', {}, { data: 2 })
      apiCache.set('/api/users', {}, { data: 3 })

      apiCache.clearPattern('dashboard')

      expect(apiCache.get('/api/dashboard', {})).toBeNull()
      expect(apiCache.get('/api/dashboard/admin', {})).toBeNull()
      expect(apiCache.get('/api/users', {})).not.toBeNull()
    })
  })

  describe('clear', () => {
    it('should clear all cache entries', () => {
      apiCache.set('/api/test1', {}, { data: 1 })
      apiCache.set('/api/test2', {}, { data: 2 })

      apiCache.clear()

      expect(apiCache.get('/api/test1', {})).toBeNull()
      expect(apiCache.get('/api/test2', {})).toBeNull()
    })
  })

  describe('getStats', () => {
    it('should return cache statistics', () => {
      apiCache.set('/api/test1', {}, { data: 1 })
      apiCache.set('/api/test2', {}, { data: 2 })

      const stats = apiCache.getStats()
      expect(stats.size).toBe(2)
      expect(stats.keys.length).toBe(2)
    })
  })
})

describe('cachedApiCall', () => {
  beforeEach(() => {
    apiCache.clear()
  })

  it('should return cached data on second call', async () => {
    const mockApiFunction = vi.fn().mockResolvedValue({ data: 'test' })
    
    // First call - should hit API
    const result1 = await cachedApiCall(mockApiFunction, '/api/test', {})
    expect(mockApiFunction).toHaveBeenCalledTimes(1)
    expect(result1).toEqual({ data: 'test' })

    // Second call - should use cache
    const result2 = await cachedApiCall(mockApiFunction, '/api/test', {})
    expect(mockApiFunction).toHaveBeenCalledTimes(1) // Still 1
    expect(result2).toEqual({ data: 'test' })
  })

  it('should call API again after cache expires', async () => {
    const mockApiFunction = vi.fn().mockResolvedValue({ data: 'test' })
    
    // First call
    await cachedApiCall(mockApiFunction, '/api/test', {}, 1)
    
    // Wait for cache to expire
    await new Promise(resolve => setTimeout(resolve, 10))
    
    // Second call - should hit API again
    await cachedApiCall(mockApiFunction, '/api/test', {}, 1)
    expect(mockApiFunction).toHaveBeenCalledTimes(2)
  })

  it('should throw error if API call fails', async () => {
    const mockApiFunction = vi.fn().mockRejectedValue(new Error('API Error'))
    
    await expect(
      cachedApiCall(mockApiFunction, '/api/test', {})
    ).rejects.toThrow('API Error')
  })
})

describe('invalidateCache', () => {
  beforeEach(() => {
    apiCache.clear()
  })

  it('should clear all cache when no patterns provided', () => {
    apiCache.set('/api/test1', {}, { data: 1 })
    apiCache.set('/api/test2', {}, { data: 2 })

    invalidateCache()

    expect(apiCache.get('/api/test1', {})).toBeNull()
    expect(apiCache.get('/api/test2', {})).toBeNull()
  })

  it('should clear cache matching patterns', () => {
    apiCache.set('/api/dashboard', {}, { data: 1 })
    apiCache.set('/api/users', {}, { data: 2 })

    invalidateCache(['dashboard'])

    expect(apiCache.get('/api/dashboard', {})).toBeNull()
    expect(apiCache.get('/api/users', {})).not.toBeNull()
  })
})
