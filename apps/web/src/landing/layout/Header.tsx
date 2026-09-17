import { useState, useEffect, useRef } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import { Menu, X, User, LogOut, LayoutDashboard, Shield } from 'lucide-react'
import { Link, useLocation } from 'wouter'
import { useScrollProgress } from '../hooks/useScrollProgress'
import { useTheme } from '../context/ThemeContext'
import { useAuth } from '../context/AuthContext'
import ThemeToggle from '../ui/ThemeToggle'
import solveAccessLogo from '../logo/Solve-Access.jpeg'

// CRM: header sem navegação pública (sem INÍCIO/FITMOTIVAÇÃO/FORMAÇÃO/STORE/FITWORKOUT)

export default function Header() {
  const { scrolled } = useScrollProgress()
  const [mobileOpen, setMobileOpen] = useState(false)
  const [userMenuOpen, setUserMenuOpen] = useState(false)
  const [location, navigate] = useLocation()
  const { isDark } = useTheme()
  const { isAuthenticated, isAdmin, logout } = useAuth()
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
              aria-label="Solve Access"
            >
              <img
                src={solveAccessLogo}
                alt="Solve Access Logo"
                className="h-10 w-auto object-contain group-hover:opacity-80 transition-opacity"
                style={{ backgroundColor: '#fff', borderRadius: 6, padding: '2px 8px' }}
              />
            </Link>

            <div className="hidden lg:flex flex-1" />

            {/* ── CTAs ── */}
            <div className="hidden lg:flex items-center gap-2 flex-shrink-0 ml-2">
              <ThemeToggle />

              {/* Auth Button */}
              {isAuthenticated ? (
                <div className="relative" ref={userMenuRef}>
                  <button
                    onClick={() => setUserMenuOpen(!userMenuOpen)}
                    className="flex items-center gap-2 px-3 py-1.5 rounded-[7px] transition-colors text-sm font-semibold"
                    style={{ backgroundColor: isDark ? '#1a1a1f' : '#f0f0f2', color: textPrimary }}
                  >
                    <User size={16} />
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
                            style={{ color: '#042251' }}
                            onMouseEnter={e => (e.currentTarget as HTMLElement).style.backgroundColor = isDark ? '#1a1a1f' : '#f9f9fb'}
                            onMouseLeave={e => (e.currentTarget as HTMLElement).style.backgroundColor = 'transparent'}
                          >
                            <Shield size={15} /> Painel Bruno
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
              ) : location === '/login' ? null : (
                <Link to="/login"
                  className="flex items-center gap-1.5 px-4 py-2 rounded-[7px] text-sm font-bold transition-colors"
                  style={{ backgroundColor: '#042251', color: '#fff', boxShadow: '0 2px 12px rgba(4,34,81,0.3)' }}
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
                <img src={solveAccessLogo} alt="Solve Access" className="h-8 w-auto object-contain" style={{ backgroundColor: '#fff', borderRadius: 6, padding: '2px 6px' }} />
                <span className="font-heading font-bold text-sm" style={{ color: textPrimary }}>Solve Access</span>
              </div>

              <div className="mt-auto flex flex-col gap-2.5 pt-5" style={{ borderTop: `1px solid ${dividerColor}` }}>
                {/* Theme toggle in mobile */}
                <div className="flex items-center justify-between px-3 py-2">
                  <span className="font-body text-xs uppercase tracking-wider" style={{ color: textMuted }}>Tema</span>
                  <ThemeToggle />
                </div>
                {isAuthenticated ? (
                  <>
                    <Link to={isAdmin ? '/admin' : '/dashboard'} onClick={() => setMobileOpen(false)}
                      className="flex items-center justify-center gap-2 font-body font-semibold text-[12px] tracking-wide uppercase text-white bg-[#042251] py-3 hover:bg-[#0A3A75] transition-colors rounded-sm">
                      <User size={16} /> {isAdmin ? 'Painel Bruno' : 'Minha conta'}
                    </Link>
                    <button onClick={() => { logout(); setMobileOpen(false); navigate('/') }}
                      className="flex items-center justify-center gap-2 font-body font-semibold text-[12px] tracking-wide uppercase py-3 transition-colors rounded-sm"
                      style={{ color: textMuted, border: `1px solid ${dividerColor}` }}>
                      <LogOut size={16} /> Sair
                    </button>
                  </>
                ) : (
                  <>
                    {location !== '/login' && (
                    <Link to="/login" onClick={() => setMobileOpen(false)}
                      className="flex items-center justify-center gap-2 font-body font-semibold text-[12px] tracking-wide uppercase text-white bg-[#042251] py-3 hover:bg-[#0A3A75] transition-colors rounded-sm">
                      <User size={16} /> Entrar
                    </Link>
                    )}
                    <Link to="/login?tab=register" onClick={() => setMobileOpen(false)}
                      className="flex items-center justify-center gap-2 font-body font-semibold text-[12px] tracking-wide uppercase py-3 transition-colors rounded-sm"
                      style={{ color: textPrimary, border: `1px solid ${dividerColor}` }}>
                      Criar conta
                    </Link>
                  </>
                )}
              </div>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>
    </>
  )
}
