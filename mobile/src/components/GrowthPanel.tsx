// ═══════════════════════════════════════════════════════════════════════
// GROWTH — what the badge on the squad card was pointing at.
//
// The card can only carry a number. This is where the number has to earn
// itself: how it was measured, over how long, how much of it could be the
// tape rather than the athlete, and what a coach might do about it.
//
// The order is deliberate. Measurement first, then interpretation, then the
// caveat — never a recommendation above the evidence it rests on.
// ═══════════════════════════════════════════════════════════════════════

import React from 'react'
import { View, Text, StyleSheet } from 'react-native'
import { Ionicons } from '@expo/vector-icons'
import { useTheme } from '../contexts/ThemeContext'
import { MonoKicker } from './ui'
import InfoDot from './InfoDot'
import { spacing, radius, onImage, typeScale, weight } from '../lib/theme'
import {
  GROWTH_LABEL, GROWTH_TONE, growthHeadline, growthAdvice,
  daysSinceLastHeight, REMEASURE_DAYS, RAPID_CM_PER_YEAR, estimateConflict,
  type GrowthReading, type HeightPoint,
} from '../lib/growth'

export default function GrowthPanel({
  reading, heights, sex, age, maturityStatus,
}: {
  reading: GrowthReading | null
  /** 'pre-PHV' | 'circa-PHV' | 'post-PHV' from the Mirwald estimate, if known. */
  maturityStatus?: string | null
  /** Only for the "last measured" line — the maths is already done. */
  heights: HeightPoint[]
  sex?: string | null
  age?: number | null
}) {
  const { colors } = useTheme()
  if (!reading) return null

  // Growth monitoring is for people who are still growing. Showing a
  // 27-year-old a stature velocity would be noise dressed as insight.
  if (age != null && age >= 19) return null

  const tone = GROWTH_TONE[reading.level]
  const since = daysSinceLastHeight(heights)
  const stale = since != null && since > REMEASURE_DAYS
  const advice = growthAdvice(reading, sex)
  const conflict = estimateConflict(reading, maturityStatus)

  return (
    <View style={s.wrap}>
      <View style={s.head}>
        <Ionicons name="resize-outline" size={14} color={tone} />
        <MonoKicker color={onImage.muted}>Growth</MonoKicker>
        <InfoDot term="phv" size={13} />
      </View>

      <View style={s.headline}>
        <Text style={[s.level, { color: tone }]}>{GROWTH_LABEL[reading.level]}</Text>
        <Text style={s.detail}>{growthHeadline(reading)}</Text>
      </View>

      {/* How it was arrived at, before what it means. */}
      {reading.level !== 'unknown' && (
        <View style={s.facts}>
          <Fact label="Measurements" value={`${reading.points}`} />
          <Fact label="Over" value={`${reading.spanDays} days`} />
          {reading.massVelocity != null && (
            <Fact label="Mass" value={`${reading.massVelocity > 0 ? '+' : ''}${reading.massVelocity.toFixed(1)} kg/yr`} />
          )}
        </View>
      )}

      {advice.map((line, i) => (
        <View key={i} style={s.line}>
          <View style={[s.bullet, { backgroundColor: i === 0 ? tone : onImage.dim }]} />
          <Text style={[s.lineText, i === 0 && { color: onImage.ink, fontWeight: weight.medium }]}>
            {line}
          </Text>
        </View>
      ))}

      {reading.level === 'steady' && (
        <Text style={s.lineText}>
          Growing at a rate that carries no particular flag. Keep measuring —
          the value of this is the series, not any one reading.
        </Text>
      )}

      {!!conflict && (
        <View style={[s.stale, { borderColor: onImage.cardBorder, backgroundColor: onImage.card }]}>
          <Ionicons name="git-compare-outline" size={13} color={onImage.muted} />
          <Text style={[s.staleText, { color: onImage.muted }]}>{conflict}</Text>
        </View>
      )}

      {stale && (
        <View style={[s.stale, { borderColor: colors.amber + '4D', backgroundColor: colors.amber + '14' }]}>
          <Ionicons name="time-outline" size={13} color={colors.amber} />
          <Text style={[s.staleText, { color: colors.amber }]}>
            Last measured {since} days ago. Monthly is what catches a spurt while
            it is happening — it takes thirty seconds against a wall.
          </Text>
        </View>
      )}

      {/* The provenance, at the bottom, in full. A coach making a decision
          about a fourteen-year-old is entitled to know that the number
          underneath it came from boys. */}
      <Text style={s.source}>
        {RAPID_CM_PER_YEAR} cm/yr is the rate above which Hall & Erskine's 2025
        review of 26 academy studies found elevated injury risk. Every one of
        those studies was male academy football; no female equivalent has been
        published. Age at peak height velocity in female athletes averages
        11.2 years but with a 90% interval spanning 8.6 to 12.9, which is why
        this is driven by what was measured rather than by how old she is.
        None of this identifies an injury or a condition.
      </Text>
    </View>
  )
}

function Fact({ label, value }: { label: string; value: string }) {
  return (
    <View style={s.fact}>
      <Text style={s.factVal}>{value}</Text>
      <Text style={s.factLabel}>{label}</Text>
    </View>
  )
}

const s = StyleSheet.create({
  wrap: {
    marginHorizontal: spacing.lg, marginTop: spacing.lg,
    borderRadius: radius.card, borderWidth: 1,
    borderColor: onImage.cardBorder, backgroundColor: onImage.card,
    padding: 15,
  },
  head: { flexDirection: 'row', alignItems: 'center', gap: 7 },
  headline: { marginTop: 9 },
  level: { fontSize: typeScale.title, fontWeight: weight.bold, letterSpacing: -0.4 },
  detail: {
    color: onImage.muted, fontSize: typeScale.caption, marginTop: 2,
    fontVariant: ['tabular-nums'],
  },
  facts: {
    flexDirection: 'row', gap: 22, marginTop: 13, paddingTop: 13,
    borderTopWidth: 1, borderTopColor: onImage.divider,
  },
  fact: {},
  factVal: {
    color: onImage.ink, fontSize: typeScale.body, fontWeight: weight.bold,
    fontVariant: ['tabular-nums'],
  },
  factLabel: {
    color: onImage.dim, fontSize: typeScale.label, marginTop: 1,
    letterSpacing: 0.6, textTransform: 'uppercase', fontWeight: weight.medium,
  },
  line: { flexDirection: 'row', gap: 9, marginTop: 12, alignItems: 'flex-start' },
  bullet: { width: 5, height: 5, borderRadius: radius.hair, marginTop: 6 },
  lineText: { flex: 1, color: onImage.muted, fontSize: typeScale.caption, lineHeight: 19 },
  stale: {
    flexDirection: 'row', gap: 8, alignItems: 'flex-start',
    marginTop: 14, padding: 10, borderRadius: radius.chip, borderWidth: 1,
  },
  staleText: { flex: 1, fontSize: typeScale.caption, lineHeight: 17 },
  source: {
    color: onImage.dim, fontSize: typeScale.label, lineHeight: 16,
    marginTop: 16, paddingTop: 12,
    borderTopWidth: 1, borderTopColor: onImage.divider,
  },
})
