// ═══════════════════════════════════════════════════════════════════════
// WHY THIS MATTERS — the note under a metric's trend chart.
//
// Three parts, in this order: what the test measures, what it is worth for
// the athlete's own event, and the evidence where there is any.
//
// The reference is rendered as a real, tappable citation with the finding's
// actual numbers rather than a vague "studies show". An athlete — or the
// coach reading over their shoulder — can go and check it, which is the only
// thing that makes citing anything worth doing.
// ═══════════════════════════════════════════════════════════════════════

import React from 'react'
import { View, Text, StyleSheet, Linking } from 'react-native'
import { Ionicons } from '@expo/vector-icons'
import { onImageColors as colors, spacing, radius, rhythm } from '../lib/theme'
import { Tappable, MonoKicker } from './ui'
import { metricNote } from '../lib/metricScience'

export default function MetricScienceBlock({
  metricKey, discipline,
}: { metricKey: string; discipline?: string | null }) {
  const note = metricNote(metricKey, discipline)

  return (
    <View style={{ paddingHorizontal: spacing.lg, marginTop: rhythm.section }}>
      <MonoKicker color={colors.text.muted}>What it measures</MonoKicker>
      <Text style={s.body}>{note.mechanism}</Text>

      <View style={s.relHead}>
        <MonoKicker color={colors.text.muted}>
          {discipline ? `Why it matters for ${discipline}` : 'Why it matters'}
        </MonoKicker>
        {/* Where this quality sits among the event's own priorities. Ranked
            rather than asserted — an app that calls everything important is
            not telling the athlete anything. */}
        {note.rank != null && !!note.axisLabel && (
          <View style={[s.rank, {
            backgroundColor: (note.rank <= 2 ? colors.accent[500] : colors.text.muted) + '2E',
          }]}>
            <Text style={[s.rankText, {
              color: note.rank <= 2 ? colors.accent[500] : colors.text.secondary,
            }]}>
              {note.axisLabel} · {note.rank} of {note.rankOf}
            </Text>
          </View>
        )}
      </View>
      <Text style={s.body}>{note.relevance}</Text>

      {!!note.reference && (
        <View style={s.ref}>
          <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6, marginBottom: 6 }}>
            <Ionicons name="school-outline" size={13} color={colors.text.muted} />
            <Text style={s.refKicker}>Evidence</Text>
          </View>
          <Text style={s.refClaim}>{note.reference.claim}</Text>
          <Tappable
            onPress={() => Linking.openURL(note.reference!.url).catch(() => {})}
            accessibilityLabel={`Open the source: ${note.reference.cite}`}
            style={{ flexDirection: 'row', alignItems: 'center', gap: 5, marginTop: 8 }}
          >
            <Text style={s.refCite}>{note.reference.cite}</Text>
            <Ionicons name="open-outline" size={12} color={colors.accent[500]} />
          </Tappable>
        </View>
      )}
    </View>
  )
}

const s = StyleSheet.create({
  body: {
    fontSize: 13.5, lineHeight: 20, color: colors.text.secondary, marginTop: 8,
  },
  relHead: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between',
    gap: 8, marginTop: rhythm.section,
  },
  rank: { paddingHorizontal: 7, paddingVertical: 3, borderRadius: 5 },
  rankText: { fontSize: 9.5, fontWeight: '800', letterSpacing: 0.4 },
  ref: {
    marginTop: rhythm.section, padding: 14, borderRadius: radius.md,
    borderWidth: 1, borderColor: 'rgba(255,255,255,0.14)',
    backgroundColor: 'rgba(255,255,255,0.05)',
  },
  refKicker: {
    fontSize: 9, letterSpacing: 1.6, textTransform: 'uppercase',
    color: colors.text.muted, fontWeight: '700',
  },
  refClaim: { fontSize: 12.5, lineHeight: 18.5, color: colors.text.secondary },
  refCite: { fontSize: 11.5, fontWeight: '700', color: colors.accent[500], flexShrink: 1 },
})
