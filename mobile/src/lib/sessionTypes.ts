// ═══════════════════════════════════════════════════════════════════════
// SESSION ARCHETYPES — what kind of work this is.
//
// A hurdle walkover and a back squat used to render identically: name,
// prescription, intensity, rest, tempo, cue. That is a gym row, and every
// other kind of session was being pushed through it. The fields that matter
// are genuinely different:
//
//   track        two recoveries, and the gap between them IS the session.
//                6 × 30m off 1 minute and 6 × 30m off 4 minutes are different
//                workouts with identical reps.
//   technical    no load at all. The prescription is what a good rep looks
//                like — printing "—" in an intensity column says nothing.
//   conditioning a target to hold, not a weight to lift.
//
// The type is assigned server-side from the day's quality, so this file only
// has to decide how each one looks.
// ═══════════════════════════════════════════════════════════════════════

export type SessionType =
  'track' | 'gym' | 'technical' | 'conditioning' | 'mobility' | 'recovery'

export const SESSION_TYPES: SessionType[] =
  ['track', 'gym', 'technical', 'conditioning', 'mobility', 'recovery']

export interface TypeStyle {
  label: string
  icon: string
  /** Palette key, resolved against the active theme by the caller. */
  tone: 'accent' | 'blue' | 'green' | 'amber' | 'muted'
}

export const TYPE_STYLE: Record<SessionType, TypeStyle> = {
  track: { label: 'Track', icon: 'walk-outline', tone: 'accent' },
  gym: { label: 'Gym', icon: 'barbell-outline', tone: 'blue' },
  technical: { label: 'Technical', icon: 'construct-outline', tone: 'amber' },
  conditioning: { label: 'Conditioning', icon: 'pulse-outline', tone: 'green' },
  mobility: { label: 'Mobility', icon: 'body-outline', tone: 'muted' },
  recovery: { label: 'Recovery', icon: 'leaf-outline', tone: 'muted' },
}

export function sessionType(v: any): SessionType {
  const t = String(v || '').trim().toLowerCase()
  return (SESSION_TYPES as string[]).includes(t) ? (t as SessionType) : 'track'
}

/** A value the generator actually filled in, rather than a dash. */
export const filled = (v: any): boolean => {
  const t = String(v ?? '').trim()
  return t !== '' && t !== '—' && t !== '-' && t !== 'N/A' && t !== 'n/a'
}

/**
 * The meta line under an exercise, in the order that type reads in.
 *
 * Built here rather than in the component so the ordering is one decision
 * per archetype instead of a chain of conditionals inside a render.
 */
export function exerciseMeta(ex: any, type: SessionType): string[] {
  const out: string[] = []
  const push = (label: string, v: any) => { if (filled(v)) out.push(label ? `${label} ${v}` : String(v)) }

  switch (type) {
    case 'track':
      push('', ex?.intensity)
      // Both recoveries, labelled, because an unlabelled pair is ambiguous
      // and the difference between them is the whole session.
      push('rep rest', ex?.rest)
      push('set rest', ex?.rest_between_sets)
      push('on', ex?.surface)
      break
    case 'gym':
      push('', ex?.intensity)
      push('rest', ex?.rest)
      push('tempo', ex?.tempo)
      break
    case 'technical':
      // Deliberately no intensity: a technical drill has no load, and a
      // column printing "—" is worse than no column.
      push('', ex?.reps)
      push('rest', ex?.rest)
      break
    case 'conditioning':
      push('', ex?.target_pace)
      push('', ex?.intensity)
      push('work:rest', ex?.work_rest)
      break
    case 'mobility':
    case 'recovery':
      push('', ex?.intensity)
      break
  }
  if (filled(ex?.implement_kg)) out.push(`${ex.implement_kg}kg implement`)
  return out
}
