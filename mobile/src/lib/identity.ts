// ═══════════════════════════════════════════════════════════════════════
// SEX, SPELLED ONE WAY.
//
// user_profiles.gender is character(1). Five places in this app decided
// independently what to put in it, and two of them chose a six-letter word:
//
//   LoginScreen      sex === 'F' ? 'Female' : 'Male'   → auth metadata
//   AuthContext      gender: authGender                → straight through
//   ProfileScreen    sex === 'F' ? 'Female' : ...      → straight through
//   CoachRoster      scrapedGender || 'M'
//   AuthContext      gender === 'Female' ? 'F' : ...   → and back again
//
// So every profile save returned 22001, "value too long for type
// character(1)", and no user of this app — coach or athlete — has ever
// successfully edited their own name, club, country, date of birth or sex.
// Carolina hit it trying to correct her details; Keenan hit it on the coach
// side ten seconds later. It was not one screen's bug. It was five
// spellings of one fact and no single place that owned it.
//
// Sign-up survived only because the handle_new_user trigger normalises
// 'Male'/'Female' down to one character on its way in. The column has held
// 'M' and 'F' the whole time, which is why reads looked healthy while every
// write failed.
//
// This file is that single place. Everything that writes the column calls
// toGenderColumn; everything that reads it calls toSexCode; the two are
// inverses and they live four lines apart so they cannot drift again.
// ═══════════════════════════════════════════════════════════════════════

/** The one-character form the database column holds. */
export type SexCode = 'M' | 'F'

/**
 * Read anything this codebase or its data has ever called a sex, and return
 * the one-character code, or null when it genuinely is not stated.
 *
 * Deliberately permissive on input and strict on output. Old rows, auth
 * metadata written by earlier builds, scraped World Athletics fields and the
 * two buttons on the profile form have all spelled this differently, and a
 * reader that only understood its own spelling is what produced a screen
 * showing "Men's" selected for a woman.
 */
export function toSexCode(value: unknown): SexCode | null {
  if (value == null) return null
  const v = String(value).trim().toLowerCase()
  if (v === '') return null
  if (v === 'f' || v === 'female' || v === 'w' || v === 'women' || v === "women's") return 'F'
  if (v === 'm' || v === 'male' || v === 'men' || v === "men's") return 'M'
  return null
}

/**
 * The value to WRITE to user_profiles.gender / coach_roster.gender.
 *
 * Identical to toSexCode today, and named separately on purpose: the column
 * is the constraint, and a call site that says "column" is a call site whose
 * author was thinking about the column. `null` clears it, which is what the
 * column allows and what "prefer not to say" means.
 */
export function toGenderColumn(value: unknown): SexCode | null {
  return toSexCode(value)
}

/** For a label, a heading, a sentence. Never for a write. */
export function sexLabel(value: unknown): string | null {
  const c = toSexCode(value)
  return c === 'F' ? "Women's" : c === 'M' ? "Men's" : null
}
