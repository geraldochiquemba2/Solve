import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { useState, useEffect } from 'react';

const API_BASE = import.meta.env.VITE_API_URL || (import.meta.env.DEV ? 'http://localhost:3000' : '');

/** Lê o cookie `csrf` (legível por JS) para o devolver no header X-CSRF-Token. */
function readCsrfCookie(): string | null {
  if (typeof document === 'undefined') return null;
  for (const part of document.cookie.split(';')) {
    const eq = part.indexOf('=');
    if (eq < 0) continue;
    if (part.slice(0, eq).trim() !== 'csrf') continue;
    const raw = part.slice(eq + 1);
    try { return decodeURIComponent(raw); } catch { return raw; }
  }
  return null;
}

/** Header CSRF para pedidos que mudam estado (o servidor só o exige com sessão por cookie). */
function csrfHeader(): Record<string, string> {
  const token = readCsrfCookie();
  return token ? { 'X-CSRF-Token': token } : {};
}

function getHeaders(): HeadersInit {
  const token = localStorage.getItem('token');
  return {
    'Content-Type': 'application/json',
    ...(token ? { Authorization: `Bearer ${token}` } : {}),
    ...csrfHeader(),
  };
}


let _isHandling401 = false;

/** Opções de query aceites pelos hooks que não recebem parâmetros de rota. */
type OpcoesQuery = { refetchInterval?: number; staleTime?: number; enabled?: boolean };

async function handleUnauthorized() {
  if (_isHandling401) return;
  _isHandling401 = true;
  const token = localStorage.getItem('token');
  localStorage.removeItem('token');
  try {
    await fetch(`${API_BASE}/api/v1/auth/logout`, {
      method: 'POST',
      credentials: 'include',
    });
  } catch {}
  if (token) window.location.href = '/login';
}

async function apiGet<T>(path: string): Promise<T> {
  const res = await fetch(`${API_BASE}${path}`, { headers: getHeaders() });
  if (res.status === 401) { handleUnauthorized(); throw new Error('Não autenticado'); }
  if (!res.ok) {
    const err = await res.json().catch(() => ({ error: `API error: ${res.status}` }));
    const msg = err.error || `API error: ${res.status}`;
    throw new Error(err.details ? `${msg} (${err.details})` : msg);
  }
  return res.json();
}

async function apiMutate<T>(path: string, method: string, body?: unknown): Promise<T> {
  const res = await fetch(`${API_BASE}${path}`, {
    method,
    headers: getHeaders(),
    body: body ? JSON.stringify(body) : undefined,
  });
  if (res.status === 401) { handleUnauthorized(); throw new Error('Não autenticado'); }
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

export function useListAutomations(options?: OpcoesQuery) {
  return useQuery({
    queryKey: ['automations'],
    queryFn: () => apiGet<{ data: Automation[]; total: number }>('/api/v1/automations'),
    ...options,
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

export function useListAuditLogs(entity?: string, options?: { refetchInterval?: number; enabled?: boolean }) {
  const params = entity ? `?entity=${entity}` : '';
  return useQuery({
    queryKey: ['audit-logs', entity],
    queryFn: () => apiGet<{ data: AuditLog[]; total: number }>(`/api/v1/audit-logs${params}`),
    refetchInterval: options?.refetchInterval,
    // O endpoint exige papel admin/gestor: sem `enabled` o resto da equipa
    // fica a levar 403 a cada refetch.
    enabled: options?.enabled ?? true,
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
  loginCount?: number | null;
  createdAt: string;
  updatedAt: string;
}

export function useListUsersAll(options?: OpcoesQuery) {
  return useQuery({
    queryKey: ['users-all'],
    queryFn: () => apiGet<{ data: User[]; total: number }>('/api/v1/users'),
    ...options,
  });
}

export function useToggleUser() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (id: string) => apiMutate<{ data: User }>(`/api/v1/users/${id}/toggle`, 'PATCH'),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['users-all'] }),
  });
}

// ─── SSE Payment Stream ──────────────────────────────────────────────────────
export function usePaymentStream(onUpdate: (data: { code: string; status: string }) => void) {
  const [connected, setConnected] = useState(false);

  useEffect(() => {
    const apiBase = import.meta.env.VITE_API_URL || '';
    // Cookie httpOnly segue automaticamente (com credenciais em dev).
    const es = new EventSource(`${apiBase}/api/v1/payments/stream`, { withCredentials: true });

    es.onopen = () => setConnected(true);

    es.onmessage = (e) => {
      try {
        const data = JSON.parse(e.data);
        if (data.type === 'payment_updated') {
          onUpdate(data);
        }
      } catch {}
    };

    es.onerror = () => setConnected(false);

    return () => es.close();
  }, []);

  return { connected };
}

// ─── Cademi (plataforma de cursos) ─────────────────────────────────────────
export interface CademiHealth {
  connected: boolean;
  message: string;
  products?: number;
}

export function useCademiHealth() {
  return useQuery({
    queryKey: ['cademi-health'],
    queryFn: () => apiGet<CademiHealth>('/api/v1/cademi/health'),
    refetchInterval: 300000,
    retry: false,
  });
}

export function useCademiSync() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: () => apiPost<{ ok: boolean; cademiUsers: number; matched: number }>('/api/v1/cademi/sync'),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['cademi-users'] });
      qc.invalidateQueries({ queryKey: ['customers-manual'] });
    },
  });
}

export function usePay4AllHealth() {
  return useQuery({
    queryKey: ['pay4all-health'],
    queryFn: () => apiGet<{ data: { connected: boolean; message: string } }>('/api/v1/pay4all/health'),
    retry: false,
  });
}

export function useSaveSettings() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (settings: Record<string, string>) =>
      apiMutate<{ message: string }>('/api/v1/settings', 'PUT', { settings }),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['settings'] });
    },
  });
}

// ─── Customers (manual fallback) ────────────────────────────────────────────
export interface CustomerData {
  id: string; code: string; name: string; email: string; phone: string;
  company: string | null; nif: string | null; state: string; planName: string | null;
  subscriptionEnd: string | null; createdAt: string; updatedAt: string;
  gender?: string; entryDate?: string | null;
}

export function useListCustomersManual() {
  return useQuery({
    queryKey: ['customers-manual'],
    queryFn: () => apiGet<{ data: CustomerData[]; total: number }>('/api/v1/customers'),
    retry: false,
  });
}


// ─── Códigos promocionais ───────────────────────────────────────────────────
// `apps/api` (drizzle) devolve camelCase (`minAmount`, `startsAt`, `usageCount`);
// o `standalone-server` (produção) devolve as colunas em snake_case
// (`min_amount`, `starts_at`, `usage_count`). `normalizePromo` aceita as duas
// formas para o resto do UI só ver um formato.
export interface PromoCode {
  id: string;
  code: string;
  type: 'percent' | 'fixed';
  value: number;
  minAmount: number | null;
  maxDiscount: number | null;
  appliesTo: 'all' | 'plans';
  planIds: string[];
  usageLimit: number | null;
  usedCount: number;
  usageCount: number;
  perUser: boolean;
  active: boolean;
  startsAt: string | null;
  expiresAt: string | null;
  createdAt: string | null;
}

export interface PromoUsage {
  id: string;
  email: string | null;
  phone: string | null;
  payment_code: string | null;
  discount_applied: number | null;
  amount_before: number | null;
  amount_after: number | null;
  used_at: string | null;
  payment_status: string | null;
  payment_amount: number | null;
  customer_name: string | null;
}

const pick = (o: Record<string, any>, a: string, b: string) => {
  const v = o?.[a] ?? o?.[b];
  return v === undefined ? null : v;
};

export function normalizePromo(raw: any): PromoCode {
  const o = (raw ?? {}) as Record<string, any>;
  const usage = Number(pick(o, 'usageCount', 'usage_count') ?? 0);
  return {
    id: String(o.id ?? ''),
    code: String(o.code ?? ''),
    type: o.type === 'fixed' ? 'fixed' : 'percent',
    value: Number(o.value ?? 0),
    minAmount: numOrNull(pick(o, 'minAmount', 'min_amount')),
    maxDiscount: numOrNull(pick(o, 'maxDiscount', 'max_discount')),
    appliesTo: pick(o, 'appliesTo', 'applies_to') === 'plans' ? 'plans' : 'all',
    planIds: Array.isArray(pick(o, 'planIds', 'plan_ids')) ? (pick(o, 'planIds', 'plan_ids') as string[]) : [],
    usageLimit: numOrNull(pick(o, 'usageLimit', 'usage_limit')),
    usedCount: Number(pick(o, 'usedCount', 'used_count') ?? 0),
    usageCount: Number.isFinite(usage) ? usage : 0,
    perUser: pick(o, 'perUser', 'per_user') !== false,
    active: o.active !== false,
    startsAt: strOrNull(pick(o, 'startsAt', 'starts_at')),
    expiresAt: strOrNull(pick(o, 'expiresAt', 'expires_at')),
    createdAt: strOrNull(pick(o, 'createdAt', 'created_at')),
  };
}

function numOrNull(v: unknown): number | null {
  if (v === null || v === undefined || v === '') return null;
  const n = Number(v);
  return Number.isFinite(n) ? n : null;
}
function strOrNull(v: unknown): string | null {
  if (v === null || v === undefined || v === '') return null;
  return String(v);
}

export function useListPromos(options?: OpcoesQuery) {
  return useQuery({
    queryKey: ['promos'],
    queryFn: async () => {
      const json = await apiGet<{ data: any[]; total: number }>('/api/v1/promos');
      return { data: (json.data ?? []).map(normalizePromo), total: json.total ?? (json.data ?? []).length };
    },
    ...options,
  });
}

export function usePromoUsages(promoId: string | null, options?: OpcoesQuery) {
  return useQuery({
    queryKey: ['promos', promoId, 'usages'],
    queryFn: () => apiGet<{ data: PromoUsage[]; total: number }>(`/api/v1/promos/${promoId}/usages`),
    enabled: !!promoId && (options?.enabled ?? true),
    ...options,
  });
}

export function useCreatePromo() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (data: Record<string, unknown>) =>
      apiMutate<{ data: any }>('/api/v1/promos', 'POST', data),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['promos'] }),
  });
}

export function useUpdatePromo() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({ id, ...patch }: { id: string } & Record<string, unknown>) =>
      apiMutate<{ data: any }>(`/api/v1/promos/${id}`, 'PATCH', patch),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['promos'] }),
  });
}

export function useTogglePromo() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (id: string) => apiMutate<{ data: any }>(`/api/v1/promos/${id}/toggle`, 'PATCH'),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['promos'] }),
  });
}

export function useDeletePromo() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (id: string) => apiMutate<void>(`/api/v1/promos/${id}`, 'DELETE'),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['promos'] }),
  });
}

export interface PromoValidation {
  valid: boolean;
  reason?: string;
  discount?: number;
  original?: number;
  final?: number;
  type?: 'percent' | 'fixed';
  value?: number;
}

/** Valida um código contra um montante (endpoint público; nunca lança). */
export async function validatePromoCode(payload: {
  code: string;
  amount?: number;
  email?: string | null;
  phone?: string | null;
  cademi_produto?: string | null;
  plan_ids?: string[];
}): Promise<PromoValidation> {
  try {
    return await apiPost<PromoValidation>('/api/v1/promos/validate', payload);
  } catch (e: any) {
    return { valid: false, reason: e?.message || 'Erro ao validar o código' };
  }
}

// ─── SamoraFit Studio (ginásio) ─────────────────────────────────────────────
export interface StudioCustomer {
  id: string; externalId: string; customerNumber: string | null; name: string;
  phone: string | null; email: string | null; nif: string | null; status: string;
  gender: string | null; birthDate: string | null; notes: string | null;
  crmCustomerId: string | null; syncedAt: string;
}
export interface StudioPlan {
  id: string; externalId: string; name: string; price: number; enrollmentFee: number;
  renewalFee: number; planType: string | null; classesQuantity: number | null;
  validityMonths: number; active: boolean; syncedAt: string;
}
export interface StudioSubscription {
  id: string; externalId: string; customerExternalId: string; planExternalId: string;
  customerName?: string | null; planName?: string | null; startDate: string; endDate: string | null;
  price: number; classesQuantity: number | null; status: string; syncedAt: string;
}
export interface StudioPayment {
  id: string; externalId: string; customerExternalId: string | null; customerName?: string | null;
  amount: number; kind: string | null; paymentDate: string | null; paymentMethod: string | null;
  status: string; reference: string | null; notes: string | null; syncedAt: string;
}
export interface StudioInvoice {
  id: string; externalId: string; customerExternalId: string; customerName?: string | null;
  subscriptionExternalId: string | null; year: number | null; month: number | null;
  periodStart: string | null; periodEnd: string | null; amountDue: number; amountPaid: number;
  amountReleased: number; amountRemaining: number; status: string; dueDate: string | null;
  paidAt: string | null; isPartial: boolean; syncedAt: string;
}
export interface StudioRefund {
  id: string; externalId: string; paymentExternalId: string | null; customerExternalId: string | null;
  customerName?: string | null; amount: number; reason: string | null; status: string;
  refundedAt: string | null; syncedAt: string;
}
export interface StudioSnapshot {
  data: {
    customers: StudioCustomer[]; plans: StudioPlan[]; subscriptions: StudioSubscription[];
    payments: StudioPayment[]; invoices: StudioInvoice[]; refunds: StudioRefund[];
  };
}
export interface StudioOverview {
  data: {
    customers: { total: number; active: number };
    plans: { total: number; active: number };
    subscriptions: { total: number; active: number };
    payments: { total: number; amount: number; confirmed: number };
    invoices: { total: number; pending: number };
    refunds: { total: number; amount: number };
    lastSync: { started_at: string; status: string; received_count: number; upserted_count: number; error_count: number } | null;
  };
}
export function useStudioSnapshot(options?: OpcoesQuery) {
  return useQuery({
    queryKey: ['studio-snapshot'],
    queryFn: () => apiGet<StudioSnapshot>('/api/v1/integrations/samorafit-studio/snapshot?limit=200'),
    refetchInterval: 60000,
    ...options,
  });
}

export function useStudioOverview(options?: OpcoesQuery) {
  return useQuery({
    queryKey: ['studio-overview'],
    queryFn: () => apiGet<StudioOverview>('/api/v1/integrations/samorafit-studio/overview'),
    refetchInterval: 60000,
    ...options,
  });
}

export interface StudioKey {
  id: string; name: string; prefix: string; active: boolean;
  lastUsedAt: string | null; createdAt: string;
}

export function useStudioKeys(options?: OpcoesQuery) {
  return useQuery({
    queryKey: ['studio-keys'],
    queryFn: () => apiGet<{ data: StudioKey[]; total: number }>('/api/v1/integrations/samorafit-studio/keys'),
    ...options,
  });
}

export function useCreateStudioKey() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (name: string) =>
      apiPost<{ data: { id: string; name: string; key: string; prefix: string; createdAt: string } }>(
        '/api/v1/integrations/samorafit-studio/keys', { name }),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['studio-keys'] }),
  });
}

export function useRevokeStudioKey() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (id: string) => apiMutate<void>(`/api/v1/integrations/samorafit-studio/keys/${id}`, 'DELETE'),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['studio-keys'] }),
  });
}

