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

export async function updateIn(table: string, filter: string, data: any) {
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
