// ═══════════════════════════════════════════════════════════════════════
// ADD AN EVENT — a race, a test day, a competition weekend.
// Deliberately four fields. Anything longer and nobody logs the race.
// ═══════════════════════════════════════════════════════════════════════

import React, { useState, useEffect } from 'react'
import { View, Text, Modal, TextInput, ScrollView, StyleSheet, ActivityIndicator } from 'react-native'
import { Ionicons } from '@expo/vector-icons'
import { useTheme } from '../contexts/ThemeContext'
import { Tappable, MonoKicker } from './ui'
import { spacing, radius, typeScale, weight } from '../lib/theme'
import { EVENT_KINDS, type EventKind } from '../lib/events'
import { dayLabel, todayDay, addDays } from '../lib/schedule'
import { tapFeedback } from '../lib/haptics'

const ISO = /^\d{4}-\d{2}-\d{2}$/

export default function AddEventSheet({
  visible, day, onClose, onSave,
}: {
  visible: boolean
  /** The day that was selected when Add was tapped. */
  day: string
  onClose: () => void
  onSave: (e: {
    date: string; endDate: string | null; kind: EventKind; title: string; notes: string | null
  }) => Promise<void>
}) {
  const { colors } = useTheme()
  const [kind, setKind] = useState<EventKind>('race')
  const [title, setTitle] = useState('')
  const [date, setDate] = useState(day)
  const [endDate, setEndDate] = useState('')
  const [notes, setNotes] = useState('')
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState('')

  // Re-seed on open: the sheet stays mounted for its slide animation, so last
  // visit's values are still sitting here.
  useEffect(() => {
    if (!visible) return
    setKind('race'); setTitle(''); setDate(day || todayDay())
    setEndDate(''); setNotes(''); setError(''); setSaving(false)
  }, [visible, day])

  const save = async () => {
    const t = title.trim()
    if (!t) { setError('Give it a name — “County Champs”, “6×30m testing”.'); return }
    if (!ISO.test(date)) { setError('Date needs to be YYYY-MM-DD.'); return }
    if (endDate.trim() && !ISO.test(endDate.trim())) {
      setError('End date needs to be YYYY-MM-DD, or leave it empty.'); return
    }
    if (endDate.trim() && endDate.trim() < date) {
      setError('The end date is before the start date.'); return
    }
    setError(''); setSaving(true)
    try {
      await onSave({ date, endDate: endDate.trim() || null, kind, title: t, notes: notes.trim() || null })
      onClose()
    } catch (e: any) {
      setError(e?.message?.replace(/^Supabase \d+:\s*/, '') || 'Could not save that.')
      setSaving(false)
    }
  }

  const input = {
    backgroundColor: colors.bg.primary, borderWidth: 1, borderColor: colors.glass.border,
    borderRadius: radius.control, paddingHorizontal: 12, minHeight: 48,
    fontSize: typeScale.body, color: colors.text.primary,
  }

  return (
    <Modal visible={visible} animationType="slide" presentationStyle="pageSheet" onRequestClose={onClose}>
      <View style={{ flex: 1, backgroundColor: '#0B0C18' }}>
        <View style={{ alignItems: 'center', paddingTop: 10 }}>
          <View style={{ width: 36, height: 4, borderRadius: radius.full, backgroundColor: 'rgba(255,255,255,0.22)' }} />
        </View>
        <View style={s.header}>
          <View style={{ flex: 1 }}>
            <MonoKicker color={colors.text.muted}>{dayLabel(date)}</MonoKicker>
            <Text style={[s.title, { color: colors.text.primary }]}>Add an event</Text>
          </View>
          <Tappable onPress={onClose} accessibilityLabel="Close" style={s.close}>
            <Ionicons name="close" size={20} color={colors.text.secondary} />
          </Tappable>
        </View>

        <ScrollView contentContainerStyle={{ padding: spacing.lg, paddingTop: 0 }}
          keyboardShouldPersistTaps="handled">
          <Text style={[s.label, { color: colors.text.muted }]}>What is it?</Text>
          <View style={s.chips}>
            {EVENT_KINDS.map((k) => {
              const on = kind === k.v
              const tone = k.tone === 'muted' ? colors.text.muted : (colors as any)[k.tone] || colors.accent[500]
              return (
                <Tappable key={k.v} onPress={() => { tapFeedback(); setKind(k.v) }}
                  accessibilityLabel={k.l}
                  style={[s.chip, { borderColor: on ? tone + '73' : colors.glass.border,
                    backgroundColor: on ? tone + '24' : colors.bg.primary }]}>
                  <Ionicons name={k.icon as any} size={14} color={on ? tone : colors.text.muted} />
                  <Text style={[s.chipText, { color: on ? tone : colors.text.secondary }]}>{k.l}</Text>
                </Tappable>
              )
            })}
          </View>

          <Text style={[s.label, { color: colors.text.muted }]}>Name</Text>
          <TextInput style={input as any} value={title} onChangeText={setTitle}
            placeholder="e.g. County Championships" placeholderTextColor={colors.text.dimmed}
            keyboardAppearance="dark" maxLength={120} autoFocus />

          <Text style={[s.label, { color: colors.text.muted }]}>Date</Text>
          <TextInput style={input as any} value={date} onChangeText={setDate}
            placeholder="YYYY-MM-DD" placeholderTextColor={colors.text.dimmed}
            keyboardType="numbers-and-punctuation" keyboardAppearance="dark" />

          <Text style={[s.label, { color: colors.text.muted }]}>
            Last day (optional — for something running over a weekend)
          </Text>
          <View style={{ flexDirection: 'row', gap: 8, alignItems: 'center' }}>
            <TextInput style={[input as any, { flex: 1 }]} value={endDate} onChangeText={setEndDate}
              placeholder="YYYY-MM-DD" placeholderTextColor={colors.text.dimmed}
              keyboardType="numbers-and-punctuation" keyboardAppearance="dark" />
            <Tappable onPress={() => setEndDate(addDays(date, 1))} accessibilityLabel="Two days"
              style={[s.quick, { borderColor: colors.glass.border }]}>
              <Text style={{ fontSize: typeScale.caption, fontWeight: weight.bold, color: colors.text.secondary }}>+1 day</Text>
            </Tappable>
          </View>

          <Text style={[s.label, { color: colors.text.muted }]}>Notes (optional)</Text>
          <TextInput style={[input as any, { height: 84, textAlignVertical: 'top', paddingTop: 12 }]}
            value={notes} onChangeText={setNotes} multiline
            placeholder="Anything you want to remember" placeholderTextColor={colors.text.dimmed}
            keyboardAppearance="dark" />

          {!!error && (
            <View style={{ flexDirection: 'row', gap: 8, marginTop: spacing.md, alignItems: 'flex-start' }}>
              <Ionicons name="alert-circle" size={15} color={colors.red} style={{ marginTop: 1 }} />
              <Text style={{ flex: 1, fontSize: typeScale.caption, lineHeight: 18, color: colors.red }}>{error}</Text>
            </View>
          )}

          <Tappable onPress={save} disabled={saving} accessibilityLabel="Save event"
            style={[s.save, { backgroundColor: colors.accent[500] }]}>
            {saving
              ? <ActivityIndicator color="#fff" />
              : <Text style={{ color: '#fff', fontSize: typeScale.body, fontWeight: weight.bold }}>Add to calendar</Text>}
          </Tappable>
        </ScrollView>
      </View>
    </Modal>
  )
}

const s = StyleSheet.create({
  header: {
    flexDirection: 'row', alignItems: 'flex-start', justifyContent: 'space-between',
    paddingHorizontal: spacing.lg, paddingTop: spacing.md, paddingBottom: spacing.md,
  },
  title: { fontSize: typeScale.stat, fontWeight: weight.bold, letterSpacing: -0.5, marginTop: 4 },
  close: {
    width: 44, height: 44, borderRadius: radius.full, alignItems: 'center', justifyContent: 'center',
    backgroundColor: 'rgba(255,255,255,0.08)', borderWidth: 1, borderColor: 'rgba(255,255,255,0.16)',
  },
  label: {
    fontSize: typeScale.label, letterSpacing: 1.5, textTransform: 'uppercase',
    fontWeight: weight.bold, marginTop: spacing.lg, marginBottom: 8,
  },
  chips: { flexDirection: 'row', flexWrap: 'wrap', gap: 8 },
  chip: {
    flexDirection: 'row', alignItems: 'center', gap: 6,
    minHeight: 44, paddingHorizontal: 12, borderRadius: radius.control, borderWidth: 1,
  },
  chipText: { fontSize: typeScale.caption, fontWeight: weight.bold },
  quick: {
    minHeight: 48, paddingHorizontal: 14, justifyContent: 'center',
    borderRadius: radius.control, borderWidth: 1,
  },
  save: {
    marginTop: spacing.xl, minHeight: 52, borderRadius: radius.control,
    alignItems: 'center', justifyContent: 'center',
  },
})
