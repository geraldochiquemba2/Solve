import { motion } from 'framer-motion'
import { Instagram, Linkedin, Youtube, Mail, Phone, MapPin, ArrowRight } from 'lucide-react'
import logoWhite from '../logo/Logo Bruno Samora Top Performance White.png'

const footerLinks = {
  Serviços: [
    { label: 'Corporate Wellness', href: '#servicos' },
    { label: 'Mentoria Executiva', href: '#servicos' },
    { label: 'Palestras', href: '#servicos' },
    { label: 'Workshops', href: '#servicos' },
    { label: 'Masterclass', href: '#agenda' },
  ],
  Empresa: [
    { label: 'Sobre Bruno Samora', href: '#bruno' },
    { label: 'Metodologia', href: '#metodologia' },
    { label: 'Casos de Sucesso', href: '#casos' },
    { label: 'Planos', href: '#planos' },
    { label: 'FAQ', href: '#faq' },
  ],
  Legal: [
    { label: 'Política de Privacidade (Lei n.º 22/11)', href: '#privacy' },
    { label: 'Termos e Condições', href: '#terms' },
    { label: 'Política de Cookies', href: '#cookies' },
  ],
}

const socials = [
  { icon: Instagram, href: 'https://instagram.com/brunosamora', label: 'Instagram' },
  { icon: Linkedin, href: 'https://linkedin.com/in/brunosamora', label: 'LinkedIn' },
  { icon: Youtube, href: 'https://youtube.com/@brunosamora', label: 'YouTube' },
]

const handleNavClick = (href: string) => {
  if (href === '#privacy') {
    window.dispatchEvent(new Event('openPrivacyModal'))
    return
  }
  if (href === '#terms') {
    window.dispatchEvent(new Event('openTermsModal'))
    return
  }
  if (href === '#cookies') {
    window.dispatchEvent(new Event('openCookiesModal'))
    return
  }
  if (href === '#') return
  const el = document.querySelector(href)
  if (el) el.scrollIntoView({ behavior: 'smooth' })
}

export default function Footer() {
  return (
    <footer className="bg-white dark:bg-zinc-950 border-t border-zinc-200 dark:border-zinc-800">
      {/* Newsletter strip */}
      <div className="border-b border-zinc-200 dark:border-zinc-800">
        <div className="container-custom py-12">
          <div className="flex flex-col md:flex-row items-start md:items-center justify-between gap-6">
            <div>
              <h3 className="font-heading text-xl font-bold text-zinc-900 dark:text-white mb-1">
                Receba Conteúdos de Alta Performance
              </h3>
              <p className="text-zinc-500 dark:text-zinc-400 text-sm font-body">
                Estratégias semanais aplicadas pelos melhores líderes do mundo.
              </p>
            </div>
            <form
              onSubmit={(e) => e.preventDefault()}
              className="flex gap-3 w-full md:w-auto"
              aria-label="Formulário de newsletter"
            >
              <input
                type="email"
                placeholder="O seu email"
                className="input-field md:w-72 text-sm"
                required
                aria-label="Email para newsletter"
                id="footer-newsletter-email"
              />
              <button
                type="submit"
                className="btn btn-primary py-3 px-5 text-xs flex-shrink-0"
                id="footer-newsletter-submit"
              >
                Subscrever
              </button>
            </form>
          </div>
        </div>
      </div>

      {/* Main footer grid */}
      <div className="container-custom py-16">
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-5 gap-12">

          {/* Brand column */}
          <div className="lg:col-span-2">
            <div className="flex items-center gap-3 mb-6">
              <img 
                src={logoWhite} 
                alt="Bruno Samora Logo" 
                className="h-16 w-auto object-contain dark:brightness-0 dark:invert invert-0"
              />
            </div>

            <p className="text-zinc-500 dark:text-zinc-400 text-sm font-body leading-relaxed mb-6 max-w-xs">
              A Ciência da Alta Performance aplicada à Liderança, Saúde e Resultados. Transformando pessoas e organizações há mais de 15 anos.
            </p>

            {/* Contact info */}
            <div className="flex flex-col gap-3 mb-8">
              <a href="tel:+244000000000" className="flex items-center gap-3 text-zinc-500 dark:text-zinc-400 hover:text-zinc-900 dark:hover:text-white text-sm transition-colors group">
                <Phone size={15} className="text-[#D71920] group-hover:scale-110 transition-transform" />
                +244 000 000 000
              </a>
              <a href="mailto:geral@brunosamora.com" className="flex items-center gap-3 text-zinc-500 dark:text-zinc-400 hover:text-zinc-900 dark:hover:text-white text-sm transition-colors group">
                <Mail size={15} className="text-[#D71920] group-hover:scale-110 transition-transform" />
                geral@brunosamora.com
              </a>
              <div className="flex items-center gap-3 text-zinc-500 dark:text-zinc-400 text-sm">
                <MapPin size={15} className="text-[#D71920]" />
                Talatona, Angola
              </div>
            </div>

            {/* Socials */}
            <div className="flex gap-3">
              {socials.map(({ icon: Icon, href, label }) => (
                <a
                  key={label}
                  href={href}
                  target="_blank"
                  rel="noopener noreferrer"
                  aria-label={label}
                  className="w-10 h-10 bg-zinc-50 dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-800 flex items-center justify-center text-zinc-500 dark:text-zinc-400 hover:text-white hover:bg-[#D71920] hover:border-[#D71920] transition-all duration-300"
                >
                  <Icon size={16} />
                </a>
              ))}
            </div>
          </div>

          {/* Link columns */}
          {Object.entries(footerLinks).map(([title, links]) => (
            <div key={title}>
              <h4 className="font-heading font-bold text-zinc-900 dark:text-white text-sm mb-5 tracking-wide">{title}</h4>
              <ul className="flex flex-col gap-3">
                {links.map((link) => (
                  <li key={link.label}>
                    <a
                      href={link.href}
                      onClick={(e) => {
                        if (link.href.startsWith('#')) {
                          e.preventDefault()
                          handleNavClick(link.href)
                        }
                      }}
                      className="flex items-center gap-2 text-zinc-500 dark:text-zinc-400 hover:text-zinc-900 dark:hover:text-white text-sm font-body transition-colors group"
                    >
                      <ArrowRight size={12} className="opacity-0 group-hover:opacity-100 text-[#D71920] transition-all -translate-x-2 group-hover:translate-x-0" />
                      {link.label}
                    </a>
                  </li>
                ))}
              </ul>
            </div>
          ))}
        </div>
      </div>

      {/* Bottom bar */}
      <div className="border-t border-zinc-200 dark:border-zinc-800">
        <div className="container-custom py-6 flex flex-col sm:flex-row items-center justify-between gap-4">
          <p className="text-zinc-500 dark:text-zinc-400 text-xs font-body text-center sm:text-left">
            © {new Date().getFullYear()} Bruno Samora. Todos os direitos reservados.
          </p>
          <div className="flex items-center gap-1">
            <span className="text-zinc-400 text-xs font-body">Desenvolvido com</span>
            <span className="text-[#D71920] text-xs"></span>
            <span className="text-zinc-400 text-xs font-body">em Angola</span>
          </div>
        </div>
      </div>
    </footer>
  )
}
