import { create } from 'zustand'
import { persist } from 'zustand/middleware'
import api from '../services/api'
import { invalidateCache } from '../utils/apiCache'
import { clearApiCache } from '../services/api'

export const useAuthStore = create(
  persist(
    (set, get) => ({
      user: null,
      token: null,
      isAuthenticated: false,
      isLoading: false,

      login: async (email, password) => {
        set({ isLoading: true })
        try {
          invalidateCache()
          clearApiCache()
          const response = await api.post('/auth/login', { email, password })
          const { user, token } = response.data.data

          set({
            user,
            token,
            isAuthenticated: true,
            isLoading: false,
          })

          // Set token in API defaults
          api.defaults.headers.common['Authorization'] = `Bearer ${token}`

          return { success: true, user }
        } catch (error) {
          set({ isLoading: false })
          throw error
        }
      },

      logout: async () => {
        try {
          await api.post('/auth/logout')
        } catch (error) {
          console.error('Logout error:', error)
        } finally {
          invalidateCache()
          clearApiCache()
          set({
            user: null,
            token: null,
            isAuthenticated: false,
          })
          delete api.defaults.headers.common['Authorization']
        }
      },

      fetchUser: async () => {
        const { token } = get()
        if (!token) return

        try {
          api.defaults.headers.common['Authorization'] = `Bearer ${token}`
          const response = await api.get('/auth/me')
          set({ user: response.data.data, isAuthenticated: true })
        } catch (error) {
          // Token expired or invalid
          set({
            user: null,
            token: null,
            isAuthenticated: false,
          })
          delete api.defaults.headers.common['Authorization']
        }
      },

      updateProfile: async (data) => {
        const response = await api.put('/auth/profile', data)
        set({ user: response.data.data })
        return response.data
      },

      changePassword: async (currentPassword, newPassword, confirmPassword) => {
        const response = await api.post('/auth/change-password', {
          current_password: currentPassword,
          password: newPassword,
          password_confirmation: confirmPassword,
        })
        const { user } = get()
        if (user) {
          set({ user: { ...user, must_change_password: false } })
        }
        return response.data
      },

      isAdmin: () => {
        const { user } = get()
        return user?.role === 'admin'
      },

      // Initialize auth state on app load
      initializeAuth: () => {
        const { token, fetchUser } = get()
        if (token) {
          api.defaults.headers.common['Authorization'] = `Bearer ${token}`
          fetchUser()
        }
      },
    }),
    {
      name: 'hse-auth-storage',
      partialize: (state) => ({
        user: state.user,
        token: state.token,
        isAuthenticated: state.isAuthenticated,
      }),
      onRehydrateStorage: () => (state) => {
        // Called after storage is rehydrated
        if (state?.token) {
          api.defaults.headers.common['Authorization'] = `Bearer ${state.token}`
          state.fetchUser()
        }
      },
    }
  )
)
