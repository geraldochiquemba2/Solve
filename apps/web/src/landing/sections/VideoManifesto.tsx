import { useState } from 'react'
import { motion } from 'framer-motion'
import { Play, X } from 'lucide-react'
import Modal from '../ui/Modal'

export default function VideoManifesto() {
  const [isOpen, setIsOpen] = useState(false)
  // Replace with actual YouTube/Vimeo URL
  const videoId = 'dQw4w9WgXcQ' // placeholder

  return (
    <>
      <section id="video" className="relative py-32 md:py-40 overflow-hidden bg-[#f5f5f7] dark:bg-zinc-900">
        {/* Background — dark with red glow */}
        <div className="absolute inset-0">
          {/* Grid pattern */}
          <div
            className="absolute inset-0 opacity-[0.04]"
            style={{
              backgroundImage:
                'linear-gradient(rgba(215,25,32,1) 1px, transparent 1px), linear-gradient(90deg, rgba(215,25,32,1) 1px, transparent 1px)',
              backgroundSize: '80px 80px',
            }}
          />
          {/* Center glow */}
          <div
            className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[600px] h-[600px] opacity-15"
            style={{ background: 'radial-gradient(circle, #D71920 0%, transparent 70%)' }}
          />
        </div>

        <div className="container-custom relative z-10 text-center">

          <motion.h2
            className="font-heading font-black text-4xl md:text-5xl lg:text-6xl text-zinc-900 dark:text-white mb-6 max-w-3xl mx-auto"
            initial={{ opacity: 0, y: 20 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true }}
            transition={{ delay: 0.1 }}
          >
            Descubra a{' '}
            <span className="text-red-gradient">Visão</span>{' '}
            por Detrás do Método
          </motion.h2>

          <motion.p
            className="font-body text-zinc-500 dark:text-zinc-400 text-lg mb-12 max-w-xl mx-auto"
            initial={{ opacity: 0, y: 20 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true }}
            transition={{ delay: 0.2 }}
          >
            Uma mensagem directa de Bruno Samora sobre o que é a Alta Performance
            e como este Universo te pode transformar.
          </motion.p>

          {/* Play button */}
          <motion.button
            onClick={() => setIsOpen(true)}
            className="group relative w-24 h-24 md:w-28 md:h-28 bg-[#D71920] flex items-center justify-center mx-auto"
            style={{ boxShadow: '0 0 60px rgba(215,25,32,0.4), 0 0 0 0px rgba(215,25,32,0.2)' }}
            initial={{ opacity: 0, scale: 0.8 }}
            whileInView={{ opacity: 1, scale: 1 }}
            viewport={{ once: true }}
            transition={{ delay: 0.3, type: 'spring', stiffness: 200 }}
            whileHover={{ scale: 1.1 }}
            whileTap={{ scale: 0.95 }}
            id="video-play-btn"
            aria-label="Reproduzir vídeo manifesto"
          >
            {/* Animated rings */}
            <motion.div
              className="absolute inset-0 border-2 border-[#D71920]/40"
              animate={{ scale: [1, 1.4], opacity: [0.4, 0] }}
              transition={{ repeat: Infinity, duration: 2, ease: 'easeOut' }}
            />
            <motion.div
              className="absolute inset-0 border-2 border-[#D71920]/30"
              animate={{ scale: [1, 1.7], opacity: [0.3, 0] }}
              transition={{ repeat: Infinity, duration: 2, delay: 0.4, ease: 'easeOut' }}
            />
            <Play size={36} className="text-white ml-2" fill="white" />
          </motion.button>

          <motion.p
            className="font-body text-zinc-500 dark:text-zinc-400 text-sm mt-6"
            initial={{ opacity: 0 }}
            whileInView={{ opacity: 1 }}
            viewport={{ once: true }}
            transition={{ delay: 0.5 }}
          >
            Clique para ver o vídeo manifesto
          </motion.p>
        </div>
      </section>

      {/* Video Modal */}
      <Modal isOpen={isOpen} onClose={() => setIsOpen(false)} title="Vídeo Manifesto — Bruno Samora">
        <div className="relative w-full bg-black overflow-hidden" style={{ paddingBottom: '56.25%' }}>
          {isOpen && (
            <iframe
              className="absolute inset-0 w-full h-full"
              src={`https://www.youtube.com/embed/${videoId}?autoplay=1&rel=0`}
              title="Bruno Samora — Vídeo Manifesto"
              allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture"
              allowFullScreen
            />
          )}
        </div>
      </Modal>
    </>
  )
}
