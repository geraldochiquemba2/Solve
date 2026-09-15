import { motion } from 'framer-motion'
import { Flame, Brain, BarChart2, Focus, RefreshCw, TrendingDown } from 'lucide-react'

const problems = [
  {
    icon: Flame,
    title: 'Exaustão e Burnout',
    description: 'Estás frequentemente sem energia física e mental para dar o melhor de ti nos treinos ou no trabalho.',
  },
  {
    icon: Brain,
    title: 'Stress e Ansiedade',
    description: 'Níveis elevados de cortisol que destroem o teu foco, a qualidade do sono e a recuperação muscular.',
  },
  {
    icon: TrendingDown,
    title: 'Falta de Evolução',
    description: 'Sentes que estagnaste nos teus objetivos (físicos ou profissionais) apesar de te esforçares diariamente.',
  },
  {
    icon: Focus,
    title: 'Falta de Foco',
    description: 'Incapacidade de manter a concentração nas rotinas essenciais que realmente geram transformação e resultados.',
  },
  {
    icon: RefreshCw,
    title: 'Desmotivação',
    description: 'Começas projetos e planos de treino, mas desistes a meio por não teres o acompanhamento adequado.',
  },
  {
    icon: BarChart2,
    title: 'Baixo Desempenho',
    description: 'Resultados consistentemente abaixo do teu verdadeiro potencial físico e cognitivo.',
  },
]

const containerVariants = {
  hidden: {},
  visible: { transition: { staggerChildren: 0.1 } },
}

const cardVariants = {
  hidden: { opacity: 0, y: 40 },
  visible: { opacity: 1, y: 0, transition: { duration: 0.6, ease: [0.22, 1, 0.36, 1] as const } },
}

export default function Problema() {
  return (
    <section id="problema" className="section-py bg-[#f5f5f7] dark:bg-zinc-900">
      <div className="container-custom">

        {/* Header */}
        <div className="text-center mb-16">

          <motion.h2
            className="font-heading font-black text-4xl md:text-5xl text-zinc-900 dark:text-white mb-5"
            initial={{ opacity: 0, y: 20 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true }}
            transition={{ delay: 0.1, duration: 0.6 }}
          >
            Reconheces Algum Destes{' '}
            <span className="text-red-gradient">Obstáculos</span>{' '}
            na Tua Rotina Diária?
          </motion.h2>
          <motion.p
            className="font-body text-zinc-500 dark:text-zinc-400 text-lg max-w-2xl mx-auto"
            initial={{ opacity: 0, y: 20 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true }}
            transition={{ delay: 0.2, duration: 0.6 }}
          >
            Estes são os desafios mais comuns que impedem pessoas e líderes de alcançar o seu verdadeiro potencial, seja no ginásio ou nos negócios.
          </motion.p>
        </div>

        {/* Cards grid */}
        <motion.div
          className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-5"
          variants={containerVariants}
          initial="hidden"
          whileInView="visible"
          viewport={{ once: true, margin: '-50px' }}
        >
          {problems.map((problem, i) => {
            const Icon = problem.icon
            return (
              <motion.div
                key={problem.title}
                variants={cardVariants}
                className="card group cursor-default"
              >
                <div className="w-12 h-12 bg-[#D71920]/10 border border-[#D71920]/20 flex items-center justify-center mb-5 group-hover:bg-[#D71920]/20 group-hover:border-[#D71920]/40 transition-all duration-300">
                  <Icon size={22} className="text-[#D71920]" />
                </div>
                <h3 className="font-heading font-bold text-zinc-900 dark:text-white text-lg mb-3">
                  {problem.title}
                </h3>
                <p className="font-body text-zinc-500 dark:text-zinc-400 text-sm leading-relaxed flex-1">
                  {problem.description}
                </p>
              </motion.div>
            )
          })}
        </motion.div>
      </div>
    </section>
  )
}
