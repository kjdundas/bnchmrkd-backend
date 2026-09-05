// ═══════════════════════════════════════════════════════════════════════
// THE EVENT CATALOGUE — one list, shared.
//
// This lived inside CoachAnalyseScreen, where an athlete could not reach
// it. That mattered more than it sounds: an athlete had no way anywhere in
// the app to say what they compete in, so their event was inferred purely
// from what they happened to log. Sign up, log nothing, and the app has no
// event — which means no personal best, no tier, no percentile, no
// projection and no place on a leaderboard, with no control to fix it.
//
// The names are the strings the science tables are keyed on. They are not
// display labels to be tidied up: change '3000m Steeplechase' here and it
// stops matching a benchmark row.
// ═══════════════════════════════════════════════════════════════════════

export type DisciplineGroup =
  'Sprint' | 'Middle' | 'Long' | 'Hurdles' | 'Jumps' | 'Throws'

export type DisciplineEntry = {
  name: string
  icon: string
  group: DisciplineGroup
}

export const DISCIPLINES: DisciplineEntry[] = [
  { name: '60m', icon: 'flash-outline', group: 'Sprint' },
  { name: '100m', icon: 'flash-outline', group: 'Sprint' },
  { name: '200m', icon: 'flash-outline', group: 'Sprint' },
  { name: '400m', icon: 'flash-outline', group: 'Sprint' },
  { name: '800m', icon: 'timer-outline', group: 'Middle' },
  { name: '1500m', icon: 'timer-outline', group: 'Middle' },
  { name: '3000m', icon: 'fitness-outline', group: 'Long' },
  { name: '3000m Steeplechase', icon: 'fitness-outline', group: 'Long' },
  { name: '5000m', icon: 'fitness-outline', group: 'Long' },
  { name: '10000m', icon: 'fitness-outline', group: 'Long' },
  { name: '100m Hurdles', icon: 'reorder-four-outline', group: 'Hurdles' },
  { name: '110m Hurdles', icon: 'reorder-four-outline', group: 'Hurdles' },
  { name: '400m Hurdles', icon: 'reorder-four-outline', group: 'Hurdles' },
  { name: 'High Jump', icon: 'trending-up-outline', group: 'Jumps' },
  { name: 'Long Jump', icon: 'trending-up-outline', group: 'Jumps' },
  { name: 'Triple Jump', icon: 'trending-up-outline', group: 'Jumps' },
  { name: 'Pole Vault', icon: 'trending-up-outline', group: 'Jumps' },
  { name: 'Shot Put', icon: 'ellipse-outline', group: 'Throws' },
  { name: 'Discus Throw', icon: 'ellipse-outline', group: 'Throws' },
  { name: 'Javelin Throw', icon: 'ellipse-outline', group: 'Throws' },
  { name: 'Hammer Throw', icon: 'ellipse-outline', group: 'Throws' },
]

export const GROUP_ORDER: DisciplineGroup[] =
  ['Sprint', 'Middle', 'Long', 'Hurdles', 'Jumps', 'Throws']

/** Grouped for a picker, in the order a track programme runs. */
export function byGroup(): { group: DisciplineGroup; items: DisciplineEntry[] }[] {
  return GROUP_ORDER
    .map((group) => ({ group, items: DISCIPLINES.filter((d) => d.group === group) }))
    .filter((g) => g.items.length > 0)
}

export const disciplineNames = () => DISCIPLINES.map((d) => d.name)

/** Case- and space-tolerant lookup, since names arrive from typed data too. */
export function findDiscipline(name?: string | null): DisciplineEntry | null {
  const want = String(name || '').trim().toLowerCase()
  if (!want) return null
  return DISCIPLINES.find((d) => d.name.toLowerCase() === want) || null
}

export const isKnownDiscipline = (name?: string | null) => !!findDiscipline(name)
