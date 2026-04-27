// ═══════════════════════════════════════════════════════════════════════════
// FULL ANALYSIS — 5-Act deep performance report (matches web app depth)
// Act I:  Snapshot — editorial narrative, percentile, peak forecast, tier dist
// Act II: Similar Athletes — career-matched historical athletes with depth
// Act III: Performance Matrix — age group × tier grid, steps to world class
// Act IV: Improvement Trajectories — early/late/steady projections + scenarios
// Act V: Competition Ladder — full qualification standards with "YOU" line
// ═══════════════════════════════════════════════════════════════════════════

import React, { useState, useMemo, useEffect } from 'react'
import {
  View,
  Text,
  ScrollView,
  StyleSheet,
  ActivityIndicator,
  Dimensions,
} from 'react-native'
import { Ionicons } from '@expo/vector-icons'
import { colors, spacing, radius } from '../lib/theme'
import { SUPABASE_URL, SUPABASE_ANON_KEY, getCachedToken } from '../lib/supabase'
import { getTier, TIER_NAMES, TIER_COLORS, TIER_SHORT, TIER_COUNT_SENIOR, buildMatrix, deriveTiers, AGE_GROUPS } from '../lib/performanceTiers'
import { getAgeGroup, isTimeDiscipline, PERFORMANCE_LEVELS } from '../lib/performanceLevels'
import {
  isLowerBetter,
  performancePercentile,
  qualifierZones,
  performanceZoneLabel,
  getCalibration,
} from '../lib/disciplineScience'
import { projectAllTrajectories } from '../lib/improvementCurves'

const { width: SCREEN_W } = Dimensions.get('window')

// ── Constants ───────────────────────────────────────────────────────────────
const TYPICAL_PEAK_AGES: Record<string, number> = {
  '60m': 26, '100m': 26, '200m': 26, '400m': 26,
  '110m Hurdles': 27, '100m Hurdles': 27, '400m Hurdles': 27,
  '800m': 27, '1500m': 28, '3000m': 28, '3000m Steeplechase': 28,
  '5000m': 28, '10000m': 29,
  'Long Jump': 27, 'High Jump': 27, 'Triple Jump': 27, 'Pole Vault': 28,
  'Shot Put': 28, 'Discus Throw': 29, 'Hammer Throw': 29, 'Javelin Throw': 27,
}

const THROWS = ['Discus Throw', 'Shot Put', 'Javelin Throw', 'Hammer Throw', 'Discus', 'Javelin', 'Hammer', 'Shot']
const isThrowsDiscipline = (d: string) => THROWS.some(t => d?.toLowerCase().includes(t.toLowerCase()))
const isJumpsDiscipline = (d: string) => ['High Jump', 'Long Jump', 'Triple Jump', 'Pole Vault'].some(t => d?.includes(t))
const isHurdleDiscipline = (d: string) => d?.toLowerCase().includes('hurdle')
const isDistanceDiscipline = (d: string) => ['800m', '1500m', '3000m', '5000m', '10000m'].some(t => d?.includes(t))

function getEventCode(discipline: string, sex: string): string {
  const g = sex === 'F' ? 'F' : 'M'
  const d = discipline.toLowerCase()
  if (d === '100m') return `${g}100`
  if (d === '200m') return `${g}200`
  if (d === '400m') return `${g}400`
  if (d === '60m') return `${g}60`
  if (d.includes('110m h')) return `${g}110H`
  if (d.includes('100m h')) return `${g}100H`
  if (d.includes('400m h')) return `${g}400H`
  if (d === '800m') return `${g}800`
  if (d === '1500m') return `${g}1500`
  if (d.includes('steeple')) return `${g}3SC`
  if (d === '3000m') return `${g}3000`
  if (d === '5000m') return `${g}5K`
  if (d === '10000m') return `${g}10K`
  if (d.includes('long jump')) return `${g}LJ`
  if (d.includes('triple jump')) return `${g}TJ`
  if (d.includes('high jump')) return `${g}HJ`
  if (d.includes('pole vault')) return `${g}PV`
  if (d.includes('shot put')) return `${g}SP`
  if (d.includes('discus')) return `${g}DT`
  if (d.includes('hammer')) return `${g}HT`
  if (d.includes('javelin')) return `${g}JT`
  return ''
}

function formatPerf(value: number | null, discipline: string): string {
  if (!value) return '—'
  if (isThrowsDiscipline(discipline) || isJumpsDiscipline(discipline)) return `${value.toFixed(2)}m`
  const mins = Math.floor(value / 60)
  const secs = (value % 60).toFixed(2)
  return mins > 0 ? `${mins}:${secs.padStart(5, '0')}` : `${secs}s`
}

// ── Editorial narrative builder ─────────────────────────────────────────────
function buildEditorial(
  age: number, discipline: string, sex: string, pb: number,
  tier: any, percentile: number, similarAthletes: any[]
): string {
  const ageGroup = getAgeGroup(age)
  const lower = isLowerBetter(discipline)
  const isThrows = isThrowsDiscipline(discipline)
  const isJumps = isJumpsDiscipline(discipline)
  const currentTier = tier?.tier || 0
  const tierName = tier?.tierName || 'Unknown'
  const peakAge = TYPICAL_PEAK_AGES[discipline] || 27
  const yearsToPeak = Math.max(0, peakAge - age)

  const discNoun = isThrows ? 'throwers' : isJumps ? 'jumpers'
    : isHurdleDiscipline(discipline) ? 'hurdlers'
    : isDistanceDiscipline(discipline) ? 'distance runners' : 'sprinters'
  const discDisplay = discipline.toLowerCase()

  const simNames = similarAthletes.slice(0, 2).map((s: any) =>
    (s.athlete_name || s.name || '').split(' ').pop()
  )
  const simRef = simNames.length > 0 ? ` — a trajectory shared by ${simNames.join(' and ')}` : ''
  const peakSentence = yearsToPeak > 0
    ? ` Typical peak window for ${discDisplay} is age ${peakAge}–${peakAge + 2} (${yearsToPeak} year${yearsToPeak !== 1 ? 's' : ''} out).`
    : ''

  const typicalPeak = peakAge
  const isPastPeak = age > typicalPeak + 2
  const isInPeakWindow = age >= typicalPeak - 1 && age <= typicalPeak + 2

  const ageBucket = age < 16 ? 'youth'
    : age < 18 ? 'juniorDev'
    : age < 20 ? 'juniorTrans'
    : age < 24 ? 'earlySenior'
    : age < 30 ? 'peakSenior'
    : 'postPeak'

  const tierBucket = currentTier >= 7 ? 'elite'
    : currentTier >= 5 ? 'high'
    : currentTier >= 3 ? 'mid'
    : 'low'

  const pct = Math.max(1, 100 - percentile)
  let editorial = `At ${age}, this athlete outperforms ${percentile}% of ${ageGroup} ${discNoun} in our Olympic-outcome database.`

  if (ageBucket === 'youth') {
    if (tierBucket === 'high') {
      editorial += ` These are standout numbers for this age group, but performance at this stage often reflects physical maturity as much as raw talent. Many early developers plateau when peers catch up physically.`
      editorial += ` The priority should be broad athletic development across multiple movement qualities — speed, coordination, endurance — rather than early specialisation pressure.`
      if (simRef) editorial += simRef + '.'
    } else if (tierBucket === 'mid') {
      editorial += ` Showing a strong foundation for this age group. At this stage, biological maturity is the dominant variable — the athletes who go on to compete at the highest level are often not the ones leading the age-group rankings yet.`
      editorial += ` Continued multi-sport engagement and building a broad training base will serve them well.${peakSentence}`
    } else {
      editorial += ` This is a normal development range for this age. Many athletes who became nationally competitive as seniors were at similar or lower levels at ${age}.`
      editorial += ` The most important thing at this stage is keeping them in the sport, building enjoyment, and developing physical literacy. The performance window is years away.${peakSentence}`
    }
  } else if (ageBucket === 'juniorDev') {
    if (tierBucket === 'high') {
      editorial += ` Performing at a level that puts them alongside the junior trajectories of future Olympic qualifiers and finalists${simRef}.`
      editorial += ` However, continued physical maturation will play a significant role over the next 2–3 years. Structured training progression and avoiding overloading are critical at this stage.${peakSentence}`
    } else if (tierBucket === 'mid') {
      editorial += ` Tracking well — this tier placement aligns with athletes who went on to compete nationally as seniors. The next 2–3 years of structured development will be the key differentiator.`
      editorial += ` Focus should be on building event-specific technical foundations alongside general athletic qualities.${peakSentence}`
    } else {
      editorial += ` Still within normal development range. Many senior medalists were at the ${tierName.toLowerCase()} level or below at 16–17 — late physical maturation and training response can shift the picture significantly.`
      editorial += ` Patience and consistent training are the priority. Keep building the base.${peakSentence}`
    }
  } else if (ageBucket === 'juniorTrans') {
    if (tierBucket === 'high') {
      editorial += ` This is a genuine elite-trajectory signal. At ${age}, performing at levels consistent with the early careers of Olympic finalists and medalists${simRef}.`
      editorial += ` The transition from junior to senior competition is the next critical phase — maintaining this trajectory through increased training loads and senior-level competition will be key.${peakSentence}`
    } else if (tierBucket === 'mid') {
      editorial += ` Solid competitive position. Many senior finalists were in this range at ${age} — the next 2–3 years of development are often where the biggest jumps occur.`
      editorial += ` Should be transitioning into a more structured, event-specific training programme while maintaining volume.${peakSentence}`
    } else {
      editorial += ` Behind the typical curve of athletes who reached senior elite level, but late development is well documented in ${discDisplay}.`
      editorial += ` The window is not closed — several Olympic-level athletes made their breakthrough after 20. Consistent, progressive training and avoiding comparison to early developers is important.${peakSentence}`
    }
  } else if (ageBucket === 'earlySenior') {
    if (tierBucket === 'elite') {
      editorial += ` Exceptional — among the best in the world at a young senior age. Performing at world-class level with years of development still ahead${simRef}.${peakSentence}`
    } else if (tierBucket === 'high') {
      editorial += ` Elite trajectory confirmed. Performing at levels consistent with Olympic contention${simRef}.`
      editorial += ` Focus should shift toward marginal gains, competition strategy, and peaking for major championship cycles.${peakSentence}`
    } else if (tierBucket === 'mid') {
      editorial += ` Competitive domestically at the ${tierName.toLowerCase()} level. With the right improvement trajectory, international qualification is a realistic target within the peak window.`
      editorial += ` Needs a clear, periodised programme targeting specific performance thresholds.${peakSentence}`
    } else {
      editorial += ` There is a significant gap between the current level and the elite standard. At ${age}, most athletes who reach major championship level are already performing considerably higher.`
      editorial += ` Honest assessment of training programme, coaching quality, and commitment level is warranted. Specific, measurable short-term targets will be more productive than long-range goals.${peakSentence}`
    }
  } else if (ageBucket === 'peakSenior') {
    if (tierBucket === 'elite') {
      editorial += ` World-leading performance${simRef}.`
      editorial += isInPeakWindow ? ` Currently inside the typical peak window for ${discDisplay} — this is the time to target global medals and records.` : isPastPeak ? ` Sustaining world-class performance beyond the typical peak window is remarkable.` : `${peakSentence}`
    } else if (tierBucket === 'high') {
      editorial += ` In the mix for major championship finals and medals. The performance level is there — execution, consistency, and championship readiness are the variables${simRef}.`
      editorial += isInPeakWindow ? ` Inside the peak window — maximising this period is critical.` : `${peakSentence}`
    } else if (tierBucket === 'mid') {
      editorial += ` National-calibre competitor at the ${tierName.toLowerCase()} level.`
      editorial += isInPeakWindow ? ` Inside the typical peak window for ${discDisplay}, international qualification is the realistic ceiling without a significant breakthrough.` : isPastPeak ? ` Past the typical peak window — sustained competition at this level reflects a solid career.` : `${peakSentence}`
    } else {
      editorial += ` Well below elite standard ${isInPeakWindow ? 'at peak age' : isPastPeak ? 'and past the typical peak window' : 'approaching the peak window'}.`
      editorial += ` At this stage, the focus should be on personal bests, realistic competition targets, and the aspects of the sport valued most. The gap to international level is substantial.`
    }
  } else {
    // Post-peak 30+
    if (tierBucket === 'elite' || tierBucket === 'high') {
      editorial += ` Remarkable longevity — maintaining ${tierName.toLowerCase()}-level performance at ${age} is exceptional. Very few athletes sustain this standard past the typical peak window${simRef}.`
      editorial += ` Recovery, injury prevention, and smart competition scheduling become increasingly important.`
    } else if (tierBucket === 'mid') {
      editorial += ` A sustained competitive career at the ${tierName.toLowerCase()} level past 30 is commendable. Performing above the age-expected curve for most ${discNoun}.`
      editorial += ` Longevity at this level reflects strong training habits and durability.`
    } else {
      editorial += ` At ${age}, past the typical competitive peak for ${discDisplay}. Performance at this level suggests they may be returning to the sport or competing recreationally.`
      editorial += ` Focus on personal benchmarks, enjoyment, and injury-free training.`
    }
  }

  return editorial
}

// ── Section divider ─────────────────────────────────────────────────────────
function ActDivider({ number, title }: { number: string; title: string }) {
  return (
    <View style={s.actDivider}>
      <View style={s.actDividerLine} />
      <View style={s.actDividerContent}>
        <Text style={s.actNumber}>{number}</Text>
        <Text style={s.actTitle}>{title}</Text>
      </View>
    </View>
  )
}

// ═══════════════════════════════════════════════════════════════════════════
// MAIN COMPONENT
// ═══════════════════════════════════════════════════════════════════════════
interface FullAnalysisProps {
  discipline: string
  mark: number
  age: number
  sex: string  // 'M' or 'F'
  athleteName?: string
}

export default function FullAnalysis({ discipline, mark, age, sex, athleteName }: FullAnalysisProps) {
  const ageGroup = getAgeGroup(age)
  const lower = isLowerBetter(discipline)
  const tier = getTier(discipline, sex, ageGroup, mark)
  const percentile = performancePercentile(mark, discipline, sex)
  const zones = qualifierZones(discipline, sex)
  const peakAge = TYPICAL_PEAK_AGES[discipline] || 27
  const yearsToPeak = Math.max(0, peakAge - age)

  // ── Similar athletes ──
  const [similarAthletes, setSimilarAthletes] = useState<any[]>([])
  const [similarLoading, setSimilarLoading] = useState(true)

  useEffect(() => {
    const fetchSimilar = async () => {
      const eventCode = getEventCode(discipline, sex)
      if (!eventCode) { setSimilarLoading(false); return }
      try {
        const token = getCachedToken()
        const res = await fetch(`${SUPABASE_URL}/rest/v1/rpc/find_similar_athletes`, {
          method: 'POST',
          headers: {
            apikey: SUPABASE_ANON_KEY,
            Authorization: `Bearer ${token || SUPABASE_ANON_KEY}`,
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({ p_discipline_code: eventCode, p_pb: mark, p_age: age, p_limit: 5 }),
        })
        if (res.ok) setSimilarAthletes(await res.json())
      } catch (e) { console.warn('Similar athletes:', e) }
      setSimilarLoading(false)
    }
    fetchSimilar()
  }, [discipline, mark, age, sex])

  // ── Editorial ──
  const editorial = useMemo(() =>
    buildEditorial(age, discipline, sex, mark, tier, percentile, similarAthletes),
    [age, discipline, sex, mark, tier, percentile, similarAthletes]
  )

  // ── Performance matrix (Act III) ──
  const matrix = useMemo(() => buildMatrix(discipline, sex), [discipline, sex])

  // ── Improvement trajectories (Act IV) ──
  const trajectories = useMemo(() => {
    try {
      return projectAllTrajectories(mark, age, discipline, sex, 35)
    } catch { return null }
  }, [mark, age, discipline, sex])

  // ── Improvement scenarios table (Act IV) ──
  const scenarioRates = [0, 0.5, 1.0, 1.5, 2.0, 2.5]
  const futureAges = useMemo(() => {
    const ages: number[] = []
    for (let a = age; a <= Math.min(age + 8, 35); a++) ages.push(a)
    return ages
  }, [age])

  const scenarioTable = useMemo(() => {
    return scenarioRates.map(rate => ({
      rate,
      values: futureAges.map(futAge => {
        const years = futAge - age
        if (years === 0) return mark
        const factor = lower
          ? Math.pow(1 - rate / 100, years)
          : Math.pow(1 + rate / 100, years)
        return parseFloat((mark * factor).toFixed(2))
      }),
    }))
  }, [mark, age, lower, futureAges])

  // ── Tier distribution (Act I) ──
  const tierDistribution = [
    { tier: 7, name: 'World', pct: 0.04 },
    { tier: 6, name: 'Medalist', pct: 0.11 },
    { tier: 5, name: 'Finalist', pct: 0.18 },
    { tier: 4, name: 'Qualifier', pct: 0.26 },
    { tier: 3, name: 'National', pct: 0.22 },
    { tier: 2, name: 'Developing', pct: 0.14 },
    { tier: 1, name: 'Emerging', pct: 0.05 },
  ]
  const maxPct = Math.max(...tierDistribution.map(t => t.pct))

  // ── Competition ladder zones (Act V) ──
  const calibration = getCalibration(discipline, sex)

  return (
    <View>
      {/* ═══ ACT I: SNAPSHOT ═══ */}
      <ActDivider number="I" title="Snapshot" />

      {/* Hero PB */}
      <View style={s.heroCard}>
        <View pointerEvents="none" style={s.heroGlow} />
        <View style={s.heroInner}>
          {athleteName && <Text style={s.heroName}>{athleteName}</Text>}
          <Text style={s.heroDiscipline}>{discipline} · {sex === 'F' ? 'Female' : 'Male'} · Age {age}</Text>
          <Text style={s.heroPb}>{formatPerf(mark, discipline)}</Text>
          {tier && (
            <View style={[s.heroBadge, { backgroundColor: tier.color + '15', borderColor: tier.color + '25' }]}>
              <View style={[s.heroBadgeDot, { backgroundColor: tier.color }]} />
              <Text style={[s.heroBadgeText, { color: tier.color }]}>{tier.tierName}</Text>
            </View>
          )}
          <View style={s.heroStats}>
            <View style={s.heroStat}>
              <Text style={s.heroStatVal}>{percentile}%</Text>
              <Text style={s.heroStatLabel}>Percentile</Text>
            </View>
            <View style={s.heroStatDiv} />
            <View style={s.heroStat}>
              <Text style={s.heroStatVal}>{ageGroup}</Text>
              <Text style={s.heroStatLabel}>Age Group</Text>
            </View>
            <View style={s.heroStatDiv} />
            <View style={s.heroStat}>
              <Text style={[s.heroStatVal, yearsToPeak > 0 ? { color: colors.green } : { color: colors.text.muted }]}>
                {yearsToPeak > 0 ? `${peakAge}–${peakAge + 2}` : 'In window'}
              </Text>
              <Text style={s.heroStatLabel}>Peak Window</Text>
            </View>
          </View>
          {/* Tier bar */}
          <View style={s.tierBar}>
            {[1, 2, 3, 4, 5, 6, ...(ageGroup === 'Senior' ? [7] : [])].map(t => (
              <View key={t} style={[s.tierSeg, {
                backgroundColor: tier && tier.tier >= t ? TIER_COLORS[t] : 'rgba(255,255,255,0.06)',
              }]} />
            ))}
          </View>
        </View>
      </View>

      {/* Editorial narrative */}
      <View style={s.section}>
        <View style={s.sectionHead}>
          <Ionicons name="document-text-outline" size={14} color={colors.orange[500]} />
          <Text style={s.sectionTitle}>Assessment</Text>
        </View>
        <Text style={s.editorial}>{editorial}</Text>
      </View>

      {/* Tier distribution chart */}
      <View style={s.section}>
        <View style={s.sectionHead}>
          <Ionicons name="stats-chart-outline" size={14} color={colors.orange[500]} />
          <Text style={s.sectionTitle}>Cohort Distribution</Text>
          <Text style={s.sectionSub}>N = 1,204 · Olympics 2000–2024</Text>
        </View>
        {tierDistribution.map(td => {
          const isActive = tier && tier.tier === td.tier
          const barWidth = Math.max(8, (td.pct / maxPct) * 100)
          return (
            <View key={td.tier} style={s.distRow}>
              <View style={s.distLabel}>
                <Text style={[s.distTierName, isActive && { color: colors.text.primary, fontWeight: '700' }]}>
                  T{td.tier}
                </Text>
                <Text style={[s.distName, isActive && { color: colors.text.primary }]}>{td.name}</Text>
              </View>
              <View style={s.distBarWrap}>
                <View style={[s.distBarFill, {
                  width: `${barWidth}%`,
                  backgroundColor: isActive ? TIER_COLORS[td.tier] : TIER_COLORS[td.tier] + '40',
                }]} />
              </View>
              <Text style={[s.distPct, isActive && { color: colors.text.primary, fontWeight: '700' }]}>
                {Math.round(td.pct * 100)}%
              </Text>
              {isActive && (
                <View style={[s.youChip, { borderColor: TIER_COLORS[td.tier] + '40' }]}>
                  <Text style={[s.youChipText, { color: TIER_COLORS[td.tier] }]}>YOU</Text>
                </View>
              )}
            </View>
          )
        })}
      </View>

      {/* ═══ ACT II: SIMILAR ATHLETES ═══ */}
      <ActDivider number="II" title="Similar Athletes" />

      <View style={s.section}>
        <View style={s.sectionHead}>
          <Ionicons name="people-outline" size={14} color={colors.blue} />
          <Text style={s.sectionTitle}>Career-Matched Athletes</Text>
        </View>
        {similarLoading ? (
          <View style={s.loadRow}>
            <ActivityIndicator color={colors.orange[500]} size="small" />
            <Text style={s.loadText}>Searching 7,000+ Olympic careers...</Text>
          </View>
        ) : similarAthletes.length === 0 ? (
          <Text style={s.mutedText}>No career-matched athletes found for this event and age combination.</Text>
        ) : (
          similarAthletes.map((a: any, idx: number) => (
            <View key={idx} style={s.athleteCard}>
              <View style={s.athleteHeader}>
                <View style={s.athleteAvatar}>
                  <Text style={s.athleteInitial}>{(a.athlete_name || '?')[0]}</Text>
                </View>
                <View style={{ flex: 1 }}>
                  <Text style={s.athleteName}>{a.athlete_name}</Text>
                  <Text style={s.athleteMeta}>{a.country}</Text>
                </View>
                <View style={s.athletePbWrap}>
                  <Text style={s.athletePbLabel}>PB</Text>
                  <Text style={s.athletePbVal}>{formatPerf(a.pb_time, discipline)}</Text>
                </View>
              </View>
              <View style={s.athleteStats}>
                <View style={s.athleteStatItem}>
                  <Text style={s.athleteStatLabel}>At Age {a.closest_age}</Text>
                  <Text style={s.athleteStatVal}>{formatPerf(a.time_at_similar_age, discipline)}</Text>
                </View>
                {a.peak_age && (
                  <View style={s.athleteStatItem}>
                    <Text style={s.athleteStatLabel}>Peak Age</Text>
                    <Text style={s.athleteStatVal}>{a.peak_age}</Text>
                  </View>
                )}
                {a.classification && (
                  <View style={s.athleteStatItem}>
                    <Text style={s.athleteStatLabel}>Olympic</Text>
                    <Text style={[s.athleteStatVal, { color: colors.orange[500] }]}>
                      {a.classification === 'F' ? 'Finalist' : a.classification === 'SF' ? 'Semi' : 'Qualifier'}
                    </Text>
                  </View>
                )}
              </View>
            </View>
          ))
        )}
      </View>

      {/* ═══ ACT III: PERFORMANCE MATRIX ═══ */}
      <ActDivider number="III" title="Performance Matrix" />

      <View style={s.section}>
        <View style={s.sectionHead}>
          <Ionicons name="grid-outline" size={14} color={colors.purple} />
          <Text style={s.sectionTitle}>Age Group × Tier Standards</Text>
        </View>
        <Text style={s.sectionDesc}>
          Typical PB thresholds by age group. Your current position is highlighted.
        </Text>

        {/* Steps to top */}
        {tier && tier.tier < (ageGroup === 'Senior' ? 7 : 6) && (
          <View style={s.stepsCard}>
            <Text style={s.stepsNum}>{(ageGroup === 'Senior' ? 7 : 6) - tier.tier}</Text>
            <View>
              <Text style={s.stepsLabel}>tier{((ageGroup === 'Senior' ? 7 : 6) - tier.tier) !== 1 ? 's' : ''} to {ageGroup === 'Senior' ? 'World Class' : 'Medalist'}</Text>
              {tier.gap && tier.nextTierName && (
                <Text style={s.stepsGap}>
                  Next: {tier.nextTierName} ({lower ? '+' : '-'}{Math.abs(tier.gap).toFixed(2)})
                </Text>
              )}
            </View>
          </View>
        )}

        {/* Matrix grid */}
        <ScrollView horizontal showsHorizontalScrollIndicator={false}>
          <View>
            {/* Header row */}
            <View style={s.matrixRow}>
              <View style={[s.matrixCell, s.matrixHeaderCell]}>
                <Text style={s.matrixHeaderText}>Tier</Text>
              </View>
              {AGE_GROUPS.map(ag => (
                <View key={ag} style={[s.matrixCell, s.matrixHeaderCell, ag === ageGroup && s.matrixActiveCol]}>
                  <Text style={[s.matrixHeaderText, ag === ageGroup && { color: colors.orange[500] }]}>{ag}</Text>
                </View>
              ))}
            </View>

            {/* Data rows (T7 down to T1) */}
            {[7, 6, 5, 4, 3, 2, 1].map(t => {
              if (!matrix?.rows) return null
              return (
                <View key={t} style={s.matrixRow}>
                  <View style={[s.matrixCell, s.matrixLabelCell]}>
                    <View style={[s.matrixTierDot, { backgroundColor: TIER_COLORS[t] }]} />
                    <Text style={s.matrixTierLabel}>{TIER_SHORT[t]}</Text>
                  </View>
                  {matrix.rows.map((row: any) => {
                    const val = row.cuts[t - 1]
                    const isYou = tier && tier.tier === t && row.ageGroup === ageGroup
                    return (
                      <View key={row.ageGroup} style={[
                        s.matrixCell,
                        row.ageGroup === ageGroup && s.matrixActiveCol,
                        isYou && s.matrixYouCell,
                      ]}>
                        {val != null ? (
                          <Text style={[s.matrixVal, isYou && { color: colors.orange[500], fontWeight: '700' }]}>
                            {formatPerf(val, discipline)}
                          </Text>
                        ) : (
                          <Text style={s.matrixNull}>—</Text>
                        )}
                      </View>
                    )
                  })}
                </View>
              )
            })}
          </View>
        </ScrollView>
      </View>

      {/* ═══ ACT IV: IMPROVEMENT TRAJECTORIES ═══ */}
      <ActDivider number="IV" title="Improvement Trajectories" />

      {/* Trajectory projections */}
      {trajectories && (
        <View style={s.section}>
          <View style={s.sectionHead}>
            <Ionicons name="trending-up-outline" size={14} color={colors.green} />
            <Text style={s.sectionTitle}>Projected Career Paths</Text>
          </View>
          <Text style={s.sectionDesc}>
            Based on 10,423 Olympic-pipeline careers. Three trajectory types with median improvement rates.
          </Text>

          {['early', 'steady', 'late'].map(type => {
            const traj = (trajectories as any)[type]
            if (!traj?.projected?.length) return null
            const lastPoint = traj.projected[traj.projected.length - 1]
            const peakVal = lower
              ? Math.min(...traj.projected.map((p: any) => p.value))
              : Math.max(...traj.projected.map((p: any) => p.value))
            const peakPoint = traj.projected.find((p: any) => p.value === peakVal)
            const label = type === 'early' ? 'Early Peaker' : type === 'late' ? 'Late Developer' : 'Steady'
            const color = type === 'early' ? colors.orange[500] : type === 'late' ? colors.blue : colors.green
            const count = traj.count || traj.n || '—'

            return (
              <View key={type} style={s.trajCard}>
                <View style={s.trajHeader}>
                  <View style={[s.trajDot, { backgroundColor: color }]} />
                  <Text style={[s.trajLabel, { color }]}>{label}</Text>
                  <Text style={s.trajCount}>n = {count}</Text>
                </View>
                <View style={s.trajStats}>
                  {peakPoint && (
                    <View style={s.trajStatItem}>
                      <Text style={s.trajStatLabel}>Peak</Text>
                      <Text style={s.trajStatVal}>{formatPerf(peakVal, discipline)}</Text>
                      <Text style={s.trajStatSub}>at age {peakPoint.age}</Text>
                    </View>
                  )}
                  <View style={s.trajStatItem}>
                    <Text style={s.trajStatLabel}>At {Math.min(age + 4, 35)}</Text>
                    <Text style={s.trajStatVal}>
                      {formatPerf(
                        traj.projected.find((p: any) => p.age === Math.min(age + 4, 35))?.value || lastPoint?.value,
                        discipline
                      )}
                    </Text>
                  </View>
                </View>
              </View>
            )
          })}
        </View>
      )}

      {/* Improvement scenarios table */}
      <View style={s.section}>
        <View style={s.sectionHead}>
          <Ionicons name="calculator-outline" size={14} color={colors.amber} />
          <Text style={s.sectionTitle}>Improvement Scenarios</Text>
        </View>
        <Text style={s.sectionDesc}>
          Projected performance at different annual improvement rates.
        </Text>

        <ScrollView horizontal showsHorizontalScrollIndicator={false}>
          <View>
            {/* Header */}
            <View style={s.scenTableRow}>
              <View style={[s.scenTableCell, s.scenTableHeader, { width: 50 }]}>
                <Text style={s.scenTableHeaderText}>Rate</Text>
              </View>
              {futureAges.map(a => (
                <View key={a} style={[s.scenTableCell, s.scenTableHeader, a === age && s.scenTableActiveCol]}>
                  <Text style={[s.scenTableHeaderText, a === age && { color: colors.orange[500] }]}>{a}</Text>
                </View>
              ))}
            </View>

            {/* Data rows */}
            {scenarioTable.map(row => (
              <View key={row.rate} style={s.scenTableRow}>
                <View style={[s.scenTableCell, { width: 50 }]}>
                  <Text style={[s.scenTableRate, row.rate === 0 && { color: colors.text.dimmed }]}>
                    {row.rate === 0 ? 'Base' : `${lower ? '-' : '+'}${row.rate}%`}
                  </Text>
                </View>
                {row.values.map((val, idx) => {
                  const futAge = futureAges[idx]
                  const isBase = futAge === age
                  const newTier = getTier(discipline, sex, getAgeGroup(futAge), val)
                  const meetsFinalist = zones && (lower ? val <= zones.s80 : val >= zones.s80)
                  const meetsQualifier = zones && (lower ? val <= zones.s90 : val >= zones.s90)
                  return (
                    <View key={futAge} style={[
                      s.scenTableCell,
                      isBase && s.scenTableActiveCol,
                      meetsFinalist && { backgroundColor: colors.green + '08' },
                      meetsQualifier && !meetsFinalist && { backgroundColor: colors.blue + '08' },
                    ]}>
                      <Text style={[
                        s.scenTableVal,
                        isBase && { color: colors.orange[500], fontWeight: '700' },
                        meetsFinalist && { color: colors.green },
                      ]}>
                        {formatPerf(val, discipline)}
                      </Text>
                    </View>
                  )
                })}
              </View>
            ))}
          </View>
        </ScrollView>

        {/* Legend */}
        <View style={s.scenLegend}>
          <View style={s.scenLegendItem}>
            <View style={[s.scenLegendDot, { backgroundColor: colors.green + '30' }]} />
            <Text style={s.scenLegendText}>Finalist standard</Text>
          </View>
          <View style={s.scenLegendItem}>
            <View style={[s.scenLegendDot, { backgroundColor: colors.blue + '30' }]} />
            <Text style={s.scenLegendText}>Qualifier standard</Text>
          </View>
        </View>
      </View>

      {/* ═══ ACT V: COMPETITION LADDER ═══ */}
      <ActDivider number="V" title="Competition Ladder" />

      {zones ? (
        <View style={s.section}>
          <View style={s.sectionHead}>
            <Ionicons name="trophy-outline" size={14} color={colors.orange[500]} />
            <Text style={s.sectionTitle}>Qualification Standards</Text>
          </View>

          {/* Build ladder rungs from zones */}
          {(() => {
            const rungs = [
              { label: 'Olympic Qualifier', threshold: zones.s90, level: 'qualifier' },
              { label: 'Semifinalist', threshold: zones.s80, level: 'semi' },
              { label: 'Top 8 (Finalist)', threshold: zones.optimal, level: 'finalist' },
            ]
            // Add calibration extras if available
            if (calibration?.rocS70) {
              rungs.push({ label: 'Medal Contention', threshold: calibration.rocS70, level: 'medal' })
            }

            // Sort: hardest first for time (lowest), hardest first for field (highest)
            rungs.sort((a, b) => lower ? a.threshold - b.threshold : b.threshold - a.threshold)

            // Find where "YOU" sits
            let youInserted = false

            return (
              <View>
                {rungs.map((rung, idx) => {
                  const isMet = lower ? mark <= rung.threshold : mark >= rung.threshold
                  const gap = lower ? rung.threshold - mark : mark - rung.threshold
                  const isNext = !isMet && !youInserted

                  // Insert YOU marker before first unmet standard
                  const showYou = !isMet && !youInserted
                  if (showYou) youInserted = true

                  return (
                    <React.Fragment key={idx}>
                      {showYou && (
                        <View style={s.ladderYou}>
                          <View style={s.ladderYouLine} />
                          <View style={s.ladderYouChip}>
                            <Text style={s.ladderYouText}>YOU · {formatPerf(mark, discipline)}</Text>
                          </View>
                          <View style={s.ladderYouLine} />
                        </View>
                      )}
                      <View style={[s.ladderRow, isNext && s.ladderRowNext]}>
                        <View style={s.ladderLeft}>
                          <View style={[s.ladderDot, {
                            backgroundColor: isMet ? colors.green : isNext ? colors.orange[500] + '30' : 'rgba(255,255,255,0.06)',
                          }]}>
                            {isMet && <Ionicons name="checkmark" size={12} color="#fff" />}
                          </View>
                          <View>
                            <Text style={[s.ladderLabel, isMet && { color: colors.text.primary, fontWeight: '600' }]}>
                              {rung.label}
                            </Text>
                            {isNext && <Text style={s.ladderNextTag}>NEXT TARGET</Text>}
                          </View>
                        </View>
                        <View style={{ alignItems: 'flex-end' }}>
                          <Text style={[s.ladderThreshold, isNext && { color: colors.orange[500] }]}>
                            {formatPerf(rung.threshold, discipline)}
                          </Text>
                          {isMet ? (
                            <Text style={{ color: colors.green, fontSize: 10, fontWeight: '600' }}>Cleared</Text>
                          ) : (
                            <Text style={s.ladderGap}>{lower ? '+' : '-'}{Math.abs(gap).toFixed(2)} away</Text>
                          )}
                        </View>
                      </View>
                    </React.Fragment>
                  )
                })}
                {/* If all met, show YOU at the top */}
                {!youInserted && (
                  <View style={s.ladderYou}>
                    <View style={s.ladderYouLine} />
                    <View style={s.ladderYouChip}>
                      <Text style={s.ladderYouText}>YOU · {formatPerf(mark, discipline)}</Text>
                    </View>
                    <View style={s.ladderYouLine} />
                  </View>
                )}
              </View>
            )
          })()}
        </View>
      ) : (
        <View style={s.section}>
          <Text style={s.mutedText}>Competition standards not available for this discipline.</Text>
        </View>
      )}

      {/* Footer */}
      <View style={s.footer}>
        <Text style={s.footerText}>
          Olympics 2000–2024 · All rounds · {discipline} · {sex === 'F' ? 'Female' : 'Male'}
        </Text>
        <Text style={s.footerBrand}>bnchmrkd.</Text>
      </View>

      <View style={{ height: 40 }} />
    </View>
  )
}

// ── Styles ──────────────────────────────────────────────────────────────────
const s = StyleSheet.create({
  // Act dividers
  actDivider: { marginTop: spacing.xl, marginBottom: spacing.md },
  actDividerLine: { height: 1, backgroundColor: 'rgba(255,255,255,0.06)', marginBottom: spacing.md },
  actDividerContent: { flexDirection: 'row', alignItems: 'baseline', gap: spacing.sm },
  actNumber: { fontSize: 11, fontWeight: '800', color: colors.orange[500], letterSpacing: 1 },
  actTitle: { fontSize: 18, fontWeight: '700', color: colors.text.primary, letterSpacing: -0.3 },

  // Hero
  heroCard: {
    position: 'relative', overflow: 'hidden',
    backgroundColor: 'rgba(249,115,22,0.06)',
    borderWidth: 1, borderColor: 'rgba(249,115,22,0.15)',
    borderRadius: radius.lg, marginBottom: spacing.md,
  },
  heroGlow: {
    position: 'absolute', top: -60, left: -60, width: 160, height: 160,
    borderRadius: 80, backgroundColor: colors.orange[500], opacity: 0.08,
  },
  heroInner: { padding: spacing.xl, alignItems: 'center' },
  heroName: { fontSize: 20, fontWeight: '700', color: colors.text.primary, marginBottom: 2 },
  heroDiscipline: { fontSize: 11, letterSpacing: 1.5, color: colors.text.muted, fontWeight: '600', textTransform: 'uppercase', marginBottom: spacing.md },
  heroPb: { fontSize: 44, fontWeight: '800', color: colors.text.primary, letterSpacing: -2, marginBottom: spacing.md },
  heroBadge: { flexDirection: 'row', alignItems: 'center', gap: 6, paddingHorizontal: 14, paddingVertical: 6, borderRadius: 20, borderWidth: 1, marginBottom: spacing.xl },
  heroBadgeDot: { width: 6, height: 6, borderRadius: 3 },
  heroBadgeText: { fontSize: 13, fontWeight: '700' },
  heroStats: { flexDirection: 'row', gap: spacing.lg, marginBottom: spacing.lg },
  heroStat: { alignItems: 'center', minWidth: 70 },
  heroStatVal: { fontSize: 16, fontWeight: '700', color: colors.text.primary },
  heroStatLabel: { fontSize: 9, letterSpacing: 1, color: colors.text.muted, fontWeight: '600', marginTop: 2, textTransform: 'uppercase' },
  heroStatDiv: { width: 1, backgroundColor: 'rgba(255,255,255,0.08)' },
  tierBar: { flexDirection: 'row', gap: 3, width: '100%' },
  tierSeg: { flex: 1, height: 3, borderRadius: 1.5 },

  // Sections
  section: {
    backgroundColor: 'rgba(255,255,255,0.02)',
    borderWidth: 1, borderColor: 'rgba(255,255,255,0.05)',
    borderRadius: radius.md, padding: spacing.lg, marginBottom: spacing.md,
  },
  sectionHead: {
    flexDirection: 'row', alignItems: 'center', gap: spacing.sm,
    marginBottom: spacing.md, paddingBottom: spacing.sm,
    borderBottomWidth: 1, borderBottomColor: 'rgba(255,255,255,0.04)',
  },
  sectionTitle: { fontSize: 14, fontWeight: '600', color: colors.text.primary, flex: 1 },
  sectionSub: { fontSize: 10, color: colors.text.dimmed },
  sectionDesc: { fontSize: 12, color: colors.text.muted, lineHeight: 17, marginBottom: spacing.md },

  // Editorial
  editorial: { fontSize: 14, color: colors.text.secondary, lineHeight: 22 },

  // Tier distribution
  distRow: { flexDirection: 'row', alignItems: 'center', paddingVertical: 6, gap: spacing.sm },
  distLabel: { flexDirection: 'row', alignItems: 'center', gap: 4, width: 90 },
  distTierName: { fontSize: 11, fontWeight: '700', color: colors.text.dimmed, width: 22 },
  distName: { fontSize: 11, color: colors.text.muted },
  distBarWrap: { flex: 1, height: 8, backgroundColor: 'rgba(255,255,255,0.04)', borderRadius: 4, overflow: 'hidden' },
  distBarFill: { height: 8, borderRadius: 4 },
  distPct: { fontSize: 11, color: colors.text.dimmed, width: 28, textAlign: 'right' },
  youChip: { paddingHorizontal: 5, paddingVertical: 1, borderRadius: 4, borderWidth: 1 },
  youChipText: { fontSize: 8, fontWeight: '800', letterSpacing: 1 },

  // Similar athletes
  loadRow: { flexDirection: 'row', alignItems: 'center', gap: spacing.sm, padding: spacing.sm },
  loadText: { fontSize: 13, color: colors.text.muted },
  mutedText: { fontSize: 13, color: colors.text.dimmed },
  athleteCard: {
    backgroundColor: 'rgba(255,255,255,0.02)', borderRadius: radius.sm,
    borderWidth: 1, borderColor: 'rgba(255,255,255,0.04)',
    padding: spacing.md, marginBottom: spacing.sm,
  },
  athleteHeader: { flexDirection: 'row', alignItems: 'center', gap: spacing.md, marginBottom: spacing.sm },
  athleteAvatar: {
    width: 36, height: 36, borderRadius: 18,
    backgroundColor: 'rgba(255,255,255,0.06)',
    justifyContent: 'center', alignItems: 'center',
  },
  athleteInitial: { fontSize: 14, fontWeight: '700', color: colors.text.muted },
  athleteName: { fontSize: 14, fontWeight: '600', color: colors.text.primary },
  athleteMeta: { fontSize: 11, color: colors.text.muted },
  athletePbWrap: { alignItems: 'flex-end' },
  athletePbLabel: { fontSize: 9, letterSpacing: 1, color: colors.text.dimmed, fontWeight: '600' },
  athletePbVal: { fontSize: 16, fontWeight: '700', color: colors.orange[500] },
  athleteStats: { flexDirection: 'row', gap: spacing.md, borderTopWidth: 1, borderTopColor: 'rgba(255,255,255,0.04)', paddingTop: spacing.sm },
  athleteStatItem: { flex: 1 },
  athleteStatLabel: { fontSize: 9, letterSpacing: 0.8, color: colors.text.dimmed, fontWeight: '600', textTransform: 'uppercase' },
  athleteStatVal: { fontSize: 13, fontWeight: '600', color: colors.text.primary, marginTop: 2 },

  // Performance matrix
  stepsCard: {
    flexDirection: 'row', alignItems: 'center', gap: spacing.md,
    backgroundColor: 'rgba(249,115,22,0.06)', borderRadius: radius.sm,
    padding: spacing.md, marginBottom: spacing.lg,
    borderWidth: 1, borderColor: 'rgba(249,115,22,0.12)',
  },
  stepsNum: { fontSize: 32, fontWeight: '800', color: colors.orange[500] },
  stepsLabel: { fontSize: 14, fontWeight: '600', color: colors.text.primary },
  stepsGap: { fontSize: 11, color: colors.text.muted, marginTop: 1 },
  matrixRow: { flexDirection: 'row' },
  matrixCell: { width: 62, paddingVertical: 8, alignItems: 'center', borderBottomWidth: 1, borderBottomColor: 'rgba(255,255,255,0.03)' },
  matrixHeaderCell: { borderBottomColor: 'rgba(255,255,255,0.06)' },
  matrixLabelCell: { flexDirection: 'row', alignItems: 'center', gap: 4, justifyContent: 'center' },
  matrixActiveCol: { backgroundColor: 'rgba(249,115,22,0.04)' },
  matrixYouCell: { backgroundColor: 'rgba(249,115,22,0.10)', borderRadius: 4 },
  matrixHeaderText: { fontSize: 10, fontWeight: '700', color: colors.text.muted, letterSpacing: 0.5 },
  matrixTierDot: { width: 6, height: 6, borderRadius: 3 },
  matrixTierLabel: { fontSize: 10, fontWeight: '700', color: colors.text.muted },
  matrixVal: { fontSize: 10, color: colors.text.secondary, fontWeight: '500' },
  matrixNull: { fontSize: 10, color: colors.text.dimmed },

  // Trajectory cards
  trajCard: {
    backgroundColor: 'rgba(255,255,255,0.02)', borderRadius: radius.sm,
    borderWidth: 1, borderColor: 'rgba(255,255,255,0.04)',
    padding: spacing.md, marginBottom: spacing.sm,
  },
  trajHeader: { flexDirection: 'row', alignItems: 'center', gap: spacing.sm, marginBottom: spacing.sm },
  trajDot: { width: 8, height: 8, borderRadius: 4 },
  trajLabel: { fontSize: 13, fontWeight: '700' },
  trajCount: { fontSize: 10, color: colors.text.dimmed, marginLeft: 'auto' },
  trajStats: { flexDirection: 'row', gap: spacing.lg },
  trajStatItem: {},
  trajStatLabel: { fontSize: 9, letterSpacing: 0.8, color: colors.text.dimmed, fontWeight: '600', textTransform: 'uppercase' },
  trajStatVal: { fontSize: 15, fontWeight: '700', color: colors.text.primary, marginTop: 2 },
  trajStatSub: { fontSize: 10, color: colors.text.muted, marginTop: 1 },

  // Scenarios table
  scenTableRow: { flexDirection: 'row' },
  scenTableCell: { width: 58, paddingVertical: 8, alignItems: 'center', borderBottomWidth: 1, borderBottomColor: 'rgba(255,255,255,0.03)' },
  scenTableHeader: { borderBottomColor: 'rgba(255,255,255,0.06)' },
  scenTableActiveCol: { backgroundColor: 'rgba(249,115,22,0.05)' },
  scenTableHeaderText: { fontSize: 10, fontWeight: '700', color: colors.text.muted },
  scenTableRate: { fontSize: 10, fontWeight: '600', color: colors.green },
  scenTableVal: { fontSize: 10, color: colors.text.secondary },
  scenLegend: { flexDirection: 'row', gap: spacing.lg, marginTop: spacing.md },
  scenLegendItem: { flexDirection: 'row', alignItems: 'center', gap: 4 },
  scenLegendDot: { width: 10, height: 10, borderRadius: 2 },
  scenLegendText: { fontSize: 10, color: colors.text.dimmed },

  // Ladder
  ladderRow: {
    flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center',
    paddingVertical: 12, borderBottomWidth: 1, borderBottomColor: 'rgba(255,255,255,0.03)',
  },
  ladderRowNext: { backgroundColor: 'rgba(249,115,22,0.04)', borderRadius: radius.sm, paddingHorizontal: spacing.sm },
  ladderLeft: { flexDirection: 'row', alignItems: 'center', gap: spacing.md },
  ladderDot: { width: 22, height: 22, borderRadius: 11, justifyContent: 'center', alignItems: 'center' },
  ladderLabel: { fontSize: 14, color: colors.text.muted },
  ladderNextTag: { fontSize: 9, fontWeight: '700', color: colors.orange[500], letterSpacing: 1, marginTop: 1 },
  ladderThreshold: { fontSize: 14, fontWeight: '600', color: colors.text.primary },
  ladderGap: { fontSize: 10, color: colors.text.dimmed, marginTop: 1 },
  ladderYou: {
    flexDirection: 'row', alignItems: 'center', gap: spacing.sm,
    paddingVertical: spacing.sm,
  },
  ladderYouLine: { flex: 1, height: 1, backgroundColor: colors.orange[500] + '40' },
  ladderYouChip: {
    backgroundColor: colors.orange[500] + '15', borderWidth: 1, borderColor: colors.orange[500] + '30',
    borderRadius: 12, paddingHorizontal: 10, paddingVertical: 3,
  },
  ladderYouText: { fontSize: 10, fontWeight: '700', color: colors.orange[500], letterSpacing: 0.5 },

  // Footer
  footer: { alignItems: 'center', marginTop: spacing.xl, paddingVertical: spacing.lg },
  footerText: { fontSize: 10, color: colors.text.dimmed, letterSpacing: 0.5 },
  footerBrand: { fontSize: 14, fontWeight: '700', color: colors.orange[500] + '40', marginTop: spacing.xs, letterSpacing: -0.5 },
})
