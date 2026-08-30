// ═══════════════════════════════════════════════════════════════════════
// WHY THIS TEST MATTERS — for THIS athlete's event.
//
// Two things go on a metric's detail sheet: what the test actually measures,
// and what it is worth for the event the athlete competes in. The second half
// is the point. Vertical stiffness matters differently to a 100m runner and a
// 5000m runner, and a screen that says "power is important" to everyone is
// saying nothing.
//
// ── RULES FOR WHAT GOES IN HERE ────────────────────────────────────
// 1. NO INVENTED CITATIONS. Every reference below was checked against the
//    source before it was written down — author, year, journal, and the
//    actual finding. Where no verified reference exists, the mechanism is
//    stated plainly with no citation attached to it. A fabricated reference
//    in a youth sport product is worse than no reference.
// 2. THE EVIDENCE IS ALLOWED TO BE INCONVENIENT. Sit-and-reach is the example
//    worth keeping in mind: for distance runners, LESS flexibility goes with
//    BETTER running economy. An app that quietly assumed more is better on
//    every axis would be coaching against the literature.
// 3. RELEVANCE IS RANKED, NOT ASSERTED. The event's own quality priorities
//    already exist in disciplineScience; the note says where this axis sits
//    in that order rather than calling everything important.
// ═══════════════════════════════════════════════════════════════════════

import { RADAR_AXES, disciplineFamily, disciplinePriority } from './disciplineScience'

export interface Reference {
  /** The finding, in one line, with its numbers where they exist. */
  claim: string
  /** Author, year, journal — as verified against the source. */
  cite: string
  url: string
}

// ── Verified references ────────────────────────────────────────────
// Each of these was fetched and read. The numbers are the paper's own.
export const REFS: Record<string, Reference> = {
  rsi: {
    claim:
      'Ground contact time and jump height together describe how well an athlete uses '
      + 'the stretch-shortening cycle — the reactive strength index was proposed as the '
      + 'way to prescribe and monitor fast SSC work rather than jump height alone.',
    cite: 'Flanagan & Comyns (2008), Strength and Conditioning Journal 30(6): 32–38',
    url: 'https://journals.lww.com/nsca-scj/fulltext/2008/10000/the_use_of_contact_time_and_the_reactive_strength.5.aspx',
  },
  horizontalForce: {
    claim:
      'Across a 100m, acceleration occupies roughly 60–70% of race time. How well force '
      + 'is oriented horizontally — not how much total force is produced — tracked sprint '
      + 'velocity (r = 0.899, p < 0.001), while total force did not relate to 100m '
      + 'performance at all (p = 0.16). Vertical force related to top speed, not to acceleration.',
    cite: 'Morin, Edouard & Samozino (2013), New Studies in Athletics 28(3/4): 87–103',
    url: 'https://worldathletics.org/download/downloadnsa?filename=24d13356-c773-4aba-ade4-54c51d7cf37c.pdf',
  },
  relativeStrength: {
    claim:
      'In 63 trained youth players, strength relative to body mass correlated with jump '
      + 'performance at r = 0.52–0.58 while absolute 1RM managed only r = 0.16–0.26. '
      + 'For sprinting both were moderate and the difference was not significant.',
    cite: 'Wagner et al. (2023), Montenegrin Journal of Sports Science and Medicine',
    url: 'https://www.mjssm.me/clanci/MJSSM_March_2023_Wagner.pdf',
  },
  sitAndReach: {
    claim:
      'In 34 international-standard male distance runners, POORER sit-and-reach scores went '
      + 'with better running economy (r = 0.68, p < 0.0001). The proposed mechanism is that '
      + 'stiffer musculotendinous structures return more elastic energy through the '
      + 'stretch-shortening cycle, lowering the oxygen cost of submaximal running.',
    cite: 'Jones (2002), International Journal of Sports Medicine 23(1): 40–43',
    url: 'https://www.thieme-connect.com/products/ejournals/abstract/10.1055/s-2002-19271',
  },
}

// ── What each test measures ────────────────────────────────────────
// Mechanism only — no claim about importance, which is the event's business.
const MECHANISM: Record<string, string> = {
  // Acceleration
  sprint_10m: 'Time over the first 10 metres from a stationary start. Almost entirely a measure of how much force you can put into the ground behind you, and how well you can orient it horizontally while your body is still low.',
  sprint_20m: 'The first 20 metres — still acceleration, but far enough out that early upright mechanics start to show.',
  sprint_30m: 'Thirty metres from a standstill. Long enough to cover the whole acceleration phase for most youth athletes, short enough that top speed barely contributes.',
  sprint_40m: 'Forty metres from a standstill — acceleration plus the transition into upright running.',
  sprint_100m: 'A full 100m. Everything at once: the start, acceleration, top speed and how much of it you keep to the line — which is why it diagnoses nothing on its own. The splits are what tell you where the time went.',
  split_300m: 'A 300m effort. Long enough that it stops being a speed test and becomes a speed-endurance one — your ability to keep producing force as lactate accumulates.',
  broad_jump: 'A standing horizontal jump. A quick, equipment-free read on horizontal power production from a static position.',

  // Top speed
  flying_10m: 'Ten metres timed with a run-up, so the clock starts at full speed. The cleanest field measure of maximum velocity, because it removes the start entirely.',
  max_velocity: 'The highest speed reached, usually from radar or timing gates. What the whole middle of a short sprint is built around.',
  sprint_60m: 'Sixty metres — long enough that most athletes reach top speed, so it blends acceleration and maximum velocity.',

  // Power
  cmj_height: 'Countermovement jump height. A dip then a jump, so it measures concentric power with a fast eccentric pre-load — the everyday index of lower-body explosiveness.',
  sj_height: 'Squat jump height, held at the bottom before jumping. Removing the countermovement strips out the elastic contribution, so the gap between this and your CMJ is your stretch-shortening contribution.',
  rsi_dj30: 'Reactive strength index from a 30cm drop jump: jump height divided by ground contact time. It rewards bouncing, not grinding — a high jump off a slow contact scores badly.',
  rsi_mod: 'Modified RSI from a countermovement jump — jump height over time to take off. A gentler version of the same idea for athletes not yet ready for drop jumps.',
  cmj_rel_pp: 'Peak power in the countermovement jump divided by body mass. Power that has to move you, rather than raw wattage.',
  cmj_peak_force: 'Peak ground reaction force in the countermovement jump, in newtons. Absolute force output — read it next to your body mass, since a heavier athlete produces more of it without necessarily jumping higher.',
  eur: 'Eccentric utilisation ratio: countermovement jump height divided by squat jump height. It isolates how much your jump comes from the stretch-shortening cycle rather than from concentric strength alone. Around 1.0 means you are getting little from the countermovement.',

  // Strength
  back_squat_1rm: 'The heaviest single back squat. A measure of maximal lower-body force production through a long range.',
  deadlift_1rm: 'The heaviest single deadlift. Posterior-chain-dominant maximal strength from a dead stop.',
  power_clean_1rm: 'The heaviest single power clean. Maximal strength expressed at speed — the bar has to move fast to be caught.',
  bench_1rm: 'The heaviest single bench press. Upper-body pressing strength.',
  imtp_rel_force: 'Isometric mid-thigh pull force relative to body mass. A pull against an immovable bar, so it measures force production without any technique or fatigue from moving a load.',
  imtp_peak_force: 'Peak force in the isometric mid-thigh pull, in newtons. Maximal force with no movement and no technique confound. Divide by body mass before comparing yourself with anyone.',
  imtp_rfd_100: 'Force produced in the first 100 milliseconds of an isometric mid-thigh pull. Ground contact in a sprint lasts around a tenth of a second, so how fast you can produce force matters more than how much you could eventually produce.',
  front_squat_1rm: 'The heaviest single front squat. More upright than a back squat, so it loads the quadriceps and trunk harder and the hips less.',
  snatch_1rm: 'The heaviest single snatch. Maximal power expressed through a full-body triple extension — a technical lift, so it measures skill as much as capacity.',
  hip_thrust_1rm: 'The heaviest single hip thrust. Loads hip extension horizontally, which is the direction acceleration needs force in.',
  weighted_pullup: 'The heaviest added load for a single pull-up. Upper-body pulling strength above your own body mass.',
  pullup_max: 'Maximum strict pull-ups. Relative upper-body pulling strength — it scales against your own body mass by definition.',

  // Mobility
  sit_and_reach: 'A seated forward reach. A crude measure of posterior-chain and lower-back extensibility. Read the note below before assuming a higher score is a better one.',
  knee_to_wall_l: 'Ankle dorsiflexion range on the left, measured as how far the foot can sit from a wall with the knee still touching it.',
  knee_to_wall_r: 'Ankle dorsiflexion range on the right. Compare it with the left — the asymmetry is usually more informative than either number.',
  fms_total: 'Functional Movement Screen composite. A movement-quality screen, not a performance test.',
  shoulder_flex: 'Shoulder flexion range. Matters most where the arms have to get overhead or behind the trunk under load.',
  thomas_l: 'Thomas test on the left — hip flexor length. Restriction here limits how far the hip can extend behind you, which is where sprint propulsion happens.',
  thomas_r: 'Thomas test on the right. As with ankles, the difference between sides usually says more than either number.',
  aslr_l: 'Active straight leg raise, left. Part hamstring extensibility, part the trunk control to keep the other leg down while you lift.',
  aslr_r: 'Active straight leg raise, right.',
  overhead_squat: 'An overhead squat screen. A movement-quality check across ankles, hips and shoulders at once — a screen, not a performance test.',
  adductor_squeeze: 'Force produced squeezing the knees together, usually against a dynamometer. Primarily a groin-health marker: a drop from your own baseline is the signal worth acting on, not the absolute number.',

  // Conditioning
  vo2_max: 'Maximum rate of oxygen uptake. The ceiling on aerobic energy supply, and largely a measure of central capacity — heart, blood, lungs.',
  yoyo_ir1: 'Yo-Yo Intermittent Recovery Level 1 distance. Repeated shuttle running with short recoveries, so it measures the ability to keep repeating high-intensity efforts.',
  mas: 'Maximal aerobic speed — the slowest speed at which you reach VO₂max. More useful than VO₂max for prescribing running paces, because it is already in units you can run at.',
  iftt_30_15: 'The 30-15 Intermittent Fitness Test speed. An intermittent test that gives a speed for interval prescription, accounting for change of direction and recovery.',
  rhr: 'Resting heart rate. A crude, cheap marker of aerobic conditioning and, tracked daily, of accumulated fatigue.',
  tt_1200m: 'A 1200m time trial. A practical read on aerobic power without lab equipment.',
  tt_2km: 'A 2km time trial. Longer, so it leans further toward aerobic endurance.',
  bronco: 'The Bronco shuttle test — 20, 40 and 60m shuttles, five times through. A repeated-effort conditioning test.',
  yoyo_ir2: 'Yo-Yo Intermittent Recovery Level 2. Starts faster than Level 1, so it leans harder on anaerobic contribution and recovery between efforts — for athletes who have outgrown Level 1.',

  // Body composition and anthropometrics — measurements, not performances
  body_mass: 'Body mass. Not a performance test: it is the denominator. Almost every measure that matters in a running or jumping event is force, power or oxygen uptake PER KILOGRAM, so mass changes those numbers without you getting any better or worse at anything.',
  standing_height: 'Standing height. Tracked to follow growth, not to be improved.',
  sitting_height: 'Seated height. Paired with standing height it gives leg length, which is what makes a maturity estimate possible.',
  wingspan: 'Arm span. A fixed anthropometric — relevant in throws and hurdles, not something training changes.',
  lean_mass: 'Estimated fat-free mass. The part of body mass that produces force.',
  fat_mass: 'Estimated fat mass.',
  body_fat_pct: 'Estimated body fat percentage.',
  sum_7_skinfolds: 'Sum of seven skinfold sites. A tracking measure of body composition change over time — the trend is the signal, not any single reading.',

  // Wellness
  hrv_rmssd: 'Heart rate variability (RMSSD). A daily readiness marker rather than a fitness one; the rolling trend is worth more than any single morning.',
  hr_recovery_60: 'Heart rate drop in the 60 seconds after hard exercise. A marker of aerobic recovery capacity.',
}

// Which axis a metric belongs to, taken from the same map the DNA radar uses
// so a metric can never sit in one axis here and another there.
const AXIS_OF: Record<string, string> = {
  sprint_10m: 'acceleration', sprint_20m: 'acceleration', sprint_30m: 'acceleration',
  sprint_40m: 'acceleration', broad_jump: 'acceleration',
  hip_thrust_1rm: 'acceleration',
  flying_10m: 'topSpeed', max_velocity: 'topSpeed', sprint_60m: 'topSpeed',
  cmj_height: 'power', sj_height: 'power', rsi_dj30: 'power', rsi_mod: 'power',
  cmj_rel_pp: 'power', cmj_peak_force: 'power', eur: 'power', imtp_rfd_100: 'power',
  snatch_1rm: 'power',
  back_squat_1rm: 'strength', deadlift_1rm: 'strength', power_clean_1rm: 'strength',
  bench_1rm: 'strength', imtp_rel_force: 'strength', pullup_max: 'strength',
  imtp_peak_force: 'strength', front_squat_1rm: 'strength', weighted_pullup: 'strength',
  sit_and_reach: 'mobility', knee_to_wall_l: 'mobility', knee_to_wall_r: 'mobility',
  fms_total: 'mobility', shoulder_flex: 'mobility',
  thomas_l: 'mobility', thomas_r: 'mobility', aslr_l: 'mobility', aslr_r: 'mobility',
  overhead_squat: 'mobility',
  vo2_max: 'conditioning', yoyo_ir1: 'conditioning', mas: 'conditioning',
  iftt_30_15: 'conditioning', rhr: 'conditioning', tt_1200m: 'conditioning',
  tt_2km: 'conditioning', bronco: 'conditioning', yoyo_ir2: 'conditioning',
}

const AXIS_LABEL: Record<string, string> =
  Object.fromEntries(RADAR_AXES.map((a: any) => [a.key, a.label]))

// ── Event-specific notes ───────────────────────────────────────────
// Written where the generic "this ranks Nth for your event" line would miss
// something an athlete should actually know. Keyed axis → discipline family.
const SPECIFIC: Record<string, Partial<Record<string, string>>> = {
  acceleration: {
    sprint: 'Acceleration is roughly the first 30–40m of your race, and around 60–70% of your total 100m time is spent getting to top speed. Improving it moves the whole race.',
    longSprint: 'You accelerate once and then have to hold form for a long time. Acceleration matters, but not at the expense of the speed endurance the event is decided by.',
    hurdles: 'Your acceleration has to arrive at hurdle one in the right stride pattern. Raw 10m time is worth less to you than a 10m time you can repeat into a fixed take-off point.',
    jumps: 'Your approach run is an acceleration problem with a fixed end point. Faster is only better if you still arrive at the board in control.',
    throws: 'Short-distance acceleration is a general power marker for you rather than an event demand.',
    midDistance: 'Useful for a finishing kick and little else. Do not build your block around it.',
    distance: 'Barely relevant to your event. Worth having, not worth training for.',
  },
  topSpeed: {
    sprint: 'This is the single quality your event is most decided by. A 100m is won in the middle of it, and top speed is what you are defending from 60m onward.',
    longSprint: 'Your top speed sets the ceiling your race pace is a percentage of. Raising it lowers the relative effort of running your current 400m pace.',
    hurdles: 'Top speed matters, but only the part of it you can express inside the stride pattern between hurdles.',
    jumps: 'Approach velocity is the largest single input to how far you jump. This is close to the top of your list.',
    throws: 'Not an event demand. A general athleticism marker for you.',
    midDistance: 'Relevant to the last 200m, not to the first 1300.',
    distance: 'Largely irrelevant to your event.',
  },
  power: {
    sprint: 'Sprinting is a series of very short, very forceful ground contacts. Jump testing is the cheapest window onto whether that quality is improving.',
    longSprint: 'Power holds your mechanics together as fatigue arrives. It matters most in the last 100m, when it is disappearing.',
    hurdles: 'Every hurdle is a jump you have to do at speed and then recover from. This sits high for you.',
    jumps: 'This is your event, expressed in a test. Little needs explaining here.',
    throws: 'Throwing is strength delivered fast. Jump tests track the "fast" half of that.',
    midDistance: 'Supports economy and a finishing kick. A supporting quality rather than a target.',
    distance: 'Relevant through economy and elastic return, not through peak output.',
  },
  strength: {
    sprint: 'Strength is what makes force production possible, but it is not the thing itself — a stronger squat only helps if it turns into force applied in the tenth of a second your foot is down.',
    longSprint: 'Strength underpins your ability to hold mechanics when the race hurts.',
    hurdles: 'Needed for take-off and landing, and for tolerating the repeated impact.',
    jumps: 'The base under your power. It matters, but relative strength matters more than absolute.',
    throws: 'The primary quality for your event. Almost everything else you do supports it.',
    midDistance: 'Mostly injury resilience and economy rather than performance directly.',
    distance: 'Strength work supports economy and durability. It will not make you aerobically fitter.',
  },
  mobility: {
    sprint: 'Enough range to reach the positions your event needs, and no more. Chasing flexibility beyond that is not a performance strategy.',
    longSprint: 'Range for stride mechanics, and enough tissue tolerance to keep repeating them.',
    hurdles: 'The one event where mobility is genuinely a performance quality rather than a maintenance one — lead-leg and trail-leg range determine how low and fast you can get over the barrier.',
    jumps: 'Enough range to hit take-off positions. Ankle stiffness is an asset here, not a fault.',
    throws: 'Thoracic and shoulder range set how long a path you can accelerate the implement over.',
    midDistance: 'A maintenance quality. See the evidence note below before chasing a bigger sit-and-reach score.',
    distance: 'Read the evidence note below carefully. More flexibility is not obviously better for you.',
  },
  conditioning: {
    sprint: 'Enough conditioning to complete your training week and recover between reps. It is not a performance quality for a 100m runner and a big aerobic block will cost you elsewhere.',
    longSprint: 'The 400m is the event where this stops being support and becomes the race. Your ability to keep producing force as lactate accumulates is what the last 100m is.',
    hurdles: 'Support quality — enough to hold technique through a full session.',
    jumps: 'Support quality. Enough to complete a long competition, no more.',
    midDistance: 'One of the two things your event is decided by, alongside your ability to run fast when tired.',
    distance: 'This is your event, in a test.',
  },
}

// Relevance that does not follow from the axis. These are the measures whose
// point is something other than "this quality ranks Nth for your event".
const METRIC_SPECIFIC: Record<string, string> = {
  adductor_squeeze: 'Tracked for groin health rather than performance. What matters is your own trend: a meaningful fall from your established baseline is a recognised warning sign in sports with sprinting and change of direction, and is worth acting on before it becomes pain.',
  sprint_100m: 'This is your event rather than a test of it. Use the 10m and flying-10m splits to find out WHERE the time is going; a full 100m only tells you that it went.',
  standing_height: 'Tracked to follow growth. Alongside seated height it is what makes a maturity estimate possible, which is what decides how aggressively your programs are allowed to load you.',
  sitting_height: 'Tracked to follow growth. Paired with standing height it gives leg length, and with it an estimate of where you are relative to your growth spurt — which changes what training is appropriate.',
  body_mass: 'Not something to improve, and not something the app scores you on. It matters because it is the denominator under almost every number that does: force, power and oxygen uptake per kilogram.',
}

export interface MetricNote {
  /** What the test measures. Always present. */
  mechanism: string
  /** What it is worth for this athlete's event. */
  relevance: string
  /** Where this axis ranks among the event's qualities, 1 = most important. */
  rank: number | null
  rankOf: number
  axisLabel: string | null
  reference: Reference | null
}

/**
 * The note for one metric, for one athlete's event.
 *
 * Returns a usable note even for a metric with no entry here — the fallback
 * says plainly that the app has nothing specific to add, rather than inventing
 * something that sounds like coaching.
 */
export function metricNote(metricKey: string, discipline?: string | null): MetricNote {
  const axis = AXIS_OF[metricKey] || null
  const family = disciplineFamily(discipline || '')
  const priority: string[] = axis ? disciplinePriority(discipline || '') : []
  const idx = axis ? priority.indexOf(axis) : -1

  const specific = METRIC_SPECIFIC[metricKey] || (axis ? SPECIFIC[axis]?.[family] : null)
  const rank = idx >= 0 ? idx + 1 : null

  let relevance: string
  if (specific) {
    relevance = specific
  } else if (axis && rank) {
    // No bespoke line for this axis-and-event pair: say where it ranks and
    // stop, rather than padding it out into advice.
    relevance = `${AXIS_LABEL[axis] || axis} ranks ${rank} of ${priority.length} for your event.`
  } else {
    relevance = 'This is a tracking measurement rather than a performance quality — the trend over time is what it is for.'
  }

  // References attach to the metric, not the axis, where the finding is about
  // that specific test.
  let reference: Reference | null = null
  if (metricKey === 'sit_and_reach') reference = REFS.sitAndReach
  else if (metricKey === 'rsi_dj30' || metricKey === 'rsi_mod') reference = REFS.rsi
  else if (axis === 'acceleration' && family !== 'distance' && family !== 'midDistance') reference = REFS.horizontalForce
  else if (axis === 'topSpeed' && (family === 'sprint' || family === 'hurdles' || family === 'jumps')) reference = REFS.horizontalForce
  else if (axis === 'strength' && metricKey !== 'adductor_squeeze') reference = REFS.relativeStrength
  else if (metricKey === 'cmj_rel_pp' || metricKey === 'imtp_rel_force') reference = REFS.relativeStrength

  return {
    mechanism: MECHANISM[metricKey]
      || 'A tracked measurement. The app has no specific note for this one yet.',
    relevance,
    rank,
    rankOf: priority.length || 6,
    axisLabel: axis ? (AXIS_LABEL[axis] || axis) : null,
    reference,
  }
}
