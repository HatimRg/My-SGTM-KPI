import { useEffect, useMemo, useState } from 'react'
import { projectService, regulatoryWatchService } from '../../services/api'
import { useLanguage } from '../../i18n'
import Select from '../../components/ui/Select'
import { FileText, Loader2, CheckCircle, XCircle, Send } from 'lucide-react'
import toast from 'react-hot-toast'

const SCHEMA_VERSION = 'v1'

const SECTION_1 = {
  section_id: 'code_travail_titre_iv_ch1',
  title: '1. Loi Code du travail',
  subtitle: "Titre IV : De l'hygiène et de la sécurité des salariés · Chapitre I : Dispositions générales",
  articles: [
    {
      article_id: '281',
      code: 'Article 281',
      text:
        "Locaux propres. Bonne conditions d'hygiène, de propreté et de salubrité nécessaires à la santé des salariés (prévention incendie, éclairage, eau potable, chauffage, aération, insonorisation, ventilation, fosses d'aisances, évacuation des eaux résiduaires et de lavage, poussières et vapeurs, vestiaires, toilette et couchage). Approvisionnement normal en eau potable des chantiers et logements salubres.",
    },
    {
      article_id: '282',
      code: 'Article 282',
      text:
        "Aménagement des locaux pour garantir la sécurité des salariés handicapés. Mise en place de dispositifs de protection afin que leur utilisation ne présente pas de danger.",
    },
    {
      article_id: '283',
      code: 'Article 283',
      text:
        "Interdiction d'acquisition ou de location de machines présentant un danger sans dispositifs de protection dont elles ont été pourvues à l'origine.",
    },
    {
      article_id: '284',
      code: 'Article 284',
      text:
        "Obligation de port de ceinture ou autres dispositifs de sécurité et de masques de protection pour les salariés appelés à réaliser ce genre de travaux.",
    },
    {
      article_id: '285',
      code: 'Article 285',
      text:
        "Obligation de clôture des puits, trappes ou ouvertures de descente. Barrières de protection/cloisons pour les moteurs. Escaliers solides munis de fortes rampes. Échafaudages munis de garde-corps rigides d'au moins 90 cm.",
    },
    {
      article_id: '286',
      code: 'Article 286',
      text: "Mettre en place des dispositifs de sécurité intégrés et éviter le contact avec les courroies.",
    },
    {
      article_id: '287',
      code: 'Article 287',
      text:
        "Interdiction d'utilisation de produits/substances/appareils/machines reconnus comme susceptibles de porter atteinte à la santé ou à la sécurité. Interdiction de permettre l'utilisation dans des conditions contraires à la réglementation.",
    },
    {
      article_id: '288',
      code: 'Article 288',
      text:
        "Signaler sur les emballages des substances et préparations dangereuses un avertissement des dangers.",
    },
    {
      article_id: '289',
      code: 'Article 289',
      text:
        "Informer les salariés des dispositions légales concernant la protection contre les dangers des machines. Afficher un avis lisible indiquant les dangers et précautions. Interdiction d'utiliser des machines sans dispositifs de protection, d'inopérer les dispositifs, et d'imposer le transport manuel de charges compromettant la santé/sécurité.",
    },
    {
      article_id: '290',
      code: 'Article 290',
      text: "Réalisation de visite médicale avant recrutement avec renouvellement périodique.",
    },
    {
      article_id: '294',
      code: 'Article 294',
      text: "Garantir les conditions d'hygiène et de sécurité.",
    },
  ],
}

const makeInitialAnswers = () => {
  return {
    sections: [
      {
        section_id: SECTION_1.section_id,
        title: SECTION_1.title,
        subtitle: SECTION_1.subtitle,
        articles: SECTION_1.articles.map((a) => ({
          article_id: a.article_id,
          code: a.code,
          text: a.text,
          applicable: true,
          compliant: true,
          corrective_action: '',
          comment: '',
        })),
      },
    ],
  }
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

export default function VeilleReglementaire() {
  const { t } = useLanguage()

  const [projects, setProjects] = useState([])
  const [loadingProjects, setLoadingProjects] = useState(true)
  const [selectedProjectId, setSelectedProjectId] = useState('')

  const [loadingLatest, setLoadingLatest] = useState(false)
  const [submitting, setSubmitting] = useState(false)
  const [latestSubmission, setLatestSubmission] = useState(null)

  const [answers, setAnswers] = useState(() => makeInitialAnswers())

  useEffect(() => {
    const loadProjects = async () => {
      try {
        setLoadingProjects(true)
        const list = await projectService.getAllList({ status: 'active' })
        setProjects(Array.isArray(list) ? list : [])
        if (!selectedProjectId && Array.isArray(list) && list.length === 1) {
          setSelectedProjectId(String(list[0].id))
        }
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
    const loadLatest = async () => {
      if (!selectedProjectId) {
        setLatestSubmission(null)
        setAnswers(makeInitialAnswers())
        return
      }

      try {
        setLoadingLatest(true)
        const res = await regulatoryWatchService.getLatest({ project_id: Number(selectedProjectId) })
        const data = res.data?.data ?? null
        setLatestSubmission(data)
        const nextAnswers = data?.answers
        if (nextAnswers && typeof nextAnswers === 'object') {
          setAnswers(nextAnswers)
        } else {
          setAnswers(makeInitialAnswers())
        }
      } catch {
        setLatestSubmission(null)
        setAnswers(makeInitialAnswers())
      } finally {
        setLoadingLatest(false)
      }
    }

    loadLatest()
  }, [selectedProjectId])

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

  const updateArticle = (sectionIndex, articleIndex, patch) => {
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

    try {
      setSubmitting(true)
      const payload = {
        project_id: Number(selectedProjectId),
        schema_version: SCHEMA_VERSION,
        answers,
      }
      await regulatoryWatchService.submit(payload)
      toast.success(t('regulatoryWatch.submitSuccess'))

      const res = await regulatoryWatchService.getLatest({ project_id: Number(selectedProjectId) })
      setLatestSubmission(res.data?.data ?? null)
    } catch (e) {
      toast.error(e.response?.data?.message ?? t('errors.somethingWentWrong'))
    } finally {
      setSubmitting(false)
    }
  }

  return (
    <div className="space-y-6">
      <div className="flex items-start justify-between gap-4 flex-col sm:flex-row">
        <div className="flex items-start gap-3">
          <div className="p-2 bg-hse-primary/10 rounded-lg">
            <FileText className="w-5 h-5 text-hse-primary" />
          </div>
          <div>
            <h1 className="text-xl font-bold text-gray-900 dark:text-gray-100">{t('regulatoryWatch.title')}</h1>
            <p className="text-sm text-gray-600 dark:text-gray-400">{t('regulatoryWatch.subtitle')}</p>
          </div>
        </div>

        <div className="flex items-center gap-2 w-full sm:w-auto">
          <button
            type="button"
            onClick={handleSubmit}
            disabled={submitting || !selectedProjectId}
            className="btn-primary flex items-center justify-center gap-2 w-full sm:w-auto"
          >
            {submitting ? <Loader2 className="w-4 h-4 animate-spin" /> : <Send className="w-4 h-4" />}
            {t('common.submit')}
          </button>
        </div>
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
              <option value="">{loadingProjects ? t('common.loading') : t('common.select')}...</option>
              {projects.map((p) => (
                <option key={p.id} value={String(p.id)}>
                  {p.name}
                </option>
              ))}
            </Select>
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

        {loadingLatest && (
          <div className="mt-3 flex items-center gap-2 text-sm text-gray-500 dark:text-gray-400">
            <Loader2 className="w-4 h-4 animate-spin" />
            {t('common.loading')}
          </div>
        )}

        {!loadingLatest && latestSubmission?.submitted_at && (
          <div className="mt-3 text-xs text-gray-500 dark:text-gray-400">
            {t('regulatoryWatch.lastSubmission')}: {new Date(latestSubmission.submitted_at).toLocaleString()}
          </div>
        )}
      </div>

      {(answers?.sections ?? []).map((section, sectionIndex) => {
        const score = sectionScores.find((s) => s.section_id === section.section_id)
        return (
          <div key={section.section_id} className="bg-white dark:bg-gray-800 rounded-xl shadow-sm border border-gray-200 dark:border-gray-700 overflow-hidden">
            <div className="p-4 border-b border-gray-200 dark:border-gray-700">
              <div className="flex flex-col sm:flex-row sm:items-start sm:justify-between gap-3">
                <div>
                  <h2 className="font-semibold text-gray-900 dark:text-gray-100">{section.title}</h2>
                  {section.subtitle && <p className="text-sm text-gray-600 dark:text-gray-400 mt-1">{section.subtitle}</p>}
                </div>

                <div className="p-3 rounded-lg border border-gray-200 dark:border-gray-700 bg-gray-50 dark:bg-gray-900">
                  <div className="text-xs text-gray-500 dark:text-gray-400">{t('regulatoryWatch.sectionScore')}</div>
                  <div className="text-sm font-semibold text-gray-900 dark:text-gray-100">
                    {score ? `${score.totalConforme} / ${score.totalApplicable}` : '-'}
                    {score?.score === null ? '' : ` (${score.score}%)`}
                  </div>
                </div>
              </div>
            </div>

            <div className="p-4 space-y-3">
              {(section.articles ?? []).map((a, articleIndex) => {
                const disabled = !a.applicable
                const containerClass = disabled
                  ? 'border-gray-200 dark:border-gray-700 bg-gray-50/70 dark:bg-gray-900/40 opacity-70'
                  : 'border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-800'

                return (
                  <div key={a.article_id} className={`rounded-xl border ${containerClass} p-3`}> 
                    <div className="flex flex-col md:flex-row md:items-start md:justify-between gap-3">
                      <div className="flex-1">
                        <div className="font-medium text-gray-900 dark:text-gray-100">{a.code}</div>
                        <div className="text-sm text-gray-600 dark:text-gray-300 mt-1">{a.text}</div>
                      </div>

                      <div className="flex flex-col gap-2 min-w-[240px]">
                        <div className="grid grid-cols-2 gap-2">
                          <button
                            type="button"
                            onClick={() => updateArticle(sectionIndex, articleIndex, { applicable: true })}
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
                            onClick={() => updateArticle(sectionIndex, articleIndex, { applicable: false })}
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
                            onClick={() => updateArticle(sectionIndex, articleIndex, { compliant: true })}
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
                            onClick={() => updateArticle(sectionIndex, articleIndex, { compliant: false })}
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
                          onChange={(e) => updateArticle(sectionIndex, articleIndex, { corrective_action: e.target.value })}
                          rows={2}
                          className="input"
                        />
                      </div>
                    )}

                    <div className="mt-3">
                      <label className="label text-xs">{t('regulatoryWatch.comment')}</label>
                      <textarea
                        value={a.comment ?? ''}
                        onChange={(e) => updateArticle(sectionIndex, articleIndex, { comment: e.target.value })}
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
        )
      })}
    </div>
  )
}
