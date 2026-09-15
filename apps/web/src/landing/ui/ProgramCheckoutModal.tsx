import { useState, useEffect } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import { X, ChevronRight, User, Phone, MapPin, FileText, Package, CreditCard, CheckCircle2, Loader2, ShieldCheck } from 'lucide-react'
import { useAuth } from '../context/AuthContext'
import { useOrders } from '../context/OrderContext'
import { useTheme } from '../context/ThemeContext'
import { createPay4AllPayment } from '../services/pay4all'
import type { Program, Plan } from '../context/CMSContext'

interface Props {
  isOpen: boolean
  onClose: () => void
  program: Program | null
  plans: Plan[]
  initialPlanId?: string
  initialCycle?: 'monthly' | 'quarterly' | 'biannual' | 'annual'
}

type Step = 1 | 2 | 3 | 4 | 5 // 5 = success

export default function ProgramCheckoutModal({ isOpen, onClose, program, plans, initialPlanId, initialCycle }: Props) {
  const { user, isAuthenticated } = useAuth()
  const { addOrder } = useOrders()
  const { isDark } = useTheme()
  const [step, setStep] = useState<Step>(1)
  const [selectedPlan, setSelectedPlan] = useState<Plan | null>(null)
  const [cycle, setCycle] = useState<'monthly' | 'quarterly' | 'biannual' | 'annual'>(initialCycle || 'monthly')
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [orderId, setOrderId] = useState<string | null>(null)

  const [form, setForm] = useState(() => {
    try {
      const saved = localStorage.getItem('samora_checkout_form')
      if (saved) return JSON.parse(saved)
    } catch {}
    return {
      name: user?.name || '',
      email: user?.email || '',
      phone: user?.phone || '',
      nif: '',
    }
  })

  // Persist form to localStorage
  useEffect(() => {
    localStorage.setItem('samora_checkout_form', JSON.stringify(form))
  }, [form])

  // Reset/Initialize state when modal opens
  useEffect(() => {
    if (isOpen) {
      setStep(1)
      setError(null)
      setCycle(initialCycle || 'monthly')
      if (initialPlanId) {
        setSelectedPlan(plans.find(p => p.id === initialPlanId) || plans[0] || null)
      } else if (plans.length === 1) {
        setSelectedPlan(plans[0])
      } else {
        setSelectedPlan(plans[0] || null)
      }
    }
    
    // Scroll lock for background
    if (isOpen) {
      document.body.style.overflow = 'hidden'
    } else {
      document.body.style.overflow = 'unset'
    }
    
    return () => {
      document.body.style.overflow = 'unset'
    }
  }, [isOpen, initialPlanId, initialCycle, plans])

  const cardBg = isDark ? '#111113' : '#ffffff'
  const textPrimary = isDark ? '#f4f4f5' : '#18181b'
  const textMuted = isDark ? '#a1a1aa' : '#71717a'
  const borderColor = isDark ? 'rgba(255,255,255,0.08)' : 'rgba(0,0,0,0.08)'
  const inputBg = isDark ? '#1a1a1f' : '#f9f9fb'

  const formatKz = (v: number) =>
    new Intl.NumberFormat('pt-PT').format(v) + ' Kz'

  const handleClose = () => {
    setStep(1); setError(null)
    onClose()
  }

  const isContactOnly = selectedPlan?.priceMonthly === 0 && selectedPlan?.priceAnnual === 0

  const handleCheckout = async () => {
    if (!program || !selectedPlan) return
    setLoading(true); setError(null)

    // Contact-only plans (Sob Consulta) — just register a contact request
    if (isContactOnly) {
      try {
        const order = addOrder({
          userId: user?.id || 'guest',
          userEmail: form.email,
          userName: form.name,
          programId: program.id,
          programName: program.name,
          planId: selectedPlan.id,
          planName: selectedPlan.name,
          amount: 0,
          currency: selectedPlan.currency,
          status: 'Contacto',
          phone: form.phone,
          nif: form.nif,
        })
        setOrderId(order.id)
        setStep(5)
      } catch {
        setError('Ocorreu um erro ao registar o pedido.')
      } finally {
        setLoading(false)
      }
      return
    }

    const amount = cycle === 'monthly' ? selectedPlan.priceMonthly 
                 : cycle === 'quarterly' ? selectedPlan.priceMonthly * 3 
                 : cycle === 'biannual' ? selectedPlan.priceMonthly * 6 
                 : selectedPlan.priceAnnual
    const cycleLabel = cycle === 'monthly' ? 'Mensal' 
                     : cycle === 'quarterly' ? 'Trimestral' 
                     : cycle === 'biannual' ? 'Semestral' 
                     : 'Anual'

    try {
      const response = await createPay4AllPayment({
        totalAmount: amount,
        customer: { name: form.name, email: form.email, phone: form.phone, address: '', nif: form.nif },
        items: [{ name: `${program.name} — ${selectedPlan.name} (${cycleLabel})`, price: amount, qty: 1 }]
      })
      if (response.success) {
        const order = addOrder({
          userId: user?.id || 'guest',
          userEmail: form.email,
          userName: form.name,
          programId: program.id,
          programName: program.name,
          planId: selectedPlan.id,
          planName: selectedPlan.name,
          amount: amount,
          currency: selectedPlan.currency,
          status: 'Pendente',
          phone: form.phone,
          nif: form.nif,
        })
        setOrderId(order.id)
        setStep(5)
      } else {
        setError('Ocorreu um erro ao processar o pagamento.')
      }
    } catch {
      setError('Erro de comunicação com a Pay4All.')
    } finally {
      setLoading(false)
    }
  }

  const hasPlans = plans.length > 0
  const skipPlanStep = !!initialPlanId || plans.length === 1 || !hasPlans

  const steps = [
    { n: 1, label: 'Dados' },
    ...(!skipPlanStep ? [{ n: 2, label: 'Plano' }] : []),
    ...(isContactOnly ? [] : [{ n: 3, label: 'Ciclo' }]),
    { n: 4, label: isContactOnly ? 'Confirmar' : 'Pagamento' },
  ]

  return (
    <AnimatePresence>
      {isOpen && program && (
        <motion.div
          className="fixed inset-0 z-[70] flex items-center justify-center p-4"
          initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
        >
          <div className="absolute inset-0 bg-black/60 backdrop-blur-sm" onClick={handleClose} />
          <motion.div
            className="relative w-full max-w-xl shadow-2xl overflow-hidden rounded-[7px] max-h-[90vh] flex flex-col"
            style={{ backgroundColor: cardBg }}
            initial={{ scale: 0.95, opacity: 0, y: 20 }}
            animate={{ scale: 1, opacity: 1, y: 0 }}
            exit={{ scale: 0.95, opacity: 0 }}
          >
            {/* Header */}
            <div className="flex items-center justify-between px-6 py-4 border-b" style={{ borderColor }}>
              <div>
                <p className="text-[10px] font-bold uppercase tracking-widest" style={{ color: '#D71920' }}>Inscrição</p>
                <h2 className="font-heading font-bold text-lg" style={{ color: textPrimary }}>{program.name}</h2>
              </div>
              <button onClick={handleClose} className="p-1.5 rounded-[7px] transition-colors" style={{ color: textMuted }}>
                <X size={20} />
              </button>
            </div>

            {/* Stepper (only if not success) */}
            {step < 5 && (
              <div className="flex items-center px-6 py-3 gap-2 border-b overflow-x-auto no-scrollbar" style={{ borderColor }}>
                {steps.map((s, i) => (
                  <div key={s.n} className="flex items-center gap-2 flex-1 min-w-[80px]">
                    <div
                      className="w-6 h-6 rounded-full flex items-center justify-center text-xs font-bold shrink-0"
                      style={{
                        backgroundColor: step >= s.n ? '#D71920' : (isDark ? '#1a1a1f' : '#f0f0f2'),
                        color: step >= s.n ? '#fff' : textMuted,
                      }}
                    >
                      {step > s.n ? <CheckCircle2 size={14} /> : s.n}
                    </div>
                    <span className="text-xs font-medium hidden sm:block truncate" style={{ color: step >= s.n ? textPrimary : textMuted }}>{s.label}</span>
                    {i < steps.length - 1 && <div className="flex-1 h-px min-w-[20px]" style={{ backgroundColor: step > s.n ? '#D71920' : borderColor }} />}
                  </div>
                ))}
              </div>
            )}

            {/* Body */}
            <div className="flex-1 overflow-y-auto min-h-0" data-lenis-prevent="true">
              <AnimatePresence mode="wait">

                {/* STEP 1 — Dados Pessoais */}
                {step === 1 && (
                  <motion.div key="s1" {...fadeSlide} className="p-6 space-y-4">
                    <h3 className="font-heading font-bold" style={{ color: textPrimary }}>Os teus dados</h3>
                    {[
                      { label: 'Nome completo', key: 'name', type: 'text', icon: <User size={15} />, placeholder: 'O teu nome' },
                      { label: 'Email', key: 'email', type: 'email', icon: <FileText size={15} />, placeholder: 'exemplo@email.com' },
                      { label: 'Telemóvel', key: 'phone', type: 'tel', icon: <Phone size={15} />, placeholder: '+244 ...' },
                      { label: 'NIF (opcional)', key: 'nif', type: 'text', icon: <MapPin size={15} />, placeholder: 'Número de contribuinte' },
                    ].map(f => (
                      <div key={f.key}>
                        <label className="block text-xs font-semibold uppercase tracking-wider mb-1.5" style={{ color: textMuted }}>{f.label}</label>
                        <div className="relative">
                          <span className="absolute left-3 top-1/2 -translate-y-1/2" style={{ color: textMuted }}>{f.icon}</span>
                          <input
                            required={f.key !== 'nif'}
                            type={f.type}
                            value={(form as any)[f.key]}
                            onChange={e => setForm((p: typeof form) => ({ ...p, [f.key]: e.target.value }))}
                            placeholder={f.placeholder}
                            className="w-full h-10 pl-9 pr-3 text-sm rounded-[7px] outline-none"
                            style={{ backgroundColor: inputBg, border: `1px solid ${borderColor}`, color: textPrimary }}
                          />
                        </div>
                      </div>
                    ))}
                  </motion.div>
                )}

                {/* STEP 2 — Plano */}
                {step === 2 && !skipPlanStep && (
                  <motion.div key="s2" {...fadeSlide} className="p-6 space-y-3">
                    <h3 className="font-heading font-bold mb-4" style={{ color: textPrimary }}>Escolhe o teu plano</h3>
                    {plans.length === 0 ? (
                      <p className="text-sm text-center py-8" style={{ color: textMuted }}>Nenhum plano disponível para este programa.</p>
                    ) : plans.map(plan => (
                      <button
                        key={plan.id}
                        onClick={() => setSelectedPlan(plan)}
                        className="w-full text-left p-4 rounded-[7px] border transition-all"
                        style={{
                          backgroundColor: selectedPlan?.id === plan.id ? (isDark ? '#1a1a1f' : '#fff8f8') : 'transparent',
                          borderColor: selectedPlan?.id === plan.id ? '#D71920' : borderColor,
                          boxShadow: selectedPlan?.id === plan.id ? '0 0 0 1px #D71920' : 'none',
                        }}
                      >
                        <div className="flex justify-between items-start mb-2">
                          <div>
                            <span className="font-heading font-bold text-sm" style={{ color: textPrimary }}>{plan.name}</span>
                            {plan.highlighted && (
                              <span className="ml-2 text-[9px] font-black uppercase tracking-wider px-2 py-0.5 rounded-full" style={{ backgroundColor: '#D71920', color: '#fff' }}>Popular</span>
                            )}
                          </div>
                          <span className="font-heading font-black text-lg" style={{ color: '#D71920' }}>
                            {formatKz(plan.priceMonthly)}<span className="text-xs font-normal" style={{ color: textMuted }}>/mês</span>
                          </span>
                        </div>
                        <ul className="space-y-1">
                          {plan.features.map((f, i) => (
                            <li key={i} className="flex items-center gap-1.5 text-xs" style={{ color: textMuted }}>
                              <CheckCircle2 size={11} style={{ color: '#10b981', flexShrink: 0 }} /> {f}
                            </li>
                          ))}
                        </ul>
                      </button>
                    ))}
                  </motion.div>
                )}

                {/* STEP 3 — Ciclo (skip for contact-only plans) */}
                {step === 3 && selectedPlan && !isContactOnly && (
                  <motion.div key="s3" {...fadeSlide} className="p-6 space-y-4">
                    <h3 className="font-heading font-bold mb-4" style={{ color: textPrimary }}>Escolhe o teu ciclo</h3>
                    
                    {[
                      { id: 'monthly', title: 'Mensal', price: selectedPlan.priceMonthly, label: 'cobrado mensalmente' },
                      { id: 'quarterly', title: 'Trimestral', price: selectedPlan.priceMonthly * 3, label: 'cobrado a cada 3 meses' },
                      { id: 'biannual', title: 'Semestral', price: selectedPlan.priceMonthly * 6, label: 'cobrado a cada 6 meses' },
                      { 
                        id: 'annual', 
                        title: 'Anual', 
                        price: selectedPlan.priceAnnual, 
                        label: 'cobrado anualmente',
                        discount: Math.round(((selectedPlan.priceMonthly * 12 - selectedPlan.priceAnnual) / (selectedPlan.priceMonthly * 12)) * 100) 
                      }
                    ].map(opt => (
                      <div 
                        key={opt.id}
                        onClick={() => setCycle(opt.id as any)}
                        className="relative p-4 border rounded-[7px] cursor-pointer transition-all hover:border-red-500"
                        style={{ 
                          borderColor: cycle === opt.id ? '#D71920' : borderColor,
                          backgroundColor: cycle === opt.id ? (isDark ? '#2d1115' : '#fff5f5') : cardBg
                        }}
                      >
                        {cycle === opt.id && (
                          <div className="absolute top-4 right-4 text-red-600">
                            <CheckCircle2 size={20} />
                          </div>
                        )}
                        <div className="pr-10">
                          <div className="flex items-center gap-3 mb-1">
                            <h4 className="font-heading font-bold" style={{ color: textPrimary }}>{opt.title}</h4>
                            {opt.discount && opt.discount > 0 && (
                              <span className="text-[10px] font-bold px-2 py-0.5 rounded-full bg-red-100 text-red-600">
                                Poupa {opt.discount}%
                              </span>
                            )}
                          </div>
                          <div className="font-bold text-xl mb-1" style={{ color: '#D71920' }}>
                            {formatKz(opt.price)}
                          </div>
                          <p className="text-xs" style={{ color: textMuted }}>{opt.label}</p>
                        </div>
                      </div>
                    ))}
                  </motion.div>
                )}

                {/* STEP 4 — Confirmação */}
                {step === 4 && selectedPlan && (
                  <motion.div key="s4" {...fadeSlide} className="p-6 space-y-4">
                    <h3 className="font-heading font-bold mb-4" style={{ color: textPrimary }}>
                      {isContactOnly ? 'Confirmar Pedido de Contacto' : 'Resumo & Pagamento'}
                    </h3>
                    <div className="p-4 rounded-[7px] bg-zinc-50 dark:bg-[#1a1a1f] mb-6">
                      <div className="flex justify-between items-center mb-2">
                        <span className="text-sm font-medium" style={{ color: textMuted }}>Plano</span>
                        <span className="font-bold" style={{ color: textPrimary }}>{selectedPlan.name}</span>
                      </div>
                      {!isContactOnly && (
                        <div className="flex justify-between items-center mb-2">
                          <span className="text-sm font-medium" style={{ color: textMuted }}>Ciclo</span>
                          <span className="font-bold" style={{ color: textPrimary }}>
                            {cycle === 'monthly' ? 'Mensal' : cycle === 'quarterly' ? 'Trimestral' : cycle === 'biannual' ? 'Semestral' : 'Anual'}
                          </span>
                        </div>
                      )}
                      <div className="flex justify-between items-center pt-2 mt-2 border-t" style={{ borderColor }}>
                        <span className="font-bold" style={{ color: textPrimary }}>
                          {isContactOnly ? 'Valor' : 'Total a Pagar'}
                        </span>
                        <span className="font-bold text-lg" style={{ color: isContactOnly ? textMuted : '#D71920' }}>
                          {isContactOnly ? 'Sob Consulta' : formatKz(cycle === 'monthly' ? selectedPlan.priceMonthly 
                                  : cycle === 'quarterly' ? selectedPlan.priceMonthly * 3 
                                  : cycle === 'biannual' ? selectedPlan.priceMonthly * 6 
                                  : selectedPlan.priceAnnual)}
                        </span>
                      </div>
                      <div className="flex justify-between text-sm mt-4">
                        <span style={{ color: textMuted }}>Nome</span>
                        <span className="font-semibold text-right" style={{ color: textPrimary }}>{form.name}</span>
                      </div>
                      <div className="flex justify-between text-sm">
                        <span style={{ color: textMuted }}>Email</span>
                        <span className="font-semibold text-right truncate max-w-[200px] sm:max-w-none" style={{ color: textPrimary }}>{form.email}</span>
                      </div>
                      <div className="flex justify-between text-sm">
                        <span style={{ color: textMuted }}>Telemóvel</span>
                        <span className="font-semibold text-right" style={{ color: textPrimary }}>{form.phone}</span>
                      </div>
                    </div>
                    {error && (
                      <p className="text-sm text-center font-medium" style={{ color: '#D71920' }}>{error}</p>
                    )}
                  </motion.div>
                )}

                {/* STEP 5 — Sucesso */}
                {step === 5 && (
                  <motion.div key="s5" {...fadeSlide} className="p-8 text-center flex flex-col items-center gap-4">
                    <div className="w-16 h-16 rounded-full flex items-center justify-center" style={{ backgroundColor: 'rgba(16,185,129,0.1)' }}>
                      <CheckCircle2 size={36} style={{ color: '#10b981' }} />
                    </div>
                    <h3 className="font-heading font-black text-2xl" style={{ color: textPrimary }}>
                      {isContactOnly ? 'Pedido Enviado!' : 'Inscrição Realizada!'}
                    </h3>
                    <p className="text-sm" style={{ color: textMuted }}>
                      {isContactOnly
                        ? <>O teu pedido de contacto para <strong style={{ color: textPrimary }}>{program.name}</strong> foi registado. A nossa equipa entrará em contacto brevemente.</>
                        : <>A tua inscrição em <strong style={{ color: textPrimary }}>{program.name}</strong> foi registada com sucesso.</>
                      }
                    </p>
                    <div className="px-4 py-3 rounded-[7px] text-sm font-mono font-bold" style={{ backgroundColor: isDark ? '#1a1a1f' : '#f0f0f2', color: textPrimary }}>
                      {orderId}
                    </div>
                    <p className="text-xs" style={{ color: textMuted }}>
                      {isContactOnly ? 'Confirmaremos em breve por email ou telefone.' : 'Confirmaremos em breve por email. Segue o estado no Dashboard.'}
                    </p>
                    <button onClick={handleClose} className="mt-2 px-6 py-2.5 font-bold text-sm rounded-[7px] text-white" style={{ backgroundColor: '#D71920' }}>
                      Fechar
                    </button>
                  </motion.div>
                )}

              </AnimatePresence>
            </div>

            {/* Footer */}
            {step < 5 && (
              <div className="px-6 py-4 border-t flex items-center justify-between gap-4" style={{ borderColor, backgroundColor: isDark ? '#0d0d0f' : '#fafafa' }}>
                <button
                  onClick={() => {
                    if (step === 1) handleClose()
                    else if (step === 3 && skipPlanStep) setStep(1)
                    else if (step === 4 && isContactOnly && skipPlanStep) setStep(1)
                    else if (step === 4 && isContactOnly && !skipPlanStep) setStep(2)
                    else setStep(s => (s - 1) as Step)
                  }}
                  className="text-sm font-medium" style={{ color: textMuted }}
                >
                  {step === 1 ? 'Cancelar' : '← Voltar'}
                </button>
                {step < 4 ? (
                  <button
                    onClick={() => {
                      if (step === 1 && (!form.name || !form.email || !form.phone)) {
                        setError('Preenche os campos obrigatórios.')
                        return
                      }
                      if (step === 2 && !selectedPlan) {
                        setError('Seleciona um plano para continuar.')
                        return
                      }
                      setError(null)
                      if (step === 1 && skipPlanStep && isContactOnly) {
                        setStep(4) // Skip ciclo step for contact-only plans
                      } else if (step === 1 && skipPlanStep) {
                        setStep(3)
                      } else if (step === 2 && isContactOnly) {
                        setStep(4) // Skip ciclo step
                      } else {
                        setStep(s => (s + 1) as Step)
                      }
                    }}
                    className="flex items-center gap-2 px-5 py-2.5 font-bold text-sm text-white rounded-[7px]"
                    style={{ backgroundColor: '#D71920', boxShadow: '0 4px 16px rgba(215,25,32,0.3)' }}
                  >
                    Continuar <ChevronRight size={16} />
                  </button>
                ) : (
                  <button
                    onClick={handleCheckout}
                    disabled={loading}
                    className="flex items-center gap-2 px-5 py-2.5 font-bold text-sm text-white rounded-[7px] disabled:opacity-60"
                    style={{ backgroundColor: '#D71920', boxShadow: '0 4px 16px rgba(215,25,32,0.3)' }}
                  >
                    {loading 
                      ? <><Loader2 size={16} className="animate-spin" /> A processar...</> 
                      : isContactOnly 
                        ? <><Package size={16} /> Enviar Pedido</> 
                        : <><CreditCard size={16} /> Pagar com Pay4All</>}
                  </button>
                )}
              </div>
            )}

            {step === 4 && (
              <p className="flex items-center justify-center gap-1.5 text-[11px] pb-3 font-medium uppercase tracking-wider" style={{ color: textMuted }}>
                <ShieldCheck size={13} style={{ color: '#10b981' }} /> Pagamento 100% seguro via Pay4All
              </p>
            )}
          </motion.div>
        </motion.div>
      )}
    </AnimatePresence>
  )
}

const fadeSlide = {
  initial: { opacity: 0, y: 8 },
  animate: { opacity: 1, y: 0 },
  exit: { opacity: 0 },
  transition: { duration: 0.2 },
}
