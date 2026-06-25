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
  if (c.soreness != null) {
    if (c.soreness >= 4) { bump('red'); reasons.push('High soreness') }
    else if (c.soreness === 3) { bump('amber'); reasons.push('Moderate soreness') }
  }
  if (c.sleep_hours != null) {
    const s = Number(c.sleep_hours)
    if (Number.isFinite(s)) {
      if (s < 5) { bump('red'); reasons.push('Very low sleep') }
      else if (s < 6.5) { bump('amber'); reasons.push('Below-target sleep') }
    }
  }
  if (c.mood != null && c.mood <= 2) { bump('amber'); reasons.push('Low mood') }
  if (c.energy != null && c.energy <= 2) { bump('amber'); reasons.push('Low energy') }

  return { level, label: READINESS_LABEL[level], reasons }
}

export function todayStr(): string {
  const d = new Date()
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`
}

export function isToday(checkin: CheckinRow): boolean {
  if (!checkin || !checkin.checkin_date) return false
  return String(checkin.checkin_date).slice(0, 10) === todayStr()
}
