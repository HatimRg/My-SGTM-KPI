import { useEffect, useMemo, useState } from 'react'
import { Modal, Select } from '../ui'
import { useLanguage } from '../../i18n'
import { userService, notificationService } from '../../services/api'
import toast from 'react-hot-toast'
import { Search, X, UserPlus, AlertTriangle } from 'lucide-react'

const ROLE_OPTIONS = [
  'admin',
  'consultation',
  'pole_director',
  'works_director',
  'hse_director',
  'hr_director',
  'hse_manager',
  'regional_hse_manager',
  'responsable',
  'supervisor',
  'user',
  'hr',
]

export default function UrgentNotificationComposer({ isOpen, onClose }) {
  const { t } = useLanguage()

  const [target, setTarget] = useState('all')
  const [role, setRole] = useState('user')
  const [urgency, setUrgency] = useState('high')
  const [message, setMessage] = useState('')
  const [sending, setSending] = useState(false)

  const [userSearch, setUserSearch] = useState('')
  const [userResults, setUserResults] = useState([])
  const [userLoading, setUserLoading] = useState(false)
  const [selectedUsers, setSelectedUsers] = useState([])

  useEffect(() => {
    if (!isOpen) return
    setTarget('all')
    setRole('user')
    setUrgency('high')
    setMessage('')
    setUserSearch('')
    setUserResults([])
    setSelectedUsers([])
    setUserLoading(false)
    setSending(false)
  }, [isOpen])

  const roleLabel = (r) => {
    const key1 = `users.roles.${r}`
    const v1 = t(key1)
    if (v1 !== key1) return v1
    const key2 = `roles.${r}`
    const v2 = t(key2)
    return v2 === key2 ? r : v2
  }

  const selectedUserIds = useMemo(() => new Set(selectedUsers.map((u) => u.id)), [selectedUsers])

  const urgencyUi = useMemo(() => {
    const key = String(urgency || '').toLowerCase()
    if (key === 'low') {
      return {
        badge: 'bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-200',
        ring: 'ring-2 ring-green-200 dark:ring-green-900/40',
        label: t('notifications.urgent.urgencyLow'),
      }
    }
    if (key === 'high') {
      return {
        badge: 'bg-red-100 text-red-700 dark:bg-red-900/30 dark:text-red-200',
        ring: 'ring-2 ring-red-200 dark:ring-red-900/40',
        label: t('notifications.urgent.urgencyHigh'),
      }
    }
    return {
      badge: 'bg-amber-100 text-amber-800 dark:bg-amber-900/30 dark:text-amber-200',
      ring: 'ring-2 ring-amber-200 dark:ring-amber-900/40',
      label: t('notifications.urgent.urgencyMedium'),
    }
  }, [urgency, t])

  useEffect(() => {
    if (!isOpen) return
    if (target !== 'user_ids') return

    const query = userSearch.trim()
    if (query.length < 2) {
      setUserResults([])
      setUserLoading(false)
      return
    }

    let cancelled = false
    const timer = setTimeout(async () => {
      try {
        setUserLoading(true)
        const res = await userService.getAll({ search: query, per_page: 10, sort_by: 'name', sort_order: 'asc' })
        if (cancelled) return
        setUserResults(Array.isArray(res.data?.data) ? res.data.data : [])
      } catch {
        if (!cancelled) setUserResults([])
      } finally {
        if (!cancelled) setUserLoading(false)
      }
    }, 250)

    return () => {
      cancelled = true
      clearTimeout(timer)
    }
  }, [isOpen, target, userSearch])

  const addUser = (u) => {
    if (!u?.id) return
    if (selectedUserIds.has(u.id)) return
    setSelectedUsers((prev) => [...prev, { id: u.id, name: u.name, email: u.email }])
  }

  const removeUser = (id) => {
    setSelectedUsers((prev) => prev.filter((u) => u.id !== id))
  }

  const handleSubmit = async () => {
    const trimmed = message.trim()
    if (!trimmed) {
      toast.error(t('notifications.urgent.requiredMessage'))
      return
    }

    if (target === 'user_ids' && selectedUsers.length === 0) {
      toast.error(t('notifications.urgent.noRecipients'))
      return
    }

    try {
      setSending(true)
      const payload = {
        target,
        urgency,
        message: trimmed,
      }

      if (target === 'role') payload.role = role
      if (target === 'user_ids') payload.user_ids = selectedUsers.map((u) => u.id)

      await notificationService.urgentSend(payload)
      toast.success(t('notifications.urgent.sentSuccess'))
      onClose?.()
    } catch (e) {
      toast.error(e?.response?.data?.message ?? t('notifications.urgent.sentError'))
    } finally {
      setSending(false)
    }
  }

  return (
    <Modal isOpen={isOpen} onClose={onClose} title={t('notifications.urgent.composerTitle')} size="lg">
      <div className="space-y-5">
        <div className={`rounded-2xl p-4 ${urgencyUi.ring} bg-gray-50 dark:bg-gray-900/30`}>
          <div className="flex items-start gap-3">
            <div className="w-10 h-10 rounded-xl bg-white dark:bg-gray-900 flex items-center justify-center ring-1 ring-gray-200 dark:ring-gray-700">
              <AlertTriangle className="w-5 h-5 text-gray-700 dark:text-gray-200" />
            </div>
            <div className="min-w-0">
              <div className="text-sm font-extrabold text-gray-900 dark:text-gray-100">
                {t('notifications.urgent.composerTitle')}
              </div>
              <div className="mt-1">
                <span className={`inline-flex items-center px-2.5 py-1 rounded-full text-xs font-bold ${urgencyUi.badge}`}>
                  {urgencyUi.label}
                </span>
              </div>
            </div>
          </div>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
          <div>
            <label className="block text-sm font-semibold text-gray-700 dark:text-gray-200">
              {t('notifications.urgent.targetLabel')}
            </label>
            <Select
              value={target}
              onChange={(e) => {
                setTarget(e.target.value)
                setUserSearch('')
                setUserResults([])
                setSelectedUsers([])
              }}
              className="mt-1 w-full"
            >
              <option value="all">{t('notifications.urgent.targetAll')}</option>
              <option value="role">{t('notifications.urgent.targetRole')}</option>
              <option value="user_ids">{t('notifications.urgent.targetUsers')}</option>
            </Select>
          </div>

          <div>
            <label className="block text-sm font-semibold text-gray-700 dark:text-gray-200">
              {t('notifications.urgent.urgencyLabel')}
            </label>
            <Select value={urgency} onChange={(e) => setUrgency(e.target.value)} className="mt-1 w-full">
              <option value="low">{t('notifications.urgent.urgencyLow')}</option>
              <option value="medium">{t('notifications.urgent.urgencyMedium')}</option>
              <option value="high">{t('notifications.urgent.urgencyHigh')}</option>
            </Select>
          </div>
        </div>

        {target === 'role' && (
          <div>
            <label className="block text-sm font-semibold text-gray-700 dark:text-gray-200">
              {t('notifications.urgent.roleLabel')}
            </label>
            <Select value={role} onChange={(e) => setRole(e.target.value)} className="mt-1 w-full">
              {ROLE_OPTIONS.map((r) => (
                <option key={r} value={r}>
                  {roleLabel(r)}
                </option>
              ))}
            </Select>
          </div>
        )}

        {target === 'user_ids' && (
          <div className="space-y-2">
            <label className="block text-sm font-semibold text-gray-700 dark:text-gray-200">
              {t('notifications.urgent.usersLabel')}
            </label>

            <div className="relative">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
              <input
                type="text"
                value={userSearch}
                onChange={(e) => setUserSearch(e.target.value)}
                placeholder={t('notifications.urgent.usersSearchPlaceholder')}
                className="input pl-10"
              />
            </div>

            {selectedUsers.length > 0 && (
              <div className="flex flex-wrap gap-2">
                {selectedUsers.map((u) => (
                  <div
                    key={u.id}
                    className="inline-flex items-center gap-2 px-2.5 py-1 rounded-full bg-gray-100 dark:bg-gray-700 text-sm"
                  >
                    <span className="text-gray-800 dark:text-gray-100 font-medium">{u.name}</span>
                    <button
                      type="button"
                      onClick={() => removeUser(u.id)}
                      className="p-1 rounded-full hover:bg-gray-200 dark:hover:bg-gray-600"
                      title={t('common.remove')}
                    >
                      <X className="w-3.5 h-3.5 text-gray-500 dark:text-gray-300" />
                    </button>
                  </div>
                ))}
              </div>
            )}

            {(userLoading || userResults.length > 0) && (
              <div className="rounded-xl border border-gray-200 dark:border-gray-700 overflow-hidden">
                {userLoading ? (
                  <div className="p-3 text-sm text-gray-500 dark:text-gray-400">{t('common.loading')}</div>
                ) : (
                  <div className="max-h-56 overflow-y-auto">
                    {userResults
                      .filter((u) => !selectedUserIds.has(u.id))
                      .map((u) => (
                        <button
                          type="button"
                          key={u.id}
                          onClick={() => addUser(u)}
                          className="w-full text-left px-3 py-2 hover:bg-gray-50 dark:hover:bg-gray-800 flex items-center justify-between gap-3"
                        >
                          <div className="min-w-0">
                            <div className="text-sm font-semibold text-gray-900 dark:text-gray-100 truncate">{u.name}</div>
                            <div className="text-xs text-gray-500 dark:text-gray-400 truncate">{u.email}</div>
                          </div>
                          <UserPlus className="w-4 h-4 text-hse-primary shrink-0" />
                        </button>
                      ))}
                  </div>
                )}
              </div>
            )}
          </div>
        )}

        <div>
          <label className="block text-sm font-semibold text-gray-700 dark:text-gray-200">
            {t('notifications.urgent.messageLabel')}
          </label>
          <textarea
            value={message}
            onChange={(e) => setMessage(e.target.value)}
            rows={5}
            className="mt-1 w-full rounded-lg border border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-900 px-3 py-2 text-sm"
            placeholder={t('notifications.urgent.messagePlaceholder')}
          />
        </div>

        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-end gap-2 pt-2">
          <button
            onClick={onClose}
            className="px-4 py-2 rounded-lg border border-gray-200 dark:border-gray-700 hover:bg-gray-50 dark:hover:bg-gray-800 text-sm font-semibold"
            disabled={sending}
          >
            {t('common.cancel')}
          </button>
          <button
            onClick={handleSubmit}
            className="inline-flex items-center justify-center gap-2 px-4 py-2 rounded-lg bg-hse-primary text-white hover:bg-hse-primary/90 text-sm font-semibold disabled:opacity-50"
            disabled={sending}
          >
            {sending ? t('notifications.urgent.sending') : t('notifications.urgent.send')}
          </button>
        </div>
      </div>
    </Modal>
  )
}
