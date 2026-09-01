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
import { spacing, radius, onImage } from '../lib/theme'
import { Tappable, MonoKicker } from '../components/ui'
import ScreenBackdrop, { BACKDROP_GROUND } from '../components/ScreenBackdrop'
import AppHeader from '../components/AppHeader'
import { TAB_BAR_CLEARANCE } from '../navigation/FloatingTabBar'
import SquadSwitcher, { type SquadFilter } from '../components/SquadSwitcher'
import {
  fetchSquads, fetchSquadAthletes, squadCounts, inSquad,
  subjectFor, type Squad, type SquadAthlete,
} from '../lib/squads'
import { fetchResultsForMany } from '../lib/athleteResults'
import { buildBoards, excludedCount, currentSeason, type RankMode } from '../lib/leaderboard'
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

  const [squads, setSquads] = useState<Squad[]>([])
  const [athletes, setAthletes] = useState<SquadAthlete[]>([])
  const [results, setResults] = useState<Map<string, any[]>>(new Map())
  const [filter, setFilter] = useState<SquadFilter>(null)
  const [mode, setMode] = useState<RankMode>('pb')
  const [refreshing, setRefreshing] = useState(false)

  const load = useCallback(async () => {
    const [sq, ath] = await Promise.all([fetchSquads(user?.id || ''), fetchSquadAthletes()])
    setSquads(sq); setAthletes(ath)
    // Two queries for the whole squad, not one per athlete.
    setResults(await fetchResultsForMany(ath.map(subjectFor)))
  }, [user])

  useEffect(() => { load() }, [load])
  useEffect(() => navigation.addListener('focus', load), [navigation, load])

  const counts = useMemo(() => squadCounts(athletes), [athletes])
  const shown = useMemo(() => (
    filter === 'unassigned'
      ? athletes.filter((a) => !a.squad_id)
      : inSquad(athletes, filter as string | null)
  ), [athletes, filter])

  const boards = useMemo(
    () => buildBoards(shown, results, mode, currentSeason()),
    [shown, results, mode])
  const excluded = useMemo(() => excludedCount(shown, boards), [shown, boards])

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
            <Text style={s.h1}>Leaderboards</Text>
          </View>

          <SquadSwitcher
            squads={squads} counts={counts.counts} unassigned={counts.unassigned}
            total={counts.total} value={filter} onChange={setFilter}
            onAdd={() => navigation.navigate('Home')}
          />

          <View style={s.modes}>
            {([['pb', 'All time'], ['season', currentSeason()]] as [RankMode, string][]).map(
              ([m, label]) => {
                const on = mode === m
                return (
                  <Tappable key={m} onPress={() => { tapFeedback(); setMode(m) }}
                    accessibilityLabel={label} accessibilityState={{ selected: on }}
                    style={[s.mode, {
                      borderColor: on ? colors.accent[500] + '8C' : onImage.cardBorder,
                      backgroundColor: on ? colors.accent[500] + '2E' : onImage.card,
                    }]}>
                    <Text style={[s.modeText, { color: on ? '#FFFFFF' : onImage.muted }]}>{label}</Text>
                  </Tappable>
                )
              })}
          </View>

          {boards.map((b) => (
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
                    onPress={() => navigation.navigate('AthleteDetail', {
                      athlete: {
                        id: a.roster_athlete_id, linked_user_id: a.athlete_user_id,
                        name: a.name, dob: a.dob, gender: a.gender, discipline: a.discipline,
                      },
                    })}
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

          {boards.length === 0 && (
            <View style={{ paddingHorizontal: spacing.lg, paddingTop: 30, alignItems: 'center' }}>
              <Ionicons name="podium-outline" size={30} color={onImage.muted} />
              <Text style={s.emptyTitle}>Nothing to rank yet</Text>
              <Text style={s.emptyBody}>
                {athletes.length === 0
                  ? 'Add athletes and their results will rank here.'
                  : mode === 'season'
                    ? `Nobody in this squad has an approved result from ${currentSeason()} yet.`
                    : 'Nobody in this squad has an approved result yet. Results awaiting your approval are in your inbox.'}
              </Text>
            </View>
          )}

          {boards.length > 0 && excluded > 0 && (
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
  h1: { fontSize: 34, fontWeight: '700', letterSpacing: -0.9, color: onImage.ink },
  modes: { flexDirection: 'row', gap: 8, paddingHorizontal: spacing.lg, marginTop: 14 },
  mode: {
    minHeight: 36, paddingHorizontal: 14, borderRadius: radius.full, borderWidth: 1,
    alignItems: 'center', justifyContent: 'center',
  },
  modeText: { fontSize: 13, fontWeight: '700' },
  board: { marginTop: 22, paddingHorizontal: spacing.lg },
  boardHead: {
    flexDirection: 'row', alignItems: 'baseline', justifyContent: 'space-between',
    marginBottom: 10, gap: 10,
  },
  boardTitle: { color: onImage.ink, fontSize: 18, fontWeight: '700', letterSpacing: -0.3, flex: 1 },
  boardCount: { color: onImage.muted, fontSize: 12 },
  row: {
    flexDirection: 'row', alignItems: 'center', gap: 12,
    minHeight: 58, paddingHorizontal: 14, marginBottom: 7,
    borderRadius: radius.lg, borderWidth: 1,
    borderColor: onImage.cardBorder, backgroundColor: onImage.card,
  },
  rank: {
    width: 22, textAlign: 'center', color: onImage.muted,
    fontSize: 15, fontWeight: '700', fontVariant: ['tabular-nums'],
  },
  name: { color: onImage.ink, fontSize: 15, fontWeight: '700', letterSpacing: -0.2 },
  meta: { color: onImage.muted, fontSize: 11.5, marginTop: 1 },
  tier: { paddingHorizontal: 7, paddingVertical: 3, borderRadius: 5, borderWidth: 1 },
  tierText: { fontSize: 10, fontWeight: '800', letterSpacing: 0.4 },
  mark: {
    color: onImage.ink, fontSize: 15.5, fontWeight: '700',
    fontVariant: ['tabular-nums'], minWidth: 62, textAlign: 'right',
  },
  emptyTitle: { color: onImage.ink, fontSize: 17, fontWeight: '700', marginTop: 12 },
  emptyBody: {
    color: onImage.muted, fontSize: 14, lineHeight: 20, textAlign: 'center',
    marginTop: 6, maxWidth: 320,
  },
  foot: {
    color: onImage.muted, fontSize: 12, lineHeight: 18,
    paddingHorizontal: spacing.lg, marginTop: 20,
  },
})
