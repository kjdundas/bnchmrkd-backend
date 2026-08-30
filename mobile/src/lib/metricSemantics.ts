// ═══════════════════════════════════════════════════════════════════════
// METRIC SEMANTICS — direction, grouping and formatting for athlete_metrics
// and competition marks. Ported from the web AthleteDashboard so both apps
// answer "is this a PB?" and "how do I print this mark?" the same way.
//
// These helpers were previously duplicated (and had drifted) across
// HomeScreen, LogScreen, AthleteDetailScreen, CoachRosterScreen and
// FullAnalysis. New code should import from here.
// ═══════════════════════════════════════════════════════════════════════

// ── Discipline helpers ─────────────────────────────────────────────
export const THROWS = [
  'Discus Throw', 'Shot Put', 'Javelin Throw', 'Hammer Throw',
  'Discus', 'Javelin', 'Hammer', 'Shot',
]

export const isThrowsDiscipline = (d?: string | null) =>
  THROWS.some((t) => (d || '').toLowerCase().includes(t.toLowerCase()))

/** Throws print in metres; everything else as ss.xx s or m:ss.xx. */
export function formatMark(value: number | null | undefined, discipline?: string | null): string {
  if (value == null || !Number.isFinite(Number(value))) return '—'
  const v = Number(value)
  if (isThrowsDiscipline(discipline)) return `${v.toFixed(2)}m`
  const mins = Math.floor(v / 60)
  const secs = (v % 60).toFixed(2)
  return mins > 0 ? `${mins}:${secs.padStart(5, '0')}` : `${secs}s`
}

// ── PB direction ───────────────────────────────────────────────────
// Metrics where a LOWER value is the better result. This is the UNION of the
// web set and the set mobile already used, so adopting this module cannot
// silently flip the direction of a metric either app already handled.
export const LOWER_IS_BETTER = new Set<string>([
  // speed — sprint splits and flying times
  'sprint_10m', 'sprint_20m', 'sprint_30m', 'sprint_40m', 'sprint_60m',
  'sprint_100m', 'flying_10m', 'flying_20m', 'split_300m',
  // endurance — time trials and resting HR
  'tt_1200m', 'bronco', 'tt_2km', 'rhr', 'resting_hr',
  // anthropometrics — fat metrics
  'body_fat', 'body_fat_pct', 'sum_7_skinfolds', 'fat_mass',
])

/** Metrics where "PB" doesn't really apply — body mass, heights, spans. */
export const NO_PB = new Set<string>([
  'body_mass', 'standing_height', 'sitting_height', 'wingspan', 'lean_mass',
])

export const isLowerBetter = (key: string) => LOWER_IS_BETTER.has(key)
export const hasNoPb = (key: string) => NO_PB.has(key)

// ── Grouping ───────────────────────────────────────────────────────
export interface MetricRow {
  metric_key: string
  metric_label?: string | null
  unit?: string | null
  value: number | string
  recorded_at: string
  [k: string]: any
}

export interface MetricGroup {
  key: string
  label?: string | null
  unit?: string | null
  latest: MetricRow
  best: MetricRow
  history: MetricRow[]
}

/**
 * Collapse raw athlete_metrics rows into one group per metric_key, carrying the
 * latest reading, the best reading (direction-aware) and the full history
 * sorted oldest → newest. Groups come back most-recently-logged first.
 */
export function groupMetrics(metrics: MetricRow[] | null | undefined): MetricGroup[] {
  const byKey: Record<string, MetricGroup> = {}
  for (const r of metrics || []) {
    if (r?.value == null) continue
    if (!byKey[r.metric_key]) {
      byKey[r.metric_key] = {
        key: r.metric_key, label: r.metric_label, unit: r.unit,
        latest: r, best: r, history: [r],
      }
    } else {
      const g = byKey[r.metric_key]
      g.history.push(r)
      if (new Date(r.recorded_at) > new Date(g.latest.recorded_at)) g.latest = r
      const lower = LOWER_IS_BETTER.has(r.metric_key)
      const rv = Number(r.value), bv = Number(g.best.value)
      if (lower ? rv < bv : rv > bv) g.best = r
    }
  }
  const groups = Object.values(byKey)
  for (const g of groups) {
    g.history.sort((a, b) => new Date(a.recorded_at).getTime() - new Date(b.recorded_at).getTime())
  }
  return groups.sort(
    (a, b) => new Date(b.latest.recorded_at).getTime() - new Date(a.latest.recorded_at).getTime()
  )
}

/**
 * How a metric draws as a ring: how full, and whether the latest reading is
 * the best one.
 *
 * Fill is the latest reading's position within that metric's OWN historical
 * range, not against any external standard — a full ring means "your best
 * ever", an empty one "your worst ever". Metrics in NO_PB (body mass, height)
 * have no better direction, so they always draw full.
 *
 * This lives here, rather than inside the rail, because the picker draws the
 * same rings from the same data. Two implementations of "how full is this
 * ring" is two chances for the preview to disagree with the thing it previews.
 */
export interface RingModel {
  latest: number
  /** 0.04–1. Floored so a metric at its own worst still shows a visible arc. */
  shown: number
  isPb: boolean
}

export function ringModel(g: MetricGroup): RingModel {
  const noPb = NO_PB.has(g.key)
  const lowerBetter = LOWER_IS_BETTER.has(g.key)
  const latest = Number(g.latest.value)
  const vals = g.history.map((r) => Number(r.value)).filter(Number.isFinite)
  const best = lowerBetter ? Math.min(...vals) : Math.max(...vals)
  const worst = lowerBetter ? Math.max(...vals) : Math.min(...vals)
  const span = Math.abs(best - worst)
  const frac = noPb || span === 0 ? 1 : Math.abs(latest - worst) / span
  const isPb = !noPb && g.history.length > 1 && latest === best
  return { latest, shown: Math.max(0.04, frac), isPb }
}

// ── Display ────────────────────────────────────────────────────────
export const fmtMetricValue = (v: number | string): string => {
  const n = Number(v)
  if (!Number.isFinite(n)) return String(v)
  if (Math.abs(n) >= 100) return n.toFixed(0)
  return String(parseFloat(n.toFixed(2)))
}

export const timeAgo = (dateLike?: string | number | null): string => {
  if (!dateLike) return ''
  const d = new Date(dateLike).getTime()
  if (!Number.isFinite(d)) return ''
  const days = Math.floor((Date.now() - d) / 86400000)
  if (days <= 0) return 'today'
  if (days === 1) return '1d ago'
  if (days < 7) return `${days}d ago`
  if (days < 30) return `${Math.floor(days / 7)}w ago`
  return `${Math.floor(days / 30)}mo ago`
}
