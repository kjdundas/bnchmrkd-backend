import React, { createContext, useContext, useEffect, useState } from 'react'
import { supabase, selectFrom, setCachedToken } from '../lib/supabase'
import type { Session, User } from '@supabase/supabase-js'

interface AthleteProfile {
  id: string
  user_id: string
  full_name: string
  club?: string
  country?: string
  height_cm?: number
  weight_kg?: number
  wa_url?: string
  role: 'athlete' | 'coach'
  created_at: string
}

interface AuthState {
  session: Session | null
  user: User | null
  profile: AthleteProfile | null
  loading: boolean
  signIn: (email: string, password: string) => Promise<{ error: any }>
  signUp: (email: string, password: string, fullName: string) => Promise<{ error: any }>
  signOut: () => Promise<void>
  refreshProfile: () => Promise<void>
}

const AuthContext = createContext<AuthState | undefined>(undefined)

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const [session, setSession] = useState<Session | null>(null)
  const [profile, setProfile] = useState<AthleteProfile | null>(null)
  const [loading, setLoading] = useState(true)

  // Fetch athlete_profile for current user
  async function fetchProfile(userId: string) {
    try {
      const rows = await selectFrom('athlete_profiles', {
        filter: `id=eq.${userId}`,
        limit: '1',
      })
      if (rows.length > 0) setProfile(rows[0])
      else setProfile(null)
    } catch (e) {
      console.warn('fetchProfile error:', e)
      setProfile(null)
    }
  }

  useEffect(() => {
    // Safety timeout: never stay on splash more than 3s
    const timeout = setTimeout(() => setLoading(false), 3000)

    // Get initial session
    supabase.auth
      .getSession()
      .then(({ data: { session: s } }) => {
        setSession(s)
        setCachedToken(s?.access_token ?? null)
        if (s?.user) fetchProfile(s.user.id).finally(() => { clearTimeout(timeout); setLoading(false) })
        else { clearTimeout(timeout); setLoading(false) }
      })
      .catch((err) => {
        console.warn('Auth getSession error:', err)
        clearTimeout(timeout)
        setLoading(false)
      })

    // Listen for auth changes — also cache the token for REST helpers
    const { data: { subscription } } = supabase.auth.onAuthStateChange(
      async (_event, s) => {
        setSession(s)
        setCachedToken(s?.access_token ?? null)
        if (s?.user) await fetchProfile(s.user.id)
        else setProfile(null)
      },
    )
    return () => {
      clearTimeout(timeout)
      subscription.unsubscribe()
    }
  }, [])

  const signIn = async (email: string, password: string) => {
    const { error } = await supabase.auth.signInWithPassword({ email, password })
    return { error }
  }

  const signUp = async (email: string, password: string, fullName: string) => {
    const { error, data } = await supabase.auth.signUp({
      email,
      password,
      options: { data: { full_name: fullName } },
    })
    return { error }
  }

  const signOut = async () => {
    await supabase.auth.signOut()
    setProfile(null)
  }

  const refreshProfile = async () => {
    if (session?.user) await fetchProfile(session.user.id)
  }

  return (
    <AuthContext.Provider
      value={{
        session,
        user: session?.user ?? null,
        profile,
        loading,
        signIn,
        signUp,
        signOut,
        refreshProfile,
      }}
    >
      {children}
    </AuthContext.Provider>
  )
}

export function useAuth() {
  const ctx = useContext(AuthContext)
  if (!ctx) throw new Error('useAuth must be used within AuthProvider')
  return ctx
}
