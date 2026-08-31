// ═══════════════════════════════════════════════════════════════════════
// COMPETITION RESULTS — the athlete's whole competitive record.
//
// A season is the unit an athlete thinks in ("my 2026 season"), so the table
// groups by year with a header carrying the season best. Within a season the
// newest result is first, because the reason you open this is usually the
// thing that just happened.
//
// ── EVERY RESULT APPEARS, INCLUDING THE ONES THAT DON'T COUNT ──────
// A DNF, a disqualification and a wind-assisted mark are all part of the
// record and all excluded from PB, trend and projection maths. A table that
// silently dropped them would make a season with three DNFs look like a
// season with three fewer competitions — and an athlete who knows they raced
// six times would stop trusting a screen that shows three.
//
// So they are shown, marked, and the reason is stated. `countsForAnalysis` is
// the same gate the charts use, so this table and the trend line can never
// disagree about which results were counted.
// ═══════════════════════════════════════════════════════════════════════

import React, { useMemo, useState } from 'react'
import { View, Text, StyleSheet } from 'react-native'
import { Ionicons } from '@expo/vector-icons'
import { useTheme } from '../contexts/ThemeContext'
import { Tappable, MonoKicker } from './ui'
import { spacing, radius, numerals } from '../lib/theme'
import { formatMark, isLowerBetter } from '../lib/metricSemantics'
import {
  countsForAnalysis, exclusionReason, ordinal, formatWind, isWindAffected,
  ROUND_LABEL, PROGRESSION_LABEL, STATUS_LABEL,
  type ResultStatus,
} from '../lib/resultSemantics'
import { parseDay, MONTH_SHORT } from '../lib/schedule'

/** How many seasons are open on arrival. The rest collapse. */
const OPEN_SEASONS = 1

export default function ResultsTable({ performances }: { performances: any[] }) {
  const { colors } = useTheme()

  const seasons = useMemo(() => {
    const rows = (performances || [])
      .filter((p) => p?.competition_date)
      .sort((a, b) => (a.competition_date < b.competition_date ? 1 : -1))

    const byYear = new Map<string, any[]>()
    for (const r of rows) {
      const y = String(r.competition_date).slice(0, 4)
      const list = byYear.get(y)
      list ? list.push(r) : byYear.set(y, [r])
    }

    return [...byYear.entries()]
      .sort((a, b) => (a[0] < b[0] ? 1 : -1))
      .map(([year, list]) => {
        // The season best is computed from countable results only — the same
        // rule the rest of the app uses.
        const best = new Map<string, number>()
        for (const r of list) {
          if (!countsForAnalysis(r, r.discipline)) continue
          const d = String(r.discipline || '')
          const m = Number(r.mark)
          const lower = isLowerBetter(d)
          const cur = best.get(d)
          if (cur == null || (lower ? m < cur : m > cur)) best.set(d, m)
        }
        return { year, list, best, counted: list.filter((r) => countsForAnalysis(r, r.discipline)).length }
      })
  }, [performances])

  const [open, setOpen] = useState<Set<string>>(
    () => new Set(seasons.slice(0, OPEN_SEASONS).map((s) => s.year)),
  )

  if (!seasons.length) {
    return (
      <Text style={[s.empty, { color: colors.text.muted }]}>
        No competition results yet. Log one from the + button and it will appear here
        with where you placed, which round it was, and whether you went through.
      </Text>
    )
  }

  return (
    <View style={{ gap: 10 }}>
      {seasons.map((season) => {
        const isOpen = open.has(season.year)
        const excluded = season.list.length - season.counted
        return (
          <View key={season.year} style={[s.season, { borderColor: colors.glass.border }]}>
            <Tappable
              onPress={() => setOpen((prev) => {
                const n = new Set(prev)
                n.has(season.year) ? n.delete(season.year) : n.add(season.year)
                return n
              })}
              accessibilityLabel={`${season.year} season, ${season.list.length} results. ${isOpen ? 'Collapse' : 'Expand'}`}
              style={s.seasonHead}
            >
              <View style={{ flex: 1 }}>
                <Text style={[s.year, { color: colors.text.primary }]}>{season.year}</Text>
                <Text style={[s.seasonMeta, { color: colors.text.muted }]}>
                  {season.list.length} result{season.list.length === 1 ? '' : 's'}
                  {excluded > 0 ? ` · ${excluded} not counted` : ''}
                </Text>
              </View>
              <Ionicons
                name={isOpen ? 'chevron-up' : 'chevron-down'}
                size={16} color={colors.text.muted}
              />
            </Tappable>

            {isOpen && (
              <View style={{ paddingHorizontal: 12, paddingBottom: 6 }}>
                {season.list.map((r, i) => (
                  <ResultRow
                    key={r.id || i}
                    r={r}
                    isSeasonBest={
                      countsForAnalysis(r, r.discipline)
                      && season.best.get(String(r.discipline || '')) === Number(r.mark)
                    }
                  />
                ))}
              </View>
            )}
          </View>
        )
      })}
    </View>
  )
}

function ResultRow({ r, isSeasonBest }: { r: any; isSeasonBest: boolean }) {
  const { colors } = useTheme()
  const counts = countsForAnalysis(r, r.discipline)
  const reason = exclusionReason(r, r.discipline)
  const d = parseDay(String(r.competition_date))
  const wind = isWindAffected(r.discipline) ? formatWind(r.wind_mps) : null

  // The mark cell carries the status where there is no mark, so the column
  // always says what happened rather than going blank.
  const markText = Number.isFinite(Number(r.mark))
    ? formatMark(Number(r.mark), r.discipline)
    : (STATUS_LABEL[r.status as ResultStatus] || '—')

  const context = [
    ordinal(r.place),
    ROUND_LABEL[r.round] || null,
  ].filter(Boolean).join(' · ')

  return (
    <View style={[s.row, { borderBottomColor: colors.glass.divider }]}>
      <View style={s.date}>
        <Text style={[s.day, { color: colors.text.primary }]}>{d.getDate()}</Text>
        <Text style={[s.mon, { color: colors.text.muted }]}>{MONTH_SHORT[d.getMonth()]}</Text>
      </View>

      <View style={{ flex: 1, gap: 2 }}>
        <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6 }}>
          <Text numberOfLines={1} style={[s.disc, { color: colors.text.primary }]}>
            {r.discipline}
          </Text>
          {isSeasonBest && (
            <View style={[s.tag, { backgroundColor: colors.accent[500] + '2E' }]}>
              <Text style={[s.tagText, { color: colors.accent[500] }]}>SB</Text>
            </View>
          )}
          {!!r.progressed && (
            <View style={[s.tag, {
              backgroundColor: (r.progressed === 'out' ? colors.text.muted : colors.green) + '2E',
            }]}>
              <Text style={[s.tagText, {
                color: r.progressed === 'out' ? colors.text.secondary : colors.green,
              }]}>
                {PROGRESSION_LABEL[r.progressed]}
              </Text>
            </View>
          )}
        </View>

        <Text numberOfLines={1} style={[s.meta, { color: colors.text.muted }]}>
          {[context, r.competition_name].filter(Boolean).join(' · ') || '—'}
        </Text>

        {/* Why it does not count, said plainly rather than left to be noticed. */}
        {!counts && !!reason && (
          <Text style={[s.reason, { color: colors.amber }]}>
            {reason === 'Wind-assisted'
              ? `Wind-assisted${wind ? ` ${wind}` : ''} — legal to run, not a PB`
              : 'Not counted toward your PB or trend'}
          </Text>
        )}
      </View>

      <View style={{ alignItems: 'flex-end' }}>
        <Text style={[s.mark, {
          color: counts ? colors.text.primary : colors.text.muted,
          fontStyle: counts ? 'normal' : 'italic',
        }]}>
          {markText}
        </Text>
        {!!wind && (
          <Text style={[s.wind, { color: colors.text.muted }]}>{wind}</Text>
        )}
      </View>
    </View>
  )
}

const s = StyleSheet.create({
  empty: { fontSize: 13, lineHeight: 19, paddingVertical: spacing.md },
  season: { borderWidth: 1, borderRadius: radius.md, overflow: 'hidden' },
  seasonHead: {
    flexDirection: 'row', alignItems: 'center', gap: 10,
    paddingHorizontal: 14, paddingVertical: 12,
  },
  year: { fontSize: 16, fontWeight: '700', ...numerals },
  seasonMeta: { fontSize: 11.5, marginTop: 2 },
  row: {
    flexDirection: 'row', alignItems: 'center', gap: 12,
    paddingVertical: 11, borderBottomWidth: 1,
  },
  date: { width: 30, alignItems: 'center' },
  day: { fontSize: 15, fontWeight: '700', ...numerals },
  mon: { fontSize: 9.5, letterSpacing: 0.5, textTransform: 'uppercase', fontWeight: '600' },
  disc: { fontSize: 14.5, fontWeight: '600', flexShrink: 1 },
  tag: { paddingHorizontal: 5, paddingVertical: 2, borderRadius: 4 },
  tagText: { fontSize: 8.5, fontWeight: '800', letterSpacing: 0.8 },
  meta: { fontSize: 11.5 },
  reason: { fontSize: 10.5, fontWeight: '600', marginTop: 1 },
  mark: { fontSize: 15.5, fontWeight: '700', ...numerals },
  wind: { fontSize: 10.5, marginTop: 1, ...numerals },
})
