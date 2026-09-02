// ═══════════════════════════════════════════════════════════════════════
// THE FIELD, AS ONE LINE.
//
// This replaces a ladder that drew a full-width bar for every position:
// 1st, 2nd, 3rd, 4th, 5th, 7th, 15th — eight grey bars with nothing in
// them, because by design the device never receives anybody else's value.
//
// That was a real mistake and worth naming. A BAR IMPLIES A QUANTITY. Eight
// empty ones do not read as "we are not telling you these" — they read as
// data that failed to load, which makes a privacy guarantee look like a bug.
// The honest drawing shows only what is actually known: how many people are
// in the field, and which one is you.
//
// One element about 60pt tall, instead of nine rows about 360pt tall. The
// screen gets a third of itself back and says strictly more.
//
// Under 24 in the field every position gets its own mark, because you can
// count them. Above that they would be hairlines, so it becomes a
// continuous track with a marker — the same reading either way.
// ═══════════════════════════════════════════════════════════════════════

import React from 'react'
import { View, Text } from 'react-native'
import { radius, typeScale, weight, numerals } from '../lib/theme'
import { ordinal } from '../lib/boards'

const H = 34
const DISCRETE_UPTO = 24

let skia: any | null | undefined
function getSkia() {
  if (skia !== undefined) return skia
  try {
    const m = require('@shopify/react-native-skia')
    skia = m?.Canvas && m?.RoundedRect && m?.BlurMask ? m : null
  } catch { skia = null }
  return skia
}

export default function FieldStrip({
  rank, field, width, accent, dim, ink, muted,
}: {
  rank: number
  field: number
  width: number
  accent: string
  dim: string
  ink: string
  muted: string
}) {
  const w = Math.max(60, width)
  const n = Math.max(1, field)
  const discrete = n <= DISCRETE_UPTO
  const S = getSkia()

  // Geometry. Discrete: one mark per position. Continuous: a track, and the
  // marker sits at the fraction of the field you occupy.
  const gap = discrete ? Math.min(6, w / (n * 4)) : 0
  const markW = discrete ? Math.max(3, (w - gap * (n - 1)) / n) : 3.5
  const xOf = (p: number) => discrete
    ? (p - 1) * (markW + gap)
    : ((p - 0.5) / n) * (w - markW)

  const mine = xOf(rank)

  return (
    <View>
      <View style={{ width: w, height: H }}>
        {S ? (
          <S.Canvas style={{ width: w, height: H }}>
            {/* Everybody else. Present, unmeasured, and unnamed. */}
            {discrete
              ? Array.from({ length: n }, (_, i) => i + 1).filter((p) => p !== rank).map((p) => (
                  <S.RoundedRect
                    key={p} x={xOf(p)} y={H / 2 - 5} width={markW} height={10} r={2}
                    color={dim} opacity={0.5}
                  />
                ))
              : (
                <S.RoundedRect x={0} y={H / 2 - 3} width={w} height={6} r={3}
                  color={dim} opacity={0.5} />
              )}

            {/* You. The bloom is the whole reason a 3pt mark reads as a
                person rather than a tick. */}
            <S.RoundedRect x={mine - 3} y={4} width={markW + 6} height={H - 8} r={6}
              color={accent} opacity={0.55}>
              <S.BlurMask blur={8} style="normal" />
            </S.RoundedRect>
            <S.RoundedRect x={mine} y={6} width={markW} height={H - 12} r={Math.min(3, markW / 2)}
              color="#FFFFFF" />
          </S.Canvas>
        ) : (
          <View style={{ flexDirection: 'row', alignItems: 'center', height: H, gap }}>
            {discrete ? (
              Array.from({ length: n }, (_, i) => i + 1).map((p) => (
                <View key={p} style={{
                  width: markW,
                  height: p === rank ? H - 12 : 10,
                  borderRadius: radius.hair,
                  backgroundColor: p === rank ? '#FFFFFF' : dim,
                  opacity: p === rank ? 1 : 0.5,
                }} />
              ))
            ) : (
              <View style={{ width: w, height: 6, borderRadius: radius.hair, backgroundColor: dim, opacity: 0.5 }} />
            )}
          </View>
        )}
      </View>

      {/* The ends of the field, and nothing between them — there is nothing
          between them we are entitled to draw. */}
      <View style={{ flexDirection: 'row', justifyContent: 'space-between', marginTop: 6 }}>
        <Text style={[e.end, { color: muted }]}>1st</Text>
        <Text style={[e.end, { color: muted }]}>{ordinal(n)}</Text>
      </View>
    </View>
  )
}

const e = {
  end: {
    fontSize: typeScale.micro, letterSpacing: 1.1, textTransform: 'uppercase' as const,
    fontWeight: weight.medium, ...numerals,
  },
}
