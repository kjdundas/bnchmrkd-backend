// ═══════════════════════════════════════════════════════════════════════
// WHAT YOU ACTUALLY DID — logged against what you were told to do.
//
// Rows come pre-filled from the prescription, so a session that went to plan
// is two taps. The value of that is not convenience: an athlete who has to
// type four identical rows stops logging by Wednesday, and a training log
// with three weeks in it tells you nothing.
//
// ── PER SET, NOT PER EXERCISE ──────────────────────────────────────
// A session where you faded on the last set and one you held together give
// the same per-exercise summary and are very different sessions. The fade is
// the part a coach wants to see, so the fade has to survive being recorded.
//
// Load pre-fills from a %1RM intensity ONLY where the athlete has actually
// tested that lift. Where they have not, the field is left empty rather than
// filled from an assumed max — a suggested working weight derived from
// nothing is the one output on this screen that could hurt someone.
// ═══════════════════════════════════════════════════════════════════════

import React, { useState, useEffect, useMemo } from 'react'
import { View, Text, Modal, ScrollView, TextInput, StyleSheet, ActivityIndicator } from 'react-native'
import { Ionicons } from '@expo/vector-icons'
import { useTheme } from '../contexts/ThemeContext'
import { Tappable, MonoKicker } from './ui'
import { spacing, radius, numerals } from '../lib/theme'
import { parsePrescription, prefillLoadKg, deviations } from '../lib/prescription'
import { sessionType, TYPE_STYLE, filled } from '../lib/sessionTypes'
import { tapFeedback, successFeedback, errorFeedback } from '../lib/haptics'

export interface SetRow {
  set_index: number
  reps: string
  load_kg: string
  distance_m: string
  time_s: string
  rpe: string
  completed: boolean
}

export default function SetLogger({
  visible, onClose, exercise, blockType, existing, oneRepMaxKg, onSave,
}: {
  visible: boolean
  onClose: () => void
  exercise: any
  blockType: string
  /** Rows already logged for this exercise this week. */
  existing: any[]
  /** The athlete's tested 1RM for this lift, if they have one. */
  oneRepMaxKg?: number | null
  onSave: (rows: SetRow[]) => Promise<void>
}) {
  const { colors } = useTheme()
  const [rows, setRows] = useState<SetRow[]>([])
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState('')

  const type = sessionType(blockType)
  const target = useMemo(() => parsePrescription(exercise?.prescription), [exercise])
  const targetLoad = useMemo(
    () => prefillLoadKg(exercise?.intensity, oneRepMaxKg),
    [exercise, oneRepMaxKg],
  )

  useEffect(() => {
    if (!visible) return
    const byIndex = new Map((existing || []).map((r: any) => [Number(r.set_index), r]))
    const n = Math.max(target.rows, byIndex.size, 1)
    const str = (v: any) => (v == null || v === '' ? '' : String(v))
    setRows(Array.from({ length: n }, (_, i) => {
      const prev = byIndex.get(i + 1)
      return {
        set_index: i + 1,
        // A previously logged value always wins over the prescription — it is
        // what happened, and re-opening the sheet must not overwrite it.
        reps: prev ? str(prev.reps) : (target.reps != null ? String(target.reps) : ''),
        load_kg: prev ? str(prev.load_kg) : (targetLoad != null ? String(targetLoad) : ''),
        distance_m: prev ? str(prev.distance_m) : (target.distanceM != null ? String(target.distanceM) : ''),
        time_s: prev ? str(prev.time_s) : (target.timeS != null ? String(target.timeS) : ''),
        rpe: prev ? str(prev.rpe) : '',
        completed: prev ? prev.completed !== false : true,
      }
    }))
    setError(''); setSaving(false)
  }, [visible, exercise, existing, targetLoad, target.rows])

  // Which columns this movement is even measured in.
  const cols = useMemo(() => {
    const c: { key: keyof SetRow; label: string; kb: any }[] = []
    if (type === 'gym' || target.reps != null) c.push({ key: 'reps', label: 'Reps', kb: 'number-pad' })
    if (type === 'gym' || targetLoad != null) c.push({ key: 'load_kg', label: 'kg', kb: 'decimal-pad' })
    if (target.distanceM != null) c.push({ key: 'distance_m', label: 'm', kb: 'decimal-pad' })
    if (target.timeS != null || type === 'track') c.push({ key: 'time_s', label: 'Time s', kb: 'decimal-pad' })
    if (!c.length) c.push({ key: 'reps', label: 'Reps', kb: 'number-pad' })
    c.push({ key: 'rpe', label: 'RPE', kb: 'decimal-pad' })
    return c
  }, [type, target, targetLoad])

  const set = (i: number, key: keyof SetRow, v: any) =>
    setRows((prev) => prev.map((r, j) => (j === i ? { ...r, [key]: v } : r)))

  const save = async () => {
    setError(''); setSaving(true)
    try {
      await onSave(rows)
      successFeedback()
      onClose()
    } catch (e: any) {
      errorFeedback()
      setError(e?.message?.replace(/^Supabase \d+:\s*/, '') || 'Could not save that.')
      setSaving(false)
    }
  }

  const st = TYPE_STYLE[type]

  return (
    <Modal visible={visible} animationType="slide" presentationStyle="pageSheet" onRequestClose={onClose}>
      <View style={{ flex: 1, backgroundColor: '#0B0C18' }}>
        <View style={{ alignItems: 'center', paddingTop: 10 }}>
          <View style={{ width: 36, height: 4, borderRadius: 2, backgroundColor: 'rgba(255,255,255,0.22)' }} />
        </View>

        <View style={s.header}>
          <View style={{ flex: 1 }}>
            <MonoKicker color={colors.text.muted}>
              {st.label}{filled(exercise?.prescription) ? ` · ${exercise.prescription}` : ''}
              {filled(exercise?.intensity) ? ` · ${exercise.intensity}` : ''}
            </MonoKicker>
            <Text style={[s.title, { color: colors.text.primary }]} numberOfLines={2}>
              {exercise?.name || 'Exercise'}
            </Text>
          </View>
          <Tappable onPress={onClose} accessibilityLabel="Close" style={s.close}>
            <Ionicons name="close" size={20} color={colors.text.secondary} />
          </Tappable>
        </View>

        <ScrollView contentContainerStyle={{ paddingBottom: 56 }} keyboardShouldPersistTaps="handled">
          {/* Where a load was prescribed as a percentage and we have no 1RM,
              say so rather than leaving an unexplained empty box. */}
          {targetLoad == null && /1\s*-?\s*rm/i.test(String(exercise?.intensity || '')) && (
            <Text style={[s.note, { color: colors.amber }]}>
              This is prescribed off your 1RM, which you haven't tested for this lift.
              Log the weight you actually used and the app will have it next time.
            </Text>
          )}

          <View style={[s.thead, { borderBottomColor: colors.glass.divider }]}>
            <Text style={[s.th, { width: 34, color: colors.text.muted }]}>Set</Text>
            {cols.map((c) => (
              <Text key={c.key} style={[s.th, s.cell, { color: colors.text.muted }]}>{c.label}</Text>
            ))}
            <View style={{ width: 34 }} />
          </View>

          {rows.map((r, i) => {
            const devs = deviations({
              reps: r.reps, load_kg: r.load_kg, distance_m: r.distance_m, time_s: r.time_s,
            }, target, targetLoad)
            const off = devs.filter((d) => d.material)
            return (
              <View key={r.set_index}>
                <View style={[s.row, { borderBottomColor: colors.glass.divider }]}>
                  <Text style={[s.setNum, { width: 34, color: colors.text.secondary }]}>{r.set_index}</Text>
                  {cols.map((c) => (
                    <TextInput
                      key={c.key}
                      style={[s.input, s.cell, {
                        color: r.completed ? colors.text.primary : colors.text.dimmed,
                        borderColor: colors.glass.border, backgroundColor: colors.bg.primary,
                      }]}
                      value={String(r[c.key] ?? '')}
                      onChangeText={(v) => set(i, c.key, v)}
                      keyboardType={c.kb}
                      keyboardAppearance="dark"
                      placeholder="—"
                      placeholderTextColor={colors.text.dimmed}
                      editable={r.completed}
                      accessibilityLabel={`Set ${r.set_index} ${c.label}`}
                    />
                  ))}
                  <Tappable
                    onPress={() => { tapFeedback(); set(i, 'completed', !r.completed) }}
                    accessibilityLabel={`Set ${r.set_index}, ${r.completed ? 'done — tap to mark skipped' : 'skipped — tap to mark done'}`}
                    hitSlop={6}
                    style={{ width: 34, alignItems: 'center' }}
                  >
                    <Ionicons
                      name={r.completed ? 'checkmark-circle' : 'close-circle-outline'}
                      size={22}
                      color={r.completed ? colors.accent[500] : colors.text.dimmed}
                    />
                  </Tappable>
                </View>
                {r.completed && off.length > 0 && (
                  <Text style={[s.dev, { color: colors.amber }]}>
                    {off.map((d) => {
                      const unit = d.field === 'load_kg' ? 'kg'
                        : d.field === 'distance_m' ? 'm' : d.field === 'time_s' ? 's' : ''
                      const name = d.field === 'load_kg' ? 'load'
                        : d.field === 'distance_m' ? 'distance'
                          : d.field === 'time_s' ? 'time' : 'reps'
                      const n = Math.round(d.delta * 100) / 100
                      return `${n > 0 ? '+' : '−'}${Math.abs(n)}${unit} ${name}`
                    }).join(' · ')}
                  </Text>
                )}
              </View>
            )
          })}

          <View style={{ flexDirection: 'row', gap: 10, paddingHorizontal: spacing.lg, marginTop: spacing.md }}>
            <Tappable
              onPress={() => setRows((p) => [...p, {
                set_index: p.length + 1, reps: '', load_kg: '', distance_m: '',
                time_s: '', rpe: '', completed: true,
              }])}
              accessibilityLabel="Add a set"
              style={[s.ghost, { borderColor: colors.glass.border }]}
            >
              <Ionicons name="add" size={15} color={colors.text.secondary} />
              <Text style={{ fontSize: 13, fontWeight: '700', color: colors.text.secondary }}>Set</Text>
            </Tappable>
            <Tappable onPress={save} disabled={saving} accessibilityLabel="Save"
              style={[s.save, { backgroundColor: colors.accent[500] }]}>
              {saving ? <ActivityIndicator color="#fff" />
                : <Text style={{ color: '#fff', fontSize: 14, fontWeight: '700' }}>Save</Text>}
            </Tappable>
          </View>

          {!!error && (
            <Text style={[s.note, { color: colors.red }]}>{error}</Text>
          )}
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
  title: { fontSize: 22, fontWeight: '700', letterSpacing: -0.4, marginTop: 4 },
  close: {
    width: 44, height: 44, borderRadius: 22, alignItems: 'center', justifyContent: 'center',
    backgroundColor: 'rgba(255,255,255,0.08)', borderWidth: 1, borderColor: 'rgba(255,255,255,0.16)',
  },
  note: { fontSize: 12, lineHeight: 18, paddingHorizontal: spacing.lg, marginBottom: spacing.md },
  thead: {
    flexDirection: 'row', alignItems: 'center', gap: 6,
    paddingHorizontal: spacing.lg, paddingBottom: 8, borderBottomWidth: 1,
  },
  th: { fontSize: 9, letterSpacing: 1.2, textTransform: 'uppercase', fontWeight: '700' },
  row: {
    flexDirection: 'row', alignItems: 'center', gap: 6,
    paddingHorizontal: spacing.lg, paddingVertical: 8, borderBottomWidth: 1,
  },
  cell: { flex: 1, textAlign: 'center' },
  setNum: { fontSize: 14, fontWeight: '700', textAlign: 'center', ...numerals },
  input: {
    minHeight: 44, borderRadius: radius.sm, borderWidth: 1,
    fontSize: 15, fontWeight: '600', paddingHorizontal: 4, ...numerals,
  },
  dev: { fontSize: 10.5, fontWeight: '700', paddingHorizontal: spacing.lg, paddingTop: 4, paddingBottom: 6 },
  ghost: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 5,
    minHeight: 48, paddingHorizontal: 16, borderRadius: radius.md, borderWidth: 1,
  },
  save: { flex: 1, minHeight: 48, borderRadius: radius.md, alignItems: 'center', justifyContent: 'center' },
})
