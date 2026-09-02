// ═══════════════════════════════════════════════════════════════════════
// WHERE YOU STAND IN THE WORLD — the card that does not wait for a network.
//
// Fetches the distribution, states the population it is drawn from, and
// hands the curve to Skia. Silent when the corpus has no population for
// the event, because a curve drawn off forty marks is a shape, not a field.
// ═══════════════════════════════════════════════════════════════════════

import React, { useEffect, useState } from 'react'
import { View, Text, LayoutChangeEvent } from 'react-native'
import { MonoKicker } from './ui'
import DistributionCurve from './DistributionCurve'
import { onImage, radius, rhythm, typeScale, weight } from '../lib/theme'
import { markDistribution, type MarkDistribution } from '../lib/corpus'
import { useTheme } from '../contexts/ThemeContext'

/** Under this many athletes the curve is a shape rather than a field. */
const FLOOR = 120

export default function CorpusStanding({
  discipline, sex, mark, colour, valueFmt,
}: {
  discipline: string
  sex: string | null
  mark: number
  colour: string
  valueFmt: (v: number) => string
}) {
  const { colors } = useTheme()
  const [dist, setDist] = useState<MarkDistribution>(null)
  const [w, setW] = useState(0)

  useEffect(() => {
    if (!discipline) { setDist(null); return }
    let cancelled = false
    markDistribution({ discipline, sex, mark })
      .then((d) => { if (!cancelled) setDist(d && d.athletes >= FLOOR ? d : null) })
      .catch(() => { if (!cancelled) setDist(null) })
    return () => { cancelled = true }
  }, [discipline, sex, mark])

  if (!dist) return null

  const onLayout = (e: LayoutChangeEvent) => {
    const nw = Math.round(e.nativeEvent.layout.width)
    if (nw && nw !== w) setW(nw)
  }

  return (
    <View
      onLayout={onLayout}
      style={{
        borderRadius: radius.card, borderWidth: 1,
        borderColor: colors.glass.border, backgroundColor: colors.glass.bg,
        padding: 18, marginBottom: rhythm.section,
      }}
    >
      <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' }}>
        <MonoKicker color={colors.text.muted}>The field</MonoKicker>
        <Text style={{
          fontSize: typeScale.micro, letterSpacing: 1.2, textTransform: 'uppercase',
          color: colors.text.dimmed, fontWeight: weight.medium,
        }}>
          World Athletics
        </Text>
      </View>

      <Text style={{
        fontSize: typeScale.body, color: colors.text.secondary,
        lineHeight: 20, marginTop: 6, marginBottom: 14,
      }}>
        Your board is still filling up. Here is the same question asked of
        every ranked athlete in your event.
      </Text>

      {w > 0 && (
        <DistributionCurve
          dist={dist}
          mark={mark}
          width={w - 36}
          colour={colour}
          valueFmt={valueFmt}
          population={`ranked ${sex === 'F' ? 'senior women' : 'senior men'}`}
        />
      )}

      {/* The population is elite and the card says so rather than letting
          "54%" be read as 54% of everybody. The corpus's slowest 1% of
          senior men still run 11.45. */}
      <Text style={{
        fontSize: typeScale.label, lineHeight: 17,
        color: colors.text.dimmed, marginTop: 10,
      }}>
        These are athletes ranked by World Athletics, not the general
        population — a median here is already a very fast time.
      </Text>
    </View>
  )
}
