// ═══════════════════════════════════════════════════════════════════════
// HOME SCREEN — four blocks, one question each.
//
//   1  the mark        what did I do          (hero — no card around it)
//   2  today           what am I doing now    (session + check-in, one card)
//   3  where I stand   how do I compare
//   4  since last time what changed
//
// It was ten. Four of those ten answered the same question — the metric rail,
// the Today card, the check-in and the hero were all "how am I doing right
// now" — and the rail and the DNA strip were computed from the same `metrics`
// array, one drawn as rings and one as a score. A screen where everything is
// a card of equal weight reads as wallpaper: uniformity tells the eye that
// nothing matters more than anything else.
//
// The mark leads and carries no chrome at all, because it is the reason the
// app exists. It used to be the fourth thing you saw, at 22 points, inside a
// card, under a kicker reading YOUR HEADLINE.
//
// The greeting is gone. It was set at 10px, uppercase, tracked out, in muted
// grey — the athlete's own name was the smallest, faintest text on their home
// screen. Identity lives in AppHeader; the streak sits on the date line.
//
// Exploration lives on Trajectory (per-discipline analysis), the rings and
// the DNA profile on Profile.
//
// KEY: Physical metrics (athlete_metrics) bridge to competition data.
// If a user logs sprint_100m = 11.23s, that populates the hero as a "100m" PB.
// ═══════════════════════════════════════════════════════════════════════

import React, { useEffect, useState, useCallback, useMemo, useRef } from 'react'
import {
  View,
  Text,
  StyleSheet,
  RefreshControl,
  Animated,
} from 'react-native'
import { SafeAreaView } from 'react-native-safe-area-context'
import { useNavigation } from '@react-navigation/native'
import { colors, spacing, onImage, typeScale, weight, radius } from '../lib/theme'
import { useAuth } from '../contexts/AuthContext'
import { useTheme } from '../contexts/ThemeContext'
import { selectFrom, callRpc } from '../lib/supabase'
import { Stagger, SectionLabel, Tappable } from '../components/ui'
import {
  RivalCard,
  WhereYouStand,
  ScienceSpotlight,
  SinceLastVisit,
  Sparkline,
} from '../components/HomeSections'
import { StreakChip as GamStreakChip } from '../components/GamificationUI'
import AthleteCoachLinks from '../components/AthleteCoachLinks'
import AppHeader from '../components/AppHeader'
import { TAB_BAR_CLEARANCE } from '../navigation/FloatingTabBar'
import CheckInCard from '../components/CheckInCard'
import ScreenBackdrop, { BACKDROP_GROUND } from '../components/ScreenBackdrop'
import { PerformanceHero, type HomeView, type TierBand } from '../components/OuraSections'
import { LOWER_IS_BETTER, formatMark } from '../lib/metricSemantics'
import { isLowerBetter } from '../lib/disciplineScience'
import { countsForAnalysis } from '../lib/resultSemantics'
import TodayCard from '../components/TodayCard'
import HomeStanding from '../components/HomeStanding'
import CorpusLine from '../components/CorpusLine'
import { buildWeek, blockWeekFor, mondayOf, todayDay } from '../lib/schedule'
import { fetchEvents } from '../lib/events'
import ApprovalInbox, { ApprovalBanner } from '../components/ApprovalInbox'
import GetStartedCard from '../components/GetStartedCard'
import EventPickerSheet from '../components/EventPickerSheet'
import { athleteSteps } from '../lib/firstRun'
import AsyncStorage from '@react-native-async-storage/async-storage'
import { tapFeedback } from '../lib/haptics'
import { useApprovals } from '../contexts/ApprovalsContext'
import { getTier } from '../lib/performanceTiers'
import { getAgeGroup } from '../lib/performanceLevels'
import { ageFromDob } from '../lib/age'
import { calculateStreak, type UserStats } from '../lib/gamification'
import { loadProgress } from '../lib/progress'
import {
  RADAR_AXES,
  buildDnaProfile,
  scoreToTier,
  findLimitingFactor,
} from '../lib/disciplineScience'
import {
  WhatIfExplorer,
  SmartDailyInsight,
} from '../components/IntelligenceCards'


// ── Bridge: physical metric keys → competition disciplines ───────────
// Maps metric_key from athlete_metrics to a discipline string that
// disciplineScience.js / historicalRivals.js understand.
const METRIC_TO_DISCIPLINE: Record<string, string> = {
  sprint_10m: '100m',   sprint_20m: '100m',   sprint_30m: '100m',
  sprint_40m: '100m',   sprint_60m: '100m',   sprint_100m: '100m',
  flying_10m: '100m',   flying_20m: '200m',   split_300m: '400m',
  broad_jump: 'Long Jump',
  cmj_height: 'High Jump', sj_height: 'High Jump',
}

// Priority order: which metric key is most representative for a discipline
const DISCIPLINE_METRIC_PRIORITY: Record<string, string[]> = {
  '100m': ['sprint_100m', 'sprint_60m', 'sprint_40m', 'sprint_30m', 'sprint_20m', 'sprint_10m'],
  '200m': ['flying_20m'],
  '400m': ['split_300m'],
  'Long Jump': ['broad_jump'],
  'High Jump': ['cmj_height'],
}

/**
 * From physical metrics, derive the best competition discipline + PB.
 * E.g. if user logged sprint_100m = 11.23, returns { discipline: '100m', pb: 11.23, races: [...] }
 */
function deriveCompetitionFromMetrics(
  metrics: any[],
  lowerSet: Set<string>
): { discipline: string | null; pb: number | null; races: { value: number; date: string }[] } {
  // Group metrics by discipline
  const byDisc: Record<string, { value: number; date: string; key: string }[]> = {}
  for (const m of metrics) {
    const disc = METRIC_TO_DISCIPLINE[m.metric_key]
    if (!disc) continue
    const val = parseFloat(m.value)
    if (!Number.isFinite(val)) continue
    if (!byDisc[disc]) byDisc[disc] = []
    byDisc[disc].push({ value: val, date: m.recorded_at, key: m.metric_key })
  }

  // Pick discipline with most data points
  let bestDisc: string | null = null
  let bestCount = 0
  for (const [disc, entries] of Object.entries(byDisc)) {
    if (entries.length > bestCount) {
      bestCount = entries.length
      bestDisc = disc
    }
  }
  if (!bestDisc) return { discipline: null, pb: null, races: [] }

  // For the chosen discipline, pick the most representative metric key
  const entries = byDisc[bestDisc]
  const priorityKeys = DISCIPLINE_METRIC_PRIORITY[bestDisc] || []
  let targetKey = entries[0].key
  for (const pk of priorityKeys) {
    if (entries.some((e) => e.key === pk)) { targetKey = pk; break }
  }

  // Filter to only entries with that key, build races array
  const keyEntries = entries.filter((e) => e.key === targetKey)
  const lower = lowerSet.has(targetKey)
  const races = keyEntries.map((e) => ({ value: e.value, date: e.date }))
  const pb = races.reduce(
    (best, r) => (best === null ? r.value : lower ? Math.min(best, r.value) : Math.max(best, r.value)),
    null as number | null
  )

  return { discipline: bestDisc, pb, races }
}

export default function HomeScreen() {
  const { profile, user } = useAuth()
  const { colors: c } = useTheme()
  const [metrics, setMetrics] = useState<any[]>([])
  const [performances, setPerformances] = useState<any[]>([])
  // athlete_profiles.discipline — user_profiles has NO discipline column, so
  // this row is the only place the athlete's stored event actually lives.
  const [storedDiscipline, setStoredDiscipline] = useState<string | null>(null)
  // Which discipline Home is currently showing (web calls this activeDiscipline).
  const [activeDiscipline, setActiveDiscipline] = useState<string | null>(null)
  const [persistedXP, setPersistedXP] = useState<number | null>(null)
  // First run. The event step is the one that matters: without it there is
  // no best, no level and no projection, and until now no way to set one.
  const [eventPickerOpen, setEventPickerOpen] = useState(false)
  // Reported up by CheckInCard, which already runs this query.
  const [hasCheckin, setHasCheckin] = useState(false)
  const [hasCoach, setHasCoach] = useState(false)
  const [openCheckin, setOpenCheckin] = useState(0)
  const [setupHidden, setSetupHidden] = useState(false)
  const setupKey = `@bnchmrkd_setup_hidden_${user?.id || 'anon'}`
  useEffect(() => {
    // Whether they have a coach at all — decides if the connect step is even
    // relevant, and it is the same RPC the sharing controls use.
    callRpc('my_coaches')
      .then((r: any) => setHasCoach(Array.isArray(r) && r.length > 0))
      .catch(() => {})
  }, [user?.id])
  useEffect(() => {
    AsyncStorage.getItem(setupKey).then((v: string | null) => setSetupHidden(v === '1')).catch(() => {})
  }, [setupKey])
  const [refreshing, setRefreshing] = useState(false)
  // Just enough to answer "what am I doing today" — the schedule tab owns the
  // full picture; this is a window onto the same model.
  const [todayPrograms, setTodayPrograms] = useState<any[]>([])
  const [todayEvents, setTodayEvents] = useState<any[]>([])
  const [todayLogs, setTodayLogs] = useState<any[]>([])
  // Anything a coach has sent that hasn't been answered, plus anything this
  // athlete logged that their coach hasn't approved yet. Zero for an athlete
  // with no coach, so the banner never appears for them.
  // Shared with the tab bar and with the coach side, so there is one answer
  // to "how many do I owe" rather than one per screen that mounts.
  const { count: pendingCount, refresh: refreshPending } = useApprovals()
  const [inboxOpen, setInboxOpen] = useState(false)
  const [fadeAnim] = useState(new Animated.Value(0))
  // Drives the hero's blur/parallax. Native-driven, so scrolling stays smooth.
  const scrollY = useRef(new Animated.Value(0)).current

  const loadData = useCallback(async () => {
    if (!user) return
    try {
      const [mets, perfs, athleteRows] = await Promise.all([
        selectFrom('athlete_metrics', {
          filter: `athlete_id=eq.${user.id}`,
          order: 'recorded_at.desc',
          limit: '500',
        }),
        selectFrom('performances', {
          filter: `user_id=eq.${user.id}`,
          order: 'competition_date.desc',
          limit: '50',
        }).catch((e) => { console.warn('[Home] performances query failed:', e.message); return [] }),
        selectFrom('athlete_profiles', { filter: `id=eq.${user.id}`, limit: '1' })
          .catch(() => []),
      ])
      setMetrics(mets || [])
      setPerformances(perfs || [])
      // Stored values have been seen with trailing whitespace ("100m "), which
      // silently fails every discipline lookup — normalise on the way in.
      setStoredDiscipline((athleteRows?.[0]?.discipline || '').trim() || null)
    } catch (e: any) {
      console.warn('[Home] Load failed:', e.message)
    }
  }, [user])

  useEffect(() => {
    loadData()
    refreshPending()
    Animated.timing(fadeAnim, {
      toValue: 1,
      duration: 600,
      useNativeDriver: true,
    }).start()
  }, [user])

  // ── Reload data when tab comes back into focus ──
  const navigation = useNavigation()
  useEffect(() => {
    const unsub = navigation.addListener('focus', () => {
      loadData()
    })
    return unsub
  }, [navigation, loadData])

  const onRefresh = async () => {
    setRefreshing(true)
    await Promise.all([loadData(), refreshPending()])
    setRefreshing(false)
  }

  // ── Computed data ──
  const totalLogs = metrics.length
  const recentLogs = metrics.slice(0, 8)

  // PBs per metric
  const pbMap: Record<string, { value: number; date: string }> = {}
  for (const m of metrics) {
    const key = m.metric_key
    const val = parseFloat(m.value)
    const lower = LOWER_IS_BETTER.has(key)
    if (!pbMap[key] || (lower ? val < pbMap[key].value : val > pbMap[key].value)) {
      pbMap[key] = { value: val, date: m.recorded_at }
    }
  }

  // Streak (use gamification engine for consistency)
  const logDateStrings = metrics.map((m) => m.recorded_at).filter(Boolean)
  const streakData = useMemo(() => calculateStreak(logDateStrings), [logDateStrings.length])
  const streak = streakData.current

  // Pull the persisted XP total (source of truth, written by LogScreen) so the
  // Home XP bar matches what the athlete actually earned across devices.
  useEffect(() => {
    if (!user) return
    let cancelled = false
    loadProgress(user.id).then((p) => {
      if (!cancelled && p && p.bootstrapped) setPersistedXP(p.totalXP)
    })
    return () => { cancelled = true }
  }, [user, metrics.length])

  // ── Today ────────────────────────────────────────────────────────
  useEffect(() => {
    if (!user) return
    let cancelled = false
    const week = mondayOf(todayDay())
    Promise.all([
      selectFrom('programs', {
        filter: `athlete_user_id=eq.${user.id}&status=eq.active`, order: 'created_at.desc',
      }).catch(() => []),
      fetchEvents(user.id, todayDay(), todayDay()).catch(() => []),
      selectFrom('program_session_logs', {
        filter: `athlete_id=eq.${user.id}&week_start=eq.${week}`, limit: '200',
      }).catch(() => []),
    ]).then(([p, e, l]) => {
      if (cancelled) return
      setTodayPrograms(Array.isArray(p) ? p : [])
      setTodayEvents(Array.isArray(e) ? e : [])
      setTodayLogs(Array.isArray(l) ? l : [])
    })
    return () => { cancelled = true }
  }, [user])

  const todayCell = useMemo(() => {
    const week = buildWeek({
      weekStart: mondayOf(todayDay()),
      programs: todayPrograms, sessionLogs: todayLogs, events: todayEvents,
    })
    return week.days.find((d) => d.isToday) || null
  }, [todayPrograms, todayLogs, todayEvents])

  const todayBlock = useMemo(() => {
    for (const p of todayPrograms) {
      const b = blockWeekFor(p, mondayOf(todayDay()))
      if (b) return b
    }
    return null
  }, [todayPrograms])

  // ── XP + Gamification stats ──
  const gamStats = useMemo((): UserStats => {
    const uniqueKeys = new Set(metrics.map((m) => m.metric_key))
    const catSet = new Set<string>()
    for (const k of uniqueKeys) {
      if (k.startsWith('sprint_') || k.startsWith('flying_') || k.startsWith('split_') || k.startsWith('max_velocity')) catSet.add('speed')
      else if (k.startsWith('cmj_') || k.startsWith('sj_') || k.startsWith('eur') || k.startsWith('broad_') || k.startsWith('rsi_')) catSet.add('power')
      else if (k.startsWith('back_squat') || k.startsWith('front_squat') || k.startsWith('deadlift') || k.startsWith('bench_') || k.startsWith('power_clean') || k.startsWith('snatch_') || k.startsWith('hip_thrust') || k.startsWith('imtp_peak') || k.startsWith('imtp_rel') || k.startsWith('pullup') || k.startsWith('weighted_')) catSet.add('strength')
      else if (k.startsWith('vo2') || k.startsWith('yoyo_') || k.startsWith('iftt_') || k.startsWith('mas') || k.startsWith('tt_') || k.startsWith('bronco') || k.startsWith('rhr') || k.startsWith('hrv_') || k.startsWith('hr_recovery')) catSet.add('endurance')
      else if (k.startsWith('sit_and_') || k.startsWith('knee_to_') || k.startsWith('thomas_') || k.startsWith('aslr_') || k.startsWith('shoulder_') || k.startsWith('overhead_') || k.startsWith('fms_') || k.startsWith('adductor_')) catSet.add('mobility')
      else if (k.startsWith('body_mass') || k.startsWith('standing_') || k.startsWith('sitting_') || k.startsWith('wingspan') || k.startsWith('body_fat') || k.startsWith('sum_7_') || k.startsWith('lean_mass') || k.startsWith('fat_mass')) catSet.add('anthropometrics')
    }
    const today = new Date().toISOString().slice(0, 10)
    const logsToday = metrics.filter((m) => m.recorded_at?.startsWith(today)).length
    return {
      totalLogs: metrics.length,
      totalPBs: Object.keys(pbMap).length,
      currentStreak: streakData.current,
      longestStreak: streakData.longest,
      categoriesLogged: catSet.size,
      // Prefer the persisted total; fall back to an approximation until the
      // athlete_progress row loads (or for brand-new users).
      totalXP: persistedXP ?? (metrics.length * 25 + Object.keys(pbMap).length * 10),
      daysActive: new Set(metrics.map((m) => m.recorded_at?.slice(0, 10))).size,
      logsToday,
      uniqueMetrics: uniqueKeys.size,
    }
  }, [metrics, pbMap, streakData, persistedXP])

  // Build DNA profile
  const metricsForDna = metrics.map((m) => ({
    metric_key: m.metric_key,
    metric_label: m.metric_key?.replace(/_/g, ' '),
    value: m.value,
    unit: m.unit,
    recorded_at: m.recorded_at,
  }))
  const dnaProfile = buildDnaProfile(metricsForDna)

  const dnaAxes = RADAR_AXES.map((axis: any) => {
    const data = (dnaProfile as Record<string, any>)[axis.key]
    const score = data?.score ?? null
    const tier = score != null ? scoreToTier(score) : undefined
    return { key: axis.key, label: axis.label, score, tier }
  })

  const activeAxes = dnaAxes.filter((a) => a.score != null)
  const overallScore =
    activeAxes.length >= 3
      ? Math.round(activeAxes.reduce((s, a) => s + a.score!, 0) / activeAxes.length)
      : null
  const overallTier = overallScore != null ? scoreToTier(overallScore) : undefined

  // Limiting factor
  const limitingFactor = findLimitingFactor(dnaProfile, null, null)

  // ── Competition data (with metric bridge fallback) ──────────────────
  // Priority: 1) actual performances table, 2) physical metrics that map to disciplines
  // Every discipline this athlete has actually competed in, most recent first.
  // `performances` is ordered competition_date.desc, so first-seen == latest.
  const availableDisciplines = useMemo(() => {
    const seen: string[] = []
    for (const p of performances) {
      const d = (p.discipline || '').trim()
      if (d && !seen.some((x) => x.toLowerCase() === d.toLowerCase())) seen.push(d)
    }
    return seen
  }, [performances])

  // The discipline Home is showing: an explicit pick wins, else the athlete's
  // stored event (if they have results in it), else their most recent event.
  const perfDiscipline = useMemo(() => {
    if (activeDiscipline) return activeDiscipline
    const stored = storedDiscipline
    if (stored && availableDisciplines.some((d) => d.toLowerCase() === stored.toLowerCase())) return stored
    return availableDisciplines[0] || stored || null
  }, [activeDiscipline, storedDiscipline, availableDisciplines])

  // CRITICAL: filter to the active discipline. Without this a 60m result and a
  // 100m result land on the same trend line and gauge, which makes a 60m PB
  // look like a 3-second improvement on a 100m.
  const perfRaces = useMemo(() => {
    const want = (perfDiscipline || '').trim().toLowerCase()
    return performances
      .filter((p: any) => !want || (p.discipline || '').trim().toLowerCase() === want)
      // A DNF, a DQ'd time and a wind-assisted mark all reach this screen and
      // none of them may set the PB the gauge is anchored on or bend the
      // trend line. Number.isFinite alone does not catch the last two.
      .filter((p: any) => countsForAnalysis(p, p.discipline))
      .map((p: any) => ({
        value: parseFloat(p.mark),
        date: p.competition_date || p.created_at,
        competition: p.competition_name || null,
      }))
      .filter((r) => Number.isFinite(r.value))
  }, [performances, perfDiscipline])

  const sex = profile?.sex || 'M'
  const age = ageFromDob(profile?.dob)
  // PB direction depends on the event. This asked isThrowsDiscipline, whose
  // list contains no JUMPS — so a long jumper's PB was their SHORTEST jump,
  // here and in every chart fed from this view.
  const higherIsBetter = !isLowerBetter(perfDiscipline)
  const perfPb = perfRaces.length > 0
    ? perfRaces.reduce(
        (best, r) => (best === null ? r.value : higherIsBetter ? Math.max(best, r.value) : Math.min(best, r.value)),
        null as number | null,
      )
    : null

  // Fallback: derive from physical metrics when no competition data
  const metricDerived = useMemo(
    () => deriveCompetitionFromMetrics(metrics, LOWER_IS_BETTER),
    [metrics]
  )

  // Use competition data if available, otherwise use metric-derived data
  const discipline = perfDiscipline || metricDerived.discipline
  const competitionPb = perfPb ?? metricDerived.pb
  const races = perfRaces.length > 0 ? perfRaces : metricDerived.races

  // Shape the race data the way the Oura sections expect. `chartData` is
  // chronological (oldest → newest) for the trend line; `sortedDesc` is
  // newest-first, and its extreme anchors the gauge's "season worst" end.
  const homeView = useMemo<HomeView>(() => {
    const valid = (races || [])
      .filter((r: any) => Number.isFinite(Number(r.value)) && r.date)
      .map((r: any) => ({ value: Number(r.value), date: r.date, competition: r.competition ?? null }))
    const asc = [...valid].sort((a, b) => new Date(a.date).getTime() - new Date(b.date).getTime())
    const desc = [...asc].reverse()
    return {
      discipline,
      pb: competitionPb,
      higherIsBetter: !isLowerBetter(discipline),
      lastRace: desc[0] || null,
      sortedDesc: desc,
      chartData: asc.map((r) => ({ date: r.date, value: r.value })),
    }
  }, [races, discipline, competitionPb])

  // Sparkline data per metric (last 7 values, chronological)
  const sparklineData: Record<string, number[]> = {}
  const metricsByKey: Record<string, any[]> = {}
  for (const m of metrics) {
    if (!metricsByKey[m.metric_key]) metricsByKey[m.metric_key] = []
    metricsByKey[m.metric_key].push(m)
  }
  for (const [key, logs] of Object.entries(metricsByKey)) {
    sparklineData[key] = logs
      .slice(0, 7)
      .reverse()
      .map((l) => parseFloat(l.value))
  }

  // ── The tier band the gauge runs between ─────────────────────────
  // Both ends come from the tier table for this event, sex and age group, so
  // the arc means the same thing week to week. Null when we hold no tiers for
  // the event — the hero then falls back to the range strip, which builds an
  // axis from the athlete's own marks and says so.
  const tierBand = useMemo<TierBand | null>(() => {
    if (!discipline || competitionPb == null) return null
    const ageGroup = age ? getAgeGroup(age) : 'Senior'
    const t: any = getTier(discipline, sex, ageGroup, competitionPb)
    if (!t || t.currentCut == null) return null
    return {
      currentCut: t.currentCut,
      nextCut: t.nextCut,
      tierName: t.tierName,
      nextTierName: t.nextTierName,
      color: t.color,
      atTop: t.nextCut == null,
      floorIsSynthetic: !!t.floorIsSynthetic,
    }
  }, [discipline, competitionPb, sex, age])

  const today = new Date().toLocaleDateString('en-GB', {
    weekday: 'long', day: 'numeric', month: 'long',
  })

  return (
    // The photograph is the screen. It sits BEHIND the scroll view rather than
    // inside it, so content slides over the image instead of dragging it along.
    <View style={{ flex: 1, backgroundColor: BACKDROP_GROUND }}>
      <ScreenBackdrop scrollY={scrollY} />
      <SafeAreaView style={{ flex: 1 }} edges={['top', 'left', 'right']}>
      {/* Persistent top bar — identity + the way into Profile, as on web. */}
      <AppHeader onImage />
      <Animated.ScrollView
        style={[styles.scroll, { opacity: fadeAnim, backgroundColor: 'transparent' }]}
        contentContainerStyle={styles.content}
        refreshControl={
          <RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor={c.accent[500]} />
        }
        showsVerticalScrollIndicator={false}
        scrollEventThrottle={16}
        onScroll={Animated.event(
          [{ nativeEvent: { contentOffset: { y: scrollY } } }],
          { useNativeDriver: true },
        )}
      >
        {/* Anything awaiting an answer comes before anything to read. */}
        {/* Before anything else on a new account: every panel underneath is
            empty until the event is set, and nothing else explained why. */}
        <GetStartedCard
          steps={athleteSteps({
            hasEvent: !!storedDiscipline,
            hasResult: performances.length > 0,
            hasCheckin,
            hasCoach,
          })}
          // Home has its own Daily check-in row, so the card does not
          // promote a check-in on top of it.
          alreadyOffered={['checkin']}
          dismissed={setupHidden}
          onDismiss={() => {
            setSetupHidden(true)
            AsyncStorage.setItem(setupKey, '1').catch(() => {})
          }}
          onAct={(step) => {
            // A switch on the id, not a chain of route checks. The chain
            // handled 'Log' and 'Profile' and silently fell through for the
            // check-in step, whose route is 'Home' — the button rendered, the
            // press registered, and nothing happened. The default case below
            // makes that a compile error rather than a dead button: add a
            // step id without handling it and the default case says so out
            // loud instead of doing nothing. (It cannot be a compile-time
            // exhaustiveness check while StepId spans both roles — the coach
            // ids are in the same union and would never be handled here.)
            switch (step.id) {
              case 'event':
                setEventPickerOpen(true)
                break
              case 'result':
                navigation.navigate('Log' as never)
                break
              case 'checkin':
                // The check-in is not a screen — it is the card further down
                // this same screen. Open its sheet directly.
                setOpenCheckin((n) => n + 1)
                break
              case 'coach':
                navigation.navigate('Profile' as never)
                break
              default: {
                const unhandled: never = step.id as never
                console.warn('Get started step with no action:', unhandled)
              }
            }
          }}
        />

        <ApprovalBanner count={pendingCount} onPress={() => { tapFeedback(); setInboxOpen(true) }} />

        {/* ── Pending coach requests (only renders if any) ── */}
        <View style={{ marginTop: spacing.md }}>
          <AthleteCoachLinks pendingOnly />
        </View>

        {/* ── Date line ────────────────────────────────────────────
            What the greeting used to be, carrying something. A 10px
            "GOOD MORNING, KEENAN" in muted grey was the smallest text on
            the screen and told the athlete nothing they did not know. */}
        <View style={styles.dateRow}>
          <Text style={styles.dateText}>{today}</Text>
          {streak > 0 && <GamStreakChip streak={streak} />}
        </View>

        {/* ══ 1 · THE MARK ══════════════════════════════════════════
            No card. `surface: 'hero'` exists for exactly one block per
            screen and this is it — the number the app is for. */}
        <Stagger index={0}>
          {homeView.lastRace && homeView.pb != null ? (
            <PerformanceHero
              view={homeView}
              disciplines={availableDisciplines}
              onSelectDiscipline={setActiveDiscipline}
              scrollY={scrollY}
              band={tierBand}
            />
          ) : (
            // PerformanceHero returns null without a mark, and the block it
            // leads is the one the screen is built around — so the empty case
            // needs a shape of its own rather than a hole. Same position, same
            // weight, one thing to do.
            <Tappable
              onPress={() => { tapFeedback(); navigation.navigate('Log' as never) }}
              accessibilityLabel="No result yet. Log your first one."
              style={styles.heroEmpty}
            >
              <Text style={styles.heroEmptyMark}>—</Text>
              <Text style={styles.heroEmptyTitle}>No result yet</Text>
              <Text style={styles.heroEmptyBody}>
                Log a race or a test and this becomes your mark.
              </Text>
            </Tappable>
          )}
        </Stagger>

        {/* The corpus, on Home for the first time. A tier arc is something
            any app can draw; what happened to the other people who were
            here is not. Past tense, other people, and silent below four
            comparable careers. */}
        {homeView.pb != null && (
          <CorpusLine
            discipline={discipline}
            sex={sex}
            age={age}
            mark={homeView.pb}
            target={tierBand?.nextCut ?? null}
            lowerBetter={isLowerBetter(discipline)}
            valueFmt={(v) => formatMark(v, discipline)}
            onOpen={() => navigation.navigate('Trajectory' as never)}
          />
        )}

        {/* ══ 2 · TODAY ═════════════════════════════════════════════
            The session and the check-in, in one card. They were two, and
            they are one moment: you look at what you are about to do and
            you say how you feel about it. The card survives a rest day
            because the check-in still needs answering on one. */}
        <Stagger index={1}>
          <TodayCard
            day={todayCell}
            block={todayBlock}
            onOpen={() => navigation.navigate('Programs' as never)}
            footer={
              <CheckInCard
                athleteId={user?.id}
                onImage
                bare
                onState={setHasCheckin}
                openSignal={openCheckin}
              />
            }
          />
        </Stagger>

        {/* ══ 3 · WHERE YOU STAND ═══════════════════════════════════
            Silent unless there is a real position. Boards owns the
            reasons; Home owns the one number. */}
        <Stagger index={2}>
          <HomeStanding
            discipline={discipline}
            onOpen={() => { tapFeedback(); navigation.navigate('Boards' as never) }}
          />
        </Stagger>

        {/* ══ 4 · SINCE YOU WERE HERE ═══════════════════════════════
            REMOVED from Home and why:
              MetricRail      → Profile. It is a profile, not a headline,
                                and it read the same `metrics` array the
                                DNA strip did — the same data drawn twice.
              DnaStrip        → Profile, where it already rendered. It was
                                on screen twice within two taps.
              RaceTrendCard   → Trajectory owns history; the hero already
                                carries the last mark and its delta.
              Greeting        → AppHeader carries identity.
              WhereYouStand   → Trajectory has TierPositioning
              RivalCard       → Trajectory has SimilarAthletes
              WhatIfExplorer  → Trajectory has ImprovementScenarios
              ScienceSpotlight→ Trajectory
              XP bar          → a level chip in AppHeader
              Recent activity,
              Weekly recap,
              Daily insight   → folded into Since-last-visit
            ──────────────────────────────────────────────────────── */}
        <Stagger index={3}>
          <SectionLabel color={onImage.dim}>Since you were here</SectionLabel>
          <SinceLastVisit metrics={metrics} performances={performances} onImage />
        </Stagger>

        {/* The tab bar floats over the content now, so the feed has to end
            above it rather than behind it. */}
        <View style={{ height: TAB_BAR_CLEARANCE }} />
      </Animated.ScrollView>

      <EventPickerSheet
        visible={eventPickerOpen}
        userId={user?.id}
        initial={storedDiscipline ? [storedDiscipline] : []}
        onClose={() => setEventPickerOpen(false)}
        onSaved={(events) => { setStoredDiscipline(events[0]); loadData() }}
      />

      <ApprovalInbox
        visible={inboxOpen}
        userId={user?.id}
        onClose={() => setInboxOpen(false)}
        // An answer changes what counts: an approved result becomes eligible
        // for a PB, an accepted program starts generating sessions. Both are
        // read by loadData, so the screen behind has to refetch.
        onChanged={() => { refreshPending(); loadData() }}
      />

      </SafeAreaView>
    </View>
  )
}

// TrainingInsight replaced by SmartDailyInsight from IntelligenceCards

function formatDate(iso: string): string {
  try {
    const d = new Date(iso)
    const diff = Date.now() - d.getTime()
    const days = Math.floor(diff / 86400000)
    if (days === 0) return 'Today'
    if (days === 1) return 'Yesterday'
    if (days < 7) return `${days} days ago`
    return d.toLocaleDateString('en-GB', { day: 'numeric', month: 'short' })
  } catch { return '' }
}

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: colors.bg.primary },
  scroll: { flex: 1 },
  content: { padding: spacing.lg, paddingTop: spacing.sm },

  // The date line the greeting became. Sentence case at reading size, not a
  // tracked-out 10px label — it is a sentence, so it is set like one.
  dateRow: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between',
    marginBottom: spacing.sm, paddingTop: spacing.xs, minHeight: 26,
  },
  // The empty hero. Same slot and roughly the same height as the real one, so
  // the screen does not reflow the day an athlete logs their first mark.
  heroEmpty: { alignItems: 'center', paddingVertical: spacing.xl, marginBottom: spacing.lg },
  heroEmptyMark: {
    fontSize: typeScale.mark, lineHeight: 60, fontWeight: weight.bold,
    color: 'rgba(255,255,255,0.22)', letterSpacing: -2.4,
  },
  heroEmptyTitle: {
    fontSize: typeScale.title, fontWeight: weight.bold, color: onImage.ink, marginTop: 4,
  },
  heroEmptyBody: {
    fontSize: typeScale.body, color: onImage.muted, marginTop: 4, textAlign: 'center',
  },
  dateText: {
    fontSize: typeScale.body, fontWeight: weight.medium, color: onImage.muted,
    letterSpacing: -0.1,
  },
  clubText: {
    fontSize: typeScale.label, letterSpacing: 1.5, textTransform: 'uppercase',
    color: colors.text.muted, marginTop: 4, fontWeight: weight.medium,
  },

  // Limiting Factor
  limitingRow: { flexDirection: 'row', gap: 14, alignItems: 'flex-start' },
  limitingIconWrap: {
    width: 40, height: 40, borderRadius: radius.control,
    backgroundColor: 'rgba(245,158,11,0.1)',
    alignItems: 'center', justifyContent: 'center', marginTop: 2,
  },
  limitingAxis: { color: colors.text.primary, fontSize: typeScale.body, fontWeight: weight.bold },
  limitingScore: { color: colors.text.secondary, fontSize: typeScale.caption, marginTop: 2 },
  limitingDesc: { color: colors.text.secondary, fontSize: typeScale.caption, lineHeight: 19, marginTop: 6 },

  // Activity feed
  activityRow: {
    flexDirection: 'row', alignItems: 'center',
    paddingVertical: 11, borderBottomWidth: 1,
    borderBottomColor: 'rgba(255,255,255,0.03)', gap: 8,
  },
  activityDot: { width: 20, height: 20, alignItems: 'center', justifyContent: 'center' },
  dotInner: { width: 6, height: 6, borderRadius: radius.full, backgroundColor: 'rgba(255,255,255,0.2)' },
  activityTitleRow: { flexDirection: 'row', alignItems: 'center', gap: 6 },
  activityLabel: { color: colors.text.primary, fontSize: typeScale.body, fontWeight: weight.medium, textTransform: 'capitalize' },
  activityDate: { color: colors.text.dimmed, fontSize: typeScale.label, marginTop: 2 },
  activityValue: { color: colors.orange[400], fontSize: typeScale.body, fontWeight: weight.bold },
  activityUnit: { fontSize: typeScale.label, fontWeight: weight.regular, color: colors.text.muted },
  pbBadge: {
    backgroundColor: colors.green + '20', borderRadius: radius.hair,
    paddingHorizontal: 6, paddingVertical: 2,
    borderWidth: 1, borderColor: colors.green + '40',
  },
  pbText: { color: colors.green, fontSize: typeScale.micro, fontWeight: weight.bold, letterSpacing: 1 },

  // Insight
  insightRow: { flexDirection: 'row', gap: 12, alignItems: 'flex-start' },
  insightIcon: { fontSize: typeScale.stat, marginTop: 2 },
  insightText: { color: colors.text.secondary, fontSize: typeScale.body, lineHeight: 21, flex: 1 },
})
