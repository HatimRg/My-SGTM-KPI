import { create } from 'zustand'
import { projectService } from '../services/api'

export const useProjectStore = create((set, get) => ({
  projects: [],
  isLoading: false,
  hasLoaded: false,
  error: null,

  // Fetch and cache projects list. By default, loads up to 100 projects.
  fetchProjects: async (params) => {
    const { isLoading, hasLoaded, projects } = get()
    if (hasLoaded && projects.length > 0) {
      return projects
    }
    if (isLoading) {
      return projects
    }

    const effectiveParams = params || {}

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

  reset: () => set({ projects: [], hasLoaded: false, error: null }),
}))
