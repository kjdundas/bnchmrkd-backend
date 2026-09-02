// ═══════════════════════════════════════════════════════════════════════
// SQUAD WELLNESS — how everyone is, and which way it is going.
//
// Two things a coach wants and one they are owed.
//
//   WANT 1  today, at a glance: who is green, who is amber, who is red.
//   WANT 2  the direction: a fortnight of readiness as a sparkline, because
//           one bad night is noise and five in a row is a conversation.
//   OWED    the truth about absence. A blank row can mean "did not check in"
//           or "chose not to share", and those call for opposite responses —
//           chase the first, respect the second. Guessing wrong in either
//           direction damages the relationship the app exists to support,
//           so the two are drawn differently and never merged.
//
// Tapping an athlete opens the same history sheet the athlete sees of
// themselves, from the same component, so there is one idea of what a month
// of wellness looks like rather than a coach's version and an athlete's.
// ═══════════════════════════════════════════════════════════════════════

import React, { useMemo, useState } from 'react'
import { View, Text, StyleSheet } from 'react-native'
import Svg, { Polyline, Circle } from 'react-native-svg'
import { Ionicons } from '@expo/vector-icons'
import { useTheme } from '../contexts/ThemeContext'
import { Tappable, MonoKicker } from './ui'
import InfoDot from './InfoDot'
import { spacing, radius, onImage, typeScale, weight } from '../lib/theme'
import { tapFeedback } from '../lib/haptics'
import { checkinStatus, READINESS_COLORS, isToday } from '../lib/readiness'
import { keyOf, sharesWellness, sharesPain, type SquadAthlete, type SharedCheckin } from '../lib/squads'
import WellnessHistorySheet from './WellnessHistorySheet'

/** Readiness as a number, purely so it can be drawn as a line. */
const SCORE: Record<string, number> = { green: 1, amber: 0.55, red: 0.15, none: 0 }

const SPARK_W = 72
const SPARK_H = 22

function Spark({ points, tone }: { points: number[]; tone: string }) {
  if (points.length < 2) return null
  const step = SPARK_W / (points.length - 1)
  const d = points
    .map((p, i) => `${(i * step).toFixed(1)},${(SPARK_H - 2 - p * (SPARK_H - 4)).toFixed(1)}`)
    .join(' ')
  const last = points[points.length - 1]
  return (
    <Svg width={SPARK_W} height={SPARK_H}>
      <Polyline points={d} fill="none" stroke={tone} strokeWidth={1.6}
        strokeLinejoin="round" strokeLinecap="round" opacity={0.85} />
      <Circle cx={SPARK_W} cy={SPARK_H - 2 - last * (SPARK_H - 4)} r={2.4} fill={tone} />
    </Svg>
  )
}

export default function SquadWellness({
  athletes, checkins,
}: {
  athletes: SquadAthlete[]
  checkins: Map<string, SharedCheckin[]>
}) {
  const { colors } = useTheme()
  const [open, setOpen] = useState(false)
  const [sheetFor, setSheetFor] = useState<SquadAthlete | null>(null)

  // Only athletes with an account can check in at all. A roster entry in
  // this list would be a permanent empty row that nothing could ever fill.
  const withAccounts = useMemo(
    () => athletes.filter((a) => !!a.athlete_user_id), [athletes])

  const rows = useMemo(() => withAccounts.map((a) => {
    const list = checkins.get(keyOf(a)) || []
    const latest = list.length ? list[list.length - 1] : null
    const shared = sharesWellness(list)
    const pain = sharesPain(list)
    // Today's status only counts if it IS today. A green from last Tuesday
    // drawn as today's readiness is worse than no dot at all.
    const fresh = latest && isToday(latest as any)
    const status = shared && fresh ? checkinStatus(latest as any) : null
    const spark = shared
      ? list.slice(-14).map((c) => SCORE[checkinStatus(c as any).level] ?? 0)
      : []
    return { athlete: a, list, latest, shared, pain, status, spark, fresh: !!fresh }
  }), [withAccounts, checkins])

  const flagged = rows.filter((r) => r.status && r.status.level !== 'green').length
  const hidden = rows.filter((r) => !r.shared).length
  const quiet = rows.filter((r) => r.shared && !r.fresh).length

  if (!withAccounts.length) return null

  const summary = [
    flagged > 0 ? `${flagged} to look at` : null,
    quiet > 0 ? `${quiet} not in today` : null,
    hidden > 0 ? `${hidden} private` : null,
  ].filter(Boolean).join(' · ') || 'everyone green'

  return (
    <View style={s.wrap}>
      <Tappable
        onPress={() => { tapFeedback(); setOpen((v) => !v) }}
        accessibilityLabel={`Squad wellness. ${summary}`}
        accessibilityState={{ expanded: open }}
        style={s.head}
      >
        <Ionicons name="pulse" size={15} color={colors.accent[500]} />
        <Text style={s.headTitle}>Wellness</Text>
        <InfoDot term="readiness" size={13} />
        <Text style={s.headMeta} numberOfLines={1}>{summary}</Text>
        <Ionicons name={open ? 'chevron-up' : 'chevron-down'} size={15} color={onImage.dim} />
      </Tappable>

      {open && (
        <View style={s.body}>
          {rows.map((r) => {
            const tone = r.status ? READINESS_COLORS[r.status.level] : onImage.dim
            return (
              <Tappable
                key={keyOf(r.athlete)}
                onPress={() => {
                  if (!r.shared) return          // nothing to open
                  tapFeedback(); setSheetFor(r.athlete)
                }}
                accessibilityLabel={
                  !r.shared ? `${r.athlete.name}, wellness not shared`
                    : r.fresh ? `${r.athlete.name}, ${r.status?.label}. Open history`
                    : `${r.athlete.name}, no check-in today. Open history`}
                style={s.row}
              >
                <View style={[s.dot, {
                  backgroundColor: r.shared ? tone : 'transparent',
                  borderColor: r.shared ? tone : onImage.dim,
                  borderWidth: r.shared ? 0 : 1,
                }]} />

                <View style={{ flex: 1, minWidth: 0 }}>
                  <Text style={s.name} numberOfLines={1}>{r.athlete.name}</Text>
                  <Text style={[s.state, !r.shared && { fontStyle: 'italic' }]} numberOfLines={1}>
                    {/* The three cases, kept apart on purpose. */}
                    {!r.shared
                      ? 'Wellness not shared'
                      : r.fresh
                        ? (r.status?.reasons?.length ? r.status.reasons.join(' · ') : r.status?.label)
                        : r.list.length
                          ? 'No check-in today'
                          : 'Never checked in'}
                  </Text>
                </View>

                {/* A pain flag survives wellness being switched off — that is
                    the whole reason the two are separate switches. */}
                {r.pain && r.latest?.pain && (
                  <Ionicons name="medkit" size={14} color={colors.red} />
                )}

                {r.shared
                  ? <Spark points={r.spark} tone={tone === onImage.dim ? onImage.muted : tone} />
                  : <Ionicons name="lock-closed" size={13} color={onImage.dim} />}
              </Tappable>
            )
          })}

          {hidden > 0 && (
            <Text style={s.foot}>
              {hidden === 1 ? 'One athlete has' : `${hidden} athletes have`} chosen not to
              share wellness. They can change that in their own profile — it is
              their call, not a setting you can reach.
            </Text>
          )}
        </View>
      )}

      <WellnessHistorySheet
        visible={!!sheetFor}
        onClose={() => setSheetFor(null)}
        checkins={sheetFor ? (checkins.get(keyOf(sheetFor)) || []) : []}
      />
    </View>
  )
}

const s = StyleSheet.create({
  wrap: {
    marginHorizontal: spacing.lg, marginTop: 14,
    borderRadius: radius.card, borderWidth: 1,
    borderColor: onImage.cardBorder, backgroundColor: onImage.card,
    overflow: 'hidden',
  },
  head: { flexDirection: 'row', alignItems: 'center', gap: 9, padding: 13 },
  headTitle: { color: onImage.ink, fontSize: typeScale.body, fontWeight: weight.bold, letterSpacing: -0.2 },
  headMeta: { flex: 1, color: onImage.muted, fontSize: typeScale.caption, textAlign: 'right' },
  body: { borderTopWidth: 1, borderTopColor: onImage.divider, paddingHorizontal: 13 },
  row: { flexDirection: 'row', alignItems: 'center', gap: 11, minHeight: 50 },
  dot: { width: 9, height: 9, borderRadius: radius.hair },
  name: { color: onImage.ink, fontSize: typeScale.body, fontWeight: weight.medium },
  state: { color: onImage.muted, fontSize: typeScale.label, marginTop: 1 },
  foot: {
    color: onImage.dim, fontSize: typeScale.label, lineHeight: 17,
    paddingVertical: 10, borderTopWidth: 1, borderTopColor: onImage.divider,
  },
})
