// ═══════════════════════════════════════════════════════════════════════
// HOME SCREEN — The athlete's dashboard (full feature parity with web)
// TrajectoryHero → SinceLastVisit → WhereYouStand → RivalCard →
// AthleteDNALadder → LimitingFactor → ScienceSpotlight →
// RecentActivity → WeeklyRecap → DailyInsight
//
// KEY: Physical metrics (athlete_metrics) bridge to competition data.
// If user logs sprint_100m = 11.23s, that populates the Trajectory Hero
// as a "100m" PB, enabling WhereYouStand / RivalCard / etc.
// ═══════════════════════════════════════════════════════════════════════

import React, { useEffect, useState, useCallback, useMemo } from 'react'
import {
  View,
  Text,
  StyleSheet,
  RefreshControl,
  Animated,
} from 'react-native'
import { SafeAreaView } from 'react-native-safe-area-context'
import { useNavigation } from '@react-navigation/native'
import { Ionicons } from '@expo/vector-icons'
import { colors, spacing } from '../lib/theme'
import { useAuth } from '../contexts/AuthContext'
import { selectFrom } from '../lib/supabase'
import {
  AlmanacCard,
  MonoKicker,
  EmptyState,
} from '../components/ui'
import {
  TrajectoryHero,
  RivalCard,
  WhereYouStand,
  AthleteDNALadder,
  ScienceSpotlight,
  SinceLastVisit,
  WeeklyRecap,
  Sparkline,
} from '../components/HomeSections'
import { XPBar, StreakChip as GamStreakChip } from '../components/GamificationUI'
import { calculateStreak, type UserStats } from '../lib/gamification'
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

const LOWER_IS_BETTER = new Set([
  'sprint_10m', 'sprint_20m', 'sprint_30m', 'sprint_40m', 'sprint_60m',
  'sprint_100m', 'flying_10m', 'flying_20m', 'split_300m',
  'resting_hr', 'rhr', 'body_fat', 'body_fat_pct',
  'tt_1200m', 'tt_2km', 'bronco',
])

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
  const [metrics, setMetrics] = useState<any[]>([])
  const [performances, setPerformances] = useState<any[]>([])
  const [refreshing, setRefreshing] = useState(false)
  const [fadeAnim] = useState(new Animated.Value(0))

  const loadData = useCallback(async () => {
    if (!user) return
    try {
      const [mets, perfs] = await Promise.all([
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
      ])
      setMetrics(mets || [])
      setPerformances(perfs || [])
    } catch (e: any) {
      console.warn('[Home] Load failed:', e.message)
    }
  }, [user])

  useEffect(() => {
    loadData()
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
    await loadData()
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
      totalXP: metrics.length * 25 + Object.keys(pbMap).length * 10, // approximate — real XP tracked on save
      daysActive: new Set(metrics.map((m) => m.recorded_at?.slice(0, 10))).size,
      logsToday,
      uniqueMetrics: uniqueKeys.size,
    }
  }, [metrics, pbMap, streakData])

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
    const data = dnaProfile[axis.key]
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
  const perfRaces = performances.map((p: any) => ({
    value: parseFloat(p.mark || p.result),
    date: p.competition_date || p.created_at,
  })).filter((r) => Number.isFinite(r.value))

  const perfDiscipline = profile?.primary_discipline || performances[0]?.discipline || null
  const sex = profile?.sex || 'M'
  const perfPb = perfRaces.length > 0
    ? perfRaces.reduce((best, r) => (best === null ? r.value : Math.min(best, r.value)), null as number | null)
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

  // Greeting
  const hour = new Date().getHours()
  const greeting = hour < 12 ? 'Good morning' : hour < 18 ? 'Good afternoon' : 'Good evening'
  const firstName = profile?.full_name?.split(' ')[0] || 'Athlete'

  return (
    <SafeAreaView style={styles.safe}>
      <Animated.ScrollView
        style={[styles.scroll, { opacity: fadeAnim }]}
        contentContainerStyle={styles.content}
        refreshControl={
          <RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor={colors.orange[500]} />
        }
        showsVerticalScrollIndicator={false}
      >
        {/* ── Greeting + Gamification ── */}
        <View style={styles.greetingSection}>
          <View style={styles.greetingTopRow}>
            <View style={{ flex: 1 }}>
              <MonoKicker>{greeting}</MonoKicker>
              <Text style={styles.greetingName}>{firstName}</Text>
              {profile?.club && <Text style={styles.clubText}>{profile.club}</Text>}
            </View>
            {streak > 0 && <GamStreakChip streak={streak} />}
          </View>
        </View>

        {/* ── XP Progress ── */}
        <XPBar totalXP={gamStats.totalXP} />

        {/* ════════════════════════════════════════════════════
            NEXT MILESTONE — nearest meaningful target
            ════════════════════════════════════════════════ */}
        <NextMilestone
          dnaProfile={dnaProfile}
          discipline={discipline}
          pb={competitionPb}
          sex={sex}
        />

        {/* ════════════════════════════════════════════════════
            0. TRAJECTORY HERO — PB | SB | Last Race
            ════════════════════════════════════════════════ */}
        <TrajectoryHero
          races={races}
          pb={competitionPb}
          discipline={discipline}
          sex={sex}
          streak={streak}
        />

        {/* ════════════════════════════════════════════════════
            SINCE LAST VISIT — activity banner
            ════════════════════════════════════════════════ */}
        <SinceLastVisit metrics={metrics} performances={performances} />

        {/* ════════════════════════════════════════════════════
            1. WHERE YOU STAND — tier continuum
            ════════════════════════════════════════════════ */}
        <WhereYouStand pb={competitionPb} discipline={discipline} sex={sex} />

        {/* ════════════════════════════════════════════════════
            0b. RIVAL CARD — pacer comparison
            ════════════════════════════════════════════════ */}
        <RivalCard
          pb={competitionPb}
          discipline={discipline}
          sex={sex}
          dob={profile?.dob || null}
        />

        {/* ════════════════════════════════════════════════════
            2. DNA LADDER — sorted tiered bars
            ════════════════════════════════════════════════ */}
        <AthleteDNALadder
          metrics={metricsForDna}
          discipline={discipline}
          dob={profile?.dob || null}
        />

        {/* ════════════════════════════════════════════════════
            LIMITING FACTOR
            ════════════════════════════════════════════════ */}
        {limitingFactor && (
          <AlmanacCard kicker="FOCUS AREA" title="Limiting Factor" accent={colors.amber}>
            <View style={styles.limitingRow}>
              <View style={styles.limitingIconWrap}>
                <Ionicons name="warning" size={20} color={colors.amber} />
              </View>
              <View style={{ flex: 1 }}>
                <Text style={styles.limitingAxis}>{limitingFactor.axisLabel}</Text>
                <Text style={styles.limitingScore}>
                  Score: <Text style={{ color: colors.amber, fontWeight: '700' }}>{limitingFactor.score}</Text>
                </Text>
                <Text style={styles.limitingDesc}>
                  {limitingFactor.impactSeconds
                    ? `Improving this axis could save ~${limitingFactor.impactSeconds.toFixed(2)}s in sprints.`
                    : 'Your weakest axis — focus training here for the biggest gains.'}
                </Text>
              </View>
            </View>
          </AlmanacCard>
        )}

        {/* ════════════════════════════════════════════════════
            WHAT-IF SCENARIO EXPLORER
            ════════════════════════════════════════════════ */}
        <WhatIfExplorer
          dnaProfile={dnaProfile}
          discipline={discipline}
          pb={competitionPb}
          sex={sex}
          metrics={metrics}
        />

        {/* ════════════════════════════════════════════════════
            SCIENCE SPOTLIGHT
            ════════════════════════════════════════════════ */}
        <ScienceSpotlight discipline={discipline} />

        {/* ════════════════════════════════════════════════════
            RECENT ACTIVITY — with sparklines
            ════════════════════════════════════════════════ */}
        <AlmanacCard
          kicker="TRAINING LOG"
          title="Recent Activity"
          number={recentLogs.length > 0 ? `${recentLogs.length}` : undefined}
          accent={colors.teal}
        >
          {recentLogs.length === 0 ? (
            <EmptyState
              icon="📊"
              title="No logs yet"
              subtitle="Tap the Log tab to record your first metric and start building your trajectory."
            />
          ) : (
            recentLogs.map((log, i) => {
              const label = log.metric_key?.replace(/_/g, ' ') || 'Unknown'
              const val = parseFloat(log.value)
              const isPB = pbMap[log.metric_key]?.value === val
              const isLast = i === recentLogs.length - 1
              const sparkData = sparklineData[log.metric_key]
              return (
                <View
                  key={`${log.metric_key}_${i}`}
                  style={[styles.activityRow, isLast && { borderBottomWidth: 0 }]}
                >
                  <View style={styles.activityDot}>
                    <View
                      style={[
                        styles.dotInner,
                        isPB && { backgroundColor: colors.green, shadowColor: colors.green, shadowOpacity: 0.6, shadowRadius: 4 },
                      ]}
                    />
                  </View>
                  <View style={{ flex: 1 }}>
                    <View style={styles.activityTitleRow}>
                      <Text style={styles.activityLabel}>{label}</Text>
                      {isPB && (
                        <View style={styles.pbBadge}>
                          <Text style={styles.pbText}>PB</Text>
                        </View>
                      )}
                    </View>
                    <Text style={styles.activityDate}>
                      {formatDate(log.recorded_at || log.created_at)}
                    </Text>
                  </View>
                  {/* Sparkline */}
                  {sparkData && sparkData.length >= 2 && (
                    <View style={{ marginRight: 8 }}>
                      <Sparkline data={sparkData} color={isPB ? colors.green : colors.orange[400]} width={48} height={20} />
                    </View>
                  )}
                  <Text style={[styles.activityValue, isPB && { color: colors.green }]}>
                    {val}
                    <Text style={styles.activityUnit}> {log.unit || ''}</Text>
                  </Text>
                </View>
              )
            })
          )}
        </AlmanacCard>

        {/* ════════════════════════════════════════════════════
            WEEKLY RECAP
            ════════════════════════════════════════════════ */}
        <WeeklyRecap metrics={metrics} overallTier={overallTier} />

        {/* ════════════════════════════════════════════════════
            DAILY INSIGHT — Smart, data-driven
            ════════════════════════════════════════════════ */}
        <AlmanacCard kicker="DAILY INSIGHT" accent={colors.purple}>
          <SmartDailyInsight
            dnaProfile={dnaProfile}
            discipline={discipline}
            pb={competitionPb}
            sex={sex}
            totalLogs={totalLogs}
            streak={streak}
            metrics={metrics}
          />
        </AlmanacCard>

        <View style={{ height: 24 }} />
      </Animated.ScrollView>
    </SafeAreaView>
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
