import { useState, useEffect, useRef } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import { Menu, X, Home, Mic, GraduationCap, ShoppingBag, Dumbbell, Building2, User, LogOut, LayoutDashboard, Shield } from 'lucide-react'
import { Link, useLocation } from 'wouter'
import { useScrollProgress } from '../hooks/useScrollProgress'
import { useCart } from '../context/CartContext'
import { useTheme } from '../context/ThemeContext'
import { useAuth } from '../context/AuthContext'
import ThemeToggle from '../ui/ThemeToggle'
import logoWhite from '../logo/Logo Bruno Samora Top Performance White.png'
import logoBlack from '../logo/Logo Bruno Samora Top Performance Black!.png'

const navLinks = [
  { label: 'INÍCIO', href: '/', icon: Home },
  { label: 'FITMOTIVAÇÃO', href: '/fit-motivacao', icon: Mic },
  { label: 'FORMAÇÃO', href: '/formacao', icon: GraduationCap },
  { label: 'STORE', href: '/store', icon: ShoppingBag },
  { label: 'FITWORKOUT', href: '/fit-workout', icon: Dumbbell },
  { label: 'FITSTUDIO', href: '/fit-studio', icon: Building2 },
]

export default function Header() {
  const { scrolled } = useScrollProgress()
  const [mobileOpen, setMobileOpen] = useState(false)
  const [userMenuOpen, setUserMenuOpen] = useState(false)
  const [location] = useLocation()
  const [, navigate] = useLocation()
  const { cart, setCartOpen } = useCart()
  const { isDark } = useTheme()
  const { user, isAuthenticated, isAdmin, logout } = useAuth()
  const cartItemCount = cart.reduce((acc, item) => acc + item.quantity, 0)
  const userMenuRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    const handleResize = () => {
      if (window.innerWidth >= 1024) setMobileOpen(false)
    }
    window.addEventListener('resize', handleResize)
    return () => window.removeEventListener('resize', handleResize)
  }, [])

  const handleNavClick = () => {
    setMobileOpen(false)
    window.scrollTo({ top: 0, behavior: 'smooth' })
  }

  // Dynamic styles based on theme state
  const headerBg = isDark ? 'rgba(9,9,11,0.92)' : 'rgba(255,255,255,0.92)'
  const textPrimary = isDark ? '#f4f4f5' : '#18181b'
  const textMuted = isDark ? '#a1a1aa' : '#71717a'
  const dividerColor = isDark ? 'rgba(255,255,255,0.1)' : 'rgba(0,0,0,0.08)'
  const activeBg = isDark ? '#27272a' : '#f4f4f5'
  const hoverBg = isDark ? '#27272a' : '#f9f9f9'
  const cartBg = isDark ? '#27272a' : 'transparent'

  return (
    <>
      <header
        className="fixed top-0 left-0 right-0 z-50 transition-all duration-300 backdrop-blur-2xl"
        style={{
          backgroundColor: headerBg,
          boxShadow: isDark
            ? '0 1px 0 rgba(255,255,255,0.06), 0 8px 40px rgba(0,0,0,0.2)'
            : '0 1px 0 rgba(0,0,0,0.06), 0 8px 40px rgba(0,0,0,0.05)',
        }}
      >
        <div className="container-custom">
          <div className="flex items-center h-[68px] gap-4">

            {/* ── LOGO ── */}
            <Link
              to="/"
              onClick={handleNavClick}
              className="flex items-center group flex-shrink-0 mr-4"
              aria-label="Bruno Samora"
            >
              <img
                src={isDark ? logoWhite : logoBlack}
                alt="Bruno Samora Logo"
                className="h-10 w-auto object-contain group-hover:opacity-80 transition-opacity"
                style={{ filter: isDark ? 'invert(0)' : 'none' }}
              />
            </Link>

            {/* ── VERTICAL DIVIDER ── */}
            <div className="hidden lg:block w-px h-[22px] flex-shrink-0" style={{ backgroundColor: dividerColor }} />

            {/* ── NAV LINKS ── */}
            <nav className="hidden lg:flex items-center gap-0.5 flex-1 justify-center" aria-label="Navegação principal">
              {navLinks.map((link) => {
                const isActive = location === link.href || (link.href !== '/' && location.startsWith(link.href))
                return (
                  <Link
                    key={link.label}
                    to={link.href}
                    onClick={handleNavClick}
                    className="relative px-3 py-1.5 text-[11px] uppercase tracking-wider font-body font-semibold transition-all duration-200 whitespace-nowrap flex items-center gap-1.5 rounded-sm"
                    style={{
                      color: isActive ? textPrimary : textMuted,
                      backgroundColor: isActive ? activeBg : 'transparent',
                    }}
                    onMouseEnter={e => { if (!isActive) (e.currentTarget as HTMLElement).style.backgroundColor = hoverBg }}
                    onMouseLeave={e => { if (!isActive) (e.currentTarget as HTMLElement).style.backgroundColor = 'transparent' }}
                  >
                    <link.icon size={14} style={{ color: isActive ? '#D71920' : textMuted }} />
                    {link.label}
                    {isActive && (
                      <motion.span
                        layoutId="nav-active"
                        className="absolute bottom-0.5 left-1/2 -translate-x-1/2 w-1 h-1 bg-[#D71920] rounded-full"
                        transition={{ type: 'spring', stiffness: 400, damping: 30 }}
                      />
                    )}
                  </Link>
                )
              })}
            </nav>

            {/* ── VERTICAL DIVIDER ── */}
            <div className="hidden lg:block w-px h-[22px] flex-shrink-0" style={{ backgroundColor: dividerColor }} />

            {/* ── CTAs ── */}
            <div className="hidden lg:flex items-center gap-2 flex-shrink-0 ml-2">
              <ThemeToggle />

              <button
                onClick={() => setCartOpen(true)}
                className="relative w-10 h-10 rounded-full transition-colors flex items-center justify-center"
                style={{ color: textPrimary, backgroundColor: cartBg }}
                aria-label="Abrir carrinho"
              >
                <ShoppingBag size={20} />
                {cartItemCount > 0 && (
                  <span className="absolute top-0 right-0 bg-[#D71920] text-white text-[10px] font-bold w-4 h-4 rounded-full flex items-center justify-center">
                    {cartItemCount}
                  </span>
                )}
              </button>

              {/* Auth Button */}
              {isAuthenticated ? (
                <div className="relative" ref={userMenuRef}>
                  <button
                    onClick={() => setUserMenuOpen(!userMenuOpen)}
                    className="flex items-center gap-2 px-3 py-1.5 rounded-[7px] transition-colors text-sm font-semibold"
                    style={{ backgroundColor: isDark ? '#1a1a1f' : '#f0f0f2', color: textPrimary }}
                  >
                    <div className="w-6 h-6 rounded-full flex items-center justify-center text-white text-xs font-black" style={{ backgroundColor: '#D71920' }}>
                      {user?.name?.charAt(0).toUpperCase()}
                    </div>
                    {user?.name?.split(' ')[0]}
                  </button>
                  <AnimatePresence>
                    {userMenuOpen && (
                      <motion.div
                        initial={{ opacity: 0, y: 8, scale: 0.96 }}
                        animate={{ opacity: 1, y: 0, scale: 1 }}
                        exit={{ opacity: 0, y: 8, scale: 0.96 }}
                        transition={{ duration: 0.15 }}
                        className="absolute right-0 top-full mt-2 w-48 rounded-[7px] shadow-xl overflow-hidden z-50"
                        style={{ backgroundColor: isDark ? '#111113' : '#ffffff', border: `1px solid ${dividerColor}` }}
                      >
                        {!isAdmin && (
                          <Link to="/dashboard" onClick={() => setUserMenuOpen(false)}
                            className="flex items-center gap-2.5 px-4 py-2.5 text-sm font-medium transition-colors"
                            style={{ color: textPrimary }}
                            onMouseEnter={e => (e.currentTarget as HTMLElement).style.backgroundColor = isDark ? '#1a1a1f' : '#f9f9fb'}
                            onMouseLeave={e => (e.currentTarget as HTMLElement).style.backgroundColor = 'transparent'}
                          >
                            <LayoutDashboard size={15} /> Dashboard
                          </Link>
                        )}
                        {isAdmin && (
                          <Link to="/admin" onClick={() => setUserMenuOpen(false)}
                            className="flex items-center gap-2.5 px-4 py-2.5 text-sm font-medium transition-colors"
                            style={{ color: '#D71920' }}
                            onMouseEnter={e => (e.currentTarget as HTMLElement).style.backgroundColor = isDark ? '#1a1a1f' : '#f9f9fb'}
                            onMouseLeave={e => (e.currentTarget as HTMLElement).style.backgroundColor = 'transparent'}
                          >
                            <Shield size={15} /> Admin CMS
                          </Link>
                        )}
                        <div style={{ height: 1, backgroundColor: dividerColor, margin: '2px 0' }} />
                        <button
                          onClick={() => { logout(); setUserMenuOpen(false); navigate('/') }}
                          className="w-full flex items-center gap-2.5 px-4 py-2.5 text-sm font-medium transition-colors"
                          style={{ color: '#ef4444' }}
                          onMouseEnter={e => (e.currentTarget as HTMLElement).style.backgroundColor = isDark ? '#1a1a1f' : '#f9f9fb'}
                          onMouseLeave={e => (e.currentTarget as HTMLElement).style.backgroundColor = 'transparent'}
                        >
                          <LogOut size={15} /> Sair
                        </button>
                      </motion.div>
                    )}
                  </AnimatePresence>
                </div>
              ) : (
                <Link to="/login"
                  className="flex items-center gap-1.5 px-4 py-2 rounded-[7px] text-sm font-bold transition-colors"
                  style={{ backgroundColor: '#D71920', color: '#fff', boxShadow: '0 2px 12px rgba(215,25,32,0.3)' }}
                >
                  <User size={14} /> Entrar
                </Link>
              )}
            </div>

            {/* ── MOBILE HAMBURGER ── */}
            <div className="lg:hidden ml-auto">
              <button
                className="w-9 h-9 flex items-center justify-center rounded-sm transition-colors"
                style={{ backgroundColor: activeBg, color: textPrimary, border: `1px solid ${dividerColor}` }}
                onClick={() => setMobileOpen(!mobileOpen)}
                aria-label={mobileOpen ? 'Fechar menu' : 'Abrir menu'}
                aria-expanded={mobileOpen}
              >
                {mobileOpen ? <X size={16} /> : <Menu size={16} />}
              </button>
            </div>
          </div>
        </div>
      </header>

      {/* ── MOBILE DRAWER ── */}
      <AnimatePresence>
        {mobileOpen && (
          <motion.div
            className="fixed inset-0 z-40 lg:hidden"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            transition={{ duration: 0.18 }}
          >
            <div
              className="absolute inset-0 backdrop-blur-sm"
              style={{ backgroundColor: isDark ? 'rgba(0,0,0,0.75)' : 'rgba(255,255,255,0.75)' }}
              onClick={() => setMobileOpen(false)}
            />
            <motion.div
              className="absolute top-0 right-0 bottom-0 w-64 flex flex-col pt-20 pb-7 px-4"
              style={{
                backgroundColor: isDark ? '#09090b' : '#ffffff',
                borderLeft: `1px solid ${dividerColor}`,
              }}
              initial={{ x: '100%' }}
              animate={{ x: 0 }}
              exit={{ x: '100%' }}
              transition={{ type: 'spring', damping: 28, stiffness: 280 }}
            >
              {/* Brand in drawer */}
              <div className="flex items-center gap-2.5 px-3 mb-6 pb-5" style={{ borderBottom: `1px solid ${dividerColor}` }}>
                <div className="w-7 h-7 bg-[#D71920] flex items-center justify-center font-heading font-black text-white text-[10px] rounded-sm">UBS</div>
                <span className="font-heading font-bold text-sm" style={{ color: textPrimary }}>Bruno Samora</span>
              </div>

              <nav className="flex flex-col gap-0.5" aria-label="Navegação mobile">
                {navLinks.map((link) => (
                  <Link
                    key={link.label}
                    to={link.href}
                    onClick={handleNavClick}
                    className="flex items-center gap-3 px-3 py-2.5 font-body font-semibold uppercase tracking-wider transition-all text-[12px] rounded-sm"
                    style={{ color: textMuted }}
                    onMouseEnter={e => (e.currentTarget as HTMLElement).style.backgroundColor = hoverBg}
                    onMouseLeave={e => (e.currentTarget as HTMLElement).style.backgroundColor = 'transparent'}
                  >
                    <link.icon size={16} className="text-[#D71920]" />
                    {link.label}
                  </Link>
                ))}
              </nav>

              <div className="mt-auto flex flex-col gap-2.5 pt-5" style={{ borderTop: `1px solid ${dividerColor}` }}>
                {/* Theme toggle in mobile */}
                <div className="flex items-center justify-between px-3 py-2">
                  <span className="font-body text-xs uppercase tracking-wider" style={{ color: textMuted }}>Tema</span>
                  <ThemeToggle />
                </div>
                <button
                  onClick={() => { setMobileOpen(false); setCartOpen(true) }}
                  className="flex items-center justify-center gap-2 font-body font-semibold text-[12px] tracking-wide uppercase text-white bg-[#D71920] py-3 hover:bg-[#FF3038] transition-colors rounded-sm"
                >
                  <ShoppingBag size={16} />
                  Carrinho ({cartItemCount})
                </button>
              </div>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>
    </>
  )
}
