// ═══════════════════════════════════════════════════════════════════════════
// ATHLETE DETAIL SCREEN — Premium deep dive from coach roster
// Clean hero → tier positioning → season progression → race log → comparisons
// Strava/Whoop-inspired: large numbers, clean sections, no emojis
// ═══════════════════════════════════════════════════════════════════════════

import React, { useState, useMemo } from 'react'
import {
  View,
  Text,
  ScrollView,
  TouchableOpacity,
  StyleSheet,
} from 'react-native'
import { SafeAreaView } from 'react-native-safe-area-context'
import { useRoute, useNavigation } from '@react-navigation/native'
import { Ionicons } from '@expo/vector-icons'
import { colors, spacing, radius } from '../lib/theme'
import { getTier, TIER_NAMES, TIER_COLORS } from '../lib/performanceTiers'
import { getAgeGroup } from '../lib/performanceLevels'
import { isLowerBetter, performancePercentile } from '../lib/disciplineScience'
import FullAnalysis from '../components/FullAnalysis'

// ── Helpers ─────────────────────────────────────────────────────────────────
const THROWS = ['Discus Throw', 'Shot Put', 'Javelin Throw', 'Hammer Throw', 'Discus', 'Javelin', 'Hammer', 'Shot']
const isThrowsDiscipline = (d: string) => THROWS.some(t => d?.toLowerCase().includes(t.toLowerCase()))

function formatMark(value: number | null, discipline: string): string {
  if (!value) return '—'
  if (isThrowsDiscipline(discipline)) return `${value.toFixed(2)}m`
  const mins = Math.floor(value / 60)
  const secs = (value % 60).toFixed(2)
  return mins > 0 ? `${mins}:${secs.padStart(5, '0')}` : `${secs}s`
}

function calcAge(dob: string | null): number | null {
  if (!dob) return null
  return Math.floor((Date.now() - new Date(dob).getTime()) / (365.25 * 24 * 60 * 60 * 1000))
}

export default function AthleteDetailScreen() {
  const route = useRoute<any>()
  const navigation = useNavigation()
  const athlete = route.params?.athlete

  if (!athlete) {
    return (
      <SafeAreaView style={styles.safe}>
        <View style={styles.emptyWrap}>
          <Ionicons name="person-outline" size={32} color={colors.text.dimmed} />
          <Text style={styles.emptyText}>No athlete data</Text>
        </View>
      </SafeAreaView>
    )
  }

  const age = calcAge(athlete.dob)
  const ageGroup = age ? getAgeGroup(age) : 'Senior'
  const genderCode = athlete.gender === 'Female' ? 'F' : 'M'
  const lower = isLowerBetter(athlete.discipline)

  // Compute PB
  const pb = useMemo(() => {
    if (athlete.pb_value) return athlete.pb_value
    if (!athlete.races?.length) return null
    const values = athlete.races.map((r: any) => parseFloat(r.value)).filter(Number.isFinite)
    if (!values.length) return null
    return lower ? Math.min(...values) : Math.max(...values)
  }, [athlete])

  const tier = pb ? getTier(athlete.discipline, genderCode, ageGroup, pb) : null
  const percentile = pb ? performancePercentile(pb, athlete.discipline, genderCode) : null

  // Sort races by date (newest first)
  const races = useMemo(() => {
    if (!athlete.races?.length) return []
    return [...athlete.races]
      .sort((a: any, b: any) => new Date(b.date).getTime() - new Date(a.date).getTime())
  }, [athlete])

  // Season bests
  const seasonBests = useMemo(() => {
    if (!races.length) return []
    const grouped: Record<string, number[]> = {}
    for (const r of races) {
      const year = r.date ? new Date(r.date).getFullYear().toString() : 'Unknown'
      if (!grouped[year]) grouped[year] = []
      const v = parseFloat(r.value)
      if (Number.isFinite(v)) grouped[year].push(v)
    }
    return Object.entries(grouped)
      .map(([year, vals]) => ({
        year,
        best: lower ? Math.min(...vals) : Math.max(...vals),
        count: vals.length,
      }))
      .sort((a, b) => b.year.localeCompare(a.year))
  }, [races])

  // Trend (last 2 results)
  const trend = useMemo(() => {
    if (races.length < 2) return null
    const curr = parseFloat(races[0].value)
    const prev = parseFloat(races[1].value)
    if (!Number.isFinite(curr) || !Number.isFinite(prev)) return null
    return lower ? (curr < prev ? 'up' : curr > prev ? 'down' : null)
                 : (curr > prev ? 'up' : curr < prev ? 'down' : null)
  }, [races])

  return (
    <SafeAreaView style={styles.safe}>
      {/* Header */}
      <View style={styles.header}>
        <TouchableOpacity onPress={() => navigation.goBack()} style={styles.backBtn}>
          <Ionicons name="chevron-back" size={22} color={colors.text.primary} />
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

      <ScrollView contentContainerStyle={styles.content} showsVerticalScrollIndicator={false}>
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
            <Ionicons name="timer-outline" size={24} color={colors.text.dimmed} />
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
      </ScrollView>
    </SafeAreaView>
  )
}

// ── Styles ──────────────────────────────────────────────────────────────────
const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: colors.bg.primary },

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
    color: colors.text.primary,
  },
  headerMeta: {
    fontSize: 12,
    color: colors.text.muted,
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
    backgroundColor: 'rgba(249,115,22,0.06)',
    borderWidth: 1,
    borderColor: 'rgba(249,115,22,0.15)',
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
    color: colors.text.primary,
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
  heroStatVal: { fontSize: 17, fontWeight: '700', color: colors.text.primary },
  heroStatLabel: { fontSize: 9, letterSpacing: 1, color: colors.text.muted, fontWeight: '600', marginTop: 2, textTransform: 'uppercase' },
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
  noPbText: { fontSize: 15, fontWeight: '600', color: colors.text.secondary },
  noPbSub: { fontSize: 13, color: colors.text.muted, textAlign: 'center', lineHeight: 18 },

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
  sectionTitle: { fontSize: 14, fontWeight: '600', color: colors.text.primary, flex: 1 },
  sectionCount: {
    fontSize: 11,
    color: colors.text.dimmed,
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
  seasonYear: { fontSize: 13, fontWeight: '700', color: colors.text.muted, width: 38 },
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
  seasonBest: { fontSize: 14, fontWeight: '700', color: colors.text.primary },
  seasonCount: { fontSize: 10, color: colors.text.dimmed, marginTop: 1 },

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
  raceMark: { fontSize: 15, fontWeight: '700', color: colors.text.primary },
  raceComp: { fontSize: 11, color: colors.text.muted, marginTop: 1 },
  raceDate: { fontSize: 12, color: colors.text.muted },
  pbChip: {
    backgroundColor: colors.orange[500] + '18',
    paddingHorizontal: 6,
    paddingVertical: 1,
    borderRadius: 4,
    borderWidth: 1,
    borderColor: colors.orange[500] + '30',
  },
  pbChipText: { fontSize: 9, fontWeight: '700', color: colors.orange[500], letterSpacing: 0.5 },
  moreText: { fontSize: 11, color: colors.text.dimmed, textAlign: 'center', marginTop: spacing.sm },

  // Empty
  emptyWrap: { flex: 1, justifyContent: 'center', alignItems: 'center', gap: spacing.md },
  emptyText: { fontSize: 15, color: colors.text.muted },
})
