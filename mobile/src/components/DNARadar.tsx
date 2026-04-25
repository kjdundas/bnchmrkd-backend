// ═══════════════════════════════════════════════════════════════════════
// DNA Hexagon Radar — the 6-axis physical profile visualization
// Draws a SVG hexagon with animated fill representing:
// Acceleration, Top Speed, Power, Strength, Mobility, Conditioning
// ═══════════════════════════════════════════════════════════════════════

import React, { useEffect, useRef } from 'react'
import { View, Text, StyleSheet, Animated, Dimensions } from 'react-native'
import Svg, { Polygon, Line, Circle, Text as SvgText } from 'react-native-svg'
import { colors, spacing, radius, fonts } from '../lib/theme'
import { TierBadge } from './ui'

const { width: SCREEN_W } = Dimensions.get('window')
const SIZE = Math.min(SCREEN_W - 64, 280)
const CX = SIZE / 2
const CY = SIZE / 2
const RADIUS = SIZE * 0.38

interface DNAAxis {
  key: string
  label: string
  score: number | null
  tier?: { label: string; color: string }
}

interface DNARadarProps {
  axes: DNAAxis[]
  overallScore?: number
  overallTier?: { label: string; color: string }
}

// Get hex point coordinates
function getPoint(index: number, value: number, total: number = 6): [number, number] {
  const angle = (Math.PI * 2 * index) / total - Math.PI / 2
  const r = (value / 100) * RADIUS
  return [CX + r * Math.cos(angle), CY + r * Math.sin(angle)]
}

export default function DNARadar({ axes, overallScore, overallTier }: DNARadarProps) {
  const validAxes = axes.filter((a) => a.score !== null && a.score !== undefined)

  if (validAxes.length < 3) {
    return (
      <View style={styles.container}>
        <View style={styles.emptyRadar}>
          <Text style={styles.emptyTitle}>Physical DNA</Text>
          <Text style={styles.emptyText}>
            Log at least 3 axis metrics to unlock your DNA profile
          </Text>
          <View style={styles.axisHints}>
            {axes.map((a) => (
              <View key={a.key} style={styles.axisHint}>
                <View
                  style={[
                    styles.hintDot,
                    { backgroundColor: a.score != null ? colors.green : colors.text.dimmed },
                  ]}
                />
                <Text
                  style={[
                    styles.hintLabel,
                    a.score != null && { color: colors.text.primary },
                  ]}
                >
                  {a.label}
                </Text>
              </View>
            ))}
          </View>
        </View>
      </View>
    )
  }

  // Build polygon points for the data shape
  const dataPoints = axes
    .map((a, i) => getPoint(i, a.score || 0))
    .map(([x, y]) => `${x},${y}`)
    .join(' ')

  // Grid rings at 20, 40, 60, 80, 100
  const rings = [20, 40, 60, 80, 100]

  return (
    <View style={styles.container}>
      {/* Overall score + tier */}
      {overallScore != null && (
        <View style={styles.overallRow}>
          <Text style={styles.overallScore}>{overallScore}</Text>
          {overallTier && <TierBadge label={overallTier.label} color={overallTier.color} />}
        </View>
      )}

      {/* SVG Radar */}
      <View style={styles.svgWrap}>
        <Svg width={SIZE} height={SIZE}>
          {/* Grid rings */}
          {rings.map((ring) => {
            const pts = Array.from({ length: 6 }, (_, i) => getPoint(i, ring))
              .map(([x, y]) => `${x},${y}`)
              .join(' ')
            return (
              <Polygon
                key={ring}
                points={pts}
                fill="none"
                stroke="rgba(255,255,255,0.06)"
                strokeWidth={1}
              />
            )
          })}

          {/* Axis lines from center */}
          {axes.map((_, i) => {
            const [x, y] = getPoint(i, 100)
            return (
              <Line
                key={i}
                x1={CX}
                y1={CY}
                x2={x}
                y2={y}
                stroke="rgba(255,255,255,0.04)"
                strokeWidth={1}
              />
            )
          })}

          {/* Data polygon — orange gradient fill */}
          <Polygon
            points={dataPoints}
            fill={colors.orange[500] + '25'}
            stroke={colors.orange[500]}
            strokeWidth={2}
          />

          {/* Data points as dots */}
          {axes.map((a, i) => {
            if (a.score == null) return null
            const [x, y] = getPoint(i, a.score)
            return (
              <Circle
                key={a.key}
                cx={x}
                cy={y}
                r={4}
                fill={a.tier?.color || colors.orange[500]}
                stroke="#0a0a0f"
                strokeWidth={2}
              />
            )
          })}

          {/* Axis labels */}
          {axes.map((a, i) => {
            const [x, y] = getPoint(i, 120)
            return (
              <SvgText
                key={a.key + '_label'}
                x={x}
                y={y}
                fontSize={9}
                fontWeight="600"
                fill={a.score != null ? colors.text.secondary : colors.text.dimmed}
                textAnchor="middle"
                alignmentBaseline="middle"
              >
                {a.label}
              </SvgText>
            )
          })}
        </Svg>
      </View>

      {/* Axis score list below radar */}
      <View style={styles.axisList}>
        {axes.map((a) => (
          <View key={a.key} style={styles.axisRow}>
            <View style={styles.axisLabelRow}>
              <View
                style={[
                  styles.axisDot,
                  { backgroundColor: a.tier?.color || colors.text.dimmed },
                ]}
              />
              <Text style={styles.axisLabel}>{a.label}</Text>
            </View>
            {a.score != null ? (
              <View style={styles.axisScoreRow}>
                <Text style={[styles.axisScore, { color: a.tier?.color || colors.text.primary }]}>
                  {a.score}
                </Text>
                {a.tier && (
                  <Text style={[styles.axisTierLabel, { color: a.tier.color }]}>
                    {a.tier.label}
                  </Text>
                )}
              </View>
            ) : (
              <Text style={styles.axisNoData}>—</Text>
            )}
          </View>
        ))}
      </View>
    </View>
  )
}

const styles = StyleSheet.create({
  container: { alignItems: 'center' },

  overallRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    marginBottom: spacing.md,
  },
  overallScore: {
    fontSize: 36,
    fontWeight: '700',
    color: colors.text.primary,
  },

  svgWrap: {
    alignItems: 'center',
    justifyContent: 'center',
    marginVertical: spacing.sm,
  },

  axisList: {
    width: '100%',
    marginTop: spacing.md,
    gap: 6,
  },
  axisRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingVertical: 6,
    paddingHorizontal: spacing.sm,
    borderBottomWidth: 1,
    borderBottomColor: 'rgba(255,255,255,0.03)',
  },
  axisLabelRow: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  axisDot: { width: 8, height: 8, borderRadius: 4 },
  axisLabel: { color: colors.text.secondary, fontSize: 13, fontWeight: '500' },
  axisScoreRow: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  axisScore: { fontSize: 16, fontWeight: '700' },
  axisTierLabel: { fontSize: 10, fontWeight: '600', textTransform: 'uppercase', letterSpacing: 0.5 },
  axisNoData: { color: colors.text.dimmed, fontSize: 14 },

  // Empty state
  emptyRadar: { alignItems: 'center', paddingVertical: spacing.xl },
  emptyTitle: { fontSize: 16, fontWeight: '700', color: colors.text.primary, marginBottom: 6 },
  emptyText: { color: colors.text.secondary, fontSize: 13, textAlign: 'center', marginBottom: spacing.lg },
  axisHints: { gap: 6, width: '100%' },
  axisHint: { flexDirection: 'row', alignItems: 'center', gap: 8, paddingVertical: 4 },
  hintDot: { width: 6, height: 6, borderRadius: 3 },
  hintLabel: { color: colors.text.muted, fontSize: 13 },
})
