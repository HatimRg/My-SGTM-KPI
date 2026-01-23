import { useEffect, useMemo, useState } from 'react'
import { useLanguage } from '../../i18n'
import { bugReportService } from '../../services/api'
import { Modal } from '../../components/ui'
import toast from 'react-hot-toast'
import {
  Bug,
  RefreshCw,
  Eye,
  Download,
  Loader2,
  User,
  Calendar,
  AlertTriangle,
} from 'lucide-react'

const extractFilename = (contentDisposition) => {
  if (!contentDisposition) return null
  const match = /filename\*=UTF-8''([^;]+)|filename="?([^";]+)"?/i.exec(contentDisposition)
  const value = decodeURIComponent(match?.[1] ?? match?.[2] ?? '')
  return value !== '' ? value : null
}

const downloadBlob = (blob, filename) => {
  const url = URL.createObjectURL(blob)
  const a = document.createElement('a')
  a.href = url
  a.download = filename ?? 'attachment'
  document.body.appendChild(a)
  a.click()
  a.remove()
  setTimeout(() => URL.revokeObjectURL(url), 5000)
}

const severityBadge = (severity) => {
  const s = String(severity || '').toLowerCase()
  if (s === 'critical') return 'bg-red-100 text-red-700 dark:bg-red-900/30 dark:text-red-300'
  if (s === 'high') return 'bg-orange-100 text-orange-700 dark:bg-orange-900/30 dark:text-orange-300'
  if (s === 'medium') return 'bg-amber-100 text-amber-700 dark:bg-amber-900/30 dark:text-amber-300'
  if (s === 'low') return 'bg-blue-100 text-blue-700 dark:bg-blue-900/30 dark:text-blue-300'
  return 'bg-gray-100 text-gray-700 dark:bg-gray-800 dark:text-gray-300'
}

export default function BugReports() {
  const { t } = useLanguage()

  const [loading, setLoading] = useState(false)
  const [items, setItems] = useState([])
  const [meta, setMeta] = useState({ current_page: 1, last_page: 1, total: 0, per_page: 25 })

  const [selectedId, setSelectedId] = useState(null)
  const [selected, setSelected] = useState(null)
  const [detailsOpen, setDetailsOpen] = useState(false)
  const [loadingDetails, setLoadingDetails] = useState(false)

  const [downloading, setDownloading] = useState(false)

  const fetchList = async (page = 1) => {
    try {
      setLoading(true)
      const res = await bugReportService.list({ per_page: 25, page })
      setItems(res.data?.data ?? [])
      setMeta(res.data?.meta ?? { current_page: 1, last_page: 1, total: 0, per_page: 25 })
    } catch (e) {
      toast.error(e.response?.data?.message ?? t('errors.somethingWentWrong'))
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    fetchList(1)
  }, [])

  const openDetails = async (id) => {
    try {
      setSelectedId(id)
      setDetailsOpen(true)
      setLoadingDetails(true)
      const res = await bugReportService.getById(id)
      setSelected(res.data?.data ?? null)
    } catch (e) {
      toast.error(e.response?.data?.message ?? t('errors.somethingWentWrong'))
      setDetailsOpen(false)
      setSelected(null)
      setSelectedId(null)
    } finally {
      setLoadingDetails(false)
    }
  }

  const closeDetails = () => {
    setDetailsOpen(false)
    setSelected(null)
    setSelectedId(null)
  }

  const handleDownloadAttachment = async () => {
    if (!selected?.id) return
    try {
      setDownloading(true)
      const res = await bugReportService.downloadAttachment(selected.id)
      const blob = res.data
      const filename =
        extractFilename(res.headers?.['content-disposition'] || res.headers?.['Content-Disposition']) ||
        selected?.attachment_original_name ||
        'attachment'
      downloadBlob(blob, filename)
    } catch (e) {
      toast.error(e.response?.data?.message ?? t('errors.somethingWentWrong'))
    } finally {
      setDownloading(false)
    }
  }

  const canPrev = (meta?.current_page ?? 1) > 1
  const canNext = (meta?.current_page ?? 1) < (meta?.last_page ?? 1)

  const empty = !loading && items.length === 0

  const rows = useMemo(() => {
    return items.map((r) => {
      const createdAt = r?.created_at ? new Date(r.created_at) : null
      return {
        id: r.id,
        comment: r.comment,
        severity: r.severity,
        userName: r.user?.name ?? null,
        role: r.user?.role ?? r.role ?? null,
        createdAt,
        hasAttachment: !!r.attachment_path,
      }
    })
  }, [items])

  return (
    <div className="p-4 sm:p-6">
      <div className="flex items-center justify-between gap-3 mb-6">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-xl bg-hse-primary/10 flex items-center justify-center">
            <Bug className="w-5 h-5 text-hse-primary" />
          </div>
          <div>
            <h1 className="text-xl font-bold text-gray-900 dark:text-gray-100">{t('bugReports.title')}</h1>
            <p className="text-sm text-gray-500 dark:text-gray-400">{t('bugReports.subtitle')}</p>
          </div>
        </div>

        <button
          onClick={() => fetchList(meta?.current_page ?? 1)}
          className="inline-flex items-center gap-2 px-3 py-2 rounded-lg border border-gray-200 dark:border-gray-700 hover:bg-gray-50 dark:hover:bg-gray-800 text-sm"
          disabled={loading}
        >
          <RefreshCw className={loading ? 'w-4 h-4 animate-spin' : 'w-4 h-4'} />
          {t('common.refresh')}
        </button>
      </div>

      {loading && (
        <div className="flex items-center gap-2 text-sm text-gray-600 dark:text-gray-300">
          <Loader2 className="w-4 h-4 animate-spin" />
          {t('common.loading')}
        </div>
      )}

      {empty && (
        <div className="rounded-xl border border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-900 p-6 text-center">
          <p className="text-gray-600 dark:text-gray-300">{t('common.noData')}</p>
        </div>
      )}

      {!loading && rows.length > 0 && (
        <div className="space-y-3">
          {rows.map((r) => (
            <div
              key={r.id}
              className="rounded-xl border border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-900 p-4"
            >
              <div className="flex items-start justify-between gap-3">
                <div className="min-w-0 flex-1">
                  <div className="flex flex-wrap items-center gap-2">
                    <span className={"inline-flex items-center px-2 py-1 rounded-full text-xs font-semibold " + severityBadge(r.severity)}>
                      {r.severity ?? t('bugReports.unknownSeverity')}
                    </span>
                    {r.hasAttachment && (
                      <span className="inline-flex items-center gap-1 px-2 py-1 rounded-full text-xs font-semibold bg-emerald-100 text-emerald-700 dark:bg-emerald-900/30 dark:text-emerald-300">
                        <Download className="w-3 h-3" />
                        {t('bugReports.hasAttachment')}
                      </span>
                    )}
                  </div>

                  <div className="mt-2 text-sm text-gray-900 dark:text-gray-100 font-semibold line-clamp-2">
                    {r.comment}
                  </div>

                  <div className="mt-2 flex flex-wrap items-center gap-x-4 gap-y-1 text-xs text-gray-500 dark:text-gray-400">
                    <span className="inline-flex items-center gap-1">
                      <User className="w-3.5 h-3.5" />
                      {r.userName ?? t('common.unknown')} {r.role ? `(${r.role})` : ''}
                    </span>
                    <span className="inline-flex items-center gap-1">
                      <Calendar className="w-3.5 h-3.5" />
                      {r.createdAt ? `${r.createdAt.toLocaleDateString()} ${r.createdAt.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}` : t('common.unknown')}
                    </span>
                  </div>
                </div>

                <button
                  onClick={() => openDetails(r.id)}
                  className="inline-flex items-center gap-2 px-3 py-2 rounded-lg bg-hse-primary text-white text-sm font-semibold hover:bg-hse-primary/90"
                >
                  <Eye className="w-4 h-4" />
                  {t('common.view')}
                </button>
              </div>
            </div>
          ))}

          <div className="flex items-center justify-between pt-2">
            <button
              onClick={() => canPrev && fetchList((meta?.current_page ?? 1) - 1)}
              disabled={!canPrev}
              className="px-3 py-2 rounded-lg border border-gray-200 dark:border-gray-700 text-sm disabled:opacity-50"
            >
              {t('common.previous')}
            </button>
            <div className="text-xs text-gray-500 dark:text-gray-400">
              {t('common.page')} {meta?.current_page ?? 1} {t('common.of')} {meta?.last_page ?? 1}
            </div>
            <button
              onClick={() => canNext && fetchList((meta?.current_page ?? 1) + 1)}
              disabled={!canNext}
              className="px-3 py-2 rounded-lg border border-gray-200 dark:border-gray-700 text-sm disabled:opacity-50"
            >
              {t('common.next')}
            </button>
          </div>
        </div>
      )}

      <Modal isOpen={detailsOpen} onClose={closeDetails} title={t('bugReports.detailsTitle')} size="lg">
        {loadingDetails ? (
          <div className="flex items-center gap-2 text-sm text-gray-600 dark:text-gray-300">
            <Loader2 className="w-4 h-4 animate-spin" />
            {t('common.loading')}
          </div>
        ) : !selected ? (
          <div className="text-sm text-gray-600 dark:text-gray-300">{t('common.noData')}</div>
        ) : (
          <div className="space-y-4">
            <div className="rounded-xl border border-gray-200 dark:border-gray-700 p-4 bg-gray-50 dark:bg-gray-800/40">
              <div className="flex flex-wrap items-center gap-2">
                <span className={"inline-flex items-center px-2 py-1 rounded-full text-xs font-semibold " + severityBadge(selected.severity)}>
                  {selected.severity ?? t('bugReports.unknownSeverity')}
                </span>
                {selected.impact && (
                  <span className="inline-flex items-center px-2 py-1 rounded-full text-xs font-semibold bg-gray-100 text-gray-700 dark:bg-gray-800 dark:text-gray-300">
                    {t('bugReports.impact')}: {selected.impact}
                  </span>
                )}
                {selected.reproducibility && (
                  <span className="inline-flex items-center px-2 py-1 rounded-full text-xs font-semibold bg-gray-100 text-gray-700 dark:bg-gray-800 dark:text-gray-300">
                    {t('bugReports.reproducibility')}: {selected.reproducibility}
                  </span>
                )}
              </div>

              <div className="mt-3 text-sm text-gray-900 dark:text-gray-100 font-semibold">{selected.comment}</div>

              {selected.extra_notes && (
                <div className="mt-2 text-sm text-gray-700 dark:text-gray-200 whitespace-pre-wrap">{selected.extra_notes}</div>
              )}
            </div>

            {selected.attachment_path && (
              <div className="rounded-xl border border-gray-200 dark:border-gray-700 p-4">
                <div className="flex items-start justify-between gap-3">
                  <div className="min-w-0">
                    <div className="flex items-center gap-2 text-sm font-semibold text-gray-900 dark:text-gray-100">
                      <AlertTriangle className="w-4 h-4 text-amber-500" />
                      {t('bugReports.attachment')}
                    </div>
                    <div className="mt-1 text-xs text-gray-500 dark:text-gray-400 break-all">
                      {selected.attachment_original_name ?? selected.attachment_path}
                    </div>
                  </div>

                  <button
                    onClick={handleDownloadAttachment}
                    disabled={downloading}
                    className="inline-flex items-center gap-2 px-3 py-2 rounded-lg bg-hse-primary text-white text-sm font-semibold hover:bg-hse-primary/90 disabled:opacity-50"
                  >
                    {downloading ? <Loader2 className="w-4 h-4 animate-spin" /> : <Download className="w-4 h-4" />}
                    {t('common.download')}
                  </button>
                </div>
              </div>
            )}

            <div className="flex items-center justify-end">
              <button
                onClick={closeDetails}
                className="px-4 py-2 rounded-lg border border-gray-200 dark:border-gray-700 hover:bg-gray-50 dark:hover:bg-gray-800 text-sm font-semibold"
              >
                {t('common.close')}
              </button>
            </div>
          </div>
        )}
      </Modal>
    </div>
  )
}
