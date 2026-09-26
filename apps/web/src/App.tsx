import { useEffect, useMemo, useRef, useState, type ReactNode } from 'react';
import { QueryClient, QueryClientProvider, useQueryClient } from '@tanstack/react-query';
import { ErrorBoundary } from '@/components/error-boundary';
import { Toaster } from '@/components/ui/toaster';
import { TooltipProvider } from '@/components/ui/tooltip';
import {
  Activity, AlertTriangle, ArrowDownRight, ArrowUpRight, BookOpen, Boxes,
  BriefcaseBusiness, Building2, Check, CheckCircle2, ChevronDown, ChevronRight,
  CircleDollarSign, Clock3, Code2, Command, CreditCard, Database, Edit3, Eye,
  FileClock, FileKey2, Filter, HeartPulse, History, KeyRound, LayoutDashboard,
  LifeBuoy, Link2, ListFilter, LockKeyhole, LogOut, Menu, MessageCircle, MoreHorizontal,
  Package, Pause, PhoneCall, Play, Plus, RefreshCw, Search, Settings, ShieldCheck,
  SlidersHorizontal, Sparkles, Target, ToggleLeft, ToggleRight, Trash2,
  TrendingUp, Upload, UserRound, Users, WalletCards, Webhook, X, Zap
} from 'lucide-react';
import { Link, Route, Switch, useLocation, useParams, Router as WouterRouter } from 'wouter';
import { useAuth } from '@/hooks/use-auth';
import '@/lib/api';

// Landing page
import LandingLayout from '@/landing/LandingLayout';
import LandingLogin from '@/landing/Login';
import FitStudio from '@/landing/FitStudio';
// Portal do Cliente (/conta/*) — sessão separada (portal_token), OTP via WhatsApp
import ContaLogin from '@/portal/ContaLogin';
import MinhaConta from '@/portal/MinhaConta';
import PortalPagamentos from '@/portal/Pagamentos';
import PortalRecibo from '@/portal/Recibo';
import PortalShell from '@/portal/PortalShell';
import { useListAutomations, useCreateAutomation, useToggleAutomation, useDeleteAutomation, useListAuditLogs, useGetSettings, useUpdateSettings, useListUsersAll, useToggleUser, useAccessStats, useAccessLogs, useSolveAccessDashboard, useSolveAccessTerminals, useSolveAccessHealth, useUnlockTurnstile, useSolveAccessStream, useOVGClientsRefresh, useOVGSyncStatus, useOVGSyncNow, useOVGHealth, useCademiHealth, useCademiSync, usePay4AllHealth, useSaveSettings, useListCustomersManual, useImportCustomerDates, usePaymentStream } from '@/hooks/use-api';
import {
  useListLeads,
  useGetDashboardStats,
  useGetDashboardCharts,
  useListPlans,
  useListIntegrations,
  useListUsers,
  useCreateLead,
  useUpdateLead,
  useCreateCustomer,
  useListWebhooks,
} from '@workspace/api-client-react';
import type { Lead as ApiLead, Plan as ApiPlan, Payment as ApiPayment, Integration as ApiIntegration, User as ApiUser } from '@workspace/api-client-react';

const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      // Quota Neon: sem refetch ao focar/voltar à rede; cada ecrã gere o seu intervalo
      refetchOnWindowFocus: false,
      refetchOnReconnect: false,
    },
  },
});

type Lead = { id: string; name: string; company: string; source: string; status: string; statusApi?: string; owner: string; value: number; last: string; email: string; phone: string; notes: string; code: string; createdAt: string; whatsapp?: string | null; produtoInteresse?: string | null; proximoContato?: string | null; motivoPerda?: string | null; contactosTotal?: number | null; ultimoContactoAt?: string | null; ultimoResultado?: string | null; ultimoStaff?: string | null };
type Customer = { id: string; name: string; company: string; plan: string; state: string; joined: string; expires: string; email: string; phone: string; gender: string; nif?: string | null; club?: string | null; ovgId?: string | null; cademiId?: string | null; entryDate?: string | null; lessonsLeft?: number | null; lessonsLimit?: number | null; _accessStats?: { total: number; autorizados: number; negados: number; ultimoAcesso: string } | null };

const LEAD_API_TO_PT: Record<string, string> = { novo_lead: 'Novo Lead', contacto: 'Novo Lead', qualificado: 'Qualificação', proposta: 'Proposta', negociacao: 'Negociação', convertido: 'Convertido', perdido: 'Perdido' };
const LEAD_PT_TO_API: Record<string, string> = { 'Novo Lead': 'novo_lead', 'Qualificação': 'qualificado', 'Proposta': 'proposta', 'Negociação': 'negociacao', 'Convertido': 'convertido', 'Perdido': 'perdido' };

function mapApiLead(l: ApiLead): Lead {
  return {
    id: l.id ?? '',
    name: l.name ?? '',
    company: l.company ?? '',
    source: l.source ?? '',
    status: LEAD_API_TO_PT[l.status ?? ''] ?? l.status ?? '',
    owner: l.ownerId ?? '',
    value: l.estimatedValue ?? 0,
    last: l.updatedAt ?? '',
    email: l.email ?? '',
    phone: l.phone ?? '',
    notes: l.notes ?? '',
    code: l.code ?? '',
    createdAt: l.createdAt ?? '',
    statusApi: l.status ?? '',
    whatsapp: (l as any).whatsapp ?? null,
    produtoInteresse: (l as any).produtoInteresse ?? null,
    proximoContato: (l as any).proximoContato ?? null,
    motivoPerda: (l as any).motivoPerda ?? null,
    contactosTotal: (l as any).contactosTotal ?? null,
    ultimoContactoAt: (l as any).ultimoContactoAt ?? null,
    ultimoResultado: (l as any).ultimoResultado ?? null,
    ultimoStaff: (l as any).ultimoStaff ?? null,
  };
}

// Seguimento de leads: rótulos curtos (ficha) e valores API.
const TRACK_PT: Record<string, string> = { novo_lead: 'Nova', contacto: 'Contactada', qualificado: 'Em acompanhamento', proposta: 'Proposta', negociacao: 'Negociação', convertido: 'Convertida', perdido: 'Perdida' };
const TRACK_LABEL_TO_API: Record<string, string> = { 'Nova': 'novo_lead', 'Contactada': 'contacto', 'Em acompanhamento': 'qualificado', 'Proposta': 'proposta', 'Negociação': 'negociacao', 'Convertida': 'convertido', 'Perdida': 'perdido' };
const TRACK_FICHA_OPTS = ['Nova', 'Contactada', 'Em acompanhamento', 'Proposta', 'Negociação', 'Convertida', 'Perdida'];
const LEAD_CANAIS = ['WhatsApp', 'Telefone', 'SMS', 'Presencial', 'E-mail'];
const LEAD_RESULTADOS = ['Não respondeu', 'Interessado', 'Pediu mais informações', 'Pediu para contactar depois', 'Não tem interesse', 'Converteu', 'Número inválido'];
const LEAD_PASSOS = ['Contactar amanhã', 'Contactar em 3 dias', 'Contactar em 7 dias', 'Sem próximo contacto', 'Agendar visita'];
// Campanhas/origens: normaliza values API → rótulo PT legível (filtro + tabelas + ficha).
const LEAD_SOURCE_ALIASES: Record<string, string> = {
  fit90_landing: 'Fit90 Landing',
  bruno_samora_landing: 'Landing Bruno Samora',
  bruno_samora: 'Landing Bruno Samora',
  'landing page bruno samora': 'Landing Bruno Samora',
  website: 'Website',
  whatsapp: 'WhatsApp',
  indicacao: 'Indicação',
  'indicação': 'Indicação',
  ovg: 'OVG',
  linkedin: 'LinkedIn',
  balcao: 'Balcão',
  'balcão': 'Balcão',
};
const srcLabel = (s?: string | null) => { const k = String(s || '').toLowerCase().trim(); return k ? (LEAD_SOURCE_ALIASES[k] ?? s!) : '—'; };
// Sugestões para o campo Origem (input livre — o gestor pode adicionar novas campanhas).
const LEAD_SOURCE_SUGG = ['Website', 'WhatsApp', 'Indicação', 'OVG', 'LinkedIn', 'Fit90 Landing', 'Landing Bruno Samora', 'Balcão'];

// Fetch autenticado para seguimento de leads (Bearer staff; recurso X-API-Key).
const leadApiBase = () => import.meta.env.VITE_API_URL || '';
function leadHeaders(): HeadersInit {
  try {
    const t = localStorage.getItem('token');
    if (t) return { Authorization: `Bearer ${t}`, 'Content-Type': 'application/json' };
  } catch {}
  return { 'X-API-Key': import.meta.env.VITE_ACCESS_API_KEY || "", 'Content-Type': 'application/json' };
}
async function leadFetch(path: string, opts: RequestInit = {}) {
  const r = await fetch(`${leadApiBase()}${path}`, { ...opts, headers: { ...leadHeaders(), ...(opts.headers || {}) } });
  const j = await r.json().catch(() => null);
  if (!r.ok) throw new Error(j?.error || `Erro ${r.status}`);
  return j;
}

// SEGURANÇA Set/2026: staff logado usa o JWT (Bearer); X-API-Key só como
// recurso (máquinas/scripts). Antes cada página mandava só a chave de env —
// vazia na build do Render → 401 silencioso → tabelas a zeros.
function authHeaders(extra: HeadersInit = {}): HeadersInit {
  try {
    const t = localStorage.getItem('token');
    if (t) return { Authorization: `Bearer ${t}`, 'Content-Type': 'application/json', ...extra };
  } catch {}
  return { 'X-API-Key': import.meta.env.VITE_ACCESS_API_KEY || "", 'Content-Type': 'application/json', ...extra };
}

// Telefone → wa.me (AO: 9 dígitos ganham 244) e tel:.
const waDigits = (p?: string | null) => {
  const d = String(p || '').replace(/\D/g, '');
  if (d.length === 9) return '244' + d;
  if (d.length === 12 && d.startsWith('244')) return d;
  return d.length >= 9 ? d : '';
};
const waLink = (p?: string | null) => { const d = waDigits(p); return d ? `https://wa.me/${d}` : ''; };
const fmtDateShort = (d?: string | null) => { if (!d) return '—'; try { return new Date(d.length <= 10 ? d + 'T12:00:00' : d).toLocaleDateString('pt-AO', { day: '2-digit', month: 'short' }); } catch { return d; } };
const passoParaDataLocal = (passo: string) => {
  const d = new Date();
  if (passo === 'Contactar amanhã') d.setDate(d.getDate() + 1);
  else if (passo === 'Contactar em 3 dias') d.setDate(d.getDate() + 3);
  else if (passo === 'Contactar em 7 dias') d.setDate(d.getDate() + 7);
  else return '';
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
};

function mapApiCustomer(c: any): Customer {
  const formatDate = (d: string | null) => {
    if (!d) return '';
    try { return new Date(d).toLocaleDateString('pt-AO', { day: '2-digit', month: 'short', year: 'numeric' }); } catch { return d; }
  };
  const relativeDate = (d: string | null) => {
    if (!d) return '';
    try {
      const diff = Math.floor((Date.now() - new Date(d).getTime()) / 86400000);
      if (diff <= 0) return 'Hoje';
      if (diff === 1) return 'Ontem';
      if (diff < 7) return `H\u00e1 ${diff} dias`;
      if (diff < 30) return `H\u00e1 ${Math.floor(diff / 7)} sem.`;
      return formatDate(d);
    } catch { return formatDate(d); }
  };
  const isAccessClient = !!c._accessStats;
  const joinedRaw: string | null = c.joinedAt ?? c.subscriptionEnd ?? c.createdAt ?? null;
  let joined = '';
  if (isAccessClient && c.entryDate) {
    joined = formatDate(c.entryDate);
  } else if (isAccessClient && c._accessStats?.ultimoAcesso) {
    joined = relativeDate(c._accessStats.ultimoAcesso);
  } else if (c.entryDate) {
    joined = formatDate(c.entryDate);
  } else if (c.joinedAt) {
    joined = relativeDate(c.joinedAt);
  } else if (c.subscriptionEnd) {
    const endDate = new Date(c.subscriptionEnd);
    endDate.setDate(endDate.getDate() - 30);
    joined = relativeDate(endDate.toISOString());
  } else if (c.createdAt) {
    joined = relativeDate(c.createdAt);
  }
  const rawState = (c.state ?? '').toString().toLowerCase();
  const fallbackState = (c.client_status ?? '').toString().toLowerCase();
  const normState = rawState || fallbackState;
  const isBlocked = c.bloqueado === true;
  // OVG usa ortografia brasileira (ativo/inativo, sem C); acesso local usa europeia (activo)
  const isActive = normState === 'activo' || normState === 'ativo';
  const isInactive = normState === 'inactivo' || normState === 'inativo';
  return {
    id: c.code ?? c.id ?? '',
    name: c.name ?? '',
    company: c.company ?? '',
    plan: isAccessClient ? 'Solve Access' : (c.planName ?? ''),
    state: isBlocked ? 'Bloqueado' : isActive ? 'Activo' : isInactive ? 'Inactivo' : normState === 'em_atraso' ? 'Em atraso' : normState === 'suspenso' ? 'Suspenso' : (c.state || c.client_status || 'Activo'),
    joined,
    expires: isAccessClient ? '' : formatDate(c.subscriptionEnd ?? null),
    email: c.email ?? '',
    phone: c.phone ?? '',
    gender: c.gender === 'M' ? 'Masculino' : c.gender === 'F' ? 'Feminino' : c.gender ?? '',
    nif: c.nif ?? null,
    club: c.club ?? null,
    ovgId: c.ovgId ?? null,
    cademiId: c.cademiId ?? null,
    entryDate: c.entryDate ?? null,
    lessonsLeft: c.numero_entradas ?? c.lessonsLeft ?? null,
    lessonsLimit: c.limite_entradas ?? c.lessonsLimit ?? null,
    _accessStats: c._accessStats ?? null,
  };
}

const navGroups = [
  { label: 'Visão geral', items: [{ href: '/admin', label: 'Dashboard', icon: LayoutDashboard }] },
  { label: 'Operação comercial', items: [{ href: '/admin/leads', label: 'Leads', icon: Target }, { href: '/admin/pipeline', label: 'Funil', icon: Filter }, { href: '/admin/clientes', label: 'Clientes', icon: Building2 }] },
  { label: 'Receita e acesso', items: [{ href: '/admin/pagamentos', label: 'Pagamentos', icon: WalletCards }] },
   { label: 'Ecossistema', items: [{ href: '/admin/academia', label: 'SamoraFit Workout', icon: BookOpen }, { href: '/admin/integracoes', label: 'Integrações', icon: Link2 }] },
];

const money = (n: number) => new Intl.NumberFormat('pt-AO', { style: 'currency', currency: 'AOA', maximumFractionDigits: 0 }).format(n);

// Tempo relativo para estados de sincronização (evita ISO cru no UI).
const fmtRel = (d?: string | null) => {
  if (!d) return 'Nunca';
  try {
    const ms = Date.now() - new Date(d).getTime();
    if (Number.isNaN(ms) || ms < 0) return 'Nunca';
    const min = Math.floor(ms / 60000);
    if (min < 1) return 'agora mesmo';
    if (min < 60) return `há ${min} min`;
    const h = Math.floor(min / 60);
    if (h < 48) return `há ${h} h`;
    return new Date(d).toLocaleDateString('pt-AO', { day: '2-digit', month: 'short' });
  } catch { return 'Nunca'; }
};

// Descrições das integrações vindas da API (evita ecoar o nome).
const INTEGRATION_DESC: Record<string, string> = {
  ovg: 'Virtual Gym · Sócios e acessos',
  pay4all: 'Pagamentos e reconciliação',
  cademi: 'Acessos e área de membros',
  whatsapp: 'SamoraFit · Conversas comerciais',
  website: 'Formulários e canais digitais',
};

function Status({ children, tone = 'neutral' }: { children: ReactNode; tone?: 'good' | 'warn' | 'danger' | 'neutral' | 'live' | 'pending' }) {
  return <span className={`status status-${tone}`}>{children}</span>;
}
function IconButton({ label, children, onClick }: { label: string; children: ReactNode; onClick?: () => void }) {
  return <button type="button" aria-label={label} data-testid={`button-${label.toLowerCase().replaceAll(' ', '-')}`} className="btn-quiet" onClick={onClick}>{children}</button>;
}
function PageHeader({ eyebrow, title, subtitle, action }: { eyebrow: string; title: string; subtitle?: string; action?: ReactNode }) {
  return <div className="section-header" style={{ marginBottom: '.9rem' }}><div><div className="eyebrow">{eyebrow}</div><h1 className="page-title">{title}</h1>{subtitle && <p className="page-subtitle">{subtitle}</p>}</div>{action}</div>;
}
function Metric({ label, value, note, trend, negative = false, onClick, active = false, loading = false }: { label: string; value: string; note: string; trend?: string; negative?: boolean; onClick?: () => void; active?: boolean; loading?: boolean }) {
  return <div className="card metric" onClick={onClick} style={{ ...(onClick ? { cursor: 'pointer' } : {}), ...(active ? { outline: '2px solid hsl(var(--accent))', outlineOffset: '-2px' } : {}) }}>{loading ? <><div className="skeleton" style={{ width: '55%', height: '.66rem' }} /><div className="skeleton" style={{ width: '85%', height: '1.45rem', marginTop: '.35rem' }} /><div className="skeleton" style={{ width: '75%', height: '.7rem', marginTop: '.32rem' }} /></> : <><div className="eyebrow">{label}</div><div className="metric-value">{value}</div><div className={`metric-note${trend ? (negative ? ' text-bad' : ' text-good') : ''}`}>{trend && (negative ? <ArrowDownRight size={12} style={{ verticalAlign: 'middle' }} /> : <ArrowUpRight size={12} style={{ verticalAlign: 'middle' }} />)} {trend}{trend && ' · '}{note}</div></>}</div>;
}
function Section({ title, note, action, children, className = '' }: { title: string; note?: string; action?: ReactNode; children: ReactNode; className?: string }) {
  return <section className={`card ${className}`} style={{ padding: '1.1rem' }}><div className="section-header"><div><h2 className="section-title">{title}</h2>{note && <p className="section-note">{note}</p>}</div>{action}</div>{children}</section>;
}
function EmptyState({ title, text, action }: { title: string; text: string; action?: ReactNode }) {
  return <div style={{ padding: '2.6rem 1rem', textAlign: 'center', color: 'hsl(var(--muted-foreground))' }}><Boxes size={25} style={{ margin: '0 auto .7rem', opacity: .55 }} /><div style={{ color: 'hsl(var(--foreground))', fontWeight: 700, fontSize: '.85rem' }}>{title}</div><p style={{ fontSize: '.75rem', margin: '.35rem auto 1rem', maxWidth: 330 }}>{text}</p>{action}</div>;
}
function Modal({ title, subtitle, onClose, children }: { title: string; subtitle?: string; onClose: () => void; children: ReactNode }) {
  return <div className="modal-backdrop" role="dialog" aria-modal="true"><div className="modal"><div className="modal-head"><div><div className="section-title">{title}</div>{subtitle && <div className="section-note">{subtitle}</div>}</div><IconButton label="fechar" onClick={onClose}><X size={16} /></IconButton></div><div className="modal-body">{children}</div></div></div>;
}
function FormField({ label, value, onChange, placeholder, type = 'text' }: { label: string; value: string; onChange: (value: string) => void; placeholder?: string; type?: string }) {
  return <label><span className="form-label">{label}</span><input className="input" type={type} value={value} onChange={(e) => onChange(e.target.value)} placeholder={placeholder} /></label>;
}

function Sidebar({ open, onClose, auditCount }: { open: boolean; onClose: () => void; auditCount?: number }) {
  const [location] = useLocation();
  const { logout } = useAuth();
  return <><aside className={`sidebar ${open ? 'open' : ''}`} style={{ width: 238, minHeight: '100dvh', padding: '1.25rem .8rem', position: 'fixed', inset: '0 auto 0 0', zIndex: 40, overflowY: 'auto', display: 'flex', flexDirection: 'column' }}>
    <div style={{ display: 'flex', alignItems: 'center', padding: '.15rem .55rem 1.4rem' }}><img src="/samorafit-logo-dark.png" alt="SamoraFit" style={{ height: 30, width: 'auto', maxWidth: '100%', objectFit: 'contain' }} /></div>
    <div style={{ display: 'grid', gap: '1.15rem', flex: 1 }}>{navGroups.map(group => <div key={group.label}><div className="eyebrow" style={{ color: 'hsl(var(--sidebar-foreground) / .62)', padding: '0 .7rem .42rem', fontSize: '.57rem' }}>{group.label}</div><nav style={{ display: 'grid', gap: '.15rem' }}>{group.items.map(item => { const active = item.href === '/admin' ? location === '/admin' : location.startsWith(item.href); const I = item.icon; return <Link key={item.href} href={item.href} className={`sidebar-link ${active ? 'active' : ''}`} data-testid={`link-nav-${item.label.toLowerCase()}`} onClick={onClose}><I size={15} strokeWidth={active ? 2.4 : 1.8} /><span>{item.label}</span>{item.label === 'Auditoria' && auditCount ? <span style={{ marginLeft: 'auto', fontSize: '.6rem', padding: '.12rem .35rem', borderRadius: 5, background: 'hsl(var(--sidebar-primary) / .2)', color: 'hsl(var(--sidebar-primary))' }}>{auditCount}</span> : null}</Link>; })}</nav></div>)}</div>
    <button onClick={async () => { await logout(); onClose(); window.location.href = '/login'; }} className="sidebar-link" style={{ marginTop: 'auto', padding: '.55rem .7rem', borderRadius: '.4rem', display: 'flex', alignItems: 'center', gap: '.5rem', fontSize: '.75rem', color: 'hsl(3 67% 55%)', cursor: 'pointer', background: 'transparent', border: 'none', width: '100%', textAlign: 'left' }}><LogOut size={15} /><span>Sair da sessão</span></button>
  </aside>{open && <div className="mobile-overlay" onClick={onClose} />}</>;
}
function Topbar({ onMenu, userName }: { onMenu: () => void; userName?: string }) {
  const today = new Date().toLocaleDateString('pt-AO', { weekday: 'long', day: 'numeric', month: 'short', year: 'numeric' });
  const displayName = userName || 'Utilizador';
  const initials = displayName.split(' ').map((n: string) => n[0]).join('').slice(0, 2).toUpperCase();
  return <header className="topbar" style={{ height: 65, borderBottom: '1px solid hsl(var(--border))', background: 'hsl(var(--card) / .84)', backdropFilter: 'blur(10px)', display: 'flex', alignItems: 'center', gap: '1rem', padding: '0 1.7rem', position: 'sticky', top: 0, zIndex: 20 }}><button className="mobile-only btn-quiet" onClick={onMenu} data-testid="button-open-menu" aria-label="Abrir menu"><Menu size={19} /></button><div style={{ marginLeft: 'auto', display: 'flex', alignItems: 'center', gap: '.35rem' }}><span className="desktop-only" style={{ color: 'hsl(var(--muted-foreground))', fontSize: '.7rem', marginRight: '.45rem' }}>{today}</span><div className="desktop-only" style={{ height: 22, width: 1, background: 'hsl(var(--border))', margin: '0 .25rem' }} /><div className="desktop-only" style={{ display: 'flex', alignItems: 'center', gap: '.45rem', fontSize: '.75rem', fontWeight: 600 }}><div style={{ width: 25, height: 25, display: 'grid', placeItems: 'center', borderRadius: '50%', background: 'hsl(var(--primary))', color: 'white', fontSize: '.62rem' }}>{initials}</div>{displayName}</div></div></header>;
}

function Dashboard({ leads, customers, userName }: { leads: Lead[]; customers: Customer[]; userName?: string }) {
  const [, setLocation] = useLocation();
  const statsQuery = useGetDashboardStats({ query: { refetchInterval: 300000 } });
  const chartsQuery = useGetDashboardCharts({ query: { refetchInterval: 300000 } });
  const overview = statsQuery.data?.data?.overview;
  const ov: any = overview as any;
  const integrations = statsQuery.data?.data?.integrations ?? [];
  const chartsData: any = chartsQuery.data?.data as any;
  const revenueData = ((chartsData?.revenueByMonth ?? []) as any[]).map((d: any) => ({ month: d.month ?? '', value: d.total ?? d.value ?? 0 }));
  const dashLoading = statsQuery.isLoading || chartsQuery.isLoading;
  const firstName = (userName || 'Utilizador').split(' ')[0];
  const hour = new Date().getHours();
  const greeting = hour < 12 ? 'Bom dia' : hour < 18 ? 'Boa tarde' : 'Boa noite';
  const metricTitle = greeting + ', ' + firstName + '.';
  const totalLeads = overview?.totalLeads ?? leads.length;
  const pendCount = ov?.pendingPaymentsCount ?? overview?.pendingPayments ?? 0;
  const pendTotal = ov?.pendingPaymentsTotal ?? 0;
  const lateCount = ov?.latePaymentsCount ?? overview?.latePayments ?? 0;
  const lateTotal = ov?.latePaymentsTotal ?? 0;
  const convRate = Number(chartsData?.conversionRate ?? 0) || (leads.length > 0 ? Math.round((leads.filter(l => l.status === 'Convertido').length / leads.length) * 100) : 0);
  const newLeads7 = leads.filter(l => { try { return Date.now() - new Date(l.createdAt).getTime() < 7 * 86400000; } catch { return false; } }).length;
  // Funil por etapa: API devolve mapa {novo_lead: n, ...}; fallback calcula das leads carregadas.
  const funnelStages = ['novo_lead', 'qualificado', 'proposta', 'negociacao', 'convertido', 'perdido'];
  const funnelRaw: any = (statsQuery.data?.data as any)?.leadsByStatus;
  let funnel: Array<{ key: string; label: string; count: number }> = [];
  if (Array.isArray(funnelRaw)) {
    funnel = funnelStages.map(k => { const f = funnelRaw.find((r: any) => r.status === k); return { key: k, label: LEAD_API_TO_PT[k] ?? k, count: Number(f?.count ?? 0) }; });
  } else if (funnelRaw && typeof funnelRaw === 'object') {
    funnel = funnelStages.map(k => ({ key: k, label: LEAD_API_TO_PT[k] ?? k, count: Number(funnelRaw[k] ?? 0) + (k === 'novo_lead' ? Number(funnelRaw['contacto'] ?? 0) : 0) }));
  }
  if (funnel.every(f => !f.count) && leads.length > 0) {
    const byStatus: Record<string, number> = {};
    leads.forEach(l => { byStatus[l.status] = (byStatus[l.status] ?? 0) + 1; });
    funnel = ['Novo Lead', 'Qualificação', 'Proposta', 'Negociação', 'Convertido', 'Perdido'].map(label => ({ key: label, label, count: byStatus[label] ?? 0 }));
  }
  const sources: Array<{ source: string; count: number }> = ((chartsData?.leadsBySource ?? []) as any[]).map((s: any) => ({ source: String(s.source ?? '—'), count: Number(s.count ?? 0) })).slice(0, 6);
  const payMethods: Array<{ method: string; count: number; total: number }> = ((chartsData?.paymentMethods ?? []) as any[]).map((m: any) => ({ method: String(m.method ?? '—'), count: Number(m.count ?? 0), total: Number(m.total ?? 0) })).slice(0, 5);
  const monthLabel = (m?: string) => { try { const parts = (m || '').split('-'); if (parts.length < 2) return m ?? ''; return new Date(Number(parts[0]), Number(parts[1]) - 1, 1).toLocaleDateString('pt-AO', { month: 'short' }).replace('.', ''); } catch { return m ?? ''; } };
  const todayStr = new Date().toLocaleDateString('pt-AO', { day: 'numeric', month: 'short', year: 'numeric' });
  const [copiedReport, setCopiedReport] = useState(false);
  const reportLines = [
    `Clientes activos: ${overview?.activeCustomers ?? 0} de ${overview?.totalCustomers ?? 0}`,
    `Receita 30 dias: ${overview?.revenueLast30Days ? money(overview.revenueLast30Days) : '0 Kz'}`,
    `A receber: ${money(pendTotal)} (${pendCount} transações)`,
    `Em atraso: ${money(lateTotal)} (${lateCount} em atenção)`,
    `Leads: ${totalLeads} · conversão ${convRate}% · ${newLeads7} novos em 7 dias`,
  ];
  const reportText = `RELATÓRIO SOLVE — ${todayStr}\n` + reportLines.map(l => `• ${l}`).join('\n');
  const copyReport = () => { navigator.clipboard?.writeText(reportText); setCopiedReport(true); setTimeout(() => setCopiedReport(false), 2000); };
  const [chartRange, setChartRange] = useState<'mes' | 'tudo'>('mes');
  const revenueShown = chartRange === 'mes' ? revenueData.slice(-4) : revenueData;
  return <><PageHeader eyebrow="Operação · Hoje" title={metricTitle} subtitle="Resumo comercial e financeiro em tempo real." /><div className="metric-grid" style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(160px, 1fr))', gap: '.8rem', marginBottom: '.8rem' }}><Metric label="Receita 30 dias" value={overview?.revenueLast30Days ? money(overview.revenueLast30Days) : '0 Kz'} note="pagamentos confirmados" loading={dashLoading} onClick={() => setLocation('/admin/pagamentos?filtro=Confirmado')} /><Metric label="A receber" value={money(pendTotal)} note={`${pendCount} transações pendentes`} loading={dashLoading} onClick={() => setLocation('/admin/pagamentos?filtro=Pendente')} /><Metric label="Em atraso" value={money(lateTotal)} note={`${lateCount} em atenção`} negative loading={dashLoading} onClick={() => setLocation('/admin/pagamentos')} /><Metric label="Leads" value={String(totalLeads)} note={`${convRate}% conversão · ${newLeads7} novos 7d`} loading={dashLoading} onClick={() => setLocation('/admin/pipeline')} /></div>
  <Section title="Relatório do dia" note="Bloco de notas da operação" action={<button className="btn-secondary" onClick={copyReport}><Code2 size={14} /> {copiedReport ? 'Copiado!' : 'Copiar'}</button>}>
    <div style={{ display: 'grid', gap: '.45rem', fontSize: '.76rem' }}>{reportLines.map(l => <div key={l} style={{ display: 'flex', gap: '.5rem', alignItems: 'baseline' }}><span style={{ width: 6, height: 6, borderRadius: '50%', background: 'hsl(var(--accent))', flexShrink: 0, transform: 'translateY(-1px)' }} />{l}</div>)}</div>
  </Section>
  <div className="content-grid" style={{ display: 'grid', gridTemplateColumns: '1.35fr .85fr', gap: '.8rem', marginBottom: '.8rem' }}><Section title="Ritmo comercial" note="Receita confirmada por mês" action={<button className="btn-quiet" onClick={() => setChartRange(chartRange === 'mes' ? 'tudo' : 'mes')}>{chartRange === 'mes' ? 'Este mês' : 'Período total'} <ChevronDown size={13} /></button>}><div style={{ height: 165, display: 'flex', alignItems: 'end', gap: 'clamp(.4rem, 2.4vw, 1rem)', padding: '1rem .2rem .2rem', borderBottom: '1px solid hsl(var(--border))' }}>{dashLoading ? <div style={{ display: 'flex', gap: '.5rem', alignItems: 'end', flex: 1, width: '100%' }}><div className="skeleton" style={{ height: 60, flex: 1 }} /><div className="skeleton" style={{ height: 100, flex: 1 }} /><div className="skeleton" style={{ height: 80, flex: 1 }} /><div className="skeleton" style={{ height: 120, flex: 1 }} /></div> : (revenueShown.length > 0 ? revenueShown : []).map((d, i, arr) => { const max = Math.max(...arr.map(x => x.value ?? 0), 1); const pct = ((d.value ?? 0) / max) * 100; return <div key={i} style={{ flex: 1, height: `${Math.max(pct, 5)}%`, position: 'relative', minWidth: 7, background: i === arr.length - 1 ? 'hsl(var(--accent))' : 'hsl(var(--chart-2) / .72)', borderRadius: '3px 3px 0 0' }} title={`${d.value ?? 0} Kz`} />; })}</div><div style={{ display: 'flex', justifyContent: 'space-between', color: 'hsl(var(--muted-foreground))', fontSize: '.65rem', paddingTop: '.45rem' }}>{dashLoading ? <span>A verificar…</span> : revenueShown.length > 0 ? revenueShown.map((d, i) => <span key={i}>{monthLabel(d.month) || `M${i + 1}`}</span>) : <span>Sem receita ainda — cria uma cobrança em Pagamentos</span>}</div></Section><Section title="Saúde do ecossistema" note={dashLoading ? 'A verificar…' : integrations.length > 0 ? `${integrations.length} canais` : 'Sem canais ligados'}><div style={{ display: 'grid', gap: '.72rem' }}>{integrations.length > 0 ? integrations.map((ig, i) => <div key={i} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', fontSize: '.72rem' }}><div style={{ display: 'flex', alignItems: 'center', gap: '.5rem' }}><div style={{ width: 7, height: 7, borderRadius: '50%', background: ig.status === 'operacional' ? 'hsl(155 41% 43%)' : 'hsl(38 80% 50%)' }} />{ig.name}</div><Status tone={ig.status === 'operacional' ? 'good' : 'warn'}>{ig.status === 'operacional' ? 'Operacional' : ig.status}</Status></div>) : <div style={{ padding: '.7rem', fontSize: '.72rem', color: 'hsl(var(--muted-foreground))' }}>Sem dados de integração</div>}</div></Section></div><div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '.8rem' }}><Section title="Leads recentes" note="Últimas captações"><div style={{ display: 'grid', gap: '.5rem' }}>{(leads.length > 0 ? leads.slice(0, 5) : []).map(l => <div key={l.id} style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '.5rem 0', borderBottom: '1px solid hsl(var(--border))', fontSize: '.73rem' }}><div><div style={{ fontWeight: 600 }}>{l.name}</div><div style={{ color: 'hsl(var(--muted-foreground))' }}>{l.company}</div></div><Status tone={l.status === 'Convertido' ? 'good' : l.status === 'Perdido' ? 'danger' : 'neutral'}>{l.status}</Status></div>)}</div></Section><Section title="Clientes activos" note="Estado das contas"><div style={{ display: 'grid', gap: '.5rem' }}>{(customers.length > 0 ? customers.slice(0, 5) : []).map(c => <div key={c.id} style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '.5rem 0', borderBottom: '1px solid hsl(var(--border))', fontSize: '.73rem' }}><div><div style={{ fontWeight: 600 }}>{c.name}</div><div style={{ color: 'hsl(var(--muted-foreground))' }}>{c.company}</div></div><Status tone={c.state === 'Activo' ? 'good' : 'warn'}>{c.state}</Status></div>)}</div></Section></div><div className="content-grid" style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(230px, 1fr))', gap: '.8rem', marginBottom: '.8rem' }}>
<Section title="Funil de leads" note={`${totalLeads} oportunidades · ${convRate}% conversão`}><div style={{ display: 'grid', gap: '.55rem' }}>{dashLoading ? <><div className="skeleton" style={{ height: 8 }} /><div className="skeleton" style={{ height: 8 }} /><div className="skeleton" style={{ height: 8 }} /><div className="skeleton" style={{ height: 8 }} /><div className="skeleton" style={{ height: 8 }} /><div className="skeleton" style={{ height: 8 }} /></> : funnel.map(f => { const max = Math.max(...funnel.map(x => x.count), 1); const isConv = f.label === 'Convertido'; const isLost = f.label === 'Perdido'; return <div key={f.key} style={{ display: 'grid', gridTemplateColumns: '104px 1fr 32px', alignItems: 'center', gap: '.6rem', fontSize: '.72rem' }}><span style={{ fontWeight: 600 }}>{f.label}</span><div style={{ height: 8, background: 'hsl(var(--secondary))', borderRadius: 4 }}><div style={{ height: '100%', width: `${f.count > 0 ? Math.max((f.count / max) * 100, 5) : 0}%`, background: isConv ? 'hsl(155 41% 43%)' : isLost ? 'hsl(0 84% 60%)' : 'hsl(var(--accent))', borderRadius: 4 }} /></div><span className="mono" style={{ textAlign: 'right', fontWeight: 700 }}>{f.count}</span></div>; })}{!dashLoading && funnel.every(f => !f.count) && <div style={{ padding: '.7rem', fontSize: '.72rem', color: 'hsl(var(--muted-foreground))' }}>Sem leads ainda — cria o primeiro em Leads</div>}</div></Section>
<Section title="Origens de leads" note="De onde vêm as oportunidades"><div style={{ display: 'grid', gap: '.55rem' }}>{!dashLoading && sources.length === 0 && <div style={{ padding: '.7rem', fontSize: '.72rem', color: 'hsl(var(--muted-foreground))' }}>Nada ainda — regista um lead para ver as origens</div>}{dashLoading ? <><div className="skeleton" style={{ height: 8 }} /><div className="skeleton" style={{ height: 8 }} /><div className="skeleton" style={{ height: 8 }} /><div className="skeleton" style={{ height: 8 }} /><div className="skeleton" style={{ height: 8 }} /></> : sources.map(s => { const max = Math.max(...sources.map(x => x.count), 1); return <div key={s.source} style={{ display: 'grid', gridTemplateColumns: '104px 1fr 32px', alignItems: 'center', gap: '.6rem', fontSize: '.72rem' }}><span style={{ fontWeight: 600, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>{srcLabel(s.source)}</span><div style={{ height: 8, background: 'hsl(var(--secondary))', borderRadius: 4 }}><div style={{ height: '100%', width: `${s.count > 0 ? Math.max((s.count / max) * 100, 5) : 0}%`, background: 'hsl(var(--chart-2) / .8)', borderRadius: 4 }} /></div><span className="mono" style={{ textAlign: 'right', fontWeight: 700 }}>{s.count}</span></div>; })}</div></Section>
<Section title="Métodos de pagamento" note="Transações por método"><div style={{ display: 'grid', gap: '.2rem' }}>{!dashLoading && payMethods.length === 0 && <div style={{ padding: '.7rem', fontSize: '.72rem', color: 'hsl(var(--muted-foreground))' }}>Nada ainda — confirma uma transação para ver os métodos</div>}{dashLoading ? <><div className="skeleton" style={{ height: 28 }} /><div className="skeleton" style={{ height: 28 }} /><div className="skeleton" style={{ height: 28 }} /><div className="skeleton" style={{ height: 28 }} /></> : payMethods.map(m => <div key={m.method} style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '.5rem 0', borderBottom: '1px solid hsl(var(--border))', fontSize: '.73rem' }}><div><div style={{ fontWeight: 600 }}>{m.method}</div><div style={{ color: 'hsl(var(--muted-foreground))' }}>{m.count} transações</div></div><span className="mono" style={{ fontWeight: 700 }}>{money(m.total)}</span></div>)}</div></Section>
</div></>;
}

function LeadFicha({ lead, staff, onClose, onChanged }: { lead: Lead; staff: Array<{ id: string; name: string }>; onClose: () => void; onChanged?: () => void }) {
  const apiEstado = (TRACK_LABEL_TO_API[lead.status] || LEAD_PT_TO_API[lead.status] || lead.statusApi || 'novo_lead');
  const [fResp, setFResp] = useState(lead.owner || '');
  const [fEstado, setFEstado] = useState(TRACK_PT[apiEstado] ?? lead.status);
  const [fProd, setFProd] = useState(lead.produtoInteresse || '');
  const [fProx, setFProx] = useState(lead.proximoContato || '');
  const [fMotivo, setFMotivo] = useState(lead.motivoPerda || '');
  const [hist, setHist] = useState<any[]>([]);
  const [loadingH, setLoadingH] = useState(true);
  const [cCanal, setCCanal] = useState('WhatsApp');
  const [cResult, setCResult] = useState('Interessado');
  const [cPasso, setCPasso] = useState('Contactar amanhã');
  const [cData, setCData] = useState(passoParaDataLocal('Contactar amanhã'));
  const [cObs, setCObs] = useState('');
  const [busy, setBusy] = useState(false);
  const [msg, setMsg] = useState('');
  const loadHist = async () => {
    setLoadingH(true);
    try { const j = await leadFetch(`/api/v1/leads/${lead.id}/contacts`); setHist(j.data || []); } catch { setHist([]); }
    setLoadingH(false);
  };
  useEffect(() => { loadHist(); }, [lead.id]);
  const zapNum = lead.whatsapp || lead.phone || '';
  const zap = waLink(zapNum);
  const telDigits = waDigits(lead.phone || zapNum);
  const tel = telDigits ? `tel:+${telDigits}` : '';
  const fmtH = (d: string) => { if (!d) return '—'; try { return new Date(d).toLocaleString('pt-AO', { day: '2-digit', month: 'short', hour: '2-digit', minute: '2-digit' }); } catch { return d; } };
  const guardar = async () => {
    setBusy(true); setMsg('');
    try {
      await leadFetch(`/api/v1/leads/${lead.id}`, { method: 'PATCH', body: JSON.stringify({ ownerId: fResp || null, status: TRACK_LABEL_TO_API[fEstado] || 'novo_lead', produtoInteresse: fProd || null, proximoContato: fProx || null, motivoPerda: fMotivo || null }) });
      onChanged?.(); onClose();
    } catch (e: any) { setMsg('Erro: ' + (e.message || 'falha a guardar')); }
    setBusy(false);
  };
  const registar = async () => {
    setBusy(true); setMsg('');
    try {
      await leadFetch(`/api/v1/leads/${lead.id}/contacts`, { method: 'POST', body: JSON.stringify({ canal: cCanal, resultado: cResult, proximo_passo: cPasso, proximo_contato: cData || undefined, observacao: cObs || undefined }) });
      setCObs(''); await loadHist(); onChanged?.(); setMsg('Contacto registado.');
    } catch (e: any) { setMsg('Erro: ' + (e.message || 'falha a registar')); }
    setBusy(false);
  };
  const mudaPasso = (v: string) => {
    setCPasso(v);
    const d = passoParaDataLocal(v);
    if (d) setCData(d);
    if (v === 'Sem próximo contacto') setCData('');
  };
  return <Modal title={lead.name} subtitle={`${lead.code || ''} · entrou ${fmtDateShort(lead.createdAt)} · ${srcLabel(lead.source)}`} onClose={onClose}>
    <div style={{ display: 'grid', gap: '.9rem' }}>
      <div style={{ display: 'flex', gap: '.5rem', flexWrap: 'wrap' }}>
        {zap ? <a className="btn-primary" href={zap} target="_blank" rel="noreferrer" style={{ flex: 1, textDecoration: 'none' }}><MessageCircle size={14} /> WhatsApp</a> : null}
        {tel ? <a className="btn-secondary" href={tel} style={{ flex: 1, textDecoration: 'none' }}><PhoneCall size={14} /> Ligar</a> : null}
        {!zap && !tel ? <div className="section-note">Sem número para contactar.</div> : null}
      </div>
      <div style={{ fontSize: '.74rem', display: 'grid', gap: '.25rem' }}>
        {lead.phone ? <div>Telefone: <span className="mono">{lead.phone}</span></div> : null}
        {lead.whatsapp ? <div>WhatsApp: <span className="mono">{lead.whatsapp}</span></div> : null}
        {lead.email ? <div>Email: {lead.email}</div> : null}
        {lead.company ? <div>Empresa: {lead.company}</div> : null}
        <div>Produto de interesse: {lead.produtoInteresse || '—'}</div>
      </div>
      <div>
        <div className="eyebrow" style={{ marginBottom: '.45rem' }}>Ficha</div>
        <div className="form-grid">
          <label><span className="form-label">Responsável</span><select className="select" style={{ width: '100%' }} value={staff.some((s) => s.id === fResp) ? fResp : ''} onChange={(e) => setFResp(e.target.value)}><option value="">—</option>{staff.map((s) => <option key={s.id} value={s.id}>{s.name}</option>)}{fResp && !staff.some((s) => s.id === fResp) ? <option value={fResp}>{fResp}</option> : null}</select></label>
          <label><span className="form-label">Estado</span><select className="select" style={{ width: '100%' }} value={fEstado} onChange={(e) => setFEstado(e.target.value)}>{TRACK_FICHA_OPTS.map((o) => <option key={o}>{o}</option>)}</select></label>
          <FormField label="Produto / serviço de interesse" value={fProd} onChange={setFProd} placeholder="Ex.: Plano Mensal" />
          <label><span className="form-label">Próximo contacto</span><input className="input" type="date" style={{ width: '100%' }} value={fProx} onChange={(e) => setFProx(e.target.value)} /></label>
          {fEstado === 'Perdida' ? <FormField label="Motivo (perdida)" value={fMotivo} onChange={setFMotivo} placeholder="Ex.: sem interesse neste momento" /> : null}
        </div>
        <div style={{ display: 'flex', marginTop: '.6rem' }}><button className="btn-primary" onClick={guardar} disabled={busy} style={{ flex: 1 }}><Check size={14} /> {busy ? 'A guardar…' : 'Guardar ficha'}</button></div>
      </div>
      <div>
        <div className="eyebrow" style={{ marginBottom: '.45rem' }}>Histórico de contactos</div>
        {loadingH ? <div className="section-note">A carregar…</div> : hist.length === 0 ? <div className="section-note">Sem contactos registados.</div> :
        <div className="table-wrap"><table className="data-table"><thead><tr><th>Data</th><th>Funcionário</th><th>Canal</th><th>Resultado</th><th>Obs.</th></tr></thead><tbody>{hist.map((h: any) => <tr key={h.id}><td style={{ whiteSpace: 'nowrap' }}>{fmtH(h.created_at)}</td><td>{h.staff_nome || '—'}</td><td>{h.canal}</td><td>{h.resultado}</td><td style={{ fontSize: '.7rem' }}>{h.observacao || '—'}</td></tr>)}</tbody></table></div>}
      </div>
      <div>
        <div className="eyebrow" style={{ marginBottom: '.45rem' }}>Registar contacto</div>
        <div className="form-grid">
          <label><span className="form-label">Canal</span><select className="select" style={{ width: '100%' }} value={cCanal} onChange={(e) => setCCanal(e.target.value)}>{LEAD_CANAIS.map((o) => <option key={o}>{o}</option>)}</select></label>
          <label><span className="form-label">Resultado</span><select className="select" style={{ width: '100%' }} value={cResult} onChange={(e) => setCResult(e.target.value)}>{LEAD_RESULTADOS.map((o) => <option key={o}>{o}</option>)}</select></label>
          <label><span className="form-label">Próximo passo</span><select className="select" style={{ width: '100%' }} value={cPasso} onChange={(e) => mudaPasso(e.target.value)}>{LEAD_PASSOS.map((o) => <option key={o}>{o}</option>)}</select></label>
          <label><span className="form-label">Data próximo contacto</span><input className="input" type="date" style={{ width: '100%' }} value={cData} onChange={(e) => setCData(e.target.value)} /></label>
          <label><span className="form-label">Observação (opcional)</span><input className="input" style={{ width: '100%' }} value={cObs} onChange={(e) => setCObs(e.target.value)} placeholder="Info relevante" /></label>
        </div>
        <div style={{ display: 'flex', marginTop: '.6rem' }}><button className="btn-secondary" onClick={registar} disabled={busy} style={{ flex: 1 }}><Plus size={14} /> {busy ? 'A registar…' : 'Registar'}</button></div>
      </div>
      {msg ? <div style={{ fontSize: '.76rem' }}>{msg}</div> : null}
    </div>
  </Modal>;
}

function LeadsPage({ leads, userName, onChanged }: { leads: Lead[]; userName?: string; onChanged?: () => void }) {
  const [q, setQ] = useState(() => { try { return (JSON.parse(localStorage.getItem('leads-view') || '{}') as any).q || ''; } catch { return ''; } });
  const [status, setStatus] = useState(() => { try { return (JSON.parse(localStorage.getItem('leads-view') || '{}') as any).status || 'Todos'; } catch { return 'Todos'; } });
  const [source, setSource] = useState(() => { try { return (JSON.parse(localStorage.getItem('leads-view') || '{}') as any).source || 'Todas'; } catch { return 'Todas'; } });
  const [owner, setOwner] = useState('Todos');
  const [editing, setEditing] = useState<Lead | null>(null); const [open, setOpen] = useState(false);
  const [viewMsg, setViewMsg] = useState('');
  const [acomp, setAcomp] = useState('Todos');
  const [filtro, setFiltro] = useState('todos');
  const toggleFiltro = (f: string) => setFiltro((cur) => (cur === f ? 'todos' : f));
  const [ficha, setFicha] = useState<Lead | null>(null);
  const [resumo, setResumo] = useState<any>(null);
  const [follows, setFollows] = useState<any[]>([]);
  const createMut = useCreateLead(); const updateMut = useUpdateLead();
  const qc = useQueryClient();
  const usersQ = useListUsersAll();
  const staff: Array<{ id: string; name: string }> = ((usersQ.data as any)?.data ?? []).map((u: any) => ({ id: u.id, name: u.name }));
  const staffName = (id: string) => staff.find((s) => s.id === id)?.name || id || '—';
  const trackOf = (l: Lead) => TRACK_PT[l.statusApi || LEAD_PT_TO_API[l.status] || ''] || l.status;
  const hojeISO = () => { const d = new Date(); return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`; };
  const semAcomp = (l: Lead) => (l.contactosTotal ?? 0) === 0 || (!!l.proximoContato && l.proximoContato < hojeISO());
  // Filtro KPI — só dados reais da API (status + contactosTotal calculado no backend)
  const kpiMatch = (l: Lead) => {
    if (filtro === 'todos') return true;
    const t = trackOf(l);
    if (filtro === 'novas') return t === 'Nova';
    if (filtro === 'contactadas') return t === 'Contactada';
    if (filtro === 'pendentes') return (l.contactosTotal ?? 0) === 0;
    if (filtro === 'emAcomp') return t === 'Em acompanhamento';
    if (filtro === 'convertidas') return t === 'Convertida';
    if (filtro === 'perdidas') return t === 'Perdida';
    return true;
  };
  const refreshTrack = async () => {
    try { const j = await leadFetch('/api/v1/leads/resumo'); setResumo(j.data); } catch {}
    try { const f = await leadFetch('/api/v1/leads/followups/hoje'); setFollows(f.data || []); } catch {}
  };
  useEffect(() => { refreshTrack(); }, []);
  const reloadAll = () => { onChanged?.(); refreshTrack(); };
  const owners = useMemo(() => Array.from(new Set(leads.map(l => l.owner).filter(Boolean))), [leads]);
  // Origens reais da lista (campanhas) → opções do filtro + rótulos PT.
  const sourceOpts = useMemo(() => Array.from(new Set(leads.map(l => String(l.source || '').trim()).filter(Boolean))), [leads]);
  const filtered = leads.filter(l => kpiMatch(l) && (l.name + l.company + l.email).toLowerCase().includes(q.toLowerCase()) && (status === 'Todos' || trackOf(l) === status) && (source === 'Todas' || l.source === source) && (owner === 'Todos' || l.owner === owner) && (acomp === 'Todos' || (acomp === 'Sem acompanhamento' ? semAcomp(l) : !semAcomp(l))));
  const saveView = () => { try { localStorage.setItem('leads-view', JSON.stringify({ q, status, source })); setViewMsg('Vista guardada'); setTimeout(() => setViewMsg(''), 2000); } catch {} };
  const toApi = (x: Lead) => ({ name: x.name, email: x.email || undefined, phone: x.phone || undefined, whatsapp: x.whatsapp || undefined, produtoInteresse: x.produtoInteresse || undefined, company: x.company || undefined, source: x.source || undefined, status: (TRACK_LABEL_TO_API[x.status] || LEAD_PT_TO_API[x.status] || 'novo_lead') as any, ownerId: x.owner || undefined, estimatedValue: x.value || 0 });
  const handleSave = (x: Lead) => {
    if (editing) updateMut.mutate({ id: editing.id, data: toApi(x) }, { onSuccess: () => { setOpen(false); setEditing(null); reloadAll(); } });
    else createMut.mutate({ data: toApi(x) }, { onSuccess: () => { setOpen(false); reloadAll(); } });
  };
  const pct = (n: number, t: number) => (t > 0 ? `${Math.round((n / t) * 100)}%` : '—');
  return <><PageHeader eyebrow="Comercial · Captação" title="Leads" subtitle={`${leads.length} registos no espaço de trabalho`} action={<button className="btn-primary" onClick={() => { setEditing(null); setOpen(true); }} data-testid="button-add-lead"><Plus size={15} /> Novo lead</button>} /><div className="card" style={{ padding: '.5rem .6rem', marginBottom: '.6rem', display: 'flex', gap: '.45rem', alignItems: 'center', flexWrap: 'wrap' }}><div style={{ position: 'relative', flex: '1 1 230px' }}><Search size={14} style={{ position: 'absolute', left: 10, top: 10, color: 'hsl(var(--muted-foreground))' }} /><input data-testid="input-search-leads" className="input" style={{ paddingLeft: 31 }} placeholder="Pesquisar por nome, empresa ou email" value={q} onChange={e => setQ(e.target.value)} /></div><select data-testid="select-lead-status" className="select" value={status} onChange={e => setStatus(e.target.value)}><option>Todos</option>{TRACK_FICHA_OPTS.map(v => <option key={v}>{v}</option>)}</select><select data-testid="select-lead-source" className="select" value={source} onChange={e => setSource(e.target.value)}><option>Todas</option>{sourceOpts.map(v => <option key={v} value={v}>{srcLabel(v)}</option>)}</select><select data-testid="select-lead-owner" className="select" value={owner} onChange={e => setOwner(e.target.value)}><option>Todos</option>{owners.map(v => <option key={v} value={v}>{staffName(v)}</option>)}</select><select className="select" value={acomp} onChange={e => setAcomp(e.target.value)}><option>Todos</option><option>Sem acompanhamento</option><option>Em acompanhamento</option></select></div>{resumo ? <div className="metric-compact" style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(110px, 1fr))', gap: '.5rem', marginBottom: '.6rem' }}><Metric label="Total" value={String(resumo.total)} note="leads · limpar filtro" active={filtro === 'todos'} onClick={() => setFiltro('todos')} /><Metric label="Novas" value={String(resumo.novas)} note={pct(resumo.novas, resumo.total)} active={filtro === 'novas'} onClick={() => toggleFiltro('novas')} /><Metric label="Contactadas" value={String(resumo.contactadas)} note={pct(resumo.contactadas, resumo.total)} active={filtro === 'contactadas'} onClick={() => toggleFiltro('contactadas')} /><Metric label="Pendentes" value={String(resumo.pendentes)} note={pct(resumo.pendentes, resumo.total)} active={filtro === 'pendentes'} onClick={() => toggleFiltro('pendentes')} /><Metric label="Em acompanhamento" value={String(resumo.emAcompanhamento)} note={pct(resumo.emAcompanhamento, resumo.total)} active={filtro === 'emAcomp'} onClick={() => toggleFiltro('emAcomp')} /><Metric label="Convertidas" value={String(resumo.convertidas)} note={pct(resumo.convertidas, resumo.total)} active={filtro === 'convertidas'} onClick={() => toggleFiltro('convertidas')} /><Metric label="Perdidas" value={String(resumo.perdidas)} note={pct(resumo.perdidas, resumo.total)} active={filtro === 'perdidas'} onClick={() => toggleFiltro('perdidas')} /></div> : null}<Section title="Follow-ups de hoje" note={`${follows.length} para contactar`}>{follows.length === 0 ? <div className="section-note">Nada agendado para hoje.</div> : <div style={{ display: 'grid', gap: '.5rem' }}>{follows.map((f: any) => <div key={f.id} style={{ display: 'flex', alignItems: 'center', gap: '.6rem', padding: '.55rem .7rem', background: 'hsl(var(--secondary) / .55)', borderRadius: '.5rem' }}><div style={{ flex: 1, minWidth: 0 }}><div style={{ fontWeight: 700, fontSize: '.78rem' }}>{f.name}</div><div className="section-note">{f.ownerNome || staffName(f.ownerId || '')}{f.ultimoResultado ? ` · último: ${f.ultimoResultado}` : ''}</div></div>{waLink(f.whatsapp || f.phone) ? <a className="btn-quiet" href={waLink(f.whatsapp || f.phone)} target="_blank" rel="noreferrer" title="Abrir WhatsApp"><MessageCircle size={14} /></a> : null}<button className="btn-secondary" onClick={() => setFicha({ ...(f as Lead), status: LEAD_API_TO_PT[(f as any).status] ?? (f as any).status, statusApi: (f as any).status, owner: (f as any).ownerId || '' } as Lead)}>Abrir ficha</button></div>)}</div>}</Section><Section title="Todos os leads" note={`${filtered.length} resultados${viewMsg ? ` · ${viewMsg}` : ''}`} action={<button className="btn-quiet" onClick={saveView}><Filter size={13} /> Guardar vista</button>}><div className="table-wrap"><table className="data-table"><thead><tr><th>Lead</th><th>WhatsApp</th><th>Origem</th><th>Etapa</th><th>Responsável</th><th>Próx. contacto</th><th>Último contacto</th><th>Valor estimado</th><th /></tr></thead><tbody>{filtered.map(l => <tr key={l.id} data-testid={`row-lead-${l.id}`}><td><div style={{ display: 'flex', alignItems: 'center', gap: '.6rem' }}><div style={{ width: 30, height: 30, borderRadius: 7, display: 'grid', placeItems: 'center', background: 'hsl(var(--secondary))', fontSize: '.64rem', fontWeight: 700 }}>{l.name.slice(0, 2).toUpperCase()}</div><div><div style={{ fontWeight: 700 }}>{l.name}</div><div style={{ fontSize: '.67rem', color: 'hsl(var(--muted-foreground))' }}>{l.company}</div></div></div></td><td>{waLink(l.whatsapp || l.phone) ? <a className="btn-quiet" href={waLink(l.whatsapp || l.phone)} target="_blank" rel="noreferrer" title="Abrir WhatsApp"><MessageCircle size={14} /></a> : <span className="section-note">—</span>}</td><td>{srcLabel(l.source)}</td><td><select className="select" data-testid={`select-lead-row-status-${l.id}`} style={{ padding: '.15rem .5rem', fontSize: '.68rem', width: 'auto' }} value={trackOf(l)} onChange={e => { const s = e.target.value; const st = TRACK_LABEL_TO_API[s] || 'novo_lead'; qc.setQueryData<any>(['/api/v1/leads'], (old: any) => (old?.data ? { ...old, data: old.data.map((x: any) => (x.id === l.id ? { ...x, status: st } : x)) } : old)); updateMut.mutate({ id: l.id, data: { status: st as any } }, { onSuccess: () => reloadAll() }); }}>{TRACK_FICHA_OPTS.map(v => <option key={v}>{v}</option>)}</select></td><td>{staffName(l.owner)}</td><td style={{ whiteSpace: 'nowrap' }}>{fmtDateShort(l.proximoContato)}</td><td style={{ whiteSpace: 'nowrap' }}>{l.ultimoContactoAt ? fmtDateShort(l.ultimoContactoAt) : '—'}</td><td className="mono" style={{ fontSize: '.68rem' }}>{money(l.value)}</td><td><div style={{ display: 'flex', gap: '.25rem' }}><IconButton label="ficha lead" onClick={() => setFicha(l)}><Eye size={14} /></IconButton><IconButton label="editar lead" onClick={() => { setEditing(l); setOpen(true); }}><Edit3 size={14} /></IconButton></div></td></tr>)}</tbody></table></div></Section>{ficha && <LeadFicha lead={ficha} staff={staff} onClose={() => setFicha(null)} onChanged={reloadAll} />}{open && <LeadModal initial={editing} onClose={() => setOpen(false)} onSave={handleSave} userName={userName} />}</>;
}
function LeadModal({ initial, onClose, onSave, userName }: { initial: Lead | null; onClose: () => void; onSave: (x: Lead) => void; userName?: string }) {
  const [name, setName] = useState(initial?.name ?? ''); const [company, setCompany] = useState(initial?.company ?? ''); const [email, setEmail] = useState(initial?.email ?? ''); const [source, setSource] = useState(initial?.source ?? 'Website');
  const [phone, setPhone] = useState(initial?.phone ?? ''); const [zap, setZap] = useState(initial?.whatsapp ?? ''); const [produto, setProduto] = useState(initial?.produtoInteresse ?? '');
  const [estado, setEstado] = useState(TRACK_PT[(initial as any)?.statusApi ?? ''] || initial?.status || TRACK_FICHA_OPTS[0]);
  return <Modal title={initial ? 'Editar lead' : 'Adicionar lead'} subtitle="Registo comercial interno" onClose={onClose}><div className="form-grid"><FormField label="Nome completo" value={name} onChange={setName} placeholder="Ex.: Joana Manuel" /><FormField label="Empresa" value={company} onChange={setCompany} placeholder="Nome da organização" /><FormField label="Email profissional" value={email} onChange={setEmail} type="email" /><FormField label="Telefone" value={phone} onChange={setPhone} placeholder="Ex.: 943412688" /><FormField label="WhatsApp" value={zap} onChange={setZap} placeholder="Ex.: 943412688" /><FormField label="Produto / serviço de interesse" value={produto} onChange={setProduto} placeholder="Ex.: Plano Mensal" /><label><span className="form-label">Origem / campanha</span><input className="input" style={{ width: '100%' }} list="lead-source-datalist" value={source} onChange={e => setSource(e.target.value)} placeholder="Ex.: Website, WhatsApp ou nova campanha" /><datalist id="lead-source-datalist">{LEAD_SOURCE_SUGG.map(x => <option key={x} value={x} />)}</datalist></label><label><span className="form-label">Estado</span><select className="select" style={{ width: '100%' }} value={estado} onChange={e => setEstado(e.target.value)}>{TRACK_FICHA_OPTS.map(x => <option key={x}>{x}</option>)}</select></label><div style={{ display: 'flex', justifyContent: 'flex-end', gap: '.5rem', marginTop: '.35rem' }}><button className="btn-secondary" onClick={onClose}>Cancelar</button><button className="btn-primary" disabled={!name || !company} onClick={() => onSave({ id: initial?.id ?? 'LD-' + Date.now().toString(36).slice(-6).toUpperCase(), name, company, email, source, status: estado, owner: initial?.owner ?? (userName || 'Utilizador'), value: initial?.value ?? 0, last: 'Agora', phone, whatsapp: zap, produtoInteresse: produto, notes: initial?.notes ?? '', code: initial?.code ?? '', createdAt: initial?.createdAt ?? '' })}><Check size={14} /> Guardar lead</button></div></div></Modal>;
}

function PipelinePage({ leads, userName, onChanged }: { leads: Lead[]; userName?: string; onChanged?: () => void }) {
  const stages = ['Novo Lead', 'Qualificação', 'Proposta', 'Negociação', 'Convertido', 'Perdido']; const [selected, setSelected] = useState<Lead | null>(null);
  const [isNew, setIsNew] = useState(false);
  const [sort, setSort] = useState('Recentes');
  const updateMut = useUpdateLead(); const createMut = useCreateLead();
  const qc = useQueryClient();
  const move = (lead: Lead, stage: string) => {
    const status = (TRACK_LABEL_TO_API[stage] || LEAD_PT_TO_API[stage] || 'novo_lead') as string;
    // Optimista: atualiza já o cache partilhado (todas as janelas refletem de imediato) e confirma no servidor.
    qc.setQueryData<any>(['/api/v1/leads'], (old: any) => (old?.data ? { ...old, data: old.data.map((x: any) => (x.id === lead.id ? { ...x, status } : x)) } : old));
    updateMut.mutate({ id: lead.id, data: { status } as any }, { onSettled: () => onChanged?.() });
  };
  const sorted = (cards: Lead[]) => sort === 'Maior valor' ? [...cards].sort((a, b) => b.value - a.value) : sort === 'Nome A-Z' ? [...cards].sort((a, b) => a.name.localeCompare(b.name)) : cards;
  const handleSave = (x: Lead) => {
    const data = { name: x.name, email: x.email || undefined, company: x.company || undefined, source: x.source || undefined, status: (TRACK_LABEL_TO_API[x.status] || LEAD_PT_TO_API[x.status] || 'novo_lead') as any, ownerId: x.owner || undefined, estimatedValue: x.value || 0 };
    if (!isNew && selected) updateMut.mutate({ id: selected.id, data }, { onSuccess: () => { setSelected(null); onChanged?.(); } });
    else createMut.mutate({ data }, { onSuccess: () => { setIsNew(false); onChanged?.(); } });
  };
  const cycleSort = () => setSort(sort === 'Recentes' ? 'Maior valor' : sort === 'Maior valor' ? 'Nome A-Z' : 'Recentes');
  return <><PageHeader eyebrow="Comercial · Conversão" title="Pipeline" subtitle="Acompanhe cada oportunidade até  à decisão." action={<div className="page-actions" style={{ display: 'flex', gap: '.45rem' }}><button className="btn-secondary" onClick={cycleSort}><ListFilter size={14} /> Vista: {sort}</button><button className="btn-primary" onClick={() => { setSelected(null); setIsNew(true); }}><Plus size={14} /> Oportunidade</button></div>} /><div className="card" style={{ padding: '.8rem', marginBottom: '.8rem', display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: '.8rem', flexWrap: 'wrap' }}><div><span className="eyebrow">Valor total em aberto</span><div className="mono" style={{ fontWeight: 600, fontSize: '1.1rem', marginTop: '.25rem' }}>{money(leads.reduce((s, l) => s + l.value, 0))}</div></div><div style={{ display: 'flex', gap: '1.2rem', color: 'hsl(var(--muted-foreground))', fontSize: '.7rem' }}><span><strong style={{ color: 'hsl(var(--foreground))' }}>{leads.length}</strong> oportunidades</span><span><strong style={{ color: 'hsl(var(--foreground))' }}>{Math.round((leads.filter(l => l.status === 'Convertido').length / Math.max(leads.length, 1)) * 100)}%</strong> conversão</span></div></div><div style={{ display: 'grid', gridTemplateColumns: `repeat(${stages.length}, minmax(180px, 1fr))`, gap: '.65rem', overflowX: 'auto', paddingBottom: '.45rem' }}>{stages.map((stage) => { const cards = sorted(leads.filter(l => l.status === stage)); return <div key={stage} style={{ minHeight: 410, background: 'hsl(var(--secondary) / .55)', border: '1px solid hsl(var(--border))', borderRadius: '.65rem', padding: '.65rem' }}><div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '.7rem' }}><div style={{ fontSize: '.7rem', fontWeight: 700 }}>{stage}</div><span style={{ width: 20, height: 20, display: 'grid', placeItems: 'center', borderRadius: 6, background: 'hsl(var(--card))', color: 'hsl(var(--muted-foreground))', fontSize: '.62rem' }}>{cards.length}</span></div><div style={{ display: 'grid', gap: '.5rem' }}>{cards.map(l => <div key={l.id} onClick={() => { setSelected(l); setIsNew(false); }} style={{ textAlign: 'left', padding: '.65rem', background: 'hsl(var(--card))', border: '1px solid hsl(var(--border))', borderRadius: '.5rem', cursor: 'pointer', boxShadow: 'none' }}><div style={{ fontWeight: 700, fontSize: '.74rem' }}>{l.name}</div><div style={{ fontSize: '.66rem', color: 'hsl(var(--muted-foreground))', marginTop: '.15rem' }}>{l.company}</div><div style={{ display: 'flex', justifyContent: 'space-between', marginTop: '.5rem', fontSize: '.64rem' }}><span style={{ color: 'hsl(var(--muted-foreground))' }}>{srcLabel(l.source)}</span><span className="mono">{money(l.value)}</span></div><select className="select" data-testid={`select-pipeline-stage-${l.id}`} style={{ marginTop: '.5rem', width: '100%', fontSize: '.66rem', padding: '.2rem .45rem' }} value={stage} onClick={(e) => e.stopPropagation()} onChange={(e) => { e.stopPropagation(); move(l, e.target.value); }}>{stages.map(sOpt => <option key={sOpt} value={sOpt}>{sOpt}</option>)}</select></div>)}</div></div>; })}</div>{(isNew || selected) && <LeadModal initial={isNew ? null : selected} onClose={() => { setSelected(null); setIsNew(false); }} onSave={handleSave} userName={userName} />}</>;
}


function CustomersPage({ customers, loading, onChanged }: { customers: Customer[]; loading?: boolean; onChanged?: () => void }) {
  const [q, setQ] = useState('');
  // OVG on-demand: atualiza ao entrar aqui (máx 1x/hora); sem polling de fundo.
  const ovg = useOVGClientsRefresh(() => onChanged?.());
  const [status, setStatus] = useState(() => {
    const f = new URLSearchParams(window.location.search).get('filtro');
    return ['Todos', 'Activo', 'Inactivo', 'Bloqueado', 'Em atraso', 'Esgotadas'].includes(f ?? '') ? f as string : 'Todos';
  });
  const filtered = customers.filter(c => `${c.name} ${c.company} ${c.id}`.toLowerCase().includes(q.toLowerCase()) && (status === 'Todos' || (status === 'Esgotadas' ? (c.lessonsLimit !== -1 && (c.lessonsLeft ?? 1) === 0) : c.state === status)));
  const importMutation = useImportCustomerDates();
  const [importMsg, setImportMsg] = useState('');
  const createLeadMut = useCreateLead();
  const [newOpen, setNewOpen] = useState(false);
  const [newName, setNewName] = useState('');
  const [newPhone, setNewPhone] = useState('');
  const [newEmail, setNewEmail] = useState('');
  const [newMsg, setNewMsg] = useState('');
  const saveNewClient = () => {
    if (!newName.trim()) { setNewMsg('Nome é obrigatório'); return; }
    createLeadMut.mutate({ data: { name: newName.trim(), phone: newPhone || undefined, email: newEmail || undefined, company: 'Particular', source: 'Balcão', status: 'novo_lead' as any } }, {
      onSuccess: () => { setNewOpen(false); setNewName(''); setNewPhone(''); setNewEmail(''); setNewMsg(''); onChanged?.(); },
      onError: (e: any) => setNewMsg('Erro: ' + (e.message || 'desconhecido')),
    });
  };
  const handleCsvImport = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = (ev) => {
      const text = ev.target?.result as string;
      const lines = text.split(/\r?\n/).filter(l => l.trim());
      if (lines.length < 2) { setImportMsg('CSV vazio'); return; }
      const header = lines[0].toLowerCase().split(',').map(h => h.trim().replace(/"/g, ''));
      const codeIdx = header.findIndex(h => h === 'code' || h === 'codigo' || h === 'código');
      const ovgIdx = header.findIndex(h => h === 'ovg_id' || h === 'ovgid' || h === 'customer_number');
      const nameIdx = header.findIndex(h => h === 'name' || h === 'nome');
      const dateIdx = header.findIndex(h => h === 'joined_at' || h === 'data_entrada' || h === 'entry_date' || h === 'joined');
      if (dateIdx === -1) { setImportMsg('CSV precisa de coluna "joined_at" (ou "data_entrada", "entry_date")'); return; }
      const rows = lines.slice(1).map(line => {
        const cols = line.split(',').map(c => c.trim().replace(/"/g, ''));
        return {
          code: codeIdx >= 0 ? cols[codeIdx] : undefined,
          ovg_id: ovgIdx >= 0 ? cols[ovgIdx] : undefined,
          name: nameIdx >= 0 ? cols[nameIdx] : undefined,
          joined_at: cols[dateIdx],
        };
      }).filter(r => r.joined_at);
      importMutation.mutate(rows, {
        onSuccess: (res) => { setImportMsg(res.message); },
        onError: (err: any) => { setImportMsg('Erro: ' + (err.message || 'desconhecido')); },
      });
    };
    reader.readAsText(file);
    e.target.value = '';
  };
  return <><PageHeader eyebrow="Receita · Relação" title="Clientes" subtitle="Registos únicos e contexto completo de cada conta." />{importMsg && <div className="card" style={{ padding: '.6rem .8rem', marginBottom: '.6rem', fontSize: '.75rem', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}><span>{importMsg}</span><button className="btn-quiet" onClick={() => setImportMsg('')} aria-label="Fechar mensagem"><X size={14} /></button></div>}{ovg.msg && <div className="card" style={{ padding: '.6rem .8rem', marginBottom: '.6rem', fontSize: '.75rem', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}><span>{ovg.msg}</span><button className="btn-quiet" onClick={() => ovg.clearMsg()} aria-label="Fechar mensagem"><X size={14} /></button></div>}<div className="card" style={{ padding: '.7rem', marginBottom: '.8rem', display: 'flex', gap: '.5rem' }}><div style={{ position: 'relative', maxWidth: 380, width: '100%' }}><Search size={14} style={{ position: 'absolute', left: 10, top: 10, color: 'hsl(var(--muted-foreground))' }} /><input data-testid="input-search-customers" className="input" style={{ paddingLeft: 31 }} placeholder="Pesquisar cliente ou empresa" value={q} onChange={e => setQ(e.target.value)} /></div><select data-testid="select-customer-state" className="select" value={status} onChange={e => setStatus(e.target.value)} style={{ maxWidth: 160 }}><option>Todos</option><option>Activo</option><option>Inactivo</option><option>Bloqueado</option><option>Em atraso</option><option>Esgotadas</option></select></div><Section title="Directório de clientes" note={loading ? 'A carregar…' : `${filtered.length} contas com registo consolidado${ovg.updating ? ' · OVG a atualizar…' : ''}`}><div className="table-wrap"><table className="data-table"><thead><tr><th>Cliente</th><th>Plano</th><th>Estado</th><th>Género</th><th>Entrada</th><th>Aulas</th><th>Contacto</th><th /></tr></thead><tbody>{loading ? <tr><td colSpan={8} style={{ textAlign: 'center', padding: '3rem' }}><div style={{ display: 'inline-block', width: 28, height: 28, border: '3px solid hsl(var(--border))', borderTopColor: 'hsl(var(--accent))', borderRadius: '50%', animation: 'spin 0.7s linear infinite' }} /><div style={{ marginTop: '.6rem', color: 'hsl(var(--muted-foreground))', fontSize: '.75rem' }}>A carregar clientes...</div></td></tr> : filtered.map(c => <tr key={c.id}><td><Link href={`/admin/clientes/${c.id}`} style={{ textDecoration: 'none', color: 'inherit', display: 'flex', alignItems: 'center', gap: '.6rem' }} data-testid={`link-customer-${c.id}`}><div style={{ width: 30, height: 30, borderRadius: 7, display: 'grid', placeItems: 'center', background: 'hsl(var(--secondary))', fontSize: '.64rem', fontWeight: 700 }}>{c.name.slice(0, 2).toUpperCase()}</div><div><div style={{ fontWeight: 700 }}>{c.name}</div><div style={{ fontSize: '.67rem', color: 'hsl(var(--muted-foreground))' }}>{c.company} · {c.id}</div></div></Link></td><td>{c.plan || '—'}</td><td><Status tone={c.state === 'Activo' ? 'good' : 'warn'}>{c.state}</Status></td><td style={{ fontSize: '.72rem' }}>{c.gender || '—'}</td><td>{c.joined}</td><td style={{ fontWeight: 600, color: c.lessonsLimit !== -1 && (c.lessonsLeft ?? 1) === 0 ? 'hsl(0 70% 50%)' : undefined }}>{c.lessonsLimit === -1 ? '∞' : `${c.lessonsLeft ?? '—'} / ${c.lessonsLimit ?? '—'}`}</td><td><div style={{ fontSize: '.72rem' }}>{c.email}</div><div style={{ fontSize: '.65rem', color: 'hsl(var(--muted-foreground))' }}>{c.phone}</div></td><td><ChevronRight size={15} color="hsl(var(--muted-foreground))" /></td></tr>)}</tbody></table></div></Section>
  {newOpen && <div className="modal-backdrop" onClick={() => setNewOpen(false)}><div className="modal" onClick={e => e.stopPropagation()} style={{ maxWidth: '420px', padding: '1.2rem' }}>
    <h3 style={{ marginBottom: '.2rem' }}>Novo cliente</h3>
    <div className="section-note" style={{ marginBottom: '1rem' }}>Regista como lead de Balcão para acompanhamento comercial.</div>
    <label className="label">Nome *</label>
    <input className="input" value={newName} onChange={e => setNewName(e.target.value)} placeholder="Nome completo" style={{ width: '100%' }} />
    <div style={{ display: 'flex', gap: '.5rem', marginTop: '.6rem' }}>
      <div style={{ flex: 1 }}><label className="label">Telefone</label>
      <input className="input" value={newPhone} onChange={e => setNewPhone(e.target.value)} placeholder="9XXXXXXXX" /></div>
      <div style={{ flex: 1 }}><label className="label">Email</label>
      <input className="input" value={newEmail} onChange={e => setNewEmail(e.target.value)} placeholder="email@..." /></div>
    </div>
    {newMsg && <div style={{ fontSize: '.75rem', marginTop: '.6rem', color: 'hsl(0 70% 50%)' }}>{newMsg}</div>}
    <div style={{ display: 'flex', gap: '.5rem', marginTop: '1rem' }}>
      <button className="btn-secondary" onClick={() => setNewOpen(false)} style={{ flex: 1 }}>Cancelar</button>
      <button className="btn-primary" onClick={saveNewClient} disabled={createLeadMut.isPending} style={{ flex: 1 }}><Check size={14} /> {createLeadMut.isPending ? 'A guardar…' : 'Guardar'}</button>
    </div>
  </div></div>}</>;
}
function CustomerDetail({ customers, onChanged }: { customers: Customer[]; onChanged?: () => void }) {
  const { id } = useParams<{ id: string }>(); const customer = customers.find(c => c.id === id) ?? customers[0];
  const [, setLocation] = useLocation();
  const [editOpen, setEditOpen] = useState(false);
  const [menuOpen, setMenuOpen] = useState(false);
  const [fName, setFName] = useState(''); const [fPhone, setFPhone] = useState(''); const [fEmail, setFEmail] = useState(''); const [fGender, setFGender] = useState('');
  const [editMsg, setEditMsg] = useState(''); const [saving, setSaving] = useState(false);
  const openEdit = () => {
    if (!customer) return;
    setFName(customer.name || ''); setFPhone(customer.phone || ''); setFEmail(customer.email || '');
    setFGender(customer.gender === 'Masculino' ? 'M' : customer.gender === 'Feminino' ? 'F' : '');
    setEditMsg(''); setEditOpen(true);
  };
  const saveEdit = async () => {
    if (!customer) return;
    if (!fName.trim()) { setEditMsg('Nome é obrigatório'); return; }
    setSaving(true);
    try {
      const token = localStorage.getItem('token');
      const base = import.meta.env.VITE_API_URL || '';
      const res = await fetch(`${base}/api/v1/customers/${encodeURIComponent(customer.id)}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json', ...(token ? { Authorization: `Bearer ${token}` } : {}) },
        body: JSON.stringify({ nome: fName.trim(), telefone: fPhone, email: fEmail, genero: fGender }),
      });
      if (!res.ok) { const e = await res.json().catch(() => ({})); throw new Error((e as any).error || res.statusText); }
      setEditOpen(false); onChanged?.();
    } catch (e: any) { setEditMsg('Erro: ' + e.message); }
    setSaving(false);
  };
  const waLink = () => {
    if (!customer) return;
    const digits = (customer.phone || '').replace(/\D/g, '');
    if (!digits) { alert('Cliente sem telefone'); return; }
    window.open(`https://wa.me/${digits}?text=${encodeURIComponent(`Olá ${customer.name}! Aqui é da SamoraFit. `)}`, '_blank');
  };
  if (!customer) return <EmptyState title="Cliente não encontrado" text="O registo solicitado não foi localizado." action={<Link href="/admin/clientes" className="btn-primary">Voltar  à lista</Link>} />; 
  return <><PageHeader eyebrow="Cliente · Perfil 360º" title={customer.name} subtitle={`${customer.company} · ${customer.id}`} action={<div className="page-actions" style={{ display: 'flex', gap: '.4rem' }}><button className="btn-secondary" onClick={openEdit}><Edit3 size={14} /> Editar</button><div style={{ position: 'relative' }}><button className="btn-primary" onClick={() => setMenuOpen(!menuOpen)}><MoreHorizontal size={14} /> Acções</button>{menuOpen && <div className="card" style={{ position: 'absolute', right: 0, top: '110%', zIndex: 30, padding: '.4rem', minWidth: 180 }}>
    <button className="btn-quiet" style={{ width: '100%', justifyContent: 'flex-start' }} onClick={() => { setMenuOpen(false); setLocation(`/admin/acesso-fisico?search=${encodeURIComponent(customer.name)}`); }}>Ver acessos</button>
    <button className="btn-quiet" style={{ width: '100%', justifyContent: 'flex-start' }} onClick={() => { setMenuOpen(false); waLink(); }}>WhatsApp</button>
  </div>}</div></div>} /><div className="content-grid" style={{ display: 'grid', gridTemplateColumns: '1.1fr .9fr', gap: '.8rem' }}><Section title="Resumo da conta" note="Fonte única de verdade"><div style={{ display: 'flex', alignItems: 'center', gap: '.75rem', marginBottom: '1rem' }}><div style={{ width: 51, height: 51, borderRadius: 12, display: 'grid', placeItems: 'center', background: 'hsl(var(--primary))', color: 'white', fontWeight: 700 }}>{customer.name.slice(0, 2).toUpperCase()}</div><div><div style={{ fontWeight: 700 }}>{customer.company}</div><div className="section-note">{customer.email} · {customer.phone}</div></div></div>    <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: '.6rem' }}>
      {[
        ['Plano', customer.plan || '—'],
        ['Estado', customer.state],
        ['Desde', customer.joined],
      ].map(([l, v]) => (
        <div key={l} style={{ padding: '.7rem', background: 'hsl(var(--secondary) / .65)', borderRadius: '.5rem' }}>
          <div className="eyebrow">{l}</div>
          <div style={{ fontSize: '.8rem', fontWeight: 600, marginTop: '.3rem' }}>{v}</div>
        </div>
      ))}
    </div>
    {customer.lessonsLimit !== undefined && customer.lessonsLimit !== null && (
      <div style={{ marginTop: '.7rem', padding: '.7rem', background: 'hsl(var(--secondary) / .65)', borderRadius: '.5rem' }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '.73rem', marginBottom: '.35rem' }}><span className="eyebrow">Aulas restantes</span><strong>{customer.lessonsLimit === -1 ? 'Ilimitado' : `${customer.lessonsLeft ?? '—'} de ${customer.lessonsLimit}`}</strong></div>
        {customer.lessonsLimit !== -1 && customer.lessonsLimit > 0 && (
          <div className="progress-track"><div className="progress-fill" style={{ width: `${Math.min(100, ((customer.lessonsLeft ?? 0) / customer.lessonsLimit) * 100)}%`, background: (customer.lessonsLeft ?? 0) === 0 ? 'hsl(0 70% 50%)' : undefined }} /></div>
        )}
      </div>
    )}
    {customer.gender && (
      <div style={{ marginTop: '.7rem', padding: '.5rem .7rem', background: 'hsl(var(--secondary) / .45)', borderRadius: '.5rem', fontSize: '.75rem' }}>
        <span style={{ color: 'hsl(var(--muted-foreground))' }}>Género:</span>{' '}
        <span style={{ fontWeight: 600 }}>{customer.gender}</span>
      </div>
    )}
    {customer.ovgId && (
      <div style={{ marginTop: '.7rem', padding: '.5rem .7rem', background: 'hsl(var(--secondary) / .45)', borderRadius: '.5rem', fontSize: '.75rem', display: 'grid', gap: '.3rem' }}>
        <div style={{ fontWeight: 700, fontSize: '.72rem' }}>Dados OVG</div>
        {[['Nº sócio', customer.ovgId], ['NIF', customer.nif || '—'], ['Clube', customer.club || '—'], ['Sócio desde', customer.entryDate || '—']].map(([l, v]) => (
          <div key={l} style={{ display: 'flex', justifyContent: 'space-between' }}><span style={{ color: 'hsl(var(--muted-foreground))' }}>{l}:</span><strong>{v}</strong></div>
        ))}
      </div>
    )}</Section><Section title="Saúde da conta" note="Indicadores de retenção"><div style={{ display: 'grid', gap: '.9rem' }}>{(() => {
        const unlimited = customer.lessonsLimit === -1;
        const lessonsLabel = unlimited ? 'Ilimitado' : (customer.lessonsLeft !== null && customer.lessonsLeft !== undefined && customer.lessonsLimit ? `${customer.lessonsLeft} de ${customer.lessonsLimit}` : '—');
        const lessonsPct = unlimited ? 100 : (customer.lessonsLimit ? Math.max(0, Math.min(100, Math.round(((customer.lessonsLeft ?? 0) / customer.lessonsLimit) * 100))) : 0);
        const rows = customer.state === 'Activo'
          ? [['Estado da conta', 'Activo', 100], ['Aulas restantes', lessonsLabel, lessonsPct], ['Último acesso', customer.joined || '—', 100]]
          : [['Estado da conta', customer.state, customer.state === 'Inactivo' ? 0 : 50], ['Aulas restantes', lessonsLabel, lessonsPct], ['Último acesso', customer.joined || '—', 100]];
        return rows.map(([l, v, p]) => <div key={l as string}><div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '.73rem', marginBottom: '.35rem' }}><span>{l as string}</span><strong>{v as string}</strong></div><div className="progress-track"><div className="progress-fill" style={{ width: `${p as number}%`, background: (p as number) === 100 ? 'hsl(155 41% 43%)' : undefined }} /></div></div>)})()}</div></Section></div>
  {editOpen && <div className="modal-backdrop" onClick={() => setEditOpen(false)}><div className="modal" onClick={e => e.stopPropagation()} style={{ maxWidth: '420px', padding: '1.2rem' }}>
    <h3 style={{ marginBottom: '.2rem' }}>Editar cliente</h3>
    <div className="section-note" style={{ marginBottom: '1rem' }}>Só nome, telefone, email e género (a catraca gere o resto).</div>
    <label className="label">Nome *</label>
    <input className="input" value={fName} onChange={e => setFName(e.target.value)} style={{ width: '100%' }} />
    <div style={{ display: 'flex', gap: '.5rem', marginTop: '.6rem' }}>
      <div style={{ flex: 1 }}><label className="label">Telefone</label>
      <input className="input" value={fPhone} onChange={e => setFPhone(e.target.value)} /></div>
      <div style={{ flex: 1 }}><label className="label">Email</label>
      <input className="input" value={fEmail} onChange={e => setFEmail(e.target.value)} /></div>
    </div>
    <div style={{ marginTop: '.6rem' }}><label className="label">Género</label>
      <select className="select" value={fGender} onChange={e => setFGender(e.target.value)} style={{ width: '100%' }}><option value="">Não definido</option><option value="M">Masculino</option><option value="F">Feminino</option></select></div>
    {editMsg && <div style={{ fontSize: '.75rem', marginTop: '.6rem', color: 'hsl(0 70% 50%)' }}>{editMsg}</div>}
    <div style={{ display: 'flex', gap: '.5rem', marginTop: '1rem' }}>
      <button className="btn-secondary" onClick={() => setEditOpen(false)} style={{ flex: 1 }}>Cancelar</button>
      <button className="btn-primary" onClick={saveEdit} disabled={saving} style={{ flex: 1 }}><Check size={14} /> {saving ? 'A guardar…' : 'Guardar'}</button>
    </div>
  </div></div>}</>;
}
function MiniList({ items }: { items: string[] }) { return <div style={{ display: 'grid', gap: '.65rem' }}>{items.map((x, i) => <div key={x} style={{ display: 'flex', alignItems: 'center', gap: '.55rem', fontSize: '.72rem', color: i === 0 ? 'hsl(var(--foreground))' : 'hsl(var(--muted-foreground))' }}><span style={{ width: 6, height: 6, borderRadius: '50%', background: i === 0 ? 'hsl(var(--chart-2))' : 'hsl(var(--border))' }} />{x}</div>)}</div>; }

function PlansPage() {
  const apiBase = import.meta.env.VITE_API_URL || '';
  const [plans, setPlans] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [showModal, setShowModal] = useState(false);
  const [editing, setEditing] = useState<any>(null);
  const [form, setForm] = useState({ name: '', description: '', price: '', periodicity: 'mensal', active: true });

  const fetchPlans = async () => {
    try {
      const res = await fetch(`${apiBase}/api/v1/plans`, {
        headers: authHeaders(),
      });
      if (res.ok) {
        const json = await res.json();
        setPlans(json.data || []);
      }
    } catch (e) { console.error(e); }
    setLoading(false);
  };

  useEffect(() => { fetchPlans(); }, []);

  const openNew = () => {
    setEditing(null);
    setForm({ name: '', description: '', price: '', periodicity: 'mensal', active: true });
    setShowModal(true);
  };

  const openEdit = (p: any) => {
    setEditing(p);
    setForm({ name: p.name || '', description: p.description || '', price: String(p.price ?? ''), periodicity: p.periodicity || 'mensal', active: p.active !== false });
    setShowModal(true);
  };

  const save = async () => {
    if (!form.name.trim()) { alert('Nome é obrigatório'); return; }
    const body = {
      name: form.name.trim(),
      description: form.description || null,
      price: parseFloat(form.price) || 0,
      periodicity: form.periodicity,
      active: form.active,
    };
    try {
      const url = editing ? `${apiBase}/api/v1/plans/${editing.id}` : `${apiBase}/api/v1/plans`;
      const res = await fetch(url, {
        method: editing ? 'PUT' : 'POST',
        headers: authHeaders(),
        body: JSON.stringify(body),
      });
      if (res.ok) {
        setShowModal(false);
        fetchPlans();
      } else {
        const err = await res.json().catch(() => ({}));
        alert('Erro: ' + (err.error || res.statusText));
      }
    } catch (e: any) { alert('Erro: ' + e.message); }
  };

  const del = async (p: any) => {
    if (!confirm(`Apagar plano "${p.name}"?`)) return;
    try {
      const res = await fetch(`${apiBase}/api/v1/plans/${p.id}`, {
        method: 'DELETE',
        headers: authHeaders(),
      });
      const j: any = await res.json().catch(() => ({}));
      if (res.status === 409 && j.error === 'has_dependencies') {
        if (!confirm(`"${p.name}" tem ${j.subscriptions} subscrições e ${j.payments} pagamentos. APAGAR TUDO? (irreversível, histórico some do Controlo e do site)`)) return;
        const res2 = await fetch(`${apiBase}/api/v1/plans/${p.id}?force=1`, {
          method: 'DELETE',
          headers: authHeaders(),
        });
        const j2: any = await res2.json().catch(() => ({}));
        if (res2.ok) { alert('Plano e histórico apagados'); fetchPlans(); }
        else alert('Erro: ' + (j2.error || 'ao apagar'));
        return;
      }
      if (res.ok) fetchPlans();
      else alert('Erro: ' + (j.error || 'ao apagar'));
    } catch (e: any) { alert('Erro: ' + e.message); }
  };

  return <><PageHeader eyebrow="Receita · Catálogo" title="Planos" subtitle="Catálogo comercial e estado das subscrições." action={<button className="btn-primary" onClick={openNew}><Plus size={14} /> Novo plano</button>} />
  {loading ? <div className="card" style={{ padding: '2rem', textAlign: 'center' }}>A carregar…</div> :
  <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(280px, 1fr))', gap: '.8rem' }}>{plans.length === 0 && <div className="card" style={{ padding: '2rem', textAlign: 'center', color: 'hsl(var(--muted-foreground))' }}>Nenhum plano configurado</div>}{(plans).map((p, i) => <div className="card" key={p.id} style={{ padding: '1.1rem', borderTop: i === 0 ? '3px solid hsl(var(--accent))' : undefined }}><div style={{ display: 'flex', alignItems: 'start', justifyContent: 'space-between' }}><div><div className="eyebrow">{i === 0 ? 'Mais subscrito' : `Plano 0${i + 1}`}</div><h2 style={{ fontSize: '1.05rem', marginTop: '.35rem' }}>{p.name}</h2></div><Status tone={p.active ? 'good' : 'warn'}>{p.active ? 'Activo' : 'Inactivo'}</Status></div><p className="section-note" style={{ minHeight: 33 }}>{p.description || 'Plano disponível'}</p><div className="mono" style={{ fontSize: '1.2rem', margin: '1rem 0' }}>{p.price ? money(p.price) : 'Gratuito'}<span style={{ fontFamily: 'var(--app-font-sans)', color: 'hsl(var(--muted-foreground))', fontSize: '.67rem' }}> / {p.periodicity || 'mês'}</span></div><div style={{ display: 'flex', gap: '.4rem' }}><button className="btn-secondary" onClick={() => openEdit(p)} style={{ flex: 1 }}>Editar</button><button className="btn-secondary" onClick={() => del(p)} style={{ color: 'hsl(0 70% 50%)' }}><Trash2 size={14} /></button></div></div>)}</div>}
  {showModal && <div className="modal-backdrop" onClick={() => setShowModal(false)}><div className="modal" onClick={e => e.stopPropagation()} style={{ maxWidth: '420px', padding: '1.2rem' }}>
    <h3 style={{ marginBottom: '1rem' }}>{editing ? 'Editar plano' : 'Novo plano'}</h3>
    <label className="label">Nome *</label>
    <input className="input" value={form.name} onChange={e => setForm({ ...form, name: e.target.value })} placeholder="Ex: SamoraFit Mensal" />
    <label className="label" style={{ marginTop: '.6rem' }}>Descrição</label>
    <textarea className="input" value={form.description} onChange={e => setForm({ ...form, description: e.target.value })} placeholder="Descrição do plano" rows={2} />
    <div style={{ display: 'flex', gap: '.5rem', marginTop: '.6rem' }}>
      <div style={{ flex: 1 }}><label className="label">Preço (Kz)</label>
      <input className="input" type="number" min="0" value={form.price} onChange={e => setForm({ ...form, price: e.target.value })} placeholder="25000" /></div>
      <div style={{ flex: 1 }}><label className="label">Periodicidade</label>
      <select className="select" value={form.periodicity} onChange={e => setForm({ ...form, periodicity: e.target.value })}><option value="avulso">Avulso</option><option value="semanal">Semanal</option><option value="quinzenal">Quinzenal</option><option value="3_semanas">3 semanas</option><option value="mensal">Mensal</option><option value="trimestral">Trimestral</option><option value="semestral">Semestral</option><option value="anual">Anual</option></select></div>
    </div>
    <label style={{ display: 'flex', alignItems: 'center', gap: '.5rem', marginTop: '.8rem', fontSize: '.8rem' }}><input type="checkbox" checked={form.active} onChange={e => setForm({ ...form, active: e.target.checked })} /> Plano activo</label>
    <div style={{ display: 'flex', gap: '.5rem', marginTop: '1rem' }}>
      <button className="btn-secondary" onClick={() => setShowModal(false)} style={{ flex: 1 }}>Cancelar</button>
      <button className="btn-primary" onClick={save} style={{ flex: 1 }}><Check size={14} /> Guardar</button>
    </div>
  </div></div>}
  </>;
}

function PaymentDetailModal({ payment, onClose }: { payment: any; onClose: () => void }) {
  const [checking, setChecking] = useState(false);
  const [checkResult, setCheckResult] = useState<any>(null);
  const [sending, setSending] = useState(false);
  const [sendResult, setSendResult] = useState<string | null>(null);
  const [cancelling, setCancelling] = useState(false);

  const sendCademi = async () => {
    setSending(true); setSendResult(null);
    try {
      const res = await fetch(`${import.meta.env.VITE_API_URL || 'http://localhost:3000'}/api/v1/payments/${payment.code || payment.id}/cademi-delivery`, { method: 'POST', headers: authHeaders() });
      const data = await res.json().catch(() => null);
      setSendResult(res.ok ? `Acesso libertado (${data?.email || ''})` : `Falha: ${data?.error || res.statusText}`);
    } catch (e: any) { setSendResult('Erro: ' + e.message); }
    setSending(false);
  };

  const checkStatus = async () => {
    setChecking(true);
    try {
      const res = await fetch(`${import.meta.env.VITE_API_URL || 'http://localhost:3000'}/api/v1/payments/ekwanza/check-status/${payment.raw?.id || payment.id}`, { credentials: 'include' });
      if (res.ok) {
        const data = await res.json();
        setCheckResult(data);
        if (data.changed) window.location.reload();
      }
    } catch (e) { console.error(e); }
    setChecking(false);
  };

  const cancelPayment = async () => {
    const code = payment.code || payment.id;
    if (!confirm(`Cancelar o pagamento ${code}? O aluno pode gerar nova cobrança depois.`)) return;
    setCancelling(true);
    try {
      const res = await fetch(`${import.meta.env.VITE_API_URL || 'http://localhost:3000'}/api/v1/payments/${code}/cancel`, {
        method: 'POST',
        headers: authHeaders(),
        body: JSON.stringify({ email: payment.customerEmail || undefined, phone: payment.customerPhone || undefined }),
      });
      const j: any = await res.json().catch(() => ({}));
      if (res.ok) { alert('Pagamento cancelado'); window.location.reload(); }
      else alert('Não cancelou: ' + (j.error || res.statusText));
    } catch (e: any) { alert('Erro: ' + e.message); }
    setCancelling(false);
  };

  const fmtDate = (d: string | null) => {
    if (!d) return '—';
    try { return new Date(d).toLocaleString('pt-AO', { day: '2-digit', month: 'short', year: 'numeric', hour: '2-digit', minute: '2-digit' }); } catch { return d; }
  };
  const raw = payment.raw ?? {};
  const meta = raw.metadata && typeof raw.metadata === 'object' ? raw.metadata : {};
  const fields = [
    ['Código da Transação', payment.code || payment.id || '—'],
    ['Número da Referência', payment.referenceCode || raw.referenceCode || '—'],
    ['Entidade', payment.entity || raw.entity || meta.entity || '—'],
    ['Código É-kwanza', payment.ekwanzaCode || raw.ekwanzaCode || '—'],
    ['Código Operação É-kwanza', payment.ekwanzaOperationCode || raw.ekwanzaOperationCode || '—'],
    ['Cliente', payment.customerName || '—'],
    ['Telefone', payment.customerPhone || '—'],
    ['Email', payment.customerEmail || '—'],
    ['Montante', payment.amount ? money(payment.amount) : '—'],
    ['Método', payment.method || '—'],
    ['Estado', payment.state || '—'],
    ['Data de Criação', fmtDate(payment.createdAt)],
    ['Data de Pagamento', fmtDate(payment.paidAt)],
    ['Expira em', fmtDate(payment.expiresAt)],
  ];
  return <Modal title="Detalhes do Pagamento" subtitle={`Transação ${payment.code || payment.id}`} onClose={onClose}>
    <div style={{ display: 'grid', gap: '.55rem' }}>
      {fields.map(([label, value]) => (
        <div key={label} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '.5rem .65rem', background: 'hsl(var(--secondary) / .45)', borderRadius: '.4rem' }}>
          <span style={{ fontSize: '.73rem', color: 'hsl(var(--muted-foreground))' }}>{label}</span>
          <span className="mono" style={{ fontSize: '.72rem', fontWeight: 600, textAlign: 'right', maxWidth: '60%', wordBreak: 'break-all' }}>{value}</span>
        </div>
      ))}
      {Object.keys(meta).length > 0 && <div style={{ marginTop: '.3rem' }}><div className="eyebrow" style={{ marginBottom: '.35rem' }}>Metadados</div>{Object.entries(meta).map(([k, v]) => <div key={k} style={{ display: 'flex', justifyContent: 'space-between', padding: '.4rem .65rem', background: 'hsl(var(--secondary) / .3)', borderRadius: '.3rem', marginBottom: '.2rem' }}><span style={{ fontSize: '.68rem', color: 'hsl(var(--muted-foreground))' }}>{k}</span><span className="mono" style={{ fontSize: '.67rem' }}>{String(v)}</span></div>)}</div>}
      <div style={{ marginTop: '.5rem', display: 'flex', gap: '.5rem' }}>
        <button className="btn-secondary" onClick={checkStatus} disabled={checking} style={{ flex: 1 }}>
          {checking ? 'Verificando…' : 'Verificar Estado no É-kwanza'}
        </button>
        <button className="btn-primary" onClick={sendCademi} disabled={sending} style={{ flex: 1 }}>
          {sending ? 'A enviar…' : 'Enviar SamoraFit Workout'}
        </button>
      </div>
      {(payment.state === 'pendente' || payment.raw?.status === 'pendente') && (
        <div style={{ marginTop: '.5rem' }}>
          <button className="btn-secondary" onClick={cancelPayment} disabled={cancelling} style={{ flex: 1, width: '100%', color: 'hsl(0 70% 50%)' }}>
            {cancelling ? 'A cancelar…' : 'Cancelar pagamento'}
          </button>
        </div>
      )}
      {sendResult && (
        <div style={{ marginTop: '.4rem', padding: '.5rem .65rem', background: 'hsl(var(--secondary) / .45)', borderRadius: '.4rem', fontSize: '.72rem' }}>
          <strong>SamoraFit Workout:</strong> {sendResult}
        </div>
      )}
      {checkResult && (
        <div style={{ marginTop: '.4rem', padding: '.5rem .65rem', background: checkResult.changed ? 'hsl(142 70% 45% / .15)' : 'hsl(var(--secondary) / .45)', borderRadius: '.4rem', fontSize: '.72rem' }}>
          <strong>É-kwanza:</strong> {checkResult.ekwanzaStatus} {checkResult.changed && `(atualizado de ${checkResult.previousStatus})`}
          {checkResult.reference && <div style={{ marginTop: '.2rem', fontSize: '.68rem' }}>Ref: {checkResult.reference.referenceNumber} | Entity: {checkResult.reference.entity}</div>}
        </div>
      )}
    </div>
  </Modal>;
}

const PAYMENT_METHOD_LABELS: Record<string, string> = { mcx_express: 'M. Express', referencia: 'Referência', kwik: 'KWiK', multicaixa: 'Multicaixa' };

function fmtPaymentDate(d: string | null | undefined): string {
  if (!d) return '—';
  try {
    const dt = new Date(d);
    const day = String(dt.getDate()).padStart(2, '0');
    const month = String(dt.getMonth() + 1).padStart(2, '0');
    const hours = String(dt.getHours()).padStart(2, '0');
    const mins = String(dt.getMinutes()).padStart(2, '0');
    return `${day}/${month}/${dt.getFullYear()} ${hours}:${mins}`;
  } catch { return d; }
}

function PaymentsPage() {
  const [paymentsData, setPaymentsData] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  
  const fetchPayments = async () => {
    try {
      const apiBase = import.meta.env.VITE_API_URL || '';
      const res = await fetch(`${apiBase}/api/v1/payments`, {
        headers: authHeaders(),
        credentials: 'include',
      });
      if (res.ok) {
        const json = await res.json();
        const rows = json.data || [];
        setPaymentsData(rows);
        return rows;
      }
    } catch (e) { console.error(e); }
    setLoading(false);
    return null;
  };

  useEffect(() => { fetchPayments().finally(() => setLoading(false)); }, []);

  // Realtime: SSE push + polling de segurança a cada 5min (cota Neon mensal; fase Cademi-CRM)
  usePaymentStream(() => { fetchPayments(); });
  useEffect(() => {
    const t = setInterval(() => { fetchPayments(); }, 300000);
    return () => clearInterval(t);
  }, []);

  // Auto-sync: pergunta à É-kwanza o estado dos pendentes a cada 5min (cota Neon mensal).
  // Sem isto o estado fica preso em "pendente" até alguém clicar Sincronizar.
  const syncingRef = useRef(false);
  const syncPendentes = async (rows?: any[]) => {
    if (syncingRef.current) return 0;
    const list = rows ?? paymentsDataRef.current;
    const pend = list.filter((p: any) => p.status === 'pendente').slice(0, 10);
    if (pend.length === 0) return 0;
    syncingRef.current = true;
    let changed = 0;
    try {
      const apiBase = import.meta.env.VITE_API_URL || '';
      for (const p of pend) {
        try {
          const r = await fetch(`${apiBase}/api/v1/payments/ekwanza/check-status/${p.code || p.id}`, {
            headers: authHeaders(),
          });
          const j = await r.json().catch(() => null);
          if (j?.changed) changed++;
          await new Promise(r2 => setTimeout(r2, 300));
        } catch {}
      }
    } finally { syncingRef.current = false; }
    if (changed > 0) await fetchPayments();
    return changed;
  };
  const paymentsDataRef = useRef<any[]>([]);
  paymentsDataRef.current = paymentsData;
  useEffect(() => {
    const t = setInterval(() => { syncPendentes(); }, 300000);
    return () => clearInterval(t);
  }, []);

  const [syncing, setSyncing] = useState(false);
  const [chargeOpen, setChargeOpen] = useState(false);
  const [cAmount, setCAmount] = useState('');
  const [cMethod, setCMethod] = useState('mcx_express');
  const [cPhone, setCPhone] = useState('');
  const [cEmail, setCEmail] = useState('');
  const [cName, setCName] = useState('');
  const [cEntregas, setCEntregas] = useState<Array<{ id: string; nome: string; preco?: number }>>([]);
  const [cProduto, setCProduto] = useState('');
  const pickProduto = (id: string) => {
    setCProduto(id);
    // Preço da tabela Cademi: preenche o montante (editável).
    const found = cEntregas.find(o => o.id === id);
    if (found?.preco) setCAmount(String(found.preco));
  };
  const [cDesc, setCDesc] = useState('');
  const [cMsg, setCMsg] = useState('');
  const [charging, setCharging] = useState(false);
  // Entregas reais (slugs da Cademi) para o seletor de conteúdo.
  useEffect(() => {
    if (!chargeOpen) return;
    const apiBase = import.meta.env.VITE_API_URL || '';
    fetch(`${apiBase}/api/v1/cademi/entregas`, { headers: authHeaders() })
      .then(r => r.json())
      .then(j => {
        const list = Array.isArray(j.data) ? j.data : [];
        setCEntregas(list);
        if (!cProduto && list.length > 0) setCProduto(list[0].id);
      })
      .catch(() => {});
  }, [chargeOpen]);
  const createCharge = async () => {
    const amt = parseFloat(cAmount);
    if (!amt || amt <= 0) { setCMsg('Indica um montante válido'); return; }
    if (cMethod === 'mcx_express' && !cPhone.trim()) { setCMsg('Express precisa do número de telefone'); return; }
    // Snapshot dos campos + FECHO IMEDIATO (optimista).
    // O POST corre em background: o modal fecha sempre, mesmo que o
    // servidor demore (É-kwanza) ou esteja na versão antiga.
    const payload = { amount: amt, method: cMethod, customer_phone: cPhone.trim() || undefined, customer_email: cEmail.trim() || undefined, customer_name: cName.trim() || undefined, cademi_produto: cProduto || undefined, description: cDesc.trim() || undefined };
    const snap = { amount: cAmount, method: cMethod, phone: cPhone, email: cEmail, name: cName, produto: cProduto, desc: cDesc };
    setChargeOpen(false);
    setCAmount(''); setCPhone(''); setCEmail(''); setCName(''); setCProduto(''); setCDesc(''); setCMsg('');
    setCharging(false);
    try {
      const apiBase3 = import.meta.env.VITE_API_URL || '';
      const ctrl = new AbortController();
      const timer = setTimeout(() => ctrl.abort(), 20000);
      let res: Response;
      try {
        res = await fetch(`${apiBase3}/api/v1/payments`, {
          method: 'POST',
          headers: authHeaders(),
          body: JSON.stringify(payload),
          signal: ctrl.signal,
        });
      } finally { clearTimeout(timer); }
      const json = await res.json().catch(() => null);
      if (!res.ok) throw new Error(json?.error || res.statusText);
      const rows = await fetchPayments();
      // Re-verifica o estado na É-kwanza aos 15s/45s/90s (o cliente aprova no telefone).
      [15000, 45000, 90000].forEach(dt => setTimeout(() => { syncPendentes(rows || undefined); }, dt));
    } catch (e: any) {
      // Falhou: reabre o modal com os valores e o erro.
      setCAmount(snap.amount); setCMethod(snap.method); setCPhone(snap.phone); setCEmail(snap.email); setCName(snap.name); setCProduto(snap.produto); setCDesc(snap.desc);
      setCMsg(e?.name === 'AbortError' ? 'Erro: tempo excedido. Verifica a lista — o pagamento pode ter sido criado.' : 'Erro: ' + e.message);
      setChargeOpen(true);
    }
  };
  const syncNow = async () => {
    setSyncing(true);
    try {
      const rows = await fetchPayments();
      const changed = await syncPendentes(rows || undefined);
      await fetchPayments();
      if (changed > 0) console.log(`[SYNC] ${changed} pagamento(s) actualizado(s)`);
    } catch {}
    setSyncing(false);
  };

  const payments = useMemo(() =>
    paymentsData.map((p: any) => {
      const meta = p.metadata && typeof p.metadata === 'object' ? p.metadata : {};
      const phone = p.customer_phone || meta.phone || '';
      const name = p.customer_name || '';
      const shortRef = p.customer_id ? `#${String(p.customer_id).slice(0, 8)}` : '';
      return {
      id: p.code ?? p.id ?? '',
      customer: name || phone || shortRef || '—',
      customerPhone: phone && phone !== name ? phone : '',
      amount: p.amount ?? 0,
      method: p.method ?? '',
      methodLabel: PAYMENT_METHOD_LABELS[p.method] || p.method || '—',
      state: p.status === 'confirmado' ? 'Confirmado' : p.status === 'pendente' ? 'Pendente' : p.status === 'em_atraso' ? 'Em atraso' : p.status === 'rejeitado' ? 'Cancelado' : p.status === 'reembolsado' ? 'Reembolsado' : p.status === 'expirado' ? 'Expirado' : p.status ?? '',
      date: p.paid_at ?? p.created_at ?? '',
      dateFmt: fmtPaymentDate(p.paid_at ?? p.created_at),
      referenceCode: p.reference_code ?? '',
      entity: p.entity ?? '',
      ekwanzaCode: p.ekwanza_code ?? '',
      ekwanzaOperationCode: p.ekwanza_operation_code ?? '',
      customerName: p.customer_name ?? '',
      createdAt: p.created_at ?? '',
      paidAt: p.paid_at ?? '',
      expiresAt: p.expires_at ?? '',
      raw: p,
      };
    })
  , [paymentsData]);
  const [filter, setFilter] = useState(() => {
    const f = new URLSearchParams(window.location.search).get('filtro');
    return ['Todas', 'Confirmado', 'Pendente', 'Em atraso', 'Cancelado', 'Expirado', 'Reembolsado'].includes(f ?? '') ? f as string : 'Todas';
  });
  const [search, setSearch] = useState('');
  const [dateFrom, setDateFrom] = useState('');
  const [dateTo, setDateTo] = useState('');
  const [selected, setSelected] = useState<any>(null);
  const visible = payments.filter(p => {
    if (filter !== 'Todas' && p.state !== filter) return false;
    if (search && !p.customer.toLowerCase().includes(search.toLowerCase()) && !p.id.toLowerCase().includes(search.toLowerCase()) && !(p.customerPhone || '').includes(search)) return false;
    if (dateFrom && p.date && p.date < dateFrom) return false;
    if (dateTo && p.date && p.date > dateTo + 'T23:59:59') return false;
    return true;
  });
  return <><PageHeader eyebrow="Receita · Tesouraria" title="Pagamentos" subtitle="Monitorização de transacções." action={<div className="page-actions" style={{ display: 'flex', gap: '.45rem' }}><button className="btn-secondary" onClick={syncNow} disabled={syncing}><RefreshCw size={14} className={syncing ? 'animate-spin' : ''} /> {syncing ? 'A sincronizar…' : 'Sincronizar Pay4All'}</button><button className="btn-primary" onClick={() => { setCMsg(''); setChargeOpen(true); }}><Plus size={14} /> Nova cobrança</button></div>} /><div className="metric-grid" style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: '.8rem', marginBottom: '.8rem' }}><Metric label="Recebido" value={money(payments.filter(p => p.state === 'Confirmado').reduce((s, p) => s + p.amount, 0))} note={`${payments.filter(p => p.state === 'Confirmado').length} transacções`} /><Metric label="Pendente" value={money(payments.filter(p => p.state === 'Pendente').reduce((s, p) => s + p.amount, 0))} note={`${payments.filter(p => p.state === 'Pendente').length} transacções`} /><Metric label="Em atraso" value={money(payments.filter(p => p.state === 'Em atraso').reduce((s, p) => s + p.amount, 0))} note={`${payments.filter(p => p.state === 'Em atraso').length} cliente(s)`} negative /><Metric label="Cancelado" value={money(payments.filter(p => p.state === 'Cancelado').reduce((s, p) => s + p.amount, 0))} note={`${payments.filter(p => p.state === 'Cancelado').length} transacções`} negative /></div>
  <div style={{ display: 'flex', gap: '.5rem', marginBottom: '.8rem', flexWrap: 'wrap' }}>
    <input className="input" placeholder="Pesquisar cliente ou ID..." value={search} onChange={e => setSearch(e.target.value)} style={{ flex: 1, minWidth: '150px' }} />
    <input className="input" type="date" value={dateFrom} onChange={e => setDateFrom(e.target.value)} style={{ width: '140px' }} />
    <input className="input" type="date" value={dateTo} onChange={e => setDateTo(e.target.value)} style={{ width: '140px' }} />
    {(search || dateFrom || dateTo) && <button className="btn-secondary" onClick={() => { setSearch(''); setDateFrom(''); setDateTo(''); }}><RefreshCw size={12} /> Limpar</button>}
  </div>
  <Section title="Movimentos recentes" note={`${visible.length} transacções`} action={<select className="select" value={filter} onChange={e => setFilter(e.target.value)} data-testid="select-payment-status"><option>Todas</option><option>Confirmado</option><option>Pendente</option><option>Em atraso</option><option>Cancelado</option><option>Expirado</option><option>Reembolsado</option></select>}><div className="table-wrap"><table className="data-table"><thead><tr><th>Transacção</th><th>Cliente</th><th>Método</th><th>Estado</th><th>Montante</th><th>Data</th><th /></tr></thead><tbody>{visible.map(p => <tr key={p.id}><td className="mono" style={{ fontSize: '.67rem' }} title={p.id}>{p.id.length > 14 ? p.id.slice(0, 14) + '…' : p.id}</td><td><div style={{ fontWeight: 700 }}>{p.customer}</div>{p.customerPhone && <div style={{ fontSize: '.65rem', color: 'hsl(var(--muted-foreground))' }}>{p.customerPhone}</div>}</td><td>{p.methodLabel}</td><td><Status tone={p.state === 'Confirmado' ? 'good' : p.state === 'Pendente' ? 'pending' : p.state === 'Cancelado' ? 'danger' : p.state === 'Em atraso' ? 'danger' : p.state === 'Expirado' ? 'danger' : 'warn'}>{p.state}</Status></td><td className="mono" style={{ fontSize: '.68rem' }}>{money(p.amount)}</td><td style={{ color: 'hsl(var(--muted-foreground))', whiteSpace: 'nowrap' }}>{p.dateFmt}</td><td>{p.state === 'Confirmado' && <span className="text-good" style={{ fontSize: '.7rem', display: 'inline-flex', gap: '.3rem', alignItems: 'center' }}><CheckCircle2 size={13} /> Conciliado</span>}</td><td><button className="btn-quiet" onClick={() => setSelected(p)} aria-label="Ver detalhes da transação"><Eye size={14} /></button></td></tr>)}</tbody></table></div></Section>{selected && <PaymentDetailModal payment={selected} onClose={() => setSelected(null)} />}
  {chargeOpen && <div className="modal-backdrop" onClick={() => setChargeOpen(false)}><div className="modal" onClick={e => e.stopPropagation()} style={{ maxWidth: '420px', padding: '1.2rem' }}>
    <h3 style={{ marginBottom: '.2rem' }}>Nova cobrança</h3>
    <div className="section-note" style={{ marginBottom: '1rem' }}>Regista pendente de imediato; Express dispara para o telefone.</div>
    <div style={{ display: 'flex', gap: '.5rem' }}>
      <div style={{ flex: 1 }}><label className="label">Montante (Kz) *</label>
      <input className="input" type="number" min="1" value={cAmount} onChange={e => setCAmount(e.target.value)} placeholder="100" /></div>
      <div style={{ flex: 1 }}><label className="label">Método</label>
      <select className="select" value={cMethod} onChange={e => setCMethod(e.target.value)}><option value="mcx_express">M. Express</option><option value="referencia">Referência</option></select></div>
    </div>
    <div style={{ marginTop: '.6rem' }}><label className="label">Telefone {cMethod === 'mcx_express' ? '*' : '(opcional)'}</label>
    <input className="input" value={cPhone} onChange={e => setCPhone(e.target.value)} placeholder="9XXXXXXXX" style={{ width: '100%' }} /></div>
    <div style={{ display: 'flex', gap: '.5rem', marginTop: '.6rem' }}>
      <div style={{ flex: 1 }}><label className="label">Nome (p/ SamoraFit Workout)</label>
      <input className="input" value={cName} onChange={e => setCName(e.target.value)} placeholder="Nome do aluno" style={{ width: '100%' }} /></div>
      <div style={{ flex: 1 }}><label className="label">Email (p/ SamoraFit Workout)</label>
      <input className="input" type="email" value={cEmail} onChange={e => setCEmail(e.target.value)} placeholder="aluno@email.com" style={{ width: '100%' }} /></div>
    </div>
    <div style={{ marginTop: '.6rem' }}><label className="label">Conteúdo (SamoraFit Workout) *</label>
    <select className="select" value={cProduto} onChange={e => pickProduto(e.target.value)} style={{ width: '100%' }}>
      {cEntregas.length === 0 && <option value="">A carregar…</option>}
      {cEntregas.map(o => <option key={o.id} value={o.id}>{o.nome}{o.preco ? ` — ${o.preco} Kz` : ''}</option>)}
    </select></div>
    <div style={{ marginTop: '.6rem' }}><label className="label">Descrição</label>
    <input className="input" value={cDesc} onChange={e => setCDesc(e.target.value)} placeholder="Ex: Mensalidade Setembro" style={{ width: '100%' }} /></div>
    {cMsg && <div style={{ fontSize: '.75rem', marginTop: '.6rem' }}>{cMsg}</div>}
    <div style={{ display: 'flex', gap: '.5rem', marginTop: '1rem' }}>
      <button className="btn-secondary" onClick={() => setChargeOpen(false)} style={{ flex: 1 }}>Fechar</button>
      <button className="btn-primary" onClick={createCharge} disabled={charging} style={{ flex: 1 }}><Check size={14} /> {charging ? 'A gerar…' : 'Gerar'}</button>
    </div>
  </div></div>}</>;
}

const INTEGRATION_DEFAULTS: { name: string; desc: string; icon: typeof BriefcaseBusiness }[] = [
  { name: 'OVG', desc: 'Virtual Gym · Sócios e acessos', icon: BriefcaseBusiness },
  { name: 'Pay4All', desc: 'Pagamentos e reconciliação', icon: CreditCard },
  { name: 'SamoraFit Workout', desc: 'Acessos e área de membros', icon: KeyRound },
  { name: 'WhatsApp', desc: 'SamoraFit · Conversas comerciais', icon: LifeBuoy },
  { name: 'Website', desc: 'Formulários e canais digitais', icon: Link2 },
];
function IntegrationsPage() {
  const { data } = useListIntegrations({ query: { refetchInterval: 300000 } });
  const ovgSync = useOVGSyncStatus();
  const ovgHealth = useOVGHealth();
  const syncNowMut = useOVGSyncNow();
  const cademiHealth = useCademiHealth();
  const cademiSyncMut = useCademiSync();
  const payHealth = usePay4AllHealth();
  const apiIntegrations = data?.data ?? [];
  const ovgSyncData = ovgSync.data?.data;
  const ovgHealthData = ovgHealth.data?.data;
  const cademiHealthData = cademiHealth.data;
  const payHealthData = payHealth.data?.data;
  const [configName, setConfigName] = useState<string | null>(null);
  
  const items = useMemo(() => {
    const applyCademi = (list: any[]) => list.map(item => {
      if (!['cademi', 'samorafit workout'].includes(String(item.name ?? '').toLowerCase())) return item;
      if (!cademiHealthData) return { ...item, name: 'SamoraFit Workout' };
      return {
        ...item,
        name: 'SamoraFit Workout',
        state: cademiHealthData.connected ? 'Operacional' : 'Erro',
        sync: cademiHealthData.connected ? 'Ligado' : 'Falha',
        volume: cademiHealthData.connected ? `${cademiHealthData.products ?? 0} produtos` : (cademiHealthData.message || 'Não configurado'),
        isCademi: true,
        cademi: cademiHealthData,
      };
    });
    if (apiIntegrations.length > 0) {
      const iconMap: Record<string, typeof BriefcaseBusiness> = { OVG: BriefcaseBusiness, Pay4All: CreditCard, 'SamoraFit Workout': KeyRound, WhatsApp: LifeBuoy, Website: Link2 };
      return applyCademi(apiIntegrations.map(ig => {
        const igName = String(ig.name ?? '');
        const key = igName.toLowerCase();
        const isOVG = key === 'ovg';
        const isPay = key === 'pay4all';
        const syncInfo = isOVG && ovgSyncData ? ovgSyncData : null;
        const healthInfo = isOVG && ovgHealthData ? ovgHealthData : null;
        // Pay4All mostra o estado REAL da É-kwanza (ex. 401): problema visível no cartão.
        const payOk = isPay && payHealthData ? payHealthData.connected : null;

        return {
          name: isOVG ? 'OVG' : igName,
          desc: INTEGRATION_DESC[key] ?? (isOVG ? 'Virtual Gym · Sócios e acessos' : igName),
          icon: iconMap[isOVG ? 'OVG' : igName] ?? iconMap[Object.keys(iconMap).find(k => k.toLowerCase() === key) ?? ''] ?? Link2,
          state: healthInfo ? (healthInfo.connected ? 'Operacional' : 'Erro') : (payOk === false ? 'Erro' : (ig.status === 'operacional' ? 'Operacional' : ig.status === 'atencao' ? 'Atenção' : ig.status === 'erro' ? 'Erro' : 'Inativo')),
          sync: syncInfo ? (syncInfo.isSyncing ? 'A sincronizar…' : (syncInfo.lastSync ? `há ${Math.round((Date.now() - new Date(syncInfo.lastSync.timestamp).getTime()) / 60000)} min` : 'Nunca')) : fmtRel(ig.lastSyncAt),
          volume: syncInfo ? (syncInfo.lastSync ? `${syncInfo.lastSync.created} criados, ${syncInfo.lastSync.updated} actualizados` : 'Aguardando primeira sincronização') : (ig.errorCount ? `${ig.errorCount} erros` : ''),
          isOVG,
          syncInfo,
          isPay,
          pay: isPay ? payHealthData : null,
        };
      }));
    }
    return applyCademi(INTEGRATION_DEFAULTS.map(ig => ({
      ...ig,
      icon: ig.icon,
      state: 'Inativo',
      sync: 'Nunca',
      volume: 'Aguardando configuração',
      isOVG: ig.name === 'OVG',
      syncInfo: null,
    })));
  }, [apiIntegrations, ovgSyncData, ovgHealthData, cademiHealthData, payHealthData]);
  
  return <><PageHeader eyebrow="Ecossistema · Conectividade" title="Integrações" subtitle="Estado dos canais que alimentam a operação." action={<button className="btn-secondary" onClick={() => syncNowMut.mutate()} disabled={syncNowMut.isPending || ovgSyncData?.isSyncing}><RefreshCw size={14} className={syncNowMut.isPending || ovgSyncData?.isSyncing ? 'animate-spin' : ''} /> {syncNowMut.isPending || ovgSyncData?.isSyncing ? 'A sincronizar…' : 'Sincronizar tudo'}</button>} /><div className="grid-2">{items.map(({ name, desc, icon: I, state, sync, volume, isOVG, syncInfo, isCademi, cademi, isPay, pay }) => <div className="card" key={name} style={{ padding: '1rem' }}><div style={{ display: 'flex', gap: '.7rem', alignItems: 'flex-start' }}><div style={{ width: 37, height: 37, borderRadius: 9, display: 'grid', placeItems: 'center', background: 'hsl(var(--secondary))', color: 'hsl(var(--primary))' }}><I size={17} /></div><div style={{ flex: 1 }}><div style={{ display: 'flex', justifyContent: 'space-between', gap: '.5rem' }}><div><div style={{ fontWeight: 700, fontSize: '.85rem' }}>{name}</div><div className="section-note">{desc}</div></div><Status tone={state === 'Operacional' ? 'good' : 'warn'}>{state}</Status></div><div style={{ display: 'flex', justifyContent: 'space-between', marginTop: '1rem', fontSize: '.67rem', color: 'hsl(var(--muted-foreground))' }}><span><Clock3 size={12} style={{ verticalAlign: 'middle', marginRight: 4 }} />{syncInfo?.isSyncing ? <span style={{ color: 'hsl(var(--accent))' }}>A sincronizar...</span> : `Sincronizado ${sync}`}</span><span>{volume}</span></div>{isOVG && <div style={{ marginTop: '.5rem', fontSize: '.65rem', color: 'hsl(var(--muted-foreground))' }}>{ovgHealthData ? (ovgHealthData.connected ? `✓ ${ovgHealthData.message}` : `✗ ${ovgHealthData.message}`) : 'A verificar…'}</div>}{isCademi && <div style={{ marginTop: '.5rem', fontSize: '.65rem', color: 'hsl(var(--muted-foreground))' }}>{cademi ? (cademi.connected ? `SamoraFit Workout OK · ${cademi.products ?? 0} produtos` : cademi.message) : 'A verificar…'}</div>}{isPay && <div style={{ marginTop: '.5rem', fontSize: '.65rem', color: 'hsl(var(--muted-foreground))' }}>{pay ? (pay.connected ? `✓ ${pay.message}` : `✗ ${pay.message}`) : 'A verificar…'}</div>}<div style={{ display: 'flex', gap: '.45rem', marginTop: '.75rem' }}>{(isOVG || isCademi) && <button className="btn-secondary" onClick={() => isOVG ? syncNowMut.mutate() : cademiSyncMut.mutate()} disabled={syncNowMut.isPending || syncInfo?.isSyncing || cademiSyncMut.isPending}><RefreshCw size={13} className={syncNowMut.isPending || syncInfo?.isSyncing || cademiSyncMut.isPending ? 'animate-spin' : ''} /> {isOVG ? (syncInfo?.isSyncing ? 'A sincronizar…' : 'Sincronizar') : (cademiSyncMut.isPending ? 'A sincronizar…' : 'Sincronizar')}</button>}<button className="btn-quiet" onClick={() => setConfigName(name)}>Configurar <ChevronRight size={13} /></button></div></div></div></div>)}</div>{configName && <IntegrationConfigModal name={configName} onClose={() => setConfigName(null)} />}<Section title="Actividade de sincronização" note="Eventos mais recentes"><MiniList items={[...(ovgSyncData?.lastSync ? [`OVG · ${ovgSyncData.lastSync.created} criados, ${ovgSyncData.lastSync.updated} actualizados · agora`] : []), 'Pay4All · 86 transacções importadas · há 4 min', 'Website · 12 leads recebidos · há 8 min', 'SamoraFit Workout · 2 acessos pendentes · há 17 min']} /></Section></>;
}

function AcademiaPage() {
  const apiBase = import.meta.env.VITE_API_URL || '';
  const [products, setProducts] = useState<any[]>([]);
  const [students, setStudents] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [selected, setSelected] = useState<any>(null);
  const [detail, setDetail] = useState<any>(null);
  const [loadingDetail, setLoadingDetail] = useState(false);
  const [syncing, setSyncing] = useState(false);
  const [syncMsg, setSyncMsg] = useState('');
  const [cobr, setCobr] = useState<any[]>([]);
  const [cobFilter, setCobFilter] = useState('Todos');
  const [cademiView, setCademiView] = useState<'pagamentos' | 'alunos'>('pagamentos');
  // Entrega Cademi fixa (não editável): produto sempre 'samorafit-workout', envio sempre ligado.
  const FIXO_PRODUTO_ID = 'samorafit-workout';
  const [entregasArr, setEntregasArr] = useState<Array<{ id: string; nome: string; preco?: number }>>([]);
  const [cfgMsg, setCfgMsg] = useState('');
  const [savingCfg, setSavingCfg] = useState(false);

  const fetchCfg = async () => {
    try {
      // Entregas reais (do endpoint): cada uma com o seu campo de preço.
      // (produto de entrega e envio automático são fixos — ver FIXO_PRODUTO_ID.)
      try {
        const e: any = await fetch(`${apiBase}/api/v1/cademi/entregas`, { headers: authHeaders() }).then(r => r.json());
        const list = Array.isArray(e.data) ? e.data : [];
        if (list.length > 0) setEntregasArr(list.map((o: any) => ({ id: o.id, nome: o.nome || o.id, ...(o.preco ? { preco: Number(o.preco) } : {}) })));
      } catch {}
    } catch {}
  };

  const saveCfg = async () => {
    setSavingCfg(true); setCfgMsg('');
    try {
      const res = await fetch(`${apiBase}/api/v1/settings`, {
        method: 'PUT',
        headers: authHeaders(),
        body: JSON.stringify({ settings: { cademi_produto_id: FIXO_PRODUTO_ID, cademi_auto_delivery: '1', cademi_entregas: JSON.stringify(entregasArr) } }),
      });
      if (!res.ok) throw new Error('Falha a guardar');
      setCfgMsg('Configuração guardada. Pagamentos confirmados passam a libertar acesso.');
    } catch (e: any) { setCfgMsg('Erro: ' + e.message); }
    setSavingCfg(false);
  };

  const fetchAll = async () => {
    setLoading(true);
    try {
      const [p, u, c] = await Promise.all([
        fetch(`${apiBase}/api/v1/cademi/products`, { headers: authHeaders() }).then(r => r.json()),
        fetch(`${apiBase}/api/v1/cademi/users`, { headers: authHeaders() }).then(r => r.json()),
        fetch(`${apiBase}/api/v1/cademi/alunos-cobranca`, { headers: authHeaders() }).then(r => r.json()).catch(() => ({ data: [] })),
      ]);
      setProducts(p.data || []);
      setStudents(u.data || []);
      setCobr(c.data || []);
    } catch (e) { console.error(e); }
    setLoading(false);
  };

  useEffect(() => { fetchAll(); fetchCfg(); }, []);

  const openStudent = async (s: any) => {
    setSelected(s);
    setDetail(null);
    setLoadingDetail(true);
    try {
      const a: any = await fetch(`${apiBase}/api/v1/cademi/users/${s.id}/access`, { headers: authHeaders() }).then(r => r.json());
      const acessos = a.data?.acesso || [];
    const withProgress = await Promise.all(acessos.map(async (ac: any) => {
      try {
        const pr: any = await fetch(`${apiBase}/api/v1/cademi/users/${s.id}/progress/${ac.produto.id}`, { headers: authHeaders() }).then(r => r.json());
        // Total de aulas do curso (o progresso só traz completas/assistidas)
        let totalAulas: number | null = null;
        try {
          const ls: any = await fetch(`${apiBase}/api/v1/cademi/products/${ac.produto.id}/lessons`, { headers: authHeaders() }).then(r => r.json());
          if (typeof ls.total === 'number') totalAulas = ls.total;
        } catch {}
        return { ...ac, progresso: pr.data || null, totalAulas };
      } catch { return { ...ac, progresso: null, totalAulas: null }; }
    }));
      setDetail({ ...a.data, acesso: withProgress });
    } catch (e) { console.error(e); }
    setLoadingDetail(false);
  };

  const sync = async () => {
    setSyncing(true);
    setSyncMsg('');
    try {
      const r: any = await fetch(`${apiBase}/api/v1/cademi/sync`, { method: 'POST', headers: authHeaders() }).then(r => r.json());
      setSyncMsg(`${r.matched ?? 0} alunos ligados de ${r.cademiUsers ?? 0} no SamoraFit Workout`);
    } catch (e: any) { setSyncMsg('Erro: ' + e.message); }
    setSyncing(false);
  };

  const visible = students.filter(s => !search || (s.nome || '').toLowerCase().includes(search.toLowerCase()) || (s.email || '').toLowerCase().includes(search.toLowerCase()));
  const fmtD = (d: string | null) => { if (!d) return '—'; try { return new Date(d).toLocaleDateString('pt-AO', { day: '2-digit', month: 'short', year: 'numeric' }); } catch { return d; } };

  return <><PageHeader eyebrow="Ecossistema · Formação" title="SamoraFit Workout" subtitle="Cursos e alunos da plataforma SamoraFit Workout." action={<div className="page-actions" style={{ display: 'flex', gap: '.5rem' }}><button className="btn-secondary" onClick={fetchAll}><RefreshCw size={14} /> Atualizar</button><button className="btn-primary" onClick={sync} disabled={syncing}><RefreshCw size={14} className={syncing ? 'animate-spin' : ''} /> {syncing ? 'A sincronizar…' : 'Sincronizar'}</button></div>} />
  {syncMsg && <div className="card" style={{ padding: '.7rem 1rem', marginBottom: '.8rem', fontSize: '.78rem' }}>{syncMsg}</div>}
  <Section title="Acesso automático" note="Ao confirmar pagamento, liberta o curso no SamoraFit Workout">
    <div className="grid-2">
      <div><label className="label">Entrega padrão *</label>
      <div className="mono" style={{ fontSize: '.8rem', fontWeight: 700, padding: '.55rem .7rem', background: 'hsl(var(--secondary) / .65)', borderRadius: '.45rem' }}>{FIXO_PRODUTO_ID}</div></div>
      <div><label className="label">Envio automático</label>
      <div style={{ padding: '.55rem .7rem' }}><Status tone="good">Ligado</Status></div></div>
    </div>
    <div style={{ marginTop: '.6rem' }}><label className="label">Preços por conteúdo (Kz)</label>
    <div style={{ display: 'grid', gap: '.45rem' }}>
      {entregasArr.length === 0 && <div className="section-note">A carregar entregas…</div>}
      {entregasArr.map(o => <div key={o.id} style={{ display: 'flex', gap: '.5rem', alignItems: 'center' }}>
        <div style={{ flex: 1, fontSize: '.78rem', fontWeight: 600 }}>{o.nome}<div className="mono" style={{ fontSize: '.62rem', color: 'hsl(var(--muted-foreground))', fontWeight: 400 }}>{o.id}</div></div>
        <input className="input" type="number" min="0" value={o.preco ?? ''} onChange={e => setEntregasArr(entregasArr.map(x => x.id === o.id ? { ...x, preco: e.target.value === '' ? undefined : Number(e.target.value) } : x))} placeholder="Preço" style={{ width: '130px' }} />
      </div>)}
    </div></div>
    {cfgMsg && <div style={{ fontSize: '.75rem', marginTop: '.6rem' }}>{cfgMsg}</div>}
    <div style={{ display: 'flex', marginTop: '.8rem' }}><button className="btn-primary" onClick={saveCfg} disabled={savingCfg} style={{ flex: 1 }}><Check size={14} /> {savingCfg ? 'A guardar…' : 'Guardar'}</button></div>
  </Section>
  {loading ? <div className="card" style={{ padding: '2rem', textAlign: 'center' }}>A carregar dados do SamoraFit Workout…</div> : <>
    {/* Secção "Cursos" oculta por decisão de operação (produtos geridos na Cademi). */}
    <div style={{ display: 'flex', gap: '.5rem', marginBottom: '.8rem', marginTop: '.8rem' }}>
      <input className="input" placeholder="Pesquisar aluno por nome ou email..." value={search} onChange={e => setSearch(e.target.value)} style={{ flex: 1, minWidth: 0 }} />
    </div>
    <div style={{ display: 'flex', gap: '.5rem', marginBottom: '.8rem' }}>
      <button className={cademiView === 'pagamentos' ? 'btn-primary' : 'btn-secondary'} onClick={() => setCademiView('pagamentos')} style={{ flex: 1 }}>Ver pagamentos</button>
      <button className={cademiView === 'alunos' ? 'btn-primary' : 'btn-secondary'} onClick={() => setCademiView('alunos')} style={{ flex: 1 }}>Ver alunos</button>
    </div>
    {cademiView === 'pagamentos' && <Section title="Controlo de pagamentos" note={`${cobr.filter(s => cobFilter === 'Todos' || (cobFilter === 'Pendente' ? s.estado === 'pendente' : cobFilter === 'Em dia' ? s.estado === 'em_dia' : s.estado === 'sem_registo')).length} alunos`} action={<select className="select" value={cobFilter} onChange={e => setCobFilter(e.target.value)}><option>Todos</option><option>Pendente</option><option>Em dia</option><option>Sem registo</option></select>}>
      <div className="table-wrap sticky-first"><table className="data-table"><thead><tr><th>Aluno</th><th>Pagos</th><th>Total pago</th><th>Pendentes</th><th>Último</th><th>Estado</th></tr></thead>
      <tbody>{cobr.filter(s => cobFilter === 'Todos' || (cobFilter === 'Pendente' ? s.estado === 'pendente' : cobFilter === 'Em dia' ? s.estado === 'em_dia' : s.estado === 'sem_registo')).map(s => <tr key={s.cademi_id}><td style={{ fontWeight: 700 }}>{s.nome}<div style={{ fontSize: '.65rem', color: 'hsl(var(--muted-foreground))', fontWeight: 400 }}>{s.email}</div></td><td>{s.pagos}</td><td className="mono">{money(s.total_pago)}</td><td>{s.pendentes}</td><td style={{ fontSize: '.68rem' }}>{s.ultimo ? `${s.ultimo.status} · ${money(s.ultimo.valor)}` : '—'}</td><td><Status tone={s.estado === 'em_dia' ? 'good' : s.estado === 'pendente' ? 'pending' : 'warn'}>{s.estado === 'em_dia' ? 'Em dia' : s.estado === 'pendente' ? 'Pendente' : 'Sem registo'}</Status></td><td><button className="btn-quiet" onClick={() => { const f = students.find((x: any) => x.id === s.cademi_id) || { id: s.cademi_id, nome: s.nome, email: s.email }; openStudent(f); }} title="Ver detalhes do aluno" aria-label="Ver detalhes do aluno"><Eye size={14} /></button></td></tr>)}</tbody></table></div>
    </Section>}
    {cademiView === 'alunos' && <Section title="Alunos" note={`${visible.length} de ${students.length}`}>
      <div className="table-wrap sticky-first"><table className="data-table"><thead><tr><th>Aluno</th><th>Email</th><th>Telemóvel</th><th>Último acesso</th><th /></tr></thead>
      <tbody>{visible.map(s => <tr key={s.id}><td style={{ fontWeight: 700 }}>{s.nome}</td><td>{s.email}</td><td>{s.celular || '—'}</td><td>{s.ultimo_acesso_em ? fmtD(s.ultimo_acesso_em) : 'Nunca'}</td><td><button className="btn-quiet" onClick={() => openStudent(s)} title="Ver acessos e progresso" aria-label="Ver acessos e progresso"><ChevronRight size={14} /></button></td></tr>)}</tbody></table></div>
    </Section>}
  </>}
  {selected && <div className="modal-backdrop" onClick={() => setSelected(null)}><div className="modal" onClick={e => e.stopPropagation()} style={{ maxWidth: '520px', padding: '1.2rem' }}>
    <h3 style={{ marginBottom: '.2rem' }}>{selected.nome}</h3>
    <div className="section-note" style={{ marginBottom: '1rem' }}>{selected.email}</div>
    {loadingDetail ? <div style={{ padding: '1.5rem', textAlign: 'center' }}>A carregar acessos…</div> :
    (detail?.acesso?.length > 0 ? detail.acesso.map((ac: any, i: number) => {
      const pct = parseFloat(String(ac.progresso?.total || '0').replace('%', '')) || 0;
      return <div key={i} className="card" style={{ boxShadow: 'none', background: 'hsl(var(--secondary) / .6)', padding: '.8rem', marginBottom: '.6rem' }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}><strong style={{ fontSize: '.82rem' }}>{ac.produto?.nome}</strong><Status tone={ac.encerrado ? 'warn' : 'good'}>{ac.encerrado ? 'Encerrado' : (ac.duracao_tipo === 'vitalicio' ? 'Vitalício' : 'Ativo')}</Status></div>
        <div style={{ fontSize: '.7rem', color: 'hsl(var(--muted-foreground))', marginTop: '.3rem' }}>Início: {fmtD(ac.comecou_em)}{ac.encerra_em ? ` · Fim: ${fmtD(ac.encerra_em)}` : ''}</div>
        {ac.progresso && <div style={{ marginTop: '.5rem' }}><div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '.7rem' }}><span>Progresso</span><strong>{ac.progresso.total}</strong></div><div style={{ height: 6, borderRadius: 3, background: 'hsl(var(--muted))', marginTop: '.25rem' }}><div style={{ width: `${Math.min(pct, 100)}%`, height: '100%', borderRadius: 3, background: 'hsl(var(--accent))' }} /></div><div style={{ fontSize: '.68rem', color: 'hsl(var(--muted-foreground))', marginTop: '.25rem' }}>{ac.progresso.completas ?? 0} de {ac.totalAulas ?? '?'} aulas completas · {ac.progresso.assistidas ?? 0} assistidas</div></div>}
      </div>;
    }) : <div style={{ padding: '1rem', textAlign: 'center', color: 'hsl(var(--muted-foreground))' }}>Sem acessos a cursos</div>)}
    <div style={{ display: 'flex', marginTop: '.5rem' }}><button className="btn-secondary" onClick={() => setSelected(null)} style={{ flex: 1 }}>Fechar</button></div>
  </div></div>}
  </>;
}

const INTEGRATION_CONFIG_FIELDS: Record<string, Array<{ key: string; label: string; type?: string; placeholder?: string }>> = {
  OVG: [
    { key: 'ovg_api_url', label: 'URL da API', placeholder: 'https://...' },
    { key: 'ovg_username', label: 'Utilizador' },
    { key: 'ovg_password', label: 'Password', type: 'password' },
    { key: 'ovg_club_code', label: 'Código do clube', placeholder: 'LUA' },
  ],
  'SamoraFit Workout': [
    { key: 'cademi_api_url', label: 'URL da API', placeholder: 'https://...' },
    { key: 'cademi_api_key', label: 'Chave de API', type: 'password' },
  ],
  Pay4All: [
    { key: 'ekwanza_client_id', label: 'Client ID' },
    { key: 'ekwanza_client_secret', label: 'Client Secret', type: 'password' },
    { key: 'ekwanza_resource', label: 'Resource' },
  ],
};

const INTEGRATION_HEALTH_URL: Record<string, string> = {
  OVG: '/api/v1/ovg/health',
  'SamoraFit Workout': '/api/v1/cademi/health',
  Pay4All: '/api/v1/pay4all/health',
};

function IntegrationConfigModal({ name, onClose }: { name: string; onClose: () => void }) {
  const { data: settingsData } = useGetSettings();
  const saveMut = useSaveSettings();
  const fields = INTEGRATION_CONFIG_FIELDS[name] || [];
  const [form, setForm] = useState<Record<string, string>>({});
  const [loaded, setLoaded] = useState(false);
  const [testing, setTesting] = useState(false);
  const [testMsg, setTestMsg] = useState('');
  const [saveMsg, setSaveMsg] = useState('');

  useEffect(() => {
    if (!loaded && settingsData?.data) {
      const init: Record<string, string> = {};
      fields.forEach(f => {
        const v = (settingsData.data as any)[f.key];
        init[f.key] = typeof v === 'boolean' ? '' : (v || '');
      });
      setForm(init);
      setLoaded(true);
    }
  }, [settingsData, loaded, name]);

  const test = async () => {
    const url = INTEGRATION_HEALTH_URL[name];
    if (!url) return;
    setTesting(true);
    setTestMsg('');
    try {
      const token = localStorage.getItem('token');
      const base = import.meta.env.VITE_API_URL || '';
      const res = await fetch(`${base}${url}`, { headers: token ? { Authorization: `Bearer ${token}` } : {} });
      const json = await res.json();
      const d = json.data || json;
      setTestMsg((d.connected ? 'OK · ' : 'FALHA · ') + (d.message || ''));
    } catch (e: any) { setTestMsg('Erro: ' + e.message); }
    setTesting(false);
  };

  const save = () => {
    setSaveMsg('');
    saveMut.mutate(form, {
      onSuccess: () => setSaveMsg('Configuração guardada'),
      onError: (e: any) => setSaveMsg('Erro: ' + (e.message || 'desconhecido')),
    });
  };

  return <div className="modal-backdrop" onClick={onClose}><div className="modal" onClick={e => e.stopPropagation()} style={{ maxWidth: '440px', padding: '1.2rem' }}>
    <h3 style={{ marginBottom: '.2rem' }}>Configurar {name}</h3>
    <div className="section-note" style={{ marginBottom: '1rem' }}>{fields.length > 0 ? 'Se a chave existir no servidor (Render), ela tem prioridade. O que guardares aqui serve de fallback.' : 'Sem opções configuráveis de momento.'}</div>
    {fields.map(f => <div key={f.key} style={{ marginBottom: '.6rem' }}><label className="label">{f.label}</label>
      <input className="input" type={f.type || 'text'} placeholder={f.type === 'password' ? '•••••• (guardada — vazio mantém)' : (f.placeholder || '')} value={form[f.key] || ''} onChange={e => setForm({ ...form, [f.key]: e.target.value })} style={{ width: '100%' }} /></div>)}
    {testMsg && <div style={{ fontSize: '.75rem', marginBottom: '.6rem', color: testMsg.startsWith('OK') ? 'hsl(155 41% 35%)' : 'hsl(0 70% 50%)' }}>{testMsg}</div>}
    {saveMsg && <div style={{ fontSize: '.75rem', marginBottom: '.6rem' }}>{saveMsg}</div>}
    <div style={{ display: 'flex', gap: '.5rem', marginTop: '.4rem' }}>
      <button className="btn-secondary" onClick={onClose} style={{ flex: 1 }}>Fechar</button>
      {INTEGRATION_HEALTH_URL[name] && <button className="btn-secondary" onClick={test} disabled={testing} style={{ flex: 1 }}>{testing ? 'A testar…' : 'Testar ligação'}</button>}
      {fields.length > 0 && <button className="btn-primary" onClick={save} disabled={saveMut.isPending} style={{ flex: 1 }}><Check size={14} /> Guardar</button>}
    </div>
  </div></div>;
}

function AutomationsPage() {
  const { data, refetch } = useListAutomations({ query: { refetchInterval: 300000 } });
  const toggleMut = useToggleAutomation();
  const deleteMut = useDeleteAutomation();
  const createMut = useCreateAutomation();
  const [open, setOpen] = useState(false);
  const [fName, setFName] = useState('');
  const [fTrigger, setFTrigger] = useState('pagamento.confirmado');
  const [fAction, setFAction] = useState('send_notification');
  const [fMsg, setFMsg] = useState('');
  const rules = data?.data ?? [];
  const save = () => {
    if (!fName.trim()) { setFMsg('Nome é obrigatório'); return; }
    createMut.mutate({ name: fName.trim(), trigger: fTrigger, action: fAction }, {
      onSuccess: () => { setOpen(false); setFName(''); setFMsg(''); refetch(); },
      onError: (e: any) => setFMsg('Erro: ' + (e.message || 'desconhecido')),
    });
  };
  return <><PageHeader eyebrow="Ecossistema · Orquestração" title="Automações" subtitle="Regras orientadas a eventos, com execução auditável." action={<button className="btn-primary" onClick={() => { setFMsg(''); setOpen(true); }}><Plus size={14} /> Nova automação</button>} /><Section title="Regras activas" note={`${rules.filter((x: any) => x.active).length} de ${rules.length} activas`}><div style={{ display: 'grid', gap: '.55rem' }}>{rules.map((r: any, i: number) => <div key={r.id} className="card" style={{ boxShadow: 'none', padding: '.8rem', display: 'grid', gridTemplateColumns: '1.1fr 1fr 1fr auto', gap: '.8rem', alignItems: 'center' }}><div style={{ display: 'flex', gap: '.6rem', alignItems: 'center' }}><div style={{ width: 29, height: 29, borderRadius: 7, display: 'grid', placeItems: 'center', background: r.active ? 'hsl(var(--accent) / .25)' : 'hsl(var(--muted))', color: r.active ? 'hsl(38 60% 35%)' : 'hsl(var(--muted-foreground))' }}><Zap size={14} /></div><div><div style={{ fontWeight: 700, fontSize: '.75rem' }}>{r.name}</div><div className="section-note">Regra {String(i + 1).padStart(2, '0')}</div></div></div><div><div className="eyebrow">Quando</div><div style={{ fontSize: '.71rem', marginTop: '.25rem' }}>{r.trigger}</div></div><div><div className="eyebrow">Executar</div><div style={{ fontSize: '.71rem', marginTop: '.25rem' }}>{r.action}</div></div><div style={{ textAlign: 'right' }}><button className="btn-quiet" onClick={() => toggleMut.mutate(r.id)}>{r.active ? <ToggleRight size={18} color="hsl(155 41% 43%)" /> : <ToggleLeft size={18} />} {r.active ? 'Activo' : 'Inactivo'}</button><button className="btn-quiet" onClick={() => { if (confirm('Eliminar automação?')) deleteMut.mutate(r.id); }}><Trash2 size={14} /></button></div></div>)}</div></Section>
  {open && <div className="modal-backdrop" onClick={() => setOpen(false)}><div className="modal" onClick={e => e.stopPropagation()} style={{ maxWidth: '420px', padding: '1.2rem' }}>
    <h3 style={{ marginBottom: '.2rem' }}>Nova automação</h3>
    <div className="section-note" style={{ marginBottom: '1rem' }}>Regra guardada como ativa. A execução agenda-se no motor.</div>
    <label className="label">Nome *</label>
    <input className="input" value={fName} onChange={e => setFName(e.target.value)} placeholder="Ex: Alertar aulas esgotadas" style={{ width: '100%' }} />
    <div style={{ display: 'flex', gap: '.5rem', marginTop: '.6rem' }}>
      <div style={{ flex: 1 }}><label className="label">Quando</label>
      <select className="select" value={fTrigger} onChange={e => setFTrigger(e.target.value)}>{['pagamento.confirmado', 'pagamento.pendente', 'acesso.negado', 'aulas.esgotadas', 'cliente.bloqueado'].map(v => <option key={v}>{v}</option>)}</select></div>
      <div style={{ flex: 1 }}><label className="label">Executar</label>
      <select className="select" value={fAction} onChange={e => setFAction(e.target.value)}>{['send_notification', 'create_task', 'update_customer_state', 'sync_to_cademi', 'sync_to_ovg'].map(v => <option key={v}>{v}</option>)}</select></div>
    </div>
    {fMsg && <div style={{ fontSize: '.75rem', marginTop: '.6rem', color: 'hsl(0 70% 50%)' }}>{fMsg}</div>}
    <div style={{ display: 'flex', gap: '.5rem', marginTop: '1rem' }}>
      <button className="btn-secondary" onClick={() => setOpen(false)} style={{ flex: 1 }}>Cancelar</button>
      <button className="btn-primary" onClick={save} disabled={createMut.isPending} style={{ flex: 1 }}><Check size={14} /> Guardar</button>
    </div>
  </div></div>}</>;
}
function ApiPage() {
  const [copied, setCopied] = useState(false); const endpoint = (import.meta.env.VITE_API_URL || 'http://localhost:3000') + '/api';
  return <><PageHeader eyebrow="Ecossistema · Desenvolvimento" title="API & Webhooks" subtitle="Visibilidade operacional sobre a camada de integração." action={<button className="btn-secondary" onClick={() => { navigator.clipboard?.writeText(endpoint); setCopied(true); }}><Code2 size={14} /> {copied ? 'Copiado' : 'Copiar endpoint'}</button>} /><div className="content-grid" style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '.8rem', marginBottom: '.8rem' }}><Section title="Endpoint base" note="Autenticação por chave de aplicação"><div className="card" style={{ boxShadow: 'none', background: 'hsl(var(--secondary) / .7)', padding: '.8rem', display: 'flex', justifyContent: 'space-between', gap: '.6rem', alignItems: 'center' }}><code className="mono" style={{ fontSize: '.7rem', overflow: 'hidden', textOverflow: 'ellipsis' }}>{endpoint}</code><IconButton label="copiar endpoint" onClick={() => { navigator.clipboard?.writeText(endpoint); setCopied(true); }}><FileKey2 size={14} /></IconButton></div></Section></div></>;
}

function UsersPage() {
  const { data, refetch } = useListUsersAll({ query: { refetchInterval: 300000 } });
  const toggleMut = useToggleUser();
  const users = data?.data ?? [];
  const roles = ['Administrador', 'Gestor', 'Comercial', 'Financeiro', 'Operacional'];
  const [inviteOpen, setInviteOpen] = useState(false);
  const [iName, setIName] = useState(''); const [iEmail, setIEmail] = useState(''); const [iRole, setIRole] = useState('Operacional');
  const [iMsg, setIMsg] = useState(''); const [inviting, setInviting] = useState(false);
  const invite = async () => {
    if (!iName.trim() || !iEmail.trim()) { setIMsg('Nome e email são obrigatórios'); return; }
    setInviting(true);
    try {
      const token = localStorage.getItem('token');
      const base = import.meta.env.VITE_API_URL || '';
      const res = await fetch(`${base}/api/v1/users/invite`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', ...(token ? { Authorization: `Bearer ${token}` } : {}) },
        body: JSON.stringify({ name: iName.trim(), email: iEmail.trim(), role: iRole }),
      });
      const json = await res.json();
      if (!res.ok) throw new Error(json.error || res.statusText);
      setIMsg(`Convite criado! Password temporária: ${json.data?.tempPassword || '—'}`);
      setIName(''); setIEmail('');
      refetch();
    } catch (e: any) { setIMsg('Erro: ' + e.message); }
    setInviting(false);
  };
  const permissions = ['Ver dashboard', 'Gerir leads', 'Gerir clientes', 'Ver pagamentos', 'Editar planos', 'Executar integrações', 'Gerir utilizadores', 'Ver auditoria'];
  const [active, setActive] = useState('Administrador');
  return <><PageHeader eyebrow="Governação · Acesso" title="Utilizadores" subtitle="Equipa, papéis e permissões granulares." action={<button className="btn-primary" onClick={() => { setIMsg(''); setInviteOpen(true); }}><Plus size={14} /> Convidar utilizador</button>} /><div className="content-grid" style={{ display: 'grid', gridTemplateColumns: '.8fr 1.5fr', gap: '.8rem' }}><Section title="Equipa" note={`${users.length} utilizadores`}><div style={{ display: 'grid', gap: '.45rem' }}>{users.map((u: any) => <button key={u.id} className="btn-quiet" style={{ justifyContent: 'flex-start', padding: '.65rem', background: active === u.role ? 'hsl(var(--secondary))' : undefined }} onClick={() => setActive(u.role)}><div style={{ width: 29, height: 29, borderRadius: '50%', display: 'grid', placeItems: 'center', background: 'hsl(var(--primary))', color: 'white', fontSize: '.62rem', fontWeight: 700 }}>{u.name.split(' ').map((n: string) => n[0]).join('').slice(0, 2).toUpperCase()}</div><div style={{ textAlign: 'left' }}><div style={{ fontWeight: 700, fontSize: '.73rem' }}>{u.name}</div><div style={{ fontSize: '.65rem', color: 'hsl(var(--muted-foreground))' }}>{u.role}</div></div><span style={{ marginLeft: 'auto' }}><Status tone={u.active ? 'good' : 'warn'}>{u.active ? 'Activo' : 'Inactivo'}</Status></span></button>)}</div></Section><Section title={`Matriz de permissões · ${active}`} note="Acesso efectivo deste papel"><div className="table-wrap"><table className="data-table"><thead><tr><th>Permissão</th>{roles.slice(0, 1).map(r => <th key={r}>{r}</th>)}</tr></thead><tbody>{permissions.map((p, i) => <tr key={p}><td>{p}</td><td>{i === 6 || i === 7 || active === 'Administrador' || (active === 'Financeiro' && i === 3) ? <CheckCircle2 size={16} color="hsl(155 41% 43%)" /> : <span style={{ color: 'hsl(var(--muted-foreground))' }}>—</span>}</td></tr>)}</tbody></table></div></Section></div>
  {inviteOpen && <div className="modal-backdrop" onClick={() => setInviteOpen(false)}><div className="modal" onClick={e => e.stopPropagation()} style={{ maxWidth: '420px', padding: '1.2rem' }}>
    <h3 style={{ marginBottom: '.2rem' }}>Convidar utilizador</h3>
    <div className="section-note" style={{ marginBottom: '1rem' }}>Cria o acesso com password temporária.</div>
    <label className="label">Nome *</label>
    <input className="input" value={iName} onChange={e => setIName(e.target.value)} placeholder="Nome completo" style={{ width: '100%' }} />
    <div style={{ display: 'flex', gap: '.5rem', marginTop: '.6rem' }}>
      <div style={{ flex: 1 }}><label className="label">Email *</label>
      <input className="input" value={iEmail} onChange={e => setIEmail(e.target.value)} placeholder="email@..." /></div>
      <div style={{ flex: 1 }}><label className="label">Papel</label>
      <select className="select" value={iRole} onChange={e => setIRole(e.target.value)}>{roles.map(r => <option key={r}>{r}</option>)}</select></div>
    </div>
    {iMsg && <div style={{ fontSize: '.75rem', marginTop: '.6rem' }}>{iMsg}</div>}
    <div style={{ display: 'flex', gap: '.5rem', marginTop: '1rem' }}>
      <button className="btn-secondary" onClick={() => setInviteOpen(false)} style={{ flex: 1 }}>Fechar</button>
      <button className="btn-primary" onClick={invite} disabled={inviting} style={{ flex: 1 }}><Check size={14} /> {inviting ? 'A criar…' : 'Criar acesso'}</button>
    </div>
  </div></div>}</>;
}
function AuditPage() {
  const { data } = useListAuditLogs(undefined, { refetchInterval: 300000 });
  const logs = data?.data ?? [];
  const [tab, setTab] = useState('Eventos');
  const [reprocMsg, setReprocMsg] = useState('');
  const [reprocessing, setReprocessing] = useState<string | null>(null);
  const reprocess = async (log: any) => {
    if (log.entity !== 'payment' || !log.entityId) return;
    setReprocessing(log.id); setReprocMsg('');
    try {
      const token = localStorage.getItem('token');
      const base = import.meta.env.VITE_API_URL || '';
      const res = await fetch(`${base}/api/v1/payments/ekwanza/check-status/${log.entityId}`, {
        headers: token ? { Authorization: `Bearer ${token}` } : {},
      });
      const json = await res.json();
      setReprocMsg(json.changed ? `Atualizado: ${json.status || ''}` : 'Sem alterações');
    } catch (e: any) { setReprocMsg('Erro: ' + e.message); }
    setReprocessing(null);
  };
  const exportCsv = () => {
    const rows = [['quando', 'actor', 'evento', 'referencia', 'estado']].concat(
      logs.map((log: any) => [log.createdAt || '', log.actor || '', log.action || '', log.entityId || log.entity || '', 'Registado'])
    );
    const csv = rows.map(r => r.map((c: any) => `"${String(c).replace(/"/g, '""')}"`).join(',')).join('\r\n');
    const blob = new Blob([csv], { type: 'text/csv;charset=utf-8' });
    const a = document.createElement('a');
    a.href = URL.createObjectURL(blob);
    a.download = `auditoria_${new Date().toISOString().slice(0, 10)}.csv`;
    a.click();
    URL.revokeObjectURL(a.href);
  };
  return <><PageHeader eyebrow="Governação · Controlo" title="Auditoria" subtitle="Registo imutável de actividade, saúde e recuperação." action={<button className="btn-secondary" onClick={exportCsv}><Database size={14} /> Exportar registo</button>} /><div style={{ display: 'flex', gap: '.2rem', borderBottom: '1px solid hsl(var(--border))', marginBottom: '.8rem' }}>{['Eventos', 'Backups', 'Erros e reprocessamento'].map(x => <button key={x} className="btn-quiet" style={{ borderBottom: tab === x ? '2px solid hsl(var(--accent))' : '2px solid transparent', borderRadius: 0, color: tab === x ? 'hsl(var(--foreground))' : undefined }} onClick={() => setTab(x)}>{x}</button>)}</div>{tab === 'Eventos' && <Section title="Actividade registada" note={`${logs.length} eventos`}><div className="table-wrap"><table className="data-table"><thead><tr><th>Actor</th><th>Evento</th><th>Referência</th><th>Quando</th><th>Estado</th></tr></thead><tbody>{logs.map((log: any) => <tr key={log.id}><td style={{ fontWeight: 600 }}>{log.actor}</td><td>{log.action}</td><td className="mono" style={{ fontSize: '.65rem', color: 'hsl(var(--muted-foreground))' }}>{log.entityId || log.entity || '—'}</td><td style={{ color: 'hsl(var(--muted-foreground))' }}>{new Date(log.createdAt).toLocaleString('pt-AO')}</td><td><Status tone="good">Registado</Status></td></tr>)}{logs.length === 0 && <tr><td colSpan={5} style={{ textAlign: 'center', color: 'hsl(var(--muted-foreground))', padding: '2rem' }}>Sem eventos de auditoria registados</td></tr>}</tbody></table></div></Section>}{tab === 'Backups' && <Section title="Backups automáticos" note="Política de retenção: 90 dias"><div style={{ display: 'grid', gap: '.6rem' }}>{logs.length > 0 ? logs.slice(0, 10).map((log) => <div key={log.id} className="card" style={{ boxShadow: 'none', padding: '.75rem', display: 'flex', justifyContent: 'space-between' }}><span style={{ fontSize: '.75rem' }}><Database size={14} style={{ verticalAlign: 'middle', marginRight: 6 }} />{log.action}</span><span className="mono" style={{ fontSize: '.65rem', color: 'hsl(var(--muted-foreground))' }}>{new Date(log.createdAt).toLocaleString('pt-AO')}</span></div>) : <div style={{ textAlign: 'center', padding: '2rem', color: 'hsl(var(--muted-foreground))', fontSize: '.75rem' }}>Sem registos de backup</div>}</div></Section>}{tab === 'Erros e reprocessamento' && <Section title="Erros recentes" note={`Integrações com falha${reprocMsg ? ` · ${reprocMsg}` : ''}`}><div style={{ display: 'grid', gap: '.5rem' }}>{logs.filter((l: any) => l.action?.includes('falha') || l.action?.includes('erro')).map((log: any) => <div key={log.id} className="card" style={{ boxShadow: 'none', padding: '.7rem', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}><div><div style={{ fontWeight: 600, fontSize: '.75rem' }}>{log.action}</div><div style={{ fontSize: '.65rem', color: 'hsl(var(--muted-foreground))' }}>{log.entity} · {new Date(log.createdAt).toLocaleString('pt-AO')}</div></div><button className="btn-secondary" onClick={() => reprocess(log)} disabled={reprocessing === log.id || log.entity !== 'payment'} title={log.entity === 'payment' ? 'Recheck status' : 'Só pagamentos são reprocessáveis'}><RefreshCw size={13} className={reprocessing === log.id ? 'animate-spin' : ''} /> Reprocessar</button></div>)}{logs.filter((l: any) => l.action?.includes('falha') || l.action?.includes('erro')).length === 0 && <div style={{ textAlign: 'center', color: 'hsl(var(--muted-foreground))', padding: '2rem' }}>Sem erros recentes</div>}</div></Section>}</>;
}
function SettingsPage() {
  const { data } = useGetSettings();
  const updateMut = useUpdateSettings();
  const settings = data?.data ?? {};
  const [orgName, setOrgName] = useState(settings.orgName || 'Solve Corporate');
  const [orgEmail, setOrgEmail] = useState(settings.orgEmail || 'operacoes@solvecorporate.ao');
  const [timezone, setTimezone] = useState(settings.timezone || 'Africa/Luanda (WAT)');
  const [alerts, setAlerts] = useState(settings.alerts ?? true);
  const [compact, setCompact] = useState(settings.compact ?? false);
  const [confirmCritical, setConfirmCritical] = useState(settings.confirmCritical ?? true);
  const [saved, setSaved] = useState(false);
  const [policyOpen, setPolicyOpen] = useState(false);
  const handleSave = () => {
    updateMut.mutate({ orgName, orgEmail, timezone, alerts, compact, confirmCritical }, { onSuccess: () => setSaved(true) });
  };
  return <><PageHeader eyebrow="Governação · Workspace" title="Definições" subtitle="Preferências do espaço Solve Corporate." action={saved ? <Status tone="good">Alterações guardadas</Status> : <button className="btn-primary" onClick={handleSave}><Check size={14} /> Guardar alterações</button>} /><div className="content-grid" style={{ display: 'grid', gridTemplateColumns: '1.15fr .85fr', gap: '.8rem' }}><Section title="Perfil da organização" note="Informação apresentada em documentos e notificações"><div className="form-grid"><FormField label="Nome da organização" value={orgName} onChange={(v) => { setOrgName(v); setSaved(false); }} /><FormField label="Email operacional" value={orgEmail} onChange={(v) => { setOrgEmail(v); setSaved(false); }} /><FormField label="Fuso horário" value={timezone} onChange={(v) => { setTimezone(v); setSaved(false); }} /></div></Section><Section title="Preferências" note="Comportamento da aplicação"><div style={{ display: 'grid', gap: '.35rem' }}><Preference label="Alertas operacionais" detail="Notificar falhas de integração e pagamentos" on={alerts} setOn={(v) => { setAlerts(v); setSaved(false); }} /><Preference label="Vista compacta" detail="Mostrar mais linhas nas tabelas" on={compact} setOn={(v) => { setCompact(v); setSaved(false); }} /><Preference label="Confirmação de acções críticas" detail="Pedir confirmação antes de reprocessar" on={confirmCritical} setOn={(v) => { setConfirmCritical(v); setSaved(false); }} /></div></Section></div><Section title="Dados e privacidade" note="Controlos do espaço de trabalho"><div style={{ display: 'flex', alignItems: 'center', gap: '.8rem', padding: '.2rem 0' }}><LockKeyhole size={18} color="hsl(var(--chart-2))" /><div style={{ flex: 1 }}><div style={{ fontSize: '.78rem', fontWeight: 700 }}>Retenção de auditoria</div><div className="section-note">Os registos de auditoria são mantidos durante 90 dias.</div></div><button className="btn-secondary" onClick={() => setPolicyOpen(true)}>Ver política</button></div></Section>
  {policyOpen && <div className="modal-backdrop" onClick={() => setPolicyOpen(false)}><div className="modal" onClick={e => e.stopPropagation()} style={{ maxWidth: '440px', padding: '1.2rem' }}>
    <h3 style={{ marginBottom: '.5rem' }}>Política de retenção</h3>
    <div style={{ fontSize: '.78rem', display: 'grid', gap: '.5rem' }}>
      <p>Os registos de auditoria são mantidos durante <strong>90 dias</strong> e depois eliminados automaticamente.</p>
      <p>Dados de acessos da catraca e sócios são mantidos enquanto a conta estiver ativa.</p>
      <p>Pagamentos e faturas seguem o prazo legal contabilístico.</p>
    </div>
    <div style={{ display: 'flex', marginTop: '1rem' }}><button className="btn-secondary" onClick={() => setPolicyOpen(false)} style={{ flex: 1 }}>Fechar</button></div>
  </div></div>}</>;
}
function Preference({ label, detail, on, setOn }: { label: string; detail: string; on: boolean; setOn: (v: boolean) => void }) { return <button className="btn-quiet" style={{ justifyContent: 'flex-start', textAlign: 'left', padding: '.7rem .2rem' }} onClick={() => setOn(!on)}><div style={{ flex: 1 }}><div style={{ fontSize: '.76rem', fontWeight: 700, color: 'hsl(var(--foreground))' }}>{label}</div><div style={{ fontSize: '.66rem', color: 'hsl(var(--muted-foreground))', marginTop: '.18rem' }}>{detail}</div></div>{on ? <ToggleRight size={22} color="hsl(155 41% 43%)" /> : <ToggleLeft size={22} color="hsl(var(--muted-foreground))" />}</button>; }

function AppShell({ children, userName, auditCount }: { children: ReactNode; userName?: string; auditCount?: number }) {
  const [menu, setMenu] = useState(false); return <div className="shell"><Sidebar open={menu} onClose={() => setMenu(false)} auditCount={auditCount} /><div className="main-area"><Topbar onMenu={() => setMenu(true)} userName={userName} /><main className="page-content" style={{ maxWidth: 1200, margin: '0 auto', padding: '1.65rem 1.7rem 3rem' }}>{children}</main></div></div>;
}

function ProtectedRoute({ children }: { children: ReactNode }) {
  const { isAuthenticated, token } = useAuth();
  const [, setLocation] = useLocation();
  // SEGURANÇA Set/2026: o CRM exige JWT (token). A sessão da loja
  // (samora_user) sozinha não entra — sem token as queries dariam 401 e
  // parecia "entra e sai sozinho".
  const allowed = isAuthenticated && !!token;
  useEffect(() => {
    if (!allowed) {
      setLocation('/');
    }
  }, [allowed, setLocation]);
  if (!allowed) return null;
  return <>{children}</>;
}

function ProtectedPortal({ children }: { children: ReactNode }) {
  const [, setLocation] = useLocation();
  const [ok, setOk] = useState<boolean | null>(null);
  useEffect(() => {
    const t = localStorage.getItem('portal_token');
    if (!t) {
      setOk(false);
      setLocation('/conta/login');
    } else {
      setOk(true);
    }
  }, [setLocation]);
  if (ok === null) return <div style={{ minHeight: '100dvh', display: 'grid', placeItems: 'center', color: 'hsl(var(--muted-foreground))', fontSize: '.8rem' }}>A verificar sessão…</div>;
  if (!ok) return null;
  return <>{children}</>;
}

function AccessPage() {
  const [filter, setFilter] = useState(() => {
    const f = new URLSearchParams(window.location.search).get('resultado');
    return ['todos', 'autorizado', 'negado'].includes(f ?? '') ? f as string : 'todos';
  });
  const [dateFilter, setDateFilter] = useState(() => {
    const d = new URLSearchParams(window.location.search).get('data');
    return ['hoje', 'ontem', 'semana', 'mes', 'todos'].includes(d ?? '') ? d as string : 'hoje';
  });
  const [search, setSearch] = useState(() => new URLSearchParams(window.location.search).get('search') || '');
  const [page, setPage] = useState(1);
  const limit = 100;
  const accessStats = useAccessStats();
  const solveDashboard = useSolveAccessDashboard();
  const solveTerminals = useSolveAccessTerminals();
  const solveHealth = useSolveAccessHealth();
  const unlockMutation = useUnlockTurnstile();
  const qc = useQueryClient();
  const [syncingAccess, setSyncingAccess] = useState(false);
  const syncAccess = () => {
    setSyncingAccess(true);
    Promise.all([
      qc.invalidateQueries({ queryKey: ['access-stats'] }),
      qc.invalidateQueries({ queryKey: ['access-logs'] }),
      qc.invalidateQueries({ queryKey: ['solve-access-dashboard'] }),
      qc.invalidateQueries({ queryKey: ['solve-access-terminals'] }),
      qc.invalidateQueries({ queryKey: ['customers-access'] }),
      qc.invalidateQueries({ queryKey: ['customers-manual'] }),
    ]).finally(() => setTimeout(() => setSyncingAccess(false), 800));
  };
  const access = accessStats.data?.data;
  const solveData = solveDashboard.data?.data;
  const terminals = solveTerminals.data?.data;
  const [realtimeEvents, setRealtimeEvents] = useState<any[]>([]);

  const { connected, history } = useSolveAccessStream((event) => {
    setRealtimeEvents(prev => [event, ...prev].slice(0, 100));
  });

  const today = new Date().toISOString().slice(0, 10);
  const yesterday = new Date(Date.now() - 86400000).toISOString().slice(0, 10);
  const weekAgo = new Date(Date.now() - 7 * 86400000).toISOString().slice(0, 10);
  const monthAgo = new Date(Date.now() - 30 * 86400000).toISOString().slice(0, 10);

  const dateFrom = dateFilter === 'hoje' ? today : dateFilter === 'ontem' ? yesterday : dateFilter === 'semana' ? weekAgo : dateFilter === 'mes' ? monthAgo : undefined;
  const dateTo = dateFilter === 'hoje' ? today : dateFilter === 'ontem' ? yesterday : undefined;

  const accessLogsFiltered = useAccessLogs({ page, limit, date_from: dateFrom, date_to: dateTo, search: search || undefined });
  const logsFiltered = accessLogsFiltered.data?.data ?? [];
  const pagination = accessLogsFiltered.data?.pagination;

  const filteredLogs = logsFiltered.filter(l => filter === 'todos' || l.resultado === filter);
  const entradas = filteredLogs.filter(l => l.tipo_acesso === 'entrada');
  const saidas = filteredLogs.filter(l => l.tipo_acesso === 'saida');
  const isConnected = solveHealth.data?.success;

  const handleUnlock = (tipo: 'entrada' | 'saida') => {
    if (confirm(`Liberar catraca de ${tipo}?`)) {
      unlockMutation.mutate(tipo);
    }
  };

  return <><PageHeader eyebrow="Controlo de Acesso · Solve Access" title="Acesso Físico" subtitle={`Solve Access: ${isConnected ? 'Conectado' : 'Desconectado'} · ${solveHealth.data?.source ?? '—'}`} action={<div className="page-actions" style={{ display: 'flex', gap: '.45rem' }}><Status tone={connected ? 'live' : 'danger'}>{connected ? '● Live' : '○ Offline'}</Status><button className="btn-secondary" onClick={syncAccess} disabled={syncingAccess}><RefreshCw size={14} className={syncingAccess ? 'animate-spin' : ''} /> {syncingAccess ? 'A sincronizar…' : 'Sincronizar'}</button></div>} />
  <div className="metric-grid" style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: '.8rem', marginBottom: '.8rem' }}>
    <Metric label="Clientes activos" value={access?.clients.active?.toString() ?? '—'} note={`${access?.clients.total ?? 0} total`} />
    <Metric label="Terminais online" value={terminals?.online ? '1' : '0'} note={terminals?.online ? (terminals.nome_terminal || 'Terminal') : 'Nenhum online'} />
    <Metric label="Acessos hoje" value={access?.accesses.today?.toString() ?? '—'} note={`${access?.accesses.authorizedToday ?? 0} autorizados`} />
  </div>
  <div style={{ display: 'flex', gap: '.5rem', marginBottom: '.8rem', alignItems: 'center', flexWrap: 'wrap' }}>
    <input type="text" placeholder="Pesquisar cliente..." value={search} onChange={e => { setSearch(e.target.value); setPage(1); }} style={{ flex: '1 1 180px', padding: '.45rem .7rem', borderRadius: '.4rem', border: '1px solid hsl(var(--border))', background: 'hsl(var(--background))', fontSize: '.75rem', color: 'hsl(var(--foreground))' }} />
    <div style={{ display: 'flex', gap: '.3rem' }}>
      {[{ v: 'hoje', l: 'Hoje' }, { v: 'ontem', l: 'Ontem' }, { v: 'semana', l: '7 dias' }, { v: 'mes', l: '30 dias' }, { v: 'todos', l: 'Tudo' }].map(d => <button key={d.v} className={dateFilter === d.v ? 'btn-primary' : 'btn-quiet'} onClick={() => { setDateFilter(d.v); setPage(1); }} style={{ fontSize: '.68rem', padding: '.3rem .6rem' }}>{d.l}</button>)}
    </div>
    <div style={{ display: 'flex', gap: '.3rem' }}>
      {[{ v: 'todos', l: 'Todos' }, { v: 'autorizado', l: 'Autorizado' }, { v: 'negado', l: 'Negado' }].map(f => <button key={f.v} className={filter === f.v ? 'btn-primary' : 'btn-quiet'} onClick={() => { setFilter(f.v); setPage(1); }} style={{ fontSize: '.68rem', padding: '.3rem .6rem' }}>{f.l}</button>)}
    </div>
  </div>
  <div className="content-grid" style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '.8rem' }}>
    <Section title="Entradas" note={`${entradas.length} registos`}>
    <div className="table-wrap"><table className="data-table"><thead><tr><th>Cliente</th><th>Data</th><th>Hora</th><th>Resultado</th><th>Motivo</th></tr></thead><tbody>{entradas.map(l => <tr key={l.id_acesso}><td style={{ fontWeight: 600 }}>{l.cliente_nome || `#${l.cliente_id}`}</td><td>{l.data_acesso}</td><td className="mono" style={{ fontSize: '.72rem' }}>{l.hora_acesso?.slice(0, 8)}</td><td><Status tone={l.resultado === 'autorizado' ? 'good' : 'danger'}>{l.resultado}</Status></td><td style={{ fontSize: '.72rem', color: 'hsl(var(--muted-foreground))' }}>{l.motivo || '—'}</td></tr>)}</tbody></table></div>
    </Section>
    <Section title="Saídas" note={`${saidas.length} registos`}>
    <div className="table-wrap"><table className="data-table"><thead><tr><th>Cliente</th><th>Data</th><th>Hora</th><th>Resultado</th><th>Motivo</th></tr></thead><tbody>{saidas.map(l => <tr key={l.id_acesso}><td style={{ fontWeight: 600 }}>{l.cliente_nome || `#${l.cliente_id}`}</td><td>{l.data_acesso}</td><td className="mono" style={{ fontSize: '.72rem' }}>{l.hora_acesso?.slice(0, 8)}</td><td><Status tone={l.resultado === 'autorizado' ? 'good' : 'danger'}>{l.resultado}</Status></td><td style={{ fontSize: '.72rem', color: 'hsl(var(--muted-foreground))' }}>{l.motivo || '—'}</td></tr>)}</tbody></table></div>
    </Section>
  </div>
  {pagination && pagination.totalPages > 1 && <div style={{ display: 'flex', justifyContent: 'center', alignItems: 'center', gap: '.5rem', marginTop: '.8rem', fontSize: '.75rem' }}>
    <button className="btn-quiet" disabled={page <= 1} onClick={() => setPage(p => p - 1)} style={{ padding: '.35rem .7rem' }}>Anterior</button>
    <span style={{ color: 'hsl(var(--muted-foreground))' }}>Página {pagination.page} de {pagination.totalPages} ({pagination.total} registos)</span>
    <button className="btn-quiet" disabled={page >= pagination.totalPages} onClick={() => setPage(p => p + 1)} style={{ padding: '.35rem .7rem' }}>Próxima</button>
  </div>}
  <div style={{ display: 'grid', gap: '.8rem', marginTop: '.8rem' }}>
    <div style={{ display: 'grid', gap: '.8rem' }}>
      <Section title="Terminal" note={terminals?.nome_terminal || 'A ligar…'}>
        <div style={{ padding: '.7rem', background: 'hsl(var(--secondary) / .65)', borderRadius: '.5rem' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '.5rem', marginBottom: '.5rem' }}>
            <div style={{ width: 8, height: 8, borderRadius: '50%', background: terminals?.online ? 'hsl(155 41% 43%)' : 'hsl(0 84% 60%)' }} />
            <span style={{ fontSize: '.75rem', fontWeight: 600 }}>{terminals?.online ? 'Online' : 'Offline'}</span>
          </div>
          <div style={{ fontSize: '.68rem', color: 'hsl(var(--muted-foreground))' }}>
            <div>IP: {terminals?.ip || '—'}</div>
            <div>Porta: {terminals?.porta || '—'}</div>
            <div>Modelo: {terminals?.modelo || 'Virtual'}</div>
            <div>Tipo: {terminals?.tipo || '—'}</div>
          </div>
          <div style={{ display: 'flex', gap: '.5rem', marginTop: '.7rem' }}>
            <button className="btn-primary" onClick={() => handleUnlock('entrada')} disabled={unlockMutation.isPending} style={{ flex: 1 }}>
              {unlockMutation.isPending ? 'A abrir…' : 'Liberar Entrada'}
            </button>
            <button className="btn-primary" onClick={() => handleUnlock('saida')} disabled={unlockMutation.isPending} style={{ flex: 1 }}>
              {unlockMutation.isPending ? 'A abrir…' : 'Liberar Saída'}
            </button>
          </div>
        </div>
      </Section>
      <Section title="Atividade por hora" note="Horas de pico (últimos 7 dias)">
        <div style={{ display: 'grid', gap: '.4rem' }}>{(access?.peakHours ?? []).map(h => <div key={h.hour} style={{ display: 'flex', alignItems: 'center', gap: '.6rem' }}><span className="mono" style={{ fontSize: '.7rem', width: 35 }}>{String(h.hour).padStart(2, '0')}:00</span><div style={{ flex: 1, height: 8, background: 'hsl(var(--secondary))', borderRadius: 4 }}><div style={{ height: '100%', width: `${Math.min((h.count / Math.max(...(access?.peakHours ?? []).map(x => x.count), 1)) * 100, 100)}%`, background: 'hsl(var(--accent))', borderRadius: 4 }} /></div><span className="mono" style={{ fontSize: '.65rem', color: 'hsl(var(--muted-foreground))' }}>{h.count}</span></div>)}</div>
      </Section>
      <Section title="Clientes online" note="Presença actual no ginásio">
        <div style={{ display: 'grid', gap: '.45rem' }}>{(access?.recentAccesses ?? []).filter(a => a.tipo_acesso === 'entrada' && a.resultado === 'autorizado').slice(0, 8).map(a => <div key={a.id_acesso} style={{ display: 'flex', alignItems: 'center', gap: '.55rem', padding: '.45rem .55rem', background: 'hsl(var(--secondary) / .5)', borderRadius: '.4rem' }}><div style={{ width: 6, height: 6, borderRadius: '50%', background: 'hsl(155 41% 43%)' }} /><span style={{ fontSize: '.74rem', fontWeight: 500 }}>{a.cliente_nome}</span><span className="mono" style={{ fontSize: '.62rem', color: 'hsl(var(--muted-foreground))', marginLeft: 'auto' }}>{a.hora_acesso?.slice(0, 5)}</span></div>)}</div>
      </Section>
    </div>
  </div></>;
}
function CRM() {
  const { user } = useAuth();
  const userName = user?.name || 'Utilizador';
  const leadsQuery = useListLeads(undefined, { query: { refetchInterval: 300000 } });
  const customersQuery = useListCustomersManual();
  const auditQuery = useListAuditLogs(undefined, { refetchInterval: 300000 });
  const auditCount = auditQuery.data?.total ?? auditQuery.data?.data?.length ?? 0;

  const qc = useQueryClient();
  const leads = useMemo(() => {
    return (leadsQuery.data?.data ?? []).map(mapApiLead);
  }, [leadsQuery.data]);
  // Invalida a query partilhada + refetch: qualquer janela (Leads, Funil, Dashboard) reaprende o estado.
  const reloadLeads = () => { qc.invalidateQueries({ queryKey: ['/api/v1/leads'] }); leadsQuery.refetch(); };
  const customers = useMemo(() => {
    return (customersQuery.data?.data ?? []).map(mapApiCustomer);
  }, [customersQuery.data]);

  return <AppShell userName={userName} auditCount={auditCount}><Switch><Route path="/admin" component={() => <Dashboard leads={leads} customers={customers} userName={userName} />} /><Route path="/admin/leads" component={() => <LeadsPage leads={leads} userName={userName} onChanged={reloadLeads} />} /><Route path="/admin/pipeline" component={() => <PipelinePage leads={leads} userName={userName} onChanged={reloadLeads} />} /><Route path="/admin/clientes/:id" component={() => <CustomerDetail customers={customers} onChanged={() => customersQuery.refetch()} />} /><Route path="/admin/clientes" component={() => <CustomersPage customers={customers} loading={customersQuery.isLoading} onChanged={() => { reloadLeads(); customersQuery.refetch(); }} />} /><Route path="/admin/planos" component={PlansPage} /><Route path="/admin/pagamentos" component={PaymentsPage} /><Route path="/admin/integracoes" component={IntegrationsPage} /><Route path="/admin/academia" component={AcademiaPage} /><Route path="/admin/automacoes" component={AutomationsPage} /><Route path="/admin/api-webhooks" component={ApiPage} /><Route path="/admin/utilizadores" component={UsersPage} /><Route path="/admin/auditoria" component={AuditPage} /><Route path="/admin/definicoes" component={SettingsPage} /><Route path="/admin/acesso-fisico" component={AccessPage} /><Route component={() => <EmptyState title="Página não encontrada" text="O endereço solicitado não existe neste espaço." action={<Link href="/admin" className="btn-primary">Voltar ao dashboard</Link>} />} /></Switch></AppShell>;
}
function LandingLoginPage() {
  return (
    <LandingLayout>
      <LandingLogin />
    </LandingLayout>
  );
}

function LandingSubPage({ children }: { children: ReactNode }) {
  return (
    <LandingLayout>
      {children}
    </LandingLayout>
  );
}

function App() {
  return (
    <QueryClientProvider client={queryClient}>
      <TooltipProvider>
        <WouterRouter base={import.meta.env.BASE_URL.replace(/\/$/, '')}>
          <ErrorBoundary>
            <Switch>
              {/* Login (raiz) → CRM */}
              <Route path="/login" component={LandingLoginPage} />
              <Route path="/" component={LandingLoginPage} />
              <Route path="/fit-studio" component={() => <LandingSubPage><FitStudio /></LandingSubPage>} />
              {/* Portal do Cliente (OTP, sessão portal_token) */}
              <Route path="/conta/login" component={ContaLogin} />
              <Route path="/conta/pagamentos" component={() => <ProtectedPortal><PortalShell><PortalPagamentos /></PortalShell></ProtectedPortal>} />
              <Route path="/conta/recibos/:id" component={() => <ProtectedPortal><PortalShell><PortalRecibo /></PortalShell></ProtectedPortal>} />
              <Route path="/conta" component={() => <ProtectedPortal><PortalShell><MinhaConta /></PortalShell></ProtectedPortal>} />
              {/* CRM (protected) */}
              <Route component={() => <ProtectedRoute><CRM /></ProtectedRoute>} />
            </Switch>
          </ErrorBoundary>
        </WouterRouter>
        <Toaster />
      </TooltipProvider>
    </QueryClientProvider>
  );
}
export default App;




