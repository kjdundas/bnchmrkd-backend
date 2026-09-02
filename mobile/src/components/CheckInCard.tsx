// ═══════════════════════════════════════════════════════════════════════
// DAILY CHECK-IN (athlete · mobile) — native port of the web CheckInCard.
// Sleep · soreness · energy · mood · pain. One row per day, updated in place.
// Rolls up to a red/amber/green readiness the athlete sees and the linked
// coach sees on their roster. Youth-safe: any reported pain forces red.
// ═══════════════════════════════════════════════════════════════════════

import React, { useState, useEffect, useCallback } from 'react'
import { View, Text, ActivityIndicator, Modal, ScrollView } from 'react-native'
import { Ionicons } from '@expo/vector-icons'
import { selectFrom, insertInto, updateIn, SIGNED_OUT } from '../lib/supabase'
import { checkinStatus, READINESS_COLORS, PAIN_AREAS, todayStr } from '../lib/readiness'
import { useTheme } from '../contexts/ThemeContext'
import { spacing, radius, rhythm, onImage } from '../lib/theme'
import { successFeedback, errorFeedback } from '../lib/haptics'
import { Tappable, GlassPanel, MonoKicker } from './ui'

const SLEEP_CHIPS = [
  { l: '<5h', v: 4.5 }, { l: '5–6h', v: 5.5 }, { l: '6–7h', v: 6.5 },
  { l: '7–8h', v: 7.5 }, { l: '8h+', v: 8.5 },
]
const SCALE = [1, 2, 3, 4, 5]

interface Form {
  sleep_hours: number | null
  soreness: number | null
  mood: number | null
  energy: number | null
  pain: boolean
  pain_areas: string[]
}

/**
 * A message an athlete can act on, out of whatever the REST helper threw.
 * `insertInto athlete_checkins failed: 401 {...}` is not one.
 */
function cleanError(e: any): string {
  const msg = String(e?.message || '')
  if (e?.code === SIGNED_OUT || /\b40[13]\b/.test(msg)) {
    return 'You\u2019re signed out, so that couldn\u2019t be saved. Sign in again and it will go through.'
  }
  if (/Network request failed|fetch/i.test(msg)) {
    return 'No connection \u2014 your check-in was not saved. Try again when you\u2019re back online.'
  }
  if (/\b409\b|duplicate/i.test(msg)) {
    return 'You have already checked in today. Pull to refresh and edit it instead.'
  }
  return msg.replace(/^\w+ [\w.]+ failed: \d+\s*/, '').slice(0, 160)
}

const EMPTY: Form = { sleep_hours: null, soreness: null, mood: null, energy: null, pain: false, pain_areas: [] }

function Chip({ on, danger, onPress, children, grow }: any) {
  const { colors } = useTheme()
  const activeBg = danger ? colors.red + '2E' : colors.accent[500] + '2E'
  const activeFg = danger ? colors.red : colors.accent[500]
  return (
    <Tappable
      onPress={onPress}
      accessibilityLabel={String(children)}
      hitSlop={4}
      style={{
        flex: grow ? 1 : undefined, minWidth: 44,
        // 44pt minimum (Apple HIG). These were ~32pt tall.
        minHeight: 44, justifyContent: 'center',
        paddingHorizontal: grow ? 4 : 14,
        borderRadius: radius.md, alignItems: 'center',
        backgroundColor: on ? activeBg : colors.bg.primary,
        borderWidth: 1, borderColor: on ? activeFg + '73' : colors.glass.border,
      }}
    >
      <Text style={{ fontSize: 13, fontWeight: '700', color: on ? activeFg : colors.text.secondary }}>
        {children}
      </Text>
    </Tappable>
  )
}

function Scale({ label, hint, children }: any) {
  const { colors } = useTheme()
  return (
    <View style={{ marginTop: 12 }}>
      <View style={{ flexDirection: 'row', alignItems: 'baseline', justifyContent: 'space-between', marginBottom: 6 }}>
        <Text style={{ fontSize: 10, letterSpacing: 1.5, textTransform: 'uppercase', color: colors.text.muted, fontWeight: '600' }}>
          {label}
        </Text>
        {!!hint && <Text style={{ fontSize: 9, color: colors.text.dimmed }}>{hint}</Text>}
      </View>
      <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 6 }}>{children}</View>
    </View>
  )
}

export default function CheckInCard({
  athleteId, onImage: over, onState, openSignal = 0 }: {
  athleteId?: string | null
  /** True when the card sits over the stadium backdrop rather than on paper. */
  onImage?: boolean
  /** Reports whether a check-in exists, so the getting-started card can tell
   *  without running the same query a second time. Two queries for one fact
   *  is how two parts of a screen start disagreeing. */
  onState?: (hasCheckin: boolean) => void
  /** Bumped by a caller to open the check-in sheet from outside — the
      Get started card's CTA, which otherwise has nowhere to send anyone:
      the check-in is not a screen, it is this card. */
  openSignal?: number
}) {
  const { colors } = useTheme()
  const [row, setRow] = useState<any>(null)
  React.useEffect(() => { onState?.(!!row) }, [row])
  const [loading, setLoading] = useState(true)
  const [editing, setEditing] = useState(false)
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState('')
  const [sheet, setSheet] = useState(false)
  const [form, setForm] = useState<Form>({ ...EMPTY })

  // Opened from outside. Skips the first render so the sheet does not fly up
  // the moment the home screen mounts.
  const firstSignal = React.useRef(true)
  useEffect(() => {
    if (firstSignal.current) { firstSignal.current = false; return }
    if (row) setEditing(true)
    setSheet(true)
  }, [openSignal])

  const load = useCallback(async () => {
    if (!athleteId) return
    setLoading(true)
    try {
      const rows = await selectFrom('athlete_checkins', {
        filter: `athlete_id=eq.${athleteId}&checkin_date=eq.${todayStr()}`, limit: '1',
      })
      const r = Array.isArray(rows) && rows[0] ? rows[0] : null
      setRow(r)
      if (r) {
        setForm({
          sleep_hours: r.sleep_hours, soreness: r.soreness, mood: r.mood,
          energy: r.energy, pain: !!r.pain, pain_areas: r.pain_areas || [],
        })
      }
      setEditing(!r)
    } catch (e: any) {
      // Was silent, which made a failed read indistinguishable from a first
      // check-in of the day — the athlete then filled the form in and the save
      // collided with a row they could not see.
      setRow(null); setEditing(true)
      setError(cleanError(e) || 'Could not load today\u2019s check-in.')
    } finally { setLoading(false) }
  }, [athleteId])

  useEffect(() => { load() }, [load])

  const set = (k: keyof Form, v: any) => { setError(''); setForm((s) => ({ ...s, [k]: v })) }
  const toggleArea = (a: string) =>
    setForm((s) => ({
      ...s,
      pain_areas: s.pain_areas.includes(a) ? s.pain_areas.filter((x) => x !== a) : [...s.pain_areas, a],
    }))

  const save = async () => {
    setSaving(true); setError('')
    try {
      const payload = {
        sleep_hours: form.sleep_hours, soreness: form.soreness, mood: form.mood,
        energy: form.energy, pain: !!form.pain,
        pain_areas: form.pain ? form.pain_areas : [],
        pain_note: null,
      }
      let saved
      if (row?.id) saved = await updateIn('athlete_checkins', `id=eq.${row.id}`, payload)
      else saved = await insertInto('athlete_checkins', { athlete_id: athleteId, checkin_date: todayStr(), ...payload })
      setRow(saved || { ...payload, checkin_date: todayStr() })
      successFeedback()
      setEditing(false)
      setSheet(false)
    } catch (e: any) {
      // Stay in edit mode so the athlete can retry — and SAY WHY. A haptic on
      // its own is the bug this replaces: the buzz fired, the write had been
      // refused, and the screen said nothing at all.
      errorFeedback()
      setError(cleanError(e) || 'Could not save your check-in. Try again.')
    } finally { setSaving(false) }
  }

  if (loading) return null

  const status = checkinStatus(row)
  const color = READINESS_COLORS[status.level]

  const canSave =
    form.soreness != null || form.mood != null || form.energy != null ||
    form.sleep_hours != null || form.pain

  // ── The form itself ──────────────────────────────────────────────
  // Extracted so it can render inline on paper OR inside the sheet that the
  // on-image pill opens. One implementation, two hosts.
  const formBody = (
    <>
      <Scale label="Sleep last night">
        {SLEEP_CHIPS.map((c) => (
          <Chip key={c.l} on={form.sleep_hours === c.v} onPress={() => set('sleep_hours', c.v)}>{c.l}</Chip>
        ))}
      </Scale>

      <Scale label="Soreness" hint="1 fresh · 5 very sore">
        {SCALE.map((n) => (
          <Chip key={n} grow on={form.soreness === n} danger={n >= 4} onPress={() => set('soreness', n)}>{n}</Chip>
        ))}
      </Scale>

      <Scale label="Energy" hint="1 flat · 5 buzzing">
        {SCALE.map((n) => (
          <Chip key={n} grow on={form.energy === n} onPress={() => set('energy', n)}>{n}</Chip>
        ))}
      </Scale>

      <Scale label="Mood" hint="1 low · 5 great">
        {SCALE.map((n) => (
          <Chip key={n} grow on={form.mood === n} onPress={() => set('mood', n)}>{n}</Chip>
        ))}
      </Scale>

      <Tappable
        onPress={() => set('pain', !form.pain)}
        accessibilityLabel={form.pain ? 'Pain reported today, tap to clear' : 'Report pain or a niggle today'}
        style={{ flexDirection: 'row', alignItems: 'center', gap: 10, marginTop: rhythm.section, minHeight: 44 }}
      >
        <Ionicons
          name={form.pain ? 'checkbox' : 'square-outline'}
          size={20} color={form.pain ? colors.red : colors.text.muted}
        />
        <Text style={{ fontSize: 14, color: colors.text.primary }}>Any pain or niggle today?</Text>
      </Tappable>

      {form.pain && (
        <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 6, marginTop: 10 }}>
          {PAIN_AREAS.map((a) => (
            <Chip key={a.v} danger on={form.pain_areas.includes(a.v)} onPress={() => toggleArea(a.v)}>
              {a.l}
            </Chip>
          ))}
        </View>
      )}

      <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8, marginTop: 18 }}>
        <Tappable
          onPress={save} disabled={saving || !canSave}
          accessibilityLabel={row ? 'Update check-in' : 'Save check-in'}
          style={{
            flex: 1, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 7,
            minHeight: 48, borderRadius: radius.md,
            backgroundColor: colors.accent[500],
          }}
        >
          {saving
            ? <ActivityIndicator size="small" color="#FFFFFF" />
            : <Ionicons name="checkmark" size={15} color="#FFFFFF" />}
          <Text style={{ color: '#FFFFFF', fontSize: 13, fontWeight: '700' }}>
            {saving ? 'Saving…' : row ? 'Update check-in' : 'Check in'}
          </Text>
        </Tappable>
        {row && !over && (
          <Tappable
            onPress={() => setEditing(false)}
            accessibilityLabel="Cancel"
            style={{ paddingHorizontal: 14, minHeight: 48, justifyContent: 'center' }}
          >
            <Text style={{ fontSize: 13, color: colors.text.muted, fontWeight: '600' }}>Cancel</Text>
          </Tappable>
        )}
      </View>

      {!!error && (
        <View style={{
          flexDirection: 'row', alignItems: 'flex-start', gap: 7, marginTop: 12,
          borderLeftWidth: 2, borderLeftColor: colors.red, paddingLeft: 10,
        }}>
          <Ionicons name="alert-circle" size={14} color={colors.red} style={{ marginTop: 2 }} />
          <Text style={{ flex: 1, fontSize: 12.5, lineHeight: 18, color: colors.red }}>
            {error}
          </Text>
        </View>
      )}

      {form.pain && (
        <Text style={{ fontSize: 11, color: colors.text.muted, marginTop: 10, lineHeight: 16 }}>
          If pain persists or worsens, stop and see a physio or doctor. Your coach will see this flagged.
        </Text>
      )}
    </>
  )

  // ── The sheet the on-image pill opens ────────────────────────────
  const formSheet = (
    <Modal
      visible={sheet}
      animationType="slide"
      presentationStyle="pageSheet"
      onRequestClose={() => setSheet(false)}
    >
      <View style={{ flex: 1, backgroundColor: colors.bg.primary }}>
        <View style={{ alignItems: 'center', paddingTop: 10 }}>
          <View style={{ width: 36, height: 4, borderRadius: 2, backgroundColor: colors.glass.border }} />
        </View>
        <View style={{
          flexDirection: 'row', alignItems: 'flex-start', justifyContent: 'space-between',
          paddingHorizontal: spacing.lg, paddingTop: spacing.md, paddingBottom: spacing.sm,
        }}>
          <View>
            <MonoKicker>30 seconds</MonoKicker>
            <Text style={{
              fontSize: 26, fontWeight: '700', color: colors.text.primary,
              letterSpacing: -0.5, marginTop: 4,
            }}>
              Daily check-in
            </Text>
          </View>
          <Tappable
            onPress={() => setSheet(false)}
            accessibilityLabel="Close check-in"
            style={{
              width: 44, height: 44, borderRadius: 22, alignItems: 'center', justifyContent: 'center',
              backgroundColor: colors.glass.bg, borderWidth: 1, borderColor: colors.glass.border,
            }}
          >
            <Ionicons name="close" size={20} color={colors.text.secondary} />
          </Tappable>
        </View>
        <ScrollView
          contentContainerStyle={{ paddingHorizontal: spacing.lg, paddingBottom: 48 }}
          showsVerticalScrollIndicator={false}
        >
          {formBody}
        </ScrollView>
      </View>
    </Modal>
  )

  // ══ ON-IMAGE ═══════════════════════════════════════════════════════
  // Oura's "Confirm yesterday's activity": one translucent row on the
  // photograph, never a form. A five-scale questionnaire competing with the
  // hero is the fastest way to make a beautiful screen look busy — so the
  // whole thing collapses to a single line and opens in a sheet.
  if (over) {
    const done = !!row
    return (
      <>
        <GlassPanel
          onPress={() => { if (row) setEditing(true); setSheet(true) }}
          accessibilityLabel={done
            ? `Checked in today, ${status.label}. Tap to update.`
            : 'Daily check-in, takes 30 seconds. Tap to start.'}
          radius={18}
          style={{
            flexDirection: 'row', alignItems: 'center', gap: 13,
            paddingHorizontal: 16, minHeight: 62,
            marginBottom: rhythm.section,
          }}
        >
          <View style={{
            width: 34, height: 34, borderRadius: 17,
            alignItems: 'center', justifyContent: 'center',
            backgroundColor: done ? color + '2E' : 'rgba(255,255,255,0.14)',
            borderWidth: 1, borderColor: done ? color + '66' : 'rgba(255,255,255,0.20)',
          }}>
            <Ionicons
              name={done ? 'checkmark' : 'pulse'}
              size={16}
              color={done ? color : onImage.ink}
            />
          </View>

          <View style={{ flex: 1 }}>
            <Text style={{ fontSize: 15, fontWeight: '600', color: onImage.ink }}>
              {done ? `Checked in · ${status.label}` : 'Daily check-in'}
            </Text>
            <Text numberOfLines={1} style={{ fontSize: 12, color: onImage.muted, marginTop: 2 }}>
              {done
                ? (status.reasons.length ? status.reasons.join(' · ') : 'All green — have a great session.')
                : 'Sleep, soreness, energy · 30 seconds'}
            </Text>
          </View>

          <Ionicons name="chevron-forward" size={17} color={onImage.dim} />
        </GlassPanel>

        {formSheet}
      </>
    )
  }

  // ══ ON PAPER ═══════════════════════════════════════════════════════
  // ── Saved (collapsed) state ──────────────────────────────────────
  if (row && !editing) {
    // Ambient level: once you've checked in this is a status line, not a
    // task. A left rule in the readiness colour carries the state instead of
    // a 10pt dot — amber should be legible at arm's length.
    return (
      <View style={{
        borderRadius: 16, marginBottom: rhythm.section,
        backgroundColor: color + '12',
        flexDirection: 'row', alignItems: 'center', gap: 14,
        paddingRight: 16, overflow: 'hidden',
      }}>
        <View style={{ width: 4, alignSelf: 'stretch', backgroundColor: color }} />
        <View style={{ paddingVertical: 14, flexDirection: 'row', alignItems: 'center', gap: 12, flex: 1 }}>
        <View style={{ flex: 1 }}>
          <Text style={{ fontSize: 14, fontWeight: '700', color: colors.text.primary }}>
            Checked in today · {status.label}
          </Text>
          <Text numberOfLines={1} style={{ fontSize: 11, color: colors.text.muted, marginTop: 2 }}>
            {status.reasons.length ? status.reasons.join(' · ') : 'All green — have a great session.'}
          </Text>
        </View>
        <Tappable
          onPress={() => setEditing(true)}
          accessibilityLabel="Edit today's check-in"
          hitSlop={12}
          style={{ minHeight: 44, justifyContent: 'center', paddingHorizontal: 4 }}
        >
          <Text style={{ fontSize: 13, color: colors.accent[500], fontWeight: '600' }}>Edit</Text>
        </Tappable>
        </View>
      </View>
    )
  }

  // ── Edit / first-time state ──────────────────────────────────────
  return (
    <View style={{
      borderRadius: 20, padding: 18, marginBottom: rhythm.section,
      backgroundColor: colors.glass.overlay,
      borderWidth: 1, borderColor: colors.accent[500] + '33',
    }}>
      <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8 }}>
        <Ionicons name="pulse" size={16} color={colors.accent[500]} />
        <Text style={{ fontSize: 14, fontWeight: '700', color: colors.text.primary }}>Daily check-in</Text>
        <Text style={{ fontSize: 11, color: colors.text.muted }}>· 30 seconds</Text>
      </View>
      {formBody}
    </View>
  )
}
