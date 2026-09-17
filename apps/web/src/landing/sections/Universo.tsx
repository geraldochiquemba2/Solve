import { useState } from 'react'
import { Link } from 'wouter'
import { motion } from 'framer-motion'
import {
  Building2,
  ArrowRight,
  Users,
  Heart,
  Activity
} from 'lucide-react'

// CRM: só FitStudio permanece no frontend (INÍCIO/FITMOTIVAÇÃO/FORMAÇÃO/STORE/FITWORKOUT removidos)
const universoData = [
  {
    id: 'fitstudio',
    path: '/fit-studio',
    title: 'FitStudio',
    description: 'O nosso ginásio oficial de alta performance e bem-estar.',
    icon: Building2,
    color: 'from-[#042251]/20 to-[#800000]/20',
    borderColor: 'group-hover:border-[#042251]/50',
    iconColor: 'text-[#042251]',
    span: 'md:col-span-3 lg:col-span-2 xl:col-span-2',
    services: [
      { name: 'Ginásio Premium', icon: Building2 },
      { name: 'Personal Training', icon: Heart },
      { name: 'Aulas de Grupo', icon: Users },
      { name: 'Performance', icon: Activity },
    ]
  },
]

const containerVariants = {
  hidden: {},
  visible: { transition: { staggerChildren: 0.1 } }
}

const itemVariants = {
  hidden: { opacity: 0, y: 30 },
  visible: { opacity: 1, y: 0, transition: { duration: 0.8, ease: [0.22, 1, 0.36, 1] as const } }
}

export default function Universo() {
  const [hoveredCard, setHoveredCard] = useState<string | null>(null)

  return (
    <section id="universo" className="section-py bg-[#f5f5f7] dark:bg-zinc-900 relative overflow-hidden">
      {/* Background Glow */}
      <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[800px] h-[800px] bg-[#042251]/5 blur-[120px] pointer-events-none" />

      <div className="container-custom relative z-10">
        
        {/* Header */}
        <div className="text-center mb-16 md:mb-24">
          <motion.div
            initial={{ opacity: 0, scale: 0.9 }}
            whileInView={{ opacity: 1, scale: 1 }}
            viewport={{ once: true }}
            transition={{ duration: 0.5 }}
            className="inline-flex items-center gap-2 px-4 py-2 bg-zinc-200/50 border border-black/5 mb-6 rounded-[7px]"
          >
            <span className="w-2 h-2 bg-[#042251] animate-pulse" />
            <span className="text-xs font-body font-medium tracking-wider uppercase text-zinc-600 dark:text-zinc-300">O Ecossistema</span>
          </motion.div>
          
          <motion.h2
            className="font-heading font-black text-4xl md:text-6xl text-zinc-900 dark:text-white mb-6 tracking-tight"
            initial={{ opacity: 0, y: 20 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true }}
            transition={{ delay: 0.1, duration: 0.6 }}
          >
            Universo <span className="text-transparent bg-clip-text bg-gradient-to-r from-[#042251] to-[#ff4d4d]">Bruno Samora</span>
          </motion.h2>
          
          <motion.p
            className="font-body text-zinc-500 dark:text-zinc-400 text-lg md:text-xl max-w-3xl mx-auto leading-relaxed"
            initial={{ opacity: 0, y: 20 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true }}
            transition={{ delay: 0.2, duration: 0.6 }}
          >
            Uma plataforma integrada de alta performance. Entra por qualquer porta e descobre um mundo dedicado à tua evolução contínua, saúde e liderança.
          </motion.p>
        </div>

        {/* Bento Grid */}
        <motion.div 
          className="grid grid-cols-1 md:grid-cols-3 lg:grid-cols-3 xl:grid-cols-4 gap-4 md:gap-6"
          variants={containerVariants}
          initial="hidden"
          whileInView="visible"
          viewport={{ once: true, margin: '-100px' }}
        >
          {universoData.map((item) => {
            const Icon = item.icon
            const isHovered = hoveredCard === item.id

            return (
              <motion.div
                key={item.id}
                variants={itemVariants}
                onMouseEnter={() => setHoveredCard(item.id)}
                onMouseLeave={() => setHoveredCard(null)}
                className={`group relative overflow-hidden-[24px] bg-white dark:bg-zinc-950 border border-zinc-200 dark:border-zinc-800 p-8 transition-all duration-500 ease-out flex flex-col min-h-[320px] ${item.span} ${item.borderColor}`}
              >
                {/* Background Gradient on Hover */}
                <div 
                  className={`absolute inset-0 bg-gradient-to-br ${item.color} opacity-0 group-hover:opacity-100 transition-opacity duration-700 pointer-events-none`} 
                />

                <div className="relative z-10 flex flex-col h-full">
                  <div className="flex justify-between items-start mb-6">
                    <div className={`w-14 h-14 bg-zinc-50 dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-800 flex items-center justify-center transition-transform duration-500 group-hover:scale-110 group-hover:-rotate-3`}>
                      <Icon size={28} className={item.iconColor} />
                    </div>
                    
                    <Link 
                      to={item.path}
                      className="w-10 h-10 bg-zinc-100 dark:bg-zinc-800 flex items-center justify-center opacity-0 -translate-x-4 group-hover:opacity-100 group-hover:translate-x-0 transition-all duration-500 hover:bg-zinc-200"
                      aria-label={`Saber mais sobre ${item.title}`}
                    >
                      <ArrowRight size={18} className="text-zinc-900 dark:text-white" />
                    </Link>
                  </div>

                  <h3 className="font-heading font-bold text-2xl text-zinc-900 dark:text-white mb-3 tracking-wide">
                    {item.title}
                  </h3>
                  
                  <p className="font-body text-zinc-500 dark:text-zinc-400 text-sm leading-relaxed mb-8 max-w-sm">
                    {item.description}
                  </p>

                  <div className="mt-auto">
                    <div className="grid grid-cols-2 gap-3 opacity-60 group-hover:opacity-100 transition-opacity duration-500">
                      {item.services.map((service, idx) => {
                        const ServiceIcon = service.icon
                        return (
                          <div key={idx} className="flex items-center gap-2 text-xs font-body font-medium text-zinc-700">
                            <ServiceIcon size={14} className={item.iconColor} />
                            <span className="truncate">{service.name}</span>
                          </div>
                        )
                      })}
                    </div>
                  </div>
                </div>
              </motion.div>
            )
          })}
        </motion.div>

      </div>
    </section>
  )
}
