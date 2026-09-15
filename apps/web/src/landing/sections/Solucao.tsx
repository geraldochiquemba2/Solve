import { motion } from 'framer-motion'
import { ClipboardList, Compass, Cog, HeartHandshake, Trophy } from 'lucide-react'

const steps = [
  {
    number: '01',
    icon: ClipboardList,
    title: 'Avaliação & Diagnóstico',
    description: 'Análise profunda do teu estado atual físico e mental, identificando bloqueios e as melhores oportunidades de evolução.',
  },
  {
    number: '02',
    icon: Compass,
    title: 'O Plano de Ação',
    description: 'Desenvolvimento de uma estratégia personalizada com base na ciência do desporto e do comportamento para atingir as tuas metas.',
  },
  {
    number: '03',
    icon: Cog,
    title: 'Ação e Consistência',
    description: 'Execução estruturada do programa através de treinos otimizados, mentoria, nutrição adequada e rotinas que funcionam no dia a dia.',
  },
  {
    number: '04',
    icon: HeartHandshake,
    title: 'Acompanhamento Premium',
    description: 'Suporte de excelência para garantir que a motivação se mantém, os hábitos se instalam e nunca estás sozinho no processo.',
  },
  {
    number: '05',
    icon: Trophy,
    title: 'Resultados Comprovados',
    description: 'Avaliação contínua da evolução: mais força, melhor foco, menos gordura, longevidade — resultados 100% visíveis e sustentáveis.',
  },
]

export default function Solucao() {
  return (
    <section id="solucao" className="section-py bg-white dark:bg-zinc-950">
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
            O Teu Caminho Para a{' '}
            <span className="text-red-gradient">Excelência</span>
          </motion.h2>
          <motion.p
            className="font-body text-zinc-500 dark:text-zinc-400 text-lg max-w-2xl mx-auto"
            initial={{ opacity: 0, y: 20 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true }}
            transition={{ delay: 0.2 }}
          >
            Não existe uma solução genérica. O nosso processo é rigoroso, personalizado
            e orientado para a transformação visível do teu corpo e da tua mente.
          </motion.p>
        </div>

        {/* Vertical timeline */}
        <div className="relative max-w-3xl mx-auto">
          {/* Vertical line */}
          <div className="absolute left-[26px] md:left-1/2 top-0 bottom-0 w-px bg-gradient-to-b from-[#D71920] via-[#D71920]/30 to-transparent md:-translate-x-px hidden sm:block" />

          <div className="flex flex-col gap-0">
            {steps.map((step, i) => {
              const Icon = step.icon
              const isLeft = i % 2 === 0

              return (
                <motion.div
                  key={step.number}
                  className={`relative flex items-start gap-6 md:gap-0 ${
                    isLeft ? 'md:flex-row' : 'md:flex-row-reverse'
                  } pb-12`}
                  initial={{ opacity: 0, x: isLeft ? -40 : 40 }}
                  whileInView={{ opacity: 1, x: 0 }}
                  viewport={{ once: true, margin: '-80px' }}
                  transition={{ duration: 0.7, ease: [0.22, 1, 0.36, 1] as const }}
                >
                  {/* Card */}
                  <div className={`w-full sm:w-[calc(50%-40px)] ${isLeft ? 'md:pr-8' : 'md:pl-8'}`}>
                    <div className="card group hover:border-[#D71920]/30">
                      <div className="flex items-center gap-4 mb-4">
                        <div className="w-10 h-10 bg-[#D71920]/10 border border-[#D71920]/20 flex items-center justify-center group-hover:bg-[#D71920]/20 transition-all">
                          <Icon size={18} className="text-[#D71920]" />
                        </div>
                        <span className="font-heading font-black text-[#D71920]/40 text-3xl leading-none">{step.number}</span>
                      </div>
                      <h3 className="font-heading font-bold text-zinc-900 dark:text-white text-xl mb-3">{step.title}</h3>
                      <p className="font-body text-zinc-500 dark:text-zinc-400 text-sm leading-relaxed">{step.description}</p>
                    </div>
                  </div>

                  {/* Center dot */}
                  <div className="absolute hidden sm:flex left-0 md:left-1/2 top-8 md:-translate-x-1/2 -translate-x-1/2">
                    <div className="w-[18px] h-[18px] bg-[#D71920] border-4 border-white shadow-[0_0_20px_rgba(215,25,32,0.5)]" />
                  </div>
                </motion.div>
              )
            })}
          </div>
        </div>
      </div>
    </section>
  )
}
