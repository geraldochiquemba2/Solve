import { useEffect } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import { X } from 'lucide-react'
import ContactForm from './ContactForm'

interface FormModalProps {
  isOpen: boolean
  onClose: () => void
}

export default function FormModal({ isOpen, onClose }: FormModalProps) {
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
            data-lenis-prevent="true"
          >
            <motion.div
              onClick={(e) => e.stopPropagation()}
              className="bg-[#111111] border border-[#2A2A2A] p-6 sm:p-8 w-full max-w-xl relative shadow-2xl my-auto"
              initial={{ opacity: 0, scale: 0.95, y: 20 }}
              animate={{ opacity: 1, scale: 1, y: 0 }}
              exit={{ opacity: 0, scale: 0.95, y: 20 }}
              transition={{ type: 'spring', stiffness: 300, damping: 30 }}
            >
              {/* Close Button */}
              <button
                onClick={onClose}
                className="absolute top-4 right-4 sm:top-6 sm:right-6 w-10 h-10 bg-[#1a1a1a] border border-[#2A2A2A] flex items-center justify-center text-white/50 hover:text-white hover:bg-[#D71920] hover:border-[#D71920] transition-all"
                aria-label="Fechar Modal"
              >
                <X size={20} />
              </button>

              <ContactForm />
            </motion.div>
          </div>
        </>
      )}
    </AnimatePresence>
  )
}
