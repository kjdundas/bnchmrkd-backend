// ═══════════════════════════════════════════════════════════════════════
// WHAT HAPPENED TO THE OTHERS — the corpus, on Home, for the first time.
//
// 1,084,255 results. 6,892 careers with a date of birth on every mark, so
// every performance has a decimal age attached. Until now the home screen —
// the one every athlete opens every day — used none of it.
//
// A tier arc is something any app can draw. "Four athletes were at 10.33 at
// your age; three of them went under 10.15 later" cannot be drawn by anyone
// without this data. It is the only thing on the screen a competitor could
// not ship next week.
//
// ── WHAT THIS MUST NOT BECOME ────────────────────────────────────────
// A forecast. Boccia tracked 5,981 jumpers: of those in the world top 50 at
// sixteen, 8% of men and 16% of women ever reached the senior top 50. So the
// line is written in the PAST TENSE about OTHER PEOPLE, always — what they
// did, never what you will do. The full context, the band and the sentence
// that says so live on Trajectory, and tapping this goes there.
//
// It is silent below four comparable careers. A claim about "athletes like
// you" resting on two of them is not a small claim, it is a wrong one.
// ═══════════════════════════════════════════════════════════════════════

import React, { useEffect, useState } from 'react'
import { View, Text } from 'react-native'
import { Ionicons } from '@expo/vector-icons'
import { Tappable } from './ui'
import { onImage, onDark, radius, rhythm, typeScale, weight, numerals } from '../lib/theme'
import { similarAthletes, type SimilarAthlete } from '../lib/corpus'
import { tapFeedback } from '../lib/haptics'

/** Below this, the corpus has an opinion but not a finding. */
const FLOOR = 4

export default function CorpusLine({
  discipline, sex, age, mark, target, lowerBetter, valueFmt, onOpen,
}: {
  discipline: string | null
  sex: string | null | undefined
  age: number | null
  mark: number | null
  /** The next tier's cut, when there is one — what "went on to" is measured against. */
  target?: number | null
  lowerBetter: boolean
  valueFmt: (v: number) => string
  onOpen: () => void
}) {
  const [rows, setRows] = useState<SimilarAthlete[] | null>(null)

  useEffect(() => {
    if (!discipline || age == null || mark == null) { setRows(null); return }
    let cancelled = false
    similarAthletes({ discipline, sex, age, mark, limit: 12 })
      .then((r) => { if (!cancelled) setRows(r) })
      .catch(() => { if (!cancelled) setRows([]) })
    return () => { cancelled = true }
  }, [discipline, sex, age, mark])

  if (!rows || rows.length < FLOOR) return null

  // Careers that carry a senior best are the ones that can answer "and then
  // what". A junior mark with nothing after it is a career we cannot see the
  // end of, not a career that ended.
  const withAfter = rows.filter((r) => r.seniorBest != null && r.ageAtSeniorBest != null)
  if (withAfter.length < FLOOR) return null

  const beat = target != null
    ? withAfter.filter((r) => (lowerBetter ? r.seniorBest! < target : r.seniorBest! > target))
    : []

  const ages = withAfter.map((r) => r.ageAtSeniorBest!).sort((a, b) => a - b)
  const medianAge = Math.round(ages[Math.floor(ages.length / 2)])

  return (
    <Tappable
      onPress={() => { tapFeedback(); onOpen() }}
      accessibilityLabel={
        `${withAfter.length} athletes in the database were at your mark at your age. `
        + (target != null
          ? `${beat.length} of them later went ${lowerBetter ? 'under' : 'over'} ${valueFmt(target)}. `
          : '')
        + 'Open Trajectory for the full picture.'
      }
      style={{
        flexDirection: 'row', alignItems: 'center', gap: 10,
        paddingHorizontal: 14, paddingVertical: 12,
        borderRadius: radius.card, borderWidth: 1,
        borderColor: 'rgba(255,255,255,0.10)',
        backgroundColor: 'rgba(11,12,24,0.45)',
        marginBottom: rhythm.section,
      }}
    >
      <Ionicons name="people-outline" size={16} color={onDark.accent} />
      <Text style={{ flex: 1, fontSize: typeScale.caption, color: onImage.muted, lineHeight: 19 }}>
        <Text style={{ color: onImage.ink, fontWeight: weight.bold, ...numerals }}>
          {withAfter.length}
        </Text>
        {' athletes were at your mark at '}
        <Text style={{ color: onImage.ink, fontWeight: weight.bold, ...numerals }}>{Math.floor(age!)}</Text>
        {target != null && beat.length > 0 ? (
          <>
            {'. '}
            <Text style={{ color: onImage.ink, fontWeight: weight.bold, ...numerals }}>{beat.length}</Text>
            {` went ${lowerBetter ? 'under' : 'over'} `}
            <Text style={{ color: onImage.ink, fontWeight: weight.bold, ...numerals }}>{valueFmt(target)}</Text>
            {` by ${medianAge}.`}
          </>
        ) : (
          <>{`. Their best came at ${medianAge}, on average.`}</>
        )}
      </Text>
      <Ionicons name="chevron-forward" size={15} color={onImage.dim} />
    </Tappable>
  )
}
