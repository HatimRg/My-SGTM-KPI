import { useEffect, useMemo, useState } from 'react'
import toast from 'react-hot-toast'
import { useLanguage } from '../../i18n'
import { useAuthStore } from '../../store/authStore'
import { communityFeedService } from '../../services/api'
import { MessageCircle, ImageIcon, Plus, Send, Hash, Filter } from 'lucide-react'

const CATEGORIES = ['good-practice', 'initiative', 'improvement', 'learning']

const REACTIONS = [
  { key: 'like', emoji: '👍', label: 'Like' },
  { key: 'praying_hands', emoji: '🙏', label: 'Praying Hands' },
  { key: 'sad', emoji: '😢', label: 'Sad' },
  { key: 'heart', emoji: '❤️', label: 'Heart' },
  { key: 'red_helmet', emoji: '⛑️', label: 'Red Helmet' },
]

const CLIENT_BLOCKED_TERMS = [
  'fuck', 'f*ck', 'fvck', 'shit', 'bitch', 'asshole',
  'putain', 'pute', 'salope', 'connard', 'encule',
  'zamel', '9ahba', 'qahba', 'zebi', 'weld l97ba',
  'قحبة', 'زب', 'نيك', 'شرموطة', 'ابن القحبة',
]

const normalizeForSearch = (value) => String(value || '')
  .normalize('NFKC')
  .replace(/[\u2018\u2019\u201A\u201B\u2032]/g, "'")
  .replace(/[\u201C\u201D\u201E\u201F\u2033]/g, '"')
  .replace(/\s+/g, ' ')
  .trim()
  .toLowerCase()
  .normalize('NFD')
  .replace(/\p{Diacritic}/gu, '')

const formatDate = (value) => {
  const date = new Date(value)
  return Number.isNaN(date.getTime()) ? '--/--/----' : date.toLocaleDateString('en-GB')
}

const getReactionTotal = (reactions = {}) => Object.values(reactions).reduce((acc, n) => acc + Number(n || 0), 0)

export default function HseCommunityFeed() {
  const { t, language } = useLanguage()
  const { user } = useAuthStore()

  const [posts, setPosts] = useState([])
  const [loading, setLoading] = useState(true)
  const [query, setQuery] = useState('')
  const [categoryFilter, setCategoryFilter] = useState('all')
  const [newBody, setNewBody] = useState('')
  const [newCategory, setNewCategory] = useState(CATEGORIES[0])
  const [newImages, setNewImages] = useState([])
  const [commentDrafts, setCommentDrafts] = useState({})
  const [blockedTerms, setBlockedTerms] = useState([])

  const canPublish = useMemo(() => {
    const roles = ['admin', 'dev', 'consultation', 'pole_director', 'works_director', 'hse_director', 'hr_director', 'hse_manager', 'regional_hse_manager', 'responsable', 'supervisor']
    return roles.includes(user?.role)
  }, [user?.role])

  const loadPosts = async () => {
    try {
      setLoading(true)
      const res = await communityFeedService.getPosts({
        search: query || undefined,
        category: categoryFilter,
        per_page: 50,
      })
      setPosts(res.data?.data || [])
    } catch (error) {
      toast.error(t('communityFeed.notifications.loadFailed'))
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    loadPosts()
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [categoryFilter])

  const filteredPosts = useMemo(() => {
    const q = normalizeForSearch(query)
    if (!q) return posts
    return posts.filter((post) => {
      const target = [
        post.body_normalized,
        normalizeForSearch(post.user?.full_name),
        normalizeForSearch(post.user?.project),
        ...(post.hashtags || []).map((h) => h.normalized),
      ].join(' ')
      return target.includes(q)
    })
  }, [posts, query])

  const checkBlockedTerms = (text) => {
    const normalized = normalizeForSearch(text).replace(/[^\p{L}\p{N}\s]/gu, '')
    const found = CLIENT_BLOCKED_TERMS.filter((term) => normalized.includes(normalizeForSearch(term).replace(/[^\p{L}\p{N}\s]/gu, '')))
    setBlockedTerms(found)
    return found
  }

  const createPost = async () => {
    const body = String(newBody || '').trim()
    if (!body) return

    const found = checkBlockedTerms(body)
    if (found.length > 0) {
      toast.error(t('communityFeed.moderation.notAllowed'))
      return
    }

    try {
      await communityFeedService.createPost({
        category: newCategory,
        bodyRaw: body,
        projectId: null,
        images: newImages,
      })
      setNewBody('')
      setNewCategory(CATEGORIES[0])
      setNewImages([])
      setBlockedTerms([])
      toast.success(t('communityFeed.notifications.postCreated'))
      loadPosts()
    } catch (error) {
      const apiTerms = error?.response?.data?.errors?.blocked_terms || []
      if (apiTerms.length) setBlockedTerms(apiTerms)
      toast.error(error?.response?.data?.message || t('communityFeed.notifications.createFailed'))
    }
  }

  const handleImageSelect = (event) => {
    const files = Array.from(event.target.files || [])
    setNewImages(files.slice(0, 6))
  }

  const react = async (postId, reactionType) => {
    try {
      await communityFeedService.react(postId, reactionType)
      loadPosts()
    } catch {
      toast.error(t('communityFeed.notifications.reactionFailed'))
    }
  }

  const addComment = async (postId) => {
    const value = String(commentDrafts[postId] || '').trim()
    if (!value) return

    try {
      await communityFeedService.addComment(postId, value)
      setCommentDrafts((prev) => ({ ...prev, [postId]: '' }))
      loadPosts()
    } catch (error) {
      const daysLeft = error?.response?.data?.errors?.days_left
      if (daysLeft) {
        toast.error(t('communityFeed.notifications.commentBan', { days: String(daysLeft) }))
        return
      }
      toast.error(error?.response?.data?.message || t('communityFeed.notifications.commentFailed'))
    }
  }

  return (
    <div className="max-w-5xl mx-auto space-y-6 animate-fade-in">
      <div>
        <div className="text-xs text-gray-500 dark:text-gray-400 mb-1">{t('nav.dashboard')} / {t('communityFeed.pageTitle')}</div>
        <h1 className="text-2xl font-bold text-gray-900 dark:text-gray-100">{t('communityFeed.pageTitle')}</h1>
        <p className="text-gray-500 dark:text-gray-400 mt-1">{t('communityFeed.pageSubtitle')}</p>
      </div>

      <div className="card">
        <div className="card-header flex flex-col gap-3 md:flex-row md:items-center md:justify-between">
          <div className="flex items-center gap-2"><Filter className="w-4 h-4 text-hse-primary" /><span className="font-medium text-gray-900 dark:text-gray-100">{t('communityFeed.filters.title')}</span></div>
          <div className="flex flex-col md:flex-row gap-2 w-full md:w-auto">
            <input value={query} onChange={(event) => setQuery(event.target.value)} placeholder={t('communityFeed.filters.searchPlaceholder')} className="input-field md:w-80" />
            <select value={categoryFilter} onChange={(event) => setCategoryFilter(event.target.value)} className="input-field md:w-52">
              <option value="all">{t('communityFeed.filters.allCategories')}</option>
              {CATEGORIES.map((category) => <option key={category} value={category}>{t(`communityFeed.categories.${category}`)}</option>)}
            </select>
            <button type="button" onClick={loadPosts} className="btn-secondary">{t('common.search')}</button>
          </div>
        </div>
      </div>

      {canPublish && (
        <div className="card">
          <div className="card-header flex items-center gap-2"><Plus className="w-5 h-5 text-hse-primary" /><h2 className="font-semibold text-gray-900 dark:text-gray-100">{t('communityFeed.create.title')}</h2></div>
          <div className="space-y-3">
            <select value={newCategory} onChange={(event) => setNewCategory(event.target.value)} className="input-field">
              {CATEGORIES.map((category) => <option key={category} value={category}>{t(`communityFeed.categories.${category}`)}</option>)}
            </select>
            <textarea value={newBody} onChange={(event) => { setNewBody(event.target.value); checkBlockedTerms(event.target.value) }} className="input-field min-h-24" placeholder={t('communityFeed.create.bodyPlaceholder')} />
            {blockedTerms.length > 0 && (
              <div className="rounded-md border border-red-300 bg-red-50 text-red-700 p-3 text-sm">
                <p className="font-semibold">{t('communityFeed.moderation.notAllowed')}</p>
                <p>{blockedTerms.join(', ')}</p>
              </div>
            )}
            <label className="inline-flex items-center gap-2 text-sm text-gray-600 dark:text-gray-300 cursor-pointer"><ImageIcon className="w-4 h-4" />{t('communityFeed.create.uploadImages')}<input type="file" accept="image/*" multiple onChange={handleImageSelect} className="hidden" /></label>
            {newImages.length > 0 && <p className="text-xs text-gray-500 dark:text-gray-400">{t('communityFeed.create.imagesSelected', { count: String(newImages.length) })}</p>}
            <button type="button" onClick={createPost} className="btn-primary inline-flex items-center gap-2"><Send className="w-4 h-4" />{t('communityFeed.create.publish')}</button>
          </div>
        </div>
      )}

      {!canPublish && <div className="card text-sm text-gray-600 dark:text-gray-300">{t('communityFeed.create.restrictedMessage')}</div>}

      <div className="space-y-4">
        {loading && <div className="card py-10 text-center text-gray-500 dark:text-gray-400">{t('common.loading')}</div>}
        {!loading && filteredPosts.length === 0 && <div className="card text-center py-10 text-gray-500 dark:text-gray-400">{t('communityFeed.emptyState')}</div>}

        {!loading && filteredPosts.map((post) => (
          <article key={post.id} className="card space-y-4">
            <header>
              <p className="font-semibold text-gray-900 dark:text-gray-100">{post.user?.full_name}</p>
              <p className="text-sm text-gray-600 dark:text-gray-300">{t(`roles.${post.user?.role}`)} • {post.user?.project || t('communityFeed.fallbackProject')}</p>
              <p className="text-xs text-gray-500 dark:text-gray-400">{formatDate(post.created_at)}</p>
            </header>
            <p className="whitespace-pre-line text-sm text-gray-800 dark:text-gray-100" dir="auto">{post.body_raw}</p>
            {!!post.hashtags?.length && <div className="flex flex-wrap gap-2">{post.hashtags.map((tag) => <span key={`${post.id}-${tag.normalized}`} className="inline-flex items-center gap-1 text-xs rounded-full bg-blue-50 dark:bg-blue-900/30 text-blue-700 dark:text-blue-300 px-2.5 py-1"><Hash className="w-3 h-3" />{tag.original}</span>)}</div>}
            {!!post.images?.length && <div className="grid grid-cols-2 md:grid-cols-3 gap-2">{post.images.map((image) => <div key={image.id} className="rounded-lg overflow-hidden border border-gray-200 dark:border-gray-700"><img src={image.url} alt={image.name} className="w-full h-32 object-cover" /></div>)}</div>}

            <div className="flex flex-wrap gap-2">
              {REACTIONS.map((reaction) => (
                <button key={reaction.key} type="button" onClick={() => react(post.id, reaction.key)} className={`px-2.5 py-1.5 rounded-full border text-sm ${post.my_reaction === reaction.key ? 'border-hse-primary text-hse-primary bg-blue-50 dark:bg-blue-900/20' : 'border-gray-300 dark:border-gray-600 text-gray-600 dark:text-gray-200'}`}>
                  <span className="mr-1">{reaction.emoji}</span>
                  {post.reactions?.[reaction.key] || 0}
                </button>
              ))}
              <span className="inline-flex items-center gap-1 text-gray-600 dark:text-gray-300 text-sm"><MessageCircle className="w-4 h-4" />{post.comments_count || 0}</span>
              <span className="text-xs text-gray-500 dark:text-gray-400 self-center">{getReactionTotal(post.reactions)} {t('communityFeed.reactions.total')}</span>
            </div>

            <div className="space-y-2">
              {(post.comments || []).map((comment) => (
                <div key={comment.id} className="rounded-lg bg-gray-50 dark:bg-gray-800 px-3 py-2 text-sm">
                  <span className="font-medium text-gray-900 dark:text-gray-100">{comment.author}</span>
                  <p className="text-gray-700 dark:text-gray-300" dir="auto">{comment.body_raw}</p>
                </div>
              ))}

              <div className="flex gap-2">
                <input value={commentDrafts[post.id] || ''} onChange={(event) => setCommentDrafts((prev) => ({ ...prev, [post.id]: event.target.value }))} className="input-field" placeholder={t('communityFeed.comments.placeholder')} dir="auto" />
                <button type="button" onClick={() => addComment(post.id)} className="btn-secondary">{t('communityFeed.comments.add')}</button>
              </div>
            </div>
          </article>
        ))}
      </div>
    </div>
  )
}
