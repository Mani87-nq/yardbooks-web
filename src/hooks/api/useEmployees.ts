'use client';

import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import api from '@/lib/api-client';

interface Employee {
  id: string;
  employeeNumber: string;
  firstName: string;
  lastName: string;
  email: string | null;
  phone: string | null;
  position: string;
  department: string | null;
  employmentType: string;
  paymentFrequency: string;
  baseSalary: number;
  trnNumber: string;
  nisNumber: string;
  hireDate: string;
  isActive: boolean;
  createdAt: string;
}

interface ListResponse<T> { data: T[] }

export function useEmployees(params?: { active?: boolean; limit?: number }) {
  const searchParams = new URLSearchParams();
  if (params?.active !== undefined) searchParams.set('active', String(params.active));
  if (params?.limit) searchParams.set('limit', String(params.limit));
  const qs = searchParams.toString();

  return useQuery({
    queryKey: ['employees', params],
    queryFn: () => api.get<ListResponse<Employee>>(`/api/v1/employees${qs ? `?${qs}` : ''}`),
  });
}

export function useEmployee(id: string) {
  return useQuery({
    queryKey: ['employees', id],
    queryFn: () => api.get<Employee>(`/api/v1/employees/${id}`),
    enabled: !!id,
  });
}

export function useCreateEmployee() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (data: Record<string, unknown>) => api.post<Employee>('/api/v1/employees', data),
    onSuccess: () => { qc.invalidateQueries({ queryKey: ['employees'] }); },
  });
}

export function useUpdateEmployee() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({ id, data }: { id: string; data: Record<string, unknown> }) =>
      api.put<Employee>(`/api/v1/employees/${id}`, data),
    onSuccess: (_, vars) => {
      qc.invalidateQueries({ queryKey: ['employees'] });
      qc.invalidateQueries({ queryKey: ['employees', vars.id] });
    },
  });
}

export function useDeleteEmployee() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (id: string) => api.delete(`/api/v1/employees/${id}`),
    onSuccess: () => { qc.invalidateQueries({ queryKey: ['employees'] }); },
  });
}
