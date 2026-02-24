'use client';

import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import api from '@/lib/api-client';

// ---- GL Accounts ----

interface GLAccount {
  id: string;
  accountNumber: string;
  code: string | null;
  name: string;
  type: string;
  isActive: boolean;
  currentBalance: number;
  description: string | null;
}

interface ListResponse<T> { data: T[] }

export function useGLAccounts() {
  return useQuery({
    queryKey: ['glAccounts'],
    queryFn: () => api.get<ListResponse<GLAccount>>('/api/v1/gl-accounts'),
  });
}

export function useGLAccount(id: string) {
  return useQuery({
    queryKey: ['glAccounts', id],
    queryFn: () => api.get<GLAccount>(`/api/v1/gl-accounts/${id}`),
    enabled: !!id,
  });
}

export function useCreateGLAccount() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (data: Record<string, unknown>) => api.post<GLAccount>('/api/v1/gl-accounts', data),
    onSuccess: () => { qc.invalidateQueries({ queryKey: ['glAccounts'] }); },
  });
}

export function useUpdateGLAccount() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({ id, data }: { id: string; data: Record<string, unknown> }) =>
      api.put<GLAccount>(`/api/v1/gl-accounts/${id}`, data),
    onSuccess: (_, vars) => {
      qc.invalidateQueries({ queryKey: ['glAccounts'] });
      qc.invalidateQueries({ queryKey: ['glAccounts', vars.id] });
    },
  });
}

export function useDeleteGLAccount() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (id: string) => api.delete(`/api/v1/gl-accounts/${id}`),
    onSuccess: () => { qc.invalidateQueries({ queryKey: ['glAccounts'] }); },
  });
}

// ---- Journal Entries ----

interface JournalEntry {
  id: string;
  entryNumber: string;
  date: string;
  description: string;
  reference: string | null;
  status: string;
  totalDebits: number;
  totalCredits: number;
  lines: JournalLine[];
  createdAt: string;
}

interface JournalLine {
  id: string;
  accountId: string;
  accountCode: string;
  accountName: string;
  description: string | null;
  debitAmount: number;
  creditAmount: number;
}

interface PaginatedResponse<T> {
  data: T[];
  pagination: { nextCursor: string | null; hasMore: boolean; limit: number };
}

export function useJournalEntries(params?: { limit?: number }) {
  const searchParams = new URLSearchParams();
  if (params?.limit) searchParams.set('limit', String(params.limit));
  const qs = searchParams.toString();

  return useQuery({
    queryKey: ['journalEntries', params],
    queryFn: () => api.get<PaginatedResponse<JournalEntry>>(`/api/v1/journal-entries${qs ? `?${qs}` : ''}`),
  });
}

export function useJournalEntry(id: string) {
  return useQuery({
    queryKey: ['journalEntries', id],
    queryFn: () => api.get<JournalEntry>(`/api/v1/journal-entries/${id}`),
    enabled: !!id,
  });
}

export function useCreateJournalEntry() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (data: Record<string, unknown>) => api.post<JournalEntry>('/api/v1/journal-entries', data),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['journalEntries'] });
      qc.invalidateQueries({ queryKey: ['glAccounts'] }); // balances may change
    },
  });
}

export function useUpdateJournalEntry() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({ id, data }: { id: string; data: Record<string, unknown> }) =>
      api.put<JournalEntry>(`/api/v1/journal-entries/${id}`, data),
    onSuccess: (_, vars) => {
      qc.invalidateQueries({ queryKey: ['journalEntries'] });
      qc.invalidateQueries({ queryKey: ['journalEntries', vars.id] });
    },
  });
}

export function useDeleteJournalEntry() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (id: string) => api.delete(`/api/v1/journal-entries/${id}`),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['journalEntries'] });
      qc.invalidateQueries({ queryKey: ['glAccounts'] });
    },
  });
}

export function usePostJournalEntry() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (id: string) => api.post<JournalEntry>(`/api/v1/journal-entries/${id}/post`),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['journalEntries'] });
      qc.invalidateQueries({ queryKey: ['glAccounts'] }); // balances change on post
    },
  });
}

export function useVoidJournalEntry() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (id: string) => api.post<JournalEntry>(`/api/v1/journal-entries/${id}/void`),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['journalEntries'] });
      qc.invalidateQueries({ queryKey: ['glAccounts'] }); // balances change on void
    },
  });
}
