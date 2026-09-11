import { motion } from 'framer-motion'
import { Calendar, MapPin, Users, ArrowRight, Clock } from 'lucide-react'

const events = [
  {
    id: 'masterclass-lideranca',
    type: 'Masterclass',
    title: 'Liderança de Alta Performance',
    description: 'Um dia intensivo para líderes que querem transformar a sua equipa em máquinas de resultados. Neurociência, método e implementação imediata.',
    date: { day: '18', month: 'Set', year: '2026' },
    time: '09:00 – 18:00',
    location: 'Talatona, Angola',
    spots: 25,
    spotsLeft: 8,
    tag: 'Presencial',
    tagColor: 'bg-blue-500/20 text-blue-400 border-blue-500/30',
  },
  {
    id: 'workshop-corporate-wellness',
    type: 'Workshop',
    title: 'Corporate Wellness na Prática',
    description: 'Workshop de 2 dias dedicado a equipas de RH e Gestores que querem implementar programas de bem-estar com impacto real e mensurável.',
    date: { day: '22', month: 'Out', year: '2026' },
    time: '09:00 – 17:00',
    location: 'Luanda, Angola',
    spots: 30,
    spotsLeft: 15,
    tag: 'Presencial',
    tagColor: 'bg-green-500/20 text-green-400 border-green-500/30',
  },
  {
    id: 'masterclass-energia-foco',
    type: 'Masterclass Online',
    title: 'Energia e Foco Executivo',
    description: 'Masterclass online ao vivo: aprenda a optimizar a sua energia, foco e tempo para atingir o pico de performance sem burnout.',
    date: { day: '14', month: 'Nov', year: '2026' },
    time: '19:00 – 22:00',
    location: 'Online (Zoom)',
    spots: 100,
    spotsLeft: 47,
    tag: 'Online',
    tagColor: 'bg-purple-500/20 text-purple-400 border-purple-500/30',
  },
]

export default function Agenda() {
  return (
    <section id="agenda" className="section-py bg-white dark:bg-zinc-950">
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
            Agenda{' '}
            <span className="text-red-gradient">2026</span>
          </motion.h2>
          <motion.p
            className="font-body text-zinc-500 dark:text-zinc-400 text-lg max-w-2xl mx-auto"
            initial={{ opacity: 0, y: 20 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true }}
            transition={{ delay: 0.2 }}
          >
            Junte-se a centenas de líderes nos próximos eventos presenciais e online.
            Vagas limitadas — garanta o seu lugar hoje.
          </motion.p>
        </div>

        {/* Events list */}
        <div className="flex flex-col gap-5 max-w-4xl mx-auto">
          {events.map((event, i) => {
            const pctFilled = ((event.spots - event.spotsLeft) / event.spots) * 100

            return (
              <motion.div
                key={event.id}
                className="group bg-[#f5f5f7] dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-800 p-6 md:p-8 hover:border-[#D71920]/30 transition-all duration-400"
                initial={{ opacity: 0, y: 30 }}
                whileInView={{ opacity: 1, y: 0 }}
                viewport={{ once: true }}
                transition={{ delay: i * 0.12, duration: 0.6 }}
                whileHover={{ y: -4 }}
              >
                <div className="flex flex-col md:flex-row gap-6 items-start">

                  {/* Date block */}
                  <div className="flex-shrink-0 w-20 h-20 bg-[#D71920]/10 border border-[#D71920]/20 flex flex-col items-center justify-center group-hover:bg-[#D71920]/20 transition-all">
                    <span className="font-heading font-black text-2xl text-[#D71920] leading-none">{event.date.day}</span>
                    <span className="font-body text-[#D71920]/70 text-xs font-semibold tracking-widest uppercase">{event.date.month}</span>
                    <span className="font-body text-[#D71920]/70 text-xs">{event.date.year}</span>
                  </div>

                  {/* Content */}
                  <div className="flex-1 min-w-0">
                    <div className="flex flex-wrap items-center gap-3 mb-3">
                      <span className={`px-3 py-1 border text-xs font-body font-semibold ${event.tagColor}`}>
                        {event.tag}
                      </span>
                      <span className="text-zinc-500 dark:text-zinc-400 text-xs font-body">{event.type}</span>
                    </div>

                    <h3 className="font-heading font-bold text-zinc-900 dark:text-white text-xl mb-2">{event.title}</h3>
                    <p className="font-body text-zinc-600 dark:text-zinc-300 text-sm leading-relaxed mb-4">{event.description}</p>

                    {/* Meta info */}
                    <div className="flex flex-wrap gap-4 mb-4">
                      <div className="flex items-center gap-2 text-zinc-500 dark:text-zinc-400 text-xs font-body">
                        <Clock size={13} className="text-[#D71920]" />
                        {event.time}
                      </div>
                      <div className="flex items-center gap-2 text-zinc-500 dark:text-zinc-400 text-xs font-body">
                        <MapPin size={13} className="text-[#D71920]" />
                        {event.location}
                      </div>
                      <div className="flex items-center gap-2 text-zinc-500 dark:text-zinc-400 text-xs font-body">
                        <Users size={13} className="text-[#D71920]" />
                        {event.spotsLeft} vagas disponíveis
                      </div>
                    </div>

                    {/* Spots progress */}
                    <div className="w-full h-1.5 bg-zinc-200 dark:bg-zinc-700 overflow-hidden">
                      <motion.div
                        className="h-full bg-[#D71920]"
                        initial={{ width: 0 }}
                        whileInView={{ width: `${pctFilled}%` }}
                        viewport={{ once: true }}
                        transition={{ delay: 0.3 + i * 0.1, duration: 1, ease: 'easeOut' }}
                      />
                    </div>
                    <div className="text-zinc-500 dark:text-zinc-400 text-xs font-body mt-1">
                      {event.spots - event.spotsLeft} / {event.spots} inscritos
                    </div>
                  </div>

                  {/* CTA */}
                  <div className="flex-shrink-0 md:self-center">
                    <button
                      className="btn btn-primary gap-2 whitespace-nowrap"
                      id={`agenda-reservar-${event.id}`}
                      onClick={() => window.dispatchEvent(new Event('openFormModal'))}
                    >
                      Reservar Lugar
                      <ArrowRight size={16} />
                    </button>
                  </div>
                </div>
              </motion.div>
            )
          })}
        </div>
      </div>
    </section>
  )
}
