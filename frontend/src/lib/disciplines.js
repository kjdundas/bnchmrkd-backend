// ═══════════════════════════════════════════════════════════════════════
// DISCIPLINE CATALOG — the canonical list used for manual result entry, so a
// new result links to the athlete's existing results (same discipline names),
// with the right unit (time vs distance) and, for throws, the implement weight.
// ═══════════════════════════════════════════════════════════════════════
import { isTimeDiscipline } from './performanceLevels'

export const DISCIPLINE_GROUPS = [
  { group: 'Sprints', items: ['60m', '100m', '200m', '400m'] },
  { group: 'Middle distance', items: ['800m', '1500m'] },
  { group: 'Distance', items: ['3000m', '3000m Steeplechase', '5000m', '10000m', 'Marathon'] },
  { group: 'Hurdles', items: ['60mH', '80mH', '100mH', '110mH', '400mH'] },
  { group: 'Jumps', items: ['Long Jump', 'Triple Jump', 'High Jump', 'Pole Vault'] },
  { group: 'Throws', items: ['Shot Put', 'Discus Throw', 'Javelin Throw', 'Hammer Throw'] },
]

export const ALL_DISCIPLINES = DISCIPLINE_GROUPS.flatMap((g) => g.items)

const THROWS = new Set(['Shot Put', 'Discus Throw', 'Javelin Throw', 'Hammer Throw'])
export const isThrow = (d) => THROWS.has((d || '').trim())

// Standard World Athletics implement weights (kg) by gender. The first entry is
// the senior weight (used as the sensible default); coaches can pick a lighter
// age-group implement. Javelin is shown in grams.
export const IMPLEMENT_WEIGHTS = {
  'Shot Put':      { M: [7.26, 6, 5, 4, 3], F: [4, 3, 2] },
  'Discus Throw':  { M: [2, 1.75, 1.5, 1], F: [1, 0.75] },
  'Hammer Throw':  { M: [7.26, 6, 5, 4, 3], F: [4, 3] },
  'Javelin Throw': { M: [0.8, 0.7, 0.6, 0.5], F: [0.6, 0.5, 0.4] },
}

// Options for a given throw + gender code ('M' | 'F').
export function implementOptions(discipline, genderCode) {
  const map = IMPLEMENT_WEIGHTS[(discipline || '').trim()]
  if (!map) return []
  return map[genderCode === 'F' ? 'F' : 'M'] || []
}

export function weightLabel(discipline, kg) {
  if (kg == null) return ''
  if ((discipline || '').trim() === 'Javelin Throw') return `${Math.round(kg * 1000)}g`
  return `${kg}kg`
}

// Is a discipline measured by distance/height (field) rather than time (track)?
export const isFieldDiscipline = (d) => !isTimeDiscipline(d)

// The unit hint + placeholder for the result input, by discipline.
export function resultInputHint(discipline) {
  if (isTimeDiscipline(discipline)) {
    return { label: 'Time', placeholder: 'e.g. 10.45 or 1:52.30', unit: 'time' }
  }
  return { label: 'Distance / height', placeholder: 'e.g. 65.20', unit: 'm' }
}
