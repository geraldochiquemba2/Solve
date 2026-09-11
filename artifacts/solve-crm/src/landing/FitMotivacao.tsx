import { useState } from 'react'
import { motion } from 'framer-motion'
import { Mic, Users, Briefcase, TrendingUp, ArrowRight, Star, Play } from 'lucide-react'
import { useCMS } from './context/CMSContext'
import ProgramCheckoutModal from './ui/ProgramCheckoutModal'

const servicos = [
  {
    icon: Mic,
    title: 'Palestras Keynote',
    description: 'Intervenções de alto impacto para eventos corporate. Foco em superação, alta performance e mindset de vencedor.'
  },
  {
    icon: Users,
    title: 'Eventos Imersivos',
    description: 'Workshops e dinâmicas de grupo desenhadas para quebrar limites mentais e criar sinergias inquebráveis na tua equipa.'
  },
  {
    icon: Briefcase,
    title: 'Corporate Wellness',
    description: 'Programas de saúde física e mental à medida para empresas que valorizam a máxima produtividade e bem-estar.'
  },
  {
    icon: TrendingUp,
    title: 'Mentoria de Liderança',
    description: 'Acompanhamento executivo para líderes que precisam de inspirar, guiar e obter resultados de topo em ambientes de pressão.'
  }
]

export default function FitMotivacao() {
  const { programs, getPlansByProgram } = useCMS()
  const [checkoutOpen, setCheckoutOpen] = useState(false)
  const [initialPlanId, setInitialPlanId] = useState<string | undefined>()
  const openForm = () => window.dispatchEvent(new Event('openFormModal'))
  
  // Find the matching program in CMS
  const program = programs.find(p => p.id === 'prog-fitmotivacao') || null
  const plans = program ? getPlansByProgram(program.id) : []

  return (
    <main className="pb-0 min-h-screen bg-[#f5f5f7] dark:bg-zinc-900">
      <ProgramCheckoutModal
        isOpen={checkoutOpen}
        onClose={() => { setCheckoutOpen(false); setInitialPlanId(undefined); }}
        program={program}
        plans={plans}
        initialPlanId={initialPlanId}
      />
      {/* ── HERO MANIFESTO (FULLSCREEN PREMIUM) ── */}
      <section className="relative w-full h-[65vh] min-h-[520px] max-h-[640px] flex items-center justify-center overflow-hidden bg-zinc-900">
        {/* FULL BLEED BACKGROUND */}
        <div className="absolute inset-0 z-0">
          <img 
            src="https://images.unsplash.com/photo-1551632811-561732d1e306?ixlib=rb-4.0.3&auto=format&fit=crop&w=2000&q=80" 
            alt="Manifesto FitMotivação"
            className="w-full h-full object-cover opacity-50 grayscale-[0.3]"
          />
          {/* Cinematic overlay gradients */}
          <div className="absolute inset-0 bg-gradient-to-t from-zinc-900 via-zinc-900/60 to-zinc-900/20" />
          <div className="absolute inset-0 bg-gradient-to-r from-zinc-900/80 via-transparent to-zinc-900/20" />
        </div>

        {/* CONTENT */}
        <div className="container-custom relative z-10 text-center pb-16">
          <motion.div
            className="max-w-3xl mx-auto"
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 1, ease: [0.16, 1, 0.3, 1] }}
          >
            {/* Badge */}
            <div className="inline-flex items-center gap-3 mb-5">
              <div className="w-8 h-px bg-[#D71920]" />
              <span className="text-[10px] font-bold uppercase tracking-[0.35em] text-[#D71920]">Manifesto</span>
              <div className="w-8 h-px bg-[#D71920]" />
            </div>

            {/* Main Headline */}
            <h1 className="font-heading font-black text-3xl md:text-4xl lg:text-5xl text-white mb-5 tracking-tighter leading-tight uppercase">
              Desperta o <span className="text-[#D71920]">Potencial</span> Oculto.
            </h1>

            <p className="font-body text-zinc-400 text-base leading-relaxed mb-7 max-w-lg mx-auto font-light">
              A <span className="font-semibold text-white">FitMotivação</span> é a centelha que falta à tua equipa.
            </p>

            {/* Play Button */}
            <motion.button
              onClick={openForm}
              className="w-16 h-16 bg-[#D71920] flex items-center justify-center text-white mx-auto hover:bg-red-700 transition-colors duration-300 shadow-[0_0_40px_rgba(215,25,32,0.4)]"
              whileHover={{ scale: 1.08 }}
              whileTap={{ scale: 0.96 }}
            >
              <Play size={24} className="ml-1" fill="currentColor" />
            </motion.button>
          </motion.div>
        </div>

        {/* BOTTOM CTA BAR */}
        <div className="absolute bottom-0 left-0 right-0 z-20 border-t border-white/10 bg-white/5 backdrop-blur-md">
          <div className="container-custom">
            <div className="flex flex-col sm:flex-row items-center justify-between py-5 gap-4">
              <div className="flex items-center gap-6">
                {[
                  { value: '10k+', label: 'Pessoas Impactadas' },
                  { value: '150+', label: 'Eventos' },
                  { value: '50+', label: 'Empresas' },
                ].map((s, i) => (
                  <div key={i} className="text-center">
                    <p className="font-heading font-black text-white text-xl leading-none">{s.value}</p>
                    <p className="font-body text-[10px] uppercase tracking-widest text-zinc-400 mt-0.5">{s.label}</p>
                  </div>
                ))}
              </div>
              <button onClick={() => { setInitialPlanId(undefined); setCheckoutOpen(true); }} className="w-full sm:w-auto px-8 py-3 bg-[#D71920] hover:bg-red-700 text-white font-body font-medium tracking-wide text-sm transition-colors duration-300 flex items-center justify-center gap-3">
                Agendar Palestra <ArrowRight size={16} />
              </button>
            </div>
          </div>
        </div>
      </section>

      {/* ── PARCEIROS CORPORATE ── */}
      <section className="border-y border-zinc-200 dark:border-zinc-800 bg-[#f5f5f7] dark:bg-zinc-900 py-12 mb-24 overflow-hidden">
        <div className="container-custom text-center mb-8">
          <p className="text-zinc-500 dark:text-zinc-400 text-xs font-bold uppercase tracking-widest">Empresas que confiam em nós para elevar a sua liderança</p>
        </div>
        <div className="flex justify-center gap-12 md:gap-24 opacity-40 grayscale flex-wrap px-4">
          <div className="text-2xl font-black font-heading tracking-tighter text-zinc-900 dark:text-white">FORBES</div>
          <div className="text-2xl font-black font-heading tracking-tighter text-zinc-900 dark:text-white">VODAFONE</div>
          <div className="text-2xl font-black font-heading tracking-tighter text-zinc-900 dark:text-white">MICROSOFT</div>
          <div className="text-2xl font-black font-heading tracking-tighter text-zinc-900 dark:text-white">RE/MAX</div>
          <div className="text-2xl font-black font-heading tracking-tighter text-zinc-900 dark:text-white">TAP</div>
        </div>
      </section>

      {/* ── STATS / IMPACT ── */}
      <section className="bg-gradient-to-b from-transparent via-red-900/5 to-transparent py-16 mb-32 border-y border-zinc-200 dark:border-zinc-800">
        <div className="container-custom">
          <div className="grid grid-cols-2 md:grid-cols-4 gap-8 divide-x divide-zinc-200">
            {[
              { label: 'Pessoas Impactadas', value: '10k+' },
              { label: 'Eventos Realizados', value: '150+' },
              { label: 'Empresas Clientes', value: '50+' },
              { label: 'Horas de Mentoria', value: '2.5k' },
            ].map((stat, i) => (
              <motion.div 
                key={i} 
                className="text-center px-4"
                initial={{ opacity: 0, scale: 0.9 }}
                whileInView={{ opacity: 1, scale: 1 }}
                viewport={{ once: true }}
                transition={{ delay: i * 0.1 }}
              >
                <h4 className="font-heading font-black text-4xl text-zinc-900 dark:text-white mb-2">{stat.value}</h4>
                <p className="font-body text-sm font-medium text-zinc-500 dark:text-zinc-400 uppercase tracking-widest">{stat.label}</p>
              </motion.div>
            ))}
          </div>
        </div>
      </section>

      {/* ── SERVIÇOS ── */}
      <section className="container-custom mb-32">
        <div className="text-center mb-16">
          <h2 className="font-heading font-bold text-4xl md:text-5xl text-zinc-900 dark:text-white mb-4">Áreas de Atuação</h2>
          <p className="font-body text-zinc-500 dark:text-zinc-400 text-lg">Soluções desenhadas para maximizar a performance humana.</p>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-6 max-w-5xl mx-auto">
          {servicos.map((svc, i) => (
            <motion.div
              key={i}
              initial={{ opacity: 0, y: 20 }}
              whileInView={{ opacity: 1, y: 0 }}
              viewport={{ once: true }}
              transition={{ delay: i * 0.1 }}
              className="p-10 bg-white dark:bg-zinc-950 border border-zinc-200 dark:border-zinc-800 hover:border-red-500/30 transition-all duration-500 group shadow-sm hover:shadow-md"
            >
              <div className="w-16 h-16 bg-zinc-50 dark:bg-zinc-900 flex items-center justify-center mb-8 group-hover:scale-110 transition-transform group-hover:bg-red-50 group-hover:text-red-600 text-zinc-500 dark:text-zinc-400">
                <svc.icon size={28} />
              </div>
              <h3 className="font-heading font-bold text-2xl text-zinc-900 dark:text-white mb-4">{svc.title}</h3>
              <p className="font-body text-zinc-500 dark:text-zinc-400 leading-relaxed mb-8">{svc.description}</p>
              <button onClick={() => { setInitialPlanId(undefined); setCheckoutOpen(true); }} className="text-sm font-bold text-red-600 hover:text-red-500 flex items-center gap-2">
                Saber Mais e Orçamentar <ArrowRight size={16} />
              </button>
            </motion.div>
          ))}
        </div>
      </section>

      {/* ── TESTIMONIALS ── */}
      <section className="container-custom mb-32">
        <div className="max-w-5xl mx-auto p-12 md:p-16 bg-gradient-to-br from-red-50 to-white border border-red-100 relative overflow-hidden shadow-sm">
          <div className="absolute -right-10 -top-10 text-9xl text-red-500/10 font-heading font-black rotate-12 select-none">"</div>
          
          <div className="grid grid-cols-1 md:grid-cols-2 gap-12 items-center relative z-10">
            <div>
              <div className="flex gap-1 mb-6 text-red-500">
                {[...Array(5)].map((_, i) => <Star key={i} size={20} fill="currentColor" />)}
              </div>
              <p className="font-heading font-bold text-2xl md:text-3xl text-zinc-900 dark:text-white leading-snug mb-8">
                "A intervenção do Bruno foi o ponto de viragem para a nossa equipa de vendas. Num mercado tão competitivo, precisávamos de resiliência e foco absoluto. Foi exatamente isso que recebemos."
              </p>
              <div>
                <h5 className="font-bold text-zinc-900 dark:text-white text-lg mb-1">Miguel Silva</h5>
                <p className="text-zinc-500 dark:text-zinc-400">Head of Sales Europe, TechCorp</p>
              </div>
            </div>
            
            <div className="space-y-6">
              {[
                { name: 'Ana Rita', role: 'HR Manager', quote: 'A melhor masterclass de liderança que tivemos nos últimos 5 anos.' },
                { name: 'João P.', role: 'CEO', quote: 'Impactante, visceral e direto ao assunto. Sem rodriguinhos.' }
              ].map((t, i) => (
                <div key={i} className="p-6 bg-white dark:bg-zinc-950 border border-zinc-200 dark:border-zinc-800 shadow-sm">
                  <p className="text-zinc-600 dark:text-zinc-300 italic text-sm mb-4">"{t.quote}"</p>
                  <p className="text-zinc-900 dark:text-white font-bold text-sm">{t.name} <span className="font-normal text-zinc-500 dark:text-zinc-400">| {t.role}</span></p>
                </div>
              ))}
            </div>
          </div>
        </div>
      </section>

    </main>
  )
}
