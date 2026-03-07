import { useEffect, useMemo, useState } from 'react'
import toast from 'react-hot-toast'
import { useLanguage } from '../../i18n'
import { useAuthStore } from '../../store/authStore'
import { communityFeedService } from '../../services/api'
import { MessageCircle, ImageIcon, Plus, Send, Hash, Filter, Search, X, Loader2 } from 'lucide-react'

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

const creatorRoles = ['admin', 'dev', 'consultation', 'pole_director', 'works_director', 'hse_director', 'hr_director', 'hse_manager', 'regional_hse_manager', 'responsable', 'supervisor']

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

const getInitials = (name) => {
  const parts = String(name || '').trim().split(/\s+/).filter(Boolean)
  if (parts.length === 0) return 'U'
  return parts.slice(0, 2).map((p) => p[0]?.toUpperCase()).join('')
}

const FeedSkeleton = () => (
  <div className="rounded-xl border border-slate-300/70 dark:border-slate-700 bg-white/80 dark:bg-slate-900/90 p-4 space-y-3">
    <div className="flex items-center gap-3">
      <div className="h-10 w-10 rounded-full skeleton" />
      <div className="space-y-2 flex-1">
        <div className="h-3 w-1/3 skeleton" />
        <div className="h-2 w-1/4 skeleton" />
      </div>
    </div>
    <div className="h-3 w-full skeleton" />
    <div className="h-3 w-5/6 skeleton" />
    <div className="h-48 w-full rounded-lg skeleton" />
  </div>
)

export default function HseCommunityFeed() {
  const { t } = useLanguage()
  const { user } = useAuthStore()

  const [posts, setPosts] = useState([])
  const [loading, setLoading] = useState(true)
  const [fetching, setFetching] = useState(false)
  const [query, setQuery] = useState('')
  const [categoryFilter, setCategoryFilter] = useState('all')

  const [newBody, setNewBody] = useState('')
  const [newCategory, setNewCategory] = useState(CATEGORIES[0])
  const [newImages, setNewImages] = useState([])
  const [blockedTerms, setBlockedTerms] = useState([])
  const [publishing, setPublishing] = useState(false)

  const [commentDrafts, setCommentDrafts] = useState({})
  const [submittingComments, setSubmittingComments] = useState({})

  const canPublish = useMemo(() => creatorRoles.includes(user?.role), [user?.role])

  const loadPosts = async ({ background = false } = {}) => {
    try {
      if (background) setFetching(true)
      else setLoading(true)

      const res = await communityFeedService.getPosts({
        search: query || undefined,
        category: categoryFilter,
        per_page: 50,
      })

      setPosts(res.data?.data || [])
    } catch {
      toast.error(t('communityFeed.notifications.loadFailed'))
    } finally {
      if (background) setFetching(false)
      else setLoading(false)
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

  const handleImageSelect = (event) => {
    const files = Array.from(event.target.files || [])
    const selected = files.slice(0, 6)
    const withPreview = selected.map((file) => ({
      file,
      preview: URL.createObjectURL(file),
      id: `${file.name}-${file.size}-${Math.random()}`,
    }))
    setNewImages(withPreview)
  }

  const removeSelectedImage = (id) => {
    setNewImages((prev) => {
      const target = prev.find((img) => img.id === id)
      if (target?.preview) URL.revokeObjectURL(target.preview)
      return prev.filter((img) => img.id !== id)
    })
  }

  const createPost = async () => {
    const body = String(newBody || '').trim()
    if (!body || publishing) return

    const found = checkBlockedTerms(body)
    if (found.length > 0) {
      toast.error(t('communityFeed.moderation.notAllowed'))
      return
    }

    try {
      setPublishing(true)
      await communityFeedService.createPost({
        category: newCategory,
        bodyRaw: body,
        projectId: null,
        images: newImages.map((img) => img.file),
      })

      setNewBody('')
      setNewCategory(CATEGORIES[0])
      newImages.forEach((img) => img.preview && URL.revokeObjectURL(img.preview))
      setNewImages([])
      setBlockedTerms([])
      toast.success(t('communityFeed.notifications.postCreated'))
      loadPosts({ background: true })
    } catch (error) {
      const apiTerms = error?.response?.data?.errors?.blocked_terms || []
      if (apiTerms.length) setBlockedTerms(apiTerms)
      toast.error(error?.response?.data?.message || t('communityFeed.notifications.createFailed'))
    } finally {
      setPublishing(false)
    }
  }

  const react = async (postId, reactionType) => {
    // optimistic reaction update
    const previous = [...posts]
    setPosts((prev) => prev.map((post) => {
      if (post.id !== postId) return post

      const nextReactions = { ...(post.reactions || {}) }
      const prevType = post.my_reaction
      if (prevType) nextReactions[prevType] = Math.max(0, Number(nextReactions[prevType] || 0) - 1)

      if (prevType === reactionType) {
        return { ...post, my_reaction: null, reactions: nextReactions }
      }

      nextReactions[reactionType] = Number(nextReactions[reactionType] || 0) + 1
      return { ...post, my_reaction: reactionType, reactions: nextReactions }
    }))

    try {
      await communityFeedService.react(postId, reactionType)
    } catch {
      setPosts(previous)
      toast.error(t('communityFeed.notifications.reactionFailed'))
    }
  }

  const addComment = async (postId) => {
    const value = String(commentDrafts[postId] || '').trim()
    if (!value || submittingComments[postId]) return

    setSubmittingComments((prev) => ({ ...prev, [postId]: true }))
    try {
      const res = await communityFeedService.addComment(postId, value)
      const comment = res?.data?.data || { id: Date.now(), author: user?.name, body_raw: value }

      setPosts((prev) => prev.map((post) => {
        if (post.id !== postId) return post
        return {
          ...post,
          comments_count: Number(post.comments_count || 0) + 1,
          comments: [...(post.comments || []), comment],
        }
      }))

      setCommentDrafts((prev) => ({ ...prev, [postId]: '' }))
    } catch (error) {
      const daysLeft = error?.response?.data?.errors?.days_left
      if (daysLeft) {
        toast.error(t('communityFeed.notifications.commentBan', { days: String(daysLeft) }))
      } else {
        toast.error(error?.response?.data?.message || t('communityFeed.notifications.commentFailed'))
      }
    } finally {
      setSubmittingComments((prev) => ({ ...prev, [postId]: false }))
    }
  }

  return (
    <div className="max-w-5xl mx-auto animate-fade-in space-y-5 rounded-2xl bg-gray-50/60 dark:bg-slate-950/70 p-4 md:p-6">
      <section className="space-y-1">
        <p className="text-xs text-gray-500 dark:text-slate-400">{t('nav.dashboard')} / {t('communityFeed.pageTitle')}</p>
        <h1 className="text-3xl font-bold text-gray-900 dark:text-white">{t('communityFeed.pageTitle')}</h1>
        <p className="text-sm md:text-base text-gray-600 dark:text-slate-300">{t('communityFeed.pageSubtitle')}</p>
      </section>

      <section className="sticky top-2 z-10 rounded-xl border border-slate-300/70 dark:border-slate-700 bg-white/90 dark:bg-slate-900/95 backdrop-blur shadow-sm">
        <div className="px-4 py-3 border-b border-slate-200 dark:border-slate-700 flex items-center gap-2 text-gray-800 dark:text-slate-100 font-semibold">
          <Filter className="w-4 h-4 text-amber-500" />
          {t('communityFeed.filters.title')}
          {fetching && <Loader2 className="ml-auto w-4 h-4 animate-spin text-slate-400" />}
        </div>
        <div className="p-3 flex flex-col lg:flex-row gap-2">
          <div className="relative flex-1">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
            <input
              value={query}
              onChange={(event) => setQuery(event.target.value)}
              onKeyDown={(event) => {
                if (event.key === 'Enter') loadPosts({ background: true })
              }}
              placeholder={t('communityFeed.filters.searchPlaceholder')}
              className="w-full rounded-lg border border-slate-300 dark:border-slate-600 bg-white dark:bg-slate-800 pl-9 pr-3 py-2.5 text-sm text-gray-900 dark:text-white placeholder:text-gray-400"
            />
          </div>
          <select value={categoryFilter} onChange={(event) => setCategoryFilter(event.target.value)} className="rounded-lg border border-slate-300 dark:border-slate-600 bg-white dark:bg-slate-800 px-3 py-2.5 text-sm text-gray-900 dark:text-white min-w-[220px]">
            <option value="all">{t('communityFeed.filters.allCategories')}</option>
            {CATEGORIES.map((category) => <option key={category} value={category}>{t(`communityFeed.categories.${category}`)}</option>)}
          </select>
          <button type="button" onClick={() => loadPosts({ background: true })} className="px-4 py-2.5 rounded-lg bg-slate-700 hover:bg-slate-800 dark:bg-slate-700 dark:hover:bg-slate-600 text-white text-sm font-semibold">
            {t('common.search')}
          </button>
        </div>
      </section>

      {canPublish && (
        <section className="rounded-xl border border-slate-300/70 dark:border-slate-700 bg-white/80 dark:bg-slate-900/90 shadow-sm">
          <div className="px-4 py-3 border-b border-slate-200 dark:border-slate-700 flex items-center gap-2 text-gray-900 dark:text-slate-100 font-semibold">
            <Plus className="w-4 h-4 text-amber-500" />
            {t('communityFeed.create.title')}
          </div>
          <div className="p-3 space-y-3">
            <select value={newCategory} onChange={(event) => setNewCategory(event.target.value)} className="rounded-lg border border-slate-300 dark:border-slate-600 bg-white dark:bg-slate-800 px-3 py-2.5 text-sm text-gray-900 dark:text-white min-w-[220px]">
              {CATEGORIES.map((category) => <option key={category} value={category}>{t(`communityFeed.categories.${category}`)}</option>)}
            </select>

            <textarea
              value={newBody}
              onChange={(event) => {
                setNewBody(event.target.value)
                checkBlockedTerms(event.target.value)
              }}
              className="w-full rounded-lg border border-slate-300 dark:border-slate-600 bg-white dark:bg-slate-800 px-3 py-2.5 text-sm text-gray-900 dark:text-white placeholder:text-gray-400 min-h-28"
              placeholder={t('communityFeed.create.bodyPlaceholder')}
              dir="auto"
            />
            <div className="text-xs text-gray-500 dark:text-slate-400 text-right">{String(newBody.length)}/5000</div>

            {blockedTerms.length > 0 && (
              <div className="rounded-lg border border-red-300/70 dark:border-red-700 bg-red-50 dark:bg-red-950/40 text-red-700 dark:text-red-300 p-3 text-sm">
                <p className="font-semibold">{t('communityFeed.moderation.notAllowed')}</p>
                <p>{blockedTerms.join(', ')}</p>
              </div>
            )}

            {newImages.length > 0 && (
              <div className="grid grid-cols-2 md:grid-cols-3 gap-2">
                {newImages.map((img) => (
                  <div key={img.id} className="relative rounded-lg overflow-hidden border border-slate-300 dark:border-slate-600">
                    <img src={img.preview} alt={img.file?.name || 'preview'} className="w-full h-24 object-cover" />
                    <button type="button" onClick={() => removeSelectedImage(img.id)} className="absolute top-1 right-1 bg-black/70 text-white rounded-full p-1 hover:bg-black">
                      <X className="w-3 h-3" />
                    </button>
                  </div>
                ))}
              </div>
            )}

            <div className="flex flex-wrap items-center gap-2">
              <label className="inline-flex items-center gap-2 text-sm text-gray-600 dark:text-slate-300 cursor-pointer">
                <ImageIcon className="w-4 h-4" />
                {t('communityFeed.create.uploadImages')}
                <input type="file" accept="image/*" multiple onChange={handleImageSelect} className="hidden" />
              </label>

              {newImages.length > 0 && <span className="text-xs text-gray-500 dark:text-slate-400">{t('communityFeed.create.imagesSelected', { count: String(newImages.length) })}</span>}

              <button type="button" disabled={publishing || !newBody.trim()} onClick={createPost} className="ml-auto inline-flex items-center gap-2 px-4 py-2 rounded-lg bg-amber-500 hover:bg-amber-600 disabled:opacity-60 disabled:cursor-not-allowed text-white text-sm font-semibold">
                {publishing ? <Loader2 className="w-4 h-4 animate-spin" /> : <Send className="w-4 h-4" />}
                {t('communityFeed.create.publish')}
              </button>
            </div>
          </div>
        </section>
      )}

      {!canPublish && <div className="rounded-xl border border-slate-300/70 dark:border-slate-700 bg-white/80 dark:bg-slate-900/90 p-4 text-sm text-gray-600 dark:text-slate-300">{t('communityFeed.create.restrictedMessage')}</div>}

      <section className="space-y-3">
        {loading && (
          <>
            <FeedSkeleton />
            <FeedSkeleton />
          </>
        )}

        {!loading && filteredPosts.length === 0 && (
          <div className="rounded-xl border border-slate-300/70 dark:border-slate-700 bg-white/80 dark:bg-slate-900/90 py-10 text-center text-gray-500 dark:text-slate-400">
            {t('communityFeed.emptyState')}
          </div>
        )}

        {!loading && filteredPosts.map((post) => (
          <article key={post.id} className="rounded-xl border border-slate-300/70 dark:border-slate-700 bg-white/80 dark:bg-slate-900/90 shadow-sm overflow-hidden">
            <div className="p-4 space-y-3">
              <header className="flex items-start gap-3">
                <div className="w-10 h-10 rounded-full bg-amber-500/90 text-white flex items-center justify-center font-semibold text-xs">
                  {getInitials(post.user?.full_name)}
                </div>
                <div className="min-w-0">
                  <p className="font-semibold text-gray-900 dark:text-white truncate">{post.user?.full_name}</p>
                  <p className="text-sm text-gray-600 dark:text-slate-300 truncate">{t(`roles.${post.user?.role}`)} • {post.user?.project || t('communityFeed.fallbackProject')}</p>
                  <p className="text-xs text-gray-500 dark:text-slate-400">{formatDate(post.created_at)}</p>
                </div>
              </header>

              <p className="whitespace-pre-line text-sm text-gray-800 dark:text-slate-100" dir="auto">{post.body_raw}</p>

              {!!post.hashtags?.length && (
                <div className="flex flex-wrap gap-2">
                  {post.hashtags.map((tag) => (
                    <span key={`${post.id}-${tag.normalized}`} className="inline-flex items-center gap-1 text-xs rounded-full bg-blue-50 dark:bg-blue-900/30 text-blue-700 dark:text-blue-300 px-2.5 py-1">
                      <Hash className="w-3 h-3" />{tag.original}
                    </span>
                  ))}
                </div>
              )}
            </div>

            {!!post.images?.length && (
              <div className={`grid gap-0.5 bg-slate-200 dark:bg-slate-700 ${post.images.length === 1 ? 'grid-cols-1' : post.images.length === 2 ? 'grid-cols-2' : 'grid-cols-2 md:grid-cols-3'}`}>
                {post.images.map((image) => (
                  <div key={image.id} className="bg-white dark:bg-slate-800">
                    <img src={image.url} alt={image.name} className={`w-full object-cover ${post.images.length === 1 ? 'h-[420px]' : 'h-56'}`} />
                  </div>
                ))}
              </div>
            )}

            <div className="p-4 border-t border-slate-200 dark:border-slate-700 space-y-3">
              <div className="flex flex-wrap gap-2 items-center">
                {REACTIONS.map((reaction) => (
                  <button
                    key={reaction.key}
                    type="button"
                    onClick={() => react(post.id, reaction.key)}
                    className={`px-2.5 py-1.5 rounded-full border text-sm transition ${post.my_reaction === reaction.key ? 'border-amber-500 text-amber-600 dark:text-amber-300 bg-amber-50 dark:bg-amber-900/20' : 'border-slate-300 dark:border-slate-600 text-gray-600 dark:text-slate-200 hover:border-amber-500/60'}`}
                  >
                    <span className="mr-1">{reaction.emoji}</span>
                    {post.reactions?.[reaction.key] || 0}
                  </button>
                ))}

                <span className="inline-flex items-center gap-1 text-gray-600 dark:text-slate-300 text-sm px-1">
                  <MessageCircle className="w-4 h-4" />{post.comments_count || 0}
                </span>
                <span className="text-xs text-gray-500 dark:text-slate-400 self-center">{getReactionTotal(post.reactions)} {t('communityFeed.reactions.total')}</span>
              </div>

              <div className="space-y-2">
                {(post.comments || []).map((comment) => (
                  <div key={comment.id} className="rounded-lg bg-gray-100 dark:bg-slate-800 px-3 py-2 text-sm">
                    <span className="font-medium text-gray-900 dark:text-white">{comment.author}</span>
                    <p className="text-gray-700 dark:text-slate-300" dir="auto">{comment.body_raw}</p>
                  </div>
                ))}

                <div className="flex flex-col sm:flex-row gap-2">
                  <input
                    value={commentDrafts[post.id] || ''}
                    onChange={(event) => setCommentDrafts((prev) => ({ ...prev, [post.id]: event.target.value }))}
                    onKeyDown={(event) => {
                      if (event.key === 'Enter') addComment(post.id)
                    }}
                    className="w-full rounded-lg border border-slate-300 dark:border-slate-600 bg-white dark:bg-slate-800 px-3 py-2.5 text-sm text-gray-900 dark:text-white placeholder:text-gray-400"
                    placeholder={t('communityFeed.comments.placeholder')}
                    dir="auto"
                  />
                  <button type="button" disabled={submittingComments[post.id]} onClick={() => addComment(post.id)} className="px-4 py-2.5 rounded-lg bg-slate-700 hover:bg-slate-800 dark:bg-slate-700 dark:hover:bg-slate-600 text-white text-sm font-semibold whitespace-nowrap disabled:opacity-60 disabled:cursor-not-allowed">
                    {submittingComments[post.id] ? <Loader2 className="w-4 h-4 animate-spin" /> : t('communityFeed.comments.add')}
                  </button>
                </div>
              </div>
            </div>
          </article>
        ))}
      </section>
    </div>
  )
}
