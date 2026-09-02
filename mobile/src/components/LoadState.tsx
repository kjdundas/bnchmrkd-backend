// ═══════════════════════════════════════════════════════════════════════
// WHAT A SCREEN SHOWS BEFORE IT HAS ANYTHING TO SHOW.
//
// Every coach screen but the roster rendered its empty state first and
// repainted when the fetch landed. So the first frame of opening Boards was
// "Nothing to rank yet" for a few hundred milliseconds — a false sentence,
// in the most memorable position there is.
//
// Three states, and the order they are checked in matters:
//
//   Skeleton   we are still asking
//   Failed     we asked and could not get an answer
//   Empty      we asked, got an answer, and the answer was nothing
//
// Empty is last because it is the only one of the three that makes a claim
// about the athletes rather than about the request. It has to be the state
// we are surest of, not the one we fall back to.
//
// The shimmer is deliberately slow and shallow — 0.30 to 0.55 over two
// seconds. A skeleton that pulses hard reads as an error state; one that
// barely moves reads as a surface waiting to be filled, which is what it is.
// ═══════════════════════════════════════════════════════════════════════

import React, { useEffect, useRef } from 'react'
import { View, Text, Animated, StyleSheet, Easing } from 'react-native'
import { Ionicons } from '@expo/vector-icons'
import { useTheme } from '../contexts/ThemeContext'
import { spacing, radius, onImage } from '../lib/theme'
import { useReducedMotion } from '../lib/motion'
import { LOAD_FAILED_TITLE, LOAD_FAILED_BODY } from '../lib/loadState'

/** One shimmering block. Every skeleton below is built from these. */
export function Bone({
  w, h = 12, r = 4, style,
}: {
  w?: number | string
  h?: number
  r?: number
  style?: any
}) {
  const reduced = useReducedMotion()
  const v = useRef(new Animated.Value(0)).current

  useEffect(() => {
    if (reduced) return
    const loop = Animated.loop(
      Animated.sequence([
        Animated.timing(v, { toValue: 1, duration: 1000, easing: Easing.inOut(Easing.quad), useNativeDriver: true }),
        Animated.timing(v, { toValue: 0, duration: 1000, easing: Easing.inOut(Easing.quad), useNativeDriver: true }),
      ]),
    )
    loop.start()
    // Without this an unmounted screen keeps a loop running behind the one
    // you navigated to, which is a real battery cost for an invisible view.
    return () => loop.stop()
  }, [reduced, v])

  const opacity = reduced ? 0.4 : v.interpolate({ inputRange: [0, 1], outputRange: [0.30, 0.55] })

  return (
    <Animated.View
      style={[{
        width: w as any, height: h, borderRadius: r,
        backgroundColor: 'rgba(255,255,255,0.09)', opacity,
      }, style]}
    />
  )
}

/** A stack of rows, for a list that is about to arrive. */
export function SkeletonRows({ rows = 4, height = 58 }: { rows?: number; height?: number }) {
  return (
    <View
      // A skeleton is scenery, not content. Announcing "loading" once on the
      // container beats VoiceOver reading out eight decorative rectangles.
      accessible
      accessibilityLabel="Loading"
      style={{ paddingHorizontal: spacing.lg, gap: 7 }}
    >
      {Array.from({ length: rows }).map((_, i) => (
        <View key={i} style={[s.row, { minHeight: height }]}>
          <Bone w={30} h={30} r={15} />
          <View style={{ flex: 1, gap: 6 }}>
            {/* Widths vary so the stack reads as names rather than as a grid. */}
            <Bone w={`${52 + ((i * 13) % 26)}%`} h={13} />
            <Bone w={`${28 + ((i * 7) % 18)}%`} h={9} />
          </View>
          <Bone w={46} h={14} />
        </View>
      ))}
    </View>
  )
}

/** A stack of cards, for a grid of athletes. */
export function SkeletonCards({ cards = 4 }: { cards?: number }) {
  return (
    <View accessible accessibilityLabel="Loading" style={s.cards}>
      {Array.from({ length: cards }).map((_, i) => (
        <View key={i} style={s.card}>
          <Bone w={34} h={34} r={17} />
          <Bone w="70%" h={13} style={{ marginTop: 10 }} />
          <Bone w="45%" h={9} style={{ marginTop: 7 }} />
          <Bone w="55%" h={20} r={6} style={{ marginTop: 14 }} />
        </View>
      ))}
    </View>
  )
}

/**
 * The state that says the request failed.
 *
 * The wording matters more than the layout: it has to make clear this is a
 * statement about the connection and NOT about the athletes, because the
 * whole bug was a coach reading a failed request as a fact about their
 * squad.
 */
export function LoadFailed({ onRetry }: { onRetry?: () => void }) {
  const { colors } = useTheme()
  return (
    <View style={s.state} accessible accessibilityLabel={`${LOAD_FAILED_TITLE}. ${LOAD_FAILED_BODY}`}>
      <Ionicons name="cloud-offline-outline" size={28} color={colors.amber} />
      <Text style={s.title}>{LOAD_FAILED_TITLE}</Text>
      <Text style={s.body}>{LOAD_FAILED_BODY}</Text>
    </View>
  )
}

/** The honest empty state — only reached once a load actually succeeded. */
export function NothingHere({
  icon = 'ellipse-outline', title, body,
}: {
  icon?: string
  title: string
  body?: string
}) {
  return (
    <View style={s.state}>
      <Ionicons name={icon as any} size={28} color={onImage.muted} />
      <Text style={s.title}>{title}</Text>
      {!!body && <Text style={s.body}>{body}</Text>}
    </View>
  )
}

const s = StyleSheet.create({
  row: {
    flexDirection: 'row', alignItems: 'center', gap: 12,
    paddingHorizontal: 14, borderRadius: radius.lg, borderWidth: 1,
    borderColor: onImage.cardBorder, backgroundColor: onImage.card,
  },
  cards: {
    flexDirection: 'row', flexWrap: 'wrap', gap: 10,
    paddingHorizontal: spacing.lg,
  },
  card: {
    width: '47.5%', minHeight: 150, padding: 13,
    borderRadius: radius.lg, borderWidth: 1,
    borderColor: onImage.cardBorder, backgroundColor: onImage.card,
  },
  state: { paddingHorizontal: spacing.lg, paddingTop: 30, alignItems: 'center' },
  title: { color: onImage.ink, fontSize: 17, fontWeight: '700', marginTop: 12 },
  body: {
    color: onImage.muted, fontSize: 14, lineHeight: 20, textAlign: 'center',
    marginTop: 6, maxWidth: 320,
  },
})
