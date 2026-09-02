// ═══════════════════════════════════════════════════════════════════════
// WHAT DO YOU DO? — the control the app never had.
//
// An athlete's event was inferred entirely from what they happened to log.
// Nowhere in the app could you simply say "I'm a 400m runner", which meant a
// new athlete had no best, no level, no percentile, no projection and no
// leaderboard place, and no way to fix any of it.
//
// Multi-select, because athletes are not one event. A 100m sprinter almost
// always runs the 200m; a heptathlete does seven. The first one chosen is
// the primary — it is what the hero shows and what the app opens on — and it
// is stated plainly rather than left as a rule to be discovered.
// ═══════════════════════════════════════════════════════════════════════

import React, { useState, useMemo } from 'react'
import { View, Text, Modal, ScrollView, StyleSheet, ActivityIndicator } from 'react-native'
import { Ionicons } from '@expo/vector-icons'
import { useTheme } from '../contexts/ThemeContext'
import { Tappable, MonoKicker } from './ui'
import { spacing, radius } from '../lib/theme'
import { tapFeedback } from '../lib/haptics'
import { byGroup } from '../lib/disciplines'
import { upsertInto } from '../lib/supabase'

export default function EventPickerSheet({
  visible, userId, initial = [], onClose, onSaved,
}: {
  visible: boolean
  userId?: string | null
  initial?: string[]
  onClose: () => void
  onSaved?: (events: string[]) => void
}) {
  const { colors } = useTheme()
  const [picked, setPicked] = useState<string[]>(initial)
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState('')
  const groups = useMemo(() => byGroup(), [])

  // Re-seed each time it opens, or editing later starts from an empty sheet
  // and looks like it has forgotten what you told it.
  React.useEffect(() => { if (visible) { setPicked(initial); setError('') } }, [visible])

  const toggle = (name: string) => {
    tapFeedback()
    setPicked((p) => (p.includes(name) ? p.filter((x) => x !== name) : [...p, name]))
  }

  const save = async () => {
    if (!picked.length || !userId) return
    setSaving(true); setError('')
    try {
      // Order matters and is preserved: the first is the primary event.
      await upsertInto('athlete_profiles', {
        id: userId,
        discipline: picked[0],
        disciplines: picked,
      })
      onSaved?.(picked)
      onClose()
    } catch (e: any) {
      setError(e?.message?.replace(/^\w+ \w+ failed: \d+\s*/, '') || 'Could not save that.')
    } finally {
      setSaving(false)
    }
  }

  return (
    <Modal visible={visible} animationType="slide" onRequestClose={onClose} presentationStyle="pageSheet">
      <View style={[s.wrap, { backgroundColor: colors.bg.primary }]}>
        <View style={[s.head, { borderBottomColor: colors.glass.border }]}>
          <Tappable onPress={() => { tapFeedback(); onClose() }} accessibilityLabel="Close" hitSlop={12}>
            <Ionicons name="close" size={22} color={colors.text.secondary} />
          </Tappable>
          <Text style={[s.title, { color: colors.text.primary }]}>Your events</Text>
          <View style={{ width: 22 }} />
        </View>

        <ScrollView contentContainerStyle={{ padding: spacing.lg, paddingBottom: 140 }}>
          <Text style={[s.lede, { color: colors.text.secondary }]}>
            Pick everything you compete in. Your best, your level and where you
            sit on a leaderboard are all worked out per event, so this is what
            makes the rest of the app able to say anything about you.
          </Text>
          <Text style={[s.hint, { color: colors.text.muted }]}>
            {picked.length === 0
              ? 'Choose at least one.'
              : `${picked[0]} is your main event — it is what the app opens on. Tap another first to change that.`}
          </Text>

          {groups.map(({ group, items }) => (
            <View key={group} style={{ marginTop: 22 }}>
              <MonoKicker color={colors.text.muted}>{group}</MonoKicker>
              <View style={s.chips}>
                {items.map((d) => {
                  const on = picked.includes(d.name)
                  const primary = picked[0] === d.name
                  return (
                    <Tappable
                      key={d.name}
                      onPress={() => toggle(d.name)}
                      accessibilityLabel={d.name}
                      accessibilityState={{ selected: on }}
                      style={[s.chip, {
                        borderColor: on ? colors.accent[500] : colors.glass.border,
                        backgroundColor: on ? colors.accent[500] + '2E' : colors.glass.bg,
                      }]}
                    >
                      <Ionicons
                        name={(on ? 'checkmark-circle' : d.icon) as any}
                        size={15}
                        color={on ? colors.accent[500] : colors.text.muted}
                      />
                      <Text style={[s.chipText, {
                        color: on ? colors.text.primary : colors.text.secondary,
                        fontWeight: on ? '700' : '600',
                      }]}>
                        {d.name}
                      </Text>
                      {primary && (
                        <View style={[s.primary, { backgroundColor: colors.accent[500] }]}>
                          <Text style={s.primaryText}>MAIN</Text>
                        </View>
                      )}
                    </Tappable>
                  )
                })}
              </View>
            </View>
          ))}

          {!!error && <Text style={[s.error, { color: colors.red }]}>{error}</Text>}
        </ScrollView>

        <View style={[s.foot, { backgroundColor: colors.bg.primary, borderTopColor: colors.glass.border }]}>
          <Tappable
            onPress={save}
            disabled={!picked.length || saving}
            accessibilityLabel={picked.length ? `Save ${picked.length} events` : 'Choose an event first'}
            style={[s.save, {
              backgroundColor: picked.length ? colors.accent[500] : colors.glass.bg,
              opacity: saving ? 0.6 : 1,
            }]}
          >
            {saving
              ? <ActivityIndicator color="#FFFFFF" />
              : (
                <Text style={[s.saveText, { color: picked.length ? '#FFFFFF' : colors.text.muted }]}>
                  {picked.length === 0 ? 'Choose at least one'
                    : `Save ${picked.length} ${picked.length === 1 ? 'event' : 'events'}`}
                </Text>
              )}
          </Tappable>
        </View>
      </View>
    </Modal>
  )
}

const s = StyleSheet.create({
  wrap: { flex: 1 },
  head: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between',
    paddingHorizontal: spacing.lg, paddingVertical: 14, borderBottomWidth: 1,
  },
  title: { fontSize: 17, fontWeight: '700' },
  lede: { fontSize: 15, lineHeight: 22 },
  hint: { fontSize: 13, lineHeight: 19, marginTop: 8 },
  chips: { flexDirection: 'row', flexWrap: 'wrap', gap: 8, marginTop: 10 },
  chip: {
    flexDirection: 'row', alignItems: 'center', gap: 7,
    minHeight: 42, paddingHorizontal: 13,
    borderRadius: radius.full, borderWidth: 1,
  },
  chipText: { fontSize: 14 },
  primary: {
    paddingHorizontal: 5, paddingVertical: 2, borderRadius: 4, marginLeft: 2,
  },
  primaryText: { color: '#FFFFFF', fontSize: 9, fontWeight: '800', letterSpacing: 0.5 },
  error: { fontSize: 13, marginTop: 18, lineHeight: 19 },
  foot: {
    position: 'absolute', left: 0, right: 0, bottom: 0,
    padding: spacing.lg, paddingBottom: 30, borderTopWidth: 1,
  },
  save: {
    minHeight: 50, borderRadius: radius.full,
    alignItems: 'center', justifyContent: 'center',
  },
  saveText: { fontSize: 16, fontWeight: '700' },
})
