import React, { createContext, useContext, useEffect, useState } from 'react'
import AsyncStorage from '@react-native-async-storage/async-storage'
import { supabase, selectFrom, insertInto, updateIn, setCachedToken, getCachedToken, SUPABASE_URL } from '../lib/supabase'

// ── The session, recovered without getSession() ──────────────────────
//
// getSession() can hang indefinitely on the gotrue Web Locks bug — that is
// why the REST helpers cache the token instead of calling it. The startup
// path below still called it, guarded by a 3s timeout that gave up and let
// the app render. When it hung, the timeout fired, the app came up looking
// signed in, and setCachedToken was NEVER called: every read then ran as
// anon and returned [] with a 200, and every write returned 401 into a
// silent catch. A check-in buzzed and did nothing.
//
// So the timeout no longer just gives up. It reads the persisted session
// straight out of storage — the same place supabase-js keeps it — and
// caches the token itself. An expired one is treated as absent, which is
// the honest answer: writes then fail loudly with 'you're signed out'
// rather than quietly.
const SESSION_KEY = `sb-${SUPABASE_URL.split('//')[1].split('.')[0]}-auth-token`

async function tokenFromStorage(): Promise<string | null> {
  try {
    const raw = await AsyncStorage.getItem(SESSION_KEY)
    if (!raw) return null
    const p = JSON.parse(raw)
    const sess = p?.currentSession ?? p
    const token = sess?.access_token ?? null
    const expiresAt = Number(sess?.expires_at ?? 0)
    // 30s of slack so a token about to expire is not treated as usable.
    if (!token || (expiresAt && Date.now() / 1000 > expiresAt - 30)) return null
    return token
  } catch {
    return null
  }
}
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
  signUp: (
    email: string, password: string, fullName: string,
    role?: 'athlete' | 'coach',
    extra?: { date_of_birth?: string | null; gender?: string | null },
  ) => Promise<{ error: any }>
  signOut: () => Promise<void>
  refreshProfile: () => Promise<void>
}

const AuthContext = createContext<AuthState | undefined>(undefined)

/**
 * One shape for the rest of the app, whichever table or code path produced it.
 *
 * `user_profiles` stores date_of_birth / gender / club_school; every screen
 * reads dob / sex / club. That aliasing used to live inline in ONE of the four
 * branches of fetchProfile, so the legacy-table path and the trigger-retry
 * path both handed back a profile with dob undefined — the app then graded
 * those athletes against Senior standards with no sign anything was wrong.
 */
function normaliseProfile(row: any, fallbackRole: 'athlete' | 'coach' = 'athlete'): UserProfile {
  const p = { ...row }
  p.role = p.account_type || p.role || fallbackRole
  if (!p.dob && p.date_of_birth) p.dob = p.date_of_birth
  if (!p.club && p.club_school) p.club = p.club_school
  if (!p.sex && p.gender) {
    p.sex = p.gender === 'Female' ? 'F' : p.gender === 'Male' ? 'M' : p.gender
  }
  return p as UserProfile
}

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
        if (p.club_school && !p.club) p.club = p.club_school
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
      // Sign-up stashes these on auth metadata, because the profile row is
      // created HERE on first fetch rather than by the sign-up call itself.
      const authMeta: any = currentSession?.user?.user_metadata || {}
      const authDob = authMeta.date_of_birth || null
      const authGender = authMeta.gender || null

      try {
        await insertInto('user_profiles', {
          id: userId,
          email: authEmail,
          account_type: authRole,
          full_name: authName,
          date_of_birth: authDob,
          gender: authGender,
        })
        setProfile(normaliseProfile({
          id: userId,
          email: authEmail,
          account_type: authRole,
          full_name: authName,
          date_of_birth: authDob,
          gender: authGender,
        }, authRole))
      } catch (insertErr) {
        // Insert might fail if trigger already created a row — try fetching again
        const retry = await selectFrom('user_profiles', {
          filter: `id=eq.${userId}`,
          limit: '1',
        }).catch(() => [])
        if (retry && retry.length > 0) {
          const p = retry[0]
          // If the trigger created it with wrong account_type, fix it
          if (p.account_type !== authRole) {
            await updateIn('user_profiles', `id=eq.${userId}`, { account_type: authRole }).catch(() => {})
            p.account_type = authRole
          }
          // A DB trigger creates the row from auth metadata it may not read in
          // full, so back-fill whatever sign-up collected that the row lacks.
          // Without this a signup that raced the trigger lost its date of
          // birth permanently — and this branch also skipped the aliasing
          // below, so dob/sex/club came back undefined even when present.
          const patch: Record<string, any> = {}
          if (!p.date_of_birth && authDob) patch.date_of_birth = authDob
          if (!p.gender && authGender) patch.gender = authGender
          if (!p.full_name && authName) patch.full_name = authName
          if (Object.keys(patch).length) {
            await updateIn('user_profiles', `id=eq.${userId}`, patch).catch(() => {})
            Object.assign(p, patch)
          }
          setProfile(normaliseProfile(p, authRole))
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
    const timeout = setTimeout(async () => {
      // getSession() never came back. Recover the token ourselves rather than
      // rendering a signed-in app with no credentials behind it.
      if (!getCachedToken()) {
        const token = await tokenFromStorage()
        if (token) setCachedToken(token)
      }
      setLoading(false)
    }, 3000)

    // Prime the token from storage straight away. getSession() may resolve
    // late rather than never, and until it does every REST call would run as
    // anon. Whatever getSession() or the auth listener returns overwrites this
    // a moment later.
    tokenFromStorage().then((t) => { if (t && !getCachedToken()) setCachedToken(t) })

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

    // Listen for auth changes — also cache the token for REST helpers.
    //
    // This callback MUST stay synchronous. supabase-js runs it while holding
    // the auth lock, and awaiting inside it deadlocks that lock — the same
    // Web Locks failure that makes getSession() hang. It was `async` and
    // awaited fetchProfile, so after a sign-out/sign-in the lock never
    // cleared, later events stopped arriving, and the cached token silently
    // went stale. Every REST call then fell through to the anon key: reads
    // came back 200-with-nothing, writes came back 401, and the check-in
    // button did nothing at all.
    //
    // So: cache the token first, on the same tick, and push the profile fetch
    // out to a later one where it is free to await whatever it likes.
    const { data: { subscription } } = supabase.auth.onAuthStateChange(
      (_event, s) => {
        setSession(s)
        setCachedToken(s?.access_token ?? null)
        if (s?.user) {
          const uid = s.user.id
          setTimeout(() => { fetchProfile(uid, s) }, 0)
        } else {
          setProfile(null)
        }
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

  const signUp = async (
    email: string,
    password: string,
    fullName: string,
    role: 'athlete' | 'coach' = 'athlete',
    extra?: { date_of_birth?: string | null; gender?: string | null },
  ) => {
    // Everything the profile row needs travels on auth metadata, because the
    // row itself is created later — on the first fetchProfile — and may
    // instead be created by a DB trigger that only sees this metadata.
    const { error } = await supabase.auth.signUp({
      email,
      password,
      options: {
        data: {
          full_name: fullName,
          role,
          date_of_birth: extra?.date_of_birth || null,
          gender: extra?.gender || null,
        },
      },
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
