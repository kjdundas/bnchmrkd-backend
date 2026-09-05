// ═══════════════════════════════════════════════════════════════════════
// INDICATOR PICKER — which rings live on Home, and in what order.
//
// Reached by long-pressing any ring on the rail. That gesture is the whole
// reason this sheet can be as plain as it is: the athlete arrives already
// pointing at the thing they want to change, so the sheet's job is to show
// the rail as a list and let them edit it, not to teach a concept.
//
// TWO RULES CARRY THE BEHAVIOUR:
//
//   1. Empty means AUTOMATIC, not empty. A stored list of zero keys is the
//      rail's default order (most recently logged first), which keeps
//      adapting as new metrics arrive. So when the sheet opens on an athlete
//      who has never chosen, it SEEDS the working list from what is currently
//      on screen. Editing is then subtraction from what they can see — which
//      is what long-pressing a ring to remove it implies — rather than
//      building a list from nothing and watching eight rings vanish on the
//      first tap.
//
//   2. Nothing is written until something is changed. Seeding is not a
//      choice. If the athlete opens the sheet, looks, and closes it, the rail
//      stays automatic and keeps re-ordering itself. Committing the seed
//      would silently freeze the order at whatever today happened to be.
//
// Order is edited with chevrons rather than drag-and-drop. Dragging inside a
// scroll view needs a gesture-handler list and a reanimated layout pass to
// feel right; done badly it fights the scroll on every touch. A list this
// short reorders fine with two buttons, and two buttons are reachable with
// VoiceOver, which a drag handle is not.
// ═══════════════════════════════════════════════════════════════════════

import React, { useEffect, useMemo, useRef, useState } from 'react'
import { View, Text, Modal, ScrollView, StyleSheet } from 'react-native'
import Svg, { Circle, Defs, LinearGradient, Stop } from 'react-native-svg'
import { Ionicons } from '@expo/vector-icons'
import { onImageColors as colors, spacing, radius, rhythm, numerals, onDark, typeScale, weight } from '../lib/theme'
import { Tappable, MonoKicker } from './ui'
import { useReducedMotion } from '../lib/motion'
import { MAX_INDICATORS } from '../lib/indicators'
import { ringModel, fmtMetricValue, timeAgo, type MetricGroup } from '../lib/metricSemantics'

export default function IndicatorPicker({
  visible, onClose, groups, chosen, onChange, focusKey,
}: {
  visible: boolean
  onClose: () => void
  /** Every metric the athlete has actually logged, automatic order. */
  groups: MetricGroup[]
  /** The saved list. Empty = automatic. */
  chosen: string[]
  /** Called on every edit. An empty array means "go back to automatic". */
  onChange: (keys: string[]) => void
  /** The ring that was long-pressed, highlighted so the gesture lands. */
  focusKey?: string | null
}) {
  const reduced = useReducedMotion()
  const byKey = useMemo(() => new Map(groups.map((g) => [g.key, g])), [groups])

  // The seed: what the rail is showing right now.
  const automatic = useMemo(
    () => groups.slice(0, MAX_INDICATORS).map((g) => g.key),
    [groups],
  )

  const [working, setWorking] = useState<string[]>([])
  const [touched, setTouched] = useState(false)

  // Everything the seed needs, read at open time rather than depended on.
  //
  // This ref is the whole reason the sheet works. Seeding from `chosen` in a
  // dependency array looks right and is a trap: every edit calls onChange,
  // which updates `chosen` upstream, which re-runs the effect and overwrites
  // the working list. Removing the last ring would set `chosen` to [], the
  // effect would read that as "automatic", and all nine rings would spring
  // back the instant the athlete removed the ninth.
  const seedRef = useRef({ chosen, automatic, byKey })
  seedRef.current = { chosen, automatic, byKey }

  // Re-seed on every open, not just on mount — the sheet stays mounted so its
  // slide-in animation works, which means state from the last visit is still
  // sitting here.
  useEffect(() => {
    if (!visible) return
    const cur = seedRef.current
    // Drop keys with no data: a metric can be chosen on one device and never
    // logged on this one, and a row with nothing in it is not editable.
    const seed = (cur.chosen.length ? cur.chosen : cur.automatic).filter((k) => cur.byKey.has(k))
    setWorking(seed.length ? seed : cur.automatic)
    setTouched(false)
  }, [visible])

  const commit = (next: string[]) => {
    setWorking(next)
    setTouched(true)
    onChange(next)
  }

  const toggle = (key: string) => {
    if (working.includes(key)) commit(working.filter((k) => k !== key))
    else if (working.length < MAX_INDICATORS) commit([...working, key])
  }

  const move = (key: string, dir: -1 | 1) => {
    const i = working.indexOf(key)
    const j = i + dir
    if (i < 0 || j < 0 || j >= working.length) return
    const next = working.slice()
    next[i] = next[j]
    next[j] = key
    commit(next)
  }

  const reset = () => {
    setWorking(automatic)
    setTouched(true)
    onChange([])
  }

  const selected = working.map((k) => byKey.get(k)).filter(Boolean) as MetricGroup[]
  const rest = groups.filter((g) => !working.includes(g.key))
  const full = working.length >= MAX_INDICATORS
  // "Automatic" is what the rail is ACTUALLY on, which is a question about
  // what is stored, not about this sheet. An empty stored list is automatic —
  // so an athlete who removes every ring is put back on automatic, and the
  // sheet has to say that rather than claim nothing is showing.
  const isAutomatic = working.length === 0 || (!chosen.length && !touched)

  return (
    <Modal
      visible={visible}
      animationType={reduced ? 'none' : 'slide'}
      presentationStyle="pageSheet"
      onRequestClose={onClose}
    >
      <View style={{ flex: 1, backgroundColor: '#0B0C18' }}>
        <View style={{ alignItems: 'center', paddingTop: 10 }}>
          <View style={{ width: 36, height: 4, borderRadius: radius.full, backgroundColor: 'rgba(255,255,255,0.22)' }} />
        </View>

        <View style={s.header}>
          <View style={{ flex: 1 }}>
            <MonoKicker color={colors.text.muted}>
              {isAutomatic ? 'Automatic' : `${working.length} of ${MAX_INDICATORS}`}
            </MonoKicker>
            <Text style={s.title}>Performance indicators</Text>
          </View>
          <Tappable onPress={onClose} accessibilityLabel="Done" style={s.close}>
            <Ionicons name="close" size={20} color={colors.text.secondary} />
          </Tappable>
        </View>

        <ScrollView contentContainerStyle={{ paddingBottom: 56 }} showsVerticalScrollIndicator={false}>
          <Text style={s.intro}>
            {isAutomatic
              ? 'Your rail is choosing itself — most recently logged first. Edit it below and it stays exactly as you set it.'
              : 'These are your rings, in this order. Remove one and it drops off Home; the rail keeps the rest.'}
          </Text>

          <Section label={`On your home screen · ${working.length}`} />
          {selected.length === 0 ? (
            <Text style={s.empty}>
              Nothing chosen, so the rail is back to choosing itself — most
              recently logged first. Add any metric below to take it over.
            </Text>
          ) : selected.map((g, i) => (
            <Row
              key={g.key}
              g={g}
              index={i}
              focused={g.key === focusKey}
              onToggle={() => toggle(g.key)}
              onUp={i > 0 ? () => move(g.key, -1) : undefined}
              onDown={i < selected.length - 1 ? () => move(g.key, 1) : undefined}
            />
          ))}

          {rest.length > 0 && (
            <>
              <Section label={`Also logged · ${rest.length}`} />
              {full && (
                <Text style={s.empty}>
                  The rail holds {MAX_INDICATORS}. Remove one above to make room.
                </Text>
              )}
              {rest.map((g) => (
                <Row
                  key={g.key}
                  g={g}
                  index={null}
                  focused={g.key === focusKey}
                  disabled={full}
                  onToggle={() => toggle(g.key)}
                />
              ))}
            </>
          )}

          <View style={{ paddingHorizontal: spacing.lg, marginTop: rhythm.section }}>
            <Tappable
              onPress={reset}
              disabled={isAutomatic}
              accessibilityLabel="Reset indicators to automatic"
              style={s.reset}
            >
              <Ionicons name="refresh" size={16} color={colors.text.secondary} />
              <Text style={s.resetText}>Reset to automatic</Text>
            </Tappable>
            <Text style={s.foot}>
              Automatic shows whatever you have logged most recently, so it keeps
              up as you add new tests. A set list never changes on its own.
            </Text>
          </View>
        </ScrollView>
      </View>
    </Modal>
  )
}

// ── One metric row ─────────────────────────────────────────────────
function Row({
  g, index, focused, disabled, onToggle, onUp, onDown,
}: {
  g: MetricGroup
  index: number | null
  focused?: boolean
  disabled?: boolean
  onToggle: () => void
  onUp?: () => void
  onDown?: () => void
}) {
  const on = index != null
  const { latest, shown, isPb } = ringModel(g)
  const name = g.label || g.key

  return (
    <View style={[s.row, focused && s.rowFocused]}>
      <Tappable
        onPress={onToggle}
        disabled={disabled && !on}
        accessibilityLabel={
          on
            ? `${name}, position ${(index as number) + 1}. Remove from home screen`
            : `${name}. Add to home screen`
        }
        style={s.rowBody}
      >
        <MiniRing uid={g.key} shown={shown} isPb={isPb} on={on} value={latest} />
        <View style={{ flex: 1, gap: 2 }}>
          <Text numberOfLines={1} style={[s.name, !on && { color: colors.text.secondary }]}>
            {name}
            {isPb ? <Text style={{ color: onDark.accent }}> ★</Text> : null}
          </Text>
          <Text numberOfLines={1} style={s.meta}>
            {fmtMetricValue(latest)}{g.unit ? ` ${g.unit}` : ''}
            {' · '}{g.history.length} reading{g.history.length === 1 ? '' : 's'}
            {timeAgo(g.latest.recorded_at) ? ` · ${timeAgo(g.latest.recorded_at)}` : ''}
          </Text>
        </View>
        <Ionicons
          name={on ? 'checkmark-circle' : 'add-circle-outline'}
          size={24}
          color={on ? onDark.accent : (disabled ? colors.text.dimmed : colors.text.muted)}
        />
      </Tappable>

      {on && (
        <View style={s.moves}>
          <Tappable
            onPress={onUp}
            disabled={!onUp}
            hitSlop={6}
            accessibilityLabel={`Move ${name} earlier`}
            style={s.move}
          >
            <Ionicons name="chevron-up" size={15} color={onUp ? colors.text.secondary : colors.text.dimmed} />
          </Tappable>
          <Tappable
            onPress={onDown}
            disabled={!onDown}
            hitSlop={6}
            accessibilityLabel={`Move ${name} later`}
            style={s.move}
          >
            <Ionicons name="chevron-down" size={15} color={onDown ? colors.text.secondary : colors.text.dimmed} />
          </Tappable>
        </View>
      )}
    </View>
  )
}

// A 40pt version of the rail's ring, so the list previews the thing it edits.
// No sweep animation: nine arcs animating on every reorder is motion for its
// own sake, and the list is a settings screen, not a dashboard.
function MiniRing({ uid: key, shown, isPb, on, value }: {
  uid: string; shown: number; isPb: boolean; on: boolean; value: number
}) {
  const R = 16
  const C = 2 * Math.PI * R
  // Keyed on the metric, not on its value: two metrics that happen to sit at
  // the same fill would otherwise share a gradient id.
  const uid = `mini_${String(key).replace(/[^a-zA-Z0-9]/g, '')}`
  return (
    <View style={{ width: 40, height: 40, opacity: on ? 1 : 0.5 }}>
      <Svg width={40} height={40} viewBox="0 0 40 40" style={{ transform: [{ rotate: '-90deg' }] }}>
        <Defs>
          <LinearGradient id={uid} x1="0" y1="0" x2="1" y2="1">
            <Stop offset="0" stopColor={isPb ? '#A8A2FF' : '#4F3CF0'} />
            <Stop offset="1" stopColor={isPb ? '#FFFFFF' : '#A8A2FF'} />
          </LinearGradient>
        </Defs>
        <Circle cx={20} cy={20} r={R} fill="none" stroke="rgba(255,255,255,0.13)" strokeWidth={2.5} />
        <Circle
          cx={20} cy={20} r={R} fill="none"
          stroke={`url(#${uid})`} strokeWidth={2.5} strokeLinecap="round"
          strokeDasharray={`${C}`} strokeDashoffset={C * (1 - shown)}
        />
      </Svg>
      <View style={{
        position: 'absolute', left: 0, right: 0, top: 0, bottom: 0,
        alignItems: 'center', justifyContent: 'center',
      }}>
        <Text style={{ fontSize: typeScale.label, fontWeight: weight.bold, color: colors.text.primary, ...numerals }}>
          {fmtMetricValue(value)}
        </Text>
      </View>
    </View>
  )
}

function Section({ label }: { label: string }) {
  return (
    <View style={s.section}>
      <Text style={s.sectionText}>{label}</Text>
    </View>
  )
}

const s = StyleSheet.create({
  header: {
    flexDirection: 'row', alignItems: 'flex-start', justifyContent: 'space-between',
    paddingHorizontal: spacing.lg, paddingTop: spacing.md, paddingBottom: spacing.md,
  },
  title: {
    fontSize: typeScale.stat, fontWeight: weight.bold, color: colors.text.primary,
    letterSpacing: -0.5, marginTop: 4,
  },
  close: {
    width: 44, height: 44, borderRadius: radius.full, alignItems: 'center', justifyContent: 'center',
    backgroundColor: 'rgba(255,255,255,0.08)', borderWidth: 1, borderColor: 'rgba(255,255,255,0.16)',
  },
  intro: {
    fontSize: typeScale.caption, lineHeight: 19, color: colors.text.secondary,
    paddingHorizontal: spacing.lg, paddingBottom: spacing.md,
  },
  section: {
    paddingHorizontal: spacing.lg, paddingTop: rhythm.section, paddingBottom: 8,
  },
  sectionText: {
    fontSize: typeScale.micro, letterSpacing: 1.6, textTransform: 'uppercase',
    color: colors.text.muted, fontWeight: weight.bold,
  },
  empty: {
    fontSize: typeScale.caption, lineHeight: 18, color: colors.text.muted,
    paddingHorizontal: spacing.lg, paddingBottom: 8,
  },
  row: {
    flexDirection: 'row', alignItems: 'center',
    paddingHorizontal: spacing.lg, paddingVertical: 6,
  },
  rowFocused: {
    backgroundColor: 'rgba(79,60,240,0.13)',
  },
  rowBody: {
    flex: 1, flexDirection: 'row', alignItems: 'center', gap: 12,
    paddingVertical: 8,
  },
  name: { fontSize: typeScale.body, fontWeight: weight.medium, color: colors.text.primary },
  meta: { fontSize: typeScale.label, color: colors.text.muted, fontVariant: ['tabular-nums'] },
  moves: { marginLeft: 8, gap: 2 },
  move: {
    width: 34, height: 24, borderRadius: radius.chip, alignItems: 'center', justifyContent: 'center',
    backgroundColor: 'rgba(255,255,255,0.06)',
  },
  reset: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 8,
    height: 48, borderRadius: radius.control,
    borderWidth: 1, borderColor: 'rgba(255,255,255,0.16)',
    backgroundColor: 'rgba(255,255,255,0.05)',
  },
  resetText: { fontSize: typeScale.body, fontWeight: weight.medium, color: colors.text.secondary },
  foot: {
    // dimmed (38% white) measures 3.86:1 on this ground — below the 4.5:1
    // this size needs. muted clears it at 6.0:1.
    fontSize: typeScale.label, color: colors.text.muted, lineHeight: 16, marginTop: 12,
  },
})
