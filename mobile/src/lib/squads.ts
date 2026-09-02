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
import { type Trouble } from './loadState'

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

export async function fetchSquads(coachId: string, trouble?: Trouble): Promise<Squad[]> {
  if (!coachId) return []
  try {
    return (await selectFrom('squads', {
      filter: `coach_id=eq.${coachId}`,
      order: 'sort_order.asc',
    })) as Squad[]
  } catch (e) {
    trouble?.note('squads', e)
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
export async function fetchSquadAthletes(trouble?: Trouble): Promise<SquadAthlete[]> {
  try {
    return ((await callRpc('get_coach_squad')) || []) as SquadAthlete[]
  } catch (e) {
    // The squad itself failing is the worst case: every panel downstream
    // then renders 'no athletes', which reads as an empty roster.
    trouble?.note('squad', e)
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

// ═══════════════════════════════════════════════════════════════════════
// THE COACH'S WEEK
//
// Assigning one session to eight athletes writes eight rows — that is the
// right shape, because each athlete answers for themselves and one of them
// declining must not remove the session from the other seven. But it is the
// wrong shape to LOOK at: a coach opening Tuesday should see one session
// with eight names on it, not the same session eight times.
//
// So the rows are pulled per athlete and regrouped here, on one key: what it
// is, what it is called, and when. Two genuinely different sessions on the
// same day stay two cards; one session fanned out to a squad becomes one.
// ═══════════════════════════════════════════════════════════════════════

export type Attendee = {
  athlete: SquadAthlete
  /** 'pending' | 'accepted' | 'declined'. Absent in the data means accepted. */
  approval: string
  eventId: string
}

export type SquadEvent = {
  key: string
  kind: string
  title: string
  day: string
  discipline: string | null
  notes: string | null
  /** What is actually IN the session — the lines the coach wrote when they
   *  assigned it. Carried through because a card that names a session and
   *  cannot say what it was is a reminder, not a plan. */
  lines: string[]
  attendees: Attendee[]
  accepted: number
  pending: number
  declined: number
}

/**
 * Every calendar row for these athletes between two days, inclusive.
 *
 * Two queries rather than one `or=(...)`: an account and a roster entry live
 * in different columns, and PostgREST's `or` across two `in` lists is a
 * filter string long enough to hit a URL limit on a real squad.
 */
export async function fetchSquadEvents(
  athletes: SquadAthlete[], fromDay: string, toDay: string, trouble?: Trouble,
): Promise<Map<string, any[]>> {
  const byUser = athletes.map((a) => a.athlete_user_id).filter(Boolean) as string[]
  const byRoster = athletes.map((a) => a.roster_athlete_id).filter(Boolean) as string[]
  const out = new Map<string, any[]>()
  for (const a of athletes) out.set(keyOf(a), [])

  const pull = async (col: string, ids: string[]) => {
    if (!ids.length) return
    try {
      const rows = (await selectFrom('athlete_events', {
        filter: `${col}=in.(${ids.join(',')})&event_date=gte.${fromDay}&event_date=lte.${toDay}`,
        order: 'event_date.asc',
        limit: '2000',
      })) as any[]
      for (const r of rows || []) {
        const k = r[col]
        if (k) out.get(k)?.push(r)
      }
    } catch (e) { trouble?.note(`events:${col}`, e) }
  }
  await Promise.all([pull('athlete_id', byUser), pull('roster_athlete_id', byRoster)])
  return out
}

/** Absent approval means accepted — the same rule the results side uses. */
const approvalOf = (r: any): string => r?.approval || 'accepted'

/**
 * The lines a coach wrote, out of whatever shape the row carries.
 *
 * `structure` is jsonb and has held more than one shape over the life of
 * this table, so this reads defensively rather than assuming .lines is an
 * array of strings — a session that renders as [object Object] is worse
 * than one that renders as nothing.
 */
function linesOf(structure: any): string[] {
  const raw = Array.isArray(structure) ? structure : structure?.lines
  if (!Array.isArray(raw)) return []
  return raw
    .map((l: any) => (typeof l === 'string' ? l : l?.text || l?.name || ''))
    .map((l: string) => String(l).trim())
    .filter(Boolean)
}

/**
 * Collapse per-athlete rows into one card per real-world session.
 *
 * The key deliberately excludes the athlete and the row id, and deliberately
 * includes the date: the same session title on Monday and Wednesday is two
 * sessions, because a coach standing on the track on Wednesday cannot attend
 * Monday's.
 */
export function groupSquadEvents(
  athletes: SquadAthlete[], eventsBy: Map<string, any[]>,
): SquadEvent[] {
  const byKey = new Map<string, SquadEvent>()

  for (const a of athletes) {
    for (const r of eventsBy.get(keyOf(a)) || []) {
      const day = String(r.event_date || '').slice(0, 10)
      if (!day) continue
      const kind = String(r.kind || 'other')
      const title = String(r.title || '').trim()
      const key = `${day}|${kind}|${title.toLowerCase()}`
      let ev = byKey.get(key)
      if (!ev) {
        ev = {
          key, kind, day, title: title || kind,
          discipline: r.discipline || null, notes: r.notes || null,
          lines: linesOf(r.structure),
          attendees: [], accepted: 0, pending: 0, declined: 0,
        }
        byKey.set(key, ev)
      }
      const approval = approvalOf(r)
      ev.attendees.push({ athlete: a, approval, eventId: String(r.id) })
      if (approval === 'pending') ev.pending++
      else if (approval === 'declined') ev.declined++
      else ev.accepted++
    }
  }

  for (const ev of byKey.values()) {
    ev.attendees.sort((x, y) => x.athlete.name.localeCompare(y.athlete.name))
  }
  return [...byKey.values()].sort(
    (x, y) => x.day.localeCompare(y.day) || x.title.localeCompare(y.title))
}

/** The week's cards, keyed by day, so a day with nothing on it is knowable. */
export function eventsByDay(events: SquadEvent[]): Map<string, SquadEvent[]> {
  const out = new Map<string, SquadEvent[]>()
  for (const e of events) {
    const list = out.get(e.day)
    if (list) list.push(e)
    else out.set(e.day, [e])
  }
  return out
}

// ═══════════════════════════════════════════════════════════════════════
// THE SQUAD'S WELLNESS
//
// Read from `shared_checkins`, never from `athlete_checkins`. The view is
// where the athlete's sharing preference is applied, column by column — a
// coach whose athlete shares pain but not sleep gets the row with the sleep
// columns nulled and two flags saying which half is missing and why.
//
// Reading the table directly would return nothing at all now (the coach's
// policy on it was removed), which is the correct failure: a path that
// forgets the preference cannot accidentally work.
// ═══════════════════════════════════════════════════════════════════════

export type SharedCheckin = {
  athlete_id: string
  checkin_date: string
  sleep_hours: number | null
  soreness: number | null
  mood: number | null
  energy: number | null
  pain: boolean | null
  pain_areas: string[] | null
  pain_note: string | null
  wellness_shared: boolean
  pain_shared: boolean
}

export async function fetchSquadCheckins(
  athletes: SquadAthlete[], fromDay: string, toDay: string, trouble?: Trouble,
): Promise<Map<string, SharedCheckin[]>> {
  // Only athletes with an account: a roster entry has nobody to check in.
  const ids = athletes.map((a) => a.athlete_user_id).filter(Boolean) as string[]
  const out = new Map<string, SharedCheckin[]>()
  for (const id of ids) out.set(id, [])
  if (!ids.length) return out

  try {
    const rows = (await selectFrom('shared_checkins', {
      filter: `athlete_id=in.(${ids.join(',')})&checkin_date=gte.${fromDay}&checkin_date=lte.${toDay}`,
      order: 'checkin_date.asc',
      limit: '2000',
    })) as SharedCheckin[]
    for (const r of rows || []) out.get(r.athlete_id)?.push(r)
  } catch (e) { trouble?.note('checkins', e) }
  return out
}

/**
 * Whether this athlete shares wellness, judged from the ROWS rather than
 * guessed. The view stamps every row with the flag, so one row is enough —
 * and no rows at all means we genuinely do not know, in which case the
 * honest answer is "shared, nothing logged" rather than accusing them of
 * hiding something.
 */
export function sharesWellness(rows: SharedCheckin[] | undefined): boolean {
  const r = (rows || [])[0]
  return r ? r.wellness_shared !== false : true
}

export function sharesPain(rows: SharedCheckin[] | undefined): boolean {
  const r = (rows || [])[0]
  return r ? r.pain_shared !== false : true
}

// ═══════════════════════════════════════════════════════════════════════
// GROWTH ACROSS THE SQUAD
//
// Heights, sitting heights and body mass for everyone, turned into one
// reading per athlete. Anthropometrics live in athlete_metrics alongside
// the gym numbers, so this is the same fan-out as everything else — the
// only difference is that these three keys are read as a time series
// rather than as a best.
//
// Approval and sharing both still apply: fetchMetricsForMany goes through
// the same policies, so a metric awaiting an answer or belonging to an
// athlete who has switched body measurements off simply is not here.
// ═══════════════════════════════════════════════════════════════════════

import { growthReading, type GrowthReading } from './growth'

const HEIGHT_KEY = 'standing_height'
const SITTING_KEY = 'sitting_height'
const MASS_KEY = 'body_mass'

const seriesOf = (rows: any[], key: string) => (rows || [])
  .filter((r) => r?.metric_key === key && r?.recorded_at)
  .map((r) => ({ day: String(r.recorded_at).slice(0, 10), cm: Number(r.value) }))

export function growthForMany(
  athletes: SquadAthlete[], metricsBy: Map<string, any[]>,
): Map<string, GrowthReading> {
  const out = new Map<string, GrowthReading>()
  for (const a of athletes) {
    const rows = metricsBy.get(keyOf(a)) || []
    out.set(keyOf(a), growthReading(seriesOf(rows, HEIGHT_KEY), {
      masses: seriesOf(rows, MASS_KEY),
      sittingHeights: seriesOf(rows, SITTING_KEY),
    }))
  }
  return out
}

/** The same reading for one athlete, off the rows a detail screen already has. */
export function growthOf(rows: any[]): GrowthReading {
  return growthReading(seriesOf(rows, HEIGHT_KEY), {
    masses: seriesOf(rows, MASS_KEY),
    sittingHeights: seriesOf(rows, SITTING_KEY),
  })
}
