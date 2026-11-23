import { createContext, useContext, useState, useEffect, useMemo, useCallback } from 'react'

interface ThemeContextType {
  isDark: boolean
  toggleTheme: () => void
}

const ThemeContext = createContext<ThemeContextType>({ isDark: false, toggleTheme: () => {} })

export function ThemeProvider({ children }: { children: React.ReactNode }) {
  const [isDark, setIsDark] = useState(() => {
    const saved = localStorage.getItem('theme')
    return saved ? saved === 'dark' : window.matchMedia('(prefers-color-scheme: dark)').matches
  })
  
  useEffect(() => {
    document.documentElement.classList.add('theme-transition')
    document.documentElement.classList.toggle('dark', isDark)
    localStorage.setItem('theme', isDark ? 'dark' : 'light')
    const timer = setTimeout(() => document.documentElement.classList.remove('theme-transition'), 300)
    return () => clearTimeout(timer)
  }, [isDark])
  
  const toggleTheme = useCallback(() => setIsDark(prev => !prev), [])
  
  const value = useMemo(() => ({ isDark, toggleTheme }), [isDark, toggleTheme])
  
  return <ThemeContext.Provider value={value}>{children}</ThemeContext.Provider>
}

export const useTheme = () => useContext(ThemeContext)
