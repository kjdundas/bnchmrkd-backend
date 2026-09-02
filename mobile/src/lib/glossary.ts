// ═══════════════════════════════════════════════════════════════════════
// WHAT THAT WORD MEANS.
//
// The app is full of terms that are obvious to a coach and opaque to a
// fifteen-year-old: percentile, tier, circa-PHV, wind-assisted, season best,
// readiness. Some of them are load-bearing — an athlete who misreads
// "wind-assisted" thinks the app has stolen their personal best.
//
// One entry per term, written to be read on a phone by somebody who is not
// a sports scientist. Two rules held throughout:
//
//   Say what it IS before what it is for. A definition that opens with
//   "this helps you track…" has not defined anything.
//
//   Say the limitation in the same breath. Where a number is an estimate,
//   the entry says so — it is the same honesty the panels themselves carry,
//   and hiding it in a help sheet would be worse than not explaining at all.
// ═══════════════════════════════════════════════════════════════════════

export type GlossaryEntry = {
  title: string
  body: string
  /** The bit people get wrong, when there is one. */
  note?: string
}

export const GLOSSARY: Record<string, GlossaryEntry> = {
  tier: {
    title: 'Level',
    body: 'Where a mark sits against real athletes of the same sex and age '
      + 'group, from Club up to World Class. It is not a score out of ten — '
      + 'each level is a band drawn from a database of actual results.',
    note: 'It moves with your age group, so the same mark can be a different '
      + 'level next season. That is the point: you are compared to people your '
      + 'own age, not to adults.',
  },
  percentile: {
    title: 'Percentile',
    body: 'The share of athletes in your age group and event that this mark '
      + 'is better than. 67% means roughly two thirds of them are behind it.',
    note: 'It is not a mark out of 100 and it is not a school grade. 50% is '
      + 'exactly average, which for a competitive athlete is a real place to '
      + 'be starting from.',
  },
  pb: {
    title: 'Personal best',
    body: 'Your best legal mark in one event, ever. Every event has its own — '
      + 'a 100m best and a 200m best are separate things and never mix.',
    note: 'Only completed, legal results count. A DNF, a disqualification or '
      + 'a wind-assisted sprint is kept in your log but cannot become a best.',
  },
  seasonBest: {
    title: 'Season best',
    body: 'Your best mark within one calendar year. It is how form is read '
      + 'across a season, where a personal best from three years ago says '
      + 'nothing about where you are now.',
  },
  windAssisted: {
    title: 'Wind-assisted',
    body: 'In sprints and horizontal jumps, a following wind above +2.0 m/s '
      + 'makes a mark ineligible for records and bests. The rule is World '
      + 'Athletics’, not ours.',
    note: 'The result stays in your log and still happened — it just cannot '
      + 'become a personal best. If it is missing a wind reading it is treated '
      + 'as legal.',
  },
  approval: {
    title: 'Waiting for approval',
    body: 'When you have a coach, a result you enter goes to them to confirm '
      + 'before it counts towards your bests and the leaderboards. When your '
      + 'coach enters something for you, it comes to you the same way.',
    note: 'Nothing is deleted while it waits, and an athlete with no coach '
      + 'never sees any of this — their results count immediately.',
  },
  readiness: {
    title: 'Readiness',
    body: 'A traffic light built from your last check-in: sleep, energy, '
      + 'soreness and mood. Green means nothing stands out, amber means one '
      + 'or two things are low, red means several are.',
    note: 'It describes what you reported this morning. It is not a medical '
      + 'assessment and it does not know about anything you did not tell it.',
  },
  phv: {
    title: 'Growth spurt',
    body: 'Peak height velocity is the fastest part of the adolescent growth '
      + 'spurt. Around it, bones lengthen before muscles and tendons catch up, '
      + 'so an athlete is temporarily longer-levered, relatively weaker and '
      + 'less coordinated than they were a few months ago.',
    note: 'Growth is measured here, not guessed — from repeated heights over '
      + 'time. A dip in results through a spurt is usually the spurt, not a '
      + 'loss of form.',
  },
  growthRate: {
    title: 'cm per year',
    body: 'How fast this athlete is currently growing, worked out from their '
      + 'height measurements and stretched to a yearly rate. 7.2 cm/yr and '
      + 'above is the point where studies of academy athletes found more '
      + 'injuries.',
    note: 'Those studies were all male academy footballers; no female '
      + 'equivalent has been published. Treat it as a prompt to look, not a '
      + 'line somebody has crossed.',
  },
  projection: {
    title: 'Where this could go',
    body: 'A development curve built from the year-on-year improvement rates '
      + 'of real athletes in this event, by age. The shaded band is the range '
      + 'between the slower and faster quarters of them.',
    note: 'It is a spread of what has happened to other people, not a '
      + 'prediction about you, and not a target to be judged against.',
  },
  squad: {
    title: 'Squads',
    body: 'Your own groupings — a sprint group, a Tuesday session, an age '
      + 'band. Filtering to a squad filters the whole screen: the boards, the '
      + 'week, and who gets assigned what.',
    note: 'An athlete can sit in one squad. Anyone you have not filed shows '
      + 'up under Unassigned rather than disappearing.',
  },
  rosterAthlete: {
    title: 'Athletes without an account',
    body: 'You can keep an athlete who has no phone entirely yourself — you '
      + 'enter their results and measurements, and they appear everywhere a '
      + 'linked athlete does.',
    note: 'Because there is nobody on the other side, nothing they have needs '
      + 'approving and they cannot check in.',
  },
  sharing: {
    title: 'What your coach sees',
    body: 'Your competition results are always shared — that is what a coach '
      + 'is for. Wellness, pain, test results and measurements are each a '
      + 'separate switch that you control.',
    note: 'Switching one off applies immediately, and your coach is told it '
      + 'is off rather than being shown an empty screen they might read as '
      + 'you having stopped logging.',
  },
}

export type GlossaryKey = keyof typeof GLOSSARY
