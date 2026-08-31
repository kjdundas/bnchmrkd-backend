// ═══════════════════════════════════════════════════════════════════════
// SQUAD SWITCHER — the first thing a coach touches.
//
// A row of chips: All, then each squad, then anyone not yet filed. The (+)
// sits at the end rather than the start, so adding a squad never moves the
// squad you were about to tap.
//
// "Unassigned" only appears when somebody is. It is not a squad — it is the
// absence of a membership row — so it has no count badge to maintain and
// disappears on its own once everyone is filed.
// ═══════════════════════════════════════════════════════════════════════

import React from 'react'
import { View, Text, ScrollView, StyleSheet } from 'react-native'
import { Ionicons } from '@expo/vector-icons'
import { useTheme } from '../contexts/ThemeContext'
import { Tappable } from './ui'
import { spacing, radius, onImage } from '../lib/theme'
import { tapFeedback } from '../lib/haptics'
import type { Squad } from '../lib/squads'

/** null = All. 'unassigned' = the ones with no squad. */
export type SquadFilter = string | null | 'unassigned'

export default function SquadSwitcher({
  squads, counts, unassigned, total, value, onChange, onAdd, onEdit,
}: {
  squads: Squad[]
  counts: Map<string, number>
  unassigned: number
  total: number
  value: SquadFilter
  onChange: (v: SquadFilter) => void
  onAdd: () => void
  /** Long-press a squad to rename or remove it. */
  onEdit?: (s: Squad) => void
}) {
  const { colors } = useTheme()

  const chip = (
    key: string,
    label: string,
    count: number,
    active: boolean,
    onPress: () => void,
    onLongPress?: () => void,
  ) => (
    <Tappable
      key={key}
      onPress={() => { tapFeedback(); onPress() }}
      onLongPress={onLongPress}
      accessibilityLabel={`${label}, ${count} ${count === 1 ? 'athlete' : 'athletes'}`}
      accessibilityState={{ selected: active }}
      style={[s.chip, {
        borderColor: active ? colors.accent[500] + '8C' : onImage.cardBorder,
        backgroundColor: active ? colors.accent[500] + '2E' : onImage.card,
      }]}
    >
      <Text style={[s.chipText, { color: active ? '#FFFFFF' : onImage.muted }]}>{label}</Text>
      <View style={[s.count, { backgroundColor: active ? colors.accent[500] : 'rgba(255,255,255,0.14)' }]}>
        <Text style={[s.countText, { color: active ? '#FFFFFF' : onImage.muted }]}>{count}</Text>
      </View>
    </Tappable>
  )

  return (
    <ScrollView
      horizontal
      showsHorizontalScrollIndicator={false}
      contentContainerStyle={s.row}
      keyboardShouldPersistTaps="handled"
    >
      {chip('all', 'All', total, value === null, () => onChange(null))}

      {squads.map((sq) =>
        chip(
          sq.id, sq.name, counts.get(sq.id) || 0, value === sq.id,
          () => onChange(sq.id),
          onEdit ? () => { tapFeedback(); onEdit(sq) } : undefined,
        ),
      )}

      {unassigned > 0 &&
        chip('unassigned', 'Unassigned', unassigned, value === 'unassigned',
             () => onChange('unassigned'))}

      <Tappable
        onPress={() => { tapFeedback(); onAdd() }}
        accessibilityLabel="Add a squad or an athlete"
        style={[s.add, { borderColor: onImage.cardBorder, backgroundColor: onImage.card }]}
      >
        <Ionicons name="add" size={18} color={onImage.ink} />
      </Tappable>
    </ScrollView>
  )
}

const s = StyleSheet.create({
  row: { paddingHorizontal: spacing.lg, gap: 8, alignItems: 'center', paddingVertical: 2 },
  chip: {
    flexDirection: 'row', alignItems: 'center', gap: 7,
    minHeight: 38, paddingHorizontal: 13,
    borderRadius: radius.full, borderWidth: 1,
  },
  chipText: { fontSize: 13.5, fontWeight: '700', letterSpacing: -0.1 },
  count: {
    minWidth: 20, height: 18, borderRadius: 9, paddingHorizontal: 5,
    alignItems: 'center', justifyContent: 'center',
  },
  countText: { fontSize: 11, fontWeight: '700' },
  add: {
    width: 38, height: 38, borderRadius: 19, borderWidth: 1,
    alignItems: 'center', justifyContent: 'center',
  },
})
