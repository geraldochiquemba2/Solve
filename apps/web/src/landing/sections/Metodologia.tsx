import { useState } from 'react'
import { motion } from 'framer-motion'
import { Zap, Focus, Crown, Rocket, Heart, ArrowRight } from 'lucide-react'

const pillars = [
  {
    number: '01',
    icon: Zap,
    title: 'Treino & Força',
    subtitle: 'A base da evolução física',
    description:
      'Programas estruturados para a hipertrofia e força máxima, utilizando metodologias científicas para garantir progressão constante sem o risco de lesões e estagnação.',
    benefits: ['Periodização do treino', 'Técnica e amplitude de movimento', 'Desenvolvimento de força funcional', 'Metodologias de hipertrofia comprovadas'],
  },
  {
    number: '02',
    icon: Focus,
    title: 'Nutrição & Energia',
    subtitle: 'O combustível da performance',
    description:
      'Planos nutricionais focados em maximizar a performance no ginásio, melhorar a composição corporal e manter os níveis de energia vitais ao longo do dia.',
    benefits: ['Alimentação orientada a objetivos', 'Suplementação inteligente', 'Gestão do metabolismo', 'Hidratação e otimização celular'],
  },
  {
    number: '03',
    icon: Crown,
    title: 'Mindset',
    subtitle: 'A vantagem psicológica',
    description:
      'O corpo alcança aquilo em que a mente acredita. Desenvolvemos foco inabalável, resiliência perante o desconforto e uma mentalidade orientada ao sucesso.',
    benefits: ['Gestão de stress', 'Construção de hábitos de ferro', 'Resiliência e superação', 'Eliminação de crenças limitantes'],
  },
  {
    number: '04',
    icon: Rocket,
    title: 'Recuperação',
    subtitle: 'O momento em que crescemos',
    description:
      'O músculo cresce durante o descanso. Ajudamos-te a otimizar a qualidade do sono e implementar técnicas de recuperação ativa para estares a 100% no próximo treino.',
    benefits: ['Protocolos de sono profundo', 'Recuperação ativa (SPA/Crioterapia)', 'Redução da inflamação', 'Gestão do sistema nervoso central'],
  },
  {
    number: '05',
    icon: Heart,
    title: 'Longevidade',
    subtitle: 'Resultados para a vida',
    description:
      'Criamos hábitos saudáveis que garantem que não só alcanças o teu corpo de sonho agora, como o manténs ao longo de décadas com saúde articular e cardiovascular.',
    benefits: ['Mobilidade e prevenção de lesões', 'Saúde cardiovascular', 'Manutenção a longo prazo', 'Equilíbrio holístico (Corpo e Mente)'],
  },
]

export default function Metodologia() {
  const [active, setActive] = useState(0)
  const activePillar = pillars[active]
  const ActiveIcon = activePillar.icon

  return (
    <section id="metodologia" className="section-py bg-[#f5f5f7] dark:bg-zinc-900">
      <div className="container-custom">

        {/* Header */}
        <div className="text-center mb-16">

          <motion.h2
            className="font-heading font-black text-4xl md:text-5xl text-zinc-900 dark:text-white mb-5"
            initial={{ opacity: 0, y: 20 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true }}
            transition={{ delay: 0.1 }}
          >
            Os 5 Pilares da{' '}
            <span className="text-red-gradient">Alta Performance</span>
          </motion.h2>
          <motion.p
            className="font-body text-zinc-500 dark:text-zinc-400 text-lg max-w-2xl mx-auto"
            initial={{ opacity: 0, y: 20 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true }}
            transition={{ delay: 0.2 }}
          >
            Uma metodologia provada, assente nestes cinco pilares fundamentais, para esculpir o físico, fortalecer a mente e alavancar a tua confiança pessoal.
          </motion.p>
        </div>

        {/* Interactive pillar selector */}
        <motion.div
          className="grid lg:grid-cols-[1fr_1.5fr] gap-8 items-start"
          initial={{ opacity: 0, y: 40 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true }}
          transition={{ duration: 0.7 }}
        >
          {/* Left: Pillar buttons */}
          <div className="flex flex-col gap-3">
            {pillars.map((pillar, i) => {
              const Icon = pillar.icon
              return (
                <button
                  key={pillar.title}
                  onClick={() => setActive(i)}
                  className={`flex items-center gap-4 p-4 border text-left transition-all duration-300 group ${
                    active === i
                      ? 'bg-[#D71920]/10 border-[#D71920]/50 shadow-[0_0_30px_rgba(215,25,32,0.1)]'
                      : 'bg-white dark:bg-zinc-950 border-zinc-200 dark:border-zinc-800 hover:border-[#D71920]/30 hover:bg-[#D71920]/5'
                  }`}
                  id={`metodologia-pillar-${i}`}
                >
                  <div className={`w-12 h-12 flex items-center justify-center flex-shrink-0 transition-all ${
                    active === i ? 'bg-[#D71920] shadow-[0_8px_20px_rgba(215,25,32,0.35)]' : 'bg-zinc-50 dark:bg-zinc-900 group-hover:bg-[#D71920]/20'
                  }`}>
                    <Icon size={20} className={active === i ? 'text-white' : 'text-[#D71920]'} />
                  </div>
                  <div>
                    <div className={`font-heading font-bold text-base transition-colors ${active === i ? 'text-zinc-900 dark:text-white' : 'text-zinc-600 dark:text-zinc-300 group-hover:text-zinc-900 dark:text-white'}`}>
                      {pillar.title}
                    </div>
                    <div className="text-zinc-500 dark:text-zinc-400 text-xs font-body mt-0.5">{pillar.subtitle}</div>
                  </div>
                  <div className="ml-auto">
                    <span className={`font-heading font-black text-2xl transition-colors ${active === i ? 'text-[#D71920]' : 'text-zinc-300'}`}>
                      {pillar.number}
                    </span>
                  </div>
                </button>
              )
            })}
          </div>

          {/* Right: Active pillar detail */}
          <motion.div
            key={active}
            className="bg-white dark:bg-zinc-950 border border-[#D71920]/20 p-8 sticky top-28"
            initial={{ opacity: 0, x: 30 }}
            animate={{ opacity: 1, x: 0 }}
            transition={{ duration: 0.4, ease: [0.22, 1, 0.36, 1] as const }}
          >
            {/* Icon + title */}
            <div className="flex items-start gap-5 mb-6">
              <div className="w-16 h-16 bg-[#D71920] flex items-center justify-center shadow-[0_12px_30px_rgba(215,25,32,0.35)] flex-shrink-0">
                <ActiveIcon size={28} className="text-white" />
              </div>
              <div>
                <div className="text-[#D71920] text-xs font-body font-semibold tracking-widest uppercase mb-1">{activePillar.number} / 05</div>
                <h3 className="font-heading font-black text-2xl text-zinc-900 dark:text-white">{activePillar.title}</h3>
                <p className="text-zinc-500 dark:text-zinc-400 text-sm font-body">{activePillar.subtitle}</p>
              </div>
            </div>

            {/* Description */}
            <p className="font-body text-zinc-500 dark:text-zinc-400 leading-relaxed mb-8 text-base">
              {activePillar.description}
            </p>

            {/* Benefits */}
            <div className="space-y-3 mb-8">
              {activePillar.benefits.map((benefit) => (
                <div key={benefit} className="flex items-center gap-3">
                  <div className="w-5 h-5 bg-[#D71920]/15 border border-[#D71920]/30 flex items-center justify-center flex-shrink-0">
                    <div className="w-1.5 h-1.5 bg-[#D71920]" />
                  </div>
                  <span className="font-body text-zinc-600 dark:text-zinc-300 text-sm">{benefit}</span>
                </div>
              ))}
            </div>

            <button
              onClick={() => document.querySelector('#cta')?.scrollIntoView({ behavior: 'smooth' })}
              className="btn btn-primary w-full justify-center gap-3"
              id={`metodologia-cta-${active}`}
            >
              Quero Implementar Este Pilar
              <ArrowRight size={18} />
            </button>
          </motion.div>
        </motion.div>
      </div>
    </section>
  )
}
