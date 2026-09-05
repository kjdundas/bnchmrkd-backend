// ═══════════════════════════════════════════════════════════════════════
// WELLNESS HISTORY — check-ins over a chosen window.
//
// ── PLOTTED AGAINST TIME, NOT AGAINST INDEX ────────────────────────
// Check-ins are irregular by nature — three in a row, then nothing for two
// months. Spacing them evenly by index would draw that as a steady series and
// make a two-month gap look identical to two consecutive nights, which is the
// opposite of what someone reading their own sleep history needs. So x is the
// real date, and gaps are visible as gaps.
//
// ── THE AXIS IS THE WINDOW, AND IT ALWAYS ENDS TODAY ───────────────
// Not the extent of the data. Fitting the axis to the readings pins the
// newest one to the right-hand edge forever, so a chart from someone who
// stopped checking in a month ago looks exactly like one from someone who
// checked in this morning. Anchoring the right edge to today makes "you have
// not logged anything for three weeks" visible as empty space, which is the
// single most useful thing this screen can tell an athlete who has drifted.
//
// The cost is that a short history inside a long window sits squashed at one
// end. That is the truth about the record, and the range chips carry a count
// each so the emptiness is a choice rather than a surprise.
//
// ── DENSITY ────────────────────────────────────────────────────────
// A year of daily check-ins is 365 marks per chart and 1,460 SVG nodes across
// four — unreadable, and slow. Past a threshold the series collapses to one
// point per week: the mean, inside a band of that week's range. A band keeps
// the bad night visible instead of averaging it away, which is the usual sin
// of smoothing wellness data.
//
// A connecting line across a long gap claims to know what happened in the
// middle. Segments spanning more than a fortnight are drawn dashed and faint.
// ═══════════════════════════════════════════════════════════════════════

import React, { useMemo, useState } from 'react'
import { View, Text, Modal, ScrollView, StyleSheet } from 'react-native'
import Svg, { Line, Circle, Path, Text as SvgText } from 'react-native-svg'
import { Ionicons } from '@expo/vector-icons'
import { onImageColors as colors, spacing, radius, rhythm, numerals, onDark, typeScale, weight } from '../lib/theme'
import { Tappable, MonoKicker } from './ui'
import { useReducedMotion } from '../lib/motion'
import { tapFeedback } from '../lib/haptics'
import {
  checkinStatus, fieldLevel, FIELD_LABEL, READINESS_COLORS,
  type WellnessField,
} from '../lib/readiness'
import {
  parseDay, dayOf, addDays, todayDay, mondayOf,
  MONTH_SHORT, WEEKDAY_SHORT, weekdayOf,
} from '../lib/schedule'

const FIELDS: WellnessField[] = ['sleep_hours', 'soreness', 'energy', 'mood']
const UNIT: Record<WellnessField, string> = {
  sleep_hours: 'h', soreness: '/5', energy: '/5', mood: '/5',
}
/** Fixed scales — a 1–5 rating charted against its own min and max turns a
 *  one-point wobble into a cliff. Sleep gets a realistic human range. */
const SCALE: Record<WellnessField, [number, number]> = {
  sleep_hours: [3, 10], soreness: [1, 5], energy: [1, 5], mood: [1, 5],
}

/** Days beyond which a connecting segment stops asserting the middle. */
const GAP_DAYS = 14

/** Above this many readings in a window, collapse to weekly means + range. */
const DENSITY_LIMIT = 60

export type RangeKey = 'week' | 'month' | '6m' | 'year'
export const RANGES: { key: RangeKey; label: string; days: number }[] = [
  { key: 'week', label: 'Week', days: 7 },
  { key: 'month', label: 'Month', days: 30 },
  { key: '6m', label: '6 months', days: 182 },
  { key: 'year', label: 'Year', days: 365 },
]

/**
 * The first day of a window that ends today and is `days` long.
 *
 * Inclusive of both ends: a week is today and the six days before it, not
 * today and seven others. Off by one here is a whole extra day of readings in
 * every count on the chips.
 */
export function windowStart(days: number, today = todayDay()): string {
  return addDays(today, -(days - 1))
}

export interface Mark {
  day: string
  v: number
  /** Present only on an aggregated mark: that week's spread and count. */
  lo?: number
  hi?: number
  n?: number
}

/**
 * Collapse marks to one per ISO week: the mean, carrying that week's min and
 * max so the band can show the spread rather than hiding it.
 *
 * The bucket is dated mid-week (Monday + 3) so it sits over the days it
 * covers instead of at their left edge.
 */
export function weeklyBuckets(marks: Mark[]): Mark[] {
  const byWeek = new Map<string, number[]>()
  for (const p of marks) {
    const k = mondayOf(p.day)
    const list = byWeek.get(k)
    list ? list.push(p.v) : byWeek.set(k, [p.v])
  }
  return [...byWeek.entries()]
    .sort((a, b) => (a[0] < b[0] ? -1 : 1))
    .map(([week, vs]) => ({
      day: addDays(week, 3),
      v: vs.reduce((a, b) => a + b, 0) / vs.length,
      lo: Math.min(...vs),
      hi: Math.max(...vs),
      n: vs.length,
    }))
}

export default function WellnessHistorySheet({
  visible, onClose, checkins,
}: {
  visible: boolean
  onClose: () => void
  checkins: any[]
}) {
  const reduced = useReducedMotion()
  // A month is the default: long enough for a pattern, short enough that a
  // normal logging habit fills it.
  const [range, setRange] = useState<RangeKey>('month')

  const all = useMemo(() => (checkins || [])
    .map((c) => ({ ...c, day: dayOf(c?.checkin_date) }))
    .filter((c) => c.day)
    .sort((a, b) => (a.day! < b.day! ? -1 : a.day! > b.day! ? 1 : 0)),
    [checkins])

  // Counts per range, so choosing a window is an informed choice rather than
  // a tap into an empty chart.
  const counts = useMemo(() => {
    const today = todayDay()
    const out = {} as Record<RangeKey, number>
    for (const r of RANGES) {
      const from = windowStart(r.days, today)
      out[r.key] = all.filter((c) => c.day! >= from).length
    }
    return out
  }, [all])

  const model = useMemo(() => {
    const def = RANGES.find((r) => r.key === range)!
    const to = todayDay()
    const from = windowStart(def.days, to)
    const rows = all.filter((c) => c.day! >= from && c.day! <= to)
    return { from, to, rows, days: def.days, label: def.label }
  }, [all, range])

  const chips = (
    <View style={s.chips}>
      {RANGES.map((r) => {
        const on = r.key === range
        const n = counts[r.key]
        return (
          <Tappable
            key={r.key}
            onPress={() => { tapFeedback(); setRange(r.key) }}
            accessibilityLabel={`${r.label}, ${n} check-in${n === 1 ? '' : 's'}`}
            style={[s.chip, on
              ? { backgroundColor: onDark.accent + '2E', borderColor: onDark.accent + '73' }
              : { borderColor: 'rgba(255,255,255,0.16)' }]}
          >
            <Text style={[s.chipText, { color: on ? onDark.accent : colors.text.secondary }]}>
              {r.label}
            </Text>
            <Text style={[s.chipCount, {
              color: on ? onDark.accent : colors.text.muted,
              opacity: n ? 1 : 0.45,
            }]}>
              {n}
            </Text>
          </Tappable>
        )
      })}
    </View>
  )

  const body = (
    <>
      {chips}

      {model.rows.length === 0 ? (
        <Text style={s.empty}>
          {all.length === 0
            ? 'No check-ins yet. Once you start logging how you slept and how you feel, this is where the pattern shows up.'
            : `Nothing logged in the last ${model.label.toLowerCase()}. Your most recent check-in was ${friendlyAgo(all[all.length - 1].day!)}.`}
        </Text>
      ) : (
        <>
          <Text style={s.intro}>
            {model.rows.length} check-in{model.rows.length === 1 ? '' : 's'} in the last{' '}
            {model.label.toLowerCase()}. The line runs to today, so a gap at the right-hand
            end is time you haven't logged.
          </Text>

          {FIELDS.map((f) => (
            <FieldChart key={f} field={f} rows={model.rows} from={model.from} to={model.to} />
          ))}

          {/* ── Every check-in in this window ─────────────────── */}
          <View style={{ paddingHorizontal: spacing.lg, marginTop: rhythm.section }}>
            <MonoKicker color={colors.text.muted}>
              {model.rows.length === all.length
                ? 'Every check-in'
                : `${model.rows.length} of ${all.length} check-ins`}
            </MonoKicker>
            <View style={s.thead}>
              <Text style={[s.th, { flex: 1 }]}>Date</Text>
              <Text style={[s.th, s.cell]}>Sleep</Text>
              <Text style={[s.th, s.cell]}>Sore</Text>
              <Text style={[s.th, s.cell]}>Enrg</Text>
              <Text style={[s.th, s.cell]}>Mood</Text>
            </View>
            {[...model.rows].reverse().map((c, i) => {
              const st = checkinStatus(c)
              return (
                <View key={i} style={s.row}>
                  <View style={{ flex: 1 }}>
                    <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6 }}>
                      <View style={[s.dot, { backgroundColor: READINESS_COLORS[st.level] }]} />
                      <Text style={s.date}>{fullDate(c.day!)}</Text>
                    </View>
                    {!!st.reasons.length && (
                      <Text numberOfLines={1} style={s.reasons}>{st.reasons.join(' · ')}</Text>
                    )}
                  </View>
                  {FIELDS.map((f) => {
                    const v = c[f]
                    const lvl = fieldLevel(f, v)
                    return (
                      <Text key={f} style={[s.val, s.cell, {
                        color: lvl && lvl !== 'green' ? READINESS_COLORS[lvl] : colors.text.primary,
                        opacity: v == null ? 0.3 : 1,
                      }]}>
                        {v == null ? '—' : String(v)}
                      </Text>
                    )
                  })}
                </View>
              )
            })}
          </View>

          <Text style={s.foot}>
            Colours match the schedule: amber is worth watching, red is worth acting on.
            Any reported pain marks the whole day red, whatever else it says.
            {model.rows.length > DENSITY_LIMIT
              ? ' Over this many readings the charts show one point per week — the average, inside that week’s range.'
              : ''}
          </Text>
        </>
      )}
    </>
  )

  return (
    <Modal
      visible={visible}
      animationType={reduced ? 'none' : 'slide'}
      presentationStyle="pageSheet"
      onRequestClose={onClose}
    >
      <View style={{ flex: 1, backgroundColor: '#0B0C18' }}>
        <View style={{ alignItems: 'center', paddingTop: 10 }}>
          <View style={{ width: 36, height: 4, borderRadius: radius.full, backgroundColor: 'rgba(255,255,255,0.22)' }} />
        </View>

        <View style={s.header}>
          <View style={{ flex: 1 }}>
            <MonoKicker color={colors.text.muted}>Wellness</MonoKicker>
            <Text style={s.title}>How you've been</Text>
          </View>
          <Tappable onPress={onClose} accessibilityLabel="Close" style={s.close}>
            <Ionicons name="close" size={20} color={colors.text.secondary} />
          </Tappable>
        </View>

        <ScrollView contentContainerStyle={{ paddingBottom: 56 }} showsVerticalScrollIndicator={false}>
          {body}
        </ScrollView>
      </View>
    </Modal>
  )
}

// ── One field, over the window ─────────────────────────────────────

function FieldChart({
  field, rows, from, to,
}: { field: WellnessField; rows: any[]; from: string; to: string }) {
  const raw: Mark[] = rows
    .map((c) => ({ day: c.day as string, v: Number(c[field]) }))
    .filter((p) => Number.isFinite(p.v))

  // Weekly collapse past the density limit. The band is the week's min–max, so
  // one bad night still shows rather than disappearing into its own average.
  const aggregated = raw.length > DENSITY_LIMIT
  const pts: Mark[] = useMemo(
    () => (aggregated ? weeklyBuckets(raw) : raw),
    [raw, aggregated],
  )

  const W = 340, H = 92, padL = 8, padR = 34, padT = 14, padB = 20
  const t0 = parseDay(from).getTime()
  const t1 = parseDay(to).getTime()
  const [lo, hi] = SCALE[field]

  const X = (day: string) => {
    if (t1 === t0) return padL + (W - padL - padR) / 2
    const f = (parseDay(day).getTime() - t0) / (t1 - t0)
    return padL + Math.min(1, Math.max(0, f)) * (W - padL - padR)
  }
  const Y = (v: number) => {
    const f = (Math.min(hi, Math.max(lo, v)) - lo) / (hi - lo)
    return padT + (1 - f) * (H - padT - padB)
  }

  const latest = pts.length ? pts[pts.length - 1] : null
  // The headline number is the latest actual reading, never a weekly mean —
  // "your last night" is a fact, "your last week averaged" is a different one.
  const latestRaw = raw.length ? raw[raw.length - 1] : null
  const latestLevel = latestRaw ? fieldLevel(field, latestRaw.v) : null
  const avg = raw.length ? raw.reduce((a, p) => a + p.v, 0) / raw.length : null

  // The min–max band, drawn as one closed shape: across the tops, back along
  // the bottoms.
  const bandPath = aggregated && pts.length > 1
    ? pts.map((p, i) => `${i ? 'L' : 'M'}${X(p.day)},${Y(p.hi ?? p.v)}`).join(' ')
      + ' ' + [...pts].reverse().map((p) => `L${X(p.day)},${Y(p.lo ?? p.v)}`).join(' ') + ' Z'
    : null

  return (
    <View style={{ paddingHorizontal: spacing.lg, marginTop: rhythm.section }}>
      <View style={s.fieldHead}>
        <Text style={s.fieldName}>{FIELD_LABEL[field]}</Text>
        <View style={{ flexDirection: 'row', alignItems: 'baseline', gap: 8 }}>
          {avg != null && <Text style={s.fieldAvg}>avg {round1(avg)}{UNIT[field]}</Text>}
          {latestRaw && (
            <Text style={[s.fieldNow, {
              color: latestLevel && latestLevel !== 'green'
                ? READINESS_COLORS[latestLevel] : colors.text.primary,
            }]}>
              {round1(latestRaw.v)}{UNIT[field]}
            </Text>
          )}
        </View>
      </View>

      <Svg width="100%" height={H} viewBox={`0 0 ${W} ${H}`}>
        {[lo, (lo + hi) / 2, hi].map((v) => (
          <React.Fragment key={v}>
            <Line x1={padL} x2={W - padR} y1={Y(v)} y2={Y(v)}
              stroke="rgba(255,255,255,0.07)" strokeWidth={1} />
            <SvgText x={W - padR + 6} y={Y(v) + 3.5} fontSize={9} fill={colors.text.muted}>
              {round1(v)}
            </SvgText>
          </React.Fragment>
        ))}

        {bandPath && (
          <Path d={bandPath} fill={onDark.accent} fillOpacity={0.16} stroke="none" />
        )}

        {pts.slice(1).map((p, i) => {
          const prev = pts[i]
          const gap = Math.round(
            (parseDay(p.day).getTime() - parseDay(prev.day).getTime()) / 86400000,
          )
          const far = gap > GAP_DAYS
          return (
            <Line
              key={`s${i}`}
              x1={X(prev.day)} y1={Y(prev.v)} x2={X(p.day)} y2={Y(p.v)}
              stroke={onDark.accent}
              strokeOpacity={far ? 0.22 : 0.6}
              strokeDasharray={far ? '3 5' : undefined}
              strokeWidth={2} strokeLinecap="round"
            />
          )
        })}

        {pts.map((p, i) => {
          const lvl = fieldLevel(field, p.v)
          const tone = lvl && lvl !== 'green' ? READINESS_COLORS[lvl] : onDark.accent
          return (
            <Circle key={i} cx={X(p.day)} cy={Y(p.v)} r={aggregated ? 2.6 : 3.6} fill={tone} />
          )
        })}
      </Svg>

      <View style={s.axis}>
        <Text style={s.axisText}>{shortDate(from)}</Text>
        <Text style={s.axisText}>Today</Text>
      </View>
    </View>
  )
}

const round1 = (n: number) => String(Math.round(n * 10) / 10)
const shortDate = (day: string) => {
  const d = parseDay(day)
  return `${d.getDate()} ${MONTH_SHORT[d.getMonth()]}`
}
const fullDate = (day: string) => {
  const d = parseDay(day)
  return `${WEEKDAY_SHORT[weekdayOf(day) - 1]} ${d.getDate()} ${MONTH_SHORT[d.getMonth()]} ${String(d.getFullYear()).slice(2)}`
}
/** "yesterday" · "12 days ago" · "on 25 Jun" — for the empty-window line. */
function friendlyAgo(day: string): string {
  const days = Math.round(
    (parseDay(todayDay()).getTime() - parseDay(day).getTime()) / 86400000,
  )
  if (days <= 0) return 'today'
  if (days === 1) return 'yesterday'
  if (days < 31) return `${days} days ago`
  return `on ${shortDate(day)}`
}

const s = StyleSheet.create({
  header: {
    flexDirection: 'row', alignItems: 'flex-start', justifyContent: 'space-between',
    paddingHorizontal: spacing.lg, paddingTop: spacing.md, paddingBottom: spacing.md,
  },
  title: { fontSize: typeScale.stat, fontWeight: weight.bold, color: colors.text.primary, letterSpacing: -0.5, marginTop: 4 },
  close: {
    width: 44, height: 44, borderRadius: radius.full, alignItems: 'center', justifyContent: 'center',
    backgroundColor: 'rgba(255,255,255,0.08)', borderWidth: 1, borderColor: 'rgba(255,255,255,0.16)',
  },
  chips: {
    flexDirection: 'row', gap: 6, paddingHorizontal: spacing.lg, paddingBottom: spacing.md,
  },
  chip: {
    flex: 1, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 5,
    minHeight: 44, paddingHorizontal: 6,
    borderRadius: radius.control, borderWidth: 1,
    backgroundColor: 'rgba(255,255,255,0.05)',
  },
  chipText: { fontSize: typeScale.caption, fontWeight: weight.bold },
  chipCount: { fontSize: typeScale.label, fontWeight: weight.medium, ...numerals },
  intro: {
    fontSize: typeScale.caption, lineHeight: 19, color: colors.text.secondary,
    paddingHorizontal: spacing.lg,
  },
  empty: {
    fontSize: typeScale.caption, lineHeight: 20, color: colors.text.secondary,
    paddingHorizontal: spacing.lg, paddingTop: spacing.sm,
  },
  fieldHead: {
    flexDirection: 'row', alignItems: 'baseline', justifyContent: 'space-between',
    marginBottom: 2,
  },
  fieldName: { fontSize: typeScale.body, fontWeight: weight.bold, color: colors.text.primary },
  fieldAvg: { fontSize: typeScale.label, color: colors.text.muted, ...numerals },
  fieldNow: { fontSize: typeScale.title, fontWeight: weight.bold, ...numerals },
  axis: { flexDirection: 'row', justifyContent: 'space-between', marginTop: -4 },
  axisText: { fontSize: typeScale.label, color: colors.text.muted, ...numerals },
  thead: {
    flexDirection: 'row', alignItems: 'center', gap: 6, marginTop: 10,
    paddingBottom: 8, borderBottomWidth: 1, borderBottomColor: 'rgba(255,255,255,0.12)',
  },
  th: { fontSize: typeScale.micro, letterSpacing: 1.2, textTransform: 'uppercase', color: colors.text.muted, fontWeight: weight.bold },
  cell: { width: 38, textAlign: 'right' },
  row: {
    flexDirection: 'row', alignItems: 'center', gap: 6, paddingVertical: 11,
    borderBottomWidth: 1, borderBottomColor: 'rgba(255,255,255,0.06)',
  },
  dot: { width: 7, height: 7, borderRadius: radius.full },
  date: { fontSize: typeScale.caption, color: colors.text.primary, fontWeight: weight.medium },
  reasons: { fontSize: typeScale.label, color: colors.text.muted, marginTop: 2, marginLeft: 13 },
  val: { fontSize: typeScale.body, fontWeight: weight.bold, ...numerals },
  foot: {
    fontSize: typeScale.label, color: colors.text.muted, lineHeight: 16,
    marginTop: rhythm.section, paddingHorizontal: spacing.lg,
  },
})
