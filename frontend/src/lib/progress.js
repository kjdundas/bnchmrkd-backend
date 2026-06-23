// ═══════════════════════════════════════════════════════════════════════
// PROGRESS PERSISTENCE (web) — reads/writes athlete_progress so XP, streak
// and earned badges persist and stay in sync with the mobile app.
// Mirrors mobile/src/lib/progress.ts. Never throws — gamification must never
// block a successful log.
// ═══════════════════════════════════════════════════════════════════════

import { selectFrom, upsertInto } from './supabaseRest'
import { calculateLogXP, calculateStreak, getEarnedBadges } from './gamification'

export async function loadProgress(userId) {
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

export async function saveProgress(userId, p) {
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
    console.warn('[progress] save failed:', e)
  }
}

/**
 * Replay a race history through the XP rules to estimate XP for users who
 * predate the table. `lowerBetter(value, isThrows)` not needed here — races
 * carry their own values, so we pass `isThrows` per race to decide PBs.
 * `racesByDisc` is the athlete's full races array; isThrows is a predicate
 * on discipline.
 */
export function bootstrapXPFromRaces(races, isThrowsForDiscipline) {
  if (!races || !races.length) return { totalXP: 0, longestStreak: 0, badgesEarned: [] }

  const ordered = [...races]
    .filter((r) => r && r.date && r.value != null)
    .sort((a, b) => new Date(a.date) - new Date(b.date))

  let totalXP = 0
  const pbByDisc = {}
  const datesSoFar = []
  const perDay = {}

  for (const r of ordered) {
    const disc = r.discipline || '_'
    const isThrows = isThrowsForDiscipline ? isThrowsForDiscipline(r.discipline) : false
    const prev = pbByDisc[disc]
    const isPB = prev == null || (isThrows ? r.value > prev : r.value < prev)
    if (isPB) pbByDisc[disc] = r.value

    const day = String(r.date).slice(0, 10)
    datesSoFar.push(r.date)
    perDay[day] = (perDay[day] || 0) + 1
    const streak = calculateStreak(datesSoFar)

    const { total } = calculateLogXP({
      isPB,
      hasNotes: false,
      isFirstEver: datesSoFar.length === 1,
      isNewCategory: false,
      logsToday: perDay[day],
      currentStreak: streak.current,
    })
    totalXP += total
  }

  const allDates = ordered.map((r) => r.date)
  const finalStreak = calculateStreak(allDates)
  const today = new Date().toISOString().slice(0, 10)
  const stats = {
    totalLogs: ordered.length,
    totalPBs: Object.keys(pbByDisc).length,
    currentStreak: finalStreak.current,
    longestStreak: finalStreak.longest,
    categoriesLogged: 0,
    totalXP,
    daysActive: new Set(allDates.map((d) => String(d).slice(0, 10))).size,
    logsToday: ordered.filter((r) => String(r.date).slice(0, 10) === today).length,
    uniqueMetrics: 0,
  }
  const badgesEarned = getEarnedBadges(stats).map((b) => b.id)
  return { totalXP, longestStreak: finalStreak.longest, badgesEarned }
}
