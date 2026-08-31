// ═══════════════════════════════════════════════════════════════════════
// THE WEEK MODEL — one answer to "what is on this day", for every surface.
//
// Everything the schedule draws comes from here: the plan, what was actually
// done, the check-in, and anything logged. Built as a pure function over data
// the screen has already fetched, so it can be tested against real dates
// without a renderer — which matters more than usual, because calendars are
// where date bugs live.
//
// ── DATES ARE LOCAL DAY-STRINGS, NOT Date OBJECTS ──────────────────
// Every date in this module is 'YYYY-MM-DD' in the athlete's own timezone.
// Two traps make this the only safe currency:
//
//   new Date('2026-08-31')            → midnight UTC, which is the 30th in
//                                        the Americas. Never parse a bare
//                                        day-string with the Date constructor.
//   d.toISOString().slice(0, 10)      → converts to UTC first, so an evening
//                                        session in Sydney lands on tomorrow
//                                        and a morning one in Los Angeles on
//                                        yesterday.
//
// So: `isoDay` formats from local getFullYear/getMonth/getDate, `parseDay`
// builds a local midnight via the numeric constructor, and arithmetic goes
// through setDate — which handles month ends, leap years and DST for us. A
// day is never advanced by adding 86_400_000 milliseconds: two days a year
// are not 24 hours long, and doing so silently repeats or skips a day.
// ═══════════════════════════════════════════════════════════════════════

import { checkinStatus, type CheckinRow, type ReadinessStatus } from './readiness'

// ── Day-string primitives ──────────────────────────────────────────

/** Local 'YYYY-MM-DD' for a Date. */
export function isoDay(d: Date): string {
  const p = (n: number) => String(n).padStart(2, '0')
  return `${d.getFullYear()}-${p(d.getMonth() + 1)}-${p(d.getDate())}`
}

/** Local midnight for a 'YYYY-MM-DD'. Tolerates a full timestamp. */
export function parseDay(day: string): Date {
  const [y, m, d] = String(day).slice(0, 10).split('-').map(Number)
  return new Date(y, (m || 1) - 1, d || 1)
}

/** The local day a timestamp falls on. Handles date and timestamptz alike. */
export function dayOf(ts: string | number | Date | null | undefined): string | null {
  if (ts == null || ts === '') return null
  // A bare date column is already a local day — parsing it would drag it
  // through UTC for nothing.
  if (typeof ts === 'string' && /^\d{4}-\d{2}-\d{2}$/.test(ts.trim())) return ts.trim()
  const d = ts instanceof Date ? ts : new Date(ts)
  return Number.isNaN(d.getTime()) ? null : isoDay(d)
}

export function addDays(day: string, n: number): string {
  const d = parseDay(day)
  d.setDate(d.getDate() + n)
  return isoDay(d)
}

/** ISO weekday: Monday = 1 … Sunday = 7. */
export function weekdayOf(day: string): number {
  return ((parseDay(day).getDay() + 6) % 7) + 1
}

/** Monday of the week containing `day`. */
export function mondayOf(day: string): string {
  return addDays(day, -(weekdayOf(day) - 1))
}

export function todayDay(): string {
  return isoDay(new Date())
}

/** The seven day-strings of a week, Monday first. */
export function weekDays(weekStart: string): string[] {
  return Array.from({ length: 7 }, (_, i) => addDays(weekStart, i))
}

export const WEEKDAY_SHORT = ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun']
export const WEEKDAY_LETTER = ['M', 'T', 'W', 'T', 'F', 'S', 'S']
export const WEEKDAY_FULL = [
  'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday', 'Sunday',
]

/** 1–7 → 'Mon'. Safe for anything out of range. */
export const weekdayShort = (n: number) => WEEKDAY_SHORT[(n - 1) % 7] || '—'

// ── Where sessions land ────────────────────────────────────────────
//
// Recovery-spaced rather than packed against the front of the week: two hard
// days back to back at the start and five days off is a worse week than the
// same load spread, and this is what the athlete sees before they have said
// anything about their own week. Sunday is the last day to be used.
//
// This is a FALLBACK. It applies only where nothing better is known, and the
// UI must present it as a suggestion rather than a prescription — an invented
// day drawn with the same confidence as a chosen one is a lie about the plan.
const AUTO_SPREAD: Record<number, number[]> = {
  1: [1],
  2: [1, 4],
  3: [1, 3, 5],
  4: [1, 2, 4, 5],
  5: [1, 2, 4, 5, 6],
  6: [1, 2, 3, 4, 5, 6],
  7: [1, 2, 3, 4, 5, 6, 7],
}

export function autoSpread(count: number): number[] {
  if (count <= 0) return []
  const known = AUTO_SPREAD[count]
  if (known) return known
  // More sessions than days: wrap, so a doubled-up day is visible rather than
  // a session silently vanishing.
  return Array.from({ length: count }, (_, i) => (i % 7) + 1)
}

const validWeekday = (n: any) => Number.isInteger(n) && n >= 1 && n <= 7

/**
 * Which weekday each session sits on, in session order.
 *
 * Three sources, most authoritative first:
 *
 *   1. `session.day_of_week` — written by the server from the athlete's own
 *      chosen days, or set by their coach. This is a real answer.
 *   2. The athlete's training days — for a program generated before days
 *      existed, spread across the days they say they train.
 *   3. `autoSpread` — a suggestion, and nothing more.
 *
 * `assigned` reports which of those was used, so the UI can say "suggested"
 * where it is guessing and stay quiet where it is not.
 */
export function resolveSessionDays(
  sessions: any[],
  trainingDays?: number[] | null,
): { days: number[]; assigned: 'program' | 'athlete' | 'auto' } {
  const list = Array.isArray(sessions) ? sessions : []
  if (!list.length) return { days: [], assigned: 'auto' }

  // Only trust the program when EVERY session carries a valid day. A half-set
  // field means something went wrong upstream, and mixing a real day with a
  // guessed one in the same week is worse than guessing consistently.
  if (list.every((s) => validWeekday(s?.day_of_week))) {
    return { days: list.map((s) => Number(s.day_of_week)), assigned: 'program' }
  }

  const chosen = (trainingDays || []).filter(validWeekday)
  if (chosen.length) {
    const sorted = [...new Set(chosen)].sort((a, b) => a - b)
    return {
      days: list.map((_, i) => sorted[i % sorted.length]),
      assigned: 'athlete',
    }
  }

  return { days: autoSpread(list.length), assigned: 'auto' }
}

/** The training days implied by a program, for pre-filling the next intake. */
export function trainingDaysOf(structure: any): number[] {
  const sessions = Array.isArray(structure?.sessions) ? structure.sessions : []
  const explicit = (structure?.training_days || []).filter(validWeekday)
  if (explicit.length) return [...new Set(explicit as number[])].sort((a, b) => a - b)
  const days = sessions.map((s: any) => s?.day_of_week).filter(validWeekday)
  return [...new Set(days as number[])].sort((a, b) => a - b)
}

// ── The week ───────────────────────────────────────────────────────

export interface PlannedSession {
  programId: string
  programTitle: string
  /** Index into structure.sessions — the key program_session_logs uses. */
  index: number
  label: string
  focus?: string | null
  /** The session archetype — track, gym, technical, conditioning, mobility. */
  type: string
  blocks: number
  done: boolean
  /** The day it was actually ticked, when that differs from the planned day. */
  completedOn?: string | null
  /** False when the day is a suggestion rather than a chosen or set day. */
  dayIsCertain: boolean
}

export interface DayCell {
  date: string
  /** 1 = Monday. */
  weekday: number
  isToday: boolean
  isPast: boolean
  isFuture: boolean
  sessions: PlannedSession[]
  plannedCount: number
  doneCount: number
  checkin: any | null
  readiness: ReadinessStatus
  races: any[]
  tests: any[]
  /** Calendar events touching this day — a race, a test day, a camp. */
  events: any[]
}

/** Where a displayed week sits inside a program's block. */
export interface BlockWeek {
  programId: string
  programTitle: string
  /** 1-based week of the block. Can exceed `total` once the block has run out. */
  week: number
  total: number
  phase: 'build' | 'deload' | null
  /** The deterministic intent for this week, from the skeleton. */
  intent: string
  /** The event-specific line the generator wrote for this week, if any. */
  adjustment: string
  /** True once the displayed week is past the end of the written plan. */
  finished: boolean
}

/**
 * Which week of its block a program is in, for the week being displayed.
 *
 * Anchored on the week the program was CREATED, which is the only start date
 * that exists — there is no separate "block start" field, and inventing one
 * would mean asking the athlete a question to which "the day I made it" is
 * almost always the answer.
 *
 * Returns null for a program with no week plan: everything generated before
 * the plan existed is a single template week, and claiming it is "week 3 of
 * 4" of a progression nobody wrote would be a fabrication.
 */
export function blockWeekFor(program: any, weekStart: string): BlockWeek | null {
  const plan = program?.structure?.week_plan
  if (!Array.isArray(plan) || !plan.length) return null

  const created = dayOf(program?.created_at)
  if (!created) return null

  const startMonday = mondayOf(created)
  // Whole weeks between two Mondays. Both are local midnights, so a DST
  // change inside the span shifts this by an hour at most — nowhere near the
  // half-week it would take to round wrong.
  const diff = Math.round(
    (parseDay(weekStart).getTime() - parseDay(startMonday).getTime()) / 604800000,
  )
  if (diff < 0) return null            // the week is before the program existed

  const week = diff + 1
  const entry = plan[diff] || null
  return {
    programId: program.id,
    programTitle: program?.structure?.title || program?.title || 'Program',
    week,
    total: plan.length,
    phase: entry?.phase ?? null,
    intent: entry?.intent || '',
    adjustment: entry?.adjustment || '',
    finished: week > plan.length,
  }
}

/**
 * Whether a program's block actually covers the week being drawn.
 *
 * Without this, a program is placed on every matching weekday for all time:
 * the month view showed a four-week block created on 30 August running
 * through the whole of July and on into September. Sessions before the
 * program existed are not a plan, and sessions past the end of the block are
 * a plan nobody wrote.
 *
 * A program with no week_plan — anything generated before block shapes
 * existed — has no known end, so it runs from its creation week onward rather
 * than disappearing. Hiding those would empty the calendar for every athlete
 * with an older program.
 */
export function programCoversWeek(program: any, weekStart: string): boolean {
  const created = dayOf(program?.created_at)
  // No creation date at all: nothing to bound it with, so leave it visible.
  if (!created) return true
  if (weekStart < mondayOf(created)) return false

  const plan = program?.structure?.week_plan
  if (!Array.isArray(plan) || !plan.length) return true

  const elapsed = Math.round(
    (parseDay(weekStart).getTime() - parseDay(mondayOf(created)).getTime()) / 604800000,
  )
  return elapsed < plan.length
}

export interface WeekModel {
  weekStart: string
  days: DayCell[]
  /** Where this week sits in each active program's block. */
  blocks: BlockWeek[]
  plannedCount: number
  doneCount: number
  checkinCount: number
  eventCount: number
  /** True when any session in the week sits on a guessed day. */
  hasSuggestedDays: boolean
  isCurrentWeek: boolean
}

export interface BuildWeekInput {
  weekStart: string
  /** Active programs, each with .id, .title and .structure. */
  programs?: any[]
  /** Rows from program_session_logs for THIS week_start. */
  sessionLogs?: any[]
  checkins?: any[]
  performances?: any[]
  metrics?: any[]
  /** Already expanded per day by eventsByDay, or raw rows. */
  events?: any[]
  /** The athlete's chosen training days, 1–7. */
  trainingDays?: number[] | null
}

export function buildWeek({
  weekStart, programs, sessionLogs, checkins, performances, metrics, trainingDays, events,
}: BuildWeekInput): WeekModel {
  const dates = weekDays(weekStart)
  const today = todayDay()
  const thisMonday = mondayOf(today)

  const cells: DayCell[] = dates.map((date) => ({
    date,
    weekday: weekdayOf(date),
    isToday: date === today,
    isPast: date < today,
    isFuture: date > today,
    sessions: [],
    plannedCount: 0,
    doneCount: 0,
    checkin: null,
    readiness: checkinStatus(null),
    races: [],
    tests: [],
    events: [],
  }))
  const byDate = new Map(cells.map((c) => [c.date, c]))

  // ── Plan ──
  // Completion is keyed (program, session index) within the week the caller
  // asked for; the caller is responsible for passing this week's logs.
  const doneKey = new Set<string>()
  const doneAt = new Map<string, string | null>()
  for (const l of sessionLogs || []) {
    if (!l) continue
    const k = `${l.program_id}:${l.session_index}`
    doneKey.add(k)
    doneAt.set(k, dayOf(l.completed_at))
  }

  let hasSuggestedDays = false
  const blocks: BlockWeek[] = []
  for (const p of programs || []) {
    const bw = blockWeekFor(p, weekStart)
    if (bw) blocks.push(bw)

    // Outside the block's own window, the program is not running. Its
    // sessions belong to weeks it actually covers, not to every Monday in
    // the calendar.
    if (!programCoversWeek(p, weekStart)) continue

    const structure = p?.structure || {}
    const sessions = Array.isArray(structure.sessions) ? structure.sessions : []
    if (!sessions.length) continue

    const { days, assigned } = resolveSessionDays(
      sessions,
      trainingDaysOf(structure).length ? trainingDaysOf(structure) : trainingDays,
    )
    if (assigned === 'auto') hasSuggestedDays = true

    sessions.forEach((s: any, i: number) => {
      const cell = byDate.get(addDays(weekStart, (days[i] || 1) - 1))
      if (!cell) return
      const k = `${p.id}:${i}`
      const done = doneKey.has(k)
      cell.sessions.push({
        programId: p.id,
        programTitle: structure.title || p.title || 'Program',
        index: i,
        label: String(s?.label || `Session ${i + 1}`),
        focus: s?.focus ?? null,
        type: String(s?.type || 'track'),
        blocks: Array.isArray(s?.blocks) ? s.blocks.length : 0,
        done,
        completedOn: done ? doneAt.get(k) ?? null : null,
        dayIsCertain: assigned !== 'auto',
      })
      cell.plannedCount++
      if (done) cell.doneCount++
    })
  }

  // ── Check-ins ──
  for (const c of checkins || []) {
    const d = dayOf(c?.checkin_date)
    const cell = d ? byDate.get(d) : null
    if (!cell) continue
    cell.checkin = c
    cell.readiness = checkinStatus(c as CheckinRow)
  }

  // ── What actually happened ──
  for (const r of performances || []) {
    const d = dayOf(r?.competition_date)
    if (d) byDate.get(d)?.races.push(r)
  }
  for (const m of metrics || []) {
    const d = dayOf(m?.recorded_at)
    if (d) byDate.get(d)?.tests.push(m)
  }

  // A multi-day event belongs on every day it covers, not just the day it
  // starts — otherwise the Sunday of a weekend meet reads as empty.
  for (const e of events || []) {
    const from = dayOf(e?.event_date)
    if (!from) continue
    const to = dayOf(e?.end_date) || from
    for (const cell of cells) {
      if (cell.date >= from && cell.date <= to) cell.events.push(e)
    }
  }

  return {
    weekStart,
    days: cells,
    blocks,
    plannedCount: cells.reduce((n, c) => n + c.plannedCount, 0),
    doneCount: cells.reduce((n, c) => n + c.doneCount, 0),
    checkinCount: cells.reduce((n, c) => n + (c.checkin ? 1 : 0), 0),
    eventCount: cells.reduce((n, c) => n + c.events.length, 0),
    hasSuggestedDays,
    isCurrentWeek: weekStart === thisMonday,
  }
}

// Month names are a fixed table, not Intl.
//
// `toLocaleDateString('en-GB', { month: 'short' })` returns "Sept" for
// September on current ICU and "Sep" on older builds — so the label reads
// "31 Aug – 6 Sept" on one device and "31 Aug – 6 Sep" on the next, with the
// odd four-letter month sitting among eleven three-letter ones. Locale data
// is not a stable API across iOS versions, Android versions and the
// simulator; a twelve-entry array is.
export const MONTH_SHORT = [
  'Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun',
  'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec',
]

/** "24–30 Aug" · "31 Aug – 6 Sep" · "28 Dec 2026 – 3 Jan 2027" */
export function weekLabel(weekStart: string): string {
  const a = parseDay(weekStart)
  const b = parseDay(addDays(weekStart, 6))
  const sameMonth = a.getMonth() === b.getMonth() && a.getFullYear() === b.getFullYear()
  const sameYear = a.getFullYear() === b.getFullYear()
  const mon = (d: Date) => MONTH_SHORT[d.getMonth()]
  if (sameMonth) return `${a.getDate()}–${b.getDate()} ${mon(b)}`
  if (sameYear) return `${a.getDate()} ${mon(a)} – ${b.getDate()} ${mon(b)}`
  return `${a.getDate()} ${mon(a)} ${a.getFullYear()} – ${b.getDate()} ${mon(b)} ${b.getFullYear()}`
}

/** "This week" · "Last week" · "In 2 weeks" · the date range beyond that. */
export function weekHeading(weekStart: string): string {
  const diff = Math.round(
    (parseDay(weekStart).getTime() - parseDay(mondayOf(todayDay())).getTime()) / 604800000,
  )
  if (diff === 0) return 'This week'
  if (diff === -1) return 'Last week'
  if (diff === 1) return 'Next week'
  return weekLabel(weekStart)
}

/** "Fri 28 Aug" — for a day header. */
export function dayLabel(day: string): string {
  const d = parseDay(day)
  return `${weekdayShort(weekdayOf(day))} ${d.getDate()} ${MONTH_SHORT[d.getMonth()]}`
}

// ── The month ──────────────────────────────────────────────────────

export interface MonthModel {
  /** First of the month. */
  monthStart: string
  label: string
  /** Six weeks of seven days, Monday-aligned — a fixed grid. */
  weeks: WeekModel[]
  /** Days belonging to the month being shown, for dimming the rest. */
  inMonth: (day: string) => boolean
}

/**
 * A month as six weeks of the SAME day cells the week view uses.
 *
 * Built by calling buildWeek six times rather than with its own arithmetic,
 * so the month and the week can never disagree about what happened on a day —
 * which is exactly the drift that would appear first on the one day of the
 * year the clocks change.
 *
 * Always six rows, never five. A grid that changes height between months
 * makes everything below it jump, and the trailing days are dimmed anyway.
 */
export function buildMonth(
  monthStart: string,
  input: Omit<BuildWeekInput, 'weekStart'>,
): MonthModel {
  const first = parseDay(monthStart)
  const firstOfMonth = isoDay(new Date(first.getFullYear(), first.getMonth(), 1))
  const gridStart = mondayOf(firstOfMonth)
  const month = first.getMonth()
  const year = first.getFullYear()

  return {
    monthStart: firstOfMonth,
    label: `${MONTH_SHORT[month]} ${year}`,
    weeks: Array.from({ length: 6 }, (_, i) =>
      buildWeek({ ...input, weekStart: addDays(gridStart, i * 7) })),
    inMonth: (day: string) => {
      const d = parseDay(day)
      return d.getMonth() === month && d.getFullYear() === year
    },
  }
}

/** The first of the month `delta` months from the one containing `day`. */
export function shiftMonth(day: string, delta: number): string {
  const d = parseDay(day)
  // Day 1 before shifting: setMonth on the 31st rolls into the next month.
  return isoDay(new Date(d.getFullYear(), d.getMonth() + delta, 1))
}
