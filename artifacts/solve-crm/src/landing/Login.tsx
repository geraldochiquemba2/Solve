import { useState } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import { Eye, EyeOff, Mail, Lock, User, ArrowRight, X, Phone } from 'lucide-react'
import { useAuth } from './context/AuthContext'
import { useLocation } from 'wouter'
import logoBlack from './logo/Logo Bruno Samora Top Performance Black!.png'
import logoWhite from './logo/Logo Bruno Samora Top Performance White.png'
import { useTheme } from './context/ThemeContext'

type Tab = 'login' | 'register'

export default function Login() {
  const { login, register } = useAuth()
  const { isDark } = useTheme()
  const [, navigate] = useLocation()
  const [tab, setTab] = useState<Tab>('login')
  const [showPass, setShowPass] = useState(false)
  const [showConfirm, setShowConfirm] = useState(false)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)

  // Login fields
  const [loginIdentifier, setLoginIdentifier] = useState('')
  const [loginPassword, setLoginPassword] = useState('')

  // Register fields
  const [regName, setRegName] = useState('')
  const [regEmail, setRegEmail] = useState('')
  const [regPassword, setRegPassword] = useState('')
  const [regConfirm, setRegConfirm] = useState('')

  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault()
    setError(null)
    setLoading(true)
    const res = await login(loginIdentifier, loginPassword)
    setLoading(false)
    if (!res.success) { setError(res.error || 'Erro ao entrar.'); return }
    if (res.user?.role === 'admin') navigate('/admin')
    else navigate('/dashboard')
  }

  const handleRegister = async (e: React.FormEvent) => {
    e.preventDefault()
    setError(null)
    if (regPassword !== regConfirm) { setError('As palavras-passe não coincidem.'); return }
    if (regPassword.length < 6) { setError('A palavra-passe deve ter pelo menos 6 caracteres.'); return }
    setLoading(true)
    const res = await register(regName, regEmail, regPassword)
    setLoading(false)
    if (!res.success) { setError(res.error || 'Erro ao registar.'); return }
    if (res.user?.role === 'admin') navigate('/admin')
    else navigate('/dashboard')
  }

  const bg = isDark ? '#09090b' : '#f5f5f7'
  const cardBg = isDark ? '#111113' : '#ffffff'
  const textPrimary = isDark ? '#f4f4f5' : '#18181b'
  const textMuted = isDark ? '#a1a1aa' : '#71717a'
  const borderColor = isDark ? 'rgba(255,255,255,0.08)' : 'rgba(0,0,0,0.08)'
  const inputBg = isDark ? '#1a1a1f' : '#f9f9fb'

  return (
    <div className="min-h-screen flex items-center justify-center pt-[68px] px-4" style={{ backgroundColor: bg }}>
      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.5, ease: [0.16, 1, 0.3, 1] }}
        className="w-full max-w-md"
      >
        {/* Card */}
        <div className="rounded-[7px] overflow-hidden shadow-[0_24px_64px_rgba(0,0,0,0.12)]" style={{ backgroundColor: cardBg, border: `1px solid ${borderColor}` }}>

          {/* Header */}
          <div className="px-8 pt-8 pb-0 text-center">
            <img src={isDark ? logoWhite : logoBlack} alt="Bruno Samora" className="h-10 mx-auto mb-6 object-contain" />
            <h1 className="font-heading font-bold text-2xl mb-1" style={{ color: textPrimary }}>
              {tab === 'login' ? 'Bem-vindo de volta' : 'Criar conta'}
            </h1>
            <p className="text-sm mb-6" style={{ color: textMuted }}>
              {tab === 'login' ? 'Acede à tua área pessoal.' : 'Junta-te ao universo Bruno Samora.'}
            </p>

            {/* Tabs */}
            <div className="flex rounded-[7px] p-1 mb-6" style={{ backgroundColor: isDark ? '#1a1a1f' : '#f0f0f2' }}>
              {(['login', 'register'] as Tab[]).map(t => (
                <button
                  key={t}
                  onClick={() => { setTab(t); setError(null) }}
                  className="flex-1 py-2 text-sm font-semibold transition-all duration-200 rounded-[5px]"
                  style={{
                    backgroundColor: tab === t ? (isDark ? '#27272a' : '#ffffff') : 'transparent',
                    color: tab === t ? textPrimary : textMuted,
                    boxShadow: tab === t ? '0 1px 4px rgba(0,0,0,0.1)' : 'none',
                  }}
                >
                  {t === 'login' ? 'Entrar' : 'Registar'}
                </button>
              ))}
            </div>
          </div>

          {/* Forms */}
          <div className="px-8 pb-8">
            <AnimatePresence mode="wait">
              {error && (
                <motion.div
                  key="error"
                  initial={{ opacity: 0, y: -8 }}
                  animate={{ opacity: 1, y: 0 }}
                  exit={{ opacity: 0 }}
                  className="flex items-center justify-between gap-2 mb-4 px-4 py-3 rounded-[7px] text-sm font-medium"
                  style={{ backgroundColor: 'rgba(215,25,32,0.08)', color: '#D71920', border: '1px solid rgba(215,25,32,0.2)' }}
                >
                  <span>{error}</span>
                  <button onClick={() => setError(null)}><X size={14} /></button>
                </motion.div>
              )}
            </AnimatePresence>

            <AnimatePresence mode="wait">
              {tab === 'login' ? (
                <motion.form
                  key="login"
                  initial={{ opacity: 0, x: -16 }}
                  animate={{ opacity: 1, x: 0 }}
                  exit={{ opacity: 0, x: 16 }}
                  transition={{ duration: 0.25 }}
                  onSubmit={handleLogin}
                  className="space-y-4"
                >
                  <Field
                    label="Email ou Telefone" type="text" value={loginIdentifier}
                    onChange={setLoginIdentifier} placeholder="exemplo@email.com ou 999999999"
                    icon={<Mail size={16} />} inputBg={inputBg}
                    textPrimary={textPrimary} textMuted={textMuted} borderColor={borderColor}
                  />
                  <Field
                    label="Palavra-passe" type={showPass ? 'text' : 'password'}
                    value={loginPassword} onChange={setLoginPassword} placeholder="••••••••"
                    icon={<Lock size={16} />} inputBg={inputBg}
                    textPrimary={textPrimary} textMuted={textMuted} borderColor={borderColor}
                    endIcon={
                      <button type="button" onClick={() => setShowPass(!showPass)} style={{ color: textMuted }}>
                        {showPass ? <EyeOff size={16} /> : <Eye size={16} />}
                      </button>
                    }
                  />
                  <SubmitBtn loading={loading}>Entrar na Conta</SubmitBtn>
                </motion.form>
              ) : (
                <motion.form
                  key="register"
                  initial={{ opacity: 0, x: 16 }}
                  animate={{ opacity: 1, x: 0 }}
                  exit={{ opacity: 0, x: -16 }}
                  transition={{ duration: 0.25 }}
                  onSubmit={handleRegister}
                  className="space-y-4"
                >
                  <Field
                    label="Nome completo" type="text" value={regName}
                    onChange={setRegName} placeholder="O teu nome"
                    icon={<User size={16} />} inputBg={inputBg}
                    textPrimary={textPrimary} textMuted={textMuted} borderColor={borderColor}
                  />
                  <Field
                    label="Email" type="email" value={regEmail}
                    onChange={setRegEmail} placeholder="exemplo@email.com"
                    icon={<Mail size={16} />} inputBg={inputBg}
                    textPrimary={textPrimary} textMuted={textMuted} borderColor={borderColor}
                  />
                  <Field
                    label="Palavra-passe" type={showPass ? 'text' : 'password'}
                    value={regPassword} onChange={setRegPassword} placeholder="Mínimo 6 caracteres"
                    icon={<Lock size={16} />} inputBg={inputBg}
                    textPrimary={textPrimary} textMuted={textMuted} borderColor={borderColor}
                    endIcon={
                      <button type="button" onClick={() => setShowPass(!showPass)} style={{ color: textMuted }}>
                        {showPass ? <EyeOff size={16} /> : <Eye size={16} />}
                      </button>
                    }
                  />
                  <Field
                    label="Confirmar palavra-passe" type={showConfirm ? 'text' : 'password'}
                    value={regConfirm} onChange={setRegConfirm} placeholder="Repete a palavra-passe"
                    icon={<Lock size={16} />} inputBg={inputBg}
                    textPrimary={textPrimary} textMuted={textMuted} borderColor={borderColor}
                    endIcon={
                      <button type="button" onClick={() => setShowConfirm(!showConfirm)} style={{ color: textMuted }}>
                        {showConfirm ? <EyeOff size={16} /> : <Eye size={16} />}
                      </button>
                    }
                  />
                  <SubmitBtn loading={loading}>Criar Conta</SubmitBtn>
                </motion.form>
              )}
            </AnimatePresence>

            {/* Footer note */}
            <p className="text-center text-xs mt-6" style={{ color: textMuted }}>
              {tab === 'login' ? (
                <>Não tens conta?{' '}
                  <button onClick={() => setTab('register')} className="font-semibold" style={{ color: '#D71920' }}>Registar</button>
                </>
              ) : (
                <>Já tens conta?{' '}
                  <button onClick={() => setTab('login')} className="font-semibold" style={{ color: '#D71920' }}>Entrar</button>
                </>
              )}
            </p>
          </div>
        </div>

        {/* Admin hint */}
        <p className="text-center text-[11px] mt-4" style={{ color: textMuted }}>
          Admin: admin / 999999999 · Password: 1234567890
        </p>
      </motion.div>
    </div>
  )
}

// ─── SUB-COMPONENTS ───────────────────────────────────────────────────────
interface FieldProps {
  label: string; type: string; value: string
  onChange: (v: string) => void; placeholder: string
  icon: React.ReactNode; endIcon?: React.ReactNode
  inputBg: string; textPrimary: string; textMuted: string; borderColor: string
}

function Field({ label, type, value, onChange, placeholder, icon, endIcon, inputBg, textPrimary, textMuted, borderColor }: FieldProps) {
  return (
    <div>
      <label className="block text-xs font-semibold uppercase tracking-wider mb-1.5" style={{ color: textMuted }}>{label}</label>
      <div className="relative">
        <span className="absolute left-3 top-1/2 -translate-y-1/2" style={{ color: textMuted }}>{icon}</span>
        <input
          required type={type} value={value}
          onChange={e => onChange(e.target.value)}
          placeholder={placeholder}
          className="w-full h-11 pl-10 pr-10 text-sm outline-none transition-all rounded-[7px]"
          style={{ backgroundColor: inputBg, border: `1px solid ${borderColor}`, color: textPrimary }}
          onFocus={e => { (e.target as HTMLInputElement).style.borderColor = '#D71920' }}
          onBlur={e => { (e.target as HTMLInputElement).style.borderColor = borderColor }}
        />
        {endIcon && (
          <span className="absolute right-3 top-1/2 -translate-y-1/2">{endIcon}</span>
        )}
      </div>
    </div>
  )
}

function SubmitBtn({ children, loading }: { children: React.ReactNode; loading: boolean }) {
  return (
    <button
      type="submit"
      disabled={loading}
      className="w-full h-12 flex items-center justify-center gap-2 font-heading font-bold text-sm text-white transition-all rounded-[7px] mt-2"
      style={{ backgroundColor: loading ? '#999' : '#D71920', boxShadow: loading ? 'none' : '0 4px 20px rgba(215,25,32,0.3)', cursor: loading ? 'not-allowed' : 'pointer' }}
    >
      {loading ? (
        <div className="w-5 h-5 border-2 border-white/30 border-t-white rounded-full animate-spin" />
      ) : (
        <>{children} <ArrowRight size={16} /></>
      )}
    </button>
  )
}
