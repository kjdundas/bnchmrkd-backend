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
// ── WHAT WAS WRONG WITH IT ───────────────────────────────────────────
// The row labelled SESSION was not the session. Calendar events render with
// their kind's label and tone, and `session` is a valid event kind — a
// one-off workout somebody added to the calendar. So an ad-hoc "Warm up" got
// the accent border and the SESSION tag, while the actual programmed session
// from a periodised block rendered grey and untagged underneath it. The
// emphasis was exactly inverted.
//
// Meanwhile `TYPE_STYLE` was computed for every session — a label and a tone,
// Gym, Track, Technical — and thrown away without being drawn.
//
// And the header said "0 of 1 done" above two rows, because the count only
// ever counted program sessions. A counter that disagrees with the list
// directly beneath it is worse than no counter.
//
// ── WHAT DECIDES EMPHASIS NOW ────────────────────────────────────────
// What you have to DO, in the order you have to think about it:
//
//   1  a race, a competition, a test day — these genuinely outrank training
//   2  the programmed sessions — the plan, tagged with their type, countable
//   3  everything else on the calendar — camps, rest, ad-hoc items: context
//
// Emphasis is a left rule in the item's own tone rather than a full border on
// everything. A border says "separate object" and spending it on every row
// says nothing is more important than anything else.
// ═══════════════════════════════════════════════════════════════════════

import React from 'react'
import { View, Text, StyleSheet } from 'react-native'
import { Ionicons } from '@expo/vector-icons'
import { Tappable, GlassPanel, MonoKicker } from './ui'
import { spacing, radius, onImage, onDark, typeScale, weight, numerals } from '../lib/theme'
import { READINESS_COLORS } from '../lib/readiness'
import { sessionType, TYPE_STYLE, stripWeekday, outranksTraining } from '../lib/sessionTypes'
import { EVENT_STYLE, eventKind } from '../lib/events'
import BlockProgress from './BlockProgress'
import type { DayCell, BlockWeek } from '../lib/schedule'

const TONE: Record<string, string> = {
  accent: '#8B83FF', blue: '#5B9DF9', green: '#34d399',
  amber: '#F59E0B', red: '#FF6B6B', muted: 'rgba(255,255,255,0.62)',
}

export default function TodayCard({
  day, block, onOpen, footer,
}: {
  day: DayCell | null
  /** Which week of the block today sits in, if a program is running. */
  block?: BlockWeek | null
  onOpen: () => void
  /** Hosted below a divider — the check-in. Looking at what you are about to
      do and saying how you feel about it is one moment, and it was two cards.
      A footer also keeps the card alive on a rest day, when there is no
      session to show but there is still a check-in to answer. */
  footer?: React.ReactNode
}) {
  const sessions = day?.sessions ?? []
  const events = day?.events ?? []
  const priority = events.filter((e: any) => outranksTraining(eventKind(e.kind)))
  const context = events.filter((e: any) => !outranksTraining(eventKind(e.kind)))

  const hasAnything = sessions.length > 0 || events.length > 0
  if (!hasAnything && !footer) return null

  // Skia draws in pixels, so the track has to be told how wide it is. One
  // onLayout on the card, not one per segment.
  const [barW, setBarW] = React.useState(0)

  const done = sessions.filter((s) => s.done).length
  const allDone = sessions.length > 0 && done === sessions.length

  return (
    <GlassPanel
      tone="deep"
      intensity={24}
      radius={radius.card}
      onPress={hasAnything ? onOpen : undefined}
      accessibilityLabel={
        `Today: ${sessions.length} session${sessions.length === 1 ? '' : 's'}, ${done} done`
        + (events.length ? `, ${events.map((e: any) => e.title).join(', ')}` : '')
        + '. Open the schedule.'
      }
      style={{ padding: 16, marginBottom: spacing.lg }}
      onLayout={(e: any) => {
        const w = e?.nativeEvent?.layout?.width
        if (w) setBarW(Math.max(0, Math.round(w) - 32))   // minus the 16pt padding either side
      }}
    >
      <View style={s.head}>
        <MonoKicker color={onImage.dim}>Today</MonoKicker>
        <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6 }}>
          {sessions.length > 0 && (
            // Named, so it cannot disagree with a list that also holds events.
            <Text style={[s.count, { color: allDone ? TONE.green : onImage.muted }]}>
              {done} of {sessions.length} session{sessions.length === 1 ? '' : 's'}
            </Text>
          )}
          {hasAnything && <Ionicons name="chevron-forward" size={14} color={onImage.dim} />}
        </View>
      </View>

      {/* 1 · The days that outrank training. */}
      {priority.map((e: any, i: number) => (
        <EventRow key={e.id || `p${i}`} event={e} emphasis />
      ))}

      {/* 2 · The plan. Tagged with the type that was always being computed. */}
      {sessions.map((sess, i) => {
        const st = TYPE_STYLE[sessionType(sess.type)]
        const tone = TONE[st.tone] || TONE.accent
        const detail = [
          sess.focus,
          sess.blocks ? `${sess.blocks} block${sess.blocks === 1 ? '' : 's'}` : null,
        ].filter(Boolean).join(' · ')
        return (
          <View key={`${sess.programId}:${sess.index}`} style={[s.row, sess.done && s.rowDone]}>
            <View style={[s.rail, { backgroundColor: sess.done ? TONE.green : tone }]} />
            <View style={s.rowBody}>
              <View style={s.rowTop}>
                <Ionicons
                  name={sess.done ? 'checkmark-circle' : (st.icon as any)}
                  size={15}
                  color={sess.done ? TONE.green : tone}
                />
                <Text numberOfLines={1} style={[s.title, sess.done && s.titleDone]}>
                  {stripWeekday(sess.label)}
                </Text>
                <Text style={[s.tag, { color: sess.done ? TONE.green : tone }]}>
                  {st.label.toUpperCase()}
                </Text>
                {day && day.readiness.level !== 'none' && i === 0 && (
                  <View style={[s.dot, { backgroundColor: READINESS_COLORS[day.readiness.level] }]} />
                )}
              </View>
              {!!detail && <Text numberOfLines={1} style={s.detail}>{detail}</Text>}
            </View>
          </View>
        )
      })}

      {/* 3 · Everything else on the calendar. Context, and it reads like it. */}
      {context.map((e: any, i: number) => (
        <EventRow key={e.id || `c${i}`} event={e} />
      ))}

      {/* Where today sits in the block. Four weeks is four marks, not a
          sentence — the deload is the thing you most want to see coming and
          most easily forget, and you cannot see it coming in prose. */}
      {!!block && !block.finished && barW > 0 && (
        <View style={s.block} onLayout={undefined}>
          <BlockProgress block={block} width={barW} />
        </View>
      )}

      {!!footer && (
        <>
          {hasAnything && <View style={s.rule} />}
          {footer}
        </>
      )}
    </GlassPanel>
  )
}

/** A calendar day. `emphasis` is for the ones that outrank training. */
function EventRow({ event, emphasis }: { event: any; emphasis?: boolean }) {
  const st = EVENT_STYLE[eventKind(event.kind)]
  const tone = TONE[st.tone] || TONE.accent
  return (
    <View style={[s.row, !emphasis && s.rowQuiet]}>
      <View style={[s.rail, { backgroundColor: emphasis ? tone : 'rgba(255,255,255,0.18)' }]} />
      <View style={s.rowBody}>
        <View style={s.rowTop}>
          <Ionicons name={st.icon as any} size={15} color={emphasis ? tone : onImage.dim} />
          <Text numberOfLines={1} style={[s.title, !emphasis && s.titleQuiet]}>{event.title}</Text>
          <Text style={[s.tag, { color: emphasis ? tone : onImage.dim }]}>{st.l.toUpperCase()}</Text>
        </View>
      </View>
    </View>
  )
}

const s = StyleSheet.create({
  head: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between',
    marginBottom: 10,
  },
  count: { fontSize: typeScale.label, fontWeight: weight.bold, ...numerals },

  // A left rule in the item's own colour, not a border round everything.
  row: {
    flexDirection: 'row', alignItems: 'stretch',
    borderRadius: radius.control, overflow: 'hidden',
    backgroundColor: 'rgba(255,255,255,0.06)',
    marginBottom: 6, minHeight: 44,
  },
  rowQuiet: { backgroundColor: 'rgba(255,255,255,0.03)' },
  rowDone: { opacity: 0.55 },
  rail: { width: 3 },
  rowBody: { flex: 1, paddingVertical: 10, paddingHorizontal: 11, justifyContent: 'center' },
  rowTop: { flexDirection: 'row', alignItems: 'center', gap: 9 },

  title: { fontSize: typeScale.caption, fontWeight: weight.medium, color: onImage.ink, flex: 1 },
  titleQuiet: { color: onImage.muted, fontWeight: weight.regular },
  titleDone: { textDecorationLine: 'line-through' },
  tag: { fontSize: typeScale.micro, fontWeight: weight.bold, letterSpacing: 0.9 },
  detail: { fontSize: typeScale.label, color: onImage.dim, marginTop: 3, marginLeft: 24 },
  dot: { width: 8, height: 8, borderRadius: radius.full },

  block: { marginTop: 6 },

  rule: { height: 1, backgroundColor: 'rgba(255,255,255,0.10)', marginTop: 12, marginBottom: 10 },
})
