// ═══════════════════════════════════════════════════════════════════════
// COMPETITION LOG — Log race results / throws / jumps from competitions
// Discipline picker → Mark/Time input → Competition name → Date → Save
// ═══════════════════════════════════════════════════════════════════════

import React, { useState } from 'react'
import {
  View,
  Text,
  TextInput,
  StyleSheet,
  ScrollView,
  Animated } from 'react-native'
import { Ionicons } from '@expo/vector-icons'
// Rendered only from the Log tab, which runs on the dark ground under
// <OnImageTheme/>. This file was still on the static LIGHT palette, so every
// label was #16181D — near-black ink on #0B0C18. The event chips were
// technically on screen the whole time and completely unreadable.
import { onImageColors as colors, spacing, radius, onImage, typeScale, weight } from '../lib/theme'
import { useAuth } from '../contexts/AuthContext'
import { TAB_BAR_CLEARANCE } from '../navigation/FloatingTabBar'
import { insertInto, selectFrom } from '../lib/supabase'
import {
  RESULT_STATUSES, ROUNDS, PROGRESSIONS, ROUND_LABEL,
  isWindAffected, isCompleted, countsForAnalysis, roundHasProgression,
  countPersonalBests, optionalNumber, WIND_LIMIT, type ResultStatus } from '../lib/resultSemantics'
import { isLowerBetter, performancePercentile, performanceZoneLabel } from '../lib/disciplineScience'
import {
  GlassCard,
  SectionHeader,
  Tappable } from './ui'
import { loadProgress, saveProgress } from '../lib/progress'
import {
  calculateLogXP, calculateStreak, getLevelFromXP,
  getEarnedBadges, getMotivationalMessage, type Badge } from '../lib/gamification'

// Parse a competition mark. Field events: plain metres ("7.85"). Time events:
// seconds ("10.52"), m:ss ("1:52.30") or h:mm:ss ("2:05:30" for marathon).
function parseCompetitionMark(raw: string, isTime: boolean): number | null {
  if (!raw) return null
  const s = raw.trim().replace(',', '.')
  if (!isTime) {
    const v = parseFloat(s.replace('m', ''))
    return Number.isFinite(v) && v > 0 ? v : null
  }
  if (s.includes(':')) {
    const parts = s.split(':').map((p) => parseFloat(p))
    if (parts.some((p) => !Number.isFinite(p))) return null
    let secs = 0
    if (parts.length === 2) secs = parts[0] * 60 + parts[1]          // m:ss
    else if (parts.length === 3) secs = parts[0] * 3600 + parts[1] * 60 + parts[2] // h:mm:ss
    else return null
    return secs > 0 ? secs : null
  }
  const v = parseFloat(s)
  return Number.isFinite(v) && v > 0 ? v : null
}

// Count PBs set across a performance history (replay per discipline).
// A selectable option. `danger` tints the non-completion statuses, so DNF and
// DQ do not read as neutral alternatives to finishing.
function Pill({
  label, active, danger, onPress }: { label: string; active: boolean; danger?: boolean; onPress: () => void }) {
  const on = active ? (danger ? colors.red : colors.accent[500]) : null
  return (
    <Tappable
      onPress={onPress}
      accessibilityRole="button"
      accessibilityState={{ selected: active }}
      accessibilityLabel={label}
      style={[
        styles.pill,
        on ? { backgroundColor: on + '2E', borderColor: on + '73' } : null,
      ]}
    >
      <Text style={[styles.pillText, on ? { color: on } : null]}>{label}</Text>
    </Tappable>
  )
}

const DISCIPLINES = [
  { group: 'Sprints', items: ['60m', '100m', '200m', '400m'] },
  { group: 'Hurdles', items: ['60mH', '100mH', '110mH', '400mH'] },
  { group: 'Middle', items: ['800m', '1500m'] },
  { group: 'Distance', items: ['3000m', '5000m', '10000m', 'Marathon'] },
  { group: 'Jumps', items: ['Long Jump', 'Triple Jump', 'High Jump', 'Pole Vault'] },
  { group: 'Throws', items: ['Shot Put', 'Discus Throw', 'Javelin Throw', 'Hammer Throw'] },
]

interface CompetitionLogProps {
  onClose: () => void
}

export default function CompetitionLog({ onClose }: CompetitionLogProps) {
  const { user, profile } = useAuth()
  const [discipline, setDiscipline] = useState<string | null>(null)
  const [mark, setMark] = useState('')
  const [competition, setCompetition] = useState('')
  // What actually happened. Status leads because it decides whether a mark is
  // even a sensible thing to ask for.
  const [status, setStatus] = useState<ResultStatus>('OK')
  const [place, setPlace] = useState('')
  const [round, setRound] = useState<string | null>(null)
  const [progressed, setProgressed] = useState<string | null>(null)
  const [wind, setWind] = useState('')
  const [saving, setSaving] = useState(false)
  const [saved, setSaved] = useState(false)
  const [error, setError] = useState('')
  const [percentile, setPercentile] = useState<number | null>(null)
  const [zoneLabel, setZoneLabel] = useState<string | null>(null)
  const [date, setDate] = useState(new Date().toISOString().slice(0, 10))
  // Gamification results shown on the success screen
  const [xpEarned, setXpEarned] = useState(0)
  const [xpBreakdown, setXpBreakdown] = useState<{ reason: string; xp: number }[]>([])
  const [newBadges, setNewBadges] = useState<Badge[]>([])
  const [leveledUp, setLeveledUp] = useState(false)
  const [newLevel, setNewLevel] = useState<{ level: number; title: string; icon: string } | null>(null)
  const [isPbResult, setIsPbResult] = useState(false)
  const [celebMsg, setCelebMsg] = useState('')

  const handleSave = async () => {
    if (!discipline || !mark || !user) return
    setError('')
    setSaving(true)

    const lower = isLowerBetter(discipline)
    const completed = isCompleted(status)
    const numMark = parseCompetitionMark(mark, lower)

    // A DNF has no time and a no-mark has no distance. Requiring one would
    // make the honest answer unloggable, which is how results stop being
    // logged at all.
    if (completed && numMark == null) {
      setError(lower
        ? 'Enter a valid time — e.g. 10.52, 1:52.30, or 2:05:30.'
        : 'Enter a valid distance in metres — e.g. 7.85.')
      setSaving(false)
      return
    }
    const numPlace = optionalNumber(place)
    if (place.trim() && (numPlace == null || numPlace < 1 || !Number.isInteger(numPlace))) {
      setError('Finishing position should be a whole number — 1 for first.')
      setSaving(false); return
    }
    const numWind = optionalNumber(wind)
    if (wind.trim() && (numWind == null || numWind < -9.9 || numWind > 9.9)) {
      setError('Wind should be a reading in m/s, e.g. 1.8 or -0.4.')
      setSaving(false); return
    }
    const logDate = /^\d{4}-\d{2}-\d{2}$/.test(date) ? date : new Date().toISOString().slice(0, 10)

    try {
      // Prior performances → basis for PB detection + streak (filter by user,
      // narrow to discipline client-side to avoid URL-encoding spaces).
      let prior: any[] = []
      try {
        prior = (await selectFrom('performances', { filter: `user_id=eq.${user.id}`, limit: '1000' })) || []
      } catch { prior = [] }

      // Only legal results set a personal best. A DQ'd time and a
      // wind-assisted mark are both real numbers that the sport does not
      // count, and `countsForAnalysis` is the one place that decides.
      let priorPB: number | null = null
      for (const p of prior.filter((x) => x.discipline === discipline)) {
        if (!countsForAnalysis(p, discipline)) continue
        const m = Number(p.mark)
        if (priorPB == null || (lower ? m < priorPB : m > priorPB)) priorPB = m
      }
      const thisRow = {
        status, mark: numMark, discipline,
        wind_mps: isWindAffected(discipline) ? numWind : null }
      const eligible = countsForAnalysis(thisRow, discipline)
      const isPB = eligible && (priorPB == null
        || (lower ? numMark! < priorPB : numMark! > priorPB))

      await insertInto('performances', {
        user_id: user.id,
        discipline,
        // A DQ often carries the time it was recorded at before being voided,
        // so the mark is kept where there is one — the status is what stops
        // it counting, not its absence.
        mark: numMark,
        status,
        place: numPlace,
        round: round || null,
        // A final has nothing to progress to; storing "out" there would read
        // as elimination from a round that does not exist.
        progressed: roundHasProgression(round) ? progressed : null,
        wind_mps: isWindAffected(discipline) ? numWind : null,
        competition_name: competition || null,
        competition_date: logDate,
        sex: profile?.sex || profile?.gender || 'M' })

      // Benchmarks. Only a legal result has a percentile — ranking a DQ or a
      // wind-assisted mark against the population would be a flattering lie,
      // and there is no mark at all behind a DNF.
      const sex = profile?.sex || profile?.gender || 'M'
      if (eligible && numMark != null) {
        setPercentile(performancePercentile(numMark, discipline, sex))
        setZoneLabel(performanceZoneLabel(numMark, discipline, sex))
      } else {
        setPercentile(null)
        setZoneLabel(null)
      }

      // ── Gamification: award XP / streak / badges, persist (parity with web) ──
      try {
        // The new row carries its status so countCompetitionPBs, which reads
        // marks, cannot count a DNF or a voided time as a best.
        const allPerfs = [...prior, {
          discipline, mark: numMark, competition_date: logDate,
          status, wind_mps: thisRow.wind_mps }]
        const allDates = allPerfs.map((p) => p.competition_date).filter(Boolean)
        const newStreak = calculateStreak(allDates)
        const logsToday = allDates.filter((d) => String(d).slice(0, 10) === logDate).length

        const xpResult = calculateLogXP({
          isPB, hasNotes: false,
          isFirstEver: prior.length === 0,
          isNewCategory: false,
          logsToday, currentStreak: newStreak.current })

        const progress = await loadProgress(user.id)
        const prevXP = progress?.totalXP ?? 0
        const newTotalXP = prevXP + xpResult.total

        const stats = {
          totalLogs: allPerfs.length,
          totalPBs: countPersonalBests(allPerfs),
          currentStreak: newStreak.current,
          longestStreak: Math.max(progress?.longestStreak ?? 0, newStreak.longest),
          categoriesLogged: 0,
          totalXP: newTotalXP,
          daysActive: new Set(allDates.map((d) => String(d).slice(0, 10))).size,
          logsToday,
          uniqueMetrics: 0 }
        const earnedIds = getEarnedBadges(stats).map((b) => b.id)
        const prevIds = new Set(progress?.badgesEarned ?? [])
        const freshBadges = getEarnedBadges(stats).filter((b) => !prevIds.has(b.id))

        const before = getLevelFromXP(prevXP)
        const after = getLevelFromXP(newTotalXP)

        await saveProgress(user.id, {
          totalXP: newTotalXP,
          longestStreak: stats.longestStreak,
          badgesEarned: earnedIds,
          lastLogDate: logDate,
          bootstrapped: true })

        setXpEarned(xpResult.total)
        setXpBreakdown(xpResult.breakdown)
        setNewBadges(freshBadges)
        setLeveledUp(after.level > before.level)
        setNewLevel(after.level > before.level ? { level: after.level, title: after.title, icon: after.icon } : null)
        setIsPbResult(isPB)
        setCelebMsg(getMotivationalMessage(isPB, newStreak.current))
      } catch (ge) {
        console.warn('[competition] gamification failed:', ge)
      }

      setSaved(true)
    } catch (e: any) {
      const msg = e.message || 'Failed to save'
      if (msg.includes('404') || msg.includes('relation') || msg.includes('does not exist')) {
        setError('The performances table is not set up yet in Supabase. Please create it first, or use Physical mode to log training metrics.')
      } else {
        setError(msg)
      }
    }
    setSaving(false)
  }

  // ── Success view ──
  if (saved && discipline) {
    return (
      <ScrollView contentContainerStyle={styles.successView}>
        <View style={styles.successIcon}>
          <Ionicons name="checkmark-circle" size={48} color={colors.green} />
        </View>
        <Text style={styles.successTitle}>Logged!</Text>
        {isPbResult && <Text style={styles.pbTag}>★ PERSONAL BEST</Text>}
        <Text style={styles.successDiscipline}>{discipline}</Text>
        <Text style={styles.successMark}>{mark} {isLowerBetter(discipline) ? '' : 'm'}</Text>

        {celebMsg !== '' && <Text style={styles.celebMsg}>{celebMsg}</Text>}

        {xpEarned > 0 && (
          <GlassCard style={{ marginTop: spacing.lg, width: '100%' }}>
            <View style={styles.xpHeaderRow}>
              <Text style={styles.xpHeaderLabel}>XP Earned</Text>
              <Text style={styles.xpHeaderValue}>+{xpEarned}</Text>
            </View>
            {xpBreakdown.map((b, i) => (
              <View key={i} style={styles.xpRow}>
                <Text style={styles.xpRowReason}>{b.reason}</Text>
                <Text style={styles.xpRowVal}>+{b.xp}</Text>
              </View>
            ))}
            {leveledUp && newLevel && (
              <View style={styles.levelUpRow}>
                <Ionicons name="arrow-up-circle" size={16} color={colors.orange[400]} />
                <Text style={styles.levelUpText}>Level up! {newLevel.icon} Lv {newLevel.level} · {newLevel.title}</Text>
              </View>
            )}
            {newBadges.length > 0 && (
              <View style={styles.badgeWrap}>
                {newBadges.map((b) => (
                  <View key={b.id} style={styles.badgeChip}>
                    <Text style={styles.badgeIcon}>{b.icon}</Text>
                    <Text style={styles.badgeTitle}>{b.title}</Text>
                  </View>
                ))}
              </View>
            )}
          </GlassCard>
        )}

        {percentile != null && (
          <GlassCard style={{ marginTop: spacing.xl, width: '100%' }}>
            <View style={styles.benchmarkRow}>
              <Text style={styles.benchmarkLabel}>Olympic Percentile</Text>
              <Text style={[styles.benchmarkValue, { color: colors.orange[400] }]}>
                P{percentile}
              </Text>
            </View>
            {zoneLabel && (
              <View style={styles.benchmarkRow}>
                <Text style={styles.benchmarkLabel}>Zone</Text>
                <Text style={styles.benchmarkZone}>{zoneLabel}</Text>
              </View>
            )}
          </GlassCard>
        )}

        <Tappable style={styles.doneBtn} onPress={onClose}>
          <Text style={styles.doneBtnText}>Done</Text>
        </Tappable>
      </ScrollView>
    )
  }

  // ── Discipline picker ──
  if (!discipline) {
    return (
      <ScrollView contentContainerStyle={styles.pickerContent}>
        <View style={styles.pickerHeader}>
          <Tappable
            onPress={onClose} hitSlop={12} style={styles.headerBtn}
            accessibilityRole="button" accessibilityLabel="Close"
          >
            <Ionicons name="close" size={22} color={colors.text.secondary} />
          </Tappable>
          <Text style={styles.pickerTitle}>Log Competition</Text>
          <View style={{ width: 44 }} />
        </View>
        <Text style={styles.pickerSub}>Select your event</Text>

        {DISCIPLINES.map((group) => (
          <View key={group.group} style={styles.groupWrap}>
            <Text style={styles.groupLabel}>{group.group}</Text>
            <View style={styles.disciplineGrid}>
              {group.items.map((d) => (
                <Tappable
                  key={d}
                  style={styles.disciplineChip}
                  onPress={() => setDiscipline(d)}
                >
                  <Text style={styles.disciplineText}>{d}</Text>
                </Tappable>
              ))}
            </View>
          </View>
        ))}
      </ScrollView>
    )
  }

  // ── Mark input ──
  const lower = isLowerBetter(discipline)
  const completed = isCompleted(status)
  const windy = isWindAffected(discipline)
  const assisted = windy && (optionalNumber(wind) ?? -99) > WIND_LIMIT
  // Field events qualify rather than run heats, so they are offered a
  // different set of rounds.
  const isField = !lower
  return (
    <ScrollView contentContainerStyle={styles.inputContent} keyboardShouldPersistTaps="handled">
      <View style={styles.pickerHeader}>
        <Tappable
          onPress={() => setDiscipline(null)} hitSlop={12} style={styles.headerBtn}
          accessibilityRole="button" accessibilityLabel="Back to events"
        >
          <Ionicons name="arrow-back" size={22} color={colors.text.secondary} />
        </Tappable>
        <Text style={styles.pickerTitle}>{discipline}</Text>
        <View style={{ width: 44 }} />
      </View>

      {/* ── What happened ──────────────────────────────────────────
          Asked before the mark, because it decides whether asking for one
          makes sense at all. An athlete who pulled up at 60m should not have
          to invent a time to record the race. */}
      <Text style={styles.inputLabel}>Result</Text>
      <View style={styles.chipRow}>
        {RESULT_STATUSES.map((st) => (
          <Pill
            key={st.v} label={st.l} active={status === st.v}
            danger={st.v !== 'OK'}
            onPress={() => setStatus(st.v)}
          />
        ))}
      </View>

      {completed ? (
        <>
          <Text style={styles.inputLabel}>{lower ? 'Time' : 'Distance (metres)'}</Text>
          <TextInput
            style={styles.markInput}
            keyboardType={lower ? 'default' : 'decimal-pad'}
            placeholder={lower ? '1:52.30' : '7.85'}
            placeholderTextColor={colors.text.dimmed}
            value={mark}
            onChangeText={setMark}
            autoFocus
          />
          <Text style={styles.inputHint}>
            {lower ? 'Seconds (10.52), m:ss (1:52.30), or h:mm:ss (2:05:30)' : 'Metres, e.g. 7.85'}
          </Text>
        </>
      ) : (
        <>
          {/* A DQ usually has the time that was on the clock before it was
              voided. Worth keeping — it just never counts. */}
          <Text style={styles.inputLabel}>
            {lower ? 'Time' : 'Distance'} (optional)
          </Text>
          <TextInput
            style={styles.markInput}
            keyboardType={lower ? 'default' : 'decimal-pad'}
            placeholder={status === 'DQ' ? (lower ? '10.52' : '7.85') : '—'}
            placeholderTextColor={colors.text.dimmed}
            value={mark}
            onChangeText={setMark}
          />
          <Text style={styles.inputHint}>
            {RESULT_STATUSES.find((x) => x.v === status)?.hint}
            {' It will not count toward your PB or trend.'}
          </Text>
        </>
      )}

      {/* ── Wind, only where it is measured ──────────────────────── */}
      {windy && (
        <>
          <Text style={styles.inputLabel}>Wind (m/s, optional)</Text>
          <TextInput
            style={styles.compInput}
            keyboardType="numbers-and-punctuation"
            placeholder="e.g. 1.8 or -0.4"
            placeholderTextColor={colors.text.dimmed}
            value={wind}
            onChangeText={setWind}
          />
          <Text style={[styles.inputHint, assisted && { color: colors.amber }]}>
            {assisted
              ? `Over +${WIND_LIMIT.toFixed(1)} — wind-assisted. It will show in your results but never as a PB.`
              : `Tailwind is positive. Over +${WIND_LIMIT.toFixed(1)} is wind-assisted and cannot be a PB.`}
          </Text>
        </>
      )}

      {/* ── Where they came ─────────────────────────────────────── */}
      <Text style={styles.inputLabel}>Finishing position (optional)</Text>
      <TextInput
        style={styles.compInput}
        keyboardType="number-pad"
        placeholder="e.g. 2"
        placeholderTextColor={colors.text.dimmed}
        value={place}
        onChangeText={setPlace}
      />

      {/* ── Which round ─────────────────────────────────────────── */}
      <Text style={styles.inputLabel}>Round (optional)</Text>
      <View style={styles.chipRow}>
        {ROUNDS.filter((r) => (isField ? r.field : r.track)).map((r) => (
          <Pill
            key={r.v} label={r.l} active={round === r.v}
            onPress={() => setRound(round === r.v ? null : r.v)}
          />
        ))}
      </View>

      {/* Only a round you can advance FROM asks whether you did. */}
      {roundHasProgression(round) && (
        <>
          <Text style={styles.inputLabel}>Did you go through?</Text>
          <View style={styles.chipRow}>
            {PROGRESSIONS.map((pr) => (
              <Pill
                key={pr.v} label={pr.l} active={progressed === pr.v}
                onPress={() => setProgressed(progressed === pr.v ? null : pr.v)}
              />
            ))}
          </View>
        </>
      )}

      <Text style={styles.inputLabel}>Competition (optional)</Text>
      <TextInput
        style={styles.compInput}
        placeholder="e.g. County Championships"
        placeholderTextColor={colors.text.dimmed}
        value={competition}
        onChangeText={setCompetition}
      />

      <Text style={styles.inputLabel}>Date</Text>
      <TextInput
        style={styles.compInput}
        keyboardType="numbers-and-punctuation"
        placeholder="YYYY-MM-DD"
        placeholderTextColor={colors.text.dimmed}
        value={date}
        onChangeText={setDate}
      />

      {/* Error display */}
      {error !== '' && (
        <View style={styles.errorBanner}>
          <Ionicons name="alert-circle" size={16} color={colors.red} />
          <Text style={styles.errorText}>{error}</Text>
        </View>
      )}

      <Tappable
        style={[styles.logBtn, (!mark || saving) && { opacity: 0.4 }]}
        onPress={handleSave}
        disabled={!mark || saving}
      >
        <Text style={styles.logBtnText}>{saving ? 'Saving…' : 'Log Result'}</Text>
      </Tappable>
    </ScrollView>
  )
}

const styles = StyleSheet.create({
  // Discipline picker
  pickerContent: { padding: spacing.lg, paddingBottom: TAB_BAR_CLEARANCE },
  headerBtn: {
    width: 44, height: 44, alignItems: 'flex-start', justifyContent: 'center' },
  pickerHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: spacing.md },
  pickerTitle: {
    fontSize: typeScale.title, fontWeight: weight.bold, color: colors.text.primary,
    letterSpacing: -0.3 },
  pickerSub: {
    color: colors.text.secondary, fontSize: typeScale.body, marginBottom: spacing.xl },

  groupWrap: { marginBottom: spacing.lg },
  groupLabel: {
    fontSize: typeScale.label,
    letterSpacing: 2,
    textTransform: 'uppercase',
    color: colors.text.muted,
    fontWeight: weight.medium,
    marginBottom: spacing.sm },
  disciplineGrid: { flexDirection: 'row', flexWrap: 'wrap', gap: spacing.sm },
  disciplineChip: {
    // 4% fill with an 8% border on #0B0C18 is a 1.05:1 edge — the chips were
    // technically drawn and effectively invisible. Lifted to the same values
    // the rest of the app uses for a tappable surface, and given a real 44pt
    // target (10pt padding round 14pt text came out at ~34).
    backgroundColor: 'rgba(255,255,255,0.07)',
    borderWidth: 1,
    // 0.34, not the 0.18 the rest of the app uses for a passive card edge.
    // Measured over #0B0C18: 0.18 gives a 1.65:1 border, and WCAG wants 3:1
    // for the boundary of a control. 0.34 lands at 3.02:1. These chips are
    // the only thing on the screen to tap, so their edge has to be findable.
    borderColor: 'rgba(255,255,255,0.34)',
    borderRadius: radius.control,
    paddingHorizontal: 18,
    minHeight: 44,
    justifyContent: 'center' },
  disciplineText: {
    color: colors.text.primary, fontSize: typeScale.body, fontWeight: weight.medium },

  // Mark input
  inputContent: { padding: spacing.xxl, paddingBottom: TAB_BAR_CLEARANCE },
  inputLabel: {
    color: colors.text.secondary,
    fontSize: typeScale.caption,
    fontWeight: weight.medium,
    marginBottom: spacing.sm,
    marginTop: spacing.lg },
  markInput: {
    fontSize: typeScale.display,
    fontWeight: weight.bold,
    color: colors.orange[400],
    textAlign: 'center',
    borderBottomWidth: 2,
    borderBottomColor: colors.orange[500] + '40',
    paddingVertical: spacing.md },
  compInput: {
    backgroundColor: colors.bg.input,
    borderWidth: 1,
    borderColor: colors.bg.inputBorder,
    borderRadius: radius.control,
    paddingHorizontal: spacing.lg,
    paddingVertical: 14,
    fontSize: typeScale.body,
    color: colors.text.primary },
  errorBanner: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: 8,
    backgroundColor: 'rgba(251,113,133,0.08)',
    borderWidth: 1,
    borderColor: 'rgba(251,113,133,0.2)',
    borderRadius: radius.control,
    padding: spacing.md,
    marginTop: spacing.lg },
  errorText: {
    color: colors.red,
    fontSize: typeScale.caption,
    lineHeight: 18,
    flex: 1 },
  logBtn: {
    backgroundColor: colors.orange[500],
    borderRadius: radius.control,
    paddingVertical: 18,
    alignItems: 'center',
    marginTop: spacing.xxl },
  logBtnText: { color: '#fff', fontSize: typeScale.title, fontWeight: weight.bold, letterSpacing: 0.5 },

  // Success
  successView: { padding: spacing.xxl, alignItems: 'center', paddingTop: 60 },
  successIcon: { marginBottom: spacing.md },
  successTitle: { fontSize: typeScale.stat, fontWeight: weight.bold, color: colors.green, marginBottom: 4 },
  successDiscipline: { fontSize: typeScale.body, color: colors.text.secondary },
  successMark: { fontSize: typeScale.display, fontWeight: weight.bold, color: colors.text.primary, marginTop: spacing.sm },
  benchmarkRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    paddingVertical: 8,
    borderBottomWidth: 1,
    borderBottomColor: 'rgba(255,255,255,0.04)' },
  benchmarkLabel: { color: colors.text.secondary, fontSize: typeScale.body },
  benchmarkValue: { fontSize: typeScale.title, fontWeight: weight.bold },
  benchmarkZone: { color: colors.text.primary, fontSize: typeScale.body, fontWeight: weight.medium },
  doneBtn: {
    marginTop: spacing.xxl,
    paddingHorizontal: 40,
    paddingVertical: 14,
    borderRadius: radius.control,
    borderWidth: 1,
    borderColor: colors.text.dimmed },
  doneBtnText: { color: colors.text.primary, fontSize: typeScale.body, fontWeight: weight.medium },

  // Input hint + gamification on success screen
  inputHint: { color: colors.text.muted, fontSize: typeScale.label, marginTop: 6, lineHeight: 16 },
  chipRow: { flexDirection: 'row', flexWrap: 'wrap', gap: 8, marginTop: 2 },
  pill: {
    // 44pt minimum touch target (Apple HIG) — these read as small chips but
    // are full-size targets.
    minHeight: 44, minWidth: 44, paddingHorizontal: 14, justifyContent: 'center',
    borderRadius: radius.control, borderWidth: 1,
    borderColor: colors.glass.border, backgroundColor: colors.bg.primary },
  pillText: { fontSize: typeScale.caption, fontWeight: weight.bold, color: colors.text.secondary },
  pbTag: {
    color: colors.orange[400], fontSize: typeScale.label, fontWeight: weight.bold,
    letterSpacing: 2, marginTop: 4 },
  celebMsg: {
    color: colors.text.secondary, fontSize: typeScale.body, textAlign: 'center',
    marginTop: spacing.md, lineHeight: 20, paddingHorizontal: spacing.lg },
  xpHeaderRow: {
    flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center',
    marginBottom: spacing.sm },
  xpHeaderLabel: { color: colors.text.secondary, fontSize: typeScale.caption, fontWeight: weight.medium },
  xpHeaderValue: { color: colors.orange[400], fontSize: typeScale.title, fontWeight: weight.bold },
  xpRow: { flexDirection: 'row', justifyContent: 'space-between', paddingVertical: 3 },
  xpRowReason: { color: colors.text.muted, fontSize: typeScale.caption },
  xpRowVal: { color: colors.orange[400], fontSize: typeScale.caption, fontWeight: weight.bold },
  levelUpRow: {
    flexDirection: 'row', alignItems: 'center', gap: 6,
    marginTop: spacing.md, paddingTop: spacing.md,
    borderTopWidth: 1, borderTopColor: 'rgba(255,255,255,0.06)' },
  levelUpText: { color: colors.text.primary, fontSize: typeScale.caption, fontWeight: weight.bold },
  badgeWrap: { flexDirection: 'row', flexWrap: 'wrap', gap: 8, marginTop: spacing.md },
  badgeChip: {
    flexDirection: 'row', alignItems: 'center', gap: 6,
    backgroundColor: 'rgba(255,255,255,0.05)',
    borderWidth: 1, borderColor: 'rgba(255,255,255,0.1)',
    borderRadius: radius.full, paddingHorizontal: 10, paddingVertical: 5 },
  badgeIcon: { fontSize: typeScale.body },
  badgeTitle: { color: colors.text.primary, fontSize: typeScale.caption, fontWeight: weight.medium } })
