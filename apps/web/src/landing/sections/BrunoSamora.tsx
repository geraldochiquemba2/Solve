import { motion } from 'framer-motion'
import { Award, Trophy, Users, Building2, Star, CheckCircle } from 'lucide-react'

const milestones = [
  { year: '2008', title: 'Início da Carreira', description: 'Início da especialização em Alta Performance e preparação física de elite.' },
  { year: '2012', title: 'IFBB Pro Card', description: 'Obtenção do estatuto profissional IFBB — reconhecimento internacional de excelência.' },
  { year: '2015', title: 'Corporate Wellness', description: 'Lançamento do primeiro programa de Corporate Wellness em parceria com multinacionais.' },
  { year: '2018', title: '50 Empresas', description: 'Marco de 50 empresas transformadas com a metodologia de Alta Performance.' },
  { year: '2021', title: 'Referência Nacional', description: 'Reconhecido como principal referência em Alta Performance Corporativa.' },
  { year: '2024', title: '+120 Empresas', description: 'Mais de 120 empresas e 20.000 pessoas transformadas a nível nacional e internacional.' },
]

const credentials = [
  { icon: Award, text: 'IFBB Professional Card' },
  { icon: Trophy, text: '+300 Eventos e Conferências' },
  { icon: Users, text: '+20.000 Pessoas Formadas' },
  { icon: Building2, text: '+120 Empresas Clientes' },
  { icon: Star, text: '98% Taxa de Satisfação' },
  { icon: CheckCircle, text: '15 Anos de Experiência' },
]

export default function BrunoSamora() {
  return (
    <section id="bruno" className="section-py bg-[#f5f5f7] dark:bg-zinc-900 relative overflow-hidden bg-[url('/images/bruno-bg.jpg')] bg-cover bg-center bg-fixed">
      {/* Dark overlay */}
      <div className="absolute inset-0 bg-white/90" />
      
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
            Quem é{' '}
            <span className="text-red-gradient">Bruno Samora</span>
          </motion.h2>
        </div>

        <div className="grid lg:grid-cols-[1fr_1.4fr] gap-12 xl:gap-20 items-start">

          {/* LEFT: Photo placeholder + credentials */}
          <motion.div
            initial={{ opacity: 0, x: -40 }}
            whileInView={{ opacity: 1, x: 0 }}
            viewport={{ once: true }}
            transition={{ duration: 0.7, ease: [0.22, 1, 0.36, 1] as const }}
          >
            {/* Photo */}
            <div
              className="photo-placeholder w-full aspect-[4/5] mb-6"
              style={{ boxShadow: '0 40px 80px rgba(0,0,0,0.5), 0 0 0 1px rgba(215,25,32,0.15)' }}
            >
              <div className="grid-pattern" />
              <div className="absolute inset-0 flex flex-col items-center justify-center gap-4">
                <div className="w-20 h-20 bg-[#D71920]/20 border border-[#D71920]/30 flex items-center justify-center">
                  <span className="font-heading font-black text-3xl text-[#D71920]">BS</span>
                </div>
                <div className="text-center px-8">
                  <div className="font-heading font-bold text-white text-base bg-[#D71920] px-3 py-1 inline-block mb-2">
                    [ ESPAÇO PARA FOTOGRAFIA ]
                  </div>
                  <div className="text-[#D71920]/80 text-xs font-body tracking-widest uppercase mt-1">Bruno Samora • Alta Performance</div>
                </div>
              </div>
            </div>

            {/* Credentials grid */}
            <div className="grid grid-cols-2 gap-3">
              {credentials.map(({ icon: Icon, text }) => (
                <div key={text} className="flex items-center gap-3 bg-zinc-50 dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-800 p-3 hover:border-[#D71920]/30 transition-colors">
                  <Icon size={16} className="text-[#D71920] flex-shrink-0" />
                  <span className="font-body text-zinc-600 dark:text-zinc-300 text-xs leading-tight">{text}</span>
                </div>
              ))}
            </div>
          </motion.div>

          {/* RIGHT: Bio + Timeline */}
          <motion.div
            initial={{ opacity: 0, x: 40 }}
            whileInView={{ opacity: 1, x: 0 }}
            viewport={{ once: true }}
            transition={{ duration: 0.7, ease: [0.22, 1, 0.36, 1] as const }}
          >
            <blockquote className="font-heading text-xl md:text-2xl font-bold text-zinc-900 dark:text-white leading-relaxed mb-6 pl-6 border-l-2 border-[#D71920]">
              "A alta performance não é um traço de personalidade — é uma competência que se treina, sistematiza e replica."
            </blockquote>

            <p className="font-body text-zinc-600 dark:text-zinc-300 leading-relaxed mb-5">
              Bruno Samora é o principal especialista lusófono em Alta Performance Humana aplicada ao mundo corporativo.
              Com formação em Ciências do Exercício, Neurociência Aplicada e Psicologia do Comportamento, desenvolveu
              uma metodologia única que combina a disciplina do desporto de elite com as exigências do mundo executivo.
            </p>
            <p className="font-body text-zinc-600 dark:text-zinc-300 leading-relaxed mb-10">
              Atleta profissional IFBB com conquistas internacionais, Bruno transportou os princípios da preparação
              física de alto rendimento para o ambiente corporativo — criando programas que já transformaram mais
              de 120 empresas e 20.000 pessoas, com forte impacto no tecido corporativo e institucional angolano.
            </p>

            {/* Timeline */}
            <div className="space-y-0">
              <h3 className="font-heading font-bold text-zinc-900 dark:text-white text-lg mb-6">Percurso e Conquistas</h3>
              {milestones.map((milestone, i) => (
                <motion.div
                  key={milestone.year}
                  className="flex gap-4 pb-6 last:pb-0"
                  initial={{ opacity: 0, x: 20 }}
                  whileInView={{ opacity: 1, x: 0 }}
                  viewport={{ once: true }}
                  transition={{ delay: i * 0.08, duration: 0.5 }}
                >
                  {/* Timeline left */}
                  <div className="flex flex-col items-center flex-shrink-0 w-14">
                    <div className="w-8 h-8 bg-[#D71920] flex items-center justify-center text-white font-heading font-black text-[9px] text-center leading-none flex-shrink-0">
                      {milestone.year.slice(2)}
                    </div>
                    {i < milestones.length - 1 && (
                      <div className="w-px flex-1 bg-gradient-to-b from-[#D71920]/50 to-transparent mt-2" />
                    )}
                  </div>
                  {/* Content */}
                  <div className="pt-1 pb-2">
                    <div className="flex items-center gap-3 mb-1">
                      <span className="font-body text-[#D71920] text-xs font-bold tracking-widest">{milestone.year}</span>
                    </div>
                    <div className="font-heading font-bold text-zinc-900 dark:text-white text-base mb-1">{milestone.title}</div>
                    <div className="font-body text-zinc-600 dark:text-zinc-300 text-sm leading-relaxed">{milestone.description}</div>
                  </div>
                </motion.div>
              ))}
            </div>
          </motion.div>
        </div>
      </div>
    </section>
  )
}
