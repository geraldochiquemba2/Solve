import { motion } from 'framer-motion'
import Counter from '../ui/Counter'

const results = [
  { prefix: '+', value: 42, suffix: '%', label: 'Produtividade', description: 'Aumento médio nos primeiros 90 dias' },
  { prefix: '+', value: 38, suffix: '%', label: 'Foco e Concentração', description: 'Melhoria na performance cognitiva' },
  { prefix: '-', value: 51, suffix: '%', label: 'Níveis de Stress', description: 'Redução mensurada em 6 meses' },
  { prefix: '+', value: 89, suffix: '%', label: 'Engagement', description: 'Aumento do envolvimento das equipas' },
]

export default function Resultados() {
  return (
    <section id="resultados" className="section-py bg-white dark:bg-zinc-950 overflow-hidden">
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
            Números que{' '}
            <span className="text-red-gradient">Falam por Si</span>
          </motion.h2>
          <motion.p
            className="font-body text-zinc-500 dark:text-zinc-400 text-lg max-w-2xl mx-auto"
            initial={{ opacity: 0, y: 20 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true }}
            transition={{ delay: 0.2 }}
          >
            Resultados medidos e validados através de casos reais de transformação pessoal e coletiva 
            ao longo de vários anos de aplicação da metodologia de Alta Performance.
          </motion.p>
        </div>

        {/* Results grid */}
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-5">
          {results.map((result, i) => (
            <motion.div
              key={result.label}
              className="relative bg-[#f5f5f7] dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-800 p-6 md:p-8 text-center overflow-hidden group hover:border-[#D71920]/30 transition-all duration-500"
              initial={{ opacity: 0, y: 40 }}
              whileInView={{ opacity: 1, y: 0 }}
              viewport={{ once: true }}
              transition={{ delay: i * 0.1, duration: 0.6, ease: [0.22, 1, 0.36, 1] as const }}
              whileHover={{ y: -8 }}
            >
              {/* Background glow */}
              <div className="absolute inset-0 bg-gradient-to-b from-[#D71920]/5 to-transparent opacity-0 group-hover:opacity-100 transition-opacity duration-500" />

              <div className="relative z-10">
                <div className="font-heading font-black text-5xl md:text-6xl text-zinc-900 dark:text-white mb-2 leading-none">
                  <Counter
                    prefix={result.prefix}
                    target={result.value}
                    suffix={result.suffix}
                    duration={2200}
                  />
                </div>
                <div className="font-heading font-bold text-zinc-900 dark:text-white text-base mb-2">{result.label}</div>
                <div className="font-body text-zinc-500 dark:text-zinc-400 text-xs leading-relaxed">{result.description}</div>
              </div>

              {/* Bottom accent line */}
              <div className="absolute bottom-0 left-1/2 -translate-x-1/2 w-12 h-0.5 bg-[#D71920] opacity-0 group-hover:opacity-100 transition-opacity duration-500" />
            </motion.div>
          ))}
        </div>
      </div>
    </section>
  )
}
