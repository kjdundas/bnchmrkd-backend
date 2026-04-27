// ═══════════════════════════════════════════════════════════════════════════
// COACH RESULTS SCREEN — Premium AI Scanner + Result Import
// Step indicator → paste results → review matches → confirm save
// Clean, professional UI inspired by Strava activity upload
// ═══════════════════════════════════════════════════════════════════════════

import React, { useState, useCallback } from 'react'
import {
  View,
  Text,
  ScrollView,
  TouchableOpacity,
  TextInput,
  StyleSheet,
  ActivityIndicator,
  Platform,
  Dimensions,
} from 'react-native'
import { SafeAreaView } from 'react-native-safe-area-context'
import { Ionicons } from '@expo/vector-icons'
import { colors, spacing, radius } from '../lib/theme'
import { useAuth } from '../contexts/AuthContext'
import { selectFrom, insertInto, updateIn, SUPABASE_URL, SUPABASE_ANON_KEY } from '../lib/supabase'
import { getCachedToken } from '../lib/supabase'
import { isTimeDiscipline } from '../lib/performanceLevels'

const { width: SCREEN_W } = Dimensions.get('window')
const API_BASE = 'https://web-production-295f1.up.railway.app'

// ── Step Indicator ──────────────────────────────────────────────────────────
function StepIndicator({ current }: { current: 0 | 1 | 2 }) {
  const steps = ['Import', 'Review', 'Done']
  return (
    <View style={stepStyles.row}>
      {steps.map((label, idx) => {
        const isActive = idx === current
        const isDone = idx < current
        return (
          <React.Fragment key={label}>
            {idx > 0 && (
              <View style={[stepStyles.line, isDone && stepStyles.lineDone]} />
            )}
            <View style={stepStyles.stepWrap}>
              <View style={[
                stepStyles.dot,
                isActive && stepStyles.dotActive,
                isDone && stepStyles.dotDone,
              ]}>
                {isDone ? (
                  <Ionicons name="checkmark" size={10} color="#fff" />
                ) : (
                  <Text style={[stepStyles.dotNum, isActive && stepStyles.dotNumActive]}>
                    {idx + 1}
                  </Text>
                )}
              </View>
              <Text style={[stepStyles.label, (isActive || isDone) && stepStyles.labelActive]}>
                {label}
              </Text>
            </View>
          </React.Fragment>
        )
      })}
    </View>
  )
}

// ── Stage: Input ────────────────────────────────────────────────────────────
function ScanInputStage({
  onSubmit,
  loading,
}: {
  onSubmit: (text: string) => void
  loading: boolean
}) {
  const [text, setText] = useState('')

  return (
    <ScrollView contentContainerStyle={styles.content} showsVerticalScrollIndicator={false}>
      <View style={styles.sectionHeader}>
        <View style={styles.sectionIconWrap}>
          <Ionicons name="scan-outline" size={20} color={colors.orange[500]} />
        </View>
        <View>
          <Text style={styles.sectionTitle}>Paste Results</Text>
          <Text style={styles.sectionDesc}>
            The AI will extract athletes, disciplines, and marks from any format.
          </Text>
        </View>
      </View>

      <TextInput
        style={styles.textArea}
        placeholder={'Paste competition results here...\n\ne.g.\n1. John Smith    100m    10.45\n2. Sarah Jones   200m    23.12'}
        placeholderTextColor={colors.text.dimmed}
        value={text}
        onChangeText={setText}
        multiline
        textAlignVertical="top"
        numberOfLines={12}
      />

      <TouchableOpacity
        style={[styles.primaryBtn, (!text.trim() || loading) && { opacity: 0.4 }]}
        onPress={() => onSubmit(text.trim())}
        disabled={!text.trim() || loading}
        activeOpacity={0.7}
      >
        {loading ? (
          <View style={styles.btnRow}>
            <ActivityIndicator color="#fff" size="small" />
            <Text style={styles.primaryBtnText}>Processing...</Text>
          </View>
        ) : (
          <View style={styles.btnRow}>
            <Ionicons name="sparkles-outline" size={16} color="#fff" />
            <Text style={styles.primaryBtnText}>Scan Results</Text>
          </View>
        )}
      </TouchableOpacity>

      {/* Info card */}
      <View style={styles.infoCard}>
        <Ionicons name="information-circle-outline" size={16} color={colors.text.muted} />
        <Text style={styles.infoText}>
          Supports pasted text from PDFs, spreadsheets, or screenshots. Names are automatically matched against your roster.
        </Text>
      </View>

      <View style={{ height: 40 }} />
    </ScrollView>
  )
}

// ── Stage: Review ───────────────────────────────────────────────────────────
function ScanReviewStage({
  candidates,
  selections,
  onToggle,
  onSave,
  onBack,
  saving,
  stats,
}: {
  candidates: any[]
  selections: Record<string, boolean>
  onToggle: (key: string) => void
  onSave: () => void
  onBack: () => void
  saving: boolean
  stats: { matched: number; unmatched: number; total: number } | null
}) {
  const selectedCount = Object.values(selections).filter(Boolean).length

  return (
    <ScrollView contentContainerStyle={styles.content} showsVerticalScrollIndicator={false}>
      {/* Stats row */}
      {stats && (
        <View style={styles.reviewStatsRow}>
          <View style={styles.reviewStat}>
            <Text style={styles.reviewStatNum}>{stats.total}</Text>
            <Text style={styles.reviewStatLabel}>Extracted</Text>
          </View>
          <View style={styles.reviewStatDivider} />
          <View style={styles.reviewStat}>
            <Text style={[styles.reviewStatNum, { color: colors.green }]}>{stats.matched}</Text>
            <Text style={styles.reviewStatLabel}>Matched</Text>
          </View>
          <View style={styles.reviewStatDivider} />
          <View style={styles.reviewStat}>
            <Text style={[styles.reviewStatNum, { color: colors.text.dimmed }]}>{stats.unmatched}</Text>
            <Text style={styles.reviewStatLabel}>Unmatched</Text>
          </View>
        </View>
      )}

      {/* Candidate list */}
      {candidates.map((candidate, cidx) => (
        <View key={cidx} style={styles.candidateCard}>
          {/* Candidate header */}
          <View style={styles.candidateHeader}>
            <View style={[styles.candidateStatus, {
              backgroundColor: candidate.matched ? colors.green + '12' : 'rgba(255,255,255,0.04)',
            }]}>
              <Ionicons
                name={candidate.matched ? 'checkmark-circle' : 'help-circle-outline'}
                size={14}
                color={candidate.matched ? colors.green : colors.text.dimmed}
              />
            </View>
            <View style={{ flex: 1 }}>
              <Text style={styles.candidateName}>
                {candidate.roster_name || candidate.extracted_name}
              </Text>
              {!candidate.matched && (
                <Text style={styles.candidateUnmatched}>Not found on roster</Text>
              )}
            </View>
            <Text style={[styles.candidateTag, {
              color: candidate.matched ? colors.green : colors.text.dimmed,
            }]}>
              {candidate.matched ? 'Matched' : 'Unmatched'}
            </Text>
          </View>

          {/* Results */}
          {candidate.results?.map((result: any, ridx: number) => {
            const key = `${cidx}:${ridx}`
            const selected = selections[key] ?? candidate.matched
            return (
              <TouchableOpacity
                key={ridx}
                style={[styles.resultRow, selected && styles.resultRowSelected]}
                onPress={() => candidate.matched && onToggle(key)}
                disabled={!candidate.matched}
                activeOpacity={0.6}
              >
                {candidate.matched && (
                  <Ionicons
                    name={selected ? 'checkbox' : 'square-outline'}
                    size={18}
                    color={selected ? colors.orange[500] : colors.text.dimmed}
                    style={{ marginRight: spacing.md }}
                  />
                )}
                <View style={{ flex: 1 }}>
                  <Text style={styles.resultDiscipline}>{result.discipline || '—'}</Text>
                  {result.competition && (
                    <Text style={styles.resultComp}>{result.competition}</Text>
                  )}
                </View>
                <View style={{ alignItems: 'flex-end' }}>
                  <Text style={[styles.resultMark, selected && { color: colors.text.primary }]}>
                    {result.mark || result.time || '—'}
                  </Text>
                  {result.date && <Text style={styles.resultDate}>{result.date}</Text>}
                </View>
              </TouchableOpacity>
            )
          })}
        </View>
      ))}

      {/* Action buttons */}
      <View style={styles.reviewActions}>
        <TouchableOpacity style={styles.secondaryBtn} onPress={onBack}>
          <Text style={styles.secondaryBtnText}>Back</Text>
        </TouchableOpacity>
        <TouchableOpacity
          style={[styles.primaryBtn, { flex: 2 }, (saving || selectedCount === 0) && { opacity: 0.4 }]}
          onPress={onSave}
          disabled={saving || selectedCount === 0}
        >
          {saving ? (
            <ActivityIndicator color="#fff" size="small" />
          ) : (
            <Text style={styles.primaryBtnText}>
              Save {selectedCount} result{selectedCount !== 1 ? 's' : ''}
            </Text>
          )}
        </TouchableOpacity>
      </View>

      <View style={{ height: 40 }} />
    </ScrollView>
  )
}

// ── Stage: Done ─────────────────────────────────────────────────────────────
function ScanDoneStage({ savedCount, onReset }: { savedCount: number; onReset: () => void }) {
  return (
    <View style={styles.doneWrap}>
      <View style={styles.doneCheckWrap}>
        <Ionicons name="checkmark-circle" size={48} color={colors.green} />
      </View>
      <Text style={styles.doneTitle}>{savedCount} result{savedCount !== 1 ? 's' : ''} saved</Text>
      <Text style={styles.doneSubtitle}>
        Athlete records have been updated on your roster.
      </Text>
      <TouchableOpacity style={styles.primaryBtn} onPress={onReset} activeOpacity={0.7}>
        <View style={styles.btnRow}>
          <Ionicons name="scan-outline" size={16} color="#fff" />
          <Text style={styles.primaryBtnText}>Scan More Results</Text>
        </View>
      </TouchableOpacity>
    </View>
  )
}

// ── Main Screen ─────────────────────────────────────────────────────────────
export default function CoachResultsScreen() {
  const { user } = useAuth()
  const [stage, setStage] = useState<'input' | 'review' | 'done'>('input')
  const [scanLoading, setScanLoading] = useState(false)
  const [scanError, setScanError] = useState('')
  const [candidates, setCandidates] = useState<any[]>([])
  const [selections, setSelections] = useState<Record<string, boolean>>({})
  const [saving, setSaving] = useState(false)
  const [savedCount, setSavedCount] = useState(0)
  const [stats, setStats] = useState<{ matched: number; unmatched: number; total: number } | null>(null)

  const handleScan = async (text: string) => {
    if (!user?.id) return
    setScanLoading(true)
    setScanError('')
    try {
      const token = getCachedToken()
      const res = await fetch(`${API_BASE}/api/scan-results`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          ...(token ? { Authorization: `Bearer ${token}` } : {}),
        },
        body: JSON.stringify({ text, coach_id: user.id, input_type: 'text' }),
      })
      if (!res.ok) {
        const body = await res.text().catch(() => '')
        throw new Error(body || `Scan failed: ${res.status}`)
      }
      const data = await res.json()
      const cands = data.candidates || []
      setCandidates(cands)

      const sels: Record<string, boolean> = {}
      cands.forEach((c: any, cidx: number) => {
        if (c.matched) {
          c.results?.forEach((_: any, ridx: number) => { sels[`${cidx}:${ridx}`] = true })
        }
      })
      setSelections(sels)

      const matched = cands.filter((c: any) => c.matched).length
      setStats({
        total: cands.reduce((s: number, c: any) => s + (c.results?.length || 0), 0),
        matched,
        unmatched: cands.length - matched,
      })
      setStage('review')
    } catch (e: any) {
      setScanError(e.message || 'Scan failed')
    }
    setScanLoading(false)
  }

  const handleToggle = (key: string) => {
    setSelections(prev => ({ ...prev, [key]: !prev[key] }))
  }

  const handleSave = async () => {
    if (!user?.id) return
    setSaving(true)
    let count = 0
    try {
      for (const [key, selected] of Object.entries(selections)) {
        if (!selected) continue
        const [cidxStr, ridxStr] = key.split(':')
        const candidate = candidates[parseInt(cidxStr)]
        const result = candidate?.results?.[parseInt(ridxStr)]
        if (!candidate?.matched || !result) continue

        const raceEntry = {
          value: result.time_seconds || result.value,
          date: result.date || new Date().toISOString().split('T')[0],
          competition: result.competition || 'Scanner Import',
          discipline: result.discipline || candidate.discipline,
          source: 'scanner',
        }

        try {
          const rows = await selectFrom('coach_roster', {
            filter: `id=eq.${candidate.roster_id}&coach_id=eq.${user.id}`,
            limit: '1',
          })
          if (rows.length > 0) {
            const existingRaces = rows[0].races || []
            await updateIn('coach_roster', `id=eq.${candidate.roster_id}`, {
              races: [...existingRaces, raceEntry],
            })
            count++
          }
        } catch (e) { console.warn('Save race error:', e) }
      }
      setSavedCount(count)
      setStage('done')
    } catch (e: any) {
      console.warn('Save error:', e)
    }
    setSaving(false)
  }

  const handleReset = () => {
    setStage('input'); setCandidates([]); setSelections({})
    setSavedCount(0); setStats(null); setScanError('')
  }

  const stepIndex = stage === 'input' ? 0 : stage === 'review' ? 1 : 2

  return (
    <SafeAreaView style={styles.safe}>
      {/* Header */}
      <View style={styles.header}>
        <View style={{ flex: 1 }}>
          <Text style={styles.title}>Results</Text>
        </View>
        {stage === 'review' && (
          <TouchableOpacity onPress={handleReset} style={styles.resetBtn}>
            <Ionicons name="refresh-outline" size={18} color={colors.text.secondary} />
          </TouchableOpacity>
        )}
      </View>

      {/* Step indicator */}
      <StepIndicator current={stepIndex as 0 | 1 | 2} />

      {stage === 'input' && <ScanInputStage onSubmit={handleScan} loading={scanLoading} />}
      {stage === 'review' && (
        <ScanReviewStage
          candidates={candidates}
          selections={selections}
          onToggle={handleToggle}
          onSave={handleSave}
          onBack={handleReset}
          saving={saving}
          stats={stats}
        />
      )}
      {stage === 'done' && <ScanDoneStage savedCount={savedCount} onReset={handleReset} />}
    </SafeAreaView>
  )
}

// ── Step Indicator Styles ───────────────────────────────────────────────────
const stepStyles = StyleSheet.create({
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: spacing.xxl,
    paddingVertical: spacing.lg,
    borderBottomWidth: 1,
    borderBottomColor: 'rgba(255,255,255,0.04)',
  },
  stepWrap: { alignItems: 'center', gap: 4 },
  dot: {
    width: 22,
    height: 22,
    borderRadius: 11,
    backgroundColor: 'rgba(255,255,255,0.06)',
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.1)',
    justifyContent: 'center',
    alignItems: 'center',
  },
  dotActive: {
    backgroundColor: colors.orange[500] + '15',
    borderColor: colors.orange[500] + '40',
  },
  dotDone: {
    backgroundColor: colors.green,
    borderColor: colors.green,
  },
  dotNum: { fontSize: 10, fontWeight: '700', color: colors.text.dimmed },
  dotNumActive: { color: colors.orange[500] },
  label: { fontSize: 10, fontWeight: '600', color: colors.text.dimmed },
  labelActive: { color: colors.text.secondary },
  line: {
    height: 1,
    flex: 1,
    backgroundColor: 'rgba(255,255,255,0.06)',
    marginHorizontal: spacing.sm,
    marginBottom: 16,
  },
  lineDone: { backgroundColor: colors.green + '40' },
})

// ── Styles ──────────────────────────────────────────────────────────────────
const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: colors.bg.primary },
  header: {
    paddingHorizontal: spacing.lg,
    paddingTop: spacing.md,
    paddingBottom: spacing.sm,
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  title: {
    fontSize: 28,
    fontWeight: '700',
    color: colors.text.primary,
    letterSpacing: -0.5,
  },
  resetBtn: {
    width: 36,
    height: 36,
    borderRadius: 18,
    backgroundColor: 'rgba(255,255,255,0.04)',
    justifyContent: 'center',
    alignItems: 'center',
  },
  content: {
    padding: spacing.lg,
    paddingTop: spacing.lg,
  },

  // Section header
  sectionHeader: {
    flexDirection: 'row',
    gap: spacing.md,
    marginBottom: spacing.xl,
  },
  sectionIconWrap: {
    width: 40,
    height: 40,
    borderRadius: 10,
    backgroundColor: colors.orange[500] + '10',
    justifyContent: 'center',
    alignItems: 'center',
    marginTop: 2,
  },
  sectionTitle: {
    fontSize: 17,
    fontWeight: '600',
    color: colors.text.primary,
  },
  sectionDesc: {
    fontSize: 13,
    color: colors.text.muted,
    marginTop: 2,
    lineHeight: 18,
    maxWidth: SCREEN_W - 120,
  },

  // Text area
  textArea: {
    backgroundColor: 'rgba(255,255,255,0.02)',
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.06)',
    borderRadius: radius.md,
    padding: spacing.lg,
    fontSize: 14,
    color: colors.text.primary,
    minHeight: 200,
    marginBottom: spacing.lg,
    lineHeight: 22,
  },

  // Buttons
  primaryBtn: {
    backgroundColor: colors.orange[500],
    borderRadius: radius.md,
    paddingVertical: 15,
    alignItems: 'center',
    justifyContent: 'center',
  },
  primaryBtnText: { color: '#fff', fontSize: 15, fontWeight: '700' },
  secondaryBtn: {
    flex: 1,
    paddingVertical: 15,
    borderRadius: radius.md,
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.08)',
    alignItems: 'center',
  },
  secondaryBtnText: { fontSize: 15, fontWeight: '600', color: colors.text.secondary },
  btnRow: { flexDirection: 'row', alignItems: 'center', gap: spacing.sm },

  // Info card
  infoCard: {
    flexDirection: 'row',
    gap: spacing.sm,
    marginTop: spacing.xl,
    paddingVertical: spacing.md,
    paddingHorizontal: spacing.md,
    backgroundColor: 'rgba(255,255,255,0.02)',
    borderRadius: radius.sm,
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.04)',
  },
  infoText: { flex: 1, fontSize: 12, color: colors.text.muted, lineHeight: 17 },

  // Review stats
  reviewStatsRow: {
    flexDirection: 'row',
    backgroundColor: 'rgba(255,255,255,0.02)',
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.05)',
    borderRadius: radius.md,
    paddingVertical: spacing.md,
    marginBottom: spacing.lg,
  },
  reviewStat: { flex: 1, alignItems: 'center' },
  reviewStatNum: { fontSize: 22, fontWeight: '700', color: colors.text.primary, letterSpacing: -0.5 },
  reviewStatLabel: { fontSize: 9, letterSpacing: 1.2, color: colors.text.muted, fontWeight: '600', marginTop: 2, textTransform: 'uppercase' },
  reviewStatDivider: { width: 1, backgroundColor: 'rgba(255,255,255,0.06)' },

  // Candidate cards
  candidateCard: {
    backgroundColor: 'rgba(255,255,255,0.02)',
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.05)',
    borderRadius: radius.md,
    marginBottom: spacing.md,
    overflow: 'hidden',
  },
  candidateHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: spacing.md,
    borderBottomWidth: 1,
    borderBottomColor: 'rgba(255,255,255,0.04)',
    gap: spacing.sm,
  },
  candidateStatus: {
    width: 28,
    height: 28,
    borderRadius: 14,
    justifyContent: 'center',
    alignItems: 'center',
  },
  candidateName: { fontSize: 15, fontWeight: '600', color: colors.text.primary },
  candidateUnmatched: { fontSize: 11, color: colors.text.dimmed, marginTop: 1 },
  candidateTag: { fontSize: 10, fontWeight: '600', letterSpacing: 0.5, textTransform: 'uppercase' },

  // Result rows
  resultRow: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 12,
    paddingHorizontal: spacing.md,
    borderBottomWidth: 1,
    borderBottomColor: 'rgba(255,255,255,0.03)',
  },
  resultRowSelected: {
    backgroundColor: 'rgba(249,115,22,0.03)',
  },
  resultDiscipline: { fontSize: 14, fontWeight: '600', color: colors.text.primary },
  resultComp: { fontSize: 11, color: colors.text.muted, marginTop: 1 },
  resultMark: { fontSize: 15, fontWeight: '700', color: colors.text.muted },
  resultDate: { fontSize: 10, color: colors.text.dimmed, marginTop: 1 },

  // Review actions
  reviewActions: {
    flexDirection: 'row',
    gap: spacing.md,
    marginTop: spacing.md,
  },

  // Done
  doneWrap: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    paddingHorizontal: spacing.xxl,
  },
  doneCheckWrap: { marginBottom: spacing.lg },
  doneTitle: { fontSize: 22, fontWeight: '700', color: colors.text.primary, marginBottom: 6 },
  doneSubtitle: { fontSize: 14, color: colors.text.muted, textAlign: 'center', marginBottom: spacing.xl, lineHeight: 20 },
})

