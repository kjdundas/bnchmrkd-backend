// ═══════════════════════════════════════════════════════════════════════
// LEADERBOARDS — the squad ranked, by event.
//
// Ranking is grouped by discipline and never across it: a 400m runner and a
// hammer thrower have no common scale, and a single ordered list of a whole
// squad would be a category error dressed up as a table.
//
// Every mark here has already been through countsForAnalysis, which is the
// same gate the athlete's own screens use. So a wind-assisted sprint, a DNF,
// and — this is the part that makes the approval flow worth doing — a result
// the coach has not yet approved, are all absent. A leaderboard you can move
// by logging an unverified time is not a leaderboard.
// ═══════════════════════════════════════════════════════════════════════

import { countsForAnalysis } from './resultSemantics'
import { isLowerBetter, sameDiscipline } from './disciplineScience'
import { isLowerBetter as metricLowerIsBetter, countsAsMetric } from './metricSemantics'
import { eventsOf, type SquadAthlete } from './squads'
import { ageFromDob } from './age'
import { getAgeGroup } from './performanceLevels'

export type RankMode = 'pb' | 'season'

export type Ranked = {
  athlete: SquadAthlete
  mark: number
  when: string | null
  /** Shared by everyone on the same mark — see the tie note below. */
  rank: number
  results: number
}

export type Board = { discipline: string; rows: Ranked[] }

/** The season an athlete is currently being ranked in. */
export function currentSeason(today = new Date()): string {
  return String(today.getFullYear())
}

function bestOf(results: any[], discipline: string, mode: RankMode, season: string) {
  const legal = (results || []).filter((r) => {
    // The row has to BE this event. countsForAnalysis takes a discipline
    // only to decide whether the wind rule applies, not to check the row
    // against it — without this a sprinter's 60m ranks on the 100m board.
    if (!sameDiscipline(r.discipline, discipline)) return false
    if (!countsForAnalysis(r, discipline)) return false
    if (mode === 'season') {
      // The date is a plain YYYY-MM-DD; slice the year off the string rather
      // than going through Date, which reads it as UTC midnight and returns
      // the previous year for 1 January east of Greenwich.
      return String(r.competition_date || '').slice(0, 4) === season
    }
    return true
  })
  if (!legal.length) return null
  const lower = isLowerBetter(discipline)
  let best = legal[0]
  for (const r of legal) {
    const m = Number(r.mark)
    const b = Number(best.mark)
    if (!Number.isFinite(m)) continue
    if (!Number.isFinite(b) || (lower ? m < b : m > b)) best = r
  }
  const mark = Number(best.mark)
  return Number.isFinite(mark)
    ? { mark, when: best.competition_date || null, results: legal.length }
    : null
}

/**
 * One board per discipline, best first.
 *
 * An athlete with no legal mark in the mode being shown is left out entirely
 * rather than listed last with a dash. A leaderboard is a ranking, and a row
 * with nothing to rank is noise — the squad screen is where you see everyone.
 *
 * Ties share a rank and the next rank skips, the way results are read out at
 * a track meeting: two athletes on 11.40 are both 1st, and the next is 3rd.
 */
export function buildBoards(
  athletes: SquadAthlete[],
  resultsBy: Map<string, any[]>,
  mode: RankMode,
  season = currentSeason(),
): Board[] {
  const byDiscipline = new Map<string, Ranked[]>()

  for (const a of athletes) {
    const discipline = (a.discipline || '').trim()
    if (!discipline) continue
    const key = (a.athlete_user_id || a.roster_athlete_id) as string
    const best = bestOf(resultsBy.get(key) || [], discipline, mode, season)
    if (!best) continue
    const list = byDiscipline.get(discipline) || []
    list.push({ athlete: a, mark: best.mark, when: best.when, results: best.results, rank: 0 })
    byDiscipline.set(discipline, list)
  }

  const boards: Board[] = []
  for (const [discipline, rows] of byDiscipline) {
    const lower = isLowerBetter(discipline)
    rows.sort((x, y) => (lower ? x.mark - y.mark : y.mark - x.mark)
      || x.athlete.name.localeCompare(y.athlete.name))
    let rank = 0
    let prev: number | null = null
    rows.forEach((r, i) => {
      if (prev === null || r.mark !== prev) rank = i + 1
      r.rank = rank
      prev = r.mark
    })
    boards.push({ discipline, rows })
  }

  // Biggest events first, then alphabetically — a coach's main group should
  // not be below a discipline with one athlete in it.
  boards.sort((a, b) => b.rows.length - a.rows.length || a.discipline.localeCompare(b.discipline))
  return boards
}

/** How many athletes have nothing to show in this mode, and why. */
export function excludedCount(
  athletes: SquadAthlete[], boards: Board[],
): number {
  const shown = new Set<string>()
  for (const b of boards) for (const r of b.rows) {
    shown.add((r.athlete.athlete_user_id || r.athlete.roster_athlete_id) as string)
  }
  return athletes.filter(
    (a) => !shown.has((a.athlete_user_id || a.roster_athlete_id) as string)).length
}


// ── Who is in the running ─────────────────────────────────────────────
// Each filter is a SET, and an empty set means "all of them" rather than
// "none of them". That is the difference between a filter row you can leave
// alone and one you have to fully populate before anything appears.

export type Filters = {
  disciplines: Set<string>
  ageGroups: Set<string>
  genders: Set<string>
}

export const emptyFilters = (): Filters => ({
  disciplines: new Set(), ageGroups: new Set(), genders: new Set(),
})

export function genderOf(a: SquadAthlete): 'M' | 'F' | null {
  const g = (a.gender || '').trim().toUpperCase()
  if (!g) return null
  return g.startsWith('F') || g === 'WOMAN' ? 'F' : 'M'
}

export function ageGroupOf(a: SquadAthlete): string | null {
  const age = ageFromDob(a.dob)
  return age == null ? null : getAgeGroup(age)
}

/**
 * An athlete passes a group if it is empty, or if they match it.
 *
 * Someone with no date of birth or no recorded sex is EXCLUDED once that
 * filter is switched on, and included while it is off. Guessing either would
 * put a person in an age group or a sex category they may not belong to, on
 * a ranking their coach is going to show them.
 */
export function passes(a: SquadAthlete, f: Filters): boolean {
  if (f.disciplines.size) {
    const mine = eventsOf(a)
    if (!mine.some((d) => [...f.disciplines].some((x) => sameDiscipline(d, x)))) return false
  }
  if (f.ageGroups.size) {
    const g = ageGroupOf(a)
    if (!g || !f.ageGroups.has(g)) return false
  }
  if (f.genders.size) {
    const g = genderOf(a)
    if (!g || !f.genders.has(g)) return false
  }
  return true
}

const AGE_ORDER = ['U13', 'U15', 'U17', 'U20', 'Senior']

/** Only what this squad actually offers — never a chip that matches nobody. */
export function filterOptions(athletes: SquadAthlete[]) {
  const disciplines = new Set<string>()
  const ageGroups = new Set<string>()
  const genders = new Set<string>()
  for (const a of athletes) {
    for (const d of eventsOf(a)) disciplines.add(d)
    const g = ageGroupOf(a); if (g) ageGroups.add(g)
    const s = genderOf(a); if (s) genders.add(s)
  }
  return {
    disciplines: [...disciplines].sort(),
    ageGroups: [...ageGroups].sort((x, y) => AGE_ORDER.indexOf(x) - AGE_ORDER.indexOf(y)),
    genders: [...genders].sort(),
  }
}

// ── Physical tests ────────────────────────────────────────────────────

export type MetricRow = {
  athlete: SquadAthlete; value: number; when: string | null; rank: number; results: number
}
export type MetricBoard = { key: string; label: string; unit: string; rows: MetricRow[] }

/**
 * One board per test, best first — and "best" is per test, not per column.
 * A 10 m split and a squat 1RM both live in this table and run in opposite
 * directions, so the direction comes from the metric key every time.
 */
/**
 * Tests that are measurements of a body rather than of a performance, and
 * so are never ranked. Body mass, height, wingspan and every fat metric are
 * facts about an athlete, not achievements — putting a squad of teenagers in
 * descending order of body fat is a leaderboard nobody asked for and a good
 * way to do harm. They still show on the athlete's own profile, where they
 * belong; they just do not become a table the whole squad can be measured
 * against.
 */
const NEVER_RANKED = new Set<string>([
  'body_mass', 'standing_height', 'sitting_height', 'wingspan', 'lean_mass',
  'body_fat', 'body_fat_pct', 'sum_7_skinfolds', 'fat_mass',
])
export const isRankable = (key: string) => !NEVER_RANKED.has(key)

export function buildMetricBoards(
  athletes: SquadAthlete[],
  metricsBy: Map<string, any[]>,
): MetricBoard[] {
  const byKey = new Map<string, MetricBoard>()

  for (const a of athletes) {
    const key = (a.athlete_user_id || a.roster_athlete_id) as string
    const rows = metricsBy.get(key) || []
    const bestPer = new Map<string, any>()
    for (const r of rows) {
      const v = Number(r?.value)
      if (!r?.metric_key || !isRankable(r.metric_key) || !Number.isFinite(v)) continue
      // The same gate the athlete's own screens use — a test the coach has
      // not answered cannot move the board they are answering it on.
      if (!countsAsMetric(r)) continue
      const lower = metricLowerIsBetter(r.metric_key)
      const cur = bestPer.get(r.metric_key)
      if (!cur || (lower ? v < Number(cur.value) : v > Number(cur.value))) bestPer.set(r.metric_key, r)
    }
    for (const [k, r] of bestPer) {
      const board: MetricBoard = byKey.get(k)
        || { key: k, label: r.metric_label || k, unit: r.unit || '', rows: [] }
      board.rows.push({
        athlete: a, value: Number(r.value), when: r.recorded_at || null, rank: 0,
        results: rows.filter((x: any) => x.metric_key === k && countsAsMetric(x)).length,
      })
      byKey.set(k, board)
    }
  }

  const boards = [...byKey.values()]
  for (const b of boards) {
    const lower = metricLowerIsBetter(b.key)
    b.rows.sort((x, y) => (lower ? x.value - y.value : y.value - x.value)
      || x.athlete.name.localeCompare(y.athlete.name))
    let rank = 0
    let prev: number | null = null
    b.rows.forEach((r, i) => {
      if (prev === null || r.value !== prev) rank = i + 1
      r.rank = rank
      prev = r.value
    })
  }
  boards.sort((x, y) => y.rows.length - x.rows.length || x.label.localeCompare(y.label))
  return boards
}
