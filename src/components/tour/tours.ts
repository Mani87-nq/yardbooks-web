/**
 * Tour step definitions.
 *
 * Each tour is a named list of steps. Steps reference DOM elements via
 * `data-tour` attributes. The TourProvider finds these elements and
 * positions spotlights + tooltips around them.
 */

export type TourPlacement = 'top' | 'bottom' | 'left' | 'right';

export interface TourStep {
  /** Unique step identifier */
  id: string;
  /** CSS selector to find the target element (typically `[data-tour="..."]`) */
  target: string;
  /** Step title shown in tooltip header */
  title: string;
  /** Step content/description */
  content: string;
  /** Preferred tooltip placement relative to target */
  placement: TourPlacement;
  /** Whether this step should pulse/glow to draw extra attention */
  highlight?: boolean;
}

export interface TourDefinition {
  /** Unique tour identifier (used for completion tracking) */
  id: string;
  /** Display name */
  name: string;
  /** Tour steps in order */
  steps: TourStep[];
}

// ─── Welcome Tour ────────────────────────────────────────────
// Shown after the onboarding wizard completes for the first time.

export const WELCOME_TOUR: TourDefinition = {
  id: 'welcome',
  name: 'Welcome to YaadBooks',
  steps: [
    {
      id: 'welcome',
      target: '[data-tour="dashboard-welcome"]',
      title: 'Welcome to YaadBooks! 🎉',
      content:
        'This is your business command center. You\'ll see key metrics, quick actions, and recent activity right here.',
      placement: 'bottom',
    },
    {
      id: 'sidebar-nav',
      target: '[data-tour="sidebar"]',
      title: 'Your Navigation',
      content:
        'Everything you need is organized here — sales, accounting, inventory, payroll, and reports. Click group headers to expand or collapse sections.',
      placement: 'right',
    },
    {
      id: 'modules',
      target: '[data-tour="sidebar-modules"]',
      title: 'Industry Modules',
      content:
        'Supercharge your business with specialized modules for Retail, Restaurant, or Salon. Browse and activate them here with one click.',
      placement: 'right',
      highlight: true,
    },
    {
      id: 'invoicing',
      target: '[data-tour="quick-action-invoice"]',
      title: 'Create Your First Invoice',
      content:
        'Start here to send professional invoices. YaadBooks handles GCT calculation, payment tracking, and automated reminders.',
      placement: 'bottom',
    },
    {
      id: 'pos',
      target: '[data-tour="quick-action-pos"]',
      title: 'Point of Sale',
      content:
        'For walk-in sales, the POS system handles cash, card, and split payments with receipt printing — works offline too.',
      placement: 'bottom',
    },
    {
      id: 'settings',
      target: '[data-tour="sidebar-settings"]',
      title: 'Settings & Team',
      content:
        'Customize your business settings, invite team members, set up tax rates, and manage your subscription here.',
      placement: 'right',
    },
    {
      id: 'help',
      target: '[data-tour="sidebar-help"]',
      title: 'Need Help? We\'re Here!',
      content:
        'Check out the Help Center for guides, or use the AI Assistant to ask questions about your business data. You\'re all set — let\'s go! 🚀',
      placement: 'right',
    },
  ],
};

// ─── Tour Registry ───────────────────────────────────────────

export const ALL_TOURS: TourDefinition[] = [WELCOME_TOUR];

export function getTour(tourId: string): TourDefinition | undefined {
  return ALL_TOURS.find((t) => t.id === tourId);
}
