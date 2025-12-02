import axios from 'axios'
import toast from 'react-hot-toast'

const API_BASE_URL = import.meta.env.VITE_API_URL || '/api'

const api = axios.create({
  baseURL: API_BASE_URL,
  headers: {
    'Content-Type': 'application/json',
    'Accept': 'application/json',
  },
  timeout: 30000,
})

// Request interceptor
api.interceptors.request.use(
  (config) => {
    // Token is already set in authStore when logging in
    return config
  },
  (error) => {
    return Promise.reject(error)
  },
)

export const trainingService = {
  getAll: (params) => api.get('/trainings', { params }),
  getById: (id) => api.get(`/trainings/${id}`),
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

export const awarenessService = {
  getAll: (params) => api.get('/awareness-sessions', { params }),
  getById: (id) => api.get(`/awareness-sessions/${id}`),
  create: (data) => api.post('/awareness-sessions', data),
  update: (id, data) => api.put(`/awareness-sessions/${id}`, data),
  delete: (id) => api.delete(`/awareness-sessions/${id}`),
}

// Response interceptor
api.interceptors.response.use(
  (response) => response,
  (error) => {
    const { response } = error

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
          toast.error('Server error. Please try again later.')
          break
        default:
          toast.error(response.data?.message || 'An error occurred')
      }
    } else {
      toast.error('Network error. Please check your connection.')
    }

    return Promise.reject(error)
  }
)

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
  getAdminDashboard: (year) => api.get('/dashboard/admin', { params: { year } }),
  getUserDashboard: (year) => api.get('/dashboard/user', { params: { year } }),
  getAccidentCharts: (params) => api.get('/dashboard/charts/accidents', { params }),
  getTrainingCharts: (params) => api.get('/dashboard/charts/trainings', { params }),
  getInspectionCharts: (params) => api.get('/dashboard/charts/inspections', { params }),
  getRateCharts: (params) => api.get('/dashboard/charts/rates', { params }),
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
}

export const projectService = {
  getAll: (params) => api.get('/projects', { params }),
  getById: (id) => api.get(`/projects/${id}`),
  create: (data) => api.post('/projects', data),
  update: (id, data) => api.put(`/projects/${id}`, data),
  delete: (id) => api.delete(`/projects/${id}`),
  getStatistics: () => api.get('/projects/statistics'),
  getKpiTrends: (id, months) => api.get(`/projects/${id}/kpi-trends`, { params: { months } }),
  // Team management
  getTeam: (id) => api.get(`/projects/${id}/team`),
  getAvailableOfficers: (id) => api.get(`/projects/${id}/team/available`),
  addTeamMember: (projectId, userId) => api.post(`/projects/${projectId}/team`, { user_id: userId }),
  addTeamMembers: (projectId, userIds) => api.post(`/projects/${projectId}/team/bulk`, { user_ids: userIds }),
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

export const kpiService = {
  getAll: (params) => api.get('/kpi-reports', { params }),
  getById: (id) => api.get(`/kpi-reports/${id}`),
  create: (data) => api.post('/kpi-reports', data),
  update: (id, data) => api.put(`/kpi-reports/${id}`, data),
  delete: (id) => api.delete(`/kpi-reports/${id}`),
  approve: (id) => api.post(`/kpi-reports/${id}/approve`),
  reject: (id, reason) => api.post(`/kpi-reports/${id}/reject`, { reason }),
}

export const notificationService = {
  getAll: (params) => api.get('/notifications', { params }),
  getUnreadCount: (params) => api.get('/notifications/unread-count', { params }),
  markAsRead: (id) => api.post(`/notifications/${id}/mark-read`),
  markAllAsRead: (params) => api.post('/notifications/mark-all-read', params),
  delete: (id) => api.delete(`/notifications/${id}`),
  deleteRead: () => api.post('/notifications/delete-read'),
  send: (data) => api.post('/notifications/send', data),
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
}

export const sorService = {
  getAll: (params) => api.get('/sor-reports', { params }),
  getById: (id) => api.get(`/sor-reports/${id}`),
  getPinned: () => api.get('/sor-reports/pinned'),
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
  downloadTemplate: (params) => api.get('/daily-kpi/download-template', { params, responseType: 'blob' }),
  parseTemplate: (formData) => api.post('/daily-kpi/parse-template', formData, {
    headers: { 'Content-Type': 'multipart/form-data' }
  }),
  bulkSave: (data) => api.post('/daily-kpi/bulk-save', data),
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

export const workerService = {
  getAll: (params) => api.get('/workers', { params }),
  getById: (id) => api.get(`/workers/${id}`),
  create: (data) => api.post('/workers', data),
  update: (id, data) => api.put(`/workers/${id}`, data),
  delete: (id) => api.delete(`/workers/${id}`),
  getStatistics: () => api.get('/workers/statistics'),
  getEntreprises: () => api.get('/workers/entreprises'),
  downloadTemplate: () => api.get('/workers/template', { responseType: 'blob' }),
  export: (params) => api.get('/workers/export', { params, responseType: 'blob' }),
  import: (formData) => api.post('/workers/import', formData, {
    headers: { 'Content-Type': 'multipart/form-data' }
  }),
  bulkDeactivate: (workerIds) => api.post('/workers/bulk-deactivate', { worker_ids: workerIds }),
  bulkActivate: (workerIds) => api.post('/workers/bulk-activate', { worker_ids: workerIds }),
}
