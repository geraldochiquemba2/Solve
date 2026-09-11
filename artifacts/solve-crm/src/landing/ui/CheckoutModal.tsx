import { useState } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import { X, CreditCard, Loader2, ShieldCheck } from 'lucide-react'
import { useCart } from '../context/CartContext'
import { createPay4AllPayment } from '../services/pay4all'

interface CheckoutModalProps {
  isOpen: boolean
  onClose: () => void
}

export default function CheckoutModal({ isOpen, onClose }: CheckoutModalProps) {
  const { cart, cartTotal, shippingCost, grandTotal, formatKz } = useCart()
  const [loading, setLoading] = useState(false)
  const [formData, setFormData] = useState({
    name: '',
    email: '',
    phone: '',
    address: '',
    nif: ''
  })

  const handleChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    setFormData(prev => ({ ...prev, [e.target.name]: e.target.value }))
  }

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setLoading(true)

    try {
      const response = await createPay4AllPayment({
        totalAmount: cartTotal,
        customer: formData,
        items: cart
      })

      if (response.success && response.payment_url) {
        // Redirecionar para o portal da Pay4All
        window.location.href = response.payment_url
      } else {
        alert('Ocorreu um erro ao gerar o pagamento. Tente novamente.')
      }
    } catch (error) {
      console.error(error)
      alert('Erro de comunicação com a Pay4All.')
    } finally {
      setLoading(false)
    }
  }

  return (
    <AnimatePresence>
      {isOpen && (
        <motion.div
          className="fixed inset-0 z-[70] flex items-center justify-center p-4 sm:p-6"
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
        >
          <div className="absolute inset-0 bg-black/60 backdrop-blur-sm" onClick={onClose} />
          
          <motion.div
            className="relative w-full max-w-5xl bg-white dark:bg-zinc-950 shadow-2xl overflow-hidden flex flex-col max-h-[90vh]"
            initial={{ scale: 0.95, opacity: 0, y: 20 }}
            animate={{ scale: 1, opacity: 1, y: 0 }}
            exit={{ scale: 0.95, opacity: 0, y: 20 }}
          >
            {/* Header Mobile Only */}
            <div className="flex md:hidden items-center justify-between p-6 border-b border-zinc-100 dark:border-zinc-800 bg-zinc-50 dark:bg-zinc-900">
              <div>
                <h2 className="font-heading font-bold text-xl text-zinc-900 dark:text-white">Finalizar Encomenda</h2>
              </div>
              <button onClick={onClose} className="p-2 bg-white dark:bg-zinc-900 hover:bg-zinc-100 dark:hover:bg-zinc-800 text-zinc-500 dark:text-zinc-400 border border-zinc-200 dark:border-zinc-800 transition-colors shadow-sm">
                <X size={20} />
              </button>
            </div>

            <div className="flex flex-col md:flex-row flex-1 overflow-hidden">
              
              {/* Left Column: Form */}
              <div className="w-full md:w-3/5 p-6 md:p-10 overflow-y-auto border-r border-zinc-100 dark:border-zinc-800">
                <div className="hidden md:flex justify-between items-center mb-8">
                  <h2 className="font-heading font-bold text-3xl text-zinc-900 dark:text-white">Finalizar Encomenda</h2>
                  <button onClick={onClose} className="p-2 bg-zinc-50 dark:bg-zinc-900 hover:bg-zinc-100 dark:bg-zinc-800 text-zinc-500 dark:text-zinc-400 transition-colors">
                    <X size={20} />
                  </button>
                </div>

                <form id="checkout-form" onSubmit={handleSubmit} className="space-y-5">
                
                <div>
                  <label className="block text-sm font-semibold text-zinc-900 dark:text-white mb-1.5">Nome Completo *</label>
                  <input required type="text" name="name" value={formData.name} onChange={handleChange} className="w-full h-12 px-4 border border-zinc-200 dark:border-zinc-800 bg-zinc-50 dark:bg-zinc-900 focus:bg-white dark:focus:bg-zinc-950 text-zinc-900 dark:text-white placeholder-zinc-400 dark:placeholder-zinc-500 focus:border-[#D71920] focus:ring-1 focus:ring-[#D71920] transition-all outline-none" placeholder="O seu nome" />
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                  <div>
                    <label className="block text-sm font-semibold text-zinc-900 dark:text-white mb-1.5">Email *</label>
                    <input required type="email" name="email" value={formData.email} onChange={handleChange} className="w-full h-12 px-4 border border-zinc-200 dark:border-zinc-800 bg-zinc-50 dark:bg-zinc-900 focus:bg-white dark:focus:bg-zinc-950 text-zinc-900 dark:text-white placeholder-zinc-400 dark:placeholder-zinc-500 focus:border-[#D71920] focus:ring-1 focus:ring-[#D71920] transition-all outline-none" placeholder="exemplo@email.com" />
                  </div>
                  <div>
                    <label className="block text-sm font-semibold text-zinc-900 dark:text-white mb-1.5">Telemóvel *</label>
                    <input required type="tel" name="phone" value={formData.phone} onChange={handleChange} className="w-full h-12 px-4 border border-zinc-200 dark:border-zinc-800 bg-zinc-50 dark:bg-zinc-900 focus:bg-white dark:focus:bg-zinc-950 text-zinc-900 dark:text-white placeholder-zinc-400 dark:placeholder-zinc-500 focus:border-[#D71920] focus:ring-1 focus:ring-[#D71920] transition-all outline-none" placeholder="+244 ..." />
                  </div>
                </div>

                <div>
                  <label className="block text-sm font-semibold text-zinc-900 dark:text-white mb-1.5">Morada Completa *</label>
                  <input required type="text" name="address" value={formData.address} onChange={handleChange} className="w-full h-12 px-4 border border-zinc-200 dark:border-zinc-800 bg-zinc-50 dark:bg-zinc-900 focus:bg-white dark:focus:bg-zinc-950 text-zinc-900 dark:text-white placeholder-zinc-400 dark:placeholder-zinc-500 focus:border-[#D71920] focus:ring-1 focus:ring-[#D71920] transition-all outline-none" placeholder="Rua, Número, Código Postal, Cidade" />
                </div>

                <div>
                  <label className="block text-sm font-semibold text-zinc-900 dark:text-white mb-1.5">NIF <span className="text-zinc-400 font-normal">(Opcional)</span></label>
                  <input type="text" name="nif" value={formData.nif} onChange={handleChange} className="w-full h-12 px-4 border border-zinc-200 dark:border-zinc-800 bg-zinc-50 dark:bg-zinc-900 focus:bg-white dark:focus:bg-zinc-950 text-zinc-900 dark:text-white placeholder-zinc-400 dark:placeholder-zinc-500 focus:border-[#D71920] focus:ring-1 focus:ring-[#D71920] transition-all outline-none" placeholder="Número de Contribuinte" />
                </div>

              </form>
              </div>

              {/* Right Column: Order Summary */}
              <div className="w-full md:w-2/5 bg-zinc-50 dark:bg-zinc-900 p-6 md:p-10 flex flex-col border-t md:border-t-0 border-zinc-100 overflow-y-auto">
                <h3 className="font-heading font-bold text-xl text-zinc-900 dark:text-white mb-6">Resumo da Encomenda</h3>
                
                <div className="flex-1 space-y-4 mb-8">
                  {cart.map((item, i) => (
                    <div key={i} className="flex gap-4 items-center">
                      <div className="w-16 h-20 bg-white dark:bg-zinc-950 overflow-hidden shrink-0 border border-zinc-200 dark:border-zinc-800 relative">
                        <img src={item.product.image} alt={item.product.name} className="w-full h-full object-cover" />
                        <span className="absolute -top-2 -right-2 w-5 h-5 bg-zinc-900 text-white text-[10px] flex items-center justify-center z-10">{item.quantity}</span>
                      </div>
                      <div className="flex-1">
                        <h4 className="font-heading font-bold text-sm text-zinc-900 dark:text-white leading-tight">{item.product.name}</h4>
                        {(item.selectedSize || item.selectedColor) && (
                          <p className="text-xs text-zinc-500 dark:text-zinc-400 mt-0.5">
                            {item.selectedSize} {item.selectedSize && item.selectedColor && ' | '} {item.selectedColor}
                          </p>
                        )}
                      </div>
                      <div className="font-bold text-zinc-900 dark:text-white text-sm">
                        {formatKz(item.product.price * item.quantity)}
                      </div>
                    </div>
                  ))}
                </div>

                <div className="space-y-3 pt-6 border-t border-zinc-200 dark:border-zinc-800 mb-6">
                  <div className="flex justify-between items-center text-sm">
                    <span className="text-zinc-500 dark:text-zinc-400 font-medium">Subtotal</span>
                    <span className="font-bold text-zinc-900 dark:text-white">{formatKz(cartTotal)}</span>
                  </div>
                  <div className="flex justify-between items-center text-sm">
                    <span className="text-zinc-500 dark:text-zinc-400 font-medium">Portes de Envio</span>
                    <span className="font-bold text-zinc-900 dark:text-white">{shippingCost === 0 ? 'Grátis' : formatKz(shippingCost)}</span>
                  </div>
                </div>

                <div className="flex justify-between items-end pt-6 border-t border-zinc-200 dark:border-zinc-800 mb-8">
                  <span className="font-heading font-bold text-lg text-zinc-900 dark:text-white">Total</span>
                  <span className="font-heading font-black text-3xl text-teal-600">{formatKz(grandTotal)}</span>
                </div>

                <button 
                  type="submit" 
                  form="checkout-form"
                  disabled={loading}
                  className="w-full bg-[#D71920] hover:bg-[#FF3038] text-white font-bold h-14 shadow-[0_4px_20px_rgba(215,25,32,0.3)] transition-colors flex items-center justify-center gap-2 disabled:opacity-70 disabled:cursor-not-allowed"
                >
                  {loading ? (
                    <>
                      <Loader2 size={20} className="animate-spin" />
                      A processar...
                    </>
                  ) : (
                    <>
                      <CreditCard size={20} />
                      Pagar Seguramente
                    </>
                  )}
                </button>
                <div className="flex items-center justify-center gap-2 mt-4 text-[11px] text-zinc-400 font-medium uppercase tracking-wider">
                  <ShieldCheck size={14} className="text-teal-500" />
                  <span>Pagamento 100% seguro via Pay4All</span>
                </div>
              </div>

            </div>
          </motion.div>
        </motion.div>
      )}
    </AnimatePresence>
  )
}
