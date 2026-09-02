// ═══════════════════════════════════════════════════════════════════════
// TIER GAUGE — the arc runs between two standards, not between your own
// worst and best.
//
// The original gauge swept season-worst → PB. Both ends were the athlete's
// own results, so both moved every time they raced: log one slow heat and the
// scale rescaled underneath a needle that hadn't earned the move. It also
// borrowed the grammar of a bounded quantity with a real zero and maximum
// while measuring a race time, which has neither.
//
// Anchoring the ends to the tier table fixes both faults at once:
//
//   left   the cut you CLEARED to be in this tier
//   right  the cut that takes you into the next one
//
// Now it is genuinely a percentage of a real goal — which is the one thing a
// gauge is honestly for — and the scale is identical next week. It steps when
// you change tier or age group, but a step on promotion is an event worth
// seeing, not drift.
//
// The FILL tracks the PB, because the PB is what the tier is computed from;
// showing the latest race there would let one slow afternoon appear to demote
// you. The latest race gets its own tick on the same arc, so "where I stand"
// and "how today went" are both legible without being conflated.
// ═══════════════════════════════════════════════════════════════════════

import React, { useRef, useEffect } from 'react'
import { View, Text, Animated } from 'react-native'
import Svg, { Path, Circle, Line, Defs, LinearGradient, Stop } from 'react-native-svg'
import { onDark, numerals, spacing, typeScale, weight } from '../lib/theme'
import { DURATION, EASE, useReducedMotion } from '../lib/motion'

const AnimatedPath = Animated.createAnimatedComponent(Path)
const AnimatedCircle = Animated.createAnimatedComponent(Circle)

// Same geometry as the web gauge, so the two apps draw the same shape.
const R = 88, CX = 108, CY = 106, W = 216, H = 124
const LEN = Math.PI * R
const SAMPLES = 24

/** Point on the arc at 0..1 along the sweep. */
const ptX = (f: number) => CX + R * Math.cos(Math.PI * (1 - f))
const ptY = (f: number) => CY - R * Math.sin(Math.PI * (1 - f))

export default function TierGauge({
  pb, latest, currentCut, nextCut, lower, tierName, nextTierName,
  color, valueFmt, atTop, floorIsSynthetic,
}: {
  pb: number
  /** The most recent race. Drawn as a tick if it differs from the PB. */
  latest?: number | null
  currentCut: number
  nextCut: number | null
  lower: boolean
  tierName: string
  nextTierName?: string | null
  color: string
  valueFmt: (v: number) => string
  atTop?: boolean
  floorIsSynthetic?: boolean
}) {
  const reduced = useReducedMotion()
  const anim = useRef(new Animated.Value(0)).current

  const span = nextCut != null ? nextCut - currentCut : 0
  const posOf = (v: number) => {
    if (atTop || nextCut == null || span === 0) return 1
    const f = (v - currentCut) / span
    return Math.max(0, Math.min(1, f))
  }
  const frac = atTop ? 1 : posOf(pb)

  // The latest race only gets a tick when it actually falls INSIDE the band.
  // posOf clamps, so a 10.99 and an 11.40 — both slower than this tier's
  // entry — would otherwise pin to the same spot at 0% and claim a position
  // neither of them has. Outside the band it is said in words instead.
  const rawLatest = latest != null && Number.isFinite(latest) && !atTop && span !== 0
    ? (latest - currentCut) / span
    : null
  const latestInside = rawLatest != null && rawLatest > 0.02 && rawLatest < 0.98
  const latestFrac = latestInside ? Math.max(0, Math.min(1, rawLatest as number)) : null
  const showLatest = latestFrac != null && Math.abs(latestFrac - frac) > 0.02
  const latestBelowBand = rawLatest != null && rawLatest <= 0.02
  const latestAboveBand = rawLatest != null && rawLatest >= 0.98

  useEffect(() => {
    if (reduced) { anim.setValue(1); return }
    anim.setValue(0)
    const a = Animated.timing(anim, {
      toValue: 1, duration: DURATION.slow, easing: EASE.sweep, useNativeDriver: false,
    })
    a.start()
    return () => a.stop()
  }, [reduced, frac])

  const dashOffset = anim.interpolate({
    inputRange: [0, 1], outputRange: [LEN, LEN * (1 - frac)],
  })
  // The marker rides the arc rather than appearing at its end, so the eye
  // follows the travel. Sampled along the circle the path describes.
  const ramp = Array.from({ length: SAMPLES + 1 }, (_, i) => i / SAMPLES)
  const dotX = anim.interpolate({ inputRange: ramp, outputRange: ramp.map((t) => ptX(t * frac)) })
  const dotY = anim.interpolate({ inputRange: ramp, outputRange: ramp.map((t) => ptY(t * frac)) })

  const pct = Math.round(frac * 100)

  return (
    <View style={{ alignItems: 'center' }}>
      <View style={{ width: W, height: H - 8 }}>
        <Svg width={W} height={H} viewBox={`0 0 ${W} ${H}`}>
          <Defs>
            <LinearGradient id="tierArc" x1="0" y1="0" x2="1" y2="0">
              <Stop offset="0" stopColor={color} stopOpacity="0.55" />
              <Stop offset="1" stopColor={color} />
            </LinearGradient>
          </Defs>

          <Path d={`M ${CX - R} ${CY} A ${R} ${R} 0 0 1 ${CX + R} ${CY}`}
            fill="none" stroke={onDark.line} strokeWidth={5} strokeLinecap="round" />

          <AnimatedPath d={`M ${CX - R} ${CY} A ${R} ${R} 0 0 1 ${CX + R} ${CY}`}
            fill="none" stroke="url(#tierArc)" strokeWidth={5.5} strokeLinecap="round"
            strokeDasharray={`${LEN}`} strokeDashoffset={dashOffset} />

          {/* Today's race, if it sits somewhere other than the PB. A tick, so
              it reads as a reading on the scale rather than a second needle. */}
          {showLatest && (
            <Line
              x1={CX + (R - 9) * Math.cos(Math.PI * (1 - latestFrac))}
              y1={CY - (R - 9) * Math.sin(Math.PI * (1 - latestFrac))}
              x2={CX + (R + 9) * Math.cos(Math.PI * (1 - latestFrac))}
              y2={CY - (R + 9) * Math.sin(Math.PI * (1 - latestFrac))}
              stroke={onDark.muted} strokeWidth={2} strokeLinecap="round"
            />
          )}

          <AnimatedCircle cx={dotX} cy={dotY} r={13} fill={color} fillOpacity={0.22} />
          <AnimatedCircle cx={dotX} cy={dotY} r={6} fill="#FFFFFF" />
        </Svg>
      </View>

      {/* The two standards the arc runs between. */}
      <View style={{
        flexDirection: 'row', justifyContent: 'space-between',
        alignSelf: 'stretch', paddingHorizontal: 2, marginTop: -14,
      }}>
        <View style={{ alignItems: 'flex-start', maxWidth: '42%' }}>
          <Text style={{ fontSize: typeScale.micro, letterSpacing: 1.4, textTransform: 'uppercase', color: onDark.dim, fontWeight: weight.bold }}>
            {floorIsSynthetic ? 'Starting out' : tierName}
          </Text>
          <Text style={{ fontSize: typeScale.caption, color: onDark.muted, marginTop: 2, ...numerals }}>
            {floorIsSynthetic ? '' : valueFmt(currentCut)}
          </Text>
        </View>
        <View style={{ alignItems: 'flex-end', maxWidth: '42%' }}>
          <Text numberOfLines={1} style={{ fontSize: typeScale.micro, letterSpacing: 1.4, textTransform: 'uppercase', color: color, fontWeight: weight.bold }}>
            {atTop ? 'Top tier' : nextTierName || 'Next'}
          </Text>
          <Text style={{ fontSize: typeScale.caption, color: onDark.muted, marginTop: 2, ...numerals }}>
            {atTop || nextCut == null ? '' : valueFmt(nextCut)}
          </Text>
        </View>
      </View>

      {/* What the arc says, in words. */}
      <Text style={{
        fontSize: typeScale.caption, color: onDark.muted, marginTop: spacing.md, textAlign: 'center',
      }}>
        {atTop
          ? `Your PB of ${valueFmt(pb)} is at the top of this age group.`
          : <>
              PB <Text style={{ color: onDark.ink, fontWeight: weight.bold }}>{valueFmt(pb)}</Text>
              {' — '}
              <Text style={{ color: onDark.ink, fontWeight: weight.bold }}>{pct}%</Text>
              {' of the way to '}{nextTierName}
            </>}
      </Text>
      {showLatest && (
        <Text style={{ fontSize: typeScale.label, color: onDark.dim, marginTop: 4 }}>
          Tick marks this race
        </Text>
      )}
      {!showLatest && latestBelowBand && (
        <Text style={{ fontSize: typeScale.label, color: onDark.dim, marginTop: 4, textAlign: 'center' }}>
          This race was outside your current band — the arc tracks your best.
        </Text>
      )}
      {!showLatest && latestAboveBand && !atTop && (
        <Text style={{ fontSize: typeScale.label, color: onDark.accent, marginTop: 4, textAlign: 'center' }}>
          This race clears {nextTierName} — log it and the band moves up.
        </Text>
      )}
    </View>
  )
}
