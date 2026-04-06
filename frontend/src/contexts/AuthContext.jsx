import { createContext, useContext, useEffect, useState } from 'react'
import { supabase } from '../lib/supabase'

const AuthContext = createContext({})

export function AuthProvider({ children }) {
  const [user, setUser] = useState(null)
  const [profile, setProfile] = useState(null)
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    // Safety timeout — if auth takes longer than 5s (e.g. Web Locks hang), proceed without auth
    const authTimeout = setTimeout(() => {
      setLoading(false)
    }, 5000)

    // Get initial session
    supabase.auth.getSession().then(({ data: { session } }) => {
      clearTimeout(authTimeout)
      setUser(session?.user ?? null)
      if (session?.user) fetchProfile(session.user.id)
      else setLoading(false)
    }).catch(() => {
      clearTimeout(authTimeout)
      setLoading(false)
    })

    // Listen for auth changes (login, logout, token refresh)
    const { data: { subscription } } = supabase.auth.onAuthStateChange(
      async (event, session) => {
        setUser(session?.user ?? null)
        if (session?.user) {
          await fetchProfile(session.user.id)
        } else {
          setProfile(null)
          setLoading(false)
        }
      }
    )

    return () => {
      clearTimeout(authTimeout)
      subscription.unsubscribe()
    }
  }, [])

  async function fetchProfile(userId) {
    try {
      const { data, error } = await supabase
        .from('user_profiles')
        .select('*')
        .eq('id', userId)
        .single()

      if (error && error.code === 'PGRST116') {
        // No profile yet — user just signed up, needs onboarding
        setProfile(null)
      } else if (data) {
        setProfile(data)
      }
    } catch (err) {
      console.warn('Failed to fetch profile:', err)
    } finally {
      setLoading(false)
    }
  }

  async function signUp(email, password) {
    const { data, error } = await supabase.auth.signUp({ email, password })
    return { data, error }
  }

  async function signIn(email, password) {
    const { data, error } = await supabase.auth.signInWithPassword({ email, password })
    return { data, error }
  }

  async function signInWithGoogle() {
    const { data, error } = await supabase.auth.signInWithOAuth({
      provider: 'google',
      options: {
        redirectTo: window.location.origin,
      },
    })
    return { data, error }
  }

  async function signOut() {
    // Always clear local state immediately so the UI responds
    setUser(null)
    setProfile(null)
    try {
      await supabase.auth.signOut()
    } catch (err) {
      console.warn('Supabase signOut failed:', err)
    }
    return { error: null }
  }

  async function createProfile(profileData) {
    const { data, error } = await supabase
      .from('user_profiles')
      .insert({
        id: user.id,
        email: user.email,
        ...profileData,
      })
      .select()
      .single()

    if (!error && data) {
      setProfile(data)
    }
    return { data, error }
  }

  async function createCoachProfile(coachData) {
    const { data, error } = await supabase
      .from('coach_profiles')
      .insert({
        id: user.id,
        ...coachData,
      })
      .select()
      .single()
    return { data, error }
  }

  async function createAthleteProfile(athleteData) {
    const { data, error } = await supabase
      .from('athlete_profiles')
      .insert({
        id: user.id,
        ...athleteData,
      })
      .select()
      .single()
    return { data, error }
  }

  const value = {
    user,
    profile,
    loading,
    signUp,
    signIn,
    signInWithGoogle,
    signOut,
    createProfile,
    createCoachProfile,
    createAthleteProfile,
    refreshProfile: () => user && fetchProfile(user.id),
  }

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>
}

export const useAuth = () => useContext(AuthContext)
