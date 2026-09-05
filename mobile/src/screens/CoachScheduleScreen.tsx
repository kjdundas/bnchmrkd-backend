// ═══════════════════════════════════════════════════════════════════════
// THE COACH'S WEEK — what is on, and who is on it.
//
// The athlete's Programs tab answers "what am I doing". This answers a
// different question: "who is standing in front of me on Tuesday". So the
// unit is not the athlete, it is the session — one card per real session
// with the squad listed on it, rather than the same session repeated once
// per athlete, which is what the table actually holds.
//
// Attendance is the point of the card. A session eight athletes were sent
// and three have accepted is not the same session as one all eight accepted,
// and a coach needs to know that before they turn up with eight lanes set.
// The counts are always visible; the names are one tap away, because most
// days you want the number and some days you want to know exactly who.
// ═══════════════════════════════════════════════════════════════════════

import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { View, Text, Animated, StyleSheet, RefreshControl } from 'react-native'
import { SafeAreaView } from 'react-native-safe-area-context'
import { Ionicons } from '@expo/vector-icons'
import { useNavigation, useRoute } from '@react-navigation/native'
import { useAuth } from '../contexts/AuthContext'
import { useTheme } from '../contexts/ThemeContext'
import { spacing, radius, onImage, typeScale, weight } from '../lib/theme'
import { Tappable, MonoKicker } from '../components/ui'
import ScreenBackdrop, { BACKDROP_GROUND } from '../components/ScreenBackdrop'
import AppHeader from '../components/AppHeader'
import { SkeletonRows, LoadFailed } from '../components/LoadState'
import { newTrouble } from '../lib/loadState'
import { TAB_BAR_CLEARANCE } from '../navigation/FloatingTabBar'
import { tapFeedback } from '../lib/haptics'
import { EVENT_STYLE, eventKind } from '../lib/events'
import {
  fetchSquadAthletes, fetchSquadEvents, groupSquadEvents, eventsByDay,
  type SquadAthlete, type SquadEvent, type Attendee,
} from '../lib/squads'
import {
  mondayOf, todayDay, addDays, weekDays, weekHeading, weekLabel,
  WEEKDAY_LETTER, dayLabel,
} from '../lib/schedule'

/** How an answer reads on a name. Absent approval was normalised to accepted. */
const STATE: Record<string, { label: string; tone: string; icon: string }> = {
  accepted: { label: 'Going', tone: '#34D399', icon: 'checkmark-circle' },
  pending: { label: 'Waiting', tone: '#F59E0B', icon: 'time-outline' },
  declined: { label: 'Out', tone: '#FF6B6B', icon: 'close-circle' },
}

export default function CoachScheduleScreen() {
  const { user } = useAuth()
  const { colors } = useTheme()
  const navigation = useNavigation<any>()
  const route = useRoute<any>()
  const scrollY = useRef(new Animated.Value(0)).current

  const [athletes, setAthletes] = useState<SquadAthlete[]>([])
  const [rows, setRows] = useState<Map<string, any[]>>(new Map())
  const [weekStart, setWeekStart] = useState(() => mondayOf(todayDay()))
  const [selected, setSelected] = useState(() => todayDay())
  const [open, setOpen] = useState<string | null>(null)
  const [refreshing, setRefreshing] = useState(false)
  const [loading, setLoading] = useState(true)
  const [failed, setFailed] = useState(false)

  const days = useMemo(() => weekDays(weekStart), [weekStart])

  // Arriving from "See it on Tuesday" after assigning something. Move the
  // week AND the selection, or the coach lands on the right week with the
  // wrong day open and has to hunt for the thing they just created.
  useEffect(() => {
    const day = route.params?.day
    if (!day) return
    setWeekStart(mondayOf(day))
    setSelected(day)
    setOpen(null)
    // Cleared so stepping away and back does not yank the view to a date the
    // coach has since navigated away from.
    navigation.setParams({ day: undefined })
  }, [route.params?.day, navigation])

  const load = useCallback(async () => {
    const t = newTrouble()
    const ath = await fetchSquadAthletes(t)
    setAthletes(ath)
    // A generous window either side, so stepping a week does not refetch and
    // the day pills can show a count for a week you have not opened yet.
    setRows(await fetchSquadEvents(ath, addDays(weekStart, -14), addDays(weekStart, 20), t))
    setFailed(t.failed)
    setLoading(false)
  }, [user, weekStart])

  useEffect(() => { load() }, [load])
  useEffect(() => navigation.addListener('focus', load), [navigation, load])

  const week = useMemo(
    () => groupSquadEvents(athletes, rows), [athletes, rows])
  const byDay = useMemo(() => eventsByDay(week), [week])
  const shown = byDay.get(selected) || []

  // Stepping a week has to move the selection too, or the strip highlights a
  // day that is no longer on it and the list below shows the old day's work.
  const step = (n: number) => {
    const next = addDays(weekStart, n * 7)
    setWeekStart(next)
    const today = todayDay()
    setSelected(weekDays(next).includes(today) ? today : next)
    setOpen(null)
  }
  const backToToday = () => {
    setWeekStart(mondayOf(todayDay()))
    setSelected(todayDay())
    setOpen(null)
  }

  const isCurrentWeek = weekStart === mondayOf(todayDay())
  const total = week.filter((e) => days.includes(e.day)).length
  const waiting = week
    .filter((e) => days.includes(e.day))
    .reduce((n, e) => n + e.pending, 0)

  return (
    <View style={{ flex: 1, backgroundColor: BACKDROP_GROUND }}>
      <ScreenBackdrop image="stadium" scrollY={scrollY} />
      <SafeAreaView style={{ flex: 1 }} edges={['top', 'left', 'right']}>
        <AppHeader onImage />
        <Animated.ScrollView
          style={{ backgroundColor: 'transparent' }}
          contentContainerStyle={{ paddingBottom: TAB_BAR_CLEARANCE }}
          showsVerticalScrollIndicator={false}
          scrollEventThrottle={16}
          onScroll={Animated.event(
            [{ nativeEvent: { contentOffset: { y: scrollY } } }],
            { useNativeDriver: true })}
          refreshControl={
            <RefreshControl
              refreshing={refreshing} tintColor={colors.accent[500]}
              onRefresh={async () => { setRefreshing(true); await load(); setRefreshing(false) }} />
          }
        >
          <View style={{ paddingHorizontal: spacing.lg, marginBottom: 4 }}>
            <MonoKicker color={onImage.muted}>
              {total === 0 ? 'Nothing on this week'
                : `${total} ${total === 1 ? 'session' : 'sessions'} this week`}
            </MonoKicker>
            <Text style={s.h1}>Schedule</Text>
          </View>

          {/* ── The week ─────────────────────────────────────────── */}
          <View style={s.nav}>
            <Tappable onPress={() => { tapFeedback(); step(-1) }}
              accessibilityLabel="Previous week" hitSlop={10} style={s.arrow}>
              <Ionicons name="chevron-back" size={17} color={onImage.muted} />
            </Tappable>

            <Tappable onPress={() => { tapFeedback(); backToToday() }}
              accessibilityLabel={isCurrentWeek ? weekHeading(weekStart)
                : `${weekHeading(weekStart)}. Jump back to this week`}
              style={{ flex: 1, alignItems: 'center' }}>
              <Text style={s.heading}>{weekHeading(weekStart)}</Text>
              {isCurrentWeek
                ? <Text style={s.range}>{weekLabel(weekStart)}</Text>
                : <Text style={[s.range, { color: colors.accent[500] }]}>Back to this week</Text>}
            </Tappable>

            <Tappable onPress={() => { tapFeedback(); step(1) }}
              accessibilityLabel="Next week" hitSlop={10} style={s.arrow}>
              <Ionicons name="chevron-forward" size={17} color={onImage.muted} />
            </Tappable>
          </View>

          <View style={s.strip}>
            {days.map((d, i) => {
              const on = d === selected
              const isToday = d === todayDay()
              const list = byDay.get(d) || []
              // One dot per session, capped at three. A row of eleven dots is
              // not more information than "busy", it is just a longer row.
              const dots = Math.min(list.length, 3)
              const anyWaiting = list.some((e) => e.pending > 0)
              return (
                <Tappable key={d}
                  onPress={() => { tapFeedback(); setSelected(d); setOpen(null) }}
                  accessibilityLabel={`${dayLabel(d)}, ${list.length} ${list.length === 1 ? 'session' : 'sessions'}`}
                  accessibilityState={{ selected: on }}
                  style={[s.day, {
                    borderColor: on ? colors.accent[500] + '8C' : onImage.chipEdge,
                    backgroundColor: on ? colors.accent[500] + '2E' : onImage.chipPlate,
                  }]}>
                  <Text style={[s.dayLetter, on && { color: '#FFFFFF' }]}>
                    {WEEKDAY_LETTER[i]}
                  </Text>
                  <Text style={[s.dayNum, on && { color: '#FFFFFF' },
                    isToday && !on && { color: colors.accent[500] }]}>
                    {Number(d.slice(8, 10))}
                  </Text>
                  <View style={s.dots}>
                    {Array.from({ length: dots }).map((_, k) => (
                      <View key={k} style={[s.dot, {
                        backgroundColor: anyWaiting && k === 0
                          ? '#F59E0B' : on ? '#FFFFFF' : onImage.dim,
                      }]} />
                    ))}
                  </View>
                </Tappable>
              )
            })}
          </View>

          {waiting > 0 && (
            <Text style={s.waiting}>
              {waiting} {waiting === 1 ? 'athlete has' : 'athletes have'} not answered yet this week.
            </Text>
          )}

          {/* ── The selected day ─────────────────────────────────── */}
          <View style={{ paddingHorizontal: spacing.lg, marginTop: 20, marginBottom: 4 }}>
            <Text style={s.dayHead}>{dayLabel(selected)}</Text>
          </View>

          {!loading && !failed && shown.map((e) => (
            <SessionCard
              key={e.key} e={e}
              expanded={open === e.key}
              // No LayoutAnimation: it is deprecated under the New
              // Architecture this app runs on, where it can silently do
              // nothing. A card that expands instantly beats one that
              // animates on some builds and not others.
              onToggle={() => { tapFeedback(); setOpen((k) => (k === e.key ? null : e.key)) }}
              onAthlete={(a) => navigation.navigate('AthleteDetail', {
                athlete: {
                  id: a.roster_athlete_id, linked_user_id: a.athlete_user_id,
                  name: a.name, dob: a.dob, gender: a.gender, discipline: a.discipline,
                },
              })}
            />
          ))}

          {loading && <View style={{ marginTop: 14 }}><SkeletonRows rows={2} height={70} /></View>}

          {!loading && failed && <LoadFailed />}

          {!loading && !failed && shown.length === 0 && (
            <View style={s.empty}>
              <Ionicons name="calendar-outline" size={28} color={onImage.muted} />
              <Text style={s.emptyTitle}>Nothing on this day</Text>
              <Text style={s.emptyBody}>
                {athletes.length === 0
                  ? 'Add athletes first, then anything you assign them appears here.'
                  : 'Assign a session, a race or a test day and everyone you send it to lands here.'}
              </Text>
              {athletes.length > 0 && (
                <Tappable
                  onPress={() => { tapFeedback(); navigation.navigate('Assign', { day: selected }) }}
                  accessibilityLabel={`Assign something on ${dayLabel(selected)}`}
                  style={[s.cta, { borderColor: colors.accent[500] + '8C',
                    backgroundColor: colors.accent[500] + '2E' }]}>
                  <Ionicons name="add" size={15} color="#FFFFFF" />
                  <Text style={s.ctaText}>Assign something</Text>
                </Tappable>
              )}
            </View>
          )}
        </Animated.ScrollView>
      </SafeAreaView>
    </View>
  )
}

// ── One session, and who is on it ──────────────────────────────────────
function SessionCard({
  e, expanded, onToggle, onAthlete,
}: {
  e: SquadEvent
  expanded: boolean
  onToggle: () => void
  onAthlete: (a: SquadAthlete) => void
}) {
  const { colors } = useTheme()
  const style = EVENT_STYLE[eventKind(e.kind)]
  const n = e.attendees.length

  return (
    <View style={s.card}>
      <Tappable onPress={onToggle}
        accessibilityLabel={`${e.title}, ${n} ${n === 1 ? 'athlete' : 'athletes'}`}
        accessibilityState={{ expanded }}
        style={s.cardHead}>
        <View style={[s.icon, { borderColor: colors.accent[500] + '59' }]}>
          <Ionicons name={style.icon as any} size={15} color={colors.accent[500]} />
        </View>
        <View style={{ flex: 1 }}>
          <Text style={s.cardTitle} numberOfLines={1}>{e.title}</Text>
          <View style={s.counts}>
            <Text style={s.count}>{n} {n === 1 ? 'athlete' : 'athletes'}</Text>
            {/* Only states that actually occur are named. "0 out" is noise on
                every card that has nobody out, which is most of them. */}
            {e.accepted > 0 && <Pip tone={STATE.accepted.tone} text={`${e.accepted} going`} />}
            {e.pending > 0 && <Pip tone={STATE.pending.tone} text={`${e.pending} waiting`} />}
            {e.declined > 0 && <Pip tone={STATE.declined.tone} text={`${e.declined} out`} />}
          </View>
        </View>
        <Ionicons name={expanded ? 'chevron-up' : 'chevron-down'} size={16} color={onImage.dim} />
      </Tappable>

      {expanded && (
        <View style={s.names}>
          {/* What the session actually was. Above the attendees, because a
              coach opening a card on the track wants the work first and the
              register second. */}
          {e.lines.length > 0 && (
            <View style={s.session}>
              {e.lines.map((l, i) => (
                <View key={i} style={s.lineRow}>
                  <Text style={s.lineNum}>{i + 1}</Text>
                  <Text style={s.lineText}>{l}</Text>
                </View>
              ))}
            </View>
          )}

          {!!e.notes && <Text style={s.notes}>{e.notes}</Text>}

          {e.lines.length === 0 && !e.notes && e.kind === 'session' && (
            <Text style={s.noPlan}>
              No detail was written for this session — only a title.
            </Text>
          )}
          {/* The register, separated from the work. Without a break the
              names read as one more line of the session. */}
          {(e.lines.length > 0 || !!e.notes) && (
            <View style={s.registerHead}>
              <MonoKicker color={onImage.dim}>Who's on it</MonoKicker>
            </View>
          )}

          {e.attendees.map((a: Attendee) => {
            const st = STATE[a.approval] || STATE.accepted
            return (
              <Tappable key={a.eventId}
                onPress={() => { tapFeedback(); onAthlete(a.athlete) }}
                accessibilityLabel={`${a.athlete.name}, ${st.label}`}
                style={s.name}>
                <Ionicons name={st.icon as any} size={14} color={st.tone} />
                <Text style={s.nameText} numberOfLines={1}>{a.athlete.name}</Text>
                {!a.athlete.athlete_user_id && (
                  <Text style={s.noAccount}>no account</Text>
                )}
                <Text style={[s.stateText, { color: st.tone }]}>{st.label}</Text>
              </Tappable>
            )
          })}
        </View>
      )}
    </View>
  )
}

function Pip({ tone, text }: { tone: string; text: string }) {
  return (
    <View style={[s.pip, { borderColor: tone + '59', backgroundColor: tone + '1A' }]}>
      <Text style={[s.pipText, { color: tone }]}>{text}</Text>
    </View>
  )
}

const s = StyleSheet.create({
  h1: { fontSize: typeScale.hero, fontWeight: weight.bold, letterSpacing: -0.9, color: onImage.ink },

  nav: {
    flexDirection: 'row', alignItems: 'center',
    paddingHorizontal: spacing.lg, marginTop: 14, gap: 8,
  },
  arrow: {
    width: 34, height: 34, borderRadius: radius.full, borderWidth: 1,
    borderColor: onImage.chipEdge, backgroundColor: onImage.chipPlate,
    alignItems: 'center', justifyContent: 'center',
  },
  heading: { color: onImage.ink, fontSize: typeScale.body, fontWeight: weight.bold, letterSpacing: -0.2 },
  range: { color: onImage.muted, fontSize: typeScale.label, marginTop: 1 },

  strip: { flexDirection: 'row', gap: 6, paddingHorizontal: spacing.lg, marginTop: 14 },
  day: {
    flex: 1, minHeight: 62, borderRadius: radius.card, borderWidth: 1,
    alignItems: 'center', justifyContent: 'center', paddingVertical: 7, gap: 1,
  },
  dayLetter: { color: onImage.dim, fontSize: typeScale.label, fontWeight: weight.bold, letterSpacing: 0.6 },
  dayNum: {
    color: onImage.muted, fontSize: typeScale.body, fontWeight: weight.bold,
    fontVariant: ['tabular-nums'],
  },
  dots: { flexDirection: 'row', gap: 3, height: 5, alignItems: 'center' },
  dot: { width: 4, height: 4, borderRadius: radius.full },

  waiting: {
    color: '#F59E0B', fontSize: typeScale.caption, fontWeight: weight.medium,
    paddingHorizontal: spacing.lg, marginTop: 12,
  },
  dayHead: { color: onImage.ink, fontSize: typeScale.title, fontWeight: weight.bold, letterSpacing: -0.3 },

  card: {
    marginHorizontal: spacing.lg, marginTop: 10,
    borderRadius: radius.card, borderWidth: 1,
    borderColor: onImage.cardBorder, backgroundColor: onImage.card,
    overflow: 'hidden',
  },
  cardHead: { flexDirection: 'row', alignItems: 'center', gap: 12, padding: 13 },
  icon: {
    width: 32, height: 32, borderRadius: radius.chip, borderWidth: 1,
    alignItems: 'center', justifyContent: 'center',
  },
  cardTitle: { color: onImage.ink, fontSize: typeScale.body, fontWeight: weight.bold, letterSpacing: -0.2 },
  counts: { flexDirection: 'row', alignItems: 'center', gap: 6, marginTop: 4, flexWrap: 'wrap' },
  count: { color: onImage.muted, fontSize: typeScale.label },
  pip: { paddingHorizontal: 6, paddingVertical: 2, borderRadius: radius.hair, borderWidth: 1 },
  pipText: { fontSize: typeScale.label, fontWeight: weight.bold, letterSpacing: 0.2 },

  names: {
    borderTopWidth: 1, borderTopColor: onImage.divider,
    paddingHorizontal: 13, paddingVertical: 6,
  },
  notes: {
    color: onImage.muted, fontSize: typeScale.caption, lineHeight: 18,
    paddingVertical: 8,
  },
  session: { paddingTop: 10, paddingBottom: 4 },
  registerHead: {
    marginTop: 4, paddingTop: 10,
    borderTopWidth: 1, borderTopColor: onImage.divider,
  },
  lineRow: { flexDirection: 'row', gap: 10, alignItems: 'flex-start', marginBottom: 7 },
  lineNum: {
    color: onImage.dim, fontSize: typeScale.label, fontWeight: weight.bold, minWidth: 13,
    fontVariant: ['tabular-nums'], marginTop: 1.5,
  },
  lineText: { flex: 1, color: onImage.ink, fontSize: typeScale.body, lineHeight: 20, fontWeight: weight.medium },
  noPlan: {
    color: onImage.dim, fontSize: typeScale.caption, lineHeight: 18,
    paddingVertical: 10, fontStyle: 'italic',
  },
  name: { flexDirection: 'row', alignItems: 'center', gap: 9, minHeight: 40 },
  nameText: { color: onImage.ink, fontSize: typeScale.body, fontWeight: weight.medium, flexShrink: 1 },
  noAccount: { color: onImage.dim, fontSize: typeScale.label },
  stateText: { marginLeft: 'auto', fontSize: typeScale.label, fontWeight: weight.bold },

  empty: { paddingHorizontal: spacing.lg, paddingTop: 26, alignItems: 'center' },
  emptyTitle: { color: onImage.ink, fontSize: typeScale.body, fontWeight: weight.bold, marginTop: 10 },
  emptyBody: {
    color: onImage.muted, fontSize: typeScale.caption, lineHeight: 19, textAlign: 'center',
    marginTop: 5, maxWidth: 300,
  },
  cta: {
    flexDirection: 'row', alignItems: 'center', gap: 6,
    minHeight: 40, paddingHorizontal: 15, marginTop: 14,
    borderRadius: radius.full, borderWidth: 1,
  },
  ctaText: { color: '#FFFFFF', fontSize: typeScale.caption, fontWeight: weight.bold },
})
