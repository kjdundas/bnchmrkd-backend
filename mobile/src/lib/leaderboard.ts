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
import { isLowerBetter } from './disciplineScience'
import type { SquadAthlete } from './squads'

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
