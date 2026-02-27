/**
 * Module Store — Zustand store for client-side module activation state.
 *
 * Holds the list of active module IDs for the current company and
 * provides selectors / actions consumed by ModuleGate, the Sidebar,
 * and dashboard widget rendering.
 *
 * Hydrated during the initial data-loading phase via `fetchActiveModules()`,
 * which calls the company modules API endpoint.
 */
import { create } from 'zustand';

// ============================================
// STATE SHAPE
// ============================================

interface ModuleState {
  /** Module IDs currently active for the company */
  activeModules: string[];

  /** Whether the initial fetch has completed */
  loaded: boolean;

  /** Error message from the last fetch attempt */
  error: string | null;

  // ── Actions ────────────────────────────────────────────────

  /**
   * Fetch active modules from the API and update the store.
   * Typically called during data hydration.
   */
  fetchActiveModules: (companyId: string) => Promise<void>;

  /**
   * Directly set the active module list (e.g. after activating
   * or deactivating a module without a full refetch).
   */
  setActiveModules: (moduleIds: string[]) => void;

  /**
   * Add a single module to the active list (optimistic update).
   */
  addActiveModule: (moduleId: string) => void;

  /**
   * Remove a single module from the active list (optimistic update).
   */
  removeActiveModule: (moduleId: string) => void;

  /**
   * Reset the store (e.g. on logout or company switch).
   */
  reset: () => void;

  // ── Selectors ──────────────────────────────────────────────

  /**
   * Check if a specific module is active.
   */
  isModuleActive: (moduleId: string) => boolean;
}

// ============================================
// INITIAL STATE
// ============================================

const initialState = {
  activeModules: [] as string[],
  loaded: false,
  error: null as string | null,
};

// ============================================
// STORE
// ============================================

export const useModuleStore = create<ModuleState>()((set, get) => ({
  ...initialState,

  fetchActiveModules: async (companyId: string) => {
    try {
      set({ error: null });

      const res = await fetch(`/api/v1/company/${companyId}/modules`, {
        credentials: 'include',
      });

      if (!res.ok) {
        const body = await res.json().catch(() => ({}));
        throw new Error(
          (body as Record<string, string>).detail ?? `Failed to fetch modules (${res.status})`
        );
      }

      const data: { modules: string[] } = await res.json();

      set({
        activeModules: data.modules,
        loaded: true,
        error: null,
      });
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Unknown error fetching modules';
      console.error('[ModuleStore] fetchActiveModules failed:', message);
      set({ error: message, loaded: true });
    }
  },

  setActiveModules: (moduleIds) =>
    set({ activeModules: moduleIds, loaded: true }),

  addActiveModule: (moduleId) =>
    set((state) => {
      if (state.activeModules.includes(moduleId)) return state;
      return { activeModules: [...state.activeModules, moduleId] };
    }),

  removeActiveModule: (moduleId) =>
    set((state) => ({
      activeModules: state.activeModules.filter((id) => id !== moduleId),
    })),

  reset: () => set(initialState),

  isModuleActive: (moduleId: string) => {
    return get().activeModules.includes(moduleId);
  },
}));

// ============================================
// STANDALONE SELECTORS
// ============================================

/**
 * Hook that returns whether a given module is active.
 * Convenience wrapper around `useModuleStore`.
 */
export function useIsModuleActive(moduleId: string): boolean {
  return useModuleStore((s) => s.activeModules.includes(moduleId));
}

/**
 * Hook that returns the full list of active module IDs.
 */
export function useActiveModuleIds(): string[] {
  return useModuleStore((s) => s.activeModules);
}
