// ═══════════════════════════════════════════════════════════════════════
// NEEDS ATTENTION — who a coach should look at first.
//
// Lifted out of CoachHomeScreen because it had two bugs in it at once, and
// both were invisible in a screen file: it iterated the wrong population and
// read readiness from a different source than the panel directly below it.
// Logic that decides which fourteen-year-old a coach is shown first belongs
// somewhere it can be exercised.
//
// ── THE POPULATION RULE ───────────────────────────────────────────────
// Everything here runs over the squad AS FILTERED. Two consequences, both
// deliberate:
//
//   A roster athlete — no phone, no account — is a first-class subject.
//   The old version read a linked-athletes RPC, so an athlete without an
//   app could not be flagged however urgent they were. That is exactly
//   backwards: they are the one with no other way to reach their coach.
//
//   Filtering to a squad filters this too. Anything else and the screen
//   looks like it ignored the instruction it was just given.
//
// ── THE SOURCE RULE ───────────────────────────────────────────────────
// Readiness comes from the same check-in rows the wellness panel draws.
// Two panels on one screen answering "how is she" from two queries will
// eventually disagree in front of a coach, and the first time they do,
// both stop being believed.
// ═══════════════════════════════════════════════════════════════════════

import { checkinStatus, READINESS_COLORS, isToday } from './readiness'
import { growthHeadline, GROWTH_TONE, type GrowthReading } from './growth'
import { ageFromDob } from './age'
import { keyOf, type SquadAthlete, type SharedCheckin } from './squads'

export type AttentionKind = 'readiness' | 'growth' | 'compliance' | 'quiet'

export type AttentionItem = {
  key: string
  kind: AttentionKind
  /** Sorted descending. See RANK below for why growth outranks a bad night. */
  rank: number
  headline: string
  detail: string
  icon: string
  color: string
  athlete: SquadAthlete
}

/**
 * What gets seen first when several things are wrong at once.
 *
 * A red check-in outranks everything because it is today and it is a person
 * telling you something. A rapid growth flag comes next: it is a weeks-long
 * window rather than an emergency, but it is the one a coach can actually
 * plan around, and it is the one that goes unnoticed for a term if it is not
 * put in front of them. Gone-quiet sits last — it is information, not a
 * problem, and it should never push a flagged athlete down the list.
 */
export const RANK = {
  readinessRed: 5,
  growthRapid: 4,
  readinessAmber: 3,
  compliance: 2,
  growthWatch: 1,
  quiet: 0,
} as const

/** No result in this many days and an athlete has gone quiet. */
export const QUIET_DAYS = 14

/** Growth monitoring applies to people who are still growing. */
export const GROWTH_MAX_AGE = 19

export type AttentionInput = {
  athletes: SquadAthlete[]
  checkins: Map<string, SharedCheckin[]>
  growth: Map<string, GrowthReading>
  results: Map<string, any[]>
  /** program_compliance by athlete_user_id — account holders only have one. */
  compliance: Map<string, any>
  /** Injected so the tests are not a function of the day they run on. */
  now?: number
}

export function buildAttention(input: AttentionInput): AttentionItem[] {
  const { athletes, checkins, growth, results, compliance } = input
  const now = input.now ?? Date.now()
  const out: AttentionItem[] = []
  // Monday = 0. Nobody is "behind on the week" on a Monday morning.
  const dow = (new Date(now).getDay() + 6) % 7

  for (const a of athletes) {
    const k = keyOf(a)
    if (!k) continue

    // ── readiness ───────────────────────────────────────────────────
    // Only today's check-in counts. A red from last Tuesday presented as a
    // flag now is worse than no flag: it sends a coach to ask about a bad
    // night the athlete has long since slept off.
    const ck = checkins.get(k) || []
    const latest = ck.length ? ck[ck.length - 1] : null
    if (latest && isToday(latest as any, now)) {
      const status = checkinStatus(latest as any)
      if (status.level === 'red' || status.level === 'amber') {
        out.push({
          key: `${k}-r`, kind: 'readiness', athlete: a,
          rank: status.level === 'red' ? RANK.readinessRed : RANK.readinessAmber,
          headline: `${a.name} · ${status.label}`,
          detail: status.reasons.join(' · ') || 'Flagged on check-in',
          icon: 'heart-outline', color: READINESS_COLORS[status.level],
        })
      }
    }

    // ── growth ──────────────────────────────────────────────────────
    const g = growth.get(k)
    const age = ageFromDob(a.dob)
    if (g && (g.level === 'rapid' || g.level === 'watch')
        && age != null && age < GROWTH_MAX_AGE) {
      out.push({
        key: `${k}-g`, kind: 'growth', athlete: a,
        rank: g.level === 'rapid' ? RANK.growthRapid : RANK.growthWatch,
        headline: `${a.name} · growing ${g.level === 'rapid' ? 'fast' : 'quickly'}`,
        detail: growthHeadline(g),
        icon: 'resize-outline', color: GROWTH_TONE[g.level],
      })
    }

    // ── behind on the program ───────────────────────────────────────
    const comp = a.athlete_user_id ? compliance.get(a.athlete_user_id) : null
    if (comp && comp.sessions_per_week && dow >= 3
        && (comp.done_this_week / comp.sessions_per_week) < 0.5) {
      out.push({
        key: `${k}-c`, kind: 'compliance', athlete: a, rank: RANK.compliance,
        headline: `${a.name} · behind on program`,
        detail: `${comp.done_this_week}/${comp.sessions_per_week} sessions this week`,
        icon: 'barbell-outline', color: '#fbbf24',
      })
    }

    // ── gone quiet ──────────────────────────────────────────────────
    // Off the results map, so it works for both kinds of athlete. The
    // version this replaced walked a denormalised blob that only ever
    // existed on an account holder's row.
    const rows = results.get(k) || []
    let newest: number | null = null
    for (const r of rows) {
      const t = new Date(r?.competition_date).getTime()
      if (!Number.isNaN(t) && (newest == null || t > newest)) newest = t
    }
    if (newest != null) {
      const days = Math.floor((now - newest) / 86400000)
      if (days >= QUIET_DAYS) {
        out.push({
          key: `${k}-q`, kind: 'quiet', athlete: a, rank: RANK.quiet,
          headline: `${a.name} · gone quiet`,
          detail: `No result in ${days} days`,
          icon: 'time-outline', color: '#64748b',
        })
      }
    }
  }

  // Stable within a rank: same inputs, same order, every render.
  return out.sort((x, y) => y.rank - x.rank || x.headline.localeCompare(y.headline))
}

/** How many of the squad on screen checked in today. */
export function checkedInToday(
  athletes: SquadAthlete[], checkins: Map<string, SharedCheckin[]>, now?: number,
): { checked: number; withAccounts: number } {
  const withAccounts = athletes.filter((a) => !!a.athlete_user_id)
  const checked = withAccounts.filter((a) => {
    const ck = checkins.get(keyOf(a)) || []
    const latest = ck.length ? ck[ck.length - 1] : null
    return !!latest && isToday(latest as any, now)
  }).length
  return { checked, withAccounts: withAccounts.length }
}
