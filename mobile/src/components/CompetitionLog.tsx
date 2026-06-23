// ═══════════════════════════════════════════════════════════════════════
// COMPETITION LOG — Log race results / throws / jumps from competitions
// Discipline picker → Mark/Time input → Competition name → Date → Save
// ═══════════════════════════════════════════════════════════════════════

import React, { useState } from 'react'
import {
  View,
  Text,
  TextInput,
  TouchableOpacity,
  StyleSheet,
  ScrollView,
  Animated,
} from 'react-native'
import { Ionicons } from '@expo/vector-icons'
import { colors, spacing, radius, fonts } from '../lib/theme'
import { useAuth } from '../contexts/AuthContext'
import { insertInto, selectFrom } from '../lib/supabase'
import { isLowerBetter, performancePercentile, performanceZoneLabel } from '../lib/disciplineScience'
import { GlassCard, SectionHeader } from './ui'
import { loadProgress, saveProgress } from '../lib/progress'
import {
  calculateLogXP, calculateStreak, getLevelFromXP,
  getEarnedBadges, getMotivationalMessage, type Badge,
} from '../lib/gamification'

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
function countCompetitionPBs(perfs: any[]): number {
  const best: Record<string, number> = {}
  let n = 0
  const ordered = [...perfs]
    .filter((p) => p.competition_date && p.mark != null)
    .sort((a, b) => new Date(a.competition_date).getTime() - new Date(b.competition_date).getTime())
  for (const p of ordered) {
    const d = p.discipline || '_'
    const lower = isLowerBetter(p.discipline)
    if (best[d] == null || (lower ? p.mark < best[d] : p.mark > best[d])) { best[d] = p.mark; n++ }
  }
  return n
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
    const numMark = parseCompetitionMark(mark, lower)
    if (numMark == null) {
      setError(lower
        ? 'Enter a valid time — e.g. 10.52, 1:52.30, or 2:05:30.'
        : 'Enter a valid distance in metres — e.g. 7.85.')
      setSaving(false)
      return
    }
    const logDate = /^\d{4}-\d{2}-\d{2}$/.test(date) ? date : new Date().toISOString().slice(0, 10)

    try {
      // Prior performances → basis for PB detection + streak (filter by user,
      // narrow to discipline client-side to avoid URL-encoding spaces).
      let prior: any[] = []
      try {
        prior = (await selectFrom('performances', { filter: `user_id=eq.${user.id}`, limit: '1000' })) || []
      } catch { prior = [] }

      let priorPB: number | null = null
      for (const p of prior.filter((x) => x.discipline === discipline)) {
        if (p.mark == null) continue
        if (priorPB == null || (lower ? p.mark < priorPB : p.mark > priorPB)) priorPB = p.mark
      }
      const isPB = priorPB == null || (lower ? numMark < priorPB : numMark > priorPB)

      await insertInto('performances', {
        user_id: user.id,
        discipline,
        mark: numMark,
        competition_name: competition || null,
        competition_date: logDate,
        sex: profile?.sex || profile?.gender || 'M',
      })

      // Benchmarks
      const sex = profile?.sex || profile?.gender || 'M'
      setPercentile(performancePercentile(numMark, discipline, sex))
      setZoneLabel(performanceZoneLabel(numMark, discipline, sex))

      // ── Gamification: award XP / streak / badges, persist (parity with web) ──
      try {
        const allPerfs = [...prior, { discipline, mark: numMark, competition_date: logDate }]
        const allDates = allPerfs.map((p) => p.competition_date).filter(Boolean)
        const newStreak = calculateStreak(allDates)
        const logsToday = allDates.filter((d) => String(d).slice(0, 10) === logDate).length

        const xpResult = calculateLogXP({
          isPB, hasNotes: false,
          isFirstEver: prior.length === 0,
          isNewCategory: false,
          logsToday, currentStreak: newStreak.current,
        })

        const progress = await loadProgress(user.id)
        const prevXP = progress?.totalXP ?? 0
        const newTotalXP = prevXP + xpResult.total

        const stats = {
          totalLogs: allPerfs.length,
          totalPBs: countCompetitionPBs(allPerfs),
          currentStreak: newStreak.current,
          longestStreak: Math.max(progress?.longestStreak ?? 0, newStreak.longest),
          categoriesLogged: 0,
          totalXP: newTotalXP,
          daysActive: new Set(allDates.map((d) => String(d).slice(0, 10))).size,
          logsToday,
          uniqueMetrics: 0,
        }
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
          bootstrapped: true,
        })

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

        <TouchableOpacity style={styles.doneBtn} onPress={onClose}>
          <Text style={styles.doneBtnText}>Done</Text>
        </TouchableOpacity>
      </ScrollView>
    )
  }

  // ── Discipline picker ──
  if (!discipline) {
    return (
      <ScrollView contentContainerStyle={styles.pickerContent}>
        <View style={styles.pickerHeader}>
          <TouchableOpacity onPress={onClose}>
            <Ionicons name="close" size={24} color={colors.text.secondary} />
          </TouchableOpacity>
          <Text style={styles.pickerTitle}>Log Competition</Text>
          <View style={{ width: 24 }} />
        </View>
        <Text style={styles.pickerSub}>Select your event</Text>

        {DISCIPLINES.map((group) => (
          <View key={group.group} style={styles.groupWrap}>
            <Text style={styles.groupLabel}>{group.group}</Text>
            <View style={styles.disciplineGrid}>
              {group.items.map((d) => (
                <TouchableOpacity
                  key={d}
                  style={styles.disciplineChip}
                  onPress={() => setDiscipline(d)}
                  activeOpacity={0.7}
                >
                  <Text style={styles.disciplineText}>{d}</Text>
                </TouchableOpacity>
              ))}
            </View>
          </View>
        ))}
      </ScrollView>
    )
  }

  // ── Mark input ──
  const lower = isLowerBetter(discipline)
  return (
    <ScrollView contentContainerStyle={styles.inputContent} keyboardShouldPersistTaps="handled">
      <View style={styles.pickerHeader}>
        <TouchableOpacity onPress={() => setDiscipline(null)}>
          <Ionicons name="arrow-back" size={24} color={colors.text.secondary} />
        </TouchableOpacity>
        <Text style={styles.pickerTitle}>{discipline}</Text>
        <View style={{ width: 24 }} />
      </View>

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

      <TouchableOpacity
        style={[styles.logBtn, (!mark || saving) && { opacity: 0.4 }]}
        onPress={handleSave}
        disabled={!mark || saving}
        activeOpacity={0.8}
      >
        <Text style={styles.logBtnText}>{saving ? 'Saving…' : 'Log Result'}</Text>
      </TouchableOpacity>
    </ScrollView>
  )
}

const styles = StyleSheet.create({
  // Discipline picker
  pickerContent: { padding: spacing.lg },
  pickerHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: spacing.md,
  },
  pickerTitle: { fontSize: 18, fontWeight: '700', color: colors.text.primary },
  pickerSub: { color: colors.text.secondary, fontSize: 14, marginBottom: spacing.lg },

  groupWrap: { marginBottom: spacing.lg },
  groupLabel: {
    fontSize: 10,
    letterSpacing: 2,
    textTransform: 'uppercase',
    color: colors.text.muted,
    fontWeight: '600',
    marginBottom: spacing.sm,
  },
  disciplineGrid: { flexDirection: 'row', flexWrap: 'wrap', gap: spacing.sm },
  disciplineChip: {
    backgroundColor: 'rgba(255,255,255,0.04)',
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.08)',
    borderRadius: radius.md,
    paddingHorizontal: 16,
    paddingVertical: 10,
  },
  disciplineText: { color: colors.text.primary, fontSize: 14, fontWeight: '500' },

  // Mark input
  inputContent: { padding: spacing.xxl },
  inputLabel: {
    color: colors.text.secondary,
    fontSize: 13,
    fontWeight: '500',
    marginBottom: spacing.sm,
    marginTop: spacing.lg,
  },
  markInput: {
    fontSize: 44,
    fontWeight: '700',
    color: colors.orange[400],
    textAlign: 'center',
    borderBottomWidth: 2,
    borderBottomColor: colors.orange[500] + '40',
    paddingVertical: spacing.md,
  },
  compInput: {
    backgroundColor: colors.bg.input,
    borderWidth: 1,
    borderColor: colors.bg.inputBorder,
    borderRadius: radius.md,
    paddingHorizontal: spacing.lg,
    paddingVertical: 14,
    fontSize: 16,
    color: colors.text.primary,
  },
  errorBanner: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: 8,
    backgroundColor: 'rgba(251,113,133,0.08)',
    borderWidth: 1,
    borderColor: 'rgba(251,113,133,0.2)',
    borderRadius: radius.md,
    padding: spacing.md,
    marginTop: spacing.lg,
  },
  errorText: {
    color: colors.red,
    fontSize: 13,
    lineHeight: 18,
    flex: 1,
  },
  logBtn: {
    backgroundColor: colors.orange[500],
    borderRadius: radius.md,
    paddingVertical: 18,
    alignItems: 'center',
    marginTop: spacing.xxl,
  },
  logBtnText: { color: '#fff', fontSize: 17, fontWeight: '700', letterSpacing: 0.5 },

  // Success
  successView: { padding: spacing.xxl, alignItems: 'center', paddingTop: 60 },
  successIcon: { marginBottom: spacing.md },
  successTitle: { fontSize: 24, fontWeight: '700', color: colors.green, marginBottom: 4 },
  successDiscipline: { fontSize: 16, color: colors.text.secondary },
  successMark: { fontSize: 40, fontWeight: '700', color: colors.text.primary, marginTop: spacing.sm },
  benchmarkRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    paddingVertical: 8,
    borderBottomWidth: 1,
    borderBottomColor: 'rgba(255,255,255,0.04)',
  },
  benchmarkLabel: { color: colors.text.secondary, fontSize: 14 },
  benchmarkValue: { fontSize: 18, fontWeight: '700' },
  benchmarkZone: { color: colors.text.primary, fontSize: 14, fontWeight: '600' },
  doneBtn: {
    marginTop: spacing.xxl,
    paddingHorizontal: 40,
    paddingVertical: 14,
    borderRadius: radius.md,
    borderWidth: 1,
    borderColor: colors.text.dimmed,
  },
  doneBtnText: { color: colors.text.primary, fontSize: 15, fontWeight: '600' },

  // Input hint + gamification on success screen
  inputHint: { color: colors.text.muted, fontSize: 11, marginTop: 6 },
  pbTag: {
    color: colors.orange[400], fontSize: 11, fontWeight: '700',
    letterSpacing: 2, marginTop: 4,
  },
  celebMsg: {
    color: colors.text.secondary, fontSize: 14, textAlign: 'center',
    marginTop: spacing.md, lineHeight: 20, paddingHorizontal: spacing.lg,
  },
  xpHeaderRow: {
    flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center',
    marginBottom: spacing.sm,
  },
  xpHeaderLabel: { color: colors.text.secondary, fontSize: 13, fontWeight: '600' },
  xpHeaderValue: { color: colors.orange[400], fontSize: 20, fontWeight: '800' },
  xpRow: { flexDirection: 'row', justifyContent: 'space-between', paddingVertical: 3 },
  xpRowReason: { color: colors.text.muted, fontSize: 12 },
  xpRowVal: { color: colors.orange[400], fontSize: 12, fontWeight: '700' },
  levelUpRow: {
    flexDirection: 'row', alignItems: 'center', gap: 6,
    marginTop: spacing.md, paddingTop: spacing.md,
    borderTopWidth: 1, borderTopColor: 'rgba(255,255,255,0.06)',
  },
  levelUpText: { color: colors.text.primary, fontSize: 13, fontWeight: '700' },
  badgeWrap: { flexDirection: 'row', flexWrap: 'wrap', gap: 8, marginTop: spacing.md },
  badgeChip: {
    flexDirection: 'row', alignItems: 'center', gap: 6,
    backgroundColor: 'rgba(255,255,255,0.05)',
    borderWidth: 1, borderColor: 'rgba(255,255,255,0.1)',
    borderRadius: 999, paddingHorizontal: 10, paddingVertical: 5,
  },
  badgeIcon: { fontSize: 14 },
  badgeTitle: { color: colors.text.primary, fontSize: 12, fontWeight: '600' },
})
