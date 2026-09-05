// ═══════════════════════════════════════════════════════════════════════
// GROWTH MONITORING — is this young athlete in a spurt right now?
//
// This is the OTHER half of maturation. maturation.js estimates where an
// athlete sits relative to peak height velocity from one set of
// measurements (Mirwald). This measures what is actually happening, from
// serial heights over time — which is the stronger evidence and the thing a
// coach can act on this week.
//
// ── WHY IT MATTERS ────────────────────────────────────────────────────
// Growth-related injury peaks around PHV: the long bones lengthen before
// the muscle-tendon units and before bone mineral catches up, so an athlete
// mid-spurt is temporarily longer-levered, relatively weaker and less
// coordinated than they were three months ago. Hall & Erskine's 2025 review
// of 26 academy studies found stature increases of 7.2 cm/year or more
// associated with elevated injury risk.
//
// ── WHAT THIS IS NOT ──────────────────────────────────────────────────
// Not a diagnosis, and not a reason to stop anybody training. The output is
// a prompt to have a conversation and look at load, jump volume and
// technical demand — nothing here identifies an injury or a condition.
//
// ── THE EVIDENCE, AND ITS LIMITS ──────────────────────────────────────
// Stated plainly because the app will show this to coaches of girls, and
// the number underneath it did not come from girls:
//
//   • 7.2 cm/yr — Hall & Erskine (2025), a narrative review of 26 studies.
//     EVERY ONE of those 26 studies was male academy soccer. There is no
//     equivalent female threshold in the literature. Applying it to a girl
//     is the most defensible thing available, and it is still a transfer.
//   • Age at PHV in female athletes: 11.18 yr (90% CI 8.62–12.94), from a
//     2024 Bayesian meta-analysis. The interval is enormous — four years
//     wide — which is exactly why an alert should be driven by MEASURED
//     velocity and not by age.
//   • PHV magnitude: ~7.8 cm/yr girls, ~8.3 cm/yr boys, on average.
//   • Circa-PHV is conventionally ±0.5 yr either side.
//
// ── MEASUREMENT ERROR IS THE WHOLE PROBLEM ────────────────────────────
// A stadiometer reading is good to roughly ±0.3 cm in careful hands, and
// worse than that in a gym with a tape on a wall. Annualising a short gap
// multiplies that error by the same factor it multiplies the signal:
//
//     0.3 cm of error over 30 days  →  ±3.7 cm/yr of pure noise
//     0.3 cm of error over 90 days  →  ±1.2 cm/yr
//     0.3 cm of error over 180 days →  ±0.6 cm/yr
//
// So a 60-day minimum span is enforced, and anything under 90 days is
// returned as provisional. An alert that fires because someone stood up
// straighter this week would destroy a coach's trust in every alert after
// it — the false positive is more expensive than the delay.
// ═══════════════════════════════════════════════════════════════════════

/** A height reading. Anything with a date and a number in centimetres. */
export type HeightPoint = { day: string; cm: number }

export type GrowthLevel = 'rapid' | 'watch' | 'steady' | 'unknown'

export type GrowthReading = {
  level: GrowthLevel
  /** Annualised stature velocity in cm/yr, or null when it cannot be said. */
  velocity: number | null
  /** Days between the first and last reading used. */
  spanDays: number
  /** How many readings the window held. */
  points: number
  /** True while the span is long enough to compute but short enough that
   *  measurement error is still a meaningful share of the answer. */
  provisional: boolean
  /** ± the measurement error contributes at this span, in cm/yr. */
  noise: number | null
  /** Why there is no answer, when there isn't one. */
  reason: string | null
  /** Weight velocity in kg/yr over the same window, when mass was recorded. */
  massVelocity: number | null
  /** Legs lengthening faster than the trunk — the classic early-spurt sign. */
  legLed: boolean | null
}

// ── The thresholds ─────────────────────────────────────────────────────
/** Hall & Erskine 2025. Male academy soccer; see the caveat above. */
export const RAPID_CM_PER_YEAR = 7.2
/**
 * No study defines this one. It sits a little under the mean PHV magnitude
 * for girls (7.8) so that an athlete on the way up is noticed BEFORE they
 * cross the injury-associated line, which is the only point of watching.
 * Named as a judgement rather than dressed up as a finding.
 */
export const WATCH_CM_PER_YEAR = 5.5

/** Assumed stadiometer error, one reading, centimetres. */
export const MEASUREMENT_ERROR_CM = 0.3
/** Below this the annualised number is more error than signal. */
export const MIN_SPAN_DAYS = 60
/** Below this it is computable but should be labelled provisional. */
export const CONFIDENT_SPAN_DAYS = 90

const dayMs = 86400000
const toTime = (d: string) => new Date(d + 'T00:00:00Z').getTime()

/** Sorted oldest first, junk dropped, one reading per day (the last wins). */
export function cleanHeights(points: HeightPoint[]): HeightPoint[] {
  const byDay = new Map<string, number>()
  for (const p of points || []) {
    const cm = Number(p?.cm)
    const day = String(p?.day || '').slice(0, 10)
    // A human is not 40 cm and not 260 cm. A fat-fingered 17 instead of 170
    // would otherwise read as the fastest shrink in medical history.
    if (!day || !Number.isFinite(cm) || cm < 40 || cm > 260) continue
    byDay.set(day, cm)
  }
  return [...byDay.entries()]
    .map(([day, cm]) => ({ day, cm }))
    .sort((a, b) => a.day.localeCompare(b.day))
}

/**
 * Annualised velocity across a window, plus the noise floor at that span.
 *
 * First-to-last rather than a regression, deliberately. A coach has three or
 * four readings, and a least-squares slope over four points is not more
 * truthful than the endpoints — it just looks more sophisticated while
 * hiding which two numbers actually drove it.
 */
export function velocityOf(points: HeightPoint[]): {
  velocity: number | null; spanDays: number; noise: number | null
} {
  const pts = cleanHeights(points)
  if (pts.length < 2) return { velocity: null, spanDays: 0, noise: null }
  const first = pts[0]
  const last = pts[pts.length - 1]
  const spanDays = Math.round((toTime(last.day) - toTime(first.day)) / dayMs)
  if (spanDays <= 0) return { velocity: null, spanDays: 0, noise: null }
  const velocity = ((last.cm - first.cm) / spanDays) * 365.25
  // Two independent readings, so the errors add in quadrature.
  const noise = (Math.SQRT2 * MEASUREMENT_ERROR_CM / spanDays) * 365.25
  return {
    velocity: Math.round(velocity * 10) / 10,
    spanDays,
    noise: Math.round(noise * 10) / 10,
  }
}

/**
 * The reading a coach sees.
 *
 * `windowDays` bounds how far back to look: a spurt is a thing happening
 * NOW, and including a reading from two years ago would average this
 * month's 9 cm/yr away to nothing.
 */
export function growthReading(
  heights: HeightPoint[],
  opts: {
    masses?: HeightPoint[]          // kg, same shape
    sittingHeights?: HeightPoint[]  // cm, same shape
    windowDays?: number
    today?: string
  } = {},
): GrowthReading {
  const windowDays = opts.windowDays ?? 400
  const todayT = opts.today ? toTime(opts.today) : Date.now()
  const inWindow = (pts: HeightPoint[]) => cleanHeights(pts)
    .filter((p) => (todayT - toTime(p.day)) / dayMs <= windowDays)

  const pts = inWindow(heights)
  const none = (reason: string): GrowthReading => ({
    level: 'unknown', velocity: null, spanDays: 0, points: pts.length,
    provisional: false, noise: null, reason, massVelocity: null, legLed: null,
  })

  if (pts.length === 0) return none('No height recorded yet.')
  if (pts.length === 1) return none('Only one height on file — a second one is what makes this readable.')

  const { velocity, spanDays, noise } = velocityOf(pts)
  if (velocity == null) return none('Heights are all on the same day.')
  if (spanDays < MIN_SPAN_DAYS) {
    return {
      ...none(`Only ${spanDays} days between measurements — too short to tell growth from measurement error.`),
      points: pts.length, spanDays, noise,
    }
  }

  // Mass over the same window, so "heavier or just longer" can be answered.
  const massPts = inWindow(opts.masses || [])
  const mass = massPts.length >= 2 ? velocityOf(massPts) : null

  // Legs before trunk. Sitting height is trunk; standing minus sitting is
  // leg. Legs leading is the classic early-spurt signature and the one that
  // changes a thrower's block and a jumper's run-up before anyone notices.
  let legLed: boolean | null = null
  const sitPts = inWindow(opts.sittingHeights || [])
  if (sitPts.length >= 2 && pts.length >= 2) {
    const sit = velocityOf(sitPts)
    if (sit.velocity != null && velocity != null) {
      const legVelocity = velocity - sit.velocity
      legLed = legVelocity > sit.velocity
    }
  }

  const provisional = spanDays < CONFIDENT_SPAN_DAYS
  const level: GrowthLevel =
    velocity >= RAPID_CM_PER_YEAR ? 'rapid'
      : velocity >= WATCH_CM_PER_YEAR ? 'watch'
      : 'steady'

  return {
    level, velocity, spanDays, points: pts.length, provisional, noise,
    reason: null,
    massVelocity: mass?.velocity ?? null,
    legLed,
  }
}

// ── What to say about it ───────────────────────────────────────────────

export const GROWTH_LABEL: Record<GrowthLevel, string> = {
  rapid: 'Growing fast',
  watch: 'Growing',
  steady: 'Steady',
  unknown: 'Not enough data',
}

export const GROWTH_TONE: Record<GrowthLevel, string> = {
  rapid: '#F59E0B',
  watch: '#60A5FA',
  steady: '#34D399',
  unknown: 'rgba(255,255,255,0.44)',
}

/** The headline, with the uncertainty attached rather than in a footnote. */
export function growthHeadline(r: GrowthReading): string {
  if (r.level === 'unknown' || r.velocity == null) return r.reason || 'Not enough data'
  const v = r.velocity.toFixed(1)
  const band = r.noise != null && r.noise >= 0.5 ? ` ± ${r.noise.toFixed(1)}` : ''
  return `${v}${band} cm/yr over ${r.spanDays} days`
}

/**
 * What a coach should actually do. Written as questions to consider rather
 * than instructions, because this is one signal about one athlete and the
 * person reading it knows things the app does not.
 */
export function growthAdvice(r: GrowthReading, sex?: string | null): string[] {
  if (r.level === 'steady' || r.level === 'unknown') return []
  const out: string[] = []

  out.push(
    r.level === 'rapid'
      ? 'Growth at or above the rate linked with higher injury risk in academy athletes. Worth a conversation this week.'
      : 'Growing quickly, though below the rate injury studies flag. Worth keeping the tape handy.',
  )

  if (r.legLed) {
    out.push('Legs are lengthening faster than the trunk — expect run-ups, blocks and takeoff points to need re-measuring, not just re-coaching.')
  }
  if (r.massVelocity != null && r.velocity != null && r.massVelocity < r.velocity * 0.6) {
    out.push('Height is climbing faster than mass, so they are longer-levered without the strength to match yet. Relative strength will read worse than last term even if nothing has gone wrong.')
  }

  out.push('Bone lengthens before the muscle-tendon unit catches up, so tightness and tendon-attachment soreness are common in this window — worth asking rather than waiting to be told.')
  out.push('Look at total jump, throw and sprint volume rather than at technique. Coordination often dips through a spurt and returns on its own.')

  if (String(sex || '').toUpperCase().startsWith('F')) {
    out.push('The 7.2 cm/yr figure comes from studies of male academy players — there is no female equivalent published. Treat it as a prompt, not a line she has crossed.')
  }
  if (r.provisional) {
    out.push(`Only ${r.spanDays} days of separation, so this is provisional. Re-measure in a month before acting on the number.`)
  }
  return out
}

/**
 * When the estimate and the tape disagree, say so — and say which to trust.
 *
 * This is not hypothetical. The first athlete this feature was built against
 * is a 14.2-year-old measured growing 10.0 cm/yr across six months, and
 * Mirwald puts her at +1.77 years PAST peak height velocity. Both cannot be
 * true, and the resolution is not a coin toss:
 *
 *   Mirwald is a cross-sectional regression whose own authors report it
 *   regresses toward the mean and loses accuracy at the maturity extremes
 *   and at older ages. A late-maturing girl is precisely that case — the
 *   equation is dominated by chronological age, so it reads "14 and 162 cm"
 *   as a girl who finished growing, because most 14-year-old girls have.
 *
 *   Six serial heights over 182 days are a measurement.
 *
 * So the measurement wins, and the coach is told the estimate disagreed
 * rather than being quietly shown one of the two. Hiding the conflict would
 * be the more dangerous choice: this is exactly the athlete whose spurt gets
 * missed, because the estimate says there is nothing to look for.
 */
export function estimateConflict(
  r: GrowthReading, maturityStatus?: string | null,
): string | null {
  if (!maturityStatus) return null
  if (r.level !== 'rapid' && r.level !== 'watch') return null
  if (maturityStatus !== 'post-PHV') return null
  return 'The maturity estimate from her latest measurements says post-PHV, '
    + 'which contradicts what the tape shows. Mirwald loses accuracy for late '
    + 'maturers and at older ages, and it is one snapshot against six. Trust '
    + 'the series.'
}

/**
 * How overdue a re-measure is. Consensus guidance is every 4–6 months for
 * maturity estimation, but that is for ESTIMATING status. Catching a spurt
 * while it is happening needs monthly, which is thirty seconds against a
 * wall and the highest-value thirty seconds in youth monitoring.
 */
export const REMEASURE_DAYS = 35

export function daysSinceLastHeight(heights: HeightPoint[], today?: string): number | null {
  const pts = cleanHeights(heights)
  if (!pts.length) return null
  const t = today ? toTime(today) : Date.now()
  return Math.round((t - toTime(pts[pts.length - 1].day)) / dayMs)
}
