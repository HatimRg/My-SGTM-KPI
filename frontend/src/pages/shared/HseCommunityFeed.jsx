import React, { useCallback, useEffect, useMemo, useState } from 'react'
import toast from 'react-hot-toast'
import { communityFeedService } from '../../services/api'
import { useLanguage } from '../../i18n'
import ResultsFooter from '../../components/ui/ResultsFooter'
import { useAuthStore } from '../../store/authStore'
import { useProjectStore } from '../../store/projectStore'
import { ChevronDown, Filter, Hash, ImageIcon, Loader2, MessageCircle, Plus, Send, X } from 'lucide-react'

const CATEGORIES = ['good-practice', 'initiative', 'improvement', 'learning']

const REACTIONS = [
  { key: 'like', emoji: '👍' },
  { key: 'heart', emoji: '❤️' },
  { key: 'praying_hands', emoji: '🙏' },
  { key: 'sad', emoji: '😢' },
  { key: 'red_helmet', emoji: '⛑️' },
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

const resolveAssetUrl = (value) => {
  const raw = String(value || '').trim()
  if (!raw) return ''

  if (/^https?:\/\//i.test(raw)) {
    try {
      const url = new URL(raw)
      if (typeof window !== 'undefined' && window.location?.origin && url.origin !== window.location.origin) {
        return `${window.location.origin}${url.pathname}${url.search}${url.hash}`
      }
      return raw
    } catch {
      return raw
    }
  }

  if (raw.startsWith('/')) {
    if (typeof window !== 'undefined' && window.location?.origin) {
      return `${window.location.origin}${raw}`
    }
  }

  return raw
}

const FeedImage = ({ src, alt }) => {
  const resolvedSrc = useMemo(() => resolveAssetUrl(src), [src])
  const [blobUrl, setBlobUrl] = useState('')
  const [triedBlob, setTriedBlob] = useState(false)
  const [hidden, setHidden] = useState(false)

  useEffect(() => {
    setHidden(false)
    setTriedBlob(false)
    setBlobUrl((prev) => {
      if (prev) URL.revokeObjectURL(prev)
      return ''
    })
  }, [resolvedSrc])

  useEffect(() => {
    return () => {
      setBlobUrl((prev) => {
        if (prev) URL.revokeObjectURL(prev)
        return ''
      })
    }
  }, [])

  const tryBlob = useCallback(async () => {
    if (!resolvedSrc || triedBlob) return
    setTriedBlob(true)

    try {
      const res = await fetch(resolvedSrc, { credentials: 'include' })
      if (!res.ok) throw new Error('Failed to load image')
      const blob = await res.blob()
      const url = URL.createObjectURL(blob)
      setBlobUrl((prev) => {
        if (prev) URL.revokeObjectURL(prev)
        return url
      })
    } catch {
      setHidden(true)
    }
  }, [resolvedSrc, triedBlob])

  if (!resolvedSrc || hidden) return null

  return (
    <img
      src={blobUrl || resolvedSrc}
      alt={alt}
      className="w-full h-32 object-cover"
      loading="lazy"
      onError={() => {
        if (blobUrl) {
          setHidden(true)
          return
        }
        tryBlob()
      }}
    />
  )
}

const formatDate = (value, lang) => {
  const date = new Date(value)
  if (Number.isNaN(date.getTime())) return '--/--/----'
  const locale = String(lang || '').toLowerCase().startsWith('en') ? 'en-GB' : 'fr-FR'
  return date.toLocaleDateString(locale)
}

const getReactionTotal = (reactions = {}) => Object.values(reactions).reduce((acc, n) => acc + Number(n || 0), 0)

const getReactionEmoji = (reactionType) => {
  const key = String(reactionType || '').trim()
  if (!key) return ''
  const found = REACTIONS.find((r) => r.key === key)
  return found?.emoji || ''
}

const getTimeAgoLabel = (value, t, language) => {
  const date = new Date(value)
  if (Number.isNaN(date.getTime())) return '--'

  const diffMs = Date.now() - date.getTime()
  const diffSeconds = Math.floor(diffMs / 1000)

  if (diffSeconds < 20) return t('communityFeed.timeAgo.justNow')
  const minutes = Math.floor(diffSeconds / 60)
  if (minutes < 60) return t('communityFeed.timeAgo.minutes', { count: String(minutes) })
  const hours = Math.floor(minutes / 60)
  if (hours < 24) return t('communityFeed.timeAgo.hours', { count: String(hours) })

  const days = Math.floor(hours / 24)
  if (days === 1) return t('communityFeed.timeAgo.yesterday')
  if (days < 7) return t('communityFeed.timeAgo.days', { count: String(days) })

  return formatDate(value, language)
}

export default function HseCommunityFeed() {
  const { t, language } = useLanguage()
  const { user } = useAuthStore()

  const { projects, fetchProjects } = useProjectStore()

  const [posts, setPosts] = useState([])
  const [loading, setLoading] = useState(true)
  const [loadingMore, setLoadingMore] = useState(false)
  const [page, setPage] = useState(1)
  const [total, setTotal] = useState(0)
  const [perPage, setPerPage] = useState(50)
  const [query, setQuery] = useState('')
  const [debouncedQuery, setDebouncedQuery] = useState('')
  const [categoryFilter, setCategoryFilter] = useState('all')
  const [projectFilter, setProjectFilter] = useState('all')
  const [newBody, setNewBody] = useState('')
  const [newCategory, setNewCategory] = useState(CATEGORIES[0])
  const [newProjectId, setNewProjectId] = useState('')
  const [newImages, setNewImages] = useState([])
  const [newImagePreviews, setNewImagePreviews] = useState([])
  const [posting, setPosting] = useState(false)
  const [commentDrafts, setCommentDrafts] = useState({})
  const [blockedTerms, setBlockedTerms] = useState([])
  const [reactionPickerPostId, setReactionPickerPostId] = useState(null)

  useEffect(() => {
    fetchProjects({ status: 'active' }).catch(() => {})
  }, [fetchProjects])

  const visibleProjects = useMemo(() => {
    const list = Array.isArray(projects) ? projects : []
    return list
      .filter((p) => !p || p.status === undefined || p.status === 'active')
      .map((p) => ({ id: p.id, name: p.name }))
      .filter((p) => p.id && p.name)
  }, [projects])

  useEffect(() => {
    if (newProjectId) return
    if (visibleProjects.length === 1) {
      setNewProjectId(String(visibleProjects[0].id))
    }
  }, [newProjectId, visibleProjects])

  const canPublish = useMemo(() => {
    const roles = ['admin', 'dev', 'consultation', 'pole_director', 'works_director', 'hse_director', 'hr_director', 'hse_manager', 'regional_hse_manager', 'responsable', 'supervisor']
    return roles.includes(user?.role)
  }, [user?.role])

  const loadPosts = useCallback(async (opts = {}) => {
    const nextPage = Number(opts?.page ?? 1)
    const append = !!opts?.append

    try {
      if (append) {
        setLoadingMore(true)
      } else {
        setLoading(true)
      }

      const res = await communityFeedService.getPosts({
        search: debouncedQuery?.trim() ? debouncedQuery.trim() : undefined,
        category: categoryFilter && categoryFilter !== 'all' ? categoryFilter : undefined,
        project_id: projectFilter && projectFilter !== 'all' ? projectFilter : undefined,
        page: nextPage,
        per_page: perPage,
      })
      const items = res.data?.data
      const meta = res.data?.meta ?? {}

      setPosts((prev) => {
        const list = Array.isArray(items) ? items : []
        if (!append) return list
        return [...(Array.isArray(prev) ? prev : []), ...list]
      })

      setPage(Number(meta.current_page ?? nextPage ?? 1))
      setTotal(Number(meta.total ?? 0))
      setPerPage(Number(meta.per_page ?? perPage))
    } catch (error) {
      toast.error(t('communityFeed.notifications.loadFailed'))
      setPosts([])
      setPage(1)
      setTotal(0)
    } finally {
      setLoading(false)
      setLoadingMore(false)
    }
  }, [categoryFilter, debouncedQuery, perPage, projectFilter, t])

  useEffect(() => {
    const timer = setTimeout(() => {
      setDebouncedQuery(query)
    }, 350)
    return () => clearTimeout(timer)
  }, [query])

  useEffect(() => {
    loadPosts({ page: 1, append: false })
  }, [loadPosts])

  useEffect(() => {
    const onDocMouseDown = (event) => {
      const target = event?.target
      if (!target) return
      if (target.closest?.('[data-reaction-picker="true"]')) return
      setReactionPickerPostId(null)
    }

    document.addEventListener('mousedown', onDocMouseDown)
    return () => document.removeEventListener('mousedown', onDocMouseDown)
  }, [])

  const shownCount = Array.isArray(posts) ? posts.length : 0
  const hasMore = total > shownCount

  const showMore = async () => {
    if (loading || loadingMore) return
    if (!hasMore) return
    await loadPosts({ page: page + 1, append: true })
  }

  const checkBlockedTerms = (text) => {
    const normalized = normalizeForSearch(text).replace(/[^\p{L}\p{N}\s]/gu, '')
    const found = CLIENT_BLOCKED_TERMS.filter((term) => normalized.includes(normalizeForSearch(term).replace(/[^\p{L}\p{N}\s]/gu, '')))
    setBlockedTerms(found)
    return found
  }

  const createPost = async () => {
    const body = String(newBody || '').trim()
    if (!body) return
    if (posting) return

    const found = checkBlockedTerms(body)
    if (found.length > 0) {
      toast.error(t('communityFeed.moderation.notAllowed'))
      return
    }

    try {
      setPosting(true)
      await communityFeedService.createPost({
        category: newCategory,
        bodyRaw: body,
        projectId: newProjectId ? Number(newProjectId) : null,
        images: newImages,
      })
      setNewBody('')
      setNewCategory(CATEGORIES[0])
      setNewImages([])
      setBlockedTerms([])
      toast.success(t('communityFeed.notifications.postCreated'))
      loadPosts({ page: 1, append: false })
    } catch (error) {
      const apiTerms = error?.response?.data?.errors?.blocked_terms || []
      if (apiTerms.length) setBlockedTerms(apiTerms)
      toast.error(error?.response?.data?.message || t('communityFeed.notifications.createFailed'))
    } finally {
      setPosting(false)
    }
  }

  const handleImageSelect = (event) => {
    const files = Array.from(event.target.files || [])
    setNewImages(files.slice(0, 6))
  }

  useEffect(() => {
    const previews = (newImages || []).map((file) => ({
      file,
      url: URL.createObjectURL(file),
    }))
    setNewImagePreviews(previews)

    return () => {
      for (const p of previews) {
        try {
          URL.revokeObjectURL(p.url)
        } catch {
          // ignore
        }
      }
    }
  }, [newImages])

  const removeNewImage = (index) => {
    setNewImages((prev) => {
      const list = Array.isArray(prev) ? [...prev] : []
      list.splice(index, 1)
      return list
    })
  }

  const react = async (postId, reactionType) => {
    const snapshot = posts

    setPosts((prev) => {
      const list = Array.isArray(prev) ? prev : []
      return list.map((p) => {
        if (String(p?.id) !== String(postId)) return p

        const next = { ...p }
        const reactions = { ...(next.reactions || {}) }
        const prevReaction = next.my_reaction || null

        if (prevReaction && reactions[prevReaction] !== undefined) {
          reactions[prevReaction] = Math.max(0, Number(reactions[prevReaction] || 0) - 1)
        }

        const isTogglingOff = prevReaction && prevReaction === reactionType
        if (isTogglingOff) {
          next.my_reaction = null
        } else {
          reactions[reactionType] = Number(reactions[reactionType] || 0) + 1
          next.my_reaction = reactionType
        }

        next.reactions = reactions
        return next
      })
    })

    try {
      await communityFeedService.react(postId, reactionType)
    } catch {
      setPosts(snapshot)
      toast.error(t('communityFeed.notifications.reactionFailed'))
    }
  }

  const chooseReaction = async (postId, reactionType) => {
    setReactionPickerPostId(null)
    await react(postId, reactionType)
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
    <div className="max-w-4xl mx-auto px-3 sm:px-6 space-y-5 sm:space-y-6 animate-fade-in">
      <div>
        <div className="text-xs text-gray-500 dark:text-gray-400 mb-1">{t('nav.dashboard')} / {t('communityFeed.pageTitle')}</div>
        <h1 className="text-2xl sm:text-3xl font-bold text-gray-900 dark:text-gray-100">{t('communityFeed.pageTitle')}</h1>
        <p className="text-gray-500 dark:text-gray-400 mt-1">{t('communityFeed.pageSubtitle')}</p>
      </div>

      <div className="card">
        <div className="card-header flex flex-col gap-3 md:flex-row md:items-center md:justify-between">
          <div className="flex items-center gap-2"><Filter className="w-4 h-4 text-hse-primary" /><span className="font-medium text-gray-900 dark:text-gray-100">{t('communityFeed.filters.title')}</span></div>
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-2 w-full md:w-auto">
            <input value={query} onChange={(event) => setQuery(event.target.value)} placeholder={t('communityFeed.filters.searchPlaceholder')} className="input w-full" />
            <select value={categoryFilter} onChange={(event) => setCategoryFilter(event.target.value)} className="input w-full">
              <option value="all">{t('communityFeed.filters.allCategories')}</option>
              {CATEGORIES.map((category) => <option key={category} value={category}>{t(`communityFeed.categories.${category}`)}</option>)}
            </select>
            <select value={projectFilter} onChange={(event) => setProjectFilter(event.target.value)} className="input w-full">
              <option value="all">{t('communityFeed.filters.allProjects')}</option>
              {visibleProjects.map((p) => <option key={p.id} value={String(p.id)}>{p.name}</option>)}
            </select>
            <button type="button" onClick={() => loadPosts({ page: 1, append: false })} className="btn-secondary" disabled={loading}>
              {loading ? <Loader2 className="w-4 h-4 animate-spin" /> : null}
              {t('common.search')}
            </button>
          </div>
        </div>
      </div>

      {canPublish && (
        <div className="card">
          <div className="card-header flex items-center gap-2"><Plus className="w-5 h-5 text-hse-primary" /><h2 className="font-semibold text-gray-900 dark:text-gray-100">{t('communityFeed.create.title')}</h2></div>
          <div className="space-y-3">
            {visibleProjects.length > 1 && (
              <select value={newProjectId} onChange={(event) => setNewProjectId(event.target.value)} className="input" disabled={posting}>
                <option value="">{t('communityFeed.create.selectProject')}</option>
                {visibleProjects.map((p) => <option key={p.id} value={String(p.id)}>{p.name}</option>)}
              </select>
            )}
            <select value={newCategory} onChange={(event) => setNewCategory(event.target.value)} className="input" disabled={posting}>
              {CATEGORIES.map((category) => <option key={category} value={category}>{t(`communityFeed.categories.${category}`)}</option>)}
            </select>
            <textarea
              value={newBody}
              onChange={(event) => {
                setNewBody(event.target.value)
                checkBlockedTerms(event.target.value)
              }}
              className="input min-h-24"
              placeholder={t('communityFeed.create.bodyPlaceholder')}
              disabled={posting}
            />
            {blockedTerms.length > 0 && (
              <div className="rounded-md border border-red-300 bg-red-50 text-red-700 p-3 text-sm">
                <p className="font-semibold">{t('communityFeed.moderation.notAllowed')}</p>
                <p>{blockedTerms.join(', ')}</p>
              </div>
            )}
            <label
              className={`inline-flex items-center gap-2 text-sm text-gray-600 dark:text-gray-300 ${posting ? 'opacity-50 cursor-not-allowed' : 'cursor-pointer'}`}
            >
              <ImageIcon className="w-4 h-4" />
              {t('communityFeed.create.uploadImages')}
              <input type="file" accept="image/*" multiple onChange={handleImageSelect} className="hidden" disabled={posting} />
            </label>
            {newImages.length > 0 && <p className="text-xs text-gray-500 dark:text-gray-400">{t('communityFeed.create.imagesSelected', { count: String(newImages.length) })}</p>}

            {newImagePreviews.length > 0 && (
              <div className="grid grid-cols-2 md:grid-cols-3 gap-2">
                {newImagePreviews.map((p, idx) => (
                  <div key={`${p.url}-${idx}`} className="relative rounded-lg overflow-hidden border border-gray-200 dark:border-gray-700 bg-gray-50 dark:bg-gray-800">
                    <img src={p.url} alt={p.file?.name ?? t('communityFeed.create.imagePreviewAlt')} className="w-full h-28 object-cover" />
                    <button
                      type="button"
                      className="absolute top-2 right-2 bg-white/90 dark:bg-gray-900/80 border border-gray-200 dark:border-gray-700 rounded-full p-1"
                      onClick={() => removeNewImage(idx)}
                      disabled={posting}
                      aria-label={t('common.remove')}
                      title={t('common.remove')}
                    >
                      <X className="w-4 h-4 text-gray-700 dark:text-gray-200" />
                    </button>
                  </div>
                ))}
              </div>
            )}

            <button
              type="button"
              onClick={createPost}
              className="btn-primary inline-flex items-center gap-2"
              disabled={posting || !String(newBody || '').trim() || (visibleProjects.length > 1 && !newProjectId)}
            >
              {posting ? <Loader2 className="w-4 h-4 animate-spin" /> : <Send className="w-4 h-4" />}
              {posting ? t('communityFeed.create.publishing') : t('communityFeed.create.publish')}
            </button>
          </div>
        </div>
      )}

      {!canPublish && <div className="card text-sm text-gray-600 dark:text-gray-300">{t('communityFeed.create.restrictedMessage')}</div>}

      <div className="space-y-4">
        {loading && <div className="card py-10 text-center text-gray-500 dark:text-gray-400">{t('common.loading')}</div>}
        {!loading && posts.length === 0 && <div className="card text-center py-10 text-gray-500 dark:text-gray-400">{t('communityFeed.emptyState')}</div>}

        {!loading && posts.map((post) => (
          <article key={post.id} className="card space-y-4">
            <header className="flex items-start gap-3">
              <div className="w-10 h-10 rounded-full bg-gray-100 dark:bg-gray-800 border border-gray-200 dark:border-gray-700 flex items-center justify-center text-sm font-semibold text-gray-700 dark:text-gray-200">
                {String(post.user?.full_name || '').trim().slice(0, 1).toUpperCase() || '?'}
              </div>
              <div className="min-w-0 flex-1">
                <p className="font-semibold text-gray-900 dark:text-gray-100 truncate">{post.user?.full_name}</p>
              <p className="text-sm text-gray-600 dark:text-gray-300">{t(`roles.${post.user?.role}`)} • {post.user?.project || t('communityFeed.fallbackProject')}</p>
              <p className="text-xs text-gray-500 dark:text-gray-400">
                {getTimeAgoLabel(post.created_at, t, language)}
                <span className="mx-1 text-gray-300 dark:text-gray-700">•</span>
                {formatDate(post.created_at, language)}
              </p>
              </div>
            </header>
            <p className="whitespace-pre-line text-sm text-gray-800 dark:text-gray-100" dir="auto">{post.body_raw}</p>
            {!!post.hashtags?.length && <div className="flex flex-wrap gap-2">{post.hashtags.map((tag) => <span key={`${post.id}-${tag.normalized}`} className="inline-flex items-center gap-1 text-xs rounded-full bg-blue-50 dark:bg-blue-900/30 text-blue-700 dark:text-blue-300 px-2.5 py-1"><Hash className="w-3 h-3" />{tag.original}</span>)}</div>}
            {!!post.images?.length && (
              <div className="grid grid-cols-2 md:grid-cols-3 gap-2">
                {post.images.map((image) => (
                  <div key={image.id} className="rounded-lg overflow-hidden border border-gray-200 dark:border-gray-700 bg-gray-50 dark:bg-gray-800">
                    <FeedImage src={image.url} alt={image.name} />
                  </div>
                ))}
              </div>
            )}

            <div className="flex flex-wrap items-center gap-2">
              <div className="relative" data-reaction-picker="true">
                <button
                  type="button"
                  onClick={() => setReactionPickerPostId((prev) => (String(prev) === String(post.id) ? null : post.id))}
                  className={`inline-flex items-center gap-2 px-3 py-1.5 rounded-full border text-sm ${
                    post.my_reaction
                      ? 'border-hse-primary text-hse-primary bg-blue-50 dark:bg-blue-900/20'
                      : 'border-gray-300 dark:border-gray-600 text-gray-700 dark:text-gray-200'
                  }`}
                  aria-haspopup="menu"
                  aria-expanded={String(reactionPickerPostId) === String(post.id)}
                  title={t('communityFeed.reactions.reactButton')}
                >
                  <span className="text-base leading-none">{getReactionEmoji(post.my_reaction) || '😊'}</span>
                  <span className="font-medium">{t('communityFeed.reactions.reactButton')}</span>
                  <ChevronDown className="w-4 h-4 opacity-70" />
                </button>

                {String(reactionPickerPostId) === String(post.id) && (
                  <div
                    role="menu"
                    className="absolute left-0 mt-2 w-64 z-40 rounded-xl border border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-900 shadow-xl p-2"
                  >
                    <div className="grid grid-cols-5 gap-1">
                      {REACTIONS.map((reaction) => (
                        <button
                          key={reaction.key}
                          type="button"
                          onClick={() => chooseReaction(post.id, reaction.key)}
                          className={`h-11 rounded-lg border text-lg transition-colors ${
                            post.my_reaction === reaction.key
                              ? 'border-hse-primary bg-blue-50 dark:bg-blue-900/20'
                              : 'border-gray-200 dark:border-gray-700 hover:bg-gray-50 dark:hover:bg-gray-800'
                          }`}
                          aria-label={t(`communityFeed.reactions.types.${reaction.key}`)}
                          title={t(`communityFeed.reactions.types.${reaction.key}`)}
                        >
                          {reaction.emoji}
                        </button>
                      ))}
                    </div>

                    {post.my_reaction && (
                      <button
                        type="button"
                        onClick={() => chooseReaction(post.id, post.my_reaction)}
                        className="mt-2 w-full px-3 py-2 rounded-lg border border-gray-200 dark:border-gray-700 text-sm text-gray-700 dark:text-gray-200 hover:bg-gray-50 dark:hover:bg-gray-800"
                      >
                        {t('communityFeed.reactions.remove')}
                      </button>
                    )}
                  </div>
                )}
              </div>

              <span className="inline-flex items-center gap-1 text-gray-700 dark:text-gray-200 text-sm px-3 py-1.5 rounded-full border border-gray-300 dark:border-gray-600">
                <span className="font-medium">{getReactionTotal(post.reactions)}</span>
                <span className="text-gray-500 dark:text-gray-400">{t('communityFeed.reactions.total')}</span>
              </span>

              <span className="inline-flex items-center gap-1 text-gray-700 dark:text-gray-200 text-sm px-3 py-1.5 rounded-full border border-gray-300 dark:border-gray-600">
                <MessageCircle className="w-4 h-4" />
                <span className="font-medium">{post.comments_count || 0}</span>
              </span>
            </div>

            <div className="space-y-2">
              {(post.comments || []).map((comment) => (
                <div key={comment.id} className="rounded-lg bg-gray-50 dark:bg-gray-800 px-3 py-2 text-sm">
                  <span className="font-medium text-gray-900 dark:text-gray-100">{comment.author}</span>
                  <p className="text-gray-700 dark:text-gray-300" dir="auto">{comment.body_raw}</p>
                </div>
              ))}

              <div className="flex gap-2">
                <input value={commentDrafts[post.id] || ''} onChange={(event) => setCommentDrafts((prev) => ({ ...prev, [post.id]: event.target.value }))} className="input" placeholder={t('communityFeed.comments.placeholder')} dir="auto" />
                <button type="button" onClick={() => addComment(post.id)} className="btn-secondary">{t('communityFeed.comments.add')}</button>
              </div>
            </div>
          </article>
        ))}

        {!loading && posts.length > 0 && (
          <ResultsFooter
            shown={shownCount}
            total={total}
            onShowMore={showMore}
            loadingMore={loadingMore}
          />
        )}
      </div>
    </div>
  )
}
