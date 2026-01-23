const STORAGE_KEY = 'bug_report_recorder_v1'

const MAX_ENTRIES = 200
const MAX_STRING_LENGTH = 2000
const MAX_DURATION_MS = 10 * 60 * 1000

const REDACT_KEYS = [
  'password',
  'pass',
  'pwd',
  'token',
  'access_token',
  'refresh_token',
  'authorization',
  'auth',
  'secret',
  'api_key',
  'apikey',
  'cookie',
  'cookies',
  'set-cookie',
]

const nowIso = () => new Date().toISOString()

const safeToString = (value) => {
  try {
    if (value instanceof Error) return value.stack || value.message || String(value)
    if (typeof value === 'string') return value
    return JSON.stringify(value)
  } catch {
    try {
      return String(value)
    } catch {
      return '[unserializable]'
    }
  }
}

const isPlainObject = (v) => {
  if (!v || typeof v !== 'object') return false
  if (Array.isArray(v)) return false
  return Object.getPrototypeOf(v) === Object.prototype
}

const shouldRedactKey = (key) => {
  if (!key) return false
  const k = String(key).toLowerCase()
  return REDACT_KEYS.some((needle) => k === needle || k.includes(needle))
}

const truncateString = (str) => {
  const s = String(str)
  if (s.length <= MAX_STRING_LENGTH) return s
  return s.slice(0, MAX_STRING_LENGTH) + '…'
}

const sanitizeValue = (value, depth = 0) => {
  try {
    if (depth > 6) return '[MAX_DEPTH]'

    if (value === null || value === undefined) return null
    if (typeof value === 'string') return truncateString(value)
    if (typeof value === 'number' || typeof value === 'boolean') return value

    if (value instanceof Date) return value.toISOString()
    if (value instanceof Error) return truncateString(value.stack || value.message || String(value))

    if (typeof FormData !== 'undefined' && value instanceof FormData) {
      return '[FormData]'
    }

    if (typeof Blob !== 'undefined' && value instanceof Blob) {
      return `[Blob size=${value.size}]`
    }

    if (typeof ArrayBuffer !== 'undefined' && value instanceof ArrayBuffer) {
      return `[ArrayBuffer byteLength=${value.byteLength}]`
    }

    if (Array.isArray(value)) {
      const arr = value.slice(0, 200).map((v) => sanitizeValue(v, depth + 1))
      if (value.length > 200) arr.push('[TRUNCATED_ARRAY]')
      return arr
    }

    if (isPlainObject(value) || typeof value === 'object') {
      const obj = isPlainObject(value) ? value : { ...value }
      const keys = Object.keys(obj)
      const out = {}
      for (const k of keys.slice(0, 200)) {
        if (shouldRedactKey(k)) {
          out[k] = '[REDACTED]'
          continue
        }
        out[k] = sanitizeValue(obj[k], depth + 1)
      }
      if (keys.length > 200) out.__truncated__ = true
      return out
    }

    return truncateString(safeToString(value))
  } catch {
    return '[SANITIZE_ERROR]'
  }
}

const pushRing = (arr, entry) => {
  const next = Array.isArray(arr) ? arr.slice() : []
  next.push(entry)
  if (next.length > MAX_ENTRIES) {
    return next.slice(next.length - MAX_ENTRIES)
  }
  return next
}

const defaultState = () => ({
  isRecording: false,
  startedAt: null,
  endedAt: null,
  durationSeconds: null,
  comment: null,
  consoleLogs: [],
  networkLogs: [],
  routeLogs: [],
  metadata: {},
  uploads: [],
})

let state = defaultState()
let persistTimer = null
let consoleInstalled = false

// Keep actual File objects out of persisted state.
let latestUploadedFile = null

const originalConsole = {
  warn: console.warn,
  error: console.error,
}

const schedulePersist = () => {
  if (typeof window === 'undefined') return
  if (persistTimer) return
  persistTimer = window.setTimeout(() => {
    persistTimer = null
    persist()
  }, 300)
}

const persist = () => {
  try {
    if (typeof window === 'undefined') return
    window.sessionStorage.setItem(STORAGE_KEY, JSON.stringify(state))
  } catch {
    // ignore
  }
}

const load = () => {
  try {
    if (typeof window === 'undefined') return null
    const raw = window.sessionStorage.getItem(STORAGE_KEY)
    if (!raw) return null
    const parsed = JSON.parse(raw)
    return parsed && typeof parsed === 'object' ? parsed : null
  } catch {
    return null
  }
}

const clearStorage = () => {
  try {
    if (typeof window === 'undefined') return
    window.sessionStorage.removeItem(STORAGE_KEY)
  } catch {
    // ignore
  }
}

const buildBrowserMetadata = () => {
  try {
    const nav = typeof navigator !== 'undefined' ? navigator : null
    const conn = nav && nav.connection ? nav.connection : null

    return sanitizeValue({
      userAgent: nav ? nav.userAgent : null,
      locale: nav ? nav.language : null,
      screen: typeof window !== 'undefined' ? { width: window.screen?.width, height: window.screen?.height } : null,
      connection: conn
        ? {
            effectiveType: conn.effectiveType,
            downlink: conn.downlink,
            rtt: conn.rtt,
            saveData: conn.saveData,
          }
        : null,
      timeZone: (() => {
        try {
          return Intl.DateTimeFormat().resolvedOptions().timeZone
        } catch {
          return null
        }
      })(),
    })
  } catch {
    return {}
  }
}

const shouldCaptureUrl = (url) => {
  const u = String(url || '')
  if (!u) return false
  if (u.includes('/bug-reports')) return false
  return true
}

const captureConsole = (level, args) => {
  if (!state.isRecording) return
  const entry = {
    ts: nowIso(),
    level,
    message: truncateString(args.map((a) => safeToString(a)).join(' ')),
    args: sanitizeValue(args),
  }
  state.consoleLogs = pushRing(state.consoleLogs, entry)
  schedulePersist()
}

const installConsoleHooks = () => {
  if (consoleInstalled) return
  consoleInstalled = true

  console.warn = (...args) => {
    captureConsole('warn', args)
    originalConsole.warn(...args)
  }

  console.error = (...args) => {
    captureConsole('error', args)
    originalConsole.error(...args)
  }
}

const uninstallConsoleHooks = () => {
  if (!consoleInstalled) return
  console.warn = originalConsole.warn
  console.error = originalConsole.error
  consoleInstalled = false
}

const init = () => {
  const loaded = load()
  if (!loaded) return

  state = {
    ...defaultState(),
    ...loaded,
    consoleLogs: Array.isArray(loaded.consoleLogs) ? loaded.consoleLogs : [],
    networkLogs: Array.isArray(loaded.networkLogs) ? loaded.networkLogs : [],
    routeLogs: Array.isArray(loaded.routeLogs) ? loaded.routeLogs : [],
    metadata: loaded.metadata && typeof loaded.metadata === 'object' ? loaded.metadata : {},
    uploads: Array.isArray(loaded.uploads) ? loaded.uploads : [],
  }

  if (state.isRecording && state.startedAt) {
    const started = new Date(state.startedAt).getTime()
    if (Number.isFinite(started) && Date.now() - started > MAX_DURATION_MS) {
      // auto-stop after 10 minutes
      stop()
      return
    }
    installConsoleHooks()
  }
}

const start = ({ comment, user } = {}) => {
  state = defaultState()
  latestUploadedFile = null
  state.isRecording = true
  state.startedAt = nowIso()
  state.comment = truncateString(comment || '')

  state.metadata = sanitizeValue({
    browser: buildBrowserMetadata(),
    user: user
      ? {
          id: user.id ?? null,
          name: user.name ?? null,
          role: user.role ?? null,
        }
      : null,
  })

  installConsoleHooks()
  persist()
}

const stop = () => {
  if (!state.isRecording) return

  state.isRecording = false
  state.endedAt = nowIso()

  try {
    const started = state.startedAt ? new Date(state.startedAt).getTime() : null
    const ended = state.endedAt ? new Date(state.endedAt).getTime() : null
    if (started && ended) {
      state.durationSeconds = Math.max(0, Math.min(600, Math.round((ended - started) / 1000)))
    }
  } catch {
    // ignore
  }

  uninstallConsoleHooks()
  persist()
}

const clear = () => {
  state = defaultState()
  latestUploadedFile = null
  uninstallConsoleHooks()
  clearStorage()
}

const isRecording = () => !!state.isRecording

const trackRoute = (route) => {
  if (!state.isRecording) return
  const entry = {
    ts: nowIso(),
    route: sanitizeValue(route),
  }
  state.routeLogs = pushRing(state.routeLogs, entry)
  schedulePersist()
}

const recordNetwork = (entry) => {
  if (!state.isRecording) return
  state.networkLogs = pushRing(state.networkLogs, sanitizeValue(entry))
  schedulePersist()
}

let axiosInterceptorsInstalled = false

const captureUploadedFilesFromConfig = (cfg, method, url) => {
  try {
    if (!state.isRecording) return
    const data = cfg?.data
    if (!data) return
    if (typeof FormData === 'undefined') return
    if (!(data instanceof FormData)) return

    const uploads = []
    for (const [field, value] of data.entries()) {
      // File inherits from Blob, so check File first.
      if (typeof File !== 'undefined' && value instanceof File) {
        uploads.push({ field, file: value })
        continue
      }
      // Ignore non-File blobs by default.
    }

    if (uploads.length === 0) return

    // Keep the last uploaded file (backend supports one attachment).
    latestUploadedFile = uploads[uploads.length - 1].file

    const uploadMeta = uploads.map((u) => ({
      ts: nowIso(),
      field: u.field,
      name: u.file?.name ?? null,
      size: u.file?.size ?? null,
      type: u.file?.type ?? null,
      method,
      url,
    }))

    state.uploads = pushRing(state.uploads, uploadMeta.length === 1 ? uploadMeta[0] : uploadMeta)

    // Also include metadata snapshot (helps later troubleshooting)
    state.metadata = sanitizeValue({
      ...(state.metadata || {}),
      uploads: state.uploads,
    })

    schedulePersist()
  } catch {
    // ignore
  }
}

const installAxiosInterceptors = (axiosInstance, { isSensitiveUrl } = {}) => {
  if (!axiosInstance || axiosInterceptorsInstalled) return
  axiosInterceptorsInstalled = true

  axiosInstance.interceptors.request.use(
    (cfg) => {
      try {
        const url = cfg?.url
        const method = (cfg?.method || 'get').toUpperCase()
        if (!shouldCaptureUrl(url)) return cfg
        if (typeof isSensitiveUrl === 'function' && isSensitiveUrl(url)) return cfg
        captureUploadedFilesFromConfig(cfg, method, url)
      } catch {
        // ignore
      }
      return cfg
    },
    (error) => Promise.reject(error)
  )

  axiosInstance.interceptors.response.use(
    (response) => {
      try {
        const cfg = response?.config
        const url = cfg?.url
        const method = (cfg?.method || 'get').toUpperCase()

        if (!shouldCaptureUrl(url)) return response
        if (typeof isSensitiveUrl === 'function' && isSensitiveUrl(url)) return response

        const meta = cfg?.metadata || {}
        const startTime = meta.startTime
        const durationMs = typeof startTime === 'number' ? Date.now() - startTime : null

        const contentType = response?.headers?.['content-type'] || response?.headers?.['Content-Type']
        const data = response?.data

        recordNetwork({
          ts: nowIso(),
          kind: 'response',
          requestId: meta.requestId || null,
          method,
          url,
          status: response?.status,
          durationMs,
          contentType,
          request: {
            params: cfg?.params,
            data: cfg?.data,
          },
          response: {
            data,
          },
        })
      } catch {
        // ignore
      }
      return response
    },
    (error) => {
      try {
        const cfg = error?.config
        const url = cfg?.url
        const method = (cfg?.method || 'get').toUpperCase()

        if (!shouldCaptureUrl(url)) return Promise.reject(error)
        if (typeof isSensitiveUrl === 'function' && isSensitiveUrl(url)) return Promise.reject(error)

        const meta = cfg?.metadata || {}
        const startTime = meta.startTime
        const durationMs = typeof startTime === 'number' ? Date.now() - startTime : null

        const status = error?.response?.status
        const contentType = error?.response?.headers?.['content-type'] || error?.response?.headers?.['Content-Type']

        recordNetwork({
          ts: nowIso(),
          kind: 'error',
          requestId: meta.requestId || null,
          method,
          url,
          status,
          durationMs,
          contentType,
          message: truncateString(error?.message || 'Request failed'),
          request: {
            params: cfg?.params,
            data: cfg?.data,
          },
          response: {
            data: error?.response?.data,
          },
        })
      } catch {
        // ignore
      }
      return Promise.reject(error)
    },
  )
}

const getDraft = () => ({
  comment: state.comment,
  started_at: state.startedAt,
  ended_at: state.endedAt,
  duration_seconds: state.durationSeconds,
  console_logs: state.consoleLogs,
  network_logs: state.networkLogs,
  route_logs: state.routeLogs,
  metadata: sanitizeValue({
    ...(state.metadata || {}),
    uploads: state.uploads,
  }),
})

const getLatestUploadedFile = () => latestUploadedFile

const clearLatestUploadedFile = () => {
  latestUploadedFile = null
  state.uploads = []
  state.metadata = sanitizeValue({
    ...(state.metadata || {}),
    uploads: state.uploads,
  })
  schedulePersist()
}

const bugReportRecorder = {
  init,
  start,
  stop,
  clear,
  isRecording,
  trackRoute,
  getDraft,
  getLatestUploadedFile,
  clearLatestUploadedFile,
  installAxiosInterceptors,
}

export default bugReportRecorder
