import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { useMemo, useState, useEffect } from 'react';

const API_BASE = import.meta.env.VITE_API_URL || '';
const ACCESS_API = import.meta.env.VITE_ACCESS_API_URL || 'https://solve-sqoh.onrender.com';
const ACCESS_API_KEY = import.meta.env.VITE_ACCESS_API_KEY || "";

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

function getAccessHeaders(): HeadersInit {
  // SEGURANÇA Set/2026: staff logado usa o JWT (Bearer); X-API-Key só recurso.
  try {
    const token = localStorage.getItem('token');
    if (token) return { 'Content-Type': 'application/json', Authorization: `Bearer ${token}`, ...csrfHeader() };
  } catch {}
  return {
    'Content-Type': 'application/json',
    'X-API-Key': ACCESS_API_KEY,
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
  if (!res.ok) throw new Error(`API error: ${res.status}`);
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

async function accessGet<T>(path: string): Promise<T> {
  const res = await fetch(`${ACCESS_API}${path}`, { headers: getAccessHeaders() });
  if (!res.ok) throw new Error(`Access API error: ${res.status}`);
  return res.json();
}

async function accessPost<T>(path: string, body?: unknown): Promise<T> {
  const res = await fetch(`${ACCESS_API}${path}`, {
    method: 'POST',
    headers: getAccessHeaders(),
    body: body ? JSON.stringify(body) : undefined,
  });
  if (!res.ok) throw new Error(`Access API error: ${res.status}`);
  return res.json();
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

// ─── Solve Access ────────────────────────────────────────────────────────────
// Formas de resposta derivatives das queries em `standalone-server/index.js`
// (`/api/v1/access/stats` e `/api/v1/access/logs`). `cliente_nome` e
// `hora_acesso` são anuláveis porque ambas as queries usam LEFT JOIN.
export interface AccessStats {
  clients: { total: number; active: number; online: number; blocked: number };
  accesses: { today: number; month: number; authorizedToday: number; deniedToday: number };
  recentAccesses: Array<{
    id_acesso: number; cliente_id: number; cliente_nome: string | null;
    data_acesso: string; hora_acesso: string | null; tipo_acesso: string;
    resultado: string; motivo: string | null;
  }>;
  accessByDay: unknown[];
  peakHours: Array<{ hour: number; count: number }>;
}

export interface AccessLog {
  id_acesso: number; cliente_id: number; cliente_nome: string | null;
  data_acesso: string; hora_acesso: string | null;
  tipo_acesso: string; resultado: string; motivo: string | null;
}

export interface AccessLogsResponse {
  data: AccessLog[];
  pagination: { page: number; limit: number; total: number; totalPages: number };
}

export function useAccessStats() {
  return useQuery({
    queryKey: ['access-stats'],
    queryFn: () => fetch(`${ACCESS_API}/api/v1/access/stats`, { headers: getAccessHeaders() })
      .then(r => r.json() as Promise<{ success: boolean; data: AccessStats }>),
    refetchInterval: 300000,
    retry: false,
  });
}

export function useAccessLogs(params?: { client_id?: string; resultado?: string; tipo_acesso?: string; date_from?: string; date_to?: string; search?: string; page?: number; limit?: number }) {
  const filtered = params ? Object.fromEntries(Object.entries(params).filter(([_, v]) => v != null && v !== '')) : {};
  const qs = Object.keys(filtered).length > 0 ? '?' + new URLSearchParams(filtered as any).toString() : '';
  return useQuery({
    queryKey: ['access-logs', params],
    queryFn: () => accessGet<AccessLogsResponse>(`/api/v1/access/logs${qs}`),
    refetchInterval: 180000,
    retry: false,
  });
}

// Solve Access (Terminal Control) — calls Render standalone server directly
export function useSolveAccessDashboard() {
  return useQuery({
    queryKey: ['solve-access-dashboard'],
    queryFn: () => accessGet<{ success: boolean; data: any }>('/api/v1/access/stats'),
    refetchInterval: 180000,
    retry: false,
  });
}

export function useSolveAccessTerminals() {
  return useQuery({
    queryKey: ['solve-access-terminals'],
    queryFn: () => accessGet<{ success: boolean; data: any }>('/api/v1/terminal/status'),
    refetchInterval: 180000, // fase Cademi-CRM: sem ginásio, polling reduzido (cota Neon)
    retry: false,
  });
}

export function useSolveAccessHealth() {
  return useQuery({
    queryKey: ['solve-access-health'],
    queryFn: () => accessGet<{ success: boolean; data: any; source: string }>('/healthz'),
    refetchInterval: 180000,
    retry: false,
  });
}

export function useUnlockTurnstile() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (tipo: 'entrada' | 'saida') =>
      accessPost<{ success: boolean; data: any }>(`/api/v1/terminal/unlock`, { tipo }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['solve-access-terminals'] });
    },
  });
}

// ─── OVG on-demand (zona de Clientes) ─────────────────────────────────────────
// Liga o OVG sem polling de fundo (cota Neon): atualiza ao entrar nos Clientes,
// no máximo 1x/hora (travão por lastSync do espelho). Botão manual força sempre.
const OVG_REFRESH_MIN_MS = 60 * 60 * 1000;

export function useOVGClientsRefresh(onRefreshed?: () => void) {
  const [checking, setChecking] = useState(true);
  const [updating, setUpdating] = useState(false);
  const [lastSync, setLastSync] = useState<string | null>(null);
  const [total, setTotal] = useState<number | null>(null);
  const [msg, setMsg] = useState('');
  // Servidor bloqueado pelo OVG (ex.: Render): não insistir no auto-sync a cada visita.
  // Guardado por origem — o flag do site não afeta o localhost e vice-versa.
  const [blocked, setBlocked] = useState(() => {
    try { return localStorage.getItem('ovg-server-blocked') === '1'; } catch { return false; }
  });
  const markBlocked = (on: boolean) => {
    setBlocked(on);
    try {
      if (on) localStorage.setItem('ovg-server-blocked', '1');
      else localStorage.removeItem('ovg-server-blocked');
    } catch {}
  };

  const refreshNow = async () => {
    setUpdating(true); setMsg('');
    try {
      // Backend local (mesmo API_BASE do login): o Render está bloqueado pelo OVG (success:0).
      const r = await apiPost<{ ok: boolean; upserted: number; total: number }>('/api/v1/access/ovg-reseed', {});
      setLastSync(new Date().toISOString());
      setTotal(r.total ?? r.upserted ?? null);
      setMsg(`${r.upserted ?? r.total ?? 0} sócios atualizados do OVG`);
      markBlocked(false);
      onRefreshed?.();
    } catch (e: any) {
      const raw = e.message || 'erro';
      // OVG pode recusar login fora da rede autorizada — sync corre no PC local, sem mostrar aviso.
      if (raw.includes('no token')) {
        markBlocked(true);
        setMsg('');
      } else {
        setMsg('OVG indisponível: ' + raw);
      }
    } finally { setUpdating(false); }
  };

  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const st = await apiGet<{ total: number; lastSync: string | null }>('/api/v1/access/ovg-status');
        if (cancelled) return;
        setLastSync(st.lastSync);
        setTotal(st.total ?? null);
        setChecking(false);
        let isBlocked = false;
        try { isBlocked = localStorage.getItem('ovg-server-blocked') === '1'; } catch {}
        if (isBlocked) return; // servidor bloqueado: só manual, sem martelar o OVG
        const age = st.lastSync ? Date.now() - new Date(st.lastSync).getTime() : Infinity;
        if (age > OVG_REFRESH_MIN_MS) await refreshNow();
      } catch { if (!cancelled) setChecking(false); }
    })();
    return () => { cancelled = true; };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  return { checking, updating, lastSync, total, msg, refreshNow, clearMsg: () => setMsg('') };
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
    // VULN-16: sem ?api_key= no URL (vazava em logs). O cookie httpOnly
    // segue automaticamente (mesma origem em prod; withCredentials em dev).
    const es = new EventSource(`${ACCESS_API}/api/v1/access/stream`, { withCredentials: true });

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

// ─── OVG Sync ────────────────────────────────────────────────────────────────
export interface OVGSyncStatus {
  isSyncing: boolean;
  lastSync: {
    created: number;
    updated: number;
    skipped: number;
    errors: string[];
    timestamp: string;
  } | null;
  nextSyncIn: number;
}

export function useOVGSyncStatus() {
  return useQuery({
    queryKey: ['ovg-sync-status'],
    queryFn: () => apiGet<{ data: OVGSyncStatus }>('/api/v1/ovg/sync/status'),
    refetchInterval: 300000, // fase Cademi-CRM: módulo ginásio desligado (cota Neon)
    retry: false,
  });
}

export function useOVGSyncNow() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: () => apiPost<{ data: any; message: string }>('/api/v1/ovg/sync/now'),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['ovg-sync-status'] });
      qc.invalidateQueries({ queryKey: ['integrations'] });
    },
  });
}

export function useOVGHealth() {
  return useQuery({
    queryKey: ['ovg-health'],
    queryFn: () => apiGet<{ data: { connected: boolean; message: string; details?: string } }>('/api/v1/ovg/health'),
    refetchInterval: 300000,
    retry: false,
  });
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
  ovgId: string | null; cademiId: string | null; leadId: string | null;
  gender?: string; entryDate?: string | null;
}

export function useListCustomersManual() {
  const apiQuery = useQuery({
    queryKey: ['customers-manual'],
    queryFn: () => apiGet<{ data: CustomerData[]; total: number }>('/api/v1/customers'),
    retry: false,
  });
  const accessQuery = useQuery({
    queryKey: ['customers-access'],
    queryFn: () => accessGet<{ data: Array<{ id_cliente: number; nome: string; ultimo_acesso: string; total_acessos: number; acessos_autorizados: number; acessos_negados: number; ovg_sex: string; ovg_email: string; ovg_phone: string; ovg_nif: string; ovg_status: string; ovg_last_entry: string; ovg_entry_date: string }>; total: number }>('/api/v1/access/clients'),
    refetchInterval: 180000,
    retry: false,
  });
  // Espelho OVG (304 sócios): 3ª fonte da fusão — sem ela a lista só mostra o Cademi.
  const ovgQuery = useQuery({
    queryKey: ['customers-ovg'],
    queryFn: () => apiGet<{ data: any[]; total: number }>('/api/v1/ovg/members'),
    retry: false,
  });
  return useMemo(() => {
    const apiCustomers = apiQuery.data?.data ?? [];
    const accessCustomers = (accessQuery.data?.data ?? []).map((c: any) => ({
      id: String(c.id_cliente),
      code: String(c.id_cliente),
      name: c.nome ?? '',
      email: c.ovg_email ?? '',
      phone: c.ovg_phone ?? '',
      company: '',
      nif: c.ovg_nif ?? null,
      state: c.ovg_status === 'ATIVO' ? 'activo' : c.ovg_status === 'INATIVO' ? 'inactivo' : (c.acessos_negados > c.acessos_autorizados) ? 'em_atraso' : 'activo',
      planName: null,
      subscriptionEnd: null,
      createdAt: c.ultimo_acesso || c.ovg_last_entry || '',
      updatedAt: c.ultimo_acesso || '',
      ovgId: String(c.id_cliente),
      cademiId: null,
      leadId: null,
      gender: c.ovg_sex || '',
      entryDate: c.ovg_entry_date || null,
      numero_entradas: c.numero_entradas ?? null,
      limite_entradas: c.limite_entradas ?? null,
      _accessStats: { total: c.total_acessos, autorizados: c.acessos_autorizados, negados: c.acessos_negados, ultimoAcesso: c.ultimo_acesso },
    }));
    const seen = new Set(apiCustomers.map((c: CustomerData) => String(c.id)));
    const seenContact = new Set(apiCustomers.flatMap((c: CustomerData) => [String(c.email || '').toLowerCase(), String(c.phone || '').replace(/\D/g, '').slice(-9)].filter(Boolean)));
    const merged = [...apiCustomers, ...accessCustomers.filter((c: any) => !seen.has(String(c.id)))];
    // OVG: entra se email+telefone ainda não existirem (evita duplicar quem já é cliente Cademi)
    const ovgCustomers = ((ovgQuery.data?.data ?? []) as any[]).map((o: any) => ({
      id: `ovg-${o.customer_number}`,
      code: String(o.customer_number ?? ''),
      name: o.name ?? '',
      email: o.email ?? '',
      phone: o.mobile_number ?? '',
      company: '',
      nif: o.nif ?? null,
      state: o.status === 'ATIVO' ? 'activo' : o.status === 'INATIVO' ? 'inactivo' : 'activo',
      planName: null,
      subscriptionEnd: null,
      createdAt: o.last_entry || o.entry_date || '',
      updatedAt: o.synced_at || '',
      ovgId: String(o.customer_number ?? ''),
      cademiId: null,
      leadId: null,
      gender: o.sex || '',
      club: o.club ?? null,
      entryDate: o.entry_date || null,
    })).filter((c: any) => {
      const em = String(c.email || '').toLowerCase();
      const ph = String(c.phone || '').replace(/\D/g, '').slice(-9);
      return !(em && seenContact.has(em)) && !(ph && seenContact.has(ph));
    });
    const mergedAll = [...merged, ...ovgCustomers];
    return { data: { data: mergedAll, total: mergedAll.length }, isLoading: apiQuery.isLoading || accessQuery.isLoading || ovgQuery.isLoading, refetch: () => { apiQuery.refetch(); accessQuery.refetch(); ovgQuery.refetch(); } };
  }, [apiQuery.data, accessQuery.data, ovgQuery.data, apiQuery.isLoading, accessQuery.isLoading, ovgQuery.isLoading]);
}

export function useImportCustomerDates() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (rows: Array<{ code?: string; ovg_id?: string; name?: string; joined_at?: string }>) =>
      apiMutate<{ data: { updated: number; notFound: number; errors: string[]; total: number }; message: string }>(
        '/api/v1/customers/import-dates', 'POST', { rows }
      ),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['customers-manual'] });
    },
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
