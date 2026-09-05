// ═══════════════════════════════════════════════════════════════════════
// THE CORPUS — 1.08 million real results, asked a question at a time.
//
// What this replaces: HISTORICAL_RIVALS, about 150 hand-typed rows of
// famous names. Usain Bolt, 10.03, age 16. It could only ever return a
// celebrity, several events had no women's pool at all and silently fell
// back to the men's, and five events returned nothing.
//
// What it replaces it with: CORPUS_CAREERS real careers with a date of birth and a
// decimal age on every mark, so the question becomes "who was actually
// where you are, at your age, in your event" — and, because these are
// whole careers rather than snapshots, "and what happened to them next".
// Both the encouraging answer and the sobering one.
//
// ── THREE THINGS THE SERVER DOES THAT THIS FILE MUST NOT UNDO ────────
//
// The implement is part of the event. Shot Put (5kg) is a different
// discipline from Shot Put, so a fifteen-year-old is only ever compared
// against fifteen-year-olds on the same implement. The senior career is
// returned alongside, because the same athletes keep throwing after they
// move up and a career that appears to stop at seventeen is a lie.
//
// n comes back with every band. A trajectory drawn off nine athletes and
// one drawn off nine hundred must not look alike, and that decision cannot
// be made here if the number is thrown away.
//
// A projection is a description of a population, never a forecast for the
// person reading it. Boccia tracked 5,981 jumpers: of those in the world
// top 50 at sixteen, 8% of men and 16% of women ever made the senior top
// 50. `disclaimer` below exists so no screen has to remember that.


// ═══════════════════════════════════════════════════════════════════════

// ── The size of the thing, in one place ────────────────────────────────
// Every screen that cites the corpus was citing a different number, and all
// of them were stale: "10,423 Olympic-pipeline careers" on the coach's
// Projected Career Paths (shown to users), "6,892 careers" in three source
// comments, "1,084,255 results" in a fourth. The corpus has been re-ingested
// since; on 2 Sep 2026 it held 7,215 careers carrying a date of birth, out of
// 7,705 athletes and 1,207,608 results.
//
// A figure quoted to a user is a claim, so it gets one definition and a date.
// Re-measure with:
//   select count(distinct r.athlete_id) from reference.results r
//     join reference.athletes a on a.id = r.athlete_id where a.dob is not null;
export const CORPUS_CAREERS = 7215
export const CORPUS_RESULTS = 1207608
export const CORPUS_MEASURED = '2 Sep 2026'

/** "7,215" — the corpus size, ready to drop into a sentence. */
export const corpusCareers = () => CORPUS_CAREERS.toLocaleString('en-GB')

import { callRpc } from './supabase'

export type SimilarAthlete = {
  athlete: string
  nationality: string | null
  /** The age they were when they set the mark below. Within a year of the
      athlete's own — it is stated rather than implied, because the previous
      version showed the age of their CAREER best and it read as this one. */
  matchedAge: number
  /** Their season best at the age you are now, in your event and implement. */
  atYourAge: number
  /** Their best in that same event — which, for an age-group implement,
      is capped by the age they stopped using it. */
  bestSameEvent: number
  /** The adult-implement event, named. Equal to yours when you are already
      on the senior specification. */
  seniorEvent: string | null
  seniorBest: number | null
  ageAtSeniorBest: number | null
  yearsStillCompeting: number | null
}

export type BandPoint = {
  age: number
  /** Which specification this age is measured on. It changes mid-career
      for an age-group event, and a chart that switched silently would be
      worse than one that stopped. */
  discipline: string
  disciplineId: string
  n: number
  p25: number
  p50: number
  p75: number
}

export type Coverage = {
  disciplineId: string
  athletes: number
  seasons: number
  youngest: number
  oldest: number
} | null

const num = (v: any): number | null => {
  const n = typeof v === 'number' ? v : parseFloat(v)
  return Number.isFinite(n) ? n : null
}

/**
 * Real athletes who were at this mark at this age.
 *
 * Returns [] rather than throwing when the corpus has nothing — an event
 * it does not cover, or an age nobody competed at. A screen should render
 * that as "no comparison yet", not as an error.
 */
export async function similarAthletes(opts: {
  discipline: string
  sex: string | null | undefined
  age: number
  mark: number
  limit?: number
}): Promise<SimilarAthlete[]> {
  if (!opts.discipline || !Number.isFinite(opts.age) || !Number.isFinite(opts.mark)) return []
  try {
    const rows = await callRpc('corpus_similar_athletes', {
      p_discipline: opts.discipline,
      p_sex: opts.sex || 'M',
      p_age: opts.age,
      p_mark: opts.mark,
      p_limit: opts.limit ?? 8,
    })
    if (!Array.isArray(rows)) return []
    return rows.map((r: any) => ({
      athlete: String(r.athlete || ''),
      nationality: r.nationality || null,
      matchedAge: num(r.matched_age) as number,
      atYourAge: num(r.at_your_age) as number,
      bestSameEvent: num(r.best_same_event) as number,
      seniorEvent: r.senior_event || null,
      seniorBest: num(r.senior_best),
      ageAtSeniorBest: num(r.age_at_senior_best),
      yearsStillCompeting: num(r.years_still_competing),
    })).filter((r) => r.athlete && r.atYourAge != null)
  } catch {
    return []
  }
}

/** What athletes at this level went on to do, age by age. */
export async function trajectoryBand(opts: {
  discipline: string
  sex: string | null | undefined
  age: number
  mark: number
}): Promise<BandPoint[]> {
  if (!opts.discipline || !Number.isFinite(opts.age) || !Number.isFinite(opts.mark)) return []
  try {
    const rows = await callRpc('corpus_trajectory_band', {
      p_discipline: opts.discipline,
      p_sex: opts.sex || 'M',
      p_age: opts.age,
      p_mark: opts.mark,
    })
    if (!Array.isArray(rows)) return []
    return rows.map((r: any) => ({
      age: num(r.season_age) as number,
      discipline: String(r.discipline || ''),
      disciplineId: String(r.discipline_id || ''),
      n: num(r.n) as number,
      p25: num(r.p25) as number,
      p50: num(r.p50) as number,
      p75: num(r.p75) as number,
    })).filter((r) => r.age != null && r.n != null)
  } catch {
    return []
  }
}

export async function coverage(discipline: string, sex: string | null | undefined): Promise<Coverage> {
  if (!discipline) return null
  try {
    const rows = await callRpc('corpus_coverage', { p_discipline: discipline, p_sex: sex || 'M' })
    const r = Array.isArray(rows) ? rows[0] : rows
    if (!r) return null
    return {
      disciplineId: String(r.discipline_id || ''),
      athletes: num(r.athletes) as number,
      seasons: num(r.seasons) as number,
      youngest: num(r.youngest) as number,
      oldest: num(r.oldest) as number,
    }
  } catch {
    return null
  }
}

export type PeakAge = { peak: number; p25: number; p75: number; n: number } | null

/**
 * The age athletes in this event actually peaked at, per sex.
 *
 * Replaces a table of 21 hand-written numbers that were the same for both
 * sexes and defaulted to 27 for anything unlisted. Returns null rather than
 * a guess when fewer than 20 careers support it — a peak age off six people
 * is a rumour.
 */
export async function peakAge(discipline: string, sex: string | null | undefined): Promise<PeakAge> {
  if (!discipline) return null
  try {
    const rows = await callRpc('corpus_peak_age', { p_discipline: discipline, p_sex: sex || 'M' })
    const r = Array.isArray(rows) ? rows[0] : rows
    if (!r || r.peak_age == null) return null
    return { peak: num(r.peak_age) as number, p25: num(r.p25_age) as number,
             p75: num(r.p75_age) as number, n: num(r.n) as number }
  } catch {
    return null
  }
}

// ── How much weight a band can carry ─────────────────────────────────
//
// Drawn from the sample at the athlete's own age, not the sample overall.
// The 100m women's corpus holds 1,571 athletes, but the band at fourteen
// may rest on eleven of them, and it is the eleven that decide how firmly
// a line may be drawn.

export type Confidence = 'none' | 'indicative' | 'fair' | 'strong'

export function confidenceAt(band: BandPoint[], age: number): Confidence {
  const near = band.filter((b) => Math.abs(b.age - age) <= 1)
  const n = near.length ? Math.max(...near.map((b) => b.n)) : 0
  if (n < 5) return 'none'
  if (n < 20) return 'indicative'
  if (n < 60) return 'fair'
  return 'strong'
}

export const CONFIDENCE_COPY: Record<Confidence, string> = {
  none: 'Too few athletes at your age to show a range yet.',
  indicative: 'Drawn from a handful of athletes — treat it as a hint, not a forecast.',
  fair: 'Drawn from a few dozen athletes at your age.',
  strong: 'Drawn from hundreds of athletes at your age.',
}

/**
 * The sentence that has to sit under any projection.
 *
 * Not decoration. Junior standing is a weak predictor of senior standing,
 * and a chart that arrives somewhere invites exactly the wrong reading.
 */
export const PROJECTION_DISCLAIMER =
  'This is what other athletes did, not what you will do. Most athletes who '
  + 'are ahead at sixteen are not ahead at twenty-five, and plenty who are '
  + 'behind now are not later.'

/** A band widens; it does not arrive. Handy for the chart to key off. */
export const bandWidth = (b: BandPoint) => Math.abs(b.p75 - b.p25)


// ── Where a mark sits in the world ───────────────────────────────────
//
// The Boards tab can only rank an athlete against other bnchmrkd accounts.
// With a squad of one it has nothing to say, and the screen becomes four
// rows of filters over an apology. This does not depend on anybody else
// signing up: 892 ranked senior men have run a 100m in the corpus, so
// "where do I stand" has an answer today.
//
// The population is ELITE and every surface that draws this has to say so.
// "Faster than 54% of men" is a different and much bigger claim than
// "faster than 54% of RANKED senior men", and only the second one is true.

export type MarkDistribution = {
  /** Histogram buckets, low to high mark. */
  bins: { lo: number; hi: number; n: number }[]
  /** Season bests behind the curve, and the people who set them. */
  total: number
  athletes: number
  /** Share of the population this mark beats, in the event's own direction. */
  percentile: number
  lowerBetter: boolean
  p05: number
  p50: number
  p95: number
} | null

export async function markDistribution(opts: {
  discipline: string
  sex: string | null | undefined
  mark: number
  ageLo?: number
  ageHi?: number
}): Promise<MarkDistribution> {
  if (!opts.discipline || !Number.isFinite(opts.mark)) return null
  try {
    const rows = await callRpc('corpus_mark_distribution', {
      p_discipline: opts.discipline,
      p_sex: opts.sex || 'M',
      p_mark: opts.mark,
      p_age_lo: opts.ageLo ?? 20,
      p_age_hi: opts.ageHi ?? 34,
    })
    if (!Array.isArray(rows) || !rows.length) return null
    const first: any = rows[0]
    const bins = rows
      .map((r: any) => ({ lo: num(r.lo) as number, hi: num(r.hi) as number, n: num(r.n) as number }))
      .filter((b) => b.lo != null && b.hi != null && b.n != null)
    if (bins.length < 4) return null
    return {
      bins,
      total: num(first.total) as number,
      athletes: num(first.athletes) as number,
      percentile: num(first.percentile) ?? 0,
      lowerBetter: !!first.lower_better,
      p05: num(first.p05) as number,
      p50: num(first.p50) as number,
      p95: num(first.p95) as number,
    }
  } catch {
    return null
  }
}
