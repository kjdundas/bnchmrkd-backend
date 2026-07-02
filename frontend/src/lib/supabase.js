import { createClient } from '@supabase/supabase-js'

const supabaseUrl = import.meta.env.VITE_SUPABASE_URL
const supabaseAnonKey = import.meta.env.VITE_SUPABASE_ANON_KEY

if (!supabaseUrl || !supabaseAnonKey) {
  console.error(
    'Missing Supabase environment variables. ' +
    'Make sure VITE_SUPABASE_URL and VITE_SUPABASE_ANON_KEY are set in your .env file.'
  )
}

// ── Web Locks hang fix ──────────────────────────────────────────────────
// gotrue-js serializes auth calls (getSession, signInWithPassword, token
// refresh, onAuthStateChange) behind the browser Web Locks API by default.
// In our setup that lock can deadlock — the promise never resolves and the
// app freezes on a blank screen right after login. We already bypass the
// lock everywhere else by reading the token straight from localStorage
// (see lib/supabaseRest.js). Supplying a no-op lock here makes the auth
// client itself skip navigator.locks entirely, which is the supported
// mitigation for this bug. We only ever run one tab per session for auth,
// so cross-tab lock coordination isn't needed.
const noOpLock = async (_name, _acquireTimeout, fn) => fn()

export const supabase = createClient(supabaseUrl, supabaseAnonKey, {
  auth: {
    lock: noOpLock,
    persistSession: true,
    autoRefreshToken: true,
    detectSessionInUrl: true, // needed for the Google OAuth redirect back to origin
  },
})
