import { useState } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import { GraduationCap, BookOpen, Award, CheckCircle2, PlayCircle, Star, Target, Users, LayoutList, ChevronDown } from 'lucide-react'
import { useCMS } from './context/CMSContext'
import ProgramCheckoutModal from './ui/ProgramCheckoutModal'


const courses = [
  {
    id: 1,
    title: 'A Biologia da Alta Performance',
    duration: '4 Módulos • 12 Horas',
    level: 'Avançado',
    desc: 'O guia definitivo para reprogramares o teu corpo para o máximo rendimento físico e mental.',
    image: 'https://images.unsplash.com/photo-1594381898411-846e7d193883?ixlib=rb-4.0.3&auto=format&fit=crop&w=1000&q=80',
    link: '#'
  },
  {
    id: 2,
    title: 'Nutrição Otimizada (E-Book)',
    duration: '8 Módulos • 40 Horas',
    level: 'Profissional',
    desc: 'Esquece as dietas da moda. Descobre o que realmente abastece a máquina humana.',
    image: 'https://images.unsplash.com/photo-1490645935967-10de6ba17061?ixlib=rb-4.0.3&auto=format&fit=crop&w=1000&q=80',
    link: '#'
  },
  {
    id: 3,
    title: 'Mentalidade de Elite',
    duration: '2 Módulos • 6 Horas',
    level: 'Iniciante',
    desc: 'Treina a tua mente para o caos. Resiliência, foco e disciplina inabalável.',
    image: 'https://images.unsplash.com/photo-1522075469751-3a6694fb2f61?ixlib=rb-4.0.3&auto=format&fit=crop&w=1000&q=80',
    link: '#'
  }
]

const faqs = [
  {
    q: 'As formações são 100% online?',
    a: 'Sim, a maior parte do nosso catálogo é on-demand, gravado em 4K e disponível 24/7. Temos pontualmente algumas imersões presenciais que são anunciadas antecipadamente.'
  },
  {
    q: 'Os certificados têm validade no mercado de trabalho?',
    a: 'Os nossos certificados profissionais (como o de Personal Trainer PRO) são desenhados segundo as exigências de excelência das principais cadeias de ginásios e são frequentemente o fator de desempate em contratações de alta performance.'
  },
  {
    q: 'Quanto tempo tenho para terminar um curso?',
    a: 'O acesso aos conteúdos é vitalício. Sabemos que os nossos alunos têm rotinas intensas, por isso poderás estudar ao teu ritmo, sem prazos de validade ou pressões externas.'
  },
  {
    q: 'Existe algum tipo de suporte de dúvidas?',
    a: 'Sim. Dentro da nossa plataforma tens acesso exclusivo a uma comunidade de alunos e suporte direto da equipa de mentores Bruno Samora para garantires que nenhum obstáculo trava a tua evolução.'
  }
]

export default function Formacao() {
  const { programs, getPlansByProgram } = useCMS()
  const [checkoutOpen, setCheckoutOpen] = useState(false)
  const [initialPlanId, setInitialPlanId] = useState<string | undefined>()
  const openForm = () => window.dispatchEvent(new Event('openFormModal'))

  // Find the matching program in CMS
  const program = programs.find(p => p.id === 'prog-formacao') || null
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
      {/* ── HERO SECTION (EDITORIAL PREMIUM SPLIT) ── */}
      <section className="relative w-full overflow-hidden bg-white dark:bg-zinc-950 border-b border-zinc-100 dark:border-zinc-800">
        <div className="grid lg:grid-cols-2 h-[65vh] min-h-[520px] max-h-[640px]">

          {/* LEFT — CONTENT */}
          <motion.div
            className="flex flex-col justify-center px-8 md:px-16 lg:px-20 py-24 lg:py-0"
            initial={{ opacity: 0, x: -30 }}
            animate={{ opacity: 1, x: 0 }}
            transition={{ duration: 0.9, ease: [0.16, 1, 0.3, 1] }}
          >
            {/* Eyebrow */}
            <div className="flex items-center gap-3 mb-8">
              <div className="w-8 h-px bg-zinc-300" />
              <span className="text-[11px] font-medium uppercase tracking-[0.25em] text-zinc-500 dark:text-zinc-400">Formação de Elite</span>
            </div>

            <h1 className="font-heading font-normal text-5xl md:text-6xl lg:text-[5rem] text-zinc-900 dark:text-white mb-6 tracking-tight leading-[1.05]">
              Eleva o teu<br/>
              <span className="font-bold text-[#D71920]">Conhecimento.</span>
            </h1>

            <p className="font-body text-zinc-500 dark:text-zinc-400 text-lg leading-relaxed mb-10 font-light max-w-md">
              Cursos, certificações e mentorias desenhados para elevar as tuas competências ao patamar da excelência. Aprende com quem vive a alta performance diariamente.
            </p>

            {/* Stats row */}
            <div className="flex items-center gap-8 mb-10 border-t border-b border-zinc-100 dark:border-zinc-800 py-6">
              {[
                { value: '3', label: 'Cursos Online' },
                { value: '18h+', label: 'Conteúdo' },
                { value: '100%', label: 'Online' },
              ].map((s, i) => (
                <div key={i}>
                  <p className="font-heading font-black text-2xl text-zinc-900 dark:text-white">{s.value}</p>
                  <p className="font-body text-xs uppercase tracking-widest text-zinc-400 mt-0.5">{s.label}</p>
                </div>
              ))}
            </div>

            <div className="flex flex-col sm:flex-row items-center gap-4">
              <button onClick={() => { setInitialPlanId(undefined); setCheckoutOpen(true); }} className="w-full sm:w-auto px-10 py-4 bg-zinc-900 hover:bg-[#D71920] text-white font-body font-medium tracking-wide text-sm transition-colors duration-500 flex items-center justify-center gap-4 group">
                Ver Catálogo Completo
                <GraduationCap size={16} className="text-zinc-400 group-hover:text-white transition-colors" />
              </button>
            </div>
          </motion.div>

          {/* RIGHT — IMAGE STACK */}
          <motion.div
            className="relative hidden lg:block overflow-hidden bg-zinc-50 dark:bg-zinc-900"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            transition={{ duration: 1.2, delay: 0.2 }}
          >
            <img
              src="https://images.unsplash.com/photo-1524178232363-1fb2b075b655?q=80&w=1200&auto=format&fit=crop"
              alt="Formação de Elite"
              className="w-full h-full object-cover grayscale opacity-75 mix-blend-multiply hover:grayscale-0 hover:opacity-100 transition-all duration-[1.5s] ease-out"
            />
            {/* Minimal bottom label */}
            <div className="absolute bottom-0 left-0 bg-white dark:bg-zinc-950 px-8 py-6 flex items-center gap-4">
              <GraduationCap size={20} className="text-zinc-300" />
              <div>
                <p className="font-heading font-medium text-zinc-900 dark:text-white text-sm tracking-wide uppercase">Certificado Profissional</p>
                <p className="font-body text-[10px] uppercase tracking-widest text-zinc-400">Reconhecido no Mercado</p>
              </div>
            </div>
          </motion.div>

        </div>
      </section>

      {/* ── A QUEM SE DESTINA (NEW) ── */}
      <section className="border-y border-zinc-200 dark:border-zinc-800 bg-[#f5f5f7] dark:bg-zinc-900 py-24 mb-32">
        <div className="container-custom">
          <div className="text-center mb-16">
            <h2 className="font-heading font-bold text-3xl md:text-4xl text-zinc-900 dark:text-white mb-4">Para quem é a Formação?</h2>
            <p className="font-body text-zinc-500 dark:text-zinc-400 text-lg">Criamos soluções segmentadas para cada nível da tua jornada.</p>
          </div>
          
          <div className="grid grid-cols-1 md:grid-cols-3 gap-8 max-w-5xl mx-auto">
            {[
              { icon: Target, title: 'Iniciantes & Entusiastas', desc: 'Para quem quer construir fundações sólidas de treino, mindset e nutrição sem cair em mitos.' },
              { icon: Users, title: 'Líderes & Executivos', desc: 'Para quem gere pessoas e precisa de ferramentas avançadas de influência, produtividade e resiliência.' },
              { icon: Award, title: 'Profissionais de Fitness', desc: 'Para Personal Trainers que querem destacar-se no mercado com certificações de elite.' }
            ].map((p, i) => (
              <motion.div 
                key={i}
                initial={{ opacity: 0, y: 20 }}
                whileInView={{ opacity: 1, y: 0 }}
                viewport={{ once: true }}
                transition={{ delay: i * 0.1 }}
                className="p-8 bg-white dark:bg-zinc-950 border border-zinc-200 dark:border-zinc-800 text-center hover:border-blue-500/30 transition-colors group"
              >
                <p.icon size={32} className="mx-auto text-blue-500 mb-6 group-hover:scale-110 transition-transform" />
                <h3 className="font-heading font-bold text-xl text-zinc-900 dark:text-white mb-3">{p.title}</h3>
                <p className="font-body text-zinc-500 dark:text-zinc-400 text-sm leading-relaxed">{p.desc}</p>
              </motion.div>
            ))}
          </div>
        </div>
      </section>

      {/* ── METODOLOGIA ── */}
      <section className="container-custom mb-32">
        <div className="grid grid-cols-1 md:grid-cols-3 gap-8">
          {[
            { icon: PlayCircle, title: 'Conteúdo On-Demand', desc: 'Acede às aulas em formato 4K onde e quando quiseres. Aprendizagem ao teu ritmo sem restrições.' },
            { icon: LayoutList, title: 'Componente Prática', desc: 'Não vendemos teoria vazia. Todos os cursos têm exercícios de implementação imediata.' },
            { icon: BookOpen, title: 'Materiais Exclusivos', desc: 'Workbooks interativos, planilhas e templates prontos a aplicar na tua rotina profissional.' }
          ].map((item, i) => (
            <motion.div 
              key={i}
              initial={{ opacity: 0, y: 20 }}
              whileInView={{ opacity: 1, y: 0 }}
              viewport={{ once: true }}
              transition={{ delay: i * 0.1 }}
              className="text-center p-8 bg-[#f5f5f7] dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-800"
            >
              <item.icon size={32} className="mx-auto text-blue-500 mb-6" />
              <h3 className="font-heading font-bold text-xl text-zinc-900 dark:text-white mb-3">{item.title}</h3>
              <p className="font-body text-zinc-500 dark:text-zinc-400 text-sm leading-relaxed">{item.desc}</p>
            </motion.div>
          ))}
        </div>
      </section>



      {/* ── COURSES GRID ── */}
      <section className="container-custom mb-32">
        <div className="text-center mb-16">
          <h2 className="font-heading font-bold text-4xl md:text-5xl text-zinc-900 dark:text-white mb-4">Cursos em Destaque</h2>
          <p className="font-body text-zinc-500 dark:text-zinc-400 text-lg">As formações mais requisitadas para catapultar a tua carreira.</p>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
          {courses.map((course, i) => (
            <motion.div 
              key={i}
              initial={{ opacity: 0, y: 20 }}
              whileInView={{ opacity: 1, y: 0 }}
              viewport={{ once: true }}
              transition={{ delay: i * 0.1 }}
              className="group cursor-pointer overflow-hidden bg-white dark:bg-zinc-950 border border-zinc-200 dark:border-zinc-800 hover:border-blue-500/30 transition-all flex flex-col h-full"
            >
              <div className="h-56 relative overflow-hidden shrink-0">
                <div className="absolute inset-0 bg-zinc-900/10 z-10 group-hover:bg-transparent transition-colors duration-500" />
                <img 
                  src={course.image} 
                  alt={course.title}
                  className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-700" 
                />
                <div className="absolute top-4 right-4 z-20 bg-white/90 backdrop-blur-md px-3 py-1 text-xs font-bold text-zinc-900 dark:text-white border border-zinc-200 dark:border-zinc-800">
                  {course.level}
                </div>
              </div>
              <div className="p-6 md:p-8 flex flex-col flex-grow">
                <p className="text-blue-500 text-[10px] font-bold uppercase tracking-widest mb-3">{course.duration}</p>
                <h3 className="font-heading font-bold text-xl md:text-2xl text-zinc-900 dark:text-white mb-6 leading-tight">{course.title}</h3>
                
                <ul className="space-y-3 mb-8 flex-grow">
                  {['Acesso Vitalício', 'Módulos Práticos', 'Suporte Especializado'].map((feature, idx) => (
                    <li key={idx} className="flex items-center gap-3 text-sm text-zinc-600 dark:text-zinc-300 font-medium">
                      <CheckCircle2 size={16} className="text-blue-500 shrink-0" /> {feature}
                    </li>
                  ))}
                </ul>

                <button onClick={() => { setInitialPlanId(undefined); setCheckoutOpen(true); }} className="w-full py-4 bg-[#f5f5f7] dark:bg-zinc-900 hover:bg-blue-600 hover:text-white text-zinc-900 dark:text-white font-bold text-sm transition-colors mt-auto border border-zinc-200 dark:border-zinc-800 hover:border-blue-600">
                  Ver Detalhes do Curso
                </button>
              </div>
            </motion.div>
          ))}
        </div>
      </section>

    </main>
  )
}
