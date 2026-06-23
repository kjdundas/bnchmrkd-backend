// ═══════════════════════════════════════════════════════════════════════
// PROGRESS PERSISTENCE (roadmap Phase 1A)
// Reads/writes the athlete_progress table so XP, streak and earned badges
// survive reinstall and device switches. Previously this state was held in
// an in-memory module store and lost on every reload.
//
// XP is accumulated: the stored total_xp is the source of truth. For users
// who logged metrics BEFORE this table existed, bootstrapXPFromLogs replays
// the historical logs through the same XP rules to backfill a fair total
// once (guarded by the `bootstrapped` flag).
// ═══════════════════════════════════════════════════════════════════════

import { selectFrom, upsertInto } from './supabase'
import {
  calculateLogXP,
  calculateStreak,
  getEarnedBadges,
  getMetricCategory,
  countUniqueCategories,
  type UserStats,
} from './gamification'

export interface Progress {
  totalXP: number
  longestStreak: number
  badgesEarned: string[]
  lastLogDate: string | null
  bootstrapped: boolean
}

const EMPTY: Progress = {
  totalXP: 0,
  longestStreak: 0,
  badgesEarned: [],
  lastLogDate: null,
  bootstrapped: false,
}

/** Read the user's persisted progress row, or null if they don't have one yet. */
export async function loadProgress(userId: string): Promise<Progress | null> {
  try {
    const rows = await selectFrom('athlete_progress', { filter: `user_id=eq.${userId}`, limit: '1' })
    const row = Array.isArray(rows) ? rows[0] : rows
    if (!row) return null
    return {
      totalXP: row.total_xp ?? 0,
      longestStreak: row.longest_streak ?? 0,
      badgesEarned: row.badges_earned ?? [],
      lastLogDate: row.last_log_date ?? null,
      bootstrapped: !!row.bootstrapped,
    }
  } catch {
    return null
  }
}

/** Persist progress (insert or merge on user_id). Never throws — gamification
 *  must never block a successful log. */
export async function saveProgress(userId: string, p: Partial<Progress>): Promise<void> {
  try {
    await upsertInto('athlete_progress', {
      user_id: userId,
      ...(p.totalXP != null ? { total_xp: Math.round(p.totalXP) } : {}),
      ...(p.longestStreak != null ? { longest_streak: p.longestStreak } : {}),
      ...(p.badgesEarned != null ? { badges_earned: p.badgesEarned } : {}),
      ...(p.lastLogDate != null ? { last_log_date: p.lastLogDate } : {}),
      ...(p.bootstrapped != null ? { bootstrapped: p.bootstrapped } : {}),
    })
  } catch (e) {
    // Swallow — a failed progress write should never surface as a log failure.
    console.warn('[progress] save failed:', e)
  }
}

/**
 * Replay a user's full log history through the XP rules to estimate the XP
 * they "should" have. Used once to backfill users who predate the table.
 * `lowerIsBetter(key)` tells us which metrics improve by going down (times).
 */
export function bootstrapXPFromLogs(
  logs: any[],
  lowerIsBetter: (key: string) => boolean,
): { totalXP: number; longestStreak: number; badgesEarned: string[] } {
  if (!logs.length) return { totalXP: 0, longestStreak: 0, badgesEarned: [] }

  // Oldest first so first-ever / new-category / streak bonuses replay correctly.
  const ordered = [...logs].sort((a, b) => {
    const da = a.recorded_at || a._recorded_at || ''
    const db = b.recorded_at || b._recorded_at || ''
    return da < db ? -1 : da > db ? 1 : 0
  })

  let totalXP = 0
  const seenKeys = new Set<string>()
  const seenCats = new Set<string>()
  const pbTracker: Record<string, number> = {}
  const datesSoFar: string[] = []
  const perDayCount: Record<string, number> = {}

  for (const l of ordered) {
    const key = l.metric_key
    const v = parseFloat(l.value)
    const day = (l.recorded_at || l._recorded_at || '').slice(0, 10)
    const lower = lowerIsBetter(key)

    const isPB = !(key in pbTracker) || (lower ? v < pbTracker[key] : v > pbTracker[key])
    if (isPB) pbTracker[key] = v

    const isFirstEver = seenKeys.size === 0
    const cat = getMetricCategory(key)
    const isNewCategory = cat !== 'other' && !seenCats.has(cat)

    datesSoFar.push(l.recorded_at || l._recorded_at)
    const streak = calculateStreak(datesSoFar)
    perDayCount[day] = (perDayCount[day] || 0) + 1

    const { total } = calculateLogXP({
      isPB,
      hasNotes: !!l.notes,
      isFirstEver,
      isNewCategory,
      logsToday: perDayCount[day],
      currentStreak: streak.current,
    })
    totalXP += total

    seenKeys.add(key)
    if (cat !== 'other') seenCats.add(cat)
  }

  // Build final stats for badge backfill.
  const allDates = ordered.map((r) => r.recorded_at || r._recorded_at)
  const finalStreak = calculateStreak(allDates)
  const today = new Date().toISOString().slice(0, 10)
  const stats: UserStats = {
    totalLogs: ordered.length,
    totalPBs: Object.keys(pbTracker).length,
    currentStreak: finalStreak.current,
    longestStreak: finalStreak.longest,
    categoriesLogged: countUniqueCategories([...seenKeys]),
    totalXP,
    daysActive: new Set(allDates.map((d: string) => d?.slice(0, 10))).size,
    logsToday: ordered.filter((l) => (l.recorded_at || l._recorded_at || '').startsWith(today)).length,
    uniqueMetrics: seenKeys.size,
  }
  const badgesEarned = getEarnedBadges(stats).map((b) => b.id)

  return { totalXP, longestStreak: finalStreak.longest, badgesEarned }
}

export { EMPTY as EMPTY_PROGRESS }
