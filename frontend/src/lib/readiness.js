// ═══════════════════════════════════════════════════════════════════════
// READINESS (M3) — turn a daily check-in into a red / amber / green status.
// Youth-safe thresholds: ANY reported pain forces red (flag → refer, never
// train through pain). Used by the athlete check-in card and the coach roster.
// ═══════════════════════════════════════════════════════════════════════

export const READINESS_COLORS = {
  green: '#34d399',
  amber: '#fbbf24',
  red:   '#fb7185',
  none:  '#475569',
}

export const READINESS_LABEL = {
  green: 'Good to go',
  amber: 'Monitor',
  red:   'Needs attention',
  none:  'No check-in',
}

// Areas an athlete can flag pain in (mirrors the program injury areas).
export const PAIN_AREAS = [
  { v: 'knee', l: 'Knee' }, { v: 'heel', l: 'Heel' }, { v: 'ankle', l: 'Ankle' },
  { v: 'hip', l: 'Hip/groin' }, { v: 'shin', l: 'Shin' }, { v: 'back', l: 'Back' },
  { v: 'hamstring', l: 'Hamstring' }, { v: 'calf', l: 'Calf' }, { v: 'foot', l: 'Foot' },
  { v: 'shoulder', l: 'Shoulder' }, { v: 'other', l: 'Other' },
]

// Compute the readiness level for a single check-in row.
// Returns { level, label, reasons[] }. `level` is 'green' | 'amber' | 'red' | 'none'.
export function checkinStatus(c) {
  if (!c) return { level: 'none', label: READINESS_LABEL.none, reasons: [] }

  const reasons = []
  let level = 'green'
  const bump = (l) => {
    const rank = { green: 0, amber: 1, red: 2 }
    if (rank[l] > rank[level]) level = l
  }

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

// Is the check-in from today (local date)?
export function isToday(checkin) {
  if (!checkin?.checkin_date) return false
  return String(checkin.checkin_date).slice(0, 10) === todayStr()
}

export function todayStr() {
  const d = new Date()
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`
}
