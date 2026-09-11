import { motion } from 'framer-motion'
import { ArrowRight, HeartPulse, UserCheck, BarChart2, Hammer, Mic, BookOpen, GraduationCap } from 'lucide-react'

const services = [
  {
    icon: HeartPulse,
    title: 'Corporate Wellness',
    description: 'Programas completos de bem-estar e alta performance para equipas do setor público e privado. Desde o diagnóstico à implementação.',
    tag: 'Mais Procurado',
  },
  {
    icon: UserCheck,
    title: 'Mentoria Executiva',
    description: 'Acompanhamento 1:1 intensivo para CEOs, Directores e Líderes Institucionais. Metodologia com foco em resultados mensuráveis.',
  },
  {
    icon: BarChart2,
    title: 'Consultoria Organizacional',
    description: 'Diagnóstico profundo e estratégia para empresas e instituições públicas que pretendem elevar a performance global da estrutura.',
  },
  {
    icon: Hammer,
    title: 'Workshops Intensivos',
    description: 'Formações de 1 a 3 dias dedicadas aos quadros médios e superiores, focadas na implementação imediata.',
  },
  {
    icon: Mic,
    title: 'Palestras & Keynotes',
    description: 'Intervenções inspiradoras baseadas em neurociência para eventos corporativos e cimeiras institucionais.',
  },
  {
    icon: BookOpen,
    title: 'Cursos Online',
    description: 'Programas de capacitação digital para líderes e profissionais, com suporte e acesso contínuo às métricas.',
  },
  {
    icon: GraduationCap,
    title: 'Masterclass Executiva',
    description: 'Programas avançados de imersão total para decisores corporativos e governamentais que operam sob alta pressão.',
    tag: 'Novidade',
  },
]

const containerVariants = {
  hidden: {},
  visible: { transition: { staggerChildren: 0.08 } },
}

const cardVariants = {
  hidden: { opacity: 0, y: 30 },
  visible: { opacity: 1, y: 0, transition: { duration: 0.6, ease: [0.22, 1, 0.36, 1] as const } },
}

export default function Servicos() {
  return (
    <section id="servicos" className="section-py bg-zinc-900">
      <div className="container-custom">

        {/* Header */}
        <div className="text-center mb-16">

          <motion.h2
            className="font-heading font-black text-4xl md:text-5xl text-white mb-5"
            initial={{ opacity: 0, y: 20 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true }}
            transition={{ delay: 0.1 }}
          >
            Como Posso{' '}
            <span className="text-red-gradient">Ajudar</span>{' '}
            a Sua Organização
          </motion.h2>
          <motion.p
            className="font-body text-white/50 text-lg max-w-2xl mx-auto"
            initial={{ opacity: 0, y: 20 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true }}
            transition={{ delay: 0.2 }}
          >
            Soluções flexíveis e personalizadas para cada necessidade — desde keynotes pontuais
            a programas corporativos de longa duração.
          </motion.p>
        </div>

        {/* Services grid */}
        <motion.div
          className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-5"
          variants={containerVariants}
          initial="hidden"
          whileInView="visible"
          viewport={{ once: true, margin: '-60px' }}
        >
          {services.map((service, i) => {
            const Icon = service.icon
            // Corporate Wellness gets a featured style
            const isFeatured = i === 0
            return (
              <motion.div
                key={service.title}
                variants={cardVariants}
                className={`group relative border p-6 flex flex-col transition-all duration-400 cursor-default ${
                  isFeatured
                    ? 'bg-gradient-to-b from-[#1a0305] to-[#111111] border-[#D71920]/40 md:col-span-2 lg:col-span-1 xl:col-span-1 shadow-[0_0_40px_rgba(215,25,32,0.15)]'
                    : 'bg-[#111111] border-[#2A2A2A] hover:border-[#D71920]/30'
                }`}
                whileHover={{ y: -6 }}
              >
                {/* Tag */}
                {service.tag && (
                  <span className="absolute top-4 right-4 bg-[#D71920] text-white text-[10px] font-body font-bold px-3 py-1 tracking-wide uppercase">
                    {service.tag}
                  </span>
                )}

                <div className={`w-12 h-12 flex items-center justify-center mb-5 transition-all ${
                  isFeatured
                    ? 'bg-[#D71920] shadow-[0_8px_20px_rgba(215,25,32,0.35)]'
                    : 'bg-[#D71920]/10 border border-[#D71920]/20 group-hover:bg-[#D71920]/20'
                }`}>
                  <Icon size={22} className={isFeatured ? 'text-white' : 'text-[#D71920]'} />
                </div>

                <h3 className="font-heading font-bold text-white text-lg mb-3">{service.title}</h3>
                <p className="font-body text-white/50 text-sm leading-relaxed flex-1">{service.description}</p>

                <button
                  onClick={() => window.dispatchEvent(new Event('openFormModal'))}
                  className="mt-5 mt-auto flex items-center gap-2 text-[#D71920] text-sm font-body font-semibold hover:gap-3 transition-all group/btn"
                  id={`servico-${service.title.toLowerCase().replace(/\s+/g, '-')}-btn`}
                >
                  Saber mais
                  <ArrowRight size={14} className="group-hover/btn:translate-x-1 transition-transform" />
                </button>
              </motion.div>
            )
          })}
        </motion.div>
      </div>
    </section>
  )
}
