// ═══════════════════════════════════════════════════════════════════════
// ASSIGN — make the thing, then choose who gets it.
//
// The order is deliberate and it is the coach's own: you decide there is a
// county championships before you decide which of your athletes are going to
// it. Every coach action in this app takes this shape, so the screen is
// built to be extended — programs and results slot in beside events as a
// third and fourth "what", with the same "who" underneath.
//
// Each athlete gets their OWN row rather than one shared event with a
// membership list. A race day one athlete accepts and another declines is
// two different facts, and approval lives on the row. It also means an
// athlete who later leaves the squad keeps what was already in their
// calendar.
// ═══════════════════════════════════════════════════════════════════════

import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import {
  View, Text, Animated, TextInput, StyleSheet, ActivityIndicator,
} from 'react-native'
import { SafeAreaView } from 'react-native-safe-area-context'
import { Ionicons } from '@expo/vector-icons'
import { useNavigation, useRoute } from '@react-navigation/native'
import { useAuth } from '../contexts/AuthContext'
import { useTheme } from '../contexts/ThemeContext'
import { spacing, radius, onImage } from '../lib/theme'
import { Tappable, MonoKicker } from './../components/ui'
import ScreenBackdrop, { BACKDROP_GROUND } from '../components/ScreenBackdrop'
import AppHeader from '../components/AppHeader'
import { TAB_BAR_CLEARANCE } from '../navigation/FloatingTabBar'
import SquadSwitcher, { type SquadFilter } from '../components/SquadSwitcher'
import {
  fetchSquads, fetchSquadAthletes, squadCounts, inSquad, keyOf,
  type Squad, type SquadAthlete,
} from '../lib/squads'
import { EVENT_KINDS, type EventKind, createEventForMany, type EventSubject } from '../lib/events'
import type { SquadAthlete } from '../lib/squads'
import { todayDay, addDays, dayLabel } from '../lib/schedule'
import { recordResultForMany } from '../lib/athleteResults'
import { RESULT_STATUSES } from '../lib/resultSemantics'
import { eventsOf, subjectFor } from '../lib/squads'
import { sessionConcerns, concernSummary } from '../lib/sessionSafety'
import { tapFeedback } from '../lib/haptics'

const ISO = /^\d{4}-\d{2}-\d{2}$/

/** What you are creating. The "who" underneath is the same for all of them. */
type What = 'session' | 'event' | 'result' | 'program'
const WHATS: { v: What; l: string; icon: string }[] = [
  { v: 'session', l: 'Session', icon: 'barbell-outline' },
  { v: 'event', l: 'Calendar', icon: 'calendar-outline' },
  { v: 'result', l: 'Result', icon: 'stopwatch-outline' },
  { v: 'program', l: 'Block', icon: 'layers-outline' },
]

export default function CoachAssignScreen() {
  const { user } = useAuth()
  const { colors } = useTheme()
  const navigation = useNavigation<any>()
  const route = useRoute<any>()
  const scrollY = useRef(new Animated.Value(0)).current
  // The assistant's call-to-actions land here with the job already chosen.
  const [what, setWhat] = useState<What>(route.params?.what || 'event')
  useEffect(() => {
    if (route.params?.what) setWhat(route.params.what)
  }, [route.params?.what])

  const [squads, setSquads] = useState<Squad[]>([])
  const [athletes, setAthletes] = useState<SquadAthlete[]>([])
  const [filter, setFilter] = useState<SquadFilter>(null)
  const [picked, setPicked] = useState<Set<string>>(new Set())

  const [kind, setKind] = useState<EventKind>('race')
  const [title, setTitle] = useState('')
  const [date, setDate] = useState(todayDay())
  const [notes, setNotes] = useState('')
  // Result fields
  // Session: the lines a coach writes, one per row.
  const [lines, setLines] = useState('')
  const [event, setEvent] = useState('')
  const [mark, setMark] = useState('')
  const [wind, setWind] = useState('')
  const [status, setStatus] = useState('OK')

  const [sending, setSending] = useState(false)
  const [error, setError] = useState('')
  const [done, setDone] = useState<{ ok: number; failed: number } | null>(null)

  const load = useCallback(async () => {
    const [sq, ath] = await Promise.all([fetchSquads(user?.id || ''), fetchSquadAthletes()])
    setSquads(sq); setAthletes(ath)
  }, [user])

  useEffect(() => { load() }, [load])
  useEffect(() => navigation.addListener('focus', load), [navigation, load])

  const counts = useMemo(() => squadCounts(athletes), [athletes])
  const shown = useMemo(() => (
    filter === 'unassigned'
      ? [...athletes].filter((a) => !a.squad_id).sort((x, y) => x.name.localeCompare(y.name))
      : inSquad(athletes, filter as string | null)
  ), [athletes, filter])

  const toggle = (a: SquadAthlete) => {
    tapFeedback()
    setDone(null)
    setPicked((prev) => {
      const next = new Set(prev)
      const k = keyOf(a)
      next.has(k) ? next.delete(k) : next.add(k)
      return next
    })
  }

  // Selecting a whole squad is the common case — a coach assigns to a group
  // far more often than to one person — so it is one tap, not six.
  const allShownPicked = shown.length > 0 && shown.every((a) => picked.has(keyOf(a)))
  const toggleAllShown = () => {
    tapFeedback()
    setDone(null)
    setPicked((prev) => {
      const next = new Set(prev)
      for (const a of shown) allShownPicked ? next.delete(keyOf(a)) : next.add(keyOf(a))
      return next
    })
  }

  const chosen = useMemo(
    () => athletes.filter((a) => picked.has(keyOf(a))), [athletes, picked])

  // The same session is not equally right for every body in front of it. This
  // does not block — a coach may have a reason — it names who to check.
  const concerns = useMemo(
    () => (what === 'session' ? sessionConcerns(`${title}\n${lines}`, chosen) : []),
    [what, title, lines, chosen])

  /** Events take their own subject shape; results take the squads one. */
  const subjectFor2 = (a: SquadAthlete): EventSubject =>
    a.athlete_user_id ? { athleteId: a.athlete_user_id } : { rosterId: a.roster_athlete_id as string }

  const send = async () => {
    if (!ISO.test(date)) { setError('Date needs to be YYYY-MM-DD.'); return }
    if (!chosen.length) { setError('Choose at least one athlete.'); return }

    if (what === 'session') {
      const t = title.trim()
      if (!t) { setError('Give the session a name — “Speed + gym”, “Tempo 6×200”.'); return }
      if (!lines.trim()) { setError('What is in it? One line per piece of work.'); return }
      setError(''); setSending(true); setDone(null)
      try {
        const res = await createEventForMany(chosen.map(subjectFor2), {
          createdBy: user?.id || '', date, endDate: null, kind: 'session', title: t,
          notes: notes.trim() || null,
          structure: {
            // Stored as written, one line per piece of work. A coach's own
            // shorthand is the most accurate record of what they meant.
            lines: lines.split('\n').map((l) => l.trim()).filter(Boolean),
          },
        })
        setDone({ ok: res.ok, failed: res.failed.length })
        if (res.failed.length) setError(`${res.failed.length} didn't send — ${res.failed[0].message}`)
        else { setTitle(''); setLines(''); setNotes(''); setPicked(new Set()) }
      } catch (e: any) {
        setError(e?.message?.replace(/^Supabase \d+:\s*/, '') || 'Could not send that.')
      } finally { setSending(false) }
      return
    }

    if (what === 'result') {
      const ev = event.trim()
      if (!ev) { setError('Which event was it?'); return }
      const m = mark.trim() === '' ? null : Number(mark.trim())
      // A DNF or DQ legitimately has no mark; anything else needs one.
      if (status === 'OK' && (m == null || !Number.isFinite(m))) {
        setError('Give the mark, or set the status to DNF / DQ.'); return
      }
      const w = wind.trim() === '' ? null : Number(wind.trim())
      if (wind.trim() !== '' && !Number.isFinite(w as number)) {
        setError('Wind should be a number like 1.4 or -0.6, or left empty.'); return
      }
      setError(''); setSending(true); setDone(null)
      try {
        const res = await recordResultForMany(chosen.map(subjectFor), {
          discipline: ev,
          mark: status === 'OK' ? (m as number) : null,
          competitionDate: date,
          competitionName: title.trim() || null,
          wind: w,
          status,
          sex: chosen[0]?.gender === 'F' ? 'F' : 'M',
        })
        setDone({ ok: res.ok, failed: res.failed.length })
        if (res.failed.length) setError(`${res.failed.length} didn't save — ${res.failed[0].message}`)
        else { setMark(''); setWind(''); setTitle(''); setPicked(new Set()) }
      } catch (e: any) {
        setError(e?.message?.replace(/^Supabase \d+:\s*/, '') || 'Could not save that.')
      } finally { setSending(false) }
      return
    }

    const t = title.trim()
    if (!t) { setError('Give it a name — “County Champs”, “6×30m testing”.'); return }
    setError(''); setSending(true); setDone(null)
    try {
      const subjects: EventSubject[] = chosen.map((a) =>
        a.athlete_user_id ? { athleteId: a.athlete_user_id } : { rosterId: a.roster_athlete_id as string })
      const res = await createEventForMany(subjects, {
        createdBy: user?.id || '', date, endDate: null, kind, title: t,
        notes: notes.trim() || null,
      })
      setDone({ ok: res.ok, failed: res.failed.length })
      if (res.failed.length) {
        // Name the first failure rather than a count: "2 failed" tells a
        // coach nothing they can act on.
        setError(`${res.failed.length} didn't send — ${res.failed[0].message}`)
      } else {
        setTitle(''); setNotes(''); setPicked(new Set())
      }
    } catch (e: any) {
      setError(e?.message?.replace(/^Supabase \d+:\s*/, '') || 'Could not send that.')
    } finally {
      setSending(false)
    }
  }

  const input = {
    backgroundColor: 'rgba(255,255,255,0.08)', borderWidth: 1,
    borderColor: onImage.cardBorder, borderRadius: radius.md,
    paddingHorizontal: 12, minHeight: 48, fontSize: 15, color: onImage.ink,
  }

  return (
    <View style={{ flex: 1, backgroundColor: BACKDROP_GROUND }}>
      <ScreenBackdrop image="gym" scrollY={scrollY} />
      <SafeAreaView style={{ flex: 1 }} edges={['top', 'left', 'right']}>
        <AppHeader onImage />
        <Animated.ScrollView
          style={{ backgroundColor: 'transparent' }}
          contentContainerStyle={{ paddingBottom: TAB_BAR_CLEARANCE }}
          showsVerticalScrollIndicator={false}
          keyboardShouldPersistTaps="handled"
          scrollEventThrottle={16}
          onScroll={Animated.event(
            [{ nativeEvent: { contentOffset: { y: scrollY } } }],
            { useNativeDriver: true },
          )}
        >
          <View style={{ paddingHorizontal: spacing.lg, marginBottom: 18 }}>
            <MonoKicker color={onImage.muted}>Create, then choose who</MonoKicker>
            <Text style={s.h1}>Assign</Text>
          </View>

          {/* ── 1. What ───────────────────────────────────────────── */}
          <View style={{ paddingHorizontal: spacing.lg }}>
            <View style={s.whats}>
              {WHATS.map((w) => {
                const on = what === w.v
                return (
                  <Tappable key={w.v}
                    onPress={() => { tapFeedback(); setWhat(w.v); setDone(null); setError('') }}
                    accessibilityLabel={w.l} accessibilityState={{ selected: on }}
                    style={[s.what, {
                      borderColor: on ? colors.accent[500] + '8C' : onImage.cardBorder,
                      backgroundColor: on ? colors.accent[500] + '2E' : onImage.card,
                    }]}>
                    <Ionicons name={w.icon as any} size={15}
                      color={on ? colors.accent[500] : onImage.muted} />
                    <Text style={[s.whatText, { color: on ? '#FFFFFF' : onImage.muted }]}>{w.l}</Text>
                  </Tappable>
                )
              })}
            </View>
          </View>

          {what === 'session' ? (
            <View style={{ paddingHorizontal: spacing.lg }}>
              <Text style={s.label}>Call it something</Text>
              <TextInput style={input as any} value={title} onChangeText={setTitle}
                placeholder="e.g. Speed + gym, Tempo 6×200"
                placeholderTextColor="rgba(255,255,255,0.38)" keyboardAppearance="dark" maxLength={120} />

              <Text style={s.label}>What's in it? One line per piece of work.</Text>
              <TextInput
                style={[input, { minHeight: 150, paddingTop: 12, textAlignVertical: 'top' }] as any}
                value={lines} onChangeText={setLines} multiline maxLength={2000}
                placeholder={'Warm-up 15 min\n6×200m off 3 min @ 85%\nBack squat 4×4 @ 82%\nCool-down'}
                placeholderTextColor="rgba(255,255,255,0.38)" keyboardAppearance="dark" />

              <Text style={s.label}>Date · {ISO.test(date) ? dayLabel(date) : 'YYYY-MM-DD'}</Text>
              <View style={{ flexDirection: 'row', gap: 8, alignItems: 'center' }}>
                <TextInput style={[input, { flex: 1 }] as any} value={date} onChangeText={setDate}
                  placeholder="YYYY-MM-DD" placeholderTextColor="rgba(255,255,255,0.38)"
                  keyboardType="numbers-and-punctuation" keyboardAppearance="dark" />
                <Tappable onPress={() => { tapFeedback(); setDate(todayDay()) }}
                  accessibilityLabel="Today" style={s.mini}>
                  <Text style={s.miniText}>Today</Text>
                </Tappable>
                <Tappable onPress={() => { tapFeedback(); setDate(addDays(date, 1)) }}
                  accessibilityLabel="Tomorrow" style={s.mini}>
                  <Text style={s.miniText}>+1d</Text>
                </Tappable>
              </View>

              <Text style={s.label}>Notes (optional)</Text>
              <TextInput
                style={[input, { minHeight: 60, paddingTop: 12, textAlignVertical: 'top' }] as any}
                value={notes} onChangeText={setNotes} multiline maxLength={280}
                placeholder="Anything they need to know"
                placeholderTextColor="rgba(255,255,255,0.38)" keyboardAppearance="dark" />

              {/* Not a block. The squad session is checked against the bodies
                  actually receiving it, at the moment it is sent. */}
              {concerns.length > 0 && (
                <View style={s.concern}>
                  <Ionicons name="warning-outline" size={16} color={colors.amber} />
                  <Text style={s.concernText}>{concernSummary(concerns)}</Text>
                </View>
              )}
            </View>
          ) : what === 'program' ? (
            <View style={{ paddingHorizontal: spacing.lg }}>
              <View style={s.notYet}>
                <Ionicons name="construct-outline" size={16} color={colors.amber} />
                <Text style={s.notYetText}>
                  A block is a periodised plan over weeks, built against one
                  athlete's age, maturity and limiters — so it stays
                  per-athlete, and assigning one is the next piece. For a
                  workout the whole group does today, use Session.
                </Text>
              </View>
            </View>
          ) : what === 'result' ? (
            <View style={{ paddingHorizontal: spacing.lg }}>
              <Text style={s.label}>Which event?</Text>
              <View style={s.chips}>
                {[...new Set(chosen.flatMap(eventsOf))].slice(0, 8).map((d) => {
                  const on = event === d
                  return (
                    <Tappable key={d} onPress={() => { tapFeedback(); setEvent(d) }}
                      accessibilityLabel={d} accessibilityState={{ selected: on }}
                      style={[s.chip, {
                        borderColor: on ? colors.accent[500] + '8C' : onImage.cardBorder,
                        backgroundColor: on ? colors.accent[500] + '2E' : onImage.card,
                      }]}>
                      <Text style={[s.chipText, { color: on ? '#FFFFFF' : onImage.muted }]}>{d}</Text>
                    </Tappable>
                  )
                })}
              </View>
              <TextInput style={[input, { marginTop: 8 }] as any} value={event}
                onChangeText={setEvent} placeholder="e.g. 100m"
                placeholderTextColor="rgba(255,255,255,0.38)" keyboardAppearance="dark" maxLength={40} />

              <Text style={s.label}>What did they do?</Text>
              <View style={{ flexDirection: 'row', gap: 8 }}>
                <TextInput style={[input, { flex: 1 }] as any} value={mark} onChangeText={setMark}
                  placeholder={status === 'OK' ? 'Mark, e.g. 11.42' : 'No mark'}
                  editable={status === 'OK'}
                  placeholderTextColor="rgba(255,255,255,0.38)"
                  keyboardType="decimal-pad" keyboardAppearance="dark" />
                <TextInput style={[input, { width: 104 }] as any} value={wind} onChangeText={setWind}
                  placeholder="Wind" placeholderTextColor="rgba(255,255,255,0.38)"
                  keyboardType="numbers-and-punctuation" keyboardAppearance="dark" />
              </View>

              <Text style={s.label}>Status</Text>
              <View style={s.chips}>
                {RESULT_STATUSES.map((st) => {
                  const on = status === st.v
                  return (
                    <Tappable key={st.v} onPress={() => { tapFeedback(); setStatus(st.v) }}
                      accessibilityLabel={st.l} accessibilityState={{ selected: on }}
                      style={[s.chip, {
                        borderColor: on ? colors.accent[500] + '8C' : onImage.cardBorder,
                        backgroundColor: on ? colors.accent[500] + '2E' : onImage.card,
                      }]}>
                      <Text style={[s.chipText, { color: on ? '#FFFFFF' : onImage.muted }]}>{st.l}</Text>
                    </Tappable>
                  )
                })}
              </View>

              <Text style={s.label}>Date · {ISO.test(date) ? dayLabel(date) : 'YYYY-MM-DD'}</Text>
              <View style={{ flexDirection: 'row', gap: 8, alignItems: 'center' }}>
                <TextInput style={[input, { flex: 1 }] as any} value={date} onChangeText={setDate}
                  placeholder="YYYY-MM-DD" placeholderTextColor="rgba(255,255,255,0.38)"
                  keyboardType="numbers-and-punctuation" keyboardAppearance="dark" />
                <Tappable onPress={() => { tapFeedback(); setDate(todayDay()) }}
                  accessibilityLabel="Today" style={s.mini}>
                  <Text style={s.miniText}>Today</Text>
                </Tappable>
              </View>

              <Text style={s.label}>Competition (optional)</Text>
              <TextInput style={input as any} value={title} onChangeText={setTitle}
                placeholder="e.g. County Championships"
                placeholderTextColor="rgba(255,255,255,0.38)" keyboardAppearance="dark" maxLength={120} />
            </View>
          ) : (
          <View style={{ paddingHorizontal: spacing.lg }}>
            <Text style={s.label}>What is it?</Text>
            <View style={s.chips}>
              {EVENT_KINDS.map((k) => {
                const on = kind === k.v
                const tone = k.tone === 'muted' ? onImage.muted : (colors as any)[k.tone] || colors.accent[500]
                return (
                  <Tappable
                    key={k.v}
                    onPress={() => { tapFeedback(); setKind(k.v) }}
                    accessibilityLabel={k.l}
                    accessibilityState={{ selected: on }}
                    style={[s.chip, {
                      borderColor: on ? tone + '8C' : onImage.cardBorder,
                      backgroundColor: on ? tone + '2E' : onImage.card,
                    }]}
                  >
                    <Ionicons name={k.icon as any} size={14} color={on ? tone : onImage.muted} />
                    <Text style={[s.chipText, { color: on ? '#FFFFFF' : onImage.muted }]}>{k.l}</Text>
                  </Tappable>
                )
              })}
            </View>

            <Text style={s.label}>Name</Text>
            <TextInput
              style={input as any} value={title} onChangeText={(v) => { setTitle(v); setDone(null) }}
              placeholder="e.g. County Championships"
              placeholderTextColor="rgba(255,255,255,0.38)" keyboardAppearance="dark" maxLength={120}
            />

            <Text style={s.label}>Date · {ISO.test(date) ? dayLabel(date) : 'YYYY-MM-DD'}</Text>
            <View style={{ flexDirection: 'row', gap: 8, alignItems: 'center' }}>
              <TextInput
                style={[input, { flex: 1 }] as any} value={date} onChangeText={setDate}
                placeholder="YYYY-MM-DD" placeholderTextColor="rgba(255,255,255,0.38)"
                keyboardType="numbers-and-punctuation" keyboardAppearance="dark"
              />
              <Tappable onPress={() => { tapFeedback(); setDate(todayDay()) }}
                accessibilityLabel="Today" style={s.mini}>
                <Text style={s.miniText}>Today</Text>
              </Tappable>
              <Tappable onPress={() => { tapFeedback(); setDate(addDays(date, 7)) }}
                accessibilityLabel="A week later" style={s.mini}>
                <Text style={s.miniText}>+1w</Text>
              </Tappable>
            </View>

            <Text style={s.label}>Notes (optional)</Text>
            <TextInput
              style={[input, { minHeight: 66, paddingTop: 12, textAlignVertical: 'top' }] as any}
              value={notes} onChangeText={setNotes} multiline maxLength={280}
              placeholder="Anything they need to know" placeholderTextColor="rgba(255,255,255,0.38)"
              keyboardAppearance="dark"
            />
          </View>
          )}

          {/* ── 2. Who ────────────────────────────────────────────── */}
          <View style={{ paddingHorizontal: spacing.lg, marginTop: 26, marginBottom: 10 }}>
            <Text style={[s.label, { marginTop: 0 }]}>Who gets it?</Text>
          </View>
          <SquadSwitcher
            squads={squads} counts={counts.counts} unassigned={counts.unassigned}
            total={counts.total} value={filter} onChange={setFilter}
            onAdd={() => navigation.navigate('Home')}
          />

          {shown.length > 0 && (
            <View style={{ paddingHorizontal: spacing.lg, marginTop: 12 }}>
              <Tappable onPress={toggleAllShown}
                accessibilityLabel={allShownPicked ? 'Clear this squad' : 'Select this squad'}
                style={s.selectAll}>
                <Ionicons
                  name={allShownPicked ? 'checkbox' : 'square-outline'}
                  size={17} color={allShownPicked ? colors.accent[500] : onImage.muted} />
                <Text style={[s.selectAllText, { color: onImage.muted }]}>
                  {allShownPicked ? 'Clear these' : `Select all ${shown.length}`}
                </Text>
              </Tappable>
            </View>
          )}

          <View style={s.list}>
            {shown.map((a) => {
              const on = picked.has(keyOf(a))
              return (
                <Tappable key={keyOf(a)} onPress={() => toggle(a)}
                  accessibilityLabel={a.name} accessibilityState={{ selected: on }}
                  style={[s.row, {
                    borderColor: on ? colors.accent[500] + '8C' : onImage.cardBorder,
                    backgroundColor: on ? colors.accent[500] + '1F' : onImage.card,
                  }]}>
                  <Ionicons name={on ? 'checkmark-circle' : 'ellipse-outline'} size={20}
                    color={on ? colors.accent[500] : onImage.muted} />
                  <View style={{ flex: 1 }}>
                    <Text style={s.rowName} numberOfLines={1}>{a.name}</Text>
                    <Text style={s.rowMeta} numberOfLines={1}>
                      {a.discipline || 'No event'}
                      {a.athlete_user_id ? '' : ' · no account'}
                    </Text>
                  </View>
                </Tappable>
              )
            })}
            {shown.length === 0 && (
              <Text style={s.empty}>Nobody in this squad yet.</Text>
            )}
          </View>

          {/* ── 3. Send ───────────────────────────────────────────── */}
          <View style={{ paddingHorizontal: spacing.lg, marginTop: 18 }}>
            {!!error && (
              <View style={s.errRow}>
                <Ionicons name="alert-circle" size={15} color={colors.red} style={{ marginTop: 1 }} />
                <Text style={{ flex: 1, fontSize: 12.5, lineHeight: 18, color: colors.red }}>{error}</Text>
              </View>
            )}
            {done && done.failed === 0 && (
              <View style={s.okRow}>
                <Ionicons name="checkmark-circle" size={15} color={colors.green} style={{ marginTop: 1 }} />
                <Text style={{ flex: 1, fontSize: 12.5, lineHeight: 18, color: colors.green }}>
                  Sent to {done.ok} {done.ok === 1 ? 'athlete' : 'athletes'}. Anyone with an account
                  sees it as pending until they accept.
                </Text>
              </View>
            )}

            <Tappable onPress={what === 'program' ? () => {} : send}
              accessibilityLabel="Send to the chosen athletes"
              style={[s.send, {
                backgroundColor: chosen.length && what !== 'program'
                  ? colors.accent[500] : 'rgba(255,255,255,0.12)',
              }]}>
              {sending ? <ActivityIndicator color="#FFFFFF" /> : (
                <Text style={s.sendText}>
                  {what === 'program'
                    ? 'Not yet — see above'
                    : chosen.length
                      ? `${what === 'result' ? 'Record for' : 'Send to'} ${chosen.length} ${chosen.length === 1 ? 'athlete' : 'athletes'}`
                      : 'Choose who gets it'}
                </Text>
              )}
            </Tappable>
          </View>
        </Animated.ScrollView>
      </SafeAreaView>
    </View>
  )
}

const s = StyleSheet.create({
  h1: { fontSize: 34, fontWeight: '700', letterSpacing: -0.9, color: onImage.ink },
  label: { fontSize: 12.5, color: onImage.muted, marginTop: 16, marginBottom: 8 },
  whats: { flexDirection: 'row', gap: 8, marginTop: 4 },
  what: {
    flex: 1, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 6,
    minHeight: 44, borderRadius: radius.md, borderWidth: 1,
  },
  whatText: { fontSize: 13, fontWeight: '700' },
  notYet: {
    flexDirection: 'row', gap: 10, marginTop: 18, padding: 14,
    borderRadius: radius.lg, borderWidth: 1, borderColor: 'rgba(240,167,66,0.35)',
    backgroundColor: 'rgba(240,167,66,0.10)',
  },
  notYetText: { flex: 1, color: onImage.muted, fontSize: 12.5, lineHeight: 18 },
  concern: {
    flexDirection: 'row', gap: 10, marginTop: 16, padding: 13,
    borderRadius: radius.md, borderWidth: 1, borderColor: 'rgba(240,167,66,0.35)',
    backgroundColor: 'rgba(240,167,66,0.10)',
  },
  concernText: { flex: 1, color: onImage.ink, fontSize: 12.5, lineHeight: 18 },
  chips: { flexDirection: 'row', flexWrap: 'wrap', gap: 8 },
  chip: {
    flexDirection: 'row', alignItems: 'center', gap: 6,
    minHeight: 38, paddingHorizontal: 12, borderRadius: radius.full, borderWidth: 1,
  },
  chipText: { fontSize: 13, fontWeight: '700' },
  mini: {
    minHeight: 48, paddingHorizontal: 13, borderRadius: radius.md, borderWidth: 1,
    borderColor: onImage.cardBorder, backgroundColor: onImage.card,
    alignItems: 'center', justifyContent: 'center',
  },
  miniText: { color: onImage.muted, fontSize: 12.5, fontWeight: '700' },
  selectAll: { flexDirection: 'row', alignItems: 'center', gap: 8, minHeight: 34 },
  selectAllText: { fontSize: 13, fontWeight: '700' },
  list: { paddingHorizontal: spacing.lg, gap: 8, marginTop: 8 },
  row: {
    flexDirection: 'row', alignItems: 'center', gap: 12,
    minHeight: 58, paddingHorizontal: 14, borderRadius: radius.lg, borderWidth: 1,
  },
  rowName: { color: onImage.ink, fontSize: 15, fontWeight: '700', letterSpacing: -0.2 },
  rowMeta: { color: onImage.muted, fontSize: 12, marginTop: 1 },
  empty: { color: onImage.muted, fontSize: 13.5, paddingVertical: 14 },
  errRow: { flexDirection: 'row', gap: 7, marginBottom: 12 },
  okRow: { flexDirection: 'row', gap: 7, marginBottom: 12 },
  send: {
    minHeight: 52, borderRadius: radius.md, alignItems: 'center', justifyContent: 'center',
  },
  sendText: { color: '#FFFFFF', fontSize: 15, fontWeight: '700' },
})
