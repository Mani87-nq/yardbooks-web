/**
 * Yaad Books Web - Kiosk Workstation Store
 *
 * Client-side state for the kiosk workstation. Holds module context,
 * employee info, shift state, and terminal info. Persisted to
 * sessionStorage so state survives page refreshes within the same
 * browser session but is cleared when the tab/window closes.
 */
import { create } from 'zustand';
import { persist, createJSONStorage } from 'zustand/middleware';

// ============================================
// STORE STATE INTERFACE
// ============================================

interface KioskState {
  // Module context
  activeModules: string[];
  companyName: string;
  companyColor: string;

  // Current employee (from login)
  currentEmployee: {
    id: string;
    firstName: string;
    lastName: string;
    displayName: string | null;
    role: string;
    avatarColor: string;
    permissions: Record<string, unknown>;
  } | null;

  // Shift state
  activeShift: {
    id: string;
    clockInAt: string;
    status: string;
    totalSales: number;
    totalTips: number;
    transactionCount: number;
    isOnBreak: boolean;
  } | null;

  // Terminal
  terminalId: string | null;
  terminalNumber: number | null;

  // Network
  isOnline: boolean;

  // Loading
  isContextLoaded: boolean;

  // Actions
  loadKioskContext: () => Promise<void>;
  refreshShift: () => Promise<void>;
  setEmployee: (employee: KioskState['currentEmployee']) => void;
  setActiveModules: (modules: string[]) => void;
  setTerminal: (id: string, number: number) => void;
  setOnline: (online: boolean) => void;
  clearSession: () => void;
}

// ============================================
// INITIAL STATE
// ============================================

const INITIAL_STATE = {
  activeModules: [] as string[],
  companyName: '',
  companyColor: '#1976D2',
  currentEmployee: null,
  activeShift: null,
  terminalId: null,
  terminalNumber: null,
  isOnline: true,
  isContextLoaded: false,
} satisfies Partial<KioskState>;

// ============================================
// STORE IMPLEMENTATION
// ============================================

export const useKioskStore = create<KioskState>()(
  persist(
    (set, get) => ({
      // Spread initial state
      ...INITIAL_STATE,

      // -------------------------------------------
      // loadKioskContext
      // Fetches employee profile, active modules,
      // and active shift in parallel on kiosk boot.
      // -------------------------------------------
      loadKioskContext: async () => {
        try {
          const [profileRes, modulesRes, shiftRes] = await Promise.all([
            fetch('/api/employee/profile'),
            fetch('/api/employee/modules'),
            fetch('/api/employee/shift/active'),
          ]);

          // If any auth fails (401), set context loaded with empty state
          if (profileRes.status === 401 || modulesRes.status === 401) {
            set({ isContextLoaded: true });
            return;
          }

          const profile = profileRes.ok ? await profileRes.json() : null;
          const modules = modulesRes.ok ? await modulesRes.json() : null;
          const shiftData = shiftRes.ok ? await shiftRes.json() : null;

          set({
            currentEmployee: profile
              ? {
                  id: profile.id,
                  firstName: profile.firstName,
                  lastName: profile.lastName,
                  displayName: profile.displayName,
                  role: profile.role,
                  avatarColor: profile.avatarColor,
                  permissions: profile.permissions ?? {},
                }
              : null,
            activeModules: modules?.modules ?? [],
            companyName: modules?.company?.name ?? '',
            companyColor: modules?.company?.primaryColor ?? '#1976D2',
            activeShift: shiftData?.shift
              ? {
                  id: shiftData.shift.id,
                  clockInAt: shiftData.shift.clockInAt,
                  status: shiftData.shift.status,
                  totalSales: shiftData.shift.totalSales ?? 0,
                  totalTips: shiftData.shift.totalTips ?? 0,
                  transactionCount: shiftData.shift.transactionCount ?? 0,
                  isOnBreak: shiftData.shift.isOnBreak ?? false,
                }
              : null,
            isContextLoaded: true,
          });
        } catch {
          // Network error — mark context as loaded so the UI can show
          // an appropriate offline / retry state instead of hanging.
          set({ isContextLoaded: true });
        }
      },

      // -------------------------------------------
      // refreshShift
      // Re-fetches only the active shift. Called
      // after clock-in, clock-out, break actions.
      // -------------------------------------------
      refreshShift: async () => {
        try {
          const res = await fetch('/api/employee/shift/active');
          if (!res.ok) return;

          const data = await res.json();
          set({
            activeShift: data.shift
              ? {
                  id: data.shift.id,
                  clockInAt: data.shift.clockInAt,
                  status: data.shift.status,
                  totalSales: data.shift.totalSales ?? 0,
                  totalTips: data.shift.totalTips ?? 0,
                  transactionCount: data.shift.transactionCount ?? 0,
                  isOnBreak: data.shift.isOnBreak ?? false,
                }
              : null,
          });
        } catch {
          // Silently fail — shift will refresh on next attempt
        }
      },

      // -------------------------------------------
      // Setters
      // -------------------------------------------
      setEmployee: (employee) => set({ currentEmployee: employee }),

      setActiveModules: (modules) => set({ activeModules: modules }),

      setTerminal: (id, number) => set({ terminalId: id, terminalNumber: number }),

      setOnline: (online) => set({ isOnline: online }),

      // -------------------------------------------
      // clearSession
      // Resets all state to initial values. Called
      // on logout / session expiry.
      // -------------------------------------------
      clearSession: () => set({ ...INITIAL_STATE }),
    }),
    {
      name: 'yaadbooks-kiosk',
      storage: createJSONStorage(() => sessionStorage),
      // Only persist state — actions are always recreated by Zustand.
      partialize: (state) => ({
        activeModules: state.activeModules,
        companyName: state.companyName,
        companyColor: state.companyColor,
        currentEmployee: state.currentEmployee,
        activeShift: state.activeShift,
        terminalId: state.terminalId,
        terminalNumber: state.terminalNumber,
        isOnline: state.isOnline,
        isContextLoaded: state.isContextLoaded,
      }),
    }
  )
);
