import { useState, useEffect } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import {
  LayoutDashboard, ShoppingBag, FileText, BookOpen, User as UserIcon,
  LogOut, ChevronRight, ChevronLeft, Package, Clock, CheckCircle2, Edit3, Save, X, ArrowLeft, Moon, Sun, ArrowUpRight
} from 'lucide-react'
import { useAuth } from './context/AuthContext'
import { useOrders } from './context/OrderContext'
import { useTheme } from './context/ThemeContext'
import { useCMS } from './context/CMSContext'
import ProgramCheckoutModal from './ui/ProgramCheckoutModal'
import { useLocation } from 'wouter'

type DashTab = 'overview' | 'orders' | 'programs' | 'profile'

export default function Dashboard() {
  const { user, logout, updateProfile } = useAuth()
  const { getOrdersByUser } = useOrders()
  const { programs, getPlansByProgram } = useCMS()
  const { isDark } = useTheme()
  const [, navigate] = useLocation()
  const [activeTab, setActiveTab] = useState<DashTab>('overview')
  const [checkoutOpen, setCheckoutOpen] = useState(false)
  const [selectedProgramId, setSelectedProgramId] = useState<string | null>(null)

  const orders = user ? getOrdersByUser(user.id) : []
  const activePrograms = orders.filter(o => o.status === 'Confirmado' || o.status === 'Entregue')

  // Redefined monochromatic/premium palette variables
  const bg = isDark ? '#050505' : '#fafafa'
  const cardBg = isDark ? '#111111' : '#ffffff'
  const textPrimary = isDark ? '#ffffff' : '#050505'
  const textMuted = isDark ? '#888888' : '#666666'
  const borderColor = isDark ? 'rgba(255,255,255,0.08)' : 'rgba(0,0,0,0.08)'
  const accentColor = '#D71920'

  const handleLogout = () => { logout(); navigate('/') }

  const tabs: { id: DashTab; label: string; icon: React.ReactNode }[] = [
    { id: 'overview', label: 'Visão Geral', icon: <LayoutDashboard size={16} /> },
    { id: 'orders', label: 'Faturação', icon: <FileText size={16} /> },
    { id: 'programs', label: 'Meus Programas', icon: <BookOpen size={16} /> },
    { id: 'profile', label: 'Perfil', icon: <UserIcon size={16} /> },
  ]

  const statusColor: Record<string, string> = {
    Pendente: '#f59e0b',
    Confirmado: '#10b981',
    Cancelado: '#ef4444',
    Entregue: '#6366f1',
  }

  // Selected program for checkout
  const checkoutProgram = programs.find(p => p.id === selectedProgramId) || null
  const checkoutPlans = checkoutProgram ? getPlansByProgram(checkoutProgram.id) : []

  return (
    <div className="min-h-screen" style={{ backgroundColor: bg }}>
      <ProgramCheckoutModal
        isOpen={checkoutOpen}
        onClose={() => setCheckoutOpen(false)}
        program={checkoutProgram}
        plans={checkoutPlans}
      />
      
      <div className="max-w-7xl mx-auto px-4 py-8 md:py-12">

        {/* ─── PREMIUM HERO HEADER ─── */}
        <div className="flex flex-col md:flex-row md:items-end justify-between gap-6 mb-12">
          <div>
            <p className="text-xs font-bold uppercase tracking-[0.2em] mb-3" style={{ color: accentColor }}>
              Área Pessoal
            </p>
            <h1 className="font-heading font-black text-4xl md:text-6xl tracking-tight" style={{ color: textPrimary }}>
              Olá, {user?.name?.split(' ')[0]}
            </h1>
            <p className="mt-4 text-sm font-medium" style={{ color: textMuted }}>
              Bem-vindo ao teu hub de alta performance.
            </p>
          </div>
          
          <div className="flex items-center gap-3">
            <button
              onClick={() => navigate('/')}
              className="flex items-center gap-2 px-4 py-2.5 text-sm font-bold rounded-[7px] transition-all hover:bg-black/5 dark:hover:bg-white/5"
              style={{ color: textPrimary, border: `1px solid ${borderColor}` }}
            >
              <ArrowLeft size={16} /> Explorar Site
            </button>
            <button
              onClick={() => {
                const newTheme = isDark ? 'light' : 'dark'
                document.documentElement.classList.toggle('dark', newTheme === 'dark')
                localStorage.setItem('theme', newTheme)
                window.location.reload()
              }}
              className="flex items-center justify-center w-10 h-10 rounded-[7px] transition-colors border"
              style={{ backgroundColor: cardBg, borderColor, color: textPrimary }}
            >
              {isDark ? <Sun size={16} /> : <Moon size={16} />}
            </button>
            <button
              onClick={handleLogout}
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
              onClick={() => setActiveTab(t.id)}
              className="relative flex items-center gap-2 px-5 py-3 text-sm font-bold transition-colors whitespace-nowrap rounded-[7px] overflow-hidden"
              style={{ color: activeTab === t.id ? textPrimary : textMuted }}
            >
              <span className="relative z-10 flex items-center gap-2">
                {t.icon} {t.label}
              </span>
              {activeTab === t.id && (
                <motion.div
                  layoutId="activeTab"
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
              key={activeTab}
              initial={{ opacity: 0, y: 15 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -15 }}
              transition={{ duration: 0.25, ease: "easeOut" }}
            >
              {/* ─── OVERVIEW (BENTO GRID) ─── */}
              {activeTab === 'overview' && (
                <div className="space-y-6">
                  {/* Marketing Carousel */}
                  <MarketingCarousel isDark={isDark} accentColor={accentColor} cardBg={cardBg} borderColor={borderColor} />

                  <div className="grid grid-cols-1 md:grid-cols-12 gap-6">
                  
                  {/* Left Column (Stats - Bento) */}
                  <div className="md:col-span-8 grid grid-cols-1 sm:grid-cols-2 gap-6">
                    {/* Stat 1: Programas Ativos */}
                    <motion.div 
                      whileHover={{ y: -5 }}
                      className="rounded-[7px] p-8 flex flex-col justify-between relative overflow-hidden group shadow-sm hover:shadow-xl transition-shadow" 
                      style={{ backgroundColor: cardBg, border: `1px solid ${borderColor}` }}
                    >
                      <div className="absolute top-0 right-0 p-6 opacity-10 group-hover:opacity-20 transition-opacity">
                        <BookOpen size={100} style={{ color: textPrimary }} />
                      </div>
                      <div className="relative z-10">
                        <p className="text-xs font-bold uppercase tracking-widest mb-2" style={{ color: textMuted }}>Programas Ativos</p>
                        <h2 className="font-heading font-black text-6xl" style={{ color: textPrimary }}>{activePrograms.length}</h2>
                      </div>
                      <div className="relative z-10 mt-8">
                        <button onClick={() => setActiveTab('programs')} className="text-sm font-bold flex items-center gap-1 hover:gap-2 transition-all" style={{ color: accentColor }}>
                          Ver programas <ArrowRightIcon />
                        </button>
                      </div>
                    </motion.div>

                    {/* Stat 2: Transações */}
                    <motion.div 
                      whileHover={{ y: -5 }}
                      className="rounded-[7px] p-8 flex flex-col justify-between relative overflow-hidden group shadow-sm hover:shadow-xl transition-shadow" 
                      style={{ backgroundColor: cardBg, border: `1px solid ${borderColor}` }}
                    >
                      <div className="absolute top-0 right-0 p-6 opacity-10 group-hover:opacity-20 transition-opacity">
                        <FileText size={100} style={{ color: textPrimary }} />
                      </div>
                      <div className="relative z-10">
                        <p className="text-xs font-bold uppercase tracking-widest mb-2" style={{ color: textMuted }}>Transações</p>
                        <h2 className="font-heading font-black text-6xl" style={{ color: textPrimary }}>{orders.length}</h2>
                      </div>
                      <div className="relative z-10 mt-8 flex gap-4">
                        <p className="text-xs font-semibold uppercase tracking-wider" style={{ color: textMuted }}>
                          {orders.filter(o => o.status === 'Pendente').length} Pendentes
                        </p>
                      </div>
                    </motion.div>

                    {/* Promo Banner / Discovery */}
                    <div className="sm:col-span-2 rounded-[7px] p-8 relative overflow-hidden bg-black text-white dark:bg-white dark:text-black shadow-lg">
                      <div className="absolute inset-0 bg-gradient-to-r from-black via-black/90 to-transparent dark:from-white dark:via-white/90 dark:to-transparent z-0" />
                      <div className="relative z-10 max-w-sm">
                        <h3 className="font-heading font-black text-2xl mb-2">Desbloqueia o teu potencial máximo.</h3>
                        <p className="text-sm opacity-80 mb-6">Descobre novos serviços e formações exclusivas para a tua evolução contínua.</p>
                        <button onClick={() => navigate('/fit-motivacao')} className="bg-white text-black dark:bg-black dark:text-white px-6 py-3 font-bold text-sm rounded-[7px] transition-transform hover:scale-105">
                          Explorar Catálogo
                        </button>
                      </div>
                    </div>
                  </div>

                  {/* Right Column (Recent Transactions) */}
                  <div className="md:col-span-4 flex flex-col">
                    <div className="rounded-[7px] flex-1 flex flex-col shadow-sm" style={{ backgroundColor: cardBg, border: `1px solid ${borderColor}` }}>
                      <div className="px-6 py-5 border-b flex items-center justify-between" style={{ borderColor }}>
                        <h2 className="font-heading font-bold text-sm uppercase tracking-wider" style={{ color: textPrimary }}>Últimos Movimentos</h2>
                        <button onClick={() => setActiveTab('orders')} className="text-xs font-bold transition-colors hover:opacity-70" style={{ color: accentColor }}>Ver tudo</button>
                      </div>
                      <div className="p-2 flex-1">
                        {orders.length === 0 ? (
                          <div className="py-12 text-center h-full flex flex-col justify-center items-center">
                            <ShoppingBag size={32} className="mb-3 opacity-20" style={{ color: textPrimary }} />
                            <p className="text-sm font-medium" style={{ color: textMuted }}>Nenhum movimento.</p>
                          </div>
                        ) : (
                          <div className="space-y-1">
                            {orders.slice(0, 4).map(o => (
                              <ModernOrderRow key={o.id} order={o} textPrimary={textPrimary} textMuted={textMuted} statusColor={statusColor} isDark={isDark} />
                            ))}
                          </div>
                        )}
                      </div>
                    </div>
                  </div>

                </div>
                </div>
              )}

              {/* ─── ORDERS (FATURAÇÃO) ─── */}
              {activeTab === 'orders' && (
                <div className="rounded-[7px]" style={{ backgroundColor: cardBg, border: `1px solid ${borderColor}` }}>
                  <div className="px-6 py-5 border-b" style={{ borderColor }}>
                    <h2 className="font-heading font-bold text-sm uppercase tracking-wider" style={{ color: textPrimary }}>O Meu Histórico de Faturação</h2>
                  </div>
                  {orders.length === 0 ? (
                    <div className="py-24 text-center">
                      <ShoppingBag size={48} className="mx-auto mb-4 opacity-10" style={{ color: textPrimary }} />
                      <p className="text-sm font-bold uppercase tracking-wider" style={{ color: textMuted }}>Nenhuma fatura encontrada.</p>
                    </div>
                  ) : (
                    <div className="p-4 space-y-2">
                      {orders.map(o => (
                        <ModernOrderRow key={o.id} order={o} textPrimary={textPrimary} textMuted={textMuted} statusColor={statusColor} isDark={isDark} />
                      ))}
                    </div>
                  )}
                </div>
              )}

              {/* ─── PROGRAMS (MEUS SERVIÇOS) ─── */}
              {activeTab === 'programs' && (
                <div className="space-y-12">
                  
                  {/* Meus Programas */}
                  <div>
                    <h2 className="font-heading font-bold text-xl mb-6" style={{ color: textPrimary }}>A Tua Biblioteca Ativa</h2>
                    {activePrograms.length === 0 ? (
                      <div className="py-20 text-center rounded-[7px]" style={{ backgroundColor: cardBg, border: `1px dashed ${borderColor}` }}>
                        <BookOpen size={48} className="mx-auto mb-4 opacity-10" style={{ color: textPrimary }} />
                        <p className="text-sm font-bold uppercase tracking-wider" style={{ color: textMuted }}>Nenhum serviço ativo de momento.</p>
                      </div>
                    ) : (
                      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
                        {activePrograms.map(o => {
                          const pObj = programs.find(p => p.name === o.programName)
                          return (
                            <motion.div 
                              key={o.id} 
                              whileHover={{ y: -5 }}
                              className="rounded-[7px] overflow-hidden flex flex-col group relative shadow-sm hover:shadow-xl transition-shadow" 
                              style={{ backgroundColor: cardBg, border: `1px solid ${borderColor}` }}
                            >
                              <div className="h-40 relative overflow-hidden bg-black">
                                {pObj?.image ? (
                                  <img src={pObj.image} alt={o.programName} className="w-full h-full object-cover opacity-60 group-hover:scale-105 transition-transform duration-700" />
                                ) : (
                                  <div className="w-full h-full bg-zinc-900" />
                                )}
                                <div className="absolute inset-0 bg-gradient-to-t from-black/80 to-transparent" />
                                <div className="absolute top-4 right-4 bg-emerald-500/20 text-emerald-400 text-[10px] font-bold uppercase tracking-widest px-3 py-1 rounded-full backdrop-blur-sm border border-emerald-500/20">
                                  Ativo
                                </div>
                                <div className="absolute bottom-4 left-4 right-4">
                                  <h3 className="font-heading font-bold text-xl text-white mb-1">{o.programName}</h3>
                                  <p className="text-xs text-white/70">{o.planName}</p>
                                </div>
                              </div>
                              <div className="p-5 flex-1 flex flex-col justify-between">
                                <div className="flex justify-between items-center text-xs font-semibold mb-4" style={{ color: textMuted }}>
                                  <span>Adquirido em</span>
                                  <span>{new Date(o.createdAt).toLocaleDateString('pt-PT')}</span>
                                </div>
                                <button className="w-full py-3 rounded-[7px] font-bold text-sm bg-black dark:bg-white text-white dark:text-black flex items-center justify-center gap-2 hover:opacity-90 transition-opacity">
                                  Aceder ao Conteúdo <ArrowUpRight size={16} />
                                </button>
                              </div>
                            </motion.div>
                          )
                        })}
                      </div>
                    )}
                  </div>

                  {/* Descobrir Outros */}
                  <div>
                    <h2 className="font-heading font-bold text-xl mb-6" style={{ color: textPrimary }}>Eleva a tua performance</h2>
                    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
                      {programs.filter(p => p.status === 'Ativo').map(prog => {
                        const progPlans = getPlansByProgram(prog.id)
                        const minPrice = progPlans.length > 0 ? Math.min(...progPlans.map(pl => pl.priceMonthly)) : null
                        const currency = progPlans[0]?.currency === 'EUR' ? '€' : 'Kz'

                        return (
                          <div key={prog.id} className="rounded-[7px] border overflow-hidden flex flex-col bg-black group relative shadow-md hover:shadow-xl transition-shadow" style={{ borderColor }}>
                            {prog.image && <img src={prog.image} alt={prog.name} className="absolute inset-0 w-full h-full object-cover opacity-40 grayscale group-hover:grayscale-0 group-hover:opacity-60 transition-all duration-700" />}
                            <div className="absolute inset-0 bg-gradient-to-b from-black/20 via-black/60 to-black z-10" />
                            
                            <div className="p-6 flex-1 flex flex-col justify-end relative z-20 min-h-[300px]">
                              <span className="text-[10px] font-bold uppercase tracking-widest mb-2" style={{ color: accentColor }}>{prog.category}</span>
                              <h3 className="font-heading font-bold text-2xl text-white mb-2">{prog.name}</h3>
                              <p className="text-sm text-white/70 mb-6 line-clamp-2">{prog.shortDesc}</p>
                              
                              <div className="flex items-end justify-between mt-auto">
                                <div>
                                  {minPrice !== null && (
                                    <>
                                      <p className="text-[10px] uppercase tracking-wider font-bold text-white/50 mb-0.5">A partir de</p>
                                      <p className="font-heading font-black text-lg text-white">
                                        {new Intl.NumberFormat('pt-PT').format(minPrice)} {currency}
                                      </p>
                                    </>
                                  )}
                                </div>
                                <button
                                  onClick={() => { setSelectedProgramId(prog.id); setCheckoutOpen(true) }}
                                  className="w-10 h-10 flex items-center justify-center rounded-[7px] bg-white text-black hover:scale-105 transition-transform"
                                >
                                  <ArrowUpRight size={20} />
                                </button>
                              </div>
                            </div>
                          </div>
                        )
                      })}
                    </div>
                  </div>
                </div>
              )}

              {/* ─── PROFILE ─── */}
              {activeTab === 'profile' && user && (
                <div className="max-w-2xl">
                  <ProfileTab user={user} updateProfile={updateProfile} cardBg={cardBg} borderColor={borderColor} textPrimary={textPrimary} textMuted={textMuted} isDark={isDark} />
                </div>
              )}
            </motion.div>
          </AnimatePresence>
        </main>

      </div>
    </div>
  )
}

function ArrowRightIcon() {
  return <ChevronRight size={14} />
}

// ─── MARKETING CAROUSEL COMPONENT ───────────────────────────────────────
function MarketingCarousel({ isDark, accentColor, cardBg, borderColor }: { isDark: boolean, accentColor: string, cardBg: string, borderColor: string }) {
  const { banners } = useCMS()
  const activeBanners = banners.filter(b => b.status === 'Ativo')
  const [currentIndex, setCurrentIndex] = useState(0)
  const [, navigate] = useLocation()

  useEffect(() => {
    if (activeBanners.length <= 1) return
    const interval = setInterval(() => {
      setCurrentIndex((prev) => (prev + 1) % activeBanners.length)
    }, 8000)
    return () => clearInterval(interval)
  }, [activeBanners.length])

  if (activeBanners.length === 0) return null

  const banner = activeBanners[currentIndex]

  const next = () => setCurrentIndex((prev) => (prev + 1) % activeBanners.length)
  const prev = () => setCurrentIndex((prev) => (prev - 1 + activeBanners.length) % activeBanners.length)

  return (
    <div className="relative rounded-[7px] overflow-hidden w-full h-[300px] md:h-[400px] shadow-sm border group" style={{ borderColor, backgroundColor: cardBg }}>
      <AnimatePresence mode="wait">
        <motion.div
          key={banner.id}
          initial={{ opacity: 0, scale: 1.02 }}
          animate={{ opacity: 1, scale: 1 }}
          exit={{ opacity: 0 }}
          transition={{ duration: 0.6 }}
          className="absolute inset-0 bg-black"
        >
          {banner.type === 'video' ? (
            <video src={banner.url} className="w-full h-full object-cover opacity-70" autoPlay loop muted playsInline />
          ) : (
            <img src={banner.url} alt={banner.title} className="w-full h-full object-cover opacity-70" />
          )}
          
          <div className="absolute inset-0 bg-gradient-to-r from-black/90 via-black/50 to-transparent" />
          
          <div className="absolute inset-0 flex flex-col justify-center p-8 md:p-12 z-10 w-full md:w-2/3">
            <motion.div initial={{ y: 20, opacity: 0 }} animate={{ y: 0, opacity: 1 }} transition={{ delay: 0.2 }}>
              <span className="text-[10px] font-black uppercase tracking-[0.2em] mb-3 block" style={{ color: accentColor }}>
                Em Destaque
              </span>
              <h2 className="font-heading font-black text-3xl md:text-5xl text-white mb-4 leading-tight">
                {banner.title}
              </h2>
              <p className="text-white/80 text-sm md:text-base font-medium mb-8 max-w-xl">
                {banner.description}
              </p>
              
              {banner.ctaText && (
                <button 
                  onClick={() => {
                    if (banner.ctaLink.startsWith('http')) window.open(banner.ctaLink, '_blank')
                    else navigate(banner.ctaLink)
                  }}
                  className="inline-flex items-center gap-2 px-6 py-3 text-sm font-bold text-white rounded-[7px] hover:opacity-90 transition-opacity"
                  style={{ backgroundColor: accentColor }}
                >
                  {banner.ctaText} <ArrowRightIcon />
                </button>
              )}
            </motion.div>
          </div>
        </motion.div>
      </AnimatePresence>

      {/* Navigation Controls */}
      {activeBanners.length > 1 && (
        <>
          <button 
            onClick={prev}
            className="absolute left-4 top-1/2 -translate-y-1/2 w-10 h-10 rounded-full bg-black/40 text-white flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity hover:bg-black/60 backdrop-blur-md z-20 border border-white/10"
          >
            <ChevronLeft size={20} />
          </button>
          <button 
            onClick={next}
            className="absolute right-4 top-1/2 -translate-y-1/2 w-10 h-10 rounded-full bg-black/40 text-white flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity hover:bg-black/60 backdrop-blur-md z-20 border border-white/10"
          >
            <ChevronRight size={20} />
          </button>

          {/* Indicators */}
          <div className="absolute bottom-6 left-1/2 -translate-x-1/2 flex items-center gap-2 z-20">
            {activeBanners.map((b, idx) => (
              <button
                key={b.id}
                onClick={() => setCurrentIndex(idx)}
                className={`h-1.5 rounded-full transition-all ${idx === currentIndex ? 'w-6 bg-white' : 'w-2 bg-white/40 hover:bg-white/60'}`}
              />
            ))}
          </div>
        </>
      )}
    </div>
  )
}

// ─── HELPER COMPONENTS ──────────────────────────────────────────────────

// ─── MODERN ORDER ROW ───────────────────────────────────────────────────
function ModernOrderRow({ order, textPrimary, textMuted, statusColor, isDark }: any) {
  return (
    <div className="px-5 py-4 flex items-center gap-4 rounded-[7px] transition-colors hover:bg-black/5 dark:hover:bg-white/5 cursor-pointer">
      <div className="w-12 h-12 rounded-[7px] flex items-center justify-center shrink-0 border" style={{ backgroundColor: isDark ? '#1a1a1a' : '#f4f4f5', borderColor: isDark ? '#333' : '#e5e5e5' }}>
        <ShoppingBag size={20} style={{ color: textPrimary }} />
      </div>
      <div className="flex-1 min-w-0">
        <p className="text-sm font-bold truncate mb-0.5" style={{ color: textPrimary }}>{order.programName}</p>
        <p className="text-[11px] font-semibold uppercase tracking-wider" style={{ color: textMuted }}>
          {order.planName} • {new Date(order.createdAt).toLocaleDateString('pt-PT')}
        </p>
      </div>
      <div className="text-right shrink-0">
        <p className="text-sm font-black" style={{ color: textPrimary }}>
          {new Intl.NumberFormat('pt-PT').format(order.amount)} {order.currency === 'AOA' ? 'Kz' : '€'}
        </p>
        <div className="flex items-center justify-end gap-1.5 mt-1">
          <div className="w-2 h-2 rounded-full" style={{ backgroundColor: statusColor[order.status] || '#888' }} />
          <span className="text-[10px] font-bold uppercase tracking-wider" style={{ color: statusColor[order.status] || '#888' }}>
            {order.status}
          </span>
        </div>
      </div>
    </div>
  )
}

// ─── PROFILE TAB ─────────────────────────────────────────────────────────
function ProfileTab({ user, updateProfile, cardBg, borderColor, textPrimary, textMuted, isDark }: any) {
  const [editing, setEditing] = useState(false)
  const [form, setForm] = useState({ name: user.name, phone: user.phone || '', address: user.address || '' })
  const inputBg = isDark ? '#1a1a1f' : '#f4f4f5'
  const accentColor = '#D71920'

  const handleSave = () => {
    updateProfile(form)
    setEditing(false)
  }

  return (
    <div className="rounded-[7px] overflow-hidden" style={{ backgroundColor: cardBg, border: `1px solid ${borderColor}` }}>
      <div className="px-8 py-6 border-b flex items-center justify-between" style={{ borderColor }}>
        <h2 className="font-heading font-bold text-lg" style={{ color: textPrimary }}>Os Meus Dados</h2>
        <button
          onClick={() => editing ? handleSave() : setEditing(true)}
          className="flex items-center gap-2 text-sm font-bold px-5 py-2.5 rounded-[7px] transition-colors shadow-sm hover:shadow-md"
          style={{ backgroundColor: editing ? textPrimary : inputBg, color: editing ? (isDark ? '#000' : '#fff') : textPrimary }}
        >
          {editing ? <><Save size={16} /> Guardar Alterações</> : <><Edit3 size={16} /> Atualizar Perfil</>}
        </button>
      </div>

      <div className="p-8 space-y-8">
        {/* Avatar */}
        <div className="flex items-center gap-6">
          <div className="w-24 h-24 rounded-full flex items-center justify-center font-heading font-black text-4xl text-white shrink-0 shadow-lg" style={{ backgroundColor: accentColor }}>
            {user.name?.charAt(0).toUpperCase()}
          </div>
          <div>
            <p className="font-heading font-bold text-2xl mb-1" style={{ color: textPrimary }}>{user.name}</p>
            <p className="text-sm font-medium mb-3" style={{ color: textMuted }}>{user.email}</p>
            <span className="text-[10px] font-bold uppercase tracking-widest px-3 py-1 rounded-full" style={{ backgroundColor: user.role === 'admin' ? 'rgba(215,25,32,0.1)' : (isDark ? '#222' : '#eee'), color: user.role === 'admin' ? accentColor : textPrimary }}>
              {user.role === 'admin' ? 'Acesso Administrativo' : 'Membro Padrão'}
            </span>
          </div>
        </div>

        {/* Fields */}
        <div className="space-y-5">
          {[
            { label: 'Nome completo', key: 'name', type: 'text' },
            { label: 'Telemóvel', key: 'phone', type: 'tel' },
            { label: 'Morada de Faturação', key: 'address', type: 'text' },
          ].map(f => (
            <div key={f.key}>
              <label className="block text-xs font-bold uppercase tracking-widest mb-2" style={{ color: textMuted }}>{f.label}</label>
              {editing ? (
                <input
                  type={f.type}
                  value={(form as any)[f.key]}
                  onChange={e => setForm(prev => ({ ...prev, [f.key]: e.target.value }))}
                  className="w-full h-12 px-4 text-sm font-medium rounded-[7px] outline-none transition-colors focus:border-red-500"
                  style={{ backgroundColor: inputBg, border: `1px solid ${borderColor}`, color: textPrimary }}
                />
              ) : (
                <p className="text-base font-medium py-3 px-4 rounded-[7px] border border-transparent" style={{ backgroundColor: inputBg, color: (form as any)[f.key] ? textPrimary : textMuted }}>
                  {(form as any)[f.key] || 'Não definido'}
                </p>
              )}
            </div>
          ))}
        </div>

        {editing && (
          <div className="pt-4 flex justify-end">
            <button onClick={() => setEditing(false)} className="text-sm font-bold transition-opacity hover:opacity-70" style={{ color: textMuted }}>
              Cancelar Edição
            </button>
          </div>
        )}
      </div>
    </div>
  )
}
