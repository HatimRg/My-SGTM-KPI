import { useEffect, useMemo, useState } from 'react'
import { useNavigate, useLocation, useParams } from 'react-router-dom'
import { regulatoryWatchService } from '../../services/api'
import { useLanguage } from '../../i18n'
import ConfirmDialog from '../../components/ui/ConfirmDialog'
import { ArrowLeft, CheckCircle2, FileText, Loader2, MinusCircle, RotateCcw, Trash2, XCircle } from 'lucide-react'
import toast from 'react-hot-toast'
import { formatBulletText, getArticleSchemaById, getLocalized, getSectionSchemaById } from './veilleReglementaireSchema'

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

const Badge = ({ tone = 'gray', icon: Icon, children }) => {
  const tones = {
    green: 'bg-emerald-100 text-emerald-800 dark:bg-emerald-900/30 dark:text-emerald-200',
    red: 'bg-red-100 text-red-800 dark:bg-red-900/30 dark:text-red-200',
    gray: 'bg-gray-100 text-gray-800 dark:bg-gray-700/40 dark:text-gray-200',
    blue: 'bg-blue-100 text-blue-800 dark:bg-blue-900/30 dark:text-blue-200',
    amber: 'bg-amber-100 text-amber-800 dark:bg-amber-900/30 dark:text-amber-200',
  }

  return (
    <span className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs font-semibold ${tones[tone] ?? tones.gray}`}>
      {Icon ? <Icon className="w-3.5 h-3.5" /> : null}
      <span>{children}</span>
    </span>
  )
}

const getApplicabilityBadge = (t, applicable) => {
  if (applicable === true) {
    return { tone: 'blue', icon: CheckCircle2, label: t('regulatoryWatch.applicable') }
  }

  if (applicable === false) {
    return { tone: 'gray', icon: MinusCircle, label: t('regulatoryWatch.notApplicable') }
  }

  return { tone: 'amber', icon: MinusCircle, label: t('common.unknown') }
}

const getComplianceBadge = (t, applicable, compliant) => {
  if (applicable === false) {
    return { tone: 'gray', icon: MinusCircle, label: 'N/A' }
  }

  if (compliant === true) {
    return { tone: 'green', icon: CheckCircle2, label: t('regulatoryWatch.conforme') }
  }

  if (compliant === false) {
    return { tone: 'red', icon: XCircle, label: t('regulatoryWatch.nonConforme') }
  }

  return { tone: 'amber', icon: MinusCircle, label: t('common.unknown') }
}

export default function VeilleReglementaireDetails() {
  const { t, language } = useLanguage()
  const navigate = useNavigate()
  const location = useLocation()
  const params = useParams()

  const basePath = useMemo(() => getBasePath(location.pathname), [location.pathname])
  const submissionId = params?.id

  const [loading, setLoading] = useState(true)
  const [submission, setSubmission] = useState(null)

  const [confirmDelete, setConfirmDelete] = useState(false)

  useEffect(() => {
    const load = async () => {
      if (!submissionId) return
      try {
        setLoading(true)
        const res = await regulatoryWatchService.getById(submissionId)
        setSubmission(res.data?.data ?? null)
      } catch (e) {
        setSubmission(null)
        toast.error(e.response?.data?.message ?? t('errors.somethingWentWrong'))
      } finally {
        setLoading(false)
      }
    }

    load()
  }, [submissionId])

  const doDelete = async () => {
    if (!submissionId) return
    try {
      await regulatoryWatchService.delete(submissionId)
      toast.success(t('common.deleted') ?? 'Deleted')
      navigate(basePath)
    } catch (e) {
      toast.error(e.response?.data?.message ?? t('errors.somethingWentWrong'))
    } finally {
      setConfirmDelete(false)
    }
  }

  const overallLabel = submission?.overall_score === null || submission?.overall_score === undefined
    ? '-'
    : `${Number(submission.overall_score).toFixed(2)}%`

  const sections = submission?.answers?.sections ?? []
  const sectionScores = submission?.section_scores ?? []

  return (
    <div className="space-y-6">
      <div className="flex items-start justify-between gap-4 flex-col sm:flex-row">
        <div className="flex items-start gap-3">
          <div className="p-2 bg-hse-primary/10 rounded-lg">
            <FileText className="w-5 h-5 text-hse-primary" />
          </div>
          <div>
            <h1 className="text-xl font-bold text-gray-900 dark:text-gray-100">{t('regulatoryWatch.detailsTitle')}</h1>
            <p className="text-sm text-gray-600 dark:text-gray-400">
              {submission?.project?.name ?? t('common.unknown')} · {t('regulatoryWatch.submittedAt')}: {formatDateTime(submission?.submitted_at)}
            </p>
            {submission?.week_year && submission?.week_number && (
              <p className="text-sm text-gray-600 dark:text-gray-400">
                {t('regulatoryWatch.week')}: {submission.week_number} · {t('regulatoryWatch.year')}: {submission.week_year}
              </p>
            )}
          </div>
        </div>

        <div className="flex items-center gap-2 w-full sm:w-auto">
          <button type="button" className="btn-secondary flex items-center gap-2 w-full sm:w-auto" onClick={() => navigate(basePath)}>
            <ArrowLeft className="w-4 h-4" />
            {t('common.back')}
          </button>
          <button
            type="button"
            className="btn-primary flex items-center gap-2 w-full sm:w-auto"
            onClick={() => navigate(`${basePath}/${submissionId}/resubmit`)}
            disabled={!submissionId}
          >
            <RotateCcw className="w-4 h-4" />
            {t('regulatoryWatch.resubmit')}
          </button>
          <button
            type="button"
            className="btn-danger flex items-center gap-2 w-full sm:w-auto"
            onClick={() => setConfirmDelete(true)}
            disabled={!submissionId}
          >
            <Trash2 className="w-4 h-4" />
            {t('common.delete') ?? 'Delete'}
          </button>
        </div>
      </div>

      {loading ? (
        <div className="bg-white dark:bg-gray-800 rounded-xl shadow-sm border border-gray-200 dark:border-gray-700 p-6 flex items-center gap-2 text-sm text-gray-500 dark:text-gray-400">
          <Loader2 className="w-4 h-4 animate-spin" />
          {t('common.loading')}
        </div>
      ) : !submission ? (
        <div className="bg-white dark:bg-gray-800 rounded-xl shadow-sm border border-gray-200 dark:border-gray-700 p-6 text-sm text-gray-500 dark:text-gray-400">
          {t('common.noData')}
        </div>
      ) : (
        <>
          <div className="bg-white dark:bg-gray-800 rounded-xl shadow-sm border border-gray-200 dark:border-gray-700 p-4">
            <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
              <div className="p-3 rounded-lg border border-gray-200 dark:border-gray-700 bg-gray-50 dark:bg-gray-900">
                <div className="text-xs text-gray-500 dark:text-gray-400">{t('regulatoryWatch.overallScore')}</div>
                <div className="text-lg font-bold text-gray-900 dark:text-gray-100">{overallLabel}</div>
              </div>

              <div className="md:col-span-2 p-3 rounded-lg border border-gray-200 dark:border-gray-700 bg-gray-50 dark:bg-gray-900">
                <div className="text-xs text-gray-500 dark:text-gray-400">{t('regulatoryWatch.sectionScores')}</div>
                <div className="mt-2 grid grid-cols-1 sm:grid-cols-2 gap-2">
                  {(Array.isArray(sectionScores) ? sectionScores : []).map((s) => {
                    const label = s?.score === null || s?.score === undefined ? '-' : `${Number(s.score).toFixed(2)}%`
                    const ratio = `${s?.total_conforme ?? 0} / ${s?.total_applicable ?? 0}`

                    const sectionSchema = getSectionSchemaById(s.section_id)
                    const sectionTitle = sectionSchema ? getLocalized(sectionSchema.title, language) : s.section_id
                    return (
                      <div key={s.section_id} className="text-sm text-gray-900 dark:text-gray-100 flex items-center justify-between gap-3">
                        <span className="text-gray-600 dark:text-gray-300">{sectionTitle}</span>
                        <span className="font-semibold">{ratio} ({label})</span>
                      </div>
                    )
                  })}
                </div>
              </div>
            </div>
          </div>

          {(Array.isArray(sections) ? sections : []).map((section) => {
            const articles = section?.articles ?? []
            const sectionSchema = getSectionSchemaById(section.section_id)
            const sectionTitle = sectionSchema ? getLocalized(sectionSchema.title, language) : section.section_id
            return (
              <div key={section.section_id} className="bg-white dark:bg-gray-800 rounded-xl shadow-sm border border-gray-200 dark:border-gray-700 overflow-hidden">
                <div className="p-4 border-b border-gray-200 dark:border-gray-700">
                  <div className="text-sm font-semibold text-gray-900 dark:text-gray-100">{sectionTitle}</div>
                </div>

                <div className="p-4 space-y-3">
                  {(Array.isArray(articles) ? articles : []).map((a) => {
                    const schema = getArticleSchemaById(a.article_id)
                    const code = schema ? getLocalized(schema.code, language) : (a.code ?? a.article_id)
                    const rawText = schema ? getLocalized(schema.text, language) : (typeof a.text === 'string' ? a.text : '')
                    const text = formatBulletText(rawText)

                    const applicabilityBadge = getApplicabilityBadge(t, a.applicable)
                    const complianceBadge = getComplianceBadge(t, a.applicable, a.compliant)

                    const cardTone = a.applicable === false
                      ? 'border-gray-200 dark:border-gray-700 bg-gray-50/70 dark:bg-gray-900/40'
                      : a.compliant === false
                        ? 'border-red-200 dark:border-red-900/40 bg-red-50/40 dark:bg-red-900/10'
                        : a.compliant === true
                          ? 'border-emerald-200 dark:border-emerald-900/40 bg-emerald-50/40 dark:bg-emerald-900/10'
                          : 'border-amber-200 dark:border-amber-900/40 bg-amber-50/40 dark:bg-amber-900/10'

                    return (
                      <div
                        key={`${section.section_id}:${a.article_id}`}
                        className={`rounded-xl border p-3 ${cardTone} ${a.applicable === false ? 'opacity-80' : ''}`}
                      >
                        <div className="flex items-start justify-between gap-3">
                          <div className="font-medium text-gray-900 dark:text-gray-100">{code}</div>
                          <div className="flex items-center gap-2 flex-wrap justify-end">
                            <Badge tone={applicabilityBadge.tone} icon={applicabilityBadge.icon}>{applicabilityBadge.label}</Badge>
                            <Badge tone={complianceBadge.tone} icon={complianceBadge.icon}>{complianceBadge.label}</Badge>
                          </div>
                        </div>
                        <div className="text-sm text-gray-600 dark:text-gray-300 mt-1 whitespace-pre-line">{text}</div>

                        {a.applicable && a.compliant === false && a.corrective_action && (
                          <div className="mt-2 text-sm text-gray-900 dark:text-gray-100">
                            <div className="text-xs text-gray-500 dark:text-gray-400">{t('regulatoryWatch.correctiveAction')}</div>
                            <div>{a.corrective_action}</div>
                          </div>
                        )}

                        {a.comment && (
                          <div className="mt-2 text-sm text-gray-900 dark:text-gray-100">
                            <div className="text-xs text-gray-500 dark:text-gray-400">{t('regulatoryWatch.comment')}</div>
                            <div>{a.comment}</div>
                          </div>
                        )}
                      </div>
                    )
                  })}
                </div>
              </div>
            )
          })}
        </>
      )}

      <ConfirmDialog
        isOpen={confirmDelete}
        title={t('common.confirm') ?? 'Confirm'}
        message={t('common.confirmDelete') ?? 'Are you sure you want to delete this record?'}
        confirmLabel={t('common.delete') ?? 'Delete'}
        cancelLabel={t('common.cancel') ?? 'Cancel'}
        variant="danger"
        onConfirm={doDelete}
        onCancel={() => setConfirmDelete(false)}
      />
    </div>
  )
}
