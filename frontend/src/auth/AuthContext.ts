import { createContext, useContext } from 'react'
import type { UserProfile } from './api'

export type AuthSession = {
  user: UserProfile
  update: (user: UserProfile) => void
  clear: () => void
}

export const AuthContext = createContext<AuthSession | null>(null)
export const useAuth = () => useContext(AuthContext)
