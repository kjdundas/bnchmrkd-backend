// ═══════════════════════════════════════════════════════════════════════
// WEEK STRIP — seven days, three kinds of fact, one glance.
//
// A day has to carry the plan, whether the plan happened, and how the athlete
// felt — without becoming a dashboard cell. Three separate icons per day
// would be a legend to memorise at 50pt wide, so the day IS a ring, in the
// same visual language as the metric rings on Home:
//
//   the ARC      sessions completed of sessions planned. No arc, no session.
//   the CENTRE   the check-in — green, amber, red, or hollow for a day the
//                athlete did not check in.
//   the PIPS     a mark below for anything logged: a race, a test.
//
// The arc and the centre are independent on purpose. "Trained hard, felt
// terrible" and "did nothing, felt great" are the two readings that matter
// most, and they are the two a single combined score would hide.
//
// Nothing here is a judgement. A day with no ring is a rest day if the plan
// says so and a missed day if it does not, and the strip does not editorialise
// about which — the athlete knows, and a red mark for an unplanned rest day is
// how an app gets closed.
// ═══════════════════════════════════════════════════════════════════════

import React from 'react'
import { View, Text, StyleSheet } from 'react-native'
import Svg, { Circle } from 'react-native-svg'
import { Ionicons } from '@expo/vector-icons'
import { useTheme } from '../contexts/ThemeContext'
import { Tappable, MonoKicker } from './ui'
import { spacing, radius, numerals, typeScale, weight } from '../lib/theme'
import { READINESS_COLORS } from '../lib/readiness'
import {
  WEEKDAY_LETTER, weekHeading, weekLabel, parseDay,
  type WeekModel, type DayCell, type BlockWeek,
} from '../lib/schedule'

const RING = 34
const R = 14
const C = 2 * Math.PI * R

export default function WeekStrip({
  week, selected, onSelect, onPrev, onNext, onToday,
}: {
  week: WeekModel
  selected: string
  onSelect: (date: string) => void
  onPrev: () => void
  onNext: () => void
  onToday: () => void
}) {
  const { colors } = useTheme()
  const heading = weekHeading(week.weekStart)

  return (
    <View>
      {/* ── Week navigation ──────────────────────────────────────── */}
      <View style={s.nav}>
        <Tappable onPress={onPrev} accessibilityLabel="Previous week" hitSlop={10} style={s.arrow}>
          <Ionicons name="chevron-back" size={17} color={colors.text.secondary} />
        </Tappable>

        {/* Not disabled on the current week, deliberately. Tappable dims a
            disabled child to 45%, and the current week is the screen's DEFAULT
            state — the title would load greyed out. Tapping "This week" while
            already on it is harmless. */}
        <Tappable
          onPress={onToday}
          accessibilityLabel={week.isCurrentWeek ? heading : `${heading}. Jump back to this week`}
          style={{ flex: 1, alignItems: 'center' }}
        >
          <Text style={[s.heading, { color: colors.text.primary }]}>{heading}</Text>
          {/* Away from this week, the sub-line stops describing and starts
              offering the way back — the one thing you want from there. */}
          {week.isCurrentWeek ? (
            <Text style={[s.range, { color: colors.text.muted }]}>{weekLabel(week.weekStart)}</Text>
          ) : (
            <Text style={[s.range, { color: colors.accent[500] }]}>Back to this week</Text>
          )}
        </Tappable>

        <Tappable onPress={onNext} accessibilityLabel="Next week" hitSlop={10} style={s.arrow}>
          <Ionicons name="chevron-forward" size={17} color={colors.text.secondary} />
        </Tappable>
      </View>

      {/* ── The seven days ───────────────────────────────────────── */}
      <View style={s.row}>
        {week.days.map((d) => (
          <Day key={d.date} d={d} selected={d.date === selected} onPress={() => onSelect(d.date)} />
        ))}
      </View>

      {/* ── Where this week sits in the block ─────────────────────
          The program used to be one template week with the progression
          written as a paragraph nobody could act on. This is that paragraph,
          cut into the week you are actually in. */}
      {week.blocks.map((b) => (
        <BlockRow key={b.programId} b={b} />
      ))}

      {/* ── Week total, and what the dots meant ──────────────────
          The dots under each day had no legend at all: a green one meant a
          check-in that came back green, a hollow one meant no check-in, and
          nothing on the screen said so. Now the key sits under the strip
          that uses it. */}
      <View style={s.summary}>
        <MonoKicker color={colors.text.muted}>
          {week.plannedCount === 0
            ? 'No sessions this week'
            : `${week.doneCount} of ${week.plannedCount} sessions`}
        </MonoKicker>
        {week.hasSuggestedDays && (
          <Text style={[s.suggested, { color: colors.text.muted }]}>Days suggested</Text>
        )}
      </View>

      <View style={s.legend}>
        <View style={[s.legendDot, { backgroundColor: READINESS_COLORS.green }]} />
        <Text style={[s.legendText, { color: colors.text.muted }]}>checked in</Text>
        <View style={[s.legendDot, {
          backgroundColor: 'transparent', borderWidth: 1, borderColor: colors.glass.borderHover,
        }]} />
        <Text style={[s.legendText, { color: colors.text.muted }]}>not yet</Text>
      </View>
    </View>
  )
}

function BlockRow({ b }: { b: BlockWeek }) {
  const { colors } = useTheme()
  const deload = b.phase === 'deload'
  // A finished block is said plainly. Rolling on to "week 6 of 4" would be a
  // lie, and quietly repeating week 1 forever is the behaviour this whole
  // change exists to remove.
  const tone = b.finished ? colors.text.muted : deload ? colors.amber : colors.accent[500]

  return (
    <View style={[s.block, { borderColor: tone + '59', backgroundColor: tone + '14' }]}>
      <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8 }}>
        <Text style={[s.blockWeek, { color: tone }]}>
          {b.finished ? 'Block finished' : `Week ${b.week} of ${b.total}`}
        </Text>
        {!b.finished && !!b.phase && (
          <View style={[s.phase, { backgroundColor: tone + '2E' }]}>
            <Text style={[s.phaseText, { color: tone }]}>
              {deload ? 'DELOAD' : 'BUILD'}
            </Text>
          </View>
        )}
        <Text numberOfLines={1} style={[s.blockTitle, { color: colors.text.muted }]}>
          {b.programTitle}
        </Text>
      </View>
      <Text style={[s.blockText, { color: colors.text.secondary }]}>
        {b.finished
          ? `This block was written for ${b.total} weeks. Generate a new one, or keep going and treat it as maintenance.`
          : (b.adjustment || b.intent)}
      </Text>
    </View>
  )
}

function Day({ d, selected, onPress }: { d: DayCell; selected: boolean; onPress: () => void }) {
  const { colors } = useTheme()
  const planned = d.plannedCount
  const frac = planned ? d.doneCount / planned : 0
  const readiness = READINESS_COLORS[d.readiness.level] || READINESS_COLORS.none
  const hasCheckin = d.readiness.level !== 'none'
  const marks = d.races.length + (d.tests.length ? 1 : 0)

  // A future day cannot have been missed, so its untouched track is drawn a
  // little brighter — a planned day ahead of you reads as an outline waiting
  // to be filled rather than as a shortfall.
  const trackColor = d.isFuture ? 'rgba(255,255,255,0.18)' : 'rgba(255,255,255,0.11)'

  const label = [
    parseDay(d.date).getDate() + '',
    planned ? `${d.doneCount} of ${planned} sessions done` : 'no sessions planned',
    hasCheckin ? d.readiness.label : 'no check-in',
    d.races.length ? `${d.races.length} race` : '',
    d.tests.length ? `${d.tests.length} tests logged` : '',
  ].filter(Boolean).join(', ')

  return (
    <Tappable
      onPress={onPress}
      accessibilityLabel={label}
      hitSlop={2}
      style={[
        s.day,
        selected && { backgroundColor: 'rgba(255,255,255,0.10)' },
      ]}
    >
      <Text style={[s.letter, {
        color: d.isToday ? colors.accent[500] : colors.text.muted,
        fontWeight: d.isToday ? weight.bold : weight.medium,
      }]}>
        {WEEKDAY_LETTER[d.weekday - 1]}
      </Text>

      <View style={{ width: RING, height: RING, marginTop: 4 }}>
        <Svg width={RING} height={RING} viewBox={`0 0 ${RING} ${RING}`}
          style={{ transform: [{ rotate: '-90deg' }] }}>
          {planned > 0 && (
            <Circle cx={RING / 2} cy={RING / 2} r={R} fill="none"
              stroke={trackColor} strokeWidth={2.5} />
          )}
          {frac > 0 && (
            <Circle
              cx={RING / 2} cy={RING / 2} r={R} fill="none"
              stroke={colors.accent[500]} strokeWidth={2.5} strokeLinecap="round"
              strokeDasharray={`${C}`} strokeDashoffset={C * (1 - frac)}
            />
          )}
        </Svg>

        <View style={s.centre}>
          <Text style={[s.date, {
            color: d.isToday ? colors.text.primary : colors.text.secondary,
            fontWeight: d.isToday ? weight.bold : weight.medium,
          }]}>
            {parseDay(d.date).getDate()}
          </Text>
        </View>
      </View>

      {/* Check-in: filled when logged, an empty outline when not — an absent
          day should look like a gap to fill, not like a fourth colour. */}
      <View style={[s.dot, hasCheckin
        ? { backgroundColor: readiness }
        : { borderWidth: 1.2, borderColor: 'rgba(255,255,255,0.22)' }]} />

      {/* Anything logged that day. Kept to one row so the column height never
          changes — a strip whose rows jump as data arrives reads as broken. */}
      <View style={s.pips}>
        {d.races.length > 0 && <View style={[s.pip, { backgroundColor: colors.accent[500] }]} />}
        {d.tests.length > 0 && <View style={[s.pip, { backgroundColor: 'rgba(255,255,255,0.62)' }]} />}
        {marks === 0 && <View style={[s.pip, { backgroundColor: 'transparent' }]} />}
      </View>
    </Tappable>
  )
}

const s = StyleSheet.create({
  nav: { flexDirection: 'row', alignItems: 'center', marginBottom: spacing.md },
  arrow: {
    width: 36, height: 36, borderRadius: radius.full,
    alignItems: 'center', justifyContent: 'center',
    backgroundColor: 'rgba(255,255,255,0.07)',
  },
  heading: { fontSize: typeScale.body, fontWeight: weight.bold, letterSpacing: -0.2 },
  range: { fontSize: typeScale.label, marginTop: 2, fontWeight: weight.medium },
  row: { flexDirection: 'row', justifyContent: 'space-between' },
  day: {
    flex: 1, alignItems: 'center', paddingVertical: 8,
    borderRadius: radius.control, gap: 0,
  },
  letter: { fontSize: typeScale.label, letterSpacing: 0.5 },
  centre: {
    position: 'absolute', left: 0, right: 0, top: 0, bottom: 0,
    alignItems: 'center', justifyContent: 'center',
  },
  date: { fontSize: typeScale.caption, ...numerals },
  dot: { width: 7, height: 7, borderRadius: radius.full, marginTop: 6 },
  legend: { flexDirection: 'row', alignItems: 'center', gap: 6, marginTop: 10 },
  legendDot: { width: 6, height: 6, borderRadius: radius.full },
  legendText: { fontSize: typeScale.micro, letterSpacing: 0.4, marginRight: 6 },
  // 5pt rather than 4: a 4pt mark on a translucent panel over a photograph
  // is under the 3:1 a non-text indicator needs to be seen at all.
  pips: { flexDirection: 'row', gap: 3, height: 5, marginTop: 5, alignItems: 'center' },
  pip: { width: 5, height: 5, borderRadius: radius.full },
  summary: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between',
    marginTop: spacing.md,
  },
  suggested: { fontSize: typeScale.label, fontWeight: weight.medium, letterSpacing: 0.3 },
  block: {
    marginTop: spacing.md, padding: 12, borderRadius: radius.control, borderWidth: 1, gap: 5,
  },
  blockWeek: { fontSize: typeScale.caption, fontWeight: weight.bold, letterSpacing: 0.2 },
  phase: { paddingHorizontal: 5, paddingVertical: 2, borderRadius: radius.hair },
  phaseText: { fontSize: typeScale.micro, fontWeight: weight.bold, letterSpacing: 0.9 },
  blockTitle: { fontSize: typeScale.label, flexShrink: 1 },
  blockText: { fontSize: typeScale.caption, lineHeight: 17 },
})
