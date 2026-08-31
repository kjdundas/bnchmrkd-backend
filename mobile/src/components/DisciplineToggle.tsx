// ═══════════════════════════════════════════════════════════════════════
// DISCIPLINE TOGGLE — the athlete's event switcher.
//
// ── Why this is expo-blur and not Liquid Glass ──────────────────────
// It was expo-glass-effect twice, and failed twice in opposite directions:
//
//   colorScheme 'auto'  → followed the SYSTEM appearance (dark), giving dark
//                         glass over a dark, scrimmed photo. The chip was
//                         invisible: no edge, no fill, no shape.
//   colorScheme 'light' → a bright, near-opaque white lozenge. The white
//                         label went white-on-white, and an unselected chip
//                         ended up LOUDER than the solid indigo selected one,
//                         which inverts the hierarchy the control exists for.
//
// The cause is the same both times: Liquid Glass works by refracting and
// re-lighting what is behind it, and behind this control is a near-uniform
// region of sky under a heavy scrim. There is nothing there to refract, so
// the material has no way to describe its own edge, and every attempt to
// force one produces either nothing or a blob.
//
// So this uses the same expo-blur material as every other on-image panel in
// the app: blur, veil, hairline edge, specular top. It renders identically on
// every device and iOS version, and the toggle now matches the check-in pill
// and the cards rather than being a third material.
//
// expo-glass-effect stays installed. Liquid Glass earns its keep over content
// with real structure and movement underneath it — a floating control over a
// scrolling list, or the tab bar — not over a flat scrimmed sky.
// ═══════════════════════════════════════════════════════════════════════

import React from 'react'
import { View, Text, ScrollView, StyleSheet } from 'react-native'
import { BlurView } from 'expo-blur'
import { useTheme } from '../contexts/ThemeContext'
import { spacing, rhythm } from '../lib/theme'
import { Tappable } from './ui'

interface Props {
  disciplines: string[]
  active: string | null
  onSelect: (d: string) => void
  /** True when the toggle sits over the hero photo rather than on paper. */
  onHero?: boolean
}

export default function DisciplineToggle({ disciplines, active, onSelect, onHero }: Props) {
  const { colors } = useTheme()
  if (disciplines.length < 2) return null

  return (
    <ScrollView
      horizontal
      showsHorizontalScrollIndicator={false}
      contentContainerStyle={{
        gap: 8, paddingHorizontal: spacing.lg,
        flexGrow: 1, justifyContent: 'center',
      }}
      style={{
        marginHorizontal: -spacing.lg,
        marginTop: onHero ? spacing.md : spacing.lg,
        marginBottom: onHero ? 0 : rhythm.section,
      }}
    >
      {disciplines.map((d) => {
        const on = (active || '').toLowerCase() === d.toLowerCase()

        const label = (
          <Text style={{
            fontSize: 14, fontWeight: '700', letterSpacing: 0.3,
            color: on
              ? '#FFFFFF'
              : onHero ? 'rgba(255,255,255,0.82)' : colors.text.secondary,
          }}>
            {d}
          </Text>
        )

        const shell = {
          paddingHorizontal: 20, minHeight: 44, justifyContent: 'center' as const,
          alignItems: 'center' as const, borderRadius: 999, overflow: 'hidden' as const,
        }

        // Selected chip stays solid indigo in both paths — a glass "selected"
        // state is too subtle to read as the current choice.
        if (on) {
          return (
            <Tappable
              key={d}
              onPress={() => onSelect(d)}
              accessibilityLabel={`${d}, currently selected`}
              style={{ ...shell, backgroundColor: colors.accent[500] }}
            >
              {label}
            </Tappable>
          )
        }

        // ── Over the photograph ──────────────────────────────────
        // Deliberately QUIETER than the selected chip. An unselected option
        // that competes with the current one for attention stops the control
        // answering the only question it is there to answer: which am I
        // looking at right now?
        if (onHero) {
          return (
            <Tappable
              key={d}
              onPress={() => onSelect(d)}
              accessibilityLabel={`Show ${d} results`}
              style={shell}
            >
              <BlurView intensity={22} tint="dark" style={StyleSheet.absoluteFill} />
              <View pointerEvents="none" style={[StyleSheet.absoluteFill, {
                backgroundColor: 'rgba(255,255,255,0.11)',
              }]} />

              {/* Edge, drawn above the material — a border on the shell gets
                  covered by the absolutely-filled blur layer. Without it the
                  chip has no shape at all on a smooth dark background. */}
              <View pointerEvents="none" style={[StyleSheet.absoluteFill, {
                borderRadius: 999, borderWidth: 1,
                borderColor: 'rgba(255,255,255,0.28)',
              }]} />
              <View pointerEvents="none" style={{
                position: 'absolute', top: 0, left: 14, right: 14, height: 1,
                backgroundColor: 'rgba(255,255,255,0.38)',
              }} />

              {label}
            </Tappable>
          )
        }

        // On paper: a considered solid chip, not a degraded glass one.
        return (
          <Tappable
            key={d}
            onPress={() => onSelect(d)}
            accessibilityLabel={`Show ${d} results`}
            style={{
              ...shell,
              backgroundColor: colors.glass.bg,
              borderWidth: 1,
              borderColor: colors.glass.border,
            }}
          >
            {label}
          </Tappable>
        )
      })}
    </ScrollView>
  )
}
