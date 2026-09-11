import { useState, useEffect } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import { ShoppingBag, Truck, ShieldCheck, RefreshCcw, Star, ChevronDown, CheckCircle2, X, Plus, Minus, ChevronLeft, ChevronRight } from 'lucide-react'
import CTAFinal from './sections/CTAFinal'
import { useCart, Product } from './context/CartContext'

import { Link } from 'wouter'
import { products } from './data/products'

export default function Store() {
  const [selectedCategory, setSelectedCategory] = useState<string>('Todos')
  
  // Hero Slider State
  const [currentSlide, setCurrentSlide] = useState(0)
  const heroSlides = [
    {
      image: 'https://images.unsplash.com/photo-1618354691373-d851c5c3a990?ixlib=rb-4.0.3&auto=format&fit=crop&w=2000&q=80',
      title: 'Hoodie Oversized Essential',
      subtitle: 'Edição Limitada',
      desc: 'Fabricado com 100% algodão orgânico e gramagem pesada (400gsm). O corte oversized perfeito para o teu lifestyle.',
    },
    {
      image: 'https://images.unsplash.com/photo-1556821840-3a63f95609a7?ixlib=rb-4.0.3&auto=format&fit=crop&w=2000&q=80',
      title: 'Minimalismo & Performance',
      subtitle: 'Conforto Extremo',
      desc: 'Sem comprometer a estética luxuosa. Desenhado meticulosamente para assentar perfeitamente no corpo.',
    },
    {
      image: 'https://images.unsplash.com/photo-1521572163474-6864f9cf17ab?ixlib=rb-4.0.3&auto=format&fit=crop&w=2000&q=80',
      title: 'Disponível Agora',
      subtitle: 'Nova Coleção',
      desc: 'Junta-te à elite. Equipa-te com as ferramentas da alta performance e eleva o teu dia a dia.',
    }
  ]

  useEffect(() => {
    const timer = setInterval(() => {
      setCurrentSlide(prev => (prev + 1) % heroSlides.length)
    }, 5000)
    return () => clearInterval(timer)
  }, [heroSlides.length])
  
  // Quick View State
  const [quickViewProduct, setQuickViewProduct] = useState<Product | null>(null)
  const [selectedSize, setSelectedSize] = useState<string>('')
  const [selectedColor, setSelectedColor] = useState<string>('')
  
  // Use global E-commerce state
  const { addToCart, formatKz } = useCart()

  const categories = ['Todos', ...Array.from(new Set(products.map(p => p.category)))]
  const filteredProducts = selectedCategory === 'Todos' ? products : products.filter(p => p.category === selectedCategory)

  const handleAddToCart = (product: Product) => {
    if (product.sizes || product.colors) {
      // Abre o Quick View para escolher variantes
      setQuickViewProduct(product)
      setSelectedSize(product.sizes ? product.sizes[0] : '')
      setSelectedColor(product.colors ? product.colors[0] : '')
    } else {
      addToCart(product)
    }
  }

  const confirmAddToCart = () => {
    if (quickViewProduct) {
      addToCart(quickViewProduct, selectedSize, selectedColor)
      setQuickViewProduct(null)
    }
  }

  const openForm = () => window.dispatchEvent(new Event('openFormModal'))

  return (
    <main className="pt-[68px] pb-0 min-h-screen relative">

      {/* ── BANNER MANUTENÇÃO ── */}
      <div className="fixed inset-0 z-[200] flex flex-col items-center justify-center bg-zinc-950/97 backdrop-blur-sm">
        <div className="text-center px-6 max-w-lg">
          <div className="inline-flex items-center justify-center w-20 h-20 rounded-2xl bg-[#D71920]/10 border border-[#D71920]/30 mb-8 mx-auto">
            <svg xmlns="http://www.w3.org/2000/svg" width="40" height="40" viewBox="0 0 24 24" fill="none" stroke="#D71920" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
              <path d="M12 2L2 7l10 5 10-5-10-5z"/>
              <path d="M2 17l10 5 10-5"/>
              <path d="M2 12l10 5 10-5"/>
            </svg>
          </div>
          <p className="text-xs font-bold uppercase tracking-[0.25em] text-[#D71920] mb-3">Em Breve</p>
          <h1 className="font-heading font-black text-4xl md:text-5xl text-white mb-4 tracking-tight">Store</h1>
          <p className="text-zinc-400 text-base leading-relaxed mb-8">
            A nossa loja está a ser preparada com os melhores produtos de alta performance.<br/>
            Em breve disponível.
          </p>
          <a href="/#/" className="inline-flex items-center gap-2 px-6 py-3 bg-white text-black text-sm font-bold rounded-[7px] hover:bg-zinc-100 transition-colors">
            ← Voltar ao início
          </a>
        </div>
      </div>

      {/* ── HERO SLIDER ── */}
      <section className="relative w-full h-[60vh] min-h-[500px] mb-12 overflow-hidden bg-zinc-900 group">
        <AnimatePresence initial={false}>
          <motion.div
            key={currentSlide}
            initial={{ opacity: 0, scale: 1.05 }}
            animate={{ opacity: 1, scale: 1 }}
            exit={{ opacity: 0 }}
            transition={{ duration: 1.2, ease: 'easeInOut' }}
            className="absolute inset-0"
          >
            <div className="absolute inset-0 bg-gradient-to-r from-black/90 via-black/60 to-black/20 z-10" />
            <img 
              src={heroSlides[currentSlide].image} 
              alt={heroSlides[currentSlide].title} 
              className="w-full h-full object-cover object-center"
            />
            
            <div className="absolute inset-0 z-20 flex items-center pb-28 pt-12 md:pb-16 md:pt-0">
              <div className="container-custom w-full">
                <motion.div 
                  initial={{ opacity: 0, y: 30 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ delay: 0.5, duration: 0.8 }}
                  className="max-w-2xl min-h-[300px] flex flex-col justify-center"
                >
                  <div>
                    <div className="inline-flex items-center gap-2 px-3 py-1.5 bg-white/10 backdrop-blur-md border border-white/20 mb-6 rounded-[7px]">
                      <span className="w-2 h-2 bg-teal-400 animate-pulse" />
                      <span className="text-[10px] font-bold uppercase tracking-widest text-white">{heroSlides[currentSlide].subtitle}</span>
                    </div>
                    
                    <h1 className="font-heading font-black text-4xl md:text-6xl lg:text-7xl text-white mb-6 tracking-tight leading-[1.1] drop-shadow-xl min-h-[140px] flex items-center">
                      {heroSlides[currentSlide].title}
                    </h1>
                  </div>
                  
                  <p className="font-body text-zinc-200 text-lg md:text-xl leading-relaxed mb-10 max-w-xl text-shadow-sm">
                    {heroSlides[currentSlide].desc}
                  </p>

                  <div className="flex flex-col sm:flex-row items-center gap-4">
                    <button 
                      onClick={() => handleAddToCart(products[3])} 
                      className="bg-white dark:bg-zinc-950 text-zinc-900 dark:text-white hover:bg-zinc-100 dark:bg-zinc-800 font-bold px-10 h-14 transition-colors flex items-center justify-center gap-2 w-full sm:w-auto shadow-lg rounded-[7px]"
                    >
                      <ShoppingBag size={18} />
                      Comprar Hoodie
                    </button>
                    <span className="text-2xl font-black text-white ml-2 drop-shadow-md">{formatKz(products[3].price)}</span>
                  </div>
                </motion.div>
              </div>
            </div>
          </motion.div>
        </AnimatePresence>

        {/* Slider Controls */}
        <div className="absolute z-30 bottom-12 left-0 right-0">
          <div className="container-custom flex justify-between items-center">
            {/* Dots */}
            <div className="flex gap-3">
              {heroSlides.map((_, idx) => (
                <button
                  key={idx}
                  onClick={() => setCurrentSlide(idx)}
                  className={`h-2 transition-all duration-500 rounded-[7px] ${
                    currentSlide === idx ? 'w-10 bg-teal-500' : 'w-2 bg-white/50 hover:bg-white dark:bg-zinc-950'
                  }`}
                  aria-label={`Go to slide ${idx + 1}`}
                />
              ))}
            </div>
            
            {/* Arrows */}
            <div className="flex gap-2 opacity-0 group-hover:opacity-100 transition-opacity duration-300 hidden md:flex">
              <button 
                onClick={() => setCurrentSlide(prev => (prev - 1 + heroSlides.length) % heroSlides.length)}
                className="w-12 h-12 border border-white/20 bg-white/10 backdrop-blur-md flex items-center justify-center text-white hover:bg-white dark:bg-zinc-950 hover:text-zinc-900 dark:text-white transition-all rounded-[7px]"
              >
                <ChevronLeft size={20} />
              </button>
              <button 
                onClick={() => setCurrentSlide(prev => (prev + 1) % heroSlides.length)}
                className="w-12 h-12 border border-white/20 bg-white/10 backdrop-blur-md flex items-center justify-center text-white hover:bg-white dark:bg-zinc-950 hover:text-zinc-900 dark:text-white transition-all rounded-[7px]"
              >
                <ChevronRight size={20} />
              </button>
            </div>
          </div>
        </div>
      </section>

      {/* ── FEATURES ── */}
      <section className="border-y border-zinc-200 dark:border-zinc-800 bg-[#f5f5f7] dark:bg-zinc-900 py-8 mb-24">
        <div className="container-custom">
          <div className="flex flex-wrap justify-center gap-8 md:gap-16 text-center">
            {[
              { icon: Truck, text: 'Envio Grátis > 50.000 Kz' },
              { icon: ShieldCheck, text: 'Padrão Internacional' },
              { icon: RefreshCcw, text: 'Entregas em toda Angola' }
            ].map((feat, i) => (
              <div key={i} className="flex items-center gap-3 text-zinc-600 dark:text-zinc-300 font-body font-medium text-sm">
                <feat.icon size={20} className="text-teal-500" />
                {feat.text}
              </div>
            ))}
          </div>
        </div>
      </section>



      {/* ── PRODUCTS GRID ── */}
      <section id="catalogo" className="container-custom mb-32">
        <div className="flex flex-col md:flex-row justify-between items-center md:items-end mb-12 gap-6">
          <div className="text-center md:text-left">
            <h2 className="font-heading font-bold text-4xl text-zinc-900 dark:text-white mb-4">Catálogo</h2>
            <p className="font-body text-zinc-500 dark:text-zinc-400">Equipa-te com as ferramentas da alta performance.</p>
          </div>
          
          {/* Categorias / Filtros */}
          <div className="flex flex-wrap justify-center gap-2">
            {categories.map((cat) => (
              <button
                key={cat}
                onClick={() => setSelectedCategory(cat)}
                className={`px-5 py-2.5 font-semibold text-sm transition-all duration-300 rounded-[7px] ${
                  selectedCategory === cat 
                    ? 'bg-teal-600 text-white shadow-md' 
                    : 'bg-white dark:bg-zinc-950 text-zinc-500 dark:text-zinc-400 border border-zinc-200 dark:border-zinc-800 hover:border-teal-500 hover:text-teal-600'
                }`}
              >
                {cat}
              </button>
            ))}
          </div>
        </div>

        <motion.div 
          layout
          className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-6"
        >
          <AnimatePresence>
            {filteredProducts.map((product, i) => (
              <motion.div 
                layout
                key={product.name}
                initial={{ opacity: 0, scale: 0.9 }}
                animate={{ opacity: 1, scale: 1 }}
                exit={{ opacity: 0, scale: 0.9 }}
                transition={{ duration: 0.3 }}
                className="group cursor-pointer"
              >
              <Link to={`/store/${product.id}`} className="block relative aspect-[4/5] bg-[#f5f5f7] dark:bg-zinc-900 overflow-hidden mb-5 border border-zinc-200 dark:border-zinc-800 group-hover:border-teal-500/30 transition-colors rounded-[7px]">
                <img 
                  src={product.image} 
                  alt={product.name}
                  className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-700 opacity-90 group-hover:opacity-100" 
                />
                
                {product.status && (
                  <div className="absolute top-4 left-4 bg-white dark:bg-zinc-950 text-zinc-900 dark:text-white text-[10px] font-bold uppercase tracking-wider px-3 py-1.5 border border-zinc-200 dark:border-zinc-800 rounded-[7px]">
                    {product.status}
                  </div>
                )}
                
                <div className="absolute inset-0 bg-white/60 opacity-0 group-hover:opacity-100 transition-opacity duration-300 flex items-center justify-center backdrop-blur-sm">
                  <button 
                    onClick={() => handleAddToCart(product)} 
                    className="bg-zinc-900 text-white font-bold text-sm px-6 py-3 transform translate-y-4 group-hover:translate-y-0 transition-all duration-300 flex items-center gap-2 rounded-[7px]"
                  >
                    <ShoppingBag size={16} />
                    {product.sizes || product.colors ? 'Selecionar Opções' : 'Comprar'}
                  </button>
                </div>
              </Link>
              
              <Link to={`/store/${product.id}`} className="block text-center hover:opacity-80 transition-opacity">
                <p className="text-teal-600 text-[10px] font-bold uppercase tracking-widest mb-2">{product.category}</p>
                <h3 className="text-zinc-900 dark:text-white font-semibold text-base mb-1">{product.name}</h3>
                <p className="text-zinc-500 dark:text-zinc-400 text-sm font-medium">{formatKz(product.price)}</p>
              </Link>
            </motion.div>
          ))}
          </AnimatePresence>
        </motion.div>
      </section>

      {/* ── O PROCESSO DE QUALIDADE (MOVIDO PARA BAIXO) ── */}
      <section className="container-custom mb-32">
        <div className="text-center mb-16">
          <h2 className="font-heading font-bold text-3xl md:text-4xl text-zinc-900 dark:text-white mb-4">A Diferença Samora</h2>
          <p className="font-body text-zinc-500 dark:text-zinc-400 text-lg max-w-2xl mx-auto">Não vendemos merchandising básico. Desenhamos peças pensadas para a longevidade e performance extrema.</p>
        </div>
        <div className="grid grid-cols-1 md:grid-cols-3 gap-8">
          {[
            { title: 'Tecidos de Elite', desc: 'Selecionamos apenas algodão e misturas desportivas de alta durabilidade que resistem a centenas de lavagens.' },
            { title: 'Fit Anatómico', desc: 'Cortes estudados para assentar perfeitamente, garantindo liberdade de movimento no treino ou na rua.' },
            { title: 'Design Minimalista', desc: 'Logos discretos e paletas monocromáticas. Acreditamos que a elegância grita em silêncio.' }
          ].map((item, i) => (
            <motion.div 
              key={i}
              initial={{ opacity: 0, y: 20 }}
              whileInView={{ opacity: 1, y: 0 }}
              viewport={{ once: true }}
              transition={{ delay: i * 0.1 }}
              className="text-center p-8 bg-white dark:bg-zinc-950 border border-zinc-200 dark:border-zinc-800 rounded-[7px]"
            >
              <h3 className="font-heading font-bold text-xl text-zinc-900 dark:text-white mb-3">{item.title}</h3>
              <p className="font-body text-zinc-500 dark:text-zinc-400 text-sm leading-relaxed">{item.desc}</p>
            </motion.div>
          ))}
        </div>
      </section>

      {/* ── INSTAGRAM COMMUNITY (NEW) ── */}
      <section className="container-custom mb-32 overflow-hidden">
        <div className="text-center mb-12">
          <p className="text-teal-600 font-bold tracking-widest uppercase text-[10px] mb-2">Comunidade</p>
          <h2 className="font-heading font-bold text-3xl text-zinc-900 dark:text-white">#UniversoSamora</h2>
        </div>
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
          {[
            'https://images.unsplash.com/photo-1518310383802-640c2de311b2?ixlib=rb-4.0.3&auto=format&fit=crop&w=500&q=80',
            'https://images.unsplash.com/photo-1534438327276-14e5300c3a48?ixlib=rb-4.0.3&auto=format&fit=crop&w=500&q=80',
            'https://images.unsplash.com/photo-1483721310020-03333e577078?ixlib=rb-4.0.3&auto=format&fit=crop&w=500&q=80',
            'https://images.unsplash.com/photo-1515886657613-9f3515b0c78f?ixlib=rb-4.0.3&auto=format&fit=crop&w=500&q=80'
          ].map((img, i) => (
            <div key={i} className="aspect-square bg-zinc-900 overflow-hidden group relative">
              <img src={img} alt="Community" className="w-full h-full object-cover grayscale opacity-60 group-hover:opacity-100 group-hover:grayscale-0 transition-all duration-500" />
              <div className="absolute inset-0 flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity">
                <div className="w-12 h-12 bg-zinc-950/50 backdrop-blur-md flex items-center justify-center text-white">
                  <Star size={20} fill="currentColor" />
                </div>
              </div>
            </div>
          ))}
        </div>
      </section>



      {/* ── QUICK VIEW MODAL ── */}
      <AnimatePresence>
        {quickViewProduct && (
          <motion.div
            className="fixed inset-0 z-[70] flex items-center justify-center p-4 sm:p-6"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
          >
            <div className="absolute inset-0 bg-black/60 backdrop-blur-sm" onClick={() => setQuickViewProduct(null)} />
            
            <motion.div
              className="relative w-full max-w-3xl bg-white dark:bg-zinc-950 shadow-2xl overflow-hidden flex flex-col md:flex-row max-h-[90vh]"
              initial={{ scale: 0.95, opacity: 0, y: 20 }}
              animate={{ scale: 1, opacity: 1, y: 0 }}
              exit={{ scale: 0.95, opacity: 0, y: 20 }}
            >
              <button onClick={() => setQuickViewProduct(null)} className="absolute top-4 right-4 z-10 p-2 bg-white/80 backdrop-blur-sm hover:bg-white dark:bg-zinc-950 text-zinc-900 dark:text-white transition-colors shadow-sm">
                <X size={20} />
              </button>

              <div className="w-full md:w-1/2 h-64 md:h-auto bg-zinc-100 dark:bg-zinc-800">
                <img src={quickViewProduct.image} alt={quickViewProduct.name} className="w-full h-full object-cover" />
              </div>
              
              <div className="w-full md:w-1/2 p-8 md:p-12 overflow-y-auto">
                <p className="text-teal-600 text-[10px] font-bold uppercase tracking-widest mb-2">{quickViewProduct.category}</p>
                <h2 className="font-heading font-bold text-3xl text-zinc-900 dark:text-white mb-2 leading-tight">{quickViewProduct.name}</h2>
                <p className="text-2xl font-semibold text-zinc-900 dark:text-white mb-8">{formatKz(quickViewProduct.price)}</p>

                {quickViewProduct.colors && (
                  <div className="mb-6">
                    <h4 className="font-semibold text-sm text-zinc-900 dark:text-white mb-3">Cor</h4>
                    <div className="flex gap-2">
                      {quickViewProduct.colors.map(color => (
                        <button 
                          key={color}
                          onClick={() => setSelectedColor(color)}
                          className={`px-4 py-2 border text-sm font-medium transition-colors ${
                            selectedColor === color ? 'border-teal-500 bg-teal-50 text-teal-700' : 'border-zinc-200 dark:border-zinc-800 text-zinc-600 dark:text-zinc-300 hover:border-zinc-300'
                          }`}
                        >
                          {color}
                        </button>
                      ))}
                    </div>
                  </div>
                )}

                {quickViewProduct.sizes && (
                  <div className="mb-8">
                    <h4 className="font-semibold text-sm text-zinc-900 dark:text-white mb-3">Tamanho</h4>
                    <div className="flex gap-2">
                      {quickViewProduct.sizes.map(size => (
                        <button 
                          key={size}
                          onClick={() => setSelectedSize(size)}
                          className={`w-12 h-12 flex items-center justify-center border text-sm font-bold transition-colors ${
                            selectedSize === size ? 'border-teal-500 bg-teal-50 text-teal-700' : 'border-zinc-200 dark:border-zinc-800 text-zinc-600 dark:text-zinc-300 hover:border-zinc-300'
                          }`}
                        >
                          {size}
                        </button>
                      ))}
                    </div>
                  </div>
                )}

                <button 
                  onClick={confirmAddToCart}
                  className="w-full bg-[#D71920] hover:bg-[#FF3038] text-white font-bold h-14 shadow-[0_4px_20px_rgba(215,25,32,0.3)] transition-colors flex items-center justify-center gap-2"
                >
                  <ShoppingBag size={20} />
                  Adicionar ao Carrinho
                </button>
              </div>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>

    </main>
  )
}
