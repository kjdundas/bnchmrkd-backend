// ═══════════════════════════════════════════════════════════════════════
// ATHLETE CONTEXT — what the program generator is told about the athlete.
//
// ── WHY THIS FILE EXISTS ───────────────────────────────────────────
// The mobile app was sending `{ name, discipline }` and nothing else. Two
// things depend on this payload, and both were silently broken:
//
//   1. THE LOADING CEILING. The backend picks it from `age` and `maturity`:
//      pre-PHV gets "bodyweight and light implements only, no 1RM testing",
//      circa-PHV gets "no maximal lifts", and everyone else gets the ADULT
//      ceiling — "full range as appropriate to phase and recovery". With
//      neither field sent, every mobile athlete fell through to adult,
//      including a twelve-year-old. That is the reason this is not an
//      optional enrichment.
//
//   2. THE LIMITERS. The generator is built to diagnose from test scores and
//      bias the block toward the athlete's weakest high-priority quality.
//      With no `dna` block it has nothing to diagnose from, so it writes a
//      generic event-standard program and says so.
//
// The web app has always sent all of this (AthleteDashboard's
// buildAssistantContext). This is the same shape, so the two clients cannot
// ask the same backend for a program and get differently-safe answers.
//
// ── DELIBERATELY NOT INFERRED ──────────────────────────────────────
// Maturity needs sitting height to compute a Mirwald offset. Where it is
// missing this returns `null` rather than a guess, and the backend then falls
// back to chronological age — which is the honest ordering. A fabricated
// maturity status would drive real loading decisions.
// ═══════════════════════════════════════════════════════════════════════

import { buildDnaSummary } from './disciplineScience'
import { maturityFromProfile } from './maturation'
import { ageFromDob } from './age'
import { isLowerBetter } from './disciplineScience'
import { countsForAnalysis } from './resultSemantics'

export interface ProgramContext {
  name: string
  discipline: string
  age: number | null
  maturity: any | null
  dna: any | null
  pb: number | null
  most_recent: { date: string; value: number; competition?: string | null } | null
  total_results: number
  recent_results: { date: string; value: number; competition?: string | null }[]
}

/** True when the DNA block has something the generator can actually target. */
export function hasTargetableData(dna: any): boolean {
  return !!dna && Array.isArray(dna.axes) && dna.axes.some((a: any) => a?.score != null)
}

/**
 * A one-line read of what the data-led path knows, for the intake screen.
 * The athlete should be able to see what "build it from my data" will use
 * before choosing it — an option that silently does nothing is worse than
 * one that is not offered.
 */
export function describeDna(dna: any): string | null {
  if (!hasTargetableData(dna)) return null
  const tested = dna.axes.filter((a: any) => a?.score != null)
  const names = (dna.limiters || []).map((l: any) => String(l.label).toLowerCase())
  if (names.length) {
    return `${tested.length} area${tested.length === 1 ? '' : 's'} tested · weakest: ${names.join(', ')}`
  }
  return `${tested.length} area${tested.length === 1 ? '' : 's'} tested · no clear weak point yet`
}

export function buildProgramContext({
  profile, athleteRow, metrics, performances,
}: {
  profile: any
  athleteRow: any
  metrics: any[]
  performances: any[]
}): ProgramContext {
  const discipline = String(
    athleteRow?.discipline || profile?.primary_discipline || '',
  ).trim()
  // Field events are measured in metres and combined events in points, so a
  // bigger mark is better; everything else is a time. This asked
  // isThrowsDiscipline, which lists no jumps — so every program generated for
  // a long jumper was built on the claim that their shortest jump was their
  // best one.
  const lowerIsBetter = isLowerBetter(discipline)

  // Race history comes from two places — the scraped `races` blob on the
  // athlete row and the athlete's own logged performances. Both, deduped by
  // date and mark, or an athlete who logged a race the sync also found gets
  // it counted twice in `total_results`.
  const pts: { date: string; value: number; competition?: string | null }[] = []
  const seen = new Set<string>()
  const push = (date: any, value: any, competition: any) => {
    const v = Number(value)
    if (!date || !Number.isFinite(v)) return
    const day = String(date).slice(0, 10)
    const k = `${day}:${v}`
    if (seen.has(k)) return
    seen.add(k)
    pts.push({ date: day, value: v, competition: competition || null })
  }

  for (const r of athleteRow?.races || []) {
    const rd = String(r?.discipline || '').trim()
    if (discipline && rd && rd !== discipline) continue
    push(r?.date, r?.value, r?.competition)
  }
  for (const p of performances || []) {
    const pd = String(p?.discipline || '').trim()
    if (discipline && pd && pd !== discipline) continue
    // The generator is told the athlete's PB and recent form. A DNF has no
    // mark to report, and a voided or wind-assisted one would overstate them.
    if (!countsForAnalysis(p, pd || discipline)) continue
    push(p?.competition_date, p?.mark, p?.competition_name)
  }
  pts.sort((a, b) => (a.date < b.date ? 1 : a.date > b.date ? -1 : 0))

  let pb: number | null = null
  for (const r of pts) {
    if (pb == null || (lowerIsBetter ? r.value < pb : r.value > pb)) pb = r.value
  }

  const age = ageFromDob(profile?.date_of_birth || profile?.dob)

  // Mirwald needs sex, age, standing height, sitting height and weight. It
  // returns null when it cannot compute one, and that null is passed through
  // rather than papered over.
  const maturity = maturityFromProfile({
    sex: profile?.gender,
    dob: profile?.date_of_birth || profile?.dob,
    heightCm: athleteRow?.height_cm,
    sittingHeightCm: athleteRow?.sitting_height_cm,
    weightKg: athleteRow?.weight_kg,
  })

  return {
    name: profile?.full_name || 'You',
    discipline,
    age,
    maturity,
    dna: buildDnaSummary(metrics || [], discipline, age),
    pb,
    most_recent: pts[0] || null,
    total_results: pts.length,
    recent_results: pts.slice(0, 6),
  }
}
