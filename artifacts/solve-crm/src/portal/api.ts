// Portal do Cliente — API client (sessão separada do staff).
// Staff usa localStorage 'token'/'samora_user'; portal usa 'portal_token'/'portal_customer'.
const API_BASE = import.meta.env.VITE_API_URL || '';

export const PORTAL_TOKEN_KEY = 'portal_token';
export const PORTAL_CUSTOMER_KEY = 'portal_customer';

export function getPortalToken(): string | null {
  try {
    return localStorage.getItem(PORTAL_TOKEN_KEY);
  } catch {
    return null;
  }
}

export function setPortalSession(token: string, customer: unknown) {
  localStorage.setItem(PORTAL_TOKEN_KEY, token);
  try {
    localStorage.setItem(PORTAL_CUSTOMER_KEY, JSON.stringify(customer ?? null));
  } catch {}
}

export function clearPortalSession() {
  localStorage.removeItem(PORTAL_TOKEN_KEY);
  localStorage.removeItem(PORTAL_CUSTOMER_KEY);
}

export function getPortalCustomer<T = any>(): T | null {
  try {
    const raw = localStorage.getItem(PORTAL_CUSTOMER_KEY);
    return raw ? (JSON.parse(raw) as T) : null;
  } catch {
    return null;
  }
}

/** Normaliza número AO: aceita 9XXXXXXXX, 2449XXXXXXXX, +2449XXXXXXXX → +2449XXXXXXXX */
export function normalizePhone(input: string): string {
  const digits = (input || '').replace(/\D/g, '');
  if (!digits) return '';
  if (digits.startsWith('244') && digits.length === 12) return `+${digits}`;
  if (digits.length === 9 && digits.startsWith('9')) return `+244${digits}`;
  // fallback: prefixa +244 se forem 9 dígitos mesmo sem começar por 9
  if (digits.length === 9) return `+244${digits}`;
  if (digits.startsWith('244')) return `+${digits}`;
  return `+${digits}`;
}

export function isValidAONumber(input: string): boolean {
  const digits = (input || '').replace(/\D/g, '');
  const local = digits.startsWith('244') ? digits.slice(3) : digits;
  return /^9\d{8}$/.test(local);
}

export async function fetchPortal<T = any>(path: string, opts: RequestInit = {}): Promise<T> {
  const token = getPortalToken();
  const res = await fetch(`${API_BASE}${path}`, {
    ...opts,
    headers: {
      'Content-Type': 'application/json',
      ...(token ? { Authorization: `Bearer ${token}` } : {}),
      ...(opts.headers || {}),
    },
  });
  const json = await res.json().catch(() => ({}));
  if (res.status === 401) {
    clearPortalSession();
    throw new Error((json as any).error || 'Sessão expirada. Faz login de novo.');
  }
  if (!res.ok) throw new Error((json as any).error || `Erro ${res.status}`);
  // aceita { data } ou corpo directo
  return ((json as any).data !== undefined ? (json as any).data : json) as T;
}

// ─── OTP ─────────────────────────────────────────────
export interface RequestOtpResult {
  ok: boolean;
  /** devolve código em ambiente dev para testes sem WhatsApp */
  devCode?: string;
  expiresIn?: number;
}

export function requestOtp(phone: string): Promise<RequestOtpResult> {
  return fetchPortal<RequestOtpResult>('/api/v1/portal/otp/request', {
    method: 'POST',
    body: JSON.stringify({ phone: normalizePhone(phone) }),
  });
}

export interface VerifyOtpResult {
  token: string;
  customer: PortalCustomer;
  devCode?: string;
}

export function verifyOtp(phone: string, code: string): Promise<VerifyOtpResult> {
  return fetchPortal<VerifyOtpResult>('/api/v1/portal/otp/verify', {
    method: 'POST',
    body: JSON.stringify({ phone: normalizePhone(phone), code: code.trim() }),
  });
}

// ─── Conta / Pagamentos ──────────────────────────────
export interface PortalCustomer {
  id?: string;
  code?: string;
  name: string;
  phone?: string;
  plan?: string;
  planName?: string;
  planValidity?: string | null;
  subscriptionEnd?: string | null;
  status?: string;
  state?: string;
  client_status?: string;
  lessonsLeft?: number | null;
  numero_entradas?: number | null;
  lessonsLimit?: number | null;
  limite_entradas?: number | null;
  nextAmount?: number | null;
  nextDueDate?: string | null;
  proxima_mensalidade?: number | null;
  vencimento?: string | null;
  referencia?: string | null;
  reference_code?: string | null;
  entidade?: string | null;
  entity?: string | null;
  [k: string]: any;
}

export interface PortalPayment {
  id?: string;
  code?: string;
  amount?: number;
  method?: string;
  status?: string;
  state?: string;
  reference_code?: string | null;
  referencia?: string | null;
  entity?: string | null;
  entidade?: string | null;
  created_at?: string;
  paid_at?: string | null;
  date?: string;
  [k: string]: any;
}

// GET /api/v1/portal/minha-conta → { customer, subscription, aulas, proximaMensalidade }
export interface MinhaContaResponse {
  customer: { id: string; name: string; phone?: string | null; state?: string };
  subscription: {
    id: string;
    planName?: string | null;
    price?: number | null;
    periodicity?: string | null;
    endDate?: string | null;
    active?: boolean;
  } | null;
  aulas: { usadas: number; limite: number | null; restantes: number | null; fonte: string };
  proximaMensalidade: { amount: number; dueDate: string } | null;
}

export function getMinhaConta(): Promise<MinhaContaResponse> {
  return fetchPortal<MinhaContaResponse>('/api/v1/portal/minha-conta');
}

export function listPagamentos(limit = 20): Promise<PortalPayment[]> {
  return fetchPortal<any>(`/api/v1/portal/pagamentos?limit=${limit}`).then((d: any) =>
    Array.isArray(d) ? d : (d?.payments ?? d?.items ?? d?.rows ?? []),
  );
}

// POST /api/v1/portal/pagar { method: 'express' | 'referencia', subscriptionId? }
export interface PagarResult {
  payment: { id: string; code: string; status: string; amount: number };
  express: { initiated: boolean } | null;
  referencia: { entity: string | null; reference: string; expiresAt: string } | null;
}

export function pagar(method: 'express' | 'referencia', subscriptionId?: string, phoneNumber?: string): Promise<PagarResult> {
  return fetchPortal<PagarResult>('/api/v1/portal/pagar', {
    method: 'POST',
    body: JSON.stringify({ method, ...(subscriptionId ? { subscriptionId } : {}), ...(phoneNumber?.trim() ? { phoneNumber: phoneNumber.trim() } : {}) }),
  });
}

// GET /api/v1/portal/recibos/:id (id = payment UUID) → { payment, customer, subscription }
export interface ReciboResponse {
  payment: PortalPayment;
  customer: { id: string; name: string; phone?: string | null; email?: string | null } | null;
  subscription: {
    id: string;
    planName?: string | null;
    price?: number | null;
    periodicity?: string | null;
    startDate?: string | null;
    endDate?: string | null;
    active?: boolean;
  } | null;
}

export function getRecibo(id: string): Promise<ReciboResponse> {
  return fetchPortal<ReciboResponse>(`/api/v1/portal/recibos/${encodeURIComponent(id)}`);
}
