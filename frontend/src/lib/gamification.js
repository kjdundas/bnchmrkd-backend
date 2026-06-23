// ═══════════════════════════════════════════════════════════════════════
// GAMIFICATION ENGINE (web) — XP, streaks, levels, badges
// Ported from mobile/src/lib/gamification.ts so web and mobile award XP by
// the exact same rules and read the same persisted total (athlete_progress).
// Keep the two in sync if either changes.
// ═══════════════════════════════════════════════════════════════════════

export const XP_REWARDS = {
  LOG_METRIC: 25,
  LOG_WITH_NOTES: 10,
  PB_HIT: 100,
  STREAK_BONUS_3: 50,
  STREAK_BONUS_7: 150,
  STREAK_BONUS_14: 300,
  STREAK_BONUS_30: 750,
  NEW_CATEGORY: 75,
  FIRST_METRIC: 50,
  FIVE_IN_DAY: 100,
}

export const LEVELS = [
  { level: 1,  xpRequired: 0,     title: 'Rookie',      icon: '🌱' },
  { level: 2,  xpRequired: 100,   title: 'Trainee',     icon: '🏃' },
  { level: 3,  xpRequired: 300,   title: 'Competitor',  icon: '⚡' },
  { level: 4,  xpRequired: 600,   title: 'Contender',   icon: '🔥' },
  { level: 5,  xpRequired: 1000,  title: 'Prospect',    icon: '💪' },
  { level: 6,  xpRequired: 1600,  title: 'Varsity',     icon: '🎯' },
  { level: 7,  xpRequired: 2500,  title: 'All-Star',    icon: '⭐' },
  { level: 8,  xpRequired: 4000,  title: 'National',    icon: '🏅' },
  { level: 9,  xpRequired: 6000,  title: 'Elite',       icon: '🥇' },
  { level: 10, xpRequired: 10000, title: 'World Class', icon: '🏆' },
  { level: 11, xpRequired: 15000, title: 'Legend',      icon: '👑' },
  { level: 12, xpRequired: 25000, title: 'GOAT',        icon: '🐐' },
]

export function getLevelFromXP(xp) {
  let current = LEVELS[0]
  for (const lvl of LEVELS) {
    if (xp >= lvl.xpRequired) current = lvl
    else break
  }
  const idx = LEVELS.indexOf(current)
  const next = idx < LEVELS.length - 1 ? LEVELS[idx + 1] : null
  const xpInLevel = xp - current.xpRequired
  const xpForNext = next ? next.xpRequired - current.xpRequired : 0
  const progress = xpForNext > 0 ? xpInLevel / xpForNext : 1
  return { ...current, next, xpInLevel, xpForNext, progress }
}

// ── BADGES ────────────────────────────────────────────────────────────
export const BADGES = [
  { id: 'first_log',  title: 'First Rep',      description: 'Log your very first result',     icon: '🎬', condition: (s) => s.totalLogs >= 1 },
  { id: 'first_pb',   title: 'PB Breaker',     description: 'Set your first personal best',    icon: '💥', condition: (s) => s.totalPBs >= 1 },
  { id: 'logs_10',    title: 'Getting Started', description: 'Log 10 results',                 icon: '📊', condition: (s) => s.totalLogs >= 10 },
  { id: 'logs_50',    title: 'Data Driven',    description: 'Log 50 results',                  icon: '📈', condition: (s) => s.totalLogs >= 50 },
  { id: 'logs_100',   title: 'Centurion',      description: 'Log 100 results',                 icon: '💯', condition: (s) => s.totalLogs >= 100 },
  { id: 'pbs_5',      title: 'PB Hunter',      description: 'Set 5 personal bests',            icon: '🎯', condition: (s) => s.totalPBs >= 5 },
  { id: 'pbs_25',     title: 'Record Breaker', description: 'Set 25 personal bests',           icon: '🏅', condition: (s) => s.totalPBs >= 25 },
  { id: 'streak_3',   title: 'On a Roll',      description: 'Log 3 days in a row',             icon: '🔗', condition: (s) => s.currentStreak >= 3 || s.longestStreak >= 3 },
  { id: 'streak_7',   title: 'Week Warrior',   description: 'Log 7 days in a row',             icon: '🗓️', condition: (s) => s.currentStreak >= 7 || s.longestStreak >= 7 },
  { id: 'streak_14',  title: 'Two-Week Terror', description: 'Log 14 days in a row',          icon: '⚡', condition: (s) => s.currentStreak >= 14 || s.longestStreak >= 14 },
  { id: 'streak_30',  title: 'Iron Discipline', description: 'Log 30 days in a row',          icon: '🛡️', condition: (s) => s.currentStreak >= 30 || s.longestStreak >= 30 },
]

export function getEarnedBadges(stats) {
  return BADGES.filter((b) => b.condition(stats))
}

export function getNewBadges(oldStats, newStats) {
  const oldBadges = new Set(getEarnedBadges(oldStats).map((b) => b.id))
  return getEarnedBadges(newStats).filter((b) => !oldBadges.has(b.id))
}

// ── STREAK ────────────────────────────────────────────────────────────
export function calculateStreak(logDates) {
  if (!logDates || !logDates.length) return { current: 0, longest: 0 }
  const days = [...new Set(logDates.filter(Boolean).map((d) => String(d).slice(0, 10)))].sort().reverse()
  if (!days.length) return { current: 0, longest: 0 }

  const today = new Date().toISOString().slice(0, 10)
  const yesterday = new Date(Date.now() - 86400000).toISOString().slice(0, 10)

  let current = 0
  if (days[0] === today || days[0] === yesterday) {
    current = 1
    for (let i = 1; i < days.length; i++) {
      const prev = new Date(days[i - 1])
      const curr = new Date(days[i])
      const diff = (prev.getTime() - curr.getTime()) / 86400000
      if (diff === 1) current++
      else break
    }
  }

  let longest = 1
  let run = 1
  const sorted = [...days].reverse()
  for (let i = 1; i < sorted.length; i++) {
    const prev = new Date(sorted[i - 1])
    const curr = new Date(sorted[i])
    const diff = (curr.getTime() - prev.getTime()) / 86400000
    if (diff === 1) { run++; if (run > longest) longest = run }
    else run = 1
  }
  return { current, longest }
}

// ── XP CALCULATOR ─────────────────────────────────────────────────────
export function calculateLogXP(opts) {
  const breakdown = []
  breakdown.push({ reason: 'Result logged', xp: XP_REWARDS.LOG_METRIC })
  if (opts.isPB) breakdown.push({ reason: 'Personal best!', xp: XP_REWARDS.PB_HIT })
  if (opts.hasNotes) breakdown.push({ reason: 'Added detail', xp: XP_REWARDS.LOG_WITH_NOTES })
  if (opts.isFirstEver) breakdown.push({ reason: 'First result!', xp: XP_REWARDS.FIRST_METRIC })
  if (opts.isNewCategory) breakdown.push({ reason: 'New category', xp: XP_REWARDS.NEW_CATEGORY })
  if (opts.logsToday >= 5) breakdown.push({ reason: '5+ today', xp: XP_REWARDS.FIVE_IN_DAY })

  if (opts.currentStreak >= 30) breakdown.push({ reason: '30-day streak!', xp: XP_REWARDS.STREAK_BONUS_30 })
  else if (opts.currentStreak >= 14) breakdown.push({ reason: '14-day streak!', xp: XP_REWARDS.STREAK_BONUS_14 })
  else if (opts.currentStreak >= 7) breakdown.push({ reason: '7-day streak!', xp: XP_REWARDS.STREAK_BONUS_7 })
  else if (opts.currentStreak >= 3) breakdown.push({ reason: '3-day streak', xp: XP_REWARDS.STREAK_BONUS_3 })

  const total = breakdown.reduce((sum, b) => sum + b.xp, 0)
  return { total, breakdown }
}

// ── MESSAGES ──────────────────────────────────────────────────────────
const PB_MESSAGES = [
  'You just broke your own record.',
  'New personal best. Remember this feeling.',
  'The bar just moved. You moved it.',
  'Previous you would be impressed.',
  'That right there? Progress.',
]
const GOOD_MESSAGES = [
  "Logged. The data doesn't lie.",
  'Another entry in the book.',
  'Consistency wins championships.',
  'Building the profile, one rep at a time.',
  'The work is the work.',
  'Tracked. On to the next one.',
]
const STREAK_MESSAGES = {
  3: "Three days running. You're building something.",
  7: 'A full week. This is becoming a habit.',
  14: "Two weeks solid. You're in the zone.",
  30: 'A month straight. Iron discipline.',
}

export function getMotivationalMessage(isPB, streak) {
  if (STREAK_MESSAGES[streak]) return STREAK_MESSAGES[streak]
  if (isPB) return PB_MESSAGES[Math.floor(Math.random() * PB_MESSAGES.length)]
  return GOOD_MESSAGES[Math.floor(Math.random() * GOOD_MESSAGES.length)]
}
