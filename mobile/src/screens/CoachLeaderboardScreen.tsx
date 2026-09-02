// ═══════════════════════════════════════════════════════════════════════
// LEADERBOARDS — the squad ranked, by event.
//
// Never one list of a whole squad: a 400m runner and a hammer thrower share
// no scale, and ranking them together would be a category error dressed up
// as a table. One board per discipline, best first.
//
// Only approved, legal, completed marks appear — the same gate the athlete's
// own screens use. That is what makes the approval flow feel worth doing
// rather than like paperwork: a board you could move by logging an
// unverified time would not be worth looking at.
// ═══════════════════════════════════════════════════════════════════════

import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { View, Text, Animated, StyleSheet, RefreshControl } from 'react-native'
import { SafeAreaView } from 'react-native-safe-area-context'
import { Ionicons } from '@expo/vector-icons'
import { useNavigation } from '@react-navigation/native'
import { useAuth } from '../contexts/AuthContext'
import { useTheme } from '../contexts/ThemeContext'
import { spacing, radius, onImage, typeScale, weight } from '../lib/theme'
import { Tappable, MonoKicker } from '../components/ui'
import ScreenBackdrop, { BACKDROP_GROUND } from '../components/ScreenBackdrop'
import AppHeader from '../components/AppHeader'
import { TAB_BAR_CLEARANCE } from '../navigation/FloatingTabBar'
import FilterRow from '../components/FilterRow'
import InfoDot from '../components/InfoDot'
import { SkeletonRows, LoadFailed } from '../components/LoadState'
import { newTrouble } from '../lib/loadState'
import { fetchSquadAthletes, subjectFor, type SquadAthlete } from '../lib/squads'
import { fetchResultsForMany, fetchMetricsForMany } from '../lib/athleteResults'
import {
  buildBoards, buildMetricBoards, excludedCount, currentSeason,
  filterOptions, passes, emptyFilters, type RankMode, type Filters,
} from '../lib/leaderboard'
import { fmtMetricValue } from '../lib/metricSemantics'
import { formatMark } from '../lib/disciplineScience'
import { ageFromDob } from '../lib/age'
import { getAgeGroup } from '../lib/performanceLevels'
import { getTier, TIER_COLORS, TIER_SHORT } from '../lib/performanceTiers'
import { tapFeedback } from '../lib/haptics'

const MEDAL = ['#F0C33C', '#C7CEDB', '#C9834E']

export default function CoachLeaderboardScreen() {
  const { user } = useAuth()
  const { colors } = useTheme()
  const navigation = useNavigation<any>()
  const scrollY = useRef(new Animated.Value(0)).current

  const [athletes, setAthletes] = useState<SquadAthlete[]>([])
  const [results, setResults] = useState<Map<string, any[]>>(new Map())
  const [metrics, setMetrics] = useState<Map<string, any[]>>(new Map())
  // What is being ranked, and then who is in the running.
  const [what, setWhat] = useState<'performance' | 'physical'>('performance')
  const [mode, setMode] = useState<RankMode>('pb')
  const [filters, setFilters] = useState<Filters>(emptyFilters())
  const [refreshing, setRefreshing] = useState(false)
  // Three states, not two. 'Empty' is the only one that makes a claim
  // about the athletes, so it is the last one considered.
  const [loading, setLoading] = useState(true)
  const [failed, setFailed] = useState(false)

  const load = useCallback(async () => {
    const t = newTrouble()
    const ath = await fetchSquadAthletes(t)
    setAthletes(ath)
    const subjects = ath.map(subjectFor)
    const [r, m] = await Promise.all([
      fetchResultsForMany(subjects, t), fetchMetricsForMany(subjects, t),
    ])
    setResults(r); setMetrics(m)
    setFailed(t.failed)
    setLoading(false)
  }, [user])

  const toggle = (group: keyof Filters, value: string) => setFilters((f) => {
    const next = new Set(f[group])
    next.has(value) ? next.delete(value) : next.add(value)
    return { ...f, [group]: next }
  })
  const clear = (group: keyof Filters) =>
    setFilters((f) => ({ ...f, [group]: new Set<string>() }))

  useEffect(() => { load() }, [load])
  useEffect(() => navigation.addListener('focus', load), [navigation, load])

  const options = useMemo(() => filterOptions(athletes), [athletes])
  const shown = useMemo(() => athletes.filter((a) => passes(a, filters)), [athletes, filters])

  const boards = useMemo(
    () => buildBoards(shown, results, mode, currentSeason()),
    [shown, results, mode])
  const metricBoards = useMemo(
    () => buildMetricBoards(shown, metrics), [shown, metrics])
  const excluded = useMemo(() => excludedCount(shown, boards), [shown, boards])
  const nothing = what === 'performance' ? boards.length === 0 : metricBoards.length === 0

  return (
    <View style={{ flex: 1, backgroundColor: BACKDROP_GROUND }}>
      <ScreenBackdrop image="gym" scrollY={scrollY} />
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
          <View style={{ paddingHorizontal: spacing.lg, marginBottom: 16 }}>
            <MonoKicker color={onImage.muted}>Approved results only</MonoKicker>
            <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8 }}>
              <Text style={s.h1}>Leaderboards</Text>
              <InfoDot term="approval" size={16} />
            </View>
          </View>

          {/* What is being ranked. */}
          <View style={s.modes}>
            {([['performance', 'Performance'], ['physical', 'Physical']] as const).map(([w, label]) => {
              const on = what === w
              return (
                <Tappable key={w} onPress={() => { tapFeedback(); setWhat(w) }}
                  accessibilityLabel={label} accessibilityState={{ selected: on }}
                  style={[s.mode, { flex: 1, minHeight: 42,
                    borderColor: on ? colors.accent[500] + '8C' : onImage.chipEdge,
                    backgroundColor: on ? colors.accent[500] + '2E' : onImage.chipPlate,
                  }]}>
                  <Text style={[s.modeText, { color: on ? '#FFFFFF' : onImage.muted }]}>{label}</Text>
                </Tappable>
              )
            })}
          </View>

          {what === 'performance' && (
            <View style={[s.modes, { marginTop: 8 }]}>
              {([['pb', 'All time'], ['season', currentSeason()]] as [RankMode, string][]).map(
                ([m, label]) => {
                  const on = mode === m
                  return (
                    <Tappable key={m} onPress={() => { tapFeedback(); setMode(m) }}
                      accessibilityLabel={label} accessibilityState={{ selected: on }}
                      style={[s.mode, {
                        borderColor: on ? colors.accent[500] + '8C' : onImage.chipEdge,
                        backgroundColor: on ? colors.accent[500] + '2E' : onImage.chipPlate,
                      }]}>
                      <Text style={[s.modeText, { color: on ? '#FFFFFF' : onImage.muted }]}>{label}</Text>
                    </Tappable>
                  )
                })}
            </View>
          )}

          {/* Who is in the running. Nothing selected means everyone. */}
          <FilterRow label="Event" options={options.disciplines}
            selected={filters.disciplines}
            onToggle={(v) => toggle('disciplines', v)} onClear={() => clear('disciplines')} />
          <FilterRow label="Age group" options={options.ageGroups}
            selected={filters.ageGroups}
            onToggle={(v) => toggle('ageGroups', v)} onClear={() => clear('ageGroups')} />
          <FilterRow label="Gender" options={options.genders}
            selected={filters.genders}
            onToggle={(v) => toggle('genders', v)} onClear={() => clear('genders')} />

          {shown.length !== athletes.length && (
            <Text style={s.filtered}>
              {shown.length} of {athletes.length} athletes match.
            </Text>
          )}

          {!loading && !failed && what === 'performance' && boards.map((b) => (
            <View key={b.discipline} style={s.board}>
              <View style={s.boardHead}>
                <Text style={s.boardTitle}>{b.discipline}</Text>
                <Text style={s.boardCount}>
                  {b.rows.length} {b.rows.length === 1 ? 'athlete' : 'athletes'}
                </Text>
              </View>

              {b.rows.map((row) => {
                const a = row.athlete
                const age = ageFromDob(a.dob)
                const tier = age
                  ? getTier(b.discipline, a.gender === 'F' ? 'F' : 'M', getAgeGroup(age), row.mark)
                  : null
                const medal = row.rank <= 3 ? MEDAL[row.rank - 1] : null
                return (
                  <Tappable
                    key={(a.athlete_user_id || a.roster_athlete_id) as string}
                    onPress={() => { tapFeedback(); navigation.navigate('AthleteDetail', {
                      athlete: {
                        id: a.roster_athlete_id, linked_user_id: a.athlete_user_id,
                        name: a.name, dob: a.dob, gender: a.gender, discipline: a.discipline,
                      },
                    }) }}
                    accessibilityLabel={`${row.rank}. ${a.name}, ${formatMark(row.mark, b.discipline)}`}
                    style={s.row}
                  >
                    <Text style={[s.rank, medal ? { color: medal } : null]}>{row.rank}</Text>
                    <View style={{ flex: 1 }}>
                      <Text style={s.name} numberOfLines={1}>{a.name}</Text>
                      <Text style={s.meta} numberOfLines={1}>
                        {[age ? getAgeGroup(age) : null,
                          `${row.results} ${row.results === 1 ? 'result' : 'results'}`,
                          a.athlete_user_id ? null : 'no account',
                        ].filter(Boolean).join(' · ')}
                      </Text>
                    </View>
                    {!!tier && (
                      <View style={[s.tier, { borderColor: (TIER_COLORS as any)[tier.tier] + '66' }]}>
                        <Text style={[s.tierText, { color: (TIER_COLORS as any)[tier.tier] }]}>
                          {(TIER_SHORT as any)[tier.tier] || tier.tier}
                        </Text>
                      </View>
                    )}
                    <Text style={s.mark}>{formatMark(row.mark, b.discipline)}</Text>
                  </Tappable>
                )
              })}
            </View>
          ))}

          {!loading && !failed && what === 'physical' && metricBoards.map((b) => (
            <View key={b.key} style={s.board}>
              <View style={s.boardHead}>
                <Text style={s.boardTitle}>{b.label}</Text>
                <Text style={s.boardCount}>
                  {b.rows.length} {b.rows.length === 1 ? 'athlete' : 'athletes'}
                </Text>
              </View>

              {b.rows.map((row) => {
                const a = row.athlete
                const age = ageFromDob(a.dob)
                const medal = row.rank <= 3 ? MEDAL[row.rank - 1] : null
                const value = `${fmtMetricValue(row.value)}${b.unit ? ` ${b.unit}` : ''}`
                return (
                  <Tappable
                    key={(a.athlete_user_id || a.roster_athlete_id) as string}
                    onPress={() => { tapFeedback(); navigation.navigate('AthleteDetail', {
                      athlete: {
                        id: a.roster_athlete_id, linked_user_id: a.athlete_user_id,
                        name: a.name, dob: a.dob, gender: a.gender, discipline: a.discipline,
                      },
                    }) }}
                    accessibilityLabel={`${row.rank}. ${a.name}, ${value}`}
                    style={s.row}
                  >
                    <Text style={[s.rank, medal ? { color: medal } : null]}>{row.rank}</Text>
                    <View style={{ flex: 1 }}>
                      <Text style={s.name} numberOfLines={1}>{a.name}</Text>
                      <Text style={s.meta} numberOfLines={1}>
                        {[age ? getAgeGroup(age) : null,
                          `${row.results} ${row.results === 1 ? 'test' : 'tests'}`,
                          a.athlete_user_id ? null : 'no account',
                        ].filter(Boolean).join(' \u00b7 ')}
                      </Text>
                    </View>
                    <Text style={s.mark}>{value}</Text>
                  </Tappable>
                )
              })}
            </View>
          ))}

          {/* Was: render the empty state, then repaint when the fetch landed.
              So the first frame of this tab said "Nothing to rank yet" about a
              squad we had not finished asking about. */}
          {loading && <View style={{ marginTop: 22 }}><SkeletonRows rows={5} /></View>}

          {!loading && failed && <LoadFailed />}

          {!loading && !failed && nothing && (
            <View style={{ paddingHorizontal: spacing.lg, paddingTop: 30, alignItems: 'center' }}>
              <Ionicons name="podium-outline" size={30} color={onImage.muted} />
              <Text style={s.emptyTitle}>Nothing to rank yet</Text>
              <Text style={s.emptyBody}>
                {athletes.length === 0
                  ? 'Add athletes and their results will rank here.'
                  : shown.length === 0
                    ? 'No athlete matches these filters. Tap All to widen them.'
                    : what === 'physical'
                      ? 'Nobody matching has a recorded test yet. Log a jump, a sprint split or a lift and it will rank here.'
                      : mode === 'season'
                        ? `Nobody matching has an approved result from ${currentSeason()} yet.`
                        : 'Nobody matching has an approved result yet. Results awaiting your approval are in your inbox.'}
              </Text>
            </View>
          )}

          {!loading && !failed && what === 'performance' && boards.length > 0 && excluded > 0 && (
            <Text style={s.foot}>
              {excluded} {excluded === 1 ? 'athlete has' : 'athletes have'} no approved
              {mode === 'season' ? ` ${currentSeason()} ` : ' '}result yet, so
              {excluded === 1 ? ' they are' : ' they are'} not ranked.
            </Text>
          )}
        </Animated.ScrollView>
      </SafeAreaView>
    </View>
  )
}

const s = StyleSheet.create({
  h1: { fontSize: typeScale.hero, fontWeight: weight.bold, letterSpacing: -0.9, color: onImage.ink },
  modes: { flexDirection: 'row', gap: 8, paddingHorizontal: spacing.lg, marginTop: 14 },
  mode: {
    minHeight: 36, paddingHorizontal: 14, borderRadius: radius.full, borderWidth: 1,
    alignItems: 'center', justifyContent: 'center',
  },
  modeText: { fontSize: typeScale.caption, fontWeight: weight.bold },
  filtered: {
    color: onImage.muted, fontSize: typeScale.caption, fontWeight: weight.medium,
    paddingHorizontal: spacing.lg, marginTop: 14,
  },
  board: { marginTop: 22, paddingHorizontal: spacing.lg },
  boardHead: {
    flexDirection: 'row', alignItems: 'baseline', justifyContent: 'space-between',
    marginBottom: 10, gap: 10,
  },
  boardTitle: { color: onImage.ink, fontSize: typeScale.title, fontWeight: weight.bold, letterSpacing: -0.3, flex: 1 },
  boardCount: { color: onImage.muted, fontSize: typeScale.caption },
  row: {
    flexDirection: 'row', alignItems: 'center', gap: 12,
    minHeight: 58, paddingHorizontal: 14, marginBottom: 7,
    borderRadius: radius.card, borderWidth: 1,
    borderColor: onImage.cardBorder, backgroundColor: onImage.card,
  },
  rank: {
    width: 22, textAlign: 'center', color: onImage.muted,
    fontSize: typeScale.body, fontWeight: weight.bold, fontVariant: ['tabular-nums'],
  },
  name: { color: onImage.ink, fontSize: typeScale.body, fontWeight: weight.bold, letterSpacing: -0.2 },
  meta: { color: onImage.muted, fontSize: typeScale.label, marginTop: 1 },
  tier: { paddingHorizontal: 7, paddingVertical: 3, borderRadius: radius.hair, borderWidth: 1 },
  tierText: { fontSize: typeScale.label, fontWeight: weight.bold, letterSpacing: 0.4 },
  mark: {
    color: onImage.ink, fontSize: typeScale.body, fontWeight: weight.bold,
    fontVariant: ['tabular-nums'], minWidth: 62, textAlign: 'right',
  },
  emptyTitle: { color: onImage.ink, fontSize: typeScale.title, fontWeight: weight.bold, marginTop: 12 },
  emptyBody: {
    color: onImage.muted, fontSize: typeScale.body, lineHeight: 20, textAlign: 'center',
    marginTop: 6, maxWidth: 320,
  },
  foot: {
    color: onImage.muted, fontSize: typeScale.caption, lineHeight: 18,
    paddingHorizontal: spacing.lg, marginTop: 20,
  },
})
