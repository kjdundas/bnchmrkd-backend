// ═══════════════════════════════════════════════════════════════════════
// THE LANE — the gauge, drawn as what it is measuring.
//
// A 5pt arc between two labels is the shape every fitness app draws, and it
// was borrowed rather than chosen. bnchmrkd's own mark is a track-lane 'b';
// the thing this number describes is a sprinter on a bend. So the gauge is a
// lane: a band with two lane lines, the athlete's position in it, and the
// two standards at either end.
//
// ── WHY SKIA AND NOT THE SVG THIS REPLACED ───────────────────────────
// CORRECTION: I first justified this with contrast ratios — the arc at
// 1.00:1, its labels at 1.08, 1.20 and 1.59 — taken by point-sampling
// coordinates I had guessed. Those points were landing on the photograph
// between the glyphs and comparing it with itself. Re-measured properly the
// text on these screens passes comfortably. Do not repeat those figures.
//
// What survives that correction is the design argument, which never needed
// the numbers: a 5pt arc between two labels is the shape every fitness app
// draws, and the reason to spend Skia here is a GLOW and a SCRIM drawn into
// the same canvas, so the lane carries its own ground rather than depending
// on which photograph is behind it today. A drop shadow on an SVG stroke
// renders as nothing on iOS at this size and is ignored on Android — that
// part is a real capability gap, not a measurement.
//
// ── AND WHY IT FALLS BACK ────────────────────────────────────────────
// Same contract as BlockProgress: Skia is required lazily behind a
// capability check, because a binary older than the dependency throws at
// module scope and takes the screen with it. Without it the lane draws in
// react-native-svg — no bloom, no scrim, same geometry and the same reading.
// ═══════════════════════════════════════════════════════════════════════

import React from 'react'
import { View } from 'react-native'
import Svg, { Path, Circle, Line, Defs, LinearGradient as SvgGrad, Stop } from 'react-native-svg'
import { onDark } from '../lib/theme'

// Same geometry the SVG gauge used, so the hero's height does not move.
export const LANE_W = 216
export const LANE_H = 124
const R = 88, CX = 108, CY = 106

const LANE = 17        // the running surface
const EDGE = 1.5       // the painted lane lines
const GROUND = 'rgba(11,12,24,'

export const laneX = (f: number) => CX + R * Math.cos(Math.PI * (1 - f))
export const laneY = (f: number) => CY - R * Math.sin(Math.PI * (1 - f))

const ARC = `M ${CX - R} ${CY} A ${R} ${R} 0 0 1 ${CX + R} ${CY}`

let skia: any | null | undefined
function getSkia() {
  if (skia !== undefined) return skia
  try {
    const m = require('@shopify/react-native-skia')
    skia = m?.Canvas && m?.Path && m?.Skia && m?.BlurMask && m?.LinearGradient && m?.Circle && m?.vec ? m : null
  } catch { skia = null }
  return skia
}

export default function TrackLane({
  frac, latestFrac, colour, width = LANE_W, height = LANE_H,
}: {
  /** 0..1 along the lane — where the PB sits between the two standards. */
  frac: number
  /** The latest race, when it differs enough to be worth its own mark. */
  latestFrac?: number | null
  colour: string
  width?: number
  height?: number
}) {
  const S = getSkia()
  const f = Math.max(0, Math.min(1, frac))

  if (!S) {
    // ── react-native-svg fallback ──────────────────────────────────
    return (
      <View style={{ width, height }}>
        <Svg width={width} height={height} viewBox={`0 0 ${LANE_W} ${LANE_H}`}>
          <Defs>
            <SvgGrad id="lane" x1="0" y1="0" x2="1" y2="0">
              <Stop offset="0" stopColor={colour} stopOpacity="0.5" />
              <Stop offset="1" stopColor={colour} />
            </SvgGrad>
          </Defs>
          <Path d={ARC} fill="none" stroke="rgba(11,12,24,0.55)" strokeWidth={LANE} strokeLinecap="round" />
          <Path d={ARC} fill="none" stroke="rgba(255,255,255,0.20)" strokeWidth={EDGE} strokeLinecap="round" />
          <Path
            d={ARC} fill="none" stroke="url(#lane)" strokeWidth={LANE} strokeLinecap="round"
            strokeDasharray={`${Math.PI * R}`}
            strokeDashoffset={Math.PI * R * (1 - f)}
          />
          {latestFrac != null && (
            <Line
              x1={CX + (R - LANE / 2) * Math.cos(Math.PI * (1 - latestFrac))}
              y1={CY - (R - LANE / 2) * Math.sin(Math.PI * (1 - latestFrac))}
              x2={CX + (R + LANE / 2) * Math.cos(Math.PI * (1 - latestFrac))}
              y2={CY - (R + LANE / 2) * Math.sin(Math.PI * (1 - latestFrac))}
              stroke="rgba(255,255,255,0.85)" strokeWidth={2} strokeLinecap="round"
            />
          )}
          <Circle cx={laneX(f)} cy={laneY(f)} r={7} fill="#FFFFFF" />
        </Svg>
      </View>
    )
  }

  // ── Skia ─────────────────────────────────────────────────────────
  const path = S.Skia.Path.MakeFromSVGString(ARC)!
  const total = path.computeTightBounds ? Math.PI * R : Math.PI * R
  const mx = laneX(f), my = laneY(f)

  return (
    <View style={{ width, height }}>
      <S.Canvas style={{ width, height }}>
        {/* 1 · the lane's own ground, so the data does not depend on the
               photograph being dark in the right places today */}
        <S.Path path={path} style="stroke" strokeWidth={LANE + 7} strokeCap="round"
          color={GROUND + '0.62)'}>
          <S.BlurMask blur={6} style="normal" />
        </S.Path>

        {/* 2 · the lane still to run.
               It was rgba(255,255,255,0.09) — so dark it read as absence
               rather than as the rest of the distance. This is the part of
               the picture carrying the news (0.30s to find); it should look
               like lane, faintly lit by the same colour as the rest. */}
        <S.Path path={path} style="stroke" strokeWidth={LANE} strokeCap="round"
          color="rgba(255,255,255,0.10)" />
        <S.Path path={path} style="stroke" strokeWidth={LANE} strokeCap="round"
          start={f} end={1} color={colour} opacity={0.16} />

        {/* 3 · lane lines, which is what makes it read as a track */}
        <S.Path path={path} style="stroke" strokeWidth={LANE + EDGE * 2} strokeCap="round"
          color="rgba(255,255,255,0.16)" opacity={0.5} />
        <S.Path path={path} style="stroke" strokeWidth={LANE - EDGE * 2} strokeCap="round"
          color="rgba(11,12,24,0.30)" />

        {/* 4 · the distance covered.
               No blur along its length. A solid BlurMask here spread the
               glow evenly over everything already covered — so the brightest
               region of the picture was the ground the athlete had ALREADY
               made up, which carries no news, while the gap that does sat
               dark. Light belongs where you are, not where you have been. */}
        <S.Path path={path} style="stroke" strokeWidth={LANE} strokeCap="round"
          start={0} end={f}>
          <S.LinearGradient
            start={S.vec(0, 0)} end={S.vec(LANE_W, 0)}
            colors={[colour + '2E', colour]}
          />
        </S.Path>

        {/* 5 · the trail — the last stretch before the marker, and only
               that, so the lane reads as something travelled along rather
               than a region that is switched on. */}
        {f > 0.06 && (
          <S.Path path={path} style="stroke" strokeWidth={LANE} strokeCap="round"
            start={Math.max(0, f - 0.2)} end={f} color={colour} opacity={0.85}>
            <S.BlurMask blur={9} style="normal" />
          </S.Path>
        )}

        {/* 6 · the latest race, as a reading on the scale rather than a
               second needle */}
        {latestFrac != null && (
          <S.Path
            path={S.Skia.Path.MakeFromSVGString(
              `M ${CX + (R - LANE / 2) * Math.cos(Math.PI * (1 - latestFrac))} `
              + `${CY - (R - LANE / 2) * Math.sin(Math.PI * (1 - latestFrac))} `
              + `L ${CX + (R + LANE / 2) * Math.cos(Math.PI * (1 - latestFrac))} `
              + `${CY - (R + LANE / 2) * Math.sin(Math.PI * (1 - latestFrac))}`,
            )!}
            style="stroke" strokeWidth={2.5} strokeCap="round"
            color="rgba(255,255,255,0.9)"
          />
        )}

        {/* 7 · you, and the one light source in the picture. Two falloffs
               rather than one: a wide soft bloom that lifts the lane around
               the marker, and a tight bright core that keeps a 7pt dot
               legible over a bright stand. This is the whole reason the
               lane is drawn in Skia — a shadow on an SVG circle this size
               renders as nothing on iOS and is ignored on Android. */}
        <S.Circle cx={mx} cy={my} r={20} color={colour} opacity={0.34}>
          <S.BlurMask blur={18} style="normal" />
        </S.Circle>
        <S.Circle cx={mx} cy={my} r={11} color={colour} opacity={0.75}>
          <S.BlurMask blur={7} style="normal" />
        </S.Circle>
        <S.Circle cx={mx} cy={my} r={7.5} color="#FFFFFF" />
        <S.Circle cx={mx} cy={my} r={3} color={colour} />
      </S.Canvas>
    </View>
  )
}

export const laneUsesSkia = () => !!getSkia()
