import { useEffect, useMemo, useRef, useState } from 'react'
import { Modal } from '../ui'
import { useLanguage } from '../../i18n'
import { notificationService } from '../../services/api'
import { AlertTriangle } from 'lucide-react'

export default function UrgentNotificationOverlay({ enabled }) {
  const { t } = useLanguage()

  const [queue, setQueue] = useState([])
  const [active, setActive] = useState(null)
  const [secondsLeft, setSecondsLeft] = useState(0)
  const [afterId, setAfterId] = useState(null)

  const seenIdsRef = useRef(new Set())
  const pollingRef = useRef(null)

  const forcedSeconds = useMemo(() => {
    const raw = active?.data?.forced_visibility_seconds
    const parsed = Number(raw)
    if (!Number.isFinite(parsed) || parsed <= 0) return 5
    return Math.min(60, Math.max(1, parsed))
  }, [active])

  const urgency = (active?.urgency ?? active?.data?.urgency ?? 'medium')
  const urgencyKey = String(urgency).toLowerCase()

  const urgencyStyles = {
    low: {
      ring: 'ring-2 ring-green-200 dark:ring-green-900/40',
      badge: 'bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-200',
      accent: 'from-green-500 to-emerald-500',
      icon: 'text-green-600 dark:text-green-300',
      title: t('notifications.urgent.urgencyLow'),
    },
    medium: {
      ring: 'ring-2 ring-amber-200 dark:ring-amber-900/40',
      badge: 'bg-amber-100 text-amber-800 dark:bg-amber-900/30 dark:text-amber-200',
      accent: 'from-amber-500 to-yellow-500',
      icon: 'text-amber-600 dark:text-amber-300',
      title: t('notifications.urgent.urgencyMedium'),
    },
    high: {
      ring: 'ring-2 ring-red-200 dark:ring-red-900/40',
      badge: 'bg-red-100 text-red-700 dark:bg-red-900/30 dark:text-red-200',
      accent: 'from-red-500 to-rose-500',
      icon: 'text-red-600 dark:text-red-300',
      title: t('notifications.urgent.urgencyHigh'),
    },
  }

  const style = urgencyStyles[urgencyKey] ?? urgencyStyles.medium

  const showNext = (nextQueue) => {
    const next = nextQueue[0]
    setActive(next)
    setQueue(nextQueue.slice(1))
    setSecondsLeft(forcedSeconds)
  }

  useEffect(() => {
    if (!enabled) return

    const tick = () => {
      setSecondsLeft((s) => (s > 0 ? s - 1 : 0))
    }

    if (!active) return
    setSecondsLeft(forcedSeconds)
    const timer = setInterval(tick, 1000)
    return () => clearInterval(timer)
  }, [enabled, active, forcedSeconds])

  useEffect(() => {
    if (!enabled) {
      setQueue([])
      setActive(null)
      setSecondsLeft(0)
      setAfterId(null)
      return
    }

    const fetchUrgent = async () => {
      try {
        const res = await notificationService.urgentUnread({ after_id: afterId ?? undefined, limit: 20 })
        const payload = res.data?.data
        const items = payload?.items ?? []
        const lastId = payload?.last_id

        if (typeof lastId === 'number' || (typeof lastId === 'string' && String(lastId) !== '')) {
          setAfterId((prev) => {
            const prevNum = prev === null ? null : Number(prev)
            const nextNum = Number(lastId)
            if (!Number.isFinite(nextNum)) return prev
            if (prevNum === null) return nextNum
            return Math.max(prevNum, nextNum)
          })
        }

        if (!Array.isArray(items) || items.length === 0) return

        const unseen = items.filter((n) => {
          if (!n?.id) return false
          if (seenIdsRef.current.has(n.id)) return false
          seenIdsRef.current.add(n.id)
          return true
        })

        if (unseen.length === 0) return

        setQueue((prev) => {
          const next = [...prev, ...unseen]
          return next
        })
      } catch {
        // ignore
      }
    }

    fetchUrgent()

    pollingRef.current = setInterval(fetchUrgent, 4000)
    return () => {
      if (pollingRef.current) clearInterval(pollingRef.current)
      pollingRef.current = null
    }
  }, [enabled, afterId])

  useEffect(() => {
    if (!enabled) return
    if (active) return
    if (queue.length === 0) return
    const nextQueue = [...queue]
    const next = nextQueue[0]
    setActive(next)
    setQueue(nextQueue.slice(1))
    const raw = next?.data?.forced_visibility_seconds
    const parsed = Number(raw)
    const nextForced = Number.isFinite(parsed) && parsed > 0 ? Math.min(60, Math.max(1, parsed)) : 5
    setSecondsLeft(nextForced)
  }, [enabled, active, queue])

  const canClose = secondsLeft <= 0

  const handleClose = async () => {
    if (!active) return
    if (!canClose) return

    const current = active
    setActive(null)

    try {
      await notificationService.markAsRead(current.id)
    } catch {
      // ignore
    }
  }

  if (!enabled) return null
  if (!active) return null

  return (
    <Modal
      isOpen={true}
      onClose={handleClose}
      title={t('notifications.urgent.receivedTitle')}
      size="md"
      showCloseButton={false}
      backdropClassName="bg-black/30 backdrop-blur-sm"
      modalClassName="shadow-2xl"
    >
      <div className={`rounded-2xl ${style.ring} overflow-hidden`}> 
        <div className={`h-1.5 bg-gradient-to-r ${style.accent}`} />

        <div className="p-5">
          <div className="flex items-start justify-between gap-4">
            <div className="flex items-start gap-3 min-w-0">
              <div className={`mt-0.5 w-10 h-10 rounded-xl bg-gray-50 dark:bg-gray-900 flex items-center justify-center ${style.ring}`}>
                <AlertTriangle className={`w-5 h-5 ${style.icon}`} />
              </div>

              <div className="min-w-0">
                <div className="text-base font-extrabold text-gray-900 dark:text-gray-100 truncate">
                  {active.title || t('notifications.urgent.receivedTitle')}
                </div>
                <div className="mt-1 flex items-center gap-2">
                  <span className={`inline-flex items-center px-2.5 py-1 rounded-full text-xs font-bold ${style.badge}`}>
                    {style.title}
                  </span>
                  {!canClose && (
                    <span className="text-xs font-semibold text-gray-500 dark:text-gray-400">
                      {t('notifications.urgent.closeIn', { seconds: secondsLeft })}
                    </span>
                  )}
                </div>
              </div>
            </div>

            <button
              type="button"
              onClick={handleClose}
              disabled={!canClose}
              className={`shrink-0 inline-flex items-center justify-center px-4 py-2 rounded-xl text-sm font-extrabold transition-colors disabled:opacity-50 ${
                canClose
                  ? 'bg-hse-primary text-white hover:bg-hse-primary/90'
                  : 'bg-gray-200 text-gray-500 dark:bg-gray-700 dark:text-gray-300'
              }`}
              title={canClose ? t('notifications.urgent.close') : t('notifications.urgent.closeIn', { seconds: secondsLeft })}
            >
              {canClose ? t('notifications.urgent.close') : `${secondsLeft}s`}
            </button>
          </div>

          <div className="mt-4 whitespace-pre-wrap text-sm leading-relaxed text-gray-800 dark:text-gray-100">
            {active.message}
          </div>
        </div>
      </div>
    </Modal>
  )
}
