import { useState } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import { ArrowRight, Play, X, TrendingUp, Users, Award, Clock } from 'lucide-react'

const stats = [
  { icon: TrendingUp, value: '+120', label: 'Empresas' },
  { icon: Users, value: '+20K', label: 'Pessoas' },
  { icon: Award, value: '98%', label: 'Satisfação' },
  { icon: Clock, value: '15+', label: 'Anos Experiência' },
]

export default function Hero() {
  const [videoOpen, setVideoOpen] = useState(false)

  return (
    <>
      <section
        id="hero"
        className="relative w-full h-[90vh] min-h-[680px] flex items-center justify-center overflow-hidden bg-zinc-950"
        aria-label="Hero — Bruno Samora"
      >
        {/* ── VIDEO BACKGROUND ── */}
        <div className="absolute inset-0 z-0">
          <video
            autoPlay
            muted
            loop
            playsInline
            disablePictureInPicture
            className="w-full h-full object-cover opacity-40"
            poster="https://images.unsplash.com/photo-1571019614242-c5c5dee9f50b?q=80&w=2000&auto=format&fit=crop"
          >
            <source src="https://assets.mixkit.co/videos/preview/mixkit-athlete-doing-bench-press-at-the-gym-4051-large.mp4" type="video/mp4" />
            <source src="https://assets.mixkit.co/videos/preview/mixkit-man-exercising-on-parallel-bars-22693-large.mp4" type="video/mp4" />
            <img
              src="https://images.unsplash.com/photo-1571019614242-c5c5dee9f50b?q=80&w=2000&auto=format&fit=crop"
              alt="Bruno Samora"
              className="w-full h-full object-cover"
            />
          </video>
          {/* Cinematic overlays */}
          <div className="absolute inset-0 bg-gradient-to-t from-zinc-950 via-zinc-950/50 to-zinc-950/20" />
          <div className="absolute inset-0 bg-gradient-to-r from-zinc-950/70 via-transparent to-zinc-950/30" />
        </div>

        {/* ── MAIN CONTENT ── */}
        <div className="container-custom relative z-10 text-center px-4 w-full pb-20">

          {/* Badge */}
          <motion.div
            initial={{ opacity: 0, y: -10 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.7 }}
            className="inline-flex items-center gap-2 px-3 py-1.5 bg-white/10 backdrop-blur-md border border-white/20 mb-5"
          >
            <span className="w-1.5 h-1.5 bg-[#D71920] animate-pulse" />
            <span className="text-[10px] font-bold uppercase tracking-[0.2em] text-white/90">Bruno Samora</span>
          </motion.div>

          {/* Headline */}
          <motion.h1
            className="font-heading font-black text-4xl sm:text-5xl lg:text-[4.5rem] text-white leading-[1.05] tracking-tighter mb-4 max-w-4xl mx-auto uppercase"
            initial={{ opacity: 0, y: 30 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.9, delay: 0.2, ease: [0.16, 1, 0.3, 1] as const }}
          >
            O Teu Próximo Nível de{' '}
            <span className="text-[#D71920]">Performance.</span>
          </motion.h1>

          {/* Subtext */}
          <motion.p
            className="font-body text-zinc-300 text-base leading-relaxed mb-7 max-w-lg mx-auto font-light"
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.5, duration: 0.8 }}
          >
            Transformamos líderes, atletas e indivíduos em máquinas de alta performance através de{' '}
            <span className="text-white font-medium">ciência, método e resultados</span>.
          </motion.p>

          {/* CTAs */}
          <motion.div
            className="flex flex-col sm:flex-row items-center justify-center gap-3"
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.7, duration: 0.8 }}
          >
            <button
              onClick={() => window.dispatchEvent(new Event('openFormModal'))}
              className="w-full sm:w-auto px-7 py-3.5 bg-[#D71920] hover:bg-red-700 text-white font-body font-semibold tracking-wide text-sm transition-all duration-300 flex items-center justify-center gap-3 hover:scale-105 active:scale-95"
            >
              Agendar Diagnóstico
              <ArrowRight size={16} />
            </button>

            <button
              onClick={() => setVideoOpen(true)}
              className="w-full sm:w-auto px-7 py-3.5 bg-white/10 hover:bg-white/20 backdrop-blur-md border border-white/30 text-white font-body font-semibold tracking-wide text-sm transition-all duration-300 flex items-center justify-center gap-3 hover:scale-105 active:scale-95"
            >
              <Play size={14} fill="currentColor" />
              Ver o Manifesto
            </button>
          </motion.div>
        </div>

        {/* ── BOTTOM STATS BAR ── */}
        <motion.div
          className="absolute bottom-0 left-0 right-0 z-20 border-t border-white/10 bg-white/5 backdrop-blur-xl"
          initial={{ opacity: 0, y: 60 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 1, duration: 0.8, ease: 'easeOut' }}
        >
          <div className="container-custom">
            <div className="grid grid-cols-2 md:grid-cols-4 divide-x divide-white/10">
              {stats.map((stat) => (
                <div key={stat.label} className="py-5 px-4 flex flex-col items-center justify-center text-center group">
                  <stat.icon size={20} className="text-[#D71920] mb-2 opacity-80 group-hover:opacity-100 group-hover:scale-110 transition-all duration-300" />
                  <span className="font-heading font-black text-2xl text-white mb-0.5">{stat.value}</span>
                  <span className="text-zinc-400 text-[10px] font-body uppercase tracking-widest">{stat.label}</span>
                </div>
              ))}
            </div>
          </div>
        </motion.div>
      </section>

      {/* ── VIDEO MODAL (MANIFESTO) ── */}
      <AnimatePresence>
        {videoOpen && (
          <motion.div
            className="fixed inset-0 z-[100] flex items-center justify-center bg-black/95 backdrop-blur-sm p-4"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            onClick={() => setVideoOpen(false)}
          >
            <motion.div
              className="relative w-full max-w-5xl aspect-video bg-zinc-900"
              initial={{ scale: 0.9, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              exit={{ scale: 0.9, opacity: 0 }}
              transition={{ duration: 0.3, ease: [0.16, 1, 0.3, 1] as const }}
              onClick={(e) => e.stopPropagation()}
            >
              {/* Close button */}
              <button
                onClick={() => setVideoOpen(false)}
                className="absolute -top-10 right-0 text-white/70 hover:text-white flex items-center gap-2 text-sm font-medium transition-colors"
              >
                <X size={16} /> Fechar
              </button>

              {/* Video player placeholder — substituir pelo URL real do vídeo */}
              <div className="w-full h-full flex items-center justify-center bg-zinc-900 border border-zinc-800">
                <video
                  autoPlay
                  controls
                  className="w-full h-full object-contain"
                  poster="https://images.unsplash.com/photo-1551632811-561732d1e306?q=80&w=2000&auto=format&fit=crop"
                >
                  <source src="https://cdn.coverr.co/videos/coverr-a-man-working-out-at-a-gym-4416/1080p.mp4" type="video/mp4" />
                </video>
              </div>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>
    </>
  )
}
