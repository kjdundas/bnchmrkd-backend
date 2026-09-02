// ═══════════════════════════════════════════════════════════════════════
// WHERE YOU STAND — the Boards answer, in one line, on Home.
//
// Home asks four questions and this is the third: what did I do, what am I
// doing today, where do I sit, what changed. The Boards tab owns the full
// answer — every scope, every metric, the suppression rules and the reasons.
// This is the one number an athlete would say out loud, and a way in.
//
// It renders NOTHING rather than an empty state. A block that says "no
// position yet" every day teaches the athlete to stop reading Home, and the
// reason already has a home on the Boards tab, phrased properly. Silence
// here is not a gap; it is the block declining to take up space it has not
// earned.
//
// Squad first, then the world. An athlete in a squad of six cares far more
// about those six than about a global field, and the squad board is the one
// that fills up first.
// ═══════════════════════════════════════════════════════════════════════

import React, { useEffect, useState } from 'react'
import { View, Text , StyleProp, ViewStyle} from 'react-native'
import { Ionicons } from '@expo/vector-icons'
import { GlassPanel, MonoKicker } from './ui'
import { onImage, onDark, radius, spacing, rhythm, typeScale, weight, numerals } from '../lib/theme'
import { fetchPosition, ordinal, BAND_LABEL, type Position, type Scope } from '../lib/boards'

const ORDER: { scope: Scope; label: string }[] = [
  { scope: 'squad', label: 'Squad' },
  { scope: 'world', label: 'bnchmrkd' },
]

export default function HomeStanding({
  discipline, onOpen,
 style,
}: {
  discipline: string | null
  onOpen: () => void
  /** Placement belongs to the HOST. Screens in this app do not agree on how
      to space top-level blocks — Home and Trajectory put horizontal padding
      on the scroll container, Boards puts it on each card — so a component
      that hardcodes its own margins is only correct on the screen it was
      written for. Reused elsewhere it lands flush against its neighbour, or
      full-bleed while everything around it is inset. Both happened. */
  style?: StyleProp<ViewStyle>
}) {
  const [pos, setPos] = useState<Position | null>(null)
  const [where, setWhere] = useState<string>('')

  useEffect(() => {
    if (!discipline) { setPos(null); return }
    let cancelled = false
    ;(async () => {
      for (const { scope, label } of ORDER) {
        try {
          const p = await fetchPosition({ scope, kind: 'performance', key: discipline })
          if (cancelled) return
          // A rank is the only thing worth showing here. Every other outcome —
          // too few athletes, opted out, nothing logged — is an answer the
          // Boards tab gives properly, with the reason attached.
          if (p.rank != null && p.field > 0) { setPos(p); setWhere(label); return }
        } catch { /* a board that cannot answer is not an error on Home */ }
      }
      if (!cancelled) setPos(null)
    })()
    return () => { cancelled = true }
  }, [discipline])

  if (!pos || pos.rank == null) return null

  const rank = pos.rank
  const field = pos.field

  // Positions, evenly spaced — never spaced by value. A bar whose length
  // encodes a mark lets anyone with a ruler and their own labelled number
  // read off everybody else's. Ordinal pips carry no such information.
  const pips = Array.from({ length: Math.min(field, 12) }, (_, i) => {
    const p = field <= 12 ? i + 1 : Math.round(((i + 1) / 12) * field)
    return { key: i, me: field <= 12 ? p === rank : Math.abs(p - rank) < field / 24 }
  })

  return (
    <GlassPanel
      tone="deep"
      intensity={24}
      radius={radius.card}
      onPress={onOpen}
      accessibilityLabel={`You are ${ordinal(rank)} of ${field} in ${where}${discipline ? ', ' + discipline : ''}. Open the boards.`}
      style={[{ padding: 16, marginBottom: rhythm.section }, style]}
    >
      <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' }}>
        <MonoKicker color={onImage.dim}>Where you stand</MonoKicker>
        <Ionicons name="chevron-forward" size={14} color={onImage.dim} />
      </View>

      <View style={{ flexDirection: 'row', alignItems: 'baseline', justifyContent: 'space-between', marginTop: 6 }}>
        <View style={{ flexDirection: 'row', alignItems: 'baseline', gap: 8 }}>
          <Text style={{
            fontSize: typeScale.figure, fontWeight: weight.bold, color: onImage.ink,
            letterSpacing: -1, ...numerals,
          }}>
            {ordinal(rank)}
          </Text>
          <Text style={{ fontSize: typeScale.caption, fontWeight: weight.medium, color: onImage.muted, ...numerals }}>
            of {field}
          </Text>
        </View>
        <Text style={{
          fontSize: typeScale.label, letterSpacing: 1.6, textTransform: 'uppercase',
          color: onImage.dim, fontWeight: weight.medium,
        }}>
          {where}{discipline ? ` · ${discipline}` : ''}
        </Text>
      </View>

      <View style={{ flexDirection: 'row', gap: 4, marginTop: 12 }}>
        {pips.map((p) => (
          <View
            key={p.key}
            style={{
              flex: 1, height: 3, borderRadius: radius.hair,
              backgroundColor: p.me ? onDark.accent : 'rgba(255,255,255,0.16)',
            }}
          />
        ))}
      </View>

      {!!pos.band && (
        <Text style={{ fontSize: typeScale.caption, color: onImage.muted, marginTop: 9 }}>
          {BAND_LABEL[pos.band]} of the field
        </Text>
      )}
    </GlassPanel>
  )
}
