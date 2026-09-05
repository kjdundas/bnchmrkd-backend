// ═══════════════════════════════════════════════════════════════════════
// SESSION SAFETY — one session, several athletes, different bodies.
//
// A coach writes "6×200m off 3 min" once and the squad does it. That is
// correct, and refusing to fan a session out describes no coaching anyone
// actually does. But the SAME session is not equally appropriate for every
// athlete in front of it: a percentage of a one-rep max prescribed to a
// thirteen-year-old is exactly what the backend validator exists to catch,
// and a squad session bypasses that validator entirely.
//
// So the check moves to the moment of assignment. It does not block — a
// coach who knows their athlete may have a reason — it names who the session
// is questionable for, and why, before it goes out. Two people looking at it
// beats one rule refusing.
//
// The patterns mirror _MAXIMAL_PATTERNS in the backend's program_validator,
// deliberately: two copies of a safety rule that disagree is worse than one
// that is occasionally over-eager.
// ═══════════════════════════════════════════════════════════════════════

import { ageFromDob } from './age'

/** Loads that assume a tested one-rep max, or ask for a true maximum. */
const MAXIMAL = [
  /\b\d{2,3}\s*%\s*(of\s*)?1\s*rm\b/i,
  /\b1\s*rm\b/i,
  /\b[1-5]\s*rep\s*max\b/i,
  /\bas heavy as possible\b/i,
  /\bmax(imal)?\s+(lift|load|weight|squat|deadlift|clean|snatch|bench)\b/i,
  /\btest(ing)?\s+1rm\b/i,
]

/** Impacts that need a mature skeleton and a trained landing. */
const HIGH_IMPACT = [
  /\bdepth\s*jump/i,
  /\bdrop\s*jump/i,
  /\bshock\s*method\b/i,
  /\bbox\s*jump\s*down\b/i,
]

const OLYMPIC = [/\bsnatch\b/i, /\bclean\s*(and|&)\s*jerk\b/i, /\bpower\s*clean\b/i, /\bjerk\b/i]

export type SafetyNote = { name: string; age: number | null; reason: string }

/**
 * Who in this selection the session looks wrong for.
 *
 * Under-15 is the line for maximal loading and shock-method plyometrics —
 * the same one the backend's loading ceilings use. An athlete with no date
 * of birth is NOT flagged: guessing that an unknown age is young would cry
 * wolf on every roster athlete a coach has not filled in yet, and a warning
 * that fires constantly is a warning nobody reads.
 */
export function sessionConcerns(
  text: string,
  athletes: { name: string; dob: string | null }[],
): SafetyNote[] {
  const body = text || ''
  const maximal = MAXIMAL.some((re) => re.test(body))
  const impact = HIGH_IMPACT.some((re) => re.test(body))
  const olympic = OLYMPIC.some((re) => re.test(body))
  if (!maximal && !impact && !olympic) return []

  const out: SafetyNote[] = []
  for (const a of athletes) {
    const age = ageFromDob(a.dob)
    if (age == null) continue
    if (maximal && age < 15) {
      out.push({ name: a.name, age, reason: 'maximal loading before 15' })
    } else if (impact && age < 15) {
      out.push({ name: a.name, age, reason: 'shock-method plyometrics before 15' })
    } else if (olympic && age < 13) {
      out.push({ name: a.name, age, reason: 'weightlifting derivatives before 13' })
    }
  }
  return out
}

/** One sentence a coach can act on, or null when there is nothing to say. */
export function concernSummary(notes: SafetyNote[]): string | null {
  if (!notes.length) return null
  const reason = notes[0].reason
  const names = notes.map((n) => `${n.name} (${n.age})`)
  const who = names.length === 1
    ? names[0]
    : `${names.slice(0, -1).join(', ')} and ${names[names.length - 1]}`
  return `This prescribes ${reason}. Check it before sending to ${who}.`
}
