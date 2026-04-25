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
import { insertInto } from '../lib/supabase'
import { isLowerBetter, performancePercentile, performanceZoneLabel } from '../lib/disciplineScience'
import { GlassCard, SectionHeader } from './ui'

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

  const handleSave = async () => {
    if (!discipline || !mark || !user) return
    setError('')
    setSaving(true)

    const numMark = parseFloat(mark)
    if (!Number.isFinite(numMark) || numMark <= 0) {
      setError('Enter a valid positive number.')
      setSaving(false)
      return
    }

    try {
      await insertInto('performances', {
        user_id: user.id,
        discipline,
        mark: numMark,
        competition_name: competition || null,
        competition_date: new Date().toISOString().split('T')[0],
        sex: profile?.sex || 'M',
      })

      // Calculate percentile
      const sex = profile?.sex || 'M'
      const pct = performancePercentile(numMark, discipline, sex)
      const zone = performanceZoneLabel(numMark, discipline, sex)
      setPercentile(pct)
      setZoneLabel(zone)
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
        <Text style={styles.successDiscipline}>{discipline}</Text>
        <Text style={styles.successMark}>{mark} {isLowerBetter(discipline) ? 's' : 'm'}</Text>

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

      <Text style={styles.inputLabel}>{lower ? 'Time (seconds)' : 'Distance (metres)'}</Text>
      <TextInput
        style={styles.markInput}
        keyboardType="decimal-pad"
        placeholder={lower ? '10.52' : '7.85'}
        placeholderTextColor={colors.text.dimmed}
        value={mark}
        onChangeText={setMark}
        autoFocus
      />

      <Text style={styles.inputLabel}>Competition (optional)</Text>
      <TextInput
        style={styles.compInput}
        placeholder="e.g. County Championships"
        placeholderTextColor={colors.text.dimmed}
        value={competition}
        onChangeText={setCompetition}
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
})
