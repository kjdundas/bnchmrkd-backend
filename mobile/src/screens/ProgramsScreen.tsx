// ═══════════════════════════════════════════════════════════════════════
// PROGRAMS (athlete) — native port of frontend ProgramsPanel.jsx
// Structured intake → a periodization-aware, maturation-capped program.
// The backend builds a deterministic skeleton; the LLM fills in detail.
// Weekly session completions live in program_session_logs, bucketed by the
// Monday of the current week (same key the web app uses).
// ═══════════════════════════════════════════════════════════════════════

import React, { useState, useEffect, useCallback } from 'react'
import {
  View, Text, StyleSheet, ScrollView, TextInput,
  ActivityIndicator, RefreshControl,
} from 'react-native'
import { SafeAreaView } from 'react-native-safe-area-context'
import { Ionicons } from '@expo/vector-icons'
import { selectFrom, insertInto, deleteFrom, authHeader } from '../lib/supabase'
import { useAuth } from '../contexts/AuthContext'
import { useTheme } from '../contexts/ThemeContext'
import { spacing, radius, rhythm } from '../lib/theme'
import { successFeedback, tapFeedback, errorFeedback } from '../lib/haptics'
import { AlmanacCard, EmptyState, MonoKicker, Tappable } from '../components/ui'
import AppHeader from '../components/AppHeader'

const API_BASE = 'https://web-production-295f1.up.railway.app'

/** Monday of the current week (local) as YYYY-MM-DD — the completion bucket. */
function weekStartStr() {
  const d = new Date()
  const day = (d.getDay() + 6) % 7
  d.setDate(d.getDate() - day)
  const p = (n: number) => String(n).padStart(2, '0')
  return `${d.getFullYear()}-${p(d.getMonth() + 1)}-${p(d.getDate())}`
}

const PHASES = [
  { v: 'off_season', l: 'Off-season' },
  { v: 'pre_season', l: 'Pre-season' },
  { v: 'competition', l: 'In-season' },
  { v: 'transition', l: 'Transition' },
]
const QUALITIES = [
  'acceleration', 'max velocity', 'speed', 'speed endurance', 'power',
  'max strength', 'aerobic capacity', 'anaerobic/lactate',
  'plyometric/elastic', 'mobility', 'technique',
]
const EQUIPMENT = [
  { v: 'track', l: 'Track' },
  { v: 'full_gym', l: 'Full gym' },
  { v: 'minimal', l: 'Minimal kit' },
  { v: 'none', l: 'Bodyweight' },
]
const INJURY_AREAS = [
  { v: 'knee', l: 'Knee' }, { v: 'heel', l: 'Heel' }, { v: 'ankle', l: 'Ankle' },
  { v: 'hip', l: 'Hip/groin' }, { v: 'shin', l: 'Shin' }, { v: 'back', l: 'Back' },
]

const EMPTY_INTAKE = {
  season_phase: 'pre_season', primary_quality: '', secondary_quality: '',
  days_per_week: '4', equipment: 'track', training_age_years: '',
  target_competition_date: '', injuries: [] as string[], goal: '',
}

// ── Small primitives ───────────────────────────────────────────────
function Chip({ label, active, onPress }: { label: string; active: boolean; onPress: () => void }) {
  const { colors } = useTheme()
  return (
    <Tappable
      onPress={onPress}
      accessibilityLabel={`${label}${active ? ', selected' : ''}`}
      hitSlop={4}
      style={{
        paddingHorizontal: 14, minHeight: 44, justifyContent: 'center', borderRadius: radius.full,
        backgroundColor: active ? colors.accent[500] : colors.bg.primary,
        borderWidth: 1,
        borderColor: active ? colors.accent[500] : colors.glass.border,
      }}
    >
      <Text style={{
        fontSize: 12, fontWeight: '600',
        color: active ? '#FFFFFF' : colors.text.secondary,
      }}>{label}</Text>
    </Tappable>
  )
}

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <View style={{ marginBottom: spacing.lg }}>
      <View style={{ marginBottom: 8 }}><MonoKicker>{label}</MonoKicker></View>
      {children}
    </View>
  )
}

function ChipRow({ children }: { children: React.ReactNode }) {
  return <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 8 }}>{children}</View>
}

// ── Intake form ────────────────────────────────────────────────────
function IntakeForm({ intake, setIntake, onGenerate, onCancel, generating }: any) {
  const { colors } = useTheme()
  const setField = (k: string, v: any) => setIntake((s: any) => ({ ...s, [k]: v }))
  const toggleInjury = (k: string) =>
    setIntake((s: any) => ({
      ...s,
      injuries: s.injuries.includes(k) ? s.injuries.filter((x: string) => x !== k) : [...s.injuries, k],
    }))

  const input = {
    backgroundColor: colors.bg.primary, borderWidth: 1, borderColor: colors.glass.border,
    borderRadius: radius.md, paddingHorizontal: 12, paddingVertical: 10,
    fontSize: 14, color: colors.text.primary,
  }

  return (
    <View>
      <Field label="Season phase">
        <ChipRow>
          {PHASES.map((p) => (
            <Chip key={p.v} label={p.l} active={intake.season_phase === p.v}
              onPress={() => setField('season_phase', p.v)} />
          ))}
        </ChipRow>
      </Field>

      <Field label="Primary quality">
        <ChipRow>
          {QUALITIES.map((q) => (
            <Chip key={q} label={q} active={intake.primary_quality === q}
              onPress={() => setField('primary_quality', intake.primary_quality === q ? '' : q)} />
          ))}
        </ChipRow>
      </Field>

      <Field label="Secondary quality">
        <ChipRow>
          {QUALITIES.filter((q) => q !== intake.primary_quality).map((q) => (
            <Chip key={q} label={q} active={intake.secondary_quality === q}
              onPress={() => setField('secondary_quality', intake.secondary_quality === q ? '' : q)} />
          ))}
        </ChipRow>
      </Field>

      <Field label="Days per week">
        <ChipRow>
          {['2', '3', '4', '5', '6'].map((n) => (
            <Chip key={n} label={n} active={String(intake.days_per_week) === n}
              onPress={() => setField('days_per_week', n)} />
          ))}
        </ChipRow>
      </Field>

      <Field label="Equipment">
        <ChipRow>
          {EQUIPMENT.map((e) => (
            <Chip key={e.v} label={e.l} active={intake.equipment === e.v}
              onPress={() => setField('equipment', e.v)} />
          ))}
        </ChipRow>
      </Field>

      <Field label="Injuries / niggles to work around">
        <ChipRow>
          {INJURY_AREAS.map((a) => (
            <Chip key={a.v} label={a.l} active={intake.injuries.includes(a.v)}
              onPress={() => toggleInjury(a.v)} />
          ))}
        </ChipRow>
      </Field>

      <Field label="Training age (years)">
        <TextInput
          style={input} value={intake.training_age_years}
          onChangeText={(v) => setField('training_age_years', v)}
          keyboardType="decimal-pad" placeholder="e.g. 3"
          placeholderTextColor={colors.text.dimmed}
        />
      </Field>

      <Field label="Target competition date">
        <TextInput
          style={input} value={intake.target_competition_date}
          onChangeText={(v) => setField('target_competition_date', v)}
          placeholder="YYYY-MM-DD"
          placeholderTextColor={colors.text.dimmed}
        />
      </Field>

      <Field label="Goal">
        <TextInput
          style={[input, { height: 76, textAlignVertical: 'top' }]}
          value={intake.goal} onChangeText={(v) => setField('goal', v)}
          multiline placeholder="What do you want this block to do?"
          placeholderTextColor={colors.text.dimmed}
        />
      </Field>

      <View style={{ flexDirection: 'row', gap: 10, alignItems: 'center' }}>
        <Tappable
          onPress={onGenerate} disabled={generating}
          accessibilityLabel="Generate a training program"
          style={{
            flex: 1, flexDirection: 'row', alignItems: 'center', justifyContent: 'center',
            gap: 8, minHeight: 48, borderRadius: radius.md,
            backgroundColor: colors.accent[500],
          }}
        >
          {generating
            ? <ActivityIndicator size="small" color="#FFFFFF" />
            : <Ionicons name="sparkles" size={15} color="#FFFFFF" />}
          <Text style={{ color: '#FFFFFF', fontWeight: '700', fontSize: 14 }}>
            {generating ? 'Building your program…' : 'Generate program'}
          </Text>
        </Tappable>
        <Tappable
          onPress={onCancel}
          accessibilityLabel="Cancel"
          style={{ paddingHorizontal: 16, minHeight: 48, justifyContent: 'center' }}
        >
          <Text style={{ color: colors.text.muted, fontSize: 13, fontWeight: '600' }}>Cancel</Text>
        </Tappable>
      </View>

      <Text style={{ fontSize: 11, color: colors.text.muted, marginTop: spacing.md, lineHeight: 16 }}>
        Educational guidance, not medical advice. Review with your coach (and a
        parent/guardian if under 18) before starting. Stop and see a professional
        if anything hurts.
      </Text>
    </View>
  )
}

// ── One prescribed exercise ────────────────────────────────────────
function ExerciseRow({ ex }: { ex: any }) {
  const { colors } = useTheme()
  if (!ex) return null
  const has = (v: any) => v && String(v).trim() && String(v).trim() !== '—' && String(v).trim() !== '-'
  const meta: string[] = []
  if (has(ex.intensity)) meta.push(ex.intensity)
  if (has(ex.rest)) meta.push(`rest ${ex.rest}`)
  if (has(ex.tempo)) meta.push(`tempo ${ex.tempo}`)

  return (
    <View style={{
      backgroundColor: colors.bg.primary, borderRadius: radius.sm,
      borderWidth: 1, borderColor: colors.glass.divider,
      paddingHorizontal: 10, paddingVertical: 8, marginBottom: 6,
    }}>
      <View style={{ flexDirection: 'row', alignItems: 'baseline', justifyContent: 'space-between', gap: 8 }}>
        <Text style={{ fontSize: 13, fontWeight: '600', color: colors.text.primary, flex: 1 }}>{ex.name}</Text>
        {has(ex.prescription) && (
          <Text style={{ fontSize: 13, fontWeight: '700', color: colors.accent[500] }}>{ex.prescription}</Text>
        )}
      </View>
      {meta.length > 0 && (
        <Text style={{ fontSize: 11, color: colors.text.muted, marginTop: 3 }}>{meta.join(' · ')}</Text>
      )}
      {has(ex.cue) && (
        <Text style={{ fontSize: 11, color: colors.text.muted, fontStyle: 'italic', marginTop: 3 }}>{ex.cue}</Text>
      )}
    </View>
  )
}

// ── One program ────────────────────────────────────────────────────
function ProgramCard({ program, athleteId, open, onToggle, onDelete }: any) {
  const { colors } = useTheme()
  const s = program.structure || {}
  const sessions: any[] = Array.isArray(s.sessions) ? s.sessions : []
  const week = weekStartStr()
  const [done, setDone] = useState<Set<number>>(new Set())
  const [busy, setBusy] = useState<number | null>(null)

  useEffect(() => {
    let cancelled = false
    if (!athleteId || !program.id) return
    selectFrom('program_session_logs', {
      filter: `program_id=eq.${program.id}&week_start=eq.${week}`, limit: '50',
    })
      .then((rows: any[]) => { if (!cancelled) setDone(new Set((rows || []).map((r) => r.session_index))) })
      .catch(() => { if (!cancelled) setDone(new Set()) })
    return () => { cancelled = true }
  }, [athleteId, program.id, week])

  // Optimistic toggle — roll back the local set if the write fails.
  const toggle = async (i: number) => {
    if (busy != null) return
    setBusy(i)
    const has = done.has(i)
    // Fire immediately, not after the round-trip: feedback must land within
    // ~100ms of the tap. Completing a session earns the success pattern;
    // undoing one is just a tap.
    has ? tapFeedback() : successFeedback()
    setDone((prev) => { const n = new Set(prev); has ? n.delete(i) : n.add(i); return n })
    try {
      if (has) {
        await deleteFrom('program_session_logs',
          `program_id=eq.${program.id}&session_index=eq.${i}&week_start=eq.${week}`)
      } else {
        await insertInto('program_session_logs', {
          program_id: program.id, athlete_id: athleteId, session_index: i, week_start: week,
        })
      }
    } catch {
      // The optimistic tick is being reverted — tell the finger, not just the eye.
      errorFeedback()
      setDone((prev) => { const n = new Set(prev); has ? n.add(i) : n.delete(i); return n })
    } finally { setBusy(null) }
  }

  const total = sessions.length
  const completed = sessions.reduce((c, _, i) => c + (done.has(i) ? 1 : 0), 0)
  const pct = total ? Math.round((completed / total) * 100) : 0
  const allDone = total > 0 && completed === total
  const fromCoach = program.source === 'coach'
    || (program.created_by && program.athlete_user_id && program.created_by !== program.athlete_user_id)

  const meta = [
    s.duration_weeks ? `${s.duration_weeks} wk` : '',
    s.sessions_per_week ? `${s.sessions_per_week}×/wk` : '',
    s.summary || '',
  ].filter(Boolean).join(' · ')

  return (
    <View style={{
      backgroundColor: colors.glass.bg, borderRadius: radius.lg,
      borderWidth: 1, borderColor: colors.glass.border,
      marginBottom: spacing.md, overflow: 'hidden',
    }}>
      <Tappable
        onPress={onToggle}
        accessibilityLabel={`${s.title || program.title}, ${open ? 'collapse' : 'expand'}`}
        style={{ flexDirection: 'row', alignItems: 'center', gap: 12, padding: 16 }}
      >
        <View style={{ flex: 1 }}>
          <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8 }}>
            <Text numberOfLines={1} style={{ fontSize: 15, fontWeight: '700', color: colors.text.primary, flexShrink: 1 }}>
              {s.title || program.title}
            </Text>
            {fromCoach && (
              <View style={{ paddingHorizontal: 6, paddingVertical: 2, borderRadius: 4, backgroundColor: colors.blue + '1F' }}>
                <Text style={{ fontSize: 8, fontWeight: '700', letterSpacing: 1, textTransform: 'uppercase', color: colors.blue }}>
                  From coach
                </Text>
              </View>
            )}
          </View>
          {!!meta && (
            <Text numberOfLines={1} style={{ fontSize: 11, color: colors.text.muted, marginTop: 3 }}>{meta}</Text>
          )}
          {total > 0 && (
            <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8, marginTop: 8 }}>
              <View style={{ flex: 1, height: 5, borderRadius: 3, backgroundColor: colors.glass.divider, overflow: 'hidden' }}>
                <View style={{
                  width: `${pct}%`, height: '100%', borderRadius: 3,
                  backgroundColor: allDone ? colors.green : colors.accent[500],
                }} />
              </View>
              <Text style={{ fontSize: 10, color: allDone ? colors.green : colors.text.muted, fontWeight: '600' }}>
                {completed}/{total} this wk
              </Text>
            </View>
          )}
        </View>
        <Ionicons name={open ? 'chevron-up' : 'chevron-down'} size={18} color={colors.text.muted} />
      </Tappable>

      {open && (
        <View style={{ paddingHorizontal: 14, paddingBottom: 14, borderTopWidth: 1, borderTopColor: colors.glass.divider }}>
          {s.focus_rationale ? (
            <View style={{
              marginTop: 12, padding: 10, borderRadius: radius.md,
              backgroundColor: colors.blue + '0F',
            }}>
              <Text style={{ fontSize: 9, letterSpacing: 1.5, textTransform: 'uppercase', color: colors.blue, fontWeight: '700', marginBottom: 4 }}>
                Why this plan
              </Text>
              <Text style={{ fontSize: 12, color: colors.text.secondary, lineHeight: 17 }}>{s.focus_rationale}</Text>
            </View>
          ) : null}

          {s.maturity_note ? (
            <View style={{
              flexDirection: 'row', gap: 8, alignItems: 'flex-start',
              marginTop: 12, backgroundColor: colors.accent[500] + '0F',
              borderRadius: radius.sm, padding: 10,
            }}>
              <Ionicons name="leaf-outline" size={14} color={colors.accent[500]} style={{ marginTop: 1 }} />
              <Text style={{ flex: 1, fontSize: 12, color: colors.accent[500], lineHeight: 17 }}>
                {s.maturity_note}
              </Text>
            </View>
          ) : null}

          {sessions.map((sess, i) => {
            const isDone = done.has(i)
            return (
              <View key={i} style={{
                marginTop: 12, padding: 12, borderRadius: radius.md,
                backgroundColor: isDone ? colors.green + '0F' : colors.bg.primary,
                borderWidth: 1, borderColor: isDone ? colors.green + '33' : 'transparent',
              }}>
                <View style={{ flexDirection: 'row', alignItems: 'flex-start', justifyContent: 'space-between', gap: 8 }}>
                  <View style={{ flex: 1 }}>
                    <Text style={{ fontSize: 14, fontWeight: '700', color: colors.text.primary }}>
                      {sess.label || `Session ${i + 1}`}
                    </Text>
                    {sess.focus ? (
                      <Text style={{ fontSize: 10, letterSpacing: 1.5, textTransform: 'uppercase', color: colors.accent[500], fontWeight: '600', marginTop: 3 }}>
                        {sess.focus}
                      </Text>
                    ) : null}
                  </View>
                  <Tappable
                    onPress={() => toggle(i)} disabled={busy === i} hitSlop={10}
                    accessibilityLabel={`${sess.label || 'Session ' + (i + 1)}, ${isDone ? 'done, tap to undo' : 'mark done'}`}
                    style={{ flexDirection: 'row', alignItems: 'center', gap: 6, minHeight: 44 }}
                  >
                    <Ionicons
                      name={isDone ? 'checkmark-circle' : 'ellipse-outline'}
                      size={19} color={isDone ? colors.green : colors.text.muted}
                    />
                    <Text style={{ fontSize: 11, fontWeight: '700', color: isDone ? colors.green : colors.text.muted }}>
                      {isDone ? 'Done' : 'Mark done'}
                    </Text>
                  </Tappable>
                </View>

                <View style={{ marginTop: 10 }}>
                  {(Array.isArray(sess.blocks) ? sess.blocks : []).map((b: any, j: number) => (
                    <View key={j} style={{ marginBottom: 10 }}>
                      <Text style={{ fontSize: 12, fontWeight: '700', color: colors.text.secondary, marginBottom: 6 }}>{b.name}</Text>
                      {Array.isArray(b.exercises) && b.exercises.length > 0
                        ? b.exercises.map((ex: any, k: number) => <ExerciseRow key={k} ex={ex} />)
                        : <Text style={{ fontSize: 12, color: colors.text.muted, lineHeight: 17 }}>{b.detail}</Text>}
                    </View>
                  ))}
                </View>

                {sess.notes ? (
                  <Text style={{ fontSize: 11, color: colors.text.muted, fontStyle: 'italic', marginTop: 6 }}>{sess.notes}</Text>
                ) : null}
              </View>
            )
          })}

          {s.progression ? (
            <Text style={{ fontSize: 12, color: colors.text.secondary, marginTop: 12, lineHeight: 17 }}>
              <Text style={{ fontWeight: '700' }}>Progression: </Text>{s.progression}
            </Text>
          ) : null}
          {s.safety_note ? (
            <View style={{ flexDirection: 'row', gap: 8, alignItems: 'flex-start', marginTop: 10 }}>
              <Ionicons name="alert-circle-outline" size={14} color={colors.amber} style={{ marginTop: 1 }} />
              <Text style={{ flex: 1, fontSize: 12, color: colors.text.muted, lineHeight: 17 }}>{s.safety_note}</Text>
            </View>
          ) : null}

          <Tappable
            onPress={onDelete}
            accessibilityLabel="Delete this program"
            style={{ flexDirection: 'row', alignItems: 'center', gap: 6, marginTop: rhythm.section, minHeight: 44 }}
          >
            <Ionicons name="trash-outline" size={13} color={colors.text.muted} />
            <Text style={{ fontSize: 12, color: colors.red }}>Delete program</Text>
          </Tappable>
        </View>
      )}
    </View>
  )
}

// ── Screen ─────────────────────────────────────────────────────────
export default function ProgramsScreen() {
  const { user, profile } = useAuth()
  const { colors } = useTheme()
  const [programs, setPrograms] = useState<any[]>([])
  const [loading, setLoading] = useState(true)
  const [intake, setIntake] = useState({ ...EMPTY_INTAKE })
  const [generating, setGenerating] = useState(false)
  const [error, setError] = useState('')
  const [openId, setOpenId] = useState<string | null>(null)
  const [showForm, setShowForm] = useState(false)

  const load = useCallback(async () => {
    if (!user?.id) return
    setLoading(true)
    try {
      const rows = await selectFrom('programs', {
        filter: `athlete_user_id=eq.${user.id}&status=eq.active`, order: 'created_at.desc',
      })
      setPrograms(Array.isArray(rows) ? rows : [])
    } catch { setPrograms([]) } finally { setLoading(false) }
  }, [user])

  useEffect(() => { load() }, [load])

  const generate = async () => {
    setError(''); setGenerating(true)
    try {
      const payload = {
        role: 'athlete',
        context: {
          name: profile?.full_name || 'You',
          discipline: (profile as any)?.primary_discipline || '',
        },
        weeks: 4,
        intake: {
          ...intake,
          days_per_week: Number(intake.days_per_week) || 3,
          training_age_years: intake.training_age_years ? Number(intake.training_age_years) : null,
          target_competition_date: intake.target_competition_date || null,
        },
      }
      const res = await fetch(`${API_BASE}/api/v1/assistant/program`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', ...authHeader() },
        body: JSON.stringify(payload),
      })
      if (!res.ok) {
        const b = await res.json().catch(() => ({}))
        throw new Error((b as any).detail || `Server error ${res.status}`)
      }
      const { program } = await res.json()
      if (!program || !program.title) throw new Error('The program came back empty — try again.')
      const saved = await insertInto('programs', {
        athlete_user_id: user!.id, created_by: user!.id, source: 'ai',
        title: program.title, goal: intake.goal.trim() || null, structure: program,
      })
      setPrograms((p) => [saved, ...p])
      setOpenId(saved?.id || null)
      setIntake({ ...EMPTY_INTAKE }); setShowForm(false)
    } catch (e: any) {
      setError(e.message?.replace(/^Supabase \d+:\s*/, '') || 'Could not generate a program.')
    } finally { setGenerating(false) }
  }

  const remove = async (id: string) => {
    try {
      await deleteFrom('programs', `id=eq.${id}`)
      setPrograms((p) => p.filter((x) => x.id !== id))
    } catch { /* ignore */ }
  }

  return (
    <SafeAreaView style={{ flex: 1, backgroundColor: colors.bg.primary }} edges={['top', 'left', 'right']}>
      <AppHeader />
      <ScrollView
        contentContainerStyle={{ padding: spacing.lg, paddingBottom: 120 }}
        refreshControl={<RefreshControl refreshing={loading} onRefresh={load} tintColor={colors.accent[500]} />}
      >
        <AlmanacCard
          kicker="Your plan"
          title="Training Programs"
          right={!showForm ? (
            <Tappable
              onPress={() => setShowForm(true)}
              accessibilityLabel="Generate a new program"
              style={{
                flexDirection: 'row', alignItems: 'center', gap: 6,
                paddingHorizontal: 14, minHeight: 44, justifyContent: 'center',
                borderRadius: radius.md, backgroundColor: colors.accent[500],
              }}
            >
              <Ionicons name="sparkles" size={13} color="#FFFFFF" />
              <Text style={{ color: '#FFFFFF', fontSize: 13, fontWeight: '700' }}>Generate</Text>
            </Tappable>
          ) : undefined}
        >
          {showForm && (
            <IntakeForm
              intake={intake} setIntake={setIntake} generating={generating}
              onGenerate={generate} onCancel={() => { setShowForm(false); setError('') }}
            />
          )}

          {!!error && (
            <View style={{ flexDirection: 'row', gap: 8, alignItems: 'flex-start', marginTop: spacing.md }}>
              <Ionicons name="alert-circle" size={15} color={colors.red} style={{ marginTop: 1 }} />
              <Text style={{ color: colors.red, fontSize: 12, flex: 1, lineHeight: 17 }}>{error}</Text>
            </View>
          )}

          {loading ? (
            <ActivityIndicator style={{ marginVertical: spacing.xl }} color={colors.accent[500]} />
          ) : programs.length === 0 && !showForm ? (
            <EmptyState
              icon="barbell-outline"
              title="No programs yet"
              subtitle="Generate one tailored to your event, season phase, and development stage."
            />
          ) : (
            <View style={{ marginTop: showForm ? spacing.lg : 0 }}>
              {programs.map((p) => (
                <ProgramCard
                  key={p.id} program={p} athleteId={user?.id}
                  open={openId === p.id}
                  onToggle={() => setOpenId(openId === p.id ? null : p.id)}
                  onDelete={() => remove(p.id)}
                />
              ))}
            </View>
          )}
        </AlmanacCard>
      </ScrollView>
    </SafeAreaView>
  )
}
