// ═══════════════════════════════════════════════════════════════════════════
// TRAJECTORY SCREEN — Race Performance Analysis (complete rewrite)
// Discipline picker landing → discipline detail view with race trajectory analysis
// Uses performance tiers, similar athletes, improvement scenarios, competition ladder
// ═══════════════════════════════════════════════════════════════════════════

import React, { useEffect, useState, useMemo, useCallback } from 'react'
import {
  View,
  Text,
  ScrollView,
  TouchableOpacity,
  StyleSheet,
  RefreshControl,
  Dimensions,
  ActivityIndicator,
} from 'react-native'
import { SafeAreaView } from 'react-native-safe-area-context'
import { useNavigation } from '@react-navigation/native'
import { Ionicons } from '@expo/vector-icons'
import { colors, spacing, radius } from '../lib/theme'
import { useAuth } from '../contexts/AuthContext'
import { selectFrom, SUPABASE_URL, SUPABASE_ANON_KEY } from '../lib/supabase'
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
import { projectAllTrajectories } from '../lib/improvementCurves'
import {
  isLowerBetter,
  performancePercentile,
  qualifierZones,
  getCalibration,
} from '../lib/disciplineScience'
import { getTier, TIER_NAMES, TIER_COLORS, TIER_SHORT } from '../lib/performanceTiers'
import { getAgeGroup } from '../lib/performanceLevels'

const { width: SCREEN_W } = Dimensions.get('window')

// ── Event code mapping: discipline + sex → RPC event code ──────────────────
function getDisciplineEventCode(discipline: string, sex: string): string {
  if (!discipline) return ''

  const gender = sex === 'F' ? 'F' : 'M'
  const d = discipline.toLowerCase().trim()

  // Time events
  if (d.includes('100m') && !d.includes('h')) return `${gender}100`
  if (d.includes('200m') && !d.includes('h')) return `${gender}200`
  if (d.includes('400m') && !d.includes('h')) return `${gender}400`
  if (d.includes('60m')) return `${gender}60`
  if (d.includes('75m')) return `${gender}75`

  // Hurdles
  if (d.includes('110mh') || d.includes('110 mh')) return `${gender}110H`
  if (d.includes('100mh') || d.includes('100 mh')) return `${gender}100H`
  if (d.includes('400mh') || d.includes('400 mh')) return `${gender}400H`

  // Middle distance
  if (d.includes('800m')) return `${gender}800`
  if (d.includes('1500m')) return `${gender}1500`

  // Long distance
  if (d.includes('3000m') && d.includes('steeple')) return `${gender}3SC`
  if (d.includes('3000m')) return `${gender}3000`
  if (d.includes('5000m')) return `${gender}5K`
  if (d.includes('10000m') || d.includes('10km')) return `${gender}10K`
  if (d.includes('marathon')) return `${gender}MAR`

  // Jumps
  if (d.includes('long jump')) return `${gender}LJ`
  if (d.includes('triple jump')) return `${gender}TJ`
  if (d.includes('high jump')) return `${gender}HJ`
  if (d.includes('pole vault')) return `${gender}PV`

  // Throws
  if (d.includes('shot put') || d === 'shot') return `${gender}SP`
  if (d.includes('discus')) return `${gender}DT`
  if (d.includes('hammer')) return `${gender}HT`
  if (d.includes('javelin')) return `${gender}JT`

  return ''
}

// ── Format performance values based on discipline ───────────────────────────
function formatPerformance(value: number, discipline: string): string {
  if (!value) return '—'

  const lower = isLowerBetter(discipline)
  const d = discipline.toLowerCase()

  // Time disciplines: convert seconds to M:SS.xx or just S.xx
  if (lower) {
    if (d.includes('marathon') || d.includes('10000m') || d.includes('5000m') || d.includes('3000m') || d.includes('1500m')) {
      const min = Math.floor(value / 60)
      const sec = value % 60
      return `${min}:${sec.toFixed(2).padStart(5, '0')}`
    } else if (d.includes('800m')) {
      const min = Math.floor(value / 60)
      const sec = value % 60
      return `${min}:${sec.toFixed(2).padStart(5, '0')}`
    } else {
      return value.toFixed(2)
    }
  }

  // Field disciplines: just meters to 2 decimals
  return value.toFixed(2)
}

// ── Landing: Discipline Picker ───────────────────────────────────────────────
function DisciplinePicker({
  performances,
  onSelectDiscipline,
}: {
  performances: any[]
  onSelectDiscipline: (discipline: string) => void
}) {
  const { profile } = useAuth()

  // Group performances by discipline and get stats
  const disciplineStats = useMemo(() => {
    const grouped: Record<string, any[]> = {}
    for (const p of performances) {
      if (!grouped[p.discipline]) grouped[p.discipline] = []
      grouped[p.discipline].push(p)
    }

    return Object.entries(grouped).map(([discipline, marks]) => {
      const values = marks.map((m: any) => parseFloat(m.mark)).filter(Number.isFinite)
      const lower = isLowerBetter(discipline)
      const pb = lower ? Math.min(...values) : Math.max(...values)
      const age = profile?.dob
        ? Math.floor((Date.now() - new Date(profile.dob).getTime()) / (365.25 * 24 * 60 * 60 * 1000))
        : null
      const ageGroup = age ? getAgeGroup(age) : 'Senior'
      const sex = (profile?.sex || 'M') as string
      const tier = getTier(discipline, sex, ageGroup, pb)

      return {
        discipline,
        pb,
        count: marks.length,
        tier,
        age,
        ageGroup,
        sex,
      }
    })
  }, [performances, profile])

  if (disciplineStats.length === 0) {
    return (
      <ScrollView
        contentContainerStyle={styles.content}
        showsVerticalScrollIndicator={false}
      >
        <EmptyState
          icon="🏃"
          title="No competition data yet"
          subtitle="Log your first race in the Log tab to see your trajectory analysis."
        />
      </ScrollView>
    )
  }

  return (
    <ScrollView
      contentContainerStyle={styles.content}
      showsVerticalScrollIndicator={false}
    >
      {disciplineStats.map((stat) => (
        <TouchableOpacity
          key={stat.discipline}
          onPress={() => onSelectDiscipline(stat.discipline)}
          activeOpacity={0.7}
        >
          <AlmanacCard
            kicker={stat.ageGroup}
            title={stat.discipline}
            number={`${stat.count} race${stat.count !== 1 ? 's' : ''}`}
            accent={stat.tier?.color || colors.orange[500]}
          >
            <View style={styles.disciplineCardContent}>
              <View style={styles.pbSection}>
                <Text style={styles.pbLabel}>PB</Text>
                <Text style={[styles.pbValue, { color: stat.tier?.color || colors.orange[500] }]}>
                  {formatPerformance(stat.pb, stat.discipline)}
                </Text>
              </View>

              <View style={styles.tierSection}>
                <View style={[styles.tierBadge, { backgroundColor: stat.tier?.color + '20' }]}>
                  <Text style={[styles.tierLabel, { color: stat.tier?.color }]}>
                    {stat.tier?.tierName || 'Unrated'}
                  </Text>
                </View>
              </View>
            </View>
          </AlmanacCard>
        </TouchableOpacity>
      ))}

      <View style={{ height: 24 }} />
    </ScrollView>
  )
}

// ── Detail: Tier Positioning ─────────────────────────────────────────────────
function TierPositioningSection({
  discipline,
  pb,
  age,
  sex,
}: {
  discipline: string
  pb: number
  age: number | null
  sex: string
}) {
  const ageGroup = age ? getAgeGroup(age) : 'Senior'
  const tier = getTier(discipline, sex, ageGroup, pb)
  const percentile = performancePercentile(pb, discipline, sex)
  const lower = isLowerBetter(discipline)

  if (!tier) return null

  return (
    <HeroCard>
      <View style={styles.tierSection}>
        <Text style={styles.pbDisplay}>{formatPerformance(pb, discipline)}</Text>
        <View style={[styles.tierBadgeLarge, { backgroundColor: tier.color + '20' }]}>
          <Text style={[styles.tierNameLarge, { color: tier.color }]}>{tier.tierName}</Text>
          <Text style={[styles.tierShortLarge, { color: tier.color }]}>{TIER_SHORT[tier.tier]}</Text>
        </View>
      </View>

      <View style={styles.tierStats}>
        <View style={styles.tierStat}>
          <Text style={styles.tierStatLabel}>Percentile</Text>
          <Text style={styles.tierStatValue}>{percentile}%</Text>
        </View>
        <View style={styles.tierStatDivider} />
        <View style={styles.tierStat}>
          <Text style={styles.tierStatLabel}>Age Group</Text>
          <Text style={styles.tierStatValue}>{ageGroup}</Text>
        </View>
        {tier.nextTier && (
          <>
            <View style={styles.tierStatDivider} />
            <View style={styles.tierStat}>
              <Text style={styles.tierStatLabel}>To {TIER_NAMES[tier.nextTier]}</Text>
              <Text style={[styles.tierStatValue, { color: tier.nextCut ? colors.orange[500] : colors.text.muted }]}>
                {tier.gap ? `${lower ? '+' : '-'}${Math.abs(tier.gap).toFixed(2)}` : '—'}
              </Text>
            </View>
          </>
        )}
      </View>

      {/* Tier visual ladder */}
      <View style={styles.tierLadderContainer}>
        <View style={styles.tierLadder}>
          {[1, 2, 3, 4, 5, 6, ...(ageGroup === 'Senior' ? [7] : [])].map((t) => (
            <View
              key={t}
              style={[
                styles.tierRung,
                {
                  backgroundColor: tier.tier >= t ? TIER_COLORS[t] : 'rgba(255,255,255,0.05)',
                  opacity: tier.tier >= t ? 1 : 0.3,
                },
              ]}
            />
          ))}
        </View>
        <View style={styles.tierLadderLabels}>
          <Text style={styles.tierLadderLabel}>T1</Text>
          <Text style={styles.tierLadderLabel}>{ageGroup === 'Senior' ? 'T7' : 'T6'}</Text>
        </View>
      </View>
    </HeroCard>
  )
}

// ── Similar Athletes ─────────────────────────────────────────────────────────
function SimilarAthletesSection({
  discipline,
  pb,
  age,
  sex,
}: {
  discipline: string
  pb: number
  age: number | null
  sex: string
}) {
  const [similar, setSimilar] = useState<any[]>([])
  const [loading, setLoading] = useState(false)

  useEffect(() => {
    const loadSimilarAthletes = async () => {
      if (!age) return
      setLoading(true)
      try {
        const eventCode = getDisciplineEventCode(discipline, sex)
        if (!eventCode) {
          setSimilar([])
          setLoading(false)
          return
        }

        const response = await fetch(
          `${SUPABASE_URL}/rest/v1/rpc/find_similar_athletes`,
          {
            method: 'POST',
            headers: {
              apikey: SUPABASE_ANON_KEY,
              'Content-Type': 'application/json',
            },
            body: JSON.stringify({
              p_discipline_code: eventCode,
              p_pb: pb,
              p_age: age,
              p_limit: 3,
            }),
          }
        )

        if (response.ok) {
          const data = await response.json()
          setSimilar(data || [])
        }
      } catch (e) {
        console.warn('Similar athletes load:', e)
      } finally {
        setLoading(false)
      }
    }

    loadSimilarAthletes()
  }, [discipline, pb, age, sex])

  if (loading) {
    return (
      <AlmanacCard kicker="BENCHMARKS" title="Similar Athletes" accent={colors.orange[500]}>
        <ActivityIndicator color={colors.orange[500]} />
      </AlmanacCard>
    )
  }

  if (similar.length === 0) {
    return null
  }

  return (
    <AlmanacCard kicker="BENCHMARKS" title="Similar Athletes" accent={colors.orange[500]}>
      {similar.map((athlete: any, idx: number) => (
        <View key={idx} style={styles.similarAthleteRow}>
          <View>
            <Text style={styles.similarAthleteName}>{athlete.athlete_name || 'Athlete'}</Text>
            <Text style={styles.similarAthleteCountry}>{athlete.country || '—'}</Text>
          </View>
          <View style={styles.similarAthletePb}>
            <Text style={styles.similarAthletePbValue}>{formatPerformance(athlete.pb, discipline)}</Text>
            {athlete.age && (
              <Text style={styles.similarAthleteAge}>Age {athlete.age}</Text>
            )}
          </View>
        </View>
      ))}
    </AlmanacCard>
  )
}

// ── Improvement Scenarios ────────────────────────────────────────────────────
function ImprovementScenariosSection({
  discipline,
  pb,
  age,
  sex,
}: {
  discipline: string
  pb: number
  age: number | null
  sex: string
}) {
  const projections = useMemo(() => {
    if (!pb || !age) return null
    try {
      const result = projectAllTrajectories(
        pb,
        age,
        discipline,
        sex === 'F' ? 'female' : 'male'
      )
      if (!result?.steady?.length || result.steady.length < 2) return null
      return result
    } catch {
      return null
    }
  }, [pb, age, discipline, sex])

  if (!projections) return null

  const lower = isLowerBetter(discipline)

  const scenarios = [
    {
      name: 'Conservative',
      label: 'Late Bloomer',
      data: projections.late,
      color: '#a78bfa',
    },
    {
      name: 'Steady',
      label: 'Consistent Progress',
      data: projections.steady,
      color: colors.orange[400],
    },
    {
      name: 'Aggressive',
      label: 'Early Peaker',
      data: projections.early,
      color: '#22d3ee',
    },
  ]

  return (
    <AlmanacCard kicker="FUTURE" title="Improvement Scenarios" accent={colors.orange[500]}>
      {scenarios.map((scenario) => {
        const peakPoint = scenario.data.reduce((best: any, pt: any) =>
          !best ? pt : (lower ? (pt.projected < best.projected ? pt : best) : (pt.projected > best.projected ? pt : best)),
          null
        )

        if (!peakPoint) return null

        return (
          <View key={scenario.name} style={styles.scenarioCard}>
            <View style={styles.scenarioHeader}>
              <View>
                <Text style={[styles.scenarioName, { color: scenario.color }]}>{scenario.label}</Text>
                <Text style={styles.scenarioAge}>Peak at age {peakPoint.age}</Text>
              </View>
              <Text style={[styles.scenarioPb, { color: scenario.color }]}>
                {formatPerformance(peakPoint.projected, discipline)}
              </Text>
            </View>

            {peakPoint && (
              <View style={styles.scenarioStats}>
                <View style={styles.scenarioStat}>
                  <Text style={styles.scenarioStatLabel}>Improvement</Text>
                  <Text style={[styles.scenarioStatValue, { color: colors.green }]}>
                    {lower
                      ? `-${(pb - peakPoint.projected).toFixed(2)}`
                      : `+${(peakPoint.projected - pb).toFixed(2)}`}
                  </Text>
                </View>
                <View style={styles.scenarioStatDivider} />
                <View style={styles.scenarioStat}>
                  <Text style={styles.scenarioStatLabel}>Peak Tier</Text>
                  <Text style={styles.scenarioStatValue}>
                    {getTier(discipline, sex, getAgeGroup(peakPoint.age), peakPoint.projected)?.tierName || '—'}
                  </Text>
                </View>
              </View>
            )}
          </View>
        )
      })}
    </AlmanacCard>
  )
}

// ── Competition Ladder ───────────────────────────────────────────────────────
function CompetitionLadderSection({
  discipline,
  pb,
  sex,
}: {
  discipline: string
  pb: number
  sex: string
}) {
  const zones = qualifierZones(discipline, sex)
  const lower = isLowerBetter(discipline)

  const rungs = [
    { label: 'Development', threshold: zones.qualifier, target: zones.qualifier },
    { label: 'Qualifier', threshold: zones.semifinalist, target: zones.semifinalist },
    { label: 'Semifinalist', threshold: zones.finalist, target: zones.finalist },
    { label: 'Finalist', threshold: zones.optimal, target: zones.optimal },
  ]

  return (
    <AlmanacCard kicker="COMPETITIONS" title="Competition Ladder" accent={colors.orange[500]}>
      {rungs.map((rung, idx) => {
        const isMet = lower ? pb <= rung.threshold : pb >= rung.threshold
        const gap = lower
          ? rung.threshold - pb
          : pb - rung.threshold

        return (
          <View key={idx} style={styles.ladderRung}>
            <View style={styles.ladderRungleft}>
              <View
                style={[
                  styles.ladderCheckmark,
                  { backgroundColor: isMet ? colors.green : 'rgba(255,255,255,0.1)' },
                ]}
              >
                {isMet && <Ionicons name="checkmark" size={16} color="white" />}
              </View>
              <Text style={[styles.ladderLabel, isMet && { color: colors.orange[500], fontWeight: '700' }]}>
                {rung.label}
              </Text>
            </View>
            <View style={styles.ladderRight}>
              <Text style={styles.ladderThreshold}>{formatPerformance(rung.threshold, discipline)}</Text>
              {!isMet && gap !== 0 && (
                <Text style={styles.ladderGap}>
                  {lower ? '+' : '-'}{Math.abs(gap).toFixed(2)} away
                </Text>
              )}
              {isMet && <Text style={{ color: colors.green, fontSize: 12, fontWeight: '600' }}>Achieved</Text>}
            </View>
          </View>
        )
      })}
    </AlmanacCard>
  )
}

// ── Main Screen ──────────────────────────────────────────────────────────────
export default function TrajectoryScreen() {
  const { user, profile } = useAuth()
  const [performances, setPerformances] = useState<any[]>([])
  const [selectedDiscipline, setSelectedDiscipline] = useState<string | null>(null)
  const [refreshing, setRefreshing] = useState(false)

  const loadData = async () => {
    if (!user) return
    try {
      const perfs = await selectFrom('performances', {
        filter: `user_id=eq.${user.id}`,
        order: 'competition_date.desc',
        limit: '100',
      }).catch(() => [])
      setPerformances(perfs || [])
    } catch (e) {
      console.warn('Trajectory load:', e)
    }
  }

  useEffect(() => {
    loadData()
  }, [user])

  const navigation = useNavigation()
  useEffect(() => {
    const unsub = navigation.addListener('focus', () => {
      loadData()
    })
    return unsub
  }, [navigation])

  const onRefresh = async () => {
    setRefreshing(true)
    await loadData()
    setRefreshing(false)
  }

  const selectedPerformances = useMemo(
    () => performances.filter((p) => p.discipline === selectedDiscipline),
    [performances, selectedDiscipline]
  )

  const selectedPb = useMemo(() => {
    if (!selectedPerformances.length) return null
    const values = selectedPerformances
      .map((p) => parseFloat(p.mark))
      .filter(Number.isFinite)
    if (!values.length) return null
    const lower = isLowerBetter(selectedDiscipline!)
    return lower ? Math.min(...values) : Math.max(...values)
  }, [selectedPerformances, selectedDiscipline])

  const sex = (profile?.sex || 'M') as string
  const age = profile?.dob
    ? Math.floor((Date.now() - new Date(profile.dob).getTime()) / (365.25 * 24 * 60 * 60 * 1000))
    : null

  return (
    <SafeAreaView style={styles.safe}>
      {/* Header */}
      <View style={styles.header}>
        {selectedDiscipline && (
          <TouchableOpacity onPress={() => setSelectedDiscipline(null)} style={styles.backBtn}>
            <Ionicons name="chevron-back" size={24} color={colors.text.primary} />
          </TouchableOpacity>
        )}
        <View style={{ flex: 1 }}>
          <MonoKicker>
            {selectedDiscipline ? 'PERFORMANCE ANALYSIS' : 'YOUR PERFORMANCE STORY'}
          </MonoKicker>
          <Text style={styles.title}>{selectedDiscipline || 'Trajectory'}</Text>
        </View>
      </View>

      {/* Content */}
      {selectedDiscipline && selectedPb ? (
        <ScrollView
          contentContainerStyle={styles.content}
          refreshControl={
            <RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor={colors.orange[500]} />
          }
          showsVerticalScrollIndicator={false}
        >
          <TierPositioningSection discipline={selectedDiscipline} pb={selectedPb} age={age} sex={sex} />

          <SimilarAthletesSection discipline={selectedDiscipline} pb={selectedPb} age={age} sex={sex} />

          <ImprovementScenariosSection discipline={selectedDiscipline} pb={selectedPb} age={age} sex={sex} />

          <CompetitionLadderSection discipline={selectedDiscipline} pb={selectedPb} sex={sex} />

          <View style={{ height: 24 }} />
        </ScrollView>
      ) : (
        <DisciplinePicker
          performances={performances}
          onSelectDiscipline={(d) => setSelectedDiscipline(d)}
        />
      )}
    </SafeAreaView>
  )
}

// ── Styles ──────────────────────────────────────────────────────────────────

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: colors.bg.primary },
  header: {
    padding: spacing.lg,
    paddingBottom: spacing.sm,
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: spacing.md,
  },
  backBtn: {
    padding: spacing.sm,
    marginLeft: -spacing.sm,
  },
  title: { fontSize: 26, fontWeight: '700', color: colors.text.primary, marginTop: 4 },

  content: { padding: spacing.lg, paddingTop: spacing.md },

  // Discipline picker
  disciplineCardContent: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    gap: spacing.md,
  },
  pbSection: { alignItems: 'center' },
  pbLabel: { fontSize: 10, letterSpacing: 1.5, color: colors.text.dimmed, fontWeight: '600', marginBottom: 2 },
  pbValue: { fontSize: 20, fontWeight: '700' },

  tierSection: { alignItems: 'center' },
  tierBadge: {
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.sm,
    borderRadius: radius.md,
  },
  tierLabel: { fontSize: 12, fontWeight: '700', letterSpacing: 0.5 },

  // Tier positioning
  pbDisplay: {
    fontSize: 48,
    fontWeight: '800',
    color: colors.orange[500],
    letterSpacing: -2,
    textAlign: 'center',
    marginBottom: spacing.lg,
  },
  tierBadgeLarge: {
    paddingHorizontal: spacing.lg,
    paddingVertical: spacing.md,
    borderRadius: radius.lg,
    alignItems: 'center',
    marginBottom: spacing.lg,
  },
  tierNameLarge: { fontSize: 18, fontWeight: '700', letterSpacing: 0.5 },
  tierShortLarge: { fontSize: 14, fontWeight: '600', marginTop: spacing.xs },

  tierStats: {
    flexDirection: 'row',
    paddingVertical: spacing.md,
    borderTopWidth: 1,
    borderBottomWidth: 1,
    borderTopColor: 'rgba(255,255,255,0.04)',
    borderBottomColor: 'rgba(255,255,255,0.04)',
    marginBottom: spacing.lg,
  },
  tierStat: { flex: 1, alignItems: 'center' },
  tierStatLabel: { fontSize: 9, letterSpacing: 1.5, color: colors.text.dimmed, fontWeight: '600', marginBottom: 2 },
  tierStatValue: { fontSize: 16, fontWeight: '700', color: colors.text.primary },
  tierStatDivider: {
    width: 1,
    height: 32,
    backgroundColor: 'rgba(255,255,255,0.08)',
  },

  tierLadderContainer: { marginTop: spacing.md },
  tierLadder: { flexDirection: 'row', gap: 4, marginBottom: spacing.sm },
  tierRung: {
    flex: 1,
    height: 8,
    borderRadius: radius.full,
  },
  tierLadderLabels: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    paddingHorizontal: 2,
  },
  tierLadderLabel: { fontSize: 9, color: colors.text.dimmed, fontWeight: '600' },

  // Similar athletes
  similarAthleteRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingVertical: spacing.md,
    borderBottomWidth: 1,
    borderBottomColor: 'rgba(255,255,255,0.04)',
  },
  similarAthleteName: { fontSize: 14, fontWeight: '700', color: colors.text.primary, marginBottom: 2 },
  similarAthleteCountry: { fontSize: 12, color: colors.text.dimmed },
  similarAthletePb: { alignItems: 'flex-end' },
  similarAthletePbValue: { fontSize: 16, fontWeight: '700', color: colors.orange[500] },
  similarAthleteAge: { fontSize: 10, color: colors.text.muted, marginTop: 2 },

  // Improvement scenarios
  scenarioCard: {
    backgroundColor: 'rgba(255,255,255,0.02)',
    borderRadius: radius.md,
    padding: spacing.md,
    marginBottom: spacing.md,
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.04)',
  },
  scenarioHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
    marginBottom: spacing.md,
  },
  scenarioName: { fontSize: 14, fontWeight: '700', marginBottom: 4 },
  scenarioAge: { fontSize: 12, color: colors.text.muted },
  scenarioPb: { fontSize: 18, fontWeight: '700', textAlign: 'right' },

  scenarioStats: {
    flexDirection: 'row',
    paddingTop: spacing.md,
    borderTopWidth: 1,
    borderTopColor: 'rgba(255,255,255,0.04)',
  },
  scenarioStat: { flex: 1, alignItems: 'center' },
  scenarioStatLabel: { fontSize: 9, letterSpacing: 1, color: colors.text.dimmed, fontWeight: '600', marginBottom: 2 },
  scenarioStatValue: { fontSize: 14, fontWeight: '700', color: colors.text.primary },
  scenarioStatDivider: {
    width: 1,
    height: 28,
    backgroundColor: 'rgba(255,255,255,0.08)',
  },

  // Competition ladder
  ladderRung: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingVertical: spacing.md,
    borderBottomWidth: 1,
    borderBottomColor: 'rgba(255,255,255,0.04)',
  },
  ladderRungleft: { flexDirection: 'row', alignItems: 'center', gap: spacing.md },
  ladderCheckmark: {
    width: 24,
    height: 24,
    borderRadius: radius.full,
    justifyContent: 'center',
    alignItems: 'center',
  },
  ladderLabel: { fontSize: 14, color: colors.text.secondary, fontWeight: '600' },
  ladderRight: { alignItems: 'flex-end' },
  ladderThreshold: { fontSize: 14, fontWeight: '700', color: colors.text.primary },
  ladderGap: { fontSize: 11, color: colors.text.muted, marginTop: 2 },
})
