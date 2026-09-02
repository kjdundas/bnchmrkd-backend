// ═══════════════════════════════════════════════════════════════════════
// THE MONTH — a season's worth of context above the week.
//
// The week view answers "what am I doing on Wednesday". This answers "how
// close is the race" and "when is the deload", which is the question you
// actually have when a coach asks about your block.
//
// Every cell is the SAME DayCell the week strip renders from, produced by
// calling buildWeek six times rather than by month-specific arithmetic. The
// month and the week therefore cannot disagree about a day — the kind of
// drift that would surface first on the one day of the year the clocks change.
//
// Six rows always, never five. A grid that changes height between months
// makes everything below it jump on every swipe.
// ═══════════════════════════════════════════════════════════════════════

import React from 'react'
import { View, Text, StyleSheet } from 'react-native'
import { Ionicons } from '@expo/vector-icons'
import { useTheme } from '../contexts/ThemeContext'
import { Tappable } from './ui'
import { spacing, radius, numerals, typeScale, weight } from '../lib/theme'
import { READINESS_COLORS } from '../lib/readiness'
import { WEEKDAY_LETTER, parseDay, type MonthModel, type DayCell } from '../lib/schedule'
import { EVENT_STYLE, eventKind } from '../lib/events'

export default function MonthView({
  month, selected, onSelect, onPrev, onNext, onToday, onAddEvent,
}: {
  month: MonthModel
  selected: string
  onSelect: (day: string) => void
  onPrev: () => void
  onNext: () => void
  onToday: () => void
  onAddEvent: () => void
}) {
  const { colors } = useTheme()

  return (
    <View>
      <View style={s.nav}>
        <Tappable onPress={onPrev} accessibilityLabel="Previous month" hitSlop={10} style={s.arrow}>
          <Ionicons name="chevron-back" size={17} color={colors.text.secondary} />
        </Tappable>
        <Tappable onPress={onToday} accessibilityLabel={`${month.label}. Tap to jump to today`}
          style={{ flex: 1, alignItems: 'center' }}>
          <Text style={[s.title, { color: colors.text.primary }]}>{month.label}</Text>
          <Text style={[s.titleHint, { color: colors.text.muted }]}>Tap for today</Text>
        </Tappable>
        <Tappable onPress={onNext} accessibilityLabel="Next month" hitSlop={10} style={s.arrow}>
          <Ionicons name="chevron-forward" size={17} color={colors.text.secondary} />
        </Tappable>
      </View>

      <View style={s.headRow}>
        {WEEKDAY_LETTER.map((l, i) => (
          <Text key={i} style={[s.headLetter, { color: colors.text.muted }]}>{l}</Text>
        ))}
      </View>

      {month.weeks.map((w, wi) => (
        <View key={wi} style={s.row}>
          {w.days.map((d) => (
            <Cell
              key={d.date}
              d={d}
              dim={!month.inMonth(d.date)}
              selected={d.date === selected}
              onPress={() => onSelect(d.date)}
            />
          ))}
        </View>
      ))}

      <View style={s.footer}>
        {/* The hint shrinks and truncates; the button never does. Laying this
            out as space-between with a fixed-width label pushed the button
            off the right edge of the panel entirely — at the letter-spacing
            a mono kicker uses, a sentence is wider than it looks. */}
        <Text numberOfLines={1} style={[s.hint, { color: colors.text.muted }]}>
          Tap a day to open it
        </Text>
        <Tappable onPress={onAddEvent} accessibilityLabel="Add an event" style={[s.add, {
          borderColor: colors.accent[500] + '73', backgroundColor: colors.accent[500] + '1F',
        }]}>
          <Ionicons name="add" size={15} color={colors.accent[500]} />
          <Text style={[s.addText, { color: colors.accent[500] }]}>Event</Text>
        </Tappable>
      </View>
    </View>
  )
}

function Cell({
  d, dim, selected, onPress,
}: { d: DayCell; dim: boolean; selected: boolean; onPress: () => void }) {
  const { colors } = useTheme()
  const ev = d.events[0]
  const kind = ev ? eventKind(ev.kind) : null
  const evTone = kind
    ? (EVENT_STYLE[kind].tone === 'muted' ? colors.text.muted : (colors as any)[EVENT_STYLE[kind].tone] || colors.accent[500])
    : null
  const done = d.plannedCount > 0 && d.doneCount >= d.plannedCount

  const label = [
    parseDay(d.date).getDate(),
    d.plannedCount ? `${d.doneCount} of ${d.plannedCount} done` : null,
    d.events.length ? d.events.map((e: any) => e.title).join(', ') : null,
  ].filter(Boolean).join(', ')

  return (
    <Tappable onPress={onPress} accessibilityLabel={label} hitSlop={0}
      style={[s.cell, selected && { backgroundColor: 'rgba(255,255,255,0.12)' }]}>
      {/* An event colours the whole day, because "there is a race that week"
          is the thing you scan a month for. */}
      {!!evTone && <View style={[s.evBar, { backgroundColor: evTone }]} />}

      <Text style={[s.num, {
        color: dim ? colors.text.dimmed
          : d.isToday ? colors.accent[500] : colors.text.secondary,
        fontWeight: d.isToday ? weight.bold : weight.medium,
        opacity: dim ? 0.55 : 1,
      }]}>
        {parseDay(d.date).getDate()}
      </Text>

      <View style={s.marks}>
        {d.plannedCount > 0 && (
          <View style={[s.dot, {
            backgroundColor: done ? colors.accent[500] : 'transparent',
            borderWidth: done ? 0 : 1.2,
            borderColor: colors.accent[500] + '99',
            opacity: dim ? 0.4 : 1,
          }]} />
        )}
        {d.readiness.level !== 'none' && (
          <View style={[s.dot, {
            backgroundColor: READINESS_COLORS[d.readiness.level], opacity: dim ? 0.4 : 1,
          }]} />
        )}
        {d.races.length > 0 && (
          <View style={[s.dot, { backgroundColor: colors.green, opacity: dim ? 0.4 : 1 }]} />
        )}
      </View>
    </Tappable>
  )
}

const s = StyleSheet.create({
  nav: { flexDirection: 'row', alignItems: 'center', marginBottom: spacing.md },
  arrow: {
    width: 36, height: 36, borderRadius: radius.full, alignItems: 'center', justifyContent: 'center',
    backgroundColor: 'rgba(255,255,255,0.07)',
  },
  title: { fontSize: typeScale.body, fontWeight: weight.bold, letterSpacing: -0.2 },
  titleHint: { fontSize: typeScale.micro, fontWeight: weight.medium, marginTop: 2 },
  headRow: { flexDirection: 'row', marginBottom: 4 },
  headLetter: { flex: 1, textAlign: 'center', fontSize: typeScale.micro, fontWeight: weight.bold, letterSpacing: 0.5 },
  row: { flexDirection: 'row' },
  cell: {
    flex: 1, alignItems: 'center', paddingVertical: 5, borderRadius: radius.chip,
    minHeight: 44, justifyContent: 'center', gap: 3, overflow: 'hidden',
  },
  evBar: { position: 'absolute', top: 0, left: 4, right: 4, height: 2.5, borderRadius: radius.hair },
  num: { fontSize: typeScale.caption, ...numerals },
  marks: { flexDirection: 'row', gap: 2.5, height: 5, alignItems: 'center' },
  dot: { width: 5, height: 5, borderRadius: radius.full },
  footer: {
    flexDirection: 'row', alignItems: 'center', marginTop: spacing.md, gap: 10,
  },
  hint: {
    flex: 1, flexShrink: 1, minWidth: 0,
    fontSize: typeScale.label, letterSpacing: 1.4, textTransform: 'uppercase', fontWeight: weight.bold,
  },
  add: {
    // flexShrink 0 is the fix: the button keeps its width and the hint gives
    // way, rather than the row overflowing its container.
    flexShrink: 0,
    flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 4,
    paddingHorizontal: 14, minHeight: 40, borderRadius: radius.control, borderWidth: 1,
  },
  addText: { fontSize: typeScale.caption, fontWeight: weight.bold },
})
