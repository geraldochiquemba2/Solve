import { useState } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import {
  LayoutDashboard, BookOpen, Tag, ShoppingBag, FileText, Users,
  LogOut, Plus, Edit3, Trash2, ToggleLeft, ToggleRight,
  TrendingUp, Eye, CheckCircle2, XCircle, Clock, Save, X, ArrowLeft, Moon, Sun, ArrowUpRight, Megaphone, Download
} from 'lucide-react'
import { useAuth } from './context/AuthContext'
import { useCMS, Program, Plan, Banner } from './context/CMSContext'
import { useOrders, OrderStatus } from './context/OrderContext'
import { useTheme } from './context/ThemeContext'
import { useLocation } from 'wouter'

type AdminTab = 'dashboard' | 'programs' | 'plans' | 'orders' | 'users' | 'banners'

// ─── MAIN ADMIN PAGE ────────────────────────────────────────────────────
export default function Admin() {
  const { user, logout } = useAuth()
  const { isDark } = useTheme()
  const [, navigate] = useLocation()
  const [tab, setTab] = useState<AdminTab>('dashboard')

  // Redefined monochromatic/premium palette variables
  const bg = isDark ? '#050505' : '#fafafa'
  const cardBg = isDark ? '#111111' : '#ffffff'
  const textPrimary = isDark ? '#ffffff' : '#050505'
  const textMuted = isDark ? '#888888' : '#666666'
  const borderColor = isDark ? 'rgba(255,255,255,0.08)' : 'rgba(0,0,0,0.08)'
  const accentColor = '#D71920'

  const tabs: { id: AdminTab; label: string; icon: React.ReactNode }[] = [
    { id: 'dashboard', label: 'Dashboard', icon: <LayoutDashboard size={16} /> },
    { id: 'banners', label: 'Marketing', icon: <Megaphone size={16} /> },
    { id: 'programs', label: 'Programas', icon: <BookOpen size={16} /> },
    { id: 'plans', label: 'Planos & Preços', icon: <Tag size={16} /> },
    { id: 'orders', label: 'Faturação', icon: <FileText size={16} /> },
    { id: 'users', label: 'Utilizadores', icon: <Users size={16} /> },
  ]

  const sharedProps = { cardBg, textPrimary, textMuted, borderColor, isDark, accentColor }

  return (
    <div className="min-h-screen" style={{ backgroundColor: bg }}>
      <div className="max-w-7xl mx-auto px-4 py-8 md:py-12">
        
        {/* ─── PREMIUM HERO HEADER ─── */}
        <div className="flex flex-col md:flex-row md:items-end justify-between gap-6 mb-12">
          <div>
            <p className="text-xs font-bold uppercase tracking-[0.2em] mb-3" style={{ color: accentColor }}>
              Acesso Restrito
            </p>
            <h1 className="font-heading font-black text-4xl md:text-6xl tracking-tight" style={{ color: textPrimary }}>
              Painel de Admin
            </h1>
            <p className="mt-4 text-sm font-medium" style={{ color: textMuted }}>
              Gestão central do ecossistema Bruno Samora.
            </p>
          </div>
          
          <div className="flex items-center gap-3">
            <button
              onClick={() => navigate('/')}
              className="flex items-center gap-2 px-4 py-2.5 text-sm font-bold rounded-[7px] transition-all hover:bg-black/5 dark:hover:bg-white/5"
              style={{ color: textPrimary, border: `1px solid ${borderColor}` }}
            >
              <ArrowLeft size={16} /> Ver Site
            </button>
            <button
              onClick={() => {
                const newTheme = isDark ? 'light' : 'dark'
                document.documentElement.classList.toggle('dark', newTheme === 'dark')
                localStorage.setItem('bs-theme', newTheme)
                window.location.reload()
              }}
              className="flex items-center justify-center w-10 h-10 rounded-[7px] transition-colors border"
              style={{ backgroundColor: cardBg, borderColor, color: textPrimary }}
            >
              {isDark ? <Sun size={16} /> : <Moon size={16} />}
            </button>
            <button
              onClick={() => { logout(); navigate('/') }}
              className="flex items-center justify-center w-10 h-10 rounded-[7px] transition-colors bg-black dark:bg-white text-white dark:text-black hover:opacity-80"
            >
              <LogOut size={16} />
            </button>
          </div>
        </div>

        {/* ─── HORIZONTAL PILL NAVIGATION ─── */}
        <div className="flex items-center gap-2 overflow-x-auto no-scrollbar pb-2 mb-10 border-b" style={{ borderColor }}>
          {tabs.map(t => (
            <button
              key={t.id}
              onClick={() => setTab(t.id)}
              className="relative flex items-center gap-2 px-5 py-3 text-sm font-bold transition-colors whitespace-nowrap rounded-[7px] overflow-hidden"
              style={{ color: tab === t.id ? textPrimary : textMuted }}
            >
              <span className="relative z-10 flex items-center gap-2">
                {t.icon} {t.label}
              </span>
              {tab === t.id && (
                <motion.div
                  layoutId="adminTab"
                  className="absolute inset-0 z-0 rounded-[7px]"
                  style={{ backgroundColor: isDark ? 'rgba(255,255,255,0.05)' : 'rgba(0,0,0,0.05)' }}
                  transition={{ type: 'spring', stiffness: 400, damping: 30 }}
                />
              )}
            </button>
          ))}
        </div>

        {/* ─── CONTENT AREA ─── */}
        <main className="min-w-0">
          <AnimatePresence mode="wait">
            <motion.div 
              key={tab} 
              initial={{ opacity: 0, y: 15 }} 
              animate={{ opacity: 1, y: 0 }} 
              exit={{ opacity: 0, y: -15 }} 
              transition={{ duration: 0.25, ease: "easeOut" }}
            >
              {tab === 'dashboard' && <AdminDashboard {...sharedProps} />}
              {tab === 'banners' && <BannersManager {...sharedProps} />}
              {tab === 'programs' && <ProgramsManager {...sharedProps} />}
              {tab === 'plans' && <PlansManager {...sharedProps} />}
              {tab === 'orders' && <OrdersManager {...sharedProps} />}
              {tab === 'users' && <UsersManager {...sharedProps} />}
            </motion.div>
          </AnimatePresence>
        </main>
      </div>
    </div>
  )
}

// ─── SHARED PROPS TYPE ───────────────────────────────────────────────────
interface SharedProps { cardBg: string; textPrimary: string; textMuted: string; borderColor: string; isDark: boolean; accentColor: string }

// ─── DASHBOARD (BENTO GRID) ─────────────────────────────────────────────
function AdminDashboard({ cardBg, textPrimary, textMuted, borderColor, isDark, accentColor }: SharedProps) {
  const { programs, plans } = useCMS()
  const { getAllOrders } = useOrders()
  const orders = getAllOrders()
  const revenue = orders.filter(o => o.status === 'Confirmado' || o.status === 'Entregue').reduce((a, o) => a + o.amount, 0)
  const statusColor: Record<string, string> = { Pendente: '#f59e0b', Confirmado: '#10b981', Cancelado: '#ef4444', Entregue: '#6366f1' }

  return (
    <div className="grid grid-cols-1 md:grid-cols-12 gap-6">
      
      {/* KPI Bento Grid */}
      <div className="md:col-span-8 grid grid-cols-1 sm:grid-cols-2 gap-6">
        {/* Receita */}
        <motion.div 
          whileHover={{ y: -5 }}
          className="rounded-[7px] p-8 flex flex-col justify-between relative overflow-hidden group shadow-sm hover:shadow-xl transition-shadow" 
          style={{ backgroundColor: cardBg, border: `1px solid ${borderColor}` }}
        >
          <div className="absolute top-0 right-0 p-6 opacity-5 group-hover:opacity-10 transition-opacity">
            <TrendingUp size={120} style={{ color: textPrimary }} />
          </div>
          <div className="relative z-10">
            <p className="text-xs font-bold uppercase tracking-widest mb-2" style={{ color: textMuted }}>Receita Confirmada</p>
            <h2 className="font-heading font-black text-4xl sm:text-5xl" style={{ color: textPrimary }}>
              {new Intl.NumberFormat('pt-PT').format(revenue)} <span className="text-2xl text-muted">Kz</span>
            </h2>
          </div>
        </motion.div>

        {/* Transações */}
        <motion.div 
          whileHover={{ y: -5 }}
          className="rounded-[7px] p-8 flex flex-col justify-between relative overflow-hidden group shadow-sm hover:shadow-xl transition-shadow" 
          style={{ backgroundColor: cardBg, border: `1px solid ${borderColor}` }}
        >
          <div className="absolute top-0 right-0 p-6 opacity-5 group-hover:opacity-10 transition-opacity">
            <FileText size={120} style={{ color: textPrimary }} />
          </div>
          <div className="relative z-10">
            <p className="text-xs font-bold uppercase tracking-widest mb-2" style={{ color: textMuted }}>Transações Globais</p>
            <h2 className="font-heading font-black text-5xl sm:text-6xl" style={{ color: textPrimary }}>{orders.length}</h2>
          </div>
        </motion.div>

        {/* Programas */}
        <motion.div 
          whileHover={{ y: -5 }}
          className="rounded-[7px] p-6 relative overflow-hidden group" 
          style={{ backgroundColor: cardBg, border: `1px solid ${borderColor}` }}
        >
          <p className="text-xs font-bold uppercase tracking-widest mb-1" style={{ color: textMuted }}>Programas Ativos</p>
          <h2 className="font-heading font-black text-4xl" style={{ color: textPrimary }}>{programs.filter(p => p.status === 'Ativo').length}</h2>
        </motion.div>

        {/* Planos */}
        <motion.div 
          whileHover={{ y: -5 }}
          className="rounded-[7px] p-6 relative overflow-hidden group" 
          style={{ backgroundColor: cardBg, border: `1px solid ${borderColor}` }}
        >
          <p className="text-xs font-bold uppercase tracking-widest mb-1" style={{ color: textMuted }}>Planos Ativos</p>
          <h2 className="font-heading font-black text-4xl" style={{ color: textPrimary }}>{plans.filter(p => p.status === 'Ativo').length}</h2>
        </motion.div>
      </div>

      {/* Recentes */}
      <div className="md:col-span-4 flex flex-col">
        <div className="rounded-[7px] flex-1 flex flex-col shadow-sm" style={{ backgroundColor: cardBg, border: `1px solid ${borderColor}` }}>
          <div className="px-6 py-5 border-b flex items-center justify-between" style={{ borderColor }}>
            <h2 className="font-heading font-bold text-sm uppercase tracking-wider" style={{ color: textPrimary }}>Últimas Encomendas</h2>
          </div>
          <div className="p-2 flex-1">
            {orders.length === 0 ? (
              <div className="py-12 text-center h-full flex flex-col justify-center items-center">
                <p className="text-sm font-medium" style={{ color: textMuted }}>Nenhuma encomenda.</p>
              </div>
            ) : (
              <div className="space-y-1">
                {orders.slice(0, 5).map(o => (
                  <div key={o.id} className="px-4 py-3 flex items-center gap-3 rounded-[7px] transition-colors hover:bg-black/5 dark:hover:bg-white/5">
                    <div className="flex-1 min-w-0">
                      <p className="font-bold text-sm truncate" style={{ color: textPrimary }}>{o.userName}</p>
                      <p className="text-[10px] font-semibold uppercase tracking-wider truncate" style={{ color: textMuted }}>{o.programName} • {o.planName}</p>
                    </div>
                    <div className="text-right shrink-0">
                      <p className="text-xs font-black" style={{ color: textPrimary }}>{new Intl.NumberFormat('pt-PT').format(o.amount)} Kz</p>
                      <span className="text-[9px] font-bold uppercase tracking-wider" style={{ color: statusColor[o.status] || '#888' }}>{o.status}</span>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>
      </div>

    </div>
  )
}

// ─── BANNERS MANAGER ────────────────────────────────────────────────────
function BannersManager({ cardBg, textPrimary, textMuted, borderColor, isDark, accentColor }: SharedProps) {
  const { banners, addBanner, updateBanner, deleteBanner } = useCMS()
  const [showForm, setShowForm] = useState(false)
  const [editing, setEditing] = useState<Banner | null>(null)
  const inputBg = isDark ? '#1a1a1f' : '#f4f4f5'

  const empty: Omit<Banner, 'id' | 'createdAt'> = {
    type: 'image', url: '', title: '', description: '', ctaText: '', ctaLink: '', status: 'Ativo'
  }
  const [form, setForm] = useState(empty)

  const openNew = () => { setForm(empty); setEditing(null); setShowForm(true) }
  const openEdit = (b: Banner) => { 
    setForm({ type: b.type, url: b.url, title: b.title, description: b.description, ctaText: b.ctaText, ctaLink: b.ctaLink, status: b.status }); 
    setEditing(b); 
    setShowForm(true) 
  }

  const handleSave = () => {
    if (editing) { updateBanner(editing.id, form) } else { addBanner(form) }
    setShowForm(false)
  }

  const field = (label: string, key: keyof typeof form, type = 'text', placeholder = '') => (
    <div key={key}>
      <label className="block text-[10px] font-bold uppercase tracking-widest mb-1.5" style={{ color: textMuted }}>{label}</label>
      <input type={type} value={(form as any)[key]} onChange={e => setForm(p => ({ ...p, [key]: e.target.value }))} placeholder={placeholder}
        className="w-full h-11 px-4 text-sm font-medium rounded-[7px] outline-none focus:border-red-500 transition-colors" style={{ backgroundColor: inputBg, border: `1px solid ${borderColor}`, color: textPrimary }} />
    </div>
  )

  const select = (label: string, key: keyof typeof form, options: {value: string, label: string}[]) => (
    <div key={key}>
      <label className="block text-[10px] font-bold uppercase tracking-widest mb-1.5" style={{ color: textMuted }}>{label}</label>
      <select value={(form as any)[key]} onChange={e => setForm(p => ({ ...p, [key]: e.target.value }))}
        className="w-full h-11 px-4 text-sm font-medium rounded-[7px] outline-none focus:border-red-500 transition-colors" style={{ backgroundColor: inputBg, border: `1px solid ${borderColor}`, color: textPrimary }}>
        {options.map(o => <option key={o.value} value={o.value}>{o.label}</option>)}
      </select>
    </div>
  )

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <h2 className="font-heading font-bold text-2xl" style={{ color: textPrimary }}>Marketing (Banners)</h2>
        <button onClick={openNew} className="flex items-center gap-2 px-5 py-2.5 text-sm font-bold text-white rounded-[7px] hover:opacity-90 transition-opacity shadow-lg" style={{ backgroundColor: accentColor }}>
          <Plus size={16} /> Novo Banner
        </button>
      </div>

      <AnimatePresence>
        {showForm && (
          <div className="fixed inset-0 z-[100] flex items-center justify-center p-4 sm:p-6 bg-black/60 backdrop-blur-sm overflow-y-auto" onClick={(e) => { if(e.target === e.currentTarget) setShowForm(false) }}>
            <motion.div initial={{ opacity: 0, scale: 0.95, y: 20 }} animate={{ opacity: 1, scale: 1, y: 0 }} exit={{ opacity: 0, scale: 0.95, y: 20 }} className="w-full max-w-4xl m-auto relative">
            <div className="rounded-[7px] p-8 shadow-2xl" style={{ backgroundColor: cardBg, border: `1px solid ${borderColor}` }}>
              <div className="flex items-center justify-between mb-8">
                <h3 className="font-heading font-bold text-xl" style={{ color: textPrimary }}>{editing ? 'Editar Banner' : 'Novo Banner'}</h3>
                <button onClick={() => setShowForm(false)} className="hover:opacity-70 transition-opacity" style={{ color: textMuted }}><X size={20} /></button>
              </div>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                {select('Tipo de Média', 'type', [{value: 'image', label: 'Imagem'}, {value: 'video', label: 'Vídeo (MP4)'}])}
                {field('URL do ficheiro (Imagem/Vídeo)', 'url', 'url', 'https://...')}
                {field('Título', 'title', 'text', 'Ex: Nova Formação Disponível!')}
                {field('Texto do Botão (CTA)', 'ctaText', 'text', 'Ex: Inscreve-te Agora')}
                {field('Link do Botão', 'ctaLink', 'text', 'Ex: /dashboard ou https://...')}
                {select('Estado', 'status', [{value: 'Ativo', label: 'Ativo'}, {value: 'Inativo', label: 'Inativo'}])}
              </div>
              <div className="mt-6">
                <label className="block text-[10px] font-bold uppercase tracking-widest mb-1.5" style={{ color: textMuted }}>Descrição (Subtítulo)</label>
                <textarea value={form.description} onChange={e => setForm(p => ({ ...p, description: e.target.value }))} rows={2} placeholder="Breve descrição persuasiva..."
                  className="w-full px-4 py-3 text-sm font-medium rounded-[7px] outline-none resize-none focus:border-red-500 transition-colors" style={{ backgroundColor: inputBg, border: `1px solid ${borderColor}`, color: textPrimary }} />
              </div>
              <div className="flex justify-end gap-3 mt-8">
                <button onClick={() => setShowForm(false)} className="px-6 py-3 text-sm font-bold rounded-[7px] transition-colors" style={{ backgroundColor: isDark ? '#1a1a1f' : '#f0f0f2', color: textPrimary }}>
                  Cancelar
                </button>
                <button onClick={handleSave} className="flex items-center gap-2 px-6 py-3 text-sm font-bold text-white rounded-[7px] hover:opacity-90 transition-opacity" style={{ backgroundColor: accentColor }}>
                  <Save size={16} /> Guardar Banner
                </button>
              </div>
            </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>

      <div className="grid grid-cols-1 gap-6">
        {banners.length === 0 && !showForm && (
          <div className="py-20 text-center rounded-[7px]" style={{ backgroundColor: cardBg, border: `1px dashed ${borderColor}` }}>
            <p className="text-sm font-bold uppercase tracking-wider" style={{ color: textMuted }}>Nenhum banner configurado.</p>
          </div>
        )}
        
        {banners.map(b => (
          <div key={b.id} className="rounded-[7px] overflow-hidden flex flex-col group relative shadow-sm hover:shadow-xl transition-shadow border" style={{ backgroundColor: cardBg, borderColor }}>
            <div className="h-48 relative overflow-hidden bg-black flex items-center justify-center">
              {b.type === 'video' ? (
                <video src={b.url} className="absolute inset-0 w-full h-full object-cover opacity-60" autoPlay loop muted playsInline />
              ) : (
                <img src={b.url} alt={b.title} className="absolute inset-0 w-full h-full object-cover opacity-60" />
              )}
              <div className="absolute inset-0 bg-gradient-to-t from-black/90 via-black/40 to-transparent" />
              <div className="absolute top-3 right-3 bg-black/40 backdrop-blur-md text-[9px] font-bold uppercase tracking-widest px-2.5 py-1 rounded-full text-white border border-white/10">
                {b.status}
              </div>
              <div className="absolute bottom-4 left-5 right-5">
                <span className="text-[9px] font-black uppercase tracking-widest mb-1.5 block" style={{ color: accentColor }}>
                  {b.type === 'video' ? 'Vídeo' : 'Imagem'}
                </span>
                <h3 className="font-heading font-bold text-2xl text-white mb-1">{b.title}</h3>
                <p className="text-white/80 text-xs max-w-lg mb-3 line-clamp-1">{b.description}</p>
                <div className="inline-block px-3 py-1.5 bg-white text-black text-[10px] font-bold uppercase rounded-[7px]">
                  {b.ctaText}
                </div>
              </div>
            </div>
            <div className="p-4 flex items-center justify-end bg-transparent gap-2">
              <button onClick={() => openEdit(b)} className="flex items-center gap-2 px-3 py-1.5 rounded-[7px] text-xs font-bold hover:bg-black/5 dark:hover:bg-white/5 transition-colors" style={{ color: textPrimary }}>
                <Edit3 size={14} /> Editar
              </button>
              <button onClick={() => { if (confirm('Eliminar banner?')) deleteBanner(b.id) }} className="flex items-center gap-2 px-3 py-1.5 rounded-[7px] text-xs font-bold hover:bg-red-500/10 text-red-500 transition-colors">
                <Trash2 size={14} /> Eliminar
              </button>
            </div>
          </div>
        ))}
      </div>
    </div>
  )
}

// ─── PROGRAMS MANAGER ───────────────────────────────────────────────────
function ProgramsManager({ cardBg, textPrimary, textMuted, borderColor, isDark, accentColor }: SharedProps) {
  const { programs, addProgram, updateProgram, deleteProgram } = useCMS()
  const [showForm, setShowForm] = useState(false)
  const [editing, setEditing] = useState<Program | null>(null)
  const inputBg = isDark ? '#1a1a1f' : '#f4f4f5'

  const empty: Omit<Program, 'id' | 'createdAt'> = {
    name: '', category: 'Motivação', shortDesc: '', longDesc: '', image: '',
    duration: '', level: 'Iniciante', status: 'Ativo', tags: [], mode: 'online', platform: 'cademi',
  }
  const [form, setForm] = useState(empty)

  const openNew = () => { setForm(empty); setEditing(null); setShowForm(true) }
  const openEdit = (p: Program) => { setForm({ name: p.name, category: p.category, shortDesc: p.shortDesc, longDesc: p.longDesc, image: p.image, duration: p.duration, level: p.level, status: p.status, tags: (Array.isArray(p.tags) ? p.tags.join(', ') : (p.tags as any)), mode: p.mode || 'online', platform: p.platform || 'cademi' }); setEditing(p); setShowForm(true) }

  const handleSave = () => {
    const clean = { ...form, tags: Array.isArray((form as any).tags) ? (form as any).tags : String((form as any).tags || '').split(',').map((s: string) => s.trim()).filter(Boolean) };
    if (editing) { updateProgram(editing.id, clean) } else { addProgram(clean) }
    setShowForm(false)
  }

  const field = (label: string, key: keyof typeof form, type = 'text', placeholder = '') => (
    <div key={key}>
      <label className="block text-[10px] font-bold uppercase tracking-widest mb-1.5" style={{ color: textMuted }}>{label}</label>
      <input type={type} value={(form as any)[key]} onChange={e => setForm(p => ({ ...p, [key]: e.target.value }))} placeholder={placeholder}
        className="w-full h-11 px-4 text-sm font-medium rounded-[7px] outline-none focus:border-red-500 transition-colors" style={{ backgroundColor: inputBg, border: `1px solid ${borderColor}`, color: textPrimary }} />
    </div>
  )

  const select = (label: string, key: keyof typeof form, options: string[]) => (
    <div key={key}>
      <label className="block text-[10px] font-bold uppercase tracking-widest mb-1.5" style={{ color: textMuted }}>{label}</label>
      <select value={(form as any)[key]} onChange={e => setForm(p => ({ ...p, [key]: e.target.value }))}
        className="w-full h-11 px-4 text-sm font-medium rounded-[7px] outline-none focus:border-red-500 transition-colors" style={{ backgroundColor: inputBg, border: `1px solid ${borderColor}`, color: textPrimary }}>
        {options.map(o => <option key={o}>{o}</option>)}
      </select>
    </div>
  )

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <h2 className="font-heading font-bold text-2xl" style={{ color: textPrimary }}>Gestão de Programas</h2>
        <button onClick={openNew} className="flex items-center gap-2 px-5 py-2.5 text-sm font-bold text-white rounded-[7px] hover:opacity-90 transition-opacity shadow-lg" style={{ backgroundColor: accentColor }}>
          <Plus size={16} /> Novo Programa
        </button>
      </div>

      {/* Form */}
      <AnimatePresence>
        {showForm && (
          <div className="fixed inset-0 z-[100] flex items-center justify-center p-4 sm:p-6 bg-black/60 backdrop-blur-sm overflow-y-auto" onClick={(e) => { if(e.target === e.currentTarget) setShowForm(false) }}>
            <motion.div initial={{ opacity: 0, scale: 0.95, y: 20 }} animate={{ opacity: 1, scale: 1, y: 0 }} exit={{ opacity: 0, scale: 0.95, y: 20 }} className="w-full max-w-4xl m-auto relative">
            <div className="rounded-[7px] p-8 shadow-2xl" style={{ backgroundColor: cardBg, border: `1px solid ${borderColor}` }}>
              <div className="flex items-center justify-between mb-8">
                <h3 className="font-heading font-bold text-xl" style={{ color: textPrimary }}>{editing ? 'Editar Programa' : 'Novo Programa'}</h3>
                <button onClick={() => setShowForm(false)} className="hover:opacity-70 transition-opacity" style={{ color: textMuted }}><X size={20} /></button>
              </div>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                {field('Nome do Programa', 'name', 'text', 'Ex: FitMotivação')}
                {select('Categoria', 'category', ['Motivação', 'Formação', 'Workout', 'Studio', 'Outro'])}
                {select('Modalidade', 'mode', ['online', 'presencial'])}
                {select('Plataforma de Destino', 'platform', ['cademi', 'virtuagym', 'interno'])}
                {field('Descrição Curta', 'shortDesc', 'text', 'Resumo em 1 linha')}
                {field('Imagem (URL)', 'image', 'url', 'https://...')}
                {field('Duração', 'duration', 'text', 'Ex: 4 Módulos • 12 Horas')}
                {select('Nível', 'level', ['Iniciante', 'Intermédio', 'Avançado', 'Profissional'])}
                {select('Estado', 'status', ['Ativo', 'Rascunho', 'Arquivado'])}
                {field('Tags (separadas por vírgula)', 'tags' as any, 'text', 'Online, Certificado')}
              </div>
              <div className="mt-6">
                <label className="block text-[10px] font-bold uppercase tracking-widest mb-1.5" style={{ color: textMuted }}>Descrição Longa</label>
                <textarea value={form.longDesc} onChange={e => setForm(p => ({ ...p, longDesc: e.target.value }))} rows={4} placeholder="Descrição completa do programa..."
                  className="w-full px-4 py-3 text-sm font-medium rounded-[7px] outline-none resize-none focus:border-red-500 transition-colors" style={{ backgroundColor: inputBg, border: `1px solid ${borderColor}`, color: textPrimary }} />
              </div>
              <div className="flex justify-end gap-3 mt-8">
                <button onClick={() => setShowForm(false)} className="px-6 py-3 text-sm font-bold rounded-[7px] transition-colors" style={{ backgroundColor: isDark ? '#1a1a1f' : '#f0f0f2', color: textPrimary }}>
                  Cancelar
                </button>
                <button onClick={handleSave} className="flex items-center gap-2 px-6 py-3 text-sm font-bold text-white rounded-[7px] hover:opacity-90 transition-opacity" style={{ backgroundColor: accentColor }}>
                  <Save size={16} /> Guardar Programa
                </button>
              </div>
            </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>

      {/* List */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
        {programs.length === 0 && !showForm && (
          <div className="col-span-full py-20 text-center rounded-[7px]" style={{ backgroundColor: cardBg, border: `1px dashed ${borderColor}` }}>
            <p className="text-sm font-bold uppercase tracking-wider" style={{ color: textMuted }}>Nenhum programa configurado.</p>
          </div>
        )}
        
        {programs.map(p => (
          <div key={p.id} className="rounded-[7px] overflow-hidden flex flex-col group relative shadow-sm hover:shadow-xl transition-shadow" style={{ backgroundColor: cardBg, border: `1px solid ${borderColor}` }}>
            <div className="h-32 relative overflow-hidden bg-black">
              {p.image ? (
                <img src={p.image} alt={p.name} className="w-full h-full object-cover opacity-60 grayscale group-hover:grayscale-0 transition-all duration-500" />
              ) : (
                <div className="w-full h-full bg-zinc-900" />
              )}
              <div className="absolute inset-0 bg-gradient-to-t from-black/90 via-black/40 to-transparent" />
              <div className="absolute top-3 right-3 bg-black/40 backdrop-blur-md text-[9px] font-bold uppercase tracking-widest px-2.5 py-1 rounded-full text-white border border-white/10">
                {p.status}
              </div>
              <div className="absolute bottom-3 left-4 right-4">
                <span className="text-[9px] font-black uppercase tracking-widest mb-1 block" style={{ color: accentColor }}>{p.category}</span>
                <h3 className="font-heading font-bold text-lg text-white leading-tight">{p.name}</h3>
              </div>
            </div>
            <div className="p-4 flex items-center justify-between bg-transparent">
              <p className="text-xs font-semibold" style={{ color: textMuted }}>{p.level} • {p.duration}</p>
              <div className="flex gap-1">
                <button onClick={() => openEdit(p)} className="w-8 h-8 flex items-center justify-center rounded-[7px] hover:bg-black/5 dark:hover:bg-white/5 transition-colors" style={{ color: textPrimary }}>
                  <Edit3 size={14} />
                </button>
                <button onClick={() => { if (confirm('Eliminar programa?')) deleteProgram(p.id) }} className="w-8 h-8 flex items-center justify-center rounded-[7px] hover:bg-red-500/10 text-red-500 transition-colors">
                  <Trash2 size={14} />
                </button>
              </div>
            </div>
          </div>
        ))}
      </div>
    </div>
  )
}

// ─── PLANS MANAGER ───────────────────────────────────────────────────────
function PlansManager({ cardBg, textPrimary, textMuted, borderColor, isDark, accentColor }: SharedProps) {
  const { plans, programs, addPlan, updatePlan, deletePlan } = useCMS()
  const [showForm, setShowForm] = useState(false)
  const [editing, setEditing] = useState<Plan | null>(null)
  const inputBg = isDark ? '#1a1a1f' : '#f4f4f5'
  const [featureInput, setFeatureInput] = useState('')

  const emptyPlan = (): Omit<Plan, 'id' | 'createdAt'> => ({
    programId: programs[0]?.id || '',
    name: '', priceMonthly: 0, priceAnnual: 0, currency: 'AOA',
    features: [], highlighted: false, status: 'Ativo',
  })
  const [form, setForm] = useState(emptyPlan())

  const openNew = () => { setForm(emptyPlan()); setEditing(null); setShowForm(true) }
  const openEdit = (p: Plan) => {
    setForm({ programId: p.programId, name: p.name, priceMonthly: p.priceMonthly, priceAnnual: p.priceAnnual, currency: p.currency, features: [...p.features], highlighted: p.highlighted, status: p.status })
    setEditing(p); setShowForm(true)
  }
  const handleSave = () => {
    if (editing) { updatePlan(editing.id, form) } else { addPlan(form) }
    setShowForm(false)
  }
  const addFeature = () => {
    if (!featureInput.trim()) return
    setForm(p => ({ ...p, features: [...p.features, featureInput.trim()] }))
    setFeatureInput('')
  }
  const removeFeature = (i: number) => setForm(p => ({ ...p, features: p.features.filter((_, idx) => idx !== i) }))

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <h2 className="font-heading font-bold text-2xl" style={{ color: textPrimary }}>Planos & Preços</h2>
        <button onClick={openNew} className="flex items-center gap-2 px-5 py-2.5 text-sm font-bold text-white rounded-[7px] hover:opacity-90 transition-opacity shadow-lg" style={{ backgroundColor: accentColor }}>
          <Plus size={16} /> Novo Plano
        </button>
      </div>

      {/* Form */}
      <AnimatePresence>
        {showForm && (
          <div className="fixed inset-0 z-[100] flex items-center justify-center p-4 sm:p-6 bg-black/60 backdrop-blur-sm overflow-y-auto" onClick={(e) => { if(e.target === e.currentTarget) setShowForm(false) }}>
            <motion.div initial={{ opacity: 0, scale: 0.95, y: 20 }} animate={{ opacity: 1, scale: 1, y: 0 }} exit={{ opacity: 0, scale: 0.95, y: 20 }} className="w-full max-w-4xl m-auto relative">
            <div className="rounded-[7px] p-8 shadow-2xl" style={{ backgroundColor: cardBg, border: `1px solid ${borderColor}` }}>
              <div className="flex items-center justify-between mb-8">
                <h3 className="font-heading font-bold text-xl" style={{ color: textPrimary }}>{editing ? 'Editar Plano' : 'Novo Plano'}</h3>
                <button onClick={() => setShowForm(false)} className="hover:opacity-70 transition-opacity" style={{ color: textMuted }}><X size={20} /></button>
              </div>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                <div>
                  <label className="block text-[10px] font-bold uppercase tracking-widest mb-1.5" style={{ color: textMuted }}>Programa</label>
                  <select value={form.programId} onChange={e => setForm(p => ({ ...p, programId: e.target.value }))}
                    className="w-full h-11 px-4 text-sm font-medium rounded-[7px] outline-none focus:border-red-500" style={{ backgroundColor: inputBg, border: `1px solid ${borderColor}`, color: textPrimary }}>
                    {programs.map(p => <option key={p.id} value={p.id}>{p.name}</option>)}
                  </select>
                </div>
                <div>
                  <label className="block text-[10px] font-bold uppercase tracking-widest mb-1.5" style={{ color: textMuted }}>Nome do Plano</label>
                  <input value={form.name} onChange={e => setForm(p => ({ ...p, name: e.target.value }))} placeholder="Ex: Pro" type="text"
                    className="w-full h-11 px-4 text-sm font-medium rounded-[7px] outline-none focus:border-red-500" style={{ backgroundColor: inputBg, border: `1px solid ${borderColor}`, color: textPrimary }} />
                </div>
                <div>
                  <label className="block text-[10px] font-bold uppercase tracking-widest mb-1.5" style={{ color: textMuted }}>Preço Mensal</label>
                  <input type="number" value={form.priceMonthly} onChange={e => setForm(p => ({ ...p, priceMonthly: +e.target.value }))}
                    className="w-full h-11 px-4 text-sm font-medium rounded-[7px] outline-none focus:border-red-500" style={{ backgroundColor: inputBg, border: `1px solid ${borderColor}`, color: textPrimary }} />
                </div>
                <div>
                  <label className="block text-[10px] font-bold uppercase tracking-widest mb-1.5" style={{ color: textMuted }}>Preço Anual</label>
                  <input type="number" value={form.priceAnnual} onChange={e => setForm(p => ({ ...p, priceAnnual: +e.target.value }))}
                    className="w-full h-11 px-4 text-sm font-medium rounded-[7px] outline-none focus:border-red-500" style={{ backgroundColor: inputBg, border: `1px solid ${borderColor}`, color: textPrimary }} />
                </div>
                <div>
                  <label className="block text-[10px] font-bold uppercase tracking-widest mb-1.5" style={{ color: textMuted }}>Moeda</label>
                  <select value={form.currency} onChange={e => setForm(p => ({ ...p, currency: e.target.value as 'AOA' | 'EUR' }))}
                    className="w-full h-11 px-4 text-sm font-medium rounded-[7px] outline-none focus:border-red-500" style={{ backgroundColor: inputBg, border: `1px solid ${borderColor}`, color: textPrimary }}>
                    <option value="AOA">AOA (Kz)</option>
                    <option value="EUR">EUR (€)</option>
                  </select>
                </div>
                <div>
                  <label className="block text-[10px] font-bold uppercase tracking-widest mb-1.5" style={{ color: textMuted }}>Estado</label>
                  <select value={form.status} onChange={e => setForm(p => ({ ...p, status: e.target.value as 'Ativo' | 'Inativo' }))}
                    className="w-full h-11 px-4 text-sm font-medium rounded-[7px] outline-none focus:border-red-500" style={{ backgroundColor: inputBg, border: `1px solid ${borderColor}`, color: textPrimary }}>
                    <option>Ativo</option>
                    <option>Inativo</option>
                  </select>
                </div>
              </div>

              <div className="flex items-center gap-3 mt-6 p-4 rounded-[7px]" style={{ backgroundColor: inputBg }}>
                <button onClick={() => setForm(p => ({ ...p, highlighted: !p.highlighted }))} style={{ color: form.highlighted ? accentColor : textMuted }}>
                  {form.highlighted ? <ToggleRight size={28} /> : <ToggleLeft size={28} />}
                </button>
                <span className="text-sm font-bold uppercase tracking-wider" style={{ color: textPrimary }}>Marcar como Plano de Destaque</span>
              </div>

              <div className="mt-6">
                <label className="block text-[10px] font-bold uppercase tracking-widest mb-2" style={{ color: textMuted }}>Vantagens Incluídas</label>
                <div className="flex gap-2 mb-3">
                  <input value={featureInput} onChange={e => setFeatureInput(e.target.value)} onKeyDown={e => e.key === 'Enter' && (e.preventDefault(), addFeature())}
                    placeholder="Adiciona uma feature e prime Enter" type="text"
                    className="flex-1 h-11 px-4 text-sm font-medium rounded-[7px] outline-none focus:border-red-500" style={{ backgroundColor: inputBg, border: `1px solid ${borderColor}`, color: textPrimary }} />
                  <button onClick={addFeature} className="px-5 font-bold text-white rounded-[7px]" style={{ backgroundColor: textPrimary, color: cardBg }}>Adicionar</button>
                </div>
                <div className="flex flex-wrap gap-2">
                  {form.features.map((f, i) => (
                    <span key={i} className="flex items-center gap-2 text-xs font-semibold px-3 py-1.5 rounded-[7px] border" style={{ backgroundColor: cardBg, borderColor, color: textPrimary }}>
                      {f}
                      <button onClick={() => removeFeature(i)} className="hover:text-red-500 transition-colors" style={{ color: textMuted }}><X size={12} /></button>
                    </span>
                  ))}
                </div>
              </div>

              <div className="flex justify-end gap-3 mt-8">
                <button onClick={() => setShowForm(false)} className="px-6 py-3 text-sm font-bold rounded-[7px] transition-colors" style={{ backgroundColor: isDark ? '#1a1a1f' : '#f0f0f2', color: textPrimary }}>
                  Cancelar
                </button>
                <button onClick={handleSave} className="flex items-center gap-2 px-6 py-3 text-sm font-bold text-white rounded-[7px] hover:opacity-90 transition-opacity" style={{ backgroundColor: accentColor }}>
                  <Save size={16} /> Guardar Plano
                </button>
              </div>
            </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>

      <div className="space-y-10">
        {programs.map(prog => {
          const progPlans = plans.filter(p => p.programId === prog.id)
          if (progPlans.length === 0) return null

          return (
            <div key={prog.id}>
              <div className="flex items-center gap-3 mb-4">
                <h3 className="font-heading font-black text-xl" style={{ color: textPrimary }}>{prog.name}</h3>
                <span className="text-[10px] font-bold uppercase tracking-widest px-2 py-0.5 rounded-full bg-black dark:bg-white text-white dark:text-black">
                  {progPlans.length} Planos
                </span>
              </div>
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
                {progPlans.map(plan => (
                  <div key={plan.id} className="rounded-[7px] p-6 relative group transition-all shadow-sm hover:shadow-xl" style={{ backgroundColor: cardBg, border: plan.highlighted ? `2px solid ${accentColor}` : `1px solid ${borderColor}` }}>
                    <div className="mb-4">
                      {plan.highlighted && <span className="absolute -top-3 left-4 text-[9px] font-black uppercase tracking-widest px-3 py-1 rounded-full text-white shadow-lg" style={{ backgroundColor: accentColor }}>Popular</span>}
                      <h4 className="font-heading font-bold text-2xl mb-1" style={{ color: textPrimary }}>{plan.name}</h4>
                      <p className="font-heading font-black text-3xl" style={{ color: textPrimary }}>
                        {new Intl.NumberFormat('pt-PT').format(plan.priceMonthly)} <span className="text-lg text-muted">{plan.currency === 'AOA' ? 'Kz' : '€'}</span>
                      </p>
                    </div>
                    <ul className="space-y-2 mb-6 border-t pt-4" style={{ borderColor }}>
                      {plan.features.slice(0, 4).map((f, i) => (
                        <li key={i} className="text-xs font-medium flex items-start gap-2" style={{ color: textMuted }}>
                          <CheckCircle2 size={14} className="shrink-0 mt-0.5" style={{ color: textPrimary }} /> {f}
                        </li>
                      ))}
                      {plan.features.length > 4 && <li className="text-xs font-bold" style={{ color: textPrimary }}>+{plan.features.length - 4} vantagens...</li>}
                    </ul>
                    <div className="flex items-center justify-between pt-4 border-t" style={{ borderColor }}>
                      <span className="text-[9px] font-bold uppercase tracking-widest px-2.5 py-1 rounded-full" style={{ backgroundColor: plan.status === 'Ativo' ? 'rgba(16,185,129,0.1)' : 'rgba(161,161,170,0.1)', color: plan.status === 'Ativo' ? '#10b981' : '#a1a1aa' }}>
                        {plan.status}
                      </span>
                      <div className="flex gap-1">
                        <button onClick={() => openEdit(plan)} className="w-8 h-8 flex items-center justify-center rounded-[7px] hover:bg-black/5 dark:hover:bg-white/5 transition-colors" style={{ color: textPrimary }}><Edit3 size={14} /></button>
                        <button onClick={() => { if (confirm('Eliminar plano?')) deletePlan(plan.id) }} className="w-8 h-8 flex items-center justify-center rounded-[7px] hover:bg-red-500/10 text-red-500 transition-colors"><Trash2 size={14} /></button>
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )
        })}
        {plans.length === 0 && !showForm && (
          <div className="py-20 text-center rounded-[7px]" style={{ backgroundColor: cardBg, border: `1px dashed ${borderColor}` }}>
            <p className="text-sm font-bold uppercase tracking-wider" style={{ color: textMuted }}>Nenhum plano configurado.</p>
          </div>
        )}
      </div>
    </div>
  )
}

// ─── ORDERS MANAGER ─────────────────────────────────────────────────────
function OrdersManager({ cardBg, textPrimary, textMuted, borderColor, isDark, accentColor }: SharedProps) {
  const { getAllOrders, updateOrderStatus } = useOrders()
  const [filter, setFilter] = useState<string>('Todos')
  const orders = getAllOrders()
  const statusColor: Record<string, string> = { Pendente: '#f59e0b', Confirmado: '#10b981', Cancelado: '#ef4444', Entregue: '#6366f1' }
  const filtered = filter === 'Todos' ? orders : orders.filter(o => o.status === filter)

  const exportToCSV = () => {
    const headers = ['ID,Data,Nome,Email,Telefone,NIF,Programa,Plano,Valor,Moeda,Estado'];
    const rows = filtered.map(o => {
      const date = new Date(o.createdAt).toLocaleDateString('pt-PT');
      return `${o.id},${date},"${o.userName}","${o.userEmail}","${o.phone || ''}","${o.nif || ''}","${o.programName}","${o.planName}",${o.amount},${o.currency},${o.status}`;
    });
    
    const csvContent = headers.concat(rows).join('\n');
    const blob = new Blob(['\uFEFF' + csvContent], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.setAttribute('download', `crm_inscricoes_${new Date().toISOString().split('T')[0]}.csv`);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between flex-wrap gap-4">
        <h2 className="font-heading font-bold text-2xl" style={{ color: textPrimary }}>Faturação & CRM</h2>
        <div className="flex items-center gap-4">
          <div className="flex gap-2 bg-black/5 dark:bg-white/5 p-1 rounded-[7px]">
            {['Todos', 'Pendente', 'Confirmado', 'Cancelado', 'Entregue', 'Contacto'].map(s => (
              <button key={s} onClick={() => setFilter(s)} className="px-4 py-2 text-xs font-bold uppercase tracking-widest rounded-[7px] transition-all"
                style={{ backgroundColor: filter === s ? textPrimary : 'transparent', color: filter === s ? cardBg : textMuted }}>
                {s}
              </button>
            ))}
          </div>
          <button onClick={exportToCSV} className="flex items-center gap-2 px-5 py-2.5 text-sm font-bold text-white rounded-[7px] hover:opacity-90 transition-opacity shadow-sm" style={{ backgroundColor: accentColor }}>
            <Download size={16} /> Exportar CSV
          </button>
        </div>
      </div>

      <div className="rounded-[7px] shadow-sm" style={{ backgroundColor: cardBg, border: `1px solid ${borderColor}` }}>
        {filtered.length === 0 ? (
          <p className="py-20 text-center text-sm font-bold uppercase tracking-wider" style={{ color: textMuted }}>Nenhuma encomenda encontrada.</p>
        ) : (
          <div className="divide-y" style={{ borderColor }}>
            {filtered.map(o => (
              <div key={o.id} className="px-6 py-5 flex flex-col sm:flex-row sm:items-center gap-4 hover:bg-black/5 dark:hover:bg-white/5 transition-colors">
                <div className="w-12 h-12 rounded-[7px] border flex items-center justify-center shrink-0" style={{ borderColor }}>
                  <ShoppingBag size={20} style={{ color: textPrimary }} />
                </div>
                <div className="flex-1 min-w-0">
                  <p className="font-bold text-base" style={{ color: textPrimary }}>{o.userName} <span className="text-xs font-normal ml-2" style={{ color: textMuted }}>{o.userEmail}</span></p>
                  <p className="text-[11px] font-semibold uppercase tracking-wider mt-1" style={{ color: textMuted }}>
                    {o.programName} — {o.planName} • {new Date(o.createdAt).toLocaleDateString('pt-PT')}
                  </p>
                </div>
                <div className="text-right shrink-0">
                  <p className="text-lg font-black" style={{ color: textPrimary }}>{new Intl.NumberFormat('pt-PT').format(o.amount)} <span className="text-xs">{o.currency === 'AOA' ? 'Kz' : '€'}</span></p>
                  <span className="text-[9px] font-bold uppercase tracking-widest px-2 py-0.5 rounded-full mt-1 inline-block" style={{ backgroundColor: `${statusColor[o.status]}15`, color: statusColor[o.status] }}>
                    {o.status}
                  </span>
                </div>
                <div className="flex gap-2 shrink-0 sm:ml-4">
                  {o.status === 'Pendente' && (
                    <button onClick={() => updateOrderStatus(o.id, 'Confirmado')} className="flex items-center gap-1.5 px-3 py-1.5 rounded-[7px] text-[10px] font-bold uppercase tracking-widest bg-emerald-500/10 text-emerald-600 hover:bg-emerald-500/20 transition-colors">
                      <CheckCircle2 size={14} /> Aprovar
                    </button>
                  )}
                  {o.status !== 'Cancelado' && (
                    <button onClick={() => { if (confirm('Cancelar esta encomenda?')) updateOrderStatus(o.id, 'Cancelado') }} className="flex items-center justify-center w-8 h-8 rounded-[7px] hover:bg-red-500/10 text-red-500 transition-colors" title="Cancelar">
                      <XCircle size={16} />
                    </button>
                  )}
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  )
}

// ─── USERS MANAGER ─────────────────────────────────────────────────────
function UsersManager({ cardBg, textPrimary, textMuted, borderColor, isDark, accentColor }: SharedProps) {
  const [users, setUsers] = useState<any[]>(() => {
    try { return JSON.parse(localStorage.getItem('samora_users') || '[]') } catch { return [] }
  })
  const [filter, setFilter] = useState('Todos')
  const [showForm, setShowForm] = useState(false)
  const inputBg = isDark ? '#1a1a1f' : '#f4f4f5'

  const [form, setForm] = useState({ name: '', email: '', password: '', role: 'client' })

  const toggleRole = (id: string, currentRole: string) => {
    const newRole = currentRole === 'admin' ? 'client' : 'admin'
    const updated = users.map((u: any) => u.id === id ? { ...u, role: newRole } : u)
    localStorage.setItem('samora_users', JSON.stringify(updated))
    setUsers(updated)
  }

  const handleCreate = () => {
    if (!form.name || !form.email || !form.password) return alert('Preenche todos os campos.')
    if (users.find(u => u.email.toLowerCase() === form.email.toLowerCase())) return alert('Email já existe.')

    const newUser = {
      id: `user-${Date.now()}`,
      name: form.name,
      email: form.email,
      password: form.password,
      role: form.role,
      createdAt: new Date().toISOString()
    }
    const updated = [newUser, ...users]
    localStorage.setItem('samora_users', JSON.stringify(updated))
    setUsers(updated)
    setForm({ name: '', email: '', password: '', role: 'client' })
    setShowForm(false)
  }

  const filtered = filter === 'Todos' ? users : users.filter((u: any) => u.role === filter.toLowerCase())

  const exportToCSV = () => {
    const headers = ['ID,Nome,Email,Role,Data de Registo'];
    const rows = filtered.map((u: any) => {
      const date = new Date(u.createdAt).toLocaleDateString('pt-PT');
      return `${u.id},"${u.name}","${u.email}",${u.role},${date}`;
    });
    
    const csvContent = headers.concat(rows).join('\n');
    const blob = new Blob(['\uFEFF' + csvContent], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.setAttribute('download', `crm_utilizadores_${new Date().toISOString().split('T')[0]}.csv`);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between flex-wrap gap-4">
        <h2 className="font-heading font-bold text-2xl" style={{ color: textPrimary }}>Utilizadores & CRM</h2>
        <div className="flex items-center gap-4">
          <div className="flex gap-2 bg-black/5 dark:bg-white/5 p-1 rounded-[7px]">
            {['Todos', 'client', 'admin'].map(r => (
              <button key={r} onClick={() => setFilter(r)} className="px-4 py-2 text-xs font-bold uppercase tracking-widest rounded-[7px] transition-all"
                style={{ backgroundColor: filter === r ? textPrimary : 'transparent', color: filter === r ? cardBg : textMuted }}>
                {r === 'Todos' ? 'Todos' : r === 'client' ? 'Clientes' : 'Admins'}
              </button>
            ))}
          </div>
          <button onClick={exportToCSV} className="flex items-center gap-2 px-4 py-2.5 text-sm font-bold border rounded-[7px] hover:bg-black/5 dark:hover:bg-white/5 transition-colors" style={{ color: textPrimary, borderColor }}>
            <Download size={16} /> Exportar CSV
          </button>
          <button onClick={() => setShowForm(true)} className="flex items-center gap-2 px-5 py-2.5 text-sm font-bold text-white rounded-[7px] shadow-lg hover:opacity-90 transition-opacity" style={{ backgroundColor: accentColor }}>
            <Plus size={16} /> Novo Utilizador
          </button>
        </div>
      </div>

      <AnimatePresence>
        {showForm && (
          <div className="fixed inset-0 z-[100] flex items-center justify-center p-4 sm:p-6 bg-black/60 backdrop-blur-sm overflow-y-auto" onClick={(e) => { if(e.target === e.currentTarget) setShowForm(false) }}>
            <motion.div initial={{ opacity: 0, scale: 0.95, y: 20 }} animate={{ opacity: 1, scale: 1, y: 0 }} exit={{ opacity: 0, scale: 0.95, y: 20 }} className="w-full max-w-4xl m-auto relative">
            <div className="rounded-[7px] p-8 shadow-2xl" style={{ backgroundColor: cardBg, border: `1px solid ${borderColor}` }}>
              <div className="flex items-center justify-between mb-8">
                <h3 className="font-heading font-bold text-xl" style={{ color: textPrimary }}>Criar Acesso Manual</h3>
                <button onClick={() => setShowForm(false)} className="hover:opacity-70 transition-opacity" style={{ color: textMuted }}><X size={20} /></button>
              </div>
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
                <div>
                  <label className="block text-[10px] font-bold uppercase tracking-widest mb-1.5" style={{ color: textMuted }}>Nome Completo</label>
                  <input value={form.name} onChange={e => setForm(p => ({ ...p, name: e.target.value }))} type="text"
                    className="w-full h-11 px-4 text-sm font-medium rounded-[7px] outline-none focus:border-red-500" style={{ backgroundColor: inputBg, border: `1px solid ${borderColor}`, color: textPrimary }} />
                </div>
                <div>
                  <label className="block text-[10px] font-bold uppercase tracking-widest mb-1.5" style={{ color: textMuted }}>Email</label>
                  <input value={form.email} onChange={e => setForm(p => ({ ...p, email: e.target.value }))} type="email"
                    className="w-full h-11 px-4 text-sm font-medium rounded-[7px] outline-none focus:border-red-500" style={{ backgroundColor: inputBg, border: `1px solid ${borderColor}`, color: textPrimary }} />
                </div>
                <div>
                  <label className="block text-[10px] font-bold uppercase tracking-widest mb-1.5" style={{ color: textMuted }}>Password (Provisória)</label>
                  <input value={form.password} onChange={e => setForm(p => ({ ...p, password: e.target.value }))} type="text" placeholder="Ex: changeme123"
                    className="w-full h-11 px-4 text-sm font-medium rounded-[7px] outline-none focus:border-red-500" style={{ backgroundColor: inputBg, border: `1px solid ${borderColor}`, color: textPrimary }} />
                </div>
                <div>
                  <label className="block text-[10px] font-bold uppercase tracking-widest mb-1.5" style={{ color: textMuted }}>Permissão</label>
                  <select value={form.role} onChange={e => setForm(p => ({ ...p, role: e.target.value }))}
                    className="w-full h-11 px-4 text-sm font-medium rounded-[7px] outline-none focus:border-red-500" style={{ backgroundColor: inputBg, border: `1px solid ${borderColor}`, color: textPrimary }}>
                    <option value="client">Cliente</option>
                    <option value="admin">Administrador</option>
                  </select>
                </div>
              </div>
              <div className="flex justify-end mt-8">
                <button onClick={handleCreate} className="flex items-center gap-2 px-6 py-3 text-sm font-bold text-white rounded-[7px] hover:opacity-90 transition-opacity" style={{ backgroundColor: accentColor }}>
                  <Save size={16} /> Criar Acesso
                </button>
              </div>
            </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>

      <div className="rounded-[7px] shadow-sm" style={{ backgroundColor: cardBg, border: `1px solid ${borderColor}` }}>
        {filtered.length === 0 ? (
          <p className="py-20 text-center text-sm font-bold uppercase tracking-wider" style={{ color: textMuted }}>Nenhum utilizador encontrado.</p>
        ) : (
          <div className="divide-y" style={{ borderColor }}>
            {filtered.map((u: any) => (
              <div key={u.id} className="px-6 py-5 flex items-center gap-4 hover:bg-black/5 dark:hover:bg-white/5 transition-colors">
                <div className="w-12 h-12 rounded-[7px] flex items-center justify-center font-heading font-black text-xl text-white shrink-0 shadow-sm" style={{ backgroundColor: u.role === 'admin' ? accentColor : textPrimary, color: u.role === 'admin' ? '#fff' : cardBg }}>
                  {u.name?.charAt(0).toUpperCase()}
                </div>
                <div className="flex-1 min-w-0">
                  <p className="font-bold text-base" style={{ color: textPrimary }}>{u.name}</p>
                  <p className="text-[11px] font-semibold uppercase tracking-wider mt-0.5" style={{ color: textMuted }}>{u.email} • Registado a {new Date(u.createdAt).toLocaleDateString('pt-PT')}</p>
                </div>
                <div className="flex items-center gap-4 shrink-0">
                  <span className="text-[9px] font-bold uppercase tracking-widest px-2.5 py-1 rounded-full" style={{
                    backgroundColor: u.role === 'admin' ? 'rgba(215,25,32,0.1)' : (isDark ? '#222' : '#eee'),
                    color: u.role === 'admin' ? accentColor : textPrimary,
                  }}>
                    {u.role === 'admin' ? 'Acesso Total' : 'Cliente'}
                  </span>
                  <button onClick={() => toggleRole(u.id, u.role)} title="Mudar permissão" className="hover:opacity-70 transition-opacity" style={{ color: textMuted }}>
                    {u.role === 'admin' ? <ToggleRight size={28} style={{ color: accentColor }} /> : <ToggleLeft size={28} />}
                  </button>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  )
}
