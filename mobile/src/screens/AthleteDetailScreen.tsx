// ═══════════════════════════════════════════════════════════════════════════
// ATHLETE DETAIL SCREEN — Premium deep dive from coach roster
// Clean hero → tier positioning → season progression → race log → comparisons
// Strava/Whoop-inspired: large numbers, clean sections, no emojis
// ═══════════════════════════════════════════════════════════════════════════

import React, { useState, useMemo, useEffect, useRef } from 'react'
import {
  View,
  Text,
  Animated,
  TouchableOpacity,
  StyleSheet,
} from 'react-native'
import { SafeAreaView } from 'react-native-safe-area-context'
import ScreenBackdrop, { BACKDROP_GROUND } from '../components/ScreenBackdrop'
import { useRoute, useNavigation } from '@react-navigation/native'
import { Ionicons } from '@expo/vector-icons'
import { colors, spacing, radius, onImage } from '../lib/theme'
import { useTheme } from '../contexts/ThemeContext'
import { getTier, TIER_NAMES, TIER_COLORS } from '../lib/performanceTiers'
import { getAgeGroup } from '../lib/performanceLevels'
import { ageFromDob } from '../lib/age'
import { isLowerBetter, performancePercentile, formatMark } from '../lib/disciplineScience'
import {
  fetchResults, subjectOf, pbOf, seasonBestsOf, trendOf,
} from '../lib/athleteResults'
import FullAnalysis from '../components/FullAnalysis'

// Helpers now live in lib/disciplineScience — see formatMark there.


export default function AthleteDetailScreen() {
  const { colors: c } = useTheme()
  const route = useRoute<any>()
  const navigation = useNavigation()
  const athlete = route.params?.athlete

  if (!athlete) {
    return (
      <SafeAreaView style={[styles.safe, { backgroundColor: BACKDROP_GROUND }]}>
        <View style={styles.emptyWrap}>
          <Ionicons name="person-outline" size={32} color={onImage.dim} />
          <Text style={styles.emptyText}>No athlete data</Text>
        </View>
      </SafeAreaView>
    )
  }

  const age = ageFromDob(athlete.dob)
  const ageGroup = age ? getAgeGroup(age) : 'Senior'
  const genderCode = athlete.gender === 'Female' ? 'F' : 'M'
  const lower = isLowerBetter(athlete.discipline)

  // Results now come from `performances` for BOTH kinds of athlete — one with
  // an account and one the coach keeps on their roster. This screen used to
  // read a JSON blob on the roster row that carried no status and no wind, so
  // a coach's view of a mark could not apply the rules the athlete's own view
  // applied: the same +2.9 sprint was a personal best to one of them and not
  // to the other. Everything below goes through countsForAnalysis now.
  // Drives the backdrop's parallax and blur, as on every other screen.
  const scrollY = useRef(new Animated.Value(0)).current
  const [results, setResults] = useState<any[]>([])
  const [loading, setLoading] = useState(true)
  useEffect(() => {
    let alive = true
    const subject = subjectOf(athlete)
    if (!subject) { setResults([]); setLoading(false); return }
    setLoading(true)
    fetchResults(subject)
      .then((rows) => { if (alive) setResults(rows) })
      .finally(() => { if (alive) setLoading(false) })
    return () => { alive = false }
  }, [athlete?.id, athlete?.linked_user_id])

  const pb = useMemo(
    () => pbOf(results, athlete.discipline), [results, athlete.discipline])

  const tier = pb ? getTier(athlete.discipline, genderCode, ageGroup, pb) : null
  const percentile = pb ? performancePercentile(pb, athlete.discipline, genderCode) : null

  // Newest first. The date is a plain YYYY-MM-DD, so it sorts as a string —
  // going through Date would read it as UTC midnight.
  const races = useMemo(
    () => [...results]
      .filter((r) => r.competition_date)
      .sort((a, b) => String(b.competition_date).localeCompare(String(a.competition_date)))
      .map((r) => ({ ...r, value: r.mark, date: r.competition_date, competition: r.competition_name })),
    [results])

  const seasonBests = useMemo(
    () => seasonBestsOf(results, athlete.discipline), [results, athlete.discipline])

  const trend = useMemo(
    () => trendOf(results, athlete.discipline), [results, athlete.discipline])

  return (
    <View style={{ flex: 1, backgroundColor: BACKDROP_GROUND }}>
      {/* The same photographic ground as everywhere else. This screen was the
          one place still rendering on the light theme — near-black type on a
          near-white paper, in the middle of a dark app. */}
      <ScreenBackdrop image="gym" scrollY={scrollY} />
      <SafeAreaView style={[styles.safe, { backgroundColor: 'transparent' }]}>
      {/* Header */}
      <View style={styles.header}>
        <TouchableOpacity onPress={() => navigation.goBack()} style={styles.backBtn}>
          <Ionicons name="chevron-back" size={22} color={onImage.ink} />
        </TouchableOpacity>
        <View style={{ flex: 1 }}>
          <Text style={styles.headerName} numberOfLines={1}>{athlete.name}</Text>
          <Text style={styles.headerMeta}>
            {athlete.discipline} · {ageGroup}{age ? ` (${age})` : ''}
          </Text>
        </View>
        {trend === 'up' && (
          <View style={[styles.trendChip, { backgroundColor: colors.green + '12', borderColor: colors.green + '25' }]}>
            <Ionicons name="arrow-up" size={10} color={colors.green} />
            <Text style={[styles.trendChipText, { color: colors.green }]}>Improving</Text>
          </View>
        )}
        {trend === 'down' && (
          <View style={[styles.trendChip, { backgroundColor: colors.red + '12', borderColor: colors.red + '25' }]}>
            <Ionicons name="arrow-down" size={10} color={colors.red} />
            <Text style={[styles.trendChipText, { color: colors.red }]}>Declining</Text>
          </View>
        )}
      </View>

      <Animated.ScrollView
        contentContainerStyle={styles.content}
        showsVerticalScrollIndicator={false}
        scrollEventThrottle={16}
        onScroll={Animated.event(
          [{ nativeEvent: { contentOffset: { y: scrollY } } }],
          { useNativeDriver: true },
        )}
      >
        {/* Hero PB Card */}
        {pb ? (
          <View style={styles.heroCard}>
            <View pointerEvents="none" style={styles.heroGlow} />
            <View pointerEvents="none" style={styles.heroGlow2} />

            <View style={styles.heroInner}>
              <Text style={styles.heroPb}>{formatMark(pb, athlete.discipline)}</Text>

              {tier && (
                <View style={[styles.heroBadge, { backgroundColor: tier.color + '15', borderColor: tier.color + '25' }]}>
                  <View style={[styles.heroBadgeDot, { backgroundColor: tier.color }]} />
                  <Text style={[styles.heroBadgeText, { color: tier.color }]}>{tier.tierName}</Text>
                </View>
              )}

              {/* Key stats */}
              <View style={styles.heroStats}>
                {percentile !== null && (
                  <View style={styles.heroStat}>
                    <Text style={styles.heroStatVal}>{percentile}%</Text>
                    <Text style={styles.heroStatLabel}>Percentile</Text>
                  </View>
                )}
                <View style={styles.heroStatDivider} />
                <View style={styles.heroStat}>
                  <Text style={styles.heroStatVal}>{races.length}</Text>
                  <Text style={styles.heroStatLabel}>Races</Text>
                </View>
                {tier?.nextTier && (
                  <>
                    <View style={styles.heroStatDivider} />
                    <View style={styles.heroStat}>
                      <Text style={[styles.heroStatVal, { color: colors.orange[500] }]}>
                        {tier.gap ? `${lower ? '+' : '-'}${Math.abs(tier.gap).toFixed(2)}` : '—'}
                      </Text>
                      <Text style={styles.heroStatLabel}>To {TIER_NAMES[tier.nextTier]}</Text>
                    </View>
                  </>
                )}
              </View>

              {/* Tier bar */}
              <View style={styles.tierBar}>
                {[1, 2, 3, 4, 5, 6, ...(ageGroup === 'Senior' ? [7] : [])].map(t => (
                  <View key={t} style={[styles.tierSegment, {
                    backgroundColor: tier && tier.tier >= t ? TIER_COLORS[t] : 'rgba(255,255,255,0.06)',
                  }]} />
                ))}
              </View>
            </View>
          </View>
        ) : (
          <View style={styles.noPbCard}>
            <Ionicons name="timer-outline" size={24} color={onImage.dim} />
            <Text style={styles.noPbText}>No performances logged yet</Text>
            <Text style={styles.noPbSub}>Race results will appear here once added via the scanner.</Text>
          </View>
        )}

        {/* Season Bests */}
        {seasonBests.length > 0 && (
          <View style={styles.section}>
            <View style={styles.sectionHeader}>
              <Ionicons name="bar-chart-outline" size={14} color={colors.orange[500]} />
              <Text style={styles.sectionTitle}>Season Progression</Text>
            </View>
            {seasonBests.map((sb, idx) => {
              // Progress bar relative to PB
              const barPct = pb ? Math.min((sb.best / pb) * 100, 100) : 0
              const adjustedPct = lower ? barPct : Math.min(100, barPct)
              const isBest = pb === sb.best
              return (
                <View key={idx} style={styles.seasonRow}>
                  <Text style={styles.seasonYear}>{sb.year}</Text>
                  <View style={styles.seasonBarWrap}>
                    <View style={[styles.seasonBarFill, {
                      width: `${Math.max(adjustedPct, 8)}%`,
                      backgroundColor: isBest ? colors.orange[500] : colors.orange[500] + '40',
                    }]} />
                  </View>
                  <View style={styles.seasonRight}>
                    <Text style={[styles.seasonBest, isBest && { color: colors.orange[500] }]}>
                      {formatMark(sb.best, athlete.discipline)}
                    </Text>
                    <Text style={styles.seasonCount}>{sb.count} race{sb.count !== 1 ? 's' : ''}</Text>
                  </View>
                </View>
              )
            })}
          </View>
        )}

        {/* Race History */}
        {races.length > 0 && (
          <View style={styles.section}>
            <View style={styles.sectionHeader}>
              <Ionicons name="list-outline" size={14} color={colors.blue} />
              <Text style={styles.sectionTitle}>Race Log</Text>
              <Text style={styles.sectionCount}>{races.length}</Text>
            </View>
            {races.slice(0, 15).map((race: any, idx: number) => {
              const val = parseFloat(race.value)
              const isPb = pb === val
              return (
                <View key={idx} style={styles.raceRow}>
                  <View style={{ flex: 1 }}>
                    <View style={styles.raceMarkRow}>
                      <Text style={styles.raceMark}>{formatMark(val, athlete.discipline)}</Text>
                      {isPb && (
                        <View style={styles.pbChip}>
                          <Text style={styles.pbChipText}>PB</Text>
                        </View>
                      )}
                    </View>
                    {race.competition && <Text style={styles.raceComp}>{race.competition}</Text>}
                  </View>
                  <Text style={styles.raceDate}>
                    {race.date
                      ? new Date(race.date).toLocaleDateString('en-GB', { day: 'numeric', month: 'short', year: '2-digit' })
                      : '—'}
                  </Text>
                </View>
              )
            })}
            {races.length > 15 && (
              <Text style={styles.moreText}>+ {races.length - 15} more races</Text>
            )}
          </View>
        )}

        {/* Full 5-Act Analysis */}
        {pb && age && (
          <FullAnalysis
            discipline={athlete.discipline}
            mark={pb}
            age={age}
            sex={genderCode}
            athleteName={athlete.name}
          />
        )}

        <View style={{ height: 40 }} />
      </Animated.ScrollView>
      </SafeAreaView>
    </View>
  )
}

// ── Styles ──────────────────────────────────────────────────────────────────
const styles = StyleSheet.create({
  safe: { flex: 1 },

  header: {
    paddingHorizontal: spacing.lg,
    paddingTop: spacing.sm,
    paddingBottom: spacing.md,
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
    borderBottomWidth: 1,
    borderBottomColor: 'rgba(255,255,255,0.04)',
  },
  backBtn: {
    width: 36,
    height: 36,
    borderRadius: 18,
    backgroundColor: 'rgba(255,255,255,0.04)',
    justifyContent: 'center',
    alignItems: 'center',
  },
  headerName: {
    fontSize: 18,
    fontWeight: '700',
    color: onImage.ink,
  },
  headerMeta: {
    fontSize: 12,
    color: onImage.muted,
    marginTop: 1,
  },
  trendChip: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 3,
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 12,
    borderWidth: 1,
  },
  trendChipText: { fontSize: 10, fontWeight: '600' },

  content: { padding: spacing.lg, paddingTop: spacing.lg },

  // Hero
  heroCard: {
    position: 'relative',
    overflow: 'hidden',
    // A real surface, not a 6% tint. This card sits over the photograph at
    // the top of the screen, and a near-transparent card hands everything
    // inside it whatever the picture happens to be doing.
    backgroundColor: 'rgba(23,25,53,0.92)',
    borderWidth: 1,
    borderColor: 'rgba(249,115,22,0.28)',
    borderRadius: radius.lg,
    marginBottom: spacing.lg,
  },
  heroGlow: {
    position: 'absolute',
    top: -60,
    left: -60,
    width: 160,
    height: 160,
    borderRadius: 80,
    backgroundColor: colors.orange[500],
    opacity: 0.08,
  },
  heroGlow2: {
    position: 'absolute',
    bottom: -50,
    right: -50,
    width: 120,
    height: 120,
    borderRadius: 60,
    backgroundColor: colors.blue,
    opacity: 0.04,
  },
  heroInner: {
    padding: spacing.xl,
    alignItems: 'center',
  },
  heroPb: {
    fontSize: 44,
    fontWeight: '800',
    color: onImage.ink,
    letterSpacing: -2,
    marginBottom: spacing.md,
  },
  heroBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    paddingHorizontal: 14,
    paddingVertical: 6,
    borderRadius: 20,
    borderWidth: 1,
    marginBottom: spacing.xl,
  },
  heroBadgeDot: { width: 6, height: 6, borderRadius: 3 },
  heroBadgeText: { fontSize: 13, fontWeight: '700' },
  heroStats: {
    flexDirection: 'row',
    gap: spacing.md,
    flexWrap: 'wrap',
    justifyContent: 'center',
    marginBottom: spacing.lg,
  },
  heroStat: { alignItems: 'center', minWidth: 60 },
  heroStatVal: { fontSize: 17, fontWeight: '700', color: onImage.ink },
  heroStatLabel: { fontSize: 9, letterSpacing: 1, color: onImage.muted, fontWeight: '600', marginTop: 2, textTransform: 'uppercase' },
  heroStatDivider: { width: 1, backgroundColor: 'rgba(255,255,255,0.08)' },
  tierBar: { flexDirection: 'row', gap: 3, width: '100%' },
  tierSegment: { flex: 1, height: 3, borderRadius: 1.5 },

  // No PB
  noPbCard: {
    alignItems: 'center',
    padding: spacing.xxl,
    backgroundColor: 'rgba(255,255,255,0.02)',
    borderRadius: radius.lg,
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.05)',
    marginBottom: spacing.lg,
    gap: spacing.sm,
  },
  noPbText: { fontSize: 15, fontWeight: '600', color: onImage.muted },
  noPbSub: { fontSize: 13, color: onImage.muted, textAlign: 'center', lineHeight: 18 },

  // Sections
  section: {
    backgroundColor: 'rgba(255,255,255,0.02)',
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.05)',
    borderRadius: radius.md,
    padding: spacing.lg,
    marginBottom: spacing.md,
  },
  sectionHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
    marginBottom: spacing.md,
    paddingBottom: spacing.sm,
    borderBottomWidth: 1,
    borderBottomColor: 'rgba(255,255,255,0.04)',
  },
  sectionTitle: { fontSize: 14, fontWeight: '600', color: onImage.ink, flex: 1 },
  sectionCount: {
    fontSize: 11,
    color: onImage.dim,
    fontWeight: '600',
    backgroundColor: 'rgba(255,255,255,0.04)',
    paddingHorizontal: 7,
    paddingVertical: 2,
    borderRadius: 8,
  },

  // Season progression
  seasonRow: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 10,
    borderBottomWidth: 1,
    borderBottomColor: 'rgba(255,255,255,0.03)',
    gap: spacing.md,
  },
  seasonYear: { fontSize: 13, fontWeight: '700', color: onImage.muted, width: 38 },
  seasonBarWrap: {
    flex: 1,
    height: 6,
    backgroundColor: 'rgba(255,255,255,0.04)',
    borderRadius: 3,
    overflow: 'hidden',
  },
  seasonBarFill: {
    height: 6,
    borderRadius: 3,
  },
  seasonRight: { alignItems: 'flex-end', minWidth: 70 },
  seasonBest: { fontSize: 14, fontWeight: '700', color: onImage.ink },
  seasonCount: { fontSize: 10, color: onImage.dim, marginTop: 1 },

  // Race log
  raceRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingVertical: 10,
    borderBottomWidth: 1,
    borderBottomColor: 'rgba(255,255,255,0.03)',
  },
  raceMarkRow: { flexDirection: 'row', alignItems: 'center', gap: 6 },
  raceMark: { fontSize: 15, fontWeight: '700', color: onImage.ink },
  raceComp: { fontSize: 11, color: onImage.muted, marginTop: 1 },
  raceDate: { fontSize: 12, color: onImage.muted },
  pbChip: {
    backgroundColor: colors.orange[500] + '18',
    paddingHorizontal: 6,
    paddingVertical: 1,
    borderRadius: 4,
    borderWidth: 1,
    borderColor: colors.orange[500] + '30',
  },
  pbChipText: { fontSize: 9, fontWeight: '700', color: colors.orange[500], letterSpacing: 0.5 },
  moreText: { fontSize: 11, color: onImage.dim, textAlign: 'center', marginTop: spacing.sm },

  // Empty
  emptyWrap: { flex: 1, justifyContent: 'center', alignItems: 'center', gap: spacing.md },
  emptyText: { fontSize: 15, color: onImage.muted },
})
