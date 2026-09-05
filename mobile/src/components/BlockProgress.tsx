// ═══════════════════════════════════════════════════════════════════════
// WHERE TODAY SITS IN THE BLOCK — the first Skia in this app.
//
// This was a sentence: "Week 2 of 4 · Build — Increase sled push distance to
// 25 m." Four weeks is four marks. The deload is the thing an athlete most
// wants to see coming and most easily forgets, and you cannot see anything
// coming in prose.
//
// ── WHY SKIA, HERE, AND NOWHERE ELSE YET ─────────────────────────────
// `@shopify/react-native-skia` has been in package.json for a while with
// zero call sites, alongside Reanimated, expo-symbols and zustand — the same
// pattern as the four unused primitives in ui.tsx. It earns its place on
// exactly one thing a React Native View cannot do: a real GLOW. `shadowRadius`
// on a 3pt-tall bar renders as nothing on iOS and is ignored outright on
// Android. A BlurMask is light bleeding out of the mark, which is what makes
// the current week read as NOW rather than as one more segment.
//
// Spending it once is the point. A card where every element glows is the
// same failure as a card where every block is a card: if everything is
// emphasised, nothing is.
//
// ── AND WHY IT FALLS BACK ────────────────────────────────────────────
// Skia is a native module that this app has never once executed. If the
// installed binary predates the dependency, or the app is running in Expo
// Go, importing it throws at module scope and takes the whole screen with
// it. So it is required lazily and the plain-View version renders instead —
// same geometry, same colours, no bloom. Nobody loses the information
// because the build is old.
// ═══════════════════════════════════════════════════════════════════════

import React, { useMemo } from 'react'
import { View, Text, StyleSheet } from 'react-native'
import { onImage, onDark, radius, typeScale, weight } from '../lib/theme'
import type { BlockWeek } from '../lib/schedule'

const AMBER = '#F59E0B'
const TRACK = 'rgba(255,255,255,0.12)'
const PAST = 'rgba(255,255,255,0.30)'

const H = 4          // bar height
const GAP = 4        // between segments
const PAD = 10       // room for the glow to bleed into, top and bottom

/** Loaded once, on first render, and never again if it fails. */
let skia: any | null | undefined
function getSkia() {
  if (skia !== undefined) return skia
  try {
    const m = require('@shopify/react-native-skia')
    skia = m?.Canvas && m?.RoundedRect && m?.BlurMask && m?.Group ? m : null
  } catch {
    skia = null
  }
  return skia
}

export default function BlockProgress({ block, width }: { block: BlockWeek; width: number }) {
  const total = Math.max(1, block.total || 1)
  const week = Math.min(Math.max(1, block.week || 1), total)
  const deload = block.phase === 'deload'
  const live = deload ? AMBER : onDark.accent

  const segW = useMemo(
    () => Math.max(2, (width - GAP * (total - 1)) / total),
    [width, total],
  )

  const S = getSkia()

  return (
    <View style={s.wrap}>
      {S ? (
        <S.Canvas style={{ width, height: H + PAD * 2 }}>
          {Array.from({ length: total }, (_, i) => {
            const n = i + 1
            const x = i * (segW + GAP)
            const isNow = n === week
            const colour = isNow ? live : n < week ? PAST : TRACK
            return (
              <S.Group key={n}>
                {/* The bloom sits under the mark, not around the card. */}
                {isNow && (
                  <S.RoundedRect
                    x={x} y={PAD} width={segW} height={H} r={H / 2} color={live} opacity={0.9}
                  >
                    <S.BlurMask blur={7} style="normal" />
                  </S.RoundedRect>
                )}
                <S.RoundedRect x={x} y={PAD} width={segW} height={H} r={H / 2} color={colour} />
              </S.Group>
            )
          })}
        </S.Canvas>
      ) : (
        // Same geometry, no bloom. An old build loses the light, not the week.
        <View style={[s.fallback, { width, marginVertical: PAD }]}>
          {Array.from({ length: total }, (_, i) => {
            const n = i + 1
            return (
              <View
                key={n}
                style={{
                  width: segW, height: H, borderRadius: radius.hair,
                  backgroundColor: n === week ? live : n < week ? PAST : TRACK,
                }}
              />
            )
          })}
        </View>
      )}

      <Text style={s.label}>
        Week {week} of {total} · <Text style={{ color: live, fontWeight: weight.bold }}>
          {deload ? 'Deload' : 'Build'}
        </Text>
      </Text>
      {!!block.adjustment && <Text style={s.note}>{block.adjustment}</Text>}
    </View>
  )
}

const s = StyleSheet.create({
  wrap: { marginTop: 4 },
  fallback: { flexDirection: 'row', gap: GAP },
  label: { fontSize: typeScale.label, color: onImage.muted, fontWeight: weight.medium },
  note: { fontSize: typeScale.label, lineHeight: 17, color: onImage.dim, marginTop: 3 },
})
