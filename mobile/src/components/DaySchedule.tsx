// ═══════════════════════════════════════════════════════════════════════
// ONE DAY — what is planned, what happened, and how it felt.
//
// Sits under the strip rather than in a modal. The schedule's job is to let
// the athlete look across the week and then into a day, and a sheet that
// covers the strip breaks that motion every time you compare two days.
//
// The order is deliberate: SESSIONS first (the thing you act on — ticking a
// session is the one write on this screen), then WHAT WAS LOGGED, then the
// CHECK-IN. Readiness is context for the session, not the headline; leading
// with it turns a training screen into a wellness screen.
// ═══════════════════════════════════════════════════════════════════════

import React, { useState } from 'react'
import { View, Text, StyleSheet, ActivityIndicator } from 'react-native'
import { Ionicons } from '@expo/vector-icons'
import { useTheme } from '../contexts/ThemeContext'
import { Tappable, MonoKicker } from './ui'
import { radius, numerals, typeScale, weight } from '../lib/theme'
import { READINESS_COLORS } from '../lib/readiness'
import { dayLabel, type DayCell } from '../lib/schedule'
import {
  sessionType, TYPE_STYLE, exerciseMeta, filled, stripWeekday, outranksTraining,
} from '../lib/sessionTypes'
import { EVENT_STYLE, eventKind } from '../lib/events'
import SessionTick from './SessionTick'
import { metricForExercise } from '../lib/exerciseMetrics'
import { fmtMetricValue, formatMark } from '../lib/metricSemantics'

export default function DaySchedule({
  day, onToggleSession, busyKey, onOpenWellness, onMoveSession,
  sessionBody, onLogExercise, onTrackExercise, loggedCount, showProgram = false,
}: {
  day: DayCell
  onToggleSession: (programId: string, index: number) => void
  busyKey: string | null
  onOpenWellness: () => void
  onMoveSession?: (programId: string, index: number) => void
  /** The full session object, for expanding into blocks and exercises. */
  sessionBody?: (programId: string, index: number) => any
  onLogExercise?: (programId: string, sessionIndex: number, blockIndex: number, exerciseIndex: number) => void
  onTrackExercise?: (metricKey: string, exercise: any) => void
  /** How many sets are already logged for one exercise. */
  loggedCount?: (programId: string, sessionIndex: number, blockIndex: number, exerciseIndex: number) => number
  /** Name the programme on each session. Only worth it with more than one
      running — otherwise it is the same string three times on one screen. */
  showProgram?: boolean
}) {
  const { colors } = useTheme()
  const [openSession, setOpenSession] = useState<string | null>(null)
  const nothing = !day.sessions.length && !day.races.length && !day.tests.length
    && !day.checkin && !day.events.length

  return (
    <View style={s.wrap}>
      <View style={s.head}>
        <Text style={[s.title, { color: colors.text.primary }]}>
          {day.isToday ? 'Today' : dayLabel(day.date)}
        </Text>
        {day.isToday && (
          <Text style={[s.sub, { color: colors.text.muted }]}>{dayLabel(day.date)}</Text>
        )}
      </View>

      {nothing && (
        <Text style={[s.empty, { color: colors.text.muted }]}>
          {day.isFuture
            ? 'Nothing planned for this day.'
            : 'Nothing planned, and nothing logged.'}
        </Text>
      )}

      {/* ── The days that outrank training ─────────────────────── */}
      {/* A race, a competition or a test day comes first and keeps the
          colour. Everything else on the calendar — an ad-hoc warm-up, a
          camp, a rest day — is context and renders after the plan, quietly.
          `session` is a valid event kind, so treating every event as
          important put the accent border on a warm-up while the programmed
          session below it went untagged. */}
      {day.events.filter((e: any) => outranksTraining(eventKind(e.kind)))
        .map((e: any, i: number) => (
          <EventRow key={e.id || `p${i}`} event={e} colors={colors} emphasis />
        ))}

      {/* ── Sessions ───────────────────────────────────────────── */}
      {day.sessions.map((sess) => {
        const k = `${sess.programId}:${sess.index}`
        const busy = busyKey === k
        return (
          <View key={k} style={[s.cardWrap, { borderColor: colors.glass.border, backgroundColor: colors.glass.bg }]}>
            <View style={s.card}>
            <Tappable
              onPress={() => onToggleSession(sess.programId, sess.index)}
              disabled={busy}
              accessibilityLabel={`${sess.label}. ${sess.done ? 'Done. Tap to undo' : 'Tap to mark done'}`}
              style={s.cardRow}
            >
              <SessionTick
                done={sess.done}
                busy={busy}
                accent={colors.accent[500]}
                idle={colors.glass.borderHover}
                muted={colors.text.muted}
              />

              <View style={{ flex: 1, gap: 3 }}>
                <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6 }}>
                  {/* What KIND of session it is, before the label — a gym day
                      and a track day need different kit and a different
                      amount of the afternoon. */}
                  <Ionicons
                    name={TYPE_STYLE[sessionType(sess.type)].icon as any}
                    size={13}
                    color={sess.done ? colors.text.muted : colors.text.secondary}
                  />
                  <Text numberOfLines={2} style={[s.sessLabel, {
                    flex: 1,
                    color: colors.text.primary,
                    textDecorationLine: sess.done ? 'line-through' : 'none',
                    opacity: sess.done ? 0.66 : 1,
                  }]}>
                    {stripWeekday(sess.label)}
                  </Text>
                </View>
                <Text style={[s.sessMeta, { color: colors.text.muted }]}>
                  {TYPE_STYLE[sessionType(sess.type)].label}
                  {/* The programme name is already the banner above this
                      list and the card below it. Three truncated copies of
                      one string is not information — it only earns its
                      place when there is more than one to tell apart. */}
                  {showProgram ? ` · ${sess.programTitle}` : ''}
                  {sess.blocks ? ` · ${sess.blocks} blocks` : ''}
                  {!sess.dayIsCertain ? ' · day suggested' : ''}
                </Text>
              </View>

            </Tappable>

            {/* A sibling of the row, never a child of it: nesting one
                Pressable inside another makes both respond to the same touch,
                and "move this session" and "mark it done" are not a mistake
                you want a stray press to make. */}
            {!!sessionBody && (
              <Tappable
                onPress={() => setOpenSession(openSession === k ? null : k)}
                accessibilityLabel={`${openSession === k ? 'Hide' : 'Show'} the exercises in ${sess.label}`}
                hitSlop={8}
                style={s.move}
              >
                <Ionicons name={openSession === k ? 'chevron-up' : 'chevron-down'}
                  size={16} color={colors.text.muted} />
              </Tappable>
            )}
            {!!onMoveSession && (
              <Tappable
                onPress={() => onMoveSession(sess.programId, sess.index)}
                accessibilityLabel={`Move ${sess.label} to another day`}
                hitSlop={8}
                style={s.move}
              >
                <Ionicons name="calendar-outline" size={16} color={colors.text.muted} />
              </Tappable>
            )}
            </View>

            {openSession === k && !!sessionBody && (
              <SessionBody
                session={sessionBody(sess.programId, sess.index)}
                programId={sess.programId}
                sessionIndex={sess.index}
                onLogExercise={onLogExercise}
                onTrackExercise={onTrackExercise}
                loggedCount={loggedCount}
              />
            )}
          </View>
        )
      })}

      {/* ── What was logged ────────────────────────────────────── */}
      {day.races.length > 0 && (
        <>
          <MonoKicker color={colors.text.muted}>Competed</MonoKicker>
          {day.races.map((r: any, i: number) => (
            <View key={i} style={s.line}>
              <View style={[s.bullet, { backgroundColor: colors.accent[500] }]} />
              <Text style={[s.lineText, { color: colors.text.primary }]} numberOfLines={1}>
                {r.discipline || r.event || 'Race'}
              </Text>
              <Text style={[s.lineValue, { color: colors.text.primary }]}>
                {formatMark(r.mark ?? r.result ?? r.value, r.discipline || r.event)}
              </Text>
            </View>
          ))}
        </>
      )}

      {day.tests.length > 0 && (
        <>
          <MonoKicker color={colors.text.muted}>Tested</MonoKicker>
          {day.tests.map((m: any, i: number) => (
            <View key={i} style={s.line}>
              <View style={[s.bullet, { backgroundColor: 'rgba(255,255,255,0.45)' }]} />
              <Text style={[s.lineText, { color: colors.text.secondary }]} numberOfLines={1}>
                {m.metric_label || m.metric_key}
              </Text>
              <Text style={[s.lineValue, { color: colors.text.primary }]}>
                {fmtMetricValue(m.value)}{m.unit ? ` ${m.unit}` : ''}
              </Text>
            </View>
          ))}
        </>
      )}

      {/* ── How it felt ────────────────────────────────────────── */}
      <Tappable
        onPress={onOpenWellness}
        accessibilityLabel={
          day.checkin
            ? `Check-in: ${day.readiness.label}. Open wellness history`
            : 'No check-in this day. Open wellness history'
        }
        style={[s.checkin, { borderColor: colors.glass.border, backgroundColor: colors.glass.bg }]}
      >
        <View style={[s.readDot, {
          backgroundColor: day.checkin
            ? READINESS_COLORS[day.readiness.level]
            : 'transparent',
          borderWidth: day.checkin ? 0 : 1.2,
          borderColor: 'rgba(255,255,255,0.22)',
        }]} />
        <View style={{ flex: 1 }}>
          {day.checkin ? (
            <>
              <Text style={[s.sessLabel, { color: colors.text.primary }]}>{day.readiness.label}</Text>
              <Text style={[s.sessMeta, { color: colors.text.muted }]}>
                {[
                  day.checkin.sleep_hours != null ? `${day.checkin.sleep_hours}h sleep` : null,
                  day.checkin.soreness != null ? `soreness ${day.checkin.soreness}/5` : null,
                  day.checkin.energy != null ? `energy ${day.checkin.energy}/5` : null,
                  day.checkin.mood != null ? `mood ${day.checkin.mood}/5` : null,
                ].filter(Boolean).join(' · ')}
              </Text>
            </>
          ) : (
            <>
              <Text style={[s.sessLabel, { color: colors.text.secondary }]}>No check-in</Text>
              <Text style={[s.sessMeta, { color: colors.text.muted }]}>
                See the full wellness history
              </Text>
            </>
          )}
        </View>
        <Ionicons name="chevron-forward" size={15} color={colors.text.muted} />
      </Tappable>
    </View>
  )
}

// The exercises inside a session, once it is opened.
//
// Two different actions live here and they are not the same thing:
//   LOG    record the sets you did against what was prescribed.
//   TRACK  file this as a metric on your profile — offered only where the
//          exercise genuinely IS a test the athlete tracks, and never for a
//          submaximal working set that would corrupt a 1RM.
function SessionBody({
  session, programId, sessionIndex, onLogExercise, onTrackExercise, loggedCount,
}: any) {
  const { colors } = useTheme()
  const blocks = Array.isArray(session?.blocks) ? session.blocks : []
  if (!blocks.length) {
    return <Text style={[s.empty, { color: colors.text.muted, paddingHorizontal: 12 }]}>
      No detail stored for this session.
    </Text>
  }

  return (
    <View style={{ paddingHorizontal: 12, paddingBottom: 12, gap: 10 }}>
      {blocks.map((b: any, bi: number) => {
        const type = sessionType(b?.type || session?.type)
        const st = TYPE_STYLE[type]
        const tone = st.tone === 'muted' ? colors.text.muted : (colors as any)[st.tone] || colors.accent[500]
        return (
          <View key={bi}>
            <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6, marginBottom: 6 }}>
              <Ionicons name={st.icon as any} size={12} color={tone} />
              <Text style={[s.blockName, { color: colors.text.secondary }]}>{b?.name || st.label}</Text>
            </View>

            {(Array.isArray(b?.exercises) ? b.exercises : []).map((ex: any, ei: number) => {
              const meta = exerciseMeta(ex, type)
              const n = loggedCount ? loggedCount(programId, sessionIndex, bi, ei) : 0
              const track = onTrackExercise ? metricForExercise(ex?.name, ex?.intensity) : null
              return (
                <View key={ei} style={[s.ex, { borderColor: colors.glass.divider, backgroundColor: colors.bg.primary }]}>
                  <View style={{ flex: 1, gap: 2 }}>
                    <View style={{ flexDirection: 'row', alignItems: 'baseline', gap: 8 }}>
                      <Text style={[s.exName, { color: colors.text.primary }]} numberOfLines={2}>
                        {ex?.name}
                      </Text>
                      {filled(ex?.prescription) && (
                        <Text style={[s.exPrescription, { color: colors.accent[500] }]}>{ex.prescription}</Text>
                      )}
                    </View>
                    {meta.length > 0 && (
                      <Text style={[s.exMeta, { color: colors.text.muted }]}>{meta.join(' · ')}</Text>
                    )}
                    {n > 0 && (
                      <Text style={[s.exLogged, { color: colors.green }]}>
                        {n} set{n === 1 ? '' : 's'} logged
                      </Text>
                    )}
                  </View>

                  <View style={{ gap: 6 }}>
                    {!!onLogExercise && (
                      <Tappable
                        onPress={() => onLogExercise(programId, sessionIndex, bi, ei)}
                        accessibilityLabel={`Record the sets you did for ${ex?.name}`}
                        style={[s.exBtn, {
                          borderColor: n > 0 ? colors.green + '73' : colors.glass.border,
                          backgroundColor: n > 0 ? colors.green + '1F' : 'transparent',
                        }]}
                      >
                        <Ionicons name={n > 0 ? 'checkmark' : 'create-outline'} size={12}
                          color={n > 0 ? colors.green : colors.text.secondary} />
                        <Text style={[s.exBtnText, { color: n > 0 ? colors.green : colors.text.secondary }]}>
                          Sets
                        </Text>
                      </Tappable>
                    )}
                    {!!track && (
                      <Tappable
                        onPress={() => onTrackExercise(track.metricKey, ex)}
                        accessibilityLabel={`Log ${ex?.name} as ${track.label}`}
                        style={[s.exBtn, { borderColor: colors.accent[500] + '73' }]}
                      >
                        <Ionicons name="trending-up" size={12} color={colors.accent[500]} />
                        <Text style={[s.exBtnText, { color: colors.accent[500] }]}>Track</Text>
                      </Tappable>
                    )}
                  </View>
                </View>
              )
            })}
          </View>
        )
      })}
    </View>
  )
}

/** A calendar day. `emphasis` is for the ones that outrank training. */
function EventRow({ event, colors, emphasis }: { event: any; colors: any; emphasis?: boolean }) {
  const st = EVENT_STYLE[eventKind(event.kind)]
  const tone = st.tone === 'muted'
    ? colors.text.muted
    : (colors as any)[st.tone] || colors.accent[500]
  const multi = event.end_date && event.end_date !== event.event_date
  return (
    <View style={[
      s.event,
      emphasis
        ? { borderColor: tone + '59', backgroundColor: tone + '14' }
        : { borderColor: colors.glass.border, backgroundColor: 'transparent' },
    ]}>
      <Ionicons name={st.icon as any} size={16} color={emphasis ? tone : colors.text.dimmed} />
      <View style={{ flex: 1 }}>
        <Text style={[s.sessLabel, {
          color: emphasis ? colors.text.primary : colors.text.secondary,
          fontWeight: emphasis ? weight.bold : weight.medium,
        }]}>
          {event.title}
        </Text>
        <Text style={[s.sessMeta, { color: emphasis ? tone : colors.text.muted }]}>
          {st.l}{multi ? ' · multi-day' : ''}{event.notes ? ` · ${event.notes}` : ''}
        </Text>
      </View>
    </View>
  )
}

const s = StyleSheet.create({
  wrap: { gap: 8 },
  head: { marginBottom: 2 },
  title: { fontSize: typeScale.title, fontWeight: weight.bold, letterSpacing: -0.3 },
  sub: { fontSize: typeScale.label, marginTop: 2, fontWeight: weight.medium },
  empty: { fontSize: typeScale.caption, lineHeight: 19, paddingVertical: 6 },
  cardWrap: { borderRadius: radius.control, borderWidth: 1 },
  card: { flexDirection: 'row', alignItems: 'center', paddingRight: 8 },
  event: {
    flexDirection: 'row', alignItems: 'center', gap: 11,
    borderRadius: radius.control, borderWidth: 1, padding: 12,
  },
  blockName: { fontSize: typeScale.label, fontWeight: weight.bold, letterSpacing: 0.2 },
  ex: {
    flexDirection: 'row', alignItems: 'flex-start', gap: 10,
    borderRadius: radius.chip, borderWidth: 1, padding: 9, marginBottom: 6,
  },
  exName: { fontSize: typeScale.caption, fontWeight: weight.medium, flexShrink: 1 },
  exPrescription: { fontSize: typeScale.caption, fontWeight: weight.bold },
  exMeta: { fontSize: typeScale.label, lineHeight: 15 },
  exLogged: { fontSize: typeScale.label, fontWeight: weight.bold, marginTop: 1 },
  exBtn: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 4,
    minWidth: 62, minHeight: 30, paddingHorizontal: 8,
    borderRadius: radius.chip, borderWidth: 1,
  },
  exBtnText: { fontSize: typeScale.label, fontWeight: weight.bold, letterSpacing: 0.3 },
  cardRow: { flex: 1, flexDirection: 'row', alignItems: 'center', gap: 12, padding: 12 },
  tick: {
    width: 28, height: 28, borderRadius: radius.full, borderWidth: 1.5,
    alignItems: 'center', justifyContent: 'center',
  },
  sessLabel: { fontSize: typeScale.body, fontWeight: weight.medium },
  sessMeta: { fontSize: typeScale.label },
  move: {
    width: 34, height: 34, borderRadius: radius.full,
    alignItems: 'center', justifyContent: 'center',
    backgroundColor: 'rgba(255,255,255,0.06)',
  },
  line: {
    flexDirection: 'row', alignItems: 'center', gap: 9,
    paddingVertical: 9, paddingHorizontal: 2,
    borderBottomWidth: 1, borderBottomColor: 'rgba(255,255,255,0.07)',
  },
  bullet: { width: 5, height: 5, borderRadius: radius.full },
  lineText: { flex: 1, fontSize: typeScale.caption, fontWeight: weight.medium },
  lineValue: { fontSize: typeScale.body, fontWeight: weight.bold, ...numerals },
  checkin: {
    flexDirection: 'row', alignItems: 'center', gap: 12,
    borderRadius: radius.control, borderWidth: 1, padding: 12, marginTop: 6,
  },
  readDot: { width: 12, height: 12, borderRadius: radius.full },
})
