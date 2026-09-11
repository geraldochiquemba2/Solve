import { useState, useEffect } from 'react'
import { useParams, Link } from 'wouter'
import { ShoppingBag, ChevronLeft } from 'lucide-react'
import { products } from './data/products'
import { useCart } from './context/CartContext'

export default function ProductDetail() {
  const { id } = useParams<{ id: string }>()
  const product = products.find(p => p.id === id)
  
  const [selectedSize, setSelectedSize] = useState<string>('')
  const [selectedColor, setSelectedColor] = useState<string>('')
  
  const { addToCart, formatKz } = useCart()

  useEffect(() => {
    if (product) {
      if (product.sizes && product.sizes.length > 0) setSelectedSize(product.sizes[0])
      if (product.colors && product.colors.length > 0) setSelectedColor(product.colors[0])
    }
  }, [product])

  if (!product) {
    return (
      <main className="pt-32 pb-20 min-h-screen container-custom text-center">
        <h1 className="text-4xl font-heading font-black text-zinc-900 dark:text-white mb-4">Produto não encontrado</h1>
        <Link to="/store" className="text-teal-600 font-bold underline hover:text-teal-700">Voltar à Loja</Link>
      </main>
    )
  }

  const handleAddToCart = () => {
    addToCart(product, selectedSize, selectedColor)
  }

  return (
    <main className="pt-32 pb-20 min-h-screen relative bg-[#f5f5f7] dark:bg-zinc-900">
      <div className="container-custom">
        <Link to="/store" className="inline-flex items-center gap-2 text-zinc-500 dark:text-zinc-400 hover:text-zinc-900 dark:hover:text-white font-medium mb-8 transition-colors">
          <ChevronLeft size={20} />
          Voltar à Loja
        </Link>
        
        <div className="bg-white dark:bg-zinc-950 border border-zinc-200 dark:border-zinc-800 rounded-[7px] overflow-hidden shadow-sm flex flex-col md:flex-row">
          <div className="w-full md:w-1/2 bg-zinc-100 dark:bg-zinc-800">
            <img src={product.image} alt={product.name} className="w-full h-[50vh] md:h-full object-cover" />
          </div>
          
          <div className="w-full md:w-1/2 p-8 md:p-12 lg:p-16 flex flex-col justify-center">
            <p className="text-teal-600 text-[10px] font-bold uppercase tracking-widest mb-3">{product.category}</p>
            <h1 className="font-heading font-black text-3xl md:text-5xl text-zinc-900 dark:text-white mb-4 leading-tight">{product.name}</h1>
            <p className="text-2xl font-bold text-zinc-900 dark:text-white mb-8">{formatKz(product.price)}</p>

            {product.status && (
              <div className="inline-block bg-teal-50 dark:bg-teal-900/20 text-teal-700 dark:text-teal-400 text-xs font-bold uppercase tracking-wider px-3 py-1 border border-teal-200 dark:border-teal-900/40 rounded-[7px] mb-8 w-max">
                {product.status}
              </div>
            )}

            {product.colors && (
              <div className="mb-6">
                <h4 className="font-semibold text-sm text-zinc-900 dark:text-white mb-3">Cor</h4>
                <div className="flex gap-2">
                  {product.colors.map(color => (
                    <button 
                      key={color}
                      onClick={() => setSelectedColor(color)}
                      className={`px-4 py-2 border text-sm font-medium transition-colors rounded-[7px] ${
                        selectedColor === color ? 'border-teal-500 bg-teal-50 text-teal-700' : 'border-zinc-200 dark:border-zinc-800 text-zinc-600 dark:text-zinc-300 hover:border-zinc-300'
                      }`}
                    >
                      {color}
                    </button>
                  ))}
                </div>
              </div>
            )}

            {product.sizes && (
              <div className="mb-8">
                <h4 className="font-semibold text-sm text-zinc-900 dark:text-white mb-3">Tamanho</h4>
                <div className="flex gap-2">
                  {product.sizes.map(size => (
                    <button 
                      key={size}
                      onClick={() => setSelectedSize(size)}
                      className={`w-12 h-12 flex items-center justify-center border text-sm font-bold transition-colors rounded-[7px] ${
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
              onClick={handleAddToCart}
              className="w-full bg-[#D71920] hover:bg-[#FF3038] text-white font-bold h-14 shadow-[0_4px_20px_rgba(215,25,32,0.3)] transition-colors flex items-center justify-center gap-2 rounded-[7px]"
            >
              <ShoppingBag size={20} />
              Adicionar ao Carrinho
            </button>
          </div>
        </div>
      </div>
    </main>
  )
}
