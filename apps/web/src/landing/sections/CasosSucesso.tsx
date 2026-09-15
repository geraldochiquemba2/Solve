import { useState } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import { ChevronLeft, ChevronRight, Quote, Linkedin } from 'lucide-react'

const cases = [
  {
    name: 'Maria Santos',
    role: 'CEO',
    company: 'BancoBPI',
    result: '+52% Produtividade em 3 Meses',
    testimonial: 'O programa do Bruno Samora foi transformador. A metodologia aplicada à nossa equipa de liderança resultou numa mudança de mentalidade que se reflectiu directamente nos resultados do banco. Recomendo sem reservas.',
    tags: ['Corporate Wellness', 'Liderança'],
  },
  {
    name: 'António Ferreira',
    role: 'Director de RH',
    company: 'Galp',
    result: '-61% Absentismo em 6 Meses',
    testimonial: 'Antes do programa, o absentismo era o nosso maior desafio. Após a implementação da metodologia de Alta Performance, não só reduziu drasticamente o absentismo como o engagement das equipas atingiu máximos históricos.',
    tags: ['Wellness', 'Engagement'],
  },
  {
    name: 'Joana Costa',
    role: 'VP de Vendas',
    company: 'Vodafone',
    result: '+38% nas Vendas no 1.º Trimestre',
    testimonial: 'A equipa comercial estava desmotivada e com resultados abaixo do esperado. O Bruno identificou os problemas de energia e foco de forma cirúrgica e implementou mudanças que impactaram directamente o pipeline.',
    tags: ['Performance', 'Vendas'],
  },
  {
    name: 'Carlos Mendes',
    role: 'CEO',
    company: 'Jerónimo Martins',
    result: 'Cultura de Alta Performance Instalada',
    testimonial: 'O que me impressionou não foi apenas os resultados imediatos, mas a mudança cultural profunda que ficou instalada na organização. 18 meses depois, os efeitos continuam a crescer.',
    tags: ['Cultura', 'Liderança'],
  },
]

export default function CasosSucesso() {
  const [current, setCurrent] = useState(0)

  const prev = () => setCurrent((c) => (c === 0 ? cases.length - 1 : c - 1))
  const next = () => setCurrent((c) => (c === cases.length - 1 ? 0 : c + 1))

  const activeCase = cases[current]

  return (
    <section id="casos" className="section-py bg-[#f5f5f7] dark:bg-zinc-900">
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
            Histórias de{' '}
            <span className="text-red-gradient">Transformação</span>{' '}
            Real
          </motion.h2>
          <motion.p
            className="font-body text-zinc-500 dark:text-zinc-400 text-lg max-w-2xl mx-auto"
            initial={{ opacity: 0, y: 20 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true }}
            transition={{ delay: 0.2 }}
          >
            Resultados reais de empresas e líderes que escolheram investir na sua performance.
          </motion.p>
        </div>

        {/* Testimonial slider */}
        <motion.div
          className="relative max-w-4xl mx-auto"
          initial={{ opacity: 0, y: 40 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true }}
          transition={{ duration: 0.7 }}
        >
          <AnimatePresence mode="wait">
            <motion.div
              key={current}
              className="bg-white dark:bg-zinc-950 border border-zinc-200 dark:border-zinc-800 p-8 md:p-10"
              initial={{ opacity: 0, x: 40 }}
              animate={{ opacity: 1, x: 0 }}
              exit={{ opacity: 0, x: -40 }}
              transition={{ duration: 0.4, ease: [0.22, 1, 0.36, 1] as const }}
            >
              <div className="grid md:grid-cols-[1fr_2fr] gap-8 items-start">

                {/* Left: Person info */}
                <div>
                  {/* Photo placeholder */}
                  <div className="w-20 h-20 bg-gradient-to-br from-red-50 to-red-100 border border-[#D71920]/20 flex flex-col items-center justify-center mb-4 glow-red">
                    <span className="font-heading font-black text-2xl text-[#D71920]">
                      {activeCase.name.split(' ').map(n => n[0]).join('').slice(0, 2)}
                    </span>
                    <span className="text-[7px] font-bold text-white bg-[#D71920] px-1 mt-1 text-center leading-tight">
                      [ FOTO ]
                    </span>
                  </div>
                  <div className="font-heading font-bold text-zinc-900 dark:text-white text-lg">{activeCase.name}</div>
                  <div className="font-body text-zinc-500 dark:text-zinc-400 text-sm mb-1">{activeCase.role}</div>
                  <div className="font-body text-[#D71920] text-sm font-semibold mb-4">{activeCase.company}</div>

                  {/* Tags */}
                  <div className="flex flex-wrap gap-2 mb-4">
                    {activeCase.tags.map((tag) => (
                      <span key={tag} className="px-3 py-1 bg-[#D71920]/10 border border-[#D71920]/20 text-[#D71920] text-xs font-body font-semibold">
                        {tag}
                      </span>
                    ))}
                  </div>

                  {/* LinkedIn */}
                  <button className="flex items-center gap-2 text-zinc-500 dark:text-zinc-400 hover:text-zinc-900 dark:text-white text-xs font-body transition-colors">
                    <Linkedin size={14} />
                    Ver no LinkedIn
                  </button>
                </div>

                {/* Right: Testimonial */}
                <div>
                  {/* Result highlight */}
                  <div className="flex items-center gap-3 mb-6 p-4 bg-[#D71920]/10 border border-[#D71920]/20">
                    <div className="w-2 h-2 bg-[#D71920] flex-shrink-0" />
                    <span className="font-heading font-bold text-[#D71920] text-lg">{activeCase.result}</span>
                  </div>

                  <Quote size={32} className="text-[#D71920]/20 mb-4" />
                  <p className="font-body text-zinc-600 dark:text-zinc-300 text-base leading-relaxed italic">
                    "{activeCase.testimonial}"
                  </p>
                </div>
              </div>
            </motion.div>
          </AnimatePresence>

          {/* Navigation */}
          <div className="flex items-center justify-between mt-8">
            {/* Dots */}
            <div className="flex gap-2">
              {cases.map((_, i) => (
                <button
                  key={i}
                  onClick={() => setCurrent(i)}
                  className={`transition-all duration-300 ${
                    i === current ? 'w-8 h-2 bg-[#D71920]' : 'w-2 h-2 bg-zinc-300 hover:bg-zinc-400'
                  }`}
                  aria-label={`Ver testemunho ${i + 1}`}
                />
              ))}
            </div>

            {/* Arrows */}
            <div className="flex gap-3">
              <button
                onClick={prev}
                className="w-11 h-11 bg-white dark:bg-zinc-950 border border-zinc-200 dark:border-zinc-800 flex items-center justify-center text-zinc-400 hover:text-zinc-900 dark:text-white hover:border-[#D71920]/40 transition-all"
                aria-label="Anterior"
              >
                <ChevronLeft size={18} />
              </button>
              <button
                onClick={next}
                className="w-11 h-11 bg-[#D71920] flex items-center justify-center text-white hover:bg-[#FF3038] transition-all"
                aria-label="Próximo"
              >
                <ChevronRight size={18} />
              </button>
            </div>
          </div>
        </motion.div>
      </div>
    </section>
  )
}
