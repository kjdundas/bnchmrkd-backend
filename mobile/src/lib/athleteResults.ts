// ═══════════════════════════════════════════════════════════════════════
// ATHLETE RESULTS — one shape, whoever the athlete is.
//
// A result belongs to EITHER an account or a roster entry, never both. The
// coach adds athletes who have no phone and enters everything for them, and
// those results now live in `performances` alongside everyone else's rather
// than in a JSON array on the roster row.
//
// That JSON array is why a coach and an athlete could look at the same
// career and disagree. It carried `value` and `date` and nothing else — no
// status, no wind — so the coach's view of a mark could not apply the rules
// the athlete's view applied. A +2.9 sprint was a personal best to one of
// them and not to the other.
//
// Everything here therefore goes through countsForAnalysis, the single gate,
// exactly as the athlete's own screens do.
// ═══════════════════════════════════════════════════════════════════════

import { selectFrom } from './supabase'
import { countsForAnalysis } from './resultSemantics'
import { isLowerBetter } from './disciplineScience'

export type Subject =
  | { userId: string; rosterId?: never }
  | { rosterId: string; userId?: never }

/** Results for either kind of athlete, newest first. */
export async function fetchResults(subject: Subject): Promise<any[]> {
  const filter = subject.userId
    ? `user_id=eq.${subject.userId}`
    : `roster_athlete_id=eq.${subject.rosterId}`
  try {
    return (await selectFrom('performances', {
      filter,
      order: 'competition_date.desc',
    })) as any[]
  } catch {
    return []
  }
}

/** Reads a navigation param that may carry either kind of athlete. */
export function subjectOf(athlete: any): Subject | null {
  if (athlete?.linked_user_id) return { userId: String(athlete.linked_user_id) }
  if (athlete?.user_id) return { userId: String(athlete.user_id) }
  if (athlete?.id) return { rosterId: String(athlete.id) }
  return null
}

/**
 * Results for a whole squad in two queries rather than one per athlete.
 *
 * A coach with thirty athletes would otherwise make thirty round trips to
 * draw one leaderboard. PostgREST takes an `in.(...)` list, and the subjects
 * split cleanly in two because an account and a roster entry live in
 * different columns.
 *
 * Returns a map keyed by the id each athlete is addressed by, so the caller
 * never has to know which kind they were.
 */
export async function fetchResultsForMany(
  subjects: Subject[],
): Promise<Map<string, any[]>> {
  const userIds = subjects.map((s) => s.userId).filter(Boolean) as string[]
  const rosterIds = subjects.map((s) => s.rosterId).filter(Boolean) as string[]
  const out = new Map<string, any[]>()
  for (const id of [...userIds, ...rosterIds]) out.set(id, [])

  const pull = async (col: string, ids: string[]) => {
    if (!ids.length) return
    try {
      const rows = (await selectFrom('performances', {
        filter: `${col}=in.(${ids.join(',')})`,
        order: 'competition_date.desc',
        limit: '2000',
      })) as any[]
      for (const r of rows || []) {
        const key = r[col]
        if (key) out.get(key)?.push(r)
      }
    } catch { /* an empty leaderboard beats a crashed one */ }
  }
  await Promise.all([pull('user_id', userIds), pull('roster_athlete_id', rosterIds)])
  return out
}

/** The best legal mark, or null. Same rules the athlete's own screen uses. */
export function pbOf(results: any[], discipline: string): number | null {
  const marks = (results || [])
    .filter((r) => countsForAnalysis(r, discipline))
    .map((r) => Number(r.mark))
    .filter(Number.isFinite)
  if (!marks.length) return null
  return isLowerBetter(discipline) ? Math.min(...marks) : Math.max(...marks)
}

/** Best legal mark per calendar year, newest year first. */
export function seasonBestsOf(
  results: any[], discipline: string,
): { year: string; best: number; count: number }[] {
  const lower = isLowerBetter(discipline)
  const byYear = new Map<string, number[]>()
  for (const r of results || []) {
    if (!countsForAnalysis(r, discipline)) continue
    // The date is a plain YYYY-MM-DD; take the year off the string rather
    // than through Date, which would read it as UTC midnight and hand back
    // the previous year for anything on 1 January east of Greenwich.
    const year = String(r.competition_date || '').slice(0, 4)
    if (year.length !== 4) continue
    const v = Number(r.mark)
    if (!Number.isFinite(v)) continue
    byYear.set(year, [...(byYear.get(year) || []), v])
  }
  return [...byYear.entries()]
    .map(([year, vals]) => ({
      year,
      best: lower ? Math.min(...vals) : Math.max(...vals),
      count: vals.length,
    }))
    .sort((a, b) => b.year.localeCompare(a.year))
}

/** Improving, going backwards, or neither — from the last two legal marks. */
export function trendOf(results: any[], discipline: string): 'up' | 'down' | null {
  const legal = (results || [])
    .filter((r) => countsForAnalysis(r, discipline) && r.competition_date)
    .sort((a, b) => String(b.competition_date).localeCompare(String(a.competition_date)))
  if (legal.length < 2) return null
  const curr = Number(legal[0].mark)
  const prev = Number(legal[1].mark)
  if (!Number.isFinite(curr) || !Number.isFinite(prev)) return null
  const better = isLowerBetter(discipline) ? curr < prev : curr > prev
  const worse = isLowerBetter(discipline) ? curr > prev : curr < prev
  return better ? 'up' : worse ? 'down' : null
}
