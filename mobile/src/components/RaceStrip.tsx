// ═══════════════════════════════════════════════════════════════════════
// RACE STRIP — every race on one axis, with the latest one called out.
//
// Replaces the semicircular gauge, which had a structural fault rather than
// a cosmetic one: its arc ran season-worst → PB, so BOTH ends of the scale
// moved every time the athlete raced. Log one slow heat and the whole thing
// rescales — your position on the arc changes when your performance hasn't.
// A number on the home screen has to be comparable with itself week to week,
// and that one could not be. It also borrowed the grammar of a bounded
// quantity with a real zero and maximum (fuel, battery, % of goal). A race
// time has neither, and by construction the needle could never leave the
// scale, so it could never say anything surprising.
//
// A strip fixes it because you read the PATTERN — where this dot sits among
// the others and against the standards — not a needle against an invented
// range. The axis is anchored to the event's tier cuts wherever we hold
// them, so it is the same axis next week.
//
// Drawn with plain Views rather than SVG on purpose: opacity and transform
// on a View run on the native driver, so forty dots can stagger in without
// touching the JS thread. `r` and `cx` on an SVG circle cannot.
// ═══════════════════════════════════════════════════════════════════════

import React, { useMemo, useRef, useEffect } from 'react'
import { View, Text, Animated, StyleSheet } from 'react-native'
import { onDark, spacing } from '../lib/theme'
import { DURATION, EASE, useReducedMotion } from '../lib/motion'

export interface StripRace { value: number; date?: string | null }
export interface StripCut { label: string; value: number }

const H = 108          // total block height
const AXIS_Y = 58      // where the rule sits inside it
const DOT = 9
const LATEST = 15

export default function RaceStrip({
  races, latest, cuts = [], lower, valueFmt, calibrated = true, discipline,
}: {
  races: StripRace[]
  /** The mark being featured — drawn last, largest, and in white. */
  latest: number
  /** Tier standards for this event. Empty when we hold none. */
  cuts?: StripCut[]
  lower: boolean
  valueFmt: (v: number) => string
  calibrated?: boolean
  discipline?: string | null
}) {
  const reduced = useReducedMotion()
  const anim = useRef(new Animated.Value(0)).current

  const geom = useMemo(() => {
    const vals = races.map((r) => Number(r.value)).filter(Number.isFinite)
    if (!vals.length) return null

    let dMin = Math.min(...vals), dMax = Math.max(...vals)

    // Pull in any standard close enough to be worth aiming at. A cut ten
    // seconds away would flatten every real race into a single pixel, so
    // reach is measured in the athlete's own spread, not in absolutes.
    const ownSpread = Math.max(dMax - dMin, Math.abs(dMax) * 0.02, 0.05)
    for (const c of cuts) {
      if (!Number.isFinite(c.value)) continue
      if (c.value >= dMin - ownSpread * 1.4 && c.value <= dMax + ownSpread * 1.4) {
        dMin = Math.min(dMin, c.value)
        dMax = Math.max(dMax, c.value)
      }
    }
    if (dMax === dMin) { dMax += ownSpread; dMin -= ownSpread }
    const pad = (dMax - dMin) * 0.14
    dMin -= pad; dMax += pad

    // Better always runs to the RIGHT, whichever direction the event scores.
    const pct = (v: number) => {
      const f = (v - dMin) / (dMax - dMin)
      return Math.max(0, Math.min(1, lower ? 1 - f : f)) * 100
    }

    // Standards bunch up — Qualifier / Semi / Final for the 100m sit within
    // 0.30s of each other, which is ~19% of a typical axis. Their labels are
    // wider than that, so they overlap into an unreadable smear. Any label
    // that would collide with the last one on its row drops to a second row.
    const LABEL_PCT = 17
    const visibleCuts: (StripCut & { x: number; row: number })[] = []
    let lastOnRow: Record<number, number> = {}
    for (const c of cuts) {
      if (!Number.isFinite(c.value) || c.value < dMin || c.value > dMax) continue
      const x = pct(c.value)
      const row = (lastOnRow[0] != null && Math.abs(x - lastOnRow[0]) < LABEL_PCT) ? 1 : 0
      lastOnRow[row] = x
      visibleCuts.push({ ...c, x, row })
    }

    // Oldest first, so the stagger reads as history arriving in order.
    const dots = races
      .map((r, i) => ({ v: Number(r.value), t: r.date ? new Date(r.date).getTime() : i }))
      .filter((r) => Number.isFinite(r.v))
      .sort((a, b) => a.t - b.t)
      .map((r, i, arr) => ({
        x: pct(r.v),
        // Older races sit further back, so the eye lands on recent form.
        o: 0.28 + 0.42 * (arr.length === 1 ? 1 : i / (arr.length - 1)),
      }))

    // ── When no standard is on screen ────────────────────────────
    // A developing athlete can be a long way off every cut, and then the axis
    // is built purely from their own marks — which is the instability the
    // gauge had. So the nearest standard is pinned to the edge instead, with
    // the distance to it: a fixed reference that survives a slow race even
    // when it can't fit on the scale.
    let offscreen: { label: string; value: number; gap: number } | null = null
    if (!visibleCuts.length && cuts.length) {
      const reachable = cuts
        .filter((c) => Number.isFinite(c.value))
        .map((c) => ({ ...c, gap: Math.abs(c.value - latest) }))
        .sort((a, b) => a.gap - b.gap)[0]
      if (reachable) offscreen = { label: reachable.label, value: reachable.value, gap: reachable.gap }
    }

    return { pct, visibleCuts, dots, offscreen, latestX: pct(latest) }
  }, [races, cuts, lower, latest])

  useEffect(() => {
    if (!geom) return
    if (reduced) { anim.setValue(1); return }
    anim.setValue(0)
    const a = Animated.timing(anim, {
      toValue: 1, duration: DURATION.slow, easing: EASE.sweep, useNativeDriver: true,
    })
    a.start()
    return () => a.stop()
  }, [geom, reduced])

  if (!geom) return null

  const n = geom.dots.length

  return (
    <View style={{ height: H, alignSelf: 'stretch' }}>
      {/* The rule, drawn left to right. */}
      <Animated.View
        style={[
          styles.axis,
          { transform: [{ scaleX: anim }] },
        ]}
      />

      {/* Standards */}
      {geom.visibleCuts.map((c) => {
        const tick = anim.interpolate({ inputRange: [0.35, 0.75], outputRange: [0, 1], extrapolate: 'clamp' })
        return (
          <Animated.View
            key={c.label}
            pointerEvents="none"
            style={[styles.cutWrap, { left: `${c.x}%`, opacity: tick }]}
          >
            <View style={styles.cutTick} />
            <Text
              numberOfLines={1}
              style={[styles.cutLabel, c.row === 1 && { top: -27 }]}
            >
              {c.label}
            </Text>
          </Animated.View>
        )
      })}

      {/* Every race */}
      {geom.dots.map((dot, i) => {
        // Each dot has its own slice of the timeline, so they arrive in
        // sequence rather than all at once — the load-in reads as the season
        // being laid down.
        const start = n === 1 ? 0 : (i / n) * 0.55
        const p = anim.interpolate({
          inputRange: [start, Math.min(1, start + 0.3)],
          outputRange: [0, 1],
          extrapolate: 'clamp',
        })
        return (
          <Animated.View
            key={i}
            pointerEvents="none"
            style={[
              styles.dot,
              {
                left: `${dot.x}%`,
                opacity: Animated.multiply(p, dot.o),
                transform: [{ translateX: -DOT / 2 }, { scale: p }],
              },
            ]}
          />
        )
      })}

      {/* This race — last in, largest, white, with a halo */}
      <Animated.View
        pointerEvents="none"
        style={[
          styles.latestWrap,
          {
            left: `${geom.latestX}%`,
            opacity: anim.interpolate({ inputRange: [0.55, 0.85], outputRange: [0, 1], extrapolate: 'clamp' }),
            transform: [
              { translateX: -LATEST / 2 },
              { scale: anim.interpolate({ inputRange: [0.55, 0.8, 0.92], outputRange: [0.4, 1.18, 1], extrapolate: 'clamp' }) },
            ],
          },
        ]}
      >
        <View style={styles.latestHalo} />
        <View style={styles.latestDot} />
      </Animated.View>

      {/* Ends of the axis, so the direction is never ambiguous */}
      <Text style={[styles.endLabel, { left: 0 }]}>{lower ? 'slower' : 'shorter'}</Text>
      <Text style={[styles.endLabel, { right: 0, textAlign: 'right' }]}>
        {lower ? 'faster' : 'further'}
      </Text>

      {/* The nearest standard, when it doesn't fit on the scale */}
      {geom.offscreen && (
        <Animated.View
          pointerEvents="none"
          style={[
            styles.offscreen,
            { opacity: anim.interpolate({ inputRange: [0.6, 0.9], outputRange: [0, 1], extrapolate: 'clamp' }) },
          ]}
        >
          <Text style={styles.offscreenText}>
            {geom.offscreen.label} {valueFmt(geom.offscreen.value)}
            <Text style={styles.offscreenGap}>{`  ·  ${geom.offscreen.gap.toFixed(2)} away`}</Text>
          </Text>
          <View style={styles.offscreenArrow} />
        </Animated.View>
      )}

      {!calibrated && (
        <Text style={styles.uncal}>
          Scale is your own range — no standards held for {discipline || 'this event'} yet.
        </Text>
      )}
    </View>
  )
}

const styles = StyleSheet.create({
  axis: {
    position: 'absolute', left: 0, right: 0, top: AXIS_Y,
    height: 2, borderRadius: 1,
    backgroundColor: 'rgba(255,255,255,0.16)',
  },
  cutWrap: { position: 'absolute', top: AXIS_Y - 18, alignItems: 'center', width: 1 },
  cutTick: { width: 1, height: 30, backgroundColor: 'rgba(255,255,255,0.30)' },
  cutLabel: {
    // 64 not 90: a label wider than the gap between two standards is what
    // makes them collide in the first place.
    position: 'absolute', top: -14, width: 64, textAlign: 'center',
    fontSize: 9, letterSpacing: 0.8, fontWeight: '700',
    color: onDark.muted, textTransform: 'uppercase',
  },
  dot: {
    position: 'absolute', top: AXIS_Y + 1 - DOT / 2,
    width: DOT, height: DOT, borderRadius: DOT / 2,
    backgroundColor: '#FFFFFF',
  },
  latestWrap: {
    position: 'absolute', top: AXIS_Y + 1 - LATEST / 2,
    width: LATEST, height: LATEST, alignItems: 'center', justifyContent: 'center',
  },
  latestHalo: {
    position: 'absolute', width: 30, height: 30, borderRadius: 15,
    backgroundColor: onDark.accent, opacity: 0.26,
  },
  latestDot: {
    width: LATEST, height: LATEST, borderRadius: LATEST / 2,
    backgroundColor: '#FFFFFF',
  },
  endLabel: {
    position: 'absolute', top: AXIS_Y + 16,
    fontSize: 9, letterSpacing: 1.4, textTransform: 'uppercase',
    color: onDark.dim, fontWeight: '600',
  },
  offscreen: {
    position: 'absolute', top: AXIS_Y - 42, right: 0,
    flexDirection: 'row', alignItems: 'center', gap: 6,
  },
  offscreenText: {
    fontSize: 9.5, letterSpacing: 0.6, fontWeight: '700',
    color: onDark.muted, textTransform: 'uppercase',
  },
  offscreenGap: { fontWeight: '500', color: onDark.dim },
  offscreenArrow: {
    width: 0, height: 0, borderTopWidth: 4, borderBottomWidth: 4, borderLeftWidth: 6,
    borderTopColor: 'transparent', borderBottomColor: 'transparent',
    borderLeftColor: onDark.muted,
  },
  uncal: {
    position: 'absolute', top: AXIS_Y + 36, left: 0, right: 0,
    fontSize: 10, color: onDark.dim, textAlign: 'center',
  },
})
