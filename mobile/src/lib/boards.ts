// ═══════════════════════════════════════════════════════════════════════
// LEADERBOARDS, FROM THE ATHLETE'S SIDE.
//
// The coach's boards are a list of people. This one cannot be, because the
// people on it are each other's teammates and half of them are minors. So
// the device never receives a list at all: it asks the database for a RANK
// and a FIELD SIZE and gets back two integers and its own value.
//
// That is the whole design. There is no row of somebody else's data on the
// phone to screenshot, inspect in a debugger, or leak through a crash log —
// not because the screen chooses not to draw it, but because it was never
// sent.
//
// Everything that decides WHO is in the field lives in `board_position` in
// the database: opted-in only, account-holders only, approved rows only,
// the athlete's own physical-test sharing switch, and body measurements
// excluded outright. Those are SECURITY DEFINER functions, so RLS does not
// help them — the rules are written out inside them. This file is the view.
//
// ── WHAT THIS FILE MAY DECIDE ────────────────────────────────────────
// Direction — whether a lower number is better — is passed IN rather than
// re-derived in SQL. It is a domain fact the app already answers in one
// place, and getting it wrong produces a wrong ranking, never a leak. The
// privacy rules stay in the database; the athletics stays here.
// ═══════════════════════════════════════════════════════════════════════

import { callRpc } from './supabase'
import { isLowerBetter, REFERENCE_RANGES } from './disciplineScience'

export type Scope = 'squad' | 'city' | 'region' | 'world'
export type Kind = 'performance' | 'metric'

export const SCOPES: { key: Scope; label: string; blurb: string }[] = [
  { key: 'squad',  label: 'Squad',  blurb: 'Everyone your coach trains with you.' },
  { key: 'city',   label: 'City',   blurb: 'Athletes in your city using bnchmrkd.' },
  { key: 'region', label: 'Region', blurb: 'Your wider area.' },
  { key: 'world',  label: 'World',  blurb: 'Everyone on bnchmrkd.' },
]

/** Why a board has nothing to say. Never a thrown error — these are answers. */
export type Reason =
  | 'signed_out' | 'opted_out' | 'not_rankable'
  | 'too_few' | 'no_result_of_your_own'

export type Position = {
  rank: number | null
  field: number
  value: number | null
  minField: number
  band: 'top_quarter' | 'upper_half' | 'lower_half' | 'bottom_quarter' | null
  reason: Reason | null
}

export const BAND_LABEL: Record<string, string> = {
  top_quarter: 'Top quarter',
  upper_half: 'Upper half',
  lower_half: 'Lower half',
  bottom_quarter: 'Bottom quarter',
}

/** Whether a smaller number wins, for either kind of board. */
export function lowerIsBetter(kind: Kind, key: string): boolean {
  if (kind === 'performance') return isLowerBetter(key)
  const r = (REFERENCE_RANGES as any)[key]
  // An unknown metric is assumed higher-is-better, which is true of most of
  // the catalogue. It is a wrong ranking rather than an exposure, and the
  // screen names the metric so a wrong one is obvious.
  return !!(r && r.lowerBetter)
}

function readPosition(raw: any): Position {
  const r = raw || {}
  return {
    rank: typeof r.rank === 'number' ? r.rank : null,
    field: typeof r.field === 'number' ? r.field : 0,
    value: typeof r.value === 'number' ? r.value : null,
    minField: typeof r.min_field === 'number' ? r.min_field : 5,
    band: r.band ?? null,
    reason: r.reason ?? null,
  }
}

export async function fetchPosition(opts: {
  scope: Scope
  kind: Kind
  key: string
  ageGroups?: string[]
  genders?: string[]
}): Promise<Position> {
  const raw = await callRpc('board_position', {
    p_scope: opts.scope,
    p_kind: opts.kind,
    p_key: opts.key,
    p_lower_better: lowerIsBetter(opts.kind, opts.key),
    p_age_groups: opts.ageGroups?.length ? opts.ageGroups : null,
    p_genders: opts.genders?.length ? opts.genders : null,
  })
  return readPosition(raw)
}

export type ScopeCounts = Partial<Record<Scope, number>> & { minField: number }

/** How many people each scope is waiting for. Counts, never names. */
export async function fetchScopeCounts(opts: {
  kind: Kind
  key: string
  ageGroups?: string[]
  genders?: string[]
}): Promise<ScopeCounts> {
  const raw = await callRpc('board_scope_counts', {
    p_kind: opts.kind,
    p_key: opts.key,
    p_age_groups: opts.ageGroups?.length ? opts.ageGroups : null,
    p_genders: opts.genders?.length ? opts.genders : null,
  }) || {}
  return {
    squad: raw.squad, city: raw.city, region: raw.region, world: raw.world,
    minField: typeof raw.min_field === 'number' ? raw.min_field : 5,
  }
}

// ── Drawing the field ────────────────────────────────────────────────
//
// There was a `ladderRows` here that expanded a rank and a field size into
// a list of rows to draw — podium, you and your neighbours, last place,
// with gap markers between. The screen rendered each of those as a
// full-width bar, and since the device never receives anybody else's value
// by design, seven of the eight bars were empty.
//
// That is worse than drawing nothing. A bar implies a quantity, so a column
// of empty ones reads as data that failed to load — it made the privacy
// guarantee look like a bug. `FieldStrip` now draws the two facts we
// actually hold, the size of the field and which position is yours, and it
// does it in one element rather than nine rows.
//
// The ordinal below survives because an athlete still says "sixth" out loud.

/** "4th", "1st", "22nd" — the ordinal an athlete would say out loud. */
export function ordinal(n: number): string {
  const rem100 = n % 100
  if (rem100 >= 11 && rem100 <= 13) return `${n}th`
  switch (n % 10) {
    case 1: return `${n}st`
    case 2: return `${n}nd`
    case 3: return `${n}rd`
    default: return `${n}th`
  }
}

/**
 * What to say when there is no position, in the athlete's terms.
 *
 * Every one of these is an answer rather than a failure, so none of them is
 * phrased as an error. "Too few" in particular is a promise being kept, not
 * something going wrong, and the copy says so.
 */
export function explain(p: Position, scope: Scope): { title: string; body: string } {
  const where = scope === 'squad' ? 'your squad'
    : scope === 'city' ? 'your city'
    : scope === 'region' ? 'your area' : 'bnchmrkd'

  switch (p.reason) {
    case 'too_few':
      return {
        title: p.field === 0 ? `Nobody in ${where} yet` : 'Not enough people yet',
        body: p.field === 0
          ? `No one in ${where} has a result for this. Yours will be the first.`
          : `${p.field} ${p.field === 1 ? 'athlete' : 'athletes'} in ${where} `
            + `${p.field === 1 ? 'has' : 'have'} one on record. Below ${p.minField}, `
            + 'a position would give away individual numbers.',
      }
    case 'no_result_of_your_own':
      return {
        title: 'Nothing of yours to place',
        body: `There are ${p.field} on this board. Log a result and you will join them.`,
      }
    case 'opted_out':
      return {
        title: 'You are off the boards',
        body: 'You chose not to appear on leaderboards. Turn it back on in your '
          + 'sharing settings and your position comes back.',
      }
    case 'not_rankable':
      return {
        title: 'Not ranked, on purpose',
        body: 'Height, mass and body composition are never ranked against other '
          + 'athletes. They are yours to track, not to compete on.',
      }
    case 'signed_out':
      return { title: 'Signed out', body: 'Sign in to see where you sit.' }
    default:
      return { title: 'Nothing to show', body: 'Try another event or a wider group.' }
  }
}
