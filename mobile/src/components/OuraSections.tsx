// ═══════════════════════════════════════════════════════════════════════
// OURA-STYLE HOME SECTIONS — native port of the web athlete home redesign
// (frontend AthleteDashboard.jsx, commit "Athlete home: Oura-style redesign")
//
//   MetricRail       horizontal rail of ring circles, one per logged metric
//   PerformanceHero  semicircular gauge running season-worst → PB
//   MiniTrendChart   last-8-points line chart; times plot inverted
//   DetailTrendCards race performance + richest metrics, each with a chart
//
// Geometry constants are kept identical to the web SVG so the two render the
// same shape: ring r=27, gauge r=88 across a 216×116 box, chart 340×124.
// ═══════════════════════════════════════════════════════════════════════

import React, { useMemo, useRef, useEffect } from 'react'
import { View, Text, ScrollView, Animated } from 'react-native'
import Svg, { Circle, Path, Line, Polyline, Text as SvgText } from 'react-native-svg'
import { Ionicons } from '@expo/vector-icons'
import { useTheme } from '../contexts/ThemeContext'
import { Tappable } from './ui'
import { spacing, radius, rhythm, numerals } from '../lib/theme'
import { DURATION, EASE, STAGGER_STEP, useReducedMotion } from '../lib/motion'
import {
  groupMetrics, fmtMetricValue, timeAgo, formatMark,
  LOWER_IS_BETTER, NO_PB, type MetricRow,
} from '../lib/metricSemantics'

// The web hardcodes these two in the SVGs; they are brand constants.
const INDIGO = '#4F3CF0'
const INDIGO_BRIGHT = '#8B83FF'


// react-native-svg accepts Animated values on stroke props, but only with
// useNativeDriver:false — these are JS-driven properties, not transforms.
const AnimatedCircle = Animated.createAnimatedComponent(Circle)
const AnimatedPath = Animated.createAnimatedComponent(Path)

/**
 * Drives a 0→1 progress value once on mount (and whenever `to` changes).
 * Returns the final value immediately under Reduce Motion.
 */
function useSweep(to: number, delay = 0) {
  const reduced = useReducedMotion()
  const anim = useRef(new Animated.Value(0)).current
  useEffect(() => {
    if (reduced) { anim.setValue(1); return }
    anim.setValue(0)
    const a = Animated.timing(anim, {
      toValue: 1, duration: DURATION.slow, delay,
      easing: EASE.sweep, useNativeDriver: false,
    })
    a.start()
    return () => a.stop()
  }, [reduced, to, delay])
  return anim
}

export interface HomeView {
  discipline: string | null
  pb: number | null
  isThrows: boolean
  /** Most recent race: { value, date, competition? } */
  lastRace: { value: number; date?: string | null; competition?: string | null } | null
  /** All race values, newest first — used for the gauge's "worst" anchor. */
  sortedDesc: { value: number }[]
  /** Chronological points for the trend chart: { date, value } */
  chartData: { date: string; value: number }[]
}

// ── Metric rail ────────────────────────────────────────────────────
// Ring fill = where the latest reading sits within that metric's own
// historical range. A full ring plus ★ means the latest reading is the PB.
export function MetricRail({ metrics }: { metrics: MetricRow[] }) {
  const { colors } = useTheme()
  const groups = useMemo(() => groupMetrics(metrics), [metrics])
  if (!groups.length) return null

  return (
    <ScrollView
      horizontal
      showsHorizontalScrollIndicator={false}
      contentContainerStyle={{ gap: 14, paddingHorizontal: spacing.lg, paddingBottom: 4 }}
      style={{ marginHorizontal: -spacing.lg, marginBottom: rhythm.section }}
    >
      {groups.slice(0, 12).map((g, i) => {
        const noPb = NO_PB.has(g.key)
        const lowerBetter = LOWER_IS_BETTER.has(g.key)
        const latest = Number(g.latest.value)
        const vals = g.history.map((r) => Number(r.value)).filter(Number.isFinite)
        const best = lowerBetter ? Math.min(...vals) : Math.max(...vals)
        const worst = lowerBetter ? Math.max(...vals) : Math.min(...vals)
        const span = Math.abs(best - worst)
        const frac = noPb || span === 0 ? 1 : Math.abs(latest - worst) / span
        const isPb = !noPb && g.history.length > 1 && latest === best
        // Minimum 4% so a metric at its own worst still shows a visible arc.
        const shown = Math.max(0.04, frac)

        return (
          <RailRing
            key={g.key}
            g={g}
            latest={latest}
            shown={shown}
            isPb={isPb}
            index={i}
          />
        )
      })}
    </ScrollView>
  )
}

// One rail circle. Split out so each ring can own its own sweep animation.
function RailRing({ g, latest, shown, isPb, index }: any) {
  const { colors } = useTheme()
  const R = 27
  const C = 2 * Math.PI * R
  const sweep = useSweep(shown, index * STAGGER_STEP)
  const offset = sweep.interpolate({
    inputRange: [0, 1],
    outputRange: [C, C * (1 - shown)],
  })

  return (
          <View
            accessible
            accessibilityLabel={`${g.label || g.key}: ${fmtMetricValue(latest)} ${g.unit || ''}${isPb ? ', personal best' : ''}`}
            style={{ width: 72, alignItems: 'center', gap: 6 }}
          >
            <View style={{ width: 64, height: 64 }}>
              {/* -90° rotation starts the arc at 12 o'clock, as on web. */}
              <Svg width={64} height={64} viewBox="0 0 64 64" style={{ transform: [{ rotate: '-90deg' }] }}>
                <Circle cx={32} cy={32} r={R} fill="none" stroke={colors.glass.divider} strokeWidth={3} />
                <AnimatedCircle
                  cx={32} cy={32} r={R} fill="none"
                  stroke={isPb ? INDIGO_BRIGHT : INDIGO}
                  strokeWidth={3} strokeLinecap="round"
                  strokeDasharray={`${C}`} strokeDashoffset={offset}
                />
              </Svg>
              <View style={{
                position: 'absolute', left: 0, right: 0, top: 0, bottom: 0,
                alignItems: 'center', justifyContent: 'center',
              }}>
                <Text style={{ fontSize: 13, fontWeight: '500', color: colors.text.primary, ...numerals }}>
                  {fmtMetricValue(latest)}
                </Text>
                {!!g.unit && (
                  <Text style={{ fontSize: 8, color: colors.text.muted, marginTop: 1 }}>{g.unit}</Text>
                )}
              </View>
            </View>
            <Text numberOfLines={2} style={{
              fontSize: 10.5, fontWeight: '500', color: colors.text.secondary,
              textAlign: 'center', lineHeight: 13,
            }}>
              {g.label || g.key}{isPb ? <Text style={{ color: INDIGO }}> ★</Text> : null}
            </Text>
          </View>
  )
}

// ── Performance hero ───────────────────────────────────────────────
// The guard lives in this wrapper so the inner component's hooks always run.
// `useSweep` used to sit after an early return, which meant the hook count
// changed the moment race data arrived — React throws on that.
export function PerformanceHero({ view }: { view: HomeView }) {
  const last = view?.lastRace
  if (!last || last.value == null || view.pb == null) return null
  return <PerformanceHeroInner view={view} last={last} />
}

function PerformanceHeroInner({
  view, last,
}: { view: HomeView; last: NonNullable<HomeView['lastRace']> }) {
  const { colors } = useTheme()
  const { pb, isThrows } = view
  const value = Number(last.value)
  const isPb = value === pb
  const vals = (view.sortedDesc || []).map((r) => Number(r.value)).filter(Number.isFinite)
  const worst = vals.length ? (isThrows ? Math.min(...vals) : Math.max(...vals)) : value
  const span = Math.abs(worst - (pb as number))
  const frac = span > 0 ? Math.min(1, Math.abs(worst - value) / span) : 1

  const L = Math.PI * 88

  // The arc sweeps from the season-worst end to the athlete's mark. Snapping
  // straight to the value throws away the one moment that tells the story.
  const sweep = useSweep(frac)
  const dashOffset = sweep.interpolate({ inputRange: [0, 1], outputRange: [L, L * (1 - frac)] })
  // The dot rides the arc rather than appearing at the end, so the eye follows
  // the travel. Sampled along the same circle the path describes.
  const SAMPLES = 24
  const dotX = sweep.interpolate({
    inputRange: Array.from({ length: SAMPLES + 1 }, (_, i) => i / SAMPLES),
    outputRange: Array.from({ length: SAMPLES + 1 },
      (_, i) => 108 + 88 * Math.cos(Math.PI * (1 - (i / SAMPLES) * frac))),
  })
  const dotY = sweep.interpolate({
    inputRange: Array.from({ length: SAMPLES + 1 }, (_, i) => i / SAMPLES),
    outputRange: Array.from({ length: SAMPLES + 1 },
      (_, i) => 106 - 88 * Math.sin(Math.PI * (1 - (i / SAMPLES) * frac))),
  })

  const dateStr = last.date
    ? new Date(last.date).toLocaleDateString('en-GB', { weekday: 'short', day: 'numeric', month: 'short' })
    : ''
  const caption = [last.competition, dateStr].filter(Boolean).join(' · ')

  const delta = isPb
    ? 'New personal best!'
    : isThrows
      ? `${(pb - value).toFixed(2)}m off your best`
      : `${(value - pb).toFixed(2)} off your best`

  return (
    // Full-bleed and out of the card system entirely: one focal point per
    // screen is the whole trick, and the gauge can't be it while it sits in
    // the same column as everything else.
    <View style={{
      alignItems: 'center',
      paddingTop: rhythm.major, paddingBottom: rhythm.block,
      marginHorizontal: -spacing.lg, paddingHorizontal: spacing.lg,
      marginBottom: rhythm.section,
      backgroundColor: colors.glass.overlay,
    }}>
      <View style={{ width: 216, height: 116 }}>
        <Svg width={216} height={124} viewBox="0 0 216 124">
          <Path d="M 20 106 A 88 88 0 0 1 196 106" fill="none"
            stroke={colors.glass.divider} strokeWidth={4.5} strokeLinecap="round" />
          <AnimatedPath d="M 20 106 A 88 88 0 0 1 196 106" fill="none"
            stroke={INDIGO} strokeWidth={4.5} strokeLinecap="round"
            strokeDasharray={`${L}`} strokeDashoffset={dashOffset} />
          <AnimatedCircle cx={dotX} cy={dotY} r={5.5} fill={INDIGO} />
          <AnimatedCircle cx={dotX} cy={dotY} r={9} fill="none" stroke={INDIGO} strokeOpacity={0.3} strokeWidth={1.5} />
          <SvgText x={20} y={118} textAnchor="middle" fontSize={10} fill={colors.text.muted}>
            {formatMark(worst, view.discipline)}
          </SvgText>
          <SvgText x={196} y={118} textAnchor="middle" fontSize={10} fill={colors.text.muted}>
            {`PB ${formatMark(pb, view.discipline)}`}
          </SvgText>
        </Svg>
      </View>

      <View style={{
        width: 36, height: 36, borderRadius: 18, marginTop: -16,
        backgroundColor: colors.glass.overlay,
        alignItems: 'center', justifyContent: 'center',
      }}>
        <Ionicons name="flash" size={16} color={INDIGO} />
      </View>

      <Text style={{
        fontSize: 10, letterSpacing: 2.2, textTransform: 'uppercase',
        color: colors.text.muted, fontWeight: '600', marginTop: spacing.lg,
      }}>
        Latest performance{view.discipline ? ` · ${view.discipline}` : ''}
      </Text>

      <Text style={{
        fontSize: 54, lineHeight: 60, fontWeight: '600',
        letterSpacing: -1.6, color: colors.text.primary, ...numerals,
      }}>
        {formatMark(value, view.discipline)}
      </Text>

      {/* Web sets this line in a serif face for contrast against the numerals. */}
      <Text style={{ fontSize: 23, color: colors.text.primary, fontFamily: 'Georgia', textAlign: 'center' }}>
        {delta}
      </Text>

      {!!caption && (
        <Text style={{ fontSize: 14, color: colors.text.secondary, marginTop: 4, textAlign: 'center' }}>
          {caption}
        </Text>
      )}
    </View>
  )
}

// ── Mini trend chart ───────────────────────────────────────────────
// invert=true (times): faster values plot HIGHER, per Keenan's chart rule.
export function MiniTrendChart({
  points, invert, pbValue, valueFmt = fmtMetricValue,
}: {
  points: { t: string; v: number }[]
  invert?: boolean
  pbValue?: number | null
  valueFmt?: (v: number | string) => string
}) {
  const { colors } = useTheme()
  const pts = (points || []).slice(-8)
  if (pts.length < 2) return null

  const W = 340, H = 124, padL = 10, padR = 36, padT = 14, padB = 24
  const vs = pts.map((p) => p.v)
  let lo = Math.min(...vs, pbValue != null ? pbValue : Infinity)
  let hi = Math.max(...vs, pbValue != null ? pbValue : -Infinity)
  if (hi === lo) { hi += 1; lo -= 1 }
  const range = hi - lo
  lo -= range * 0.12; hi += range * 0.12

  const X = (i: number) => padL + (i / (pts.length - 1)) * (W - padL - padR)
  const Y = (v: number) => {
    const f = (v - lo) / (hi - lo)
    return invert ? padT + f * (H - padT - padB) : padT + (1 - f) * (H - padT - padB)
  }
  const topVal = invert ? lo : hi
  const botVal = invert ? hi : lo
  const line = pts.map((p, i) => `${X(i)},${Y(p.v)}`).join(' ')
  const months = pts.map((p) => new Date(p.t).toLocaleDateString('en-GB', { month: 'short' }))

  return (
    <Svg width="100%" height={H} viewBox={`0 0 ${W} ${H}`}>
      {[0.15, 0.5, 0.85].map((f) => (
        <Line key={f}
          x1={padL} y1={padT + f * (H - padT - padB)}
          x2={W - padR} y2={padT + f * (H - padT - padB)}
          stroke={colors.glass.divider} strokeWidth={1} />
      ))}
      <SvgText x={W - padR + 6} y={padT + 4} fontSize={9} fill={colors.text.muted}>{valueFmt(topVal)}</SvgText>
      <SvgText x={W - padR + 6} y={H - padB} fontSize={9} fill={colors.text.muted}>{valueFmt(botVal)}</SvgText>
      {pbValue != null && (
        <>
          <Line x1={padL} y1={Y(pbValue)} x2={W - padR} y2={Y(pbValue)}
            stroke={INDIGO} strokeOpacity={0.35} strokeWidth={1} strokeDasharray="3 4" />
          <SvgText x={W - padR + 6} y={Y(pbValue) + 3} fontSize={9} fill={INDIGO}>PB</SvgText>
        </>
      )}
      <Polyline points={line} fill="none" stroke={INDIGO} strokeWidth={2.5}
        strokeLinecap="round" strokeLinejoin="round" />
      {pts.map((p, i) => i < pts.length - 1 ? (
        <Circle key={i} cx={X(i)} cy={Y(p.v)} r={3.5} fill={INDIGO} />
      ) : (
        <Circle key={i} cx={X(i)} cy={Y(p.v)} r={4.5} fill={colors.bg.card} stroke={INDIGO} strokeWidth={2.5} />
      ))}
      <SvgText x={X(0)} y={H - 6} fontSize={9} fill={colors.text.muted} textAnchor="middle">{months[0]}</SvgText>
      <SvgText x={X(pts.length - 1)} y={H - 6} fontSize={9} fill={colors.text.muted} textAnchor="middle">
        {months[months.length - 1]}
      </SvgText>
    </Svg>
  )
}

// ── Detail trend cards ─────────────────────────────────────────────
function TrendCard({ icon, title, ago, bigValue, unit, chart, action, onLog }: any) {
  const { colors } = useTheme()
  return (
    <View style={{
      backgroundColor: colors.glass.bg, borderRadius: 20,
      borderWidth: 1, borderColor: colors.glass.border,
      padding: 22, marginBottom: rhythm.section,
    }}>
      <View style={{ flexDirection: 'row', alignItems: 'center', gap: 12 }}>
        <View style={{
          width: 36, height: 36, borderRadius: 18,
          backgroundColor: colors.glass.overlay,
          alignItems: 'center', justifyContent: 'center',
        }}>
          <Ionicons name={icon} size={16} color={INDIGO} />
        </View>
        <View style={{ flex: 1 }}>
          <Text numberOfLines={1} style={{ fontSize: 15, fontWeight: '600', color: colors.text.primary }}>
            {title}
          </Text>
          {!!ago && (
            <Text style={{
              fontSize: 10, letterSpacing: 1.2, textTransform: 'uppercase',
              fontWeight: '700', color: INDIGO, marginTop: 2,
            }}>{ago}</Text>
          )}
        </View>
      </View>

      <Text style={{
        fontSize: 30, fontWeight: '600', letterSpacing: -0.6,
        color: colors.text.primary, marginTop: 10, ...numerals,
      }}>
        {bigValue}
        {!!unit && <Text style={{ fontSize: 15, fontWeight: '500', color: colors.text.secondary }}> {unit}</Text>}
      </Text>

      <View style={{ marginTop: 4 }}>{chart}</View>

      {!!action && (
        <Tappable
          onPress={onLog}
          accessibilityLabel={action}
          style={{
            marginTop: spacing.lg,
            // 44pt minimum touch target (Apple HIG) — 11pt padding gave ~40.
            minHeight: 44, justifyContent: 'center',
            borderRadius: radius.lg,
            backgroundColor: colors.bg.primary,
            borderWidth: 1, borderColor: colors.glass.border,
            alignItems: 'center',
          }}
        >
          <Text style={{ fontSize: 13, fontWeight: '600', color: colors.text.secondary }}>{action}</Text>
        </Tappable>
      )}
    </View>
  )
}

/**
 * The trend chart for the athlete's ACTIVE discipline — one card, on Home.
 *
 * This used to render up to four near-identical ~330pt cards in a row, which
 * consumed the first three screens on its own and pushed every diagnostic
 * feature past the point anyone scrolls. The per-metric trends now live on
 * Trajectory as <MetricTrendCards/>.
 */
export function RaceTrendCard({
  view, onLog,
}: { view: HomeView; onLog?: () => void }) {
  const racePts = (view?.chartData || [])
    .map((d) => ({ t: d.date, v: Number(d.value) }))
    .filter((p) => Number.isFinite(p.v))

  if (racePts.length < 2) return null

  return (
    <TrendCard
      icon="flash"
      title={`${view.discipline || 'Performance'} progression`}
      ago={timeAgo(view.lastRace?.date)}
      bigValue={formatMark(Number(view.lastRace?.value), view.discipline)}
      chart={
        <MiniTrendChart
          points={racePts}
          invert={!view.isThrows}
          pbValue={view.pb}
          valueFmt={(v) => Number(v).toFixed(2)}
        />
      }
      action="Log a race result"
      onLog={onLog}
    />
  )
}

/** Per-metric trend charts. Belongs on Trajectory, not the daily screen. */
export function MetricTrendCards({
  metrics, limit = 6, onLog,
}: { metrics: MetricRow[]; limit?: number; onLog?: () => void }) {
  const groups = useMemo(
    () => groupMetrics(metrics).filter((g) => g.history.length >= 2 && !NO_PB.has(g.key)),
    [metrics]
  )
  if (!groups.length) return null

  return (
    <View>
      {groups.slice(0, limit).map((g) => (
        <TrendCard
          key={g.key}
          icon="pulse"
          title={g.label || g.key}
          ago={timeAgo(g.latest.recorded_at)}
          bigValue={fmtMetricValue(g.latest.value)}
          unit={g.unit}
          chart={
            <MiniTrendChart
              points={g.history
                .map((r) => ({ t: r.recorded_at, v: Number(r.value) }))
                .filter((p) => Number.isFinite(p.v))}
              invert={LOWER_IS_BETTER.has(g.key)}
              pbValue={Number(g.best.value)}
            />
          }
          action={`Log ${(g.label || 'a test').toLowerCase()}`}
          onLog={onLog}
        />
      ))}
    </View>
  )
}
