// ═══════════════════════════════════════════════════════════════════════
// APPROVALS — the two-way handshake between a coach and an athlete.
//
// One rule, applied in the database by a BEFORE INSERT trigger rather than
// by any client, because there are three writers (athlete app, coach app,
// assistant) and a client that forgot would silently bypass approval:
//
//   the coach wrote it            -> the ATHLETE answers
//   the athlete wrote it, linked  -> the COACH answers
//   the athlete wrote it, unlinked-> nobody; it is live immediately
//
// So an athlete with no coach never sees any of this, and never waits for an
// answer that cannot arrive.
//
// The inbox is a VIEW over the three approvable tables, not a notifications
// table. A notifications table has to be kept in step with the thing it
// describes and drifts out of it; this cannot — if a record is pending it is
// in the inbox, and if it isn't, it isn't.
// ═══════════════════════════════════════════════════════════════════════

import { selectFrom, callRpc } from './supabase'

export type ApprovalKind = 'program' | 'event' | 'performance' | 'metric'

export type PendingItem = {
  kind: ApprovalKind
  /** Text, not a uuid: athlete_metrics is keyed by a bigint and the four
   *  kinds share one column. It is opaque — it goes straight back to
   *  respond(), which casts it per kind. */
  id: string
  athlete_id: string
  created_by: string
  created_at: string
  title: string | null
  detail: string | null
  /** Set when the ATHLETE owes the answer; null when their coach does. */
  owed_by_athlete: string | null
}

/**
 * Everything awaiting `userId`'s answer.
 *
 * Row-level security already limits the view to records this account may
 * see — their own, plus their linked athletes' if they coach. The filter
 * here picks, out of those, the ones where THIS account is the party that
 * owes the answer rather than the one waiting for it.
 */
export async function fetchPendingFor(userId: string): Promise<PendingItem[]> {
  if (!userId) return []
  const rows = (await selectFrom('pending_approvals', {
    order: 'created_at.desc',
  })) as PendingItem[]
  return (rows || []).filter((r) =>
    r.owed_by_athlete ? r.owed_by_athlete === userId : r.athlete_id !== userId,
  )
}

/** How many answers this account owes. Drives the badge. */
export async function pendingCountFor(userId: string): Promise<number> {
  try {
    return (await fetchPendingFor(userId)).length
  } catch {
    return 0
  }
}

/**
 * Answer one item.
 *
 * Goes through a SECURITY DEFINER function rather than an UPDATE, because
 * row-level security gates rows and not columns: granting the athlete update
 * access so they could accept a program would also let them rewrite the
 * program the coach wrote, with the coach still recorded as its author. The
 * approval columns are pinned by a trigger against every other write path.
 */
export async function respond(
  kind: ApprovalKind,
  id: string,
  decision: 'accepted' | 'declined',
  note?: string,
): Promise<void> {
  await callRpc('respond_to_approval', {
    p_kind: kind,
    p_id: id,
    p_decision: decision,
    p_note: note?.trim() || null,
  })
}

/** What to call each kind in the inbox, from the answering side. */
export const KIND_LABEL: Record<ApprovalKind, string> = {
  program: 'Training block',
  event: 'Calendar',
  performance: 'Result',
  metric: 'Test',
}

export const KIND_ICON: Record<ApprovalKind, string> = {
  program: 'barbell-outline',
  event: 'calendar-outline',
  performance: 'stopwatch-outline',
  metric: 'fitness-outline',
}

/**
 * The sentence above the buttons. It has to say who sent it and what saying
 * yes actually does, because "Accept" on its own tells you nothing about
 * whether a session is about to appear in your week.
 */
export function consequenceOf(kind: ApprovalKind, owedByAthlete: boolean): string {
  if (owedByAthlete) {
    if (kind === 'program') return 'Accepting adds these sessions to your schedule.'
    if (kind === 'event') return 'Accepting puts this in your calendar.'
    if (kind === 'metric') return 'Accepting adds this test to your numbers.'
    return 'Accepting adds this to your results.'
  }
  if (kind === 'performance') return 'Approving lets this count towards their bests and the leaderboards.'
  if (kind === 'metric') return 'Approving lets this test count towards their trends and the physical boards.'
  if (kind === 'event') return 'Approving puts this in their calendar.'
  return 'Approving starts this block for them.'
}
