import { motion } from 'framer-motion'
import { Check, ArrowRight, Star } from 'lucide-react'

const plans = [
  {
    id: 'executive',
    name: 'Executive',
    subtitle: 'Para líderes individuais',
    price: 'Sob Consulta',
    priceNote: 'por mês',
    description: 'Mentoria individual de alta intensidade para CEOs e líderes de topo que querem resultados rápidos e duradouros.',
    features: [
      'Sessão de diagnóstico (90 min)',
      '3 sessões de mentoria 1:1/mês',
      'Plano personalizado de alta performance',
      'Acesso à comunidade privada',
      'Suporte via WhatsApp (24h)',
      'Relatório mensal de progresso',
    ],
    cta: 'Começar Mentoria',
    featured: false,
  },
  {
    id: 'corporate',
    name: 'Corporate / B2G',
    subtitle: 'Para equipas e departamentos',
    price: 'Sob Consulta',
    priceNote: 'por programa',
    description: 'Programa completo de alta performance para equipas que querem resultados colectivos mensuráveis no setor público e privado.',
    features: [
      'Diagnóstico organizacional completo',
      '2 workshops mensais (full-day)',
      'Plano de Corporate Wellness',
      'Mentoria para liderança de topo',
      'Dashboard de métricas em tempo real',
      'Relatórios trimestrais executivos',
      'Suporte contínuo à equipa',
    ],
    cta: 'Pedir Proposta',
    featured: true,
    badge: 'Mais Escolhido',
  },
  {
    id: 'enterprise',
    name: 'Enterprise / Gov',
    subtitle: 'Para grandes organizações e instituições estatais',
    price: 'Personalizado',
    priceNote: 'por projecto',
    description: 'Programa de larga escala com implementação de cultura de alta performance e excelência operacional a todos os níveis.',
    features: [
      'Programa 100% personalizado',
      'Workshops e keynotes ilimitados',
      'Consultoria estratégica contínua',
      'Formação de facilitadores internos',
      'Cultura de alta performance',
      'Relatórios executivos mensais',
      'Gestor de conta dedicado',
    ],
    cta: 'Falar com Equipa',
    featured: false,
  },
]

const comparison = [
  { feature: 'Diagnóstico inicial', executive: true, corporate: true, enterprise: true },
  { feature: 'Mentoria 1:1', executive: true, corporate: false, enterprise: true },
  { feature: 'Workshops para equipa', executive: false, corporate: true, enterprise: true },
  { feature: 'Corporate Wellness', executive: false, corporate: true, enterprise: true },
  { feature: 'Dashboard de métricas', executive: false, corporate: true, enterprise: true },
  { feature: 'Formação de facilitadores', executive: false, corporate: false, enterprise: true },
  { feature: 'Suporte dedicado', executive: false, corporate: false, enterprise: true },
]

export default function Planos() {
  return (
    <section id="planos" className="section-py bg-[#f5f5f7] dark:bg-zinc-900 relative overflow-hidden bg-[url('/images/planos-bg.jpg')] bg-cover bg-center bg-fixed">
      {/* Dark overlay */}
      <div className="absolute inset-0 bg-white/90 dark:bg-zinc-900/90" />
      
      <div className="container-custom relative z-10">

        {/* Header */}
        <div className="text-center mb-16">

          <motion.h2
            className="font-heading font-black text-4xl md:text-5xl text-zinc-900 dark:text-white mb-5"
            initial={{ opacity: 0, y: 20 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true }}
            transition={{ delay: 0.1 }}
          >
            Escolha o Plano{' '}
            <span className="text-red-gradient">Certo</span>{' '}
            para Si
          </motion.h2>
          <motion.p
            className="font-body text-zinc-500 dark:text-zinc-400 text-lg max-w-2xl mx-auto"
            initial={{ opacity: 0, y: 20 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true }}
            transition={{ delay: 0.2 }}
          >
            Todas as propostas são personalizadas. Entre em contacto para receber uma proposta
            adaptada à sua realidade e objectivos.
          </motion.p>
        </div>

        {/* Pricing cards */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-6 mb-16 items-start">
          {plans.map((plan, i) => (
            <motion.div
              key={plan.id}
              className={`pricing-card ${plan.featured ? 'featured' : ''}`}
              initial={{ opacity: 0, y: 40 }}
              whileInView={{ opacity: 1, y: 0 }}
              viewport={{ once: true }}
              transition={{ delay: i * 0.15, duration: 0.6 }}
            >
              {/* Badge */}
              {plan.badge && (
                <div className="flex items-center gap-2 mb-4">
                  <span className="bg-[#D71920] text-white text-xs font-body font-bold px-3 py-1 tracking-wide uppercase flex items-center gap-1.5">
                    <Star size={10} fill="white" />
                    {plan.badge}
                  </span>
                </div>
              )}

              <div className="mb-6">
                <h3 className="font-heading font-black text-2xl text-zinc-900 dark:text-white mb-1">{plan.name}</h3>
                <p className="text-zinc-500 dark:text-zinc-400 text-sm font-body">{plan.subtitle}</p>
              </div>

              <div className="mb-6 pb-6 border-b border-zinc-200 dark:border-zinc-800">
                <span className="font-heading font-black text-3xl text-zinc-900 dark:text-white">{plan.price}</span>
                <span className="text-zinc-500 dark:text-zinc-400 text-sm font-body ml-2">{plan.priceNote}</span>
                <p className="font-body text-zinc-500 dark:text-zinc-400 text-sm mt-3 leading-relaxed">{plan.description}</p>
              </div>

              <ul className="space-y-3 mb-8">
                {plan.features.map((feature) => (
                  <li key={feature} className="flex items-start gap-3">
                    <div className="w-5 h-5 bg-[#D71920]/15 border border-[#D71920]/30 flex items-center justify-center flex-shrink-0 mt-0.5">
                      <Check size={10} className="text-[#D71920]" strokeWidth={3} />
                    </div>
                    <span className="font-body text-zinc-600 dark:text-zinc-300 text-sm">{feature}</span>
                  </li>
                ))}
              </ul>

              <button
                onClick={() => window.dispatchEvent(new Event('openFormModal'))}
                className={`btn w-full mt-auto justify-center gap-2 ${plan.featured ? 'btn-primary' : 'btn-secondary'}`}
                id={`plano-${plan.id}-btn`}
              >
                {plan.cta}
                <ArrowRight size={16} />
              </button>
            </motion.div>
          ))}
        </div>

        {/* Comparison table */}
        <motion.div
          className="bg-white dark:bg-zinc-950 border border-zinc-200 dark:border-zinc-800 overflow-hidden shadow-sm"
          initial={{ opacity: 0, y: 30 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true }}
          transition={{ duration: 0.6 }}
        >
          <div className="grid grid-cols-4 gap-0">
            <div className="p-5 border-b border-zinc-200 dark:border-zinc-800">
              <span className="font-heading font-bold text-zinc-500 dark:text-zinc-400 text-sm">Funcionalidade</span>
            </div>
            {['Executive', 'Corporate', 'Enterprise'].map((name) => (
              <div key={name} className="p-5 border-b border-zinc-200 dark:border-zinc-800 text-center">
                <span className="font-heading font-bold text-zinc-900 dark:text-white text-sm">{name}</span>
              </div>
            ))}
            {comparison.map((row, i) => (
              <>
                <div key={`label-${i}`} className="p-4 border-b border-zinc-100 dark:border-zinc-800 last:border-0">
                  <span className="font-body text-zinc-500 dark:text-zinc-400 text-sm">{row.feature}</span>
                </div>
                {(['executive', 'corporate', 'enterprise'] as const).map((key) => (
                  <div key={`${i}-${key}`} className="p-4 border-b border-zinc-100 dark:border-zinc-800 last:border-0 flex items-center justify-center">
                    {row[key]
                      ? <Check size={16} className="text-[#D71920]" strokeWidth={3} />
                      : <span className="text-zinc-300 dark:text-zinc-600 text-lg">—</span>
                    }
                  </div>
                ))}
              </>
            ))}
          </div>
        </motion.div>
      </div>
    </section>
  )
}
