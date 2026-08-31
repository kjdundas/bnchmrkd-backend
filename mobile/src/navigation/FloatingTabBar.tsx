// ═══════════════════════════════════════════════════════════════════════
// FLOATING TAB BAR — Oura's arrangement, mirrored.
//
// Oura puts its three nav items in a translucent pill on the LEFT and the
// action button on its own at the RIGHT. This is the same construction the
// other way round: the (+) sits alone on the left, the pill of nav items on
// the right, both lifted off the bottom edge so the screen runs underneath
// them.
//
// Two reasons this is worth a custom bar rather than tabBarStyle tweaks:
//
//  1. A standard bar is a STRIP — it owns a band across the bottom of the
//     screen and everything above it stops there. The photograph on Home and
//     the dark ground everywhere else should run to the bottom of the glass,
//     which only happens if the bar floats over the content rather than
//     bounding it.
//  2. The action button is not a peer of the nav items. It doesn't navigate
//     between places, it starts a task — and putting it in the same row,
//     centred, has been quietly claiming it's the middle of five equals.
//     Separating it says what it is.
//
// Because the bar is absolutely positioned, screens no longer have space
// reserved for it. Every scrolling athlete screen must pad its content by
// TAB_BAR_CLEARANCE or the last card sits under the glass.
// ═══════════════════════════════════════════════════════════════════════

import React from 'react'
import { View, Text, Pressable, StyleSheet } from 'react-native'
import { BlurView } from 'expo-blur'
import { useSafeAreaInsets } from 'react-native-safe-area-context'
import { Ionicons } from '@expo/vector-icons'
import type { BottomTabBarProps } from '@react-navigation/bottom-tabs'
import { useTheme } from '../contexts/ThemeContext'
import { onImage } from '../lib/theme'
import { tapFeedback } from '../lib/haptics'

/** Bottom padding a scrolling screen needs so its last row clears the bar. */
export const TAB_BAR_CLEARANCE = 116

const FAB = 60
const PILL_H = 62

const ICONS: Record<string, [string, string]> = {
  Home: ['home', 'home-outline'],
  Programs: ['barbell', 'barbell-outline'],
  Trajectory: ['trending-up', 'trending-up-outline'],
  // Coach side
  Squad: ['people', 'people-outline'],
  Analyse: ['flash', 'flash-outline'],
  Leaderboards: ['podium', 'podium-outline'],
  CoachProfile: ['person', 'person-outline'],
}

export default function FloatingTabBar({
  state, descriptors, navigation, actionRoute = 'Log', actionIcon = 'add',
}: BottomTabBarProps & { actionRoute?: string; actionIcon?: string }) {
  const { colors } = useTheme()
  const insets = useSafeAreaInsets()

  // One route is pulled OUT of the row and rendered as the action button —
  // Log for an athlete, Assign for a coach. It is named rather than assumed,
  // because the two stacks have different routes and neither should have to
  // know about the other's. Indices are kept from the original list so focus
  // and navigation still refer to the real routes.
  //
  // If the named route isn't in this stack there simply is no button, and the
  // pill takes the full width. That is the correct state before the coach's
  // Assign screen exists, rather than a button that goes nowhere.
  const items = state.routes
    .map((route, index) => ({ route, index }))
    .filter(({ route }) => route.name !== actionRoute)
  const log = state.routes.findIndex((r) => r.name === actionRoute)
  const logFocused = state.index === log

  const go = (index: number, isFocused: boolean) => {
    const route = state.routes[index]
    tapFeedback()
    const event = navigation.emit({ type: 'tabPress', target: route.key, canPreventDefault: true })
    if (!isFocused && !event.defaultPrevented) navigation.navigate(route.name as never)
  }

  return (
    <View
      pointerEvents="box-none"
      style={[styles.wrap, { paddingBottom: Math.max(insets.bottom, 10) + 6 }]}
    >
      {/* ── Action button, alone ──────────────────────────────── */}
      {log >= 0 && (
        <Pressable
          onPress={() => go(log, logFocused)}
          accessibilityRole="button"
          accessibilityState={{ selected: logFocused }}
          accessibilityLabel="Log a result or test"
          style={({ pressed }) => [
            styles.fab,
            { shadowColor: colors.accent[500] },
            pressed && { transform: [{ scale: 0.94 }] },
          ]}
        >
          <BlurView intensity={55} tint="dark" style={StyleSheet.absoluteFill} />
          {/* Slightly translucent rather than solid: the accent still reads as
              the one coloured thing on the bar, but a little ground shows
              through so it belongs to the same glass as the pill beside it.
              Only a little — at D6 (84%) it washed out over a bright photo. */}
          <View pointerEvents="none" style={[StyleSheet.absoluteFill, {
            backgroundColor: colors.accent[500] + (logFocused ? 'FF' : 'F0'),
          }]} />
          <View pointerEvents="none" style={styles.fabEdge} />
          <Ionicons name={actionIcon as any} size={28} color="#FFFFFF" />
        </Pressable>
      )}

      {/* ── The three places you can go ───────────────────────── */}
      <View style={styles.pill}>
        <BlurView intensity={55} tint="dark" style={StyleSheet.absoluteFill} />
        {/* navGlass, not cardStrong. cardStrong is rgba(11,12,24,·) — the same
            colour as the ground on Programs and Trajectory, so over those
            screens it composited to 1.00:1 and the pill had nothing but a
            hairline. navGlass is lifted off the ground colour instead. */}
        <View pointerEvents="none" style={[StyleSheet.absoluteFill, {
          backgroundColor: onImage.navGlass,
        }]} />
        <View pointerEvents="none" style={styles.pillEdge} />
        <View pointerEvents="none" style={styles.specular} />

        {items.map(({ route, index }) => {
          const isFocused = state.index === index
          const label =
            (descriptors[route.key]?.options?.tabBarLabel as string) || route.name.toUpperCase()
          const [on, off] = ICONS[route.name] || ['ellipse', 'ellipse-outline']
          return (
            <Pressable
              key={route.key}
              onPress={() => go(index, isFocused)}
              accessibilityRole="button"
              accessibilityState={{ selected: isFocused }}
              accessibilityLabel={label}
              style={({ pressed }) => [styles.item, pressed && { opacity: 0.7 }]}
            >
              <Ionicons
                name={(isFocused ? on : off) as any}
                size={21}
                color={isFocused ? '#FFFFFF' : onImage.navDim}
              />
              <Text
                numberOfLines={1}
                style={[
                  styles.label,
                  { color: isFocused ? '#FFFFFF' : onImage.navDim },
                  isFocused && { fontWeight: '700' },
                ]}
              >
                {label}
              </Text>
            </Pressable>
          )
        })}
      </View>
    </View>
  )
}

const styles = StyleSheet.create({
  wrap: {
    position: 'absolute', left: 0, right: 0, bottom: 0,
    flexDirection: 'row', alignItems: 'center',
    paddingHorizontal: 16, gap: 12,
    // box-none on the wrapper, so taps between the FAB and the pill fall
    // through to whatever is scrolling underneath.
    backgroundColor: 'transparent',
  },
  fab: {
    width: FAB, height: FAB, borderRadius: FAB / 2,
    alignItems: 'center', justifyContent: 'center', overflow: 'hidden',
    shadowOffset: { width: 0, height: 8 },
    shadowOpacity: 0.45, shadowRadius: 18, elevation: 14,
  },
  fabEdge: {
    ...StyleSheet.absoluteFillObject,
    borderRadius: FAB / 2, borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.34)',
  },
  pill: {
    flex: 1, height: PILL_H, borderRadius: PILL_H / 2,
    flexDirection: 'row', alignItems: 'center', overflow: 'hidden',
    paddingHorizontal: 6,
    shadowColor: '#000', shadowOffset: { width: 0, height: 8 },
    shadowOpacity: 0.5, shadowRadius: 18, elevation: 14,
  },
  pillEdge: {
    ...StyleSheet.absoluteFillObject,
    borderRadius: PILL_H / 2, borderWidth: 1,
    // Over the flat dark ground this hairline is the only thing separating
    // the pill from the screen, so it carries more weight than a decorative
    // edge would: 2.43:1 against #0B0C18.
    borderColor: onImage.navEdge,
  },
  specular: {
    position: 'absolute', top: 0, left: 24, right: 24, height: 1,
    backgroundColor: onImage.navSpecular,
  },
  item: {
    flex: 1, alignItems: 'center', justifyContent: 'center',
    gap: 3, paddingVertical: 8, minHeight: 48,
  },
  label: { fontSize: 8.5, letterSpacing: 1, fontWeight: '600' },
})
