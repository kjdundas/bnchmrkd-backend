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

import React, { useRef, useEffect, useState } from 'react'
import { View, Text } from 'react-native'
import { onDark, numerals, spacing, typeScale, weight } from '../lib/theme'
import { DURATION, useReducedMotion } from '../lib/motion'
import TrackLane, { LANE_W, LANE_H } from './TrackLane'

const W = LANE_W, H = LANE_H

// Over a photograph, colour alone cannot carry text. Measured on the live
// hero the labels scored 1.08, 1.20 and 1.59 to 1 — the arc itself scored
// 1.00, the same colour as the stand behind it. A shadow makes each glyph
// carry its own local darkness, which works wherever the picture happens to
// be bright, and costs no chrome.
const LIFT = {
  textShadowColor: 'rgba(6,7,18,0.92)',
  textShadowOffset: { width: 0, height: 1 },
  textShadowRadius: 6,
} as const

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

  // The marker rides the lane rather than appearing at the end, so the eye
  // follows the travel. Driven here rather than by Animated because the lane
  // is now drawn in Skia, which takes a number and not an interpolation —
  // and Reanimated, the usual answer, has no babel config in this project.
  const [t, setT] = useState(reduced ? 1 : 0)
  useEffect(() => {
    if (reduced) { setT(1); return }
    let raf = 0
    const t0 = Date.now()
    const step = () => {
      const p = Math.min(1, (Date.now() - t0) / DURATION.slow)
      setT(p < 1 ? 1 - Math.pow(1 - p, 3) : 1)     // ease-out cubic
      if (p < 1) raf = requestAnimationFrame(step)
    }
    raf = requestAnimationFrame(step)
    return () => cancelAnimationFrame(raf)
  }, [reduced, frac])

  // "10% of the way to Medalist" is not a sentence anyone says. A sprinter
  // says "eighteen hundredths off". Percent-between-two-tier-cutoffs is a
  // unit this app invented; the gap is in the athlete's own unit, and it is
  // the number they will repeat out loud.
  const gap = nextCut != null ? Math.abs(nextCut - pb) : null
  const fmtGap = (g: number) => {
    const sample = nextCut != null ? valueFmt(nextCut) : ''
    const unit = (sample.match(/[^\d.:\s]+$/) || [''])[0]
    const dp = ((sample.split('.')[1] || '').match(/^\d+/) || ['00'])[0].length
    return `${g.toFixed(Math.min(3, Math.max(1, dp)))}${unit}`
  }

  return (
    <View style={{ alignItems: 'center' }}>
      <View style={{ width: W, height: H - 8 }}>
        <TrackLane
          frac={frac * t}
          latestFrac={showLatest ? latestFrac : null}
          colour={color}
        />
      </View>

      {/* The two standards the arc runs between. */}
      <View style={{
        flexDirection: 'row', justifyContent: 'space-between',
        alignSelf: 'stretch', paddingHorizontal: 2, marginTop: -14,
      }}>
        <View style={{ alignItems: 'flex-start', maxWidth: '42%' }}>
          <Text style={{ fontSize: typeScale.micro, letterSpacing: 1.4, textTransform: 'uppercase', color: onDark.muted, fontWeight: weight.bold, ...LIFT }}>
            {floorIsSynthetic ? 'Starting out' : tierName}
          </Text>
          <Text style={{ fontSize: typeScale.caption, color: onDark.ink, marginTop: 2, ...numerals, ...LIFT }}>
            {floorIsSynthetic ? '' : valueFmt(currentCut)}
          </Text>
        </View>
        <View style={{ alignItems: 'flex-end', maxWidth: '42%' }}>
          <Text numberOfLines={1} style={{ fontSize: typeScale.micro, letterSpacing: 1.4, textTransform: 'uppercase', color, fontWeight: weight.bold, ...LIFT }}>
            {atTop ? 'Top tier' : nextTierName || 'Next'}
          </Text>
          <Text style={{ fontSize: typeScale.caption, color: onDark.ink, marginTop: 2, ...numerals, ...LIFT }}>
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
              <Text style={{ color: onDark.ink, fontWeight: weight.bold }}>
                {gap != null ? fmtGap(gap) : ''}
              </Text>
              {' off '}{nextTierName}
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
