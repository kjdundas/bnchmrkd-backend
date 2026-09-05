// ═══════════════════════════════════════════════════════════════════════
// DID IT FAIL, OR IS IT EMPTY?
//
// The data layer catches its own errors and returns an empty Map. Every one
// of those catches was a deliberate call, and the comments say so — "an
// empty leaderboard beats a crashed one". That reasoning is right about
// crashing and wrong about silence.
//
// On a train with two bars a coach opens Boards and reads "Nobody in this
// squad has an approved result yet". Everything is fine; the request timed
// out. The app has just told them something false about their athletes, in
// a confident sentence, with no way to tell.
//
// So the catch stays — a screen should not white-screen because one query
// timed out — and the FACT of the failure comes out alongside the data. The
// caller then has three states to render instead of two:
//
//   loading   ...still going
//   failed    we asked and could not get an answer
//   empty     we asked, we got an answer, and the answer was nothing
//
// A Trouble is passed down rather than returned, so adding it to a fetch
// does not change that fetch's return type and does not ripple through
// every call site and harness. Screens make one per load and read it after.
// ═══════════════════════════════════════════════════════════════════════

export type Trouble = {
  /** True once anything handed this object has failed. */
  readonly failed: boolean
  /** Which fetches failed, in order, for a message or a log. */
  readonly where: readonly string[]
  /** Called from inside a catch. Never throws, whatever it is handed. */
  note(where: string, err?: unknown): void
}

export function newTrouble(): Trouble {
  const where: string[] = []
  return {
    get failed() { return where.length > 0 },
    get where() { return where },
    note(w: string, err?: unknown) {
      where.push(w)
      // Silent to the user, never silent to the developer. The whole bug
      // this exists to fix was a failure nobody could see.
      if (__DEV__) console.warn(`[load] ${w} failed`, err)
    },
  }
}

/**
 * What a screen shows where its content would be.
 *
 * `empty` is deliberately the LAST thing considered. It is the only one of
 * the three that makes a claim about the athletes rather than about the
 * request, so it has to be the state we are surest of.
 */
export type LoadPhase = 'loading' | 'failed' | 'empty' | 'ready'

export function loadPhase(opts: {
  loading: boolean
  failed: boolean
  isEmpty: boolean
}): LoadPhase {
  if (opts.loading) return 'loading'
  if (opts.failed) return 'failed'
  if (opts.isEmpty) return 'empty'
  return 'ready'
}

/** One wording for a failed load, so every screen says it the same way. */
export const LOAD_FAILED_TITLE = "Couldn't load this"
export const LOAD_FAILED_BODY =
  'Something went wrong reaching your data — this is not a report about your '
  + 'athletes. Pull down to try again.'
