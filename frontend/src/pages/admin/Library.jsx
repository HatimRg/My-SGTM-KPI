import { useMemo, useRef, useState } from 'react'
import { useLanguage } from '../../i18n'
import { useAuthStore } from '../../store/authStore'
import toast from 'react-hot-toast'
import {
  Download,
  FileText,
  FileSpreadsheet,
  File,
  Folder,
  Search,
  UploadCloud,
  X,
  Filter,
  SortAsc,
  SortDesc,
} from 'lucide-react'

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

const MOCK_ITEMS = [
  {
    id: 'folder-sst',
    kind: 'folder',
    name: 'SST / Sécurité',
    path: ['Library'],
    updated_at: '2026-02-10',
    count: 18,
  },
  {
    id: 'folder-procedures',
    kind: 'folder',
    name: 'Procédures',
    path: ['Library'],
    updated_at: '2026-02-08',
    count: 42,
  },
  {
    id: 'file-epi-guide',
    kind: 'file',
    name: 'Guide EPI - Distribution et traçabilité',
    ext: 'pdf',
    size: 2_180_000,
    path: ['Library', 'SST / Sécurité'],
    updated_at: '2026-02-07',
    url: '#',
  },
  {
    id: 'file-toolbox',
    kind: 'file',
    name: 'Toolbox Meeting - Checklist',
    ext: 'docx',
    size: 410_000,
    path: ['Library', 'SST / Sécurité'],
    updated_at: '2026-01-29',
    url: '#',
  },
  {
    id: 'file-training-matrix',
    kind: 'file',
    name: 'Matrice des formations (modèle)',
    ext: 'xlsx',
    size: 188_000,
    path: ['Library', 'Procédures'],
    updated_at: '2026-01-11',
    url: '#',
  },
]

export default function Library() {
  const { t } = useLanguage()
  const { user, isAdmin } = useAuthStore()

  const isAdminUser = isAdmin?.() || user?.role === 'dev'

  const [query, setQuery] = useState('')
  const [kindFilter, setKindFilter] = useState('all') // all | file | folder
  const [sortBy, setSortBy] = useState('relevance') // relevance | name | updated_at
  const [sortDir, setSortDir] = useState('desc') // asc | desc

  const [uploadFiles, setUploadFiles] = useState([])
  const uploadInputRef = useRef(null)

  const results = useMemo(() => {
    const q = normalizeQuery(query)

    const scored = MOCK_ITEMS
      .map((item) => {
        const haystack = `${item.name} ${(item.path || []).join(' / ')}`
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
        return a.name.localeCompare(b.name) * dirMul
      }
      if (sortBy === 'updated_at') {
        return String(a.updated_at).localeCompare(String(b.updated_at)) * dirMul
      }

      // relevance
      if (b._score !== a._score) return (b._score - a._score) * dirMul
      return String(b.updated_at).localeCompare(String(a.updated_at))
    })

    return scored
  }, [query, kindFilter, sortBy, sortDir])

  const handleDownload = (item) => {
    if (item.kind !== 'file') return

    if (!item.url || item.url === '#') {
      toast(t('common.comingSoon'))
      return
    }

    window.open(item.url, '_blank', 'noopener,noreferrer')
  }

  return (
    <div className="space-y-6 animate-fade-in">
      <div className="flex flex-col lg:flex-row lg:items-start lg:justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-gray-900 dark:text-gray-100">{t('library.title')}</h1>
          <p className="text-gray-500 dark:text-gray-400 mt-1">{t('library.subtitle')}</p>
        </div>

        {isAdminUser && (
          <div className="w-full lg:w-[420px]">
            <div className="card p-4 border border-gray-200 dark:border-gray-700 bg-white/70 dark:bg-gray-900/40">
              <div className="flex items-center justify-between gap-3">
                <div className="flex items-center gap-2">
                  <UploadCloud className="w-4 h-4 text-hse-primary" />
                  <div className="text-sm font-semibold text-gray-900 dark:text-gray-100">{t('library.adminUpload')}</div>
                </div>
                <button
                  type="button"
                  className="btn-secondary"
                  onClick={() => uploadInputRef.current?.click()}
                >
                  {t('library.selectFiles')}
                </button>
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
                accept=".pdf,.doc,.docx,.xls,.xlsx,.csv"
              />

              <div className="mt-3">
                {uploadFiles.length === 0 ? (
                  <div className="text-xs text-gray-500 dark:text-gray-400">
                    {t('library.uploadHint')}
                  </div>
                ) : (
                  <div className="space-y-2">
                    {uploadFiles.slice(0, 4).map((f) => (
                      <div key={f.name} className="flex items-center justify-between gap-3 text-xs">
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
                        onClick={() => toast(t('common.comingSoon'))}
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

      <div className="card p-5">
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
                className="bg-transparent text-sm text-gray-900 dark:text-gray-100 border-none focus:ring-0"
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
                className="bg-transparent text-sm text-gray-900 dark:text-gray-100 border-none focus:ring-0"
              >
                <option value="relevance">{t('library.sort.relevance')}</option>
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
            <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-3">
              {results.map((item) => {
                const Icon = item.kind === 'folder' ? Folder : fileIcon(item.ext)

                return (
                  <div
                    key={item.id}
                    className="rounded-xl border border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-900 p-4 hover:shadow-md transition-shadow"
                  >
                    <div className="flex items-start justify-between gap-3">
                      <div className="flex items-start gap-3 min-w-0">
                        <div className="w-10 h-10 rounded-lg bg-hse-primary/10 flex items-center justify-center flex-shrink-0">
                          <Icon className="w-5 h-5 text-hse-primary" />
                        </div>
                        <div className="min-w-0">
                          <div className="font-semibold text-gray-900 dark:text-gray-100 truncate">
                            {item.name}
                          </div>
                          <div className="text-xs text-gray-500 dark:text-gray-400 mt-1 truncate">
                            {(item.path || []).join(' / ')}
                          </div>
                        </div>
                      </div>

                      {item.kind === 'file' && (
                        <button
                          type="button"
                          className="btn-secondary"
                          onClick={() => handleDownload(item)}
                        >
                          <Download className="w-4 h-4" />
                        </button>
                      )}
                    </div>

                    <div className="mt-3 flex items-center justify-between text-xs text-gray-500 dark:text-gray-400">
                      <div>
                        {item.kind === 'folder'
                          ? `${item.count ?? 0} ${t('library.items')}`
                          : `${String(item.ext || '').toUpperCase()} · ${bytesLabel(item.size)}`}
                      </div>
                      <div>{item.updated_at}</div>
                    </div>

                    {item.kind === 'file' && (
                      <div className="mt-3">
                        <button
                          type="button"
                          onClick={() => handleDownload(item)}
                          className="w-full btn-primary flex items-center justify-center gap-2"
                        >
                          <Download className="w-4 h-4" />
                          {t('library.download')}
                        </button>
                      </div>
                    )}
                  </div>
                )
              })}
            </div>
          )}
        </div>
      </div>
    </div>
  )
}
