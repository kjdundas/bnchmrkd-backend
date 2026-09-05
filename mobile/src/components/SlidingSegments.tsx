// ═══════════════════════════════════════════════════════════════════════
// A SEGMENTED CONTROL THAT MOVES.
//
// The Week / Month toggle swapped a background colour between two buttons.
// Nothing travelled, so nothing told the eye where the selection went — you
// register the new state, not the change, and on a screen where the same tap
// also swaps the whole panel below it that is a moment of "wait, what just
// happened".
//
// A single indicator that SLIDES between the segments is the oldest fix in
// interface design and still the right one: the eye follows the movement to
// the new position, so the transition explains itself and the panel change
// underneath reads as a consequence rather than a surprise.
//
// RN Animated on the native driver, deliberately. A spring on translateX is
// exactly what the native driver is for, and Reanimated buys nothing here
// that the platform is not already doing off the JS thread.
// ═══════════════════════════════════════════════════════════════════════

import React, { useEffect, useRef, useState } from 'react'
import { View, Text, Animated, LayoutChangeEvent } from 'react-native'
import { Tappable } from './ui'
import { radius, typeScale, weight } from '../lib/theme'
import { useReducedMotion } from '../lib/motion'
import { tapFeedback } from '../lib/haptics'

export default function SlidingSegments<T extends string>({
  options, value, onChange, accent, ink, muted, track, border,
}: {
  options: { key: T; label: string }[]
  value: T
  onChange: (v: T) => void
  accent: string
  ink: string
  muted: string
  /** The trough the indicator slides in. */
  track: string
  border: string
}) {
  const reduced = useReducedMotion()
  const [w, setW] = useState(0)
  const x = useRef(new Animated.Value(0)).current
  const i = Math.max(0, options.findIndex((o) => o.key === value))
  const seg = w ? w / options.length : 0

  useEffect(() => {
    if (!seg) return
    if (reduced) { x.setValue(i * seg); return }
    Animated.spring(x, {
      toValue: i * seg,
      useNativeDriver: true,
      speed: 18,
      bounciness: 6,
    }).start()
  }, [i, seg, reduced])

  const onLayout = (e: LayoutChangeEvent) => {
    const nw = e.nativeEvent.layout.width
    if (nw && Math.abs(nw - w) > 0.5) {
      setW(nw)
      x.setValue((nw / options.length) * i)   // no slide on first measure
    }
  }

  return (
    <View
      onLayout={onLayout}
      style={{
        flexDirection: 'row', borderRadius: radius.control, padding: 3,
        backgroundColor: track, borderWidth: 1, borderColor: border,
      }}
    >
      {!!seg && (
        <Animated.View
          pointerEvents="none"
          style={{
            position: 'absolute', top: 3, bottom: 3, left: 3,
            width: seg - 6, borderRadius: radius.control - 2,
            backgroundColor: accent + '33', borderWidth: 1, borderColor: accent + '80',
            transform: [{ translateX: x }],
          }}
        />
      )}
      {options.map((o) => {
        const on = o.key === value
        return (
          <Tappable
            key={o.key}
            hitSlop={0}
            onPress={() => { if (!on) { tapFeedback(); onChange(o.key) } }}
            accessibilityRole="button"
            accessibilityState={{ selected: on }}
            accessibilityLabel={o.label}
            style={{ flex: 1, minHeight: 34, alignItems: 'center', justifyContent: 'center' }}
          >
            <Text style={{
              fontSize: typeScale.caption,
              fontWeight: on ? weight.bold : weight.medium,
              color: on ? ink : muted,
            }}>
              {o.label}
            </Text>
          </Tappable>
        )
      })}
    </View>
  )
}
