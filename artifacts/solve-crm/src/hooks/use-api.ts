import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { useMemo, useState, useEffect } from 'react';

const API_BASE = 'http://localhost:3000';

function getHeaders(): HeadersInit {
  const token = localStorage.getItem('token');
  return {
    'Content-Type': 'application/json',
    ...(token ? { Authorization: `Bearer ${token}` } : {}),
  };
}

async function apiGet<T>(path: string): Promise<T> {
  const res = await fetch(`${API_BASE}${path}`, { headers: getHeaders() });
  if (!res.ok) throw new Error(`API error: ${res.status}`);
  return res.json();
}

async function apiMutate<T>(path: string, method: string, body?: unknown): Promise<T> {
  const res = await fetch(`${API_BASE}${path}`, {
    method,
    headers: getHeaders(),
    body: body ? JSON.stringify(body) : undefined,
  });
  if (!res.ok) {
    const err = await res.json().catch(() => ({ error: 'Erro desconhecido' }));
    throw new Error(err.error || `API error: ${res.status}`);
  }
  if (res.status === 204) return undefined as T;
  return res.json();
}

async function apiPost<T>(path: string, body?: unknown): Promise<T> {
  return apiMutate<T>(path, 'POST', body);
}

// Shared polling interval (30 seconds)
const POLL_INTERVAL = 30000;

// ─── Automations ─────────────────────────────────────────────────────────────
export interface Automation {
  id: string;
  name: string;
  trigger: string;
  action: string;
  active: boolean;
  runCount: number;
  lastRunAt: string | null;
  createdAt: string;
  updatedAt: string;
}

export function useListAutomations() {
  return useQuery({
    queryKey: ['automations'],
    queryFn: () => apiGet<{ data: Automation[]; total: number }>('/api/v1/automations'),
  });
}

export function useCreateAutomation() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (data: { name: string; trigger: string; action: string }) =>
      apiMutate<{ data: Automation }>('/api/v1/automations', 'POST', data),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['automations'] }),
  });
}

export function useUpdateAutomation() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({ id, ...data }: { id: string; name?: string; trigger?: string; action?: string }) =>
      apiMutate<{ data: Automation }>(`/api/v1/automations/${id}`, 'PATCH', data),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['automations'] }),
  });
}

export function useDeleteAutomation() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (id: string) => apiMutate<void>(`/api/v1/automations/${id}`, 'DELETE'),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['automations'] }),
  });
}

export function useToggleAutomation() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (id: string) => apiMutate<{ data: Automation }>(`/api/v1/automations/${id}/toggle`, 'PATCH'),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['automations'] }),
  });
}

// ─── Audit Logs ──────────────────────────────────────────────────────────────
export interface AuditLog {
  id: string;
  actor: string;
  action: string;
  entity: string | null;
  entityId: string | null;
  details: string | null;
  ipAddress: string | null;
  createdAt: string;
}

export function useListAuditLogs(entity?: string) {
  const params = entity ? `?entity=${entity}` : '';
  return useQuery({
    queryKey: ['audit-logs', entity],
    queryFn: () => apiGet<{ data: AuditLog[]; total: number }>(`/api/v1/audit-logs${params}`),
  });
}

// ─── Settings ────────────────────────────────────────────────────────────────
export function useGetSettings() {
  return useQuery({
    queryKey: ['settings'],
    queryFn: () => apiGet<{ data: Record<string, any> }>('/api/v1/settings'),
  });
}

export function useUpdateSettings() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (settings: Record<string, any>) =>
      apiMutate<{ message: string }>('/api/v1/settings', 'PUT', { settings }),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['settings'] }),
  });
}

// ─── Users (extended) ───────────────────────────────────────────────────────
export interface User {
  id: string;
  name: string;
  email: string;
  role: string;
  phone: string | null;
  active: boolean;
  lastLoginAt: string | null;
  createdAt: string;
  updatedAt: string;
}

export function useListUsersAll() {
  return useQuery({
    queryKey: ['users-all'],
    queryFn: () => apiGet<{ data: User[]; total: number }>('/api/v1/users'),
  });
}

export function useToggleUser() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (id: string) => apiMutate<{ data: User }>(`/api/v1/users/${id}/toggle`, 'PATCH'),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['users-all'] }),
  });
}

// ─── Solve Access ────────────────────────────────────────────────────────────
export interface AccessStats {
  clients: { total: number; active: number; online: number; blocked: number };
  accesses: { today: number; month: number; authorizedToday: number; deniedToday: number };
  recentAccesses: Array<{
    id_acesso: number; cliente_id: number; cliente_nome: string;
    data_acesso: string; hora_acesso: string; tipo_acesso: string;
    resultado: string; motivo: string | null;
  }>;
  accessByDay: Array<{ date: string; count: number; authorized: number; denied: number }>;
  peakHours: Array<{ hour: number; count: number }>;
}

export interface AccessLog {
  id_acesso: number; cliente_id: number; cliente_nome: string; numero_cartao: string;
  terminal_id: number; nome_terminal: string; data_acesso: string; hora_acesso: string;
  tipo_acesso: string; resultado: string; motivo: string | null;
}

export function useAccessStats() {
  return useQuery({
    queryKey: ['access-stats'],
    queryFn: () => apiGet<{ data: AccessStats }>('/api/v1/access/stats'),
    refetchInterval: 60000,
    retry: false,
  });
}

export function useAccessLogs(params?: { client_id?: string; resultado?: string; tipo_acesso?: string }) {
  const qs = params ? '?' + new URLSearchParams(params as any).toString() : '';
  return useQuery({
    queryKey: ['access-logs', params],
    queryFn: () => apiGet<{ data: AccessLog[]; pagination: any }>(`/api/v1/access/logs${qs}`),
    refetchInterval: 30000,
    retry: false,
  });
}

// Solve Access (Terminal Control)
export function useSolveAccessDashboard() {
  return useQuery({
    queryKey: ['solve-access-dashboard'],
    queryFn: () => apiGet<{ success: boolean; data: any }>('/api/v1/solve-access/dashboard'),
    refetchInterval: 30000,
    retry: false,
  });
}

export function useSolveAccessTerminals() {
  return useQuery({
    queryKey: ['solve-access-terminals'],
    queryFn: () => apiGet<{ success: boolean; data: any }>('/api/v1/solve-access/terminais'),
    refetchInterval: 15000,
    retry: false,
  });
}

export function useSolveAccessClients(params?: { busca?: string; pagina?: number; por_pagina?: number }) {
  const qs = params ? '?' + new URLSearchParams(params as any).toString() : '';
  return useQuery({
    queryKey: ['solve-access-clients', params],
    queryFn: () => apiGet<{ success: boolean; data: any }>(`/api/v1/solve-access/clientes${qs}`),
    retry: false,
  });
}

export function useSolveAccessLogs(params?: { limite?: number; cliente_id?: number }) {
  const qs = params ? '?' + new URLSearchParams(params as any).toString() : '';
  return useQuery({
    queryKey: ['solve-access-logs', params],
    queryFn: () => apiGet<{ success: boolean; data: any }>(`/api/v1/solve-access/acessos${qs}`),
    refetchInterval: 10000,
    retry: false,
  });
}

export function useSolveAccessHealth() {
  return useQuery({
    queryKey: ['solve-access-health'],
    queryFn: () => apiGet<{ success: boolean; data: any; source: string }>('/api/v1/solve-access/health'),
    refetchInterval: 30000,
    retry: false,
  });
}

export function useUnlockTurnstile() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (tipo: 'entrada' | 'saida') =>
      apiPost<{ success: boolean; data: any }>(`/api/v1/solve-access/terminais/${tipo}/unlock`),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['solve-access-terminals'] });
    },
  });
}

// ─── SSE Real-time Stream ─────────────────────────────────────────────────────
export interface AccessStreamEvent {
  tipo: string;
  cliente_id: number;
  cliente_nome: string;
  tipo_acesso: string;
  resultado: string;
  mensagem: string;
  hora: string;
  data: string;
}

export function useSolveAccessStream(onEvent: (event: AccessStreamEvent) => void) {
  const [connected, setConnected] = useState(false);
  const [history, setHistory] = useState<AccessStreamEvent[]>([]);

  useEffect(() => {
    const es = new EventSource(`${API_BASE}/api/v1/access/stream`);

    es.onopen = () => setConnected(true);

    es.onmessage = (e) => {
      try {
        const data = JSON.parse(e.data);
        if (data.type === 'connected' && data.history) {
          setHistory(data.history);
        } else if (data.type === 'access' && data.data) {
          for (const event of data.data) {
            onEvent(event);
          }
          setHistory(prev => [...data.data, ...prev].slice(0, 50));
        }
      } catch {}
    };

    es.onerror = () => setConnected(false);

    return () => es.close();
  }, []);

  return { connected, history };
}
