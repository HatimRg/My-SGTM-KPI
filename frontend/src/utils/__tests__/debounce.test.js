import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import { debounce, throttle, createAbortController, abortAndCreate } from '../debounce'

describe('debounce', () => {
  beforeEach(() => {
    vi.useFakeTimers()
  })

  afterEach(() => {
    vi.restoreAllMocks()
  })

  it('should delay function execution', () => {
    const mockFn = vi.fn()
    const debouncedFn = debounce(mockFn, 300)

    debouncedFn()
    expect(mockFn).not.toHaveBeenCalled()

    vi.advanceTimersByTime(300)
    expect(mockFn).toHaveBeenCalledTimes(1)
  })

  it('should cancel previous calls', () => {
    const mockFn = vi.fn()
    const debouncedFn = debounce(mockFn, 300)

    debouncedFn()
    vi.advanceTimersByTime(100)
    debouncedFn()
    vi.advanceTimersByTime(100)
    debouncedFn()
    
    vi.advanceTimersByTime(300)
    expect(mockFn).toHaveBeenCalledTimes(1)
  })

  it('should pass arguments correctly', () => {
    const mockFn = vi.fn()
    const debouncedFn = debounce(mockFn, 300)

    debouncedFn('arg1', 'arg2')
    vi.advanceTimersByTime(300)

    expect(mockFn).toHaveBeenCalledWith('arg1', 'arg2')
  })

  it('should use custom wait time', () => {
    const mockFn = vi.fn()
    const debouncedFn = debounce(mockFn, 500)

    debouncedFn()
    vi.advanceTimersByTime(300)
    expect(mockFn).not.toHaveBeenCalled()

    vi.advanceTimersByTime(200)
    expect(mockFn).toHaveBeenCalledTimes(1)
  })
})

describe('throttle', () => {
  beforeEach(() => {
    vi.useFakeTimers()
  })

  afterEach(() => {
    vi.restoreAllMocks()
  })

  it('should execute immediately on first call', () => {
    const mockFn = vi.fn()
    const throttledFn = throttle(mockFn, 100)

    throttledFn()
    expect(mockFn).toHaveBeenCalledTimes(1)
  })

  it('should throttle subsequent calls', () => {
    const mockFn = vi.fn()
    const throttledFn = throttle(mockFn, 100)

    throttledFn()
    throttledFn()
    throttledFn()
    
    expect(mockFn).toHaveBeenCalledTimes(1)
  })

  it('should allow execution after limit period', () => {
    const mockFn = vi.fn()
    const throttledFn = throttle(mockFn, 100)

    throttledFn()
    expect(mockFn).toHaveBeenCalledTimes(1)

    vi.advanceTimersByTime(100)
    throttledFn()
    expect(mockFn).toHaveBeenCalledTimes(2)
  })

  it('should pass arguments correctly', () => {
    const mockFn = vi.fn()
    const throttledFn = throttle(mockFn, 100)

    throttledFn('arg1', 'arg2')
    expect(mockFn).toHaveBeenCalledWith('arg1', 'arg2')
  })
})

describe('createAbortController', () => {
  it('should create an AbortController instance', () => {
    const controller = createAbortController()
    expect(controller).toBeInstanceOf(AbortController)
    expect(controller.signal).toBeDefined()
  })
})

describe('abortAndCreate', () => {
  it('should abort previous controller and create new one', () => {
    const controller1 = createAbortController()
    const abortSpy = vi.spyOn(controller1, 'abort')

    const controller2 = abortAndCreate(controller1)

    expect(abortSpy).toHaveBeenCalled()
    expect(controller2).toBeInstanceOf(AbortController)
    expect(controller2).not.toBe(controller1)
  })

  it('should handle null previous controller', () => {
    const controller = abortAndCreate(null)
    expect(controller).toBeInstanceOf(AbortController)
  })

  it('should handle undefined previous controller', () => {
    const controller = abortAndCreate(undefined)
    expect(controller).toBeInstanceOf(AbortController)
  })
})
