import { createContext, useContext, useState, useEffect, ReactNode } from 'react'

export type UserRole = 'client' | 'admin'

export interface AuthUser {
  id: string
  name: string
  email: string
  phone?: string
  address?: string
  nif?: string
  avatar?: string
  role: UserRole
  createdAt: string
}

interface AuthContextType {
  user: AuthUser | null
  isAuthenticated: boolean
  isAdmin: boolean
  loading: boolean
  login: (email: string, password: string) => Promise<{ success: boolean; error?: string; user?: AuthUser }>
  register: (name: string, email: string, password: string) => Promise<{ success: boolean; error?: string; user?: AuthUser }>
  logout: () => void
  updateProfile: (data: Partial<AuthUser>) => void
}

const AuthContext = createContext<AuthContextType | undefined>(undefined)

const USERS_KEY = 'samora_users'
const SESSION_KEY = 'samora_user'

const DEFAULT_ADMIN: AuthUser & { password: string } = {
  id: 'admin-001',
  name: 'Administrador',
  email: 'admin',
  phone: '999999999',
  role: 'admin',
  createdAt: new Date().toISOString(),
  password: '1234567890',
}

function getStoredUsers(): (AuthUser & { password: string })[] {
  try {
    const raw = localStorage.getItem(USERS_KEY)
    return raw ? JSON.parse(raw) : []
  } catch {
    return []
  }
}

function saveUsers(users: (AuthUser & { password: string })[]) {
  localStorage.setItem(USERS_KEY, JSON.stringify(users))
}

function seedAdmin() {
  const users = getStoredUsers()
  const adminIdx = users.findIndex(u => u.email === DEFAULT_ADMIN.email)
  if (adminIdx === -1) {
    // Admin doesn't exist — add it
    saveUsers([DEFAULT_ADMIN, ...users])
  } else {
    // Admin exists — make sure phone and password are up to date
    const updated = { ...users[adminIdx], phone: DEFAULT_ADMIN.phone, password: DEFAULT_ADMIN.password }
    users[adminIdx] = updated
    saveUsers(users)
  }
}

export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<AuthUser | null>(null)
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    seedAdmin()
    try {
      const raw = localStorage.getItem(SESSION_KEY)
      if (raw) {
        const parsed = JSON.parse(raw) as AuthUser
        setUser(parsed)
      }
    } catch {
      // ignore
    }
    setLoading(false)
  }, [])

  const login = async (identifier: string, password: string): Promise<{ success: boolean; error?: string; user?: AuthUser }> => {
    // Try backend API first
    try {
      const isEmail = identifier.includes('@')
      const body: Record<string, string> = { password }
      if (isEmail) body.email = identifier
      else body.phone = identifier

      const apiUrl = import.meta.env.VITE_API_URL || window.location.origin
      const response = await fetch(`${apiUrl}/api/v1/auth/login`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(body),
        credentials: 'include',
      })

      if (response.ok) {
        const data = await response.json()
        const apiUser: AuthUser = {
          id: data.user?.id ?? '',
          name: data.user?.name ?? '',
          email: data.user?.email ?? '',
          phone: identifier,
          role: data.user?.role === 'administrador' ? 'admin' : 'client',
          createdAt: new Date().toISOString(),
        }
        setUser(apiUser)
        localStorage.setItem(SESSION_KEY, JSON.stringify(apiUser))
        // Store JWT token for CRM use
        if (data.token) {
          localStorage.setItem('token', data.token)
        }
        return { success: true, user: apiUser }
      } else {
        const err = await response.json().catch(() => ({}))
        // Fall through to localStorage check
      }
    } catch {
      // API unavailable — fall through to localStorage
    }

    // Fallback: localStorage
    const users = getStoredUsers()
    const found = users.find(u =>
      (u.email.toLowerCase() === identifier.toLowerCase() || u.phone === identifier) && u.password === password
    )
    if (!found) {
      return { success: false, error: 'Email, telefone ou palavra-passe incorretos.' }
    }
    const { password: _pw, ...userData } = found
    setUser(userData)
    localStorage.setItem(SESSION_KEY, JSON.stringify(userData))
    return { success: true, user: userData }
  }

  const register = async (name: string, email: string, password: string): Promise<{ success: boolean; error?: string; user?: AuthUser }> => {
    const users = getStoredUsers()
    const exists = users.find(u => u.email.toLowerCase() === email.toLowerCase())
    if (exists) {
      return { success: false, error: 'Este email já está registado.' }
    }
    const newUser: AuthUser & { password: string } = {
      id: `user-${Date.now()}`,
      name,
      email,
      role: 'client',
      createdAt: new Date().toISOString(),
      password,
    }
    saveUsers([...users, newUser])
    const { password: _pw, ...userData } = newUser
    setUser(userData)
    localStorage.setItem(SESSION_KEY, JSON.stringify(userData))
    return { success: true, user: userData }
  }

  const logout = () => {
    setUser(null)
    localStorage.removeItem(SESSION_KEY)
  }

  const updateProfile = (data: Partial<AuthUser>) => {
    if (!user) return
    const updated = { ...user, ...data }
    setUser(updated)
    localStorage.setItem(SESSION_KEY, JSON.stringify(updated))
    // Update in users list too
    const users = getStoredUsers()
    const idx = users.findIndex(u => u.id === user.id)
    if (idx !== -1) {
      users[idx] = { ...users[idx], ...data }
      saveUsers(users)
    }
  }

  return (
    <AuthContext.Provider value={{
      user,
      isAuthenticated: !!user,
      isAdmin: user?.role === 'admin',
      loading,
      login,
      register,
      logout,
      updateProfile,
    }}>
      {children}
    </AuthContext.Provider>
  )
}

export function useAuth() {
  const ctx = useContext(AuthContext)
  if (!ctx) throw new Error('useAuth must be used within AuthProvider')
  return ctx
}
