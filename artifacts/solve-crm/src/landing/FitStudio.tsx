import { useState } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import { Building2, MapPin, Clock, ArrowRight, ShieldCheck, Flame, ChevronDown, CheckCircle2, Instagram, Dumbbell, Droplets, Users, Star } from 'lucide-react'
import { useCMS } from './context/CMSContext'
import ProgramCheckoutModal from './ui/ProgramCheckoutModal'
import CTAFinal from './sections/CTAFinal'

const faqs = [
  {
    q: 'Posso treinar no FitStudio sem PT?',
    a: 'Sim, dispomos de modalidades "Free Pass" para atletas experientes que apenas procuram um ambiente premium e sem superlotação para cumprirem as suas rotinas.'
  },
  {
    q: 'Qual é a lotação máxima do espaço?',
    a: 'Para garantir privacidade absoluta e que nunca terás de esperar por equipamento, limitamos a ocupação a 20 pessoas em simultâneo na zona de hipertrofia.'
  },
  {
    q: 'O serviço de Crioterapia está incluído?',
    a: 'Depende do plano. Os planos Premium e Elite incluem acesso ilimitado à zona de SPA e Crioterapia. O plano base tem acesso em formato pay-per-use.'
  },
  {
    q: 'Existem balneários privados?',
    a: 'Sim, as nossas instalações foram desenhadas a pensar no conforto de luxo, disponibilizando suites de balneário totalmente privadas equipadas com toalhas premium e amenities orgânicos.'
  }
]

export default function FitStudio() {
  const { programs, getPlansByProgram } = useCMS()
  const [openFaq, setOpenFaq] = useState<number | null>(0)
  const [checkoutOpen, setCheckoutOpen] = useState(false)
  const [initialPlanId, setInitialPlanId] = useState<string | undefined>()
  const openForm = () => window.dispatchEvent(new Event('openFormModal'))

  // Find the matching program in CMS
  const program = programs.find(p => p.id === 'prog-fitstudio') || null
  const plans = program ? getPlansByProgram(program.id) : []

  return (
    <main className="pt-[68px] pb-0 min-h-screen">
      <ProgramCheckoutModal
        isOpen={checkoutOpen}
        onClose={() => { setCheckoutOpen(false); setInitialPlanId(undefined); }}
        program={program}
        plans={plans}
        initialPlanId={initialPlanId}
      />
      {/* ── HERO SECTION (EDITORIAL PREMIUM MINIMALIST) ── */}
      <section className="relative w-full overflow-hidden bg-white dark:bg-zinc-950 pt-10 pb-16 lg:pt-12 lg:pb-24 border-b border-zinc-100 dark:border-zinc-800">
        <div className="container-custom relative z-10">
          <div className="grid lg:grid-cols-2 gap-16 lg:gap-20 items-center">
            
            {/* CONTENT (LEFT) */}
            <motion.div 
              className="max-w-xl mx-auto lg:mx-0 text-center lg:text-left"
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.9, ease: [0.16, 1, 0.3, 1] }}
            >
              <div className="inline-flex items-center gap-3 mb-8">
                <div className="w-8 h-px bg-zinc-300 hidden sm:block" />
                <span className="text-[11px] font-medium uppercase tracking-[0.25em] text-zinc-500 dark:text-zinc-400">Ginásio Boutique Privado</span>
              </div>
              
              <h1 className="font-heading font-normal text-5xl md:text-6xl lg:text-[5rem] text-zinc-900 dark:text-white mb-6 tracking-tight leading-[1.05]">
                O Teu Templo <br/>
                <span className="font-bold text-[#D71920]">Elite.</span>
              </h1>
              
              <p className="font-body text-zinc-500 dark:text-zinc-400 text-lg leading-relaxed mb-10 font-light max-w-md mx-auto lg:mx-0">
                Privacidade absoluta, lotação estrita de 20 atletas e os melhores equipamentos de alta performance do mundo. O espaço de eleição para quem não aceita menos que a excelência.
              </p>
              
              <div className="flex flex-col sm:flex-row items-center justify-center lg:justify-start gap-5">
                <button onClick={() => { setInitialPlanId(undefined); setCheckoutOpen(true); }} className="w-full sm:w-auto px-10 py-4 bg-zinc-900 hover:bg-[#D71920] text-white font-body font-medium tracking-wide text-sm transition-colors duration-500 flex items-center justify-center gap-4 group">
                  Agendar Visita
                  <ArrowRight size={16} className="text-zinc-400 group-hover:text-white group-hover:translate-x-1 transition-all" />
                </button>
              </div>
            </motion.div>

            {/* IMAGERY (RIGHT) */}
            <motion.div 
              className="relative hidden md:block"
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              transition={{ duration: 1.2, delay: 0.3, ease: [0.16, 1, 0.3, 1] }}
            >
              <div className="relative aspect-[16/10] overflow-hidden bg-zinc-50 dark:bg-zinc-900 group">
                <img 
                  src="https://images.unsplash.com/photo-1540497077202-7c8a3999166f?q=80&w=1200&auto=format&fit=crop" 
                  alt="FitStudio Premium Space" 
                  className="w-full h-full object-cover grayscale opacity-80 mix-blend-multiply group-hover:scale-105 group-hover:grayscale-0 transition-all duration-[1.5s] ease-out"
                />
                
                {/* Soft Minimal Badge (No shadow, just elegant contrast) */}
                <div className="absolute bottom-0 left-0 bg-white dark:bg-zinc-950 px-8 py-6 flex items-center gap-4">
                  <Building2 size={20} className="text-zinc-300" />
                  <div>
                    <p className="font-heading font-medium text-zinc-900 dark:text-white text-sm tracking-wide uppercase">Technogym</p>
                    <p className="font-body text-[10px] uppercase tracking-widest text-zinc-400">Equipamento Oficial</p>
                  </div>
                </div>
              </div>
            </motion.div>
            
          </div>
        </div>
      </section>

      {/* ── A EXPERIÊNCIA (NEW) ── */}
      <section className="container-custom mb-32">
        <div className="text-center mb-16">
          <h2 className="font-heading font-bold text-3xl md:text-4xl text-zinc-900 dark:text-white mb-4">A Experiência FitStudio</h2>
          <p className="font-body text-zinc-500 dark:text-zinc-400 text-lg">Um ambiente projetado para quem exige o melhor em cada detalhe.</p>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
          {[
            { icon: Dumbbell, title: 'Equipamento Elite', desc: 'Linha completa Technogym Selection e zonas dedicadas de free weight.' },
            { icon: Users, title: 'Lotação Exclusiva', desc: 'Máximo de 20 pessoas em simultâneo. Sem esperas. Foco total.' },
            { icon: Flame, title: 'Crioterapia & Sauna', desc: 'Recuperação otimizada após cada sessão pesada no nosso Recovery SPA.' },
            { icon: Droplets, title: 'Balneários Privados', desc: 'Suites individuais com amenities orgânicos de luxo e toalhas premium.' }
          ].map((item, i) => (
            <motion.div 
              key={i}
              initial={{ opacity: 0, y: 20 }}
              whileInView={{ opacity: 1, y: 0 }}
              viewport={{ once: true }}
              transition={{ delay: i * 0.1 }}
              className="p-8 bg-white dark:bg-zinc-950 border border-zinc-200 dark:border-zinc-800 hover:border-[#D71920]/30 transition-all duration-300 shadow-sm hover:shadow-md group"
            >
              <div className="w-14 h-14 bg-[#f5f5f7] dark:bg-zinc-900 flex items-center justify-center mb-6 text-zinc-400 group-hover:text-[#D71920] group-hover:bg-red-50 transition-colors">
                <item.icon size={28} />
              </div>
              <h3 className="font-heading font-bold text-xl text-zinc-900 dark:text-white mb-3">{item.title}</h3>
              <p className="font-body text-zinc-500 dark:text-zinc-400 text-sm leading-relaxed">{item.desc}</p>
            </motion.div>
          ))}
        </div>
      </section>

      {/* ── BENTO GALERIA ── */}
      <section className="container-custom mb-32">
        <motion.div
          initial={{ opacity: 0, y: 30 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true }}
          className="grid grid-cols-1 md:grid-cols-3 gap-4 auto-rows-[300px]"
        >
          <div className="md:col-span-2 overflow-hidden relative group">
            <img src="https://images.unsplash.com/photo-1534438327276-14e5300c3a48?ixlib=rb-4.0.3&auto=format&fit=crop&w=1200&q=80" alt="Main Floor" className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-700 opacity-60 hover:opacity-90 mix-blend-luminosity hover:mix-blend-normal" />
            <div className="absolute bottom-6 left-6 font-heading font-bold text-2xl text-white">Main Floor</div>
          </div>
          <div className="overflow-hidden relative group">
            <img src="https://images.unsplash.com/photo-1571019614242-c5c5dee9f50b?ixlib=rb-4.0.3&auto=format&fit=crop&w=800&q=80" alt="Dumbbells" className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-700 opacity-60 hover:opacity-90 mix-blend-luminosity hover:mix-blend-normal" />
            <div className="absolute bottom-6 left-6 font-heading font-bold text-2xl text-white">Iron Zone</div>
          </div>
          <div className="aspect-[4/5] bg-zinc-900 overflow-hidden relative group">
            <img src="https://images.unsplash.com/photo-1538805060514-97d9cc17730c?ixlib=rb-4.0.3&auto=format&fit=crop&w=800&q=80" alt="Cardio" className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-700 opacity-60 hover:opacity-90 mix-blend-luminosity hover:mix-blend-normal" />
            <div className="absolute bottom-6 left-6 right-6">
              <h3 className="font-heading font-bold text-2xl text-white mb-2">Cardio Deck</h3>
              <p className="font-body text-zinc-300 text-sm">Equipamento Technogym de última geração.</p>
            </div>
          </div>
          <div className="aspect-[4/5] bg-zinc-900 overflow-hidden relative group md:col-span-2 lg:col-span-1">
            <img src="https://images.unsplash.com/photo-1540555700478-4be289fbecef?ixlib=rb-4.0.3&auto=format&fit=crop&w=1200&q=80" alt="Spa" className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-700 opacity-60 hover:opacity-90 mix-blend-luminosity hover:mix-blend-normal" />
            <div className="absolute bottom-6 left-6 right-6 font-heading font-bold text-2xl text-white">Recovery SPA</div>
          </div>
        </motion.div>
      </section>

      {/* ── PLANOS / PRICING (NEW) ── */}
      <section className="bg-[#f5f5f7] dark:bg-zinc-900 border-y border-zinc-200 dark:border-zinc-800 py-24 mb-32">
        <div className="container-custom">
          <div className="text-center mb-16">
            <h2 className="font-heading font-bold text-4xl md:text-5xl text-zinc-900 dark:text-white mb-4">Membros FitStudio</h2>
            <p className="font-body text-zinc-500 dark:text-zinc-400 text-lg">A tua entrada no círculo de alta performance. Sem fidelização.</p>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-3 gap-8 max-w-6xl mx-auto">
            {/* Free Pass */}
            <div className="bg-white dark:bg-zinc-950 p-10 border border-zinc-200 dark:border-zinc-800 flex flex-col hover:border-zinc-300 transition-colors">
              <h3 className="font-heading font-bold text-2xl text-zinc-900 dark:text-white mb-2">Free Pass</h3>
              <p className="text-zinc-500 dark:text-zinc-400 text-sm mb-6 h-10">Acesso ilimitado ao ginásio para atletas independentes.</p>
              <div className="flex items-baseline gap-1 mb-8">
                <span className="text-5xl font-black text-zinc-900 dark:text-white">89.000 Kz</span>
                <span className="text-zinc-500 dark:text-zinc-400 font-medium">/mês</span>
              </div>
              <ul className="space-y-4 mb-10 flex-grow">
                {[
                  'Acesso Livre (06:00 - 23:00)', 
                  'App FitWorkout Inclusa',
                  'Toalhas Premium',
                  'Desconto em Crioterapia'
                ].map((feat, i) => (
                  <li key={i} className="flex items-center gap-3 text-zinc-700 font-medium text-sm">
                    <CheckCircle2 size={16} className="text-[#D71920] shrink-0" /> {feat}
                  </li>
                ))}
              </ul>
              <button onClick={() => { setInitialPlanId(plans[0]?.id); setCheckoutOpen(true); }} className="w-full py-4 font-bold bg-[#f5f5f7] dark:bg-zinc-900 hover:bg-zinc-200 text-zinc-900 dark:text-white transition-colors">
                Subscrever Free Pass
              </button>
            </div>

            {/* Premium PT */}
            <div className="bg-[#D71920] text-white p-10 border border-[#D71920] flex flex-col relative shadow-[0_20px_50px_rgba(215,25,32,0.25)] transform md:-translate-y-4">
              <div className="absolute -top-4 left-1/2 -translate-x-1/2 bg-white dark:bg-zinc-950 text-zinc-900 dark:text-white text-[10px] font-bold uppercase tracking-widest px-4 py-1.5 border border-zinc-200 dark:border-zinc-800 shadow-sm">
                Mais Popular
              </div>
              <h3 className="font-heading font-bold text-2xl mb-2 mt-2">Premium PT</h3>
              <p className="text-white/80 text-sm mb-6 h-10">O equilíbrio perfeito. Treino personalizado 2x por semana.</p>
              <div className="flex items-baseline gap-1 mb-8">
                <span className="text-5xl font-black">249.000 Kz</span>
                <span className="text-white/80 font-medium">/mês</span>
              </div>
              <ul className="space-y-4 mb-10 flex-grow">
                {[
                  'Acesso Livre Total',
                  '2 Treinos PT / Semana',
                  'Planeamento Nutricional',
                  'Acesso Ilimitado ao SPA',
                  'Garrafa FitStudio Exclusive'
                ].map((feat, i) => (
                  <li key={i} className="flex items-center gap-3 text-white font-medium text-sm">
                    <CheckCircle2 size={16} className="text-white shrink-0" /> {feat}
                  </li>
                ))}
              </ul>
              <button onClick={() => { setInitialPlanId(plans.find(p => p.name?.toLowerCase().includes('premium'))?.id || plans[0]?.id); setCheckoutOpen(true); }} className="w-full py-4 font-bold bg-white dark:bg-zinc-950 text-[#D71920] hover:bg-zinc-100 dark:bg-zinc-800 transition-colors shadow-lg">
                Agendar Entrevista
              </button>
            </div>

            {/* Elite */}
            <div className="bg-zinc-900 text-white p-10 border border-zinc-800 flex flex-col hover:border-zinc-700 transition-colors">
              <h3 className="font-heading font-bold text-2xl mb-2">Elite</h3>
              <p className="text-zinc-400 text-sm mb-6 h-10">Acompanhamento total 4x por semana. O auge da performance.</p>
              <div className="flex items-baseline gap-1 mb-8">
                <span className="text-5xl font-black">499.000 Kz</span>
                <span className="text-zinc-400 font-medium">/mês</span>
              </div>
              <ul className="space-y-4 mb-10 flex-grow">
                {[
                  '4 Treinos PT / Semana',
                  'Crioterapia Ilimitada',
                  'Fisioterapia Mensal',
                  'Avaliação Biomecânica',
                  'Prioridade de Agendamento'
                ].map((feat, i) => (
                  <li key={i} className="flex items-center gap-3 text-white font-medium text-sm">
                    <CheckCircle2 size={16} className="text-zinc-400 shrink-0" /> {feat}
                  </li>
                ))}
              </ul>
              <button onClick={() => { setInitialPlanId(plans.find(p => p.name?.toLowerCase().includes('elite'))?.id || plans[0]?.id); setCheckoutOpen(true); }} className="w-full py-4 font-bold bg-zinc-800 hover:bg-zinc-700 text-white transition-colors border border-zinc-700">
                Aplicar para Elite
              </button>
            </div>
          </div>
        </div>
      </section>





      {/* ── EQUIPA PT ── */}
      <section className="container-custom mb-32">
        <div className="text-center mb-16">
          <h2 className="font-heading font-bold text-3xl md:text-5xl text-zinc-900 dark:text-white mb-4">A Nossa Equipa</h2>
          <p className="font-body text-zinc-500 dark:text-zinc-400">Mestres no corpo humano prontos a levar-te ao extremo.</p>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-3 gap-8">
          {[
            { name: 'Bruno Samora', role: 'Head Coach / Fundador', img: 'https://images.unsplash.com/photo-1568602471122-7832951cc4c5?ixlib=rb-4.0.3&auto=format&fit=crop&w=800&q=80' },
            { name: 'Tiago Mendes', role: 'Especialista Hipertrofia', img: 'https://images.unsplash.com/photo-1590086782792-42dd2350140d?ixlib=rb-4.0.3&auto=format&fit=crop&w=800&q=80' },
            { name: 'Sofia Costa', role: 'Nutrição & Performance', img: 'https://images.unsplash.com/photo-1594381898411-846e7d193883?ixlib=rb-4.0.3&auto=format&fit=crop&w=800&q=80' }
          ].map((pt, i) => (
            <div key={i} className="group relative overflow-hidden bg-zinc-900 aspect-[3/4]">
              <img src={pt.img} alt={pt.name} className="w-full h-full object-cover grayscale opacity-70 group-hover:grayscale-0 group-hover:scale-105 group-hover:opacity-100 transition-all duration-700" />
              <div className="absolute inset-0 bg-gradient-to-t from-black via-black/40 to-transparent opacity-80" />
              <div className="absolute bottom-0 left-0 p-8 w-full transform translate-y-4 group-hover:translate-y-0 transition-transform duration-500">
                <h3 className="font-heading font-bold text-2xl text-white mb-1">{pt.name}</h3>
                <p className="text-[#D71920] font-bold text-sm tracking-widest uppercase mb-4">{pt.role}</p>
                <div className="flex gap-2 opacity-0 group-hover:opacity-100 transition-opacity delay-100">
                  <a href="#" className="w-10 h-10 bg-zinc-900/10 flex items-center justify-center text-white hover:bg-[#D71920] transition-colors"><Instagram size={18} /></a>
                </div>
              </div>
            </div>
          ))}
        </div>
      </section>

      {/* ── INFO (LOCATION & SCHEDULE) ── */}
      <section className="border-y border-zinc-200 dark:border-zinc-800 bg-[#f5f5f7] dark:bg-zinc-900 py-24 mb-32">
        <div className="container-custom">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-16 max-w-5xl mx-auto">
            {/* Morada */}
            <div className="flex gap-6 p-8 bg-white dark:bg-zinc-950 border border-zinc-200 dark:border-zinc-800">
              <div className="w-16 h-16 shrink-0 bg-[#D71920]/10 flex items-center justify-center text-[#D71920]">
                <MapPin size={28} />
              </div>
              <div>
                <h4 className="font-heading font-bold text-3xl text-zinc-900 dark:text-white mb-2">Morada</h4>
                <p className="font-body text-zinc-500 dark:text-zinc-400 mb-1 text-lg">Avenida da Liberdade, 100</p>
                <p className="font-body text-zinc-500 dark:text-zinc-400 mb-6 text-lg">Lisboa, Portugal</p>
                <button onClick={openForm} className="text-sm font-bold text-[#D71920] hover:text-[#b3141a] transition-colors border-b border-[#D71920]/30 hover:border-[#D71920] pb-1">
                  Abrir no Google Maps &rarr;
                </button>
              </div>
            </div>

            {/* Horário */}
            <div className="flex gap-6 p-8 bg-white dark:bg-zinc-950 border border-zinc-200 dark:border-zinc-800">
              <div className="w-16 h-16 shrink-0 bg-[#D71920]/10 flex items-center justify-center text-[#D71920]">
                <Clock size={28} />
              </div>
              <div className="w-full">
                <h4 className="font-heading font-bold text-3xl text-zinc-900 dark:text-white mb-6">Horário</h4>
                <div className="space-y-4">
                  <div className="flex justify-between items-center text-base border-b border-zinc-100 pb-3">
                    <span className="text-zinc-500 dark:text-zinc-400 font-medium">Seg a Sex</span>
                    <span className="text-zinc-900 dark:text-white font-bold">06:00 - 23:00</span>
                  </div>
                  <div className="flex justify-between items-center text-base border-b border-zinc-100 pb-3">
                    <span className="text-zinc-500 dark:text-zinc-400 font-medium">Sábado</span>
                    <span className="text-zinc-900 dark:text-white font-bold">08:00 - 20:00</span>
                  </div>
                  <div className="flex justify-between items-center text-base">
                    <span className="text-zinc-500 dark:text-zinc-400 font-medium">Domingo</span>
                    <span className="text-zinc-900 dark:text-white font-bold">09:00 - 14:00</span>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>
      </section>




    </main>
  )
}
