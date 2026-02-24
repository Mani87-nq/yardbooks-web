'use client';

import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import api from '@/lib/api-client';

interface BankAccount {
  id: string;
  accountName: string;
  bankName: string;
  accountNumber: string;
  accountType: string;
  currency: string;
  currentBalance: number;
  availableBalance: number;
  isActive: boolean;
  createdAt: string;
}

interface ListResponse<T> { data: T[] }

export function useBankAccounts() {
  return useQuery({
    queryKey: ['bankAccounts'],
    queryFn: () => api.get<ListResponse<BankAccount>>('/api/v1/bank-accounts'),
  });
}

export function useBankAccount(id: string) {
  return useQuery({
    queryKey: ['bankAccounts', id],
    queryFn: () => api.get<BankAccount>(`/api/v1/bank-accounts/${id}`),
    enabled: !!id,
  });
}

export function useCreateBankAccount() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (data: Record<string, unknown>) => api.post<BankAccount>('/api/v1/bank-accounts', data),
    onSuccess: () => { qc.invalidateQueries({ queryKey: ['bankAccounts'] }); },
  });
}

export function useUpdateBankAccount() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({ id, data }: { id: string; data: Record<string, unknown> }) =>
      api.put<BankAccount>(`/api/v1/bank-accounts/${id}`, data),
    onSuccess: (_, vars) => {
      qc.invalidateQueries({ queryKey: ['bankAccounts'] });
      qc.invalidateQueries({ queryKey: ['bankAccounts', vars.id] });
    },
  });
}

export function useDeleteBankAccount() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (id: string) => api.delete(`/api/v1/bank-accounts/${id}`),
    onSuccess: () => { qc.invalidateQueries({ queryKey: ['bankAccounts'] }); },
  });
}

// ---- Bank Transactions ----

interface BankTransaction {
  id: string;
  bankAccountId: string;
  transactionDate: string;
  postDate: string;
  description: string;
  reference: string | null;
  amount: number;
  balance: number | null;
  category: string | null;
  isReconciled: boolean;
  createdAt: string;
}

export function useBankTransactions(bankAccountId?: string) {
  const searchParams = new URLSearchParams();
  if (bankAccountId) searchParams.set('bankAccountId', bankAccountId);
  const qs = searchParams.toString();

  return useQuery({
    queryKey: ['bankTransactions', bankAccountId],
    queryFn: () => api.get<ListResponse<BankTransaction>>(`/api/v1/banking/transactions${qs ? `?${qs}` : ''}`),
  });
}

export function useCreateBankTransaction() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (data: Record<string, unknown>) => api.post<BankTransaction>('/api/v1/banking/transactions', data),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['bankTransactions'] });
      qc.invalidateQueries({ queryKey: ['bankAccounts'] }); // balance may change
    },
  });
}

export function useUpdateBankTransaction() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({ id, data }: { id: string; data: Record<string, unknown> }) =>
      api.put<BankTransaction>(`/api/v1/banking/transactions/${id}`, data),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['bankTransactions'] });
    },
  });
}
