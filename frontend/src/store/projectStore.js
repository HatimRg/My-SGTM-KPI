import { create } from 'zustand'
import { projectService } from '../services/api'
import { useDevStore, DEV_PROJECT_SCOPE } from './devStore'
import { useAuthStore } from './authStore'

export const useProjectStore = create((set, get) => ({
  projects: [],
  isLoading: false,
  hasLoaded: false,
  error: null,
  lastScope: null,

  // Fetch and cache projects list. By default, loads up to 100 projects.
  fetchProjects: async (params, options = {}) => {
    const { isLoading, hasLoaded, projects } = get()

    const authUser = useAuthStore.getState?.()?.user
    const isDev = authUser?.role === 'dev'
    const scope = isDev ? useDevStore.getState?.()?.projectScope : null
    const normalizedScope = isDev && scope === DEV_PROJECT_SCOPE.ASSIGNED ? DEV_PROJECT_SCOPE.ASSIGNED : DEV_PROJECT_SCOPE.ALL

    const { lastScope } = get()
    const scopeChanged = isDev && lastScope && lastScope !== normalizedScope

    if (!options.force && !scopeChanged && hasLoaded && projects.length > 0) {
      return projects
    }
    if (isLoading) {
      return projects
    }

    const effectiveParams = { ...(params || {}) }

    if (isDev) {
      if (normalizedScope === DEV_PROJECT_SCOPE.ASSIGNED) {
        effectiveParams.scope = 'assigned'
      }
      set({ lastScope: normalizedScope })
    }

    set({ isLoading: true, error: null })
    try {
      if (Object.prototype.hasOwnProperty.call(effectiveParams, 'page')) {
        const res = await projectService.getAll(effectiveParams)
        const data = res.data?.data ?? []
        set({ projects: data, isLoading: false, hasLoaded: true })
        return data
      }

      const list = await projectService.getAllList(effectiveParams)
      set({ projects: list, isLoading: false, hasLoaded: true })
      return list
    } catch (error) {
      console.error('Failed to load projects:', error)
      set({ error, isLoading: false })
      throw error
    }
  },

  setProjects: (projects) => set({ projects }),

  reset: () => set({ projects: [], hasLoaded: false, error: null, lastScope: null }),
}))
