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

import React, { useMemo, useRef, useEffect, useState } from 'react'
import { View, Text, ScrollView, Animated, StyleSheet, useWindowDimensions } from 'react-native'
import { Image as ExpoImage } from 'expo-image'
import { LinearGradient as Gradient } from 'expo-linear-gradient'
import { BlurView } from 'expo-blur'
import Svg, { Circle, Path, Line, Polyline, Text as SvgText, Defs, LinearGradient, Stop, RadialGradient } from 'react-native-svg'
import { Ionicons } from '@expo/vector-icons'
import { useTheme } from '../contexts/ThemeContext'
import { Tappable, GlassPanel } from './ui'
import RaceStrip from './RaceStrip'
import TierGauge from './TierGauge'
import TrendDetailSheet, { raceVerdicts, verdictTone, type Verdict } from './TrendDetailSheet'
import MetricScienceBlock from './MetricScienceBlock'

/** Everything the gauge needs about where the athlete currently stands. */
export interface TierBand {
  currentCut: number
  nextCut: number | null
  tierName: string
  nextTierName: string | null
  color: string
  atTop: boolean
  floorIsSynthetic: boolean
}
import DisciplineToggle from './DisciplineToggle'
import { spacing, radius, rhythm, numerals, elevation, onDark, onImage } from '../lib/theme'
import { DURATION, EASE, STAGGER_STEP, useReducedMotion } from '../lib/motion'
import {
  groupMetrics, ringModel, fmtMetricValue, timeAgo, formatMark,
  LOWER_IS_BETTER, NO_PB, type MetricRow,
} from '../lib/metricSemantics'
import { applyIndicatorOrder, MAX_INDICATORS } from '../lib/indicators'

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
export function MetricRail({
  metrics, onDarkSurface, withLightPool, order, onCustomise, discipline,
}: {
  metrics: MetricRow[]
  onDarkSurface?: boolean
  withLightPool?: boolean
  /** The athlete's chosen indicators. Empty = automatic order. */
  order?: string[]
  /** Long-press handler; receives the key of the ring that was held. */
  onCustomise?: (key: string) => void
  /** Used to say why each measure matters for THIS athlete's event. */
  discipline?: string | null
}) {
  const { colors } = useTheme()
  // The athlete's order wins where they have set one. `applyIndicatorOrder`
  // returns the automatic grouping untouched when the list is empty, so the
  // rail behaves exactly as it did before anyone opened the picker.
  const groups = useMemo(
    () => applyIndicatorOrder(groupMetrics(metrics), order || []),
    [metrics, order],
  )

  // Tap opens the metric's history; long-press opens the picker. Two gestures
  // on the same ring, which is why the sheet is owned here rather than by each
  // ring — one sheet, whichever ring was tapped.
  const [openKey, setOpenKey] = useState<string | null>(null)
  const open = openKey ? groups.find((g) => g.key === openKey) : null

  if (!groups.length) return null

  // Vertical breathing room for the pools' falloff.
  //
  // Each pool is a 150pt circle hung 39pt ABOVE its ring — and a ScrollView
  // clips to its own bounds. With no vertical padding every pool was sliced at
  // the same y, which is why the shade ended in a dead-straight seam running
  // the full width of the rail. The gradient was already soft; it was simply
  // being cut off before it could fade.
  const PAD = 44
  const base = onDarkSurface ? spacing.md : rhythm.section

  return (
    <View
      pointerEvents="box-none"
      style={{
        position: 'relative',
        marginHorizontal: -spacing.lg,
        // Reclaim most of the padding so the rail occupies roughly the space
        // it did before. Not all of it: the rail now leads the feed directly
        // under the greeting, and pulling back the full 44 put the pools'
        // shade up behind the text.
        marginTop: withLightPool ? -(PAD - 18) : 0,
        marginBottom: withLightPool ? base - (PAD - 14) : base,
      }}
    >
      {/* A continuous band under the whole rail, fading to nothing top and
          bottom. The per-ring pools alone left the shade scalloped between
          circles; this gives them a ground to sit in, so what the eye reads is
          one soft strip of shade rather than nine discs on bare sky. */}
      {withLightPool && (
        <Gradient
          colors={[
            'rgba(11,13,34,0)',
            'rgba(11,13,34,0.11)',
            'rgba(11,13,34,0.16)',
            'rgba(11,13,34,0.11)',
            'rgba(11,13,34,0)',
          ]}
          locations={[0, 0.24, 0.5, 0.76, 1]}
          style={StyleSheet.absoluteFill}
          pointerEvents="none"
        />
      )}

    <ScrollView
      horizontal
      showsHorizontalScrollIndicator={false}
      contentContainerStyle={{
        gap: onDarkSurface ? 6 : 14,
        paddingHorizontal: spacing.lg,
        paddingTop: withLightPool ? PAD : 0,
        paddingBottom: withLightPool ? PAD : 4,
      }}
    >
      {groups.slice(0, MAX_INDICATORS).map((g, i) => {
        const { latest, shown, isPb } = ringModel(g)
        return (
          <RailRing
            key={g.key}
            g={g}
            latest={latest}
            shown={shown}
            isPb={isPb}
            index={i}
            onDarkSurface={onDarkSurface}
            withLightPool={withLightPool}
            onLongPress={onCustomise ? () => onCustomise(g.key) : undefined}
            onPress={() => setOpenKey(g.key)}
          />
        )
      })}
    </ScrollView>

    {!!open && (
      <TrendDetailSheet
        visible
        onClose={() => setOpenKey(null)}
        title={open.label || open.key}
        noun="test"
        unit={open.unit || undefined}
        lowerIsBetter={LOWER_IS_BETTER.has(open.key)}
        valueFmt={(v) => fmtMetricValue(v)}
        points={open.history
          .map((r) => ({ t: r.recorded_at, v: Number(r.value) }))
          .filter((p) => Number.isFinite(p.v))}
        science={<MetricScienceBlock metricKey={open.key} discipline={discipline} />}
      />
    )}
    </View>
  )
}

// One rail circle. Split out so each ring can own its own sweep animation.
function RailRing({ g, latest, shown, isPb, index, onDarkSurface, withLightPool, onLongPress, onPress }: any) {
  const { colors } = useTheme()
  const R = 27
  const C = 2 * Math.PI * R
  const sweep = useSweep(shown, index * STAGGER_STEP)
  const offset = sweep.interpolate({
    inputRange: [0, 1],
    outputRange: [C, C * (1 - shown)],
  })

  // SVG gradient ids are document-global, so they must be unique per ring.
  const uid = String(g.key).replace(/[^a-zA-Z0-9]/g, '')
  const arcId = `arc_${uid}`
  const bloomId = `bloom_${uid}`
  const poolId = `pool_${uid}`

  // Depth here comes from LIGHT, not bevels: a radial bloom behind the ring, a
  // gradient along the arc, and a bright cap where it ends. All of which only
  // read on a dark ground — on light paper a glow is just a smudge.
  const arcFrom = isPb ? '#A8A2FF' : '#4F3CF0'
  const arcTo = isPb ? '#FFFFFF' : '#A8A2FF'
  const track = onDarkSurface ? 'rgba(255,255,255,0.13)' : colors.glass.divider
  const valueColor = onDarkSurface ? onDark.ink : colors.text.primary
  // Measured off a device screenshot: onDark.dim (38% white) put the unit at
  // 2.42:1 against the stands behind it and onDark.muted (62%) put the label
  // at 2.79:1. WCAG wants 4.5:1. Both raised to clear it.
  const unitColor = onDarkSurface ? 'rgba(255,255,255,0.82)' : colors.text.muted
  const labelColor = onDarkSurface ? 'rgba(255,255,255,0.94)' : colors.text.secondary

  // Alpha alone isn't enough over a photograph. A mean contrast of 2.4:1
  // hides the places where a bright seat back sits directly behind a glyph
  // and the local ratio is near 1:1. A shadow is the standard answer for type
  // over imagery: it travels with the text, so it works wherever the glyph
  // lands, which a background scrim can't do without hiding the picture.
  const shadow = onDarkSurface
    ? {
        textShadowColor: 'rgba(6,7,16,0.85)',
        textShadowOffset: { width: 0, height: 1 },
        textShadowRadius: 4,
      }
    : null

  const a11y = `${g.label || g.key}: ${fmtMetricValue(latest)} ${g.unit || ''}${isPb ? ', personal best' : ''}${onPress ? '. Tap for history and why it matters' : ''}${onLongPress ? '. Long press to choose which indicators appear' : ''}`

  const body = (
          <View style={{ width: 72, alignItems: 'center', gap: 6 }}>
            <View style={{ width: 72, height: 72 }}>
              {/* -90° rotation starts the arc at 12 o'clock, as on web. */}
              {/* Pool of shade under the ring. Radius is ~1.9x the ring and the
                  falloff is long and smooth — a tight or hard-edged version
                  reads as a thumbprint smudged on the sky, which is exactly
                  what this treatment has to avoid. */}
              {withLightPool && (
                <Svg
                  width={150} height={150}
                  style={{ position: 'absolute', top: -39, left: -39 }}
                  pointerEvents="none"
                >
                  <Defs>
                    {/* Five stops, not four, and a lower peak now that the
                        band underneath carries the base shade. A radial with
                        few stops steps rather than fades — the extra stop near
                        the tail is what removes the visible rim. */}
                    <RadialGradient id={poolId} cx="50%" cy="50%" r="50%">
                      <Stop offset="0" stopColor="#0B0D22" stopOpacity="0.58" />
                      <Stop offset="0.30" stopColor="#0B0D22" stopOpacity="0.47" />
                      <Stop offset="0.55" stopColor="#0B0D22" stopOpacity="0.27" />
                      <Stop offset="0.78" stopColor="#0B0D22" stopOpacity="0.09" />
                      <Stop offset="1" stopColor="#0B0D22" stopOpacity="0" />
                    </RadialGradient>
                  </Defs>
                  <Circle cx={75} cy={75} r={75} fill={`url(#${poolId})`} />
                </Svg>
              )}
              <Svg width={72} height={72} viewBox="0 0 72 72" style={{ transform: [{ rotate: '-90deg' }] }}>
                <Defs>
                  <LinearGradient id={arcId} x1="0" y1="0" x2="1" y2="1">
                    <Stop offset="0" stopColor={arcFrom} />
                    <Stop offset="1" stopColor={arcTo} />
                  </LinearGradient>
                  <RadialGradient id={bloomId} cx="50%" cy="50%" r="50%">
                    <Stop offset="0.55" stopColor={arcTo} stopOpacity="0" />
                    <Stop offset="0.82" stopColor={arcTo} stopOpacity={onDarkSurface ? '0.30' : '0.10'} />
                    <Stop offset="1" stopColor={arcTo} stopOpacity="0" />
                  </RadialGradient>
                </Defs>
                {/* Bloom sits UNDER the ring — the light it appears to cast. */}
                <Circle cx={36} cy={36} r={36} fill={`url(#${bloomId})`} />
                <Circle cx={36} cy={36} r={R} fill="none" stroke={track} strokeWidth={3.5} />
                <AnimatedCircle
                  cx={36} cy={36} r={R} fill="none"
                  stroke={`url(#${arcId})`}
                  strokeWidth={3.5} strokeLinecap="round"
                  strokeDasharray={`${C}`} strokeDashoffset={offset}
                />
              </Svg>
              <View style={{
                position: 'absolute', left: 0, right: 0, top: 0, bottom: 0,
                alignItems: 'center', justifyContent: 'center',
              }}>
                <Text style={{
                  fontSize: 15, fontWeight: '700', color: valueColor,
                  ...numerals, ...(shadow || {}),
                }}>
                  {fmtMetricValue(latest)}
                </Text>
                {!!g.unit && (
                  <Text style={{
                    fontSize: 9.5, fontWeight: '600', color: unitColor,
                    marginTop: 1, letterSpacing: 0.2, ...(shadow || {}),
                  }}>{g.unit}</Text>
                )}
              </View>
            </View>
            <Text numberOfLines={2} style={{
              fontSize: 11, fontWeight: '600', color: labelColor,
              textAlign: 'center', lineHeight: 13.5, ...(shadow || {}),
            }}>
              {g.label || g.key}
              {isPb ? <Text style={{ color: onDarkSurface ? '#FFFFFF' : INDIGO }}> ★</Text> : null}
            </Text>
          </View>
  )

  // Wrapped only when there is something to long-press. A Pressable with no
  // handlers still runs its pressed style, so an unconditional wrapper would
  // dim every ring on any stray touch of the rail.
  if (onLongPress || onPress) {
    return (
      <Tappable onPress={onPress} onLongPress={onLongPress} accessibilityLabel={a11y} hitSlop={4}>
        {body}
      </Tappable>
    )
  }
  return <View accessible accessibilityLabel={a11y}>{body}</View>
}

// ── Performance hero ───────────────────────────────────────────────
// The guard lives in this wrapper so the inner component's hooks always run.
// `useSweep` used to sit after an early return, which meant the hook count
// changed the moment race data arrived — React throws on that.
export function PerformanceHero({
  view, disciplines, onSelectDiscipline, scrollY, band,
}: {
  view: HomeView
  disciplines?: string[]
  onSelectDiscipline?: (d: string) => void
  scrollY?: Animated.Value
  /** The athlete's tier band — anchors both ends of the gauge. */
  band?: TierBand | null
}) {
  const last = view?.lastRace
  if (!last || last.value == null || view.pb == null) return null
  return (
    <PerformanceHeroInner
      view={view} last={last} band={band}
      disciplines={disciplines} onSelectDiscipline={onSelectDiscipline} scrollY={scrollY}
    />
  )
}

function PerformanceHeroInner({
  view, last, disciplines, onSelectDiscipline, scrollY, band,
}: {
  view: HomeView
  last: NonNullable<HomeView['lastRace']>
  disciplines?: string[]
  onSelectDiscipline?: (d: string) => void
  scrollY?: Animated.Value
  band?: TierBand | null
}) {
  const { colors } = useTheme()
  const { pb, isThrows } = view
  const value = Number(last.value)
  const isPb = value === pb

  // Every race in this event, for the strip. `chartData` is chronological and
  // carries dates, which the strip uses to fade older marks back.
  const strip = useMemo(
    () => (view.chartData || [])
      .map((r) => ({ value: Number(r.value), date: r.date }))
      .filter((r) => Number.isFinite(r.value)),
    [view.chartData],
  )

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
    // No card, no panel, no background. The screen itself carries the
    // photograph now (see HomeScreen), so the hero is just content laid on it —
    // which is what makes the image read as the app rather than as a picture
    // pasted into the app.
    <View style={{ alignItems: 'center', paddingTop: spacing.sm, paddingBottom: rhythm.block }}>
      {/* The arc runs between the standard you cleared and the one you're
          chasing — both from the tier table, so the scale is the same next
          week. Events with no tier table fall back to the strip, which builds
          an axis from the athlete's own range and says so. */}
      <View style={{ alignSelf: 'stretch', marginBottom: spacing.sm }}>
        {band ? (
          <TierGauge
            pb={pb as number}
            latest={value}
            currentCut={band.currentCut}
            nextCut={band.nextCut}
            lower={!isThrows}
            tierName={band.tierName}
            nextTierName={band.nextTierName}
            color={band.color}
            atTop={band.atTop}
            floorIsSynthetic={band.floorIsSynthetic}
            valueFmt={(v) => formatMark(v, view.discipline)}
          />
        ) : (
          <View style={{ paddingHorizontal: 4 }}>
            <RaceStrip
              races={strip}
              latest={value}
              lower={!isThrows}
              calibrated={false}
              discipline={view.discipline}
              valueFmt={(v) => formatMark(v, view.discipline)}
            />
          </View>
        )}
      </View>

      <Text style={{
        fontSize: 10, letterSpacing: 2.2, textTransform: 'uppercase',
        color: onDark.muted, fontWeight: '600', marginTop: spacing.lg,
      }}>
        Latest performance{view.discipline ? ` · ${view.discipline}` : ''}
      </Text>

      <Text style={{
        // Widened from 54 to 64. Premium type is about RANGE — a 64px numeral
        // against a 10px mono label is a scale contrast the old set never had.
        fontSize: 64, lineHeight: 68, fontWeight: '700',
        letterSpacing: -2.4, color: onDark.ink, ...numerals,
      }}>
        {formatMark(value, view.discipline)}
      </Text>

      {/* Web sets this line in a serif face for contrast against the numerals. */}
      <Text style={{
        fontSize: 23, color: onDark.ink, fontFamily: 'Georgia',
        textAlign: 'center', marginTop: 2,
      }}>
        {delta}
      </Text>

      {!!caption && (
        <Text style={{ fontSize: 14, color: onDark.dim, marginTop: 6, textAlign: 'center' }}>
          {caption}
        </Text>
      )}

      {/* Inside the panel, over the photograph — the only place Liquid Glass
          has anything to refract. */}
      {!!disciplines?.length && !!onSelectDiscipline && (
        <View style={{ alignSelf: 'stretch', marginTop: spacing.lg }}>
          <DisciplineToggle
            disciplines={disciplines}
            active={view.discipline}
            onSelect={onSelectDiscipline}
            onHero
          />
        </View>
      )}
    </View>
  )
}

// ── Mini trend chart ───────────────────────────────────────────────
// invert=true (times): faster values plot HIGHER, per Keenan's chart rule.
export function MiniTrendChart({
  points, invert, pbValue, valueFmt = fmtMetricValue, onImage: over,
}: {
  points: { t: string; v: number }[]
  invert?: boolean
  pbValue?: number | null
  valueFmt?: (v: number | string) => string
  /** Repaints the chart for a dark, translucent host. */
  onImage?: boolean
}) {
  const { colors } = useTheme()
  const pts = (points || []).slice(-8)
  if (pts.length < 2) return null

  // The chart is drawn in ink-on-paper colours by default. Over the backdrop
  // every one of them — grid, axis labels, the last point's white fill —
  // disappears or inverts, so the palette swaps wholesale rather than being
  // patched one attribute at a time.
  const grid = over ? onImage.divider : colors.glass.divider
  const axisInk = over ? onImage.dim : colors.text.muted
  const stroke = over ? onDark.accent : INDIGO
  const dotFill = over ? 'rgba(11,12,24,0.9)' : colors.bg.card

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
  const months = pts.map((p) => new Date(p.t).toLocaleDateString('en-GB', { month: 'short' }))

  // Verdicts come from the shared classifier in TrendDetailSheet, so a dot
  // reading amber on this card reads amber in the detail sheet too. Two
  // implementations of one rule is the fastest way to end up with two charts
  // disagreeing about the same race.
  const verdict = raceVerdicts(pts.map((q) => q.v), !!invert)
  const TONE = (v: Verdict) =>
    v === 'first' ? stroke
      : v === 'flat' ? (over ? onDark.muted : colors.text.muted)
        : verdictTone(v)

  return (
    <Svg width="100%" height={H} viewBox={`0 0 ${W} ${H}`}>
      {[0.15, 0.5, 0.85].map((f) => (
        <Line key={f}
          x1={padL} y1={padT + f * (H - padT - padB)}
          x2={W - padR} y2={padT + f * (H - padT - padB)}
          stroke={grid} strokeWidth={1} />
      ))}
      <SvgText x={W - padR + 6} y={padT + 4} fontSize={9} fill={axisInk}>{valueFmt(topVal)}</SvgText>
      <SvgText x={W - padR + 6} y={H - padB} fontSize={9} fill={axisInk}>{valueFmt(botVal)}</SvgText>
      {pbValue != null && (
        <>
          <Line x1={padL} y1={Y(pbValue)} x2={W - padR} y2={Y(pbValue)}
            stroke={stroke} strokeOpacity={over ? 0.55 : 0.35} strokeWidth={1} strokeDasharray="3 4" />
          <SvgText x={W - padR + 6} y={Y(pbValue) + 3} fontSize={9} fill={stroke}>PB</SvgText>
        </>
      )}
      {/* Segments carry a light wash of the verdict; the dots carry it in
          full. Colouring the line at full strength turns eight races into
          seven competing hues and the eye stops reading the SHAPE, which is
          the thing a trend line is for. */}
      {pts.slice(1).map((p, i) => (
        <Line
          key={`seg${i}`}
          x1={X(i)} y1={Y(pts[i].v)} x2={X(i + 1)} y2={Y(p.v)}
          stroke={TONE(verdict[i + 1])}
          strokeOpacity={0.5}
          strokeWidth={2.5}
          strokeLinecap="round"
        />
      ))}
      {pts.map((p, i) => {
        const tone = TONE(verdict[i])
        const isLast = i === pts.length - 1
        const isBest = verdict[i] === 'best'
        return (
          <React.Fragment key={i}>
            {(isBest || isLast) && (
              <Circle cx={X(i)} cy={Y(p.v)} r={8} fill={tone} fillOpacity={0.22} />
            )}
            <Circle
              cx={X(i)} cy={Y(p.v)}
              r={isLast ? 4.5 : 3.5}
              fill={isLast ? dotFill : tone}
              stroke={isLast ? tone : 'none'}
              strokeWidth={isLast ? 2.5 : 0}
            />
          </React.Fragment>
        )
      })}
      <SvgText x={X(0)} y={H - 6} fontSize={9} fill={axisInk} textAnchor="middle">{months[0]}</SvgText>
      <SvgText x={X(pts.length - 1)} y={H - 6} fontSize={9} fill={axisInk} textAnchor="middle">
        {months[months.length - 1]}
      </SvgText>
    </Svg>
  )
}

// ── Detail trend cards ─────────────────────────────────────────────
function TrendCard({
  icon, title, ago, bigValue, unit, chart, action, onLog, onImage: over, detail,
}: any) {
  const [openDetail, setOpenDetail] = useState(false)
  const { colors } = useTheme()

  // Two hosts, one layout. On paper this is a solid white card; over the
  // backdrop it is a smoked glass panel, because a white card dropped onto a
  // darkened photograph reads as a pasted-in screenshot.
  const ink = over ? onImage.ink : colors.text.primary
  const sub = over ? onImage.muted : colors.text.secondary
  const accent = over ? onDark.accent : INDIGO

  const body = (
    <>
      <View style={{ flexDirection: 'row', alignItems: 'center', gap: 12 }}>
        <View style={{
          width: 36, height: 36, borderRadius: 18,
          backgroundColor: over ? 'rgba(255,255,255,0.12)' : colors.glass.overlay,
          alignItems: 'center', justifyContent: 'center',
        }}>
          <Ionicons name={icon} size={16} color={accent} />
        </View>
        <View style={{ flex: 1 }}>
          <Text numberOfLines={1} style={{ fontSize: 15, fontWeight: '600', color: ink }}>
            {title}
          </Text>
          {!!ago && (
            <Text style={{
              fontSize: 10, letterSpacing: 1.2, textTransform: 'uppercase',
              fontWeight: '700', color: accent, marginTop: 2,
            }}>{ago}</Text>
          )}
        </View>
      </View>

      <Text style={{
        fontSize: 30, fontWeight: '600', letterSpacing: -0.6,
        color: ink, marginTop: 10, ...numerals,
      }}>
        {bigValue}
        {!!unit && <Text style={{ fontSize: 15, fontWeight: '500', color: sub }}> {unit}</Text>}
      </Text>

      {/* The card chart is a shape; the numbers live one tap away. */}
      {detail ? (
        <Tappable
          onPress={() => setOpenDetail(true)}
          accessibilityLabel={`${title}: open every race with times and deltas`}
          style={{ marginTop: 4 }}
        >
          {chart}
          <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 5, marginTop: 2 }}>
            <Text style={{
              fontSize: 10, letterSpacing: 1.4, textTransform: 'uppercase',
              fontWeight: '700', color: over ? onDark.accent : INDIGO,
            }}>
              Every race
            </Text>
            <Ionicons name="chevron-forward" size={12} color={over ? onDark.accent : INDIGO} />
          </View>
        </Tappable>
      ) : (
        <View style={{ marginTop: 4 }}>{chart}</View>
      )}

      {detail && (
        <TrendDetailSheet
          visible={openDetail}
          onClose={() => setOpenDetail(false)}
          title={detail.title || title}
          points={detail.points}
          lowerIsBetter={detail.lowerIsBetter}
          valueFmt={detail.valueFmt}
          unit={unit}
        />
      )}

      {!!action && (
        <Tappable
          onPress={onLog}
          accessibilityLabel={action}
          style={{
            marginTop: spacing.lg,
            // 44pt minimum touch target (Apple HIG) — 11pt padding gave ~40.
            minHeight: 44, justifyContent: 'center',
            borderRadius: radius.lg,
            backgroundColor: over ? 'rgba(255,255,255,0.10)' : colors.bg.primary,
            borderWidth: 1,
            borderColor: over ? 'rgba(255,255,255,0.22)' : colors.glass.border,
            alignItems: 'center',
          }}
        >
          <Text style={{ fontSize: 13, fontWeight: '600', color: over ? onImage.ink : colors.text.secondary }}>
            {action}
          </Text>
        </Tappable>
      )}
    </>
  )

  if (over) {
    return (
      <GlassPanel tone="deep" intensity={22} radius={20}
        style={{ padding: 22, marginBottom: rhythm.section }}>
        {body}
      </GlassPanel>
    )
  }

  return (
    <View style={{
      backgroundColor: colors.glass.bg, borderRadius: 20,
      borderWidth: 1, borderColor: colors.glass.border,
      padding: 22, marginBottom: rhythm.section,
    }}>
      {body}
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
  view, onLog, onImage: over,
}: { view: HomeView; onLog?: () => void; onImage?: boolean }) {
  const racePts = (view?.chartData || [])
    .map((d) => ({ t: d.date, v: Number(d.value) }))
    .filter((p) => Number.isFinite(p.v))

  if (racePts.length < 2) return null

  return (
    <TrendCard
      icon="flash"
      onImage={over}
      title={`${view.discipline || 'Performance'} progression`}
      ago={timeAgo(view.lastRace?.date)}
      bigValue={formatMark(Number(view.lastRace?.value), view.discipline)}
      chart={
        <MiniTrendChart
          points={racePts}
          invert={!view.isThrows}
          pbValue={view.pb}
          onImage={over}
          valueFmt={(v) => Number(v).toFixed(2)}
        />
      }
      action="Log a race result"
      onLog={onLog}
      detail={{
        title: `${view.discipline || 'Performance'} progression`,
        points: racePts,
        lowerIsBetter: !view.isThrows,
        valueFmt: (v: number) => formatMark(v, view.discipline),
      }}
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
          detail={{
            title: g.label || g.key,
            points: g.history
              .map((r: any) => ({ t: r.recorded_at, v: Number(r.value) }))
              .filter((q: any) => Number.isFinite(q.v)),
            lowerIsBetter: LOWER_IS_BETTER.has(g.key),
            valueFmt: (v: number) => fmtMetricValue(v),
          }}
        />
      ))}
    </View>
  )
}
