import { motion } from 'framer-motion'
import { Building2, Users, Clock, Star, CalendarCheck } from 'lucide-react'
import Counter from '../ui/Counter'

const stats = [
  { icon: Building2, prefix: '+', value: 120, suffix: '', label: 'Empresas Transformadas', description: 'Em Angola e no mercado internacional' },
  { icon: Users, prefix: '+', value: 20000, suffix: '', label: 'Pessoas Impactadas', description: 'Líderes, equipas e executivos' },
  { icon: Clock, prefix: '', value: 15, suffix: '+', label: 'Anos de Experiência', description: 'Na área de Alta Performance' },
  { icon: Star, prefix: '', value: 98, suffix: '%', label: 'Taxa de Satisfação', description: 'Avaliação pós-programa' },
  { icon: CalendarCheck, prefix: '+', value: 300, suffix: '', label: 'Eventos Realizados', description: 'Keynotes, workshops e masterclasses' },
]

export default function Numeros() {
  return (
    <section id="numeros" className="section-py relative overflow-hidden bg-[#f5f5f7] dark:bg-zinc-900">
      {/* Background */}
      <div className="absolute inset-0">
        <div
          className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[800px] h-[400px] opacity-8"
          style={{ background: 'radial-gradient(ellipse, #D71920 0%, transparent 70%)' }}
        />
      </div>

      <div className="container-custom relative z-10">

        {/* Header */}
        <div className="text-center mb-16">

          <motion.h2
            className="font-heading font-black text-4xl md:text-5xl text-zinc-900 dark:text-white mb-5"
            initial={{ opacity: 0, y: 20 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true }}
            transition={{ delay: 0.1 }}
          >
            O Impacto do{' '}
            <span className="text-red-gradient">Método</span>{' '}
            em Números
          </motion.h2>
        </div>

        {/* Stats grid */}
        <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-5 gap-5">
          {stats.map((stat, i) => {
            const Icon = stat.icon
            return (
              <motion.div
                key={stat.label}
                className="relative text-center group"
                initial={{ opacity: 0, y: 30 }}
                whileInView={{ opacity: 1, y: 0 }}
                viewport={{ once: true }}
                transition={{ delay: i * 0.1, duration: 0.6 }}
              >
                <div className="bg-white dark:bg-zinc-950 border border-zinc-200 dark:border-zinc-800 p-6 hover:border-[#D71920]/30 transition-all duration-400 group-hover:shadow-[0_20px_60px_rgba(0,0,0,0.1)]">
                  <div className="w-10 h-10 bg-[#D71920]/10 flex items-center justify-center mx-auto mb-4 group-hover:bg-[#D71920]/20 transition-all">
                    <Icon size={18} className="text-[#D71920]" />
                  </div>
                  <div className="font-heading font-black text-4xl md:text-5xl text-zinc-900 dark:text-white mb-2 leading-none">
                    <Counter
                      prefix={stat.prefix}
                      target={stat.value}
                      suffix={stat.suffix}
                      duration={2000}
                    />
                  </div>
                  <div className="font-heading font-bold text-zinc-900 dark:text-white text-sm mb-1 leading-tight">{stat.label}</div>
                  <div className="font-body text-zinc-500 dark:text-zinc-400 text-xs">{stat.description}</div>
                </div>
              </motion.div>
            )
          })}
        </div>
      </div>
    </section>
  )
}
