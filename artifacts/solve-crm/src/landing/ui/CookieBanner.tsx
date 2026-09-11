import { useState, useEffect } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import { Cookie } from 'lucide-react'

export default function CookieBanner() {
  const [isVisible, setIsVisible] = useState(false)

  useEffect(() => {
    // Check if user has already accepted or rejected cookies
    const consent = localStorage.getItem('cookieConsent')
    if (!consent) {
      // Delay showing banner slightly for better UX
      const timer = setTimeout(() => setIsVisible(true), 1500)
      return () => clearTimeout(timer)
    }
    return undefined
  }, [])

  const handleAccept = () => {
    localStorage.setItem('cookieConsent', 'accepted')
    setIsVisible(false)
  }

  const handleReject = () => {
    localStorage.setItem('cookieConsent', 'rejected')
    setIsVisible(false)
  }

  return (
    <AnimatePresence>
      {isVisible && (
        <motion.div
          className="fixed bottom-4 left-4 md:bottom-8 md:left-8 z-[90] p-4 pointer-events-none"
          initial={{ y: 50, opacity: 0, scale: 0.9 }}
          animate={{ y: 0, opacity: 1, scale: 1 }}
          exit={{ y: 20, opacity: 0, scale: 0.9 }}
          transition={{ type: 'spring', stiffness: 300, damping: 25 }}
        >
          <div className="bg-white dark:bg-zinc-950 border border-zinc-200 dark:border-zinc-800 p-5 md:p-6 w-full max-w-sm rounded-[7px] shadow-2xl pointer-events-auto flex flex-col gap-4">
            <div className="flex gap-4 items-start">
              <div className="w-10 h-10 bg-teal-50 dark:bg-teal-900/20 rounded-[7px] flex items-center justify-center flex-shrink-0 border border-teal-100 dark:border-teal-900/30">
                <Cookie size={20} className="text-teal-600" />
              </div>
              <div>
                <h4 className="font-heading font-bold text-zinc-900 dark:text-white text-base mb-1">Privacidade</h4>
                <p className="font-body text-zinc-500 dark:text-zinc-400 text-xs leading-relaxed">
                  Utilizamos cookies para melhorar a sua experiência e analisar o tráfego. Consulte a nossa{' '}
                  <button 
                    onClick={() => window.dispatchEvent(new Event('openCookiesModal'))}
                    className="text-teal-600 font-medium hover:underline"
                  >
                    Política de Cookies
                  </button>.
                </p>
              </div>
            </div>
            
            <div className="flex items-center gap-2 mt-2">
              <button
                onClick={handleReject}
                className="flex-1 py-2 bg-white dark:bg-zinc-950 border border-zinc-200 dark:border-zinc-800 rounded-[7px] text-zinc-600 dark:text-zinc-300 hover:text-zinc-900 dark:text-white hover:bg-zinc-50 dark:bg-zinc-900 hover:border-zinc-300 text-xs font-bold transition-colors whitespace-nowrap"
              >
                Apenas Essenciais
              </button>
              <button
                onClick={handleAccept}
                className="flex-1 py-2 bg-[#D71920] rounded-[7px] text-white text-xs font-bold hover:bg-[#FF3038] shadow-[0_4px_14px_rgba(215,25,32,0.3)] transition-all whitespace-nowrap"
              >
                Aceitar Todos
              </button>
            </div>
          </div>
        </motion.div>
      )}
    </AnimatePresence>
  )
}
