const companies = [
  'BancoBPI', 'Galp', 'Zurich', 'Vodafone', 'EDP', 'NOS', 'CGD',
  'Millennium', 'Jerónimo Martins', 'Continente', 'Mapfre', 'Fidelidade',
  'Sonae', 'BCP', 'EDPR', 'REN', 'Siemens', 'Bosch', 'KPMG', 'Deloitte',
]

// Double array for seamless loop
const doubled = [...companies, ...companies]

export default function Empresas() {
  return (
    <section id="empresas" className="py-16 border-y border-zinc-200 dark:border-zinc-800 overflow-hidden bg-[#f5f5f7] dark:bg-zinc-900">
      <div className="container-custom mb-10">
        <p className="text-center text-zinc-500 dark:text-zinc-400 text-xs font-body font-semibold tracking-[0.2em] uppercase">
          Empresas que já transformámos
        </p>
      </div>

      {/* Marquee container */}
      <div
        className="relative overflow-hidden"
        style={{
          maskImage: 'linear-gradient(90deg, transparent, black 15%, black 85%, transparent)',
          WebkitMaskImage: 'linear-gradient(90deg, transparent, black 15%, black 85%, transparent)',
        }}
      >
        <div className="marquee-track">
          {doubled.map((name, i) => (
            <div
              key={`${name}-${i}`}
              className="flex-shrink-0 flex items-center gap-3 group cursor-default select-none"
            >
              {/* Logo text pill */}
              <div className="px-6 py-3 bg-white dark:bg-zinc-950 border border-zinc-200 dark:border-zinc-800 group-hover:border-[#D71920]/40 group-hover:bg-[#D71920]/5 transition-all duration-300">
                <span className="font-heading font-bold text-zinc-500 dark:text-zinc-400 group-hover:text-zinc-900 dark:text-white text-sm tracking-wide transition-colors duration-300 whitespace-nowrap">
                  {name}
                </span>
              </div>
              {/* Separator dot */}
              <span className="w-1 h-1 bg-[#D71920]/30 flex-shrink-0" />
            </div>
          ))}
        </div>
      </div>
    </section>
  )
}
