import { createContext, useContext, useEffect, useState, ReactNode } from 'react'

type Theme = 'light' | 'dark' | 'system'

interface ThemeContextProps {
  theme: Theme
  setTheme: (theme: Theme) => void
  isDark: boolean
}

const ThemeContext = createContext<ThemeContextProps | undefined>(undefined)

function getSystemIsDark() {
  return window.matchMedia('(prefers-color-scheme: dark)').matches
}

function getEffectiveIsDark(theme: Theme) {
  if (theme === 'dark') return true
  if (theme === 'light') return false
  return getSystemIsDark()
}

export function ThemeProvider({ children }: { children: ReactNode }) {
  const [theme, setThemeState] = useState<Theme>(() => {
    try {
      const saved = localStorage.getItem('bs-theme') as Theme
      if (saved === 'light' || saved === 'dark' || saved === 'system') return saved
    } catch {}
    return 'light' // default to light
  })

  const [isDark, setIsDark] = useState(() => getEffectiveIsDark(theme))

  const setTheme = (newTheme: Theme) => {
    setThemeState(newTheme)
    try { localStorage.setItem('bs-theme', newTheme) } catch {}
  }

  useEffect(() => {
    const effectiveDark = getEffectiveIsDark(theme)
    setIsDark(effectiveDark)

    // Apply to <html> for Tailwind dark: classes
    const html = document.documentElement
    if (effectiveDark) {
      html.classList.add('dark')
      html.classList.remove('light')
    } else {
      html.classList.remove('dark')
      html.classList.add('light')
    }

    // Listen to system changes only when in 'system' mode
    if (theme === 'system') {
      const mq = window.matchMedia('(prefers-color-scheme: dark)')
      const handler = (e: MediaQueryListEvent) => {
        setIsDark(e.matches)
        if (e.matches) {
          html.classList.add('dark')
          html.classList.remove('light')
        } else {
          html.classList.remove('dark')
          html.classList.add('light')
        }
      }
      mq.addEventListener('change', handler)
      return () => mq.removeEventListener('change', handler)
    }
    return undefined
  }, [theme])

  return (
    <ThemeContext.Provider value={{ theme, setTheme, isDark }}>
      {children}
    </ThemeContext.Provider>
  )
}

export function useTheme() {
  const ctx = useContext(ThemeContext)
  if (!ctx) throw new Error('useTheme must be used within ThemeProvider')
  return ctx
}
