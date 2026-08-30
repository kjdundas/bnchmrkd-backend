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

export type EventKind = 'race' | 'competition' | 'test' | 'camp' | 'rest' | 'other'

export const EVENT_KINDS: {
  v: EventKind; l: string; icon: string; tone: 'accent' | 'red' | 'blue' | 'green' | 'amber' | 'muted'
}[] = [
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
  const rows = await selectFrom('athlete_events', {
    // An event that STARTS before the window can still run into it, so the
    // lower bound is generous rather than exact — a week-long camp beginning
    // last month still belongs on this month's calendar.
    filter: `athlete_id=eq.${athleteId}&event_date=lte.${toDay}&or=(end_date.gte.${fromDay},and(end_date.is.null,event_date.gte.${fromDay}))`,
    order: 'event_date.asc',
    limit: '500',
  })
  return (Array.isArray(rows) ? rows : []) as AthleteEvent[]
}

export async function createEvent(input: {
  athleteId: string
  createdBy: string
  date: string
  endDate?: string | null
  kind: EventKind
  title: string
  notes?: string | null
}) {
  return insertInto('athlete_events', {
    athlete_id: input.athleteId,
    created_by: input.createdBy,
    event_date: input.date,
    end_date: input.endDate || null,
    kind: input.kind,
    title: input.title.trim().slice(0, 120),
    notes: input.notes?.trim() || null,
  })
}

export const deleteEvent = (id: string) => deleteFrom('athlete_events', `id=eq.${id}`)

export const updateEvent = (id: string, patch: Partial<AthleteEvent>) =>
  updateIn('athlete_events', `id=eq.${id}`, patch)
