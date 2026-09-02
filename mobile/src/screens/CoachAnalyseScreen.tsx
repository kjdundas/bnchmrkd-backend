// ═══════════════════════════════════════════════════════════════════════════
// COACH ANALYSE SCREEN — Premium Quick Performance Analysis
// Clean discipline list → enter mark → instant tier breakdown
// No emojis — professional Ionicons, Strava-style data layout
// ═══════════════════════════════════════════════════════════════════════════

import React, { useState, useMemo, useRef } from 'react'
import {
  Animated,
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
import ScreenBackdrop, { BACKDROP_GROUND } from '../components/ScreenBackdrop'
import AppHeader from '../components/AppHeader'
import { TAB_BAR_CLEARANCE } from '../navigation/FloatingTabBar'
import { Ionicons } from '@expo/vector-icons'
import { colors, spacing, radius, onImage } from '../lib/theme'
import { tapFeedback } from '../lib/haptics'
import { useTheme } from '../contexts/ThemeContext'
import { isLowerBetter } from '../lib/disciplineScience'
import FullAnalysis from '../components/FullAnalysis'
// One catalogue, shared with the athlete's own event picker.
import { DISCIPLINES } from '../lib/disciplines'


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
function DisciplinePicker({
  onSelect, scrollY,
}: {
  onSelect: (discipline: string) => void
  /** The backdrop's parallax/dissolve driver. Without it the photograph sits
   *  at full strength behind a thirty-row list, so the same chip reads at
   *  5:1 over a dark rack and 2.5:1 over a sunlit wall forty pixels away.
   *  The other two branches of this screen were given the driver; this one —
   *  the one you actually land on — was missed. */
  scrollY: Animated.Value
}) {
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
    <Animated.ScrollView
      contentContainerStyle={styles.content}
      showsVerticalScrollIndicator={false}
      scrollEventThrottle={16}
      onScroll={Animated.event(
        [{ nativeEvent: { contentOffset: { y: scrollY } } }], { useNativeDriver: true })}
    >
      {/* Filter chips. contentContainerStyle, not style: the padding has to
          be INSIDE the scroller or the last chip is clipped at the edge
          with nothing to say the row continues. */}
      <ScrollView
        horizontal
        showsHorizontalScrollIndicator={false}
        contentContainerStyle={styles.chipRow}
        style={styles.chipScroll}
      >
        {groups.map(g => (
          <TouchableOpacity key={g}
            style={[styles.chip, filterGroup === g && styles.chipActive]}
            onPress={() => { tapFeedback(); setFilterGroup(g) }}>
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
              <View style={[styles.groupDot, { backgroundColor: GROUP_COLORS[group] || onImage.dim }]} />
              <Text style={styles.groupLabel}>{group}</Text>
            </View>
          )}
          {/* One plate under the whole group rather than a divider drawn
              straight onto the photograph. A hairline at 3% white is
              invisible over a bright frame and needs no measuring to know
              it — the rows had nothing holding them together. */}
          <View style={styles.groupCard}>
          {disciplines.map((d, i) => (
            <TouchableOpacity key={d.name}
              style={[styles.disciplineRow, i === disciplines.length - 1 && { borderBottomWidth: 0 }]}
              onPress={() => { tapFeedback(); onSelect(d.name) }} activeOpacity={0.6}>
              {/* '10' is 6% alpha — a tint that vanished over the photo and
                  left the icon floating. A visible plate and a border, at
                  the strength the rest of the app uses. */}
              <View style={[styles.disciplineIcon, {
                backgroundColor: (GROUP_COLORS[d.group] || onImage.dim) + '26',
                borderColor: (GROUP_COLORS[d.group] || onImage.dim) + '59',
              }]}>
                <Ionicons
                  name={d.icon as any}
                  size={16}
                  color={GROUP_COLORS[d.group] || onImage.muted}
                />
              </View>
              <Text style={styles.disciplineName}>{d.name}</Text>
              <Ionicons name="chevron-forward" size={15} color={onImage.muted} />
            </TouchableOpacity>
          ))}
          </View>
        </View>
      ))}
      <View style={{ height: 40 }} />
    </Animated.ScrollView>
  )
}

// AnalysisView replaced by FullAnalysis component

// ── Main Screen ─────────────────────────────────────────────────────────────
export default function CoachAnalyseScreen() {
  // Drives the backdrop's parallax and blur. Without a scroll driver the
  // photograph never dissolves — it sits at full strength behind the whole
  // list, which is what made these two screens unreadable.
  const scrollY = useRef(new Animated.Value(0)).current
  const { colors: c } = useTheme()
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
    <View style={{ flex: 1, backgroundColor: BACKDROP_GROUND }}>
      <ScreenBackdrop image="gym" scrollY={scrollY} />
      <SafeAreaView style={{ flex: 1 }} edges={['top', 'left', 'right']}>
      <AppHeader onImage />
      {/* Header */}
      <View style={styles.header}>
        {(selectedDiscipline || result) && (
          <TouchableOpacity onPress={() => { tapFeedback(); handleBack() }} style={styles.backBtn}>
            <Ionicons name="chevron-back" size={22} color={onImage.ink} />
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
        <DisciplinePicker onSelect={(d) => setSelectedDiscipline(d)} scrollY={scrollY} />
      )}

      {/* Step 2: Enter mark + age */}
      {selectedDiscipline && !result && (
        <KeyboardAvoidingView style={{ flex: 1 }}
          behavior={Platform.OS === 'ios' ? 'padding' : 'height'}>
          <Animated.ScrollView contentContainerStyle={styles.content} showsVerticalScrollIndicator={false}
          scrollEventThrottle={16}
          onScroll={Animated.event([{ nativeEvent: { contentOffset: { y: scrollY } } }], { useNativeDriver: true })}>
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
                    placeholderTextColor={onImage.dim}
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
                    placeholderTextColor={onImage.dim}
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
                    onPress={() => { tapFeedback(); setSex(g) }}>
                    <Text style={[styles.segmentText, sex === g && styles.segmentTextActive]}>
                      {g === 'M' ? 'Male' : 'Female'}
                    </Text>
                  </TouchableOpacity>
                ))}
              </View>

              <TouchableOpacity
                style={[styles.analyseBtn, (!markInput.trim() || !ageInput.trim()) && { opacity: 0.4 }]}
                onPress={() => { tapFeedback(); handleAnalyse() }}
                disabled={!markInput.trim() || !ageInput.trim()}
                activeOpacity={0.7}
              >
                <Text style={styles.analyseBtnText}>Run Analysis</Text>
              </TouchableOpacity>
            </View>
          </Animated.ScrollView>
        </KeyboardAvoidingView>
      )}

      {/* Step 3: Full 5-Act Analysis */}
      {result && (
        <Animated.ScrollView contentContainerStyle={styles.content} showsVerticalScrollIndicator={false}
          scrollEventThrottle={16}
          onScroll={Animated.event([{ nativeEvent: { contentOffset: { y: scrollY } } }], { useNativeDriver: true })}>
          <FullAnalysis
            discipline={result.discipline}
            mark={result.mark}
            age={result.age}
            sex={result.sex}
          />
        </Animated.ScrollView>
      )}
      </SafeAreaView>
    </View>
  )
}

// ── Styles ──────────────────────────────────────────────────────────────────
const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: BACKDROP_GROUND },
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
    color: onImage.ink,
    letterSpacing: -0.5,
  },
  subtitle: {
    fontSize: 13,
    color: onImage.muted,
    marginTop: 2,
  },
  content: {
    padding: spacing.lg,
    paddingTop: spacing.md,
    // The tab bar floats over the content rather than bounding it.
    paddingBottom: TAB_BAR_CLEARANCE,
  },

  // Chips — the same chip as FilterRow on the leaderboards, deliberately.
  // These were 3% white on 6% white: over a photograph that is not a chip,
  // it is text floating on whatever happens to be behind it, which is how
  // "Hurdles" ended up at 2.6:1 while "Long" read at 5:1 in the same row.
  chipScroll: { marginBottom: spacing.lg, maxHeight: 40 },
  chipRow: { gap: 7, paddingRight: spacing.lg, alignItems: 'center' },
  chip: {
    minHeight: 32,
    paddingHorizontal: 12,
    justifyContent: 'center',
    borderRadius: radius.full,
    backgroundColor: onImage.chipPlate,
    borderWidth: 1,
    borderColor: onImage.chipEdge,
  },
  chipActive: {
    backgroundColor: colors.orange[500] + '2E',
    borderColor: colors.orange[500] + '8C',
  },
  chipText: { fontSize: 12.5, fontWeight: '700', color: onImage.muted },
  // White, not the accent: the accent on its own 18%-alpha plate over a
  // photo is a colour on a colour, and it was the palest thing in the row.
  chipTextActive: { color: '#FFFFFF' },

  // Discipline list
  disciplineGroup: { marginBottom: spacing.lg },
  groupCard: {
    borderRadius: radius.lg,
    borderWidth: 1,
    borderColor: onImage.cardBorder,
    backgroundColor: onImage.card,
    overflow: 'hidden',
  },
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
    color: onImage.ink,
    fontWeight: '700',
    textTransform: 'uppercase',
  },
  disciplineRow: {
    flexDirection: 'row',
    alignItems: 'center',
    minHeight: 52,
    paddingVertical: 12,
    paddingHorizontal: 13,
    borderBottomWidth: 1,
    borderBottomColor: onImage.divider,
    gap: spacing.md,
  },
  disciplineIcon: {
    width: 32,
    height: 32,
    borderRadius: 8,
    borderWidth: 1,
    justifyContent: 'center',
    alignItems: 'center',
  },
  disciplineName: {
    flex: 1,
    fontSize: 15,
    fontWeight: '600',
    color: onImage.ink,
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
    color: onImage.ink,
    marginBottom: 4,
  },
  inputCardDesc: {
    fontSize: 13,
    color: onImage.muted,
    marginBottom: spacing.xl,
  },
  inputRow: { flexDirection: 'row', gap: spacing.md, marginBottom: spacing.lg },
  inputWrap: {},
  inputLabel: {
    fontSize: 10,
    letterSpacing: 2,
    color: onImage.muted,
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
    color: onImage.ink,
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
  segmentText: { fontSize: 14, fontWeight: '600', color: onImage.muted },
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
