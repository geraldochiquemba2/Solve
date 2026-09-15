import { useState } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import { Dumbbell, Activity, Calendar, Trophy, ArrowRight, Play, CheckCircle2, ChevronDown, Smartphone, Users, TrendingUp } from 'lucide-react'
import { useCMS } from './context/CMSContext'
import ProgramCheckoutModal from './ui/ProgramCheckoutModal'


const faqs = [
  {
    q: 'Preciso de equipamento para treinar com a app?',
    a: 'Temos programas desenhados para todos os cenários. Podes escolher rotinas 100% peso corporal (home workout), com halteres/kettlebells, ou programas completos de ginásio.'
  },
  {
    q: 'Posso cancelar a minha subscrição a qualquer momento?',
    a: 'Sim, a FitWorkout não tem contratos de fidelização agressivos. Podes cancelar a renovação da tua subscrição diretamente na app com 1 clique.'
  },
  {
    q: 'Os treinos são em vídeo?',
    a: 'Sim, todos os exercícios incluem vídeos demonstrativos em 4K, com instruções textuais sobre postura e cadência para garantires que treinas em segurança e com eficácia.'
  },
  {
    q: 'Como funciona o Período de Teste Gratuito?',
    a: 'Tens 7 dias para explorar toda a plataforma sem qualquer custo. Se não for para ti, cancelas antes do fim do período e não te será cobrado absolutamente nada.'
  }
]

export default function FitWorkout() {
  const { programs, getPlansByProgram } = useCMS()
  const [checkoutOpen, setCheckoutOpen] = useState(false)
  const [initialPlanId, setInitialPlanId] = useState<string | undefined>()
  const [initialCycle, setInitialCycle] = useState<'monthly' | 'quarterly' | 'biannual' | 'annual' | undefined>()
  const openForm = () => window.dispatchEvent(new Event('openFormModal'))

  // Find the matching program in CMS
  const program = programs.find(p => p.id === 'prog-fitworkout') || null
  const plans = program ? getPlansByProgram(program.id) : []

  return (
    <main className="pb-0 min-h-screen">
      <ProgramCheckoutModal
        isOpen={checkoutOpen}
        onClose={() => { setCheckoutOpen(false); setInitialPlanId(undefined); setInitialCycle(undefined); }}
        program={program}
        plans={plans}
        initialPlanId={initialPlanId}
        initialCycle={initialCycle}
      />
      {/* ── HERO SECTION (NETFLIX STYLE - PREMIUM LIGHT) ── */}
      <section className="relative w-full h-[65vh] min-h-[500px] max-h-[600px] flex items-center justify-start overflow-hidden bg-white dark:bg-zinc-950 mb-24">
        {/* FULL BLEED BACKGROUND */}
        <div className="absolute inset-0 z-0">
          <img 
            src="https://images.unsplash.com/photo-1517836357463-d25dfeac3438?q=80&w=2000&auto=format&fit=crop"
            alt="FitWorkout Background"
            className="w-full h-full object-cover object-center opacity-40 grayscale-[0.2]"
          />
          {/* Gradients to create the Netflix left-pane and bottom-fade effect */}
          <div className="absolute inset-0 bg-gradient-to-r from-white via-white/70 to-transparent w-[80%] md:w-[60%]" />
          <div className="absolute inset-0 bg-gradient-to-t from-white via-white/20 to-transparent h-[120%]" />
          <div className="absolute inset-0 bg-white/10" />
        </div>

        {/* CONTENT (NETFLIX LAYOUT) */}
        <div className="container-custom relative z-10 w-full pt-20">
          <motion.div 
            className="max-w-2xl"
            initial={{ opacity: 0, x: -40 }}
            animate={{ opacity: 1, x: 0 }}
            transition={{ duration: 1, ease: [0.16, 1, 0.3, 1] }}
          >
            {/* "Netflix Original" Style Badge */}
            <div className="flex items-center gap-2 mb-4">
              <div className="flex items-center justify-center w-5 h-5 bg-[#D71920] text-white font-black text-xs leading-none">
                B
              </div>
              <span className="text-[10px] font-bold uppercase tracking-[0.3em] text-zinc-500 dark:text-zinc-400">
                Uma Produção Original
              </span>
            </div>
            
            {/* Movie-style Title */}
            <h1 className="font-heading font-black text-6xl md:text-8xl lg:text-[7rem] text-zinc-900 dark:text-white mb-2 tracking-tighter leading-none uppercase" style={{ textShadow: '0 10px 30px rgba(255,255,255,0.8)' }}>
              Fit<span className="text-[#D71920]">Workout</span>
            </h1>
            
            {/* Top 10 Badge */}
            <div className="flex items-center gap-3 mb-6">
              <div className="bg-[#D71920] text-white text-[10px] font-black px-2 py-0.5 uppercase tracking-wider">
                Top 10
              </div>
              <span className="font-heading font-bold text-zinc-900 dark:text-white text-sm md:text-base tracking-wide">
                A app de fitness mais usada em Angola
              </span>
            </div>
            
            {/* Synopsis */}
            <p className="font-body text-zinc-700 text-lg md:text-xl leading-snug mb-8 font-medium max-w-lg drop-shadow-sm">
              Treina onde e quando quiseres. Acesso instantâneo a programas guiados, tracking de resultados e demonstrações 4K para transformares o teu corpo.
            </p>
            
            {/* Action Buttons (Play & More Info) */}
            <div className="flex flex-col sm:flex-row items-center gap-3 md:gap-4">
              <button onClick={() => { setInitialPlanId(undefined); setInitialCycle(undefined); setCheckoutOpen(true); }} className="w-full sm:w-auto px-8 py-3.5 bg-zinc-900 hover:bg-black text-white font-heading font-bold text-lg md:text-xl transition-all duration-300 flex items-center justify-center gap-3 shadow-lg hover:scale-105 active:scale-95">
                <Play size={24} className="fill-white" /> Reproduzir Treino
              </button>
              
              <button onClick={() => window.scrollTo({ top: window.innerHeight, behavior: 'smooth'})} className="w-full sm:w-auto px-8 py-3.5 bg-zinc-200/80 hover:bg-zinc-300/90 backdrop-blur-md text-zinc-900 dark:text-white font-heading font-bold text-lg md:text-xl transition-all duration-300 flex items-center justify-center gap-3 shadow-sm hover:scale-105 active:scale-95">
                <CheckCircle2 size={24} /> Mais Informações
              </button>
            </div>
          </motion.div>
        </div>
      </section>

      {/* ── COMO FUNCIONA (NEW) ── */}
      <section className="bg-[#f5f5f7] dark:bg-zinc-900 border-y border-zinc-200 dark:border-zinc-800 py-24 mb-32">
        <div className="container-custom">
          <div className="text-center mb-16">
            <h2 className="font-heading font-bold text-3xl md:text-4xl text-zinc-900 dark:text-white mb-4">Como Funciona</h2>
            <p className="font-body text-zinc-500 dark:text-zinc-400 text-lg">Em menos de 3 minutos estás pronto a treinar.</p>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-3 gap-12 max-w-5xl mx-auto relative">
            {/* Linha de conexão visível apenas em Desktop */}
            <div className="hidden md:block absolute top-8 left-[15%] right-[15%] h-px bg-gradient-to-r from-transparent via-zinc-300 to-transparent" />
            
            {[
              { step: '1', title: 'Registo e Avaliação', desc: 'Responde a um questionário rápido sobre os teus objetivos, disponibilidade e nível de experiência.' },
              { step: '2', title: 'Plano Atribuído', desc: 'O nosso algoritmo, suportado pela metodologia Bruno Samora, escolhe o programa perfeito para ti.' },
              { step: '3', title: 'Treina e Regista', desc: 'Abre a app no ginásio ou em casa, segue os vídeos e regista as cargas para forçar a evolução.' }
            ].map((item, i) => (
              <div key={i} className="text-center relative z-10">
                <div className="w-16 h-16 bg-white dark:bg-zinc-950 border-2 border-zinc-200 dark:border-zinc-800 flex items-center justify-center mx-auto mb-6 shadow-xl text-xl font-black text-zinc-900 dark:text-white">
                  {item.step}
                </div>
                <h3 className="font-heading font-bold text-2xl text-zinc-900 dark:text-white mb-3">{item.title}</h3>
                <p className="font-body text-zinc-500 dark:text-zinc-400 leading-relaxed">{item.desc}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* ── FUNCIONALIDADES ── */}
      <section className="container-custom mb-32">
        <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
          {[
            { icon: Calendar, title: 'Planos Periodizados', desc: 'Esquece as folhas de Excel. Rotinas desenhadas cientificamente para hipertrofia ou performance.' },
            { icon: Activity, title: 'Tracking Preciso', desc: 'Acompanha a tua evolução com métricas detalhadas, gráficos de volume e records pessoais (PRs).' },
            { icon: Trophy, title: 'Gamification', desc: 'Supera-te em comunidade. Conquista badges e sobe no ranking mensal dos desafios FitWorkout.' }
          ].map((item, i) => (
            <motion.div 
              key={i}
              initial={{ opacity: 0, y: 20 }}
              whileInView={{ opacity: 1, y: 0 }}
              viewport={{ once: true }}
              transition={{ delay: i * 0.1 }}
              className="p-10 bg-white dark:bg-zinc-950 border border-zinc-200 dark:border-zinc-800 hover:border-zinc-300 transition-all duration-300"
            >
              <div className="w-14 h-14 bg-[#f5f5f7] dark:bg-zinc-900 flex items-center justify-center mb-8 text-zinc-900 dark:text-white">
                <item.icon size={24} />
              </div>
              <h3 className="font-heading font-bold text-2xl text-zinc-900 dark:text-white mb-4">{item.title}</h3>
              <p className="font-body text-zinc-500 dark:text-zinc-400 leading-relaxed">{item.desc}</p>
            </motion.div>
          ))}
        </div>
      </section>

      {/* ── RESULTADOS E COMUNIDADE (NEW) ── */}
      <section className="container-custom mb-32">
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-12">
          {/* Resultados Reais */}
          <div className="bg-white dark:bg-zinc-950 p-12 border border-zinc-200 dark:border-zinc-800 flex flex-col justify-center text-center items-center">
            <TrendingUp size={40} className="text-zinc-900 dark:text-white mb-6" />
            <h3 className="font-heading font-black text-3xl text-zinc-900 dark:text-white mb-4">Resultados Reais</h3>
            <p className="font-body text-zinc-500 dark:text-zinc-400 mb-8 max-w-sm">Junta-te a milhares de utilizadores que já transformaram o seu corpo com a nossa metodologia.</p>
            <div className="flex -space-x-4 mb-4">
              {[...Array(5)].map((_, i) => (
                <div key={i} className="w-12 h-12 border-2 border-white bg-[#f5f5f7] dark:bg-zinc-900 flex items-center justify-center overflow-hidden">
                  <img src={`https://i.pravatar.cc/100?img=${i+10}`} alt="User" />
                </div>
              ))}
            </div>
            <p className="text-zinc-500 dark:text-zinc-400 text-xs font-bold uppercase tracking-widest">+ 5,000 Transformações</p>
          </div>

          {/* Comunidade */}
          <div className="bg-gradient-to-br from-zinc-100 to-[#e5e5e5]-[3rem] p-12 border border-zinc-200 dark:border-zinc-800 flex flex-col justify-center text-center items-center">
            <Users size={40} className="text-zinc-600 dark:text-zinc-300 mb-6" />
            <h3 className="font-heading font-black text-3xl text-zinc-900 dark:text-white mb-4">O Grupo Privado</h3>
            <p className="font-body text-zinc-600 dark:text-zinc-300 mb-8 max-w-sm">Terás acesso imediato à comunidade Discord exclusiva. Treina, partilha dúvidas e motiva-te com pessoas na mesma missão que tu.</p>
            <button onClick={() => { setInitialPlanId(undefined); setInitialCycle(undefined); setCheckoutOpen(true); }} className="bg-white dark:bg-zinc-950 hover:bg-zinc-50 dark:bg-zinc-900 text-zinc-900 dark:text-white font-bold px-8 py-3 transition-colors border border-zinc-200 dark:border-zinc-800">
              Conhecer Comunidade
            </button>
          </div>
        </div>
      </section>

      {/* ── PLANOS ── */}
      <section className="container-custom mb-32">
        <div className="text-center mb-16">
          <h2 className="font-heading font-bold text-4xl md:text-5xl text-zinc-900 dark:text-white mb-4">Acesso Ilimitado</h2>
          <p className="font-body text-zinc-500 dark:text-zinc-400 text-lg">Um pequeno investimento na tua saúde diária. Cancela quando quiseres.</p>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-8 max-w-4xl mx-auto">
          {/* Mensal */}
          <div className="p-10 bg-white dark:bg-zinc-950 border border-zinc-200 dark:border-zinc-800 flex flex-col">
            <h3 className="text-zinc-900 dark:text-white font-bold text-2xl mb-2">Mensal</h3>
            <div className="flex items-baseline gap-1 mb-8">
              <span className="text-5xl font-black text-zinc-900 dark:text-white">19.900 Kz</span>
              <span className="text-zinc-500 dark:text-zinc-400 font-medium">/mês</span>
            </div>
            <ul className="space-y-4 mb-10 flex-grow">
              {['Acesso a todos os programas', 'Suporte da comunidade', 'Atualizações mensais na app', 'Sem fidelização'].map((feat, i) => (
                <li key={i} className="flex items-center gap-3 text-zinc-700 font-medium">
                  <CheckCircle2 size={18} className="text-zinc-400" /> {feat}
                </li>
              ))}
            </ul>
            <button onClick={() => { setInitialPlanId(plans[0]?.id); setInitialCycle('monthly'); setCheckoutOpen(true); }} className="w-full py-4 bg-[#f5f5f7] dark:bg-zinc-900 hover:bg-zinc-200 text-zinc-900 dark:text-white font-bold transition-colors border border-zinc-200 dark:border-zinc-800">
              Subscrever Mensal
            </button>
          </div>

          {/* Anual (Destaque) */}
          <div className="p-10 bg-zinc-900 text-white relative flex flex-col shadow-[0_0_50px_rgba(0,0,0,0.1)]">
            <div className="absolute -top-4 left-1/2 -translate-x-1/2 bg-white dark:bg-zinc-950 text-zinc-900 dark:text-white text-xs font-bold uppercase tracking-widest px-4 py-2 border border-zinc-200 dark:border-zinc-800">
              Mais Popular (Poupa 40%)
            </div>
            <h3 className="font-bold text-2xl mb-2 mt-2">Anual</h3>
            <div className="flex items-baseline gap-1 mb-8">
              <span className="text-5xl font-black">119.900 Kz</span>
              <span className="text-white/50 font-medium">/ano</span>
            </div>
            <ul className="space-y-4 mb-10 flex-grow">
              {['Acesso a todos os programas', 'Suporte prioritário', 'Acesso ao E-book de Nutrição', 'Desconto permanente de 15% na Store'].map((feat, i) => (
                <li key={i} className="flex items-center gap-3 font-semibold text-white/90">
                  <CheckCircle2 size={18} className="text-white" /> {feat}
                </li>
              ))}
            </ul>
            <button onClick={() => { setInitialPlanId(plans[0]?.id); setInitialCycle('annual'); setCheckoutOpen(true); }} className="w-full py-4 bg-white dark:bg-zinc-950 hover:bg-zinc-100 dark:bg-zinc-800 text-zinc-900 dark:text-white font-bold transition-colors">
              Subscrever Anual
            </button>
          </div>
        </div>
      </section>

    </main>
  )
}
