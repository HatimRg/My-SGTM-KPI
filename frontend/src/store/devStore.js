import { create } from 'zustand'
import { persist } from 'zustand/middleware'

export const DEV_PROJECT_SCOPE = {
  ALL: 'all',
  ASSIGNED: 'assigned',
}

const DEFAULT_SIMULATED_ROLE = 'hse_manager'

export const useDevStore = create(
  persist(
    (set, get) => ({
      simulatedRole: null,
      projectScope: DEV_PROJECT_SCOPE.ALL,

      setSimulatedRole: (role) => set({ simulatedRole: role || null }),
      clearSimulatedRole: () => set({ simulatedRole: null }),

      setProjectScope: (scope) => {
        const next = scope === DEV_PROJECT_SCOPE.ASSIGNED ? DEV_PROJECT_SCOPE.ASSIGNED : DEV_PROJECT_SCOPE.ALL
        set({ projectScope: next })
      },

      resetDevTools: () => set({ simulatedRole: DEFAULT_SIMULATED_ROLE, projectScope: DEV_PROJECT_SCOPE.ALL }),
    }),
    {
      name: 'hse-dev-tools',
      partialize: (state) => ({
        simulatedRole: state.simulatedRole,
        projectScope: state.projectScope,
      }),
    },
  ),
)
