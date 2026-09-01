// ═══════════════════════════════════════════════════════════════════════
// CALENDAR EVENTS — the dates that are not training sessions.
//
// A race, a testing day, a championship weekend, a planned rest day. These
// are what turn a schedule into a season: a program tells you what to do on
// Wednesday, an event tells you why.
//
// Written by the athlete today. The table carries athlete_id and created_by
// separately, so a coach assigning a test day is the same row from a
// different author — the coach UI, when it is rebuilt, needs no migration.
// ═══════════════════════════════════════════════════════════════════════

import { selectFrom, insertInto, deleteFrom, updateIn } from './supabase'
import { addDays, dayOf } from './schedule'

export type EventKind =
  'race' | 'competition' | 'test' | 'camp' | 'rest' | 'session' | 'other'

export const EVENT_KINDS: {
  v: EventKind; l: string; icon: string; tone: 'accent' | 'red' | 'blue' | 'green' | 'amber' | 'muted'
}[] = [
  // A session is a calendar item, not a table of its own: it already has a
  // date, an owner of either kind, an approval state and a place in the week.
  // A PROGRAM is the thing that stays per-athlete — a periodised block built
  // against one person's maturity. One workout on one day is not that.
  { v: 'session', l: 'Session', icon: 'barbell-outline', tone: 'accent' },
  { v: 'race', l: 'Race', icon: 'flag-outline', tone: 'accent' },
  { v: 'competition', l: 'Competition', icon: 'trophy-outline', tone: 'amber' },
  { v: 'test', l: 'Test day', icon: 'speedometer-outline', tone: 'blue' },
  { v: 'camp', l: 'Camp', icon: 'bonfire-outline', tone: 'green' },
  { v: 'rest', l: 'Rest day', icon: 'moon-outline', tone: 'muted' },
  { v: 'other', l: 'Other', icon: 'ellipse-outline', tone: 'muted' },
]

export const EVENT_STYLE = Object.fromEntries(EVENT_KINDS.map((k) => [k.v, k])) as
  Record<EventKind, typeof EVENT_KINDS[number]>

export interface AthleteEvent {
  id: string
  athlete_id: string
  created_by: string
  event_date: string
  end_date: string | null
  kind: EventKind
  title: string
  discipline: string | null
  notes: string | null
}

export const eventKind = (v: any): EventKind => {
  const k = String(v || '').trim().toLowerCase()
  return (EVENT_KINDS.some((e) => e.v === k) ? k : 'other') as EventKind
}

/**
 * Every day an event covers, not just the day it starts.
 *
 * A two-day championship should appear on both days. Returning only the start
 * date is the bug that makes Sunday of a weekend meet look empty.
 */
export function eventDays(e: AthleteEvent): string[] {
  const from = dayOf(e?.event_date)
  if (!from) return []
  const to = dayOf(e?.end_date) || from
  if (to < from) return [from]
  const out: string[] = []
  // Guard the loop: a typo'd end_date years out should not spin.
  for (let d = from, i = 0; d <= to && i < 400; d = addDays(d, 1), i++) out.push(d)
  return out
}

/** Events indexed by every day they touch. */
export function eventsByDay(events: AthleteEvent[]): Map<string, AthleteEvent[]> {
  const map = new Map<string, AthleteEvent[]>()
  for (const e of events || []) {
    for (const d of eventDays(e)) {
      const list = map.get(d)
      list ? list.push(e) : map.set(d, [e])
    }
  }
  return map
}

// ── Persistence ────────────────────────────────────────────────────

export async function fetchEvents(athleteId: string, fromDay: string, toDay: string) {
  return fetchEventsFor({ athleteId }, fromDay, toDay)
}

export async function fetchEventsFor(subject: EventSubject, fromDay: string, toDay: string) {
  const col = 'athleteId' in subject ? 'athlete_id' : 'roster_athlete_id'
  const val = 'athleteId' in subject ? subject.athleteId : subject.rosterId
  const rows = await selectFrom('athlete_events', {
    // An event that STARTS before the window can still run into it, so the
    // lower bound is generous rather than exact — a week-long camp beginning
    // last month still belongs on this month's calendar.
    filter: `${col}=eq.${val}&event_date=lte.${toDay}&or=(end_date.gte.${fromDay},and(end_date.is.null,event_date.gte.${fromDay}))`,
    order: 'event_date.asc',
    limit: '500',
  })
  return (Array.isArray(rows) ? rows : []) as AthleteEvent[]
}

/**
 * The subject of an event: an account, or a roster entry for an athlete with
 * no phone. Exactly one, which the database enforces — the same either-or
 * shape performances and squad membership use.
 */
export type EventSubject = { athleteId: string } | { rosterId: string }

export async function createEvent(input: {
  subject: EventSubject
  createdBy: string
  date: string
  endDate?: string | null
  kind: EventKind
  title: string
  notes?: string | null
  /** What is actually in a session — the lines a coach wrote. */
  structure?: any | null
}) {
  const subject = 'athleteId' in input.subject
    ? { athlete_id: input.subject.athleteId, roster_athlete_id: null }
    : { athlete_id: null, roster_athlete_id: input.subject.rosterId }
  return insertInto('athlete_events', {
    ...subject,
    created_by: input.createdBy,
    event_date: input.date,
    end_date: input.endDate || null,
    kind: input.kind,
    title: input.title.trim().slice(0, 120),
    notes: input.notes?.trim() || null,
    structure: input.structure ?? null,
  })
}

/**
 * One event, many athletes — the shape of every coach action.
 *
 * Each athlete gets their OWN row rather than a shared event with a
 * membership list. A race day one athlete accepts and another declines is
 * two different facts, and approval lives on the row; a shared row could not
 * hold two answers. It also means an athlete who later leaves the squad
 * keeps the race that was already in their calendar.
 *
 * Failures are collected rather than thrown, because a fan-out that stops at
 * the first refusal leaves the coach with no idea who did and didn't get it.
 */
export async function createEventForMany(
  subjects: EventSubject[],
  input: Omit<Parameters<typeof createEvent>[0], 'subject'>,
): Promise<{ ok: number; failed: { subject: EventSubject; message: string }[] }> {
  const results = await Promise.allSettled(
    subjects.map((subject) => createEvent({ ...input, subject })),
  )
  const failed: { subject: EventSubject; message: string }[] = []
  let ok = 0
  results.forEach((r, i) => {
    if (r.status === 'fulfilled') ok++
    else failed.push({
      subject: subjects[i],
      message: String((r.reason as any)?.message || r.reason)
        .replace(/^Supabase \d+:\s*/, ''),
    })
  })
  return { ok, failed }
}

export const deleteEvent = (id: string) => deleteFrom('athlete_events', `id=eq.${id}`)

export const updateEvent = (id: string, patch: Partial<AthleteEvent>) =>
  updateIn('athlete_events', `id=eq.${id}`, patch)
