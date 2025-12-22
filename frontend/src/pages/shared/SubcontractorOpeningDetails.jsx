import { useEffect, useMemo, useState } from 'react'
import { useLocation, useNavigate, useParams } from 'react-router-dom'
import api, { subcontractorOpeningsService } from '../../services/api'
import { useLanguage } from '../../i18n'
import Modal from '../../components/ui/Modal'
import DatePicker from '../../components/ui/DatePicker'
import {
  ArrowLeft,
  Building2,
  FileText,
  Loader2,
  Upload,
  Download,
  AlertTriangle,
  CheckCircle,
  XCircle,
  Trash2,
} from 'lucide-react'
import toast from 'react-hot-toast'

const DOC_STATUS_BADGE = {
  valid: 'bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-300',
  expiring: 'bg-amber-100 text-amber-700 dark:bg-amber-900/30 dark:text-amber-300',
  expired: 'bg-red-100 text-red-700 dark:bg-red-900/30 dark:text-red-300',
  no_expiry: 'bg-gray-100 text-gray-700 dark:bg-gray-800 dark:text-gray-300',
  no_file: 'bg-gray-100 text-gray-700 dark:bg-gray-800 dark:text-gray-300',
}

const DOC_STATUS_ICON = {
  valid: CheckCircle,
  expiring: AlertTriangle,
  expired: XCircle,
}

export default function SubcontractorOpeningDetails() {
  const { t } = useLanguage()
  const location = useLocation()
  const navigate = useNavigate()
  const { id } = useParams()

  const [loading, setLoading] = useState(false)
  const [saving, setSaving] = useState(false)

  const [opening, setOpening] = useState(null)
  const [documents, setDocuments] = useState([])

  const [activeDoc, setActiveDoc] = useState(null)
  const [activePreview, setActivePreview] = useState(null)
  const [previewUrl, setPreviewUrl] = useState(null)
  const [previewLoading, setPreviewLoading] = useState(false)
  const [file, setFile] = useState(null)
  const [startDate, setStartDate] = useState('')
  const [expiryDate, setExpiryDate] = useState('')

  const normalizeApiPath = (url) => {
    if (!url) return null
    if (typeof url !== 'string') return null
    if (url.startsWith('/api/')) return url.slice(4)
    if (url.startsWith('api/')) return url.slice(3)
    return url
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
    a.download = filename ?? 'document.pdf'
    document.body.appendChild(a)
    a.click()
    a.remove()
    setTimeout(() => URL.revokeObjectURL(url), 5000)
  }

  const fetchDetails = async () => {
    try {
      setLoading(true)
      const res = await subcontractorOpeningsService.getById(id)
      const payload = res.data
      const data = payload.data ?? payload
      setOpening(data.opening)
      setDocuments(data.documents ?? [])
    } catch (e) {
      console.error('Failed to load opening details', e)
      toast.error(e.response?.data?.message ?? t('errors.somethingWentWrong') ?? 'Failed to load')
    } finally {
      setLoading(false)
    }
  }

  const openPreview = async (doc) => {
    if (!doc?.file_view_url) return

    try {
      setActivePreview(doc)
      setPreviewLoading(true)

      if (previewUrl) {
        URL.revokeObjectURL(previewUrl)
        setPreviewUrl(null)
      }

      const path = normalizeApiPath(doc.file_view_url)
      const res = await api.get(path, { responseType: 'blob' })
      const blob = res.data
      const url = URL.createObjectURL(blob)
      setPreviewUrl(url)
    } catch (e) {
      console.error('Failed to preview PDF', e)
      toast.error(e.response?.data?.message ?? t('errors.somethingWentWrong') ?? 'Failed to preview')
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

  const handleDownload = async (doc) => {
    if (!doc?.file_download_url) return

    try {
      const path = normalizeApiPath(doc.file_download_url)
      const res = await api.get(path, { responseType: 'blob' })
      const filenameFromHeader = extractFilename(res.headers?.['content-disposition'])
      const filename = filenameFromHeader ?? `${doc.document_key ?? 'document'}.pdf`
      downloadBlob(res.data, filename)
    } catch (e) {
      console.error('Failed to download PDF', e)
      toast.error(e.response?.data?.message ?? t('errors.somethingWentWrong') ?? 'Failed to download')
    }
  }

  useEffect(() => {
    fetchDetails()
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [id])

  useEffect(() => {
    return () => {
      if (previewUrl) URL.revokeObjectURL(previewUrl)
    }
  }, [previewUrl])

  const title = useMemo(() => {
    if (!opening) return ''
    const projectName = opening.project?.name ? ` · ${opening.project.name}` : ''
    return `${opening.contractor_name}${projectName}`
  }, [opening])

  const handleFileChange = (e) => {
    const f = e.target.files?.[0]
    if (!f) {
      setFile(null)
      return
    }
    if (f.type !== 'application/pdf') {
      toast.error(t('subcontractors.pdfOnly') ?? 'PDF only')
      return
    }
    setFile(f)
  }

  const openUploadModal = (doc) => {
    setActiveDoc(doc)
    setFile(null)
    setStartDate(doc.start_date ?? '')
    setExpiryDate(doc.expiry_date ?? '')
  }

  const closeUploadModal = () => {
    setActiveDoc(null)
    setFile(null)
    setStartDate('')
    setExpiryDate('')
  }

  const handleUpload = async (e) => {
    e.preventDefault()
    if (!opening || !activeDoc || !file) return

    setSaving(true)
    try {
      const res = await subcontractorOpeningsService.uploadDocument(opening.id, {
        document_key: activeDoc.document_key,
        document_label: activeDoc.document_label,
        start_date: startDate ? startDate : undefined,
        expiry_date: expiryDate ? expiryDate : undefined,
        file,
      })

      const payload = res.data
      const data = payload.data ?? payload
      const savedDoc = data.document

      if (savedDoc?.was_compressed && savedDoc.file_size && savedDoc.compressed_size) {
        toast.success(
          t('subcontractors.documentSavedCompressed', {
            original: formatBytes(savedDoc.file_size),
            compressed: formatBytes(savedDoc.compressed_size),
          }),
        )
      } else if (savedDoc?.file_size) {
        toast.success(
          t('subcontractors.documentSavedWithSize', {
            size: formatBytes(savedDoc.file_size),
          }),
        )
      } else {
        toast.success(t('subcontractors.documentSaved'))
      }

      closeUploadModal()
      fetchDetails()
    } catch (err) {
      console.error('Upload failed', err)
      toast.error(err.response?.data?.message ?? t('subcontractors.uploadFailed') ?? 'Upload failed')
    } finally {
      setSaving(false)
    }
  }

  const handleDeleteOpening = async () => {
    if (!opening) return

    const ok = window.confirm(
      t('subcontractors.confirmDeleteOpening', {
        name: opening.contractor_name,
      }),
    )
    if (!ok) return

    try {
      await subcontractorOpeningsService.delete(opening.id)
      toast.success(t('subcontractors.openingDeleted'))

      const isAdminRoute = (location.pathname ?? '').startsWith('/admin')
      navigate(isAdminRoute ? '/admin/subcontractors' : '/subcontractors', { replace: true })
    } catch (e) {
      console.error('Failed to delete opening', e)
      toast.error(e.response?.data?.message ?? t('errors.somethingWentWrong') ?? 'Failed to delete')
    }
  }

  if (loading || !opening) {
    return (
      <div className="flex items-center justify-center py-12">
        <Loader2 className="w-6 h-6 animate-spin text-hse-primary" />
      </div>
    )
  }

  function formatBytes(bytes) {
    if (bytes == null || Number.isNaN(Number(bytes))) return ''
    const b = Number(bytes)
    if (b < 1024) return `${b} B`
    const kb = b / 1024
    if (kb < 1024) return `${kb.toFixed(1)} KB`
    const mb = kb / 1024
    if (mb < 1024) return `${mb.toFixed(2)} MB`
    const gb = mb / 1024
    return `${gb.toFixed(2)} GB`
  }

  return (
    <div className="space-y-6 animate-fade-in">
      <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-4">
        <div className="min-w-0">
          <div className="text-xs text-gray-500 dark:text-gray-400 mb-1">
            {t('nav.dashboard')} / {t('subcontractors.title')} / {t('subcontractors.opening')}
          </div>
          <div className="flex items-center gap-2">
            <Building2 className="w-5 h-5 text-hse-primary" />
            <h1 className="text-2xl font-bold text-gray-900 dark:text-gray-100 truncate">
              {title}
            </h1>
          </div>
          <p className="text-gray-600 dark:text-gray-400 mt-1">
            {t('subcontractors.openingSummary', {
              start: opening.contractor_start_date ?? '',
              workers: opening.workers_count ?? 0,
              uploaded: opening.documents_uploaded ?? 0,
              required: opening.required_documents_count ?? 0,
            })}
          </p>
          {opening.work_type && (
            <p className="text-gray-600 dark:text-gray-400 mt-1 text-sm">
              {t('subcontractors.workType')}: {opening.work_type}
            </p>
          )}
        </div>

        <div className="flex flex-wrap gap-2">
          <button
            type="button"
            className="btn-outline flex items-center gap-2"
            onClick={() => navigate(-1)}
          >
            <ArrowLeft className="w-4 h-4" />
            {t('common.back')}
          </button>

          <button
            type="button"
            className="btn-outline flex items-center gap-2 text-red-600 dark:text-red-400 border-red-200 dark:border-red-800 hover:bg-red-50 dark:hover:bg-red-900/20"
            onClick={handleDeleteOpening}
          >
            <Trash2 className="w-4 h-4" />
            {t('common.delete')}
          </button>
        </div>
      </div>

      <div className="card p-4">
        <div className="overflow-x-auto">
          <table className="min-w-full text-xs">
            <thead>
              <tr className="border-b border-gray-200 dark:border-gray-700 text-left">
                <th className="py-2 pr-3 font-medium text-gray-500 dark:text-gray-400">{t('subcontractors.table.document')}</th>
                <th className="py-2 pr-3 font-medium text-gray-500 dark:text-gray-400">{t('subcontractors.table.startDate')}</th>
                <th className="py-2 pr-3 font-medium text-gray-500 dark:text-gray-400">{t('subcontractors.table.expiryDate')}</th>
                <th className="py-2 pr-3 font-medium text-gray-500 dark:text-gray-400">{t('common.status')}</th>
                <th className="py-2 pr-3 font-medium text-gray-500 dark:text-gray-400">{t('subcontractors.table.file')}</th>
                <th className="py-2 pr-3 font-medium text-gray-500 dark:text-gray-400">{t('common.actions')}</th>
              </tr>
            </thead>
            <tbody>
              {documents.map((d) => {
                const status = d.status ?? (d.expiry_date ? 'valid' : 'no_expiry')
                const badge = DOC_STATUS_BADGE[status] ?? DOC_STATUS_BADGE.no_file
                const StatusIcon = DOC_STATUS_ICON[status]
                const statusLabel = t(`subcontractors.docStatus.${status}`)

                return (
                  <tr key={d.document_key} className="border-b border-gray-100 dark:border-gray-800">
                    <td className="py-2 pr-3 text-gray-900 dark:text-gray-100">
                      {d.document_label}
                    </td>
                    <td className="py-2 pr-3 text-gray-700 dark:text-gray-200">
                      {d.start_date ?? ''}
                    </td>
                    <td className="py-2 pr-3 text-gray-700 dark:text-gray-200">
                      {d.expiry_date ?? ''}
                    </td>
                    <td className="py-2 pr-3">
                      <span className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[11px] ${badge}`}>
                        {StatusIcon && <StatusIcon className="w-3 h-3" />}
                        {statusLabel}
                      </span>
                    </td>
                    <td className="py-2 pr-3 text-gray-700 dark:text-gray-200">
                      {d.file_view_url ? (
                        <div className="flex items-center gap-2">
                          <button
                            type="button"
                            className="text-[11px] text-hse-primary hover:underline"
                            onClick={() => openPreview(d)}
                          >
                            {t('common.view')}
                          </button>
                          <button
                            type="button"
                            onClick={() => handleDownload(d)}
                            className="text-[11px] text-gray-500 hover:underline flex items-center gap-1"
                          >
                            <Download className="w-3 h-3" />
                            {t('common.download')}
                          </button>

                          {(d.file_size != null || d.compressed_size != null) && (
                            <span className="text-[11px] text-gray-400 dark:text-gray-500">
                              {d.was_compressed && d.file_size && d.compressed_size
                                ? `${formatBytes(d.file_size)} → ${formatBytes(d.compressed_size)}`
                                : d.file_size
                                ? formatBytes(d.file_size)
                                : formatBytes(d.compressed_size)}
                            </span>
                          )}
                        </div>
                      ) : (
                        <span className="text-[11px] text-gray-400"></span>
                      )}
                    </td>
                    <td className="py-2 pr-3">
                      <button
                        type="button"
                        className="btn-outline btn-sm flex items-center gap-2"
                        onClick={() => openUploadModal(d)}
                      >
                        <Upload className="w-4 h-4" />
                        {d.file_view_url ? t('subcontractors.replace') : t('subcontractors.add')}
                      </button>
                    </td>
                  </tr>
                )
              })}
            </tbody>
          </table>
        </div>
      </div>

      {activeDoc && (
        <Modal
          isOpen={!!activeDoc}
          onClose={closeUploadModal}
          title={t('subcontractors.uploadTitle', { label: activeDoc.document_label })}
          size="xl"
        >
          <form onSubmit={handleUpload} className="space-y-4">
            <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
              <div>
                <label className="label text-xs">{t('subcontractors.table.startDate')}</label>
                <DatePicker value={startDate} onChange={setStartDate} placeholder={t('datePicker.select')} />
              </div>
              <div>
                <label className="label text-xs">{t('subcontractors.table.expiryDate')}</label>
                <DatePicker value={expiryDate} onChange={setExpiryDate} placeholder={t('datePicker.select')} />
              </div>
            </div>

            <div>
              <label className="label text-xs">{t('subcontractors.pdfFile')}</label>
              <label className="flex items-center justify-between border-2 border-dashed border-gray-300 dark:border-gray-600 rounded-lg px-3 py-2 text-xs cursor-pointer hover:border-hse-primary hover:bg-hse-primary/5">
                <div className="flex items-center gap-2">
                  <FileText className="w-4 h-4 text-gray-500" />
                  <span className="text-gray-700 dark:text-gray-200">
                    {file ? file.name : t('subcontractors.choosePdf')}
                  </span>
                </div>
                <input
                  type="file"
                  accept="application/pdf"
                  onChange={handleFileChange}
                  className="hidden"
                />
              </label>
              <p className="text-[11px] text-gray-500 dark:text-gray-400 mt-2">
                {t('subcontractors.compressionHint')}
              </p>
            </div>

            <div className="flex justify-end gap-2 pt-2 border-t border-gray-100 dark:border-gray-700">
              <button type="button" className="btn-outline" onClick={closeUploadModal}>
                {t('common.cancel')}
              </button>
              <button
                type="submit"
                className="btn-primary flex items-center gap-2"
                disabled={saving || !file}
              >
                {saving && <Loader2 className="w-4 h-4 animate-spin" />}
                {t('subcontractors.send')}
              </button>
            </div>
          </form>
        </Modal>
      )}

      {activePreview && (
        <Modal
          isOpen={!!activePreview}
          onClose={closePreview}
          title={t('subcontractors.viewDocument')}
          size="xl"
        >
          <div className="space-y-4">
            <div className="h-[70vh]">
              {previewLoading ? (
                <div className="w-full h-full rounded-lg border border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-900 flex items-center justify-center">
                  <Loader2 className="w-6 h-6 animate-spin text-hse-primary" />
                </div>
              ) : previewUrl ? (
                <iframe
                  src={previewUrl}
                  title={t('subcontractors.viewDocument')}
                  className="w-full h-full rounded-lg border border-gray-200 dark:border-gray-700 bg-white"
                />
              ) : (
                <div className="w-full h-full rounded-lg border border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-900 flex items-center justify-center text-sm text-gray-500 dark:text-gray-400">
                  {t('errors.somethingWentWrong')}
                </div>
              )}
            </div>
            <div className="flex justify-end">
              <button
                type="button"
                onClick={() => handleDownload(activePreview)}
                className="btn-primary inline-flex items-center gap-2 text-sm"
              >
                <Download className="w-4 h-4" />
                {t('common.download')}
              </button>
            </div>
          </div>
        </Modal>
      )}
    </div>
  )
}
