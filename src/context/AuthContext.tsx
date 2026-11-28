import { createContext, useContext, useState, useEffect, type ReactNode } from 'react'

export interface AuthUser {
  email: string
  name: string
  role: string
  loginTime: string
}

interface AuthContextType {
  user: AuthUser | null
  isAuthenticated: boolean
  isLoading: boolean
  login: (email: string, password: string) => Promise<boolean>
  logout: () => void
}

const AUTH_STORAGE_KEY = 'smartlock_auth_user_session'
const VALID_EMAIL = 'admin@walnutmedical.in'
const VALID_PASSWORD = 'Walnut@2026'

const AuthContext = createContext<AuthContextType | undefined>(undefined)

export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<AuthUser | null>(() => {
    try {
      const stored = localStorage.getItem(AUTH_STORAGE_KEY)
      if (stored) {
        const parsed = JSON.parse(stored)
        if (parsed && parsed.email?.toLowerCase() === VALID_EMAIL) {
          return parsed
        }
      }
    } catch {
      // storage unavailable
    }
    return null
  })
  const [isLoading, setIsLoading] = useState(false)

  const login = async (emailInput: string, passwordInput: string): Promise<boolean> => {
    setIsLoading(true)
    const cleanEmail = emailInput.trim().toLowerCase()
    const cleanPassword = passwordInput.trim()

    // Artificial short delay for realistic security verification feeling
    await new Promise((r) => setTimeout(r, 400))

    if (cleanEmail === VALID_EMAIL && cleanPassword === VALID_PASSWORD) {
      const authUser: AuthUser = {
        email: VALID_EMAIL,
        name: 'Walnut Administrator',
        role: 'Admin',
        loginTime: new Date().toISOString(),
      }
      try {
        localStorage.setItem(AUTH_STORAGE_KEY, JSON.stringify(authUser))
      } catch {
        // storage unavailable
      }
      setUser(authUser)
      setIsLoading(false)
      return true
    }

    setIsLoading(false)
    throw new Error('Invalid User ID or Password. Access denied.')
  }

  const logout = () => {
    try {
      localStorage.removeItem(AUTH_STORAGE_KEY)
    } catch {
      // storage unavailable
    }
    setUser(null)
  }

  return (
    <AuthContext.Provider
      value={{
        user,
        isAuthenticated: !!user,
        isLoading,
        login,
        logout,
      }}
    >
      {children}
    </AuthContext.Provider>
  )
}

export function useAuth() {
  const context = useContext(AuthContext)
  if (!context) {
    throw new Error('useAuth must be used within an AuthProvider')
  }
  return context
}
