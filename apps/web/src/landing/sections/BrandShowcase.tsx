import { motion } from 'framer-motion'
import logoColor from '../logo/Logo Bruno Samora Top Performance PNG.png'

export default function BrandShowcase() {
  return (
    <section className="py-24 bg-white dark:bg-zinc-950 border-y border-zinc-200 dark:border-zinc-800 relative overflow-hidden">
      {/* Subtle radial gradient for depth */}
      <div className="absolute inset-0 bg-[radial-gradient(ellipse_at_center,rgba(215,25,32,0.03)_0%,transparent_70%)]" />

      <div className="container-custom relative z-10 flex flex-col items-center justify-center text-center">
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true }}
          transition={{ duration: 0.8 }}
          className="max-w-2xl mx-auto"
        >
          <img 
            src={logoColor} 
            alt="Bruno Samora" 
            className="w-48 md:w-64 h-auto mx-auto mb-8 drop-shadow-[0_0_30px_rgba(215,25,32,0.15)]"
          />
          
          <p className="font-heading text-lg md:text-xl text-zinc-600 dark:text-zinc-300 font-medium tracking-wide">
            A CIÊNCIA DA ALTA PERFORMANCE APLICADA À<br className="hidden sm:block" />
            <span className="text-zinc-900 dark:text-white">LIDERANÇA, SAÚDE E RESULTADOS.</span>
          </p>
        </motion.div>
      </div>
    </section>
  )
}
