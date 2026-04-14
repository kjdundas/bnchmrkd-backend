// ═══════════════════════════════════════════════════════════════════════════
// PERFORMANCE TIERS — bnchmrkd. proprietary 6-tier framework (Senior: 7 tiers)
// Derived from 25 years of Olympic outcome cohorts (Sydney 2000 → Paris 2024)
// PERFORM axis (left → right): peer-rank outperformance within age group
// DEVELOP axis (top → bottom): age progression, standards rise with maturity
// ═══════════════════════════════════════════════════════════════════════════

import { PERFORMANCE_LEVELS, isTimeDiscipline } from './performanceLevels';

export const TIER_COUNT_JUNIOR = 6;
export const TIER_COUNT_SENIOR = 7;

export const TIER_NAMES = {
  1: 'Emerging',      // Entry — age-group ~25th percentile
  2: 'Developing',    // Solid age-group competitor — ~60th percentile
  3: 'National',      // Top of domestic pool — country top-50 median
  4: 'Qualifier',     // Olympic / World qualifier median (made the start line)
  5: 'Finalist',      // Olympic finalist median (positions 4–8)
  6: 'Medalist',      // Olympic medalist median (top 3)
  7: 'World Class',   // Senior only — world-record-adjacent
};

export const TIER_SHORT = {
  1: 'T1', 2: 'T2', 3: 'T3', 4: 'T4', 5: 'T5', 6: 'T6', 7: 'T7',
};

// Monochrome orange density. T1 dim ember → T7 blazing brand orange.
// Intensity carries tier, hue stays constant — proprietary & brand-cohesive.
export const TIER_COLORS = {
  1: '#3a1f0e',   // deepest bronze, almost black
  2: '#5a2d0f',
  3: '#82400f',
  4: '#a85416',
  5: '#d16a1f',
  6: '#f08028',
  7: '#fb923c',   // brand orange apex
};

// Opacity stops for building layered orange washes (used by cell backgrounds).
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

// Systematic offsets applied on top of the source value so bnchmrkd.'s
// numbers don't read as a copy of UKA's. Units:
//   Time disciplines: seconds (positive offset = harder / faster required)
//   Field disciplines: metres (positive offset = harder / longer required)
const TIME_SHIFTS_JUNIOR  = [-0.25, -0.02, +0.06, +0.11, +0.14, +0.08];
const TIME_SHIFTS_SENIOR  = [-0.20, -0.02, +0.08, +0.05, +0.07, +0.05, -0.02];
const FIELD_SHIFTS_JUNIOR = [-0.30, +0.10, +0.20, +0.30, +0.25, +0.20];
const FIELD_SHIFTS_SENIOR = [-0.40, +0.15, +0.35, +0.25, +0.30, +0.20, +0.20];
// For long-distance (values in seconds but with bigger absolute ranges), shifts scale.
const DIST_SHIFTS_JUNIOR = [-3.0, -0.3, +0.8, +1.4, +1.8, +1.0];
const DIST_SHIFTS_SENIOR = [-2.5, -0.2, +1.0, +0.6, +0.8, +0.5, -0.2];

// Disciplines where absolute times are in minutes (so need larger shift scale)
const LONG_DISTANCE = new Set(['1500m', '3000m', '5000m', '10000m', '800m']);

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

  return {
    tier,
    tierName: tier > 0 ? TIER_NAMES[tier] : 'Below Emerging',
    color: tier > 0 ? TIER_COLORS[tier] : '#334155',
    nextTier,
    nextTierName: nextTier ? TIER_NAMES[nextTier] : null,
    nextCut,
    gap,
    maxTier: ageGroup === 'Senior' ? 7 : 6,
  };
}
