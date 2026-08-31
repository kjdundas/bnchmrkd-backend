// ═══════════════════════════════════════════════════════════════════════
// TREND DETAIL — the same series, with the numbers on it.
//
// The card chart is deliberately unlabelled: eight values printed on a 124pt
// sparkline is a wall of digits where the point is the shape. This is where
// the digits live — every mark labelled, and a table of what each race did
// relative to the one before it and to the best.
//
// The verdict colours are the card's, computed the same way, so a dot that
// reads amber on Home reads amber here. They are derived once in
// `raceVerdicts` and shared, rather than reimplemented on each surface — the
// fastest way to end up with two charts that disagree about the same race.
// ═══════════════════════════════════════════════════════════════════════

import React, { useMemo } from 'react'
import { View, Text, Modal, ScrollView, StyleSheet } from 'react-native'
import Svg, { Line, Polyline, Circle, Text as SvgText } from 'react-native-svg'
import { Ionicons } from '@expo/vector-icons'
import { onImageColors as colors, spacing, radius, rhythm, onDark } from '../lib/theme'
import { Tappable, MonoKicker } from './ui'
import { useReducedMotion } from '../lib/motion'

export type Verdict = 'first' | 'best' | 'up' | 'flat' | 'off' | 'down'

/**
 * Per-race verdict with a dead band.
 *
 * Measured over simulated seasons with realistic race-to-race variation
 * (±0.08s for a sprint), 37% of consecutive races come out slower than the
 * one before even while the athlete genuinely improves. The band — 0.8% of
 * the mark, about one standard deviation — is what stops that noise being
 * reported as decline.
 */
export function raceVerdicts(values: number[], lowerIsBetter: boolean): Verdict[] {
  const better = (a: number, b: number) => (lowerIsBetter ? a < b : a > b)
  const band = (v: number) => Math.abs(v) * 0.008
  return values.map((v, i) => {
    if (i === 0) return 'first'
    const prev = values[i - 1]
    const bestSoFar = values.slice(0, i).reduce((b, q) => (better(q, b) ? q : b), values[0])
    if (better(v, bestSoFar)) return 'best'
    const d = Math.abs(v - prev)
    if (d <= band(v)) return 'flat'
    if (better(v, prev)) return 'up'
    return d > band(v) * 2.5 ? 'down' : 'off'
  })
}

export function verdictTone(v: Verdict) {
  switch (v) {
    case 'best': case 'up': return colors.green
    case 'off': return colors.amber
    case 'down': return colors.red
    default: return colors.text.muted
  }
}

const VERDICT_WORD: Record<Verdict, string> = {
  first: 'First logged',
  // "Best so far", not "New best" — the verdict is judged against the races
  // BEFORE it, while the vs-PB column compares against the athlete's current
  // best. Without the distinction a row reads "New best · +0.47 vs PB",
  // which looks like the table contradicting itself.
  best: 'Best so far',
  up: 'Faster',
  flat: 'Level',
  off: 'Off',
  down: 'Well off',
}

export interface TrendPoint { t: string; v: number }

export default function TrendDetailSheet({
  visible, onClose, title, points, lowerIsBetter, valueFmt, unit,
  noun = 'race', science,
}: {
  visible: boolean
  onClose: () => void
  title: string
  points: TrendPoint[]
  lowerIsBetter: boolean
  valueFmt: (v: number) => string
  unit?: string
  /**
   * What one point IS. Races and training tests get the same chart and the
   * same verdict colouring — deliberately, so a dot that reads amber here
   * reads amber everywhere — but they do not get the same words.
   */
  noun?: 'race' | 'test'
  /** Optional block rendered under the table: why this measure matters. */
  science?: React.ReactNode
}) {
  const reduced = useReducedMotion()

  const model = useMemo(() => {
    const pts = (points || [])
      .filter((p) => Number.isFinite(p.v))
      .sort((a, b) => new Date(a.t).getTime() - new Date(b.t).getTime())
    if (!pts.length) return null
    const vals = pts.map((p) => p.v)
    const verdicts = raceVerdicts(vals, lowerIsBetter)
    const pb = lowerIsBetter ? Math.min(...vals) : Math.max(...vals)
    return { pts, vals, verdicts, pb }
  }, [points, lowerIsBetter])

  if (!model) return null
  const { pts, vals, verdicts, pb } = model

  // ── Chart geometry ─────────────────────────────────────────────
  const W = 340, H = 210, padL = 14, padR = 40, padT = 30, padB = 34
  let lo = Math.min(...vals), hi = Math.max(...vals)
  if (hi === lo) { hi += 0.5; lo -= 0.5 }
  const range = hi - lo
  lo -= range * 0.22; hi += range * 0.22
  const X = (i: number) => padL + (i / Math.max(1, pts.length - 1)) * (W - padL - padR)
  const Y = (v: number) => {
    const f = (v - lo) / (hi - lo)
    return lowerIsBetter ? padT + f * (H - padT - padB) : padT + (1 - f) * (H - padT - padB)
  }
  const line = pts.map((p, i) => `${X(i)},${Y(p.v)}`).join(' ')

  const fmtDate = (t: string) => {
    const d = new Date(t)
    return Number.isNaN(d.getTime()) ? '—'
      : d.toLocaleDateString('en-GB', { day: 'numeric', month: 'short', year: '2-digit' })
  }

  return (
    <Modal
      visible={visible}
      animationType={reduced ? 'none' : 'slide'}
      presentationStyle="pageSheet"
      onRequestClose={onClose}
    >
      <View style={{ flex: 1, backgroundColor: '#0B0C18' }}>
        <View style={{ alignItems: 'center', paddingTop: 10 }}>
          <View style={{ width: 36, height: 4, borderRadius: 2, backgroundColor: 'rgba(255,255,255,0.22)' }} />
        </View>

        <View style={s.header}>
          <View style={{ flex: 1 }}>
            <MonoKicker color={colors.text.muted}>
              {pts.length} {noun}{pts.length === 1 ? '' : 's'}
            </MonoKicker>
            <Text style={s.title}>{title}</Text>
          </View>
          <Tappable onPress={onClose} accessibilityLabel="Close" style={s.close}>
            <Ionicons name="close" size={20} color={colors.text.secondary} />
          </Tappable>
        </View>

        <ScrollView contentContainerStyle={{ paddingBottom: 48 }} showsVerticalScrollIndicator={false}>
          {/* ── Labelled chart ───────────────────────────────── */}
          <View style={{ paddingHorizontal: spacing.lg }}>
            <Svg width="100%" height={H} viewBox={`0 0 ${W} ${H}`}>
              {[0, 0.5, 1].map((f) => (
                <Line key={f}
                  x1={padL} x2={W - padR}
                  y1={padT + f * (H - padT - padB)} y2={padT + f * (H - padT - padB)}
                  stroke="rgba(255,255,255,0.08)" strokeWidth={1} />
              ))}

              <Line x1={padL} x2={W - padR} y1={Y(pb)} y2={Y(pb)}
                stroke={onDark.accent} strokeOpacity={0.5} strokeWidth={1} strokeDasharray="3 4" />
              <SvgText x={W - padR + 5} y={Y(pb) + 3} fontSize={9} fill={onDark.accent}>PB</SvgText>

              {pts.slice(1).map((p, i) => (
                <Line key={`s${i}`}
                  x1={X(i)} y1={Y(pts[i].v)} x2={X(i + 1)} y2={Y(p.v)}
                  stroke={verdictTone(verdicts[i + 1])} strokeOpacity={0.5}
                  strokeWidth={2.5} strokeLinecap="round" />
              ))}

              {pts.map((p, i) => {
                const tone = verdictTone(verdicts[i])
                // Labels alternate above and below the line. Eight marks on
                // one row at this width overlap; staggering them is cheaper
                // than dropping half the data.
                const above = i % 2 === 0
                return (
                  <React.Fragment key={i}>
                    {verdicts[i] === 'best' && (
                      <Circle cx={X(i)} cy={Y(p.v)} r={8} fill={tone} fillOpacity={0.24} />
                    )}
                    <Circle cx={X(i)} cy={Y(p.v)} r={3.8} fill={tone} />
                    <SvgText
                      x={X(i)} y={Y(p.v) + (above ? -11 : 17)}
                      fontSize={9.5} fill={verdicts[i] === 'flat' ? colors.text.muted : tone}
                      textAnchor="middle" fontWeight="700"
                    >
                      {valueFmt(p.v)}
                    </SvgText>
                  </React.Fragment>
                )
              })}
            </Svg>
          </View>

          {/* ── The deltas ───────────────────────────────────── */}
          <View style={{ paddingHorizontal: spacing.lg, marginTop: rhythm.section }}>
            <View style={s.thead}>
              <Text style={[s.th, { flex: 1.5 }]}>Date</Text>
              <Text style={[s.th, s.num, { width: 62 }]}>Mark</Text>
              <Text style={[s.th, s.num, { width: 58 }]}>vs last</Text>
              <Text style={[s.th, s.num, { width: 58 }]}>vs best</Text>
            </View>

            {/* Newest first: the most recent race is what someone opened this
                to look at. */}
            {pts.map((p, i) => i).reverse().map((i) => {
              const p = pts[i]
              const tone = verdictTone(verdicts[i])
              const dPrev = i === 0 ? null : p.v - pts[i - 1].v
              const dPb = p.v - pb
              const sign = (n: number) => (n > 0 ? '+' : n < 0 ? '−' : '')
              return (
                <View key={i} style={s.row}>
                  <View style={{ flex: 1.5 }}>
                    <Text style={s.date}>{fmtDate(p.t)}</Text>
                    <Text style={[s.verdict, { color: tone }]}>{VERDICT_WORD[verdicts[i]]}</Text>
                  </View>
                  <Text style={[s.mark, s.num, { width: 62 }]}>{valueFmt(p.v)}</Text>
                  <Text style={[s.delta, s.num, { width: 58, color: dPrev == null ? colors.text.dimmed : tone }]}>
                    {dPrev == null ? '—' : `${sign(dPrev)}${Math.abs(dPrev).toFixed(2)}`}
                  </Text>
                  <Text style={[s.delta, s.num, { width: 58, color: dPb === 0 ? colors.green : colors.text.muted }]}>
                    {dPb === 0 ? 'PB' : `${sign(dPb)}${Math.abs(dPb).toFixed(2)}`}
                  </Text>
                </View>
              )
            })}

            <Text style={s.foot}>
              {noun === 'race'
                ? '“Level” means the change was inside the normal race-to-race spread for this event — about 0.8% of the mark — not that you ran exactly the same time. “Best so far” is judged against the races before it; the last column compares every race with your current best.'
                : '“Level” means the change was inside the normal test-to-test spread — about 0.8% — which is roughly the noise floor of a field test. Treat anything inside it as unchanged rather than as progress or decline.'}
            </Text>
          </View>

          {science}
        </ScrollView>
      </View>
    </Modal>
  )
}

const s = StyleSheet.create({
  header: {
    flexDirection: 'row', alignItems: 'flex-start', justifyContent: 'space-between',
    paddingHorizontal: spacing.lg, paddingTop: spacing.md, paddingBottom: spacing.lg,
  },
  title: {
    fontSize: 24, fontWeight: '700', color: colors.text.primary,
    letterSpacing: -0.5, marginTop: 4,
  },
  close: {
    width: 44, height: 44, borderRadius: 22, alignItems: 'center', justifyContent: 'center',
    backgroundColor: 'rgba(255,255,255,0.08)', borderWidth: 1, borderColor: 'rgba(255,255,255,0.16)',
  },
  thead: {
    flexDirection: 'row', alignItems: 'center', gap: 8,
    paddingBottom: 8, borderBottomWidth: 1, borderBottomColor: 'rgba(255,255,255,0.12)',
  },
  th: {
    fontSize: 9, letterSpacing: 1.6, textTransform: 'uppercase',
    color: colors.text.muted, fontWeight: '700',
  },
  row: {
    flexDirection: 'row', alignItems: 'center', gap: 8, paddingVertical: 12,
    borderBottomWidth: 1, borderBottomColor: 'rgba(255,255,255,0.06)',
  },
  date: { fontSize: 14, color: colors.text.primary, fontWeight: '500' },
  verdict: { fontSize: 10.5, fontWeight: '700', marginTop: 2, letterSpacing: 0.3 },
  mark: { fontSize: 15, fontWeight: '700', color: colors.text.primary },
  delta: { fontSize: 13.5, fontWeight: '600' },
  num: { textAlign: 'right', fontVariant: ['tabular-nums'] },
  foot: {
    // 38% white measures 3.86:1 against #0B0C18 — under the 4.5:1 body copy
    // at this size needs. 54% clears it at 6.0:1.
    fontSize: 11, color: colors.text.muted, lineHeight: 16,
    marginTop: rhythm.section,
  },
})
