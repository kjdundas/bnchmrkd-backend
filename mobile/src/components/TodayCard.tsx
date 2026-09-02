// ═══════════════════════════════════════════════════════════════════════
// TODAY — the one question Home should answer before any other.
//
// Everything else on Home is retrospective: what you have logged, how you are
// trending, where you sit against a standard. None of it answers "what am I
// doing this afternoon", which is the reason most people open the app.
//
// Built from the SAME buildWeek the schedule uses, so it cannot say something
// the Programs tab contradicts. It is a window onto that model, not a second
// implementation of it.
//
// Silent when there is genuinely nothing: an empty card that says "nothing
// planned" every day for a month is worse than no card, because it teaches
// the athlete to stop looking. It appears when there is something to see.
// ═══════════════════════════════════════════════════════════════════════

import React from 'react'
import { View, Text, StyleSheet } from 'react-native'
import { Ionicons } from '@expo/vector-icons'
import { Tappable, GlassPanel, MonoKicker } from './ui'
import { spacing, radius, onImage, typeScale, weight } from '../lib/theme'
import { READINESS_COLORS } from '../lib/readiness'
import { sessionType, TYPE_STYLE } from '../lib/sessionTypes'
import { EVENT_STYLE, eventKind } from '../lib/events'
import type { DayCell, BlockWeek } from '../lib/schedule'

const TONE: Record<string, string> = {
  accent: '#8B83FF', blue: '#5B9DF9', green: '#34d399',
  amber: '#F59E0B', red: '#FF6B6B', muted: 'rgba(255,255,255,0.62)',
}

export default function TodayCard({
  day, block, onOpen,
}: {
  day: DayCell | null
  /** Which week of the block today sits in, if a program is running. */
  block?: BlockWeek | null
  onOpen: () => void
}) {
  if (!day) return null

  const hasSessions = day.sessions.length > 0
  const hasEvents = day.events.length > 0
  // A day with only a check-in on it does not need a card telling you so.
  if (!hasSessions && !hasEvents) return null

  const done = day.sessions.filter((sess) => sess.done).length
  const allDone = hasSessions && done === day.sessions.length

  return (
    <GlassPanel
      tone="deep"
      intensity={24}
      radius={20}
      onPress={onOpen}
      accessibilityLabel={
        `Today: ${day.sessions.length} sessions, ${done} done`
        + (hasEvents ? `, ${day.events.map((e: any) => e.title).join(', ')}` : '')
        + '. Open the schedule.'
      }
      style={{ padding: 16, marginBottom: spacing.lg }}
    >
      <View style={s.head}>
        <MonoKicker color={onImage.dim}>Today</MonoKicker>
        <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6 }}>
          {hasSessions && (
            <Text style={[s.count, {
              color: allDone ? TONE.green : onImage.muted,
            }]}>
              {done} of {day.sessions.length} done
            </Text>
          )}
          <Ionicons name="chevron-forward" size={14} color={onImage.dim} />
        </View>
      </View>

      {/* An event first — a race today outranks the session that was planned. */}
      {day.events.map((e: any, i: number) => {
        const st = EVENT_STYLE[eventKind(e.kind)]
        const tone = TONE[st.tone] || TONE.accent
        return (
          <View key={e.id || i} style={[s.row, { borderColor: tone + '59', backgroundColor: tone + '1A' }]}>
            <Ionicons name={st.icon as any} size={15} color={tone} />
            <Text numberOfLines={1} style={[s.title, { color: onImage.ink, flex: 1 }]}>{e.title}</Text>
            <Text style={[s.tag, { color: tone }]}>{st.l.toUpperCase()}</Text>
          </View>
        )
      })}

      {day.sessions.map((sess, i) => {
        const st = TYPE_STYLE[sessionType(sess.type)]
        return (
          <View key={i} style={[s.row, {
            borderColor: 'rgba(255,255,255,0.16)',
            backgroundColor: 'rgba(255,255,255,0.06)',
            opacity: sess.done ? 0.6 : 1,
          }]}>
            <Ionicons
              name={sess.done ? 'checkmark-circle' : (st.icon as any)}
              size={15}
              color={sess.done ? TONE.green : onImage.muted}
            />
            <Text numberOfLines={1} style={[s.title, {
              color: onImage.ink, flex: 1,
              textDecorationLine: sess.done ? 'line-through' : 'none',
            }]}>
              {sess.label}
            </Text>
            {day.readiness.level !== 'none' && i === 0 && (
              <View style={[s.dot, { backgroundColor: READINESS_COLORS[day.readiness.level] }]} />
            )}
          </View>
        )
      })}

      {/* Where today sits in the block — the deload is the thing you most
          want to know before a session, and most easily forget. */}
      {!!block && !block.finished && (
        <Text style={[s.block, { color: onImage.muted }]}>
          Week {block.week} of {block.total} · {block.phase === 'deload' ? 'Deload' : 'Build'}
          {block.adjustment ? ` — ${block.adjustment}` : ''}
        </Text>
      )}
    </GlassPanel>
  )
}

const s = StyleSheet.create({
  head: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between',
    marginBottom: 10,
  },
  count: { fontSize: typeScale.label, fontWeight: weight.bold },
  row: {
    flexDirection: 'row', alignItems: 'center', gap: 10,
    borderRadius: radius.control, borderWidth: 1, padding: 11, marginBottom: 6,
  },
  title: { fontSize: typeScale.caption, fontWeight: weight.medium },
  tag: { fontSize: typeScale.micro, fontWeight: weight.bold, letterSpacing: 0.9 },
  dot: { width: 8, height: 8, borderRadius: radius.full },
  block: { fontSize: typeScale.label, lineHeight: 16, marginTop: 4 },
})
