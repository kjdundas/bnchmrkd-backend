// ═══════════════════════════════════════════════════════════════════════
// FILTER ROW — toggles, not tabs.
//
// A tab picks one thing. These pick any number, and picking NONE means all
// of them — so a coach can leave the row alone and see everybody, or narrow
// it by tapping. A filter you have to fully populate before anything appears
// is a form, not a filter.
//
// Only options the squad actually contains are offered. A chip that matches
// nobody is a promise the data can't keep.
// ═══════════════════════════════════════════════════════════════════════

import React from 'react'
import { View, Text, ScrollView, StyleSheet } from 'react-native'
import { Ionicons } from '@expo/vector-icons'
import { useTheme } from '../contexts/ThemeContext'
import { Tappable, MonoKicker } from './ui'
import { spacing, radius, onImage } from '../lib/theme'
import { tapFeedback } from '../lib/haptics'

export default function FilterRow({
  label, options, selected, onToggle, onClear,
}: {
  label: string
  options: string[]
  selected: Set<string>
  onToggle: (v: string) => void
  onClear: () => void
}) {
  const { colors } = useTheme()
  if (options.length < 2) return null   // one option filters nothing

  return (
    <View style={s.wrap}>
      <View style={s.head}>
        <MonoKicker color={onImage.dim}>{label}</MonoKicker>
        {selected.size > 0 && (
          <Tappable onPress={() => { tapFeedback(); onClear() }}
            accessibilityLabel={`Clear ${label} filter`} style={s.clear}>
            <Ionicons name="close" size={11} color={colors.accent[500]} />
            <Text style={[s.clearText, { color: colors.accent[500] }]}>All</Text>
          </Tappable>
        )}
      </View>
      <ScrollView horizontal showsHorizontalScrollIndicator={false}
        contentContainerStyle={s.row} keyboardShouldPersistTaps="handled">
        {options.map((o) => {
          const on = selected.has(o)
          return (
            <Tappable key={o} onPress={() => { tapFeedback(); onToggle(o) }}
              accessibilityLabel={o} accessibilityState={{ selected: on }}
              style={[s.chip, {
                borderColor: on ? colors.accent[500] + '8C' : onImage.chipEdge,
                backgroundColor: on ? colors.accent[500] + '2E' : onImage.chipPlate,
              }]}>
              <Text style={[s.chipText, { color: on ? '#FFFFFF' : onImage.muted }]}>{o}</Text>
            </Tappable>
          )
        })}
      </ScrollView>
    </View>
  )
}

const s = StyleSheet.create({
  wrap: { marginTop: 14 },
  head: {
    flexDirection: 'row', alignItems: 'center', gap: 10,
    paddingHorizontal: spacing.lg, marginBottom: 7,
  },
  clear: { flexDirection: 'row', alignItems: 'center', gap: 3 },
  clearText: { fontSize: 11, fontWeight: '700' },
  row: { paddingHorizontal: spacing.lg, gap: 7 },
  chip: {
    minHeight: 32, paddingHorizontal: 11, borderRadius: radius.full, borderWidth: 1,
    alignItems: 'center', justifyContent: 'center',
  },
  chipText: { fontSize: 12.5, fontWeight: '700' },
})
