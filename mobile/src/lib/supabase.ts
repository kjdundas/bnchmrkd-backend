import 'react-native-url-polyfill/auto'
import AsyncStorage from '@react-native-async-storage/async-storage'
import { createClient } from '@supabase/supabase-js'

export const SUPABASE_URL = 'https://bmbqjyrhzusidxmfrssi.supabase.co'
export const SUPABASE_ANON_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImJtYnFqeXJoenVzaWR4bWZyc3NpIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzUwMjk4MTcsImV4cCI6MjA5MDYwNTgxN30.0RI3G_fS79-jaK0u5VWUKm3yH2jV5cY9oN6NfzliowI'

export const supabase = createClient(SUPABASE_URL, SUPABASE_ANON_KEY, {
  auth: {
    storage: AsyncStorage,
    autoRefreshToken: true,
    persistSession: true,
    detectSessionInUrl: false,
  },
})

// ── Cached token — avoids supabase.auth.getSession() which hangs ─────
// The gotrue Web Locks bug causes getSession() to freeze indefinitely.
// Instead, we cache the token from onAuthStateChange and read it here.
let _cachedToken: string | null = null

/** Call this from AuthContext whenever the session changes. */
export function setCachedToken(token: string | null) {
  _cachedToken = token
}

/** Read the cached token (for debugging / external use). */
export function getCachedToken() {
  return _cachedToken
}

/**
 * Whether a real user token is cached.
 *
 * This matters more than it looks. `headers()` below falls back to the anon
 * key when there is no user token, and that fallback quietly turns "signed
 * out" into "signed in with no data": RLS filters every table on
 * `auth.uid()`, so a read comes back as `[]` with a 200 and the screen renders
 * its empty state, while a write comes back 401 with nobody listening.
 *
 * Reads keep the fallback — a few tables are legitimately readable anon. Every
 * WRITE now refuses instead, so the failure is loud and says what it is.
 */
export function hasAuth() {
  return !!_cachedToken
}

/** `err.code` on the error thrown when a write is attempted signed out. */
export const SIGNED_OUT = 'SIGNED_OUT'

function requireAuth(where: string) {
  if (_cachedToken) return
  const err: any = new Error(
    "You're signed out, so that couldn't be saved. Sign in and try again.",
  )
  err.code = SIGNED_OUT
  err.where = where
  throw err
}

/**
 * Bearer header for calls to our OWN backend API (Railway), which verifies the
 * Supabase JWT. Mirrors web's supabaseRest.authHeader(). Returns {} when signed
 * out so callers can spread it unconditionally.
 */
export function authHeader(): Record<string, string> {
  return _cachedToken ? { Authorization: `Bearer ${_cachedToken}` } : {}
}

// ── Raw REST helpers (same pattern as web supabaseRest.js) ────────────
// Uses the cached JWT when available so RLS policies work correctly.
// NEVER calls supabase.auth.getSession() — that hangs on Web Locks.
function headers(): Record<string, string> {
  const h: Record<string, string> = {
    apikey: SUPABASE_ANON_KEY,
    Authorization: `Bearer ${_cachedToken || SUPABASE_ANON_KEY}`,
    'Content-Type': 'application/json',
    Prefer: 'return=representation',
  }
  return h
}

export async function selectFrom(table: string, opts: { filter?: string; order?: string; limit?: string } = {}) {
  let url = `${SUPABASE_URL}/rest/v1/${table}?select=*`
  if (opts.filter) url += `&${opts.filter}`
  if (opts.order) url += `&order=${opts.order}`
  if (opts.limit) url += `&limit=${opts.limit}`
  const res = await fetch(url, { headers: headers() })
  if (!res.ok) {
    const body = await res.text().catch(() => '')
    throw new Error(`selectFrom ${table} failed: ${res.status} ${body}`)
  }
  return res.json()
}

export async function insertInto(table: string, data: any) {
  requireAuth(`insertInto ${table}`)
  const res = await fetch(`${SUPABASE_URL}/rest/v1/${table}`, {
    method: 'POST',
    headers: headers(),
    body: JSON.stringify(data),
  })
  if (!res.ok) {
    const body = await res.text().catch(() => '')
    throw new Error(`insertInto ${table} failed: ${res.status} ${body}`)
  }
  const rows = await res.json()
  return Array.isArray(rows) ? rows[0] : rows
}

/**
 * Upsert (insert or merge on primary key / unique constraint).
 * Uses PostgREST's `resolution=merge-duplicates` so a repeat write to the
 * same key updates the existing row instead of erroring.
 */
export async function upsertInto(table: string, data: any, onConflict?: string) {
  requireAuth(`upsertInto ${table}`)
  // PostgREST resolves a conflict against the PRIMARY KEY unless told
  // otherwise. Where the uniqueness lives in a separate unique index — as it
  // does for a logged set, keyed on where the exercise sits — the target has
  // to be named or the upsert inserts a duplicate instead of merging.
  const url = `${SUPABASE_URL}/rest/v1/${table}`
    + (onConflict ? `?on_conflict=${encodeURIComponent(onConflict)}` : '')
  const res = await fetch(url, {
    method: 'POST',
    headers: { ...headers(), Prefer: 'resolution=merge-duplicates,return=representation' },
    body: JSON.stringify(data),
  })
  if (!res.ok) {
    const body = await res.text().catch(() => '')
    throw new Error(`upsertInto ${table} failed: ${res.status} ${body}`)
  }
  const rows = await res.json()
  return Array.isArray(rows) ? rows[0] : rows
}

export async function updateIn(table: string, filter: string, data: any) {
  requireAuth(`updateIn ${table}`)
  const res = await fetch(`${SUPABASE_URL}/rest/v1/${table}?${filter}`, {
    method: 'PATCH',
    headers: headers(),
    body: JSON.stringify(data),
  })
  if (!res.ok) {
    const body = await res.text().catch(() => '')
    throw new Error(`updateIn ${table} failed: ${res.status} ${body}`)
  }
  const rows = await res.json()
  return Array.isArray(rows) ? rows[0] : rows
}

export async function deleteFrom(table: string, filter: string) {
  requireAuth(`deleteFrom ${table}`)
  const res = await fetch(`${SUPABASE_URL}/rest/v1/${table}?${filter}`, {
    method: 'DELETE',
    headers: headers(),
  })
  if (!res.ok) {
    const body = await res.text().catch(() => '')
    throw new Error(`deleteFrom ${table} failed: ${res.status} ${body}`)
  }
  return true
}

/** Call a Postgres function (RPC). Returns the function's result. */
export async function callRpc(fnName: string, args: any = {}) {
  const res = await fetch(`${SUPABASE_URL}/rest/v1/rpc/${fnName}`, {
    method: 'POST',
    headers: headers(),
    body: JSON.stringify(args),
  })
  if (!res.ok) {
    const body = await res.text().catch(() => '')
    throw new Error(`rpc ${fnName} failed: ${res.status} ${body}`)
  }
  return res.json()
}
