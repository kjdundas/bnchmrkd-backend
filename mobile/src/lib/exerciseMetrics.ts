// ═══════════════════════════════════════════════════════════════════════
// PRESCRIBED EXERCISE → TRACKABLE METRIC
//
// Some of what a program prescribes is also a test the athlete tracks. A back
// squat in a gym block is the same movement as the back_squat_1rm on their
// DNA ladder; a 30m sprint in a track block is the sprint_30m that feeds the
// acceleration axis. Where that is true, the exercise should offer to log
// itself as a metric rather than making the athlete retype it in the Log tab.
//
// ── ONLY WHERE THE MATCH IS CERTAIN ────────────────────────────────
// A wrong match is worse than no match: it would file a set of 5 at 70% as a
// one-rep max, or a flying 30 as a standing 30. So this matches on explicit
// patterns rather than fuzzy similarity, and returns null the moment it is
// unsure. Most prescribed exercises SHOULD return null — that is correct
// behaviour, not a gap.
//
// The trap worth naming: "Flying 30m sprints" contains "30m", and a naive
// match would file it as sprint_30m. A flying 30 is a different test from a
// standing 30 — the whole point of it is that the acceleration is already
// done — so the standing-sprint patterns explicitly refuse anything flying.
// ═══════════════════════════════════════════════════════════════════════

export interface MetricMatch {
  metricKey: string
  /** How the Log sheet should title it. */
  label: string
  unit: string
  /**
   * True when the metric is a MAXIMAL test, so logging it from a submaximal
   * prescription would be wrong. A 4 × 5 @ 70% back squat is not a 1RM.
   */
  maximalOnly: boolean
}

const M = (metricKey: string, label: string, unit: string, maximalOnly = false): MetricMatch =>
  ({ metricKey, label, unit, maximalOnly })

/**
 * Ordered. First match wins, so the more specific pattern must come first —
 * "flying 10" before any bare 10m rule, "front squat" before "squat".
 */
const RULES: { test: RegExp; match: MetricMatch }[] = [
  // ── Jumps, BEFORE the lifts ──
  // "Squat jump" begins with "squat", so a back-squat rule placed above this
  // one swallows it. Order is load-bearing here, not cosmetic.
  //
  // Every "jump" is written `jumps?`: the generator produces "Depth jumps"
  // and "Box jumps" in the plural, and \bjump\b does not match "jumps".
  { test: /\bcountermovement\s*jumps?\b|\bcmj\b/, match: M('cmj_height', 'CMJ jump height', 'cm') },
  { test: /\bsquat\s*jumps?\b|\bsj\b/, match: M('sj_height', 'Squat jump height', 'cm') },
  { test: /\bdepth\s*jumps?\b|\bdrop\s*jumps?\b/, match: M('rsi_dj30', 'RSI (drop jump)', '') },
  { test: /\bbroad\s*jumps?\b|\bstanding\s*long\s*jumps?\b/, match: M('broad_jump', 'Broad jump', 'cm') },

  // ── Maximal strength. These are 1RM tests; a working set is not one. ──
  { test: /\bfront\s*squats?\b/, match: M('front_squat_1rm', 'Front squat 1RM', 'kg', true) },
  { test: /\bback\s*squats?\b|^squats?\b/, match: M('back_squat_1rm', 'Back squat 1RM', 'kg', true) },
  { test: /\bdead\s*lifts?\b|\bdeadlifts?\b/, match: M('deadlift_1rm', 'Deadlift 1RM', 'kg', true) },
  { test: /\bpower\s*cleans?\b/, match: M('power_clean_1rm', 'Power clean 1RM', 'kg', true) },
  { test: /\bsnatch(es)?\b/, match: M('snatch_1rm', 'Snatch 1RM', 'kg', true) },
  { test: /\bbench\s*press(es)?\b|\bbench\b/, match: M('bench_1rm', 'Bench press 1RM', 'kg', true) },
  { test: /\bhip\s*thrusts?\b/, match: M('hip_thrust_1rm', 'Hip thrust 1RM', 'kg', true) },

  // ── Sprints. "flying" first, and excluded from the standing patterns:
  //    a flying 30 and a standing 30 are different tests. ──
  { test: /\bflying\s*10\s*m?\b/, match: M('flying_10m', 'Flying 10m', 's') },
  { test: /\bmax(imum)?\s*velocity\b/, match: M('max_velocity', 'Max velocity', 'm/s') },
  { test: /^(?!.*\bflying\b).*\b10\s*m\b/, match: M('sprint_10m', '10m sprint', 's') },
  { test: /^(?!.*\bflying\b).*\b20\s*m\b/, match: M('sprint_20m', '20m sprint', 's') },
  { test: /^(?!.*\bflying\b).*\b30\s*m\b/, match: M('sprint_30m', '30m sprint', 's') },
  { test: /^(?!.*\bflying\b).*\b40\s*m\b/, match: M('sprint_40m', '40m sprint', 's') },
  { test: /^(?!.*\bflying\b).*\b60\s*m\b/, match: M('sprint_60m', '60m sprint', 's') },
  { test: /^(?!.*\bflying\b).*\b100\s*m\b/, match: M('sprint_100m', '100m sprint', 's') },
  { test: /\b300\s*m\b/, match: M('split_300m', '300m', 's') },

  // ── Conditioning ──
  { test: /\bbronco\b/, match: M('bronco', 'Bronco', 's') },
  { test: /\byo-?\s*yo\b.*\b2\b|\byo-?yo\s*ir2\b/, match: M('yoyo_ir2', 'Yo-Yo IR2', 'm') },
  { test: /\byo-?\s*yo\b/, match: M('yoyo_ir1', 'Yo-Yo IR1', 'm') },
  { test: /\b1200\s*m\b/, match: M('tt_1200m', '1200m time trial', 's') },
  { test: /\b2\s*km\b|\b2000\s*m\b/, match: M('tt_2km', '2km time trial', 's') },

  // ── Mobility ──
  { test: /\bsit\s*(and|&|-)?\s*reach\b/, match: M('sit_and_reach', 'Sit and reach', 'cm') },
]

/**
 * The metric a prescribed exercise corresponds to, or null.
 *
 * `intensity` is consulted because a maximal test cannot be read off a
 * submaximal prescription: a back squat at 70% 1RM is a working set, and
 * offering to log it as a new 1RM would corrupt the number every axis of the
 * athlete's profile is scaled against.
 */
export function metricForExercise(
  name: any,
  intensity?: any,
): MetricMatch | null {
  const n = String(name ?? '').trim().toLowerCase()
  if (!n) return null

  const hit = RULES.find((r) => r.test.test(n))
  if (!hit) return null

  if (hit.match.maximalOnly) {
    const i = String(intensity ?? '').toLowerCase()
    // Anything naming a percentage of 1RM, or an RPE, is by definition not a
    // maximal attempt. Only an explicit max, or a bare/absent intensity where
    // the athlete may genuinely be testing, is allowed through.
    const submaximal = /\d\s*%|\brpe\b|\btechnical\b|\blight\b|\bmedium\b|\beasy\b/.test(i)
    if (submaximal) return null
  }
  return hit.match
}

/** Every exercise in a session that offers a metric, with where it sits. */
export function trackableInSession(session: any): {
  blockIndex: number; exerciseIndex: number; match: MetricMatch; name: string
}[] {
  const out: any[] = []
  const blocks = Array.isArray(session?.blocks) ? session.blocks : []
  blocks.forEach((b: any, bi: number) => {
    const exs = Array.isArray(b?.exercises) ? b.exercises : []
    exs.forEach((e: any, ei: number) => {
      const match = metricForExercise(e?.name, e?.intensity)
      if (match) out.push({ blockIndex: bi, exerciseIndex: ei, match, name: String(e?.name || '') })
    })
  })
  return out
}
