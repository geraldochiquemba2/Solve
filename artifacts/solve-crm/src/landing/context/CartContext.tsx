import { createContext, useContext, useState, useEffect, ReactNode } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import { ShoppingBag, X, Plus, Minus } from 'lucide-react'
import CheckoutModal from '../ui/CheckoutModal'

export interface Product {
  id: string
  name: string
  category: string
  price: number
  image: string
  status?: string
  sizes?: string[]
  colors?: string[]
}

export interface CartItem {
  product: Product
  quantity: number
  selectedSize?: string
  selectedColor?: string
}

interface CartContextType {
  cart: CartItem[]
  isCartOpen: boolean
  addToCart: (product: Product, size?: string, color?: string) => void
  removeFromCart: (productId: string, size?: string, color?: string) => void
  updateQuantity: (productId: string, delta: number, size?: string, color?: string) => void
  setCartOpen: (isOpen: boolean) => void
  cartTotal: number
  shippingCost: number
  grandTotal: number
  formatKz: (val: number) => string
}

const CartContext = createContext<CartContextType | undefined>(undefined)

export function CartProvider({ children }: { children: ReactNode }) {
  const [cart, setCart] = useState<CartItem[]>([])
  const [isCartOpen, setCartOpen] = useState(false)
  const [isCheckoutOpen, setCheckoutOpen] = useState(false)
  const [isLoaded, setIsLoaded] = useState(false)

  // Load from LocalStorage on mount
  useEffect(() => {
    const savedCart = localStorage.getItem('samora_cart')
    if (savedCart) {
      try {
        setCart(JSON.parse(savedCart))
      } catch (e) {
        console.error('Failed to parse cart', e)
      }
    }
    setIsLoaded(true)
  }, [])

  // Save to LocalStorage whenever cart changes
  useEffect(() => {
    if (isLoaded) {
      localStorage.setItem('samora_cart', JSON.stringify(cart))
    }
  }, [cart, isLoaded])

  const addToCart = (product: Product, size?: string, color?: string) => {
    setCart(prev => {
      const existing = prev.find(item => 
        item.product.id === product.id && 
        item.selectedSize === size && 
        item.selectedColor === color
      )
      if (existing) {
        return prev.map(item => 
          (item.product.id === product.id && item.selectedSize === size && item.selectedColor === color)
            ? { ...item, quantity: item.quantity + 1 } 
            : item
        )
      }
      return [...prev, { product, quantity: 1, selectedSize: size, selectedColor: color }]
    })
    setCartOpen(true)
  }

  const updateQuantity = (productId: string, delta: number, size?: string, color?: string) => {
    setCart(prev => prev.map(item => {
      if (item.product.id === productId && item.selectedSize === size && item.selectedColor === color) {
        const newQ = item.quantity + delta
        return newQ > 0 ? { ...item, quantity: newQ } : item
      }
      return item
    }))
  }

  const removeFromCart = (productId: string, size?: string, color?: string) => {
    setCart(prev => prev.filter(item => 
      !(item.product.id === productId && item.selectedSize === size && item.selectedColor === color)
    ))
  }

  const cartTotal = cart.reduce((total, item) => total + (item.product.price * item.quantity), 0)
  
  // Regra de Frete: 2500 Kz, mas grátis para compras acima de 50.000 Kz
  const shippingCost = (cartTotal > 0 && cartTotal < 50000) ? 2500 : 0
  const grandTotal = cartTotal + shippingCost

  const formatKz = (val: number) => {
    return new Intl.NumberFormat('pt-PT', {
      style: 'currency',
      currency: 'AOA',
      minimumFractionDigits: 2
    }).format(val).replace('AOA', 'Kz')
  }

  return (
    <CartContext.Provider value={{ cart, isCartOpen, addToCart, removeFromCart, updateQuantity, setCartOpen, cartTotal, shippingCost, grandTotal, formatKz }}>
      {children}
      {/* ── GLOBAL CART DRAWER ── */}
      <AnimatePresence>
        {isCartOpen && (
          <motion.div
            className="fixed inset-0 z-[60] flex justify-end"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            transition={{ duration: 0.2 }}
          >
            <div className="absolute inset-0 bg-black/40 backdrop-blur-sm" onClick={() => setCartOpen(false)} />
            
            <motion.div
              className="relative w-full max-w-md bg-white dark:bg-zinc-950 h-full shadow-2xl flex flex-col"
              initial={{ x: '100%' }}
              animate={{ x: 0 }}
              exit={{ x: '100%' }}
              transition={{ type: 'spring', damping: 25, stiffness: 200 }}
            >
              {/* Header */}
              <div className="flex items-center justify-between p-6 border-b border-zinc-100">
                <h2 className="font-heading font-bold text-2xl text-zinc-900 dark:text-white">O Teu Carrinho</h2>
                <button onClick={() => setCartOpen(false)} className="p-2 bg-zinc-100 dark:bg-zinc-800 hover:bg-zinc-200 text-zinc-600 dark:text-zinc-300 transition-colors">
                  <X size={20} />
                </button>
              </div>

              {/* Items */}
              <div className="flex-1 overflow-y-auto p-6 space-y-6">
                {cart.length === 0 ? (
                  <div className="flex flex-col items-center justify-center h-full text-zinc-400">
                    <ShoppingBag size={48} className="mb-4 opacity-20" />
                    <p className="font-body text-lg">O teu carrinho está vazio.</p>
                  </div>
                ) : (
                  cart.map((item, i) => (
                    <div key={i} className="flex gap-4 items-center">
                      <div className="w-20 h-24 bg-zinc-100 dark:bg-zinc-800 overflow-hidden shrink-0 border border-zinc-200 dark:border-zinc-800">
                        <img src={item.product.image} alt={item.product.name} className="w-full h-full object-cover" />
                      </div>
                      <div className="flex-1">
                        <h3 className="font-heading font-bold text-sm text-zinc-900 dark:text-white leading-tight mb-1">{item.product.name}</h3>
                        {(item.selectedSize || item.selectedColor) && (
                          <p className="text-xs text-zinc-400 mb-1">
                            {item.selectedSize && `Tam: ${item.selectedSize}`} 
                            {item.selectedSize && item.selectedColor && ' | '}
                            {item.selectedColor && `Cor: ${item.selectedColor}`}
                          </p>
                        )}
                        <p className="text-teal-600 font-medium text-sm mb-3">{formatKz(item.product.price)}</p>
                        
                        <div className="flex items-center gap-3">
                          <div className="flex items-center bg-zinc-100 dark:bg-zinc-800 p-1">
                            <button onClick={() => updateQuantity(item.product.id, -1, item.selectedSize, item.selectedColor)} className="w-6 h-6 flex items-center justify-center hover:bg-white dark:bg-zinc-950 text-zinc-600 dark:text-zinc-300 transition-colors shadow-sm">
                              <Minus size={12} />
                            </button>
                            <span className="w-6 text-center text-xs font-bold text-zinc-900 dark:text-white">{item.quantity}</span>
                            <button onClick={() => updateQuantity(item.product.id, 1, item.selectedSize, item.selectedColor)} className="w-6 h-6 flex items-center justify-center hover:bg-white dark:bg-zinc-950 text-zinc-600 dark:text-zinc-300 transition-colors shadow-sm">
                              <Plus size={12} />
                            </button>
                          </div>
                          <button onClick={() => removeFromCart(item.product.id, item.selectedSize, item.selectedColor)} className="text-[10px] uppercase font-bold text-red-500 hover:text-red-700 tracking-wider">
                            Remover
                          </button>
                        </div>
                      </div>
                    </div>
                  ))
                )}
              </div>

              {/* Footer */}
              {cart.length > 0 && (
                <div className="p-6 border-t border-zinc-100 bg-zinc-50 dark:bg-zinc-900">
                  <div className="flex justify-between items-center mb-2">
                    <span className="text-sm font-medium text-zinc-500 dark:text-zinc-400">Subtotal</span>
                    <span className="font-bold text-zinc-900 dark:text-white">{formatKz(cartTotal)}</span>
                  </div>
                  <div className="flex justify-between items-center mb-6">
                    <span className="text-sm font-medium text-zinc-500 dark:text-zinc-400">Portes de Envio</span>
                    <span className="font-bold text-zinc-900 dark:text-white">{shippingCost === 0 ? 'Grátis' : formatKz(shippingCost)}</span>
                  </div>
                  <div className="flex justify-between items-center mb-6 pt-4 border-t border-zinc-200 dark:border-zinc-800">
                    <span className="font-heading font-bold text-zinc-900 dark:text-white">Total a Pagar</span>
                    <span className="font-heading font-black text-2xl text-teal-600">{formatKz(grandTotal)}</span>
                  </div>
                  <button onClick={() => {
                    setCartOpen(false)
                    setCheckoutOpen(true)
                  }} className="w-full bg-[#D71920] hover:bg-[#FF3038] text-white font-bold h-14 shadow-[0_4px_20px_rgba(215,25,32,0.3)] transition-colors">
                    Finalizar Compra
                  </button>
                </div>
              )}
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>

      <CheckoutModal isOpen={isCheckoutOpen} onClose={() => setCheckoutOpen(false)} />
    </CartContext.Provider>
  )
}

export function useCart() {
  const context = useContext(CartContext)
  if (context === undefined) {
    throw new Error('useCart must be used within a CartProvider')
  }
  return context
}
