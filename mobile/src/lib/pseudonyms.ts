// ═══════════════════════════════════════════════════════════════════════
// NAMES DO NOT LEAVE THE DEVICE.
//
// The assistant and the program generator both post an athlete's context to
// our backend, which forwards it to OpenAI. That context carried the
// athlete's REAL NAME — alongside their age, their biological maturity
// estimate, their physical test scores and their competition history. For a
// coach it carried the whole squad at once: several named minors, most of
// them children, in a single request to a third-party US provider.
//
// None of it is needed. The model does not need to know she is called Amara
// Nwosu to write her a javelin block; it needs her event, her age, her
// maturity stage and her numbers. The name is the one field in the payload
// that turns a row of training data into an identified child.
//
// OpenAI's own under-18 API guidance is explicit that developers should not
// process personal data of children under 13 — or the local age of digital
// consent, 16 across much of the EU — without zero data retention enabled,
// which is opt-in and which we do not have. Removing the identifier does not
// make that guidance go away, but it changes what is at stake if anything
// ever goes wrong at the other end, and it is a change we can make today.
//
// ── Why tokens rather than deletion ────────────────────────────────
// A coach asking "who is improving and who has stalled?" needs an answer
// that names people. So each name is swapped for a stable token on the way
// out — Athlete-1, Athlete-2 — and the model's answer is put back together
// on the device, where the real names never left. The coach reads exactly
// what they would have read before. OpenAI sees a numbered list.
//
// The map lives for one request and is never stored.
//
// ── Why it lives here and not at the call sites ────────────────────
// Because there are two call sites today and there will be more, and a rule
// enforced by remembering is not a rule. lib/api.ts applies this to
// everything it sends; a new feature that posts context gets it for free.
// ═══════════════════════════════════════════════════════════════════════

/** token → the real name it stands for. One request's worth. */
export type NameMap = Map<string, string>

/**
 * Keys whose VALUES are a person's name somewhere in a context payload.
 *
 * Deliberately a list of exact keys rather than a fuzzy match: `name` on an
 * exercise ("Back squat") and `name` on an athlete are the same word, so the
 * walk below only treats a key as a name when it sits on an object that also
 * looks like a person — see `looksLikePerson`.
 */
const NAME_KEYS = new Set([
  'name', 'full_name', 'athlete_name', 'athlete', 'counterparty_name', 'display_name',
])

/** Fields that only ever appear on an athlete, never on an exercise or a block. */
const PERSON_MARKERS = [
  'age', 'dob', 'date_of_birth', 'maturity', 'discipline', 'events',
  'results', 'dna', 'pb', 'has_account', 'gender', 'sex',
]

function looksLikePerson(obj: Record<string, any>): boolean {
  return PERSON_MARKERS.some((k) => k in obj)
}

const TOKEN = /\bAthlete-(\d+)\b/g

/**
 * Replace every athlete name in a context payload with a stable token.
 *
 * Returns a NEW object — the caller's context is not mutated, because it is
 * usually a memoised value that the screen is still rendering from.
 */
export function pseudonymise<T>(context: T): { context: T; names: NameMap } {
  const names: NameMap = new Map()
  const byName = new Map<string, string>()
  let n = 0

  const tokenFor = (real: string): string => {
    const key = real.trim()
    const existing = byName.get(key)
    if (existing) return existing
    n += 1
    const token = `Athlete-${n}`
    byName.set(key, token)
    names.set(token, key)
    return token
  }

  const walk = (value: any): any => {
    if (Array.isArray(value)) return value.map(walk)
    if (value == null || typeof value !== 'object') return value
    const isPerson = looksLikePerson(value)
    const out: Record<string, any> = {}
    for (const [k, v] of Object.entries(value)) {
      if (isPerson && NAME_KEYS.has(k) && typeof v === 'string' && v.trim()) {
        out[k] = tokenFor(v)
      } else {
        out[k] = walk(v)
      }
    }
    return out
  }

  return { context: walk(context) as T, names }
}

/** Put the real names back, on the device, after the answer comes home. */
export function rehydrate(text: string, names: NameMap): string {
  if (!text || names.size === 0) return text
  return text.replace(TOKEN, (match) => names.get(match) || match)
}

/**
 * The same, through a whole returned object — a generated program mentions
 * the athlete inside its summary, its rationale and its session notes, and
 * every one of those is a string the model wrote.
 */
export function rehydrateDeep<T>(value: T, names: NameMap): T {
  if (names.size === 0) return value
  const walk = (v: any): any => {
    if (typeof v === 'string') return rehydrate(v, names)
    if (Array.isArray(v)) return v.map(walk)
    if (v && typeof v === 'object') {
      const out: Record<string, any> = {}
      for (const [k, val] of Object.entries(v)) out[k] = walk(val)
      return out
    }
    return v
  }
  return walk(value) as T
}
