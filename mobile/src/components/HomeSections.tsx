// ═══════════════════════════════════════════════════════════════════════
// HOME SECTIONS — Ported from web HomeSections.jsx
// TrajectoryHero, RivalCard, WhereYouStand, AthleteDNALadder,
// ScienceSpotlight, SinceLastVisit, WeeklyRecap, Sparkline
// ═══════════════════════════════════════════════════════════════════════

import React, { useMemo, useState, useEffect, useRef } from 'react'
import {
  View,
  Text,
  StyleSheet,
  Animated,
  Dimensions,
  TouchableOpacity,
} from 'react-native'
import Svg, { Path, Defs, LinearGradient as SvgGrad, Stop, Circle, Line } from 'react-native-svg'
import { Ionicons } from '@expo/vector-icons'
import { colors, spacing, radius } from '../lib/theme'
import { AlmanacCard, HeroCard, MonoKicker, TierBadge, StreakChip } from './ui'
import {
  performancePercentile,
  performanceZoneLabel,
  buildDnaProfile,
  RADAR_AXES,
  findLimitingFactor,
  getDailyScienceCard,
  getCalibration,
  performancePosition,
  getReferenceTiers,
  DNA_TIERS,
  scoreToTier,
  ageAdjustScore,
  AXIS_INFO,
  disciplinePriority,
} from '../lib/disciplineScience'
import { findRival, ageFromDob } from '../lib/historicalRivals'

const { width: SCREEN_W } = Dimensions.get('window')
const ORANGE = colors.orange[500]
const ORANGE_LITE = colors.orange[400]

// ── Format helpers ─────────────────────────────────────────────────────
const fmtMark = (v: number | null | undefined, higher: boolean) => {
  if (v == null || !Number.isFinite(v)) return '—'
  return higher ? `${Number(v).toFixed(2)}m` : `${Number(v).toFixed(2)}s`
}

const relTime = (date: Date | null) => {
  if (!date) return null
  const ms = Date.now() - date.getTime()
  const days = Math.floor(ms / 86400000)
  if (days <= 0) return 'today'
  if (days === 1) return 'yesterday'
  if (days < 7) return `${days}d ago`
  if (days < 28) return `${Math.floor(days / 7)}w ago`
  return `${Math.floor(days / 30)}mo ago`
}

// ═══════════════════════════════════════════════════════════════════════
// 0. TRAJECTORY HERO
// PB (gradient text) | Season Best | Last Race  +  Streak + Tier
// ═══════════════════════════════════════════════════════════════════════
interface TrajectoryHeroProps {
  races: { value: number; date: string }[]
  pb: number | null
  discipline: string | null
  sex?: string
  streak: number
}

export function TrajectoryHero({ races, pb, discipline, sex = 'M', streak }: TrajectoryHeroProps) {
  const cal = discipline ? getCalibration(discipline, sex) : null
  const higher = !!cal?.higher

  const stats = useMemo(() => {
    const valid = (races || [])
      .filter((r) => r && r.value != null && Number.isFinite(Number(r.value)) && r.date)
      .map((r) => ({ value: Number(r.value), date: new Date(r.date) }))
      .filter((r) => !isNaN(r.date.getTime()))
    if (!valid.length) return { pb: null, sb: null, last: null, sbIsPb: false }
    const byDate = [...valid].sort((a, b) => b.date.getTime() - a.date.getTime())
    const last = byDate[0]
    const bestOf = (arr: typeof valid) =>
      arr.reduce(
        (best: (typeof valid)[0] | null, r) =>
          best == null
            ? r
            : higher
            ? r.value > best.value
              ? r
              : best
            : r.value < best.value
            ? r
            : best,
        null
      )
    const pbRow = bestOf(valid)
    const currentYear = new Date().getFullYear()
    const sbRow = bestOf(valid.filter((r) => r.date.getFullYear() === currentYear))
    const sbIsPb = sbRow && pbRow && Math.abs(sbRow.value - pbRow.value) < 1e-6
    return { pb: pbRow, sb: sbRow, last, sbIsPb }
  }, [races, higher])

  const effectivePb = pb != null ? Number(pb) : stats.pb?.value ?? null

  const deltaVsPb = (v: number | null | undefined) => {
    if (v == null || effectivePb == null) return null
    return Number(v) - effectivePb
  }

  const fmtDelta = (d: number | null) => {
    if (d == null) return null
    if (Math.abs(d) < 0.005) return { text: '= PB', tone: 'neutral' as const }
    const sign = d > 0 ? '+' : '−'
    const abs = Math.abs(d).toFixed(2)
    const unit = higher ? 'm' : 's'
    const better = higher ? d > 0 : d < 0
    return { text: `${sign}${abs}${unit}`, tone: better ? ('up' as const) : ('down' as const) }
  }

  const sbDelta = fmtDelta(deltaVsPb(stats.sb?.value))
  const lastDelta = fmtDelta(deltaVsPb(stats.last?.value))

  const position = useMemo(
    () => (effectivePb != null && discipline ? performancePosition(effectivePb, discipline, sex) : null),
    [effectivePb, discipline, sex]
  )
  const currentTier = position?.nearestTier?.label
  const nextTier = position?.nextTier?.label

  return (
    <HeroCard>
      {/* Header — kicker + streak */}
      <View style={s.heroHeader}>
        <View style={{ flex: 1 }}>
          <MonoKicker color={colors.orange[300]}>Your headline</MonoKicker>
          <Text style={s.heroSubtitle}>Where you stand right now</Text>
        </View>
        <StreakChip count={streak} />
      </View>

      {/* 3-stat strip: PB | SB | Last Race */}
      <View style={s.heroStatsGrid}>
        {/* PB */}
        <View style={s.heroStatCol}>
          <Text style={s.heroStatKicker}>PERSONAL BEST</Text>
          <Text style={s.heroPbValue}>
            {effectivePb != null ? Number(effectivePb).toFixed(2) : '—'}
          </Text>
          <Text style={s.heroPbUnit}>{higher ? 'm' : 's'}</Text>
          <View style={s.heroPbBar} />
          {currentTier && <Text style={s.heroTierLabel}>{currentTier}</Text>}
        </View>

        {/* SB */}
        <View style={[s.heroStatCol, s.heroStatBorder]}>
          <View style={s.heroStatKickerRow}>
            <Text style={s.heroStatKickerDim}>SEASON BEST</Text>
            {stats.sbIsPb && (
              <View style={s.heroPbChip}>
                <Text style={s.heroPbChipText}>NEW PB</Text>
              </View>
            )}
          </View>
          <Text style={s.heroStatBigVal}>
            {stats.sb ? Number(stats.sb.value).toFixed(2) : '—'}
          </Text>
          <Text style={s.heroStatUnit}>{higher ? 'm' : 's'}</Text>
          {sbDelta && !stats.sbIsPb && (
            <Text
              style={[
                s.heroDelta,
                {
                  color:
                    sbDelta.tone === 'up'
                      ? colors.green
                      : sbDelta.tone === 'down'
                      ? colors.red
                      : colors.text.muted,
                },
              ]}
            >
              {sbDelta.text} <Text style={s.heroDeltaVs}>vs PB</Text>
            </Text>
          )}
          {stats.sb && (
            <Text style={s.heroTimeAgo}>{relTime(stats.sb.date)}</Text>
          )}
        </View>

        {/* Last Race */}
        <View style={[s.heroStatCol, s.heroStatBorder]}>
          <Text style={s.heroStatKickerDim}>LAST RACE</Text>
          <Text style={s.heroStatBigVal}>
            {stats.last ? Number(stats.last.value).toFixed(2) : '—'}
          </Text>
          <Text style={s.heroStatUnit}>{higher ? 'm' : 's'}</Text>
          {lastDelta && (
            <Text
              style={[
                s.heroDelta,
                {
                  color:
                    lastDelta.tone === 'up'
                      ? colors.green
                      : lastDelta.tone === 'down'
                      ? colors.red
                      : colors.text.muted,
                },
              ]}
            >
              {lastDelta.text} <Text style={s.heroDeltaVs}>vs PB</Text>
            </Text>
          )}
          {stats.last && (
            <Text style={s.heroTimeAgo}>{relTime(stats.last.date)}</Text>
          )}
        </View>
      </View>

      {!stats.pb && (
        <Text style={s.heroEmpty}>LOG A RESULT TO UNLOCK YOUR HEADLINE</Text>
      )}

      {/* Next tier footer */}
      {nextTier && nextTier !== currentTier && (
        <View style={s.heroFooter}>
          <Ionicons name="flag" size={13} color={colors.orange[300]} />
          <Text style={s.heroFooterText}>
            Next tier: <Text style={s.heroFooterBold}>{nextTier}</Text>
          </Text>
        </View>
      )}
    </HeroCard>
  )
}

// ═══════════════════════════════════════════════════════════════════════
// 0b. RIVAL CARD
// ═══════════════════════════════════════════════════════════════════════
interface RivalCardProps {
  pb: number | null
  discipline: string | null
  sex?: string
  dob?: string | null
}

export function RivalCard({ pb, discipline, sex = 'M', dob }: RivalCardProps) {
  const cal = discipline ? getCalibration(discipline, sex) : null
  const higher = !!cal?.higher
  const athleteAge = useMemo(() => (dob ? ageFromDob(dob) : null), [dob])
  const rival = useMemo(
    () => (discipline ? findRival(discipline, sex, athleteAge, pb, higher) : null),
    [discipline, sex, athleteAge, pb, higher]
  )

  if (!rival || pb == null) return null

  const unit = higher ? 'm' : 's'
  const diff = Math.abs(rival.diff)
  const ageLabel =
    athleteAge != null && rival.age != null
      ? rival.age === athleteAge
        ? `at age ${athleteAge}`
        : athleteAge < rival.age
        ? `${rival.age - athleteAge} year${rival.age - athleteAge === 1 ? '' : 's'} younger`
        : `${athleteAge - rival.age} year${athleteAge - rival.age === 1 ? '' : 's'} older`
      : rival.age != null
      ? `at age ${rival.age}`
      : ''

  return (
    <View style={s.rivalCard}>
      {/* Glow orbs */}
      <View style={[s.rivalOrb, { top: -40, left: -40, backgroundColor: colors.purple }]} />
      <View style={[s.rivalOrb, { bottom: -40, right: -40, backgroundColor: ORANGE }]} />

      {/* Header */}
      <View style={s.rivalHeader}>
        <View style={{ flex: 1 }}>
          <MonoKicker color="#c4b5fd">YOUR PACER</MonoKicker>
          <Text style={s.rivalName}>{rival.name}</Text>
          {rival.note && <Text style={s.rivalNote}>{rival.note}</Text>}
        </View>
        <Text style={s.rivalCountry}>{rival.country}</Text>
      </View>

      {/* Description */}
      <View style={s.rivalBody}>
        <Text style={s.rivalDesc}>
          {rival.name.split(' ').slice(-1)[0]}'s breakthrough at age{' '}
          <Text style={s.rivalBold}>{rival.age}</Text>:{' '}
          <Text style={s.rivalBold}>{fmtMark(rival.mark, higher)}</Text>.
        </Text>
        <Text
          style={[
            s.rivalDiff,
            { color: rival.ahead ? colors.green : colors.red },
          ]}
        >
          Your PB is {diff.toFixed(2)}
          {unit}{' '}
          {rival.ahead
            ? higher
              ? 'beyond'
              : 'faster than'
            : higher
            ? 'short of'
            : 'off'}{' '}
          that benchmark
        </Text>
      </View>

      {/* Comparison bar */}
      <View style={s.rivalBarWrap}>
        <View style={s.rivalBarTrack}>
          {/* Connector */}
          <View
            style={[
              s.rivalBarFill,
              {
                left: `${Math.min(barPct(pb, rival.mark, higher), barPct(rival.mark, rival.mark, higher))}%` as any,
                width: `${Math.abs(barPct(pb, rival.mark, higher) - barPct(rival.mark, rival.mark, higher))}%` as any,
                backgroundColor: rival.ahead ? colors.green : colors.red,
              },
            ]}
          />
        </View>
        {/* Labels */}
        <View style={s.rivalBarLabels}>
          <View>
            <Text style={s.rivalBarTag}>YOU</Text>
            <Text style={s.rivalBarVal}>{fmtMark(pb, higher)}</Text>
          </View>
          <View style={{ alignItems: 'flex-end' }}>
            <Text style={[s.rivalBarTag, { color: '#c4b5fd' }]}>RIVAL</Text>
            <Text style={[s.rivalBarVal, { color: '#c4b5fd' }]}>{fmtMark(rival.mark, higher)}</Text>
          </View>
        </View>
      </View>
    </View>
  )
}

function barPct(val: number, rivalMark: number, higher: boolean): number {
  const minV = Math.min(val, rivalMark)
  const maxV = Math.max(val, rivalMark)
  const span = Math.max(maxV - minV, higher ? 0.5 : 0.3) * 2.2
  const mid = (minV + maxV) / 2
  const lo = mid - span / 2
  const hi = mid + span / 2
  return Math.max(4, Math.min(96, ((val - lo) / (hi - lo)) * 100))
}

// ═══════════════════════════════════════════════════════════════════════
// 1. WHERE YOU STAND — The Continuum
// ═══════════════════════════════════════════════════════════════════════
interface WhereYouStandProps {
  pb: number | null
  discipline: string | null
  sex?: string
}

const TIER_ACCENT: Record<string, { swatch: string; tag: string }> = {
  Novice: { swatch: '#475569', tag: 'starter' },
  School: { swatch: '#64748b', tag: 'developing' },
  Club: { swatch: '#94a3b8', tag: 'local' },
  National: { swatch: '#f59e0b', tag: 'national' },
  Continental: { swatch: '#fb923c', tag: 'regional' },
  'Olympic Final': { swatch: '#f97316', tag: 'international' },
  'World Record': { swatch: '#fef3c7', tag: 'world' },
}

export function WhereYouStand({ pb, discipline, sex = 'M' }: WhereYouStandProps) {
  const position = useMemo(
    () => (pb != null && discipline ? performancePosition(pb, discipline, sex) : null),
    [pb, discipline, sex]
  )
  const cal = discipline ? getCalibration(discipline, sex) : null
  const higher = !!cal?.higher

  const slideAnim = useRef(new Animated.Value(0)).current
  useEffect(() => {
    Animated.timing(slideAnim, {
      toValue: 1,
      duration: 1500,
      delay: 200,
      useNativeDriver: false,
    }).start()
  }, [])

  if (pb == null || !position || position.percent == null) {
    return (
      <AlmanacCard kicker="THE CONTINUUM" title="Where you stand" accent={ORANGE}>
        <Text style={s.contEmpty}>
          Log a result to place yourself on the ladder — from novice all the way to world record.
        </Text>
      </AlmanacCard>
    )
  }

  const { percent, tiers, nearestTier, nextTier } = position
  const gap =
    nextTier && nextTier !== nearestTier
      ? higher
        ? nextTier.value - pb
        : pb - nextTier.value
      : null

  const railWidth = SCREEN_W - 72

  return (
    <AlmanacCard kicker="THE CONTINUUM" title="Where you stand" accent={ORANGE}>
      {/* PB display */}
      <View style={s.contPbRow}>
        <Text style={s.contPbLabel}>PERSONAL BEST</Text>
        <Text style={s.contPbValue}>
          {higher ? `${Number(pb).toFixed(2)} m` : `${Number(pb).toFixed(2)} s`}
        </Text>
      </View>

      {/* Rail */}
      <View style={[s.contRailWrap, { width: railWidth }]}>
        {/* Background track */}
        <View style={s.contTrack} />

        {/* Filled progress */}
        <Animated.View
          style={[
            s.contFill,
            {
              width: slideAnim.interpolate({
                inputRange: [0, 1],
                outputRange: [0, (percent / 100) * railWidth],
              }),
            },
          ]}
        />

        {/* Tier dots */}
        {tiers.map((t: any, i: number) => {
          const accent = TIER_ACCENT[t.label] || { swatch: '#94a3b8', tag: '' }
          const reached = percent >= t.percent
          const left = (t.percent / 100) * railWidth
          return (
            <View key={t.label} style={[s.contTierDot, { left: left - 4 }]}>
              <View
                style={[
                  s.contDotInner,
                  {
                    backgroundColor: reached ? accent.swatch : '#1e293b',
                    borderColor: reached ? accent.swatch : '#334155',
                  },
                ]}
              />
              <View style={[s.contTierLabel, i % 2 === 0 ? { top: -42 } : { top: 14 }]}>
                <Text style={[s.contTierTag, reached && { color: accent.swatch }]}>
                  {accent.tag}
                </Text>
                <Text style={[s.contTierName, reached && { color: '#fff' }]}>
                  {t.label}
                </Text>
              </View>
            </View>
          )
        })}

        {/* Athlete marker */}
        <Animated.View
          style={[
            s.contMarker,
            {
              left: slideAnim.interpolate({
                inputRange: [0, 1],
                outputRange: [0, (percent / 100) * railWidth - 8],
              }),
            },
          ]}
        >
          <View style={s.contMarkerGlow} />
          <View style={s.contMarkerDot} />
        </Animated.View>
      </View>

      {/* Footer — next milestone */}
      {nearestTier && (
        <View style={s.contFooter}>
          <View style={s.contFooterBar} />
          <View style={{ flex: 1 }}>
            <Text style={s.contFooterKicker}>NEXT MILESTONE</Text>
            <Text style={s.contFooterText}>
              You've cleared{' '}
              <Text style={{ color: '#fff', fontWeight: '600' }}>{nearestTier.label}</Text>
              {nextTier && nextTier !== nearestTier && gap != null && (
                <Text>
                  . Next — <Text style={{ color: colors.orange[300], fontWeight: '600' }}>{nextTier.label}</Text>{' '}
                  <Text style={{ color: colors.text.muted }}>
                    ({higher ? '+' : '−'}{Math.abs(gap).toFixed(2)}{higher ? 'm' : 's'})
                  </Text>
                </Text>
              )}
            </Text>
          </View>
        </View>
      )}
    </AlmanacCard>
  )
}

// ═══════════════════════════════════════════════════════════════════════
// 2. ATHLETE DNA LADDER — sorted tiered bars per axis
// ═══════════════════════════════════════════════════════════════════════
interface DNALadderProps {
  metrics: any[]
  discipline: string | null
  dob?: string | null
}

export function AthleteDNALadder({ metrics, discipline, dob }: DNALadderProps) {
  const profile = useMemo(() => buildDnaProfile(metrics || []), [metrics])
  const age = useMemo(() => (dob ? ageFromDob(dob) : null), [dob])
  const priorityOrder = useMemo(
    () => (discipline ? disciplinePriority(discipline) : RADAR_AXES.map((a: any) => a.key)),
    [discipline]
  )

  const rows = useMemo(() => {
    return priorityOrder.map((key: string, priorityIdx: number) => {
      const axis = RADAR_AXES.find((a: any) => a.key === key)
      const raw = profile[key]?.score ?? null
      const adj = ageAdjustScore(raw, key, age)
      const tier = raw != null && adj ? scoreToTier(adj.adjusted) : null
      return {
        key,
        label: axis?.label || key,
        priorityIdx,
        measured: raw != null,
        raw,
        adjusted: adj?.adjusted ?? null,
        boost: adj?.boost ?? 0,
        tier,
        info: AXIS_INFO?.[key],
      }
    })
  }, [profile, priorityOrder, age])

  const measuredRows = rows.filter((r) => r.measured)

  // Strengths / Focus
  const sortedByScore = [...measuredRows].sort((a, b) => (b.adjusted ?? 0) - (a.adjusted ?? 0))
  const strengths = sortedByScore
    .slice(0, 2)
    .filter((r) => (r.adjusted ?? 0) >= 60)
    .map((r) => r.label)
  const focus = sortedByScore
    .slice(-2)
    .filter((r) => (r.adjusted ?? 0) < 60)
    .reverse()
    .map((r) => r.label)

  return (
    <AlmanacCard kicker="THE PROFILE" title="Athlete DNA" accent={ORANGE}>
      {/* Meta line */}
      <Text style={s.ladderMeta}>
        {measuredRows.length}/{rows.length} axes measured
        {age != null && <Text style={{ color: colors.text.dimmed }}> · age-adjusted for {Math.round(age)}</Text>}
      </Text>

      {/* Strengths / Focus */}
      {(strengths.length > 0 || focus.length > 0) && (
        <View style={s.ladderSummary}>
          {strengths.length > 0 && (
            <View style={s.ladderSummaryItem}>
              <Text style={[s.ladderSummaryTag, { color: colors.green }]}>▲ YOUR EDGE </Text>
              <Text style={s.ladderSummaryText}>{strengths.join(', ')}</Text>
            </View>
          )}
          {focus.length > 0 && (
            <View style={s.ladderSummaryItem}>
              <Text style={[s.ladderSummaryTag, { color: colors.orange[300] }]}>● FOCUS </Text>
              <Text style={s.ladderSummaryText}>{focus.join(', ')}</Text>
            </View>
          )}
        </View>
      )}

      {/* Rows */}
      {rows.map((row, idx) => (
        <LadderRow key={row.key} row={row} isTop={idx === 0} discipline={discipline} />
      ))}

      {/* Legend */}
      <View style={s.ladderLegend}>
        <View style={s.ladderLegendItem}>
          <View style={[s.ladderLegendDot, { backgroundColor: ORANGE }]} />
          <Text style={s.ladderLegendText}>you</Text>
        </View>
        <View style={s.ladderLegendItem}>
          <View style={s.ladderLegendDash} />
          <Text style={s.ladderLegendText}>finalist</Text>
        </View>
      </View>
    </AlmanacCard>
  )
}

function LadderRow({ row, isTop, discipline }: { row: any; isTop: boolean; discipline: string | null }) {
  const { label, measured, adjusted, boost, tier } = row
  const tiers = DNA_TIERS || []

  return (
    <View style={s.ladderRow}>
      {/* Header: label + tier badge */}
      <View style={s.ladderRowHeader}>
        <View style={s.ladderRowLeft}>
          <Text style={[s.ladderAxisLabel, !measured && { color: colors.text.dimmed }]}>
            {label}
          </Text>
          {isTop && discipline && (
            <View style={s.ladderPriorityChip}>
              <Text style={s.ladderPriorityText}>#1 FOR {discipline.toUpperCase()}</Text>
            </View>
          )}
        </View>
        {measured && tier ? (
          <TierBadge label={tier.label.toUpperCase()} color={tier.color} small />
        ) : (
          <Text style={s.ladderUnlockText}>LOG TO UNLOCK</Text>
        )}
      </View>

      {/* 5-segment bar */}
      <View style={s.ladderBarRow}>
        {tiers.map((t: any, i: number) => (
          <View
            key={t.key || i}
            style={[
              s.ladderSegment,
              {
                backgroundColor: measured
                  ? tier && tier.index >= i
                    ? t.color + '55'
                    : t.color + '18'
                  : 'rgba(255,255,255,0.03)',
              },
              i < tiers.length - 1 && { marginRight: 1 },
            ]}
          />
        ))}
        {/* Finalist line at 85% */}
        {measured && <View style={s.ladderFinalistLine} />}
        {/* Athlete marker */}
        {measured && adjusted != null && (
          <View
            style={[
              s.ladderMarker,
              {
                left: `${Math.max(2, Math.min(98, adjusted))}%` as any,
                backgroundColor: tier?.color || ORANGE,
              },
            ]}
          />
        )}
      </View>

      {/* Footer: score + age boost */}
      {measured && (
        <View style={s.ladderFooter}>
          <Text style={s.ladderFooterText}>
            {tier?.nextTier ? `${tier.toNext} pts to ${tier.nextTier.label}` : 'Top tier reached'}
          </Text>
          <Text style={s.ladderFooterScore}>
            {adjusted}
            {boost > 0 && (
              <Text style={{ color: 'rgba(249,115,22,0.6)' }}> (+{boost} for age)</Text>
            )}
          </Text>
        </View>
      )}
    </View>
  )
}

// ═══════════════════════════════════════════════════════════════════════
// SCIENCE SPOTLIGHT — rotating daily training note
// ═══════════════════════════════════════════════════════════════════════
interface ScienceSpotlightProps {
  discipline: string | null
}

export function ScienceSpotlight({ discipline }: ScienceSpotlightProps) {
  const card = useMemo(() => (discipline ? getDailyScienceCard(discipline) : null), [discipline])
  if (!card) return null

  return (
    <AlmanacCard kicker="SCIENCE SPOTLIGHT" title={card.title || 'Training Science'} accent={colors.teal}>
      <Text style={s.sciText}>{card.body || ''}</Text>
      {card.target && (
        <View style={s.sciRec}>
          <Ionicons name="bulb-outline" size={14} color={colors.amber} />
          <Text style={s.sciRecText}>{card.target}</Text>
        </View>
      )}
    </AlmanacCard>
  )
}

// ═══════════════════════════════════════════════════════════════════════
// SINCE LAST VISIT — activity banner
// ═══════════════════════════════════════════════════════════════════════
interface SinceLastVisitProps {
  metrics: any[]
  performances: any[]
}

export function SinceLastVisit({ metrics, performances }: SinceLastVisitProps) {
  // Approximate "last visit" as 24h ago (no localStorage on mobile)
  const cutoff = Date.now() - 24 * 60 * 60 * 1000
  const recentMetrics = metrics.filter((m) => new Date(m.recorded_at).getTime() > cutoff)
  const recentPerfs = performances.filter(
    (p) => new Date(p.competition_date || p.created_at).getTime() > cutoff
  )
  // Compute PBs client-side
  const pbTracker: Record<string, number> = {}
  for (const m of recentMetrics) {
    const k = m.metric_key; const v = parseFloat(m.value)
    const lower = (k || '').match(/^(sprint_|flying_|split_|resting_hr|rhr|body_fat|tt_|bronco)/) != null
    if (!(k in pbTracker) || (lower ? v < pbTracker[k] : v > pbTracker[k])) pbTracker[k] = v
  }
  const newPBs = Object.keys(pbTracker).length

  if (recentMetrics.length === 0 && recentPerfs.length === 0) return null

  return (
    <View style={s.sinceCard}>
      <View style={s.sinceDot} />
      <Text style={s.sinceText}>
        Since last visit · <Text style={{ color: colors.text.secondary }}>24h ago</Text>
      </Text>
      <Text style={s.sinceSummary}>
        {newPBs > 0 && (
          <Text style={{ color: ORANGE }}>{newPBs} new PB{newPBs > 1 ? 's' : ''} · </Text>
        )}
        {recentPerfs.length > 0 && <Text>{recentPerfs.length} result{recentPerfs.length > 1 ? 's' : ''} · </Text>}
        {recentMetrics.length} metric{recentMetrics.length > 1 ? 's' : ''}
      </Text>
    </View>
  )
}

// ═══════════════════════════════════════════════════════════════════════
// WEEKLY RECAP — 3-card grid (Fri-Sun or always on mobile)
// ═══════════════════════════════════════════════════════════════════════
interface WeeklyRecapProps {
  metrics: any[]
  overallTier: any
}

export function WeeklyRecap({ metrics, overallTier }: WeeklyRecapProps) {
  // Count this week's logs
  const weekStart = new Date()
  weekStart.setDate(weekStart.getDate() - weekStart.getDay())
  weekStart.setHours(0, 0, 0, 0)
  const weekLogs = metrics.filter((m) => new Date(m.recorded_at).getTime() >= weekStart.getTime())
  // Compute week PBs client-side
  const weekPbTracker: Record<string, number> = {}
  for (const m of weekLogs) {
    const k = m.metric_key; const v = parseFloat(m.value)
    const lower = (k || '').match(/^(sprint_|flying_|split_|resting_hr|rhr|body_fat|tt_|bronco)/) != null
    if (!(k in weekPbTracker) || (lower ? v < weekPbTracker[k] : v > weekPbTracker[k])) weekPbTracker[k] = v
  }
  const weekPBs = Object.keys(weekPbTracker).length

  if (weekLogs.length === 0) return null

  return (
    <AlmanacCard kicker="WEEKLY RECAP" accent={colors.blue}>
      <View style={s.recapGrid}>
        <View style={s.recapCell}>
          <Text style={s.recapNum}>{weekLogs.length}</Text>
          <Text style={s.recapLabel}>SESSIONS</Text>
        </View>
        <View style={[s.recapCell, s.recapCellBorder]}>
          <Text style={[s.recapNum, weekPBs > 0 && { color: colors.green }]}>
            {weekPBs > 0 ? `+${weekPBs}` : '—'}
          </Text>
          <Text style={s.recapLabel}>PB DELTA</Text>
        </View>
        <View style={[s.recapCell, s.recapCellBorder]}>
          <Text style={[s.recapNum, overallTier && { color: overallTier.color }]}>
            {overallTier?.label?.[0] || '—'}
          </Text>
          <Text style={s.recapLabel}>TIER</Text>
        </View>
      </View>
    </AlmanacCard>
  )
}

// ═══════════════════════════════════════════════════════════════════════
// SPARKLINE — mini SVG chart
// ═══════════════════════════════════════════════════════════════════════
interface SparklineProps {
  data: number[]
  color?: string
  width?: number
  height?: number
}

export function Sparkline({ data, color = ORANGE, width = 60, height = 24 }: SparklineProps) {
  if (!data || data.length < 2) return null
  const min = Math.min(...data)
  const max = Math.max(...data)
  const range = max - min || 1
  const points = data.map((v, i) => ({
    x: (i / (data.length - 1)) * width,
    y: height - ((v - min) / range) * (height - 4) - 2,
  }))
  const pathD = points.map((p, i) => `${i === 0 ? 'M' : 'L'}${p.x.toFixed(1)},${p.y.toFixed(1)}`).join(' ')
  const areaD = `${pathD} L${width},${height} L0,${height} Z`

  return (
    <Svg width={width} height={height}>
      <Defs>
        <SvgGrad id="sparkFill" x1="0" y1="0" x2="0" y2="1">
          <Stop offset="0" stopColor={color} stopOpacity={0.3} />
          <Stop offset="1" stopColor={color} stopOpacity={0} />
        </SvgGrad>
      </Defs>
      <Path d={areaD} fill="url(#sparkFill)" />
      <Path d={pathD} fill="none" stroke={color} strokeWidth={1.5} strokeLinecap="round" />
      <Circle cx={points[points.length - 1].x} cy={points[points.length - 1].y} r={2} fill={color} />
    </Svg>
  )
}

// ═══════════════════════════════════════════════════════════════════════
// STYLES
// ═══════════════════════════════════════════════════════════════════════
const s = StyleSheet.create({
  // TrajectoryHero
  heroHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
    marginBottom: spacing.md,
  },
  heroSubtitle: { color: colors.text.secondary, fontSize: 14, marginTop: 4 },
  heroStatsGrid: { flexDirection: 'row', marginTop: spacing.sm },
  heroStatCol: { flex: 1 },
  heroStatBorder: { paddingLeft: 12, borderLeftWidth: 1, borderLeftColor: 'rgba(255,255,255,0.06)' },
  heroStatKicker: {
    fontSize: 8, letterSpacing: 2, color: 'rgba(253,186,116,0.8)', fontWeight: '600',
  },
  heroStatKickerRow: { flexDirection: 'row', alignItems: 'center', gap: 6 },
  heroStatKickerDim: {
    fontSize: 8, letterSpacing: 2, color: colors.text.dimmed, fontWeight: '600',
  },
  heroPbValue: {
    fontSize: 32, fontWeight: '700', color: colors.orange[400],
    marginTop: 4, letterSpacing: -1,
  },
  heroPbUnit: { fontSize: 11, color: colors.text.muted, fontWeight: '500' },
  heroPbBar: {
    width: 32, height: 2, borderRadius: 1, marginTop: 6,
    backgroundColor: ORANGE,
  },
  heroTierLabel: {
    fontSize: 11, color: colors.orange[300], fontWeight: '600', marginTop: 6,
  },
  heroPbChip: {
    paddingHorizontal: 6, paddingVertical: 2, borderRadius: 4,
    backgroundColor: 'rgba(249,115,22,0.25)',
    borderWidth: 1, borderColor: 'rgba(249,115,22,0.5)',
  },
  heroPbChipText: { fontSize: 7, fontWeight: '800', letterSpacing: 1, color: ORANGE_LITE },
  heroStatBigVal: {
    fontSize: 24, fontWeight: '600', color: '#fff',
    marginTop: 4, letterSpacing: -0.5,
  },
  heroStatUnit: { fontSize: 10, color: colors.text.muted },
  heroDelta: { fontSize: 10, fontWeight: '700', marginTop: 4 },
  heroDeltaVs: { color: colors.text.dimmed, fontWeight: '400' },
  heroTimeAgo: {
    fontSize: 8, letterSpacing: 1.5, color: colors.text.dimmed,
    fontWeight: '600', marginTop: 2, textTransform: 'uppercase',
  },
  heroEmpty: {
    fontSize: 9, letterSpacing: 2, color: colors.text.dimmed,
    textAlign: 'center', marginTop: spacing.md, fontWeight: '600',
  },
  heroFooter: {
    flexDirection: 'row', alignItems: 'center', gap: 8,
    paddingTop: spacing.md, marginTop: spacing.md,
    borderTopWidth: 1, borderTopColor: 'rgba(255,255,255,0.06)',
  },
  heroFooterText: { color: colors.text.secondary, fontSize: 12, flex: 1 },
  heroFooterBold: { color: '#fff', fontWeight: '600' },

  // RivalCard
  rivalCard: {
    position: 'relative', overflow: 'hidden', borderRadius: 16,
    borderWidth: 1, borderColor: 'rgba(167,139,250,0.25)',
    padding: 20, marginBottom: spacing.md,
    backgroundColor: 'rgba(124,58,237,0.06)',
  },
  rivalOrb: {
    position: 'absolute', width: 120, height: 120, borderRadius: 60, opacity: 0.1,
  },
  rivalHeader: { flexDirection: 'row', justifyContent: 'space-between', marginBottom: 12 },
  rivalName: { fontSize: 20, fontWeight: '600', color: '#fff', marginTop: 4 },
  rivalNote: { fontSize: 9, letterSpacing: 1.5, color: colors.text.dimmed, textTransform: 'uppercase', marginTop: 2 },
  rivalCountry: { fontSize: 10, letterSpacing: 2, color: colors.text.dimmed, fontWeight: '600' },
  rivalBody: { marginBottom: spacing.md },
  rivalDesc: { color: colors.text.secondary, fontSize: 14, lineHeight: 20 },
  rivalBold: { color: '#fff', fontWeight: '600' },
  rivalDiff: { fontSize: 15, fontWeight: '600', marginTop: 8 },

  rivalBarWrap: { marginTop: spacing.sm },
  rivalBarTrack: {
    height: 3, borderRadius: 2, backgroundColor: 'rgba(255,255,255,0.07)',
    position: 'relative',
  },
  rivalBarFill: { position: 'absolute', top: 0, bottom: 0, borderRadius: 2 },
  rivalBarLabels: {
    flexDirection: 'row', justifyContent: 'space-between', marginTop: 8,
  },
  rivalBarTag: {
    fontSize: 8, letterSpacing: 2, color: colors.orange[300],
    fontWeight: '600', textTransform: 'uppercase',
  },
  rivalBarVal: { fontSize: 10, color: '#fff', fontWeight: '600', marginTop: 2 },

  // WhereYouStand
  contEmpty: { color: colors.text.secondary, fontSize: 14, lineHeight: 20 },
  contPbRow: {
    flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center',
    marginBottom: spacing.lg,
  },
  contPbLabel: {
    fontSize: 9, letterSpacing: 2, color: colors.text.dimmed, fontWeight: '600',
  },
  contPbValue: {
    fontSize: 28, fontWeight: '600', color: colors.orange[400], letterSpacing: -0.5,
  },
  contRailWrap: {
    position: 'relative', height: 100, alignSelf: 'center', marginBottom: spacing.md,
    justifyContent: 'center',
  },
  contTrack: {
    position: 'absolute', left: 0, right: 0, height: 3, borderRadius: 2,
    backgroundColor: 'rgba(255,255,255,0.07)', top: '50%', marginTop: -1.5,
  },
  contFill: {
    position: 'absolute', left: 0, height: 3, borderRadius: 2, top: '50%', marginTop: -1.5,
    backgroundColor: ORANGE,
  },
  contTierDot: { position: 'absolute', top: '50%', marginTop: -4, zIndex: 2 },
  contDotInner: { width: 8, height: 8, borderRadius: 4, borderWidth: 1.5 },
  contTierLabel: {
    position: 'absolute', left: -30, width: 68, alignItems: 'center',
  },
  contTierTag: {
    fontSize: 7, letterSpacing: 1.5, color: colors.text.dimmed,
    fontWeight: '600', textTransform: 'uppercase',
  },
  contTierName: { fontSize: 9, color: colors.text.muted, fontWeight: '500', marginTop: 1 },
  contMarker: { position: 'absolute', top: '50%', marginTop: -8, zIndex: 3 },
  contMarkerGlow: {
    position: 'absolute', width: 40, height: 40, borderRadius: 20,
    backgroundColor: ORANGE, opacity: 0.2, top: -12, left: -12,
  },
  contMarkerDot: {
    width: 16, height: 16, borderRadius: 8,
    backgroundColor: '#fff', borderWidth: 2, borderColor: ORANGE,
  },
  contFooter: {
    flexDirection: 'row', gap: 12, alignItems: 'flex-start',
    paddingTop: spacing.md, borderTopWidth: 1,
    borderTopColor: 'rgba(255,255,255,0.05)',
  },
  contFooterBar: {
    width: 3, height: 32, borderRadius: 2, backgroundColor: ORANGE, marginTop: 2,
  },
  contFooterKicker: {
    fontSize: 8, letterSpacing: 2, color: colors.text.dimmed,
    fontWeight: '600', marginBottom: 4,
  },
  contFooterText: { color: colors.text.secondary, fontSize: 13, lineHeight: 19 },

  // DNA Ladder
  ladderMeta: {
    fontSize: 9, letterSpacing: 1.5, color: colors.text.muted,
    fontWeight: '600', marginBottom: spacing.sm,
  },
  ladderSummary: { marginBottom: spacing.md, gap: 4 },
  ladderSummaryItem: { flexDirection: 'row', flexWrap: 'wrap' },
  ladderSummaryTag: { fontSize: 9, letterSpacing: 1.5, fontWeight: '700' },
  ladderSummaryText: { fontSize: 12, color: colors.text.secondary },
  ladderRow: { marginBottom: 16 },
  ladderRowHeader: {
    flexDirection: 'row', justifyContent: 'space-between',
    alignItems: 'center', marginBottom: 6,
  },
  ladderRowLeft: { flexDirection: 'row', alignItems: 'center', gap: 8, flex: 1 },
  ladderAxisLabel: {
    fontSize: 11, letterSpacing: 1, color: colors.text.secondary,
    fontWeight: '600', textTransform: 'uppercase',
  },
  ladderPriorityChip: {
    paddingHorizontal: 6, paddingVertical: 2, borderRadius: 4,
    backgroundColor: 'rgba(249,115,22,0.12)',
    borderWidth: 1, borderColor: 'rgba(249,115,22,0.25)',
  },
  ladderPriorityText: {
    fontSize: 7, fontWeight: '800', letterSpacing: 1, color: ORANGE_LITE,
  },
  ladderUnlockText: {
    fontSize: 9, letterSpacing: 1.5, color: colors.text.dimmed, fontWeight: '600',
  },
  ladderBarRow: {
    flexDirection: 'row', height: 8, borderRadius: 4, overflow: 'hidden',
    position: 'relative',
  },
  ladderSegment: { flex: 1, height: 8 },
  ladderFinalistLine: {
    position: 'absolute', left: '85%', top: -2, bottom: -2, width: 1.5,
    backgroundColor: 'rgba(148,163,184,0.4)',
  },
  ladderMarker: {
    position: 'absolute', top: '50%', marginTop: -5, width: 10, height: 10,
    borderRadius: 5, borderWidth: 2, borderColor: '#0f172a',
  },
  ladderFooter: {
    flexDirection: 'row', justifyContent: 'space-between', marginTop: 4,
  },
  ladderFooterText: { fontSize: 9, color: colors.text.dimmed },
  ladderFooterScore: { fontSize: 9, color: colors.text.dimmed },
  ladderLegend: {
    flexDirection: 'row', justifyContent: 'center', gap: 20,
    paddingTop: spacing.md, marginTop: spacing.sm,
    borderTopWidth: 1, borderTopColor: 'rgba(255,255,255,0.05)',
  },
  ladderLegendItem: { flexDirection: 'row', alignItems: 'center', gap: 6 },
  ladderLegendDot: { width: 8, height: 8, borderRadius: 4 },
  ladderLegendDash: {
    width: 12, height: 6,
    backgroundColor: 'rgba(148,163,184,0.4)',
  },
  ladderLegendText: {
    fontSize: 9, letterSpacing: 1.5, color: colors.text.muted,
    fontWeight: '600', textTransform: 'uppercase',
  },

  // ScienceSpotlight
  sciText: { color: colors.text.secondary, fontSize: 14, lineHeight: 21 },
  sciRec: {
    flexDirection: 'row', gap: 8, alignItems: 'flex-start',
    marginTop: spacing.md, paddingTop: spacing.md,
    borderTopWidth: 1, borderTopColor: 'rgba(255,255,255,0.04)',
  },
  sciRecText: { color: colors.text.secondary, fontSize: 13, lineHeight: 19, flex: 1 },

  // SinceLastVisit
  sinceCard: {
    flexDirection: 'row', alignItems: 'center', gap: 8,
    paddingVertical: 10, paddingHorizontal: 16,
    backgroundColor: 'rgba(255,255,255,0.02)',
    borderRadius: 12, borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.06)',
    marginBottom: spacing.md,
  },
  sinceDot: { width: 6, height: 6, borderRadius: 3, backgroundColor: colors.green },
  sinceText: { fontSize: 11, color: colors.text.muted, fontWeight: '600' },
  sinceSummary: { fontSize: 11, color: colors.text.secondary, fontWeight: '500' },

  // WeeklyRecap
  recapGrid: { flexDirection: 'row' },
  recapCell: { flex: 1, alignItems: 'center', paddingVertical: 8 },
  recapCellBorder: { borderLeftWidth: 1, borderLeftColor: 'rgba(255,255,255,0.06)' },
  recapNum: {
    fontSize: 22, fontWeight: '700', color: colors.text.primary, letterSpacing: -0.5,
  },
  recapLabel: {
    fontSize: 8, letterSpacing: 2, color: colors.text.muted,
    fontWeight: '600', marginTop: 4,
  },
})
