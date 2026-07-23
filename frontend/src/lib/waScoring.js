// ═══════════════════════════════════════════════════════════════════════
// World Athletics points scoring — adapted from the portable scoring engine.
// The ~1MB table (public/wa-scoring-data.json) is fetched LAZILY on first use
// so it never touches the landing bundle. Pure logic below; no DOM/deps.
// ═══════════════════════════════════════════════════════════════════════

/** "10.45" | "1:12.40" | "18.50" -> number (seconds, or metres for throws). */
export function parsePerformance(raw) {
  const s = String(raw ?? '').trim()
  if (!s) return null
  if (s.includes(':')) {
    const p = s.split(':').map(Number)
    if (p.some(isNaN)) return null
    return p.length === 2 ? p[0] * 60 + p[1] : p[0] * 3600 + p[1] * 60 + p[2]
  }
  const n = parseFloat(s.replace(/[^\d.]/g, ''))
  return isFinite(n) ? n : null
}

/** Number -> display string. kind: 'time' | 'dist'. */
export function formatPerformance(value, kind) {
  if (kind === 'dist') return value.toFixed(2) + ' m'
  if (value >= 60) {
    const m = Math.floor(value / 60)
    const s = value - m * 60
    return m + ':' + (s < 10 ? '0' : '') + s.toFixed(2)
  }
  return value.toFixed(2)
}

function indexEvent(ev) {
  if (ev._byPoints) return ev
  ev._byPoints = [...ev.rows].sort((a, b) => a[0] - b[0])
  ev._byValue = [...ev.rows].sort((a, b) => a[1] - b[1])
  return ev
}

function bracket(pairs, x, i) {
  let lo = 0, hi = pairs.length - 1
  while (hi - lo > 1) {
    const mid = (lo + hi) >> 1
    if (pairs[mid][i] <= x) lo = mid; else hi = mid
  }
  return [pairs[lo], pairs[hi]]
}

export function createScorer(data) {
  const cohortKey = (age, gender) => age + '|' + gender

  function getEvent(age, gender, event) {
    const cohort = data[cohortKey(age, gender)]
    const ev = cohort && cohort.events[event]
    return ev ? indexEvent(ev) : null
  }

  /** Performance -> { points, edge }. edge: 0 in-table, 1 above, -1 below. */
  function score(age, gender, event, value) {
    const ev = getEvent(age, gender, event)
    if (!ev || value == null) return null
    const rows = ev._byValue, n = rows.length, lowerIsBetter = ev.kind === 'time'

    if (value <= rows[0][1])
      return { points: rows[0][0], edge: value < rows[0][1] ? (lowerIsBetter ? 1 : -1) : 0 }
    if (value >= rows[n - 1][1])
      return { points: rows[n - 1][0], edge: value > rows[n - 1][1] ? (lowerIsBetter ? -1 : 1) : 0 }

    const [a, b] = bracket(rows, value, 1)
    const t = (value - a[1]) / ((b[1] - a[1]) || 1)
    return { points: a[0] + t * (b[0] - a[0]), edge: 0 }
  }

  /** Points -> equivalent performance in an event. Inverse of score(). */
  function equivalent(age, gender, event, points) {
    const ev = getEvent(age, gender, event)
    if (!ev) return null
    const rows = ev._byPoints, n = rows.length
    if (points <= rows[0][0]) return { value: rows[0][1], edge: points < rows[0][0] ? -1 : 0 }
    if (points >= rows[n - 1][0]) return { value: rows[n - 1][1], edge: points > rows[n - 1][0] ? 1 : 0 }
    const [a, b] = bracket(rows, points, 0)
    const t = (points - a[0]) / ((b[0] - a[0]) || 1)
    return { value: a[1] + t * (b[1] - a[1]), edge: 0 }
  }

  const listEvents = (age, gender) => {
    const cohort = data[cohortKey(age, gender)]
    return cohort ? Object.keys(cohort.events) : []
  }

  return { score, equivalent, listEvents, getEvent }
}

// ── App integration ───────────────────────────────────────────────────
// Map an app discipline + gender + age to the WA cohort and event key.
// WA cohorts: Senior, U18, U16 x Men, Women. Sprints only have Senior tables;
// hurdles/throws are age-graded (implement/height baked into the event name).
const WA_EVENT = {
  '100m': { Senior: '100m' },
  '200m': { Senior: '200m' },
  '400m': { Senior: '400m' },
  '100mH': { Senior: '100mH', U18: '100mH 0.76' },
  '110mH': { Senior: '110mH', U18: '110mH 0.91' },
  '400mH': { Senior: '400mH', U18: '400mH 0.84' },
  'Shot Put': { Senior: 'SP', U18M: 'SP 5kg', U18W: 'SP 3kg', U16M: 'SP 4kg', U16W: 'SP 3kg' },
  'Discus Throw': { Senior: 'DT', U18M: 'DT 1.5kg', U16M: 'DT 1.5kg', U16W: 'DT' },
  'Hammer Throw': { Senior: 'HT', U18M: 'HT 5kg', U18W: 'HT 3kg', U16M: 'HT 4kg', U16W: 'HT 3kg' },
  'Javelin Throw': { Senior: 'JT', U18M: 'JT 700g', U18W: 'JT 500g', U16M: 'JT 600g', U16W: 'JT 400g' },
}

// Flat sprints are implement-independent, so scoring a young sprinter on the
// Senior table is valid. Hurdles/throws differ by height/weight per age band,
// so we must NOT fall back to Senior — an unmatched band returns null.
const SPRINTS = new Set(['100m', '200m', '400m'])

/** discipline/gender/age -> { cohort, gender, event } | null (not scoreable). */
export function mapToWA(discipline, gender, age) {
  const g = (gender === 'Male' || gender === 'M') ? 'Men' : 'Women'
  const gi = g === 'Men' ? 'M' : 'W'
  const a = parseInt(age, 10)
  const cohort = (!isFinite(a) || a >= 18) ? 'Senior' : a >= 16 ? 'U18' : 'U16'
  const table = WA_EVENT[discipline]
  if (!table) return null
  const chain = SPRINTS.has(discipline) ? [cohort + gi, cohort, 'Senior'] : [cohort + gi, cohort]
  for (const key of chain) {
    if (table[key]) {
      const c = key.indexOf('U18') === 0 ? 'U18' : key.indexOf('U16') === 0 ? 'U16' : 'Senior'
      return { cohort: c, gender: g, event: table[key] }
    }
  }
  return null
}

let _scorerPromise = null
/** Lazily fetch the WA table (once) and build a scorer. */
export function loadWAScorer() {
  if (!_scorerPromise) {
    _scorerPromise = fetch('/wa-scoring-data.json')
      .then((r) => { if (!r.ok) throw new Error('WA data HTTP ' + r.status); return r.json() })
      .then((data) => createScorer(data))
      .catch((e) => { _scorerPromise = null; throw e })
  }
  return _scorerPromise
}

/**
 * High-level: athlete PB (seconds for times, metres for throws) -> WA points.
 * Returns { points, edge, cohort, event, gender } or null if not scoreable.
 */
export async function computeWAPoints({ discipline, gender, age, pb }) {
  const value = typeof pb === 'number' ? pb : parsePerformance(pb)
  if (value == null || !isFinite(value)) return null
  const m = mapToWA(discipline, gender, age)
  if (!m) return null
  const scorer = await loadWAScorer()
  const res = scorer.score(m.cohort, m.gender, m.event, value)
  if (!res) return null
  return { points: Math.round(res.points), edge: res.edge, cohort: m.cohort, event: m.event, gender: m.gender }
}
