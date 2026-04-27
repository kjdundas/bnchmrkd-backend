// ═══════════════════════════════════════════════════════════════════════════
// COACH ANALYSE SCREEN — Premium Quick Performance Analysis
// Clean discipline list → enter mark → instant tier breakdown
// No emojis — professional Ionicons, Strava-style data layout
// ═══════════════════════════════════════════════════════════════════════════

import React, { useState, useMemo } from 'react'
import {
  View,
  Text,
  ScrollView,
  TouchableOpacity,
  TextInput,
  StyleSheet,
  KeyboardAvoidingView,
  Platform,
} from 'react-native'
import { SafeAreaView } from 'react-native-safe-area-context'
import { Ionicons } from '@expo/vector-icons'
import { colors, spacing, radius } from '../lib/theme'
import { isLowerBetter } from '../lib/disciplineScience'
import FullAnalysis from '../components/FullAnalysis'

// ── Discipline catalog (icon-based, no emojis) ─────────────────────────────
const DISCIPLINES: { name: string; icon: string; group: string }[] = [
  { name: '60m', icon: 'flash-outline', group: 'Sprint' },
  { name: '100m', icon: 'flash-outline', group: 'Sprint' },
  { name: '200m', icon: 'flash-outline', group: 'Sprint' },
  { name: '400m', icon: 'flash-outline', group: 'Sprint' },
  { name: '800m', icon: 'timer-outline', group: 'Middle' },
  { name: '1500m', icon: 'timer-outline', group: 'Middle' },
  { name: '3000m', icon: 'fitness-outline', group: 'Long' },
  { name: '3000m Steeplechase', icon: 'fitness-outline', group: 'Long' },
  { name: '5000m', icon: 'fitness-outline', group: 'Long' },
  { name: '10000m', icon: 'fitness-outline', group: 'Long' },
  { name: '100m Hurdles', icon: 'reorder-four-outline', group: 'Hurdles' },
  { name: '110m Hurdles', icon: 'reorder-four-outline', group: 'Hurdles' },
  { name: '400m Hurdles', icon: 'reorder-four-outline', group: 'Hurdles' },
  { name: 'High Jump', icon: 'trending-up-outline', group: 'Jumps' },
  { name: 'Long Jump', icon: 'trending-up-outline', group: 'Jumps' },
  { name: 'Triple Jump', icon: 'trending-up-outline', group: 'Jumps' },
  { name: 'Pole Vault', icon: 'trending-up-outline', group: 'Jumps' },
  { name: 'Shot Put', icon: 'ellipse-outline', group: 'Throws' },
  { name: 'Discus Throw', icon: 'ellipse-outline', group: 'Throws' },
  { name: 'Javelin Throw', icon: 'ellipse-outline', group: 'Throws' },
  { name: 'Hammer Throw', icon: 'ellipse-outline', group: 'Throws' },
]

// Group icon colors
const GROUP_COLORS: Record<string, string> = {
  Sprint: colors.orange[500],
  Middle: colors.blue,
  Long: colors.teal,
  Hurdles: colors.amber,
  Jumps: colors.purple,
  Throws: colors.red,
}

function parseMark(input: string, discipline: string): number | null {
  const trimmed = input.trim().replace(/[sm]/gi, '')
  const colonMatch = trimmed.match(/^(\d+):(\d+\.?\d*)$/)
  if (colonMatch) return parseInt(colonMatch[1]) * 60 + parseFloat(colonMatch[2])
  const val = parseFloat(trimmed)
  return Number.isFinite(val) ? val : null
}

// ── Discipline Picker ───────────────────────────────────────────────────────
function DisciplinePicker({ onSelect }: { onSelect: (discipline: string) => void }) {
  const [filterGroup, setFilterGroup] = useState('all')
  const groups = ['all', 'Sprint', 'Middle', 'Long', 'Hurdles', 'Jumps', 'Throws']
  const filtered = filterGroup === 'all' ? DISCIPLINES : DISCIPLINES.filter(d => d.group === filterGroup)

  // Group the disciplines
  const grouped = useMemo(() => {
    if (filterGroup !== 'all') return { [filterGroup]: filtered }
    const map: Record<string, typeof DISCIPLINES> = {}
    for (const d of filtered) {
      if (!map[d.group]) map[d.group] = []
      map[d.group].push(d)
    }
    return map
  }, [filtered, filterGroup])

  return (
    <ScrollView contentContainerStyle={styles.content} showsVerticalScrollIndicator={false}>
      {/* Filter chips */}
      <ScrollView horizontal showsHorizontalScrollIndicator={false} style={styles.chipScroll}>
        {groups.map(g => (
          <TouchableOpacity key={g}
            style={[styles.chip, filterGroup === g && styles.chipActive]}
            onPress={() => setFilterGroup(g)}>
            <Text style={[styles.chipText, filterGroup === g && styles.chipTextActive]}>
              {g === 'all' ? 'All' : g}
            </Text>
          </TouchableOpacity>
        ))}
      </ScrollView>

      {/* Discipline list by group */}
      {Object.entries(grouped).map(([group, disciplines]) => (
        <View key={group} style={styles.disciplineGroup}>
          {filterGroup === 'all' && (
            <View style={styles.groupHeader}>
              <View style={[styles.groupDot, { backgroundColor: GROUP_COLORS[group] || colors.text.dimmed }]} />
              <Text style={styles.groupLabel}>{group}</Text>
            </View>
          )}
          {disciplines.map(d => (
            <TouchableOpacity key={d.name} style={styles.disciplineRow}
              onPress={() => onSelect(d.name)} activeOpacity={0.6}>
              <View style={[styles.disciplineIcon, {
                backgroundColor: (GROUP_COLORS[d.group] || colors.text.dimmed) + '10',
              }]}>
                <Ionicons
                  name={d.icon as any}
                  size={16}
                  color={GROUP_COLORS[d.group] || colors.text.muted}
                />
              </View>
              <Text style={styles.disciplineName}>{d.name}</Text>
              <Ionicons name="chevron-forward" size={14} color={colors.text.dimmed} />
            </TouchableOpacity>
          ))}
        </View>
      ))}
      <View style={{ height: 40 }} />
    </ScrollView>
  )
}

// AnalysisView replaced by FullAnalysis component

// ── Main Screen ─────────────────────────────────────────────────────────────
export default function CoachAnalyseScreen() {
  const [selectedDiscipline, setSelectedDiscipline] = useState<string | null>(null)
  const [markInput, setMarkInput] = useState('')
  const [ageInput, setAgeInput] = useState('')
  const [sex, setSex] = useState<'M' | 'F'>('M')
  const [result, setResult] = useState<{ discipline: string; mark: number; age: number; sex: string } | null>(null)

  const handleAnalyse = () => {
    if (!selectedDiscipline || !markInput.trim() || !ageInput.trim()) return
    const mark = parseMark(markInput, selectedDiscipline)
    const age = parseInt(ageInput)
    if (!mark || !Number.isFinite(age) || age < 8 || age > 99) return
    setResult({ discipline: selectedDiscipline, mark, age, sex })
  }

  const handleBack = () => {
    if (result) {
      setResult(null)
    } else if (selectedDiscipline) {
      setSelectedDiscipline(null)
      setMarkInput('')
      setAgeInput('')
    }
  }

  return (
    <SafeAreaView style={styles.safe}>
      {/* Header */}
      <View style={styles.header}>
        {(selectedDiscipline || result) && (
          <TouchableOpacity onPress={handleBack} style={styles.backBtn}>
            <Ionicons name="chevron-back" size={22} color={colors.text.primary} />
          </TouchableOpacity>
        )}
        <View style={{ flex: 1 }}>
          <Text style={styles.title}>
            {result ? selectedDiscipline : selectedDiscipline || 'Analyse'}
          </Text>
          {!selectedDiscipline && !result && (
            <Text style={styles.subtitle}>Select a discipline to run analysis</Text>
          )}
        </View>
      </View>

      {/* Step 1: Pick discipline */}
      {!selectedDiscipline && !result && (
        <DisciplinePicker onSelect={(d) => setSelectedDiscipline(d)} />
      )}

      {/* Step 2: Enter mark + age */}
      {selectedDiscipline && !result && (
        <KeyboardAvoidingView style={{ flex: 1 }}
          behavior={Platform.OS === 'ios' ? 'padding' : 'height'}>
          <ScrollView contentContainerStyle={styles.content} showsVerticalScrollIndicator={false}>
            <View style={styles.inputCard}>
              <Text style={styles.inputCardTitle}>{selectedDiscipline}</Text>
              <Text style={styles.inputCardDesc}>
                Enter a mark and athlete details for instant analysis.
              </Text>

              <View style={styles.inputRow}>
                <View style={[styles.inputWrap, { flex: 2 }]}>
                  <Text style={styles.inputLabel}>
                    {isLowerBetter(selectedDiscipline) ? 'TIME' : 'DISTANCE / HEIGHT'}
                  </Text>
                  <TextInput
                    style={styles.markInput}
                    placeholder={isLowerBetter(selectedDiscipline) ? 'e.g. 10.85 or 1:52.30' : 'e.g. 65.20'}
                    placeholderTextColor={colors.text.dimmed}
                    value={markInput}
                    onChangeText={setMarkInput}
                    keyboardType="numbers-and-punctuation"
                    autoFocus
                  />
                </View>
                <View style={[styles.inputWrap, { flex: 1 }]}>
                  <Text style={styles.inputLabel}>AGE</Text>
                  <TextInput
                    style={styles.markInput}
                    placeholder="e.g. 17"
                    placeholderTextColor={colors.text.dimmed}
                    value={ageInput}
                    onChangeText={setAgeInput}
                    keyboardType="number-pad"
                  />
                </View>
              </View>

              {/* Gender toggle */}
              <View style={styles.segmentRow}>
                {(['M', 'F'] as const).map(g => (
                  <TouchableOpacity key={g}
                    style={[styles.segmentBtn, sex === g && styles.segmentBtnActive]}
                    onPress={() => setSex(g)}>
                    <Text style={[styles.segmentText, sex === g && styles.segmentTextActive]}>
                      {g === 'M' ? 'Male' : 'Female'}
                    </Text>
                  </TouchableOpacity>
                ))}
              </View>

              <TouchableOpacity
                style={[styles.analyseBtn, (!markInput.trim() || !ageInput.trim()) && { opacity: 0.4 }]}
                onPress={handleAnalyse}
                disabled={!markInput.trim() || !ageInput.trim()}
                activeOpacity={0.7}
              >
                <Text style={styles.analyseBtnText}>Run Analysis</Text>
              </TouchableOpacity>
            </View>
          </ScrollView>
        </KeyboardAvoidingView>
      )}

      {/* Step 3: Full 5-Act Analysis */}
      {result && (
        <ScrollView contentContainerStyle={styles.content} showsVerticalScrollIndicator={false}>
          <FullAnalysis
            discipline={result.discipline}
            mark={result.mark}
            age={result.age}
            sex={result.sex}
          />
        </ScrollView>
      )}
    </SafeAreaView>
  )
}

// ── Styles ──────────────────────────────────────────────────────────────────
const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: colors.bg.primary },
  header: {
    paddingHorizontal: spacing.lg,
    paddingTop: spacing.md,
    paddingBottom: spacing.md,
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: spacing.sm,
    borderBottomWidth: 1,
    borderBottomColor: 'rgba(255,255,255,0.04)',
  },
  backBtn: {
    width: 36,
    height: 36,
    borderRadius: 18,
    backgroundColor: 'rgba(255,255,255,0.04)',
    justifyContent: 'center',
    alignItems: 'center',
    marginTop: 2,
  },
  title: {
    fontSize: 28,
    fontWeight: '700',
    color: colors.text.primary,
    letterSpacing: -0.5,
  },
  subtitle: {
    fontSize: 13,
    color: colors.text.muted,
    marginTop: 2,
  },
  content: {
    padding: spacing.lg,
    paddingTop: spacing.md,
  },

  // Chips
  chipScroll: { marginBottom: spacing.lg, maxHeight: 36 },
  chip: {
    paddingHorizontal: 14,
    paddingVertical: 6,
    borderRadius: 18,
    backgroundColor: 'rgba(255,255,255,0.03)',
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.06)',
    marginRight: spacing.sm,
  },
  chipActive: {
    backgroundColor: colors.orange[500] + '12',
    borderColor: colors.orange[500] + '30',
  },
  chipText: { fontSize: 12, fontWeight: '600', color: colors.text.muted },
  chipTextActive: { color: colors.orange[500] },

  // Discipline list
  disciplineGroup: { marginBottom: spacing.lg },
  groupHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    marginBottom: spacing.sm,
    paddingLeft: 2,
  },
  groupDot: { width: 6, height: 6, borderRadius: 3 },
  groupLabel: {
    fontSize: 10,
    letterSpacing: 1.5,
    color: colors.text.muted,
    fontWeight: '600',
    textTransform: 'uppercase',
  },
  disciplineRow: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 13,
    paddingHorizontal: 4,
    borderBottomWidth: 1,
    borderBottomColor: 'rgba(255,255,255,0.03)',
    gap: spacing.md,
  },
  disciplineIcon: {
    width: 32,
    height: 32,
    borderRadius: 8,
    justifyContent: 'center',
    alignItems: 'center',
  },
  disciplineName: {
    flex: 1,
    fontSize: 15,
    fontWeight: '500',
    color: colors.text.primary,
  },

  // Input card
  inputCard: {
    backgroundColor: 'rgba(255,255,255,0.02)',
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.06)',
    borderRadius: radius.lg,
    padding: spacing.xl,
  },
  inputCardTitle: {
    fontSize: 20,
    fontWeight: '700',
    color: colors.text.primary,
    marginBottom: 4,
  },
  inputCardDesc: {
    fontSize: 13,
    color: colors.text.muted,
    marginBottom: spacing.xl,
  },
  inputRow: { flexDirection: 'row', gap: spacing.md, marginBottom: spacing.lg },
  inputWrap: {},
  inputLabel: {
    fontSize: 10,
    letterSpacing: 2,
    color: colors.text.muted,
    fontWeight: '600',
    marginBottom: 6,
  },
  markInput: {
    backgroundColor: 'rgba(255,255,255,0.03)',
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.08)',
    borderRadius: radius.md,
    paddingHorizontal: spacing.md,
    paddingVertical: 14,
    fontSize: 18,
    fontWeight: '700',
    color: colors.text.primary,
  },
  segmentRow: {
    flexDirection: 'row',
    backgroundColor: 'rgba(255,255,255,0.03)',
    borderRadius: radius.md,
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.06)',
    padding: 3,
    marginBottom: spacing.xl,
  },
  segmentBtn: {
    flex: 1,
    paddingVertical: 10,
    borderRadius: radius.md - 2,
    alignItems: 'center',
  },
  segmentBtnActive: { backgroundColor: colors.orange[500] + '15' },
  segmentText: { fontSize: 14, fontWeight: '600', color: colors.text.muted },
  segmentTextActive: { color: colors.orange[500] },
  analyseBtn: {
    backgroundColor: colors.orange[500],
    borderRadius: radius.md,
    paddingVertical: 16,
    alignItems: 'center',
    justifyContent: 'center',
  },
  analyseBtnText: { color: '#fff', fontSize: 15, fontWeight: '700' },
})
