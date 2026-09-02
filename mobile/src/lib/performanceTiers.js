// ═══════════════════════════════════════════════════════════════════════════
// PERFORMANCE TIERS — bnchmrkd. proprietary 6-tier framework (Senior: 7 tiers)
// Derived from 25 years of Olympic outcome cohorts (Sydney 2000 → Paris 2024)
// PERFORM axis (left → right): peer-rank outperformance within age group
// DEVELOP axis (top → bottom): age progression, standards rise with maturity
// ═══════════════════════════════════════════════════════════════════════════

import { PERFORMANCE_LEVELS, isTimeDiscipline } from './performanceLevels';

export const TIER_COUNT_JUNIOR = 6;
export const TIER_COUNT_SENIOR = 7;

/** @type {Record<number, string>} */
// Senior percentiles are of public.season_bests, ages 20-32 — World Athletics
// listed seniors, not the general population. T2 is the 70th percentile OF
// THAT, which is a good club athlete, and the name should be read that way.
// T1 alone is off this distribution: it is a development standard from
// Keenan's spreadsheet, kept because season_bests holds no club athletes to
// place an entry rung against.
export const TIER_NAMES = {
  1: 'Emerging',      // Entry — award standard, and the join with the U20 ladder
  2: 'Developing',    // p70 of senior season bests
  3: 'National',      // p40 — top of the domestic pool
  4: 'Qualifier',     // p10 — Olympic / World qualifier median (made the start line)
  5: 'Finalist',      // p5  — Olympic finalist median (positions 4–8)
  6: 'Medalist',      // p1  — Olympic medalist median (top 3)
  7: 'World Class',   // p0.2, Senior only — world-record-adjacent
};

/** @type {Record<number, string>} */
export const TIER_SHORT = {
  1: 'T1', 2: 'T2', 3: 'T3', 4: 'T4', 5: 'T5', 6: 'T6', 7: 'T7',
};

// Monochrome INDIGO density. Constant hue, rising luminance — the same
// "intensity carries tier" idea the orange ramp had, in the brand's actual
// colour. The old ramp ran #3a1f0e → #fb923c and its own comment called
// #fb923c the "brand orange apex", against a project guide that says: one
// brand colour, Electric Indigo #4F3CF0, no orange, that was the old scheme.
// It was rendering on the most prominent element of the home screen.
//
// Every surface that draws these is dark — Trajectory, Full Analysis, the
// coach boards, athlete detail — so the ramp climbs toward light. The old
// one climbed from near-black, which meant T1 and T2 were invisible on the
// surfaces they were drawn on.
/** @type {Record<number, string>} */
export const TIER_COLORS = {
  1: '#4A4770',   // indigo-grey — present, not shouting
  2: '#585096',
  3: '#665ABE',
  4: '#7466E4',
  5: '#8B83FF',   // --indigo-bright
  6: '#A79FFF',
  7: '#C9C4FF',   // apex
};

// ── TIER_COLORS IS A FILL RAMP. IT IS NOT A TEXT RAMP. ──────────────
//
// The ramp above climbs from #4A4770 (L=0.071) to #C9C4FF (L=0.591) so that
// intensity carries tier on a dark surface. That is right for a bar, a lane
// or a chip background, and wrong for a word.
//
// Measured on the live hero: "QUALIFIER" drawn in TIER_COLORS[4] over the
// stadium photograph scored 1.00:1 — the glyph and the ground either side
// of it were both L=0.129, the same colour to three decimal places. The
// text shadow was working; it had darkened the surround to exactly the
// luminance of the letters. On a dark panel it is less severe but still
// fails: T1 lands at 1.95:1.
//
// So there are two ramps. TIER_INK is the same hue walked up in lightness
// until every step clears AA on a panel — 5.2:1 at T1 through 14.2:1 at T7.
// Use it for any tier name, short code or number rendered as TEXT.
/** @type {Record<number, string>} */
export const TIER_INK = {
  1: '#8B7EF5',
  2: '#9C92F7',
  3: '#ACA3F8',
  4: '#BCB5F9',
  5: '#CAC4FA',
  6: '#DAD6FC',
  7: '#EAE8FD',
};

// And a warning that no ramp solves: OVER A PHOTOGRAPH, none of these work
// either. Against the measured backdrop ground, TIER_INK[4] reaches only
// 3.10:1 and even T7 stops at 4.88. Text laid on ScreenBackdrop is white or
// near-white, full stop — the tier is already carried by the word itself and
// by whatever the drawing fills in the tier's colour, which sits on a ground
// it controls rather than one the photographer chose.

// Opacity stops for building layered orange washes (used by cell backgrounds).
/** @type {Record<number, number>} */
export const TIER_OPACITY = {
  1: 0.08,
  2: 0.16,
  3: 0.28,
  4: 0.44,
  5: 0.62,
  6: 0.82,
  7: 1.00,
};

export const AGE_GROUPS = ['U13', 'U15', 'U17', 'U20', 'Senior'];

// ── Rebin logic ──────────────────────────────────────────────────────────
// The legacy PERFORMANCE_LEVELS arrays carry 9 junior cuts (L1–L9) or 12
// Senior cuts (L1–L12). We re-index to 6/7 tiers AND apply a deliberate
// "Olympic-cohort calibration" shift so the published numbers are visibly
// distinct from UKA's award standards while remaining biologically sensible.
// ─────────────────────────────────────────────────────────────────────────

// Source-array indices used to pick the tier cut points (0-indexed into
// the legacy L1–L9 / L1–L12 arrays).
const JUNIOR_SOURCE_IDX = [0, 2, 3, 5, 6, 8];        // L1, L3, L4, L6, L7, L9
const SENIOR_SOURCE_IDX = [0, 2, 4, 7, 9, 10, 11];   // L1, L3, L5, L8, L10, L11, L12

// No offsets — bnchmrkd.'s Performance Levels spreadsheet is the single
// source of truth. Tiers map directly to the calibrated L1–L12 values.
const TIME_SHIFTS_JUNIOR  = [0, 0, 0, 0, 0, 0];
const TIME_SHIFTS_SENIOR  = [0, 0, 0, 0, 0, 0, 0];
const FIELD_SHIFTS_JUNIOR = [0, 0, 0, 0, 0, 0];
const FIELD_SHIFTS_SENIOR = [0, 0, 0, 0, 0, 0, 0];
const DIST_SHIFTS_JUNIOR  = [0, 0, 0, 0, 0, 0];
const DIST_SHIFTS_SENIOR  = [0, 0, 0, 0, 0, 0, 0];

// Disciplines where absolute times are in minutes (so need larger shift scale)
const LONG_DISTANCE = new Set(['1500m', '3000m', '5000m', '10000m', '800m', 'Marathon']);

function applyShift(value, shift, isTime) {
  if (value == null) return null;
  const v = isTime ? value + shift : value + shift;
  return parseFloat(v.toFixed(2));
}

// Derive the 6/7 tier cuts for a given (discipline, gender, ageGroup).
// Returns an array of length 6 (juniors) or 7 (Senior). null entries
// indicate the tier is out of reach for that age group.
export function deriveTiers(discipline, gender, ageGroup) {
  const genderCode = gender === 'Male' || gender === 'M' ? 'M' : 'F';
  const key = `${discipline}_${genderCode}`;
  const levelData = PERFORMANCE_LEVELS[key];
  if (!levelData) return null;
  const source = levelData[ageGroup];
  if (!source) return null;

  const isSenior = ageGroup === 'Senior';
  const isTime = isTimeDiscipline(discipline);
  const isLongDist = LONG_DISTANCE.has(discipline);

  const indices = isSenior ? SENIOR_SOURCE_IDX : JUNIOR_SOURCE_IDX;
  const shifts = isSenior
    ? (isLongDist ? DIST_SHIFTS_SENIOR : isTime ? TIME_SHIFTS_SENIOR : FIELD_SHIFTS_SENIOR)
    : (isLongDist ? DIST_SHIFTS_JUNIOR : isTime ? TIME_SHIFTS_JUNIOR : FIELD_SHIFTS_JUNIOR);

  const cuts = indices.map((srcIdx, i) => {
    const raw = source[srcIdx];
    if (raw == null) return null;
    // For time: +shift makes standard harder (smaller time required)
    //   So a +0.05 shift on 11.68 → threshold becomes 11.63 (need to be faster)
    // For field: +shift makes standard harder (longer throw/jump required)
    //   So a +0.10 shift on 19.50 → threshold becomes 19.60
    const adjusted = isTime ? raw - shifts[i] : raw + shifts[i];
    return parseFloat(adjusted.toFixed(2));
  });

  // Ensure T7 for non-seniors is null
  if (!isSenior && cuts.length === 6) cuts.push(null);
  return cuts;
}

// Build the full 5-row × 7-col matrix of threshold values for a given
// discipline + gender. Returns:
//   { ageGroups: ['U13',...], tiers: [{name, color}...], matrix: [[...]...] }
export function buildMatrix(discipline, gender) {
  const rows = AGE_GROUPS.map(ag => ({
    ageGroup: ag,
    cuts: deriveTiers(discipline, gender, ag) || new Array(7).fill(null),
  }));
  return { ageGroups: AGE_GROUPS, rows };
}

// Given (discipline, gender, ageGroup, pb), return the tier [1..7] the
// athlete currently sits in, plus the next tier target + gap.
export function getTier(discipline, gender, ageGroup, pb) {
  const cuts = deriveTiers(discipline, gender, ageGroup);
  if (!cuts) return null;
  const isTime = isTimeDiscipline(discipline);

  // Walk highest → lowest; find first tier the PB meets.
  let tier = 0;
  for (let i = cuts.length - 1; i >= 0; i--) {
    if (cuts[i] == null) continue;
    const meets = isTime ? pb <= cuts[i] : pb >= cuts[i];
    if (meets) { tier = i + 1; break; }
  }

  // Next tier lookup
  let nextTier = null;
  let nextCut = null;
  for (let i = tier; i < cuts.length; i++) {
    if (cuts[i] != null) { nextTier = i + 1; nextCut = cuts[i]; break; }
  }

  const gap = nextCut != null
    ? parseFloat((isTime ? (pb - nextCut) : (nextCut - pb)).toFixed(2))
    : null;

  // The cut the athlete CLEARED to be in this tier — the lower edge of the
  // band they currently occupy. Needed to express a position as "x% of the
  // way from where this tier starts to where the next one does", which is a
  // scale built entirely from the table rather than from the athlete's own
  // results, and therefore the same scale next week.
  let currentCut = tier > 0 ? cuts[tier - 1] : null;

  // Below the first tier there is no lower edge, so one is projected from the
  // width of the T1→T2 band. Still derived from the table, still stable — it
  // just isn't a standard anyone publishes.
  let floorIsSynthetic = false;
  if (currentCut == null && cuts[0] != null && cuts[1] != null) {
    const band = Math.abs(cuts[1] - cuts[0]);
    currentCut = isTime ? cuts[0] + band : cuts[0] - band;
    floorIsSynthetic = true;
  }

  return {
    tier,
    tierName: tier > 0 ? TIER_NAMES[tier] : 'Below Emerging',
    color: tier > 0 ? TIER_COLORS[tier] : '#334155',
    nextTier,
    nextTierName: nextTier ? TIER_NAMES[nextTier] : null,
    nextCut,
    currentCut,
    floorIsSynthetic,
    gap,
    maxTier: ageGroup === 'Senior' ? 7 : 6,
    /** Every cut for this event/sex/age group, lowest tier first. */
    cuts,
  };
}
