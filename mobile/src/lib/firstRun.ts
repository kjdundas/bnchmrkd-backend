// ═══════════════════════════════════════════════════════════════════════
// GETTING STARTED — what is missing, and what to do about it.
//
// The app had no first run at all. You signed up and landed on a finished
// dashboard with nothing in it: no prompt, no next step, and — for an
// athlete — no way to fix the one thing that mattered most, because there
// was nowhere in the entire app to say what event you compete in.
//
// ── THE ORDER IS THE PRODUCT ──────────────────────────────────────────
// These steps are not a to-do list, they are a dependency chain. An
// athlete's event has to come first because almost everything the app can
// say is keyed on it: a personal best is per event, a tier is per event and
// age group, a projection needs a development curve for that event, a
// leaderboard is one board per event. Log a result before setting an event
// and the app can store it but cannot tell you anything about it.
//
// So the first step is never "log something". It is "tell us what you do",
// and the copy says why rather than just asking.
//
// ── ONE STEP AT A TIME ────────────────────────────────────────────────
// `next` returns the first incomplete step, not all of them. A checklist of
// six is a wall; one card with one button is an instruction. The rest stay
// visible as progress so nobody feels tricked about how much is left.
// ═══════════════════════════════════════════════════════════════════════

export type StepId =
  | 'event' | 'result' | 'checkin' | 'coach'          // athlete
  | 'athlete' | 'squad' | 'assign'                    // coach

export type SetupStep = {
  id: StepId
  title: string
  /** Why this matters — the half that stops it feeling like paperwork. */
  why: string
  /** The button. */
  cta: string
  /** Where it goes: a route name, handled by the screen. */
  route: string
  done: boolean
  /** Skippable steps never block the card from finishing. */
  optional?: boolean
}

export type AthleteFacts = {
  hasEvent: boolean
  hasResult: boolean
  hasCheckin: boolean
  hasCoach: boolean
}

export type CoachFacts = {
  athleteCount: number
  squadCount: number
  hasAssigned: boolean
}

export function athleteSteps(f: AthleteFacts): SetupStep[] {
  return [
    {
      id: 'event',
      title: 'Choose your event',
      // Named consequences, not a vague promise. This is the step people
      // skip, and it is the one that makes everything else work.
      why: 'Everything is measured per event — your best, your level for your '
        + 'age group, and where you sit on a leaderboard. Without it the app '
        + 'can store your results but cannot tell you anything about them.',
      cta: 'Pick your event',
      route: 'EventPicker',
      done: f.hasEvent,
    },
    {
      id: 'result',
      title: 'Add a result',
      why: 'One mark is enough to place you against your age group. A few '
        + 'across a season is enough to show a direction.',
      cta: 'Add a result',
      route: 'Log',
      done: f.hasResult,
    },
    {
      id: 'checkin',
      title: 'Do a check-in',
      why: 'Sleep, energy and soreness in about ten seconds. It is what turns '
        + 'a bad session into something explainable rather than something you '
        + 'blame yourself for.',
      cta: 'Check in',
      route: 'Home',
      done: f.hasCheckin,
      optional: true,
    },
    {
      id: 'coach',
      title: 'Connect your coach',
      why: 'If your coach uses bnchmrkd they can send you sessions and see '
        + 'the results you approve. You choose what they see, and you can '
        + 'change your mind at any time.',
      cta: 'How this works',
      route: 'Profile',
      done: f.hasCoach,
      optional: true,
    },
  ]
}

export function coachSteps(f: CoachFacts): SetupStep[] {
  return [
    {
      id: 'athlete',
      title: 'Add your first athlete',
      why: 'Add someone with a phone by invite, or key in an athlete who has '
        + 'no account — the app works the same either way.',
      cta: 'Add an athlete',
      route: 'CoachRoster',
      done: f.athleteCount > 0,
    },
    {
      id: 'squad',
      title: 'Group them into a squad',
      // Honest about when it stops being worth it. A prompt to organise two
      // people into groups is the app inventing work.
      why: 'Once you coach more than a handful, squads are how you filter '
        + 'everything at once — the boards, the week, and who gets assigned '
        + 'what.',
      cta: 'Create a squad',
      route: 'Home',
      done: f.squadCount > 0,
      optional: true,
    },
    {
      id: 'assign',
      title: 'Assign something',
      why: 'A session, a race, or a testing day. Anyone with an account gets '
        + 'it as a request they accept, so nothing lands in their week '
        + 'without them knowing.',
      cta: 'Assign',
      route: 'Assign',
      done: f.hasAssigned,
    },
  ]
}

/** The first thing still to do, or null when setup is finished. */
export function nextStep(steps: SetupStep[]): SetupStep | null {
  return steps.find((s) => !s.done) || null
}

/** Everything required is done — optional steps do not hold the card open. */
export function isSetUp(steps: SetupStep[]): boolean {
  return steps.every((s) => s.done || s.optional)
}

export function progress(steps: SetupStep[]): { done: number; total: number } {
  return { done: steps.filter((s) => s.done).length, total: steps.length }
}

/**
 * Whether to show the getting-started card at all.
 *
 * Hidden once the required steps are done, and hidden if the person has
 * explicitly dismissed it — but NOT hidden merely because they have some
 * data. Someone who logged a result before setting an event still has the
 * important step outstanding, and that is exactly who needs the card.
 */
export function shouldShowSetup(steps: SetupStep[], dismissed: boolean): boolean {
  // Every step, not just the required ones. Gating on isSetUp here meant an
  // athlete who set an event and logged a result was "finished", so the
  // check-in and connect-your-coach steps could never be shown at all —
  // two steps that existed only in the code.
  if (steps.every((s) => s.done)) return false
  // The one step that cannot be dismissed away, because without it the app
  // cannot do the thing it exists to do.
  const eventMissing = steps.some((s) => s.id === 'event' && !s.done)
  const athleteMissing = steps.some((s) => s.id === 'athlete' && !s.done)
  if (eventMissing || athleteMissing) return true
  return !dismissed
}
