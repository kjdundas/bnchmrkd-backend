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
//
// ── AND IT HAS TO KNOW HOW OLD YOU ARE ───────────────────────────────
// The first version of this said "3 went under 10.15 by 25" to a
// THIRTY-ONE-year-old, because it took the median age-at-best across every
// matched career without checking that age was still ahead of the athlete.
// Told to a 31-year-old, "by 25" is not a projection, it is a fact about the
// past dressed as one about the future — and it is the kind of number that
// looks plausible enough to go unread.
//
// So there are two modes, and the athlete's age picks them:
//
//   FORWARD  enough matched careers whose best came AFTER the age you are
//            now. "N were here at 17; M went under 10.15 by 22." A real
//            statement about what came next.
//   PEER     everyone comparable has already had their best, which is the
//            normal case for a masters athlete. There is no "next" to
//            describe, so it does not invent one: it says who else was
//            here, and how many were still racing afterwards.
//
// A 31-year-old is not a failed 17-year-old, and the corpus should not
// address them as one.
// ═══════════════════════════════════════════════════════════════════════

import React, { useEffect, useState } from 'react'
import { View, Text , StyleProp, ViewStyle} from 'react-native'
import { Ionicons } from '@expo/vector-icons'
import { Tappable } from './ui'
import { onImage, onDark, radius, rhythm, typeScale, weight, numerals } from '../lib/theme'
import { similarAthletes, type SimilarAthlete } from '../lib/corpus'
import { tapFeedback } from '../lib/haptics'

/** Below this, the corpus has an opinion but not a finding. */
const FLOOR = 4

export default function CorpusLine({
  discipline, sex, age, mark, target, lowerBetter, valueFmt, onOpen,
 style,
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
  /** Placement belongs to the HOST. Screens in this app do not agree on how
      to space top-level blocks — Home and Trajectory put horizontal padding
      on the scroll container, Boards puts it on each card — so a component
      that hardcodes its own margins is only correct on the screen it was
      written for. Reused elsewhere it lands flush against its neighbour, or
      full-bleed while everything around it is inset. Both happened. */
  style?: StyleProp<ViewStyle>
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

  if (!rows || rows.length < FLOOR || age == null) return null

  const median = (xs: number[]) =>
    Math.round([...xs].sort((a, b) => a - b)[Math.floor(xs.length / 2)])

  // Careers that carry a senior best are the ones that can answer "and then
  // what". A junior mark with nothing after it is a career we cannot see the
  // end of, not a career that ended.
  const scored = rows.filter((r) => r.seniorBest != null && r.ageAtSeniorBest != null)

  // The only careers that can describe YOUR future are the ones whose best
  // was still ahead of them at the age you are now.
  const ahead = scored.filter((r) => r.ageAtSeniorBest! > age + 0.5)
  const beat = target != null
    ? ahead.filter((r) => (lowerBetter ? r.seniorBest! < target : r.seniorBest! > target))
    : []

  const forward = ahead.length >= FLOOR && beat.length > 0 && target != null
  if (!forward && rows.length < FLOOR) return null

  const byAge = forward ? median(beat.map((r) => r.ageAtSeniorBest!)) : null

  // Peer mode: no "next" to describe, so describe the company instead.
  const stillRacing = rows.filter((r) => (r.yearsStillCompeting ?? 0) >= 2)
  const stillYears = stillRacing.length
    ? median(stillRacing.map((r) => r.yearsStillCompeting!))
    : null

  return (
    <Tappable
      onPress={() => { tapFeedback(); onOpen() }}
      accessibilityLabel={
        `${forward ? ahead.length : rows.length} athletes in the database were at your mark at your age. `
        + (forward
          ? `${beat.length} of them later went ${lowerBetter ? 'under' : 'over'} ${valueFmt(target as number)}. `
          : stillYears != null
            ? `${stillRacing.length} were still racing ${stillYears} years later. `
            : '')
        + 'Open Trajectory for the full picture.'
      }
      style={[{
        flexDirection: 'row', alignItems: 'center', gap: 10,
        paddingHorizontal: 14, paddingVertical: 12,
        borderRadius: radius.card, borderWidth: 1,
        borderColor: 'rgba(255,255,255,0.10)',
        backgroundColor: 'rgba(11,12,24,0.45)',
        marginBottom: rhythm.section,
      }, style]}
    >
      <Ionicons name="people-outline" size={16} color={onDark.accent} />
      <Text style={{ flex: 1, fontSize: typeScale.caption, color: onImage.muted, lineHeight: 19 }}>
        <Text style={{ color: onImage.ink, fontWeight: weight.bold, ...numerals }}>
          {forward ? ahead.length : rows.length}
        </Text>
        {' athletes were at your mark at '}
        <Text style={{ color: onImage.ink, fontWeight: weight.bold, ...numerals }}>{Math.floor(age)}</Text>
        {forward ? (
          <>
            {'. '}
            <Text style={{ color: onImage.ink, fontWeight: weight.bold, ...numerals }}>{beat.length}</Text>
            {` went ${lowerBetter ? 'under' : 'over'} `}
            <Text style={{ color: onImage.ink, fontWeight: weight.bold, ...numerals }}>
              {valueFmt(target as number)}
            </Text>
            {` by ${byAge}.`}
          </>
        ) : stillYears != null ? (
          <>
            {'. '}
            <Text style={{ color: onImage.ink, fontWeight: weight.bold, ...numerals }}>{stillRacing.length}</Text>
            {` were still racing ${stillYears} years later.`}
          </>
        ) : <>{'.'}</>}
      </Text>
      <Ionicons name="chevron-forward" size={15} color={onImage.dim} />
    </Tappable>
  )
}
