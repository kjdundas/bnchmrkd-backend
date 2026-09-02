// ═══════════════════════════════════════════════════════════════════════
// HOME SCREEN — The athlete's dashboard.
// Home is the DAILY loop and nothing else: am I okay today, and what was my
// last mark. It ends after ~2 screens on purpose.
//   coach requests → MetricRail → CheckInCard → PerformanceHero →   (rings first)
//   discipline switcher → race trend → since-last-visit
//
// Exploration lives on Trajectory (per-discipline analysis) and physical
// profile on Profile. See the block comment mid-file for what moved where.
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
  ScrollView,
} from 'react-native'
import { SafeAreaView } from 'react-native-safe-area-context'
import { useNavigation } from '@react-navigation/native'
import { Ionicons } from '@expo/vector-icons'
import { colors, spacing, onImage } from '../lib/theme'
import { useAuth } from '../contexts/AuthContext'
import { useTheme } from '../contexts/ThemeContext'
import { selectFrom, callRpc } from '../lib/supabase'
import { AlmanacCard, MonoKicker, EmptyState, Stagger, SectionLabel } from '../components/ui'
import {
  RivalCard,
  WhereYouStand,
  ScienceSpotlight,
  SinceLastVisit,
  WeeklyRecap,
  Sparkline,
} from '../components/HomeSections'
import { XPBar, StreakChip as GamStreakChip } from '../components/GamificationUI'
import AthleteCoachLinks from '../components/AthleteCoachLinks'
import AppHeader from '../components/AppHeader'
import { TAB_BAR_CLEARANCE } from '../navigation/FloatingTabBar'
import CheckInCard from '../components/CheckInCard'
import DnaStrip from '../components/DnaCard'
import ScreenBackdrop, { BACKDROP_GROUND } from '../components/ScreenBackdrop'
import { PerformanceHero, RaceTrendCard, MetricRail, type HomeView, type TierBand } from '../components/OuraSections'
import { LOWER_IS_BETTER, groupMetrics } from '../lib/metricSemantics'
import { isLowerBetter } from '../lib/disciplineScience'
import { countsForAnalysis } from '../lib/resultSemantics'
import TodayCard from '../components/TodayCard'
import { buildWeek, blockWeekFor, mondayOf, todayDay } from '../lib/schedule'
import { fetchEvents } from '../lib/events'
import IndicatorPicker from '../components/IndicatorPicker'
import { loadIndicators, saveIndicators } from '../lib/indicators'
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
  NextMilestone,
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
  // Which rings the athlete has chosen for the rail, and the picker that
  // edits them. Empty means automatic — see src/lib/indicators.ts.
  const [indicators, setIndicators] = useState<string[]>([])
  const [pickerFor, setPickerFor] = useState<string | null>(null)
  const [pickerOpen, setPickerOpen] = useState(false)
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

  // The saved indicator order. Read once per athlete; the rail falls back to
  // its automatic order while this is in flight, so a slow read never leaves
  // the rings blank.
  useEffect(() => {
    if (!user) { setIndicators([]); return }
    let cancelled = false
    loadIndicators(user.id).then((keys) => { if (!cancelled) setIndicators(keys) })
    return () => { cancelled = true }
  }, [user])

  // Written through on every edit rather than on dismiss: the sheet can be
  // swiped away, and a swipe is not a cancel.
  const changeIndicators = useCallback((keys: string[]) => {
    setIndicators(keys)
    if (user) saveIndicators(user.id, keys)
  }, [user])

  // The picker lists what the athlete has actually logged, in the same
  // automatic order the rail would use.
  const metricGroups = useMemo(() => groupMetrics(metrics), [metrics])

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

  // Greeting
  const hour = new Date().getHours()
  const greeting = hour < 12 ? 'Good morning' : hour < 18 ? 'Good afternoon' : 'Good evening'
  const firstName = profile?.full_name?.split(' ')[0] || 'Athlete'

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
          dismissed={setupHidden}
          onDismiss={() => {
            setSetupHidden(true)
            AsyncStorage.setItem(setupKey, '1').catch(() => {})
          }}
          onAct={(step) => {
            if (step.id === 'event') setEventPickerOpen(true)
            else if (step.route === 'Log') navigation.navigate('Log' as never)
            else if (step.route === 'Profile') navigation.navigate('Profile' as never)
          }}
        />

        <ApprovalBanner count={pendingCount} onPress={() => { tapFeedback(); setInboxOpen(true) }} />

        {/* ── Greeting line (identity moved to AppHeader) ── */}
        <View style={styles.greetingSection}>
          <View style={styles.greetingTopRow}>
            <View style={{ flex: 1 }}>
              <MonoKicker color="rgba(255,255,255,0.62)">{greeting + ', ' + firstName}</MonoKicker>
            </View>
            {streak > 0 && <GamStreakChip streak={streak} />}
          </View>
        </View>

        {/* ── Pending coach requests (only renders if any) ── */}
        <View style={{ marginTop: spacing.md }}>
          <AthleteCoachLinks pendingOnly />
        </View>

        {/* ══ Oura-style top: rail → check-in → hero → trend cards ══
            Order mirrors the web HomeView so both apps read the same. */}
        {/* Rings first, in the sky. They were nested inside PerformanceHero,
            which had two problems: they sat below the check-in bar, and they
            vanished entirely for any athlete with no race result — the hero
            returns null without one, taking the day's readings with it. They
            are their own block now. */}
        {!!metrics.length && (
          <Stagger index={0}>
            <MetricRail
              metrics={metrics}
              onDarkSurface
              withLightPool
              order={indicators}
              discipline={perfDiscipline || activeDiscipline || storedDiscipline}
              onCustomise={(key) => { setPickerFor(key); setPickerOpen(true) }}
            />
          </Stagger>
        )}

        {/* What is actually happening today, before any of the retrospective
            material below it. */}
        <Stagger index={1}>
          <TodayCard
            day={todayCell}
            block={todayBlock}
            onOpen={() => navigation.navigate('Programs' as never)}
          />
        </Stagger>

        <Stagger index={2}><CheckInCard athleteId={user?.id} onImage onState={setHasCheckin} /></Stagger>

        <Stagger index={2}>
          <PerformanceHero
            view={homeView}
            disciplines={availableDisciplines}
            onSelectDiscipline={setActiveDiscipline}
            scrollY={scrollY}
            band={tierBand}
          />
        </Stagger>

        <Stagger index={4}>
          <RaceTrendCard view={homeView} onLog={() => navigation.navigate('Log' as never)} onImage />
        </Stagger>

        {/* Athlete DNA — compact by design. One tap opens the full ladder and
            the tests behind it in a sheet, which keeps the daily screen short
            without burying the feature. */}
        <Stagger index={5}>
          <DnaStrip
            metrics={metrics}
            discipline={discipline}
            dob={profile?.dob}
            onLog={() => navigation.navigate('Log' as never)}
            onImage
          />
        </Stagger>

        {/* ── Since you were last here ──────────────────────────────
            The only ambient block that stays on Home. Recent activity, the
            weekly recap and the daily insight were three more full cards
            saying overlapping things; this is the digest.

            REMOVED from Home and why:
              WhereYouStand   → Trajectory already has TierPositioning +
                                CompetitionLadder for the same question
              RivalCard       → Trajectory has SimilarAthletes
              WhatIfExplorer  → Trajectory has ImprovementScenarios
              NextMilestone   → covered by Trajectory's tier positioning
              DNA ladder,
              Limiting factor → moved to Profile (physical, not per-race)
              ScienceSpotlight→ moved to Trajectory
              XP bar          → now a level chip in AppHeader
              Recent activity,
              Weekly recap,
              Daily insight   → folded into Since-last-visit
            ──────────────────────────────────────────────────────────── */}
        <Stagger index={6}>
          <SectionLabel color={onImage.dim}>Since you were last here</SectionLabel>
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

      <IndicatorPicker
        visible={pickerOpen}
        onClose={() => setPickerOpen(false)}
        groups={metricGroups}
        chosen={indicators}
        onChange={changeIndicators}
        focusKey={pickerFor}
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

  greetingSection: { marginBottom: spacing.md, paddingTop: spacing.sm },
  greetingTopRow: {
    flexDirection: 'row', alignItems: 'flex-start', justifyContent: 'space-between',
  },
  greetingName: {
    fontSize: 28, fontWeight: '700', color: colors.text.primary,
    marginTop: 4, letterSpacing: -0.5,
  },
  clubText: {
    fontSize: 11, letterSpacing: 1.5, textTransform: 'uppercase',
    color: colors.text.muted, marginTop: 4, fontWeight: '600',
  },

  // Limiting Factor
  limitingRow: { flexDirection: 'row', gap: 14, alignItems: 'flex-start' },
  limitingIconWrap: {
    width: 40, height: 40, borderRadius: 12,
    backgroundColor: 'rgba(245,158,11,0.1)',
    alignItems: 'center', justifyContent: 'center', marginTop: 2,
  },
  limitingAxis: { color: colors.text.primary, fontSize: 16, fontWeight: '700' },
  limitingScore: { color: colors.text.secondary, fontSize: 12, marginTop: 2 },
  limitingDesc: { color: colors.text.secondary, fontSize: 13, lineHeight: 19, marginTop: 6 },

  // Activity feed
  activityRow: {
    flexDirection: 'row', alignItems: 'center',
    paddingVertical: 11, borderBottomWidth: 1,
    borderBottomColor: 'rgba(255,255,255,0.03)', gap: 8,
  },
  activityDot: { width: 20, height: 20, alignItems: 'center', justifyContent: 'center' },
  dotInner: { width: 6, height: 6, borderRadius: 3, backgroundColor: 'rgba(255,255,255,0.2)' },
  activityTitleRow: { flexDirection: 'row', alignItems: 'center', gap: 6 },
  activityLabel: { color: colors.text.primary, fontSize: 14, fontWeight: '500', textTransform: 'capitalize' },
  activityDate: { color: colors.text.dimmed, fontSize: 11, marginTop: 2 },
  activityValue: { color: colors.orange[400], fontSize: 16, fontWeight: '700' },
  activityUnit: { fontSize: 11, fontWeight: '400', color: colors.text.muted },
  pbBadge: {
    backgroundColor: colors.green + '20', borderRadius: 4,
    paddingHorizontal: 6, paddingVertical: 2,
    borderWidth: 1, borderColor: colors.green + '40',
  },
  pbText: { color: colors.green, fontSize: 9, fontWeight: '800', letterSpacing: 1 },

  // Insight
  insightRow: { flexDirection: 'row', gap: 12, alignItems: 'flex-start' },
  insightIcon: { fontSize: 22, marginTop: 2 },
  insightText: { color: colors.text.secondary, fontSize: 14, lineHeight: 21, flex: 1 },
})
