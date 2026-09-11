import { motion } from 'framer-motion'
import { ClipboardList, Phone, Search, FileText, Rocket } from 'lucide-react'

const steps = [
  { icon: ClipboardList, number: '01', title: 'Preenche o Formulário', description: 'Preenche o formulário de contacto com informações básicas sobre a sua empresa e necessidades.' },
  { icon: Phone, number: '02', title: 'Recebe Contacto', description: 'A nossa equipa entra em contacto em menos de 24 horas para agendar uma conversa inicial.' },
  { icon: Search, number: '03', title: 'Diagnóstico Gratuito', description: 'Sessão de diagnóstico de 60 minutos para identificar os maiores bloqueios e oportunidades.' },
  { icon: FileText, number: '04', title: 'Plano Personalizado', description: 'Recebe uma proposta detalhada com metodologia, cronograma e métricas de sucesso.' },
  { icon: Rocket, number: '05', title: 'Implementação', description: 'Início do programa com acompanhamento contínuo e ajustes em tempo real para máximos resultados.' },
]

export default function ComoFunciona() {
  return (
    <section id="como-funciona" className="section-py bg-[#f5f5f7] dark:bg-zinc-900">
      <div className="container-custom">

        {/* Header */}
        <div className="text-center mb-20">

          <motion.h2
            className="font-heading font-black text-4xl md:text-5xl text-zinc-900 dark:text-white mb-5"
            initial={{ opacity: 0, y: 20 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true }}
            transition={{ delay: 0.1 }}
          >
            Como{' '}
            <span className="text-red-gradient">Funciona</span>
          </motion.h2>
          <motion.p
            className="font-body text-zinc-500 dark:text-zinc-400 text-lg max-w-2xl mx-auto"
            initial={{ opacity: 0, y: 20 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true }}
            transition={{ delay: 0.2 }}
          >
            Um processo simples, transparente e sem compromisso inicial.
            Do primeiro contacto à transformação em 5 passos.
          </motion.p>
        </div>

        {/* Desktop: Horizontal stepper */}
        <div className="hidden lg:block">
          {/* Connector line */}
          <div className="relative flex items-start justify-between mb-0">
            <div className="absolute top-[26px] left-[10%] right-[10%] h-0.5 bg-gradient-to-r from-[#D71920] via-[#D71920]/50 to-[#D71920]/20" />

            {steps.map((step, i) => {
              const Icon = step.icon
              return (
                <motion.div
                  key={step.number}
                  className="relative flex flex-col items-center text-center w-1/5 px-3"
                  initial={{ opacity: 0, y: 30 }}
                  whileInView={{ opacity: 1, y: 0 }}
                  viewport={{ once: true }}
                  transition={{ delay: i * 0.12, duration: 0.6 }}
                >
                  {/* Step circle */}
                  <div className={`relative z-10 w-14 h-14 flex items-center justify-center mb-6 transition-all ${
                    i === 0
                      ? 'bg-[#D71920] shadow-[0_0_30px_rgba(215,25,32,0.5)]'
                      : 'bg-white dark:bg-zinc-950 border-2 border-[#D71920]/50'
                  }`}>
                    <Icon size={22} className={i === 0 ? 'text-white' : 'text-[#D71920]'} />
                  </div>
                  <div className="font-body text-[#D71920]/60 text-xs font-bold tracking-widest mb-2">{step.number}</div>
                  <h3 className="font-heading font-bold text-zinc-900 dark:text-white text-base mb-2 leading-tight">{step.title}</h3>
                  <p className="font-body text-zinc-500 dark:text-zinc-400 text-xs leading-relaxed">{step.description}</p>
                </motion.div>
              )
            })}
          </div>
        </div>

        {/* Mobile: Vertical stepper */}
        <div className="lg:hidden space-y-0">
          {steps.map((step, i) => {
            const Icon = step.icon
            return (
              <motion.div
                key={step.number}
                className="flex gap-5 pb-8 last:pb-0"
                initial={{ opacity: 0, x: -30 }}
                whileInView={{ opacity: 1, x: 0 }}
                viewport={{ once: true }}
                transition={{ delay: i * 0.1, duration: 0.6 }}
              >
                {/* Left column */}
                <div className="flex flex-col items-center flex-shrink-0 w-14">
                  <div className={`w-14 h-14 flex items-center justify-center flex-shrink-0 ${
                    i === 0
                      ? 'bg-[#D71920] shadow-[0_0_20px_rgba(215,25,32,0.4)]'
                      : 'bg-white dark:bg-zinc-950 border-2 border-[#D71920]/40'
                  }`}>
                    <Icon size={20} className={i === 0 ? 'text-white' : 'text-[#D71920]'} />
                  </div>
                  {i < steps.length - 1 && (
                    <div className="w-0.5 flex-1 bg-gradient-to-b from-[#D71920]/50 to-transparent mt-2" />
                  )}
                </div>
                {/* Content */}
                <div className="pt-2 pb-4">
                  <span className="font-body text-[#D71920]/60 text-xs font-bold tracking-widest">{step.number}</span>
                  <h3 className="font-heading font-bold text-zinc-900 dark:text-white text-lg mt-1 mb-2">{step.title}</h3>
                  <p className="font-body text-zinc-500 dark:text-zinc-400 text-sm leading-relaxed">{step.description}</p>
                </div>
              </motion.div>
            )
          })}
        </div>

        {/* CTA */}
        <motion.div
          className="text-center mt-16"
          initial={{ opacity: 0, y: 20 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true }}
          transition={{ delay: 0.4 }}
        >
          <button
            onClick={() => document.querySelector('#cta')?.scrollIntoView({ behavior: 'smooth' })}
            className="btn btn-primary"
            id="como-funciona-cta-btn"
          >
            Começar Agora — É Gratuito
          </button>
          <p className="font-body text-zinc-500 dark:text-zinc-400 text-sm mt-4">
            Diagnóstico inicial 100% gratuito e sem compromisso
          </p>
        </motion.div>
      </div>
    </section>
  )
}
