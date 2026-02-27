/**
 * Tour Store — Zustand store for product tour state.
 *
 * Tracks which tours have been completed and persists to localStorage.
 * Also tracks the current active tour and step for the provider.
 */
import { create } from 'zustand';

const STORAGE_KEY = 'yb-tours-completed';

function loadCompletedTours(): string[] {
  if (typeof window === 'undefined') return [];
  try {
    const stored = localStorage.getItem(STORAGE_KEY);
    if (stored) return JSON.parse(stored);
  } catch {
    // ignore
  }
  return [];
}

function saveCompletedTours(tourIds: string[]) {
  if (typeof window === 'undefined') return;
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(tourIds));
  } catch {
    // ignore
  }
}

// ─── State Shape ─────────────────────────────────────────────

interface TourState {
  /** IDs of all completed tours */
  completedTours: string[];

  /** Currently active tour ID (null if no tour running) */
  activeTourId: string | null;

  /** Current step index within the active tour */
  currentStep: number;

  /** Whether the tour system has been initialized */
  initialized: boolean;

  // ── Actions ────────────────────────────────────────────────

  /** Initialize by loading from localStorage */
  initialize: () => void;

  /** Start a specific tour */
  startTour: (tourId: string) => void;

  /** Move to the next step */
  nextStep: () => void;

  /** Move to the previous step */
  prevStep: () => void;

  /** Go to a specific step */
  goToStep: (step: number) => void;

  /** Complete the current tour */
  completeTour: () => void;

  /** Skip (dismiss) the current tour — still marks it completed */
  skipTour: () => void;

  /** Reset a tour so it can be replayed */
  resetTour: (tourId: string) => void;

  /** Check if a tour has been completed */
  isTourCompleted: (tourId: string) => boolean;
}

// ─── Store ───────────────────────────────────────────────────

export const useTourStore = create<TourState>()((set, get) => ({
  completedTours: [],
  activeTourId: null,
  currentStep: 0,
  initialized: false,

  initialize: () => {
    const completed = loadCompletedTours();
    set({ completedTours: completed, initialized: true });
  },

  startTour: (tourId: string) => {
    set({ activeTourId: tourId, currentStep: 0 });
  },

  nextStep: () => {
    set((state) => ({ currentStep: state.currentStep + 1 }));
  },

  prevStep: () => {
    set((state) => ({ currentStep: Math.max(0, state.currentStep - 1) }));
  },

  goToStep: (step: number) => {
    set({ currentStep: Math.max(0, step) });
  },

  completeTour: () => {
    const { activeTourId, completedTours } = get();
    if (!activeTourId) return;

    const updated = [...new Set([...completedTours, activeTourId])];
    saveCompletedTours(updated);

    set({
      completedTours: updated,
      activeTourId: null,
      currentStep: 0,
    });
  },

  skipTour: () => {
    // Skipping also marks the tour as completed so it doesn't re-trigger
    const { activeTourId, completedTours } = get();
    if (!activeTourId) return;

    const updated = [...new Set([...completedTours, activeTourId])];
    saveCompletedTours(updated);

    set({
      completedTours: updated,
      activeTourId: null,
      currentStep: 0,
    });
  },

  resetTour: (tourId: string) => {
    const { completedTours } = get();
    const updated = completedTours.filter((id) => id !== tourId);
    saveCompletedTours(updated);
    set({ completedTours: updated });
  },

  isTourCompleted: (tourId: string) => {
    return get().completedTours.includes(tourId);
  },
}));
