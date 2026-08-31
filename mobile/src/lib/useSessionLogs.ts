// ═══════════════════════════════════════════════════════════════════════
// SESSION COMPLETION — one source of truth for "did I do that session?"
//
// This used to live inside ProgramCard, which was fine while the program list
// was the only place a session could be ticked. The schedule ticks the same
// sessions from a different surface, and two components each holding their
// own Set of completed indices is how you end up with a session that is done
// in the week view and undone in the program below it.
//
// So completion is fetched once per week, for every program at once, and the
// toggle is optimistic with a rollback — the tick has to land within about
// 100ms of the finger, long before the round-trip returns.
// ═══════════════════════════════════════════════════════════════════════

import { useState, useEffect, useCallback, useRef } from 'react'
import { selectFrom, insertInto, deleteFrom } from './supabase'
import { successFeedback, errorFeedback, tapFeedback } from './haptics'

export interface SessionLog {
  program_id: string
  session_index: number
  week_start: string
  completed_at?: string | null
}

const key = (programId: string, index: number) => `${programId}:${index}`

export function useSessionLogs(athleteId: string | null | undefined, weekStart: string) {
  const [logs, setLogs] = useState<SessionLog[]>([])
  const [loading, setLoading] = useState(true)
  const [busy, setBusy] = useState<string | null>(null)
  // Guards against a slow response for LAST week landing after the athlete has
  // already paged to this one and overwriting it.
  const wantRef = useRef(weekStart)

  useEffect(() => {
    wantRef.current = weekStart
    if (!athleteId) { setLogs([]); setLoading(false); return }
    let cancelled = false
    setLoading(true)
    selectFrom('program_session_logs', {
      filter: `athlete_id=eq.${athleteId}&week_start=eq.${weekStart}`,
      limit: '200',
    })
      .then((rows: any[]) => {
        if (cancelled || wantRef.current !== weekStart) return
        setLogs(Array.isArray(rows) ? rows : [])
      })
      .catch(() => { if (!cancelled) setLogs([]) })
      .finally(() => { if (!cancelled) setLoading(false) })
    return () => { cancelled = true }
  }, [athleteId, weekStart])

  const isDone = useCallback(
    (programId: string, index: number) =>
      logs.some((l) => l.program_id === programId && l.session_index === index),
    [logs],
  )

  const toggle = useCallback(async (programId: string, index: number) => {
    if (!athleteId || busy) return
    const k = key(programId, index)
    setBusy(k)
    const had = logs.some((l) => l.program_id === programId && l.session_index === index)

    // Fire the feedback before the write, not after: completing a session
    // earns the success pattern, undoing one is just a tap.
    had ? tapFeedback() : successFeedback()
    const optimistic: SessionLog = {
      program_id: programId, session_index: index, week_start: weekStart,
      completed_at: new Date().toISOString(),
    }
    setLogs((prev) => had
      ? prev.filter((l) => !(l.program_id === programId && l.session_index === index))
      : [...prev, optimistic])

    try {
      if (had) {
        await deleteFrom('program_session_logs',
          `program_id=eq.${programId}&session_index=eq.${index}&week_start=eq.${weekStart}`)
      } else {
        await insertInto('program_session_logs', {
          program_id: programId, athlete_id: athleteId,
          session_index: index, week_start: weekStart,
        })
      }
    } catch {
      // The optimistic tick is being reverted — tell the finger, not just the eye.
      errorFeedback()
      setLogs((prev) => had
        ? [...prev, optimistic]
        : prev.filter((l) => !(l.program_id === programId && l.session_index === index)))
    } finally {
      setBusy(null)
    }
  }, [athleteId, weekStart, logs, busy])

  return { logs, loading, isDone, toggle, busy }
}
