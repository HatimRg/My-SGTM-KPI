import { useEffect, useMemo, useRef, useState } from 'react'
import { useLocation, useNavigate, useParams } from 'react-router-dom'
import { projectService, regulatoryWatchService } from '../../services/api'
import { useLanguage } from '../../i18n'
import { useAuthStore } from '../../store/authStore'
import Select from '../../components/ui/Select'
import { ArrowLeft, CheckCircle, FileText, Loader2, Send, XCircle } from 'lucide-react'
import toast from 'react-hot-toast'
import { SECTIONS, SCHEMA_VERSION, makeInitialAnswers, getLocalized, formatBulletText } from './veilleReglementaireSchema'
import { getProjectLabel, sortProjects } from '../../utils/projectList'

const safeParseJson = (value) => {
  try {
    return JSON.parse(value)
  } catch {
    return null
  }
}

const getIsoWeek = (date) => {
  const d = new Date(Date.UTC(date.getFullYear(), date.getMonth(), date.getDate()))
  const dayNum = d.getUTCDay() || 7
  d.setUTCDate(d.getUTCDate() + 4 - dayNum)
  const yearStart = new Date(Date.UTC(d.getUTCFullYear(), 0, 1))
  return Math.ceil((((d - yearStart) / 86400000) + 1) / 7)
}

const getBasePath = (pathname) => {
  if (pathname.startsWith('/admin/regulatory-watch')) return '/admin/regulatory-watch'
  if (pathname.startsWith('/supervisor/regulatory-watch')) return '/supervisor/regulatory-watch'
  return '/regulatory-watch'
}

const computeSectionScore = (section) => {
  const articles = Array.isArray(section?.articles) ? section.articles : []
  let totalApplicable = 0
  let totalConforme = 0

  for (const a of articles) {
    if (!a?.applicable) continue
    totalApplicable += 1
    if (a?.compliant) totalConforme += 1
  }

  const score = totalApplicable > 0 ? Math.round((totalConforme / totalApplicable) * 10000) / 100 : null
  return { totalApplicable, totalConforme, score }
}

export default function VeilleReglementaireForm({ mode }) {
  const { t, language } = useLanguage()
  const { user } = useAuthStore()
  const navigate = useNavigate()
  const location = useLocation()
  const params = useParams()

  const basePath = useMemo(() => getBasePath(location.pathname), [location.pathname])

  const [projects, setProjects] = useState([])
  const [loadingProjects, setLoadingProjects] = useState(true)
  const [selectedProjectId, setSelectedProjectId] = useState('')

  const persistedQuery = useMemo(() => new URLSearchParams(location.search), [location.search])

  const projectListPreference = user?.project_list_preference ?? 'code'
  const sortedProjects = useMemo(() => {
    return sortProjects(projects, projectListPreference)
  }, [projects, projectListPreference])

  const [loadingSeed, setLoadingSeed] = useState(false)
  const [submitting, setSubmitting] = useState(false)

  const [answers, setAnswers] = useState(() => makeInitialAnswers())

  const draftHydratedRef = useRef({ done: false, key: '' })
  const skipSeedRef = useRef(false)

  const [currentSectionIndex, setCurrentSectionIndex] = useState(0)

  const currentPageNumber = useMemo(() => {
    const raw = params?.page
    const parsed = Number.parseInt(String(raw ?? '1'), 10)
    if (!Number.isFinite(parsed) || parsed < 1) return 1
    return parsed
  }, [params?.page])

  const wizardBasePath = useMemo(() => {
    if (mode === 'resubmit') {
      return params?.id ? `${basePath}/${params.id}/resubmit` : `${basePath}/resubmit`
    }
    return `${basePath}/new`
  }, [basePath, mode, params?.id])

  const [weekYear, setWeekYear] = useState(() => new Date().getFullYear())
  const [weekNumber, setWeekNumber] = useState(() => getIsoWeek(new Date()))

  const draftStorageKey = useMemo(() => {
    const userId = user?.id ? String(user.id) : 'anonymous'
    const submissionId = params?.id ? String(params.id) : ''
    return `regulatory_watch_draft:${mode}:${userId}:${submissionId || 'new'}`
  }, [mode, params?.id, user?.id])

  useEffect(() => {
    if (typeof window === 'undefined') return

    if (draftHydratedRef.current.done && draftHydratedRef.current.key === draftStorageKey) return
    draftHydratedRef.current.done = true
    draftHydratedRef.current.key = draftStorageKey

    try {
      const raw = window.sessionStorage.getItem(draftStorageKey)
      if (!raw) return
      const parsed = safeParseJson(raw)
      if (!parsed || typeof parsed !== 'object') return

      if (parsed.schema_version !== SCHEMA_VERSION) return
      if (mode === 'resubmit' && String(parsed.submission_id || '') !== String(params?.id || '')) return

      if (parsed.selectedProjectId) setSelectedProjectId(String(parsed.selectedProjectId))
      if (parsed.weekYear && Number.isFinite(Number(parsed.weekYear))) setWeekYear(Number(parsed.weekYear))
      if (parsed.weekNumber && Number.isFinite(Number(parsed.weekNumber))) setWeekNumber(Number(parsed.weekNumber))

      if (parsed.answers && typeof parsed.answers === 'object') {
        setAnswers(parsed.answers)
        skipSeedRef.current = true
        setLoadingSeed(false)
      }
    } catch {}
  }, [draftStorageKey, mode, params?.id])

  useEffect(() => {
    if (typeof window === 'undefined') return

    try {
      const payload = {
        schema_version: SCHEMA_VERSION,
        mode,
        submission_id: mode === 'resubmit' ? String(params?.id || '') : null,
        selectedProjectId: selectedProjectId ? String(selectedProjectId) : '',
        weekYear,
        weekNumber,
        answers,
        updated_at: Date.now(),
      }
      window.sessionStorage.setItem(draftStorageKey, JSON.stringify(payload))
    } catch {}
  }, [answers, draftStorageKey, mode, params?.id, selectedProjectId, weekNumber, weekYear])

  useEffect(() => {
    if (mode === 'resubmit') return

    const projectIdFromQuery = persistedQuery.get('project_id')
    if (projectIdFromQuery && !selectedProjectId) {
      setSelectedProjectId(projectIdFromQuery)
    }

    const weekNumberFromQuery = persistedQuery.get('week_number')
    if (weekNumberFromQuery && Number.isFinite(Number(weekNumberFromQuery))) {
      setWeekNumber(Number(weekNumberFromQuery))
    }

    const weekYearFromQuery = persistedQuery.get('week_year')
    if (weekYearFromQuery && Number.isFinite(Number(weekYearFromQuery))) {
      setWeekYear(Number(weekYearFromQuery))
    }
  }, [mode, persistedQuery, selectedProjectId])

  useEffect(() => {
    if (mode === 'resubmit') return

    const nextQuery = new URLSearchParams(location.search)

    if (selectedProjectId) nextQuery.set('project_id', String(selectedProjectId))
    else nextQuery.delete('project_id')

    if (weekNumber) nextQuery.set('week_number', String(weekNumber))
    else nextQuery.delete('week_number')

    if (weekYear) nextQuery.set('week_year', String(weekYear))
    else nextQuery.delete('week_year')

    const nextSearch = nextQuery.toString()
    const currentSearch = (location.search || '').replace(/^\?/, '')

    if (nextSearch !== currentSearch) {
      navigate(
        {
          pathname: location.pathname,
          search: nextSearch ? `?${nextSearch}` : '',
        },
        { replace: true }
      )
    }
  }, [location.pathname, location.search, mode, navigate, selectedProjectId, weekNumber, weekYear])

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
    const seedFromPrevious = async () => {
      if (mode !== 'resubmit') return
      if (skipSeedRef.current) {
        setLoadingSeed(false)
        return
      }
      const submissionId = params?.id
      if (!submissionId) return

      try {
        setLoadingSeed(true)
        const res = await regulatoryWatchService.getById(submissionId)
        const submission = res.data?.data ?? null

        const prevProjectId = submission?.project_id
        if (prevProjectId) {
          setSelectedProjectId(String(prevProjectId))
        }

        if (submission?.week_year) {
          setWeekYear(Number(submission.week_year))
        }
        if (submission?.week_number) {
          setWeekNumber(Number(submission.week_number))
        }

        const prevSections = submission?.answers?.sections ?? []
        const prevNonApplicable = (Array.isArray(prevSections) ? prevSections : [])
          .flatMap((s) => (Array.isArray(s?.articles) ? s.articles : []))
          .filter((a) => a && a.applicable === false)
          .map((a) => String(a.article_id))

        setAnswers(makeInitialAnswers({ previousNonApplicableArticleIds: prevNonApplicable }))
      } catch (e) {
        toast.error(e.response?.data?.message ?? t('errors.somethingWentWrong'))
      } finally {
        setLoadingSeed(false)
      }
    }

    seedFromPrevious()
  }, [mode, params?.id])

  useEffect(() => {
    const seedFromLatestProjectSubmission = async () => {
      if (mode === 'resubmit') return
      if (skipSeedRef.current) {
        setLoadingSeed(false)
        return
      }

      const projectId = selectedProjectId ? String(selectedProjectId) : ''
      if (!projectId) {
        setLoadingSeed(false)
        return
      }

      try {
        setLoadingSeed(true)

        const res = await regulatoryWatchService.getLatest({ project_id: projectId })
        const submission = res.data?.data ?? null
        const prevSections = submission?.answers?.sections ?? []
        const prevNonApplicable = (Array.isArray(prevSections) ? prevSections : [])
          .flatMap((s) => (Array.isArray(s?.articles) ? s.articles : []))
          .filter((a) => a && a.applicable === false)
          .map((a) => String(a.article_id))

        setAnswers(makeInitialAnswers({ previousNonApplicableArticleIds: prevNonApplicable }))
      } catch (e) {
        toast.error(e.response?.data?.message ?? t('errors.somethingWentWrong'))
      } finally {
        setLoadingSeed(false)
      }
    }

    seedFromLatestProjectSubmission()
  }, [mode, selectedProjectId, t])

  const sectionScores = useMemo(() => {
    const sections = Array.isArray(answers?.sections) ? answers.sections : []
    return sections.map((s) => ({ section_id: s.section_id, ...computeSectionScore(s) }))
  }, [answers])

  const overallScore = useMemo(() => {
    const perc = sectionScores
      .map((s) => s.score)
      .filter((v) => typeof v === 'number' && Number.isFinite(v))

    if (perc.length === 0) return null
    return Math.round((perc.reduce((a, b) => a + b, 0) / perc.length) * 100) / 100
  }, [sectionScores])

  const sectionIndexMap = useMemo(() => {
    const sections = Array.isArray(answers?.sections) ? answers.sections : []
    const map = new Map()
    for (let i = 0; i < sections.length; i++) {
      map.set(String(sections[i]?.section_id), i)
    }
    return map
  }, [answers])

  const totalSections = SECTIONS.length

  useEffect(() => {
    const clamped = Math.min(Math.max(1, currentPageNumber), totalSections)
    if (clamped !== currentPageNumber) {
      navigate(`${wizardBasePath}/${clamped}${location.search || ''}`, { replace: true })
      return
    }
    setCurrentSectionIndex(clamped - 1)
  }, [currentPageNumber, location.search, navigate, totalSections, wizardBasePath])

  useEffect(() => {
    window.scrollTo({ top: 0, left: 0, behavior: 'smooth' })
  }, [currentPageNumber])

  const currentSectionSchema = useMemo(() => {
    return SECTIONS[currentSectionIndex] ?? null
  }, [currentSectionIndex])

  const articleIndexMaps = useMemo(() => {
    const sections = Array.isArray(answers?.sections) ? answers.sections : []
    const maps = new Map()
    for (const s of sections) {
      const m = new Map()
      const articles = Array.isArray(s?.articles) ? s.articles : []
      for (let i = 0; i < articles.length; i++) {
        m.set(String(articles[i]?.article_id), i)
      }
      maps.set(String(s?.section_id), m)
    }
    return maps
  }, [answers])

  const updateArticleByIndex = (sectionIndex, articleIndex, patch) => {
    setAnswers((prev) => {
      const next = { ...prev }
      const sections = Array.isArray(next.sections) ? [...next.sections] : []
      const section = { ...(sections[sectionIndex] ?? {}) }
      const articles = Array.isArray(section.articles) ? [...section.articles] : []
      const article = { ...(articles[articleIndex] ?? {}) }

      const updated = { ...article, ...patch }

      if (Object.prototype.hasOwnProperty.call(patch, 'applicable') && patch.applicable === false) {
        updated.compliant = false
        updated.corrective_action = ''
        updated.comment = ''
      }

      if (Object.prototype.hasOwnProperty.call(patch, 'applicable') && patch.applicable === true && article.applicable === false) {
        updated.compliant = true
      }

      if (Object.prototype.hasOwnProperty.call(patch, 'compliant') && patch.compliant === true) {
        updated.corrective_action = ''
      }

      articles[articleIndex] = updated
      section.articles = articles
      sections[sectionIndex] = section
      next.sections = sections
      return next
    })
  }

  const handleSubmit = async () => {
    if (!selectedProjectId) {
      toast.error(t('regulatoryWatch.projectRequired'))
      return
    }

    if (!weekYear || !weekNumber) {
      toast.error(t('errors.somethingWentWrong'))
      return
    }

    try {
      setSubmitting(true)
      const payload = {
        project_id: Number(selectedProjectId),
        week_year: Number(weekYear),
        week_number: Number(weekNumber),
        schema_version: SCHEMA_VERSION,
        answers,
      }
      const res = await regulatoryWatchService.submit(payload)
      toast.success(t('regulatoryWatch.submitSuccess'))

      try {
        window.sessionStorage.removeItem(draftStorageKey)
      } catch {}

      const submission = res.data?.data
      if (submission?.id) {
        navigate(`${basePath}/${submission.id}`)
        return
      }

      navigate(basePath)
    } catch (e) {
      toast.error(e.response?.data?.message ?? t('errors.somethingWentWrong'))
    } finally {
      setSubmitting(false)
    }
  }

  const goPrevious = () => {
    const prevPage = Math.max(1, currentPageNumber - 1)
    navigate(`${wizardBasePath}/${prevPage}${location.search || ''}`)
  }

  const goNext = () => {
    const nextPage = Math.min(totalSections, currentPageNumber + 1)
    navigate(`${wizardBasePath}/${nextPage}${location.search || ''}`)
  }

  const isLastSection = currentSectionIndex >= totalSections - 1

  return (
    <div className="space-y-6">
      <div className="flex items-start justify-between gap-4 flex-col sm:flex-row">
        <div className="flex items-start gap-3">
          <div className="p-2 bg-hse-primary/10 rounded-lg">
            <FileText className="w-5 h-5 text-hse-primary" />
          </div>
          <div>
            <h1 className="text-xl font-bold text-gray-900 dark:text-gray-100">
              {mode === 'resubmit' ? t('regulatoryWatch.resubmitTitle') : t('regulatoryWatch.newTitle')}
            </h1>
            <p className="text-sm text-gray-600 dark:text-gray-400">{t('regulatoryWatch.subtitle')}</p>
          </div>
        </div>

        <div className="flex items-center gap-2 w-full sm:w-auto">
          <button type="button" className="btn-secondary flex items-center justify-center gap-2 w-full sm:w-auto" onClick={() => navigate(basePath)}>
            <ArrowLeft className="w-4 h-4" />
            {t('common.back')}
          </button>
          <button
            type="button"
            onClick={isLastSection ? handleSubmit : goNext}
            disabled={submitting || !selectedProjectId || (isLastSection && loadingSeed)}
            className="btn-primary flex items-center justify-center gap-2 w-full sm:w-auto"
          >
            {submitting ? <Loader2 className="w-4 h-4 animate-spin" /> : isLastSection ? <Send className="w-4 h-4" /> : null}
            {isLastSection ? t('common.submit') : t('common.next')}
          </button>
        </div>
      </div>

      <div className="bg-white dark:bg-gray-800 rounded-xl shadow-sm border border-gray-200 dark:border-gray-700 p-4">
        <div className="grid grid-cols-1 md:grid-cols-4 gap-3 items-end">
          <div className="md:col-span-2">
            <label className="label">{t('regulatoryWatch.selectProject')}</label>
            <Select
              value={selectedProjectId}
              onChange={(e) => setSelectedProjectId(e.target.value)}
              disabled={loadingProjects || loadingSeed}
            >
              <option value="">{loadingProjects ? t('common.loading') : t('common.select')}...</option>
              {sortedProjects.map((p) => (
                <option key={p.id} value={String(p.id)}>
                  {getProjectLabel(p)}
                </option>
              ))}
            </Select>
          </div>

          <div className="md:col-span-1 grid grid-cols-2 md:grid-cols-1 gap-3">
            <div>
              <label className="label">{t('regulatoryWatch.week')}</label>
              <Select value={String(weekNumber)} onChange={(e) => setWeekNumber(Number(e.target.value))} disabled={loadingSeed}>
                {Array.from({ length: 53 }, (_, i) => i + 1).map((w) => (
                  <option key={w} value={String(w)}>
                    {w}
                  </option>
                ))}
              </Select>
            </div>

            <div>
              <label className="label">{t('regulatoryWatch.year')}</label>
              <Select value={String(weekYear)} onChange={(e) => setWeekYear(Number(e.target.value))} disabled={loadingSeed}>
                {Array.from({ length: 6 }, (_, i) => new Date().getFullYear() - 2 + i).map((y) => (
                  <option key={y} value={String(y)}>
                    {y}
                  </option>
                ))}
              </Select>
            </div>
          </div>

          <div className="md:col-span-1">
            <div className="p-3 rounded-lg border border-gray-200 dark:border-gray-700 bg-gray-50 dark:bg-gray-900">
              <div className="text-xs text-gray-500 dark:text-gray-400">{t('regulatoryWatch.overallScore')}</div>
              <div className="text-lg font-bold text-gray-900 dark:text-gray-100">
                {overallScore === null ? '-' : `${overallScore}%`}
              </div>
            </div>
          </div>
        </div>

        {loadingSeed && (
          <div className="mt-3 flex items-center gap-2 text-sm text-gray-500 dark:text-gray-400">
            <Loader2 className="w-4 h-4 animate-spin" />
            {t('common.loading')}
          </div>
        )}
      </div>

      {(() => {
        if (!currentSectionSchema) return null

        const sectionIdx = sectionIndexMap.get(String(currentSectionSchema.section_id))
        const sectionAnswers = sectionIdx !== undefined ? (answers?.sections ?? [])[sectionIdx] : null
        const articleIndexMap = articleIndexMaps.get(String(currentSectionSchema.section_id)) ?? new Map()

        if (!sectionAnswers) return null

        return (
          <div className="space-y-4">
            <div className="flex items-center justify-between gap-2 text-sm text-gray-600 dark:text-gray-300">
              <div>
                {t('common.page')} {currentSectionIndex + 1} {t('common.of')} {totalSections}
              </div>
              <div className="font-medium text-gray-900 dark:text-gray-100">{getLocalized(currentSectionSchema.title, language)}</div>
            </div>

            <div className="bg-white dark:bg-gray-800 rounded-xl shadow-sm border border-gray-200 dark:border-gray-700 overflow-hidden">
              <div className="p-4 border-b border-gray-200 dark:border-gray-700">
                <div className="font-semibold text-gray-900 dark:text-gray-100">{getLocalized(currentSectionSchema.title, language)}</div>
              </div>

              <div className="p-4 space-y-6">
                {(currentSectionSchema.chapters ?? []).map((chapter) => (
                  <div key={chapter.chapter_id} className="space-y-3">
                    <div className="text-sm font-semibold text-gray-900 dark:text-gray-100">{getLocalized(chapter.title, language)}</div>

                    <div className="space-y-3">
                      {(chapter.articles ?? []).map((schemaArticle) => {
                        const idx = articleIndexMap.get(String(schemaArticle.article_id))
                        const a = idx !== undefined ? (sectionAnswers?.articles ?? [])[idx] : null

                        if (!a) return null

                        const disabled = !a.applicable
                        const containerClass = disabled
                          ? 'border-gray-200 dark:border-gray-700 bg-gray-50/70 dark:bg-gray-900/40 opacity-70'
                          : 'border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-800'

                        const displayText = formatBulletText(getLocalized(schemaArticle.text, language))

                        return (
                          <div key={schemaArticle.article_id} className={`rounded-xl border ${containerClass} p-3`}>
                            <div className="flex flex-col md:flex-row md:items-start md:justify-between gap-3">
                              <div className="flex-1">
                                <div className="font-medium text-gray-900 dark:text-gray-100">{getLocalized(schemaArticle.code, language)}</div>
                                <div className="text-sm text-gray-600 dark:text-gray-300 mt-1 whitespace-pre-line">{displayText}</div>
                              </div>

                              <div className="flex flex-col gap-2 min-w-[240px]">
                                <div className="grid grid-cols-2 gap-2">
                                  <button
                                    type="button"
                                    onClick={() => updateArticleByIndex(sectionIdx, idx, { applicable: true })}
                                    className={`px-3 py-2 rounded-lg text-sm border transition-colors ${
                                      a.applicable
                                        ? 'bg-hse-primary text-white border-hse-primary'
                                        : 'bg-white dark:bg-gray-800 border-gray-200 dark:border-gray-700 text-gray-700 dark:text-gray-200'
                                    }`}
                                  >
                                    {t('regulatoryWatch.applicable')}
                                  </button>
                                  <button
                                    type="button"
                                    onClick={() => updateArticleByIndex(sectionIdx, idx, { applicable: false })}
                                    className={`px-3 py-2 rounded-lg text-sm border transition-colors ${
                                      !a.applicable
                                        ? 'bg-gray-500 text-white border-gray-500'
                                        : 'bg-white dark:bg-gray-800 border-gray-200 dark:border-gray-700 text-gray-700 dark:text-gray-200'
                                    }`}
                                  >
                                    {t('regulatoryWatch.notApplicable')}
                                  </button>
                                </div>

                                <div className="grid grid-cols-2 gap-2">
                                  <button
                                    type="button"
                                    disabled={disabled}
                                    onClick={() => updateArticleByIndex(sectionIdx, idx, { compliant: true })}
                                    className={`px-3 py-2 rounded-lg text-sm border transition-colors disabled:opacity-60 ${
                                      a.applicable && a.compliant
                                        ? 'bg-green-600 text-white border-green-600'
                                        : 'bg-white dark:bg-gray-800 border-gray-200 dark:border-gray-700 text-gray-700 dark:text-gray-200'
                                    }`}
                                  >
                                    <span className="inline-flex items-center gap-1 justify-center">
                                      <CheckCircle className="w-4 h-4" />
                                      {t('regulatoryWatch.conforme')}
                                    </span>
                                  </button>
                                  <button
                                    type="button"
                                    disabled={disabled}
                                    onClick={() => updateArticleByIndex(sectionIdx, idx, { compliant: false })}
                                    className={`px-3 py-2 rounded-lg text-sm border transition-colors disabled:opacity-60 ${
                                      a.applicable && !a.compliant
                                        ? 'bg-red-600 text-white border-red-600'
                                        : 'bg-white dark:bg-gray-800 border-gray-200 dark:border-gray-700 text-gray-700 dark:text-gray-200'
                                    }`}
                                  >
                                    <span className="inline-flex items-center gap-1 justify-center">
                                      <XCircle className="w-4 h-4" />
                                      {t('regulatoryWatch.nonConforme')}
                                    </span>
                                  </button>
                                </div>
                              </div>
                            </div>

                            {a.applicable && a.compliant === false && (
                              <div className="mt-3">
                                <label className="label text-xs">{t('regulatoryWatch.correctiveAction')}</label>
                                <textarea
                                  value={a.corrective_action ?? ''}
                                  onChange={(e) => updateArticleByIndex(sectionIdx, idx, { corrective_action: e.target.value })}
                                  rows={2}
                                  className="input"
                                />
                              </div>
                            )}

                            <div className="mt-3">
                              <label className="label text-xs">{t('regulatoryWatch.comment')}</label>
                              <textarea
                                value={a.comment ?? ''}
                                onChange={(e) => updateArticleByIndex(sectionIdx, idx, { comment: e.target.value })}
                                rows={2}
                                className="input"
                                disabled={!a.applicable}
                              />
                            </div>
                          </div>
                        )
                      })}
                    </div>
                  </div>
                ))}
              </div>
            </div>

            <div className="flex items-center justify-between gap-2">
              <button
                type="button"
                className="btn-secondary"
                onClick={goPrevious}
                disabled={currentSectionIndex === 0 || submitting}
              >
                {t('common.previous')}
              </button>

              <button
                type="button"
                className="btn-primary"
                onClick={isLastSection ? handleSubmit : goNext}
                disabled={submitting || !selectedProjectId || (isLastSection && loadingSeed)}
              >
                {isLastSection ? t('common.submit') : t('common.next')}
              </button>
            </div>
          </div>
        )
      })()}
    </div>
  )
}
