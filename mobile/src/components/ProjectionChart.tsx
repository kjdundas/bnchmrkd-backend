// ═══════════════════════════════════════════════════════════════════════
// PROJECTION CHART — where this athlete's event could go, and how sure we are.
//
// Two halves of one picture on a single age axis: every race the athlete has
// actually run on the left, and the median development path over its p25–p75
// corridor on the right, divided by today.
//
// The projection alone was the wrong chart. A trajectory is a claim about
// where someone is heading, and you cannot read that from a single anchor
// point and a curve — you read it from the marks behind you and the shape
// they make. The history is the evidence; the projection is the inference.
//
// ── Why one line and not three ─────────────────────────────────────
// The lib returns three archetypes (steady / early peaker / late bloomer) and
// this first drew all three. Measured at the five-year horizon they differ by
// 0.09s for a sprinter and 0.17m for a long jumper, while the corridor around
// them is 1.21s and 1.32m — between 8x and 14x wider. The three lines
// therefore occupy 7–13% of the vertical space and render as one line with a
// fringe. A three-entry legend next to that promises the reader a distinction
// the chart cannot physically show, so the alternates are gone and the median
// is the projection.
//
// ── On what the band actually is ────────────────────────────────────
// It is NOT a confidence interval, and it is deliberately not labelled as
// one. projectPerformance compounds p25 and p75 independently from the
// current PB, so by age 30 they are two separate development stories — "you
// improved like the bottom quartile of this cohort every year" versus "like
// the top quartile every year" — not a ±band around the median. The web
// app's chart does show true 50%/90% σ intervals, but off a different engine
// (a single rate fitted from the athlete's own races). Mixing the two
// vocabularies would put a statistical claim on data that can't support it,
// so this says "development range" and means it.
//
// ── On the horizon: why five years and not to 35 ───────────────────
// The corridor is only credible for about five years, and it is worth being
// precise about why. p75 compounds the 75th-percentile improvement rate every
// consecutive year — which no athlete has ever done. Measured on a 17-year-old
// at 10.99:
//
//     +3y   range  10.23 – 11.04   (0.81s wide)
//     +5y   range   9.90 – 11.12   (1.21s)
//     +9y   range   9.45 – 11.57   (2.13s)   ← faster than any European, ever
//    +18y   range   8.99 – 13.47   (4.48s)   ← faster than any human, ever
//
// Drawing to 35 does two bad things at once: it puts a physically impossible
// mark on the optimistic edge, and it sets the y-domain so wide that the
// three median lines — the actual content — are squashed into the middle
// fifth of the chart. Five years is the point where the band is still a
// statement about athletes rather than about arithmetic.
// ═══════════════════════════════════════════════════════════════════════

import React, { useMemo, useEffect } from 'react'
import { View, Text } from 'react-native'
import Svg, {
  Path, Polyline, Line, Circle, Text as SvgText, Defs, LinearGradient, Stop,
} from 'react-native-svg'
import { onImageColors as colors, spacing, typeScale, radius } from '../lib/theme'

export interface ProjPoint { age: number; projected: number; p25: number; p75: number; n: number | null }

const W = 340, H = 232
const padL = 6, padR = 48, padT = 16, padB = 30
const plotW = W - padL - padR
const plotH = H - padT - padB

// Below this many athletes in the source cohort the year's rate is thin
// evidence, and the chart says so rather than drawing it with equal weight.
const THIN_N = 40

/** See the note above — beyond this the optimistic edge stops being physical. */
const HORIZON_YEARS = 5

/** How far back the raced history is drawn. */
const HISTORY_YEARS = 4

const STEADY = '#8B83FF'   // indigo-bright — the projected path
const ACTUAL = '#FFFFFF'   // raced marks: solid, white, unarguable

export interface RacePoint { age: number; value: number; date?: string }

/** What the chart could actually draw from the history it was given. */
export interface HistorySummary {
  marks: number
  days: number
  spanYears: number
}

export default function ProjectionChart({
  steady, history = [], nowAge, lower, valueFmt, nextCut, nextTierName, onSummary,
}: {
  /** The median (steady) projection, oldest-first from the athlete's age. */
  steady: ProjPoint[]
  /** Every logged race, as {age, value}. Drawn to the left of today. */
  history?: RacePoint[]
  /**
   * The athlete's age today, FRACTIONAL.
   *
   * The projection is anchored at the floored integer age, so using that as
   * the boundary would drop any race run later in the current year — an
   * athlete who is 17.8 and raced last month would lose their most recent
   * mark, which is the one that matters most.
   */
  nowAge?: number
  /** True for track events, where a lower mark is better and plots HIGHER. */
  lower: boolean
  valueFmt: (v: number) => string
  /** The next tier's cut, drawn as a target line. */
  nextCut?: number | null
  nextTierName?: string | null
  /** Reports back what the history supported, so the caller can caption it. */
  onSummary?: (s: HistorySummary) => void
}) {
  const geom = useMemo(() => {
    if (!steady?.length) return null

    // ── Horizon ──────────────────────────────────────────────────
    const better = (a: number, b: number) => (lower ? a < b : a > b)
    void better
    const peak = steady.reduce((b, p) => (better(p.projected, b.projected) ? p : b), steady[0])
    const a0 = steady[0].age
    const aEnd = Math.min(steady[steady.length - 1].age, a0 + HORIZON_YEARS)
    if (aEnd <= a0) return null

    const S = (steady || []).filter((p) => p.age >= a0 && p.age <= aEnd)
    if (S.length < 2) return null

    // ── History ──────────────────────────────────────────────────
    // Capped at HISTORY_YEARS back. An athlete with eight seasons logged
    // would otherwise squeeze the projection — the part they can still act
    // on — into the right-hand third of the chart.
    const today = Number.isFinite(nowAge as number) ? (nowAge as number) : a0
    const hCut = today - HISTORY_YEARS
    const Hs = (history || [])
      .filter((r) => Number.isFinite(r.age) && Number.isFinite(r.value)
        && r.age >= hCut && r.age <= today + 0.05)
      .sort((x, y) => x.age - y.age)

    // ── Rounds on one day are one competition, not a trend ───────
    // A meet gives you a heat, a semi and a final — three or four marks on a
    // single date, which land on the same x. Joining them with the trend line
    // draws a vertical stroke through the chart and implies the athlete got
    // slower during the afternoon. So every mark is still plotted as its own
    // dot (they all happened), but the LINE joins the best of each day, which
    // is the thing that actually moves across a season.
    const byDay = new Map<string, RacePoint[]>()
    for (const r of Hs) {
      const k = r.date ? String(r.date).slice(0, 10) : String(r.age)
      const list = byDay.get(k)
      if (list) list.push(r); else byDay.set(k, [r])
    }
    const dayBests = [...byDay.values()]
      .map((marks) => marks.reduce((b, r) => (better(r.value, b.value) ? r : b), marks[0]))
      .sort((x, y) => x.age - y.age)

    // ── Where the projection sits on the x-axis ──────────────────
    // projectPerformance is anchored at the FLOORED age (17), but the athlete
    // is 17.8 today. Drawing the projection at its own ages started the
    // dashed line nearly a year to the LEFT of the "now" divider, overlapping
    // races that have already happened. Every projected point is therefore
    // shifted so that "one year out" means one year from today, not from the
    // athlete's last birthday.
    const shift = today - a0
    const PX = (projAge: number) => projAge + shift
    const a1 = aEnd + shift

    // The x-axis starts at the first race, not at today.
    const x0 = Hs.length ? Math.min(Hs[0].age, today) : today

    // ── Value domain ─────────────────────────────────────────────
    const vals: number[] = []
    for (const p of S) vals.push(p.projected, p.p25, p.p75)
    for (const r of Hs) vals.push(r.value)
    if (nextCut != null && Number.isFinite(nextCut)) vals.push(nextCut)
    let lo = Math.min(...vals), hi = Math.max(...vals)
    if (hi === lo) { hi += 0.5; lo -= 0.5 }
    const pad = (hi - lo) * 0.08
    lo -= pad; hi += pad

    const X = (age: number) => padL + ((age - x0) / (a1 - x0)) * plotW
    // Reversed for track: a faster time sits HIGHER on the page, which is the
    // direction athletes read progress in.
    const Y = (v: number) => {
      const f = (v - lo) / (hi - lo)
      return lower ? padT + f * plotH : padT + (1 - f) * plotH
    }

    const line = (set: ProjPoint[]) =>
      set.map((p) => `${X(PX(p.age)).toFixed(1)},${Y(p.projected).toFixed(1)}`).join(' ')

    // Closed corridor: along the optimistic edge, back along the pessimistic.
    const corridor =
      'M ' + S.map((p) => `${X(PX(p.age)).toFixed(1)},${Y(p.p75).toFixed(1)}`).join(' L ') +
      ' L ' + [...S].reverse().map((p) => `${X(PX(p.age)).toFixed(1)},${Y(p.p25).toFixed(1)}`).join(' L ') +
      ' Z'

    // Where the source cohort thins out.
    const thin = S.find((p) => p.n != null && p.n < THIN_N && p.age > a0)
    void thin

    // Label the corridor at the horizon rather than labelling the padded
    // domain extremes. "9.19" was just lo after padding — a number that
    // appears nowhere in the projection and means nothing to an athlete.
    // These two are the actual range five years out.
    const last = S[S.length - 1]

    // Best mark in the visible history — worth calling out, since the
    // projection is anchored on the PB rather than on recent form.
    const best = Hs.length
      ? Hs.reduce((b, r) => (better(r.value, b.value) ? r : b), Hs[0])
      : null

    // With one competition there is no span to read a direction from, and the
    // chart should say so rather than draw a line through a single date.
    const distinctDays = byDay.size

    return {
      a0, a1, aEnd, x0, today, shift, lo, hi, X, Y, PX, S, Hs, best, peak,
      dayBests, distinctDays,
      corridor, steadyLine: line(S),
      historyLine: dayBests.map((r) => `${X(r.age).toFixed(1)},${Y(r.value).toFixed(1)}`).join(' '),
      thinX: thin ? X(PX(thin.age)) : null,
      endBest: last.p75, endWorst: last.p25, endMedian: last.projected,
      peakInView: peak.age > a0 && peak.age <= aEnd,
    }
  }, [steady, history, nowAge, lower, nextCut])

  const summary = useMemo<HistorySummary | null>(() => {
    if (!geom) return null
    const d = geom.dayBests
    return {
      marks: geom.Hs.length,
      days: geom.distinctDays,
      spanYears: d.length > 1 ? d[d.length - 1].age - d[0].age : 0,
    }
  }, [geom])

  useEffect(() => { if (summary && onSummary) onSummary(summary) }, [summary, onSummary])

  if (!geom) return null
  const { X, Y } = geom
  const start = geom.S[0]

  return (
    <View>
      <Svg width="100%" height={H} viewBox={`0 0 ${W} ${H}`}>
        <Defs>
          <LinearGradient id="corridorFill" x1="0" y1="0" x2="0" y2="1">
            <Stop offset="0" stopColor={STEADY} stopOpacity="0.26" />
            <Stop offset="1" stopColor={STEADY} stopOpacity="0.06" />
          </LinearGradient>
        </Defs>

        {/* Grid */}
        {[0, 0.5, 1].map((f) => (
          <Line
            key={f}
            x1={padL} x2={W - padR}
            y1={padT + f * plotH} y2={padT + f * plotH}
            stroke="rgba(255,255,255,0.08)" strokeWidth={1}
          />
        ))}

        {/* The development range */}
        <Path d={geom.corridor} fill="url(#corridorFill)" stroke="none" />

        {/* Thin-evidence marker — beyond here the cohort behind each year's
            rate gets small, and the chart should not pretend otherwise. */}
        {geom.thinX != null && (
          <>
            <Line
              x1={geom.thinX} x2={geom.thinX} y1={padT} y2={padT + plotH}
              stroke="rgba(255,255,255,0.22)" strokeWidth={1} strokeDasharray="2 4"
            />
            <SvgText
              x={geom.thinX + 4} y={padT + 9}
              fontSize={8} fill="rgba(255,255,255,0.44)"
            >
              fewer athletes
            </SvgText>
          </>
        )}

        {/* Where they are today — the line every other line is measured from. */}
        <Line
          x1={padL} x2={W - padR} y1={Y(start.projected)} y2={Y(start.projected)}
          stroke="rgba(255,255,255,0.30)" strokeWidth={1} strokeDasharray="2 3"
        />
        <SvgText x={W - padR + 5} y={Y(start.projected) + 3} fontSize={8.5} fill="rgba(255,255,255,0.55)">
          PB
        </SvgText>

        {/* Next tier target */}
        {nextCut != null && Number.isFinite(nextCut) && (
          <>
            <Line
              x1={padL} x2={W - padR} y1={Y(nextCut)} y2={Y(nextCut)}
              stroke={colors.amber} strokeOpacity={0.65} strokeWidth={1} strokeDasharray="5 4"
            />
            <SvgText x={W - padR + 5} y={Y(nextCut) + 3} fontSize={8.5} fill={colors.amber}>
              {nextTierName ? nextTierName.slice(0, 9) : 'Target'}
            </SvgText>
          </>
        )}

        {/* Today. Everything left of this line happened; everything right of
            it is inference, and the chart should never blur the two. */}
        {geom.Hs.length > 0 && (
          <Line
            x1={X(geom.today)} x2={X(geom.today)} y1={padT} y2={padT + plotH}
            stroke="rgba(255,255,255,0.28)" strokeWidth={1}
          />
        )}

        {/* Raced marks — solid and white, because they are the only thing on
            this chart that actually happened. */}
        {geom.dayBests.length > 1 && (
          <Polyline points={geom.historyLine} fill="none" stroke={ACTUAL}
            strokeWidth={2} strokeLinecap="round" strokeLinejoin="round" opacity={0.9} />
        )}

        {/* Projection, dashed — the visual grammar for "not measured". */}
        <Polyline points={geom.steadyLine} fill="none" stroke={STEADY} strokeWidth={2.5}
          strokeDasharray="6 4" strokeLinecap="round" strokeLinejoin="round" />

        {/* Peak of the steady line — only when it falls inside the window.
            For a young athlete the projected peak is usually years past the
            horizon; the sentence under the chart names it either way. */}
        {geom.peakInView && (
          <>
            <Circle cx={X(geom.PX(geom.peak.age))} cy={Y(geom.peak.projected)} r={7}
              fill={STEADY} fillOpacity={0.22} />
            <Circle cx={X(geom.PX(geom.peak.age))} cy={Y(geom.peak.projected)} r={3.5} fill={STEADY} />
          </>
        )}

        {/* Every race, as its own dot. The PB gets a ring. */}
        {geom.Hs.map((r, i) => {
          const isBest = geom.best != null && r.age === geom.best.age && r.value === geom.best.value
          const isDayBest = geom.dayBests.some((d) => d.age === r.age && d.value === r.value)
          return (
            <Circle
              key={`${r.age}-${r.value}-${i}`}
              cx={X(r.age)} cy={Y(r.value)}
              r={isBest ? 4.5 : isDayBest ? 3 : 2.2}
              fill={isBest ? '#0B0C18' : ACTUAL}
              fillOpacity={isDayBest ? 1 : 0.45}
              stroke={isBest ? ACTUAL : 'none'}
              strokeWidth={isBest ? 2.5 : 0}
            />
          )
        })}

        {/* Where the projection is anchored. */}
        <Circle cx={X(geom.today)} cy={Y(start.projected)} r={4}
          fill={STEADY} stroke="#0B0C18" strokeWidth={1.5} />

        {/* The corridor's own edges at the horizon — real marks, not the
            padded domain. */}
        <SvgText x={W - padR + 5} y={Y(geom.endBest) + 3} fontSize={9} fill={STEADY}>
          {valueFmt(geom.endBest)}
        </SvgText>
        <SvgText x={W - padR + 5} y={Y(geom.endWorst) + 3} fontSize={9} fill="rgba(255,255,255,0.44)">
          {valueFmt(geom.endWorst)}
        </SvgText>

        {/* Age axis */}
        <SvgText x={X(geom.x0)} y={H - 10} fontSize={9} fill="rgba(255,255,255,0.44)" textAnchor="start">
          {`age ${Math.round(geom.x0)}`}
        </SvgText>
        {geom.Hs.length > 0 && geom.x0 < geom.today - 0.2 && (
          <SvgText x={X(geom.today)} y={H - 10} fontSize={9} fill="rgba(255,255,255,0.70)" textAnchor="middle">
            now
          </SvgText>
        )}
        {geom.peakInView && (
          <SvgText x={X(geom.PX(geom.peak.age))} y={H - 10} fontSize={9} fill={STEADY} textAnchor="middle">
            {`peak ${geom.peak.age}`}
          </SvgText>
        )}
        <SvgText x={X(geom.a1)} y={H - 10} fontSize={9} fill="rgba(255,255,255,0.44)" textAnchor="end">
          {`age ${Math.round(geom.a1)}`}
        </SvgText>
      </Svg>

      {/* Legend */}
      <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 16, marginTop: spacing.sm }}>
        <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6 }}>
          <View style={{ width: 14, height: 2.5, borderRadius: radius.hair, backgroundColor: ACTUAL }} />
          <Text style={{ fontSize: typeScale.label, color: colors.text.muted }}>Your races</Text>
        </View>
        <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6 }}>
          <View style={{ width: 14, height: 2.5, borderRadius: radius.hair, backgroundColor: STEADY, opacity: 0.9 }} />
          <Text style={{ fontSize: typeScale.label, color: colors.text.muted }}>Projected</Text>
        </View>
        <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6 }}>
          <View style={{
            width: 14, height: 9, borderRadius: radius.hair,
            backgroundColor: STEADY, opacity: 0.24,
          }} />
          <Text style={{ fontSize: typeScale.label, color: colors.text.muted }}>Slower / faster quarter</Text>
        </View>
      </View>
    </View>
  )
}
