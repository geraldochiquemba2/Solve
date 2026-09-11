import { useEffect } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import { X } from 'lucide-react'

interface LegalModalProps {
  isOpen: boolean
  onClose: () => void
  title: string
  children: React.ReactNode
}

export default function LegalModal({ isOpen, onClose, title, children }: LegalModalProps) {
  // Prevent body scroll when modal is open
  useEffect(() => {
    if (isOpen) {
      document.body.style.overflow = 'hidden'
    } else {
      document.body.style.overflow = 'auto'
    }
    return () => {
      document.body.style.overflow = 'auto'
    }
  }, [isOpen])

  return (
    <AnimatePresence>
      {isOpen && (
        <>
          {/* Backdrop */}
          <motion.div
            className="fixed inset-0 z-[100] bg-zinc-950/80 backdrop-blur-sm"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            onClick={onClose}
          />
          
          {/* Modal Container */}
          <div 
            className="fixed inset-0 z-[101] overflow-y-auto p-4 sm:p-6 flex items-start sm:items-center justify-center"
            onClick={onClose}
          >
            <motion.div
              onClick={(e) => e.stopPropagation()}
              className="bg-zinc-900 border border-[#2A2A2A] w-full max-w-3xl relative shadow-2xl flex flex-col max-h-[85vh] my-auto"
              initial={{ opacity: 0, scale: 0.95, y: 20 }}
              animate={{ opacity: 1, scale: 1, y: 0 }}
              exit={{ opacity: 0, scale: 0.95, y: 20 }}
              transition={{ type: 'spring', stiffness: 300, damping: 30 }}
            >
              {/* Header */}
              <div className="flex items-center justify-between p-6 sm:p-8 border-b border-[#2A2A2A] flex-shrink-0">
                <h2 className="font-heading font-black text-2xl text-white">{title}</h2>
                <button
                  onClick={onClose}
                  className="w-10 h-10 bg-[#1a1a1a] border border-[#2A2A2A] flex items-center justify-center text-white/50 hover:text-white hover:bg-[#D71920] hover:border-[#D71920] transition-all flex-shrink-0"
                  aria-label="Fechar"
                >
                  <X size={20} />
                </button>
              </div>

              {/* Scrollable Content */}
              <div 
                className="p-6 sm:p-8 overflow-y-auto flex-1 font-body text-white/70 text-sm leading-relaxed space-y-6"
                data-lenis-prevent="true"
              >
                {children}
              </div>
            </motion.div>
          </div>
        </>
      )}
    </AnimatePresence>
  )
}
