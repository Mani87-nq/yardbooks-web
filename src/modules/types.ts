/**
 * Module Architecture Type System for YaadBooks.
 *
 * Defines the manifest and extension-point interfaces that every
 * industry module must implement.  The registry uses these types at
 * build time to discover, validate, and expose module capabilities.
 */

// ============================================
// MODULE IDENTITY
// ============================================

/**
 * Known module identifiers.  Extend this union as new modules are added.
 * Using a union (rather than plain `string`) keeps manifest declarations
 * type-safe while still allowing the registry to accept dynamic IDs at
 * runtime via the `string` fallback.
 */
export type ModuleId =
  | 'retail'
  | 'restaurant'
  | 'salon'
  | 'parking'
  | 'construction'
  | 'tourism'
  | (string & {}); // allow arbitrary IDs without losing autocomplete

export type ModuleCategory =
  | 'industry'  // Industry-vertical module (e.g. Salon, Retail)
  | 'addon'     // Cross-industry add-on (e.g. Loyalty, CRM)
  | 'integration'; // Third-party integration (e.g. QuickBooks sync)

export type RequiredPlan = 'FREE' | 'STARTER' | 'PROFESSIONAL' | 'BUSINESS' | 'ENTERPRISE';

// ============================================
// NAVIGATION
// ============================================

export interface ModuleNavItem {
  /** Display label shown in the sidebar */
  label: string;
  /** Route path relative to /dashboard/{moduleId}/ */
  href: string;
  /** Heroicon component name (e.g. "CalendarDaysIcon") */
  icon: string;
  /** Permission string required to see this nav item (omit = visible to all roles) */
  permission?: string;
  /** Nested sub-navigation items */
  children?: ModuleNavItem[];
  /** Badge count key (e.g. "pendingOrders") resolved from module store */
  badge?: string;
}

// ============================================
// DASHBOARD WIDGETS
// ============================================

export interface ModuleDashboardWidget {
  /** Unique widget identifier (e.g. "salon-today-appointments") */
  id: string;
  /** Dynamic import path relative to src/ (e.g. "modules/salon/components/TodayAppointments") */
  component: string;
  /** Widget display title */
  title: string;
  /** Whether the widget is shown by default on the dashboard */
  defaultEnabled: boolean;
  /** Minimum role required to see this widget */
  minRole: 'OWNER' | 'ADMIN' | 'ACCOUNTANT' | 'STAFF' | 'READ_ONLY';
  /** Grid span hint: 1 = single column, 2 = double, 3 = full width */
  gridSpan?: 1 | 2 | 3;
}

// ============================================
// SETTINGS PANELS
// ============================================

export interface ModuleSettingsPanel {
  /** Unique panel identifier */
  id: string;
  /** Settings panel title */
  title: string;
  /** Dynamic import path to the settings component */
  component: string;
  /** Minimum role required to access this settings panel */
  minRole: 'OWNER' | 'ADMIN' | 'ACCOUNTANT' | 'STAFF' | 'READ_ONLY';
  /** Icon for the settings navigation */
  icon: string;
}

// ============================================
// EVENTS
// ============================================

export interface ModuleEventDefinition {
  /** Fully-qualified event name (e.g. "salon.appointment.created") */
  name: string;
  /** Human-readable description of when this event fires */
  description: string;
  /** TypeScript type reference for the payload (informational) */
  payloadType?: string;
}

// ============================================
// PERMISSIONS
// ============================================

export interface ModulePermission {
  /**
   * Permission key following the pattern `{moduleId}:{entity}:{action}`.
   * Example: "salon:appointments:create"
   */
  key: string;
  /** Human-readable label shown in the admin permission editor */
  label: string;
  /** Which roles receive this permission by default on module activation */
  defaultRoles: Array<'OWNER' | 'ADMIN' | 'ACCOUNTANT' | 'STAFF' | 'READ_ONLY'>;
}

// ============================================
// MODULE MANIFEST (the main contract)
// ============================================

export interface ModuleManifest {
  // ---- Identity ----
  /** Unique module identifier (e.g. "salon") */
  id: ModuleId;
  /** Human-readable module name */
  name: string;
  /** Semantic version string */
  version: string;
  /** Short description of the module */
  description: string;
  /** Heroicon name used in the module picker */
  icon: string;
  /** Tailwind color class used for module branding (e.g. "pink", "blue") */
  color: string;
  /** Module category */
  category: ModuleCategory;

  // ---- Dependencies ----
  /** Other module IDs that must be active before this module can be activated */
  dependencies: ModuleId[];
  /** Core features this module requires (e.g. "customers", "invoices", "pos") */
  coreDependencies: string[];

  // ---- Plan & Pricing ----
  /** Minimum subscription plan required to activate this module */
  requiredPlan: RequiredPlan;
  /** Number of free trial days (0 = no trial) */
  trialDays: number;
  /** Additional monthly cost for this module (0 = included in plan) */
  pricing: {
    monthly: number;
    currency: 'JMD' | 'USD';
  };

  // ---- Extension Points ----
  /** Navigation items injected into the sidebar */
  navigation: ModuleNavItem[];
  /** Dashboard widgets provided by this module */
  dashboardWidgets: ModuleDashboardWidget[];
  /** Settings panels provided by this module */
  settingsPanels: ModuleSettingsPanel[];

  // ---- Events ----
  /** Events published by this module */
  eventsPublished: ModuleEventDefinition[];
  /** Core or cross-module events this module subscribes to */
  eventsSubscribed: string[];

  // ---- Permissions ----
  /** Permissions declared by this module */
  permissions: ModulePermission[];

  // ---- Technical ----
  /** Whether this module adds its own database tables */
  hasSchema: boolean;
}
