// ═══════════════════════════════════════════════════════════════════════
// WHAT AN ATHLETE SHARES WITH THEIR COACH.
//
// Four switches, all on by default. The default is the important part: an
// athlete who has never opened this screen has no row in the table, and a
// missing row means SHARED — because that is exactly what happens today, and
// flipping every existing coach to a blank screen the day this ships would
// be a worse outcome than the one this feature exists to fix.
//
// This module is the app's view of the preference. It is NOT where the rule
// is enforced — enforcement is in the database, in the RLS policies and
// inside the SECURITY DEFINER functions, because a client-side check is a
// suggestion. What this file is for is knowing what to SAY: the difference
// between "not shared" and "nothing logged" is invisible in the data (both
// arrive as null) and it is the whole difference to a coach deciding whether
// to chase somebody.
// ═══════════════════════════════════════════════════════════════════════

import { selectFrom, upsertInto } from './supabase'

export type ShareKey = 'wellness' | 'pain' | 'metrics' | 'body' | 'boards'

export type Sharing = Record<ShareKey, boolean>

/** Absent means shared. Stated once, here, and referenced everywhere else. */
export const ALL_SHARED: Sharing = {
  wellness: true, pain: true, metrics: true, body: true, boards: true,
}

export const SHARE_CATEGORIES: {
  key: ShareKey
  label: string
  /** What the coach gains. Written from the athlete's side of the table. */
  detail: string
  /** What it costs them if it is off — said plainly, not as a warning. */
  ifOff: string
  icon: string
}[] = [
  {
    key: 'wellness',
    label: 'Wellness',
    detail: 'Your sleep, mood, energy and soreness, and how they move over time.',
    ifOff: 'Your coach sees that you checked in, but not the numbers.',
    icon: 'pulse-outline',
  },
  {
    key: 'pain',
    label: 'Pain and injury',
    detail: 'Whether you flagged pain, where it is, and any note you left.',
    // Not phrased as a threat. It is a real consequence and they are entitled
    // to weigh it themselves.
    ifOff: 'Your coach will not know you are carrying something unless you tell them.',
    icon: 'medkit-outline',
  },
  {
    key: 'metrics',
    label: 'Physical tests',
    detail: 'Gym and testing numbers — squats, jumps, sprint splits.',
    ifOff: 'Your coach sees no test results and you are left off the physical boards.',
    icon: 'barbell-outline',
  },
  {
    key: 'body',
    label: 'Height and weight',
    detail: 'Body measurements, including anything logged as a body metric.',
    ifOff: 'Your coach sees no measurements. Nothing else is affected.',
    icon: 'body-outline',
  },
  {
    key: 'boards',
    label: 'Leaderboards',
    detail: 'Your approved results count towards squad, city, region and world boards.',
    // Said plainly, because the thing people fear is that opting out is
    // punished somewhere else. It is not.
    ifOff: 'You disappear from everyone else\u2019s boards and yours stop showing a position. Nothing else changes \u2014 your results and your coach\u2019s view of them stay exactly as they are.',
    icon: 'podium-outline',
  },]

/**
 * Competition results are deliberately NOT a category.
 *
 * They are the thing a coach is for, they are already approved one at a time
 * by whoever they belong to, and an athlete who does not want their coach to
 * see their results does not want that coach. Offering a switch that empties
 * the entire relationship would be a worse answer than unlinking, which the
 * athlete can already do.
 */
export const RESULTS_ARE_ALWAYS_SHARED = true

export async function fetchSharing(userId: string): Promise<Sharing> {
  if (!userId) return { ...ALL_SHARED }
  try {
    const rows = (await selectFrom('athlete_sharing', {
      filter: `athlete_id=eq.${userId}`, limit: '1',
    })) as any[]
    const r = rows?.[0]
    if (!r) return { ...ALL_SHARED }
    return {
      wellness: r.wellness !== false,
      pain: r.pain !== false,
      metrics: r.metrics !== false,
      body: r.body !== false,
      boards: r.boards !== false,
    }
  } catch {
    // A failed read must not silently look like "everything is private" —
    // that would show the athlete switches that are off when they are not,
    // and they might then turn one "on" that was never off.
    return { ...ALL_SHARED }
  }
}

/** Writes the WHOLE row, so a half-written preference cannot exist. */
export async function saveSharing(userId: string, next: Sharing): Promise<void> {
  await upsertInto('athlete_sharing', {
    athlete_id: userId,
    wellness: next.wellness,
    pain: next.pain,
    metrics: next.metrics,
    body: next.body,
    boards: next.boards,
    updated_at: new Date().toISOString(),
  })
}

/**
 * The categories that are about the COACH.
 *
 * `boards` lives in the same table and the same settings screen, but it is a
 * different question — it governs peer leaderboards, not the coach. Counting
 * it here would have told an athlete who left the boards that their coach
 * could no longer see something, which is untrue and exactly the kind of
 * wrong reassurance this feature exists to avoid.
 */
export const COACH_CATEGORIES = SHARE_CATEGORIES.filter((c) => c.key !== 'boards')

/** How many coach-facing categories are switched off — drives the summary. */
export const withheldCount = (s: Sharing): number =>
  COACH_CATEGORIES.filter((c) => !s[c.key]).length

export function summaryOf(s: Sharing): string {
  const off = COACH_CATEGORIES.filter((c) => !s[c.key])
  if (!off.length) return 'Your coach can see everything below.'
  if (off.length === COACH_CATEGORIES.length) {
    return 'Your coach sees your results and nothing else.'
  }
  const names = off.map((c) => c.label.toLowerCase())
  const list = names.length === 1
    ? names[0]
    : `${names.slice(0, -1).join(', ')} and ${names[names.length - 1]}`
  return `Your coach cannot see ${list}.`
}

// ── The coach's side of the same fact ──────────────────────────────────

/**
 * What a coach knows about one athlete's sharing, read off whatever row the
 * server handed back. The server sends explicit flags precisely so the app
 * never has to infer a boundary from a null.
 */
export function sharingOf(row: any): Sharing {
  if (!row) return { ...ALL_SHARED }
  return {
    wellness: row.shares_wellness !== false && row.wellness_shared !== false,
    pain: row.shares_pain !== false && row.pain_shared !== false,
    metrics: row.shares_metrics !== false,
    body: row.shares_body !== false,
    // Not a coach-facing category. A coach's view of an athlete is unchanged
    // by whether that athlete appears on peer leaderboards.
    boards: true,
  }
}

/** The line a coach sees where a withheld card would have been. */
export const NOT_SHARED_LABEL: Record<ShareKey, string> = {
  boards: 'Not on leaderboards',
  wellness: 'Wellness not shared',
  pain: 'Pain and injury not shared',
  metrics: 'Test results not shared',
  body: 'Measurements not shared',
}
