// ═══════════════════════════════════════════════════════════════════════
// GET STARTED — one step, one button.
//
// The app had no first run. You signed up and landed on a finished
// dashboard with nothing in it: every panel showing its empty state at once,
// no prompt, and no indication which of them mattered.
//
// This shows the FIRST outstanding step and nothing else. A checklist of six
// is a wall; one card with one button is an instruction. The rest are a row
// of dots underneath, so nobody feels tricked about how much is left, but
// they are progress rather than choices.
//
// It explains WHY before it asks. "Choose your event" on its own reads as
// paperwork; "everything is measured per event, so without it the app can
// store your results but cannot tell you anything about them" is a reason a
// fifteen-year-old can act on.
//
// The card is not dismissible while the load-bearing step is outstanding —
// the athlete's event, or the coach's first athlete. Everything else can be
// waved away, because an app that nags about optional things teaches people
// to ignore it.
// ═══════════════════════════════════════════════════════════════════════

import React from 'react'
import { View, Text, StyleSheet } from 'react-native'
import { Ionicons } from '@expo/vector-icons'
import { useTheme } from '../contexts/ThemeContext'
import { Tappable, MonoKicker } from './ui'
import { spacing, radius, typeScale, weight } from '../lib/theme'
import { tapFeedback } from '../lib/haptics'
import {
  nextStep, progress, shouldShowSetup, type SetupStep, type StepId,
} from '../lib/firstRun'

export default function GetStartedCard({
  steps, dismissed, onDismiss, onAct, alreadyOffered = [],
}: {
  steps: SetupStep[]
  dismissed: boolean
  onDismiss: () => void
  /** Handed the step so the screen decides how to route or open a sheet. */
  onAct: (step: SetupStep) => void
  /** Steps this screen already offers a control for. The card stands down
      for those rather than putting a second button above the first — and
      disappears entirely when they are all that is left. */
  alreadyOffered?: StepId[]
}) {
  const { colors } = useTheme()
  if (!shouldShowSetup(steps, dismissed, alreadyOffered)) return null

  const step = nextStep(steps, alreadyOffered)
  if (!step) return null
  const { done, total } = progress(steps)
  // Whether this one can be waved away. The event and first-athlete steps
  // cannot: without them the app cannot do the thing it exists to do.
  const canSkip = !!step.optional

  return (
    <View style={[s.wrap, {
      borderColor: colors.accent[500] + '4D',
      backgroundColor: colors.accent[500] + '12',
    }]}>
      <View style={s.head}>
        <Ionicons name="sparkles" size={13} color={colors.accent[500]} />
        <MonoKicker color={colors.accent[500]}>Get started</MonoKicker>
        <View style={{ flex: 1 }} />
        <Text style={[s.count, { color: colors.text.muted }]}>{done} of {total}</Text>
      </View>

      <Text style={[s.title, { color: colors.text.primary }]}>{step.title}</Text>
      <Text style={[s.why, { color: colors.text.secondary }]}>{step.why}</Text>

      <View style={s.actions}>
        <Tappable
          onPress={() => { tapFeedback(); onAct(step) }}
          accessibilityLabel={step.cta}
          style={[s.cta, { backgroundColor: colors.accent[500] }]}
        >
          <Text style={s.ctaText}>{step.cta}</Text>
          <Ionicons name="arrow-forward" size={15} color="#FFFFFF" />
        </Tappable>

        {canSkip && (
          <Tappable
            onPress={() => { tapFeedback(); onDismiss() }}
            accessibilityLabel="Hide this for now"
            style={s.skip}
          >
            <Text style={[s.skipText, { color: colors.text.muted }]}>Not now</Text>
          </Tappable>
        )}
      </View>

      {/* Progress as dots rather than a bar: five steps is countable, and a
          bar at 20% reads as failure where two dots of five reads as a start. */}
      <View style={s.dots} accessibilityLabel={`Step ${done + 1} of ${total}`}>
        {steps.map((st) => (
          <View
            key={st.id}
            style={[s.dot, {
              backgroundColor: st.done ? colors.accent[500]
                : st.id === step.id ? colors.accent[500] + '80'
                : colors.glass.border,
              width: st.id === step.id ? 18 : 6,
            }]}
          />
        ))}
      </View>
    </View>
  )
}

const s = StyleSheet.create({
  wrap: {
    marginHorizontal: spacing.lg, marginBottom: spacing.md,
    borderRadius: radius.card, borderWidth: 1, padding: 16,
  },
  head: { flexDirection: 'row', alignItems: 'center', gap: 7 },
  count: { fontSize: typeScale.label, fontWeight: weight.bold, fontVariant: ['tabular-nums'] },
  title: { fontSize: typeScale.title, fontWeight: weight.bold, letterSpacing: -0.4, marginTop: 10 },
  why: { fontSize: typeScale.body, lineHeight: 20.5, marginTop: 6 },
  actions: { flexDirection: 'row', alignItems: 'center', gap: 6, marginTop: 15 },
  cta: {
    flexDirection: 'row', alignItems: 'center', gap: 7,
    minHeight: 44, paddingHorizontal: 18, borderRadius: radius.full,
  },
  ctaText: { color: '#FFFFFF', fontSize: typeScale.body, fontWeight: weight.bold },
  skip: { minHeight: 44, paddingHorizontal: 14, justifyContent: 'center' },
  skipText: { fontSize: typeScale.body, fontWeight: weight.medium },
  dots: { flexDirection: 'row', alignItems: 'center', gap: 5, marginTop: 15 },
  dot: { height: 6, borderRadius: radius.full },
})
