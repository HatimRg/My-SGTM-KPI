import {
  SECTION_3,
  SECTION_12,
  SECTION_12_16,
  getLocalized,
  formatBulletText,
} from './veilleReglementaireSchema'

export const SCHEMA_VERSION = 'v2_env'

export const SECTIONS = [
  SECTION_3,
  SECTION_12,
  SECTION_12_16,
]

export const FLAT_ARTICLES = SECTIONS.flatMap((section) =>
  (section.chapters ?? []).flatMap((chapter) =>
    (chapter.articles ?? []).map((a) => ({ ...a, section_id: section.section_id, chapter_id: chapter.chapter_id }))
  )
)

export const makeInitialAnswers = ({ previousNonApplicableArticleIds = [] } = {}) => {
  const previousSet = new Set(previousNonApplicableArticleIds)

  return {
    sections: [
      ...SECTIONS.map((section) => {
        const flat = FLAT_ARTICLES.filter((a) => a.section_id === section.section_id)
        return {
          section_id: section.section_id,
          articles: flat.map((a) => ({
            article_id: a.article_id,
            chapter_id: a.chapter_id,
            applicable: !previousSet.has(a.article_id),
            compliant: true,
            corrective_action: '',
            comment: '',
          })),
        }
      }),
    ],
  }
}

export { getLocalized, formatBulletText }

export const getArticleSchemaById = (articleId) => {
  return FLAT_ARTICLES.find((a) => a.article_id === articleId) ?? null
}

export const getSectionSchemaById = (sectionId) => {
  return SECTIONS.find((s) => s.section_id === sectionId) ?? null
}
