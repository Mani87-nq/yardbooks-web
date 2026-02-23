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
import { api, setAccessToken } from '@/lib/api-client';
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

        // Ensure the in-memory access token is seeded from the cookie so
        // the api client can attach it as a Bearer header.
        ensureAccessTokenFromCookie();

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
          createdAt: new Date(meData.user.createdAt),
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

        store.getState().setOnboarded(true);

        // ── Step 3: Fetch company-scoped data in parallel ────────────
        const [customersRes, productsRes, invoicesRes, expensesRes, notificationsRes] =
          await Promise.all([
            api.get<PaginatedResponse<Customer>>('/api/v1/customers?limit=100'),
            api.get<PaginatedResponse<Product>>('/api/v1/products?limit=100'),
            api.get<PaginatedResponse<Invoice>>('/api/v1/invoices?limit=100'),
            api.get<PaginatedResponse<Expense>>('/api/v1/expenses?limit=100'),
            api.get<NotificationsResponse>('/api/v1/notifications?limit=100'),
          ]);

        // Populate the store in a single batch
        const state = store.getState();
        state.setCustomers(customersRes.data);
        state.setProducts(productsRes.data);
        state.setInvoices(invoicesRes.data);
        state.setExpenses(expensesRes.data);
        state.setNotifications(notificationsRes.data);

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

/**
 * Read the accessToken cookie and push it into the in-memory api-client
 * so that the Bearer header is attached to requests.
 */
function ensureAccessTokenFromCookie() {
  if (typeof document === 'undefined') return;
  const match = document.cookie.match(/(?:^|;\s*)accessToken=([^;]*)/);
  if (match?.[1]) {
    setAccessToken(decodeURIComponent(match[1]));
  }
}

function isApiError(err: unknown): err is { status: number } {
  return typeof err === 'object' && err !== null && 'status' in err;
}
