'use client';

/**
 * useDataHydration — Runs once when the dashboard mounts.
 * Fetches the authenticated user's profile, companies, and
 * company-scoped data from the API, then populates the Zustand store.
 *
 * Replaces the old demo-data / localStorage approach.
 */
import { useEffect, useRef, useState } from 'react';
import { useRouter } from 'next/navigation';
import { useAppStore } from '@/store/appStore';
import { useModuleStore } from '@/modules/store';
import { api } from '@/lib/api-client';
import type { Company, Customer, Product, Invoice, Expense } from '@/types';
import type { Notification } from '@/types/notifications';

// ── API response shapes ────────────────────────────────────────────

interface MeResponse {
  user: {
    id: string;
    email: string;
    firstName: string;
    lastName: string;
    phone: string | null;
    activeCompanyId: string | null;
    avatarUrl: string | null;
    createdAt: string;
  };
  companies: Array<{
    id: string;
    businessName: string;
    tradingName: string | null;
    role: string;
  }>;
}

interface CompaniesResponse {
  data: Array<Company & { role: string }>;
}

interface PaginatedResponse<T> {
  data: T[];
  pagination: { nextCursor: string | null; hasMore: boolean; limit: number };
}

interface NotificationsResponse {
  data: Notification[];
  unreadCount: number;
  pagination: { nextCursor: string | null; hasMore: boolean; limit: number };
}

// ── Hook ────────────────────────────────────────────────────────────

export function useDataHydration() {
  const router = useRouter();
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const hydrationStarted = useRef(false);

  const store = useAppStore;

  useEffect(() => {
    // Guard against double-invocation in React 18 strict mode
    if (hydrationStarted.current) return;
    hydrationStarted.current = true;

    async function hydrate() {
      try {
        setIsLoading(true);
        setError(null);

        // The accessToken cookie is httpOnly — the browser sends it
        // automatically with every same-origin request. No need to seed
        // the in-memory api-client; getAuthUser() reads the cookie server-side.

        // ── Step 1: Fetch user profile + company memberships ─────────
        let meData: MeResponse;
        try {
          meData = await api.get<MeResponse>('/api/auth/me');
        } catch (err: unknown) {
          // If /me fails with 401, the token is invalid — redirect to login
          if (isApiError(err) && (err.status === 401 || err.status === 403)) {
            router.replace('/login');
            return;
          }
          throw err;
        }

        // Get the user's real RBAC role for the active company
        const activeCompanyMembership = meData.user.activeCompanyId
          ? meData.companies.find((c) => c.id === meData.user.activeCompanyId)
          : meData.companies[0];
        const rbacRole = activeCompanyMembership?.role?.toUpperCase() ?? 'STAFF';

        // Map to simplified app role for backward compat
        const primaryRole = rbacRole.toLowerCase();
        const appRole: 'admin' | 'user' | 'staff' =
          primaryRole === 'owner' || primaryRole === 'admin'
            ? 'admin'
            : primaryRole === 'staff'
              ? 'staff'
              : 'user';

        // Set user in store
        store.getState().setUser({
          id: meData.user.id,
          email: meData.user.email,
          firstName: meData.user.firstName,
          lastName: meData.user.lastName,
          phone: meData.user.phone ?? undefined,
          role: appRole,
          activeCompanyId: meData.user.activeCompanyId ?? undefined,
          avatarUrl: meData.user.avatarUrl ?? undefined,
          createdAt: meData.user.createdAt,
        });

        // Store the real RBAC role for permission checks (usePermissions hook)
        store.getState().setUserRole(rbacRole);

        store.getState().setAuthenticated(true);

        // ── Step 2: Fetch full company objects ───────────────────────
        const companiesRes = await api.get<CompaniesResponse>('/api/v1/companies');
        const companies: Company[] = companiesRes.data.map(({ role, ...company }) => company);

        store.getState().setCompanies(companies);

        // Determine active company
        const activeCompanyId = meData.user.activeCompanyId;
        const activeCompany =
          companies.find((c) => c.id === activeCompanyId) ?? companies[0] ?? null;

        store.getState().setActiveCompany(activeCompany);

        if (!activeCompany) {
          // User has no companies — still mark as hydrated
          store.getState().setOnboarded(false);
          store.setState({ hydrated: true });
          setIsLoading(false);
          return;
        }

        store.getState().setOnboarded(activeCompany.onboardingCompleted === true);

        // ── Step 3: Fetch company-scoped data in parallel ────────────
        // Also hydrate module store with active modules for this company
        const modulesFetchPromise = useModuleStore.getState().fetchActiveModules(activeCompany.id);

        const [
          customersRes,
          productsRes,
          invoicesRes,
          expensesRes,
          notificationsRes,
          quotationsRes,
          employeesRes,
          payrollRes,
          glAccountsRes,
          bankAccountsRes,
          fixedAssetsRes,
          journalEntriesRes,
          bankTransactionsRes,
          userSettingsRes,
        ] = await Promise.all([
          api.get<PaginatedResponse<Customer>>('/api/v1/customers?limit=100'),
          api.get<PaginatedResponse<Product>>('/api/v1/products?limit=100'),
          api.get<PaginatedResponse<Invoice>>('/api/v1/invoices?limit=100'),
          api.get<PaginatedResponse<Expense>>('/api/v1/expenses?limit=100'),
          api.get<NotificationsResponse>('/api/v1/notifications?limit=100'),
          api.get<PaginatedResponse<any>>('/api/v1/quotations?limit=100').catch(() => ({ data: [] })),
          api.get<{ data: any[] }>('/api/v1/employees?limit=100').catch(() => ({ data: [] })),
          api.get<PaginatedResponse<any>>('/api/v1/payroll?limit=100').catch(() => ({ data: [] })),
          api.get<{ data: any[] }>('/api/v1/gl-accounts?limit=200').catch(() => ({ data: [] })),
          api.get<{ data: any[] }>('/api/v1/bank-accounts?limit=50').catch(() => ({ data: [] })),
          api.get<PaginatedResponse<any>>('/api/v1/fixed-assets?limit=100').catch(() => ({ data: [] })),
          api.get<PaginatedResponse<any>>('/api/v1/journal-entries?limit=200').catch(() => ({ data: [] })),
          api.get<PaginatedResponse<any>>('/api/v1/banking/transactions?limit=200').catch(() => ({ data: [] })),
          api.get<{ theme?: string; language?: string; currency?: string; dateFormat?: string; compactMode?: boolean }>('/api/v1/user-settings').catch(() => null),
        ]);

        // Await modules fetch (fire-and-forget if it fails - sidebar just won't show module items)
        await modulesFetchPromise.catch(() => {});

        // Populate the store in a single batch
        const state = store.getState();
        state.setCustomers(customersRes.data);
        state.setProducts(productsRes.data);
        state.setInvoices(invoicesRes.data);
        state.setExpenses(expensesRes.data);
        state.setNotifications(notificationsRes.data);
        state.setQuotations(quotationsRes.data);
        state.setEmployees(employeesRes.data);
        state.setPayrollRuns(payrollRes.data || []);
        state.setGLAccounts(glAccountsRes.data);
        state.setBankAccounts(bankAccountsRes.data);
        state.setFixedAssets(fixedAssetsRes.data);
        state.setJournalEntries(journalEntriesRes.data);
        state.setBankTransactions(bankTransactionsRes.data);

        // Apply user display preferences (currency, theme, dateFormat, etc.)
        if (userSettingsRes) {
          const prefs: Record<string, unknown> = {};
          if (userSettingsRes.currency) prefs.currency = userSettingsRes.currency;
          if (userSettingsRes.theme) prefs.theme = userSettingsRes.theme;
          if (userSettingsRes.language) prefs.language = userSettingsRes.language;
          if (userSettingsRes.dateFormat) prefs.dateFormat = userSettingsRes.dateFormat;
          if (typeof userSettingsRes.compactMode === 'boolean') prefs.compactMode = userSettingsRes.compactMode;
          if (Object.keys(prefs).length > 0) {
            state.updateSettings(prefs as any);
          }
        }

        // Mark hydration complete
        store.setState({ hydrated: true });
        setIsLoading(false);
      } catch (err: unknown) {
        console.error('[useDataHydration] Hydration failed:', err);
        const message =
          err instanceof Error ? err.message : 'Failed to load dashboard data';
        setError(message);
        setIsLoading(false);
      }
    }

    hydrate();
  }, [router, store]);

  const isHydrated = useAppStore((s) => s.hydrated);

  return { isLoading, error, isHydrated };
}

// ── Helpers ─────────────────────────────────────────────────────────

function isApiError(err: unknown): err is { status: number } {
  return typeof err === 'object' && err !== null && 'status' in err;
}
