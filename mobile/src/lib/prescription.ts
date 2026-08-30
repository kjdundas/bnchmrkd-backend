// ═══════════════════════════════════════════════════════════════════════
// READING A PRESCRIPTION — turning "4 × 5" into rows you can log against.
//
// Written against what the generator actually produces, not invented
// examples. Real output looks like:
//
//   4 × 5        gym       four sets of five
//   3 × 45 s     gym       three sets, forty-five seconds each (a plank)
//   4 × 30 m     track     four sprints of thirty metres
//   3 × 4 × 30 m track     three sets of four thirty-metre runs
//   6 reps       technical six block starts
//   10 min       mobility  a warm-up, one thing, no sets
//
// Note the unicode × (U+00D7) and the space before the unit — both come out
// of the model that way, and a parser that only handles "4x5" would silently
// fail on every single real prescription.
//
// ── WHAT A "ROW" IS ────────────────────────────────────────────────
// One row is one thing the athlete records. That is deliberately not always a
// set: in the gym you record a set, on the track you record a rep, because
// each sprint has its own time and a single row for "4 × 30m" would throw
// away the thing worth keeping. So the leading number is the row count, and
// what each row holds depends on the units that follow.
//
// Everything here fails soft. An unparseable prescription yields one row with
// no pre-filled values, which is still perfectly loggable — the athlete just
// types what they did. A parser that threw would take the session with it.
// ═══════════════════════════════════════════════════════════════════════

export interface Prescribed {
  /** How many rows to offer. At least 1. */
  rows: number
  /** Repetitions within one row, where the movement has them. */
  reps?: number
  /** Metres, for anything run or jumped for distance. */
  distanceM?: number
  /** Seconds, for a held or timed effort. */
  timeS?: number
  /** True when nothing could be read and the values are all guesses. */
  parsed: boolean
  raw: string
}

const NUM = String.raw`\d+(?:[.,]\d+)?`

/** Both the unicode multiplication sign the model emits and a plain x. */
const SPLIT = /\s*[×x*]\s*/i

const toNum = (s: string): number | null => {
  const n = Number(String(s).replace(',', '.'))
  return Number.isFinite(n) ? n : null
}

/**
 * A number with an optional range and an optional trailing unit:
 * "30 m", "45 s", "10 min", "5", "8–10 min".
 *
 * The range is matched here rather than by splitting the token first, because
 * the unit sits after the UPPER bound: splitting "8–10 min" on the dash gives
 * "8" and throws the "min" away, which silently turned a ten-minute warm-up
 * into eight repetitions.
 *
 * The lower bound is the one taken. The number is only a starting point the
 * athlete edits, and starting low is the honest default — pre-filling the top
 * of a range and having someone tap past it records work that may not have
 * happened.
 */
function part(token: string): { n: number; unit: string } | null {
  const m = String(token).trim().match(
    new RegExp(String.raw`^(${NUM})(?:\s*[–—-]\s*${NUM})?\s*([a-z:]*)`, 'i'),
  )
  if (!m) return null
  const n = toNum(m[1])
  if (n == null) return null
  return { n, unit: (m[2] || '').toLowerCase() }
}

const isDistance = (u: string) => u === 'm' || u === 'km'
const isTime = (u: string) => u === 's' || u === 'sec' || u === 'secs'
  || u === 'min' || u === 'mins' || u === 'm:ss' || u === 'h'
const toSeconds = (n: number, u: string) =>
  u === 'min' || u === 'mins' ? n * 60 : u === 'h' ? n * 3600 : n
const toMetres = (n: number, u: string) => (u === 'km' ? n * 1000 : n)

export function parsePrescription(raw: any): Prescribed {
  const text = String(raw ?? '').trim()
  const fallback: Prescribed = { rows: 1, parsed: false, raw: text }
  if (!text) return fallback

  const tokens = text.split(SPLIT).map((t) => t.trim()).filter(Boolean)
  const parts = tokens.map((t) => part(t)).filter(Boolean) as
    { n: number; unit: string }[]
  if (!parts.length) return fallback

  // ── One number: a total, not a set scheme ──
  if (parts.length === 1) {
    const p = parts[0]
    if (isTime(p.unit)) return { rows: 1, timeS: toSeconds(p.n, p.unit), parsed: true, raw: text }
    if (isDistance(p.unit)) return { rows: 1, distanceM: toMetres(p.n, p.unit), parsed: true, raw: text }
    // "6 reps", or a bare number.
    return { rows: 1, reps: p.n, parsed: true, raw: text }
  }

  // ── Two numbers ──
  if (parts.length === 2) {
    const [a, b] = parts
    const rows = Math.max(1, Math.round(a.n))
    if (isDistance(b.unit)) return { rows, distanceM: toMetres(b.n, b.unit), parsed: true, raw: text }
    if (isTime(b.unit)) return { rows, timeS: toSeconds(b.n, b.unit), parsed: true, raw: text }
    return { rows, reps: b.n, parsed: true, raw: text }
  }

  // ── Three or more: sets × reps × distance ──
  const [a, b, c] = parts
  const rows = Math.max(1, Math.round(a.n))
  const out: Prescribed = { rows, reps: b.n, parsed: true, raw: text }
  if (isDistance(c.unit)) out.distanceM = toMetres(c.n, c.unit)
  else if (isTime(c.unit)) out.timeS = toSeconds(c.n, c.unit)
  return out
}

// ── Load ───────────────────────────────────────────────────────────

/** Bar loading is in 2.5kg jumps; a suggestion of 78.4kg is not usable. */
export const roundToPlate = (kg: number) => Math.round(kg / 2.5) * 2.5

/**
 * A starting load for the set, from the prescribed intensity.
 *
 * Two cases are real: an absolute weight ("82 kg"), and a percentage of a
 * one-rep max ("70% 1RM") which is only usable if the athlete has actually
 * tested that lift. Where they have not, this returns null rather than a
 * number derived from nothing — a made-up working weight is the one output
 * here that could get someone hurt.
 *
 * "95% effort" is not a load and must not be read as one, which is why the
 * percentage branch requires the 1RM wording rather than just a % sign.
 */
export function prefillLoadKg(intensity: any, oneRepMaxKg?: number | null): number | null {
  const t = String(intensity ?? '').trim().toLowerCase()
  if (!t || t === '—' || t === '-') return null

  const abs = t.match(new RegExp(String.raw`(${NUM})\s*kg\b`))
  if (abs) {
    const n = toNum(abs[1])
    return n != null && n > 0 ? n : null
  }

  const pct = t.match(new RegExp(String.raw`(${NUM})\s*%\s*(?:of\s*)?1\s*-?\s*rm`))
  if (pct && oneRepMaxKg && oneRepMaxKg > 0) {
    const p = toNum(pct[1])
    if (p != null && p > 0 && p <= 150) return roundToPlate((p / 100) * oneRepMaxKg)
  }
  return null
}

// ── Deviation ──────────────────────────────────────────────────────

export interface Deviation {
  field: 'reps' | 'load_kg' | 'distance_m' | 'time_s'
  delta: number
  /** True when the difference is worth showing at all. */
  material: boolean
}

/**
 * How a logged row differs from what was asked for.
 *
 * Load and distance get a small tolerance because hitting a prescription
 * exactly is not always possible — the next dumbbell up is 2kg away, a track
 * is marked where it is marked. Reps do not: three reps instead of four is
 * three reps instead of four.
 */
export function deviations(
  actual: { reps?: any; load_kg?: any; distance_m?: any; time_s?: any },
  target: Prescribed,
  targetLoadKg?: number | null,
): Deviation[] {
  const out: Deviation[] = []
  const push = (field: Deviation['field'], a: any, t: any, tol: number) => {
    const av = Number(a), tv = Number(t)
    if (!Number.isFinite(av) || !Number.isFinite(tv)) return
    const delta = av - tv
    if (delta === 0) return
    out.push({ field, delta, material: Math.abs(delta) > tol })
  }
  push('reps', actual.reps, target.reps, 0)
  push('load_kg', actual.load_kg, targetLoadKg, 1.25)
  push('distance_m', actual.distance_m, target.distanceM, 0.5)
  push('time_s', actual.time_s, target.timeS, 1)
  return out
}
