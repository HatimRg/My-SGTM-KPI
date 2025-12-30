import { useCallback, useEffect, useMemo, useState } from 'react'
import toast from 'react-hot-toast'
import { heavyMachineryService } from '../../../services/api'
import { useLanguage } from '../../../i18n'
import Select from '../../../components/ui/Select'
import { AlertTriangle, CheckCircle, Loader2 } from 'lucide-react'

const STATUS_STYLES = {
  expiring: 'bg-amber-100 text-amber-700 dark:bg-amber-900/30 dark:text-amber-300',
  expired: 'bg-red-100 text-red-700 dark:bg-red-900/30 dark:text-red-300',
  unknown: 'bg-gray-100 text-gray-700 dark:bg-gray-800 dark:text-gray-300',
}

const normalizeStatus = (value) => {
  const s = String(value ?? '').toLowerCase()
  if (s === 'expired') return 'expired'
  if (s === 'expiring') return 'expiring'
  return 'unknown'
}

export default function ExpiredDocumentation() {
  const { t } = useLanguage()

  const [loading, setLoading] = useState(false)
  const [report, setReport] = useState(null)
  const [selectedProjectId, setSelectedProjectId] = useState('')
  const [selectedStatus, setSelectedStatus] = useState('')

  const fetchReport = useCallback(async () => {
    try {
      setLoading(true)
      const res = await heavyMachineryService.expiredDocumentation()
      setReport(res.data?.data ?? null)
    } catch (e) {
      toast.error(e.response?.data?.message ?? t('errors.somethingWentWrong'))
      setReport(null)
    } finally {
      setLoading(false)
    }
  }, [t])

  useEffect(() => {
    fetchReport()
  }, [fetchReport])

  const stats = report?.stats ?? { expiring_count: 0, expired_count: 0 }
  const projects = useMemo(() => {
    return Array.isArray(report?.projects) ? report.projects : []
  }, [report])

  const projectOptions = useMemo(() => {
    return projects
      .map((p) => p?.project)
      .filter(Boolean)
      .map((p) => ({ id: String(p.id), name: p.name }))
  }, [projects])

  const filteredProjects = useMemo(() => {
    const byProject = selectedProjectId
      ? projects.filter((p) => String(p?.project?.id ?? '') === String(selectedProjectId))
      : projects

    const wantStatus = selectedStatus ? String(selectedStatus) : ''
    if (!wantStatus) return byProject

    const keepIfAny = (items) => {
      return items.some((i) => normalizeStatus(i?.status) === wantStatus)
    }

    return byProject
      .map((p) => {
        const machines = Array.isArray(p?.machines) ? p.machines : []
        const operators = Array.isArray(p?.operators) ? p.operators : []
        const machinesOut = machines
          .map((m) => {
            const docs = Array.isArray(m?.documents) ? m.documents : []
            const docsOut = docs.filter((d) => normalizeStatus(d?.status) === wantStatus)
            return { ...m, documents: docsOut }
          })
          .filter((m) => (Array.isArray(m?.documents) ? m.documents.length > 0 : false))

        const operatorsOut = operators
          .map((o) => {
            const trainings = Array.isArray(o?.trainings) ? o.trainings : []
            const trainingsOut = trainings.filter((tr) => normalizeStatus(tr?.status) === wantStatus)
            return { ...o, trainings: trainingsOut }
          })
          .filter((o) => (Array.isArray(o?.trainings) ? o.trainings.length > 0 : false))

        return { ...p, machines: machinesOut, operators: operatorsOut }
      })
      .filter((p) => {
        const docs = Array.isArray(p?.machines) ? p.machines.flatMap((m) => m?.documents ?? []) : []
        const trainings = Array.isArray(p?.operators) ? p.operators.flatMap((o) => o?.trainings ?? []) : []
        return keepIfAny(docs) || keepIfAny(trainings)
      })
  }, [projects, selectedProjectId, selectedStatus])

  return (
    <div className="space-y-6 animate-fade-in">
      <div>
        <h1 className="text-2xl font-bold text-gray-900 dark:text-gray-100">{t('heavyMachinery.title')}</h1>
        <p className="text-gray-500 dark:text-gray-400 mt-1">{t('heavyMachinery.expiredDocumentation.title')}</p>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        <div className="card p-4 flex items-center justify-between">
          <div>
            <p className="text-xs text-gray-500 dark:text-gray-400">{t('heavyMachinery.expiredDocumentation.stats.expired')}</p>
            <p className="text-2xl font-bold text-gray-900 dark:text-gray-100 mt-1">{stats.expired_count ?? 0}</p>
          </div>
          <div className="w-10 h-10 rounded-xl bg-red-100 dark:bg-red-900/30 flex items-center justify-center">
            <AlertTriangle className="w-5 h-5 text-red-600 dark:text-red-300" />
          </div>
        </div>

        <div className="card p-4 flex items-center justify-between">
          <div>
            <p className="text-xs text-gray-500 dark:text-gray-400">{t('heavyMachinery.expiredDocumentation.stats.expiring')}</p>
            <p className="text-2xl font-bold text-gray-900 dark:text-gray-100 mt-1">{stats.expiring_count ?? 0}</p>
          </div>
          <div className="w-10 h-10 rounded-xl bg-amber-100 dark:bg-amber-900/30 flex items-center justify-center">
            <CheckCircle className="w-5 h-5 text-amber-700 dark:text-amber-300" />
          </div>
        </div>
      </div>

      <div className="card p-4 md:p-6 space-y-3">
        <div className="flex flex-col md:flex-row md:items-end gap-3">
          <div className="flex-1">
            <label className="label text-xs">{t('heavyMachinery.expiredDocumentation.filters.project')}</label>
            <Select value={selectedProjectId} onChange={(e) => setSelectedProjectId(e.target.value)}>
              <option value="">{t('common.allProjects')}</option>
              {projectOptions.map((p) => (
                <option key={p.id} value={p.id}>
                  {p.name}
                </option>
              ))}
            </Select>
          </div>
          <div className="md:w-64">
            <label className="label text-xs">{t('heavyMachinery.expiredDocumentation.filters.status')}</label>
            <Select value={selectedStatus} onChange={(e) => setSelectedStatus(e.target.value)}>
              <option value="">{t('heavyMachinery.expiredDocumentation.status.all')}</option>
              <option value="expired">{t('heavyMachinery.expiredDocumentation.status.expired')}</option>
              <option value="expiring">{t('heavyMachinery.expiredDocumentation.status.expiring')}</option>
            </Select>
          </div>
          <div className="flex gap-2">
            <button type="button" className="btn-outline" onClick={() => fetchReport()} disabled={loading}>
              {t('common.refresh')}
            </button>
            <button
              type="button"
              className="btn-outline"
              onClick={() => {
                setSelectedProjectId('')
                setSelectedStatus('')
              }}
              disabled={!selectedProjectId && !selectedStatus}
            >
              {t('common.reset')}
            </button>
          </div>
        </div>
        <p className="text-xs text-gray-500 dark:text-gray-400">{t('heavyMachinery.expiredDocumentation.help')}</p>
      </div>

      <div className="space-y-4">
        {loading ? (
          <div className="card p-10 flex items-center justify-center">
            <Loader2 className="w-6 h-6 animate-spin text-hse-primary" />
          </div>
        ) : filteredProjects.length === 0 ? (
          <div className="card p-8 text-center text-sm text-gray-600 dark:text-gray-300">{t('heavyMachinery.expiredDocumentation.empty')}</div>
        ) : (
          filteredProjects.map((p) => {
            const projectName = p?.project?.name ?? t('common.unknown')
            const machines = Array.isArray(p?.machines) ? p.machines : []
            const operators = Array.isArray(p?.operators) ? p.operators : []

            return (
              <div key={String(p?.project?.id ?? projectName)} className="card p-4 md:p-6 space-y-4">
                <div className="flex items-center justify-between gap-3">
                  <div className="min-w-0">
                    <h3 className="text-lg font-semibold text-gray-900 dark:text-gray-100 truncate">{projectName}</h3>
                    <p className="text-xs text-gray-500 dark:text-gray-400">{t('heavyMachinery.expiredDocumentation.projectSubtitle')}</p>
                  </div>
                </div>

                <div className="space-y-3">
                  <h4 className="text-sm font-semibold text-gray-900 dark:text-gray-100">{t('heavyMachinery.expiredDocumentation.sections.machines')}</h4>
                  {machines.length === 0 ? (
                    <div className="text-sm text-gray-500 dark:text-gray-400">{t('heavyMachinery.expiredDocumentation.sections.emptyMachines')}</div>
                  ) : (
                    <div className="overflow-x-auto">
                      <table className="min-w-full text-xs">
                        <thead>
                          <tr className="border-b border-gray-200 dark:border-gray-700 text-left">
                            <th className="py-2 pr-3 font-medium text-gray-500 dark:text-gray-400">{t('heavyMachinery.expiredDocumentation.columns.machine')}</th>
                            <th className="py-2 pr-3 font-medium text-gray-500 dark:text-gray-400">{t('heavyMachinery.expiredDocumentation.columns.document')}</th>
                            <th className="py-2 pr-3 font-medium text-gray-500 dark:text-gray-400">{t('heavyMachinery.expiredDocumentation.columns.expiryDate')}</th>
                            <th className="py-2 pr-3 font-medium text-gray-500 dark:text-gray-400">{t('heavyMachinery.expiredDocumentation.columns.status')}</th>
                          </tr>
                        </thead>
                        <tbody>
                          {machines.flatMap((m) => {
                            const machine = m?.machine
                            const docs = Array.isArray(m?.documents) ? m.documents : []
                            const machineLabel = machine
                              ? machine.internal_code
                                ? `${machine.internal_code} · ${machine.serial_number}`
                                : machine.serial_number
                              : '-'

                            return docs.map((d) => {
                              const st = normalizeStatus(d?.status)
                              return (
                                <tr key={`m-${machine?.id ?? 'x'}-d-${d.id}`} className="border-b border-gray-100 dark:border-gray-800">
                                  <td className="py-2 pr-3 text-gray-900 dark:text-gray-100 whitespace-nowrap">{machineLabel}</td>
                                  <td className="py-2 pr-3 text-gray-700 dark:text-gray-200">
                                    <div className="font-medium">{d.document_label}</div>
                                    <div className="text-[11px] text-gray-500 dark:text-gray-400">{d.document_key}</div>
                                  </td>
                                  <td className="py-2 pr-3 text-gray-700 dark:text-gray-200 whitespace-nowrap">{d.expiry_date ?? ''}</td>
                                  <td className="py-2 pr-3">
                                    <span className={`inline-flex items-center px-2 py-0.5 rounded-full text-[11px] ${STATUS_STYLES[st] ?? STATUS_STYLES.unknown}`}>
                                      {t(`heavyMachinery.expiredDocumentation.status.${st}`)}
                                    </span>
                                  </td>
                                </tr>
                              )
                            })
                          })}
                        </tbody>
                      </table>
                    </div>
                  )}
                </div>

                <div className="space-y-3 pt-2 border-t border-gray-100 dark:border-gray-800">
                  <h4 className="text-sm font-semibold text-gray-900 dark:text-gray-100">{t('heavyMachinery.expiredDocumentation.sections.operators')}</h4>
                  {operators.length === 0 ? (
                    <div className="text-sm text-gray-500 dark:text-gray-400">{t('heavyMachinery.expiredDocumentation.sections.emptyOperators')}</div>
                  ) : (
                    <div className="overflow-x-auto">
                      <table className="min-w-full text-xs">
                        <thead>
                          <tr className="border-b border-gray-200 dark:border-gray-700 text-left">
                            <th className="py-2 pr-3 font-medium text-gray-500 dark:text-gray-400">{t('heavyMachinery.expiredDocumentation.columns.worker')}</th>
                            <th className="py-2 pr-3 font-medium text-gray-500 dark:text-gray-400">{t('heavyMachinery.expiredDocumentation.columns.training')}</th>
                            <th className="py-2 pr-3 font-medium text-gray-500 dark:text-gray-400">{t('heavyMachinery.expiredDocumentation.columns.expiryDate')}</th>
                            <th className="py-2 pr-3 font-medium text-gray-500 dark:text-gray-400">{t('heavyMachinery.expiredDocumentation.columns.status')}</th>
                          </tr>
                        </thead>
                        <tbody>
                          {operators.flatMap((o) => {
                            const worker = o?.worker
                            const trainings = Array.isArray(o?.trainings) ? o.trainings : []
                            const workerLabel = worker
                              ? `${worker.full_name}${worker.cin ? ` (${worker.cin})` : ''}`
                              : '-'

                            return trainings.map((tr) => {
                              const st = normalizeStatus(tr?.status)
                              return (
                                <tr key={`w-${worker?.id ?? 'x'}-t-${tr.id}`} className="border-b border-gray-100 dark:border-gray-800">
                                  <td className="py-2 pr-3 text-gray-900 dark:text-gray-100 whitespace-nowrap">{workerLabel}</td>
                                  <td className="py-2 pr-3 text-gray-700 dark:text-gray-200">
                                    <div className="font-medium">{tr.training_label ?? tr.training_type}</div>
                                    <div className="text-[11px] text-gray-500 dark:text-gray-400">{tr.training_type}</div>
                                  </td>
                                  <td className="py-2 pr-3 text-gray-700 dark:text-gray-200 whitespace-nowrap">{tr.expiry_date ?? ''}</td>
                                  <td className="py-2 pr-3">
                                    <span className={`inline-flex items-center px-2 py-0.5 rounded-full text-[11px] ${STATUS_STYLES[st] ?? STATUS_STYLES.unknown}`}>
                                      {t(`heavyMachinery.expiredDocumentation.status.${st}`)}
                                    </span>
                                  </td>
                                </tr>
                              )
                            })
                          })}
                        </tbody>
                      </table>
                    </div>
                  )}
                </div>
              </div>
            )
          })
        )}
      </div>
    </div>
  )
}
