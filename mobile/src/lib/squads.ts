// ═══════════════════════════════════════════════════════════════════════
// SQUADS — how a coach groups the people they coach.
//
// An athlete reaches a coach two ways: an account they are linked to, and a
// roster entry keyed in for someone with no phone. Both belong in a squad, so
// membership points at either, exactly one — the same shape the results
// tables use, so there is one rule to remember rather than two.
//
// "Unassigned" is the ABSENCE of a membership row rather than a squad called
// Unassigned. An athlete you have linked but not yet filed still appears in
// the list; they simply appear ungrouped, and they stop being ungrouped the
// moment you file them. A real squad row would have to be created, defended
// against renaming, and cleaned up when it emptied.
// ═══════════════════════════════════════════════════════════════════════

import { selectFrom, insertInto, updateIn, deleteFrom, callRpc } from './supabase'

export type SquadAthlete = {
  subject_kind: 'account' | 'roster'
  roster_athlete_id: string | null
  athlete_user_id: string | null
  name: string
  dob: string | null
  gender: string | null
  /** The primary event — first in `disciplines`. */
  discipline: string
  /**
   * Every event this athlete has, declared or competed in, primary first.
   * Since a PB and a board are computed one event at a time, an athlete with
   * a single stored discipline could only ever be seen as one athlete.
   */
  disciplines: string[] | null
  squad_id: string | null
  squad_name: string | null
}

export type Squad = {
  id: string
  coach_id: string
  name: string
  colour: string | null
  sort_order: number
}

/** The id an athlete is addressed by, whichever kind they are. */
export function keyOf(a: SquadAthlete): string {
  return (a.athlete_user_id || a.roster_athlete_id || '') as string
}

/** What to hand fetchResults / AthleteDetail for this athlete. */
export function subjectFor(a: SquadAthlete) {
  return a.athlete_user_id
    ? { userId: a.athlete_user_id }
    : { rosterId: a.roster_athlete_id as string }
}

export async function fetchSquads(coachId: string): Promise<Squad[]> {
  if (!coachId) return []
  try {
    return (await selectFrom('squads', {
      filter: `coach_id=eq.${coachId}`,
      order: 'sort_order.asc',
    })) as Squad[]
  } catch {
    return []
  }
}

/**
 * Every athlete this coach has, of both kinds, with their squad if any.
 *
 * Goes through an RPC rather than a view because user_profiles is
 * select-own-only — a coach cannot read a linked athlete's name directly, and
 * widening that policy would hand them the whole profile row, email included.
 */
export async function fetchSquadAthletes(): Promise<SquadAthlete[]> {
  try {
    return ((await callRpc('get_coach_squad')) || []) as SquadAthlete[]
  } catch {
    return []
  }
}

export async function createSquad(coachId: string, name: string, sortOrder = 0) {
  const rows = await insertInto('squads', {
    coach_id: coachId, name: name.trim(), sort_order: sortOrder,
  })
  return (Array.isArray(rows) ? rows[0] : rows) as Squad
}

export async function renameSquad(id: string, name: string) {
  await updateIn('squads', `id=eq.${id}`, { name: name.trim() })
}

/** Deleting a squad ungroups its athletes; it never removes an athlete. */
export async function deleteSquad(id: string) {
  await deleteFrom('squads', `id=eq.${id}`)
}

/** Move an athlete into a squad, or out of every squad when squadId is null. */
export async function setSquadFor(a: SquadAthlete, squadId: string | null) {
  const col = a.athlete_user_id ? 'athlete_user_id' : 'roster_athlete_id'
  const val = a.athlete_user_id || a.roster_athlete_id
  if (a.squad_id) {
    await deleteFrom('squad_members', `squad_id=eq.${a.squad_id}&${col}=eq.${val}`)
  }
  if (squadId) {
    await insertInto('squad_members', { squad_id: squadId, [col]: val })
  }
}

/** The athletes in one squad, or every athlete when squadId is null. */
export function inSquad(all: SquadAthlete[], squadId: string | null): SquadAthlete[] {
  const list = squadId === null ? all : all.filter((a) => a.squad_id === squadId)
  return [...list].sort((x, y) => x.name.localeCompare(y.name))
}

/** The events to offer for this athlete, never empty when they have one. */
export function eventsOf(a: SquadAthlete): string[] {
  const list = (a.disciplines || []).map((d) => (d || '').trim()).filter(Boolean)
  if (list.length) return list
  const one = (a.discipline || '').trim()
  return one ? [one] : []
}

/** How many are in each squad, plus how many are in none. */
export function squadCounts(all: SquadAthlete[]) {
  const counts = new Map<string, number>()
  let unassigned = 0
  for (const a of all) {
    if (a.squad_id) counts.set(a.squad_id, (counts.get(a.squad_id) || 0) + 1)
    else unassigned++
  }
  return { counts, unassigned, total: all.length }
}
