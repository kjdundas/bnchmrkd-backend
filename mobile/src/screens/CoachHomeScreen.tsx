// ═══════════════════════════════════════════════════════════════════════════
// COACH HOME — the coach's landing tab. Orients them in seconds:
//   • Squad health (linked athletes, checked-in today)
//   • Needs attention — readiness flags, gone-quiet, behind-on-program
//   • Squad activity feed — recent results / tests / sessions, with reactions
// Pulls from get_linked_athletes + get_coach_feed + activity_reactions.
// ═══════════════════════════════════════════════════════════════════════════

import React, { useEffect, useState, useCallback, useMemo, useRef } from 'react'
import { View, Text, Animated, TouchableOpacity, StyleSheet, RefreshControl } from 'react-native'
import { SafeAreaView } from 'react-native-safe-area-context'
import { useNavigation } from '@react-navigation/native'
import { Ionicons } from '@expo/vector-icons'
import { colors, spacing, radius, onImage } from '../lib/theme'
import { useAuth } from '../contexts/AuthContext'
import { useTheme } from '../contexts/ThemeContext'
import { callRpc, insertInto, deleteFrom } from '../lib/supabase'
import { checkinStatus, READINESS_COLORS, isToday } from '../lib/readiness'
import { Tappable } from '../components/ui'
import { tapFeedback } from '../lib/haptics'
import ScreenBackdrop, { BACKDROP_GROUND } from '../components/ScreenBackdrop'
import AppHeader from '../components/AppHeader'
import { TAB_BAR_CLEARANCE } from '../navigation/FloatingTabBar'
import SquadSwitcher, { type SquadFilter } from '../components/SquadSwitcher'
import SquadSheet, { type SquadSheetMode } from '../components/SquadSheet'
import {
  fetchSquads, fetchSquadAthletes, createSquad, renameSquad, deleteSquad,
  setSquadFor, inSquad, squadCounts, keyOf, type Squad, type SquadAthlete,
} from '../lib/squads'
import { ageFromDob } from '../lib/age'
import SquadAthleteCard from '../components/SquadAthleteCard'
import AssistantCoachBox from '../components/AssistantCoachBox'
import { fetchResultsForMany } from '../lib/athleteResults'
import ApprovalInbox, { ApprovalBanner } from '../components/ApprovalInbox'
import { useApprovals } from '../contexts/ApprovalsContext'
import {
  subjectFor, eventsOf, fetchSquadCheckins, growthForMany,
  type SharedCheckin,
} from '../lib/squads'
import { fetchMetricsForMany } from '../lib/athleteResults'
import { type GrowthReading } from '../lib/growth'
import { buildAttention, checkedInToday } from '../lib/attention'
import SquadWellness from '../components/SquadWellness'
import { SkeletonCards, LoadFailed } from '../components/LoadState'
import GetStartedCard from '../components/GetStartedCard'
import InfoDot from '../components/InfoDot'
import { coachSteps } from '../lib/firstRun'
import AsyncStorage from '@react-native-async-storage/async-storage'
import { newTrouble } from '../lib/loadState'
import { todayDay, addDays } from '../lib/schedule'

const EMOJIS = ['👏', '🔥', '💪']
const QUIET_DAYS = 14

function greeting(): string {
  const h = new Date().getHours()
  if (h < 12) return 'Good morning'
  if (h < 17) return 'Good afternoon'
  return 'Good evening'
}

function timeAgo(ts: string | null): string {
  if (!ts) return ''
  const diff = Date.now() - new Date(ts).getTime()
  const d = Math.floor(diff / 86400000)
  if (d > 0) return d === 1 ? 'yesterday' : `${d}d ago`
  const h = Math.floor(diff / 3600000)
  if (h > 0) return `${h}h ago`
  const m = Math.floor(diff / 60000)
  return m > 1 ? `${m}m ago` : 'just now'
}

function initials(name: string): string {
  return (name || '?').split(' ').map((n) => n[0]).join('').slice(0, 2).toUpperCase()
}

// lastActivityDays and buildAthleteParam were removed with the rewrite above.
// Both read the denormalised `races` / `performances` blobs off a linked
// athlete row — the shape that could only ever describe an account holder,
// and the reason the attention list could not see a roster athlete. Leaving
// them here as dead code would be leaving the next person a working helper
// that reintroduces the bug.

export default function CoachHomeScreen() {
  const { user, profile } = useAuth()
  const { colors: c } = useTheme()
  const navigation = useNavigation<any>()
  const [linked, setLinked] = useState<any[]>([])
  const [feed, setFeed] = useState<any[]>([])
  const [reacts, setReacts] = useState<Record<string, Set<string>>>({})
  const [loading, setLoading] = useState(true)
  // Whether the last load actually reached the server. Without this a
  // timeout renders as 'No athletes yet', which is a false statement
  // about a coach's own roster.
  const [failed, setFailed] = useState(false)
  const [refreshing, setRefreshing] = useState(false)
  // Drives the backdrop's parallax and blur. Native-driven, so scrolling
  // stays smooth.
  const scrollY = useRef(new Animated.Value(0)).current
  const [busy, setBusy] = useState<string | null>(null)
  // The squad layer. `athletes` holds BOTH kinds — accounts this coach is
  // linked to and roster entries they keyed in — in one shape, so nothing
  // below has to care which is which.
  const [squads, setSquads] = useState<Squad[]>([])
  const [athletes, setAthletes] = useState<SquadAthlete[]>([])
  const [filter, setFilter] = useState<SquadFilter>(null)
  const [sheet, setSheet] = useState<SquadSheetMode | null>(null)
  // Results for the whole squad, in two queries. The cards need them for the
  // mark and the trend arrow, which is the thing a coach actually scans for.
  const [results, setResults] = useState<Map<string, any[]>>(new Map())
  // Read from shared_checkins, so an athlete's sharing choice is already
  // applied by the time it reaches this screen.
  const [checkins, setCheckins] = useState<Map<string, SharedCheckin[]>>(new Map())
  // Measured stature velocity per athlete — the growth-spurt flag.
  const [growth, setGrowth] = useState<Map<string, GrowthReading>>(new Map())
  // The activity feed is long and it is history — it opens when asked for.
  const [feedOpen, setFeedOpen] = useState(false)
  // Per-account, so signing in as somebody else does not inherit a dismissal.
  const [setupHidden, setSetupHidden] = useState(false)
  const setupKey = `@bnchmrkd_setup_hidden_${user?.id || 'anon'}`
  useEffect(() => {
    AsyncStorage.getItem(setupKey).then((v) => setSetupHidden(v === '1')).catch(() => {})
  }, [setupKey])
  // Answers this coach owes their athletes. The same inbox the athlete
  // sees, pointed the other way — one component, because an athlete
  // accepting a program and a coach approving a test are the same act.
  const [inboxOpen, setInboxOpen] = useState(false)
  // One count, shared with the tab bar. Home used to own this, which is why
  // a waiting athlete was invisible from every other tab.
  const { count: pendingCount, refresh: refreshPending } = useApprovals()

  const loadSquads = useCallback(async () => {
    const t = newTrouble()
    const [sq, ath] = await Promise.all([
      fetchSquads(user?.id || '', t),
      fetchSquadAthletes(t),
    ])
    setSquads(sq)
    setAthletes(ath)
    const [r, ck, mx] = await Promise.all([
      fetchResultsForMany(ath.map(subjectFor), t),
      // A fortnight: long enough for the sparkline to show a direction,
      // short enough not to pull a season of rows for a glance.
      fetchSquadCheckins(ath, addDays(todayDay(), -14), todayDay(), t),
      fetchMetricsForMany(ath.map(subjectFor), t),
    ])
    setResults(r); setCheckins(ck); setGrowth(growthForMany(ath, mx))
    setFailed(t.failed)
  }, [user])

  const load = useCallback(async () => {
    if (!user?.id) { setLoading(false); return }   // wait for auth/token before fetching
    try {
      const [athletes, events] = await Promise.all([
        callRpc('get_linked_athletes').catch(() => []),
        callRpc('get_coach_feed').catch(() => []),
      ])
      setLinked(Array.isArray(athletes) ? athletes : [])
      const list = Array.isArray(events) ? events : []
      setFeed(list)
      const map: Record<string, Set<string>> = {}
      for (const e of list) map[e.event_key] = new Set(Array.isArray(e.my_reactions) ? e.my_reactions : [])
      setReacts(map)
    } finally { setLoading(false) }
  }, [user?.id])

  useEffect(() => { load(); loadSquads(); refreshPending() }, [load, loadSquads, refreshPending])
  useEffect(() => {
    const unsub = navigation.addListener('focus', () => { load(); loadSquads(); refreshPending() })
    return unsub
  }, [navigation, load, loadSquads, refreshPending])

  const onRefresh = async () => {
    setRefreshing(true)
    await Promise.all([load(), loadSquads()])
    setRefreshing(false)
  }

  // ── The squad the switcher is showing ──
  const counts = useMemo(() => squadCounts(athletes), [athletes])
  const shown = useMemo(() => (
    filter === 'unassigned'
      ? [...athletes].filter((a) => !a.squad_id).sort((x, y) => x.name.localeCompare(y.name))
      : inSquad(athletes, filter as string | null)
  ), [athletes, filter])

  // ── Needs-attention items ────────────────────────────────────────
  // The logic lives in lib/attention.ts. It had two bugs at once while it
  // was inline here — the wrong population and a second source of truth for
  // readiness — and neither was visible in a screen file. Anything deciding
  // which fourteen-year-old a coach sees first belongs where it can be
  // exercised.
  const complianceBy = useMemo(() => {
    const m = new Map<string, any>()
    for (const a of linked) if (a.athlete_user_id) m.set(a.athlete_user_id, a.program_compliance)
    return m
  }, [linked])

  const items = useMemo(
    () => buildAttention({
      athletes: shown, checkins, growth, results, compliance: complianceBy,
    }),
    [shown, checkins, growth, results, complianceBy])

  // Same module, so the denominator on the stat row and the population the
  // flags are built from can never drift apart.
  const { checked: checkedToday, withAccounts: withAccountCount } =
    useMemo(() => checkedInToday(shown, checkins), [shown, checkins])
  const firstName = profile?.full_name?.split(' ')[0] || 'Coach'

  // One shape for opening an athlete, whichever surface you tapped from.
  const openParam = (a: any) => navigation.navigate('AthleteDetail', {
    athlete: {
      id: a.roster_athlete_id, linked_user_id: a.athlete_user_id,
      name: a.name, dob: a.dob, gender: a.gender, discipline: a.discipline,
    },
  })

  const toggleReact = async (ev: any, emoji: string) => {
    const k = ev.event_key
    if (busy) return
    setBusy(`${k}${emoji}`)
    const has = reacts[k]?.has(emoji)
    setReacts((prev) => { const s = new Set(prev[k] || []); has ? s.delete(emoji) : s.add(emoji); return { ...prev, [k]: s } })
    try {
      if (has) await deleteFrom('activity_reactions', `event_key=eq.${encodeURIComponent(k)}&reactor_id=eq.${user?.id}&emoji=eq.${encodeURIComponent(emoji)}`)
      else await insertInto('activity_reactions', { event_key: k, athlete_user_id: ev.athlete_user_id, reactor_id: user?.id, reactor_name: profile?.full_name || 'Coach', event_title: ev.detail, emoji })
    } catch {
      setReacts((prev) => { const s = new Set(prev[k] || []); has ? s.add(emoji) : s.delete(emoji); return { ...prev, [k]: s } })
    } finally { setBusy(null) }
  }

  const feedMeta: Record<string, { icon: string; color: string; verb: string }> = {
    result: { icon: 'trophy-outline', color: colors.amber, verb: 'logged a result' },
    test: { icon: 'speedometer-outline', color: colors.blue, verb: 'logged a test' },
    session: { icon: 'barbell-outline', color: colors.green, verb: 'completed a session' },
  }

  return (
    // Same construction as the athlete's Home: the photograph sits BEHIND the
    // scroll view, so content slides over it rather than dragging it along,
    // and the floating bar hovers over the whole thing.
    <View style={{ flex: 1, backgroundColor: BACKDROP_GROUND }}>
      {/* The track, as on the athlete side. Home is the same screen for
          both roles; only who it is about changes. */}
      <ScreenBackdrop scrollY={scrollY} />
      <SafeAreaView style={{ flex: 1 }} edges={['top', 'left', 'right']}>
      <AppHeader onImage />
      <Animated.ScrollView
        style={{ backgroundColor: 'transparent' }}
        showsVerticalScrollIndicator={false}
        contentContainerStyle={{ paddingBottom: TAB_BAR_CLEARANCE }}
        scrollEventThrottle={16}
        onScroll={Animated.event(
          [{ nativeEvent: { contentOffset: { y: scrollY } } }],
          { useNativeDriver: true },
        )}
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor={colors.orange[500]} />}>

        {/* Header */}
        <View style={styles.header}>
          <Text style={styles.greeting}>{greeting()}, {firstName}</Text>
          <Text style={styles.title}>Today</Text>
        </View>

        {/* The first thing a new coach sees, above everything else, because
            every panel below it is empty until this is done. */}
        {!loading && (
          <GetStartedCard
            steps={coachSteps({
              athleteCount: athletes.length,
              squadCount: squads.length,
              hasAssigned: feed.length > 0,
            })}
            dismissed={setupHidden}
            onDismiss={() => {
              setSetupHidden(true)
              AsyncStorage.setItem(setupKey, '1').catch(() => {})
            }}
            onAct={(step) => {
              if (step.route === 'CoachRoster') navigation.navigate('CoachRoster')
              else if (step.route === 'Assign') navigation.navigate('Assign')
              else setSheet({ kind: 'new' })
            }}
          />
        )}

        {/* Anything awaiting your answer comes before anything to read —
            an athlete is standing still until you answer it. */}
        <View style={{ paddingHorizontal: spacing.lg }}>
          <ApprovalBanner count={pendingCount} onPress={() => { tapFeedback(); setInboxOpen(true) }} />
        </View>

        {/* ── The squad, first ────────────────────────────────────────
            Who you coach comes before what happened, because the answer to
            "what am I doing today" is usually a person. */}
        <SquadSwitcher
          squads={squads}
          counts={counts.counts}
          unassigned={counts.unassigned}
          total={counts.total}
          value={filter}
          onChange={setFilter}
          onAdd={() => setSheet({ kind: 'choose' })}
          onEdit={(sq) => setSheet({ kind: 'edit', squad: sq })}
        />

        <View style={sq.grid}>
          {!loading && !failed && shown.map((a) => {
            return (
              <SquadAthleteCard
                key={keyOf(a)}
                athlete={a}
                results={results.get(keyOf(a)) || []}
                growth={growth.get(keyOf(a))}
                onOpen={(discipline) => navigation.navigate('AthleteDetail', {
                  athlete: {
                    id: a.roster_athlete_id,
                    linked_user_id: a.athlete_user_id,
                    name: a.name, dob: a.dob, gender: a.gender,
                    // Whichever event the card is showing, so opening a
                    // profile continues the thought rather than resetting it.
                    discipline,
                  },
                })}
                // Long-press files them, the same idiom the metric rings use.
                onLongPress={() => setSheet({ kind: 'assign', athlete: a })}
              />
            )
          })}
          {/* Skeleton, then failure, then — only once we actually have an
              answer — the empty state. This screen used to say "No athletes
              yet" to a coach with fourteen of them, on every cold open and on
              every dropped connection. */}
          {loading && <SkeletonCards cards={4} />}

          {!loading && failed && <LoadFailed />}

          {!loading && !failed && shown.length === 0 && (
            <Text style={sq.empty}>
              {athletes.length === 0
                ? 'No athletes yet — use the + above to add one, or invite an athlete who already has an account.'
                : 'Nobody filed into this squad yet — long-press an athlete to file them.'}
            </Text>
          )}
        </View>

        {/* Squad health.
            "Athletes" is the whole squad; "checked in" can only ever count
            the ones with an account, because an athlete with no phone has
            nothing to check in on. Showing 0/1 beside a squad of five read
            as a bug, so the denominator says what it is. */}
        {athletes.length > 0 && (
          <View style={styles.statsRow}>
            <View style={styles.statItem}>
              <Text style={styles.statNum}>{athletes.length}</Text>
              <Text style={styles.statLabel}>Athletes</Text>
            </View>
            <View style={styles.statDivider} />
            <View style={styles.statItem}>
              <Text style={styles.statNum}>
                {checkedToday}<Text style={styles.statSub}>/{withAccountCount}</Text>
              </Text>
              <View style={{ flexDirection: 'row', alignItems: 'center', gap: 4 }}>
                <Text style={styles.statLabel}>
                  {withAccountCount === shown.length ? 'Checked in' : 'Of those with an app'}
                </Text>
                {withAccountCount !== shown.length && <InfoDot term="rosterAthlete" size={12} />}
              </View>
            </View>
            <View style={styles.statDivider} />
            <View style={styles.statItem}>
              <Text style={[styles.statNum, items.length > 0 && { color: colors.orange[500] }]}>{items.length}</Text>
              <Text style={styles.statLabel}>Flags</Text>
            </View>
          </View>
        )}

        {/* Needs attention */}
        {shown.length > 0 && (
          <View style={styles.section}>
            <View style={styles.sectionHead}>
              <Ionicons name="alert-circle-outline" size={15} color={colors.orange[500]} />
              <Text style={styles.sectionTitle}>Needs attention</Text>
            </View>
            {items.length === 0 ? (
              <View style={styles.allClear}>
                <Ionicons name="checkmark-circle-outline" size={18} color={colors.green} />
                <Text style={styles.allClearText}>All clear — no flags, everyone's active.</Text>
              </View>
            ) : (
              items.map((it) => (
                <TouchableOpacity key={it.key} style={styles.row} activeOpacity={0.6} onPress={() => { tapFeedback(); openParam(it.athlete) }}>
                  <View style={[styles.rowBar, { backgroundColor: it.color }]} />
                  <Ionicons name={it.icon as any} size={16} color={it.color} style={{ marginRight: spacing.sm }} />
                  <View style={{ flex: 1 }}>
                    <Text style={styles.rowTitle} numberOfLines={1}>{it.headline}</Text>
                    <Text style={styles.rowDetail} numberOfLines={1}>{it.detail}</Text>
                  </View>
                  <Ionicons name="chevron-forward" size={14} color={onImage.dim} />
                </TouchableOpacity>
              ))
            )}
          </View>
        )}

        {/* Squad activity — history, so it opens rather than filling the
            screen. What a coach needs first is the squad and the assistant. */}
        {feed.length > 0 && (
          <View style={styles.section}>
            <Tappable
              onPress={() => { tapFeedback(); setFeedOpen((v) => !v) }}
              accessibilityLabel={feedOpen ? 'Hide squad activity' : 'Show squad activity'}
              accessibilityState={{ expanded: feedOpen }}
              style={styles.sectionHead}
            >
              <Ionicons name="pulse-outline" size={15} color={colors.orange[500]} />
              <Text style={styles.sectionTitle}>Squad activity</Text>
              <Text style={styles.sectionHint}>
                {feedOpen ? 'React to give a nudge' : `${feed.length} recent`}
              </Text>
              <Ionicons
                name={feedOpen ? 'chevron-up' : 'chevron-down'}
                size={16} color={onImage.muted} />
            </Tappable>
            {feedOpen && feed.slice(0, 15).map((ev) => {
              const meta = feedMeta[ev.kind] || feedMeta.result
              const mine = reacts[ev.event_key] || new Set<string>()
              return (
                <View key={ev.event_key} style={styles.feedRow}>
                  <View style={[styles.avatar, { backgroundColor: meta.color + '14' }]}>
                    <Text style={[styles.avatarText, { color: meta.color }]}>{initials(ev.athlete_name)}</Text>
                  </View>
                  <View style={{ flex: 1, minWidth: 0 }}>
                    <Text style={styles.feedName} numberOfLines={1}>
                      <Text style={{ fontWeight: '700', color: onImage.ink }}>{ev.athlete_name}</Text>
                      <Text style={{ color: onImage.muted }}> {meta.verb}</Text>
                    </Text>
                    <View style={styles.feedMetaRow}>
                      <Ionicons name={meta.icon as any} size={11} color={meta.color} />
                      <Text style={styles.feedDetail} numberOfLines={1}>{ev.detail}</Text>
                      <Text style={styles.feedTime}>· {timeAgo(ev.occurred_at)}</Text>
                    </View>
                  </View>
                  <View style={styles.reactRow}>
                    {EMOJIS.map((e) => {
                      const on = mine.has(e)
                      return (
                        <TouchableOpacity key={e} onPress={() => { tapFeedback(); toggleReact(ev, e) }} disabled={busy === `${ev.event_key}${e}`}
                          style={[styles.reactBtn, on && styles.reactBtnOn]}>
                          <Text style={[styles.reactEmoji, !on && { opacity: 0.55 }]}>{e}</Text>
                        </TouchableOpacity>
                      )
                    })}
                  </View>
                </View>
              )
            })}
          </View>
        )}

        {/* Empty (no linked athletes yet) */}
        {!loading && linked.length === 0 && feed.length === 0 && (
          <View style={styles.emptyWrap}>
            <View style={styles.emptyIcon}><Ionicons name="people-outline" size={30} color={onImage.dim} /></View>
            <Text style={styles.emptyTitle}>No linked athletes yet</Text>
            <Text style={styles.emptySub}>Invite athletes from your Squad to see their check-ins, programs and activity here.</Text>
            <TouchableOpacity style={styles.emptyBtn} onPress={() => { tapFeedback(); navigation.navigate('CoachRoster') }}>
              <Text style={styles.emptyBtnText}>Go to Squad</Text>
            </TouchableOpacity>
          </View>
        )}
        {/* ── Assistant coach ────────────────────────────────────────
            Below the squad, because the squad is what you came for and this
            is what you do about it. The context is the athletes ON SCREEN,
            so an answer is about who you can actually see. */}
        {/* How everyone is, before what everyone did. */}
        <SquadWellness athletes={shown} checkins={checkins} />

        <AssistantCoachBox
          context={{
            squad: filter === null ? 'All athletes'
                 : filter === 'unassigned' ? 'Unassigned'
                 : (squads.find((q) => q.id === filter)?.name || 'Squad'),
            athletes: shown.map((a) => ({
              name: a.name,
              events: eventsOf(a),
              age: ageFromDob(a.dob),
              has_account: !!a.athlete_user_id,
              results: (results.get(keyOf(a)) || []).slice(0, 12).map((r: any) => ({
                event: r.discipline, mark: r.mark, date: r.competition_date,
                status: r.status, wind: r.wind_mps, approval: r.approval,
              })),
            })),
          }}
          onRoute={(to) => navigation.navigate('Assign', {
            what: to === 'assign-session' ? 'session'
                : to === 'assign-result' ? 'result' : 'event',
          })}
        />

        <View style={{ height: 8 }} />
      </Animated.ScrollView>

      <ApprovalInbox
        visible={inboxOpen}
        userId={user?.id}
        onClose={() => setInboxOpen(false)}
        // An answer changes what counts: an approved result becomes eligible
        // for a PB and for the boards. Everything on this screen is drawn
        // from that, so it all has to refetch.
        onChanged={() => { refreshPending(); load(); loadSquads() }}
      />

      <SquadSheet
        mode={sheet}
        visible={!!sheet}
        squads={squads}
        athletes={athletes}
        onClose={() => setSheet(null)}
        onNewSquad={() => setSheet({ kind: 'new' })}
        onAddAthlete={() => { setSheet(null); navigation.navigate('CoachRoster') }}
        onCreate={async (n) => { await createSquad(user?.id || '', n, squads.length); await loadSquads() }}
        onRename={async (id, n) => { await renameSquad(id, n); await loadSquads() }}
        onDelete={async (id) => {
          await deleteSquad(id)
          // The filter may be pointing at the squad that just went.
          setFilter((f) => (f === id ? null : f))
          await loadSquads()
        }}
        onAssign={async (a, squadId) => { await setSquadFor(a, squadId); await loadSquads() }}
      />
      </SafeAreaView>
    </View>
  )
}

const sq = StyleSheet.create({
  grid: {
    flexDirection: 'row', flexWrap: 'wrap', gap: 10,
    paddingHorizontal: spacing.lg, paddingTop: 14, paddingBottom: 6,
  },
  card: {
    width: '47.6%', minHeight: 118, borderRadius: radius.lg,
    borderWidth: 1, borderColor: 'rgba(255,255,255,0.16)',
    backgroundColor: 'rgba(255,255,255,0.10)',
    padding: 13, justifyContent: 'flex-start',
  },
  avatar: {
    width: 34, height: 34, borderRadius: 17, marginBottom: 9,
    borderWidth: 1.5, borderColor: 'rgba(255,255,255,0.30)',
    alignItems: 'center', justifyContent: 'center',
  },
  avatarText: { color: '#FFFFFF', fontSize: 12.5, fontWeight: '700', letterSpacing: 0.4 },
  name: { color: '#FFFFFF', fontSize: 14.5, fontWeight: '700', letterSpacing: -0.2 },
  meta: { color: 'rgba(255,255,255,0.68)', fontSize: 12, marginTop: 2 },
  noAccount: { color: 'rgba(255,255,255,0.50)', fontSize: 10.5, marginTop: 6, lineHeight: 14 },
  empty: {
    color: 'rgba(255,255,255,0.62)', fontSize: 13.5, lineHeight: 20,
    paddingVertical: 18, paddingRight: 20,
  },
})

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: BACKDROP_GROUND },
  header: { paddingHorizontal: spacing.lg, paddingTop: spacing.md, paddingBottom: spacing.sm },
  greeting: { fontSize: 13, color: onImage.muted, fontWeight: '500' },
  title: { fontSize: 28, fontWeight: '700', color: onImage.ink, marginTop: 2, letterSpacing: -0.5 },

  statsRow: {
    flexDirection: 'row', marginHorizontal: spacing.lg, marginTop: spacing.sm,
    paddingVertical: spacing.md, backgroundColor: 'rgba(255,255,255,0.02)',
    borderRadius: radius.md, borderWidth: 1, borderColor: 'rgba(255,255,255,0.05)',
  },
  statItem: { flex: 1, alignItems: 'center' },
  statNum: { fontSize: 20, fontWeight: '700', color: onImage.ink, letterSpacing: -0.5 },
  statSub: { fontSize: 13, color: onImage.dim, fontWeight: '600' },
  statLabel: { fontSize: 10, letterSpacing: 1, color: onImage.muted, fontWeight: '500', marginTop: 2, textTransform: 'uppercase' },
  statDivider: { width: 1, backgroundColor: 'rgba(255,255,255,0.06)', marginVertical: 2 },

  section: { marginTop: spacing.xl, paddingHorizontal: spacing.lg },
  sectionHead: { flexDirection: 'row', alignItems: 'center', gap: 6, marginBottom: spacing.sm },
  sectionTitle: { fontSize: 13, fontWeight: '700', color: onImage.ink },
  sectionHint: { marginLeft: 'auto', fontSize: 10, color: onImage.dim },

  allClear: { flexDirection: 'row', alignItems: 'center', gap: 8, paddingVertical: spacing.md },
  allClearText: { fontSize: 13, color: onImage.muted },

  row: {
    flexDirection: 'row', alignItems: 'center', paddingVertical: 11, paddingRight: 4,
    borderRadius: radius.md, borderWidth: 1, borderColor: 'rgba(255,255,255,0.04)',
    paddingLeft: 0, marginBottom: 8, overflow: 'hidden',
  },
  rowBar: { width: 4, alignSelf: 'stretch', borderTopLeftRadius: radius.md, borderBottomLeftRadius: radius.md, marginRight: spacing.md },
  rowTitle: { fontSize: 13, fontWeight: '600', color: onImage.ink },
  rowDetail: { fontSize: 11, color: onImage.muted, marginTop: 1 },

  feedRow: {
    flexDirection: 'row', alignItems: 'center', paddingVertical: 10, gap: spacing.sm,
    borderBottomWidth: 1, borderBottomColor: 'rgba(255,255,255,0.04)',
  },
  avatar: { width: 34, height: 34, borderRadius: 17, justifyContent: 'center', alignItems: 'center' },
  avatarText: { fontSize: 12, fontWeight: '700' },
  feedName: { fontSize: 12.5 },
  feedMetaRow: { flexDirection: 'row', alignItems: 'center', gap: 4, marginTop: 1 },
  feedDetail: { fontSize: 11, color: onImage.muted, flexShrink: 1 },
  feedTime: { fontSize: 10, color: onImage.dim },
  reactRow: { flexDirection: 'row', gap: 4 },
  reactBtn: {
    width: 30, height: 30, borderRadius: 8, justifyContent: 'center', alignItems: 'center',
    backgroundColor: 'rgba(255,255,255,0.03)', borderWidth: 1, borderColor: 'rgba(255,255,255,0.07)',
  },
  reactBtnOn: { backgroundColor: colors.orange[500] + '24', borderColor: colors.orange[500] + '60' },
  reactEmoji: { fontSize: 14 },

  emptyWrap: { alignItems: 'center', paddingHorizontal: spacing.xxl, paddingTop: 80 },
  emptyIcon: {
    width: 60, height: 60, borderRadius: 30, backgroundColor: 'rgba(255,255,255,0.03)',
    borderWidth: 1, borderColor: 'rgba(255,255,255,0.06)', justifyContent: 'center', alignItems: 'center', marginBottom: spacing.lg,
  },
  emptyTitle: { fontSize: 16, fontWeight: '600', color: onImage.ink, marginBottom: 6 },
  emptySub: { fontSize: 13, color: onImage.muted, textAlign: 'center', lineHeight: 19, marginBottom: spacing.lg },
  emptyBtn: { backgroundColor: colors.orange[500], borderRadius: radius.md, paddingVertical: 12, paddingHorizontal: 24 },
  emptyBtnText: { color: '#fff', fontSize: 14, fontWeight: '700' },
})
