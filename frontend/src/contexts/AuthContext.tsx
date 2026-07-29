import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
  type ReactNode,
} from 'react'
import api, { AUTH_TOKEN_KEY } from '../services/api'

export type AuthUser = { id: number; username: string }

type AuthContextValue = {
  user: AuthUser | null
  token: string | null
  ready: boolean
  login: (username: string, password: string) => Promise<void>
  logout: () => void
}

const AuthContext = createContext<AuthContextValue | null>(null)

function applyAxiosToken(token: string | null) {
  if (token) {
    api.defaults.headers.common.Authorization = `Bearer ${token}`
  } else {
    delete api.defaults.headers.common.Authorization
  }
}

export function AuthProvider({ children }: { children: ReactNode }) {
  const [token, setToken] = useState<string | null>(() => localStorage.getItem(AUTH_TOKEN_KEY))
  const [user, setUser] = useState<AuthUser | null>(null)
  const [ready, setReady] = useState(false)

  useEffect(() => {
    const stored = localStorage.getItem(AUTH_TOKEN_KEY)
    if (!stored) {
      applyAxiosToken(null)
      setReady(true)
      return
    }
    applyAxiosToken(stored)
    setToken(stored)
    api
      .get<AuthUser>('/auth/me')
      .then((res) => setUser(res.data))
      .catch(() => {
        localStorage.removeItem(AUTH_TOKEN_KEY)
        setToken(null)
        applyAxiosToken(null)
      })
      .finally(() => setReady(true))
  }, [])

  const login = useCallback(async (username: string, password: string) => {
    const { data } = await api.post<{ token: string; user: AuthUser }>('/auth/login', {
      username,
      password,
    })
    localStorage.setItem(AUTH_TOKEN_KEY, data.token)
    applyAxiosToken(data.token)
    setToken(data.token)
    setUser(data.user)
  }, [])

  const logout = useCallback(() => {
    localStorage.removeItem(AUTH_TOKEN_KEY)
    applyAxiosToken(null)
    setToken(null)
    setUser(null)
  }, [])

  const value = useMemo(
    () => ({ user, token, ready, login, logout }),
    [user, token, ready, login, logout]
  )

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>
}

export function useAuth() {
  const ctx = useContext(AuthContext)
  if (!ctx) throw new Error('useAuth debe usarse dentro de AuthProvider')
  return ctx
}
