import { useEffect, useMemo, useState, type ReactNode } from 'react';
import { QueryClient, QueryClientProvider, useQueryClient } from '@tanstack/react-query';
import { ErrorBoundary } from '@/components/error-boundary';
import { Toaster } from '@/components/ui/toaster';
import { TooltipProvider } from '@/components/ui/tooltip';
import {
  Activity, AlertTriangle, ArrowDownRight, ArrowUpRight, Bell, BookOpen, Boxes,
  BriefcaseBusiness, Building2, Check, CheckCircle2, ChevronDown, ChevronRight,
  CircleDollarSign, Clock3, Code2, Command, CreditCard, Database, Edit3, Eye,
  FileClock, FileKey2, Filter, HeartPulse, History, KeyRound, LayoutDashboard,
  LifeBuoy, Link2, ListFilter, LockKeyhole, LogOut, Menu, MoreHorizontal, Package,
  Pause, Play, Plus, RefreshCw, Search, Settings, ShieldCheck, SlidersHorizontal,
  Sparkles, Target, ToggleLeft, ToggleRight, Trash2, TrendingUp, Upload, UserRound,
  Users, WalletCards, Webhook, X, Zap
} from 'lucide-react';
import { Link, Route, Switch, useLocation, useParams, Router as WouterRouter } from 'wouter';
import { useAuth } from '@/hooks/use-auth';
import '@/lib/api';

// Landing page
import LandingLayout from '@/landing/LandingLayout';
import Landing from '@/landing/Landing';
import LandingLogin from '@/landing/Login';
import FitMotivacao from '@/landing/FitMotivacao';
import Formacao from '@/landing/Formacao';
import Store from '@/landing/Store';
import ProductDetail from '@/landing/ProductDetail';
import FitWorkout from '@/landing/FitWorkout';
import FitStudio from '@/landing/FitStudio';
import { useListAutomations, useCreateAutomation, useToggleAutomation, useDeleteAutomation, useListAuditLogs, useGetSettings, useUpdateSettings, useListUsersAll, useToggleUser, useAccessStats, useAccessLogs, useSolveAccessDashboard, useSolveAccessTerminals, useSolveAccessHealth, useUnlockTurnstile, useSolveAccessStream, useOVGSyncStatus, useOVGSyncNow, useOVGHealth, useCademiHealth, useCademiSync, useSaveSettings, useListCustomersManual, useImportCustomerDates, usePaymentStream } from '@/hooks/use-api';
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

const queryClient = new QueryClient();

type Lead = { id: string; name: string; company: string; source: string; status: string; owner: string; value: number; last: string; email: string };
type Customer = { id: string; name: string; company: string; plan: string; state: string; joined: string; expires: string; email: string; phone: string; gender: string; entryDate?: string | null; lessonsLeft?: number | null; lessonsLimit?: number | null; _accessStats?: { total: number; autorizados: number; negados: number; ultimoAcesso: string } | null };

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
  };
}

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
    entryDate: c.entryDate ?? null,
    lessonsLeft: c.numero_entradas ?? c.lessonsLeft ?? null,
    lessonsLimit: c.limite_entradas ?? c.lessonsLimit ?? null,
    _accessStats: c._accessStats ?? null,
  };
}

const navGroups = [
  { label: 'Visão geral', items: [{ href: '/admin', label: 'Dashboard', icon: LayoutDashboard }] },
  { label: 'Operação comercial', items: [{ href: '/admin/clientes', label: 'Clientes', icon: Building2 }] },
  { label: 'Receita e acesso', items: [{ href: '/admin/planos', label: 'Planos', icon: Package }, { href: '/admin/pagamentos', label: 'Pagamentos', icon: WalletCards }] },
  { label: 'Controlo de Acesso', items: [{ href: '/admin/acesso-fisico', label: 'Solve Access', icon: LockKeyhole }] },
  { label: 'Ecossistema', items: [{ href: '/admin/academia', label: 'Academia', icon: BookOpen }, { href: '/admin/integracoes', label: 'Integrações', icon: Link2 }, { href: '/admin/automacoes', label: 'Automações', icon: Zap }, { href: '/admin/api-webhooks', label: 'API & Webhooks', icon: Code2 }] },
  { label: 'Governação', items: [{ href: '/admin/utilizadores', label: 'Utilizadores', icon: UserRound }, { href: '/admin/auditoria', label: 'Auditoria', icon: ShieldCheck }, { href: '/admin/definicoes', label: 'Definições', icon: Settings }] },
];

const money = (n: number) => new Intl.NumberFormat('pt-AO', { style: 'currency', currency: 'AOA', maximumFractionDigits: 0 }).format(n);

function Status({ children, tone = 'neutral' }: { children: ReactNode; tone?: 'good' | 'warn' | 'danger' | 'neutral' | 'live' }) {
  return <span className={`status status-${tone}`}>{children}</span>;
}
function IconButton({ label, children, onClick }: { label: string; children: ReactNode; onClick?: () => void }) {
  return <button type="button" aria-label={label} data-testid={`button-${label.toLowerCase().replaceAll(' ', '-')}`} className="btn-quiet" onClick={onClick}>{children}</button>;
}
function PageHeader({ eyebrow, title, subtitle, action }: { eyebrow: string; title: string; subtitle?: string; action?: ReactNode }) {
  return <div className="section-header" style={{ marginBottom: '1.35rem' }}><div><div className="eyebrow">{eyebrow}</div><h1 className="page-title">{title}</h1>{subtitle && <p className="page-subtitle">{subtitle}</p>}</div>{action}</div>;
}
function Metric({ label, value, note, trend, negative = false, onClick }: { label: string; value: string; note: string; trend?: string; negative?: boolean; onClick?: () => void }) {
  return <div className="card metric" onClick={onClick} style={onClick ? { cursor: 'pointer' } : undefined}><div className="eyebrow">{label}</div><div className="metric-value">{value}</div><div className="metric-note" style={{ color: trend ? (negative ? 'hsl(3 67% 45%)' : 'hsl(155 41% 35%)') : undefined }}>{trend && (negative ? <ArrowDownRight size={12} style={{ verticalAlign: 'middle' }} /> : <ArrowUpRight size={12} style={{ verticalAlign: 'middle' }} />)} {trend}{trend && ' · '}{note}</div></div>;
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
    <div style={{ display: 'flex', alignItems: 'center', gap: '.65rem', padding: '.15rem .55rem 1.4rem' }}><div style={{ width: 31, height: 31, borderRadius: 8, display: 'grid', placeItems: 'center', background: 'hsl(var(--sidebar-primary))', color: 'hsl(var(--sidebar-primary-foreground))', fontWeight: 800, letterSpacing: '-.08em' }}>SC</div><div><div style={{ fontWeight: 700, color: 'white', fontSize: '.86rem' }}>Solve Corporate</div><div style={{ fontSize: '.6rem', color: 'hsl(var(--sidebar-foreground))', letterSpacing: '.08em', textTransform: 'uppercase' }}>Command center</div></div></div>
    <div style={{ display: 'grid', gap: '1.15rem', flex: 1 }}>{navGroups.map(group => <div key={group.label}><div className="eyebrow" style={{ color: 'hsl(var(--sidebar-foreground) / .62)', padding: '0 .7rem .42rem', fontSize: '.57rem' }}>{group.label}</div><nav style={{ display: 'grid', gap: '.15rem' }}>{group.items.map(item => { const active = item.href === '/admin' ? location === '/admin' : location.startsWith(item.href); const I = item.icon; return <Link key={item.href} href={item.href} className={`sidebar-link ${active ? 'active' : ''}`} data-testid={`link-nav-${item.label.toLowerCase()}`} onClick={onClose}><I size={15} strokeWidth={active ? 2.4 : 1.8} /><span>{item.label}</span>{item.label === 'Auditoria' && auditCount ? <span style={{ marginLeft: 'auto', fontSize: '.6rem', padding: '.12rem .35rem', borderRadius: 5, background: 'hsl(var(--sidebar-primary) / .2)', color: 'hsl(var(--sidebar-primary))' }}>{auditCount}</span> : null}</Link>; })}</nav></div>)}</div>
    <button onClick={async () => { await logout(); onClose(); window.location.href = '/login'; }} className="sidebar-link" style={{ marginTop: 'auto', padding: '.55rem .7rem', borderRadius: '.4rem', display: 'flex', alignItems: 'center', gap: '.5rem', fontSize: '.75rem', color: 'hsl(3 67% 55%)', cursor: 'pointer', background: 'transparent', border: 'none', width: '100%', textAlign: 'left' }}><LogOut size={15} /><span>Sair da sessão</span></button>
  </aside><div className="mobile-overlay" style={{ display: 'none' }} onClick={onClose} /></>;
}
function Topbar({ onMenu, userName }: { onMenu: () => void; userName?: string }) {
  const today = new Date().toLocaleDateString('pt-AO', { weekday: 'long', day: 'numeric', month: 'short', year: 'numeric' });
  const displayName = userName || 'Utilizador';
  const initials = displayName.split(' ').map((n: string) => n[0]).join('').slice(0, 2).toUpperCase();
  const [, setLocation] = useLocation();
  const [bellOpen, setBellOpen] = useState(false);
  const [alerts, setAlerts] = useState<Array<{ label: string; value: string; href: string; tone: string }>>([]);
  const openBell = async () => {
    const next = !bellOpen;
    setBellOpen(next);
    if (!next) return;
    try {
      const token = localStorage.getItem('token');
      const base = import.meta.env.VITE_API_URL || '';
      const headers: HeadersInit = token ? { Authorization: `Bearer ${token}` } : {};
      const [a, d] = await Promise.all([
        fetch(`${base}/api/v1/access/stats`, { headers }).then(r => r.json()).catch(() => null),
        fetch(`${base}/api/v1/dashboard/stats`, { headers }).then(r => r.json()).catch(() => null),
      ]);
      const items: Array<{ label: string; value: string; href: string; tone: string }> = [];
      const denied = a?.data?.accesses?.deniedToday;
      if (denied) items.push({ label: 'Acessos negados hoje', value: String(denied), href: '/admin/acesso-fisico?resultado=negado&data=hoje', tone: 'danger' });
      const online = a?.data?.clients?.online;
      if (online) items.push({ label: 'Pessoas no ginásio', value: String(online), href: '/admin/acesso-fisico', tone: 'good' });
      const pending = d?.data?.overview?.pendingPayments;
      if (pending) items.push({ label: 'Cobranças pendentes', value: String(pending), href: '/admin/pagamentos?filtro=Pendente', tone: 'warn' });
      setAlerts(items);
    } catch {}
  };
  return <header className="topbar" style={{ height: 65, borderBottom: '1px solid hsl(var(--border))', background: 'hsl(var(--card) / .84)', backdropFilter: 'blur(10px)', display: 'flex', alignItems: 'center', gap: '1rem', padding: '0 1.7rem', position: 'sticky', top: 0, zIndex: 20 }}><button className="mobile-only btn-quiet" onClick={onMenu} data-testid="button-open-menu"><Menu size={19} /></button><div style={{ marginLeft: 'auto', display: 'flex', alignItems: 'center', gap: '.35rem' }}><span className="desktop-only" style={{ color: 'hsl(var(--muted-foreground))', fontSize: '.7rem', marginRight: '.45rem' }}>{today}</span><div style={{ position: 'relative' }}><IconButton label="central de notificações" onClick={openBell}><Bell size={16} /></IconButton>{bellOpen && <div className="card" style={{ position: 'absolute', right: 0, top: '110%', zIndex: 50, minWidth: 250, padding: '.5rem' }}>
  {alerts.length === 0 && <div style={{ padding: '.7rem', fontSize: '.72rem', color: 'hsl(var(--muted-foreground))' }}>Sem alertas de momento</div>}
  {alerts.map(al => <button key={al.label} className="btn-quiet" style={{ width: '100%', justifyContent: 'flex-start', padding: '.55rem .6rem' }} onClick={() => { setBellOpen(false); setLocation(al.href); }}><Status tone={al.tone as any}>{al.value}</Status><span style={{ fontSize: '.72rem', marginLeft: '.5rem' }}>{al.label}</span></button>)}
</div>}</div><div className="desktop-only" style={{ height: 22, width: 1, background: 'hsl(var(--border))', margin: '0 .25rem' }} /><div className="desktop-only" style={{ display: 'flex', alignItems: 'center', gap: '.45rem', fontSize: '.75rem', fontWeight: 600 }}><div style={{ width: 25, height: 25, display: 'grid', placeItems: 'center', borderRadius: '50%', background: 'hsl(var(--primary))', color: 'white', fontSize: '.62rem' }}>{initials}</div>{displayName}</div></div></header>;
}

function Dashboard({ leads, customers, userName }: { leads: Lead[]; customers: Customer[]; userName?: string }) {
  const [, setLocation] = useLocation();
  const statsQuery = useGetDashboardStats({ query: { refetchInterval: 30000 } });
  const chartsQuery = useGetDashboardCharts({ query: { refetchInterval: 60000 } });
  const accessStats = useAccessStats();
  const overview = statsQuery.data?.data?.overview;
  const integrations = statsQuery.data?.data?.integrations ?? [];
  const revenueData = chartsQuery.data?.data?.revenueByMonth ?? [];
  const access = accessStats.data?.data;
  const firstName = (userName || 'Utilizador').split(' ')[0];
  const hour = new Date().getHours();
  const greeting = hour < 12 ? 'Bom dia' : hour < 18 ? 'Boa tarde' : 'Boa noite';
  const metricTitle = greeting + ', ' + firstName + '.';
  const leadsNote = (overview?.totalLeads ?? 0) + ' oportunidades';
  const pendingNote = (overview?.latePayments ?? 0) + ' transações em atenção';
  const activeNote = (overview?.totalCustomers ?? 0) + ' total';
  const exhaustedLessons = customers.filter(c => c.lessonsLimit !== undefined && c.lessonsLimit !== null && c.lessonsLimit !== -1 && (c.lessonsLeft ?? 1) === 0).length;
  const blockedCount = customers.filter(c => c.state === 'Bloqueado').length;
  const deniedToday = (access as any)?.accesses?.deniedToday ?? 0;
  const onlineNow = (access as any)?.clients?.online ?? 0;
  const [cmdOpen, setCmdOpen] = useState(false);
  const [cmdQ, setCmdQ] = useState('');
  const [chartRange, setChartRange] = useState<'mes' | 'tudo'>('mes');
  const revenueShown = chartRange === 'mes' ? revenueData.slice(-4) : revenueData;
  const commands = [
    { label: 'Dashboard', href: '/admin' }, { label: 'Leads', href: '/admin/leads' },
    { label: 'Pipeline', href: '/admin/pipeline' }, { label: 'Clientes', href: '/admin/clientes' },
    { label: 'Planos', href: '/admin/planos' }, { label: 'Pagamentos', href: '/admin/pagamentos' },
    { label: 'Solve Access', href: '/admin/acesso-fisico' }, { label: 'Academia', href: '/admin/academia' },
    { label: 'Integrações', href: '/admin/integracoes' }, { label: 'Automações', href: '/admin/automacoes' },
    { label: 'API & Webhooks', href: '/admin/api-webhooks' }, { label: 'Utilizadores', href: '/admin/utilizadores' },
    { label: 'Auditoria', href: '/admin/auditoria' }, { label: 'Definições', href: '/admin/definicoes' },
  ].filter(c => c.label.toLowerCase().includes(cmdQ.toLowerCase()));
  return <><PageHeader eyebrow="Operação · Hoje" title={metricTitle} subtitle="A operação está estável. Eis o que merece a sua atenção." action={<button className="btn-primary" data-testid="button-dashboard-action" onClick={() => { setCmdQ(''); setCmdOpen(true); }}><Command size={14} /> Abrir comando <span className="mono" style={{ fontSize: '.65rem', opacity: .65 }}>⌘ K</span></button>} /><div className="metric-grid" style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: '.8rem', marginBottom: '.8rem' }}><Metric label="Receita recorrente" value={overview?.revenueLast30Days ? money(overview.revenueLast30Days) : '0 Kz'} note="últimos 30 dias" onClick={() => setLocation('/admin/pagamentos?filtro=Confirmado')} /><Metric label="Cobranças pendentes" value={overview?.pendingPayments ? (overview.pendingPayments + ' transações') : '0 transações'} note={pendingNote} negative onClick={() => setLocation('/admin/pagamentos?filtro=Pendente')} /><Metric label="Clientes activos" value={overview?.activeCustomers?.toString() ?? '0'} note={activeNote} onClick={() => setLocation('/admin/clientes')} /></div><div className="metric-grid" style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: '.8rem', marginBottom: '.8rem' }}><Metric label="Aulas esgotadas" value={exhaustedLessons.toString()} note="saldo 0 (renovar)" negative={exhaustedLessons > 0} onClick={() => setLocation('/admin/clientes?filtro=Esgotadas')} /><Metric label="Bloqueados" value={blockedCount.toString()} note="contas bloqueadas" negative={blockedCount > 0} onClick={() => setLocation('/admin/clientes?filtro=Bloqueado')} /><Metric label="Negados hoje" value={deniedToday.toString()} note="na catraca" negative={deniedToday > 0} onClick={() => setLocation('/admin/acesso-fisico?resultado=negado&data=hoje')} /><Metric label="No ginásio" value={onlineNow.toString()} note="agora" onClick={() => setLocation('/admin/acesso-fisico')} /></div>
  {cmdOpen && <div className="modal-backdrop" onClick={() => setCmdOpen(false)}><div className="modal" onClick={e => e.stopPropagation()} style={{ maxWidth: '420px', padding: '1.2rem' }}>
    <input className="input" autoFocus placeholder="Ir para..." value={cmdQ} onChange={e => setCmdQ(e.target.value)} onKeyDown={e => { if (e.key === 'Enter' && commands.length > 0) { setCmdOpen(false); setLocation(commands[0].href); } }} style={{ width: '100%' }} />
    <div style={{ display: 'grid', gap: '.25rem', marginTop: '.7rem', maxHeight: 300, overflowY: 'auto' }}>
      {commands.map(c => <button key={c.href} className="btn-quiet" style={{ justifyContent: 'flex-start', padding: '.6rem' }} onClick={() => { setCmdOpen(false); setLocation(c.href); }}><Command size={13} style={{ marginRight: '.5rem' }} />{c.label}</button>)}
      {commands.length === 0 && <div style={{ padding: '.7rem', fontSize: '.75rem', color: 'hsl(var(--muted-foreground))' }}>Sem resultados</div>}
    </div>
  </div></div>}
  <div className="content-grid" style={{ display: 'grid', gridTemplateColumns: '1.35fr .85fr', gap: '.8rem', marginBottom: '.8rem' }}><Section title="Ritmo comercial" note="Valor criado por semana" action={<button className="btn-quiet" onClick={() => setChartRange(chartRange === 'mes' ? 'tudo' : 'mes')}>{chartRange === 'mes' ? 'Este mês' : 'Período total'} <ChevronDown size={13} /></button>}><div style={{ height: 165, display: 'flex', alignItems: 'end', gap: 'clamp(.4rem, 2.4vw, 1rem)', padding: '1rem .2rem .2rem', borderBottom: '1px solid hsl(var(--border))' }}>{(revenueShown.length > 0 ? revenueShown : []).map((d, i, arr) => { const max = Math.max(...arr.map(x => x.value ?? 0), 1); const pct = ((d.value ?? 0) / max) * 100; return <div key={i} style={{ flex: 1, height: `${Math.max(pct, 5)}%`, position: 'relative', minWidth: 7, background: i === arr.length - 1 ? 'hsl(var(--accent))' : 'hsl(var(--chart-2) / .72)', borderRadius: '3px 3px 0 0' }} title={`${d.value ?? 0} Kz`} />; })}</div><div style={{ display: 'flex', justifyContent: 'space-between', color: 'hsl(var(--muted-foreground))', fontSize: '.65rem', paddingTop: '.45rem' }}><span>01 Jun</span><span>08 Jun</span><span>15 Jun</span><span>Hoje</span></div></Section><Section title="Saúde do ecossistema" note="Última verificação há 4 min"><div style={{ display: 'grid', gap: '.72rem' }}>{integrations.length > 0 ? integrations.map((ig, i) => <div key={i} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', fontSize: '.72rem' }}><div style={{ display: 'flex', alignItems: 'center', gap: '.5rem' }}><div style={{ width: 7, height: 7, borderRadius: '50%', background: ig.status === 'operacional' ? 'hsl(155 41% 43%)' : 'hsl(38 80% 50%)' }} />{ig.name}</div><Status tone={ig.status === 'operacional' ? 'good' : 'warn'}>{ig.status === 'operacional' ? 'Operacional' : ig.status}</Status></div>) : [['OVG', 'Operacional', 'good'], ['Pay4All', 'Operacional', 'good'], ['Cademi', 'Atenção', 'warn'], ['WhatsApp', 'Operacional', 'good'], ['Website', 'Operacional', 'good']].map(([name, state, tone]) => <div key={name} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', fontSize: '.72rem' }}><div style={{ display: 'flex', alignItems: 'center', gap: '.5rem' }}><div style={{ width: 7, height: 7, borderRadius: '50%', background: tone === 'good' ? 'hsl(155 41% 43%)' : 'hsl(38 80% 50%)' }} />{name}</div><Status tone={tone as 'good' | 'warn'}>{state}</Status></div>)}</div></Section></div><div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '.8rem' }}><Section title="Leads recentes" note="Últimas captações"><div style={{ display: 'grid', gap: '.5rem' }}>{(leads.length > 0 ? leads.slice(0, 5) : []).map(l => <div key={l.id} style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '.5rem 0', borderBottom: '1px solid hsl(var(--border))', fontSize: '.73rem' }}><div><div style={{ fontWeight: 600 }}>{l.name}</div><div style={{ color: 'hsl(var(--muted-foreground))' }}>{l.company}</div></div><Status tone={l.status === 'Convertido' ? 'good' : l.status === 'Perdido' ? 'danger' : 'neutral'}>{l.status}</Status></div>)}</div></Section><Section title="Clientes activos" note="Estado das contas"><div style={{ display: 'grid', gap: '.5rem' }}>{(customers.length > 0 ? customers.slice(0, 5) : []).map(c => <div key={c.id} style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '.5rem 0', borderBottom: '1px solid hsl(var(--border))', fontSize: '.73rem' }}><div><div style={{ fontWeight: 600 }}>{c.name}</div><div style={{ color: 'hsl(var(--muted-foreground))' }}>{c.company}</div></div><Status tone={c.state === 'Activo' ? 'good' : 'warn'}>{c.state}</Status></div>)}</div></Section></div><div className="content-grid" style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '.8rem', marginBottom: '.8rem' }}>
<Section title="Solve Access" note="Controlo de acesso físico em tempo real" action={<span className="mono" style={{ fontSize: '.65rem', color: access?.clients.online ? 'hsl(155 41% 43%)' : 'hsl(var(--muted-foreground))' }}>{access?.clients.online ?? 0} online agora</span>}>
<div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: '.6rem', marginBottom: '.8rem' }}>
<div style={{ padding: '.7rem', background: 'hsl(var(--secondary) / .65)', borderRadius: '.5rem' }}><div className="eyebrow">Acessos hoje</div><div className="mono" style={{ fontSize: '1.1rem', fontWeight: 700, marginTop: '.3rem' }}>{access?.accesses.today ?? '—'}</div></div>
<div style={{ padding: '.7rem', background: 'hsl(var(--secondary) / .65)', borderRadius: '.5rem' }}><div className="eyebrow">Autorizados</div><div className="mono" style={{ fontSize: '1.1rem', fontWeight: 700, marginTop: '.3rem', color: 'hsl(155 41% 43%)' }}>{access?.accesses.authorizedToday ?? '—'}</div></div>
<div style={{ padding: '.7rem', background: 'hsl(var(--secondary) / .65)', borderRadius: '.5rem' }}><div className="eyebrow">Negados</div><div className="mono" style={{ fontSize: '1.1rem', fontWeight: 700, marginTop: '.3rem', color: 'hsl(0 84% 60%)' }}>{access?.accesses.deniedToday ?? '—'}</div></div>
</div>
<div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '.6rem' }}>
<div style={{ padding: '.7rem', background: 'hsl(var(--secondary) / .65)', borderRadius: '.5rem' }}><div className="eyebrow">Clientes activos</div><div className="mono" style={{ fontSize: '1.1rem', fontWeight: 700, marginTop: '.3rem' }}>{access?.clients.active ?? '—'}</div></div>
<div style={{ padding: '.7rem', background: 'hsl(var(--secondary) / .65)', borderRadius: '.5rem' }}><div className="eyebrow">Bloqueados</div><div className="mono" style={{ fontSize: '1.1rem', fontWeight: 700, marginTop: '.3rem', color: access?.clients.blocked ? 'hsl(0 84% 60%)' : undefined }}>{access?.clients.blocked ?? '—'}</div></div>
</div>
</Section>
<Section title="Últimos acessos" note="Registos de entrada/saída do ginásio">
<div style={{ display: 'grid', gap: '.55rem' }}>
{(access?.recentAccesses ?? []).slice(0, 6).map((a) => <div key={a.id_acesso} style={{ display: 'flex', alignItems: 'center', gap: '.65rem', padding: '.55rem .65rem', background: 'hsl(var(--secondary) / .5)', borderRadius: '.45rem' }}>
<div style={{ width: 28, height: 28, borderRadius: 7, display: 'grid', placeItems: 'center', background: a.tipo_acesso === 'entrada' ? 'hsl(155 41% 43% / .15)' : 'hsl(var(--accent) / .15)', color: a.tipo_acesso === 'entrada' ? 'hsl(155 41% 43%)' : 'hsl(var(--accent))', fontSize: '.6rem' }}>{a.tipo_acesso === 'entrada' ? <ArrowDownRight size={13} /> : <ArrowUpRight size={13} />}</div>
<div style={{ flex: 1, minWidth: 0 }}><div style={{ fontSize: '.75rem', fontWeight: 600, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>{a.cliente_nome || `Cliente #${a.cliente_id}`}</div><div style={{ fontSize: '.63rem', color: 'hsl(var(--muted-foreground))' }}>{a.tipo_acesso === 'entrada' ? 'Entrada' : 'Saída'} · {a.hora_acesso?.slice(0, 5)}</div></div>
<Status tone={a.resultado === 'autorizado' ? 'good' : 'warn'}>{a.resultado}</Status>
</div>)}
{(!access?.recentAccesses || access.recentAccesses.length === 0) && <div style={{ textAlign: 'center', padding: '1rem', color: 'hsl(var(--muted-foreground))', fontSize: '.75rem' }}>Sem dados de acesso disponíveis</div>}
</div>
</Section>
</div></>;
}

function LeadsPage({ leads, userName, onChanged }: { leads: Lead[]; userName?: string; onChanged?: () => void }) {
  const [q, setQ] = useState(() => { try { return (JSON.parse(localStorage.getItem('leads-view') || '{}') as any).q || ''; } catch { return ''; } });
  const [status, setStatus] = useState(() => { try { return (JSON.parse(localStorage.getItem('leads-view') || '{}') as any).status || 'Todos'; } catch { return 'Todos'; } });
  const [source, setSource] = useState(() => { try { return (JSON.parse(localStorage.getItem('leads-view') || '{}') as any).source || 'Todas'; } catch { return 'Todas'; } });
  const [owner, setOwner] = useState('Todos');
  const [editing, setEditing] = useState<Lead | null>(null); const [open, setOpen] = useState(false);
  const [viewMsg, setViewMsg] = useState('');
  const createMut = useCreateLead(); const updateMut = useUpdateLead();
  const owners = useMemo(() => Array.from(new Set(leads.map(l => l.owner).filter(Boolean))), [leads]);
  const filtered = leads.filter(l => (l.name + l.company + l.email).toLowerCase().includes(q.toLowerCase()) && (status === 'Todos' || l.status === status) && (source === 'Todas' || l.source === source) && (owner === 'Todos' || l.owner === owner));
  const saveView = () => { try { localStorage.setItem('leads-view', JSON.stringify({ q, status, source })); setViewMsg('Vista guardada'); setTimeout(() => setViewMsg(''), 2000); } catch {} };
  const toApi = (x: Lead) => ({ name: x.name, email: x.email || undefined, company: x.company || undefined, source: x.source || undefined, status: LEAD_PT_TO_API[x.status] || 'novo_lead', ownerId: x.owner || undefined, estimatedValue: x.value || 0 });
  const handleSave = (x: Lead) => {
    if (editing) updateMut.mutate({ id: editing.id, data: toApi(x) }, { onSuccess: () => { setOpen(false); setEditing(null); onChanged?.(); } });
    else createMut.mutate({ data: toApi(x) }, { onSuccess: () => { setOpen(false); onChanged?.(); } });
  };
  return <><PageHeader eyebrow="Comercial · Captação" title="Leads" subtitle={`${leads.length} registos no espaço de trabalho`} action={<button className="btn-primary" onClick={() => { setEditing(null); setOpen(true); }} data-testid="button-add-lead"><Plus size={15} /> Novo lead</button>} /><div className="card" style={{ padding: '.7rem', marginBottom: '.8rem', display: 'flex', gap: '.55rem', alignItems: 'center', flexWrap: 'wrap' }}><div style={{ position: 'relative', flex: '1 1 230px' }}><Search size={14} style={{ position: 'absolute', left: 10, top: 10, color: 'hsl(var(--muted-foreground))' }} /><input data-testid="input-search-leads" className="input" style={{ paddingLeft: 31 }} placeholder="Pesquisar por nome, empresa ou email" value={q} onChange={e => setQ(e.target.value)} /></div><select data-testid="select-lead-status" className="select" value={status} onChange={e => setStatus(e.target.value)}><option>Todos</option>{['Novo Lead', 'Qualificação', 'Proposta', 'Negociação', 'Convertido', 'Perdido'].map(v => <option key={v}>{v}</option>)}</select><select data-testid="select-lead-source" className="select" value={source} onChange={e => setSource(e.target.value)}><option>Todas</option>{['Website', 'WhatsApp', 'Indicação', 'OVG', 'LinkedIn'].map(v => <option key={v}>{v}</option>)}</select><select data-testid="select-lead-owner" className="select" value={owner} onChange={e => setOwner(e.target.value)}><option>Todos</option>{owners.map(v => <option key={v}>{v}</option>)}</select></div><Section title="Todos os leads" note={`${filtered.length} resultados${viewMsg ? ` · ${viewMsg}` : ''}`} action={<button className="btn-quiet" onClick={saveView}><Filter size={13} /> Guardar vista</button>}><div className="table-wrap"><table className="data-table"><thead><tr><th>Lead</th><th>Origem</th><th>Etapa</th><th>Responsável</th><th>Valor estimado</th><th>Última actividade</th><th /></tr></thead><tbody>{filtered.map(l => <tr key={l.id} data-testid={`row-lead-${l.id}`}><td><div style={{ display: 'flex', alignItems: 'center', gap: '.6rem' }}><div style={{ width: 30, height: 30, borderRadius: 7, display: 'grid', placeItems: 'center', background: 'hsl(var(--secondary))', fontSize: '.64rem', fontWeight: 700 }}>{l.name.slice(0, 2).toUpperCase()}</div><div><div style={{ fontWeight: 700 }}>{l.name}</div><div style={{ fontSize: '.67rem', color: 'hsl(var(--muted-foreground))' }}>{l.company}</div></div></div></td><td>{l.source}</td><td><Status tone={l.status === 'Convertido' ? 'good' : l.status === 'Perdido' ? 'danger' : 'neutral'}>{l.status}</Status></td><td>{l.owner}</td><td className="mono" style={{ fontSize: '.68rem' }}>{money(l.value)}</td><td style={{ color: 'hsl(var(--muted-foreground))' }}>{l.last}</td><td><IconButton label="editar lead" onClick={() => { setEditing(l); setOpen(true); }}><Edit3 size={14} /></IconButton></td></tr>)}</tbody></table></div></Section>{open && <LeadModal initial={editing} onClose={() => setOpen(false)} onSave={handleSave} userName={userName} />}</>;
}
function LeadModal({ initial, onClose, onSave, userName }: { initial: Lead | null; onClose: () => void; onSave: (x: Lead) => void; userName?: string }) {
  const [name, setName] = useState(initial?.name ?? ''); const [company, setCompany] = useState(initial?.company ?? ''); const [email, setEmail] = useState(initial?.email ?? ''); const [source, setSource] = useState(initial?.source ?? 'Website');
  return <Modal title={initial ? 'Editar lead' : 'Adicionar lead'} subtitle="Registo comercial interno" onClose={onClose}><div className="form-grid"><FormField label="Nome completo" value={name} onChange={setName} placeholder="Ex.: Joana Manuel" /><FormField label="Empresa" value={company} onChange={setCompany} placeholder="Nome da organização" /><FormField label="Email profissional" value={email} onChange={setEmail} type="email" /><label><span className="form-label">Origem</span><select className="select" style={{ width: '100%' }} value={source} onChange={e => setSource(e.target.value)}>{['Website', 'WhatsApp', 'Indicação', 'OVG', 'LinkedIn'].map(x => <option key={x}>{x}</option>)}</select></label><div style={{ display: 'flex', justifyContent: 'flex-end', gap: '.5rem', marginTop: '.35rem' }}><button className="btn-secondary" onClick={onClose}>Cancelar</button><button className="btn-primary" disabled={!name || !company} onClick={() => onSave({ id: initial?.id ?? 'LD-' + Date.now().toString(36).slice(-6).toUpperCase(), name, company, email, source, status: initial?.status ?? 'Novo Lead', owner: initial?.owner ?? (userName || 'Utilizador'), value: initial?.value ?? 0, last: 'Agora' })}><Check size={14} /> Guardar lead</button></div></div></Modal>;
}

function PipelinePage({ leads, userName, onChanged }: { leads: Lead[]; userName?: string; onChanged?: () => void }) {
  const stages = ['Novo Lead', 'Qualificação', 'Proposta', 'Negociação', 'Convertido', 'Perdido']; const [selected, setSelected] = useState<Lead | null>(null);
  const [isNew, setIsNew] = useState(false);
  const [sort, setSort] = useState('Recentes');
  const updateMut = useUpdateLead(); const createMut = useCreateLead();
  const move = (lead: Lead, stage: string) => updateMut.mutate({ id: lead.id, data: { status: LEAD_PT_TO_API[stage] || 'novo_lead' } }, { onSuccess: () => onChanged?.() });
  const sorted = (cards: Lead[]) => sort === 'Maior valor' ? [...cards].sort((a, b) => b.value - a.value) : sort === 'Nome A-Z' ? [...cards].sort((a, b) => a.name.localeCompare(b.name)) : cards;
  const handleSave = (x: Lead) => {
    const data = { name: x.name, email: x.email || undefined, company: x.company || undefined, source: x.source || undefined, status: LEAD_PT_TO_API[x.status] || 'novo_lead', ownerId: x.owner || undefined, estimatedValue: x.value || 0 };
    if (!isNew && selected) updateMut.mutate({ id: selected.id, data }, { onSuccess: () => { setSelected(null); onChanged?.(); } });
    else createMut.mutate({ data }, { onSuccess: () => { setIsNew(false); onChanged?.(); } });
  };
  const cycleSort = () => setSort(sort === 'Recentes' ? 'Maior valor' : sort === 'Maior valor' ? 'Nome A-Z' : 'Recentes');
  return <><PageHeader eyebrow="Comercial · Conversão" title="Pipeline" subtitle="Acompanhe cada oportunidade até  à decisão." action={<div style={{ display: 'flex', gap: '.45rem' }}><button className="btn-secondary" onClick={cycleSort}><ListFilter size={14} /> Vista: {sort}</button><button className="btn-primary" onClick={() => { setSelected(null); setIsNew(true); }}><Plus size={14} /> Oportunidade</button></div>} /><div className="card" style={{ padding: '.8rem', marginBottom: '.8rem', display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: '.8rem', flexWrap: 'wrap' }}><div><span className="eyebrow">Valor total em aberto</span><div className="mono" style={{ fontWeight: 600, fontSize: '1.1rem', marginTop: '.25rem' }}>{money(leads.reduce((s, l) => s + l.value, 0))}</div></div><div style={{ display: 'flex', gap: '1.2rem', color: 'hsl(var(--muted-foreground))', fontSize: '.7rem' }}><span><strong style={{ color: 'hsl(var(--foreground))' }}>{leads.length}</strong> oportunidades</span><span><strong style={{ color: 'hsl(var(--foreground))' }}>{Math.round((leads.filter(l => l.status === 'Convertido').length / Math.max(leads.length, 1)) * 100)}%</strong> conversão</span></div></div><div style={{ display: 'grid', gridTemplateColumns: `repeat(${stages.length}, minmax(180px, 1fr))`, gap: '.65rem', overflowX: 'auto', paddingBottom: '.45rem' }}>{stages.map((stage) => { const cards = sorted(leads.filter(l => l.status === stage)); return <div key={stage} style={{ minHeight: 410, background: 'hsl(var(--secondary) / .55)', border: '1px solid hsl(var(--border))', borderRadius: '.65rem', padding: '.65rem' }}><div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '.7rem' }}><div style={{ fontSize: '.7rem', fontWeight: 700 }}>{stage}</div><span style={{ width: 20, height: 20, display: 'grid', placeItems: 'center', borderRadius: 6, background: 'hsl(var(--card))', color: 'hsl(var(--muted-foreground))', fontSize: '.62rem' }}>{cards.length}</span></div><div style={{ display: 'grid', gap: '.5rem' }}>{cards.map(l => <button key={l.id} onClick={() => { setSelected(l); setIsNew(false); }} style={{ textAlign: 'left', padding: '.65rem', background: 'hsl(var(--card))', border: '1px solid hsl(var(--border))', borderRadius: '.5rem', cursor: 'pointer', boxShadow: 'none' }}><div style={{ fontWeight: 700, fontSize: '.74rem' }}>{l.name}</div><div style={{ fontSize: '.66rem', color: 'hsl(var(--muted-foreground))', marginTop: '.15rem' }}>{l.company}</div><div style={{ display: 'flex', justifyContent: 'space-between', marginTop: '.5rem', fontSize: '.64rem' }}><span style={{ color: 'hsl(var(--muted-foreground))' }}>{l.source}</span><span className="mono">{money(l.value)}</span></div>{stages.indexOf(stage) > 0 && stages.indexOf(stage) < stages.length - 2 && <div style={{ marginTop: '.5rem', display: 'flex', gap: '.3rem' }}>{stages.indexOf(stage) > 0 && <button className="btn-secondary" style={{ fontSize: '.62rem', padding: '.25rem .45rem' }} onClick={(e) => { e.stopPropagation(); move(l, stages[stages.indexOf(stage) - 1]); }}><ArrowDownRight size={11} /> Voltar</button>}{stages.indexOf(stage) < stages.length - 2 && <button className="btn-secondary" style={{ fontSize: '.62rem', padding: '.25rem .45rem' }} onClick={(e) => { e.stopPropagation(); move(l, stages[stages.indexOf(stage) + 1]); }}><ArrowUpRight size={11} /> Avançar</button>}</div>}</button>)}</div></div>; })}</div>{(isNew || selected) && <LeadModal initial={isNew ? null : selected} onClose={() => { setSelected(null); setIsNew(false); }} onSave={handleSave} userName={userName} />}</>;
}

function CustomersPage({ customers, loading, onChanged }: { customers: Customer[]; loading?: boolean; onChanged?: () => void }) {
  const [q, setQ] = useState('');
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
    createLeadMut.mutate({ data: { name: newName.trim(), phone: newPhone || undefined, email: newEmail || undefined, company: 'Particular', source: 'Balcão', status: 'novo_lead' } }, {
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
  return <><PageHeader eyebrow="Receita · Relação" title="Clientes" subtitle="Registos únicos e contexto completo de cada conta." action={<div style={{ display: 'flex', gap: '.4rem' }}><label className="btn-secondary" style={{ cursor: 'pointer', display: 'inline-flex', alignItems: 'center', gap: '.3rem' }}><Upload size={14} /> Importar CSV<input type="file" accept=".csv" style={{ display: 'none' }} onChange={handleCsvImport} /></label><button className="btn-primary" onClick={() => setNewOpen(true)}><Plus size={14} /> Novo cliente</button></div>} />{importMsg && <div className="card" style={{ padding: '.6rem .8rem', marginBottom: '.6rem', fontSize: '.75rem', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}><span>{importMsg}</span><button className="btn-quiet" onClick={() => setImportMsg('')}><X size={14} /></button></div>}<div className="card" style={{ padding: '.7rem', marginBottom: '.8rem', display: 'flex', gap: '.5rem' }}><div style={{ position: 'relative', maxWidth: 380, width: '100%' }}><Search size={14} style={{ position: 'absolute', left: 10, top: 10, color: 'hsl(var(--muted-foreground))' }} /><input data-testid="input-search-customers" className="input" style={{ paddingLeft: 31 }} placeholder="Pesquisar cliente ou empresa" value={q} onChange={e => setQ(e.target.value)} /></div><select data-testid="select-customer-state" className="select" value={status} onChange={e => setStatus(e.target.value)} style={{ maxWidth: 160 }}><option>Todos</option><option>Activo</option><option>Inactivo</option><option>Bloqueado</option><option>Em atraso</option><option>Esgotadas</option></select></div><Section title="Directório de clientes" note={loading ? 'A carregar...' : `${filtered.length} contas com registo consolidado`}><div className="table-wrap"><table className="data-table"><thead><tr><th>Cliente</th><th>Plano</th><th>Estado</th><th>Género</th><th>Entrada</th><th>Aulas</th><th>Contacto</th><th /></tr></thead><tbody>{loading ? <tr><td colSpan={8} style={{ textAlign: 'center', padding: '3rem' }}><div style={{ display: 'inline-block', width: 28, height: 28, border: '3px solid hsl(var(--border))', borderTopColor: 'hsl(var(--accent))', borderRadius: '50%', animation: 'spin 0.7s linear infinite' }} /><div style={{ marginTop: '.6rem', color: 'hsl(var(--muted-foreground))', fontSize: '.75rem' }}>A carregar clientes...</div></td></tr> : filtered.map(c => <tr key={c.id}><td><Link href={`/admin/clientes/${c.id}`} style={{ textDecoration: 'none', color: 'inherit', display: 'flex', alignItems: 'center', gap: '.6rem' }} data-testid={`link-customer-${c.id}`}><div style={{ width: 30, height: 30, borderRadius: 7, display: 'grid', placeItems: 'center', background: 'hsl(var(--secondary))', fontSize: '.64rem', fontWeight: 700 }}>{c.name.slice(0, 2).toUpperCase()}</div><div><div style={{ fontWeight: 700 }}>{c.name}</div><div style={{ fontSize: '.67rem', color: 'hsl(var(--muted-foreground))' }}>{c.company} · {c.id}</div></div></Link></td><td>{c.plan || '—'}</td><td><Status tone={c.state === 'Activo' ? 'good' : 'warn'}>{c.state}</Status></td><td style={{ fontSize: '.72rem' }}>{c.gender || '—'}</td><td>{c.joined}</td><td style={{ fontWeight: 600, color: c.lessonsLimit !== -1 && (c.lessonsLeft ?? 1) === 0 ? 'hsl(0 70% 50%)' : undefined }}>{c.lessonsLimit === -1 ? '∞' : `${c.lessonsLeft ?? '—'} / ${c.lessonsLimit ?? '—'}`}</td><td><div style={{ fontSize: '.72rem' }}>{c.email}</div><div style={{ fontSize: '.65rem', color: 'hsl(var(--muted-foreground))' }}>{c.phone}</div></td><td><ChevronRight size={15} color="hsl(var(--muted-foreground))" /></td></tr>)}</tbody></table></div></Section>
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
      <button className="btn-primary" onClick={saveNewClient} disabled={createLeadMut.isPending} style={{ flex: 1 }}><Check size={14} /> {createLeadMut.isPending ? 'A guardar...' : 'Guardar'}</button>
    </div>
  </div></div>}</>;
}
function CustomerDetail({ customers, onChanged }: { customers: Customer[]; onChanged?: () => void }) {
  const { id } = useParams<{ id: string }>(); const customer = customers.find(c => c.id === id) ?? customers[0];
  const [, setLocation] = useLocation();
  const [editOpen, setEditOpen] = useState(false);
  const [menuOpen, setMenuOpen] = useState(false);
  const [fName, setFName] = useState(''); const [fPhone, setFPhone] = useState(''); const [fEmail, setFEmail] = useState('');
  const [editMsg, setEditMsg] = useState(''); const [saving, setSaving] = useState(false);
  const openEdit = () => {
    if (!customer) return;
    setFName(customer.name || ''); setFPhone(customer.phone || ''); setFEmail(customer.email || '');
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
        body: JSON.stringify({ nome: fName.trim(), telefone: fPhone, email: fEmail }),
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
  return <><PageHeader eyebrow="Cliente · Perfil 360º" title={customer.name} subtitle={`${customer.company} · ${customer.id}`} action={<div style={{ display: 'flex', gap: '.4rem' }}><button className="btn-secondary" onClick={openEdit}><Edit3 size={14} /> Editar</button><div style={{ position: 'relative' }}><button className="btn-primary" onClick={() => setMenuOpen(!menuOpen)}><MoreHorizontal size={14} /> Acções</button>{menuOpen && <div className="card" style={{ position: 'absolute', right: 0, top: '110%', zIndex: 30, padding: '.4rem', minWidth: 180 }}>
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
    <div className="section-note" style={{ marginBottom: '1rem' }}>Só nome, telefone e email (a catraca gere o resto).</div>
    <label className="label">Nome *</label>
    <input className="input" value={fName} onChange={e => setFName(e.target.value)} style={{ width: '100%' }} />
    <div style={{ display: 'flex', gap: '.5rem', marginTop: '.6rem' }}>
      <div style={{ flex: 1 }}><label className="label">Telefone</label>
      <input className="input" value={fPhone} onChange={e => setFPhone(e.target.value)} /></div>
      <div style={{ flex: 1 }}><label className="label">Email</label>
      <input className="input" value={fEmail} onChange={e => setFEmail(e.target.value)} /></div>
    </div>
    {editMsg && <div style={{ fontSize: '.75rem', marginTop: '.6rem', color: 'hsl(0 70% 50%)' }}>{editMsg}</div>}
    <div style={{ display: 'flex', gap: '.5rem', marginTop: '1rem' }}>
      <button className="btn-secondary" onClick={() => setEditOpen(false)} style={{ flex: 1 }}>Cancelar</button>
      <button className="btn-primary" onClick={saveEdit} disabled={saving} style={{ flex: 1 }}><Check size={14} /> {saving ? 'A guardar...' : 'Guardar'}</button>
    </div>
  </div></div>}</>;
}
function MiniList({ items }: { items: string[] }) { return <div style={{ display: 'grid', gap: '.65rem' }}>{items.map((x, i) => <div key={x} style={{ display: 'flex', alignItems: 'center', gap: '.55rem', fontSize: '.72rem', color: i === 0 ? 'hsl(var(--foreground))' : 'hsl(var(--muted-foreground))' }}><span style={{ width: 6, height: 6, borderRadius: '50%', background: i === 0 ? 'hsl(var(--chart-2))' : 'hsl(var(--border))' }} />{x}</div>)}</div>; }

function PlansPage() {
  const apiKey = 'solve-crm-api-key-2024';
  const apiBase = import.meta.env.VITE_API_URL || '';
  const [plans, setPlans] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [showModal, setShowModal] = useState(false);
  const [editing, setEditing] = useState<any>(null);
  const [form, setForm] = useState({ name: '', description: '', price: '', periodicity: 'mensal', active: true });

  const fetchPlans = async () => {
    try {
      const res = await fetch(`${apiBase}/api/v1/plans`, {
        headers: { 'X-API-Key': apiKey },
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
        headers: { 'Content-Type': 'application/json', 'X-API-Key': apiKey },
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
        headers: { 'X-API-Key': apiKey },
      });
      if (res.ok) fetchPlans();
      else alert('Erro ao apagar');
    } catch (e: any) { alert('Erro: ' + e.message); }
  };

  return <><PageHeader eyebrow="Receita · Catálogo" title="Planos" subtitle="Catálogo comercial e estado das subscrições." action={<button className="btn-primary" onClick={openNew}><Plus size={14} /> Novo plano</button>} />
  {loading ? <div className="card" style={{ padding: '2rem', textAlign: 'center' }}>A carregar...</div> :
  <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(280px, 1fr))', gap: '.8rem' }}>{plans.length === 0 && <div className="card" style={{ padding: '2rem', textAlign: 'center', color: 'hsl(var(--muted-foreground))' }}>Nenhum plano configurado</div>}{plans.map((p, i) => <div className="card" key={p.id} style={{ padding: '1.1rem', borderTop: i === 0 ? '3px solid hsl(var(--accent))' : undefined }}><div style={{ display: 'flex', alignItems: 'start', justifyContent: 'space-between' }}><div><div className="eyebrow">{i === 0 ? 'Mais subscrito' : `Plano 0${i + 1}`}</div><h2 style={{ fontSize: '1.05rem', marginTop: '.35rem' }}>{p.name}</h2></div><Status tone={p.active ? 'good' : 'warn'}>{p.active ? 'Activo' : 'Inactivo'}</Status></div><p className="section-note" style={{ minHeight: 33 }}>{p.description || 'Plano disponível'}</p><div className="mono" style={{ fontSize: '1.2rem', margin: '1rem 0' }}>{p.price ? money(p.price) : 'Gratuito'}<span style={{ fontFamily: 'var(--app-font-sans)', color: 'hsl(var(--muted-foreground))', fontSize: '.67rem' }}> / {p.periodicity || 'mês'}</span></div><div style={{ display: 'flex', gap: '.4rem' }}><button className="btn-secondary" onClick={() => openEdit(p)} style={{ flex: 1 }}>Editar</button><button className="btn-secondary" onClick={() => del(p)} style={{ color: 'hsl(0 70% 50%)' }}><Trash2 size={14} /></button></div></div>)}</div>}
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
          {checking ? 'Verificando...' : 'Verificar Estado no É-kwanza'}
        </button>
      </div>
      {checkResult && (
        <div style={{ marginTop: '.4rem', padding: '.5rem .65rem', background: checkResult.changed ? 'hsl(142 70% 45% / .15)' : 'hsl(var(--secondary) / .45)', borderRadius: '.4rem', fontSize: '.72rem' }}>
          <strong>É-kwanza:</strong> {checkResult.ekwanzaStatus} {checkResult.changed && `(atualizado de ${checkResult.previousStatus})`}
          {checkResult.reference && <div style={{ marginTop: '.2rem', fontSize: '.68rem' }}>Ref: {checkResult.reference.referenceNumber} | Entity: {checkResult.reference.entity}</div>}
        </div>
      )}
    </div>
  </Modal>;
}

function PaymentsPage() {
  const [paymentsData, setPaymentsData] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const apiKey = 'solve-crm-api-key-2024';
  
  const fetchPayments = async () => {
    try {
      const apiBase = import.meta.env.VITE_API_URL || '';
      const res = await fetch(`${apiBase}/api/v1/payments`, {
        headers: { 'X-API-Key': apiKey },
        credentials: 'include',
      });
      if (res.ok) {
        const json = await res.json();
        setPaymentsData(json.data || []);
      }
    } catch (e) { console.error(e); }
    setLoading(false);
  };

  useEffect(() => { fetchPayments(); }, []);

  const [syncing, setSyncing] = useState(false);
  const syncNow = async () => {
    setSyncing(true);
    try {
      await fetchPayments();
      const pend = paymentsData.filter((p: any) => p.status === 'pendente').slice(0, 20);
      const apiBase2 = import.meta.env.VITE_API_URL || '';
      for (const p of pend) {
        try {
          await fetch(`${apiBase2}/api/v1/payments/ekwanza/check-status/${p.code || p.id}`, {
            headers: { 'X-API-Key': apiKey },
          });
          await new Promise(r => setTimeout(r, 400));
        } catch {}
      }
      await fetchPayments();
    } catch {}
    setSyncing(false);
  };

  const payments = useMemo(() =>
    paymentsData.map((p: any) => ({
      id: p.code ?? p.id ?? '',
      customer: p.customer_name ?? 'Cliente',
      amount: p.amount ?? 0,
      method: p.method ?? '',
      state: p.status === 'confirmado' ? 'Confirmado' : p.status === 'pendente' ? 'Pendente' : p.status === 'em_atraso' ? 'Em atraso' : p.status === 'rejeitado' ? 'Cancelado' : p.status === 'reembolsado' ? 'Reembolsado' : p.status === 'expirado' ? 'Expirado' : p.status ?? '',
      date: p.paid_at ?? p.created_at ?? '',
      referenceCode: p.reference_code ?? '',
      entity: p.entity ?? '',
      ekwanzaCode: p.ekwanza_code ?? '',
      ekwanzaOperationCode: p.ekwanza_operation_code ?? '',
      customerName: p.customer_name ?? '',
      createdAt: p.created_at ?? '',
      paidAt: p.paid_at ?? '',
      expiresAt: p.expires_at ?? '',
      raw: p,
    }))
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
    if (search && !p.customer.toLowerCase().includes(search.toLowerCase()) && !p.id.toLowerCase().includes(search.toLowerCase())) return false;
    if (dateFrom && p.date && p.date < dateFrom) return false;
    if (dateTo && p.date && p.date > dateTo + 'T23:59:59') return false;
    return true;
  });
  return <><PageHeader eyebrow="Receita · Tesouraria" title="Pagamentos" subtitle="Monitorização de transacções." action={<button className="btn-secondary" onClick={syncNow} disabled={syncing}><RefreshCw size={14} className={syncing ? 'animate-spin' : ''} /> {syncing ? 'A sincronizar...' : 'Sincronizar Pay4All'}</button>} /><div className="metric-grid" style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: '.8rem', marginBottom: '.8rem' }}><Metric label="Recebido" value={money(payments.filter(p => p.state === 'Confirmado').reduce((s, p) => s + p.amount, 0))} note={`${payments.filter(p => p.state === 'Confirmado').length} transacções`} /><Metric label="Pendente" value={money(payments.filter(p => p.state === 'Pendente').reduce((s, p) => s + p.amount, 0))} note={`${payments.filter(p => p.state === 'Pendente').length} transacções`} /><Metric label="Em atraso" value={money(payments.filter(p => p.state === 'Em atraso').reduce((s, p) => s + p.amount, 0))} note={`${payments.filter(p => p.state === 'Em atraso').length} cliente(s)`} negative /><Metric label="Cancelado" value={money(payments.filter(p => p.state === 'Cancelado').reduce((s, p) => s + p.amount, 0))} note={`${payments.filter(p => p.state === 'Cancelado').length} transacções`} negative /></div>
  <div style={{ display: 'flex', gap: '.5rem', marginBottom: '.8rem', flexWrap: 'wrap' }}>
    <input className="input" placeholder="Pesquisar cliente ou ID..." value={search} onChange={e => setSearch(e.target.value)} style={{ flex: 1, minWidth: '150px' }} />
    <input className="input" type="date" value={dateFrom} onChange={e => setDateFrom(e.target.value)} style={{ width: '140px' }} />
    <input className="input" type="date" value={dateTo} onChange={e => setDateTo(e.target.value)} style={{ width: '140px' }} />
    {(search || dateFrom || dateTo) && <button className="btn-secondary" onClick={() => { setSearch(''); setDateFrom(''); setDateTo(''); }}><RefreshCw size={12} /> Limpar</button>}
  </div>
  <Section title="Movimentos recentes" note={`${visible.length} transacções`} action={<select className="select" value={filter} onChange={e => setFilter(e.target.value)} data-testid="select-payment-status"><option>Todas</option><option>Confirmado</option><option>Pendente</option><option>Em atraso</option><option>Cancelado</option><option>Expirado</option><option>Reembolsado</option></select>}><div className="table-wrap"><table className="data-table"><thead><tr><th>Transacção</th><th>Cliente</th><th>Método</th><th>Estado</th><th>Montante</th><th>Data</th><th /></tr></thead><tbody>{visible.map(p => <tr key={p.id}><td className="mono" style={{ fontSize: '.67rem' }}>{p.id}</td><td style={{ fontWeight: 700 }}>{p.customer}</td><td>{p.method}</td><td><Status tone={p.state === 'Confirmado' ? 'good' : p.state === 'Cancelado' ? 'danger' : p.state === 'Em atraso' ? 'danger' : p.state === 'Expirado' ? 'danger' : 'warn'}>{p.state}</Status></td><td className="mono" style={{ fontSize: '.68rem' }}>{money(p.amount)}</td><td style={{ color: 'hsl(var(--muted-foreground))' }}>{p.date}</td><td>{p.state === 'Confirmado' && <span style={{ color: 'hsl(155 41% 35%)', fontSize: '.7rem', display: 'inline-flex', gap: '.3rem', alignItems: 'center' }}><CheckCircle2 size={13} /> Conciliado</span>}</td><td><button className="btn-quiet" onClick={() => setSelected(p)}><Eye size={14} /></button></td></tr>)}</tbody></table></div></Section>{selected && <PaymentDetailModal payment={selected} onClose={() => setSelected(null)} />}</>;
}

const INTEGRATION_DEFAULTS: { name: string; desc: string; icon: typeof BriefcaseBusiness }[] = [
  { name: 'OVG', desc: 'Virtual Gym · Sócios e acessos', icon: BriefcaseBusiness },
  { name: 'Pay4All', desc: 'Pagamentos e reconciliação', icon: CreditCard },
  { name: 'Cademi', desc: 'Acessos e área de membros', icon: KeyRound },
  { name: 'WhatsApp', desc: 'Conversas comerciais', icon: LifeBuoy },
  { name: 'Website', desc: 'Formulários e canais digitais', icon: Link2 },
];
function IntegrationsPage() {
  const { data } = useListIntegrations({ query: { refetchInterval: 30000 } });
  const ovgSync = useOVGSyncStatus();
  const ovgHealth = useOVGHealth();
  const syncNowMut = useOVGSyncNow();
  const cademiHealth = useCademiHealth();
  const cademiSyncMut = useCademiSync();
  const apiIntegrations = data?.data ?? [];
  const ovgSyncData = ovgSync.data?.data;
  const ovgHealthData = ovgHealth.data?.data;
  const cademiHealthData = cademiHealth.data;
  const [configName, setConfigName] = useState<string | null>(null);
  
  const items = useMemo(() => {
    const applyCademi = (list: any[]) => list.map(item => {
      if (item.name !== 'Cademi') return item;
      if (!cademiHealthData) return item;
      return {
        ...item,
        state: cademiHealthData.connected ? 'Operacional' : 'Erro',
        sync: cademiHealthData.connected ? 'Ligado' : 'Falha',
        volume: cademiHealthData.connected ? `${cademiHealthData.products ?? 0} produtos` : (cademiHealthData.message || 'Não configurado'),
        isCademi: true,
        cademi: cademiHealthData,
      };
    });
    if (apiIntegrations.length > 0) {
      const iconMap: Record<string, typeof BriefcaseBusiness> = { OVG: BriefcaseBusiness, Pay4All: CreditCard, Cademi: KeyRound, WhatsApp: LifeBuoy, Website: Link2 };
      return applyCademi(apiIntegrations.map(ig => {
        const isOVG = ig.name === 'OVG';
        const syncInfo = isOVG && ovgSyncData ? ovgSyncData : null;
        const healthInfo = isOVG && ovgHealthData ? ovgHealthData : null;
        
        return {
          name: ig.name ?? '',
          desc: isOVG ? 'Virtual Gym · Sóciros e acessos' : ig.name ?? '',
          icon: iconMap[ig.name ?? ''] ?? Link2,
          state: healthInfo ? (healthInfo.connected ? 'Operacional' : 'Erro') : (ig.status === 'operacional' ? 'Operacional' : ig.status === 'atencao' ? 'Atenção' : ig.status === 'erro' ? 'Erro' : 'Inativo'),
          sync: syncInfo ? (syncInfo.isSyncing ? 'A sincronizar...' : (syncInfo.lastSync ? `há ${Math.round((Date.now() - new Date(syncInfo.lastSync.timestamp).getTime()) / 60000)} min` : 'Nunca')) : (ig.lastSyncAt ?? 'Nunca'),
          volume: syncInfo ? (syncInfo.lastSync ? `${syncInfo.lastSync.created} criados, ${syncInfo.lastSync.updated} actualizados` : 'Aguardando primeira sincronização') : (ig.errorCount ? `${ig.errorCount} erros` : 'Operacional'),
          isOVG,
          syncInfo,
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
  }, [apiIntegrations, ovgSyncData, ovgHealthData, cademiHealthData]);
  
  return <><PageHeader eyebrow="Ecossistema · Conectividade" title="Integrações" subtitle="Estado dos canais que alimentam a operação." action={<button className="btn-secondary" onClick={() => syncNowMut.mutate()} disabled={syncNowMut.isPending || ovgSyncData?.isSyncing}><RefreshCw size={14} className={syncNowMut.isPending || ovgSyncData?.isSyncing ? 'animate-spin' : ''} /> {syncNowMut.isPending || ovgSyncData?.isSyncing ? 'A sincronizar...' : 'Sincronizar tudo'}</button>} /><div style={{ display: 'grid', gridTemplateColumns: 'repeat(2, minmax(0, 1fr))', gap: '.8rem' }}>{items.map(({ name, desc, icon: I, state, sync, volume, isOVG, syncInfo, isCademi, cademi }) => <div className="card" key={name} style={{ padding: '1rem' }}><div style={{ display: 'flex', gap: '.7rem', alignItems: 'flex-start' }}><div style={{ width: 37, height: 37, borderRadius: 9, display: 'grid', placeItems: 'center', background: 'hsl(var(--secondary))', color: 'hsl(var(--primary))' }}><I size={17} /></div><div style={{ flex: 1 }}><div style={{ display: 'flex', justifyContent: 'space-between', gap: '.5rem' }}><div><div style={{ fontWeight: 700, fontSize: '.85rem' }}>{name}</div><div className="section-note">{desc}</div></div><Status tone={state === 'Operacional' ? 'good' : 'warn'}>{state}</Status></div><div style={{ display: 'flex', justifyContent: 'space-between', marginTop: '1rem', fontSize: '.67rem', color: 'hsl(var(--muted-foreground))' }}><span><Clock3 size={12} style={{ verticalAlign: 'middle', marginRight: 4 }} />{syncInfo?.isSyncing ? <span style={{ color: 'hsl(var(--accent))' }}>A sincronizar...</span> : `Sincronizado ${sync}`}</span><span>{volume}</span></div>{isOVG && <div style={{ marginTop: '.5rem', fontSize: '.65rem', color: 'hsl(var(--muted-foreground))' }}>{ovgHealthData ? (ovgHealthData.connected ? `✓ ${ovgHealthData.message}` : `✗ ${ovgHealthData.message}`) : 'A verificar...'}</div>}{isCademi && <div style={{ marginTop: '.5rem', fontSize: '.65rem', color: 'hsl(var(--muted-foreground))' }}>{cademi ? (cademi.connected ? `Cademi OK · ${cademi.products ?? 0} produtos` : cademi.message) : 'A verificar...'}</div>}<div style={{ display: 'flex', gap: '.45rem', marginTop: '.75rem' }}>{(isOVG || isCademi) && <button className="btn-secondary" onClick={() => isOVG ? syncNowMut.mutate() : cademiSyncMut.mutate()} disabled={syncNowMut.isPending || syncInfo?.isSyncing || cademiSyncMut.isPending}><RefreshCw size={13} className={syncNowMut.isPending || syncInfo?.isSyncing || cademiSyncMut.isPending ? 'animate-spin' : ''} /> {isOVG ? (syncInfo?.isSyncing ? 'A sincronizar...' : 'Sincronizar') : (cademiSyncMut.isPending ? 'A sincronizar...' : 'Sincronizar')}</button>}<button className="btn-quiet" onClick={() => setConfigName(name)}>Configurar <ChevronRight size={13} /></button></div></div></div></div>)}</div>{configName && <IntegrationConfigModal name={configName} onClose={() => setConfigName(null)} />}<Section title="Actividade de sincronização" note="Eventos mais recentes"><MiniList items={[...(ovgSyncData?.lastSync ? [`OVG · ${ovgSyncData.lastSync.created} criados, ${ovgSyncData.lastSync.updated} actualizados · agora`] : []), 'Pay4All · 86 transacções importadas · há 4 min', 'Website · 12 leads recebidos · há 8 min', 'Cademi · 2 acessos pendentes · há 17 min']} /></Section></>;
}

function AcademiaPage() {
  const apiKey = 'solve-crm-api-key-2024';
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

  const fetchAll = async () => {
    setLoading(true);
    try {
      const [p, u] = await Promise.all([
        fetch(`${apiBase}/api/v1/cademi/products`, { headers: { 'X-API-Key': apiKey } }).then(r => r.json()),
        fetch(`${apiBase}/api/v1/cademi/users`, { headers: { 'X-API-Key': apiKey } }).then(r => r.json()),
      ]);
      setProducts(p.data || []);
      setStudents(u.data || []);
    } catch (e) { console.error(e); }
    setLoading(false);
  };

  useEffect(() => { fetchAll(); }, []);

  const openStudent = async (s: any) => {
    setSelected(s);
    setDetail(null);
    setLoadingDetail(true);
    try {
      const a: any = await fetch(`${apiBase}/api/v1/cademi/users/${s.id}/access`, { headers: { 'X-API-Key': apiKey } }).then(r => r.json());
      const acessos = a.data?.acesso || [];
      const withProgress = await Promise.all(acessos.map(async (ac: any) => {
        try {
          const pr: any = await fetch(`${apiBase}/api/v1/cademi/users/${s.id}/progress/${ac.produto.id}`, { headers: { 'X-API-Key': apiKey } }).then(r => r.json());
          return { ...ac, progresso: pr.data || null };
        } catch { return { ...ac, progresso: null }; }
      }));
      setDetail({ ...a.data, acesso: withProgress });
    } catch (e) { console.error(e); }
    setLoadingDetail(false);
  };

  const sync = async () => {
    setSyncing(true);
    setSyncMsg('');
    try {
      const r: any = await fetch(`${apiBase}/api/v1/cademi/sync`, { method: 'POST', headers: { 'X-API-Key': apiKey } }).then(r => r.json());
      setSyncMsg(`${r.matched ?? 0} alunos ligados de ${r.cademiUsers ?? 0} na Cademi`);
    } catch (e: any) { setSyncMsg('Erro: ' + e.message); }
    setSyncing(false);
  };

  const visible = students.filter(s => !search || (s.nome || '').toLowerCase().includes(search.toLowerCase()) || (s.email || '').toLowerCase().includes(search.toLowerCase()));
  const fmtD = (d: string | null) => { if (!d) return '—'; try { return new Date(d).toLocaleDateString('pt-AO', { day: '2-digit', month: 'short', year: 'numeric' }); } catch { return d; } };

  return <><PageHeader eyebrow="Ecossistema · Formação" title="Academia" subtitle="Cursos e alunos da plataforma Cademi." action={<div style={{ display: 'flex', gap: '.5rem' }}><button className="btn-secondary" onClick={fetchAll}><RefreshCw size={14} /> Atualizar</button><button className="btn-primary" onClick={sync} disabled={syncing}><RefreshCw size={14} className={syncing ? 'animate-spin' : ''} /> {syncing ? 'A sincronizar...' : 'Sincronizar'}</button></div>} />
  {syncMsg && <div className="card" style={{ padding: '.7rem 1rem', marginBottom: '.8rem', fontSize: '.78rem' }}>{syncMsg}</div>}
  {loading ? <div className="card" style={{ padding: '2rem', textAlign: 'center' }}>A carregar dados da Cademi...</div> : <>
    <Section title="Cursos" note={`${products.length} produtos`}>
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(240px, 1fr))', gap: '.8rem' }}>
        {products.map(p => <div className="card" key={p.id} style={{ padding: '1rem' }}>
          <div className="eyebrow">ID {p.id}</div>
          <h2 style={{ fontSize: '1rem', marginTop: '.3rem' }}>{p.nome}</h2>
          {p.vitrine && <div className="section-note" style={{ marginTop: '.3rem' }}>Vitrine: {p.vitrine.nome}</div>}
        </div>)}
        {products.length === 0 && <div className="card" style={{ padding: '2rem', textAlign: 'center' }}>Nenhum curso encontrado</div>}
      </div>
    </Section>
    <div style={{ display: 'flex', gap: '.5rem', marginBottom: '.8rem', marginTop: '.8rem' }}>
      <input className="input" placeholder="Pesquisar aluno por nome ou email..." value={search} onChange={e => setSearch(e.target.value)} style={{ flex: 1 }} />
    </div>
    <Section title="Alunos" note={`${visible.length} de ${students.length}`}>
      <div className="table-wrap"><table className="data-table"><thead><tr><th>Aluno</th><th>Email</th><th>Telemóvel</th><th>Último acesso</th><th /></tr></thead>
      <tbody>{visible.map(s => <tr key={s.id}><td style={{ fontWeight: 700 }}>{s.nome}</td><td>{s.email}</td><td>{s.celular || '—'}</td><td>{s.ultimo_acesso_em ? fmtD(s.ultimo_acesso_em) : 'Nunca'}</td><td><button className="btn-quiet" onClick={() => openStudent(s)} title="Ver acessos e progresso"><ChevronRight size={14} /></button></td></tr>)}</tbody></table></div>
    </Section>
  </>}
  {selected && <div className="modal-backdrop" onClick={() => setSelected(null)}><div className="modal" onClick={e => e.stopPropagation()} style={{ maxWidth: '520px', padding: '1.2rem' }}>
    <h3 style={{ marginBottom: '.2rem' }}>{selected.nome}</h3>
    <div className="section-note" style={{ marginBottom: '1rem' }}>{selected.email}</div>
    {loadingDetail ? <div style={{ padding: '1.5rem', textAlign: 'center' }}>A carregar acessos...</div> :
    (detail?.acesso?.length > 0 ? detail.acesso.map((ac: any, i: number) => {
      const pct = parseFloat(String(ac.progresso?.total || '0').replace('%', '')) || 0;
      return <div key={i} className="card" style={{ boxShadow: 'none', background: 'hsl(var(--secondary) / .6)', padding: '.8rem', marginBottom: '.6rem' }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}><strong style={{ fontSize: '.82rem' }}>{ac.produto?.nome}</strong><Status tone={ac.encerrado ? 'warn' : 'good'}>{ac.encerrado ? 'Encerrado' : (ac.duracao_tipo === 'vitalicio' ? 'Vitalício' : 'Ativo')}</Status></div>
        <div style={{ fontSize: '.7rem', color: 'hsl(var(--muted-foreground))', marginTop: '.3rem' }}>Início: {fmtD(ac.comecou_em)}{ac.encerra_em ? ` · Fim: ${fmtD(ac.encerra_em)}` : ''}</div>
        {ac.progresso && <div style={{ marginTop: '.5rem' }}><div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '.7rem' }}><span>Progresso</span><strong>{ac.progresso.total}</strong></div><div style={{ height: 6, borderRadius: 3, background: 'hsl(var(--muted))', marginTop: '.25rem' }}><div style={{ width: `${Math.min(pct, 100)}%`, height: '100%', borderRadius: 3, background: 'hsl(var(--accent))' }} /></div><div style={{ fontSize: '.68rem', color: 'hsl(var(--muted-foreground))', marginTop: '.25rem' }}>{ac.progresso.completas ?? 0} de {(ac.progresso.completas ?? 0) + 0} aulas completas · {ac.progresso.assistidas ?? 0} assistidas</div></div>}
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
  Cademi: [
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
  Cademi: '/api/v1/cademi/health',
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
      fields.forEach(f => { init[f.key] = (settingsData.data as any)[f.key] || ''; });
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
    <div className="section-note" style={{ marginBottom: '1rem' }}>{fields.length > 0 ? 'Credenciais guardadas no servidor (têm prioridade sobre o Render).' : 'Sem opções configuráveis de momento.'}</div>
    {fields.map(f => <div key={f.key} style={{ marginBottom: '.6rem' }}><label className="label">{f.label}</label>
      <input className="input" type={f.type || 'text'} placeholder={f.placeholder || ''} value={form[f.key] || ''} onChange={e => setForm({ ...form, [f.key]: e.target.value })} style={{ width: '100%' }} /></div>)}
    {testMsg && <div style={{ fontSize: '.75rem', marginBottom: '.6rem', color: testMsg.startsWith('OK') ? 'hsl(155 41% 35%)' : 'hsl(0 70% 50%)' }}>{testMsg}</div>}
    {saveMsg && <div style={{ fontSize: '.75rem', marginBottom: '.6rem' }}>{saveMsg}</div>}
    <div style={{ display: 'flex', gap: '.5rem', marginTop: '.4rem' }}>
      <button className="btn-secondary" onClick={onClose} style={{ flex: 1 }}>Fechar</button>
      {INTEGRATION_HEALTH_URL[name] && <button className="btn-secondary" onClick={test} disabled={testing} style={{ flex: 1 }}>{testing ? 'A testar...' : 'Testar ligação'}</button>}
      {fields.length > 0 && <button className="btn-primary" onClick={save} disabled={saveMut.isPending} style={{ flex: 1 }}><Check size={14} /> Guardar</button>}
    </div>
  </div></div>;
}

function AutomationsPage() {
  const { data, refetch } = useListAutomations({ query: { refetchInterval: 30000 } });
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
  const { data, refetch } = useListUsersAll({ query: { refetchInterval: 30000 } });
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
      <button className="btn-primary" onClick={invite} disabled={inviting} style={{ flex: 1 }}><Check size={14} /> {inviting ? 'A criar...' : 'Criar acesso'}</button>
    </div>
  </div></div>}</>;
}
function AuditPage() {
  const { data } = useListAuditLogs(undefined, { refetchInterval: 30000 });
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
  const { isAuthenticated } = useAuth();
  const [, setLocation] = useLocation();
  useEffect(() => {
    if (!isAuthenticated) {
      setLocation('/login');
    }
  }, [isAuthenticated, setLocation]);
  if (!isAuthenticated) return null;
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

  return <><PageHeader eyebrow="Controlo de Acesso · Solve Access" title="Acesso Físico" subtitle={`Solve Access: ${isConnected ? 'Conectado' : 'Desconectado'} · ${solveHealth.data?.source ?? '—'}`} action={<div style={{ display: 'flex', gap: '.45rem' }}><Status tone={connected ? 'live' : 'danger'}>{connected ? '● Live' : '○ Offline'}</Status><button className="btn-secondary" onClick={syncAccess} disabled={syncingAccess}><RefreshCw size={14} className={syncingAccess ? 'animate-spin' : ''} /> {syncingAccess ? 'A sincronizar...' : 'Sincronizar'}</button></div>} />
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
      <Section title="Terminal" note={terminals?.nome_terminal || 'A ligar...'}>
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
              {unlockMutation.isPending ? 'A abrir...' : 'Liberar Entrada'}
            </button>
            <button className="btn-primary" onClick={() => handleUnlock('saida')} disabled={unlockMutation.isPending} style={{ flex: 1 }}>
              {unlockMutation.isPending ? 'A abrir...' : 'Liberar Saída'}
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
  const leadsQuery = useListLeads(undefined, { query: { refetchInterval: 30000 } });
  const customersQuery = useListCustomersManual();
  const auditQuery = useListAuditLogs(undefined, { refetchInterval: 60000 });
  const auditCount = auditQuery.data?.total ?? auditQuery.data?.data?.length ?? 0;

  const leads = useMemo(() => {
    return (leadsQuery.data?.data ?? []).map(mapApiLead);
  }, [leadsQuery.data]);
  const reloadLeads = () => { leadsQuery.refetch(); };

  const customers = useMemo(() => {
    return (customersQuery.data?.data ?? []).map(mapApiCustomer);
  }, [customersQuery.data]);

  return <AppShell userName={userName} auditCount={auditCount}><Switch><Route path="/admin" component={() => <Dashboard leads={leads} customers={customers} userName={userName} />} /><Route path="/admin/leads" component={() => <LeadsPage leads={leads} userName={userName} onChanged={reloadLeads} />} /><Route path="/admin/pipeline" component={() => <PipelinePage leads={leads} userName={userName} onChanged={reloadLeads} />} /><Route path="/admin/clientes/:id" component={() => <CustomerDetail customers={customers} onChanged={() => customersQuery.refetch()} />} /><Route path="/admin/clientes" component={() => <CustomersPage customers={customers} loading={customersQuery.isLoading} onChanged={reloadLeads} />} /><Route path="/admin/planos" component={PlansPage} /><Route path="/admin/pagamentos" component={PaymentsPage} /><Route path="/admin/integracoes" component={IntegrationsPage} /><Route path="/admin/academia" component={AcademiaPage} /><Route path="/admin/automacoes" component={AutomationsPage} /><Route path="/admin/api-webhooks" component={ApiPage} /><Route path="/admin/utilizadores" component={UsersPage} /><Route path="/admin/auditoria" component={AuditPage} /><Route path="/admin/definicoes" component={SettingsPage} /><Route path="/admin/acesso-fisico" component={AccessPage} /><Route component={() => <EmptyState title="Página não encontrada" text="O endereço solicitado não existe neste espaço." action={<Link href="/admin" className="btn-primary">Voltar ao dashboard</Link>} />} /></Switch></AppShell>;
}
function LandingPage() {
  return (
    <LandingLayout>
      <Landing />
    </LandingLayout>
  );
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
              {/* Landing pages */}
              <Route path="/login" component={LandingLoginPage} />
              <Route path="/" component={LandingPage} />
              <Route path="/fit-motivacao" component={() => <LandingSubPage><FitMotivacao /></LandingSubPage>} />
              <Route path="/formacao" component={() => <LandingSubPage><Formacao /></LandingSubPage>} />
              <Route path="/store" component={() => <LandingSubPage><Store /></LandingSubPage>} />
              <Route path="/store/:id" component={() => <LandingSubPage><ProductDetail /></LandingSubPage>} />
              <Route path="/fit-workout" component={() => <LandingSubPage><FitWorkout /></LandingSubPage>} />
              <Route path="/fit-studio" component={() => <LandingSubPage><FitStudio /></LandingSubPage>} />
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




