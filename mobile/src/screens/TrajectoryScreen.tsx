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
// The whole screen lives on the dark ground under <OnImageTheme/>, so the
// module-level palette is the ON-IMAGE one, not the app default. Aliasing it
// to `colors` repaints all 61 style keys and every inline reference in this
// file at once — and it is honest, because unlike Home this screen has no
// light variant to switch back to.
//
// It also un-breaks the white-alpha literals scattered through the styles
// (`rgba(255,255,255,0.06)` borders, `0.03` header cells, and so on). Those
// were never wrong — they were written for a dark surface and only started
// looking broken when the app's paper went light underneath them.
import { onImageColors as colors, spacing, radius, rhythm, onImage } from '../lib/theme'
import { useAuth } from '../contexts/AuthContext'
import { useTheme, OnImageTheme } from '../contexts/ThemeContext'
import AppHeader from '../components/AppHeader'
import { TAB_BAR_CLEARANCE } from '../navigation/FloatingTabBar'
import { BACKDROP_GROUND } from '../components/ScreenBackdrop'
import { ScienceSpotlight, RivalCard } from '../components/HomeSections'
import { selectFrom, SUPABASE_URL, SUPABASE_ANON_KEY } from '../lib/supabase'
import { LinearGradient as Gradient } from 'expo-linear-gradient'
import {
  AlmanacCard,
  GlassPanel,
  HeroCard,
  GlassCard,
  MonoKicker,
  StatBlock,
  TrendArrow,
  EmptyState,
  Divider,
} from '../components/ui'
import { projectAllTrajectories, hasImprovementCurves } from '../lib/improvementCurves'
import ProjectionChart, { type HistorySummary } from '../components/ProjectionChart'
import {
  isLowerBetter,
  performancePercentile,
  qualifierZones,
  getCalibration,
} from '../lib/disciplineScience'
import { getTier, TIER_NAMES, TIER_COLORS, TIER_SHORT, buildMatrix, AGE_GROUPS } from '../lib/performanceTiers'
import { getAgeGroup } from '../lib/performanceLevels'
import { ageFromDob, ageExact } from '../lib/age'
import { countsForAnalysis } from '../lib/resultSemantics'

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

/**
 * One spelling per event.
 *
 * `discipline` is free text in the database, so the same event arrives as
 * "100m", "100m " and "100M". Every grouping and every filter on this screen
 * goes through here, so an event can never be split across two cards with
 * half the athlete's races in each.
 */
function normDiscipline(d: string | null | undefined): string {
  return String(d || '').trim().replace(/\s+/g, ' ')
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

  // Group performances by discipline and get stats.
  //
  // Grouped on the NORMALISED name. Stored disciplines have been seen with
  // trailing whitespace ("100m "), and a raw key would split one event into
  // two cards, each holding a subset of the athlete's races — every one of
  // them a real result, silently missing from the other card's PB and trend.
  const disciplineStats = useMemo(() => {
    const grouped: Record<string, any[]> = {}
    for (const p of performances) {
      const key = normDiscipline(p.discipline)
      if (!key) continue
      if (!grouped[key]) grouped[key] = []
      grouped[key].push(p)
    }

    return Object.entries(grouped).map(([discipline, marks]) => {
      const values = marks
        .filter((m: any) => countsForAnalysis(m, discipline))
        .map((m: any) => parseFloat(m.mark))
        .filter(Number.isFinite)
      const lower = isLowerBetter(discipline)
      const pb = lower ? Math.min(...values) : Math.max(...values)
      const age = ageFromDob(profile?.dob)
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
          icon="walk-outline"
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
          <AlmanacCard glass
            kicker={stat.ageGroup}
            title={stat.discipline}
            number={`${stat.count} race${stat.count !== 1 ? 's' : ''}`}
            accent={stat.tier?.color || colors.orange[500]}
          >
            <View style={styles.disciplineCardContent}>
              <View style={{ flex: 1 }}>
                <Text style={styles.pbLabel}>Personal best</Text>
                <Text style={styles.pbValue}>
                  {formatPerformance(stat.pb, stat.discipline)}
                </Text>
                {/* Tier as a coloured word under a hairline, not a pill.
                    The pill also computed `undefined + '20'` for an unrated
                    event — the literal string "undefined20" as a colour. */}
                <View style={[
                  styles.tierRule,
                  { backgroundColor: stat.tier?.color || colors.text.dimmed },
                ]} />
                <Text style={[
                  styles.tierLabel,
                  { color: stat.tier?.color || colors.text.muted },
                ]}>
                  {stat.tier?.tierName || 'Unrated'}
                </Text>
              </View>
              <Ionicons name="chevron-forward" size={18} color={colors.text.dimmed} />
            </View>
          </AlmanacCard>
        </TouchableOpacity>
      ))}

      <View style={{ height: TAB_BAR_CLEARANCE }} />
    </ScrollView>
  )
}

// ── Race trend ───────────────────────────────────────────────────────────────
// Least-squares slope of mark against time, in units per YEAR. Returns a
// refusal rather than a number when there isn't enough to read.
//
// The guards matter more than the maths. Two races a fortnight apart can
// produce a slope implying four seconds a year; presenting that as a rate
// would be worse than saying nothing, because an athlete will believe it.
type Trend =
  | { ok: false; reason: 'few' | 'short'; n: number }
  | { ok: true; n: number; spanDays: number; perYear: number; from: number; to: number }

const MIN_RACES = 3
const MIN_SPAN_DAYS = 90

function raceTrend(
  races: { value: number; date: string }[],
  lower: boolean,
): Trend {
  const pts = (races || [])
    .map((r) => ({ t: new Date(r.date).getTime(), v: Number(r.value) }))
    .filter((p) => Number.isFinite(p.t) && Number.isFinite(p.v))
    .sort((a, b) => a.t - b.t)

  if (pts.length < MIN_RACES) return { ok: false, reason: 'few', n: pts.length }
  const spanDays = (pts[pts.length - 1].t - pts[0].t) / 86_400_000
  if (spanDays < MIN_SPAN_DAYS) return { ok: false, reason: 'short', n: pts.length }

  const YEAR = 365.25 * 86_400_000
  const xs = pts.map((p) => (p.t - pts[0].t) / YEAR)
  const ys = pts.map((p) => p.v)
  const mx = xs.reduce((a, b) => a + b, 0) / xs.length
  const my = ys.reduce((a, b) => a + b, 0) / ys.length
  let num = 0, den = 0
  for (let i = 0; i < xs.length; i++) {
    num += (xs[i] - mx) * (ys[i] - my)
    den += (xs[i] - mx) ** 2
  }
  if (den === 0) return { ok: false, reason: 'short', n: pts.length }
  const slope = num / den
  // Positive `perYear` always means getting better, whichever way the event runs.
  return {
    ok: true,
    n: pts.length,
    spanDays,
    perYear: lower ? -slope : slope,
    from: pts[0].v,
    to: pts[pts.length - 1].v,
  }
}

// ── Detail: Tier Positioning ─────────────────────────────────────────────────
function TierPositioningSection({
  discipline,
  pb,
  age,
  sex,
  races,
}: {
  discipline: string
  pb: number
  age: number | null
  sex: string
  races: { value: number; date: string }[]
}) {
  const ageGroup = age ? getAgeGroup(age) : 'Senior'
  const tier = getTier(discipline, sex, ageGroup, pb)
  const percentile = performancePercentile(pb, discipline, sex)
  const lower = isLowerBetter(discipline)
  const trend = useMemo(() => raceTrend(races, lower), [races, lower])

  if (!tier) return null

  // getTier returns a truthy object with tier: 0 for an athlete under the
  // first cut. TIER_SHORT has no 0 key, so the badge used to render the string
  // "undefined" next to "Below Emerging".
  const shortLabel = tier.tier > 0 ? TIER_SHORT[tier.tier] : null

  // ── The line that turns a gap into a plan ────────────────────────
  // A gap on its own ("0.24 to Excellent") is a fact. Whether it is closing,
  // and how fast, is the thing an athlete actually wants to know — and every
  // ingredient was already on this screen, just never combined.
  const gap = tier.gap
  let projection: { text: string; tone: 'good' | 'flat' | 'down' | 'quiet' } | null = null

  if (!trend.ok) {
    projection = {
      tone: 'quiet',
      text: trend.reason === 'few'
        ? `${trend.n} race${trend.n === 1 ? '' : 's'} logged. Three across a season is enough to read a trend.`
        : `Your races are too close together to read a rate yet — about three months apart is enough.`,
    }
  } else {
    const per = trend.perYear
    const unit = lower ? 's' : 'm'
    const rate = `${Math.abs(per).toFixed(2)}${unit} a year across ${trend.n} races`

    // Three distinct states, not two. Folding a negative slope into "flat"
    // would tell an athlete who is going backwards that they are holding
    // steady — the one reading of their own data they can't afford to have
    // softened. The wording stays factual rather than alarming: a bad patch
    // mid-season is normal, and the app shouldn't editorialise about why.
    const FLAT_BAND = 0.02   // slower than this either way is noise, not a trend

    if (per < -FLAT_BAND) {
      projection = {
        tone: 'down',
        text: `Your marks have drifted ${Math.abs(per).toFixed(2)}${unit} a year the wrong way across ${trend.n} races. Worth a look at what's changed.`,
      }
    } else if (per <= FLAT_BAND) {
      projection = {
        tone: 'flat',
        text: tier.nextTierName
          ? `Flat over your last ${trend.n} races, so the gap to ${tier.nextTierName} isn't closing yet.`
          : `Flat over your last ${trend.n} races.`,
      }
    } else if (gap == null || !tier.nextTierName) {
      projection = { tone: 'good', text: `Improving ${rate}.` }
    } else {
      const years = gap / per
      if (years > 3) {
        projection = {
          tone: 'good',
          text: `Improving ${rate} — more than three years to ${tier.nextTierName} at this rate.`,
        }
      } else {
        const months = Math.max(1, Math.round(years * 12))
        const when = new Date()
        when.setMonth(when.getMonth() + months)
        projection = {
          tone: 'good',
          text: `Improving ${rate}. At that rate you reach ${tier.nextTierName} around ${when.toLocaleDateString('en-GB', { month: 'long', year: 'numeric' })}.`,
        }
      }
    }
  }

  const toneColor =
    projection?.tone === 'good' ? colors.green
      : projection?.tone === 'flat' ? colors.amber
        : projection?.tone === 'down' ? colors.red
          : colors.text.muted

  return (
    // The hero is the same glass as Home's panels, lit from the top edge, with
    // one wash of the tier's colour bleeding from the corner. No pill, no
    // badge, no icon well — the mark is 56pt of tabular numeral and that is
    // the whole design.
    <GlassPanel tone="deep" intensity={26} radius={22} style={styles.heroPanel}>
      <Gradient
        colors={[tier.color + '2E', tier.color + '00']}
        start={{ x: 0, y: 0 }} end={{ x: 1, y: 1 }}
        style={StyleSheet.absoluteFill}
        pointerEvents="none"
      />

      <View style={styles.heroTop}>
        <View style={{ flex: 1 }}>
          <MonoKicker color={colors.text.muted}>Personal best</MonoKicker>
          <Text style={styles.pbDisplay}>{formatPerformance(pb, discipline)}</Text>
        </View>
        <View style={{ alignItems: 'flex-end' }}>
          {shortLabel && (
            <Text style={[styles.tierShortLarge, { color: tier.color }]}>{shortLabel}</Text>
          )}
          <Text style={[styles.tierNameLarge, { color: tier.color }]}>{tier.tierName}</Text>
        </View>
      </View>

      <View style={styles.tierStats}>
        <View style={styles.tierStat}>
          <Text style={styles.tierStatLabel}>Percentile</Text>
          <Text style={styles.tierStatValue}>
            {percentile != null ? `${percentile}%` : '—'}
          </Text>
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
                {gap ? `${lower ? '−' : '+'}${Math.abs(gap).toFixed(2)}` : '—'}
              </Text>
            </View>
          </>
        )}
      </View>

      {/* The projection. This is the section's actual answer. */}
      {projection && (
        <View style={styles.trendRow}>
          <View style={[styles.trendDot, { backgroundColor: toneColor }]} />
          <Text style={[styles.trendText, { color: projection.tone === 'quiet' ? colors.text.muted : colors.text.secondary }]}>
            {projection.text}
          </Text>
        </View>
      )}

      {percentile == null && (
        // Not a soft "coming soon" — the athlete needs to know the number is
        // absent because we don't hold the data, not because they're unranked.
        <View style={styles.calNote}>
          <Ionicons name="information-circle-outline" size={13} color={colors.text.muted} />
          <Text style={styles.calNoteText}>
            No percentile for {discipline} yet — we only hold reference marks for
            the events in our benchmark set. Your tier and matrix below still apply.
          </Text>
        </View>
      )}

      {percentile != null && (
        // Say what the number is. It is a normal-curve estimate over a
        // reference distribution, not a count of real athletes, and it should
        // not be read to the decimal.
        <Text style={styles.pctFootnote}>
          Percentile is estimated against our reference distribution for {discipline}.
        </Text>
      )}

      {/* The tier meter. Was a row of separate coloured chiclets — seven
          little lozenges in seven different hues, which reads as a game's
          progress pips rather than a standing. It is one continuous track now,
          filled by a gradient that runs through the tiers the athlete has
          actually passed, with hairline ticks marking the boundaries. */}
      <View style={styles.tierLadderContainer}>
        <View style={styles.tierTrack}>
          <Gradient
            colors={[TIER_COLORS[1], tier.color]}
            start={{ x: 0, y: 0 }} end={{ x: 1, y: 0 }}
            style={{
              position: 'absolute', left: 0, top: 0, bottom: 0,
              width: `${Math.max(2, (tier.tier / tier.maxTier) * 100)}%`,
              borderRadius: 3,
            }}
          />
          {Array.from({ length: tier.maxTier - 1 }, (_, i) => i + 1).map((t) => (
            <View
              key={t}
              pointerEvents="none"
              style={{
                position: 'absolute', top: 0, bottom: 0,
                left: `${(t / tier.maxTier) * 100}%`,
                width: 1, backgroundColor: 'rgba(11,12,24,0.55)',
              }}
            />
          ))}
        </View>
        <View style={styles.tierLadderLabels}>
          <Text style={styles.tierLadderLabel}>T1</Text>
          <Text style={styles.tierLadderLabel}>{`T${tier.maxTier}`}</Text>
        </View>
      </View>
    </GlassPanel>
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
  const [error, setError] = useState('')

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
            // ALWAYS send p_implement_weight (null for non-throws). Two overloads
            // of find_similar_athletes exist in the DB and differ only by this
            // argument, so omitting it makes the call ambiguous — PostgREST
            // returns HTTP 300 / PGRST203 and every comparison silently returns
            // nothing. Passing it resolves to the 5-arg version. Same fix the
            // web app already carries in bnchmarkd-app.jsx.
            body: JSON.stringify({
              p_discipline_code: eventCode,
              p_pb: pb,
              p_age: age,
              p_limit: 3,
              p_implement_weight: null,
            }),
          }
        )

        if (response.ok) {
          const data = await response.json()
          setSimilar(data || [])
          setError('')
        } else {
          // Previously there was no else here, which is how the broken RPC
          // stayed invisible: a failed call just rendered an empty section.
          const body = await response.text().catch(() => '')
          console.warn('Similar athletes RPC failed:', response.status, body)
          setSimilar([])
          setError("Couldn't load comparable athletes. Pull to refresh.")
        }
      } catch (e) {
        console.warn('Similar athletes load:', e)
        setSimilar([])
        setError("Couldn't load comparable athletes. Check your connection.")
      } finally {
        setLoading(false)
      }
    }

    loadSimilarAthletes()
  }, [discipline, pb, age, sex])

  if (loading) {
    return (
      <AlmanacCard glass kicker="BENCHMARKS" title="Similar Athletes" accent={colors.orange[500]}>
        <ActivityIndicator color={colors.orange[500]} />
      </AlmanacCard>
    )
  }

  // This section used to `return null` whenever it had nothing, which is what
  // kept the broken RPC invisible for so long. Every empty path now says why.
  if (error) {
    return (
      <AlmanacCard glass kicker="BENCHMARKS" title="Similar athletes" accent={colors.accent[500]}>
        <Text style={{ fontSize: 14, color: colors.text.secondary, lineHeight: 20 }}>{error}</Text>
      </AlmanacCard>
    )
  }

  if (!age) {
    return (
      <AlmanacCard glass kicker="BENCHMARKS" title="Similar athletes" accent={colors.accent[500]}>
        <Text style={{ fontSize: 14, color: colors.text.secondary, lineHeight: 20 }}>
          Add your date of birth in Profile to compare yourself against athletes
          who ran this time at your age.
        </Text>
      </AlmanacCard>
    )
  }

  if (similar.length === 0) {
    return (
      <AlmanacCard glass kicker="BENCHMARKS" title="Similar athletes" accent={colors.accent[500]}>
        <Text style={{ fontSize: 14, color: colors.text.secondary, lineHeight: 20 }}>
          No close matches in the database for this mark at your age yet.
        </Text>
      </AlmanacCard>
    )
  }

  return (
    <AlmanacCard glass kicker="BENCHMARKS" title="Similar Athletes" accent={colors.orange[500]}>
      {similar.map((athlete: any, idx: number) => (
        <View key={idx} style={styles.similarAthleteRow}>
          <Text style={styles.similarRank}>{String(idx + 1).padStart(2, '0')}</Text>
          <View style={{ flex: 1 }}>
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
  history,
  nowAge,
}: {
  discipline: string
  pb: number
  age: number | null
  sex: string
  /** Raced marks with the athlete's age AT THE TIME of each race. */
  history: { age: number; value: number; date?: string }[]
  /** Fractional age today — the boundary between raced and projected. */
  nowAge?: number
}) {
  // Why this section rendered nothing for two years: it passed 'female' /
  // 'male' into a table keyed '100m_Female', so the lookup always missed,
  // projectPerformance returned [], and the guard below dropped the whole
  // card. `sex` is now passed through untouched — improvementCurves
  // normalises it — and the failure modes are told apart instead of all
  // collapsing into one silent null.
  const { projections, blocked } = useMemo(() => {
    if (!pb) return { projections: null, blocked: 'nopb' as const }
    if (!age) return { projections: null, blocked: 'noage' as const }
    if (!hasImprovementCurves(discipline, sex)) {
      return { projections: null, blocked: 'nocurve' as const }
    }
    try {
      const result = projectAllTrajectories(pb, age, discipline, sex)
      if (!result?.steady?.length || result.steady.length < 2) {
        return { projections: null, blocked: 'noproj' as const }
      }
      return { projections: result, blocked: null }
    } catch (e) {
      // Was a bare `catch { return null }`. A throw in the projection maths
      // erased the section with no trace anywhere — which is exactly how a
      // dead feature stays dead.
      console.warn('[Trajectory] projection failed for', discipline, sex, e)
      return { projections: null, blocked: 'error' as const }
    }
  }, [pb, age, discipline, sex])

  const lower = isLowerBetter(discipline)

  const [histSummary, setHistSummary] = useState<HistorySummary | null>(null)

  // Pulled through so the chart can draw the next tier as a target line —
  // the same number the Tier Positioning card above quotes as the gap.
  const ageGroup = age ? getAgeGroup(age) : 'Senior'
  const tierNow = getTier(discipline, sex, ageGroup, pb)
  const nextCut = tierNow?.nextCut
  const nextTierName = tierNow?.nextTierName

  if (!projections) {
    const message =
      blocked === 'noage'
        ? 'Add your date of birth in Profile and we can project this forward — the curves are age-dependent, so there is nothing to anchor to without it.'
        : blocked === 'nocurve'
          ? `We don't hold development curves for ${discipline} yet, so there's nothing honest to project.`
          : blocked === 'error'
            ? "Couldn't build a projection from this mark. Pull to refresh."
            : 'Not enough to project from yet.'

    // Renders the card rather than vanishing. A section that disappears is
    // indistinguishable from a section that was never built.
    return (
      <AlmanacCard glass kicker="FUTURE" title="Improvement Scenarios" accent={colors.orange[500]}>
        <View style={styles.calNote}>
          <Ionicons name="information-circle-outline" size={13} color={colors.text.muted} />
          <Text style={styles.calNoteText}>{message}</Text>
        </View>
      </AlmanacCard>
    )
  }

  // The steady trajectory is the headline; the other two are context. Web
  // removed its own version of this as "a dense table that didn't earn its
  // space", and three cards of peak values had the same problem — they show
  // three endpoints where the interesting thing is the shape between here and
  // there.
  const peakOf = (set: any[]) =>
    (set || []).reduce(
      (best: any, pt: any) =>
        !best ? pt : (lower ? (pt.projected < best.projected ? pt : best)
          : (pt.projected > best.projected ? pt : best)),
      null,
    )
  const peak = peakOf(projections.steady)
  const gain = peak ? (lower ? pb - peak.projected : peak.projected - pb) : null
  const peakTier = peak
    ? getTier(discipline, sex, getAgeGroup(peak.age), peak.projected)
    : null

  return (
    <AlmanacCard glass kicker="FUTURE" title="Where this could go" accent={colors.orange[500]}>
      <ProjectionChart
        steady={projections.steady}
        history={history}
        nowAge={nowAge}
        lower={lower}
        valueFmt={(v) => formatPerformance(v, discipline)}
        nextCut={nextCut ?? null}
        nextTierName={nextTierName ?? null}
        onSummary={setHistSummary}
      />

      {/* What the history could actually support. A chart that silently draws
          four marks from one afternoon as if it were a season is worse than
          one that says what it has. */}
      {histSummary && histSummary.days < 2 && (
        <View style={styles.calNote}>
          <Ionicons name="information-circle-outline" size={13} color={colors.text.muted} />
          <Text style={styles.calNoteText}>
            {histSummary.marks > 1
              ? `All ${histSummary.marks} of your ${discipline} marks are from one competition, so there's no trend to read yet — the dots sit on the same date. Log results from another meet and the line will have something to follow.`
              : `One ${discipline} result logged. Add a few more across the season and this becomes a trend rather than a single point.`}
          </Text>
        </View>
      )}

      {/* One sentence, not a table. */}
      {peak && (
        <Text style={styles.projLede}>
          On a consistent development path you'd peak around{' '}
          <Text style={styles.projStrong}>{formatPerformance(peak.projected, discipline)}</Text>
          {' '}at <Text style={styles.projStrong}>age {peak.age}</Text>
          {gain != null && gain > 0
            ? ` — ${Math.abs(gain).toFixed(2)}${lower ? 's' : 'm'} on your current best`
            : ''}
          {peakTier?.tierName ? `, which is ${peakTier.tierName} for that age group.` : '.'}
        </Text>
      )}

      <Text style={styles.projFootnote}>
        Built from year-on-year improvement rates of real athletes in this
        event, by age. The shaded band is the 25th to 75th percentile of how
        they developed — a spread of outcomes, not a confidence interval, and
        not a prediction about you. It stops five years out because the
        optimistic edge assumes a top-quarter year every year, which nobody
        sustains for longer than that.
      </Text>
    </AlmanacCard>
  )
}

// ── Competition Ladder ───────────────────────────────────────────────────────
// Four rungs from development to finalist, with the athlete's gap to each.
//
// This had two faults that made it actively misleading:
//
//  1. OFF BY ONE. Every label was paired with the NEXT zone's threshold —
//     'Development' showed the qualifier cut, 'Qualifier' showed the
//     semifinalist cut, and so on. An athlete reading "Qualifier 10.21" was
//     being shown the semifinalist standard.
//
//  2. NOT MONOTONIC. The zones come out of the calibration table in an order
//     that isn't always hardest-last: for 100m_M, rocS90/S80/S70/optimal are
//     10.35 / 10.21 / 10.05 / 10.15, so the top rung was EASIER than the one
//     below it. High Jump_F has two rungs at exactly 2.00. A ladder whose
//     rungs don't get harder isn't a ladder.
//
// So the rungs are now paired with their own cuts, sorted by difficulty in
// the direction the event runs, and de-duplicated.
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

  // Null for any event we hold no reference marks for. Say so — the previous
  // behaviour was to show men's 100m times as a hurdler's competition targets.
  if (!zones) {
    return (
      <AlmanacCard glass kicker="COMPETITIONS" title="Competition Ladder" accent={colors.orange[500]}>
        <View style={styles.calNote}>
          <Ionicons name="information-circle-outline" size={13} color={colors.text.muted} />
          <Text style={styles.calNoteText}>
            We don't hold competition standards for {discipline} yet, so there's no
            ladder to show. Rather than estimate one, we'd rather leave it blank —
            a target that isn't real is worse than no target.
          </Text>
        </View>
      </AlmanacCard>
    )
  }

  // ── Three rungs, labelled by RANK rather than by key name ────────
  // `optimal` is deliberately not a rung. Checked across all 38 calibrated
  // events, rocOptimal is never the hardest mark: it equals rocS70 exactly in
  // 16 of them and is EASIER than rocS70 in the other 18. It is not a fourth
  // tier above finalist, so showing it as the top of the ladder invented a
  // standard that doesn't exist.
  //
  // The remaining three are labelled by their sorted position, not by which
  // key they came from. That matters because four rows in the table were
  // entered with the direction inverted — 10000m and 3000m Steeplechase, both
  // sexes, where rocS90 holds the FASTEST time rather than the slowest.
  // Deriving difficulty from the values means those four get a sensible
  // ladder instead of a backwards one, and the other 34 are unaffected.
  const harder = (a: number, b: number) => (lower ? a < b : a > b)
  const RANK_LABELS = ['Qualifier', 'Semifinalist', 'Finalist']
  const rungs = [zones.qualifier, zones.semifinalist, zones.finalist]
    .filter((t) => Number.isFinite(t))
    .sort((a, b) => (harder(a, b) ? 1 : -1))
    // Two rungs at the same mark are one rung wearing two hats.
    .filter((t, i, arr) => i === 0 || t !== arr[i - 1])
    .map((threshold, i, arr) => ({
      // Keep the hardest rung called "Finalist" even when a duplicate has
      // shortened the ladder.
      label: RANK_LABELS[RANK_LABELS.length - arr.length + i] || RANK_LABELS[i],
      threshold,
    }))

  const achieved = rungs.filter((r) => (lower ? pb <= r.threshold : pb >= r.threshold)).length
  const next = rungs.find((r) => !(lower ? pb <= r.threshold : pb >= r.threshold))

  return (
    <AlmanacCard glass
      kicker="COMPETITIONS"
      title="Competition Ladder"
      accent={colors.orange[500]}
      right={
        <View style={{ alignItems: 'flex-end' }}>
          <Text style={styles.ladderCountValue}>{achieved}<Text style={styles.ladderCountOf}>/{rungs.length}</Text></Text>
          <Text style={styles.ladderCountLabel}>CLEARED</Text>
        </View>
      }
    >
      {/* The one line that answers "so what?" — a list of four thresholds
          doesn't tell you where to aim. */}
      <Text style={styles.ladderLede}>
        {next
          ? `Next up: ${next.label} at ${formatPerformance(next.threshold, discipline)} — ${Math.abs(lower ? pb - next.threshold : next.threshold - pb).toFixed(2)} away.`
          : 'Every standard on this ladder cleared.'}
      </Text>

      {rungs.map((rung, idx) => {
        const isMet = lower ? pb <= rung.threshold : pb >= rung.threshold
        const gap = lower ? pb - rung.threshold : rung.threshold - pb
        const isNext = next?.label === rung.label

        return (
          <View
            key={rung.label}
            style={[
              styles.ladderRung,
              isNext && styles.ladderRungNext,
              // The list's own last divider drew a rule under the final row
              // with nothing beneath it — a line hanging off the bottom of
              // the card.
              idx === rungs.length - 1 && { borderBottomWidth: 0 },
            ]}
          >
            {/* A rule, not a bubble. The state lives in a 2pt spine and in the
                weight of the type — a row of coloured circles with ticks in
                them is the visual language of a checklist app, not a
                standard an athlete is chasing. */}
            <View style={[
              styles.ladderSpine,
              isMet && { backgroundColor: colors.green },
              isNext && { backgroundColor: colors.orange[500] },
            ]} />
            <Text
              numberOfLines={1}
              style={[
                styles.ladderLabel,
                isMet && { color: colors.text.primary, fontWeight: '600' },
                isNext && { color: colors.orange[500], fontWeight: '700' },
              ]}
            >
              {rung.label}
            </Text>
            <View style={styles.ladderRight}>
              <Text style={[styles.ladderThreshold, !isMet && !isNext && { color: colors.text.secondary }]}>
                {formatPerformance(rung.threshold, discipline)}
              </Text>
              <Text style={[
                styles.ladderGap,
                isMet && { color: colors.green },
                isNext && { color: colors.orange[500] },
              ]}>
                {isMet ? 'Cleared' : `${Math.abs(gap).toFixed(2)} away`}
              </Text>
            </View>
          </View>
        )
      })}
    </AlmanacCard>
  )
}

// ── Main Screen ──────────────────────────────────────────────────────────────
// ── Performance Matrix (age-group × tier grid) ───────────────────────────────
// Shows the athlete's standing across ALL age groups, not just their own — the
// cross-age "stepping stone" view (parity with the web PerformanceMatrix).
function PerformanceMatrixSection({
  discipline, pb, age, sex,
}: { discipline: string; pb: number; age: number | null; sex: string }) {
  const ageGroup = age ? getAgeGroup(age) : 'Senior'
  const tier = getTier(discipline, sex, ageGroup, pb)
  const matrix = useMemo(() => buildMatrix(discipline, sex), [discipline, sex])

  if (!matrix?.rows) return null

  return (
    <AlmanacCard glass kicker="TRAJECTORY" title="Performance Matrix" accent={colors.orange[500]}>
      <Text style={styles.matrixCaption}>
        Where you stand across age groups. Your current position is highlighted.
      </Text>
      <ScrollView horizontal showsHorizontalScrollIndicator={false}>
        <View>
          {/* Header row */}
          <View style={styles.matrixRow}>
            <View style={[styles.matrixCell, styles.matrixHeaderCell]}>
              <Text style={styles.matrixHeaderText}>Tier</Text>
            </View>
            {AGE_GROUPS.map((ag) => (
              <View key={ag} style={[styles.matrixCell, styles.matrixHeaderCell, ag === ageGroup && styles.matrixActiveCol]}>
                <Text style={[styles.matrixHeaderText, ag === ageGroup && { color: colors.orange[500] }]}>{ag}</Text>
              </View>
            ))}
          </View>

          {/* Data rows, T7 down to T1 */}
          {[7, 6, 5, 4, 3, 2, 1].map((t) => (
            <View key={t} style={styles.matrixRow}>
              <View style={[styles.matrixCell, styles.matrixLabelCell]}>
                {/* The dot was a 7pt circle repeated seven times down the
                    left edge. The tier colour belongs ON the label. */}
                <Text style={[styles.matrixTierLabel, { color: TIER_COLORS[t] }]}>{TIER_SHORT[t]}</Text>
              </View>
              {matrix.rows.map((row: any) => {
                const val = row.cuts[t - 1]
                const isYou = !!tier && tier.tier === t && row.ageGroup === ageGroup
                return (
                  <View
                    key={row.ageGroup}
                    style={[
                      styles.matrixCell,
                      row.ageGroup === ageGroup && styles.matrixActiveCol,
                      isYou && styles.matrixYouCell,
                    ]}
                  >
                    {val != null ? (
                      <Text style={[styles.matrixVal, isYou && { color: colors.orange[500], fontWeight: '700' }]}>
                        {formatPerformance(val, discipline)}
                      </Text>
                    ) : (
                      <Text style={styles.matrixNull}>—</Text>
                    )}
                  </View>
                )
              })}
            </View>
          ))}
        </View>
      </ScrollView>
      {tier ? (
        <Text style={styles.matrixYouNote}>
          You: {TIER_SHORT[tier.tier]} ({tier.tierName}) in {ageGroup}
        </Text>
      ) : null}
    </AlmanacCard>
  )
}

// The shell owns the theme override; the body is everything that repaints
// under it. They have to be separate components — useTheme() inside the shell
// would read the OUTER (light) palette, since a provider is only visible to
// its own children.
export default function TrajectoryScreen() {
  return (
    <OnImageTheme>
      <TrajectoryBody />
    </OnImageTheme>
  )
}

function TrajectoryBody() {
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
    () => performances.filter(
      (p) => normDiscipline(p.discipline) === normDiscipline(selectedDiscipline),
    ),
    [performances, selectedDiscipline]
  )

  // Chronological {value, date} for the selected event — the raw material for
  // the trend line. Kept next to selectedPb so the two can't disagree about
  // which rows count.
  const selectedRaces = useMemo(() => {
    return selectedPerformances
      // The projection is fitted to these points. One voided time in the
      // series bends the whole curve.
      .filter((p) => countsForAnalysis(p, selectedDiscipline))
      .map((p) => ({
        value: parseFloat(p.mark),
        date: p.competition_date || p.created_at,
      }))
      .filter((r) => Number.isFinite(r.value) && !!r.date)
  }, [selectedPerformances])

  const selectedPb = useMemo(() => {
    if (!selectedPerformances.length) return null
    const values = selectedPerformances
      .filter((p) => countsForAnalysis(p, selectedDiscipline))
      .map((p) => parseFloat(p.mark))
      .filter(Number.isFinite)
    if (!values.length) return null
    const lower = isLowerBetter(selectedDiscipline!)
    return lower ? Math.min(...values) : Math.max(...values)
  }, [selectedPerformances, selectedDiscipline])

  // Each race carries the athlete's age ON THE DAY, not their age today.
  // Plotting a four-year history at a single current age would stack every
  // mark on one vertical line and destroy the trend the chart exists to show.
  const raceHistory = useMemo(() => {
    if (!profile?.dob) return []
    return selectedRaces
      .map((r) => {
        const t = new Date(r.date).getTime()
        if (Number.isNaN(t)) return null
        // Fractional, so two races in the same season don't collapse onto the
        // same x. Anchored on the real birthday, like every other age here.
        const a = ageExact(profile.dob, t)
        return a != null && a > 5 && a < 60 ? { age: a, value: r.value, date: r.date } : null
      })
      .filter(Boolean) as { age: number; value: number; date: string }[]
  }, [selectedRaces, profile?.dob])

  // Fractional, unlike `age` below which is floored for age-group lookups.
  const nowAgeExact = useMemo(() => ageExact(profile?.dob), [profile?.dob])

  const sex = (profile?.sex || 'M') as string
  const age = ageFromDob(profile?.dob)

  return (
    <SafeAreaView style={styles.safe} edges={['top', 'left', 'right']}>
      <AppHeader onImage />
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
          <TierPositioningSection discipline={selectedDiscipline} pb={selectedPb} age={age} sex={sex} races={selectedRaces} />

          <PerformanceMatrixSection discipline={selectedDiscipline} pb={selectedPb} age={age} sex={sex} />

          <SimilarAthletesSection discipline={selectedDiscipline} pb={selectedPb} age={age} sex={sex} />

          {/* Historical rival — a named athlete who ran this at your age.
              Runs off local data in historicalRivals.js, so it works even when
              the similar-athletes RPC or the network doesn't. */}
          <RivalCard
            pb={selectedPb}
            discipline={selectedDiscipline}
            sex={sex}
            dob={(profile as any)?.dob}
          />

          <ImprovementScenariosSection
            discipline={selectedDiscipline} pb={selectedPb} age={age} sex={sex}
            history={raceHistory} nowAge={nowAgeExact ?? undefined}
          />

          <CompetitionLadderSection discipline={selectedDiscipline} pb={selectedPb} sex={sex} />

          {/* Moved off Home — educational, read once, belongs with the
              analysis rather than in the daily loop. */}
          <ScienceSpotlight discipline={selectedDiscipline} />

          <View style={{ height: TAB_BAR_CLEARANCE }} />
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
  // Performance Matrix (age-group × tier grid)
  matrixCaption: { color: colors.text.secondary, fontSize: 12, lineHeight: 17, marginBottom: spacing.md },
  matrixRow: { flexDirection: 'row' },
  matrixCell: {
    width: 62, height: 34, alignItems: 'center', justifyContent: 'center',
    borderWidth: 0.5, borderColor: 'rgba(255,255,255,0.06)',
  },
  matrixHeaderCell: { backgroundColor: 'rgba(255,255,255,0.03)' },
  matrixHeaderText: { color: colors.text.muted, fontSize: 10, fontWeight: '700' },
  matrixActiveCol: { backgroundColor: 'rgba(139,131,255,0.07)' },
  matrixLabelCell: { flexDirection: 'row', gap: 5, backgroundColor: 'rgba(255,255,255,0.03)' },
  matrixTierLabel: { fontSize: 10.5, fontWeight: '800', letterSpacing: 0.5 },
  matrixYouCell: { backgroundColor: 'rgba(139,131,255,0.20)', borderColor: colors.orange[500] },
  matrixVal: { color: colors.text.secondary, fontSize: 10.5 },
  matrixNull: { color: colors.text.dimmed, fontSize: 10.5 },
  matrixYouNote: { color: colors.orange[400], fontSize: 11, fontWeight: '600', marginTop: spacing.md },

  // The ground Home and Programs both land on once you scroll past their
  // photographs. Trajectory has no photograph, so it simply starts there.
  safe: { flex: 1, backgroundColor: BACKDROP_GROUND },
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
  disciplineCardContent: { flexDirection: 'row', alignItems: 'center', gap: 12 },
  pbLabel: {
    color: colors.text.muted, fontSize: 9, letterSpacing: 2,
    textTransform: 'uppercase', fontWeight: '600',
  },
  pbValue: {
    color: colors.text.primary, fontSize: 34, fontWeight: '700',
    letterSpacing: -1.2, marginTop: 3, fontVariant: ['tabular-nums'],
  },
  tierRule: { width: 26, height: 2, borderRadius: 1, marginTop: 12, marginBottom: 7 },

  tierSection: { alignItems: 'center' },
  tierLabel: {
    fontSize: 11, fontWeight: '700', letterSpacing: 1.6,
    textTransform: 'uppercase',
  },

  // Tier positioning
  // 48 -> 56, and the accent colour dropped. A huge coloured numeral competes
  // with the tier label beside it; white against the tier's own wash is the
  // contrast that reads as premium rather than as a highlight.
  pbDisplay: {
    fontSize: 56, fontWeight: '700', color: colors.text.primary,
    letterSpacing: -2.2, marginTop: 4,
    fontVariant: ['tabular-nums'],
  },
  heroPanel: { padding: 22, marginBottom: spacing.lg },
  heroTop: { flexDirection: 'row', alignItems: 'flex-end', gap: 14 },
  tierNameLarge: {
    fontSize: 11, fontWeight: '700', letterSpacing: 1.6,
    textTransform: 'uppercase', marginTop: 2,
  },
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

  calNote: {
    flexDirection: 'row', gap: 8, alignItems: 'flex-start',
    marginTop: spacing.md, paddingHorizontal: 2,
  },
  calNoteText: {
    flex: 1, color: colors.text.muted, fontSize: 11.5, lineHeight: 17,
  },
  trendRow: {
    flexDirection: 'row', gap: 9, alignItems: 'flex-start',
    marginTop: spacing.lg,
  },
  // A rule, like the ladder spine — so the whole screen speaks one language
  // rather than mixing bars and bubbles.
  trendDot: { width: 2, height: 15, borderRadius: 1, marginTop: 3 },
  trendText: { flex: 1, fontSize: 13.5, lineHeight: 20, fontWeight: '500' },
  pctFootnote: {
    color: colors.text.dimmed, fontSize: 10.5, lineHeight: 15,
    marginTop: spacing.md,
  },
  tierLadderContainer: { marginTop: spacing.md },
  tierTrack: {
    height: 6, borderRadius: 3, overflow: 'hidden',
    backgroundColor: 'rgba(255,255,255,0.10)',
    position: 'relative',
  },
  tierLadderLabels: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    paddingHorizontal: 2,
  },
  tierLadderLabel: { fontSize: 9, color: colors.text.dimmed, fontWeight: '600' },

  // Similar athletes
  similarAthleteRow: {
    flexDirection: 'row', alignItems: 'center', gap: 14,
    paddingVertical: 13,
    borderBottomWidth: 1, borderBottomColor: 'rgba(255,255,255,0.06)',
  },
  // A ranked list reads as a ranking. The rows used to be name-left,
  // value-right with nothing saying these were ordered by closeness.
  similarRank: {
    fontSize: 11, fontWeight: '700', letterSpacing: 1,
    color: colors.text.dimmed, width: 20,
    fontVariant: ['tabular-nums'],
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
  projLede: {
    color: colors.text.secondary, fontSize: 14, lineHeight: 21,
    marginTop: spacing.lg,
  },
  projStrong: { color: colors.text.primary, fontWeight: '700' },
  projFootnote: {
    color: colors.text.dimmed, fontSize: 10.5, lineHeight: 16,
    marginTop: spacing.md,
  },
  ladderLede: {
    color: colors.text.secondary, fontSize: 13, lineHeight: 19,
    marginBottom: spacing.md,
  },
  ladderCountValue: { color: colors.orange[500], fontSize: 24, fontWeight: '700', letterSpacing: -0.5 },
  ladderCountOf: { color: colors.text.dimmed, fontSize: 15, fontWeight: '600' },
  ladderCountLabel: {
    color: colors.text.muted, fontSize: 9, letterSpacing: 2,
    fontWeight: '600', marginTop: 2,
  },
  ladderRungNext: {
    // The tint used to be applied with marginHorizontal: -10, which made the
    // highlighted row physically WIDER than its neighbours — the row appeared
    // to jut out of the stack. The inset is constant now and only the fill
    // changes.
    backgroundColor: 'rgba(139,131,255,0.09)',
    borderRadius: radius.md,
  },
  ladderRung: {
    flexDirection: 'row', alignItems: 'center',
    paddingVertical: 14, paddingLeft: 16, paddingRight: 12,
    borderBottomWidth: 1, borderBottomColor: 'rgba(255,255,255,0.06)',
    position: 'relative',
  },
  ladderSpine: {
    position: 'absolute', left: 0, top: 8, bottom: 8,
    width: 2, borderRadius: 1,
    backgroundColor: 'rgba(255,255,255,0.14)',
  },
  // The label column has to take the slack, or the mark packs up against it
  // instead of sitting at the right edge. It had no flex — the checkmark
  // circle used to give this row its width, and removing the circle collapsed
  // it onto the label.
  ladderLabel: {
    flex: 1, fontSize: 15, color: colors.text.secondary, fontWeight: '500',
  },
  // Fixed width so the marks form a true column down the card rather than
  // ragging against labels of different lengths.
  ladderRight: { alignItems: 'flex-end', minWidth: 92 },
  ladderThreshold: {
    fontSize: 16, fontWeight: '700', color: colors.text.primary,
    fontVariant: ['tabular-nums'], letterSpacing: -0.3,
  },
  ladderGap: { fontSize: 11.5, color: colors.text.muted, marginTop: 3 },
})
