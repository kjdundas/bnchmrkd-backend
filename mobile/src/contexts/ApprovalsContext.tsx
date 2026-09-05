// ═══════════════════════════════════════════════════════════════════════
// HOW MANY ANSWERS DO I OWE?
//
// One number, in one place, because two things need it and they sit on
// opposite sides of the navigator: the banner at the top of Home, and the
// dot on the tab bar.
//
// Before this, the count lived in Home's own state. So an athlete waiting
// on an answer was invisible from Week, Boards and Analyse — three tabs out
// of four — and the whole point of the two-way flow is that the athlete is
// standing still until somebody answers. A coach who is not on Home has no
// way to know they are the hold-up.
//
// It also removes a duplicate fetch. Home used to ask for this itself; now
// both consumers read the same value and one refresh updates both.
// ═══════════════════════════════════════════════════════════════════════

import React, {
  createContext, useContext, useState, useEffect, useCallback, useMemo, useRef,
} from 'react'
import { AppState } from 'react-native'
import { useAuth } from './AuthContext'
import { pendingCountFor } from '../lib/approvals'

type ApprovalsValue = {
  /** Answers this account owes. 0 while unknown — never a guess upward. */
  count: number
  /** Re-read it. Called after answering something, and on returning to the app. */
  refresh: () => Promise<void>
}

const Ctx = createContext<ApprovalsValue>({ count: 0, refresh: async () => {} })

export function ApprovalsProvider({ children }: { children: React.ReactNode }) {
  const { user } = useAuth()
  const [count, setCount] = useState(0)
  // Guards a set() after the provider has gone, which React warns about and
  // which happens routinely on sign-out mid-request.
  const alive = useRef(true)
  useEffect(() => () => { alive.current = false }, [])

  const refresh = useCallback(async () => {
    if (!user?.id) { setCount(0); return }
    const n = await pendingCountFor(user.id)
    if (alive.current) setCount(n)
  }, [user?.id])

  useEffect(() => { refresh() }, [refresh])

  // Coming back from the background is the moment a stale badge is most
  // likely and most noticeable — an athlete may have logged something while
  // the phone was in a pocket.
  useEffect(() => {
    const sub = AppState.addEventListener('change', (s) => {
      if (s === 'active') refresh()
    })
    return () => sub.remove()
  }, [refresh])

  const value = useMemo(() => ({ count, refresh }), [count, refresh])
  return <Ctx.Provider value={value}>{children}</Ctx.Provider>
}

export const useApprovals = () => useContext(Ctx)
