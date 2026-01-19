import { useEffect, useMemo, useState } from 'react'
import { useNavigate, useLocation } from 'react-router-dom'
import { projectService, regulatoryWatchService } from '../../services/api'
import { useLanguage } from '../../i18n'
import { useAuthStore } from '../../store/authStore'
import Select from '../../components/ui/Select'
import ConfirmDialog from '../../components/ui/ConfirmDialog'
import { FileText, Loader2, PlusCircle, Eye, RotateCcw, Trash2 } from 'lucide-react'
import toast from 'react-hot-toast'
import { getProjectLabel, sortProjects } from '../../utils/projectList'

const safeParseJson = (value) => {
  try {
    return JSON.parse(value)
  } catch {
    return null
  }
}

const formatDateTime = (value) => {
  if (!value) return '-'
  const d = new Date(value)
  if (Number.isNaN(d.getTime())) return String(value)
  return d.toLocaleString()
}

const getBasePath = (pathname) => {
  if (pathname.startsWith('/admin/regulatory-watch')) return '/admin/regulatory-watch'
  if (pathname.startsWith('/supervisor/regulatory-watch')) return '/supervisor/regulatory-watch'
  return '/regulatory-watch'
}

export default function VeilleReglementaireHistory() {
  const { t } = useLanguage()
  const { user } = useAuthStore()
  const navigate = useNavigate()
  const location = useLocation()

  const basePath = useMemo(() => getBasePath(location.pathname), [location.pathname])

  const [projects, setProjects] = useState([])
  const [loadingProjects, setLoadingProjects] = useState(true)
  const [selectedProjectId, setSelectedProjectId] = useState('')

  const projectListPreference = user?.project_list_preference ?? 'code'
  const sortedProjects = useMemo(() => {
    return sortProjects(projects, projectListPreference)
  }, [projects, projectListPreference])

  const [loading, setLoading] = useState(true)
  const [avgOverall, setAvgOverall] = useState(null)
  const [submissions, setSubmissions] = useState([])

  const [confirmDelete, setConfirmDelete] = useState(null)

  const draftStorageKey = useMemo(() => {
    const userId = user?.id ? String(user.id) : 'anonymous'
    return `regulatory_watch_draft:new:${userId}:new`
  }, [user?.id])

  const [draft, setDraft] = useState(null)

  useEffect(() => {
    if (typeof window === 'undefined') return
    try {
      const raw = window.localStorage.getItem(draftStorageKey)
      if (!raw) {
        setDraft(null)
        return
      }
      const parsed = safeParseJson(raw)
      setDraft(parsed && typeof parsed === 'object' ? parsed : null)
    } catch {
      setDraft(null)
    }
  }, [draftStorageKey])

  const handleContinueDraft = () => {
    const page = Number.parseInt(String(draft?.page ?? '1'), 10)
    const clamped = Number.isFinite(page) && page >= 1 ? page : 1
    navigate(`${basePath}/new/${clamped}`)
  }

  const handleDiscardDraft = () => {
    try {
      window.localStorage.removeItem(draftStorageKey)
    } catch {
      // ignore
    }
    setDraft(null)
  }

  useEffect(() => {
    const loadProjects = async () => {
      try {
        setLoadingProjects(true)
        const list = await projectService.getAllList({ status: 'active' })
        setProjects(Array.isArray(list) ? list : [])
      } catch (e) {
        setProjects([])
        toast.error(e.response?.data?.message ?? t('errors.somethingWentWrong'))
      } finally {
        setLoadingProjects(false)
      }
    }

    loadProjects()
  }, [])

  useEffect(() => {
    const loadHistory = async () => {
      try {
        setLoading(true)
        const params = {
          per_page: 50,
        }
        if (selectedProjectId) params.project_id = Number(selectedProjectId)

        const res = await regulatoryWatchService.getAll(params)
        const data = res.data?.data ?? null

        setAvgOverall(data?.avg_overall_score ?? null)
        const paginator = data?.submissions
        const rows = paginator?.data ?? []
        setSubmissions(Array.isArray(rows) ? rows : [])
      } catch (e) {
        setAvgOverall(null)
        setSubmissions([])
        toast.error(e.response?.data?.message ?? t('errors.somethingWentWrong'))
      } finally {
        setLoading(false)
      }
    }

    loadHistory()
  }, [selectedProjectId])

  const handleDelete = (submission) => {
    setConfirmDelete(submission)
  }

  const confirmDeleteSubmission = async () => {
    if (!confirmDelete?.id) return

    try {
      await regulatoryWatchService.delete(confirmDelete.id)
      toast.success(t('common.deleted') ?? 'Deleted')

      const params = {
        per_page: 50,
      }
      if (selectedProjectId) params.project_id = Number(selectedProjectId)

      const res = await regulatoryWatchService.getAll(params)
      const data = res.data?.data ?? null
      setAvgOverall(data?.avg_overall_score ?? null)
      const paginator = data?.submissions
      const rows = paginator?.data ?? []
      setSubmissions(Array.isArray(rows) ? rows : [])
    } catch (e) {
      toast.error(e.response?.data?.message ?? t('errors.somethingWentWrong'))
    } finally {
      setConfirmDelete(null)
    }
  }

  const avgLabel = avgOverall === null ? '-' : `${avgOverall}%`

  return (
    <div className="space-y-6">
      {draft?.answers ? (
        <div className="bg-amber-50 dark:bg-amber-900/10 rounded-xl border border-amber-200 dark:border-amber-900/30 p-4">
          <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
            <div>
              <div className="text-sm font-semibold text-gray-900 dark:text-gray-100">{t('regulatoryWatch.draftSaved')}</div>
              <div className="text-xs text-gray-600 dark:text-gray-300 mt-1">
                {t('common.page')} {draft?.page ?? 1}
              </div>
            </div>

            <div className="flex items-center gap-2">
              <button type="button" className="btn-secondary" onClick={handleDiscardDraft}>
                {t('common.delete')}
              </button>
              <button type="button" className="btn-primary" onClick={handleContinueDraft}>
                {t('common.continue')}
              </button>
            </div>
          </div>
        </div>
      ) : null}

      <div className="flex items-start justify-between gap-4 flex-col sm:flex-row">
        <div className="flex items-start gap-3">
          <div className="p-2 bg-hse-primary/10 rounded-lg">
            <FileText className="w-5 h-5 text-hse-primary" />
          </div>
          <div>
            <h1 className="text-xl font-bold text-gray-900 dark:text-gray-100">{t('regulatoryWatch.title')}</h1>
            <p className="text-sm text-gray-600 dark:text-gray-400">{t('regulatoryWatch.historySubtitle')}</p>
          </div>
        </div>

        <button
          type="button"
          onClick={() => navigate(`${basePath}/new/1`)}
          className="btn-primary flex items-center justify-center gap-2 w-full sm:w-auto"
        >
          <PlusCircle className="w-4 h-4" />
          {t('regulatoryWatch.newSubmission')}
        </button>
      </div>

      <div className="bg-white dark:bg-gray-800 rounded-xl shadow-sm border border-gray-200 dark:border-gray-700 p-4">
        <div className="grid grid-cols-1 md:grid-cols-3 gap-3 items-end">
          <div className="md:col-span-2">
            <label className="label">{t('regulatoryWatch.selectProject')}</label>
            <Select
              value={selectedProjectId}
              onChange={(e) => setSelectedProjectId(e.target.value)}
              disabled={loadingProjects}
            >
              <option value="">{loadingProjects ? t('common.loading') : t('common.allProjects')}</option>
              {sortedProjects.map((p) => (
                <option key={p.id} value={String(p.id)}>
                  {getProjectLabel(p)}
                </option>
              ))}
            </Select>
          </div>

          <div className="md:col-span-1">
            <div className="p-3 rounded-lg border border-gray-200 dark:border-gray-700 bg-gray-50 dark:bg-gray-900">
              <div className="text-xs text-gray-500 dark:text-gray-400">{t('regulatoryWatch.avgScore')}</div>
              <div className="text-lg font-bold text-gray-900 dark:text-gray-100">{avgLabel}</div>
            </div>
          </div>
        </div>
      </div>

      <div className="bg-white dark:bg-gray-800 rounded-xl shadow-sm border border-gray-200 dark:border-gray-700 overflow-hidden">
        <div className="p-4 border-b border-gray-200 dark:border-gray-700">
          <div className="text-sm font-semibold text-gray-900 dark:text-gray-100">{t('regulatoryWatch.historyTitle')}</div>
        </div>

        {loading ? (
          <div className="p-6 flex items-center gap-2 text-sm text-gray-500 dark:text-gray-400">
            <Loader2 className="w-4 h-4 animate-spin" />
            {t('common.loading')}
          </div>
        ) : submissions.length === 0 ? (
          <div className="p-6 text-sm text-gray-500 dark:text-gray-400">{t('regulatoryWatch.noSubmissions')}</div>
        ) : (
          <div className="divide-y divide-gray-200 dark:divide-gray-700">
            {submissions.map((s) => {
              const overall = s?.overall_score
              const overallLabel = overall === null || overall === undefined ? '-' : `${Number(overall).toFixed(2)}%`

              const weekLabel = s?.week_year && s?.week_number ? `${t('dashboard.weekPrefix')} ${s.week_number} - ${s.week_year}` : null

              return (
                <div
                  key={s.id}
                  className="p-4 flex flex-col md:flex-row md:items-center md:justify-between gap-3 hover:bg-gray-50 dark:hover:bg-gray-900/40"
                >
                  <button
                    type="button"
                    className="text-left flex-1"
                    onClick={() => navigate(`${basePath}/${s.id}`)}
                  >
                    <div className="text-sm font-semibold text-gray-900 dark:text-gray-100">
                      {getProjectLabel(s.project) || s.project?.name || s.project?.code || t('common.unknown')}
                    </div>
                    <div className="text-xs text-gray-500 dark:text-gray-400 mt-1">
                      {t('regulatoryWatch.submittedAt')}: {formatDateTime(s.submitted_at)}
                    </div>
                    {weekLabel && (
                      <div className="text-xs text-gray-500 dark:text-gray-400 mt-1">
                        {weekLabel}
                      </div>
                    )}
                  </button>

                  <div className="flex items-center justify-between md:justify-end gap-3">
                    <div className="text-sm font-semibold text-gray-900 dark:text-gray-100">{overallLabel}</div>

                    <div className="flex items-center gap-2">
                      <button
                        type="button"
                        className="btn-secondary flex items-center gap-2"
                        onClick={() => navigate(`${basePath}/${s.id}`)}
                      >
                        <Eye className="w-4 h-4" />
                        {t('regulatoryWatch.viewDetails')}
                      </button>
                      <button
                        type="button"
                        className="btn-secondary flex items-center gap-2"
                        onClick={() => navigate(`${basePath}/${s.id}/resubmit`)}
                      >
                        <RotateCcw className="w-4 h-4" />
                        {t('regulatoryWatch.resubmit')}
                      </button>
                      <button
                        type="button"
                        className="btn-danger flex items-center gap-2"
                        onClick={() => handleDelete(s)}
                      >
                        <Trash2 className="w-4 h-4" />
                        {t('common.delete') ?? 'Delete'}
                      </button>
                    </div>
                  </div>
                </div>
              )
            })}
          </div>
        )}
      </div>

      <ConfirmDialog
        isOpen={!!confirmDelete}
        title={t('common.confirm') ?? 'Confirm'}
        message={t('common.confirmDelete') ?? 'Are you sure you want to delete this record?'}
        confirmLabel={t('common.delete') ?? 'Delete'}
        cancelLabel={t('common.cancel') ?? 'Cancel'}
        variant="danger"
        onConfirm={confirmDeleteSubmission}
        onCancel={() => setConfirmDelete(null)}
      />
    </div>
  )
}
