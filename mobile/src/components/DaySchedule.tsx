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
import { radius, numerals } from '../lib/theme'
import { READINESS_COLORS } from '../lib/readiness'
import { dayLabel, type DayCell } from '../lib/schedule'
import { sessionType, TYPE_STYLE, exerciseMeta, filled } from '../lib/sessionTypes'
import { EVENT_STYLE, eventKind } from '../lib/events'
import { metricForExercise } from '../lib/exerciseMetrics'
import { fmtMetricValue, formatMark } from '../lib/metricSemantics'

export default function DaySchedule({
  day, onToggleSession, busyKey, onOpenWellness, onMoveSession,
  sessionBody, onLogExercise, onTrackExercise, loggedCount,
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

      {/* ── Events ─────────────────────────────────────────────── */}
      {day.events.map((e: any, i: number) => {
        const k = eventKind(e.kind)
        const st = EVENT_STYLE[k]
        const tone = st.tone === 'muted' ? colors.text.muted : (colors as any)[st.tone] || colors.accent[500]
        return (
          <View key={e.id || i} style={[s.event, { borderColor: tone + '59', backgroundColor: tone + '14' }]}>
            <Ionicons name={st.icon as any} size={16} color={tone} />
            <View style={{ flex: 1 }}>
              <Text style={[s.sessLabel, { color: colors.text.primary }]}>{e.title}</Text>
              <Text style={[s.sessMeta, { color: tone }]}>
                {st.l}{e.end_date && e.end_date !== e.event_date ? ' · multi-day' : ''}
                {e.notes ? ` · ${e.notes}` : ''}
              </Text>
            </View>
          </View>
        )
      })}

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
              <View style={[
                s.tick,
                sess.done
                  ? { backgroundColor: colors.accent[500], borderColor: colors.accent[500] }
                  : { borderColor: colors.glass.borderHover },
              ]}>
                {busy
                  ? <ActivityIndicator size="small" color={sess.done ? '#fff' : colors.text.muted} />
                  : sess.done
                    ? <Ionicons name="checkmark" size={16} color="#fff" />
                    : null}
              </View>

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
                    {sess.label}
                  </Text>
                </View>
                <Text style={[s.sessMeta, { color: colors.text.muted }]}>
                  {TYPE_STYLE[sessionType(sess.type)].label}
                  {` · ${sess.programTitle}`}
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

const s = StyleSheet.create({
  wrap: { gap: 8 },
  head: { marginBottom: 2 },
  title: { fontSize: 19, fontWeight: '700', letterSpacing: -0.3 },
  sub: { fontSize: 11.5, marginTop: 2, fontWeight: '600' },
  empty: { fontSize: 13, lineHeight: 19, paddingVertical: 6 },
  cardWrap: { borderRadius: radius.md, borderWidth: 1 },
  card: { flexDirection: 'row', alignItems: 'center', paddingRight: 8 },
  event: {
    flexDirection: 'row', alignItems: 'center', gap: 11,
    borderRadius: radius.md, borderWidth: 1, padding: 12,
  },
  blockName: { fontSize: 11, fontWeight: '700', letterSpacing: 0.2 },
  ex: {
    flexDirection: 'row', alignItems: 'flex-start', gap: 10,
    borderRadius: radius.sm, borderWidth: 1, padding: 9, marginBottom: 6,
  },
  exName: { fontSize: 13, fontWeight: '600', flexShrink: 1 },
  exPrescription: { fontSize: 12.5, fontWeight: '700' },
  exMeta: { fontSize: 10.5, lineHeight: 15 },
  exLogged: { fontSize: 10.5, fontWeight: '700', marginTop: 1 },
  exBtn: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 4,
    minWidth: 62, minHeight: 30, paddingHorizontal: 8,
    borderRadius: radius.sm, borderWidth: 1,
  },
  exBtnText: { fontSize: 10.5, fontWeight: '800', letterSpacing: 0.3 },
  cardRow: { flex: 1, flexDirection: 'row', alignItems: 'center', gap: 12, padding: 12 },
  tick: {
    width: 28, height: 28, borderRadius: 14, borderWidth: 1.5,
    alignItems: 'center', justifyContent: 'center',
  },
  sessLabel: { fontSize: 14.5, fontWeight: '600' },
  sessMeta: { fontSize: 11.5 },
  move: {
    width: 34, height: 34, borderRadius: 17,
    alignItems: 'center', justifyContent: 'center',
    backgroundColor: 'rgba(255,255,255,0.06)',
  },
  line: {
    flexDirection: 'row', alignItems: 'center', gap: 9,
    paddingVertical: 9, paddingHorizontal: 2,
    borderBottomWidth: 1, borderBottomColor: 'rgba(255,255,255,0.07)',
  },
  bullet: { width: 5, height: 5, borderRadius: 2.5 },
  lineText: { flex: 1, fontSize: 13.5, fontWeight: '500' },
  lineValue: { fontSize: 14, fontWeight: '700', ...numerals },
  checkin: {
    flexDirection: 'row', alignItems: 'center', gap: 12,
    borderRadius: radius.md, borderWidth: 1, padding: 12, marginTop: 6,
  },
  readDot: { width: 12, height: 12, borderRadius: 6 },
})
