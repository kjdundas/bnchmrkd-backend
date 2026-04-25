// ═══════════════════════════════════════════════════════════════════════
// GAMIFICATION ENGINE — XP, streaks, levels, badges, achievements
// Makes every metric log feel rewarding and builds habit loops
// ═══════════════════════════════════════════════════════════════════════

// ── XP SYSTEM ─────────────────────────────────────────────────────────
// Every action earns XP. XP drives levels. Levels unlock tier names.
export const XP_REWARDS = {
  LOG_METRIC: 25,         // Base XP for logging any metric
  LOG_WITH_NOTES: 10,     // Bonus for adding notes
  PB_HIT: 100,            // Personal best
  STREAK_BONUS_3: 50,     // 3-day streak bonus
  STREAK_BONUS_7: 150,    // 7-day streak
  STREAK_BONUS_14: 300,   // 14-day streak
  STREAK_BONUS_30: 750,   // 30-day streak
  NEW_CATEGORY: 75,       // First metric in a new category
  FIRST_METRIC: 50,       // Very first metric ever logged
  FIVE_IN_DAY: 100,       // Logged 5+ metrics in a single day
}

// ── LEVELS ────────────────────────────────────────────────────────────
// XP thresholds for each level. Exponential curve, gets harder.
export const LEVELS = [
  { level: 1,  xpRequired: 0,     title: 'Rookie',        icon: '🌱' },
  { level: 2,  xpRequired: 100,   title: 'Trainee',       icon: '🏃' },
  { level: 3,  xpRequired: 300,   title: 'Competitor',    icon: '⚡' },
  { level: 4,  xpRequired: 600,   title: 'Contender',     icon: '🔥' },
  { level: 5,  xpRequired: 1000,  title: 'Prospect',      icon: '💪' },
  { level: 6,  xpRequired: 1600,  title: 'Varsity',       icon: '🎯' },
  { level: 7,  xpRequired: 2500,  title: 'All-Star',      icon: '⭐' },
  { level: 8,  xpRequired: 4000,  title: 'National',      icon: '🏅' },
  { level: 9,  xpRequired: 6000,  title: 'Elite',         icon: '🥇' },
  { level: 10, xpRequired: 10000, title: 'World Class',   icon: '🏆' },
  { level: 11, xpRequired: 15000, title: 'Legend',         icon: '👑' },
  { level: 12, xpRequired: 25000, title: 'GOAT',          icon: '🐐' },
]

export function getLevelFromXP(xp: number) {
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

// ── BADGES / ACHIEVEMENTS ─────────────────────────────────────────────
export interface Badge {
  id: string
  title: string
  description: string
  icon: string
  condition: (stats: UserStats) => boolean
}

export interface UserStats {
  totalLogs: number
  totalPBs: number
  currentStreak: number
  longestStreak: number
  categoriesLogged: number  // out of 6
  totalXP: number
  daysActive: number
  logsToday: number
  uniqueMetrics: number
}

export const BADGES: Badge[] = [
  // First milestones
  { id: 'first_log',     title: 'First Rep',       description: 'Log your very first metric',       icon: '🎬', condition: (s) => s.totalLogs >= 1 },
  { id: 'first_pb',      title: 'PB Breaker',      description: 'Set your first personal best',     icon: '💥', condition: (s) => s.totalPBs >= 1 },

  // Volume badges
  { id: 'logs_10',       title: 'Getting Started',  description: 'Log 10 metrics',                  icon: '📊', condition: (s) => s.totalLogs >= 10 },
  { id: 'logs_50',       title: 'Data Driven',      description: 'Log 50 metrics',                  icon: '📈', condition: (s) => s.totalLogs >= 50 },
  { id: 'logs_100',      title: 'Centurion',        description: 'Log 100 metrics',                 icon: '💯', condition: (s) => s.totalLogs >= 100 },
  { id: 'logs_500',      title: 'Machine',          description: 'Log 500 metrics',                 icon: '🤖', condition: (s) => s.totalLogs >= 500 },

  // PB badges
  { id: 'pbs_5',         title: 'PB Hunter',        description: 'Set 5 personal bests',            icon: '🎯', condition: (s) => s.totalPBs >= 5 },
  { id: 'pbs_25',        title: 'Record Breaker',   description: 'Set 25 personal bests',           icon: '🏅', condition: (s) => s.totalPBs >= 25 },
  { id: 'pbs_50',        title: 'Unstoppable',      description: 'Set 50 personal bests',           icon: '🔥', condition: (s) => s.totalPBs >= 50 },

  // Streak badges
  { id: 'streak_3',      title: 'On a Roll',        description: 'Log 3 days in a row',             icon: '🔗', condition: (s) => s.currentStreak >= 3 || s.longestStreak >= 3 },
  { id: 'streak_7',      title: 'Week Warrior',     description: 'Log 7 days in a row',             icon: '🗓️', condition: (s) => s.currentStreak >= 7 || s.longestStreak >= 7 },
  { id: 'streak_14',     title: 'Two-Week Terror',  description: 'Log 14 days in a row',            icon: '⚡', condition: (s) => s.currentStreak >= 14 || s.longestStreak >= 14 },
  { id: 'streak_30',     title: 'Iron Discipline',  description: 'Log 30 days in a row',            icon: '🛡️', condition: (s) => s.currentStreak >= 30 || s.longestStreak >= 30 },

  // Breadth badges
  { id: 'cat_3',         title: 'Well Rounded',     description: 'Log metrics in 3 categories',     icon: '🔄', condition: (s) => s.categoriesLogged >= 3 },
  { id: 'cat_6',         title: 'Complete Athlete',  description: 'Log metrics in all 6 categories', icon: '🌟', condition: (s) => s.categoriesLogged >= 6 },
  { id: 'metrics_10',    title: 'Explorer',          description: 'Log 10 different metrics',        icon: '🗺️', condition: (s) => s.uniqueMetrics >= 10 },
  { id: 'metrics_25',    title: 'Analyst',           description: 'Log 25 different metrics',        icon: '🔬', condition: (s) => s.uniqueMetrics >= 25 },

  // Session badges
  { id: 'five_in_day',   title: 'Testing Day',      description: 'Log 5+ metrics in a single day',  icon: '📋', condition: (s) => s.logsToday >= 5 },
]

export function getEarnedBadges(stats: UserStats): Badge[] {
  return BADGES.filter((b) => b.condition(stats))
}

export function getNewBadges(oldStats: UserStats, newStats: UserStats): Badge[] {
  const oldBadges = new Set(getEarnedBadges(oldStats).map((b) => b.id))
  return getEarnedBadges(newStats).filter((b) => !oldBadges.has(b.id))
}

// ── STREAK CALCULATOR ─────────────────────────────────────────────────
export function calculateStreak(logDates: string[]): { current: number; longest: number } {
  if (!logDates.length) return { current: 0, longest: 0 }

  // Get unique days, sorted descending
  const days = [...new Set(logDates.map((d) => d.slice(0, 10)))].sort().reverse()

  const today = new Date().toISOString().slice(0, 10)
  const yesterday = new Date(Date.now() - 86400000).toISOString().slice(0, 10)

  // Current streak — must include today or yesterday
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

  // Longest streak
  let longest = 1
  let run = 1
  const sorted = [...days].reverse() // chronological
  for (let i = 1; i < sorted.length; i++) {
    const prev = new Date(sorted[i - 1])
    const curr = new Date(sorted[i])
    const diff = (curr.getTime() - prev.getTime()) / 86400000
    if (diff === 1) {
      run++
      if (run > longest) longest = run
    } else {
      run = 1
    }
  }

  return { current, longest }
}

// ── XP CALCULATOR ─────────────────────────────────────────────────────
// Calculate XP earned from a single log action
export function calculateLogXP(opts: {
  isPB: boolean
  hasNotes: boolean
  isFirstEver: boolean
  isNewCategory: boolean
  logsToday: number
  currentStreak: number
}): { total: number; breakdown: { reason: string; xp: number }[] } {
  const breakdown: { reason: string; xp: number }[] = []

  breakdown.push({ reason: 'Metric logged', xp: XP_REWARDS.LOG_METRIC })

  if (opts.isPB) breakdown.push({ reason: 'Personal best!', xp: XP_REWARDS.PB_HIT })
  if (opts.hasNotes) breakdown.push({ reason: 'Added notes', xp: XP_REWARDS.LOG_WITH_NOTES })
  if (opts.isFirstEver) breakdown.push({ reason: 'First metric!', xp: XP_REWARDS.FIRST_METRIC })
  if (opts.isNewCategory) breakdown.push({ reason: 'New category', xp: XP_REWARDS.NEW_CATEGORY })
  if (opts.logsToday >= 5) breakdown.push({ reason: '5+ today', xp: XP_REWARDS.FIVE_IN_DAY })

  // Streak bonuses (only award the highest applicable)
  if (opts.currentStreak >= 30) breakdown.push({ reason: '30-day streak!', xp: XP_REWARDS.STREAK_BONUS_30 })
  else if (opts.currentStreak >= 14) breakdown.push({ reason: '14-day streak!', xp: XP_REWARDS.STREAK_BONUS_14 })
  else if (opts.currentStreak >= 7) breakdown.push({ reason: '7-day streak!', xp: XP_REWARDS.STREAK_BONUS_7 })
  else if (opts.currentStreak >= 3) breakdown.push({ reason: '3-day streak', xp: XP_REWARDS.STREAK_BONUS_3 })

  const total = breakdown.reduce((sum, b) => sum + b.xp, 0)
  return { total, breakdown }
}

// ── MOTIVATIONAL MESSAGES ─────────────────────────────────────────────
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
  'Future you will thank present you.',
  "That's how athletes get better.",
  'The work is the work.',
  'Tracked. On to the next one.',
]

const STREAK_MESSAGES: Record<number, string> = {
  3: "Three days running. You're building something.",
  7: 'A full week. This is becoming a habit.',
  14: "Two weeks solid. You're in the zone.",
  21: "Three weeks. Science says it's a habit now.",
  30: 'A month straight. Iron discipline.',
  50: "Fifty days. You're in rare company.",
  100: 'Triple digits. Legendary commitment.',
}

export function getMotivationalMessage(isPB: boolean, streak: number): string {
  // Check streak milestones first
  if (STREAK_MESSAGES[streak]) return STREAK_MESSAGES[streak]

  if (isPB) return PB_MESSAGES[Math.floor(Math.random() * PB_MESSAGES.length)]
  return GOOD_MESSAGES[Math.floor(Math.random() * GOOD_MESSAGES.length)]
}

// ── CATEGORY MAPPING (for tracking unique categories) ─────────────────
const CATEGORY_PREFIXES: Record<string, string[]> = {
  speed: ['sprint_', 'flying_', 'split_', 'max_velocity'],
  power: ['cmj_', 'sj_', 'eur', 'broad_', 'rsi_', 'imtp_rfd'],
  strength: ['back_squat', 'front_squat', 'deadlift', 'bench_', 'power_clean', 'snatch_', 'hip_thrust', 'imtp_peak', 'imtp_rel', 'pullup', 'weighted_'],
  endurance: ['vo2', 'yoyo_', 'iftt_', 'mas', 'tt_', 'bronco', 'rhr', 'hrv_', 'hr_recovery'],
  mobility: ['sit_and_', 'knee_to_', 'thomas_', 'aslr_', 'shoulder_', 'overhead_', 'fms_', 'adductor_'],
  anthropometrics: ['body_mass', 'standing_', 'sitting_', 'wingspan', 'body_fat', 'sum_7_', 'lean_mass', 'fat_mass'],
}

export function getMetricCategory(key: string): string {
  for (const [cat, prefixes] of Object.entries(CATEGORY_PREFIXES)) {
    if (prefixes.some((p) => key.startsWith(p) || key === p)) return cat
  }
  return 'other'
}

export function countUniqueCategories(metricKeys: string[]): number {
  const cats = new Set(metricKeys.map(getMetricCategory))
  cats.delete('other')
  return cats.size
}
