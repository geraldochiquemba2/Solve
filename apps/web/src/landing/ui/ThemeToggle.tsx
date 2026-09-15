import { Sun, Moon, Monitor } from 'lucide-react'
import { useTheme } from '../context/ThemeContext'
import { useState, useRef, useEffect } from 'react'
import { AnimatePresence, motion } from 'framer-motion'

export default function ThemeToggle() {
  const { theme, setTheme, isDark } = useTheme()
  const [isOpen, setIsOpen] = useState(false)
  const menuRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (menuRef.current && !menuRef.current.contains(event.target as Node)) {
        setIsOpen(false)
      }
    }
    document.addEventListener('mousedown', handleClickOutside)
    return () => document.removeEventListener('mousedown', handleClickOutside)
  }, [])

  const options: { label: string; value: typeof theme; icon: typeof Sun }[] = [
    { label: 'Claro', value: 'light', icon: Sun },
    { label: 'Escuro', value: 'dark', icon: Moon },
    { label: 'Sistema', value: 'system', icon: Monitor },
  ]

  return (
    <div className="relative" ref={menuRef}>
      <button
        onClick={() => setIsOpen(prev => !prev)}
        className="w-10 h-10 flex items-center justify-center rounded-full transition-colors text-zinc-700 dark:text-zinc-200 hover:bg-zinc-100 dark:hover:bg-zinc-800"
        aria-label="Alternar tema"
        title={isDark ? 'Modo escuro ativo' : 'Modo claro ativo'}
      >
        <AnimatePresence mode="wait" initial={false}>
          <motion.div
            key={isDark ? 'moon' : 'sun'}
            initial={{ rotate: -30, opacity: 0 }}
            animate={{ rotate: 0, opacity: 1 }}
            exit={{ rotate: 30, opacity: 0 }}
            transition={{ duration: 0.2 }}
          >
            {isDark ? <Moon size={20} /> : <Sun size={20} />}
          </motion.div>
        </AnimatePresence>
      </button>

      <AnimatePresence>
        {isOpen && (
          <motion.div
            initial={{ opacity: 0, y: 8, scale: 0.95 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, y: 8, scale: 0.95 }}
            transition={{ duration: 0.15 }}
            className="absolute right-0 mt-2 w-38 bg-white dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-700 shadow-2xl rounded-[7px] py-1.5 z-[100] overflow-hidden"
            style={{ minWidth: '9rem' }}
          >
            {options.map(({ label, value, icon: Icon }) => (
              <button
                key={value}
                onClick={() => { setTheme(value); setIsOpen(false) }}
                className={`w-full px-4 py-2.5 flex items-center gap-3 text-sm transition-colors ${
                  theme === value
                    ? 'text-[#D71920] font-bold bg-red-50 dark:bg-red-950/30'
                    : 'text-zinc-600 dark:text-zinc-300 hover:bg-zinc-50 dark:hover:bg-zinc-800'
                }`}
              >
                <Icon size={15} />
                {label}
                {theme === value && <span className="ml-auto w-1.5 h-1.5 rounded-full bg-[#D71920]" />}
              </button>
            ))}
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  )
}
