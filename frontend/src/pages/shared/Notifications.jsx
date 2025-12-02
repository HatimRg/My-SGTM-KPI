import { useEffect, useMemo, useState } from 'react'
import { useLanguage } from '../../i18n'
import { notificationService } from '../../services/api'
import { Bell, Loader2, Trash2, CheckCircle, XCircle, AlertTriangle, Clock, FolderKanban } from 'lucide-react'

const TYPE_LABELS = {
  reminder: 'Reminder',
}

const getNotificationStyle = (type) => {
  const styles = {
    kpi_submitted: { icon: CheckCircle, color: 'text-blue-500', bg: 'bg-blue-100 dark:bg-blue-900/30' },
    kpi_approved: { icon: CheckCircle, color: 'text-green-500', bg: 'bg-green-100 dark:bg-green-900/30' },
    kpi_rejected: { icon: XCircle, color: 'text-red-500', bg: 'bg-red-100 dark:bg-red-900/30' },
    project_assigned: { icon: FolderKanban, color: 'text-purple-500', bg: 'bg-purple-100 dark:bg-purple-900/30' },
    sor_submitted: { icon: AlertTriangle, color: 'text-orange-500', bg: 'bg-orange-100 dark:bg-orange-900/30' },
    sor_corrected: { icon: CheckCircle, color: 'text-green-500', bg: 'bg-green-100 dark:bg-green-900/30' },
    training_submitted: { icon: CheckCircle, color: 'text-indigo-500', bg: 'bg-indigo-100 dark:bg-indigo-900/30' },
    awareness_submitted: { icon: CheckCircle, color: 'text-teal-500', bg: 'bg-teal-100 dark:bg-teal-900/30' },
    reminder: { icon: Clock, color: 'text-yellow-500', bg: 'bg-yellow-100 dark:bg-yellow-900/30' },
    system: { icon: Bell, color: 'text-gray-500', bg: 'bg-gray-100 dark:bg-gray-700' },
    info: { icon: Bell, color: 'text-blue-500', bg: 'bg-blue-100 dark:bg-blue-900/30' },
    warning: { icon: AlertTriangle, color: 'text-yellow-500', bg: 'bg-yellow-100 dark:bg-yellow-900/30' },
    success: { icon: CheckCircle, color: 'text-green-500', bg: 'bg-green-100 dark:bg-green-900/30' },
    error: { icon: XCircle, color: 'text-red-500', bg: 'bg-red-100 dark:bg-red-900/30' },
  }
  return styles[type] || styles.info
}

export default function Notifications() {
  const { t } = useLanguage()
  const [notifications, setNotifications] = useState([])
  const [loading, setLoading] = useState(true)
  const [filter, setFilter] = useState('all') // all | unread | reminders

  useEffect(() => {
    const fetchAll = async () => {
      try {
        setLoading(true)
        const res = await notificationService.getAll({ per_page: 50 })
        setNotifications(res.data.data || [])
      } catch (error) {
        console.error('Failed to load notifications', error)
      } finally {
        setLoading(false)
      }
    }

    fetchAll()
  }, [])

  const handleMarkAsRead = async (notif) => {
    if (notif.read_at) return
    try {
      await notificationService.markAsRead(notif.id)
      setNotifications((prev) =>
        prev.map((n) => (n.id === notif.id ? { ...n, read_at: new Date().toISOString() } : n))
      )
    } catch (error) {
      console.error('Failed to mark notification as read', error)
    }
  }

  const handleMarkAllAsRead = async () => {
    try {
      await notificationService.markAllAsRead()
      setNotifications((prev) => prev.map((n) => ({ ...n, read_at: new Date().toISOString() })))
    } catch (error) {
      console.error('Failed to mark all notifications as read', error)
    }
  }

  const handleClearRead = async () => {
    try {
      await notificationService.deleteRead()
      setNotifications((prev) => prev.filter((n) => !n.read_at))
    } catch (error) {
      console.error('Failed to clear read notifications', error)
    }
  }

  const filteredNotifications = useMemo(() => {
    return notifications.filter((n) => {
      if (filter === 'unread' && n.read_at) return false
      if (filter === 'reminders' && n.type !== 'reminder') return false
      return true
    })
  }, [notifications, filter])

  return (
    <div className="max-w-3xl mx-auto space-y-6 animate-fade-in">
      <div>
        <div className="text-xs text-gray-500 dark:text-gray-400 mb-1">
          {t('nav.dashboard')} / {t('notifications.title')}
        </div>
        <h1 className="text-2xl font-bold text-gray-900 dark:text-gray-100">{t('notifications.title')}</h1>
        <p className="text-gray-500 dark:text-gray-400 mt-1">
          View all alerts, reminders, and system messages related to your HSE activity.
        </p>
      </div>

      <div className="card">
        <div className="card-header flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
          <div className="flex items-center gap-2">
            <Bell className="w-5 h-5 text-hse-primary" />
            <span className="font-semibold text-gray-900 dark:text-gray-100">{t('notifications.title')}</span>
            <span className="badge badge-info">{notifications.length}</span>
          </div>
          <div className="flex flex-wrap items-center gap-2 text-xs">
            <button
              type="button"
              onClick={() => setFilter('all')}
              className={`px-2 py-1 rounded-full border text-xs ${
                filter === 'all'
                  ? 'bg-hse-primary text-white border-hse-primary'
                  : 'border-gray-300 text-gray-600 dark:border-gray-600 dark:text-gray-300'
              }`}
            >
              All
            </button>
            <button
              type="button"
              onClick={() => setFilter('unread')}
              className={`px-2 py-1 rounded-full border text-xs ${
                filter === 'unread'
                  ? 'bg-hse-primary text-white border-hse-primary'
                  : 'border-gray-300 text-gray-600 dark:border-gray-600 dark:text-gray-300'
              }`}
            >
              Unread
            </button>
            <button
              type="button"
              onClick={() => setFilter('reminders')}
              className={`px-2 py-1 rounded-full border text-xs flex items-center gap-1 ${
                filter === 'reminders'
                  ? 'bg-hse-primary text-white border-hse-primary'
                  : 'border-gray-300 text-gray-600 dark:border-gray-600 dark:text-gray-300'
              }`}
            >
              <Clock className="w-3 h-3" />
              Reminders
            </button>
            <span className="hidden sm:inline-flex h-4 w-px bg-gray-200 dark:bg-gray-700" />
            <button
              type="button"
              onClick={handleMarkAllAsRead}
              className="text-xs text-hse-primary hover:underline"
            >
              {t('notifications.markAllRead')}
            </button>
            <button
              type="button"
              onClick={handleClearRead}
              className="inline-flex items-center gap-1 text-xs text-red-600 dark:text-red-400 hover:underline"
            >
              <Trash2 className="w-3 h-3" />
              Clear read
            </button>
          </div>
        </div>

        {loading ? (
          <div className="flex items-center justify-center py-12">
            <Loader2 className="w-6 h-6 animate-spin text-hse-primary" />
          </div>
        ) : filteredNotifications.length === 0 ? (
          <div className="py-12 text-center text-gray-500 dark:text-gray-400">
            <Bell className="w-10 h-10 mx-auto mb-3 text-gray-300 dark:text-gray-600" />
            <p className="text-sm">{t('notifications.noNotifications')}</p>
          </div>
        ) : (
          <div className="max-h-[70vh] overflow-y-auto divide-y divide-gray-100 dark:divide-gray-700">
            {filteredNotifications.map((notif) => {
              const style = getNotificationStyle(notif.type)
              const IconComponent = style.icon
              const isUnread = !notif.read_at

              return (
                <div
                  key={notif.id}
                  className={`px-4 py-3 flex gap-3 items-start ${
                    isUnread ? 'bg-blue-50/40 dark:bg-blue-900/10' : 'bg-white dark:bg-gray-800'
                  }`}
                >
                  <div className={`w-9 h-9 rounded-full ${style.bg} flex items-center justify-center flex-shrink-0`}>
                    <IconComponent className={`w-4 h-4 ${style.color}`} />
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className="flex items-start justify-between gap-2">
                      <p className={`text-sm ${isUnread ? 'font-semibold' : 'font-medium'} text-gray-900 dark:text-gray-100`}>
                        {notif.title}
                      </p>
                      {isUnread && (
                        <button
                          type="button"
                          onClick={() => handleMarkAsRead(notif)}
                          className="text-xs text-hse-primary hover:underline flex-shrink-0"
                        >
                          {t('notifications.markRead')}
                        </button>
                      )}
                    </div>
                    {notif.message && (
                      <p className="text-xs text-gray-600 dark:text-gray-300 mt-1">
                        {notif.message}
                      </p>
                    )}
                    {notif.project && (
                      <p className="text-xs text-gray-400 dark:text-gray-500 mt-1 flex items-center gap-1">
                        <FolderKanban className="w-3 h-3" />
                        {notif.project.name}
                      </p>
                    )}
                    <p className="text-xs text-gray-400 dark:text-gray-500 mt-1">
                      {new Date(notif.created_at).toLocaleDateString()} {new Date(notif.created_at).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                    </p>
                    {notif.type === 'reminder' && (
                      <p className="text-[11px] text-amber-700 dark:text-amber-300 mt-1">
                        {TYPE_LABELS.reminder}: pending KPI or SOR action.
                      </p>
                    )}
                  </div>
                </div>
              )
            })}
          </div>
        )}
      </div>
    </div>
  )
}
