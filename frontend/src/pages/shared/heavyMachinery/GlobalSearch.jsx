import { useEffect, useMemo, useState } from 'react'
import toast from 'react-hot-toast'
import api, { heavyMachineryService } from '../../../services/api'
import { useLanguage } from '../../../i18n'
import { useAuthStore } from '../../../store/authStore'
import Modal from '../../../components/ui/Modal'
import { Download, Eye, FileText, Loader2, Search, X, Truck } from 'lucide-react'

const MACHINE_IMAGE_BLOB_CACHE_MAX = 50
const machineImageBlobCache = new Map()

export default function GlobalSearch() {
  const { t } = useLanguage()
  const { token } = useAuthStore()

  const [query, setQuery] = useState('')
  const [debounced, setDebounced] = useState('')
  const [loading, setLoading] = useState(false)
  const [hasSearched, setHasSearched] = useState(false)
  const [result, setResult] = useState(null)

  const [detailsOpen, setDetailsOpen] = useState(false)

  const [detailsSections, setDetailsSections] = useState({
    info: true,
    documents: true,
    preview: true,
  })

  const [activePreview, setActivePreview] = useState(null)
  const [previewUrl, setPreviewUrl] = useState(null)
  const [previewLoading, setPreviewLoading] = useState(false)

  const normalizeApiPath = (url) => {
    if (!url) return null
    if (typeof url !== 'string') return null
    if (url.startsWith('/api/')) return url.slice(4)
    if (url.startsWith('api/')) return url.slice(3)
    return url
  }

  const MachineImage = ({ machineId, updatedAt, alt, className }) => {
    const [src, setSrc] = useState(null)

    useEffect(() => {
      if (!machineId || !token) {
        setSrc(null)
        return
      }

      let cancelled = false
      const v = updatedAt ? encodeURIComponent(String(updatedAt)) : ''
      const url = `/api/heavy-machinery/machines/${machineId}/image${v ? `?v=${v}` : ''}`

      const cacheKey = `${token}::${machineId}::${v}`
      const cached = machineImageBlobCache.get(cacheKey)

      if (cached?.objectUrl) {
        setSrc(cached.objectUrl)
        return () => {
          cancelled = true
        }
      }

      if (cached?.pending) {
        cached.pending
          .then((objectUrl) => {
            if (!cancelled) setSrc(objectUrl)
          })
          .catch(() => {
            if (!cancelled) setSrc(null)
          })

        return () => {
          cancelled = true
        }
      }

      const pending = (async () => {
        const res = await fetch(url, {
          headers: {
            Authorization: `Bearer ${token}`,
          },
        })
        if (!res.ok) throw new Error(`image fetch failed: ${res.status}`)
        const blob = await res.blob()
        return URL.createObjectURL(blob)
      })()

      machineImageBlobCache.set(cacheKey, { pending })

      ;(async () => {
        try {
          const objectUrl = await pending
          machineImageBlobCache.set(cacheKey, { objectUrl })

          while (machineImageBlobCache.size > MACHINE_IMAGE_BLOB_CACHE_MAX) {
            const firstKey = machineImageBlobCache.keys().next().value
            const first = machineImageBlobCache.get(firstKey)
            machineImageBlobCache.delete(firstKey)
            if (first?.objectUrl) URL.revokeObjectURL(first.objectUrl)
          }

          if (!cancelled) setSrc(objectUrl)
        } catch {
          machineImageBlobCache.delete(cacheKey)
          if (!cancelled) setSrc(null)
        }
      })()

      return () => {
        cancelled = true
      }
    }, [machineId, token, updatedAt])

    if (!src) return null
    return <img src={src} alt={alt} className={className} loading="lazy" />
  }

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
    a.download = filename ?? 'file.pdf'
    document.body.appendChild(a)
    a.click()
    a.remove()
    setTimeout(() => URL.revokeObjectURL(url), 5000)
  }

  useEffect(() => {
    const id = setTimeout(() => {
      setDebounced(query.trim())
    }, 350)
    return () => clearTimeout(id)
  }, [query])

  useEffect(() => {
    const run = async () => {
      if (!debounced) {
        setHasSearched(false)
        setResult(null)
        return
      }

      try {
        setLoading(true)
        setHasSearched(true)
        const res = await heavyMachineryService.globalSearch(debounced)
        setResult(res.data?.data ?? null)
      } catch (e) {
        toast.error(e.response?.data?.message ?? t('errors.somethingWentWrong'))
        setResult(null)
      } finally {
        setLoading(false)
      }
    }

    run()
  }, [debounced, t])

  useEffect(() => {
    return () => {
      if (previewUrl) URL.revokeObjectURL(previewUrl)
    }
  }, [previewUrl])

  const machine = result?.machine ?? null
  const documents = useMemo(() => {
    return Array.isArray(result?.documents) ? result.documents : []
  }, [result])

  const openPreview = async (doc) => {
    if (!doc?.file_view_url) return

    try {
      setActivePreview(doc)
      setPreviewLoading(true)
      setDetailsSections((prev) => ({ ...prev, preview: true }))

      if (previewUrl) {
        URL.revokeObjectURL(previewUrl)
        setPreviewUrl(null)
      }

      const path = normalizeApiPath(doc.file_view_url)
      const res = await api.get(path, { responseType: 'blob' })
      const url = URL.createObjectURL(res.data)
      setPreviewUrl(url)
    } catch (e) {
      toast.error(e.response?.data?.message ?? t('errors.somethingWentWrong'))
      setActivePreview(null)
    } finally {
      setPreviewLoading(false)
    }
  }

  const closePreview = () => {
    setActivePreview(null)
    setPreviewLoading(false)
    if (previewUrl) {
      URL.revokeObjectURL(previewUrl)
      setPreviewUrl(null)
    }
  }

  const closeDetails = () => {
    setDetailsOpen(false)
    closePreview()
  }

  const handleDownload = async (doc) => {
    if (!doc?.file_download_url) return
    try {
      const path = normalizeApiPath(doc.file_download_url)
      const res = await api.get(path, { responseType: 'blob' })
      const filenameFromHeader = extractFilename(res.headers?.['content-disposition'])
      const fallback = `${doc.document_key ?? 'document'}.pdf`
      downloadBlob(res.data, filenameFromHeader ?? fallback)
    } catch (e) {
      toast.error(e.response?.data?.message ?? t('errors.somethingWentWrong'))
    }
  }

  return (
    <div className="space-y-6 animate-fade-in">
      <div>
        <h1 className="text-2xl font-bold text-gray-900 dark:text-gray-100">{t('heavyMachinery.title')}</h1>
        <p className="text-gray-500 dark:text-gray-400 mt-1">{t('heavyMachinery.globalSearch.title')}</p>
      </div>

      <div className="card p-4 md:p-6 space-y-3">
        <div className="flex flex-col md:flex-row md:items-center gap-3">
          <div className="relative flex-1">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
            <input
              className="input pl-10 pr-10"
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              placeholder={t('heavyMachinery.globalSearch.searchPlaceholder')}
            />
            {query && (
              <button
                type="button"
                onClick={() => setQuery('')}
                className="absolute right-2 top-1/2 -translate-y-1/2 p-1.5 rounded-md hover:bg-gray-100 dark:hover:bg-gray-800"
                title={t('common.clear') ?? t('common.reset')}
              >
                <X className="w-4 h-4 text-gray-500" />
              </button>
            )}
          </div>

          <div className="flex items-center gap-2">
            <button type="button" className="btn-outline" onClick={() => setQuery('')} disabled={!query && !hasSearched}>
              {t('common.reset')}
            </button>
          </div>
        </div>

        <p className="text-xs text-gray-500 dark:text-gray-400">{t('heavyMachinery.globalSearch.help')}</p>
      </div>

      <div className="card p-4 md:p-6">
        {loading ? (
          <div className="flex items-center justify-center py-10">
            <Loader2 className="w-6 h-6 animate-spin text-hse-primary" />
          </div>
        ) : !hasSearched ? (
          <div className="text-sm text-gray-600 dark:text-gray-300">{t('heavyMachinery.globalSearch.help')}</div>
        ) : !machine ? (
          <div className="text-sm text-gray-600 dark:text-gray-300">{t('heavyMachinery.globalSearch.noResult')}</div>
        ) : (
          <div className="space-y-4">
            <div
              role="button"
              tabIndex={0}
              onClick={() => setDetailsOpen(true)}
              onKeyDown={(e) => {
                if (e.key === 'Enter') setDetailsOpen(true)
              }}
              className="card p-4 text-left hover:shadow-md transition-shadow cursor-pointer max-w-4xl mx-auto"
            >
              {machine.image_url && (
                <div className="mb-3">
                  <div className="w-full h-48 rounded-lg border border-gray-200 dark:border-gray-700 bg-gray-50 dark:bg-gray-800 overflow-hidden flex items-center justify-center">
                    <MachineImage
                      machineId={machine.id}
                      updatedAt={machine.updated_at}
                      alt={machine.serial_number}
                      className="w-full h-full object-contain"
                    />
                  </div>
                </div>
              )}

              <div className="flex items-start justify-between gap-3">
                <div className="min-w-0">
                  <p className="font-semibold text-gray-900 dark:text-gray-100 truncate">
                    {machine.internal_code ? `${machine.internal_code} · ${machine.serial_number}` : machine.serial_number}
                  </p>
                  <p className="text-xs text-gray-500 dark:text-gray-400 mt-1 truncate">
                    {(machine.machine_type ?? '') +
                      (machine.brand ? ` · ${machine.brand}` : '') +
                      (machine.model ? ` · ${machine.model}` : '')}
                  </p>
                  <p className="text-[11px] text-gray-500 dark:text-gray-400 mt-1 truncate">
                    {machine.project?.name ?? '-'}
                  </p>
                </div>

                <span
                  className={`inline-flex items-center px-2 py-0.5 rounded-full text-[11px] ${
                    machine.is_active
                      ? 'bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-200'
                      : 'bg-gray-100 text-gray-700 dark:bg-gray-800 dark:text-gray-300'
                  }`}
                >
                  {machine.is_active ? t('common.active') : t('common.inactive')}
                </span>
              </div>
            </div>

            {detailsOpen && (
              <Modal isOpen={detailsOpen} onClose={closeDetails} title={t('heavyMachinery.viewMachines.details')} size="full">
                <div className="space-y-4">
                  <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
                    <div className="w-full rounded-xl border border-gray-200 dark:border-gray-700 bg-gray-50 dark:bg-gray-800 overflow-hidden">
                      {machine.image_url ? (
                        <div className="w-full">
                          <MachineImage
                            machineId={machine.id}
                            updatedAt={machine.updated_at}
                            alt={machine.serial_number ?? 'machine'}
                            className="w-full h-72 object-contain"
                          />
                        </div>
                      ) : (
                        <div className="w-full h-72 flex items-center justify-center text-sm text-gray-500">
                          {t('common.noData')}
                        </div>
                      )}
                    </div>

                    <div className="min-w-0 flex flex-col justify-between gap-3">
                      <div className="min-w-0">
                        <p className="text-xs text-gray-500 dark:text-gray-400">{machine.project?.name ?? '-'}</p>
                        <h3 className="text-xl font-bold text-gray-900 dark:text-gray-100 truncate">
                          {machine.internal_code ? `${machine.internal_code} · ${machine.serial_number}` : machine.serial_number}
                        </h3>
                        <p className="text-sm text-gray-600 dark:text-gray-300 mt-1">
                          {(machine.machine_type ?? '') +
                            (machine.brand ? ` · ${machine.brand}` : '') +
                            (machine.model ? ` · ${machine.model}` : '')}
                        </p>
                        <div className="mt-2">
                          <span
                            className={`inline-flex items-center px-2 py-0.5 rounded-full text-[11px] ${
                              machine.is_active
                                ? 'bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-200'
                                : 'bg-gray-100 text-gray-700 dark:bg-gray-800 dark:text-gray-300'
                            }`}
                          >
                            {machine.is_active ? t('common.active') : t('common.inactive')}
                          </span>
                        </div>
                      </div>

                      <div className="flex items-center gap-2">
                        <div className="shrink-0 w-10 h-10 rounded-lg bg-hse-primary/10 flex items-center justify-center">
                          <Truck className="w-5 h-5 text-hse-primary" />
                        </div>
                        <div className="text-xs text-gray-600 dark:text-gray-300">{t('heavyMachinery.viewMachines.tabs.documents')}</div>
                      </div>
                    </div>
                  </div>

                  <div className="space-y-3">
                    <div className="card p-4">
                      <button
                        type="button"
                        onClick={() => setDetailsSections((prev) => ({ ...prev, info: !prev.info }))}
                        className="w-full flex items-center justify-between gap-3"
                      >
                        <span className="font-semibold text-gray-900 dark:text-gray-100 text-sm">{t('heavyMachinery.viewMachines.details')}</span>
                        <span className="text-xs text-gray-500 dark:text-gray-400">{detailsSections.info ? '−' : '+'}</span>
                      </button>

                      {detailsSections.info && (
                        <div className="mt-4 grid grid-cols-1 md:grid-cols-2 gap-3 text-sm">
                          <div className="flex items-center justify-between gap-3">
                            <span className="text-gray-500 dark:text-gray-400">{t('heavyMachinery.viewMachines.machine.serial')}</span>
                            <span className="text-gray-900 dark:text-gray-100 font-medium">{machine.serial_number ?? '-'}</span>
                          </div>
                          <div className="flex items-center justify-between gap-3">
                            <span className="text-gray-500 dark:text-gray-400">{t('heavyMachinery.viewMachines.machine.internal')}</span>
                            <span className="text-gray-900 dark:text-gray-100 font-medium">{machine.internal_code ?? '-'}</span>
                          </div>
                          <div className="flex items-center justify-between gap-3">
                            <span className="text-gray-500 dark:text-gray-400">{t('heavyMachinery.viewMachines.machine.type')}</span>
                            <span className="text-gray-900 dark:text-gray-100 font-medium">{machine.machine_type ?? '-'}</span>
                          </div>
                          <div className="flex items-center justify-between gap-3">
                            <span className="text-gray-500 dark:text-gray-400">{t('heavyMachinery.viewMachines.machine.brand')}</span>
                            <span className="text-gray-900 dark:text-gray-100 font-medium">{machine.brand ?? '-'}</span>
                          </div>
                          <div className="flex items-center justify-between gap-3">
                            <span className="text-gray-500 dark:text-gray-400">{t('heavyMachinery.viewMachines.machine.model')}</span>
                            <span className="text-gray-900 dark:text-gray-100 font-medium">{machine.model ?? '-'}</span>
                          </div>
                          <div className="flex items-center justify-between gap-3">
                            <span className="text-gray-500 dark:text-gray-400">{t('heavyMachinery.viewMachines.machine.project')}</span>
                            <span className="text-gray-900 dark:text-gray-100 font-medium">{machine.project?.name ?? '-'}</span>
                          </div>
                        </div>
                      )}
                    </div>

                    <div className="card p-4">
                      <button
                        type="button"
                        onClick={() => setDetailsSections((prev) => ({ ...prev, documents: !prev.documents }))}
                        className="w-full flex items-center justify-between gap-3"
                      >
                        <span className="font-semibold text-gray-900 dark:text-gray-100 text-sm">{t('heavyMachinery.viewMachines.tabs.documents')}</span>
                        <span className="text-xs text-gray-500 dark:text-gray-400">{detailsSections.documents ? '−' : '+'}</span>
                      </button>

                      {detailsSections.documents && (
                        <div className="mt-4 overflow-x-auto">
                          <table className="min-w-full text-xs">
                            <thead>
                              <tr className="border-b border-gray-200 dark:border-gray-700 text-left">
                                <th className="py-2 pr-3 font-medium text-gray-500 dark:text-gray-400">{t('heavyMachinery.viewMachines.documents.label')}</th>
                                <th className="py-2 pr-3 font-medium text-gray-500 dark:text-gray-400">{t('heavyMachinery.viewMachines.documents.startDate')}</th>
                                <th className="py-2 pr-3 font-medium text-gray-500 dark:text-gray-400">{t('heavyMachinery.viewMachines.documents.expiryDate')}</th>
                                <th className="py-2 pr-3 font-medium text-gray-500 dark:text-gray-400">{t('common.actions')}</th>
                              </tr>
                            </thead>
                            <tbody>
                              {documents.length === 0 ? (
                                <tr>
                                  <td colSpan={4} className="py-4 text-center text-gray-500 dark:text-gray-400">
                                    {t('common.noData')}
                                  </td>
                                </tr>
                              ) : (
                                documents.map((d) => (
                                  <tr key={d.id} className="border-b border-gray-100 dark:border-gray-800">
                                    <td className="py-2 pr-3 text-gray-900 dark:text-gray-100">
                                      <div className="font-medium">{d.document_label}</div>
                                      <div className="text-[11px] text-gray-500 dark:text-gray-400">{d.document_key}</div>
                                    </td>
                                    <td className="py-2 pr-3 text-gray-700 dark:text-gray-200">{d.start_date ?? ''}</td>
                                    <td className="py-2 pr-3 text-gray-700 dark:text-gray-200">{d.expiry_date ?? ''}</td>
                                    <td className="py-2 pr-3">
                                      <div className="flex flex-wrap gap-2">
                                        {d.file_view_url && (
                                          <button type="button" className="btn-outline btn-sm flex items-center gap-2" onClick={() => openPreview(d)}>
                                            <Eye className="w-4 h-4" />
                                            {t('common.view')}
                                          </button>
                                        )}
                                        {d.file_download_url && (
                                          <button type="button" className="btn-outline btn-sm flex items-center gap-2" onClick={() => handleDownload(d)}>
                                            <Download className="w-4 h-4" />
                                            {t('common.download')}
                                          </button>
                                        )}
                                      </div>
                                    </td>
                                  </tr>
                                ))
                              )}
                            </tbody>
                          </table>
                        </div>
                      )}
                    </div>

                    <div className="card p-4">
                      <button
                        type="button"
                        onClick={() => setDetailsSections((prev) => ({ ...prev, preview: !prev.preview }))}
                        className="w-full flex items-center justify-between gap-3"
                      >
                        <span className="font-semibold text-gray-900 dark:text-gray-100 text-sm">{t('common.view')}</span>
                        <span className="text-xs text-gray-500 dark:text-gray-400">{detailsSections.preview ? '−' : '+'}</span>
                      </button>

                      {detailsSections.preview && (
                        <div className="mt-4 space-y-3">
                          {!activePreview ? (
                            <div className="text-xs text-gray-500 dark:text-gray-400">{t('common.noData')}</div>
                          ) : (
                            <div className="space-y-3">
                              <div className="flex items-center justify-between gap-2">
                                <div className="min-w-0">
                                  <div className="text-sm font-medium text-gray-900 dark:text-gray-100 truncate">
                                    {activePreview.document_label}
                                  </div>
                                  <div className="text-[11px] text-gray-500 dark:text-gray-400 truncate">
                                    {activePreview.document_key}
                                  </div>
                                </div>
                                <button type="button" onClick={closePreview} className="btn-outline btn-sm">
                                  {t('common.close')}
                                </button>
                              </div>

                              <div className="h-[70vh]">
                                {previewLoading ? (
                                  <div className="w-full h-full rounded-lg border border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-900 flex items-center justify-center">
                                    <Loader2 className="w-6 h-6 animate-spin text-hse-primary" />
                                  </div>
                                ) : previewUrl ? (
                                  <iframe
                                    src={previewUrl}
                                    title={t('common.view')}
                                    className="w-full h-full rounded-lg border border-gray-200 dark:border-gray-700 bg-white"
                                  />
                                ) : (
                                  <div className="w-full h-full rounded-lg border border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-900 flex items-center justify-center text-sm text-gray-500 dark:text-gray-400">
                                    {t('errors.somethingWentWrong')}
                                  </div>
                                )}
                              </div>

                              {activePreview?.file_download_url && (
                                <div className="flex justify-end">
                                  <button type="button" onClick={() => handleDownload(activePreview)} className="btn-primary inline-flex items-center gap-2 text-sm">
                                    <FileText className="w-4 h-4" />
                                    {t('common.download')}
                                  </button>
                                </div>
                              )}
                            </div>
                          )}
                        </div>
                      )}
                    </div>
                  </div>
                </div>
              </Modal>
            )}
          </div>
        )}
      </div>
    </div>
  )
}
