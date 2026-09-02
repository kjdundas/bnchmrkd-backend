// ═══════════════════════════════════════════════════════════════════════
// (i) — the smallest possible way to ask "what does that mean?"
//
// Rules this follows, because a help affordance done badly is worse than
// none at all:
//
//   It never carries information on its own. Everything the dot explains is
//   optional detail; nothing that must be understood is hidden behind it.
//
//   It has a 44pt touch target inside an 15pt dot. A help control that is
//   hard to hit is a joke played on the people who most need it.
//
//   It says the term, not "info". VoiceOver reads "What does Percentile
//   mean?", so the label is useful without sight of the layout.
//
//   One dot per idea, near the number it belongs to — not a row of them.
//   If a screen needs five, the screen is the problem.
// ═══════════════════════════════════════════════════════════════════════

import React, { useState } from 'react'
import { View, Text, Modal, Pressable, StyleSheet, ScrollView } from 'react-native'
import { Ionicons } from '@expo/vector-icons'
import { useTheme } from '../contexts/ThemeContext'
import { Tappable } from './ui'
import { spacing, radius, onImage, typeScale, weight } from '../lib/theme'
import { tapFeedback } from '../lib/haptics'
import { GLOSSARY, type GlossaryKey } from '../lib/glossary'

export default function InfoDot({
  term, size = 15, color, style,
}: {
  term: GlossaryKey
  size?: number
  color?: string
  style?: any
}) {
  const { colors } = useTheme()
  const [open, setOpen] = useState(false)
  const entry = GLOSSARY[term]
  // A dot pointing at a term nobody wrote is worse than no dot: it promises
  // an explanation and then opens an empty sheet.
  if (!entry) return null

  return (
    <>
      <Tappable
        onPress={() => { tapFeedback(); setOpen(true) }}
        accessibilityLabel={`What does ${entry.title} mean?`}
        // The dot is small; the target is not.
        hitSlop={14}
        style={[{ width: size, height: size, alignItems: 'center', justifyContent: 'center' }, style]}
      >
        <Ionicons
          name="information-circle-outline"
          size={size}
          color={color || onImage.dim}
        />
      </Tappable>

      <Modal visible={open} transparent animationType="fade" onRequestClose={() => setOpen(false)}>
        {/* Tapping anywhere off the card closes it — the gesture people try
            first, before they look for a button. */}
        <Pressable style={s.backdrop} onPress={() => setOpen(false)}>
          <Pressable
            style={[s.card, { backgroundColor: colors.bg.card, borderColor: colors.glass.border }]}
            // Swallows the tap so pressing the card itself does not dismiss it.
            onPress={() => {}}
          >
            <View style={s.head}>
              <Ionicons name="information-circle" size={17} color={colors.accent[500]} />
              <Text style={[s.title, { color: colors.text.primary }]}>{entry.title}</Text>
            </View>

            <ScrollView style={{ maxHeight: 320 }} showsVerticalScrollIndicator={false}>
              <Text style={[s.body, { color: colors.text.secondary }]}>{entry.body}</Text>
              {!!entry.note && (
                <View style={[s.note, { borderColor: colors.glass.border, backgroundColor: colors.glass.bg }]}>
                  <Text style={[s.noteText, { color: colors.text.muted }]}>{entry.note}</Text>
                </View>
              )}
            </ScrollView>

            <Tappable
              onPress={() => { tapFeedback(); setOpen(false) }}
              accessibilityLabel="Close"
              style={[s.close, { backgroundColor: colors.accent[500] }]}
            >
              <Text style={s.closeText}>Got it</Text>
            </Tappable>
          </Pressable>
        </Pressable>
      </Modal>
    </>
  )
}

const s = StyleSheet.create({
  backdrop: {
    flex: 1, backgroundColor: 'rgba(6,7,14,0.72)',
    alignItems: 'center', justifyContent: 'center', padding: spacing.lg,
  },
  card: {
    width: '100%', maxWidth: 400, borderRadius: radius.card,
    borderWidth: 1, padding: 20,
  },
  head: { flexDirection: 'row', alignItems: 'center', gap: 8, marginBottom: 12 },
  title: { fontSize: typeScale.title, fontWeight: weight.bold, letterSpacing: -0.3 },
  body: { fontSize: typeScale.body, lineHeight: 22 },
  note: {
    marginTop: 14, padding: 12, borderRadius: radius.control ?? 10, borderWidth: 1,
  },
  noteText: { fontSize: typeScale.caption, lineHeight: 20 },
  close: {
    marginTop: 18, minHeight: 44, borderRadius: radius.full,
    alignItems: 'center', justifyContent: 'center',
  },
  closeText: { color: '#FFFFFF', fontSize: typeScale.body, fontWeight: weight.bold },
})
