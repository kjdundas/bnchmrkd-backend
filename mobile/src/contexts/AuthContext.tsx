import React, { createContext, useContext, useEffect, useState } from 'react'
import { supabase, selectFrom, insertInto, updateIn, setCachedToken } from '../lib/supabase'
import type { Session, User } from '@supabase/supabase-js'

// user_profiles table — matches web app structure
interface UserProfile {
  id: string
  email?: string
  account_type: 'athlete' | 'coach'
  full_name?: string
  date_of_birth?: string
  gender?: string
  country?: string
  // Convenience aliases used throughout the mobile app
  dob?: string
  sex?: string
  club?: string
  primary_discipline?: string
  height_cm?: number
  weight_kg?: number
  wa_url?: string
  role: 'athlete' | 'coach'  // Computed from account_type
  created_at?: string
}

interface AuthState {
  session: Session | null
  user: User | null
  profile: UserProfile | null
  loading: boolean
  signIn: (email: string, password: string) => Promise<{ error: any }>
  signUp: (email: string, password: string, fullName: string, role?: 'athlete' | 'coach') => Promise<{ error: any }>
  signOut: () => Promise<void>
  refreshProfile: () => Promise<void>
}

const AuthContext = createContext<AuthState | undefined>(undefined)

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const [session, setSession] = useState<Session | null>(null)
  const [profile, setProfile] = useState<UserProfile | null>(null)
  const [loading, setLoading] = useState(true)

  // Fetch user profile — tries user_profiles first (web's table),
  // falls back to athlete_profiles for legacy compatibility
  async function fetchProfile(userId: string, currentSession?: Session | null) {
    try {
      // Try user_profiles first (the table the web app uses)
      const userRows = await selectFrom('user_profiles', {
        filter: `id=eq.${userId}`,
        limit: '1',
      }).catch(() => [])

      if (userRows && userRows.length > 0) {
        const p = userRows[0]
        // Normalize: map account_type → role for the mobile app
        p.role = p.account_type || 'athlete'
        // Map date_of_birth → dob, gender → sex for consistency
        if (p.date_of_birth && !p.dob) p.dob = p.date_of_birth
        if (p.gender && !p.sex) {
          p.sex = p.gender === 'Female' ? 'F' : p.gender === 'Male' ? 'M' : p.gender
        }
        setProfile(p)
        return
      }

      // Fallback: try athlete_profiles
      const athleteRows = await selectFrom('athlete_profiles', {
        filter: `id=eq.${userId}`,
        limit: '1',
      }).catch(() => [])

      if (athleteRows && athleteRows.length > 0) {
        const p = athleteRows[0]
        if (!p.role) p.role = 'athlete'
        setProfile(p)
        return
      }

      // No profile found at all — check auth metadata for role
      // and create a user_profiles row
      const authRole = currentSession?.user?.user_metadata?.role || 'athlete'
      const authName = currentSession?.user?.user_metadata?.full_name || ''
      const authEmail = currentSession?.user?.email || ''
      try {
        await insertInto('user_profiles', {
          id: userId,
          email: authEmail,
          account_type: authRole,
          full_name: authName,
        })
        setProfile({
          id: userId,
          email: authEmail,
          account_type: authRole,
          full_name: authName,
          role: authRole,
        } as UserProfile)
      } catch (insertErr) {
        // Insert might fail if trigger already created a row — try fetching again
        const retry = await selectFrom('user_profiles', {
          filter: `id=eq.${userId}`,
          limit: '1',
        }).catch(() => [])
        if (retry && retry.length > 0) {
          const p = retry[0]
          p.role = p.account_type || authRole
          // If the trigger created it with wrong account_type, fix it
          if (p.account_type !== authRole) {
            await updateIn('user_profiles', `id=eq.${userId}`, { account_type: authRole }).catch(() => {})
            p.account_type = authRole
            p.role = authRole
          }
          setProfile(p)
        } else {
          setProfile(null)
        }
      }
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
        if (s?.user) fetchProfile(s.user.id, s).finally(() => { clearTimeout(timeout); setLoading(false) })
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
        if (s?.user) await fetchProfile(s.user.id, s)
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

  const signUp = async (email: string, password: string, fullName: string, role: 'athlete' | 'coach' = 'athlete') => {
    const { error, data } = await supabase.auth.signUp({
      email,
      password,
      options: { data: { full_name: fullName, role } },
    })
    return { error }
  }

  const signOut = async () => {
    await supabase.auth.signOut()
    setProfile(null)
  }

  const refreshProfile = async () => {
    if (session?.user) await fetchProfile(session.user.id, session)
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
