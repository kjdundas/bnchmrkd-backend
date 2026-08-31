// ═══════════════════════════════════════════════════════════════════════
// AGE — one source of truth.
//
// There were seven independent age calculations in this app, in two families
// that disagreed with each other:
//
//   historicalRivals.ageFromDob()  calendar-accurate, compares month and day
//   six copy-pasted sites          Math.floor(elapsed / (365.25 * day))
//
// 365.25 is not a year. It accumulates about three quarters of a day of drift
// per four-year cycle, so the floor flips a day or two either side of the real
// birthday. That is invisible almost everywhere and decisive in exactly the
// place it matters: an athlete on the U17/U20 boundary was showing as U17 in
// the DNA ladder and U20 on Trajectory, on the same day, graded against two
// different sets of standards.
//
// Everything now comes through here.
// ═══════════════════════════════════════════════════════════════════════

/** Age in whole years, by the calendar — the number a person would say. */
export function ageFromDob(dob: string | Date | null | undefined, at: Date = new Date()): number | null {
  if (!dob) return null
  const d = dob instanceof Date ? dob : new Date(dob)
  if (Number.isNaN(d.getTime())) return null
  let age = at.getFullYear() - d.getFullYear()
  const m = at.getMonth() - d.getMonth()
  if (m < 0 || (m === 0 && at.getDate() < d.getDate())) age--
  return age >= 0 && age < 120 ? age : null
}

/**
 * Age including the part-year, to one decimal.
 *
 * For plotting only — a race run in March and one in September of the same
 * year have to land on different points, or a season's worth of marks stacks
 * onto a single x and the trend disappears. Never use this for an age-group
 * lookup: 19.8 floors to 19, but reads as "nearly 20".
 */
export function ageExact(dob: string | Date | null | undefined, at: Date | number = new Date()): number | null {
  if (!dob) return null
  const d = dob instanceof Date ? dob : new Date(dob)
  if (Number.isNaN(d.getTime())) return null
  const t = typeof at === 'number' ? at : at.getTime()
  const whole = ageFromDob(d, new Date(t))
  if (whole == null) return null
  // Anchor on the last birthday, then measure into the current year — so the
  // integer part always agrees with ageFromDob() rather than drifting off it.
  const last = new Date(d)
  last.setFullYear(d.getFullYear() + whole)
  const next = new Date(d)
  next.setFullYear(d.getFullYear() + whole + 1)
  const frac = (t - last.getTime()) / (next.getTime() - last.getTime())
  // FLOOR to a decimal, not round. Rounding 30.96 gives 30.1e1 = 31.0, whose
  // integer part is a year ahead of ageFromDob() — measured, that disagreed on
  // 97 of 2000 sampled days, always in the six weeks before a birthday. Any
  // caller doing Math.floor(ageExact(...)) to get an age group would have
  // aged the athlete early.
  return Math.floor((whole + Math.min(0.999, Math.max(0, frac))) * 10) / 10
}

/** True when a date string is a real, plausible date of birth. */
export function isValidDob(iso: string | null | undefined): boolean {
  const a = ageFromDob(iso)
  return a != null && a >= 4 && a <= 100
}

/** ISO yyyy-mm-dd from day/month/year parts, or null if they aren't a real date. */
export function toIsoDob(day: string, month: string, year: string): string | null {
  const d = Number(day), m = Number(month), y = Number(year)
  if (!Number.isInteger(d) || !Number.isInteger(m) || !Number.isInteger(y)) return null
  if (y < 1900 || y > new Date().getFullYear()) return null
  if (m < 1 || m > 12 || d < 1 || d > 31) return null
  const dt = new Date(Date.UTC(y, m - 1, d))
  // Rejects 31 February and friends: the Date would roll over to March.
  if (dt.getUTCFullYear() !== y || dt.getUTCMonth() !== m - 1 || dt.getUTCDate() !== d) return null
  if (dt.getTime() > Date.now()) return null
  const p = (n: number) => String(n).padStart(2, '0')
  return `${y}-${p(m)}-${p(d)}`
}

/** Split an ISO date back into parts, for editing an existing value. */
export function fromIsoDob(iso: string | null | undefined): { day: string; month: string; year: string } {
  if (!iso) return { day: '', month: '', year: '' }
  const m = /^(\d{4})-(\d{2})-(\d{2})/.exec(String(iso))
  if (!m) return { day: '', month: '', year: '' }
  return { day: String(Number(m[3])), month: String(Number(m[2])), year: m[1] }
}
