// ════════════════════════════════════════════════════════════════════════
// WHERE THIS COULD GO — the development projection.
//
// Lifted out of TrajectoryScreen so the COACH sees the same chart as the
// athlete. Not a similar one: the same component, the same curves, the same
// footnote about what the band is and is not.
//
// That matters more here than it usually does. A coach and an athlete
// looking at differently-drawn versions of the same projection will read
// different futures out of them, and the disagreement will surface in a
// conversation about a young person's career. One definition, one picture.
// ════════════════════════════════════════════════════════════════════════

import React, { useEffect, useMemo, useState } from 'react'
import { View, Text, StyleSheet } from 'react-native'
import { Ionicons } from '@expo/vector-icons'
import { colors, spacing, typeScale, weight } from '../lib/theme'
import { AlmanacCard } from './ui'
import ProjectionChart, { type HistorySummary } from './ProjectionChart'
import { getTier } from '../lib/performanceTiers'
import { getAgeGroup } from '../lib/performanceLevels'
import { isLowerBetter, formatMark as formatPerformance } from '../lib/disciplineScience'
import { hasImprovementCurves, projectAllTrajectories } from '../lib/improvementCurves'
import {
  trajectoryBand, confidenceAt, CONFIDENCE_COPY,
  type BandPoint, type Confidence,
} from '../lib/corpus'

export default function ImprovementScenariosSection({
  discipline,
  pb,
  age,
  sex,
  history,
  nowAge,
}: {
  discipline: string
  pb: number
  age: number | null
  sex: string
  /** Raced marks with the athlete's age AT THE TIME of each race. */
  history: { age: number; value: number; date?: string }[]
  /** Fractional age today — the boundary between raced and projected. */
  nowAge?: number
}) {
  // Why this section rendered nothing for two years: it passed 'female' /
  // 'male' into a table keyed '100m_Female', so the lookup always missed,
  // projectPerformance returned [], and the guard below dropped the whole
  // card. `sex` is now passed through untouched — improvementCurves
  // normalises it — and the failure modes are told apart instead of all
  // collapsing into one silent null.
  // ── The band, observed rather than projected ────────────────────────
  //
  // The bundled curves multiply the athlete's own PB forward by population
  // improvement RATES, compounding a percentage a year and extrapolating
  // with a decay factor once the table runs out. That was the best available
  // when the only data was 38 hard-coded curves.
  //
  // The corpus can answer the question directly instead: of every real
  // careers, find the athletes who were within 4% of this mark at this age,
  // and report what they ACTUALLY ran at every later age. No compounding, no
  // extrapolation, no decay constant — and a sample size at every point,
  // which is the thing the old curves could not give and the reason a band
  // off nine athletes must not be drawn like a band off nine hundred.
  const [band, setBand] = useState<BandPoint[] | null>(null)
  const [bandDone, setBandDone] = useState(false)

  useEffect(() => {
    let live = true
    if (!pb || !age) { setBand(null); setBandDone(true); return }
    setBandDone(false)
    trajectoryBand({ discipline, sex, age, mark: pb })
      .then((rows) => { if (live) setBand(rows.length >= 2 ? rows : null) })
      .finally(() => { if (live) setBandDone(true) })
    return () => { live = false }
  }, [discipline, sex, age, pb])

  const fromCorpus = useMemo(() => {
    if (!band || age == null) return null
    // Only forward: the athlete's own past is drawn from their own results,
    // and other people's pasts are not their history.
    return band
      .filter((b) => b.age >= Math.floor(age))
      .map((b) => ({ age: b.age, projected: b.p50, p25: b.p25, p75: b.p75, n: b.n }))
  }, [band, age])

  const { projections, blocked } = useMemo(() => {
    if (!pb) return { projections: null, blocked: 'nopb' as const }
    if (!age) return { projections: null, blocked: 'noage' as const }
    if (!hasImprovementCurves(discipline, sex)) {
      return { projections: null, blocked: 'nocurve' as const }
    }
    try {
      const result = projectAllTrajectories(pb, age, discipline, sex)
      if (!result?.steady?.length || result.steady.length < 2) {
        return { projections: null, blocked: 'noproj' as const }
      }
      return { projections: result, blocked: null }
    } catch (e) {
      // Was a bare `catch { return null }`. A throw in the projection maths
      // erased the section with no trace anywhere — which is exactly how a
      // dead feature stays dead.
      console.warn('[Trajectory] projection failed for', discipline, sex, e)
      return { projections: null, blocked: 'error' as const }
    }
  }, [pb, age, discipline, sex])

  const lower = isLowerBetter(discipline)
  const confidence: Confidence = band && age != null ? confidenceAt(band, age) : 'none'
  // The corpus wins where it has anything to say; the curves stay as the
  // fallback for events and ages it does not reach.
  const line = fromCorpus && fromCorpus.length >= 2 ? fromCorpus : projections?.steady

  const [histSummary, setHistSummary] = useState<HistorySummary | null>(null)

  // Pulled through so the chart can draw the next tier as a target line —
  // the same number the Tier Positioning card above quotes as the gap.
  const ageGroup = age ? getAgeGroup(age) : 'Senior'
  const tierNow = getTier(discipline, sex, ageGroup, pb)
  const nextCut = tierNow?.nextCut
  const nextTierName = tierNow?.nextTierName

  if (!line && !bandDone) return null
  if (!line) {
    const message =
      blocked === 'noage'
        ? 'Add your date of birth in Profile and we can project this forward — the curves are age-dependent, so there is nothing to anchor to without it.'
        : blocked === 'nocurve'
          ? `We don't hold development curves for ${discipline} yet, so there's nothing honest to project.`
          : blocked === 'error'
            ? "Couldn't build a projection from this mark. Pull to refresh."
            : 'Not enough to project from yet.'

    // Renders the card rather than vanishing. A section that disappears is
    // indistinguishable from a section that was never built.
    return (
      <AlmanacCard glass kicker="FUTURE" title="Improvement Scenarios" accent={colors.orange[500]}>
        <View style={styles.calNote}>
          <Ionicons name="information-circle-outline" size={13} color={colors.text.muted} />
          <Text style={styles.calNoteText}>{message}</Text>
        </View>
      </AlmanacCard>
    )
  }

  // The steady trajectory is the headline; the other two are context. Web
  // removed its own version of this as "a dense table that didn't earn its
  // space", and three cards of peak values had the same problem — they show
  // three endpoints where the interesting thing is the shape between here and
  // there.
  const peakOf = (set: any[]) =>
    (set || []).reduce(
      (best: any, pt: any) =>
        !best ? pt : (lower ? (pt.projected < best.projected ? pt : best)
          : (pt.projected > best.projected ? pt : best)),
      null,
    )
  const peak = peakOf(line)
  const gain = peak ? (lower ? pb - peak.projected : peak.projected - pb) : null
  const peakTier = peak
    ? getTier(discipline, sex, getAgeGroup(peak.age), peak.projected)
    : null

  return (
    <AlmanacCard glass kicker="FUTURE" title="Where this could go" accent={colors.orange[500]}>
      <ProjectionChart
        steady={line}
        history={history}
        nowAge={nowAge}
        lower={lower}
        valueFmt={(v) => formatPerformance(v, discipline)}
        nextCut={nextCut ?? null}
        nextTierName={nextTierName ?? null}
        onSummary={setHistSummary}
      />

      {/* What the history could actually support. A chart that silently draws
          four marks from one afternoon as if it were a season is worse than
          one that says what it has. */}
      {histSummary && histSummary.days < 2 && (
        <View style={styles.calNote}>
          <Ionicons name="information-circle-outline" size={13} color={colors.text.muted} />
          <Text style={styles.calNoteText}>
            {histSummary.marks > 1
              ? `All ${histSummary.marks} of your ${discipline} marks are from one competition, so there's no trend to read yet — the dots sit on the same date. Log results from another meet and the line will have something to follow.`
              : `One ${discipline} result logged. Add a few more across the season and this becomes a trend rather than a single point.`}
          </Text>
        </View>
      )}

      {/* One sentence, not a table. */}
      {peak && (
        <Text style={styles.projLede}>
          On a consistent development path you'd peak around{' '}
          <Text style={styles.projStrong}>{formatPerformance(peak.projected, discipline)}</Text>
          {' '}at <Text style={styles.projStrong}>age {peak.age}</Text>
          {gain != null && gain > 0
            ? ` — ${Math.abs(gain).toFixed(2)}${lower ? 's' : 'm'} on your current best`
            : ''}
          {peakTier?.tierName ? `, which is ${peakTier.tierName} for that age group.` : '.'}
        </Text>
      )}

      <Text style={styles.projFootnote}>
        {fromCorpus
          ? `Every athlete in our records who was within 4% of your mark at your age, and what they actually went on to run. The band is the 25th to 75th percentile of what happened to them — real outcomes, not a forecast, and not a confidence interval. ${CONFIDENCE_COPY[confidence]}`
          : 'Built from year-on-year improvement rates of real athletes in this event, by age. The shaded band is the 25th to 75th percentile of how they developed — a spread of outcomes, not a confidence interval, and not a prediction about you. It stops five years out because the optimistic edge assumes a top-quarter year every year, which nobody sustains for longer than that.'}
      </Text>

      {/* A young athlete reading an upward line will read a promise into it.
          Most athletes ahead at sixteen are not ahead at twenty-five, and the
          chart cannot say that by itself. */}
      <Text style={styles.projFootnote}>
        Where you are now is a weak guide to where you finish. Plenty of these
        athletes were passed by people behind them today.
      </Text>
    </AlmanacCard>
  )
}

const styles = StyleSheet.create({
  calNote: {
    flexDirection: 'row', gap: 8, alignItems: 'flex-start',
    marginTop: spacing.md, paddingHorizontal: 2,
  },
  calNoteText: {
    flex: 1, color: colors.text.muted, fontSize: typeScale.label, lineHeight: 17,
  },
  projFootnote: {
    color: colors.text.dimmed, fontSize: typeScale.label, lineHeight: 16,
    marginTop: spacing.md,
  },
  projLede: {
    color: colors.text.secondary, fontSize: typeScale.body, lineHeight: 21,
    marginTop: spacing.lg,
  },
  projStrong: { color: colors.text.primary, fontWeight: weight.bold },
})
