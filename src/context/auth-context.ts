import { createContext } from 'react'
import type { LoginPayload, RegisterPayload, User } from '../models'

export interface AuthContextValue {
  user: User | null
  token: string | null
  isAuthenticated: boolean
  isSuperadmin: boolean
  /** `true` mientras se restaura la sesion guardada al arrancar la app. */
  isRestoring: boolean
  login: (payload: LoginPayload) => Promise<void>
  register: (payload: RegisterPayload) => Promise<void>
  logout: () => void
}

export const AuthContext = createContext<AuthContextValue | null>(null)
