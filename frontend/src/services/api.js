import axios from 'axios'
import toast from 'react-hot-toast'
import bugReportRecorder from '../utils/bugReportRecorder'

const API_BASE_URL = '/api'

const MASS_IMPORT_TIMEOUT = 10 * 60 * 1000

// Simple in-memory cache for GET requests
const requestCache = new Map()
const CACHE_TTL = 30000 // 30 seconds
const pendingRequests = new Map()

const getUiLang = () => {
  try {
    const raw = localStorage.getItem('hse-kpi-language')
    const normalized = String(raw || '').trim().split(/[-_]/)[0]
    return normalized === 'en' ? 'en' : 'fr'
  } catch {
    return 'fr'
  }
}

// Cache helper functions
const getCacheKey = (url, params) => {
  return `${url}:${JSON.stringify(params || {})}`
}

const getFromCache = (key, ttl) => {
  const cached = requestCache.get(key)
  const effectiveTtl = ttl ?? cached?.ttl ?? CACHE_TTL
  if (cached && Date.now() - cached.timestamp < effectiveTtl) {
    return cached.data
  }
  requestCache.delete(key)
  return null
}

const setCache = (key, data, ttl) => {
  requestCache.set(key, { data, ttl, timestamp: Date.now() })
  // Limit cache size
  if (requestCache.size > 100) {
    const firstKey = requestCache.keys().next().value
    requestCache.delete(firstKey)
  }
}

// Clear cache on mutations
export const clearApiCache = () => {
  requestCache.clear()
}

const api = axios.create({
  baseURL: API_BASE_URL,
  headers: {
    'Content-Type': 'application/json',
    'Accept': 'application/json',
  },
  timeout: 30000,
})

const makeRequestId = () => {
  try {
    if (typeof crypto !== 'undefined' && typeof crypto.randomUUID === 'function') {
      return crypto.randomUUID()
    }
  } catch {
    // ignore
  }
  return `${Date.now()}-${Math.random().toString(16).slice(2)}`
}

const isSensitiveUrl = (url) => {
  const u = String(url || '')
  return (
    u.includes('/auth/login') ||
    u.includes('/auth/reset-password') ||
    u.includes('/auth/forgot-password') ||
    u.includes('/auth/change-password')
  )
}

// Request interceptor with deduplication
api.interceptors.request.use(
  (config) => {
    // Add request timestamp for performance tracking
    config.metadata = { startTime: Date.now(), requestId: makeRequestId() }
    return config
  },
  (error) => {
    return Promise.reject(error)
  },
)

bugReportRecorder.installAxiosInterceptors(api, { isSensitiveUrl })

export const trainingService = {
  getAll: (params) => api.get('/trainings', { params }),
  getById: (id) => api.get(`/trainings/${id}`),
  getPhoto: (id) => api.get(`/trainings/${id}/photo`, { responseType: 'blob' }),
  create: (data) => {
    const formData = new FormData()
    Object.keys(data).forEach((key) => {
      const value = data[key]
      if (value !== null && value !== undefined && value !== '') {
        if (typeof value === 'boolean') {
          formData.append(key, value ? '1' : '0')
        } else {
          formData.append(key, value)
        }
      }
    })
    return api.post('/trainings', formData, {
      headers: { 'Content-Type': 'multipart/form-data' },
    })
  },
  update: (id, data) => {
    const formData = new FormData()
    formData.append('_method', 'PUT')
    Object.keys(data).forEach(key => {
      const value = data[key]
      if (value !== null && value !== undefined && value !== '') {
        formData.append(key, value)
      }
    })
    return api.post(`/trainings/${id}`, formData, {
      headers: { 'Content-Type': 'multipart/form-data' }
    })
  },
  delete: (id) => api.delete(`/trainings/${id}`),
}

export const workerTrainingService = {
  getAll: (params) => api.get('/worker-trainings', { params }),
  getOtherLabels: (params) => api.get('/worker-trainings/other-labels', { params }),
  downloadMassTemplate: () => api.get('/worker-trainings/mass/template', { params: { lang: getUiLang() }, responseType: 'blob' }),
  massImport: ({ excel, zip, progressId }) => {
    const formData = new FormData()
    if (excel) formData.append('excel', excel)
    if (zip) formData.append('zip', zip)
    if (progressId) formData.append('progress_id', progressId)
    return api.post('/worker-trainings/mass/import', formData, {
      headers: { 'Content-Type': 'multipart/form-data' },
      timeout: MASS_IMPORT_TIMEOUT,
      maxBodyLength: Infinity,
      maxContentLength: Infinity,
    })
  },
  getById: (id) => api.get(`/worker-trainings/${id}`),
  create: (data) => {
    const formData = new FormData()
    Object.keys(data).forEach((key) => {
      const value = data[key]
      if (value !== null && value !== undefined && value !== '') {
        formData.append(key, value)
      }
    })
    return api.post('/worker-trainings', formData, {
      headers: { 'Content-Type': 'multipart/form-data' },
    })
  },
  update: (id, data) => {
    const formData = new FormData()
    formData.append('_method', 'PUT')
    Object.keys(data).forEach((key) => {
      const value = data[key]
      if (value !== null && value !== undefined && value !== '') {
        formData.append(key, value)
      }
    })
    return api.post(`/worker-trainings/${id}`, formData, {
      headers: { 'Content-Type': 'multipart/form-data' },
    })
  },
  delete: (id) => api.delete(`/worker-trainings/${id}`),
}

export const workerQualificationService = {
  getAll: (params) => api.get('/worker-qualifications', { params }),
  downloadMassTemplate: () => api.get('/worker-qualifications/mass/template', { params: { lang: getUiLang() }, responseType: 'blob' }),
  massImport: ({ excel, zip, progressId }) => {
    const formData = new FormData()
    if (excel) formData.append('excel', excel)
    if (zip) formData.append('zip', zip)
    if (progressId) formData.append('progress_id', progressId)
    return api.post('/worker-qualifications/mass/import', formData, {
      headers: { 'Content-Type': 'multipart/form-data' },
      timeout: MASS_IMPORT_TIMEOUT,
      maxBodyLength: Infinity,
      maxContentLength: Infinity,
    })
  },
  getById: (id) => api.get(`/worker-qualifications/${id}`),
  create: (data) => {
    const formData = new FormData()
    Object.keys(data).forEach((key) => {
      const value = data[key]
      if (value !== null && value !== undefined && value !== '') {
        formData.append(key, value)
      }
    })
    return api.post('/worker-qualifications', formData, {
      headers: { 'Content-Type': 'multipart/form-data' },
    })
  },
  update: (id, data) => {
    const formData = new FormData()
    formData.append('_method', 'PUT')
    Object.keys(data).forEach((key) => {
      const value = data[key]
      if (value !== null && value !== undefined && value !== '') {
        formData.append(key, value)
      }
    })
    return api.post(`/worker-qualifications/${id}`, formData, {
      headers: { 'Content-Type': 'multipart/form-data' },
    })
  },
  delete: (id) => api.delete(`/worker-qualifications/${id}`),
}

export const workerMedicalAptitudeService = {
  getAll: (params) => api.get('/worker-medical-aptitudes', { params }),
  downloadMassTemplate: () => api.get('/worker-medical-aptitudes/mass/template', { params: { lang: getUiLang() }, responseType: 'blob' }),
  massImport: ({ excel, zip, progressId }) => {
    const formData = new FormData()
    if (excel) formData.append('excel', excel)
    if (zip) formData.append('zip', zip)
    if (progressId) formData.append('progress_id', progressId)
    return api.post('/worker-medical-aptitudes/mass/import', formData, {
      headers: { 'Content-Type': 'multipart/form-data' },
      timeout: MASS_IMPORT_TIMEOUT,
      maxBodyLength: Infinity,
      maxContentLength: Infinity,
    })
  },
  getById: (id) => api.get(`/worker-medical-aptitudes/${id}`),
  create: (data) => {
    const formData = new FormData()
    Object.keys(data).forEach((key) => {
      const value = data[key]
      if (value !== null && value !== undefined && value !== '') {
        if (key === 'able_to' && Array.isArray(value)) {
          value.forEach((v) => {
            if (v !== null && v !== undefined && String(v).trim() !== '') {
              formData.append('able_to[]', v)
            }
          })
          return
        }
        formData.append(key, value)
      }
    })
    return api.post('/worker-medical-aptitudes', formData, {
      headers: { 'Content-Type': 'multipart/form-data' },
    })
  },
  update: (id, data) => {
    const formData = new FormData()
    formData.append('_method', 'PUT')
    Object.keys(data).forEach((key) => {
      const value = data[key]
      if (value !== null && value !== undefined && value !== '') {
        if (key === 'able_to' && Array.isArray(value)) {
          value.forEach((v) => {
            if (v !== null && v !== undefined && String(v).trim() !== '') {
              formData.append('able_to[]', v)
            }
          })
          return
        }
        formData.append(key, value)
      }
    })
    return api.post(`/worker-medical-aptitudes/${id}`, formData, {
      headers: { 'Content-Type': 'multipart/form-data' },
    })
  },
  delete: (id) => api.delete(`/worker-medical-aptitudes/${id}`),
}

export const workerSanctionService = {
  getAll: (params) => api.get('/worker-sanctions', { params }),
  downloadMassTemplate: () => api.get('/worker-sanctions/mass/template', { params: { lang: getUiLang() }, responseType: 'blob' }),
  massImport: ({ excel, zip, progressId }) => {
    const formData = new FormData()
    if (excel) formData.append('excel', excel)
    if (zip) formData.append('zip', zip)
    if (progressId) formData.append('progress_id', progressId)
    return api.post('/worker-sanctions/mass/import', formData, {
      headers: { 'Content-Type': 'multipart/form-data' },
      timeout: MASS_IMPORT_TIMEOUT,
      maxBodyLength: Infinity,
      maxContentLength: Infinity,
    })
  },
  getById: (id) => api.get(`/worker-sanctions/${id}`),
  create: (data) => {
    const formData = new FormData()
    Object.keys(data).forEach((key) => {
      const value = data[key]
      if (value !== null && value !== undefined && value !== '') {
        formData.append(key, value)
      }
    })
    return api.post('/worker-sanctions', formData, {
      headers: { 'Content-Type': 'multipart/form-data' },
    })
  },
  delete: (id) => api.delete(`/worker-sanctions/${id}`),
}

export const awarenessService = {
  getAll: (params) => api.get('/awareness-sessions', { params }),
  getById: (id) => api.get(`/awareness-sessions/${id}`),
  downloadTemplate: () => api.get('/awareness-sessions/template', { params: { lang: getUiLang() }, responseType: 'blob' }),
  bulkImport: (formData) => api.post('/awareness-sessions/import', formData, {
    headers: { 'Content-Type': 'multipart/form-data' },
    timeout: MASS_IMPORT_TIMEOUT,
    maxBodyLength: Infinity,
    maxContentLength: Infinity,
  }),
  create: (data) => api.post('/awareness-sessions', data),
  update: (id, data) => api.put(`/awareness-sessions/${id}`, data),
  delete: (id) => api.delete(`/awareness-sessions/${id}`),
}

// Response interceptor
api.interceptors.response.use(
  (response) => {
    // Log slow requests in development
    if (response.config.metadata) {
      const duration = Date.now() - response.config.metadata.startTime
      const isDev = (typeof import.meta !== 'undefined' && import.meta.env && import.meta.env.DEV) || process.env.NODE_ENV !== 'production'
      if (isDev && duration > 2000) {
        console.warn(`Slow API request: ${response.config.url} took ${duration}ms`)
      }
    }
    return response
  },
  (error) => {
    const isCanceled =
      axios.isCancel?.(error) ||
      error?.code === 'ERR_CANCELED' ||
      error?.name === 'CanceledError' ||
      error?.name === 'AbortError'

    if (isCanceled) {
      return Promise.reject(error)
    }

    const { response, config } = error

    if (config?.silent) {
      return Promise.reject(error)
    }

    try {
      const method = String(config?.method || 'GET').toUpperCase()
      const url = String(config?.url || '')
      const requestId = config?.metadata?.requestId
      const status = response?.status

      const requestDetails = {
        requestId,
        method,
        url,
        params: config?.params,
      }

      if (!isSensitiveUrl(url)) {
        requestDetails.data = config?.data
      }

      const responseDetails = response
        ? {
            status: response.status,
            statusText: response.statusText,
            data: response.data,
          }
        : null

      console.groupCollapsed(`[API] ${method} ${url} -> ${status ?? 'NO_RESPONSE'}`)
      console.log('request', requestDetails)
      if (responseDetails) console.log('response', responseDetails)
      console.error(error)
      console.groupEnd()
    } catch (e) {
      console.error('[API] Failed to log error', e)
    }

    if (response) {
      switch (response.status) {
        case 401:
          // Unauthorized - redirect to login
          localStorage.removeItem('hse-auth-storage')
          window.location.href = '/login'
          break
        case 403:
          toast.error('Access denied. You do not have permission to perform this action.')
          break
        case 404:
          toast.error('Resource not found.')
          break
        case 422:
          // Validation errors - handle in component
          break
        case 500:
          console.error('Server error:', response.data)
          toast.error('Server error. Please try again later.')
          break
        case 502:
        case 503:
        case 504:
          toast.error('Server is temporarily unavailable. Please try again.')
          break
        default:
          toast.error(response.data?.message || 'An error occurred')
      }
    } else if (error.code === 'ECONNABORTED') {
      toast.error('Request timed out. Please try again.')
    } else {
      toast.error('Network error. Please check your connection.')
    }

    return Promise.reject(error)
  }
)

// Cached GET helper - deduplicates and caches requests
export const cachedGet = async (url, params = {}, ttl = CACHE_TTL) => {
  const cacheKey = getCacheKey(url, params)
  
  // Check cache first
  const cached = getFromCache(cacheKey, ttl)
  if (cached) {
    return { data: cached, fromCache: true }
  }
  
  // Check if request is already pending (deduplication)
  if (pendingRequests.has(cacheKey)) {
    return pendingRequests.get(cacheKey)
  }
  
  // Make the request
  const promise = api.get(url, { params }).then(response => {
    setCache(cacheKey, response.data, ttl)
    pendingRequests.delete(cacheKey)
    return response
  }).catch(error => {
    pendingRequests.delete(cacheKey)
    throw error
  })
  
  pendingRequests.set(cacheKey, promise)
  return promise
}

export default api

// API Service functions
export const authService = {
  login: (email, password) => api.post('/auth/login', { email, password }),
  logout: () => api.post('/auth/logout'),
  me: () => api.get('/auth/me'),
  forgotPassword: (email) => api.post('/auth/forgot-password', { email }),
  resetPassword: (data) => api.post('/auth/reset-password', data),
  updateProfile: (data) => api.put('/auth/profile', data),
  changePassword: (data) => api.post('/auth/change-password', data),
}

export const dashboardService = {
  // Dashboard data is cached since it's expensive to compute and doesn't change often
  getAdminDashboard: (params) => cachedGet('/dashboard/admin', params),
  getUserDashboard: (params) => {
    const normalized = typeof params === 'number' ? { year: params } : (params || {})
    return cachedGet('/dashboard/user', normalized)
  },
  getSafetyPerformance: (params) => cachedGet('/dashboard/safety-performance', params),
  getEnvironmentalMonthly: (params) => cachedGet('/dashboard/environmental-monthly', params),
  getMonthlyReportSummary: (params) => cachedGet('/admin/reports/monthly/summary', params, 60000),
  // Charts are also cached
  getAccidentCharts: (params) => cachedGet('/dashboard/charts/accidents', params),
  getTrainingCharts: (params) => cachedGet('/dashboard/charts/trainings', params),
  getInspectionCharts: (params) => cachedGet('/dashboard/charts/inspections', params),
  getSorCharts: (params) => cachedGet('/dashboard/charts/sor', params),
  getRateCharts: (params) => cachedGet('/dashboard/charts/rates', params),

  // SOR analytics (descriptive, per-graph endpoints)
  getSorAnalyticsKpis: (params) => cachedGet('/dashboard/sor-analytics/kpis', params),
  getSorProjectPoleStacked: (params) => cachedGet('/dashboard/sor-analytics/project-pole-stacked', params),
  getSorProjectTreemap: (params) => cachedGet('/dashboard/sor-analytics/project-treemap', params),
  getSorProjectPoleHeatmap: (params) => cachedGet('/dashboard/sor-analytics/project-pole-heatmap', params),
  getSorThemeAvgResolution: (params) => cachedGet('/dashboard/sor-analytics/theme-avg-resolution', params),
  getSorThemeResolutionBox: (params) => cachedGet('/dashboard/sor-analytics/theme-resolution-box', params),
  getSorThemeUnresolvedCount: (params) => cachedGet('/dashboard/sor-analytics/theme-unresolved-count', params),
  getSorThemeResolvedUnresolved: (params) => cachedGet('/dashboard/sor-analytics/theme-resolved-unresolved', params),
  getSorThemeBubble: (params) => cachedGet('/dashboard/sor-analytics/theme-bubble', params),
  getSorUserThemeAvgResolution: (params) => cachedGet('/dashboard/sor-analytics/user-theme-avg-resolution', params),
  getSorPoleThemeUnresolvedRate: (params) => cachedGet('/dashboard/sor-analytics/pole-theme-unresolved-rate', params),

  // PPE analytics
  getPpeConsumptionAnalytics: (params) => cachedGet('/dashboard/ppe-analytics/consumption', params),
}

export const userService = {
  getAll: (params) => api.get('/users', { params }),
  getById: (id) => api.get(`/users/${id}`),
  create: (data) => api.post('/users', data),
  update: (id, data) => api.put(`/users/${id}`, data),
  delete: (id) => api.delete(`/users/${id}`),
  toggleStatus: (id) => api.post(`/users/${id}/toggle-status`),
  assignProjects: (id, projectIds) => api.post(`/users/${id}/assign-projects`, { project_ids: projectIds }),
  getStatistics: () => api.get('/users/statistics'),
  downloadTemplate: () => api.get('/users/template', { params: { lang: getUiLang() }, responseType: 'blob' }),
  bulkImport: (formData) => api.post('/users/import', formData, {
    headers: { 'Content-Type': 'multipart/form-data' }
  }),
}

export const projectService = {
  getAll: (params) => api.get('/projects', { params }),
  getAllList: async (params = {}) => {
    const perPage = params.per_page ?? 200
    const baseParams = { ...(params || {}) }
    delete baseParams.page
    delete baseParams.per_page

    const listCacheKey = getCacheKey('/projects/allList', { ...baseParams, per_page: perPage })
    const cached = getFromCache(listCacheKey, 60000)
    if (cached) {
      return cached
    }

    if (pendingRequests.has(listCacheKey)) {
      return pendingRequests.get(listCacheKey)
    }

    const promise = (async () => {
      let page = 1
      const all = []

      let hasMore = true
      while (hasMore) {
        const res = await cachedGet('/projects', { ...baseParams, page, per_page: perPage }, 60000)
        const items = res.data?.data ?? []
        if (Array.isArray(items)) {
          all.push(...items)
        }

        const meta = res.data?.meta
        hasMore = !!meta && page < meta.last_page
        if (hasMore) page += 1
      }

      setCache(listCacheKey, all, 60000)
      pendingRequests.delete(listCacheKey)
      return all
    })().catch((error) => {
      pendingRequests.delete(listCacheKey)
      throw error
    })

    pendingRequests.set(listCacheKey, promise)
    return promise
  },
  getById: (id) => api.get(`/projects/${id}`),
  create: (data) => api.post('/projects', data),
  update: (id, data) => api.put(`/projects/${id}`, data),
  delete: (id) => api.delete(`/projects/${id}`),
  getStatistics: () => api.get('/projects/statistics'),
  getKpiTrends: (id, months) => api.get(`/projects/${id}/kpi-trends`, { params: { months } }),
  getPoles: (params) => cachedGet('/projects/poles', params ?? {}, 300000),
  downloadTemplate: () => api.get('/projects/template', { params: { lang: getUiLang() }, responseType: 'blob' }),
  managementExport: (params) => api.get('/projects/management-export', { params: { ...params, lang: getUiLang() }, responseType: 'blob' }),
  bulkImport: (formData) => api.post('/projects/import', formData, {
    headers: { 'Content-Type': 'multipart/form-data' }
  }),
  // Team management
  getTeam: (id) => api.get(`/projects/${id}/team`),
  getAvailableOfficers: (id) => api.get(`/projects/${id}/team/available`),
  addTeamMember: (projectId, userId) => api.post(`/projects/${projectId}/team`, { user_id: userId }),
  addTeamMembers: (projectId, userIds) => api.post(`/projects/${projectId}/team/bulk`, { user_ids: userIds }),
  downloadTeamTemplate: (projectId) => api.get(`/projects/${projectId}/team/template`, { params: { lang: getUiLang() }, responseType: 'blob' }),
  importTeam: (projectId, formData) => api.post(`/projects/${projectId}/team/import`, formData, {
    headers: { 'Content-Type': 'multipart/form-data' }
  }),
  removeTeamMember: (projectId, userId) => api.delete(`/projects/${projectId}/team/${userId}`),
  // User management (by Responsable)
  getMembers: (projectId) => api.get(`/projects/${projectId}/members`),
  createMember: (projectId, data) => api.post(`/projects/${projectId}/members/create`, data),
  updateMember: (projectId, userId, data) => api.put(`/projects/${projectId}/members/${userId}`, data),
  removeMember: (projectId, userId) => api.delete(`/projects/${projectId}/members/${userId}`),
  // Zones management
  getZones: (projectId) => api.get(`/projects/${projectId}/zones`),
  updateZones: (projectId, zones) => api.put(`/projects/${projectId}/zones`, { zones }),
  addZone: (projectId, zone) => api.post(`/projects/${projectId}/zones/add`, { zone }),
  removeZone: (projectId, zone) => api.post(`/projects/${projectId}/zones/remove`, { zone }),
}

export const heavyMachineryService = {
  getDocumentKeys: () => api.get('/heavy-machinery/document-keys'),
  getMachineTypes: () => api.get('/heavy-machinery/machine-types', { params: { lang: getUiLang(), format: 'options' } }),
  downloadMachinesTemplate: () => api.get('/heavy-machinery/machines/template', { params: { lang: getUiLang() }, responseType: 'blob' }),
  importMachines: (formData) => api.post('/heavy-machinery/machines/import', formData, {
    headers: { 'Content-Type': 'multipart/form-data' }
  }),

  getMachines: (params) => api.get('/heavy-machinery/machines', { params }),
  getMachine: (id) => api.get(`/heavy-machinery/machines/${id}`),
  createMachine: (formData) => api.post('/heavy-machinery/machines', formData, {
    headers: { 'Content-Type': 'multipart/form-data' }
  }),
  updateMachine: (id, data) => api.put(`/heavy-machinery/machines/${id}`, data),
  deleteMachine: (id) => api.delete(`/heavy-machinery/machines/${id}`),

  transferMachine: (id, projectId) => api.post(`/heavy-machinery/machines/${id}/transfer`, { project_id: projectId }),
  uploadMachineImage: (id, formData) => api.post(`/heavy-machinery/machines/${id}/image`, formData, {
    headers: { 'Content-Type': 'multipart/form-data' }
  }),

  upsertDocument: (machineId, formData) => api.post(`/heavy-machinery/machines/${machineId}/documents`, formData, {
    headers: { 'Content-Type': 'multipart/form-data' }
  }),
  updateDocument: (machineId, documentId, formData) => {
    if (formData instanceof FormData) {
      formData.append('_method', 'PUT')
    }
    return api.post(
      `/heavy-machinery/machines/${machineId}/documents/${documentId}`,
      formData,
      { headers: { 'Content-Type': 'multipart/form-data' } },
    )
  },
  deleteDocument: (machineId, documentId) => api.delete(`/heavy-machinery/machines/${machineId}/documents/${documentId}`),

  upsertInspection: (machineId, formData) => api.post(`/heavy-machinery/machines/${machineId}/inspections`, formData, {
    headers: { 'Content-Type': 'multipart/form-data' }
  }),
  deleteInspection: (machineId, inspectionId) => api.delete(`/heavy-machinery/machines/${machineId}/inspections/${inspectionId}`),

  searchWorkers: (params) => api.get('/heavy-machinery/workers/search', { params }),
  addOperator: (machineId, workerId) => api.post(`/heavy-machinery/machines/${machineId}/operators`, { worker_id: workerId }),
  removeOperator: (machineId, workerId) => api.delete(`/heavy-machinery/machines/${machineId}/operators/${workerId}`),

  globalSearch: (query) => api.get('/heavy-machinery/global-search', { params: { query } }),
  expiredDocumentation: (params) => api.get('/heavy-machinery/reports/expired-documentation', { params }),
}

export const kpiService = {
  getAll: (params) => api.get('/kpi-reports', { params }),
  getById: (id) => api.get(`/kpi-reports/${id}`),
  create: (data) => api.post('/kpi-reports', data),
  update: (id, data) => api.put(`/kpi-reports/${id}`, data),
  delete: (id) => api.delete(`/kpi-reports/${id}`),
  approve: (id) => api.post(`/kpi-reports/${id}/approve`),
  reject: (id, reason) => api.post(`/kpi-reports/${id}/reject`, { reason }),
  getAutoPopulatedData: (params) => api.get('/kpi-reports/auto-populate', { params }),
}

export const notificationService = {
  getAll: (params) => api.get('/notifications', { params }),
  getUnreadCount: (params) => cachedGet('/notifications/unread-count', params ?? {}, 15000),
  urgentUnread: (params) => api.get('/notifications/urgent/unread', { params }),
  markAsRead: (id) => api.post(`/notifications/${id}/mark-read`),
  markAllAsRead: (params) => api.post('/notifications/mark-all-read', params),
  delete: (id) => api.delete(`/notifications/${id}`),
  deleteRead: () => api.post('/notifications/delete-read'),
  send: (data) => api.post('/notifications/send', data),
  urgentSend: (data) => api.post('/notifications/urgent/send', data),
}

export const bugReportService = {
  submit: (data) => {
    const formData = new FormData()
    Object.keys(data).forEach((key) => {
      const value = data[key]
      if (value === null || value === undefined || value === '') return
      if (key === 'attachment') {
        if (value) formData.append('attachment', value)
        return
      }

      if (key === 'console_logs' || key === 'network_logs' || key === 'route_logs' || key === 'metadata') {
        formData.append(key, typeof value === 'string' ? value : JSON.stringify(value))
        return
      }

      formData.append(key, value)
    })

    return api.post('/bug-reports', formData, {
      headers: { 'Content-Type': 'multipart/form-data' },
    })
  },
  list: (params) => api.get('/bug-reports', { params }),
  getById: (id) => api.get(`/bug-reports/${id}`),
  downloadAttachment: (id) => api.get(`/bug-reports/${id}/attachment`, { responseType: 'blob' }),
}

export const exportService = {
  exportExcel: (params) => api.get('/export/excel', { params, responseType: 'blob' }),
  exportPdf: (params) => api.get('/export/pdf', { params, responseType: 'blob' }),
  exportProjectReport: (projectId, params) => api.get(`/export/project/${projectId}`, { params, responseType: 'blob' }),
  exportInspections: (params) => api.get('/inspections/export', { params, responseType: 'blob' }),
  exportDeviations: (params) => api.get('/sor-reports/export', { params, responseType: 'blob' }),
  exportAwareness: (params) => api.get('/awareness-sessions/export', { params, responseType: 'blob' }),
  exportTrainings: (params) => api.get('/trainings/export', { params, responseType: 'blob' }),
  exportKpiHistory: (params) => api.get('/kpi-reports/export', { params, responseType: 'blob' }),
  exportHseWeekly: (params) => api.get('/export/hse-weekly', { params, responseType: 'blob' }),
}

export const sorService = {
  getAll: (params) => api.get('/sor-reports', { params }),
  getById: (id) => api.get(`/sor-reports/${id}`),
  getPinned: () => api.get('/sor-reports/pinned'),
  downloadTemplate: () => api.get('/sor-reports/template', { params: { lang: getUiLang() }, responseType: 'blob' }),
  bulkImport: (formData) => api.post('/sor-reports/import', formData, {
    headers: { 'Content-Type': 'multipart/form-data' },
    timeout: MASS_IMPORT_TIMEOUT,
    maxBodyLength: Infinity,
    maxContentLength: Infinity,
  }),
  create: (data) => {
    const formData = new FormData()
    Object.keys(data).forEach(key => {
      const value = data[key]
      if (value !== null && value !== undefined && value !== '') {
        // Convert booleans to "1"/"0" for Laravel validation
        if (typeof value === 'boolean') {
          formData.append(key, value ? '1' : '0')
        } else {
          formData.append(key, value)
        }
      }
    })
    return api.post('/sor-reports', formData, {
      headers: { 'Content-Type': 'multipart/form-data' }
    })
  },
  update: (id, data) => {
    const formData = new FormData()
    formData.append('_method', 'PUT')
    Object.keys(data).forEach(key => {
      const value = data[key]
      if (value !== null && value !== undefined && value !== '') {
        formData.append(key, value)
      }
    })
    return api.post(`/sor-reports/${id}`, formData, {
      headers: { 'Content-Type': 'multipart/form-data' }
    })
  },
  submitCorrectiveAction: (id, data) => {
    const formData = new FormData()
    Object.keys(data).forEach(key => {
      if (data[key] !== null && data[key] !== undefined && data[key] !== '') {
        formData.append(key, data[key])
      }
    })
    return api.post(`/sor-reports/${id}/corrective-action`, formData, {
      headers: { 'Content-Type': 'multipart/form-data' }
    })
  },
  delete: (id) => api.delete(`/sor-reports/${id}`),
  getCategories: () => api.get('/sor-reports/categories'),
  getStatistics: (params) => api.get('/sor-reports/statistics', { params }),
}

export const workPermitService = {
  getAll: (params) => api.get('/work-permits', { params }),
  getById: (id) => api.get(`/work-permits/${id}`),
  create: (data) => api.post('/work-permits', data),
  update: (id, data) => api.put(`/work-permits/${id}`, data),
  delete: (id) => api.delete(`/work-permits/${id}`),
  restore: (id) => api.post(`/work-permits/${id}/restore`),
  getWeekInfo: (params) => api.get('/work-permits/week-info', { params }),
  getWeekPermits: (params) => api.get('/work-permits/week-permits', { params }),
  copyFromPrevious: (data) => api.post('/work-permits/copy-from-previous', data),
  reinitializeNumbers: (data) => api.post('/work-permits/reinitialize-numbers', data),
  launchWeek: (data) => api.post('/work-permits/launch-week', data),
  export: (params) => api.get('/work-permits/export', { params, responseType: 'blob' }),
  // Archive queries
  getArchived: (params) => api.get('/work-permits', { params: { ...params, only_archived: true } }),
}

export const dailyKpiService = {
  getAll: (params) => api.get('/daily-kpi', { params }),
  getById: (id) => api.get(`/daily-kpi/${id}`),
  create: (data) => api.post('/daily-kpi', data),
  update: (id, data) => api.put(`/daily-kpi/${id}`, data),
  delete: (id) => api.delete(`/daily-kpi/${id}`),
  getWeekDates: (params) => api.get('/daily-kpi/week-dates', { params }),
  getWeekAggregates: (params) => api.get('/daily-kpi/week-aggregates', { params }),
  getAutoFillValues: (params) => api.get('/daily-kpi/auto-fill', { params }),
  downloadTemplate: (params) => api.get('/daily-kpi/download-template', { params: { ...params, lang: getUiLang() }, responseType: 'blob' }),
  parseTemplate: (formData) => api.post('/daily-kpi/parse-template', formData, {
    headers: { 'Content-Type': 'multipart/form-data' }
  }),
  bulkSave: (data) => api.post('/daily-kpi/bulk-save', data),
}

export const monthlyKpiMeasurementService = {
  getAll: (params) => api.get('/monthly-kpi-measurements', { params }),
  getById: (id) => api.get(`/monthly-kpi-measurements/${id}`),
  upsert: (data) => api.post('/monthly-kpi-measurements', data),
  update: (id, data) => api.put(`/monthly-kpi-measurements/${id}`, data),
  delete: (id) => api.delete(`/monthly-kpi-measurements/${id}`),
}

export const hseEventService = {
  getAll: (params) => api.get('/hse-events', { params }),
  getById: (id) => api.get(`/hse-events/${id}`),
  create: (data) => api.post('/hse-events', data),
  update: (id, data) => api.put(`/hse-events/${id}`, data),
  delete: (id) => api.delete(`/hse-events/${id}`),
  listAttachments: (id) => api.get(`/hse-events/${id}/attachments`),
  uploadAttachment: (id, data) => {
    const formData = new FormData()
    Object.keys(data).forEach((key) => {
      const value = data[key]
      if (value !== null && value !== undefined && value !== '') {
        formData.append(key, value)
      }
    })
    return api.post(`/hse-events/${id}/attachments`, formData, {
      headers: { 'Content-Type': 'multipart/form-data' },
    })
  },
  deleteAttachment: (id, attachmentId) => api.delete(`/hse-events/${id}/attachments/${attachmentId}`),
}

export const lightingMeasurementService = {
  getAll: (params) => api.get('/lighting-measurements', { params }),
  getById: (id) => api.get(`/lighting-measurements/${id}`),
  create: (data) => api.post('/lighting-measurements', data),
  update: (id, data) => api.put(`/lighting-measurements/${id}`, data),
  delete: (id) => api.delete(`/lighting-measurements/${id}`),
}

export const wasteExportService = {
  getAll: (params) => api.get('/waste-exports', { params }),
  create: (data) => api.post('/waste-exports', data),
  update: (id, data) => api.put(`/waste-exports/${id}`, data),
  delete: (id) => api.delete(`/waste-exports/${id}`),
}

export const backupService = {
  getSettings: () => api.get('/admin/backup/settings'),
  updateSettings: (data) => api.put('/admin/backup/settings', data),
  downloadLatest: () => api.get('/admin/backup/download', { responseType: 'blob' }),
}

export const dailyEffectifService = {
  upsert: (data) => api.post('/daily-effectif', data),
  entry: (params) => api.get('/daily-effectif/entry', { params }),
  list: (params) => api.get('/daily-effectif/list', { params }),
  series: (params) => api.get('/daily-effectif/series', { params }),
  history: (params) => api.get('/daily-effectif/history', { params }),
  byProject: (params) => api.get('/daily-effectif/by-project', { params }),
}

export const inspectionService = {
  getAll: (params) => api.get('/inspections', { params }),
  getById: (id) => api.get(`/inspections/${id}`),
  create: (data) => api.post('/inspections', data),
  update: (id, data) => api.put(`/inspections/${id}`, data),
  delete: (id) => api.delete(`/inspections/${id}`),
  getStatistics: (params) => api.get('/inspections/statistics', { params }),
  getWeekCount: (params) => api.get('/inspections/week-count', { params }),
}

export const regulatoryWatchService = {
  getAll: (params) => api.get('/regulatory-watch', { params }),
  getLatest: (params) => api.get('/regulatory-watch/latest', { params }),
  getById: (id) => api.get(`/regulatory-watch/${id}`),
  submit: (data) => api.post('/regulatory-watch', data),
  delete: (id) => api.delete(`/regulatory-watch/${id}`),
}

export const workerService = {
  getAll: (params, config = {}) => api.get('/workers', { ...config, params }),
  getById: (id, config = {}) => api.get(`/workers/${id}`, { ...config }),
  create: (data, config = {}) => api.post('/workers', data, config),
  update: (id, data, config = {}) => api.put(`/workers/${id}`, data, config),
  delete: (id, config = {}) => api.delete(`/workers/${id}`, { ...config }),
  getStatistics: (params, config = {}) => api.get('/workers/statistics', { ...config, params }),
  getEntreprises: () => cachedGet('/workers/entreprises', {}, 300000),
  getFonctions: () => cachedGet('/workers/fonctions', {}, 300000),
  downloadTemplate: () => api.get('/workers/template', { params: { lang: getUiLang() }, responseType: 'blob' }),
  export: (params) => api.get('/workers/export', { params, responseType: 'blob' }),
  import: (formData) => api.post('/workers/import', formData, {
    headers: { 'Content-Type': 'multipart/form-data' }
  }),
  bulkDeactivate: (workerIds) => api.post('/workers/bulk-deactivate', { worker_ids: workerIds }),
  bulkActivate: (workerIds) => api.post('/workers/bulk-activate', { worker_ids: workerIds }),
}

export const ppeService = {
  getItems: (params) => api.get('/ppe/items', { params }),
  upsertItem: (data) => api.post('/ppe/items', data),
  deleteItem: (id) => api.delete(`/ppe/items/${id}`),

  downloadMassTemplate: () => api.get('/ppe/mass/template', { params: { lang: getUiLang() }, responseType: 'blob' }),
  massImport: ({ excel }) => {
    const formData = new FormData()
    if (excel) formData.append('excel', excel)
    return api.post('/ppe/mass/import', formData, {
      headers: { 'Content-Type': 'multipart/form-data' },
      timeout: MASS_IMPORT_TIMEOUT,
      maxBodyLength: Infinity,
      maxContentLength: Infinity,
    })
  },

  restock: (data) => api.post('/ppe/restock', data),

  issueToWorker: (data) => api.post('/ppe/issue', data),
  getIssues: (params) => api.get('/ppe/issues', { params }),
  getWorkerIssues: (workerId) => api.get(`/ppe/workers/${workerId}/issues`),
}

export const subcontractorOpeningsService = {
  getAll: (params) => api.get('/subcontractor-openings', { params }),
  getById: (id) => api.get(`/subcontractor-openings/${id}`),
  create: (data) => api.post('/subcontractor-openings', data),
  update: (id, data) => api.put(`/subcontractor-openings/${id}`, data),
  delete: (id) => api.delete(`/subcontractor-openings/${id}`),
  uploadDocument: (openingId, data) => {
    const formData = new FormData()
    Object.keys(data).forEach((key) => {
      const value = data[key]
      if (value !== null && value !== undefined && value !== '') {
        formData.append(key, value)
      }
    })
    return api.post(`/subcontractor-openings/${openingId}/documents`, formData, {
      headers: { 'Content-Type': 'multipart/form-data' },
    })
  },
}
