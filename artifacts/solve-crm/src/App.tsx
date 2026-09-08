import { useEffect, useMemo, useState, type ReactNode } from 'react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { ErrorBoundary } from '@/components/error-boundary';
import { Toaster } from '@/components/ui/toaster';
import { TooltipProvider } from '@/components/ui/tooltip';
import {
  Activity, AlertTriangle, ArrowDownRight, ArrowUpRight, Bell, BookOpen, Boxes,
  BriefcaseBusiness, Building2, Check, CheckCircle2, ChevronDown, ChevronRight,
  CircleDollarSign, Clock3, Code2, Command, CreditCard, Database, Edit3, Eye,
  FileClock, FileKey2, Filter, HeartPulse, History, KeyRound, LayoutDashboard,
  LifeBuoy, Link2, ListFilter, LockKeyhole, Menu, MoreHorizontal, Package,
  Pause, Play, Plus, RefreshCw, Search, Settings, ShieldCheck, SlidersHorizontal,
  Sparkles, Target, ToggleLeft, ToggleRight, Trash2, TrendingUp, UserRound,
  Users, WalletCards, Webhook, X, Zap
} from 'lucide-react';
import { Link, Route, Switch, useLocation, useParams, Router as WouterRouter } from 'wouter';
import { useAuth } from '@/hooks/use-auth';
import { LoginPage } from '@/pages/login';
import '@/lib/api';
import { useListAutomations, useToggleAutomation, useDeleteAutomation, useListAuditLogs, useGetSettings, useUpdateSettings, useListUsersAll, useToggleUser, useAccessStats, useAccessLogs, useSolveAccessDashboard, useSolveAccessTerminals, useSolveAccessHealth, useUnlockTurnstile, useSolveAccessStream } from '@/hooks/use-api';
import {
  useListLeads,
  useListCustomers,
  useGetDashboardStats,
  useGetDashboardCharts,
  useListPlans,
  useListPayments,
  useListIntegrations,
  useListUsers,
  useCreateLead,
  useUpdateLead,
  useCreateCustomer,
  useListWebhooks,
} from '@workspace/api-client-react';
import type { Lead as ApiLead, Customer as ApiCustomer, Plan as ApiPlan, Payment as ApiPayment, Integration as ApiIntegration, User as ApiUser } from '@workspace/api-client-react';

const queryClient = new QueryClient();

type Lead = { id: string; name: string; company: string; source: string; status: string; owner: string; value: number; last: string; email: string };
type Customer = { id: string; name: string; company: string; plan: string; state: string; joined: string; expires: string; email: string; phone: string };

function mapApiLead(l: ApiLead): Lead {
  return {
    id: l.id ?? '',
    name: l.name ?? '',
    company: l.company ?? '',
    source: l.source ?? '',
    status: l.status ?? '',
    owner: l.ownerId ?? '',
    value: l.estimatedValue ?? 0,
    last: l.updatedAt ?? '',
    email: l.email ?? '',
  };
}

function mapApiCustomer(c: ApiCustomer): Customer {
  const formatDate = (d: string | null) => {
    if (!d) return '';
    try { return new Date(d).toLocaleDateString('pt-AO', { day: '2-digit', month: 'short', year: 'numeric' }); } catch { return d; }
  };
  return {
    id: c.code ?? c.id ?? '',
    name: c.name ?? '',
    company: c.company ?? '',
    plan: (c as any).planName ?? '',
    state: c.state === 'activo' ? 'Activo' : c.state === 'inactivo' ? 'Inactivo' : c.state === 'em_atraso' ? 'Em atraso' : c.state === 'suspenso' ? 'Suspenso' : c.state ?? '',
    joined: formatDate(c.createdAt),
    expires: formatDate((c as any).subscriptionEnd ?? null),
    email: c.email ?? '',
    phone: c.phone ?? '',
  };
}

const navGroups = [
  { label: 'Visão geral', items: [{ href: '/', label: 'Dashboard', icon: LayoutDashboard }] },
  { label: 'Operação comercial', items: [{ href: '/leads', label: 'Leads', icon: Users }, { href: '/pipeline', label: 'Pipeline', icon: Target }, { href: '/clientes', label: 'Clientes', icon: Building2 }] },
  { label: 'Receita e acesso', items: [{ href: '/planos', label: 'Planos', icon: Package }, { href: '/pagamentos', label: 'Pagamentos', icon: WalletCards }] },
  { label: 'Ecossistema', items: [{ href: '/integracoes', label: 'Integrações', icon: Link2 }, { href: '/automacoes', label: 'Automações', icon: Zap }, { href: '/api-webhooks', label: 'API & Webhooks', icon: Code2 }] },
  { label: 'Controlo de Acesso', items: [{ href: '/acesso-fisico', label: 'Solve Access', icon: LockKeyhole }] },
  { label: 'Governação', items: [{ href: '/utilizadores', label: 'Utilizadores', icon: UserRound }, { href: '/auditoria', label: 'Auditoria', icon: ShieldCheck }, { href: '/definicoes', label: 'Definições', icon: Settings }] },
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
function Metric({ label, value, note, trend, negative = false }: { label: string; value: string; note: string; trend?: string; negative?: boolean }) {
  return <div className="card metric"><div className="eyebrow">{label}</div><div className="metric-value">{value}</div><div className="metric-note" style={{ color: trend ? (negative ? 'hsl(3 67% 45%)' : 'hsl(155 41% 35%)') : undefined }}>{trend && (negative ? <ArrowDownRight size={12} style={{ verticalAlign: 'middle' }} /> : <ArrowUpRight size={12} style={{ verticalAlign: 'middle' }} />)} {trend}{trend && ' · '}{note}</div></div>;
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

function Sidebar({ open, onClose }: { open: boolean; onClose: () => void }) {
  const [location] = useLocation();
  return <><aside className={`sidebar ${open ? 'open' : ''}`} style={{ width: 238, minHeight: '100dvh', padding: '1.25rem .8rem', position: 'fixed', inset: '0 auto 0 0', zIndex: 40, overflowY: 'auto' }}>
    <div style={{ display: 'flex', alignItems: 'center', gap: '.65rem', padding: '.15rem .55rem 1.4rem' }}><div style={{ width: 31, height: 31, borderRadius: 8, display: 'grid', placeItems: 'center', background: 'hsl(var(--sidebar-primary))', color: 'hsl(var(--sidebar-primary-foreground))', fontWeight: 800, letterSpacing: '-.08em' }}>SC</div><div><div style={{ fontWeight: 700, color: 'white', fontSize: '.86rem' }}>Solve Corporate</div><div style={{ fontSize: '.6rem', color: 'hsl(var(--sidebar-foreground))', letterSpacing: '.08em', textTransform: 'uppercase' }}>Command center</div></div></div>
    <div style={{ display: 'grid', gap: '1.15rem' }}>{navGroups.map(group => <div key={group.label}><div className="eyebrow" style={{ color: 'hsl(var(--sidebar-foreground) / .62)', padding: '0 .7rem .42rem', fontSize: '.57rem' }}>{group.label}</div><nav style={{ display: 'grid', gap: '.15rem' }}>{group.items.map(item => { const active = item.href === '/' ? location === '/' : location.startsWith(item.href); const I = item.icon; return <Link key={item.href} href={item.href} className={`sidebar-link ${active ? 'active' : ''}`} data-testid={`link-nav-${item.label.toLowerCase()}`} onClick={onClose}><I size={15} strokeWidth={active ? 2.4 : 1.8} /><span>{item.label}</span>{item.label === 'Auditoria' && <span style={{ marginLeft: 'auto', fontSize: '.6rem', padding: '.12rem .35rem', borderRadius: 5, background: 'hsl(var(--sidebar-primary) / .2)', color: 'hsl(var(--sidebar-primary))' }}>3</span>}</Link>; })}</nav></div>)}</div>
  </aside><div className="mobile-overlay" style={{ display: 'none' }} onClick={onClose} /></>;
}
function Topbar({ onMenu }: { onMenu: () => void }) {
  const [, setLocation] = useLocation();
  const [query, setQuery] = useState('');
  const today = new Date().toLocaleDateString('pt-AO', { weekday: 'long', day: 'numeric', month: 'short', year: 'numeric' });
  return <header className="topbar" style={{ height: 65, borderBottom: '1px solid hsl(var(--border))', background: 'hsl(var(--card) / .84)', backdropFilter: 'blur(10px)', display: 'flex', alignItems: 'center', gap: '1rem', padding: '0 1.7rem', position: 'sticky', top: 0, zIndex: 20 }}><button className="mobile-only btn-quiet" onClick={onMenu} data-testid="button-open-menu"><Menu size={19} /></button><div style={{ position: 'relative', maxWidth: 410, flex: 1 }}><Search size={15} style={{ position: 'absolute', left: 11, top: 10, color: 'hsl(var(--muted-foreground))' }} /><input aria-label="Pesquisar no CRM" data-testid="input-global-search" className="input" style={{ paddingLeft: 34, background: 'hsl(var(--secondary) / .65)', borderColor: 'transparent' }} placeholder="Pesquisar leads, clientes, transações..." value={query} onChange={(e) => setQuery(e.target.value)} onKeyDown={(e) => { if (e.key === 'Enter' && query) setLocation(`/leads?search=${query}`); }} /></div><div style={{ marginLeft: 'auto', display: 'flex', alignItems: 'center', gap: '.35rem' }}><span className="desktop-only" style={{ color: 'hsl(var(--muted-foreground))', fontSize: '.7rem', marginRight: '.45rem' }}>{today}</span><IconButton label="central de notificações"><Bell size={16} /></IconButton><div className="desktop-only" style={{ height: 22, width: 1, background: 'hsl(var(--border))', margin: '0 .25rem' }} /><div className="desktop-only" style={{ display: 'flex', alignItems: 'center', gap: '.45rem', fontSize: '.75rem', fontWeight: 600 }}><div style={{ width: 25, height: 25, display: 'grid', placeItems: 'center', borderRadius: '50%', background: 'hsl(var(--primary))', color: 'white', fontSize: '.62rem' }}>BS</div>Bruno Samora</div></div></header>;
}

function Dashboard({ leads, customers }: { leads: Lead[]; customers: Customer[] }) {
  const statsQuery = useGetDashboardStats({ query: { refetchInterval: 30000 } });
  const chartsQuery = useGetDashboardCharts({ query: { refetchInterval: 60000 } });
  const accessStats = useAccessStats();
  const overview = statsQuery.data?.data?.overview;
  const integrations = statsQuery.data?.data?.integrations ?? [];
  const revenueData = chartsQuery.data?.data?.revenueByMonth ?? [];
  const access = accessStats.data?.data;
  return <><PageHeader eyebrow="Operação · Hoje" title="Bom dia, Bruno." subtitle="A operação está estável. Eis o que merece a sua atenção." action={<button className="btn-primary" data-testid="button-dashboard-action"><Command size={14} /> Abrir comando <span className="mono" style={{ fontSize: '.65rem', opacity: .65 }}>⌘ K</span></button>} /><div className="metric-grid" style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: '.8rem', marginBottom: '.8rem' }}><Metric label="Receita recorrente" value={overview?.revenueLast30Days ? money(overview.revenueLast30Days) : '0 Kz'} trend="+8,4%" note="vs. mês anterior" /><Metric label="Pipeline aberto" value={overview?.totalLeads ? `${overview.totalLeads} leads` : '0 leads'} trend="+14,2%" note={`${overview?.totalLeads ?? 0} oportunidades`} /><Metric label="Cobranças pendentes" value={overview?.pendingPayments ? `${overview.pendingPayments} transações` : '0 transações'} note={`${overview?.latePayments ?? 0} transações em atenção`} negative /><Metric label="Clientes activos" value={overview?.activeCustomers?.toString() ?? '0'} trend={`+${overview?.totalCustomers ?? 0}`} note="nos últimos 30 dias" /></div><div className="content-grid" style={{ display: 'grid', gridTemplateColumns: '1.35fr .85fr', gap: '.8rem', marginBottom: '.8rem' }}><Section title="Ritmo comercial" note="Valor criado por semana" action={<button className="btn-quiet">Este mês <ChevronDown size={13} /></button>}><div style={{ height: 165, display: 'flex', alignItems: 'end', gap: 'clamp(.4rem, 2.4vw, 1rem)', padding: '1rem .2rem .2rem', borderBottom: '1px solid hsl(var(--border))' }}>{(revenueData.length > 0 ? revenueData : []).map((d, i, arr) => { const max = Math.max(...arr.map(x => x.value ?? 0), 1); const pct = ((d.value ?? 0) / max) * 100; return <div key={i} style={{ flex: 1, height: `${Math.max(pct, 5)}%`, position: 'relative', minWidth: 7, background: i === arr.length - 1 ? 'hsl(var(--accent))' : 'hsl(var(--chart-2) / .72)', borderRadius: '3px 3px 0 0' }} title={`${d.value ?? 0} Kz`} />; })}</div><div style={{ display: 'flex', justifyContent: 'space-between', color: 'hsl(var(--muted-foreground))', fontSize: '.65rem', paddingTop: '.45rem' }}><span>01 Jun</span><span>08 Jun</span><span>15 Jun</span><span>Hoje</span></div></Section><Section title="Saúde do ecossistema" note="Última verificação há 4 min"><div style={{ display: 'grid', gap: '.72rem' }}>{integrations.length > 0 ? integrations.map((ig, i) => <div key={i} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', fontSize: '.72rem' }}><div style={{ display: 'flex', alignItems: 'center', gap: '.5rem' }}><div style={{ width: 7, height: 7, borderRadius: '50%', background: ig.status === 'operacional' ? 'hsl(155 41% 43%)' : 'hsl(38 80% 50%)' }} />{ig.name}</div><Status tone={ig.status === 'operacional' ? 'good' : 'warn'}>{ig.status === 'operacional' ? 'Operacional' : ig.status}</Status></div>) : [['OVG', 'Operacional', 'good'], ['Pay4All', 'Operacional', 'good'], ['Cademi', 'Atenção', 'warn'], ['WhatsApp', 'Operacional', 'good'], ['Website', 'Operacional', 'good']].map(([name, state, tone]) => <div key={name} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', fontSize: '.72rem' }}><div style={{ display: 'flex', alignItems: 'center', gap: '.5rem' }}><div style={{ width: 7, height: 7, borderRadius: '50%', background: tone === 'good' ? 'hsl(155 41% 43%)' : 'hsl(38 80% 50%)' }} />{name}</div><Status tone={tone as 'good' | 'warn'}>{state}</Status></div>)}</div></Section></div><div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '.8rem' }}><Section title="Leads recentes" note="Últimas captações"><div style={{ display: 'grid', gap: '.5rem' }}>{(leads.length > 0 ? leads.slice(0, 5) : []).map(l => <div key={l.id} style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '.5rem 0', borderBottom: '1px solid hsl(var(--border))', fontSize: '.73rem' }}><div><div style={{ fontWeight: 600 }}>{l.name}</div><div style={{ color: 'hsl(var(--muted-foreground))' }}>{l.company}</div></div><Status tone={l.status === 'Convertido' ? 'good' : l.status === 'Perdido' ? 'danger' : 'neutral'}>{l.status}</Status></div>)}</div></Section><Section title="Clientes activos" note="Estado das contas"><div style={{ display: 'grid', gap: '.5rem' }}>{(customers.length > 0 ? customers.slice(0, 5) : []).map(c => <div key={c.id} style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '.5rem 0', borderBottom: '1px solid hsl(var(--border))', fontSize: '.73rem' }}><div><div style={{ fontWeight: 600 }}>{c.name}</div><div style={{ color: 'hsl(var(--muted-foreground))' }}>{c.company}</div></div><Status tone={c.state === 'Activo' ? 'good' : 'warn'}>{c.state}</Status></div>)}</div></Section></div><div className="content-grid" style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '.8rem', marginBottom: '.8rem' }}>
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

function LeadsPage({ leads, setLeads }: { leads: Lead[]; setLeads: (x: Lead[]) => void }) {
  const [q, setQ] = useState(''); const [status, setStatus] = useState('Todos'); const [source, setSource] = useState('Todas'); const [editing, setEditing] = useState<Lead | null>(null); const [open, setOpen] = useState(false);
  const filtered = leads.filter(l => (l.name + l.company + l.email).toLowerCase().includes(q.toLowerCase()) && (status === 'Todos' || l.status === status) && (source === 'Todas' || l.source === source));
  return <><PageHeader eyebrow="Comercial · Captação" title="Leads" subtitle={`${leads.length} registos no espaço de trabalho`} action={<button className="btn-primary" onClick={() => { setEditing(null); setOpen(true); }} data-testid="button-add-lead"><Plus size={15} /> Novo lead</button>} /><div className="card" style={{ padding: '.7rem', marginBottom: '.8rem', display: 'flex', gap: '.55rem', alignItems: 'center', flexWrap: 'wrap' }}><div style={{ position: 'relative', flex: '1 1 230px' }}><Search size={14} style={{ position: 'absolute', left: 10, top: 10, color: 'hsl(var(--muted-foreground))' }} /><input data-testid="input-search-leads" className="input" style={{ paddingLeft: 31 }} placeholder="Pesquisar por nome, empresa ou email" value={q} onChange={e => setQ(e.target.value)} /></div><select data-testid="select-lead-status" className="select" value={status} onChange={e => setStatus(e.target.value)}><option>Todos</option>{['Novo Lead', 'Qualificação', 'Proposta', 'Negociação', 'Convertido', 'Perdido'].map(v => <option key={v}>{v}</option>)}</select><select data-testid="select-lead-source" className="select" value={source} onChange={e => setSource(e.target.value)}><option>Todas</option>{['Website', 'WhatsApp', 'Indicação', 'OVG', 'LinkedIn'].map(v => <option key={v}>{v}</option>)}</select><button className="btn-secondary" data-testid="button-more-filters"><SlidersHorizontal size={14} /> Filtros <span style={{ background: 'hsl(var(--accent))', color: 'hsl(var(--accent-foreground))', borderRadius: 99, padding: '.1rem .3rem', fontSize: '.6rem' }}>2</span></button></div><Section title="Todos os leads" note={`${filtered.length} resultados`} action={<button className="btn-quiet"><Filter size={13} /> Guardar vista</button>}><div className="table-wrap"><table className="data-table"><thead><tr><th>Lead</th><th>Origem</th><th>Etapa</th><th>Responsável</th><th>Valor estimado</th><th>Última actividade</th><th /></tr></thead><tbody>{filtered.map(l => <tr key={l.id} data-testid={`row-lead-${l.id}`}><td><div style={{ display: 'flex', alignItems: 'center', gap: '.6rem' }}><div style={{ width: 30, height: 30, borderRadius: 7, display: 'grid', placeItems: 'center', background: 'hsl(var(--secondary))', fontSize: '.64rem', fontWeight: 700 }}>{l.name.slice(0, 2).toUpperCase()}</div><div><div style={{ fontWeight: 700 }}>{l.name}</div><div style={{ fontSize: '.67rem', color: 'hsl(var(--muted-foreground))' }}>{l.company}</div></div></div></td><td>{l.source}</td><td><Status tone={l.status === 'Convertido' ? 'good' : l.status === 'Perdido' ? 'danger' : 'neutral'}>{l.status}</Status></td><td>{l.owner}</td><td className="mono" style={{ fontSize: '.68rem' }}>{money(l.value)}</td><td style={{ color: 'hsl(var(--muted-foreground))' }}>{l.last}</td><td><IconButton label="editar lead" onClick={() => { setEditing(l); setOpen(true); }}><Edit3 size={14} /></IconButton></td></tr>)}</tbody></table></div></Section>{open && <LeadModal initial={editing} onClose={() => setOpen(false)} onSave={(x) => { setLeads(editing ? leads.map(l => l.id === x.id ? x : l) : [...leads, x]); setOpen(false); }} />}</>;
}
function LeadModal({ initial, onClose, onSave }: { initial: Lead | null; onClose: () => void; onSave: (x: Lead) => void }) {
  const [name, setName] = useState(initial?.name ?? ''); const [company, setCompany] = useState(initial?.company ?? ''); const [email, setEmail] = useState(initial?.email ?? ''); const [source, setSource] = useState(initial?.source ?? 'Website');
  return <Modal title={initial ? 'Editar lead' : 'Adicionar lead'} subtitle="Registo comercial interno" onClose={onClose}><div className="form-grid"><FormField label="Nome completo" value={name} onChange={setName} placeholder="Ex.: Joana Manuel" /><FormField label="Empresa" value={company} onChange={setCompany} placeholder="Nome da organização" /><FormField label="Email profissional" value={email} onChange={setEmail} type="email" /><label><span className="form-label">Origem</span><select className="select" style={{ width: '100%' }} value={source} onChange={e => setSource(e.target.value)}>{['Website', 'WhatsApp', 'Indicação', 'OVG', 'LinkedIn'].map(x => <option key={x}>{x}</option>)}</select></label><div style={{ display: 'flex', justifyContent: 'flex-end', gap: '.5rem', marginTop: '.35rem' }}><button className="btn-secondary" onClick={onClose}>Cancelar</button><button className="btn-primary" disabled={!name || !company} onClick={() => onSave({ id: initial?.id ?? `LD-${Math.floor(24000 + Math.random() * 900)}`, name, company, email, source, status: initial?.status ?? 'Novo Lead', owner: initial?.owner ?? 'Bruno Samora', value: initial?.value ?? 0, last: 'Agora' })}><Check size={14} /> Guardar lead</button></div></div></Modal>;
}

function PipelinePage({ leads, setLeads }: { leads: Lead[]; setLeads: (x: Lead[]) => void }) {
  const stages = ['Novo Lead', 'Qualificação', 'Proposta', 'Negociação', 'Convertido', 'Perdido']; const [selected, setSelected] = useState<Lead | null>(null);
  const move = (lead: Lead, stage: string) => setLeads(leads.map(x => x.id === lead.id ? { ...x, status: stage, last: 'Agora' } : x));
  return <><PageHeader eyebrow="Comercial · Conversão" title="Pipeline" subtitle="Acompanhe cada oportunidade até  à decisão." action={<div style={{ display: 'flex', gap: '.45rem' }}><button className="btn-secondary"><ListFilter size={14} /> Vista</button><button className="btn-primary" onClick={() => setSelected(leads[0])}><Plus size={14} /> Oportunidade</button></div>} /><div className="card" style={{ padding: '.8rem', marginBottom: '.8rem', display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: '.8rem', flexWrap: 'wrap' }}><div><span className="eyebrow">Valor total em aberto</span><div className="mono" style={{ fontWeight: 600, fontSize: '1.1rem', marginTop: '.25rem' }}>{money(leads.reduce((s, l) => s + l.value, 0))}</div></div><div style={{ display: 'flex', gap: '1.2rem', color: 'hsl(var(--muted-foreground))', fontSize: '.7rem' }}><span><strong style={{ color: 'hsl(var(--foreground))' }}>{leads.length}</strong> oportunidades</span><span><strong style={{ color: 'hsl(var(--foreground))' }}>{Math.round((leads.filter(l => l.status === 'Convertido').length / Math.max(leads.length, 1)) * 100)}%</strong> conversão</span></div></div><div style={{ display: 'grid', gridTemplateColumns: `repeat(${stages.length}, minmax(180px, 1fr))`, gap: '.65rem', overflowX: 'auto', paddingBottom: '.45rem' }}>{stages.map((stage) => { const cards = leads.filter(l => l.status === stage); return <div key={stage} style={{ minHeight: 410, background: 'hsl(var(--secondary) / .55)', border: '1px solid hsl(var(--border))', borderRadius: '.65rem', padding: '.65rem' }}><div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '.7rem' }}><div style={{ fontSize: '.7rem', fontWeight: 700 }}>{stage}</div><span style={{ width: 20, height: 20, display: 'grid', placeItems: 'center', borderRadius: 6, background: 'hsl(var(--card))', color: 'hsl(var(--muted-foreground))', fontSize: '.62rem' }}>{cards.length}</span></div><div style={{ display: 'grid', gap: '.5rem' }}>{cards.map(l => <button key={l.id} onClick={() => setSelected(l)} style={{ textAlign: 'left', padding: '.65rem', background: 'hsl(var(--card))', border: '1px solid hsl(var(--border))', borderRadius: '.5rem', cursor: 'pointer', boxShadow: 'none' }}><div style={{ fontWeight: 700, fontSize: '.74rem' }}>{l.name}</div><div style={{ fontSize: '.66rem', color: 'hsl(var(--muted-foreground))', marginTop: '.15rem' }}>{l.company}</div><div style={{ display: 'flex', justifyContent: 'space-between', marginTop: '.5rem', fontSize: '.64rem' }}><span style={{ color: 'hsl(var(--muted-foreground))' }}>{l.source}</span><span className="mono">{money(l.value)}</span></div>{stages.indexOf(stage) > 0 && stages.indexOf(stage) < stages.length - 2 && <div style={{ marginTop: '.5rem', display: 'flex', gap: '.3rem' }}>{stages.indexOf(stage) > 0 && <button className="btn-secondary" style={{ fontSize: '.62rem', padding: '.25rem .45rem' }} onClick={(e) => { e.stopPropagation(); move(l, stages[stages.indexOf(stage) - 1]); }}><ArrowDownRight size={11} /> Voltar</button>}{stages.indexOf(stage) < stages.length - 2 && <button className="btn-secondary" style={{ fontSize: '.62rem', padding: '.25rem .45rem' }} onClick={(e) => { e.stopPropagation(); move(l, stages[stages.indexOf(stage) + 1]); }}><ArrowUpRight size={11} /> Avançar</button>}</div>}</button>)}</div></div>; })}</div></>;
}

function CustomersPage({ customers }: { customers: Customer[] }) {
  const [q, setQ] = useState(''); const filtered = customers.filter(c => `${c.name} ${c.company} ${c.id}`.toLowerCase().includes(q.toLowerCase()));
  return <><PageHeader eyebrow="Receita · Relação" title="Clientes" subtitle="Registos únicos e contexto completo de cada conta." action={<button className="btn-primary"><Plus size={14} /> Novo cliente</button>} /><div className="card" style={{ padding: '.7rem', marginBottom: '.8rem', display: 'flex', gap: '.5rem' }}><div style={{ position: 'relative', maxWidth: 380, width: '100%' }}><Search size={14} style={{ position: 'absolute', left: 10, top: 10, color: 'hsl(var(--muted-foreground))' }} /><input data-testid="input-search-customers" className="input" style={{ paddingLeft: 31 }} placeholder="Pesquisar cliente ou empresa" value={q} onChange={e => setQ(e.target.value)} /></div><button className="btn-secondary"><Filter size={14} /> Estado</button></div><Section title="Directório de clientes" note={`${filtered.length} contas com registo consolidado`}><div className="table-wrap"><table className="data-table"><thead><tr><th>Cliente</th><th>Plano</th><th>Estado</th><th>Entrada</th><th>Expira</th><th>Contacto</th><th /></tr></thead><tbody>{filtered.map(c => <tr key={c.id}><td><Link href={`/clientes/${c.id}`} style={{ textDecoration: 'none', color: 'inherit', display: 'flex', alignItems: 'center', gap: '.6rem' }} data-testid={`link-customer-${c.id}`}><div style={{ width: 30, height: 30, borderRadius: 7, display: 'grid', placeItems: 'center', background: 'hsl(var(--secondary))', fontSize: '.64rem', fontWeight: 700 }}>{c.name.slice(0, 2).toUpperCase()}</div><div><div style={{ fontWeight: 700 }}>{c.name}</div><div style={{ fontSize: '.67rem', color: 'hsl(var(--muted-foreground))' }}>{c.company} · {c.id}</div></div></Link></td><td>{c.plan || '—'}</td><td><Status tone={c.state === 'Activo' ? 'good' : 'warn'}>{c.state}</Status></td><td>{c.joined}</td><td>{c.expires || '—'}</td><td><div style={{ fontSize: '.72rem' }}>{c.email}</div><div style={{ fontSize: '.65rem', color: 'hsl(var(--muted-foreground))' }}>{c.phone}</div></td><td><ChevronRight size={15} color="hsl(var(--muted-foreground))" /></td></tr>)}</tbody></table></div></Section></>;
}
function CustomerDetail({ customers }: { customers: Customer[] }) {
  const { id } = useParams<{ id: string }>(); const customer = customers.find(c => c.id === id) ?? customers[0];
  if (!customer) return <EmptyState title="Cliente não encontrado" text="O registo solicitado não foi localizado." action={<Link href="/clientes" className="btn-primary">Voltar  à lista</Link>} />;
  return <><PageHeader eyebrow="Cliente · Perfil 360º" title={customer.name} subtitle={`${customer.company} · ${customer.id}`} action={<div style={{ display: 'flex', gap: '.4rem' }}><button className="btn-secondary"><Edit3 size={14} /> Editar</button><button className="btn-primary"><MoreHorizontal size={14} /> Acções</button></div>} /><div className="content-grid" style={{ display: 'grid', gridTemplateColumns: '1.1fr .9fr', gap: '.8rem' }}><Section title="Resumo da conta" note="Fonte única de verdade"><div style={{ display: 'flex', alignItems: 'center', gap: '.75rem', marginBottom: '1rem' }}><div style={{ width: 51, height: 51, borderRadius: 12, display: 'grid', placeItems: 'center', background: 'hsl(var(--primary))', color: 'white', fontWeight: 700 }}>{customer.name.slice(0, 2).toUpperCase()}</div><div><div style={{ fontWeight: 700 }}>{customer.company}</div><div className="section-note">{customer.email} · {customer.phone}</div></div></div><div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: '.6rem' }}>{[['Plano', customer.plan || '—'], ['Estado', customer.state], ['Desde', customer.joined]].map(([l, v]) => <div key={l} style={{ padding: '.7rem', background: 'hsl(var(--secondary) / .65)', borderRadius: '.5rem' }}><div className="eyebrow">{l}</div><div style={{ fontSize: '.8rem', fontWeight: 600, marginTop: '.3rem' }}>{v}</div></div>)}</div></Section><Section title="Saúde da conta" note="Indicadores de retenção"><div style={{ display: 'grid', gap: '.9rem' }}>{[['Utilização do plano', '78%', 78], ['Pagamentos em dia', '100%', 100], ['Acessos nos últimos 30 dias', '64%', 64]].map(([l, v, p]) => <div key={l}><div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '.73rem', marginBottom: '.35rem' }}><span>{l}</span><strong>{v}</strong></div><div className="progress-track"><div className="progress-fill" style={{ width: `${p}%`, background: p === 100 ? 'hsl(155 41% 43%)' : undefined }} /></div></div>)}</div></Section></div></>;
}
function MiniList({ items }: { items: string[] }) { return <div style={{ display: 'grid', gap: '.65rem' }}>{items.map((x, i) => <div key={x} style={{ display: 'flex', alignItems: 'center', gap: '.55rem', fontSize: '.72rem', color: i === 0 ? 'hsl(var(--foreground))' : 'hsl(var(--muted-foreground))' }}><span style={{ width: 6, height: 6, borderRadius: '50%', background: i === 0 ? 'hsl(var(--chart-2))' : 'hsl(var(--border))' }} />{x}</div>)}</div>; }

function PlansPage() {
  const { data } = useListPlans();
  const apiPlans = data?.data ?? [];
  const [plans, setPlans] = useState(() =>
    apiPlans.length > 0
      ? apiPlans.map(p => ({ name: p.name ?? '', price: p.price ? money(p.price) : 'Gratuito', clients: (p as any).clientCount ?? 0, state: p.active ?? true, desc: p.description ?? 'Plano disponível' }))
      : []
  );
  return <><PageHeader eyebrow="Receita · Catálogo" title="Planos" subtitle="Catálogo comercial e estado das subscrições." action={<button className="btn-primary"><Plus size={14} /> Novo plano</button>} /><div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(280px, 1fr))', gap: '.8rem' }}>{plans.length === 0 && <div className="card" style={{ padding: '2rem', textAlign: 'center', color: 'hsl(var(--muted-foreground))' }}>Nenhum plano configurado</div>}{plans.map((p, i) => <div className="card" key={p.name} style={{ padding: '1.1rem', borderTop: i === 0 ? '3px solid hsl(var(--accent))' : undefined }}><div style={{ display: 'flex', alignItems: 'start', justifyContent: 'space-between' }}><div><div className="eyebrow">{i === 0 ? 'Mais subscrito' : `Plano 0${i + 1}`}</div><h2 style={{ fontSize: '1.05rem', marginTop: '.35rem' }}>{p.name}</h2></div><Status tone={p.state ? 'good' : 'warn'}>{p.state ? 'Activo' : 'Inactivo'}</Status></div><p className="section-note" style={{ minHeight: 33 }}>{p.desc}</p><div className="mono" style={{ fontSize: '1.2rem', margin: '1rem 0' }}>{p.price}<span style={{ fontFamily: 'var(--app-font-sans)', color: 'hsl(var(--muted-foreground))', fontSize: '.67rem' }}> / mês</span></div><div className="card" style={{ boxShadow: 'none', background: 'hsl(var(--secondary) / .6)', padding: '.6rem', display: 'flex', justifyContent: 'space-between', fontSize: '.72rem' }}><span>Subscrições</span><strong>{p.clients}</strong></div></div>)}</div></>;
}

function PaymentsPage() {
  const { data } = useListPayments({ query: { refetchInterval: 30000 } });
  const apiPayments = data?.data ?? [];
  const payments = useMemo(() =>
    apiPayments.length > 0
      ? apiPayments.map(p => ({
          id: p.code ?? p.id ?? '',
          customer: p.customerId ?? '',
          amount: p.amount ?? 0,
          method: p.method ?? '',
          state: p.status === 'confirmado' ? 'Confirmado' : p.status === 'pendente' ? 'Pendente' : p.status === 'em_atraso' ? 'Em atraso' : p.status ?? '',
          date: p.paidAt ?? p.createdAt ?? '',
        }))
      : []
  , [apiPayments]);
  const [filter, setFilter] = useState('Todas'); const [reconciled, setReconciled] = useState<string[]>([]);
  const visible = payments.filter(p => filter === 'Todas' || p.state === filter);
  return <><PageHeader eyebrow="Receita · Tesouraria" title="Pagamentos" subtitle="Monitorização de transacções e reconciliação." action={<button className="btn-secondary" onClick={() => setReconciled([])}><RefreshCw size={14} /> Sincronizar Pay4All</button>} /><div className="metric-grid" style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: '.8rem', marginBottom: '.8rem' }}><Metric label="Recebido este mês" value={money(payments.filter(p => p.state === 'Confirmado').reduce((s, p) => s + p.amount, 0))} note={`${payments.filter(p => p.state === 'Confirmado').length} transacções`} /><Metric label="Por reconciliar" value={money(payments.filter(p => p.state === 'Pendente').reduce((s, p) => s + p.amount, 0))} note={`${payments.filter(p => p.state === 'Pendente').length} transacções`} /><Metric label="Em atraso" value={money(payments.filter(p => p.state === 'Em atraso').reduce((s, p) => s + p.amount, 0))} note={`${payments.filter(p => p.state === 'Em atraso').length} cliente(s)`} negative /></div><Section title="Movimentos recentes" note={`${visible.length} transacções`} action={<select className="select" value={filter} onChange={e => setFilter(e.target.value)} data-testid="select-payment-status"><option>Todas</option><option>Confirmado</option><option>Pendente</option><option>Em atraso</option></select>}><div className="table-wrap"><table className="data-table"><thead><tr><th>Transacção</th><th>Cliente</th><th>Método</th><th>Estado</th><th>Montante</th><th>Data</th><th>Reconciliação</th></tr></thead><tbody>{visible.map(p => <tr key={p.id}><td className="mono" style={{ fontSize: '.67rem' }}>{p.id}</td><td style={{ fontWeight: 700 }}>{p.customer}</td><td>{p.method}</td><td><Status tone={p.state === 'Confirmado' ? 'good' : p.state === 'Em atraso' ? 'danger' : 'warn'}>{p.state}</Status></td><td className="mono" style={{ fontSize: '.68rem' }}>{money(p.amount)}</td><td style={{ color: 'hsl(var(--muted-foreground))' }}>{p.date}</td><td>{p.state === 'Confirmado' || reconciled.includes(p.id) ? <span style={{ color: 'hsl(155 41% 35%)', fontSize: '.7rem', display: 'inline-flex', gap: '.3rem', alignItems: 'center' }}><CheckCircle2 size={13} /> Conciliado</span> : <button className="btn-secondary" onClick={() => setReconciled([...reconciled, p.id])}>Reconciliar</button>}</td></tr>)}</tbody></table></div></Section></>;
}

const integrationsData = [{ name: 'OVG', desc: 'Origem e validação de leads', icon: BriefcaseBusiness, state: 'Operacional', sync: 'há 4 min', volume: '1.248 eventos hoje' }, { name: 'Pay4All', desc: 'Pagamentos e reconciliação', icon: CreditCard, state: 'Operacional', sync: 'há 4 min', volume: '86 transacções hoje' }, { name: 'Cademi', desc: 'Acessos e área de membros', icon: KeyRound, state: 'Atenção', sync: 'há 17 min', volume: '2 falhas a reprocessar' }, { name: 'WhatsApp', desc: 'Conversas comerciais', icon: LifeBuoy, state: 'Operacional', sync: 'há 1 min', volume: '38 mensagens hoje' }, { name: 'Website', desc: 'Formulários e canais digitais', icon: Link2, state: 'Operacional', sync: 'há 8 min', volume: '12 leads hoje' }];
function IntegrationsPage() {
  const { data } = useListIntegrations({ query: { refetchInterval: 30000 } });
  const apiIntegrations = data?.data ?? [];
  const items = useMemo(() => {
    if (apiIntegrations.length > 0) {
      const iconMap: Record<string, typeof BriefcaseBusiness> = { OVG: BriefcaseBusiness, Pay4All: CreditCard, Cademi: KeyRound, WhatsApp: LifeBuoy, Website: Link2 };
      return apiIntegrations.map(ig => ({
        name: ig.name ?? '',
        desc: ig.name ?? '',
        icon: iconMap[ig.name ?? ''] ?? Link2,
        state: ig.status === 'operacional' ? 'Operacional' : ig.status === 'atencao' ? 'Atenção' : ig.status === 'erro' ? 'Erro' : 'Inativo',
        sync: ig.lastSyncAt ?? 'Nunca',
        volume: ig.errorCount ? `${ig.errorCount} erros` : 'Operacional',
      }));
    }
    return integrationsData;
  }, [apiIntegrations]);
  return <><PageHeader eyebrow="Ecossistema · Conectividade" title="Integrações" subtitle="Estado dos canais que alimentam a operação." action={<button className="btn-secondary"><RefreshCw size={14} /> Verificar tudo</button>} /><div style={{ display: 'grid', gridTemplateColumns: 'repeat(2, minmax(0, 1fr))', gap: '.8rem' }}>{items.map(({ name, desc, icon: I, state, sync, volume }) => <div className="card" key={name} style={{ padding: '1rem' }}><div style={{ display: 'flex', gap: '.7rem', alignItems: 'flex-start' }}><div style={{ width: 37, height: 37, borderRadius: 9, display: 'grid', placeItems: 'center', background: 'hsl(var(--secondary))', color: 'hsl(var(--primary))' }}><I size={17} /></div><div style={{ flex: 1 }}><div style={{ display: 'flex', justifyContent: 'space-between', gap: '.5rem' }}><div><div style={{ fontWeight: 700, fontSize: '.85rem' }}>{name}</div><div className="section-note">{desc}</div></div><Status tone={state === 'Operacional' ? 'good' : 'warn'}>{state}</Status></div><div style={{ display: 'flex', justifyContent: 'space-between', marginTop: '1rem', fontSize: '.67rem', color: 'hsl(var(--muted-foreground))' }}><span><Clock3 size={12} style={{ verticalAlign: 'middle', marginRight: 4 }} />Sincronizado {sync}</span><span>{volume}</span></div><div style={{ display: 'flex', gap: '.45rem', marginTop: '.75rem' }}><button className="btn-secondary"><RefreshCw size={13} /> Sincronizar</button><button className="btn-quiet">Configurar <ChevronRight size={13} /></button></div></div></div></div>)}</div><Section title="Actividade de sincronização" note="Eventos mais recentes"><MiniList items={['Pay4All · 86 transacções importadas · há 4 min', 'Website · 12 leads recebidos · há 8 min', 'Cademi · 2 acessos pendentes · há 17 min']} /></Section></>;
}

function AutomationsPage() {
  const { data } = useListAutomations({ query: { refetchInterval: 30000 } });
  const toggleMut = useToggleAutomation();
  const deleteMut = useDeleteAutomation();
  const rules = data?.data ?? [];
  return <><PageHeader eyebrow="Ecossistema · Orquestração" title="Automações" subtitle="Regras orientadas a eventos, com execução auditável." action={<button className="btn-primary"><Plus size={14} /> Nova automação</button>} /><Section title="Regras activas" note={`${rules.filter((x: any) => x.active).length} de ${rules.length} activas`}><div style={{ display: 'grid', gap: '.55rem' }}>{rules.map((r: any, i: number) => <div key={r.id} className="card" style={{ boxShadow: 'none', padding: '.8rem', display: 'grid', gridTemplateColumns: '1.1fr 1fr 1fr auto', gap: '.8rem', alignItems: 'center' }}><div style={{ display: 'flex', gap: '.6rem', alignItems: 'center' }}><div style={{ width: 29, height: 29, borderRadius: 7, display: 'grid', placeItems: 'center', background: r.active ? 'hsl(var(--accent) / .25)' : 'hsl(var(--muted))', color: r.active ? 'hsl(38 60% 35%)' : 'hsl(var(--muted-foreground))' }}><Zap size={14} /></div><div><div style={{ fontWeight: 700, fontSize: '.75rem' }}>{r.name}</div><div className="section-note">Regra {String(i + 1).padStart(2, '0')}</div></div></div><div><div className="eyebrow">Quando</div><div style={{ fontSize: '.71rem', marginTop: '.25rem' }}>{r.trigger}</div></div><div><div className="eyebrow">Executar</div><div style={{ fontSize: '.71rem', marginTop: '.25rem' }}>{r.action}</div></div><div style={{ textAlign: 'right' }}><button className="btn-quiet" onClick={() => toggleMut.mutate(r.id)}>{r.active ? <ToggleRight size={18} color="hsl(155 41% 43%)" /> : <ToggleLeft size={18} />} {r.active ? 'Activo' : 'Inactivo'}</button><button className="btn-quiet" onClick={() => { if (confirm('Eliminar automação?')) deleteMut.mutate(r.id); }}><Trash2 size={14} /></button></div></div>)}</div></Section></>;
}
function ApiPage() {
  const [copied, setCopied] = useState(false); const endpoint = 'http://localhost:3000/api';
  return <><PageHeader eyebrow="Ecossistema · Desenvolvimento" title="API & Webhooks" subtitle="Visibilidade operacional sobre a camada de integração." action={<button className="btn-secondary" onClick={() => { navigator.clipboard?.writeText(endpoint); setCopied(true); }}><Code2 size={14} /> {copied ? 'Copiado' : 'Copiar endpoint'}</button>} /><div className="content-grid" style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '.8rem', marginBottom: '.8rem' }}><Section title="Endpoint base" note="Autenticação por chave de aplicação"><div className="card" style={{ boxShadow: 'none', background: 'hsl(var(--secondary) / .7)', padding: '.8rem', display: 'flex', justifyContent: 'space-between', gap: '.6rem', alignItems: 'center' }}><code className="mono" style={{ fontSize: '.7rem', overflow: 'hidden', textOverflow: 'ellipsis' }}>{endpoint}</code><IconButton label="copiar endpoint" onClick={() => setCopied(true)}><FileKey2 size={14} /></IconButton></div></Section></div></>;
}

function UsersPage() {
  const { data } = useListUsersAll({ query: { refetchInterval: 30000 } });
  const toggleMut = useToggleUser();
  const users = data?.data ?? [];
  const roles = ['Administrador', 'Gestor', 'Comercial', 'Financeiro', 'Operacional'];
  const permissions = ['Ver dashboard', 'Gerir leads', 'Gerir clientes', 'Ver pagamentos', 'Editar planos', 'Executar integrações', 'Gerir utilizadores', 'Ver auditoria'];
  const [active, setActive] = useState('Administrador');
  return <><PageHeader eyebrow="Governação · Acesso" title="Utilizadores" subtitle="Equipa, papéis e permissões granulares." action={<button className="btn-primary"><Plus size={14} /> Convidar utilizador</button>} /><div className="content-grid" style={{ display: 'grid', gridTemplateColumns: '.8fr 1.5fr', gap: '.8rem' }}><Section title="Equipa" note={`${users.length} utilizadores`}><div style={{ display: 'grid', gap: '.45rem' }}>{users.map((u: any) => <button key={u.id} className="btn-quiet" style={{ justifyContent: 'flex-start', padding: '.65rem', background: active === u.role ? 'hsl(var(--secondary))' : undefined }} onClick={() => setActive(u.role)}><div style={{ width: 29, height: 29, borderRadius: '50%', display: 'grid', placeItems: 'center', background: 'hsl(var(--primary))', color: 'white', fontSize: '.62rem', fontWeight: 700 }}>{u.name.split(' ').map((n: string) => n[0]).join('').slice(0, 2).toUpperCase()}</div><div style={{ textAlign: 'left' }}><div style={{ fontWeight: 700, fontSize: '.73rem' }}>{u.name}</div><div style={{ fontSize: '.65rem', color: 'hsl(var(--muted-foreground))' }}>{u.role}</div></div><span style={{ marginLeft: 'auto' }}><Status tone={u.active ? 'good' : 'warn'}>{u.active ? 'Activo' : 'Inactivo'}</Status></span></button>)}</div></Section><Section title={`Matriz de permissões · ${active}`} note="Acesso efectivo deste papel"><div className="table-wrap"><table className="data-table"><thead><tr><th>Permissão</th>{roles.slice(0, 1).map(r => <th key={r}>{r}</th>)}</tr></thead><tbody>{permissions.map((p, i) => <tr key={p}><td>{p}</td><td>{i === 6 || i === 7 || active === 'Administrador' || (active === 'Financeiro' && i === 3) ? <CheckCircle2 size={16} color="hsl(155 41% 43%)" /> : <span style={{ color: 'hsl(var(--muted-foreground))' }}>—</span>}</td></tr>)}</tbody></table></div></Section></div></>;
}
function AuditPage() {
  const { data } = useListAuditLogs({ query: { refetchInterval: 30000 } });
  const logs = data?.data ?? [];
  const [tab, setTab] = useState('Eventos');
  return <><PageHeader eyebrow="Governação · Controlo" title="Auditoria" subtitle="Registo imutável de actividade, saúde e recuperação." action={<button className="btn-secondary"><Database size={14} /> Exportar registo</button>} /><div style={{ display: 'flex', gap: '.2rem', borderBottom: '1px solid hsl(var(--border))', marginBottom: '.8rem' }}>{['Eventos', 'Backups', 'Erros e reprocessamento'].map(x => <button key={x} className="btn-quiet" style={{ borderBottom: tab === x ? '2px solid hsl(var(--accent))' : '2px solid transparent', borderRadius: 0, color: tab === x ? 'hsl(var(--foreground))' : undefined }} onClick={() => setTab(x)}>{x}</button>)}</div>{tab === 'Eventos' && <Section title="Actividade registada" note={`${logs.length} eventos`}><div className="table-wrap"><table className="data-table"><thead><tr><th>Actor</th><th>Evento</th><th>Referência</th><th>Quando</th><th>Estado</th></tr></thead><tbody>{logs.map((log: any) => <tr key={log.id}><td style={{ fontWeight: 600 }}>{log.actor}</td><td>{log.action}</td><td className="mono" style={{ fontSize: '.65rem', color: 'hsl(var(--muted-foreground))' }}>{log.entityId || log.entity || '—'}</td><td style={{ color: 'hsl(var(--muted-foreground))' }}>{new Date(log.createdAt).toLocaleString('pt-AO')}</td><td><Status tone="good">Registado</Status></td></tr>)}{logs.length === 0 && <tr><td colSpan={5} style={{ textAlign: 'center', color: 'hsl(var(--muted-foreground))', padding: '2rem' }}>Sem eventos de auditoria registados</td></tr>}</tbody></table></div></Section>}{tab === 'Backups' && <Section title="Backups automáticos" note="Política de retenção: 90 dias"><div style={{ display: 'grid', gap: '.6rem' }}>{['Backup incremental · hoje, 06:00', 'Backup incremental · ontem, 06:00', 'Backup completo · 16 Jun, 06:00'].map((x, i) => <div key={x} className="card" style={{ boxShadow: 'none', padding: '.75rem', display: 'flex', justifyContent: 'space-between' }}><span style={{ fontSize: '.75rem' }}><Database size={14} style={{ verticalAlign: 'middle', marginRight: 8 }} />{x}</span><Status tone="good">{i === 2 ? 'Completo' : 'Concluído'}</Status></div>)}</div></Section>}{tab === 'Erros e reprocessamento' && <Section title="Erros recentes" note="Integrações com falha"><div style={{ display: 'grid', gap: '.5rem' }}>{logs.filter((l: any) => l.action?.includes('falha') || l.action?.includes('erro')).map((log: any) => <div key={log.id} className="card" style={{ boxShadow: 'none', padding: '.7rem', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}><div><div style={{ fontWeight: 600, fontSize: '.75rem' }}>{log.action}</div><div style={{ fontSize: '.65rem', color: 'hsl(var(--muted-foreground))' }}>{log.entity} · {new Date(log.createdAt).toLocaleString('pt-AO')}</div></div><button className="btn-secondary"><RefreshCw size={13} /> Reprocessar</button></div>)}{logs.filter((l: any) => l.action?.includes('falha') || l.action?.includes('erro')).length === 0 && <div style={{ textAlign: 'center', color: 'hsl(var(--muted-foreground))', padding: '2rem' }}>Sem erros recentes</div>}</div></Section>}</>;
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
  const [saved, setSaved] = useState(false);
  const handleSave = () => {
    updateMut.mutate({ orgName, orgEmail, timezone, alerts, compact }, { onSuccess: () => setSaved(true) });
  };
  return <><PageHeader eyebrow="Governação · Workspace" title="Definições" subtitle="Preferências do espaço Solve Corporate." action={saved ? <Status tone="good">Alterações guardadas</Status> : <button className="btn-primary" onClick={handleSave}><Check size={14} /> Guardar alterações</button>} /><div className="content-grid" style={{ display: 'grid', gridTemplateColumns: '1.15fr .85fr', gap: '.8rem' }}><Section title="Perfil da organização" note="Informação apresentada em documentos e notificações"><div className="form-grid"><FormField label="Nome da organização" value={orgName} onChange={(v) => { setOrgName(v); setSaved(false); }} /><FormField label="Email operacional" value={orgEmail} onChange={(v) => { setOrgEmail(v); setSaved(false); }} /><FormField label="Fuso horário" value={timezone} onChange={(v) => { setTimezone(v); setSaved(false); }} /></div></Section><Section title="Preferências" note="Comportamento da aplicação"><div style={{ display: 'grid', gap: '.35rem' }}><Preference label="Alertas operacionais" detail="Notificar falhas de integração e pagamentos" on={alerts} setOn={(v) => { setAlerts(v); setSaved(false); }} /><Preference label="Vista compacta" detail="Mostrar mais linhas nas tabelas" on={compact} setOn={(v) => { setCompact(v); setSaved(false); }} /><Preference label="Confirmação de acções críticas" detail="Pedir confirmação antes de reprocessar" on={true} setOn={() => {}} /></div></Section></div><Section title="Dados e privacidade" note="Controlos do espaço de trabalho"><div style={{ display: 'flex', alignItems: 'center', gap: '.8rem', padding: '.2rem 0' }}><LockKeyhole size={18} color="hsl(var(--chart-2))" /><div style={{ flex: 1 }}><div style={{ fontSize: '.78rem', fontWeight: 700 }}>Retenção de auditoria</div><div className="section-note">Os registos de auditoria são mantidos durante 90 dias.</div></div><button className="btn-secondary">Ver política</button></div></Section></>;
}
function Preference({ label, detail, on, setOn }: { label: string; detail: string; on: boolean; setOn: (v: boolean) => void }) { return <button className="btn-quiet" style={{ justifyContent: 'flex-start', textAlign: 'left', padding: '.7rem .2rem' }} onClick={() => setOn(!on)}><div style={{ flex: 1 }}><div style={{ fontSize: '.76rem', fontWeight: 700, color: 'hsl(var(--foreground))' }}>{label}</div><div style={{ fontSize: '.66rem', color: 'hsl(var(--muted-foreground))', marginTop: '.18rem' }}>{detail}</div></div>{on ? <ToggleRight size={22} color="hsl(155 41% 43%)" /> : <ToggleLeft size={22} color="hsl(var(--muted-foreground))" />}</button>; }

function AppShell({ children }: { children: ReactNode }) {
  const [menu, setMenu] = useState(false); return <div className="shell"><Sidebar open={menu} onClose={() => setMenu(false)} /><div className="main-area"><Topbar onMenu={() => setMenu(true)} /><main className="page-content" style={{ maxWidth: 1200, margin: '0 auto', padding: '1.65rem 1.7rem 3rem' }}>{children}</main></div></div>;
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
  const [filter, setFilter] = useState('todos');
  const [page, setPage] = useState(1);
  const limit = 50;
  const accessStats = useAccessStats();
  const accessLogs = useAccessLogs({ page, limit });
  const solveDashboard = useSolveAccessDashboard();
  const solveTerminals = useSolveAccessTerminals();
  const solveHealth = useSolveAccessHealth();
  const unlockMutation = useUnlockTurnstile();
  const access = accessStats.data?.data;
  const logs = accessLogs.data?.data ?? [];
  const pagination = accessLogs.data?.pagination;
  const solveData = solveDashboard.data?.data;
  const terminals = solveTerminals.data?.data;
  const [realtimeEvents, setRealtimeEvents] = useState<any[]>([]);

  const { connected, history } = useSolveAccessStream((event) => {
    setRealtimeEvents(prev => [event, ...prev].slice(0, 100));
  });

  const allLogs = useMemo(() => {
    if (page > 1) return logs;
    const rtMapped = realtimeEvents.map((e, i) => ({
      id_acesso: `rt-${i}`,
      cliente_id: e.cliente_id,
      cliente_nome: e.cliente_nome,
      data_acesso: e.data,
      hora_acesso: e.hora,
      tipo_acesso: e.tipo_acesso,
      resultado: e.resultado,
      motivo: e.mensagem,
    }));
    const merged = [...rtMapped, ...logs];
    const seen = new Set();
    return merged.filter(l => {
      const key = `${l.cliente_id}-${l.hora_acesso}-${l.tipo_acesso}`;
      if (seen.has(key)) return false;
      seen.add(key);
      return true;
    });
  }, [realtimeEvents, logs, page]);

  const filteredLogs = allLogs.filter(l => filter === 'todos' || l.resultado === filter);
  const entradas = filteredLogs.filter(l => l.tipo_acesso === 'entrada');
  const saidas = filteredLogs.filter(l => l.tipo_acesso === 'saida');
  const isConnected = solveHealth.data?.success;

  const handleUnlock = (tipo: 'entrada' | 'saida') => {
    if (confirm(`Liberar catraca de ${tipo}?`)) {
      unlockMutation.mutate(tipo);
    }
  };

  return <><PageHeader eyebrow="Controlo de Acesso · Solve Access" title="Acesso Físico" subtitle={`Solve Access: ${isConnected ? 'Conectado' : 'Desconectado'} · ${solveHealth.data?.source ?? '—'}`} action={<div style={{ display: 'flex', gap: '.45rem' }}><Status tone={connected ? 'live' : 'danger'}>{connected ? '● Live' : '○ Offline'}</Status><button className="btn-secondary"><RefreshCw size={14} /> Sincronizar</button></div>} />
  <div className="metric-grid" style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: '.8rem', marginBottom: '.8rem' }}>
    <Metric label="Clientes activos" value={solveData?.clientes_ativos?.toString() ?? access?.clients.active?.toString() ?? '—'} note={`${access?.clients.total ?? 0} total`} />
    <Metric label="Pessoas hoje" value={solveData?.pessoas_hoje?.toString() ?? '—'} note={`${solveData?.entradas_hoje ?? 0} entradas`} />
    <Metric label="Terminais online" value={solveData?.terminais_online?.toString() ?? '—'} note={`${solveData?.total_terminais ?? 0} total`} />
    <Metric label="Acessos hoje" value={access?.accesses.today?.toString() ?? '—'} note={`${access?.accesses.authorizedToday ?? 0} autorizados`} />
  </div>
  <div className="content-grid" style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '.8rem' }}>
    <Section title="Entradas" note={`${entradas.length} registos`} action={<div style={{ display: 'flex', gap: '.4rem' }}>{['todos', 'autorizado', 'negado'].map(f => <button key={f} className={filter === f ? 'btn-primary' : 'btn-quiet'} onClick={() => { setFilter(f); setPage(1); }} style={{ fontSize: '.68rem', padding: '.3rem .6rem' }}>{f.charAt(0).toUpperCase() + f.slice(1)}</button>)}</div>}>
    <div className="table-wrap"><table className="data-table"><thead><tr><th>Cliente</th><th>Data</th><th>Hora</th><th>Resultado</th><th>Motivo</th></tr></thead><tbody>{entradas.map(l => <tr key={l.id_acesso}><td style={{ fontWeight: 600 }}>{l.cliente_nome || `#${l.cliente_id}`}</td><td>{l.data_acesso}</td><td className="mono" style={{ fontSize: '.72rem' }}>{l.hora_acesso?.slice(0, 8)}</td><td><Status tone={l.resultado === 'autorizado' ? 'good' : 'danger'}>{l.resultado}</Status></td><td style={{ fontSize: '.72rem', color: 'hsl(var(--muted-foreground))' }}>{l.motivo || '—'}</td></tr>)}</tbody></table></div>
    </Section>
    <Section title="Saídas" note={`${saidas.length} registos`}>
    <div className="table-wrap"><table className="data-table"><thead><tr><th>Cliente</th><th>Data</th><th>Hora</th><th>Resultado</th><th>Motivo</th></tr></thead><tbody>{saidas.map(l => <tr key={l.id_acesso}><td style={{ fontWeight: 600 }}>{l.cliente_nome || `#${l.cliente_id}`}</td><td>{l.data_acesso}</td><td className="mono" style={{ fontSize: '.72rem' }}>{l.hora_acesso?.slice(0, 8)}</td><td><Status tone={l.resultado === 'autorizado' ? 'good' : 'danger'}>{l.resultado}</Status></td><td style={{ fontSize: '.72rem', color: 'hsl(var(--muted-foreground))' }}>{l.motivo || '—'}</td></tr>)}</tbody></table></div>
    </Section>
  </div>
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
  const leadsQuery = useListLeads({ query: { refetchInterval: 30000 } });
  const customersQuery = useListCustomers({ query: { refetchInterval: 30000 } });
  const [localLeads, setLocalLeads] = useState<Lead[]>([]);

  const leads = useMemo(() => {
    const apiLeads = (leadsQuery.data?.data ?? []).map(mapApiLead);
    return localLeads.length > 0 ? localLeads : apiLeads;
  }, [leadsQuery.data, localLeads]);

  const customers = useMemo(() => {
    return (customersQuery.data?.data ?? []).map(mapApiCustomer);
  }, [customersQuery.data]);

  useEffect(() => {
    if (localLeads.length === 0 && leadsQuery.data?.data && leadsQuery.data.data.length > 0) {
      setLocalLeads(leadsQuery.data.data.map(mapApiLead));
    }
  }, [leadsQuery.data, localLeads.length]);

  return <AppShell><Switch><Route path="/" component={() => <Dashboard leads={leads} customers={customers} />} /><Route path="/leads" component={() => <LeadsPage leads={leads} setLeads={setLocalLeads} />} /><Route path="/pipeline" component={() => <PipelinePage leads={leads} setLeads={setLocalLeads} />} /><Route path="/clientes/:id" component={() => <CustomerDetail customers={customers} />} /><Route path="/clientes" component={() => <CustomersPage customers={customers} />} /><Route path="/planos" component={PlansPage} /><Route path="/pagamentos" component={PaymentsPage} /><Route path="/integracoes" component={IntegrationsPage} /><Route path="/automacoes" component={AutomationsPage} /><Route path="/api-webhooks" component={ApiPage} /><Route path="/utilizadores" component={UsersPage} /><Route path="/auditoria" component={AuditPage} /><Route path="/definicoes" component={SettingsPage} /><Route path="/acesso-fisico" component={AccessPage} /><Route component={() => <EmptyState title="Página não encontrada" text="O endereço solicitado não existe neste espaço." action={<Link href="/" className="btn-primary">Voltar ao dashboard</Link>} />} /></Switch></AppShell>;
}
function App() { return <QueryClientProvider client={queryClient}><TooltipProvider><WouterRouter base={import.meta.env.BASE_URL.replace(/\/$/, '')}><ErrorBoundary><Switch><Route path="/login" component={LoginPage} /><Route component={() => <ProtectedRoute><CRM /></ProtectedRoute>} /></Switch></ErrorBoundary></WouterRouter><Toaster /></TooltipProvider></QueryClientProvider>; }
export default App;




