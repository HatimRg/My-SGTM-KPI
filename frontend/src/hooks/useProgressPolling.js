import { useEffect, useRef, useCallback } from 'react'
import api from '../services/api'

/**
 * Reusable hook for polling mass import progress with single-flight guard,
 * visibility-based pause, and automatic cleanup.
 *
 * @param {Object} options
 * @param {boolean} options.enabled - Whether polling is active
 * @param {string|null} options.progressId - The progress ID to poll
 * @param {string|null} options.status - Current status ('running', 'completed', 'failed')
 * @param {function} options.onProgress - Callback when progress data is received
 * @param {number} [options.interval=2000] - Polling interval in ms
 * @param {number} [options.maxNotFound=5] - Max 404 responses before stopping
 */
export default function useProgressPolling({
  enabled,
  progressId,
  status,
  onProgress,
  interval = 2000,
  maxNotFound = 5,
}) {
  const inFlightRef = useRef(false)
  const notFoundCountRef = useRef(0)

  const poll = useCallback(async () => {
    if (!progressId) return false
    if (inFlightRef.current) return true // Still running, keep polling
    if (document.hidden) return true // Tab hidden, skip but keep polling

    inFlightRef.current = true
    try {
      const res = await api.get(`/mass-import/progress/${progressId}`, { silent: true })
      const data = res.data?.data ?? res.data
      notFoundCountRef.current = 0
      onProgress(data)
      return true
    } catch (err) {
      if (err?.response?.status === 404) {
        notFoundCountRef.current += 1
        if (notFoundCountRef.current >= maxNotFound) {
          return false // Stop polling
        }
      }
      return true // Keep polling on other errors
    } finally {
      inFlightRef.current = false
    }
  }, [progressId, onProgress, maxNotFound])

  useEffect(() => {
    if (!enabled) return
    if (!progressId) return
    if (status === 'completed' || status === 'failed') return

    let cancelled = false
    let timerId = null
    notFoundCountRef.current = 0

    const loop = async () => {
      if (cancelled) return
      const shouldContinue = await poll()
      if (cancelled) return
      if (shouldContinue) {
        timerId = setTimeout(loop, interval)
      }
    }

    // Initial delay before first poll
    timerId = setTimeout(loop, 1000)

    // Resume polling when tab becomes visible
    const onVisibilityChange = () => {
      if (!document.hidden && !inFlightRef.current && !cancelled) {
        poll()
      }
    }
    document.addEventListener('visibilitychange', onVisibilityChange)

    return () => {
      cancelled = true
      if (timerId) clearTimeout(timerId)
      document.removeEventListener('visibilitychange', onVisibilityChange)
    }
  }, [enabled, progressId, status, poll, interval])
}
