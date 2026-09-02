// ═══════════════════════════════════════════════════════════════════════
// READINESS (mobile) — turn a daily check-in into a red / amber / green
// status for the coach Needs-attention surface. Mirrors web readiness.js.
// Youth-safe: ANY reported pain forces red.
// ═══════════════════════════════════════════════════════════════════════

export const READINESS_COLORS: Record<string, string> = {
  green: '#34d399',
  amber: '#fbbf24',
  red: '#fb7185',
  none: '#475569',
}

export const READINESS_LABEL: Record<string, string> = {
  green: 'Good to go',
  amber: 'Monitor',
  red: 'Needs attention',
  none: 'No check-in',
}

// Kept in step with frontend/src/lib/readiness.js PAIN_AREAS.
export const PAIN_AREAS: { v: string; l: string }[] = [
  { v: 'knee', l: 'Knee' }, { v: 'heel', l: 'Heel' }, { v: 'ankle', l: 'Ankle' },
  { v: 'hip', l: 'Hip/groin' }, { v: 'shin', l: 'Shin' }, { v: 'back', l: 'Back' },
  { v: 'hamstring', l: 'Hamstring' }, { v: 'calf', l: 'Calf' }, { v: 'foot', l: 'Foot' },
  { v: 'shoulder', l: 'Shoulder' }, { v: 'other', l: 'Other' },
]

export type CheckinRow = {
  checkin_date?: string
  sleep_hours?: number | null
  soreness?: number | null
  mood?: number | null
  energy?: number | null
  pain?: boolean | null
  pain_areas?: string[] | null
} | null | undefined

export type ReadinessStatus = { level: 'green' | 'amber' | 'red' | 'none'; label: string; reasons: string[] }

// ── Per-field concern levels ───────────────────────────────────────
// Pulled out of checkinStatus rather than restated beside it. The wellness
// charts colour each reading by its own field's level, and a second copy of
// "what counts as low sleep" is a guarantee that one day the dot on the chart
// and the dot on the schedule disagree about the same night.
//
// checkinStatus is built from these, so the two can only ever move together.

export type FieldLevel = 'green' | 'amber' | 'red'
export type WellnessField = 'sleep_hours' | 'soreness' | 'mood' | 'energy'

/** null when there is no reading — which is not the same as a good one. */
export function fieldLevel(field: WellnessField, value: number | null | undefined): FieldLevel | null {
  if (value == null) return null
  const v = Number(value)
  if (!Number.isFinite(v)) return null
  switch (field) {
    case 'sleep_hours': return v < 5 ? 'red' : v < 6.5 ? 'amber' : 'green'
    case 'soreness':    return v >= 4 ? 'red' : v === 3 ? 'amber' : 'green'
    // Mood and energy never force red on their own: a flat day is a reason to
    // watch, not a reason to stop.
    case 'mood':        return v <= 2 ? 'amber' : 'green'
    case 'energy':      return v <= 2 ? 'amber' : 'green'
    default:            return null
  }
}

const FIELD_REASON: Record<WellnessField, Partial<Record<FieldLevel, string>>> = {
  sleep_hours: { red: 'Very low sleep', amber: 'Below-target sleep' },
  soreness: { red: 'High soreness', amber: 'Moderate soreness' },
  mood: { amber: 'Low mood' },
  energy: { amber: 'Low energy' },
}

/** Human name for a wellness field, for chart titles and tables. */
export const FIELD_LABEL: Record<WellnessField, string> = {
  sleep_hours: 'Sleep', soreness: 'Soreness', mood: 'Mood', energy: 'Energy',
}

/** Higher is better for all but soreness. */
export const FIELD_LOWER_IS_BETTER: Record<WellnessField, boolean> = {
  sleep_hours: false, soreness: true, mood: false, energy: false,
}

export function checkinStatus(c: CheckinRow): ReadinessStatus {
  if (!c) return { level: 'none', label: READINESS_LABEL.none, reasons: [] }

  const reasons: string[] = []
  let level: ReadinessStatus['level'] = 'green'
  const rank = { green: 0, amber: 1, red: 2 } as const
  const bump = (l: 'amber' | 'red') => { if (rank[l] > rank[level]) level = l }

  const areas = Array.isArray(c.pain_areas) ? c.pain_areas : []
  if (c.pain || areas.length > 0) {
    bump('red')
    reasons.push(areas.length ? `Pain: ${areas.join(', ')}` : 'Pain reported')
  }
  // Order matters — it is the order the reasons read in. Soreness before
  // sleep, then mood, then energy, as before.
  for (const f of ['soreness', 'sleep_hours', 'mood', 'energy'] as WellnessField[]) {
    const lvl = fieldLevel(f, c[f] as any)
    if (!lvl || lvl === 'green') continue
    bump(lvl)
    const reason = FIELD_REASON[f][lvl]
    if (reason) reasons.push(reason)
  }

  return { level, label: READINESS_LABEL[level], reasons }
}

/**
 * Local calendar date. `at` exists so callers — and the tests behind them —
 * can ask about a specific moment instead of about whenever the suite
 * happens to run. A check-in freshness test that passes in the morning and
 * fails at 00:30 is a test nobody keeps.
 */
export function todayStr(at?: number | Date): string {
  const d = at == null ? new Date() : new Date(at)
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`
}

export function isToday(checkin: CheckinRow, at?: number | Date): boolean {
  if (!checkin || !checkin.checkin_date) return false
  return String(checkin.checkin_date).slice(0, 10) === todayStr(at)
}
