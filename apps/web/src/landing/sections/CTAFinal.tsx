import { motion } from 'framer-motion'
import { Phone, MessageCircle, CheckCircle } from 'lucide-react'
import ContactForm from '../ui/ContactForm'

export default function CTAFinal() {
  return (
    <section id="cta" className="relative section-py overflow-hidden bg-[#f5f5f7] dark:bg-zinc-900">
      {/* Background */}
      <div className="absolute inset-0">
        <div
          className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[900px] h-[500px] opacity-10"
          style={{ background: 'radial-gradient(ellipse, #D71920 0%, transparent 70%)' }}
        />
        <div
          className="absolute inset-0 opacity-[0.03]"
          style={{
            backgroundImage:
              'linear-gradient(rgba(0,0,0,1) 1px, transparent 1px), linear-gradient(90deg, rgba(0,0,0,1) 1px, transparent 1px)',
            backgroundSize: '50px 50px',
          }}
        />
      </div>

      <div className="container-custom relative z-10">
        <div className="grid lg:grid-cols-2 gap-12 xl:gap-20 items-center">

          {/* LEFT: CTA content */}
          <motion.div
            initial={{ opacity: 0, x: -40 }}
            whileInView={{ opacity: 1, x: 0 }}
            viewport={{ once: true }}
            transition={{ duration: 0.7 }}
          >
            <span className="section-badge">
              <span className="dot" />
              Inicie Hoje
            </span>
            <h2 className="font-heading font-black text-4xl md:text-5xl lg:text-6xl text-zinc-900 dark:text-white leading-[1.05] mb-6">
              O Próximo Passo<br />
              é <span className="text-red-gradient">Seu</span>
            </h2>
            <p className="font-body text-zinc-500 dark:text-zinc-400 text-lg leading-relaxed mb-8">
              Agende agora o seu diagnóstico executivo de 60 minutos. Sem compromisso,
              sem pressão — apenas uma conversa estratégica sobre como podemos
              transformar a sua organização ou instituição governamental.
            </p>

            {/* Trust points */}
            <div className="flex flex-col gap-3 mb-10">
              {[
                'Diagnóstico de performance 100% gratuito e confidencial',
                'Resposta à sua equipa em menos de 24 horas',
                'Proposta adaptada à realidade da sua Instituição',
                '+120 Organizações Públicas e Privadas já transformadas',
              ].map((point) => (
                <div key={point} className="flex items-center gap-3">
                  <CheckCircle size={16} className="text-[#D71920] flex-shrink-0" />
                  <span className="font-body text-zinc-600 dark:text-zinc-300 text-sm">{point}</span>
                </div>
              ))}
            </div>

            {/* Contact alternatives */}
            <div className="flex flex-wrap gap-4">
              <a
                href="tel:+244000000000"
                className="flex items-center gap-3 px-5 py-3 bg-white dark:bg-zinc-950 border border-zinc-200 dark:border-zinc-800 text-zinc-500 dark:text-zinc-400 hover:text-zinc-900 dark:text-white hover:border-[#D71920]/40 transition-all font-body text-sm font-medium"
                id="cta-phone-link"
              >
                <Phone size={16} className="text-[#D71920]" />
                +244 000 000 000
              </a>
              <a
                href="https://wa.me/244000000000"
                target="_blank"
                rel="noopener noreferrer"
                className="flex items-center gap-3 px-5 py-3 bg-[#25D366]/10 border border-[#25D366]/30 text-[#25D366] hover:bg-[#25D366]/20 transition-all font-body text-sm font-medium"
                id="cta-whatsapp-link"
              >
                <MessageCircle size={16} />
                WhatsApp Exclusivo
              </a>
            </div>
          </motion.div>

          {/* RIGHT: Contact form */}
          <motion.div
            initial={{ opacity: 0, x: 40 }}
            whileInView={{ opacity: 1, x: 0 }}
            viewport={{ once: true }}
            transition={{ duration: 0.7 }}
            className="bg-white dark:bg-zinc-950 border border-zinc-200 dark:border-zinc-800 p-8"
          >
            <ContactForm />
          </motion.div>
        </div>
      </div>
    </section>
  )
}
