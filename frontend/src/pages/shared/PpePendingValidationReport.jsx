import { useEffect, useMemo, useState } from 'react'
import { useLocation } from 'react-router-dom'
import { Download, Loader2, Users } from 'lucide-react'
import toast from 'react-hot-toast'
import Modal from '../../components/ui/Modal'
import { useLanguage } from '../../i18n'
import { ppeService } from '../../services/api'

export default function PpePendingValidationReport() {
  const { t } = useLanguage()
  const location = useLocation()

  const query = useMemo(() => new URLSearchParams(location.search || ''), [location.search])
  const projectId = query.get('project_id') || ''
  const itemIdsRaw = query.get('item_ids') || ''

  const [loading, setLoading] = useState(true)
  const [downloading, setDownloading] = useState(false)
  const [report, setReport] = useState(null)

  const [detailsOpen, setDetailsOpen] = useState(false)
  const [detailsLoading, setDetailsLoading] = useState(false)
  const [detailsItem, setDetailsItem] = useState(null)
  const [detailsRows, setDetailsRows] = useState([])

  const loadReport = async () => {
    if (!projectId || !itemIdsRaw) {
      setReport(null)
      setLoading(false)
      return
    }

    try {
      setLoading(true)
      const res = await ppeService.getPendingValidationReport({ project_id: Number(projectId), item_ids: itemIdsRaw })
      setReport(res.data?.data ?? res.data)
    } catch (e) {
      setReport(null)
      toast.error(e.response?.data?.message ?? t('errors.failedToLoad'))
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    loadReport()
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [projectId, itemIdsRaw])

  const openDetails = async (row) => {
    if (!row?.item_id || !projectId) return

    try {
      setDetailsItem(row)
      setDetailsOpen(true)
      setDetailsLoading(true)
      const res = await ppeService.getPendingValidationDetails({ project_id: Number(projectId), item_id: Number(row.item_id) })
      const payload = res.data?.data ?? res.data
      setDetailsRows(Array.isArray(payload?.rows) ? payload.rows : [])
    } catch (e) {
      setDetailsRows([])
      toast.error(e.response?.data?.message ?? t('errors.failedToLoad'))
    } finally {
      setDetailsLoading(false)
    }
  }

  const downloadReport = async () => {
    if (!projectId || !itemIdsRaw) return

    try {
      setDownloading(true)
      const res = await ppeService.downloadPendingValidationReport({ project_id: Number(projectId), item_ids: itemIdsRaw })
      const blob = res.data
      const url = URL.createObjectURL(blob)
      const a = document.createElement('a')
      a.href = url
      a.download = `ppe_pending_validation_${projectId}.xlsx`
      document.body.appendChild(a)
      a.click()
      a.remove()
      setTimeout(() => URL.revokeObjectURL(url), 5000)
    } catch (e) {
      toast.error(e.response?.data?.message ?? t('errors.failedToExport'))
    } finally {
      setDownloading(false)
    }
  }

  if (loading) {
    return (
      <div className="card p-6 flex items-center justify-center">
        <Loader2 className="w-6 h-6 animate-spin text-hse-primary" />
      </div>
    )
  }

  if (!report) {
    return (
      <div className="card p-6 text-sm text-gray-600 dark:text-gray-300">
        {t('ppe.pendingValidation.missingParams')}
      </div>
    )
  }

  const project = report?.project ?? {}
  const rows = Array.isArray(report?.rows) ? report.rows : []

  return (
    <div className="space-y-4">
      <div className="card p-4">
        <div className="flex flex-col md:flex-row md:items-start md:justify-between gap-3">
          <div className="space-y-1">
            <div className="text-lg font-semibold text-gray-900 dark:text-gray-100">{t('ppe.pendingValidation.reportTitle')}</div>
            <div className="text-sm text-gray-700 dark:text-gray-200">
              <div><span className="font-medium">{t('ppe.pendingValidation.projectName')}:</span> {project.name ?? ''}</div>
              <div><span className="font-medium">{t('ppe.pendingValidation.projectPole')}:</span> {project.pole ?? ''}</div>
              <div><span className="font-medium">{t('ppe.pendingValidation.hseManagerName')}:</span> {project.hse_manager_name ?? '-'}</div>
              <div><span className="font-medium">{t('ppe.pendingValidation.hseManagerEmail')}:</span> {project.hse_manager_email ?? '-'}</div>
              <div className="inline-flex items-center gap-2 mt-1">
                <Users className="w-4 h-4 text-gray-500" />
                <span className="text-sm"><span className="font-medium">{t('ppe.pendingValidation.currentWorkers')}:</span> {project.current_total_workers ?? 0}</span>
              </div>
            </div>
          </div>

          <div className="flex justify-end">
            <button type="button" className="btn-outline btn-sm flex items-center gap-2" onClick={downloadReport} disabled={downloading}>
              {downloading ? <Loader2 className="w-4 h-4 animate-spin" /> : <Download className="w-4 h-4" />}
              {t('ppe.pendingValidation.downloadReport')}
            </button>
          </div>
        </div>
      </div>

      <div className="card overflow-hidden">
        <div className="overflow-x-auto">
          <table className="min-w-full text-sm">
            <thead>
              <tr className="border-b border-gray-200 dark:border-gray-700 text-left">
                <th className="py-3 px-4 font-medium text-gray-500 dark:text-gray-400">{t('ppe.pendingValidation.table.article')}</th>
                <th className="py-3 px-4 font-medium text-gray-500 dark:text-gray-400">{t('ppe.pendingValidation.table.currentStock')}</th>
                <th className="py-3 px-4 font-medium text-gray-500 dark:text-gray-400">{t('ppe.pendingValidation.table.week')}</th>
                <th className="py-3 px-4 font-medium text-gray-500 dark:text-gray-400">{t('ppe.pendingValidation.table.month')}</th>
                <th className="py-3 px-4 font-medium text-gray-500 dark:text-gray-400">{t('ppe.pendingValidation.table.names')}</th>
              </tr>
            </thead>
            <tbody>
              {rows.map((r) => (
                <tr key={String(r.item_id)} className="border-b border-gray-100 dark:border-gray-800">
                  <td className="py-3 px-4 text-gray-900 dark:text-gray-100">{r.article ?? r.item_name ?? ''}</td>
                  <td className="py-3 px-4 font-mono text-gray-700 dark:text-gray-200">{r.current_stock ?? 0}</td>
                  <td className="py-3 px-4 font-mono text-gray-700 dark:text-gray-200">{r.distributed_last_week ?? 0}</td>
                  <td className="py-3 px-4 font-mono text-gray-700 dark:text-gray-200">{r.distributed_last_month ?? 0}</td>
                  <td className="py-3 px-4">
                    <button type="button" className="btn-outline btn-sm" onClick={() => openDetails(r)}>
                      {t('ppe.pendingValidation.viewNames')}
                    </button>
                  </td>
                </tr>
              ))}
              {rows.length === 0 && (
                <tr>
                  <td colSpan={5} className="py-6 px-4 text-sm text-gray-600 dark:text-gray-300">
                    {t('common.noData')}
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </div>

      {detailsOpen && (
        <Modal
          isOpen={detailsOpen}
          onClose={() => {
            setDetailsOpen(false)
            setDetailsItem(null)
            setDetailsRows([])
          }}
          title={t('ppe.pendingValidation.detailsTitle', { article: detailsItem?.article ?? detailsItem?.item_name ?? '' })}
          size="xl"
        >
          {detailsLoading ? (
            <div className="flex items-center justify-center p-6">
              <Loader2 className="w-6 h-6 animate-spin text-hse-primary" />
            </div>
          ) : (
            <div className="overflow-x-auto">
              <table className="min-w-full text-sm">
                <thead>
                  <tr className="border-b border-gray-200 dark:border-gray-700 text-left">
                    <th className="py-3 px-4 font-medium text-gray-500 dark:text-gray-400">{t('ppe.pendingValidation.details.cin')}</th>
                    <th className="py-3 px-4 font-medium text-gray-500 dark:text-gray-400">{t('ppe.pendingValidation.details.name')}</th>
                    <th className="py-3 px-4 font-medium text-gray-500 dark:text-gray-400">{t('ppe.pendingValidation.details.quantity')}</th>
                    <th className="py-3 px-4 font-medium text-gray-500 dark:text-gray-400">{t('ppe.pendingValidation.details.date')}</th>
                  </tr>
                </thead>
                <tbody>
                  {detailsRows.map((d, idx) => (
                    <tr key={`${String(d.cin ?? '')}-${String(d.date ?? '')}-${idx}`} className="border-b border-gray-100 dark:border-gray-800">
                      <td className="py-3 px-4 font-mono text-gray-700 dark:text-gray-200">{d.cin ?? ''}</td>
                      <td className="py-3 px-4 text-gray-900 dark:text-gray-100">{d.name ?? ''}</td>
                      <td className="py-3 px-4 font-mono text-gray-700 dark:text-gray-200">{d.quantity ?? 0}</td>
                      <td className="py-3 px-4 font-mono text-gray-700 dark:text-gray-200">{d.date ?? ''}</td>
                    </tr>
                  ))}
                  {detailsRows.length === 0 && (
                    <tr>
                      <td colSpan={4} className="py-6 px-4 text-sm text-gray-600 dark:text-gray-300">
                        {t('common.noData')}
                      </td>
                    </tr>
                  )}
                </tbody>
              </table>
            </div>
          )}
        </Modal>
      )}
    </div>
  )
}
