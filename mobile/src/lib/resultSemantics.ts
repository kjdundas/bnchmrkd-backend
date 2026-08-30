// ═══════════════════════════════════════════════════════════════════════
// COMPETITION RESULT SEMANTICS — what actually happened, and what counts.
//
// A result is not just a number. An athlete can finish fourth in a heat and
// still make the final; they can run the fastest time of their life and be
// disqualified; they can foul all three throws and have no mark at all. The
// app stored only the number, so all of that was lost.
//
// ── THE ONE RULE THIS FILE EXISTS TO ENFORCE ───────────────────────
// `countsForAnalysis` is the single gate every calculation must pass a result
// through — PB, trend, projection, tier gauge, season best. Filtering on
// "does it have a mark" is NOT sufficient, and that is the trap:
//
//   · a DQ often carries the time that was recorded before it was voided.
//     It is a real number. It is not a legal result.
//   · a sprint or horizontal jump with over +2.0 m/s of tailwind is a real,
//     legal-to-run performance that is ineligible for a record. Counting it
//     as a PB tells an athlete they are faster than they are, and every
//     projection built on it inherits the error.
//
// So the gate reads `status`, `mark` and `wind_mps` together. Anything that
// bypasses it and reads `.mark` directly will eventually be wrong.
// ═══════════════════════════════════════════════════════════════════════

import { isLowerBetter } from './disciplineScience'

// ── Status ─────────────────────────────────────────────────────────
export type ResultStatus = 'OK' | 'DNF' | 'DNS' | 'DQ' | 'NM'

export const RESULT_STATUSES: { v: ResultStatus; l: string; hint: string }[] = [
  { v: 'OK', l: 'Finished', hint: 'A completed result with a mark.' },
  { v: 'DNF', l: 'DNF', hint: 'Started but did not finish.' },
  { v: 'DNS', l: 'DNS', hint: 'Did not start.' },
  { v: 'DQ', l: 'DQ', hint: 'Disqualified — false start, lane infringement, or a foul.' },
  { v: 'NM', l: 'No mark', hint: 'All attempts fouled or failed. Field events.' },
]

/** Short label for a table cell where the mark would otherwise go. */
export const STATUS_LABEL: Record<ResultStatus, string> = {
  OK: '', DNF: 'DNF', DNS: 'DNS', DQ: 'DQ', NM: 'NM',
}

export const isCompleted = (status?: string | null) => (status || 'OK') === 'OK'

// ── Round ──────────────────────────────────────────────────────────
export type ResultRound =
  'heat' | 'quarter' | 'semi' | 'final' | 'qualification' | 'trial' | 'other'

export const ROUNDS: { v: ResultRound; l: string; track: boolean; field: boolean }[] = [
  { v: 'heat', l: 'Heat', track: true, field: false },
  { v: 'quarter', l: 'Quarter-final', track: true, field: false },
  { v: 'semi', l: 'Semi-final', track: true, field: false },
  { v: 'qualification', l: 'Qualification', track: false, field: true },
  { v: 'final', l: 'Final', track: true, field: true },
  { v: 'trial', l: 'Trial / open', track: true, field: true },
  { v: 'other', l: 'Other', track: true, field: true },
]

export const ROUND_LABEL: Record<string, string> =
  Object.fromEntries(ROUNDS.map((r) => [r.v, r.l]))

/** A final has nothing to progress to; neither does a one-off trial. */
export const roundHasProgression = (round?: string | null) =>
  !!round && round !== 'final' && round !== 'trial' && round !== 'other'

// ── Progression ────────────────────────────────────────────────────
// Standard athletics notation: Q advanced on place, q advanced on mark or
// time as a fastest loser. Keeping the sport's own shorthand means a result
// read here matches a result read on a results sheet.
export type Progression = 'Q' | 'q' | 'out'

export const PROGRESSIONS: { v: Progression; l: string; hint: string }[] = [
  { v: 'Q', l: 'Q — through on place', hint: 'Automatic qualifier by finishing position.' },
  { v: 'q', l: 'q — through on mark', hint: 'Advanced as a fastest loser or on qualifying standard.' },
  { v: 'out', l: 'Out', hint: 'Did not advance.' },
]

export const PROGRESSION_LABEL: Record<string, string> = {
  Q: 'Q', q: 'q', out: 'Out',
}
export const PROGRESSION_FULL: Record<string, string> = {
  Q: 'Through on place', q: 'Through on mark', out: 'Did not advance',
}

// ── Wind ───────────────────────────────────────────────────────────
/** Over this, a mark is wind-assisted and ineligible for a record. */
export const WIND_LIMIT = 2.0

// Wind is only measured — and only matters — where a tailwind actually helps:
// the short sprints, the sprint hurdles, and the two horizontal jumps.
// A 400m, a throw, a high jump and anything indoors have no wind reading, and
// asking for one would invite a number that means nothing.
const WIND_AFFECTED = new Set([
  '100m', '200m', '100mh', '110mh', 'long jump', 'triple jump',
])

export function isWindAffected(discipline?: string | null): boolean {
  const d = String(discipline || '').trim().toLowerCase()
  if (!d) return false
  if (WIND_AFFECTED.has(d)) return true
  // Tolerate spelling variants ("100m Hurdles", "100 m H").
  const compact = d.replace(/[\s.]/g, '')
  if (compact === '100mhurdles' || compact === '110mhurdles') return true
  return WIND_AFFECTED.has(compact)
}

/**
 * A number, or null — never the 0 that Number() hands back for null, '' and
 * a whitespace string. Every numeric field on a result row is optional, and
 * `Number(null) === 0` is the coercion that turns "no reading" into a real
 * measurement of zero.
 */
function num(v: any): number | null {
  if (v == null || v === '') return null
  if (typeof v === 'string' && v.trim() === '') return null
  const n = Number(v)
  return Number.isFinite(n) ? n : null
}

/** True only where wind is measured AND the reading is over the limit. */
export function isWindAssisted(row: any, discipline?: string | null): boolean {
  const d = discipline ?? row?.discipline
  if (!isWindAffected(d)) return false
  const w = num(row?.wind_mps)
  return w != null && w > WIND_LIMIT
}

/** "+1.8" · "−0.4" · "0.0" — the sport always writes the sign. */
export function formatWind(w: any): string | null {
  const n = num(w)
  // A missing reading is not a still day. "0.0" would claim someone measured.
  if (n == null) return null
  return `${n > 0 ? '+' : n < 0 ? '−' : ''}${Math.abs(n).toFixed(1)}`
}

export { num as optionalNumber }

// ── The gate ───────────────────────────────────────────────────────

/**
 * Whether a stored result may enter PB, trend, projection or tier maths.
 *
 * Three independent reasons to exclude, and all three have to be checked
 * together — see the header. Anything that reads `.mark` without passing
 * through here is a bug waiting to happen.
 */
export function countsForAnalysis(row: any, discipline?: string | null): boolean {
  if (!row) return false
  if (!isCompleted(row.status)) return false
  // `num`, not Number: a null mark coerces to 0, and in a time event 0.00s
  // would be an unbeatable personal best that no real run could ever displace.
  if (num(row.mark) == null) return false
  return !isWindAssisted(row, discipline ?? row.discipline)
}

/** Why a result was left out, for a table that has to explain itself. */
export function exclusionReason(row: any, discipline?: string | null): string | null {
  if (!row) return null
  if (!isCompleted(row.status)) return STATUS_LABEL[row.status as ResultStatus] || 'Not a result'
  if (num(row.mark) == null) return 'No mark'
  if (isWindAssisted(row, discipline ?? row.discipline)) return 'Wind-assisted'
  return null
}

/** 1 → "1st" · 2 → "2nd" · 11 → "11th" · 23 → "23rd" */
export function ordinal(n: any): string | null {
  const v = num(n)
  if (v == null || !Number.isInteger(v) || v < 1) return null
  // 11th, 12th and 13th break the last-digit rule and are the classic bug.
  const mod100 = v % 100
  if (mod100 >= 11 && mod100 <= 13) return `${v}th`
  switch (v % 10) {
    case 1: return `${v}st`
    case 2: return `${v}nd`
    case 3: return `${v}rd`
    default: return `${v}th`
  }
}

/** A one-line summary of a result for a list row: "2nd · Semi-final · Q" */
export function resultContext(row: any): string {
  return [
    ordinal(row?.place),
    ROUND_LABEL[row?.round] || null,
    row?.progressed ? PROGRESSION_LABEL[row.progressed] : null,
  ].filter(Boolean).join(' · ')
}

// ── Personal bests ─────────────────────────────────────────────────

/**
 * How many times the athlete has set a personal best, across all events.
 *
 * A PB is an EVENT you improved on, in a RACE. It is not a training metric —
 * squatting more than you did last month is progress, not a personal best in
 * the sense an athlete means it — and it is not simply "how many events you
 * have logged", which is the number this used to return.
 *
 * The first legal result in an event counts: your first race is your best by
 * definition.
 *
 * ── WHY THE ORDERING IS SPELLED OUT ────────────────────────────────
 * This walks results in time order and counts each improvement, so the order
 * decides the answer. Four 100m marks on one afternoon — 10.52, 10.59, 10.59,
 * 10.99 — give 1 PB if the fastest is walked first and 3 if the slowest is.
 * Sorting on date alone leaves same-day results in whatever order the array
 * happened to arrive in, so the same data could report a different total on
 * each render. `created_at` then `id` breaks every tie, deterministically.
 */
export function countPersonalBests(performances: any[]): number {
  const best: Record<string, number> = {}
  let n = 0

  const ordered = (performances || [])
    .filter((p) => p?.competition_date && countsForAnalysis(p, p.discipline))
    .sort((a, b) => {
      const d = String(a.competition_date).localeCompare(String(b.competition_date))
      if (d !== 0) return d
      const c = String(a.created_at || '').localeCompare(String(b.created_at || ''))
      if (c !== 0) return c
      return String(a.id || '').localeCompare(String(b.id || ''))
    })

  for (const p of ordered) {
    const event = String(p.discipline || '_')
    const m = Number(p.mark)
    const lower = isLowerBetter(event)
    if (best[event] == null || (lower ? m < best[event] : m > best[event])) {
      best[event] = m
      n++
    }
  }
  return n
}

/** The events the athlete currently holds a legal best in, best-first. */
export function personalBests(performances: any[]): { discipline: string; mark: number }[] {
  const best = new Map<string, number>()
  for (const p of performances || []) {
    if (!countsForAnalysis(p, p?.discipline)) continue
    const event = String(p.discipline || '_')
    const m = Number(p.mark)
    const cur = best.get(event)
    if (cur == null || (isLowerBetter(event) ? m < cur : m > cur)) best.set(event, m)
  }
  return [...best.entries()].map(([discipline, mark]) => ({ discipline, mark }))
}
