import { useState, useMemo } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import { ChevronDown, Search } from 'lucide-react'

const faqs = [
  {
    category: 'Metodologia',
    question: 'O que é exactamente a metodologia de Alta Performance?',
    answer: 'A nossa metodologia baseia-se em 5 pilares científicos — Energia, Foco, Liderança, Execução e Longevidade — e combina neurociência, psicologia comportamental e práticas comprovadas do desporto de elite. É uma abordagem holística que actua tanto no indivíduo como na organização.',
  },
  {
    category: 'Metodologia',
    question: 'Como é que a metodologia é diferente de outras formações?',
    answer: 'A maioria das formações é genérica e teórica. A nossa metodologia é 100% personalizada com base num diagnóstico profundo de cada organização, com foco em implementação imediata e métricas de impacto reais e verificáveis.',
  },
  {
    category: 'Metodologia',
    question: 'Quais são os resultados esperados e em quanto tempo?',
    answer: 'Os primeiros resultados visíveis surgem tipicamente nos primeiros 30 dias. Resultados consolidados (produtividade +42%, stress -51%) são mensurados nos primeiros 90 dias. Transformações culturais profundas ocorrem entre 6 e 18 meses.',
  },
  {
    category: 'Logística',
    question: 'Os programas são presenciais ou online?',
    answer: 'Oferecemos ambos os formatos. Os programas presenciais decorrem em Luanda e Talatona (com possibilidade de deslocação para outras províncias). Os programas online são realizados via Zoom com a mesma qualidade e impacto.',
  },
  {
    category: 'Logística',
    question: 'Em que países trabalha o Bruno Samora?',
    answer: 'Trabalhamos focados em Angola. Para o mercado internacional, analisamos cada caso individualmente dependendo da dimensão do projecto e logística envolvida.',
  },
  {
    category: 'Logística',
    question: 'Quantas pessoas podem participar nos workshops?',
    answer: 'Os workshops têm um limite de 30 participantes para garantir qualidade e impacto. Para organizações maiores, oferecemos múltiplas sessões ou um modelo de "trainer the trainers" para escalar internamente.',
  },
  {
    category: 'Investimento',
    question: 'Qual é o investimento mínimo para uma empresa?',
    answer: 'Cada proposta é personalizada com base na dimensão da empresa, duração do programa e objectivos específicos. O diagnóstico inicial é sempre gratuito. Após o diagnóstico, apresentamos uma proposta detalhada com opções de investimento.',
  },
  {
    category: 'Investimento',
    question: 'Existe acompanhamento após o fim do programa?',
    answer: 'Sim. Todos os programas incluem um período de acompanhamento pós-implementação. Para clientes Enterprise, este acompanhamento é contínuo com reuniões mensais de revisão de métricas e ajuste de estratégia.',
  },
]

export default function FAQ() {
  const [openIndex, setOpenIndex] = useState<number | null>(null)
  const [search, setSearch] = useState('')
  const [activeCategory, setActiveCategory] = useState('Todos')

  const categories = ['Todos', 'Metodologia', 'Logística', 'Investimento']

  const filtered = useMemo(() => {
    return faqs.filter((faq) => {
      const matchSearch =
        faq.question.toLowerCase().includes(search.toLowerCase()) ||
        faq.answer.toLowerCase().includes(search.toLowerCase())
      const matchCategory = activeCategory === 'Todos' || faq.category === activeCategory
      return matchSearch && matchCategory
    })
  }, [search, activeCategory])

  return (
    <section id="faq" className="section-py bg-[#f5f5f7] dark:bg-zinc-900">
      <div className="container-custom">

        {/* Header */}
        <div className="text-center mb-12">

          <motion.h2
            className="font-heading font-black text-4xl md:text-5xl text-zinc-900 dark:text-white mb-5"
            initial={{ opacity: 0, y: 20 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true }}
            transition={{ delay: 0.1 }}
          >
            Tem{' '}
            <span className="text-red-gradient">Dúvidas</span>?
          </motion.h2>
          <motion.p
            className="font-body text-zinc-500 dark:text-zinc-400 text-lg max-w-xl mx-auto"
            initial={{ opacity: 0, y: 20 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true }}
            transition={{ delay: 0.2 }}
          >
            Respondemos às perguntas mais frequentes. Não encontra a sua? Entre em contacto.
          </motion.p>
        </div>

        {/* Search + Filters */}
        <motion.div
          className="max-w-2xl mx-auto mb-8"
          initial={{ opacity: 0, y: 20 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true }}
          transition={{ delay: 0.3 }}
        >
          {/* Search */}
          <div className="relative mb-4">
            <Search size={16} className="absolute left-4 top-1/2 -translate-y-1/2 text-zinc-400" />
            <input
              type="text"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="Pesquisar perguntas..."
              className="input-field pl-11"
              id="faq-search"
              aria-label="Pesquisar perguntas frequentes"
            />
          </div>

          {/* Category filters */}
          <div className="flex gap-2 flex-wrap">
            {categories.map((cat) => (
              <button
                key={cat}
                onClick={() => setActiveCategory(cat)}
                className={`px-4 py-2 text-sm font-body font-semibold transition-all ${
                  activeCategory === cat
                    ? 'bg-[#D71920] text-white'
                    : 'bg-white dark:bg-zinc-950 border border-zinc-200 dark:border-zinc-800 text-zinc-500 dark:text-zinc-400 hover:text-zinc-900 dark:text-white hover:border-[#D71920]/40'
                }`}
                id={`faq-category-${cat.toLowerCase()}`}
              >
                {cat}
              </button>
            ))}
          </div>
        </motion.div>

        {/* FAQ accordion */}
        <div className="max-w-2xl mx-auto flex flex-col gap-3">
          {filtered.length === 0 && (
            <div className="text-center py-12 text-zinc-500 dark:text-zinc-400 font-body">
              Nenhuma pergunta encontrada para "{search}".
            </div>
          )}
          {filtered.map((faq, i) => {
            const isOpen = openIndex === i
            return (
              <motion.div
                key={faq.question}
                className={`accordion-item ${isOpen ? 'open' : ''}`}
                initial={{ opacity: 0, y: 15 }}
                whileInView={{ opacity: 1, y: 0 }}
                viewport={{ once: true }}
                transition={{ delay: i * 0.05, duration: 0.4 }}
              >
                <button
                  className="w-full flex items-center justify-between gap-4 p-5 text-left bg-white dark:bg-zinc-950 hover:bg-zinc-50 dark:bg-zinc-900 transition-colors"
                  onClick={() => setOpenIndex(isOpen ? null : i)}
                  aria-expanded={isOpen}
                  id={`faq-item-${i}`}
                >
                  <div className="flex-1">
                    <span className="text-[#D71920] text-xs font-body font-semibold tracking-widest uppercase block mb-1">{faq.category}</span>
                    <span className="font-heading font-bold text-zinc-900 dark:text-white text-base">{faq.question}</span>
                  </div>
                  <motion.div
                    animate={{ rotate: isOpen ? 180 : 0 }}
                    transition={{ duration: 0.3 }}
                    className="flex-shrink-0 w-8 h-8 bg-zinc-100 dark:bg-zinc-800 flex items-center justify-center"
                  >
                    <ChevronDown size={16} className={isOpen ? 'text-[#D71920]' : 'text-zinc-400'} />
                  </motion.div>
                </button>

                <AnimatePresence initial={false}>
                  {isOpen && (
                    <motion.div
                      initial={{ height: 0, opacity: 0 }}
                      animate={{ height: 'auto', opacity: 1 }}
                      exit={{ height: 0, opacity: 0 }}
                      transition={{ duration: 0.35, ease: [0.22, 1, 0.36, 1] as const }}
                      className="overflow-hidden"
                    >
                      <div className="px-5 pb-5 bg-white dark:bg-zinc-950">
                        <div className="h-px bg-zinc-100 dark:bg-zinc-800 mb-4" />
                        <p className="font-body text-zinc-600 dark:text-zinc-300 text-sm leading-relaxed">{faq.answer}</p>
                      </div>
                    </motion.div>
                  )}
                </AnimatePresence>
              </motion.div>
            )
          })}
        </div>
      </div>
    </section>
  )
}
