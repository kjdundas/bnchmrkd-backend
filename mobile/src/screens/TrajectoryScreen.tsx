// ═══════════════════════════════════════════════════════════════════════
// TRAJECTORY SCREEN — Performance over time (premium brand)
// Category filter → Per-metric trajectory cards with AlmanacCard pattern
// Uses MonoKicker, AlmanacCard, glow effects, accent bars
// ═══════════════════════════════════════════════════════════════════════

import React, { useEffect, useState, useMemo, useCallback } from 'react'
import {
  View,
  Text,
  ScrollView,
  TouchableOpacity,
  StyleSheet,
  RefreshControl,
  Dimensions,
  Animated,
} from 'react-native'
import { SafeAreaView } from 'react-native-safe-area-context'
import { useNavigation } from '@react-navigation/native'
import { Ionicons } from '@expo/vector-icons'
import { colors, spacing, radius } from '../lib/theme'
import { useAuth } from '../contexts/AuthContext'
import { selectFrom } from '../lib/supabase'
import {
  AlmanacCard,
  HeroCard,
  GlassCard,
  MonoKicker,
  StatBlock,
  TrendArrow,
  EmptyState,
  Divider,
} from '../components/ui'
import LineChart from '../components/LineChart'
import { projectAllTrajectories } from '../lib/improvementCurves'
import { isLowerBetter } from '../lib/disciplineScience'

const { width: SCREEN_W } = Dimensions.get('window')

// ── LOWER_IS_BETTER — synced with LogScreen catalog ──
const LOWER_IS_BETTER = new Set([
  'sprint_10m', 'sprint_20m', 'sprint_30m', 'sprint_40m', 'sprint_60m',
  'sprint_100m', 'flying_10m', 'flying_20m', 'split_300m',
  'resting_hr', 'rhr', 'body_fat', 'body_fat_pct',
  'tt_1200m', 'tt_2km', 'bronco',
])

// ── Category mapping for filter pills — synced with LogScreen 58-metric catalog ──
const CATEGORIES = [
  { key: 'all', label: 'All', color: colors.text.secondary, icon: 'grid-outline' },
  { key: 'speed', label: 'Speed', color: colors.category.speed, icon: 'flash-outline', prefixes: ['sprint_', 'flying_', 'split_', 'max_velocity'] },
  { key: 'power', label: 'Power', color: colors.category.power, icon: 'rocket-outline', prefixes: ['cmj_', 'sj_height', 'eur', 'broad_jump', 'rsi_', 'imtp_rfd'] },
  { key: 'strength', label: 'Strength', color: colors.category.strength, icon: 'barbell-outline', prefixes: ['back_squat', 'front_squat', 'deadlift', 'bench_press', 'power_clean', 'snatch_', 'hip_thrust', 'imtp_peak', 'imtp_rel', 'pullup_', 'weighted_'] },
  { key: 'endurance', label: 'Endurance', color: colors.category.endurance, icon: 'heart-outline', prefixes: ['vo2', 'yoyo_', 'iftt_', 'mas', 'tt_', 'bronco', 'rhr', 'hrv_', 'hr_recovery'] },
  { key: 'mobility', label: 'Mobility', color: colors.category.mobility, icon: 'body-outline', prefixes: ['sit_and_', 'knee_to_wall', 'thomas_', 'aslr_', 'shoulder_flex', 'overhead_squat', 'fms_total', 'adductor_'] },
  { key: 'body', label: 'Body', color: colors.category.anthropometrics, icon: 'resize-outline', prefixes: ['body_mass', 'standing_height', 'sitting_height', 'wingspan', 'body_fat', 'sum_7_', 'lean_mass', 'fat_mass'] },
]

function metricCategory(key: string): string {
  for (const cat of CATEGORIES) {
    if (cat.prefixes?.some((p) => key.startsWith(p) || key === p)) return cat.key
  }
  return 'all'
}

function metricColor(key: string): string {
  const cat = CATEGORIES.find((c) => c.prefixes?.some((p) => key.startsWith(p) || key === p))
  return cat?.color || colors.orange[400]
}

function metricCategoryLabel(key: string): string {
  const cat = CATEGORIES.find((c) => c.prefixes?.some((p) => key.startsWith(p) || key === p))
  return cat?.label || 'General'
}

export default function TrajectoryScreen() {
  const { user, profile } = useAuth()
  const [allLogs, setAllLogs] = useState<any[]>([])
  const [performances, setPerformances] = useState<any[]>([])
  const [activeFilter, setActiveFilter] = useState('all')
  const [refreshing, setRefreshing] = useState(false)

  const loadData = async () => {
    if (!user) return
    try {
      const [logs, perfs] = await Promise.all([
        selectFrom('athlete_metrics', {
          filter: `athlete_id=eq.${user.id}`,
          order: 'recorded_at.desc',
          limit: '1000',
        }),
        selectFrom('performances', {
          filter: `user_id=eq.${user.id}`,
          order: 'competition_date.desc',
          limit: '50',
        }).catch(() => []),
      ])
      setAllLogs(logs || [])
      setPerformances(perfs || [])
    } catch (e) {
      console.warn('Trajectory load:', e)
    }
  }

  useEffect(() => { loadData() }, [user])

  // Reload when tab comes into focus
  const navigation = useNavigation()
  useEffect(() => {
    const unsub = navigation.addListener('focus', () => { loadData() })
    return unsub
  }, [navigation])

  const onRefresh = async () => {
    setRefreshing(true)
    await loadData()
    setRefreshing(false)
  }

  // Group by metric_key
  const grouped = useMemo(() => {
    const g: Record<string, any[]> = {}
    for (const log of allLogs) {
      if (!g[log.metric_key]) g[log.metric_key] = []
      g[log.metric_key].push(log)
    }
    return g
  }, [allLogs])

  // Filter by active category
  const filteredKeys = useMemo(() => {
    const keys = Object.keys(grouped).sort()
    if (activeFilter === 'all') return keys
    return keys.filter((k) => metricCategory(k) === activeFilter)
  }, [grouped, activeFilter])

  // Summary stats
  const totalMetrics = Object.keys(grouped).length
  const totalEntries = allLogs.length
  // Compute PB count client-side (is_pb not in DB)
  const pbKeys = new Set<string>()
  const pbTracker: Record<string, number> = {}
  for (const l of allLogs) {
    const k = l.metric_key
    const v = parseFloat(l.value)
    const lower = LOWER_IS_BETTER.has(k)
    if (!(k in pbTracker) || (lower ? v < pbTracker[k] : v > pbTracker[k])) {
      pbTracker[k] = v
    }
  }
  const pbCount = Object.keys(pbTracker).length

  const activeCat = CATEGORIES.find((c) => c.key === activeFilter)

  // ── Improvement Curve Projection ──
  const discipline = profile?.primary_discipline || performances[0]?.discipline || null
  const sex = (profile?.sex || 'M') as string
  const dob = profile?.dob || profile?.date_of_birth || null
  const currentAge = dob
    ? Math.floor((Date.now() - new Date(dob).getTime()) / (365.25 * 24 * 60 * 60 * 1000))
    : null

  // Get PB from performances
  const competitionPb = useMemo(() => {
    if (!performances.length || !discipline) return null
    const marks = performances
      .filter((p: any) => p.discipline === discipline)
      .map((p: any) => parseFloat(p.mark))
      .filter(Number.isFinite)
    if (!marks.length) return null
    const lower = isLowerBetter(discipline)
    return lower ? Math.min(...marks) : Math.max(...marks)
  }, [performances, discipline])

  const projections = useMemo(() => {
    if (!competitionPb || !currentAge || !discipline) return null
    try {
      const result = projectAllTrajectories(competitionPb, currentAge, discipline, sex === 'F' ? 'female' : 'male')
      // Verify we got useful data
      if (!result.steady?.length || result.steady.length < 2) return null
      return result
    } catch {
      return null
    }
  }, [competitionPb, currentAge, discipline, sex])

  return (
    <SafeAreaView style={styles.safe}>
      {/* Header */}
      <View style={styles.header}>
        <MonoKicker>PERFORMANCE OVER TIME</MonoKicker>
        <Text style={styles.title}>Trajectory</Text>
      </View>

      {/* Category pills */}
      <ScrollView
        horizontal
        showsHorizontalScrollIndicator={false}
        contentContainerStyle={styles.pillRow}
      >
        {CATEGORIES.map((cat) => {
          const isActive = activeFilter === cat.key
          return (
            <TouchableOpacity
              key={cat.key}
              style={[
                styles.pill,
                isActive && {
                  backgroundColor: cat.color + '15',
                  borderColor: cat.color + '50',
                },
              ]}
              onPress={() => setActiveFilter(cat.key)}
              activeOpacity={0.7}
            >
              <Ionicons
                name={(cat as any).icon as any}
                size={13}
                color={isActive ? cat.color : colors.text.dimmed}
              />
              <Text
                style={[
                  styles.pillText,
                  isActive && { color: cat.color },
                ]}
              >
                {cat.label}
              </Text>
            </TouchableOpacity>
          )
        })}
      </ScrollView>

      <ScrollView
        contentContainerStyle={styles.content}
        refreshControl={
          <RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor={colors.orange[500]} />
        }
        showsVerticalScrollIndicator={false}
      >
        {/* Summary strip */}
        {totalEntries > 0 && (
          <HeroCard style={{ marginBottom: spacing.md }}>
            <View style={styles.summaryRow}>
              <View style={styles.summaryItem}>
                <Text style={styles.summaryValue}>{totalMetrics}</Text>
                <Text style={styles.summaryLabel}>METRICS</Text>
              </View>
              <View style={styles.summaryDivider} />
              <View style={styles.summaryItem}>
                <Text style={styles.summaryValue}>{totalEntries}</Text>
                <Text style={styles.summaryLabel}>ENTRIES</Text>
              </View>
              <View style={styles.summaryDivider} />
              <View style={styles.summaryItem}>
                <Text style={[styles.summaryValue, { color: colors.green }]}>{pbCount}</Text>
                <Text style={styles.summaryLabel}>PBs</Text>
              </View>
            </View>
          </HeroCard>
        )}

        {/* Improvement Curve Projections */}
        {projections && discipline && (
          <ProjectionCard
            projections={projections}
            discipline={discipline}
            currentAge={currentAge!}
            currentPb={competitionPb!}
          />
        )}

        {/* Metric trajectory cards */}
        {filteredKeys.length === 0 ? (
          <AlmanacCard kicker="NO DATA" title="Start logging" accent={colors.text.muted}>
            <EmptyState
              icon="📈"
              title="No trajectory data yet"
              subtitle={
                activeFilter === 'all'
                  ? "Your trajectory builds from logged data. Start logging metrics to see your trends emerge."
                  : `No ${activeCat?.label || activeFilter} metrics logged yet. Tap the Log tab to start.`
              }
            />
          </AlmanacCard>
        ) : (
          filteredKeys.map((key) => (
            <MetricTrajectoryCard
              key={key}
              metricKey={key}
              logs={grouped[key]}
            />
          ))
        )}

        <View style={{ height: 24 }} />
      </ScrollView>
    </SafeAreaView>
  )
}

// ── Improvement Curve Projection Card ──
function ProjectionCard({
  projections,
  discipline,
  currentAge,
  currentPb,
}: {
  projections: { early: any[]; steady: any[]; late: any[] }
  discipline: string
  currentAge: number
  currentPb: number
}) {
  const [activeType, setActiveType] = useState<'early' | 'steady' | 'late'>('steady')
  const fadeAnim = useState(new Animated.Value(0))[0]
  const lower = isLowerBetter(discipline)
  const chartW = SCREEN_W - 80

  useEffect(() => {
    Animated.timing(fadeAnim, { toValue: 1, duration: 500, useNativeDriver: true }).start()
  }, [])

  const discLabel = discipline.replace(/_/g, ' ').replace(/\b\w/g, (c: string) => c.toUpperCase())

  const trajectoryColors = {
    early: '#22d3ee',   // cyan
    steady: colors.orange[400],
    late: '#a78bfa',    // purple
  }

  const trajectoryLabels = {
    early: 'Early Peaker',
    steady: 'Steady Progression',
    late: 'Late Bloomer',
  }

  const activeData = projections[activeType] || []
  const peakPoint = activeData.reduce((best: any, pt: any) =>
    !best ? pt : (lower ? (pt.projected < best.projected ? pt : best) : (pt.projected > best.projected ? pt : best)),
    null
  )

  // Build SVG path for all 3 trajectories
  const buildPath = (data: any[]) => {
    if (!data.length) return ''
    const minAge = data[0].age
    const maxAge = data[data.length - 1].age
    const allValues = [...projections.early, ...projections.steady, ...projections.late].map((d) => d.projected)
    const minVal = Math.min(...allValues)
    const maxVal = Math.max(...allValues)
    const valRange = maxVal - minVal || 1
    const ageRange = maxAge - minAge || 1
    const chartH = 120
    const padX = 10

    return data.map((pt, i) => {
      const x = padX + ((pt.age - minAge) / ageRange) * (chartW - padX * 2)
      const yNorm = (pt.projected - minVal) / valRange
      const y = lower ? yNorm * chartH : (1 - yNorm) * chartH
      return `${i === 0 ? 'M' : 'L'}${x.toFixed(1)},${(y + 10).toFixed(1)}`
    }).join(' ')
  }

  // Confidence band for active trajectory
  const buildBand = (data: any[]) => {
    if (!data.length) return ''
    const minAge = data[0].age
    const maxAge = data[data.length - 1].age
    const allValues = [...projections.early, ...projections.steady, ...projections.late].map((d) => d.projected)
    const minVal = Math.min(...allValues)
    const maxVal = Math.max(...allValues)
    const valRange = maxVal - minVal || 1
    const ageRange = maxAge - minAge || 1
    const chartH = 120
    const padX = 10

    const topPoints = data.map((pt) => {
      const x = padX + ((pt.age - minAge) / ageRange) * (chartW - padX * 2)
      const yNorm = ((pt.p75 || pt.projected) - minVal) / valRange
      const y = lower ? yNorm * chartH : (1 - yNorm) * chartH
      return `${x.toFixed(1)},${(y + 10).toFixed(1)}`
    })
    const bottomPoints = [...data].reverse().map((pt) => {
      const x = padX + ((pt.age - minAge) / ageRange) * (chartW - padX * 2)
      const yNorm = ((pt.p25 || pt.projected) - minVal) / valRange
      const y = lower ? yNorm * chartH : (1 - yNorm) * chartH
      return `${x.toFixed(1)},${(y + 10).toFixed(1)}`
    })
    return `M${topPoints.join(' L')} L${bottomPoints.join(' L')} Z`
  }

  // Age labels for x-axis
  const ages = activeData.length > 0
    ? [activeData[0].age, activeData[Math.floor(activeData.length / 2)]?.age, activeData[activeData.length - 1].age]
    : []

  return (
    <Animated.View style={{ opacity: fadeAnim }}>
      <AlmanacCard
        kicker="CAREER PROJECTION"
        title={`${discLabel} — Where Are You Headed?`}
        accent={trajectoryColors[activeType]}
      >
        {/* Trajectory toggle */}
        <View style={projStyles.toggleRow}>
          {(['early', 'steady', 'late'] as const).map((type) => {
            const isActive = activeType === type
            return (
              <TouchableOpacity
                key={type}
                style={[
                  projStyles.toggleBtn,
                  isActive && { backgroundColor: trajectoryColors[type] + '20', borderColor: trajectoryColors[type] + '60' },
                ]}
                onPress={() => setActiveType(type)}
                activeOpacity={0.7}
              >
                <View style={[projStyles.toggleDot, { backgroundColor: trajectoryColors[type] }]} />
                <Text style={[projStyles.toggleLabel, isActive && { color: trajectoryColors[type] }]}>
                  {type === 'early' ? 'Early' : type === 'steady' ? 'Steady' : 'Late'}
                </Text>
              </TouchableOpacity>
            )
          })}
        </View>

        {/* SVG Chart */}
        <View style={projStyles.chartContainer}>
          <svg width={chartW} height={145} viewBox={`0 0 ${chartW} 145`}>
            {/* Confidence band for active trajectory */}
            <path d={buildBand(activeData)} fill={trajectoryColors[activeType] + '12'} />

            {/* All 3 trajectory lines */}
            {(['early', 'steady', 'late'] as const).map((type) => (
              <path
                key={type}
                d={buildPath(projections[type])}
                fill="none"
                stroke={trajectoryColors[type]}
                strokeWidth={type === activeType ? 2.5 : 1}
                strokeOpacity={type === activeType ? 1 : 0.25}
                strokeDasharray={type === activeType ? undefined : '4,4'}
              />
            ))}

            {/* Current PB dot */}
            {activeData.length > 0 && (() => {
              const minAge = activeData[0].age
              const maxAge = activeData[activeData.length - 1].age
              const allValues = [...projections.early, ...projections.steady, ...projections.late].map((d) => d.projected)
              const minVal = Math.min(...allValues)
              const maxVal = Math.max(...allValues)
              const valRange = maxVal - minVal || 1
              const ageRange = maxAge - minAge || 1
              const padX = 10
              const x = padX + ((currentAge - minAge) / ageRange) * (chartW - padX * 2)
              const yNorm = (currentPb - minVal) / valRange
              const y = lower ? yNorm * 120 : (1 - yNorm) * 120
              return (
                <>
                  <circle cx={x} cy={y + 10} r={5} fill={colors.orange[400]} stroke="white" strokeWidth={2} />
                  <text x={x} y={y} fill="white" fontSize={9} textAnchor="middle" fontWeight="bold">NOW</text>
                </>
              )
            })()}
          </svg>

          {/* Age labels */}
          <View style={projStyles.ageRow}>
            {ages.map((age, i) => (
              <Text key={i} style={projStyles.ageLabel}>Age {age}</Text>
            ))}
          </View>
        </View>

        {/* Stats row */}
        <View style={projStyles.statsRow}>
          <View style={projStyles.statBox}>
            <Text style={projStyles.statKicker}>CURRENT PB</Text>
            <Text style={[projStyles.statVal, { color: colors.orange[400] }]}>{currentPb}</Text>
          </View>
          {peakPoint && (
            <View style={projStyles.statBox}>
              <Text style={projStyles.statKicker}>PROJECTED PEAK</Text>
              <Text style={[projStyles.statVal, { color: trajectoryColors[activeType] }]}>
                {peakPoint.projected.toFixed(2)}
              </Text>
              <Text style={projStyles.statSub}>Age {peakPoint.age}</Text>
            </View>
          )}
          {peakPoint && (
            <View style={projStyles.statBox}>
              <Text style={projStyles.statKicker}>IMPROVEMENT</Text>
              <Text style={[projStyles.statVal, { color: colors.green }]}>
                {lower
                  ? `-${(currentPb - peakPoint.projected).toFixed(2)}`
                  : `+${(peakPoint.projected - currentPb).toFixed(2)}`}
              </Text>
            </View>
          )}
        </View>

        {/* Insight blurb */}
        <View style={projStyles.insightRow}>
          <Ionicons name="bulb-outline" size={14} color={trajectoryColors[activeType]} />
          <Text style={projStyles.insightText}>
            {activeType === 'early'
              ? 'Early peakers see rapid gains in their early 20s but plateau sooner. Typical for athletes with a natural talent base.'
              : activeType === 'steady'
              ? 'Steady progression follows a consistent improvement curve with gradual gains over a longer career arc.'
              : 'Late bloomers often accelerate in their mid-to-late 20s, improving through accumulated training volume and technical mastery.'}
          </Text>
        </View>
      </AlmanacCard>
    </Animated.View>
  )
}

const projStyles = StyleSheet.create({
  toggleRow: {
    flexDirection: 'row',
    gap: 8,
    marginBottom: spacing.md,
  },
  toggleBtn: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 6,
    paddingVertical: 8,
    borderRadius: radius.md,
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.08)',
    backgroundColor: 'rgba(255,255,255,0.02)',
  },
  toggleDot: {
    width: 8,
    height: 8,
    borderRadius: 4,
  },
  toggleLabel: {
    fontSize: 11,
    fontWeight: '700',
    color: colors.text.secondary,
    letterSpacing: 0.5,
  },
  chartContainer: {
    alignItems: 'center',
    marginBottom: spacing.md,
  },
  ageRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    width: '100%',
    paddingHorizontal: 10,
    marginTop: 4,
  },
  ageLabel: {
    fontSize: 9,
    color: colors.text.dimmed,
    fontWeight: '600',
    letterSpacing: 1,
  },
  statsRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    paddingTop: spacing.sm,
    borderTopWidth: 1,
    borderTopColor: 'rgba(255,255,255,0.04)',
  },
  statBox: {
    flex: 1,
    alignItems: 'center',
  },
  statKicker: {
    fontSize: 8,
    letterSpacing: 1.5,
    color: colors.text.dimmed,
    fontWeight: '600',
    marginBottom: 2,
  },
  statVal: {
    fontSize: 18,
    fontWeight: '700',
    color: colors.text.primary,
  },
  statSub: {
    fontSize: 10,
    color: colors.text.muted,
    marginTop: 1,
  },
  insightRow: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: 8,
    marginTop: spacing.md,
    paddingTop: spacing.sm,
    borderTopWidth: 1,
    borderTopColor: 'rgba(255,255,255,0.04)',
  },
  insightText: {
    flex: 1,
    fontSize: 12,
    color: colors.text.secondary,
    lineHeight: 17,
  },
})

// ── Per-metric trajectory card ──
function MetricTrajectoryCard({ metricKey, logs }: { metricKey: string; logs: any[] }) {
  const lower = LOWER_IS_BETTER.has(metricKey)
  const color = metricColor(metricKey)
  const label = metricKey.replace(/_/g, ' ')
  const catLabel = metricCategoryLabel(metricKey)
  const unit = logs[0]?.unit || ''

  const values = logs.map((l) => parseFloat(l.value))
  const latest = values[0]
  const oldest = values[values.length - 1]
  const trend = latest - (values[1] ?? latest)

  // Overall change
  const overallChange = latest - oldest
  const overallPct = oldest !== 0 ? ((overallChange / oldest) * 100) : 0
  const isImproving = lower ? overallChange < 0 : overallChange > 0

  // Best value
  const best = lower ? Math.min(...values) : Math.max(...values)

  // Chart data (chronological)
  const chartData = [...logs]
    .reverse()
    .map((l) => ({
      value: parseFloat(l.value),
      date: l.recorded_at,
      isPB: false, // computed visually from best value
    }))

  return (
    <AlmanacCard
      kicker={catLabel}
      title={label}
      number={`${logs.length}`}
      accent={color}
    >
      {/* Latest + Best row */}
      <View style={styles.cardStatsRow}>
        <View>
          <Text style={styles.cardStatLabel}>LATEST</Text>
          <Text style={[styles.cardStatValue, { color }]}>
            {latest}
            <Text style={styles.cardStatUnit}> {unit}</Text>
          </Text>
        </View>
        <TrendArrow value={trend} inverted={lower} />
        <View style={{ alignItems: 'flex-end' }}>
          <Text style={styles.cardStatLabel}>BEST</Text>
          <Text style={[styles.cardStatValue, { color: colors.green }]}>
            {best}
            <Text style={styles.cardStatUnit}> {unit}</Text>
          </Text>
        </View>
      </View>

      {/* Chart */}
      {chartData.length >= 2 && (
        <View style={styles.chartWrap}>
          <LineChart
            data={chartData}
            color={color}
            height={100}
            width={SCREEN_W - 80}
            showArea
            showDots={chartData.length <= 20}
            showPBs
            lowerIsBetter={lower}
          />
        </View>
      )}

      {/* Overall change */}
      {logs.length >= 2 && (
        <View style={styles.overallRow}>
          <View style={styles.overallLeft}>
            <Ionicons
              name={isImproving ? 'trending-up' : 'trending-down'}
              size={14}
              color={isImproving ? colors.green : colors.red}
            />
            <Text style={styles.overallLabel}>Overall</Text>
          </View>
          <Text
            style={[
              styles.overallValue,
              { color: isImproving ? colors.green : colors.red },
            ]}
          >
            {overallChange >= 0 ? '+' : ''}{overallChange.toFixed(2)} {unit} ({overallPct >= 0 ? '+' : ''}{overallPct.toFixed(1)}%)
          </Text>
        </View>
      )}
    </AlmanacCard>
  )
}

// ── Styles ──────────────────────────────────────────────────────────────

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: colors.bg.primary },
  header: { padding: spacing.lg, paddingBottom: spacing.sm },
  title: { fontSize: 26, fontWeight: '700', color: colors.text.primary, marginTop: 4 },

  pillRow: { paddingHorizontal: spacing.lg, gap: 8, paddingBottom: spacing.md },
  pill: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 5,
    paddingHorizontal: 14,
    paddingVertical: 8,
    borderRadius: radius.full,
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.08)',
    backgroundColor: 'rgba(255,255,255,0.02)',
  },
  pillText: { fontSize: 12, fontWeight: '600', color: colors.text.secondary },

  content: { padding: spacing.lg, paddingTop: 0 },

  // Summary row
  summaryRow: { flexDirection: 'row', alignItems: 'center' },
  summaryItem: { flex: 1, alignItems: 'center' },
  summaryValue: {
    fontSize: 22,
    fontWeight: '700',
    color: colors.text.primary,
    letterSpacing: -0.5,
  },
  summaryLabel: {
    fontSize: 8,
    letterSpacing: 2,
    color: 'rgba(255,255,255,0.45)',
    fontWeight: '600',
    marginTop: 3,
  },
  summaryDivider: {
    width: 1,
    height: 24,
    backgroundColor: 'rgba(255,255,255,0.08)',
  },

  // Trajectory card stats
  cardStatsRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: spacing.md,
  },
  cardStatLabel: {
    fontSize: 9,
    letterSpacing: 1.5,
    color: colors.text.dimmed,
    fontWeight: '600',
    marginBottom: 2,
  },
  cardStatValue: { fontSize: 22, fontWeight: '700', color: colors.text.primary },
  cardStatUnit: { fontSize: 12, fontWeight: '400', color: colors.text.muted },

  chartWrap: { marginVertical: spacing.sm, alignItems: 'center' },

  overallRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingTop: spacing.md,
    borderTopWidth: 1,
    borderTopColor: 'rgba(255,255,255,0.04)',
    marginTop: spacing.sm,
  },
  overallLeft: { flexDirection: 'row', alignItems: 'center', gap: 6 },
  overallLabel: { color: colors.text.muted, fontSize: 12, fontWeight: '600' },
  overallValue: { fontSize: 13, fontWeight: '700' },
})
