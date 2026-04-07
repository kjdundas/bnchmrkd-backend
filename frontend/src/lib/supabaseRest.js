// Raw fetch wrappers for Supabase REST API.
// We bypass supabase-js entirely for data operations because both its query
// builder AND its auth.getSession() can hang on Web Locks issues.
// We read the access token directly from localStorage where supabase-js stores it.

const SUPABASE_URL = import.meta.env.VITE_SUPABASE_URL
const SUPABASE_KEY = import.meta.env.VITE_SUPABASE_ANON_KEY

// Extract the project ref from the URL (e.g. "bmbqjyrhzusidxmfrssi")
const PROJECT_REF = (SUPABASE_URL || '').replace('https://', '').split('.')[0]
const TOKEN_KEY = `sb-${PROJECT_REF}-auth-token`

// Read the access token directly from localStorage — bypasses Web Locks hang
function getTokenFromStorage() {
  try {
    const raw = localStorage.getItem(TOKEN_KEY)
    if (!raw) return null
    const session = JSON.parse(raw)
    return session?.access_token || null
  } catch {
    return null
  }
}

function getAuthHeaders() {
  const token = getTokenFromStorage()
  if (!token) throw new Error('No active session — please sign in again.')
  return {
    'apikey': SUPABASE_KEY,
    'Authorization': `Bearer ${token}`,
    'Content-Type': 'application/json',
  }
}

// Generic fetch with timeout
async function rawFetch(path, options = {}, timeoutMs = 15000) {
  const controller = new AbortController()
  const timer = setTimeout(() => controller.abort(), timeoutMs)
  try {
    const headers = getAuthHeaders()
    const res = await fetch(`${SUPABASE_URL}/rest/v1${path}`, {
      ...options,
      headers: { ...headers, ...(options.headers || {}) },
      signal: controller.signal,
    })
    if (!res.ok) {
      const body = await res.text()
      throw new Error(`Supabase ${res.status}: ${body || res.statusText}`)
    }
    if (res.status === 204) return null
    return await res.json()
  } finally {
    clearTimeout(timer)
  }
}

// SELECT rows from a table with optional filters
export async function selectFrom(table, { filter = '', order = '', limit = '' } = {}) {
  const params = []
  if (filter) params.push(filter)
  if (order) params.push(`order=${order}`)
  if (limit) params.push(`limit=${limit}`)
  const qs = params.length ? `?${params.join('&')}&select=*` : '?select=*'
  return rawFetch(`/${table}${qs}`)
}

// INSERT a row, returning the inserted row
export async function insertInto(table, payload) {
  const data = await rawFetch(`/${table}`, {
    method: 'POST',
    headers: { 'Prefer': 'return=representation' },
    body: JSON.stringify(payload),
  })
  return Array.isArray(data) ? data[0] : data
}

// UPDATE rows matching a filter, returning the updated row(s)
export async function updateIn(table, filter, payload) {
  const data = await rawFetch(`/${table}?${filter}`, {
    method: 'PATCH',
    headers: { 'Prefer': 'return=representation' },
    body: JSON.stringify(payload),
  })
  return Array.isArray(data) ? data[0] : data
}

// DELETE rows matching a filter
export async function deleteFrom(table, filter) {
  return rawFetch(`/${table}?${filter}`, { method: 'DELETE' })
}
