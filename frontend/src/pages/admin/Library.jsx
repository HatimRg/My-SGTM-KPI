import { useEffect, useMemo, useRef, useState } from 'react'
import { useSearchParams } from 'react-router-dom'
import { useLanguage } from '../../i18n'
import { useAuthStore } from '../../store/authStore'
import { libraryService } from '../../services/api'
import toast from 'react-hot-toast'
import {
  Download,
  FileText,
  FileSpreadsheet,
  File,
  ChevronLeft,
  Folder,
  FolderPlus,
  MoreVertical,
  Pencil,
  RefreshCw,
  Trash2,
  Search,
  UploadCloud,
  X,
  Filter,
  SortAsc,
  SortDesc,
} from 'lucide-react'

import Modal from '../../components/ui/Modal'
import ConfirmDialog from '../../components/ui/ConfirmDialog'

const normalizeQuery = (q) => {
  const raw = String(q ?? '')
    .toLowerCase()
    .trim()

  if (!raw) return ''

  // Basic plural compensation + punctuation cleanup
  return raw
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/[^a-z0-9\s._-]/g, ' ')
    .split(/\s+/)
    .filter(Boolean)
    .map((t) => {
      if (t.endsWith('ies') && t.length > 4) return t.slice(0, -3) + 'y'
      if (t.endsWith('es') && t.length > 3) return t.slice(0, -2)
      if (t.endsWith('s') && t.length > 2) return t.slice(0, -1)
      return t
    })
    .join(' ')
}

const levenshtein = (a, b) => {
  const s = String(a)
  const t = String(b)
  if (s === t) return 0
  if (!s) return t.length
  if (!t) return s.length

  const m = s.length
  const n = t.length
  const dp = Array.from({ length: m + 1 }, () => Array(n + 1).fill(0))

  for (let i = 0; i <= m; i++) dp[i][0] = i
  for (let j = 0; j <= n; j++) dp[0][j] = j

  for (let i = 1; i <= m; i++) {
    const sc = s[i - 1]
    for (let j = 1; j <= n; j++) {
      const tc = t[j - 1]
      const cost = sc === tc ? 0 : 1
      dp[i][j] = Math.min(
        dp[i - 1][j] + 1,
        dp[i][j - 1] + 1,
        dp[i - 1][j - 1] + cost,
      )
    }
  }

  return dp[m][n]
}

const similarityScore = (query, target) => {
  const q = normalizeQuery(query)
  const s = normalizeQuery(target)
  if (!q) return 1
  if (!s) return 0

  if (s.includes(q)) return 0.95

  const qTokens = q.split(' ')
  const sTokens = s.split(' ')

  let best = 0
  for (const qt of qTokens) {
    if (!qt) continue
    for (const st of sTokens) {
      if (!st) continue
      if (st.includes(qt) || qt.includes(st)) {
        best = Math.max(best, 0.85)
        continue
      }
      const dist = levenshtein(qt, st)
      const denom = Math.max(1, Math.max(qt.length, st.length))
      const score = 1 - dist / denom
      best = Math.max(best, score)
    }
  }

  // Light penalty for very short noisy queries
  if (q.length <= 2) return best * 0.75
  return best
}

const bytesLabel = (bytes) => {
  const n = Number(bytes)
  if (!Number.isFinite(n) || n <= 0) return '—'
  const units = ['B', 'KB', 'MB', 'GB']
  const i = Math.min(units.length - 1, Math.floor(Math.log(n) / Math.log(1024)))
  const v = n / Math.pow(1024, i)
  return `${v.toFixed(i === 0 ? 0 : 1)} ${units[i]}`
}

const fileIcon = (ext) => {
  const e = String(ext ?? '').toLowerCase()
  if (e === 'pdf' || e === 'doc' || e === 'docx') return FileText
  if (e === 'xls' || e === 'xlsx' || e === 'csv') return FileSpreadsheet
  return File
}

const statusPillClass = (status) => {
  const s = String(status || '').toLowerCase()
  if (s === 'indexed') return 'bg-emerald-50 text-emerald-700 border-emerald-200 dark:bg-emerald-900/30 dark:text-emerald-200 dark:border-emerald-900'
  if (s === 'failed') return 'bg-red-50 text-red-700 border-red-200 dark:bg-red-900/30 dark:text-red-200 dark:border-red-900'
  if (s === 'processing') return 'bg-amber-50 text-amber-700 border-amber-200 dark:bg-amber-900/30 dark:text-amber-200 dark:border-amber-900'
  return 'bg-gray-50 text-gray-700 border-gray-200 dark:bg-gray-800 dark:text-gray-200 dark:border-gray-700'
}

export default function Library() {
  const { t } = useLanguage()
  const { user, isAdmin } = useAuthStore()

  const [searchParams, setSearchParams] = useSearchParams()

  const isAdminUser = isAdmin?.() || user?.role === 'dev'

  const [query, setQuery] = useState('')
  const [kindFilter, setKindFilter] = useState('all') // all | file | folder
  const [sortBy, setSortBy] = useState('updated_at') // name | updated_at
  const [sortDir, setSortDir] = useState('desc') // asc | desc

  const [currentFolder, setCurrentFolder] = useState(null)
  const [breadcrumbs, setBreadcrumbs] = useState([])
  const [items, setItems] = useState([])
  const [loading, setLoading] = useState(false)

  const [currentFolderMeta, setCurrentFolderMeta] = useState(null)

  const itemsCacheRef = useRef(new Map())
  const didInitNavFromUrlRef = useRef(false)
  const lastUrlWriteRef = useRef('')
  const navPushNextRef = useRef(false)

  const encodeFolderStack = (stack) => {
    try {
      return encodeURIComponent(JSON.stringify(stack || []))
    } catch {
      return ''
    }
  }

  const decodeFolderStack = (raw) => {
    if (!raw) return []
    try {
      const decoded = decodeURIComponent(String(raw))
      const parsed = JSON.parse(decoded)
      if (!Array.isArray(parsed)) return []
      return parsed
        .filter((x) => x && (x.id !== null && x.id !== undefined) && typeof x.name === 'string')
        .map((x) => ({ id: x.id, name: x.name }))
    } catch {
      return []
    }
  }

  const [createFolderName, setCreateFolderName] = useState('')
  const [creatingFolder, setCreatingFolder] = useState(false)
  const [createFolderModalOpen, setCreateFolderModalOpen] = useState(false)

  const [viewer, setViewer] = useState({ isOpen: false, item: null })
  const [viewerUrl, setViewerUrl] = useState(null)

  const [thumbUrlsById, setThumbUrlsById] = useState({})
  const thumbAbortRef = useRef({})

  const [actionsOpenId, setActionsOpenId] = useState(null)

  const [confirmDelete, setConfirmDelete] = useState({ isOpen: false, item: null })

  const [confirmDeleteFolder, setConfirmDeleteFolder] = useState({ isOpen: false, item: null })
  const [confirmForceDeleteFolder, setConfirmForceDeleteFolder] = useState({ isOpen: false, item: null, counts: null })
  const [renameFolderModal, setRenameFolderModal] = useState({ isOpen: false, item: null })
  const [renameFolderName, setRenameFolderName] = useState('')
  const [renamingFolder, setRenamingFolder] = useState(false)

  const onDeleteFolder = async (folder) => {
    try {
      if (!folder?.id) return
      await libraryService.deleteFolder(folder.id)
      await fetchItems()
      toast.success(t('common.deleted'), { id: 'library:folder:deleted' })
    } catch (e) {
      const status = e?.response?.status
      const msg = e?.response?.data?.message
      const errors = e?.response?.data?.errors
      if (status === 400 && msg === 'Folder not empty') {
        setConfirmForceDeleteFolder({ isOpen: true, item: folder, counts: errors || null })
        return
      }
      toast.error(msg || 'Failed to delete folder', { id: 'library:folder:delete:error' })
    }
  }

  const onForceDeleteFolder = async (folder) => {
    try {
      if (!folder?.id) return
      await libraryService.deleteFolder(folder.id, { force: 1 })
      await fetchItems()
      toast.success(t('common.deleted'), { id: 'library:folder:deleted' })
    } catch (e) {
      toast.error(e?.response?.data?.message || 'Failed to delete folder', { id: 'library:folder:delete:error' })
    }
  }

  const onRenameFolder = async () => {
    const folder = renameFolderModal?.item
    const name = String(renameFolderName || '').trim()
    if (!folder?.id || !name) return
    try {
      setRenamingFolder(true)
      await libraryService.renameFolder({ id: folder.id, name })
      setRenameFolderModal({ isOpen: false, item: null })
      setRenameFolderName('')
      await fetchItems()
      toast.success(t('common.saved'), { id: 'library:folder:renamed' })
    } catch (e) {
      toast.error(e?.response?.data?.message || 'Failed to rename folder', { id: 'library:folder:rename:error' })
    } finally {
      setRenamingFolder(false)
    }
  }

  const onToggleFolderVisibility = async (folder) => {
    try {
      if (!folder?.id) return
      await libraryService.setFolderVisibility({ id: folder.id, isPublic: !folder.is_public })
      await fetchItems()
      toast.success(t('common.saved'), { id: 'library:folder:visibility' })
    } catch (e) {
      toast.error(e?.response?.data?.message || 'Failed', { id: 'library:folder:visibility:error' })
    }
  }

  const onCancelProcessing = async (item) => {
    try {
      if (!item?.id) return
      await libraryService.cancelDocument(item.id)
      await fetchItems()
      toast.success('Cancelled', { id: 'library:cancel:ok' })
    } catch (e) {
      toast.error(e?.response?.data?.message || 'Failed', { id: 'library:cancel:error' })
    }
  }

  const downloadFolderZip = async () => {
    if (!currentFolder?.id) return
    try {
      const res = await libraryService.fetchFolderZipBlob(currentFolder.id)
      const blob = res?.data
      const url = URL.createObjectURL(blob)
      const a = document.createElement('a')
      a.href = url
      a.download = `${currentFolder?.name || 'folder'}.zip`
      document.body.appendChild(a)
      a.click()
      a.remove()
      setTimeout(() => URL.revokeObjectURL(url), 2000)
    } catch (e) {
      toast.error(e?.response?.data?.message || 'Failed to download zip', { id: 'library:zip:error' })
    }
  }

  const replaceInputRef = useRef(null)
  const [replaceTarget, setReplaceTarget] = useState(null)

  const [uploadFiles, setUploadFiles] = useState([])
  const uploadInputRef = useRef(null)

  const results = useMemo(() => {
    const q = normalizeQuery(query)

    const scored = (Array.isArray(items) ? items : [])
      .map((item) => {
        const displayName = item.kind === 'folder' ? item.name : (item.title || item.original_name || '')
        const haystack = `${displayName} ${(breadcrumbs || []).map((b) => b.name).join(' / ')}`
        const score = q ? similarityScore(q, haystack) : 1
        return { ...item, _score: score }
      })
      .filter((it) => {
        if (kindFilter !== 'all' && it.kind !== kindFilter) return false
        if (!q) return true
        return it._score >= 0.55
      })

    const dirMul = sortDir === 'asc' ? 1 : -1

    scored.sort((a, b) => {
      if (sortBy === 'name') {
        const an = a.kind === 'folder' ? a.name : (a.title || '')
        const bn = b.kind === 'folder' ? b.name : (b.title || '')
        return an.localeCompare(bn) * dirMul
      }
      if (sortBy === 'updated_at') {
        return String(a.updated_at).localeCompare(String(b.updated_at)) * dirMul
      }

      // default
      return String(b.updated_at).localeCompare(String(a.updated_at)) * dirMul
    })

    return scored
  }, [breadcrumbs, items, kindFilter, query, sortBy, sortDir])

  const isImageFile = (item) => item?.kind === 'file' && ['png', 'jpg', 'jpeg'].includes(String(item.file_type || '').toLowerCase())

  const canUploadToPublicFolder = () => {
    const role = String(user?.role || '')
    return ['supervisor', 'responsable', 'hse_manager', 'regional_hse_manager'].includes(role)
  }

  const canUploadHere = isAdminUser
    ? true
    : (!!currentFolderMeta?.is_public && canUploadToPublicFolder())

  const ensureThumbUrl = async (item) => {
    if (!item?.id || !isImageFile(item)) return null
    if (thumbUrlsById[item.id]) return thumbUrlsById[item.id]
    if (!item.thumbnail_url) return null

    try {
      const existing = thumbAbortRef.current[item.id]
      if (existing) {
        try { existing.abort() } catch {}
      }

      const controller = new AbortController()
      thumbAbortRef.current[item.id] = controller

      const res = await libraryService.fetchThumbnailBlob(item.id, { signal: controller.signal })
      const url = URL.createObjectURL(res.data)

      setThumbUrlsById((prev) => ({ ...prev, [item.id]: url }))
      return url
    } catch {
      return null
    }
  }

  useEffect(() => {
    return () => {
      try {
        Object.values(thumbUrlsById).forEach((u) => {
          try { URL.revokeObjectURL(u) } catch {}
        })
      } catch {}
      try {
        if (viewerUrl) URL.revokeObjectURL(viewerUrl)
      } catch {}
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  useEffect(() => {
    const imgs = results.filter((it) => isImageFile(it) && it.thumbnail_url)
    imgs.slice(0, 18).forEach((it) => {
      if (!thumbUrlsById[it.id]) ensureThumbUrl(it)
    })
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [results])

  const fetchItems = async () => {
    try {
      setLoading(true)
      const res = await libraryService.listItems({
        folder_id: currentFolder?.id ?? undefined,
      })
      const list = res.data?.data?.items
      setCurrentFolderMeta(res.data?.data?.folder ?? null)
      const nextItems = Array.isArray(list) ? list : []
      setItems(nextItems)

      const key = currentFolder?.id ?? 'root'
      try {
        itemsCacheRef.current.set(String(key), nextItems)
      } catch {
      }
    } catch (e) {
      toast.error(e?.response?.data?.message || 'Failed to load')
      setItems([])
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    if (didInitNavFromUrlRef.current) return
    didInitNavFromUrlRef.current = true

    const raw = searchParams.get('folder_stack')
    const stack = decodeFolderStack(raw)
    if (!stack.length) return

    setBreadcrumbs(stack)
    const last = stack[stack.length - 1]
    setCurrentFolder(last ? { id: last.id, name: last.name } : null)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  useEffect(() => {
    if (!didInitNavFromUrlRef.current) return
    const raw = searchParams.get('folder_stack')
    const normalizedRaw = raw ? String(raw) : ''
    if (normalizedRaw && normalizedRaw === lastUrlWriteRef.current) return

    const stack = decodeFolderStack(raw)
    if (!stack.length) {
      setBreadcrumbs([])
      setCurrentFolder(null)
      return
    }

    setBreadcrumbs(stack)
    const last = stack[stack.length - 1]
    setCurrentFolder(last ? { id: last.id, name: last.name } : null)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [searchParams])

  useEffect(() => {
    if (!didInitNavFromUrlRef.current) return

    const next = breadcrumbs.map((b) => ({ id: b.id, name: b.name }))
    const nextRaw = next.length ? encodeFolderStack(next) : ''
    const currentRaw = searchParams.get('folder_stack') || ''
    if (currentRaw === nextRaw) return

    lastUrlWriteRef.current = nextRaw

    const sp = new URLSearchParams(searchParams)
    if (nextRaw) {
      sp.set('folder_stack', nextRaw)
    } else {
      sp.delete('folder_stack')
    }
    const replace = !navPushNextRef.current
    navPushNextRef.current = false
    setSearchParams(sp, { replace })
  }, [breadcrumbs, searchParams.toString(), setSearchParams])

  useEffect(() => {
    const key = currentFolder?.id ?? 'root'
    try {
      const cached = itemsCacheRef.current.get(String(key))
      if (Array.isArray(cached)) {
        setItems(cached)
      }
    } catch {
    }
    fetchItems()
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [currentFolder?.id])

  useEffect(() => {
    const onKeyDown = (e) => {
      const isBackKey = (e.altKey && e.key === 'ArrowLeft') || e.key === 'Backspace'
      if (!isBackKey) return

      const tag = String(e.target?.tagName || '').toLowerCase()
      const isTyping = tag === 'input' || tag === 'textarea' || e.target?.isContentEditable
      if (isTyping) return

      if (!breadcrumbs.length) return

      e.preventDefault()
      goToCrumb(breadcrumbs.length - 2)
    }

    window.addEventListener('keydown', onKeyDown)
    return () => window.removeEventListener('keydown', onKeyDown)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [breadcrumbs])

  const handleDownload = async (item) => {
    if (item?.kind !== 'file') return
    if (!item?.id) return

    try {
      const res = await libraryService.fetchDownloadBlob(item.id)
      const url = URL.createObjectURL(res.data)
      const a = document.createElement('a')
      a.href = url
      a.download = item?.original_name || item?.title || `document-${item.id}`
      document.body.appendChild(a)
      a.click()
      a.remove()
      try { URL.revokeObjectURL(url) } catch {}
    } catch (e) {
      toast.error(e?.response?.data?.message || 'Download failed')
    }
  }

  const handleOpen = (item) => {
    if (item?.kind === 'folder') {
      enterFolder(item)
      return
    }
    if (item?.kind !== 'file') return
    if (!item?.view_url) return

    const type = String(item.file_type || '').toLowerCase()
    const canInline = ['pdf', 'png', 'jpg', 'jpeg', 'txt'].includes(type)
    if (!canInline) {
      handleDownload(item)
      return
    }

    setViewer({ isOpen: true, item })
  }

  const closeViewer = () => {
    try {
      if (viewerUrl) URL.revokeObjectURL(viewerUrl)
    } catch {
      // ignore
    }
    setViewerUrl(null)
    setViewer({ isOpen: false, item: null })
  }

  useEffect(() => {
    const load = async () => {
      if (!viewer?.isOpen || !viewer?.item?.id) return
      try {
        if (viewerUrl) {
          try { URL.revokeObjectURL(viewerUrl) } catch {}
          setViewerUrl(null)
        }
        const res = await libraryService.fetchViewBlob(viewer.item.id)
        const url = URL.createObjectURL(res.data)
        setViewerUrl(url)
      } catch (e) {
        toast.error(e?.response?.data?.message || 'Failed to open')
      }
    }

    load()
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [viewer?.isOpen, viewer?.item?.id])

  useEffect(() => {
    if (!actionsOpenId) return
    const onDocDown = (e) => {
      const root = e.target?.closest?.('[data-actions-root]')
      if (!root) {
        setActionsOpenId(null)
        return
      }
      const rootId = root.getAttribute('data-actions-root')
      if (String(rootId) !== String(actionsOpenId)) {
        setActionsOpenId(null)
      }
    }
    document.addEventListener('mousedown', onDocDown)
    return () => document.removeEventListener('mousedown', onDocDown)
  }, [actionsOpenId])

  const onDelete = async (item) => {
    try {
      await libraryService.deleteDocument(item.id)
      setConfirmDelete({ isOpen: false, item: null })
      await fetchItems()
    } catch (e) {
      toast.error(e?.response?.data?.message || 'Delete failed')
    }
  }

  const openReplace = (item) => {
    setReplaceTarget(item)
    try {
      replaceInputRef.current?.click()
    } catch {}
  }

  const onReplacePicked = async (file) => {
    if (!replaceTarget?.id || !file) return
    try {
      await libraryService.replaceDocument({ id: replaceTarget.id, file })
      setReplaceTarget(null)
      if (replaceInputRef.current) replaceInputRef.current.value = ''
      await fetchItems()
    } catch (e) {
      toast.error(e?.response?.data?.message || 'Update failed')
    }
  }

  const onReindex = async (item) => {
    try {
      await libraryService.reindexDocument(item.id)
      await fetchItems()
    } catch (e) {
      toast.error(e?.response?.data?.message || 'Reindex failed')
    }
  }

  const enterFolder = (folder) => {
    if (!folder || folder.kind !== 'folder') return
    if (String(currentFolder?.id || '') === String(folder.id || '')) return
    navPushNextRef.current = true
    setCurrentFolder({ id: folder.id, name: folder.name })
    setBreadcrumbs((prev) => [...(Array.isArray(prev) ? prev : []), { id: folder.id, name: folder.name }])
  }

  const goToCrumb = (idx) => {
    navPushNextRef.current = true
    if (idx < 0) {
      setBreadcrumbs([])
      setCurrentFolder(null)
      return
    }
    const next = breadcrumbs.slice(0, idx + 1)
    setBreadcrumbs(next)
    const last = next[next.length - 1]
    setCurrentFolder(last ? { id: last.id, name: last.name } : null)
  }

  const createFolder = async () => {
    const name = String(createFolderName || '').trim()
    if (!name) return
    try {
      setCreatingFolder(true)
      await libraryService.createFolder({ name, parentId: currentFolder?.id ?? null })
      setCreateFolderName('')
      setCreateFolderModalOpen(false)
      await fetchItems()
    } catch (e) {
      toast.error(e?.response?.data?.message || 'Failed to create folder')
    } finally {
      setCreatingFolder(false)
    }
  }

  const uploadSelected = async () => {
    if (!uploadFiles.length) return
    try {
      for (const f of uploadFiles) {
        await libraryService.uploadDocument({ file: f, folderId: currentFolder?.id ?? null })
      }
      setUploadFiles([])
      if (uploadInputRef.current) uploadInputRef.current.value = ''
      await fetchItems()
    } catch (e) {
      toast.error(e?.response?.data?.message || 'Upload failed')
    }
  }

  return (
    <div className="space-y-6 animate-fade-in">
      <div className="flex flex-col lg:flex-row lg:items-start lg:justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-gray-900 dark:text-gray-100">{t('library.title')}</h1>
          <p className="text-gray-500 dark:text-gray-400 mt-1">{t('library.subtitle')}</p>
        </div>

        {canUploadHere && (
          <div className="w-full lg:w-[440px]">
            <div className="card p-4 border border-gray-200 dark:border-gray-700 bg-white/80 dark:bg-gray-900/50">
              <div className="flex items-center justify-between gap-3">
                <div className="flex items-center gap-2">
                  <UploadCloud className="w-4 h-4 text-hse-primary" />
                  <div className="text-sm font-semibold text-gray-900 dark:text-gray-100">{t('library.adminUpload')}</div>
                </div>
                <div className="flex items-center gap-2">
                  <button
                    type="button"
                    className="btn-secondary"
                    onClick={() => uploadInputRef.current?.click()}
                  >
                    {t('library.selectFiles')}
                  </button>
                </div>
              </div>

              <input
                ref={uploadInputRef}
                type="file"
                multiple
                className="hidden"
                onChange={(e) => {
                  const list = Array.from(e.target.files || [])
                  setUploadFiles(list)
                }}
                accept=".pdf,.docx,.xlsx,.pptx,.txt,.png,.jpg,.jpeg"
              />

              <div className="mt-3">
                {uploadFiles.length === 0 ? (
                  <div className="text-xs text-gray-500 dark:text-gray-400">
                    {t('library.uploadHint')}
                  </div>
                ) : (
                  <div className="space-y-2">
                    {uploadFiles.slice(0, 4).map((f) => (
                      <div key={f.name} className="flex items-center justify-between gap-3 text-xs rounded-lg px-2 py-1 bg-gray-50 dark:bg-gray-800">
                        <div className="truncate text-gray-700 dark:text-gray-200">{f.name}</div>
                        <div className="text-gray-400">{bytesLabel(f.size)}</div>
                      </div>
                    ))}
                    {uploadFiles.length > 4 && (
                      <div className="text-xs text-gray-500 dark:text-gray-400">
                        +{uploadFiles.length - 4} {t('common.more')}
                      </div>
                    )}

                    <div className="flex items-center justify-end gap-2 pt-2">
                      <button
                        type="button"
                        className="btn-secondary"
                        onClick={() => {
                          setUploadFiles([])
                          if (uploadInputRef.current) uploadInputRef.current.value = ''
                        }}
                      >
                        {t('common.clear')}
                      </button>
                      <button
                        type="button"
                        className="btn-primary"
                        onClick={uploadSelected}
                      >
                        {t('library.upload')}
                      </button>
                    </div>
                  </div>
                )}
              </div>
            </div>
          </div>
        )}
      </div>

      <div className="card p-4">
        <div className="flex flex-col lg:flex-row lg:items-center lg:justify-between gap-3">
          <div className="min-w-0">
            <div className="flex flex-wrap items-center gap-2 text-xs text-gray-500 dark:text-gray-400">
              <button
                type="button"
                className="btn-secondary !px-2 !py-1"
                onClick={() => {
                  if (!breadcrumbs.length) {
                    goToCrumb(-1)
                    return
                  }
                  goToCrumb(breadcrumbs.length - 2)
                }}
                disabled={!breadcrumbs.length}
                aria-label={t('common.back')}
                title={t('common.back')}
              >
                <ChevronLeft className="w-4 h-4" />
                <span className="text-[12px]">{t('common.back')}</span>
              </button>

              <button type="button" className="hover:underline" onClick={() => goToCrumb(-1)}>{t('library.root')}</button>

              {breadcrumbs.map((c, idx) => (
                <span key={c.id} className="inline-flex items-center gap-2">
                  <span className="opacity-60">/</span>
                  <button type="button" className="hover:underline" onClick={() => goToCrumb(idx)}>{c.name}</button>
                </span>
              ))}
            </div>
          </div>

          <div className="flex flex-col sm:flex-row gap-2">
            {currentFolder?.id && (
              <button
                type="button"
                className="btn-secondary"
                onClick={downloadFolderZip}
              >
                <Download className="w-4 h-4" />
                {t('library.downloadZip')}
              </button>
            )}

            {isAdminUser && (
              <button type="button" className="btn-primary" onClick={() => setCreateFolderModalOpen(true)} disabled={creatingFolder}>
                <FolderPlus className="w-4 h-4" />
                {t('library.createFolder')}
              </button>
            )}
          </div>
        </div>
      </div>

      <Modal
        isOpen={createFolderModalOpen}
        onClose={() => {
          if (creatingFolder) return
          setCreateFolderModalOpen(false)
        }}
        title={t('library.createFolder')}
      >
        <div className="space-y-4">
          <div className="flex items-center gap-2 rounded-lg border border-gray-200 dark:border-gray-700 bg-white/70 dark:bg-gray-900/40 px-3 py-2">
            <FolderPlus className="w-4 h-4 text-gray-400" />
            <input
              value={createFolderName}
              onChange={(e) => setCreateFolderName(e.target.value)}
              placeholder={t('library.folderName')}
              className="bg-transparent text-sm text-gray-900 dark:text-gray-100 border-none focus:ring-0 w-full"
              autoFocus
            />
          </div>
          <div className="flex justify-end gap-2">
            <button
              type="button"
              className="btn-secondary"
              onClick={() => setCreateFolderModalOpen(false)}
              disabled={creatingFolder}
            >
              {t('common.cancel')}
            </button>
            <button
              type="button"
              className="btn-primary"
              onClick={createFolder}
              disabled={creatingFolder || !String(createFolderName || '').trim()}
            >
              {t('library.createFolder')}
            </button>
          </div>
        </div>
      </Modal>

      <ConfirmDialog
        isOpen={!!confirmDeleteFolder?.isOpen}
        title={t('common.confirm')}
        message={t('common.confirmDelete')}
        confirmLabel={t('common.delete')}
        cancelLabel={t('common.cancel')}
        variant="danger"
        onCancel={() => setConfirmDeleteFolder({ isOpen: false, item: null })}
        onConfirm={async () => {
          const target = confirmDeleteFolder?.item
          setConfirmDeleteFolder({ isOpen: false, item: null })
          await onDeleteFolder(target)
        }}
      />

      <ConfirmDialog
        isOpen={!!confirmForceDeleteFolder?.isOpen}
        title={t('common.confirm')}
        message={(() => {
          const docs = Number(confirmForceDeleteFolder?.counts?.documents ?? 0)
          const subs = Number(confirmForceDeleteFolder?.counts?.subfolders ?? 0)
          if (Number.isFinite(docs) && Number.isFinite(subs)) {
            return `Folder not empty (${docs} documents, ${subs} subfolders). Delete everything inside?`
          }
          return 'Folder not empty. Delete everything inside?'
        })()}
        confirmLabel={t('common.delete')}
        cancelLabel={t('common.cancel')}
        variant="danger"
        onCancel={() => setConfirmForceDeleteFolder({ isOpen: false, item: null, counts: null })}
        onConfirm={async () => {
          const target = confirmForceDeleteFolder?.item
          setConfirmForceDeleteFolder({ isOpen: false, item: null, counts: null })
          await onForceDeleteFolder(target)
        }}
      />

      <Modal
        isOpen={!!renameFolderModal?.isOpen}
        onClose={() => {
          if (renamingFolder) return
          setRenameFolderModal({ isOpen: false, item: null })
        }}
        title={t('common.update')}
      >
        <div className="space-y-4">
          <div className="flex items-center gap-2 rounded-lg border border-gray-200 dark:border-gray-700 bg-white/70 dark:bg-gray-900/40 px-3 py-2">
            <Folder className="w-4 h-4 text-gray-400" />
            <input
              value={renameFolderName}
              onChange={(e) => setRenameFolderName(e.target.value)}
              className="bg-transparent text-sm text-gray-900 dark:text-gray-100 border-none focus:ring-0 w-full"
              autoFocus
            />
          </div>
          <div className="flex justify-end gap-2">
            <button type="button" className="btn-secondary" onClick={() => setRenameFolderModal({ isOpen: false, item: null })} disabled={renamingFolder}>
              {t('common.cancel')}
            </button>
            <button type="button" className="btn-primary" onClick={onRenameFolder} disabled={renamingFolder || !String(renameFolderName || '').trim()}>
              {t('common.update')}
            </button>
          </div>
        </div>
      </Modal>

      <div className="card p-5 overflow-visible">
        <div className="flex flex-col lg:flex-row lg:items-center gap-3">
          <div className="flex-1">
            <div className="relative">
              <Search className="w-4 h-4 text-gray-400 absolute left-3 top-1/2 -translate-y-1/2" />
              <input
                value={query}
                onChange={(e) => setQuery(e.target.value)}
                placeholder={t('library.searchPlaceholder')}
                className="input pl-10 pr-10"
              />
              {query && (
                <button
                  type="button"
                  onClick={() => setQuery('')}
                  className="absolute right-2 top-1/2 -translate-y-1/2 p-2 rounded hover:bg-gray-100 dark:hover:bg-gray-800"
                  aria-label={t('common.clear')}
                  title={t('common.clear')}
                >
                  <X className="w-4 h-4 text-gray-500" />
                </button>
              )}
            </div>
            <div className="mt-2 text-xs text-gray-500 dark:text-gray-400">
              {t('library.searchHint')}
            </div>
          </div>

          <div className="flex flex-col sm:flex-row gap-2">
            <div className="flex items-center gap-2 rounded-lg border border-gray-200 dark:border-gray-700 bg-white/70 dark:bg-gray-900/40 px-3 py-2">
              <Filter className="w-4 h-4 text-gray-400" />
              <select
                value={kindFilter}
                onChange={(e) => setKindFilter(e.target.value)}
                className="bg-transparent text-sm text-gray-900 dark:text-gray-100 border-none focus:ring-0 [&>option]:bg-white dark:[&>option]:bg-gray-900 [&>option]:text-gray-900 dark:[&>option]:text-gray-100"
              >
                <option value="all">{t('common.all')}</option>
                <option value="folder">{t('library.folders')}</option>
                <option value="file">{t('library.files')}</option>
              </select>
            </div>

            <div className="flex items-center gap-2 rounded-lg border border-gray-200 dark:border-gray-700 bg-white/70 dark:bg-gray-900/40 px-3 py-2">
              {sortDir === 'asc' ? (
                <SortAsc className="w-4 h-4 text-gray-400" />
              ) : (
                <SortDesc className="w-4 h-4 text-gray-400" />
              )}
              <select
                value={sortBy}
                onChange={(e) => setSortBy(e.target.value)}
                className="bg-transparent text-sm text-gray-900 dark:text-gray-100 border-none focus:ring-0 [&>option]:bg-white dark:[&>option]:bg-gray-900 [&>option]:text-gray-900 dark:[&>option]:text-gray-100"
              >
                <option value="updated_at">{t('library.sort.updated')}</option>
                <option value="name">{t('library.sort.name')}</option>
              </select>
              <button
                type="button"
                onClick={() => setSortDir((d) => (d === 'asc' ? 'desc' : 'asc'))}
                className="ml-1 p-1 rounded hover:bg-gray-100 dark:hover:bg-gray-800"
                aria-label={t('library.toggleSort')}
                title={t('library.toggleSort')}
              >
                {sortDir === 'asc' ? (
                  <SortAsc className="w-4 h-4 text-gray-500" />
                ) : (
                  <SortDesc className="w-4 h-4 text-gray-500" />
                )}
              </button>
            </div>
          </div>
        </div>

        <div className="mt-5">
          {results.length === 0 ? (
            <div className="py-10 text-center">
              <div className="inline-flex items-center justify-center w-12 h-12 rounded-full bg-hse-primary/10 mb-3">
                <Search className="w-5 h-5 text-hse-primary" />
              </div>
              <div className="text-sm font-semibold text-gray-900 dark:text-gray-100">{t('library.noResults')}</div>
              <div className="text-xs text-gray-500 dark:text-gray-400 mt-1">{t('library.noResultsHint')}</div>
            </div>
          ) : (
            <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-4">
              {results.map((item) => {
                const Icon = item.kind === 'folder' ? Folder : fileIcon(item.file_type)
                const displayName = item.kind === 'folder' ? item.name : (item.title || item.original_name)
                const isImage = isImageFile(item)
                const thumbUrl = isImage ? thumbUrlsById[item.id] : null
                const actionsKey = `${item.kind}:${item.id}`

                return (
                  <div
                    key={item.id}
                    role="button"
                    tabIndex={0}
                    onClick={() => handleOpen(item)}
                    onKeyDown={(e) => {
                      if (e.key === 'Enter' || e.key === ' ') {
                        e.preventDefault()
                        handleOpen(item)
                      }
                    }}
                    className="group cursor-pointer rounded-2xl border border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-900 p-4 hover:shadow-sm hover:border-gray-300 dark:hover:border-gray-600 transition h-full relative overflow-visible"
                  >
                    <div className="flex flex-col h-full">
                      <div className="flex items-start justify-between gap-3">
                        <div className="flex items-start gap-3 min-w-0">
                        {isImage && item.thumbnail_url ? (
                          <div
                            className="w-14 h-14 rounded-xl overflow-hidden border border-gray-200 dark:border-gray-700 bg-gray-50 dark:bg-gray-800 flex-shrink-0"
                          >
                            {thumbUrl ? (
                              <img src={thumbUrl} alt={displayName} className="w-full h-full object-cover" />
                            ) : (
                              <div className="w-full h-full flex items-center justify-center">
                                <Icon className="w-5 h-5 text-hse-primary" />
                              </div>
                            )}
                          </div>
                        ) : (
                          <div className="w-14 h-14 rounded-xl bg-hse-primary/10 flex items-center justify-center flex-shrink-0">
                            <Icon className="w-5 h-5 text-hse-primary" />
                          </div>
                        )}
                        <div className="min-w-0 pt-0.5">
                          <div className="font-semibold text-gray-900 dark:text-gray-100 leading-snug break-words whitespace-normal pr-2">
                            {displayName}
                          </div>
                          {item.kind === 'file' && item.status && (
                            <div className="mt-2">
                              <span className={`inline-flex items-center rounded-full border px-2.5 py-0.5 text-[11px] font-medium ${statusPillClass(item.status)}`}>
                                {String(item.status)}
                              </span>
                            </div>
                          )}
                        </div>
                      </div>

                      <div
                        className="relative flex items-center gap-2"
                        data-actions-root={actionsKey}
                        onClick={(e) => e.stopPropagation()}
                      >
                        {item.kind === 'file' && (
                          <>
                            <button
                              type="button"
                              className="h-9 w-9 inline-flex items-center justify-center rounded-xl border border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-900 hover:bg-gray-50 dark:hover:bg-gray-800 transition"
                              onClick={() => setActionsOpenId((v) => (v === actionsKey ? null : actionsKey))}
                              aria-label="Actions"
                              title="Actions"
                            >
                              <MoreVertical className="w-4 h-4" />
                            </button>

                            {actionsOpenId === actionsKey && (
                              <div className="absolute right-0 top-10 z-50 w-56 rounded-2xl border border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-900 shadow-lg p-1">
                                <button
                                  type="button"
                                  className="w-full flex items-center gap-2 px-3 py-2 text-sm rounded-lg hover:bg-gray-100 dark:hover:bg-gray-800"
                                  onClick={() => {
                                    setActionsOpenId(null)
                                    handleDownload(item)
                                  }}
                                >
                                  <Download className="w-4 h-4" />
                                  {t('library.download')}
                                </button>

                                {isAdminUser && item.kind === 'file' && (
                                  <>
                                    {String(item.status) === 'processing' && (
                                      <button
                                        type="button"
                                        className="w-full flex items-center gap-2 px-3 py-2 text-sm rounded-lg hover:bg-gray-100 dark:hover:bg-gray-800"
                                        onClick={() => {
                                          setActionsOpenId(null)
                                          onCancelProcessing(item)
                                        }}
                                      >
                                        <X className="w-4 h-4" />
                                        Stop processing
                                      </button>
                                    )}

                                    <button
                                      type="button"
                                      className="w-full flex items-center gap-2 px-3 py-2 text-sm rounded-lg hover:bg-gray-100 dark:hover:bg-gray-800"
                                      onClick={() => {
                                        setActionsOpenId(null)
                                        openReplace(item)
                                      }}
                                    >
                                      <Pencil className="w-4 h-4" />
                                      {t('common.update')}
                                    </button>

                                    {String(item.status) === 'failed' && (
                                      <button
                                        type="button"
                                        className="w-full flex items-center gap-2 px-3 py-2 text-sm rounded-lg hover:bg-gray-100 dark:hover:bg-gray-800"
                                        onClick={() => {
                                          setActionsOpenId(null)
                                          onReindex(item)
                                        }}
                                      >
                                        <RefreshCw className="w-4 h-4" />
                                        {t('common.retry')}
                                      </button>
                                    )}

                                    <button
                                      type="button"
                                      className="w-full flex items-center gap-2 px-3 py-2 text-sm rounded-lg hover:bg-gray-100 dark:hover:bg-gray-800 text-red-600"
                                      onClick={() => {
                                        setActionsOpenId(null)
                                        setConfirmDelete({ isOpen: true, item })
                                      }}
                                    >
                                      <Trash2 className="w-4 h-4" />
                                      {t('common.delete')}
                                    </button>
                                  </>
                                )}
                              </div>
                            )}
                          </>
                        )}

                        {item.kind === 'folder' && isAdminUser && (
                          <>
                            <button
                              type="button"
                              className="h-9 w-9 inline-flex items-center justify-center rounded-xl border border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-900 hover:bg-gray-50 dark:hover:bg-gray-800 transition"
                              onClick={() => setActionsOpenId((v) => (v === actionsKey ? null : actionsKey))}
                              aria-label="Actions"
                              title="Actions"
                            >
                              <MoreVertical className="w-4 h-4" />
                            </button>

                            {actionsOpenId === actionsKey && (
                              <div className="absolute right-0 top-10 z-50 w-56 rounded-2xl border border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-900 shadow-lg p-1">
                                <button
                                  type="button"
                                  className="w-full flex items-center gap-2 px-3 py-2 text-sm rounded-lg hover:bg-gray-100 dark:hover:bg-gray-800"
                                  onClick={() => {
                                    setActionsOpenId(null)
                                    onToggleFolderVisibility(item)
                                  }}
                                >
                                  <span className="text-xs font-semibold">
                                    {item.is_public ? 'Make private' : 'Make public'}
                                  </span>
                                </button>

                                <button
                                  type="button"
                                  className="w-full flex items-center gap-2 px-3 py-2 text-sm rounded-lg hover:bg-gray-100 dark:hover:bg-gray-800"
                                  onClick={() => {
                                    setActionsOpenId(null)
                                    setRenameFolderName(String(item.name || ''))
                                    setRenameFolderModal({ isOpen: true, item })
                                  }}
                                >
                                  <Pencil className="w-4 h-4" />
                                  {t('common.update')}
                                </button>

                                <button
                                  type="button"
                                  className="w-full flex items-center gap-2 px-3 py-2 text-sm rounded-lg hover:bg-gray-100 dark:hover:bg-gray-800 text-red-600"
                                  onClick={() => {
                                    setActionsOpenId(null)
                                    setConfirmDeleteFolder({ isOpen: true, item })
                                  }}
                                >
                                  <Trash2 className="w-4 h-4" />
                                  {t('common.delete')}
                                </button>
                              </div>
                            )}
                          </>
                        )}
                        </div>
                      </div>

                      <div className="mt-4 pt-3 border-t border-gray-100 dark:border-gray-800 flex items-center justify-between text-xs text-gray-500 dark:text-gray-400">
                        <div className="truncate inline-flex items-center gap-2">
                          {item.kind === 'folder'
                            ? (
                              <>
                                <span>{`${item.count ?? 0} ${t('library.items')}`}</span>
                                {item.is_public ? (
                                  <span className="inline-flex items-center rounded-full border border-emerald-200 bg-emerald-50 text-emerald-700 px-2 py-0.5 text-[11px] font-semibold">
                                    Public
                                  </span>
                                ) : null}
                              </>
                            )
                            : `${String(item.file_type || '').toUpperCase()} · ${bytesLabel(item.size_bytes)}`}
                        </div>
                        <div className="flex-shrink-0 pl-3">{String(item.updated_at || '').slice(0, 10)}</div>
                      </div>
                    </div>
                  </div>
                )
              })}
            </div>
          )}
        </div>
      </div>

      <Modal
        isOpen={!!viewer?.isOpen}
        onClose={closeViewer}
        title={viewer?.item?.title || viewer?.item?.original_name || t('library.open')}
        size="lg"
      >
        {viewer?.item ? (
          <div className="space-y-3">
            <div className="flex items-center justify-end gap-2">
              <button type="button" className="btn-secondary" onClick={() => handleDownload(viewer.item)}>
                {t('library.download')}
              </button>
            </div>
            <div className="rounded-xl overflow-hidden border border-gray-200 dark:border-gray-700 bg-gray-50 dark:bg-gray-800">
              {viewerUrl ? (
                ['png', 'jpg', 'jpeg'].includes(String(viewer.item.file_type || '').toLowerCase()) ? (
                  <img src={viewerUrl} alt={viewer.item.title || viewer.item.original_name} className="w-full max-h-[75vh] object-contain" />
                ) : (
                  <iframe title="preview" src={viewerUrl} className="w-full h-[75vh]" />
                )
              ) : (
                <div className="p-6 text-sm text-gray-500">{t('common.loading')}</div>
              )}
            </div>
          </div>
        ) : null}
      </Modal>

      <input
        ref={replaceInputRef}
        type="file"
        className="hidden"
        onChange={(e) => {
          const f = e.target.files?.[0]
          if (f) onReplacePicked(f)
        }}
        accept=".pdf,.docx,.xlsx,.pptx,.txt,.png,.jpg,.jpeg"
      />

      <ConfirmDialog
        isOpen={confirmDelete.isOpen}
        title={t('common.delete')}
        message={confirmDelete?.item ? `${t('common.delete')} "${confirmDelete.item.title || confirmDelete.item.original_name || ''}"?` : ''}
        confirmLabel={t('common.delete')}
        cancelLabel={t('common.cancel')}
        onCancel={() => setConfirmDelete({ isOpen: false, item: null })}
        onConfirm={() => {
          if (confirmDelete.item) onDelete(confirmDelete.item)
        }}
      />
    </div>
  )
}
