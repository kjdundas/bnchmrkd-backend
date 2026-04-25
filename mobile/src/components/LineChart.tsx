// ═══════════════════════════════════════════════════════════════════════
// Mini SVG Line Chart — lightweight chart for metric trajectories
// Renders a smooth polyline with gradient fill, PB markers, and axis
// ═══════════════════════════════════════════════════════════════════════

import React from 'react'
import { View, Text, StyleSheet, Dimensions } from 'react-native'
import Svg, {
  Polyline,
  Circle,
  Line,
  Defs,
  LinearGradient as SvgLinearGradient,
  Stop,
  Polygon,
  Text as SvgText,
} from 'react-native-svg'
import { colors, spacing } from '../lib/theme'

const { width: SCREEN_W } = Dimensions.get('window')

interface DataPoint {
  value: number
  date: string
  isPB?: boolean
}

interface LineChartProps {
  data: DataPoint[]
  color?: string
  height?: number
  width?: number
  showArea?: boolean
  showDots?: boolean
  showPBs?: boolean
  showYAxis?: boolean
  unit?: string
  lowerIsBetter?: boolean
}

export default function LineChart({
  data,
  color = colors.orange[500],
  height = 120,
  width: chartWidth,
  showArea = true,
  showDots = true,
  showPBs = true,
  showYAxis = false,
  unit = '',
  lowerIsBetter = false,
}: LineChartProps) {
  if (data.length < 2) {
    return (
      <View style={[styles.container, { height }]}>
        <Text style={styles.noData}>Need 2+ data points</Text>
      </View>
    )
  }

  const W = chartWidth || SCREEN_W - 64
  const H = height
  const PAD_X = showYAxis ? 40 : 16
  const PAD_Y = 16
  const PLOT_W = W - PAD_X * 2
  const PLOT_H = H - PAD_Y * 2

  const values = data.map((d) => d.value)
  const min = Math.min(...values)
  const max = Math.max(...values)
  const range = max - min || 1

  const getX = (i: number) => PAD_X + (i / (data.length - 1)) * PLOT_W
  const getY = (v: number) => PAD_Y + PLOT_H - ((v - min) / range) * PLOT_H

  const points = data.map((d, i) => `${getX(i)},${getY(d.value)}`).join(' ')

  // Area polygon: line points + bottom corners
  const areaPoints = [
    `${PAD_X},${PAD_Y + PLOT_H}`,
    ...data.map((d, i) => `${getX(i)},${getY(d.value)}`),
    `${getX(data.length - 1)},${PAD_Y + PLOT_H}`,
  ].join(' ')

  // Find PBs
  let runningBest = data[0].value
  const pbIndices: number[] = [0]
  for (let i = 1; i < data.length; i++) {
    const isBetter = lowerIsBetter
      ? data[i].value < runningBest
      : data[i].value > runningBest
    if (isBetter) {
      runningBest = data[i].value
      pbIndices.push(i)
    }
  }

  return (
    <View style={[styles.container, { height: H, width: W }]}>
      <Svg width={W} height={H}>
        <Defs>
          <SvgLinearGradient id="areaGrad" x1="0" y1="0" x2="0" y2="1">
            <Stop offset="0" stopColor={color} stopOpacity="0.25" />
            <Stop offset="1" stopColor={color} stopOpacity="0.02" />
          </SvgLinearGradient>
        </Defs>

        {/* Horizontal grid lines */}
        {[0.25, 0.5, 0.75].map((pct) => (
          <Line
            key={pct}
            x1={PAD_X}
            y1={PAD_Y + PLOT_H * (1 - pct)}
            x2={W - PAD_X}
            y2={PAD_Y + PLOT_H * (1 - pct)}
            stroke="rgba(255,255,255,0.04)"
            strokeWidth={1}
          />
        ))}

        {/* Area fill */}
        {showArea && (
          <Polygon points={areaPoints} fill="url(#areaGrad)" />
        )}

        {/* Line */}
        <Polyline
          points={points}
          fill="none"
          stroke={color}
          strokeWidth={2.5}
          strokeLinecap="round"
          strokeLinejoin="round"
        />

        {/* Dots */}
        {showDots &&
          data.map((d, i) => (
            <Circle
              key={i}
              cx={getX(i)}
              cy={getY(d.value)}
              r={3}
              fill={color}
              stroke="#0a0a0f"
              strokeWidth={1.5}
            />
          ))}

        {/* PB markers */}
        {showPBs &&
          pbIndices.map((i) => (
            <React.Fragment key={`pb_${i}`}>
              <Circle
                cx={getX(i)}
                cy={getY(data[i].value)}
                r={6}
                fill="none"
                stroke={colors.green}
                strokeWidth={2}
              />
              <SvgText
                x={getX(i)}
                y={getY(data[i].value) - 10}
                fontSize={8}
                fontWeight="700"
                fill={colors.green}
                textAnchor="middle"
              >
                PB
              </SvgText>
            </React.Fragment>
          ))}

        {/* Y-axis labels */}
        {showYAxis && (
          <>
            <SvgText
              x={8}
              y={PAD_Y + 4}
              fontSize={9}
              fill={colors.text.dimmed}
            >
              {max.toFixed(max > 100 ? 0 : 2)}
            </SvgText>
            <SvgText
              x={8}
              y={PAD_Y + PLOT_H}
              fontSize={9}
              fill={colors.text.dimmed}
            >
              {min.toFixed(min > 100 ? 0 : 2)}
            </SvgText>
          </>
        )}
      </Svg>

      {/* X-axis date labels */}
      <View style={[styles.xAxis, { width: W, paddingHorizontal: PAD_X }]}>
        <Text style={styles.dateLabel}>
          {formatDate(data[0].date)}
        </Text>
        <Text style={styles.dateLabel}>
          {formatDate(data[data.length - 1].date)}
        </Text>
      </View>
    </View>
  )
}

function formatDate(iso: string): string {
  try {
    const d = new Date(iso)
    return d.toLocaleDateString('en-GB', { day: 'numeric', month: 'short' })
  } catch {
    return iso
  }
}

const styles = StyleSheet.create({
  container: { alignItems: 'center' },
  noData: { color: colors.text.muted, fontSize: 12, textAlign: 'center', marginTop: 40 },
  xAxis: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginTop: 4,
  },
  dateLabel: { color: colors.text.dimmed, fontSize: 9, letterSpacing: 0.5 },
})
