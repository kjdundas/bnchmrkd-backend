// ═══════════════════════════════════════════════════════════════════════
// THE FIELD — every ranked athlete in the event, and one lit line for you.
//
// The Boards tab could only ever rank an athlete against other bnchmrkd
// accounts. With a squad of one that is four rows of filters over an
// apology: "Not enough people yet", and a screen 40% empty. The board was
// waiting for a network effect to arrive before it could say anything.
//
// It does not have to wait. 892 ranked senior men have run a 100m in the
// corpus and 5,228 season bests sit behind that curve, so "where do I
// stand" has an answer today, for the first athlete to install the app.
//
// ── WHAT THIS MUST SAY OUT LOUD ──────────────────────────────────────
// The population is ELITE. "Faster than 54% of men" and "faster than 54%
// of RANKED senior men" are wildly different claims and only the second is
// true — the corpus's slowest 1% of senior men run 11.45. The caller passes
// the population in words and it is drawn, not implied.
//
// ── WHY SKIA ─────────────────────────────────────────────────────────
// Two things, and react-native-svg does neither. A soft gradient fill under
// a curve — SVG can gradient, but not blend it into a dark ground without
// a hard edge at the baseline. And a real GLOW on the marker line, which is
// what makes one hairline read as "you" against 26 buckets of everybody
// else. Falls back to a plain SVG rendering behind the same capability
// check BlockProgress and TrackLane use: an older binary loses the bloom,
// not the reading.
// ═══════════════════════════════════════════════════════════════════════

import React, { useMemo } from 'react'
import { View, Text } from 'react-native'
import Svg, { Path as SvgPath, Line as SvgLine } from 'react-native-svg'
import { onImage, onDark, typeScale, weight, numerals } from '../lib/theme'
import type { MarkDistribution } from '../lib/corpus'

const H = 132
const PAD_T = 14
const BASE = H - 26          // room under the curve for the two end labels

let skia: any | null | undefined
function getSkia() {
  if (skia !== undefined) return skia
  try {
    const m = require('@shopify/react-native-skia')
    skia = m?.Canvas && m?.Path && m?.Skia && m?.BlurMask && m?.LinearGradient && m?.vec
      ? m : null
  } catch { skia = null }
  return skia
}

/** A closed area path through the bin tops, smoothed with midpoint curves. */
function buildPaths(bins: { n: number }[], w: number) {
  const peak = Math.max(1, ...bins.map((b) => b.n))
  const step = w / (bins.length - 1)
  const pts = bins.map((b, i) => ({
    x: i * step,
    y: PAD_T + (BASE - PAD_T) * (1 - b.n / peak),
  }))
  let line = `M ${pts[0].x} ${pts[0].y}`
  for (let i = 1; i < pts.length; i++) {
    const p = pts[i - 1], c = pts[i]
    const mx = (p.x + c.x) / 2
    line += ` C ${mx} ${p.y} ${mx} ${c.y} ${c.x} ${c.y}`
  }
  const area = `${line} L ${w} ${BASE} L 0 ${BASE} Z`
  return { line, area }
}

export default function DistributionCurve({
  dist, mark, width, colour, valueFmt, population,
}: {
  dist: NonNullable<MarkDistribution>
  mark: number
  width: number
  colour: string
  valueFmt: (v: number) => string
  /** Named, never implied. e.g. "ranked senior men, 20–34". */
  population: string
}) {
  const w = Math.max(80, width)
  const { line, area } = useMemo(() => buildPaths(dist.bins, w), [dist.bins, w])

  const lo = dist.bins[0].lo
  const hi = dist.bins[dist.bins.length - 1].hi
  const at = (v: number) => Math.max(0, Math.min(w, ((v - lo) / (hi - lo)) * w))
  const mx = at(mark)
  const medx = at(dist.p50)
  const inRange = mark >= lo && mark <= hi

  const S = getSkia()
  const beats = Math.round(dist.percentile)

  return (
    <View>
      <View style={{ width: w, height: H }}>
        {S ? (
          <S.Canvas style={{ width: w, height: H }}>
            <S.Path path={S.Skia.Path.MakeFromSVGString(area)!}>
              <S.LinearGradient
                start={S.vec(0, PAD_T)} end={S.vec(0, BASE)}
                colors={[colour + '59', colour + '00']}
              />
            </S.Path>
            <S.Path path={S.Skia.Path.MakeFromSVGString(line)!} style="stroke"
              strokeWidth={1.5} color={colour} opacity={0.85} />

            {/* The middle of the field, quietly. */}
            <S.Path
              path={S.Skia.Path.MakeFromSVGString(`M ${medx} ${PAD_T} L ${medx} ${BASE}`)!}
              style="stroke" strokeWidth={1} color="rgba(255,255,255,0.22)" />

            {/* You. The glow is the whole reason this is Skia — it is what
                makes one hairline read as yourself among everybody else. */}
            {inRange && (
              <>
                <S.Path
                  path={S.Skia.Path.MakeFromSVGString(`M ${mx} ${PAD_T - 6} L ${mx} ${BASE}`)!}
                  style="stroke" strokeWidth={7} color={colour} opacity={0.5}>
                  <S.BlurMask blur={9} style="normal" />
                </S.Path>
                <S.Path
                  path={S.Skia.Path.MakeFromSVGString(`M ${mx} ${PAD_T - 6} L ${mx} ${BASE}`)!}
                  style="stroke" strokeWidth={2} color="#FFFFFF" />
                <S.Circle cx={mx} cy={PAD_T - 6} r={9} color={colour} opacity={0.55}>
                  <S.BlurMask blur={8} style="normal" />
                </S.Circle>
                <S.Circle cx={mx} cy={PAD_T - 6} r={3.5} color="#FFFFFF" />
              </>
            )}
          </S.Canvas>
        ) : (
          <Svg width={w} height={H}>
            <SvgPath d={area} fill={colour} fillOpacity={0.22} />
            <SvgPath d={line} stroke={colour} strokeWidth={1.5} fill="none" opacity={0.85} />
            <SvgLine x1={medx} y1={PAD_T} x2={medx} y2={BASE} stroke="rgba(255,255,255,0.22)" strokeWidth={1} />
            {inRange && (
              <SvgLine x1={mx} y1={PAD_T - 6} x2={mx} y2={BASE} stroke="#FFFFFF" strokeWidth={2} />
            )}
          </Svg>
        )}
      </View>

      {/* The axis, said in marks rather than numbers on a scale. */}
      <View style={{ flexDirection: 'row', justifyContent: 'space-between', marginTop: -18 }}>
        <Text style={[t.end, { color: onImage.dim }]}>{valueFmt(dist.lowerBetter ? hi : lo)}</Text>
        <Text style={[t.end, { color: onImage.dim }]}>{valueFmt(dist.lowerBetter ? lo : hi)}</Text>
      </View>

      <Text style={[t.read, { color: onImage.muted }]}>
        <Text style={{ color: onImage.ink, fontWeight: weight.bold, ...numerals }}>
          {valueFmt(mark)}
        </Text>
        {` — ${dist.lowerBetter ? 'faster' : 'further'} than `}
        <Text style={{ color: onDark.accent, fontWeight: weight.bold, ...numerals }}>{beats}%</Text>
        {` of ${population}`}
      </Text>
      <Text style={[t.pop, { color: onImage.dim }]}>
        {dist.athletes.toLocaleString()} athletes · {dist.total.toLocaleString()} season bests ·
        median {valueFmt(dist.p50)}
      </Text>
    </View>
  )
}

const t = {
  end: { fontSize: typeScale.micro, letterSpacing: 0.6, ...numerals } as const,
  read: { fontSize: typeScale.caption, lineHeight: 19, marginTop: 14 } as const,
  pop: { fontSize: typeScale.label, lineHeight: 16, marginTop: 4 } as const,
}
