// ═══════════════════════════════════════════════════════════════════════
// THE TICK — the one thing an athlete does on this screen every day.
//
// It was a static circle that swapped fill colour. Marking a session done is
// the entire point of the Programs tab and it landed with no more feedback
// than a radio button: no weight, no confirmation, nothing that says the app
// noticed. Everything else here is reading; this is the doing.
//
// ── WHY RN ANIMATED AND NOT REANIMATED ───────────────────────────────
// Reanimated is installed, it has zero call sites, and it does work — the
// babel preset registers the worklets plugin automatically. It would be easy
// to reach for it here to make the number of call sites go up.
//
// It would not make this better. Reanimated earns its keep when animation is
// driven by a GESTURE and has to run on the UI thread while JS is busy — a
// drag, a swipe-to-complete, a scroll-linked header. This is a tap, and the
// response is scale and opacity, both of which the native driver already
// takes off the JS thread. Adding a library to a tap animation is the same
// mistake as adding a card to a block that did not need one.
//
// The pattern worth having is: overshoot on completion, settle back. An
// ease-out fade reads as a state change. A spring reads as something you
// DID — and paired with the haptic that already fires, it is the difference
// between a checkbox and a thing worth ticking.
// ═══════════════════════════════════════════════════════════════════════

import React, { useEffect, useRef } from 'react'
import { View, Animated, ActivityIndicator, Easing } from 'react-native'
import { Ionicons } from '@expo/vector-icons'
import { radius } from '../lib/theme'
import { useReducedMotion } from '../lib/motion'

export default function SessionTick({
  done, busy, accent, idle, muted, size = 28,
}: {
  done: boolean
  busy?: boolean
  /** The colour a completed tick fills with. */
  accent: string
  /** The ring colour before it is done. */
  idle: string
  muted: string
  size?: number
}) {
  const reduced = useReducedMotion()
  const fill = useRef(new Animated.Value(done ? 1 : 0)).current
  const pop = useRef(new Animated.Value(1)).current
  const first = useRef(true)

  useEffect(() => {
    // No pop on the first paint — a screen of already-completed sessions
    // should not detonate on arrival.
    const initial = first.current
    first.current = false
    if (reduced) { fill.setValue(done ? 1 : 0); return }

    Animated.timing(fill, {
      toValue: done ? 1 : 0,
      duration: 190,
      easing: Easing.out(Easing.cubic),
      useNativeDriver: true,
    }).start()

    if (initial || !done) return
    pop.setValue(1)
    Animated.sequence([
      Animated.spring(pop, { toValue: 1.22, useNativeDriver: true, speed: 40, bounciness: 0 }),
      Animated.spring(pop, { toValue: 1, useNativeDriver: true, speed: 12, bounciness: 14 }),
    ]).start()
  }, [done, reduced])

  return (
    <Animated.View
      style={{
        width: size, height: size, borderRadius: radius.full, borderWidth: 1.5,
        alignItems: 'center', justifyContent: 'center',
        borderColor: done ? accent : idle,
        transform: [{ scale: pop }],
      }}
    >
      {/* The fill grows from the middle rather than cross-fading, so the
          tick reads as filling up rather than as swapping colour. */}
      <Animated.View
        pointerEvents="none"
        style={{
          position: 'absolute', width: size, height: size,
          borderRadius: radius.full, backgroundColor: accent,
          opacity: fill,
          transform: [{ scale: fill.interpolate({ inputRange: [0, 1], outputRange: [0.3, 1] }) }],
        }}
      />
      {busy ? (
        <ActivityIndicator size="small" color={done ? '#fff' : muted} />
      ) : (
        <Animated.View style={{ opacity: fill }}>
          <Ionicons name="checkmark" size={Math.round(size * 0.57)} color="#fff" />
        </Animated.View>
      )}
    </Animated.View>
  )
}
