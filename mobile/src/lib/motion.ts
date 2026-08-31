// ═══════════════════════════════════════════════════════════════════════
// MOTION — shared timing tokens + reduced-motion awareness.
//
// One rhythm for the whole app: every animation uses these durations and
// easings so the product feels like one thing rather than a pile of screens.
// ═══════════════════════════════════════════════════════════════════════

import { useEffect, useState } from 'react'
import { AccessibilityInfo, Easing } from 'react-native'

export const DURATION = {
  /** Micro-interactions: press, toggle, chip select. */
  fast: 160,
  /** Standard entrance / state change. */
  base: 320,
  /** Deliberate reveals — the gauge sweep, ring fills. */
  slow: 620,
} as const

/** Per-item delay for staggered list/feed entrances. */
export const STAGGER_STEP = 45
/** Cap the stagger so the tenth card isn't still waiting half a second later. */
export const STAGGER_MAX_INDEX = 8

export const EASE = {
  /** Entering: decelerate into place. */
  out: Easing.out(Easing.cubic),
  /** Exiting: accelerate away. Exits run shorter than entrances. */
  in: Easing.in(Easing.cubic),
  /** Gauges and progress — a touch of overshoot reads as physical. */
  sweep: Easing.bezier(0.16, 1, 0.3, 1),
} as const

/**
 * True when the user has "Reduce Motion" on in iOS/Android accessibility
 * settings. Every animated component must honour this: show the final state
 * immediately rather than animating.
 */
export function useReducedMotion(): boolean {
  const [reduced, setReduced] = useState(false)
  useEffect(() => {
    let alive = true
    AccessibilityInfo.isReduceMotionEnabled()
      .then((v) => { if (alive) setReduced(!!v) })
      .catch(() => {})
    const sub = AccessibilityInfo.addEventListener('reduceMotionChanged', (v) => setReduced(!!v))
    return () => { alive = false; (sub as any)?.remove?.() }
  }, [])
  return reduced
}
