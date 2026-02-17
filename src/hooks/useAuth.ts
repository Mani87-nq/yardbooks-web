'use client';

/**
 * Auth hook — manages authentication state on the client.
 * Provides login, logout, register, and token refresh.
 */
import { useState, useEffect, useCallback, createContext, useContext } from 'react';
import { api, setAccessToken } from '@/lib/api-client';

interface AuthUser {
  id: string;
  email: string;
  firstName: string;
  lastName: string;
  activeCompanyId: string | null;
}

interface AuthCompany {
  id: string;
  businessName: string;
  role: string;
}

interface AuthState {
  user: AuthUser | null;
  companies: AuthCompany[];
  isAuthenticated: boolean;
  isLoading: boolean;
}

interface AuthActions {
  login: (email: string, password: string) => Promise<void>;
  register: (data: RegisterData) => Promise<void>;
  logout: () => Promise<void>;
  refreshSession: () => Promise<void>;
}

interface RegisterData {
  email: string;
  password: string;
  firstName: string;
  lastName: string;
  companyName?: string;
}

export function useAuthProvider(): AuthState & AuthActions {
  const [state, setState] = useState<AuthState>({
    user: null,
    companies: [],
    isAuthenticated: false,
    isLoading: true,
  });

  // Try to restore session on mount
  useEffect(() => {
    refreshSession().catch(() => {
      setState((s) => ({ ...s, isLoading: false }));
    });
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const login = useCallback(async (email: string, password: string) => {
    const data = await api.post<{
      user: AuthUser;
      companies: AuthCompany[];
      accessToken: string;
    }>('/api/auth/login', { email, password }, { skipAuth: true });

    setAccessToken(data.accessToken);
    setState({
      user: data.user,
      companies: data.companies,
      isAuthenticated: true,
      isLoading: false,
    });
  }, []);

  const register = useCallback(async (registerData: RegisterData) => {
    const data = await api.post<{
      user: AuthUser;
      company: { id: string; businessName: string } | null;
      accessToken: string;
    }>('/api/auth/register', registerData, { skipAuth: true });

    setAccessToken(data.accessToken);
    setState({
      user: data.user,
      companies: data.company
        ? [{ id: data.company.id, businessName: data.company.businessName, role: 'OWNER' }]
        : [],
      isAuthenticated: true,
      isLoading: false,
    });
  }, []);

  const logout = useCallback(async () => {
    try {
      await api.post('/api/auth/logout', undefined, { skipAuth: true });
    } finally {
      setAccessToken(null);
      setState({
        user: null,
        companies: [],
        isAuthenticated: false,
        isLoading: false,
      });
    }
  }, []);

  const refreshSession = useCallback(async () => {
    try {
      const data = await api.post<{
        accessToken: string;
        user: AuthUser;
      }>('/api/auth/refresh', undefined, { skipAuth: true });

      setAccessToken(data.accessToken);

      // Fetch companies
      const companiesRes = await api.get<{ data: AuthCompany[] }>('/api/v1/companies');

      setState({
        user: data.user,
        companies: companiesRes.data,
        isAuthenticated: true,
        isLoading: false,
      });
    } catch {
      setAccessToken(null);
      setState({
        user: null,
        companies: [],
        isAuthenticated: false,
        isLoading: false,
      });
    }
  }, []);

  return { ...state, login, register, logout, refreshSession };
}

// ============================================
// CONTEXT (optional — for deep component trees)
// ============================================

type AuthContextType = AuthState & AuthActions;

const AuthContext = createContext<AuthContextType | null>(null);

export const AuthProvider = AuthContext.Provider;

export function useAuth(): AuthContextType {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error('useAuth must be used within an AuthProvider');
  return ctx;
}
