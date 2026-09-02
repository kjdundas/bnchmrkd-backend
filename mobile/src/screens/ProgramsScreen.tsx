// ═══════════════════════════════════════════════════════════════════════
// SCHEDULE (athlete) — a week at a time, with the programs underneath it.
//
// This was a list of programs. A program is a plan for a month; what an
// athlete actually needs on a Tuesday is Tuesday. So the week leads, and the
// programs sit below it as the reference they are.
//
// The week is assembled by src/lib/schedule.ts from four separate sources —
// the plan, what was ticked, the daily check-in, and anything logged — and
// this screen does no date arithmetic of its own. That is deliberate: every
// calendar bug this app could have lives in that one tested file.
//
// Structured intake → a periodization-aware, maturation-capped program.
// The backend builds a deterministic skeleton; the LLM fills in detail, and
// the server binds each session to a weekday from the days the athlete said
// they train. Weekly completions live in program_session_logs, bucketed by
// the Monday of the week (same key the web app uses).
// ═══════════════════════════════════════════════════════════════════════

import React, { useState, useEffect, useCallback, useRef, useMemo } from 'react'
import {
  View, Text, StyleSheet, ScrollView, TextInput, Modal,
  ActivityIndicator, RefreshControl, Animated,
} from 'react-native'
import { SafeAreaView } from 'react-native-safe-area-context'
import { useNavigation } from '@react-navigation/native'
import { Ionicons } from '@expo/vector-icons'
import { selectFrom, insertInto, deleteFrom, updateIn, upsertInto, authHeader } from '../lib/supabase'
import { metricForExercise } from '../lib/exerciseMetrics'
import { API_BASE } from '../lib/api'
import { useAuth } from '../contexts/AuthContext'
import { useTheme, OnImageTheme } from '../contexts/ThemeContext'
import { spacing, radius, rhythm, onImage, typeScale, weight } from '../lib/theme'
import { tapFeedback, errorFeedback } from '../lib/haptics'
import { DURATION, EASE, useReducedMotion } from '../lib/motion'
import { EmptyState, MonoKicker, Tappable, GlassPanel, SectionLabel } from '../components/ui'
import AppHeader from '../components/AppHeader'
import { TAB_BAR_CLEARANCE } from '../navigation/FloatingTabBar'
import ScreenBackdrop, { BACKDROP_GROUND } from '../components/ScreenBackdrop'
import WeekStrip from '../components/WeekStrip'
import DaySchedule from '../components/DaySchedule'
import WellnessHistorySheet from '../components/WellnessHistorySheet'
import { useSessionLogs } from '../lib/useSessionLogs'
import { buildProgramContext, hasTargetableData, describeDna } from '../lib/assistantContext'
import {
  sessionType, exerciseMeta, filled, TYPE_STYLE, type SessionType,
} from '../lib/sessionTypes'
import {
  buildWeek, buildMonth, shiftMonth, mondayOf, todayDay, addDays, weekdayOf,
  resolveSessionDays, trainingDaysOf, WEEKDAY_SHORT,
} from '../lib/schedule'
import MonthView from '../components/MonthView'
import AddEventSheet from '../components/AddEventSheet'
import SetLogger from '../components/SetLogger'
import { fetchEvents, createEvent } from '../lib/events'
import { groupMetrics, LOWER_IS_BETTER } from '../lib/metricSemantics'


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
// ISO weekday numbers, as strings because a multi step stores string arrays.
// Monday first, matching the schedule and the rest of the app.
const TRAINING_DAYS: { v: string; l: string }[] = [
  { v: '1', l: 'Mon' }, { v: '2', l: 'Tue' }, { v: '3', l: 'Wed' }, { v: '4', l: 'Thu' },
  { v: '5', l: 'Fri' }, { v: '6', l: 'Sat' }, { v: '7', l: 'Sun' },
]

const INJURY_AREAS = [
  { v: 'knee', l: 'Knee' }, { v: 'heel', l: 'Heel' }, { v: 'ankle', l: 'Ankle' },
  { v: 'hip', l: 'Hip/groin' }, { v: 'shin', l: 'Shin' }, { v: 'back', l: 'Back' },
]

const EMPTY_INTAKE = {
  // How the block gets its focus. 'data' hands the choice to the athlete's
  // own test scores; 'manual' is the athlete choosing the qualities.
  focus_mode: '',
  season_phase: 'pre_season', primary_quality: '', secondary_quality: '',
  // WHICH days, not how many. The count is derivable from the list; the list
  // is not derivable from the count, and the schedule needs the list to put
  // sessions on real days.
  training_days: ['1', '3', '5'] as string[],
  equipment: 'track', training_age_years: '',
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
        fontSize: typeScale.caption, fontWeight: weight.medium,
        color: active ? '#FFFFFF' : colors.text.secondary,
      }}>{label}</Text>
    </Tappable>
  )
}

// One of the two answers to "how should we build this?". A card rather than a
// chip because each option needs a line of explanation to be a real choice.
function ModeCard({
  title, subtitle, icon, active, disabled, onPress,
}: {
  title: string
  subtitle: string
  icon: any
  active: boolean
  disabled?: boolean
  onPress: () => void
}) {
  const { colors } = useTheme()
  return (
    <Tappable
      onPress={onPress}
      disabled={disabled}
      accessibilityLabel={`${title}. ${subtitle}`}
      style={{
        flexDirection: 'row', alignItems: 'flex-start', gap: 12,
        padding: 14, borderRadius: radius.control, borderWidth: 1,
        borderColor: active ? colors.accent[500] + '73' : colors.glass.border,
        backgroundColor: active ? colors.accent[500] + '1F' : colors.bg.primary,
      }}
    >
      <Ionicons
        name={icon} size={18}
        color={active ? colors.accent[500] : colors.text.muted}
        style={{ marginTop: 1 }}
      />
      <View style={{ flex: 1, gap: 3 }}>
        <Text style={{
          fontSize: typeScale.body, fontWeight: weight.bold,
          color: active ? colors.accent[500] : colors.text.primary,
        }}>
          {title}
        </Text>
        <Text style={{ fontSize: typeScale.caption, lineHeight: 17, color: colors.text.muted }}>
          {subtitle}
        </Text>
      </View>
      {active && <Ionicons name="checkmark-circle" size={19} color={colors.accent[500]} />}
    </Tappable>
  )
}

function ChipRow({ children }: { children: React.ReactNode }) {
  return <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 8 }}>{children}</View>
}

// ── Intake: one question at a time ─────────────────────────────────
// The whole intake used to be nine fields stacked on one screen. That is a
// form to be endured, and it front-loads every decision before the athlete
// has any sense of how long it takes. Asked one at a time, the same nine
// questions read as a conversation: each answer is a single tap that moves
// you forward, and the progress bar makes the length honest.
//
// The steps are DATA, not nine hand-written screens — so a question can be
// added, reordered or reworded in one line, and every step is guaranteed the
// same layout, motion, spacing and back/skip behaviour.

type Opt = { v: string; l: string }

type Step = {
  key: keyof typeof EMPTY_INTAKE
  /** The question as it is asked. */
  q: string
  /** One line under it, when the question needs a reason or a unit. */
  hint?: string
  optional?: boolean
  /**
   * Which focus modes ask this question. Omitted means both.
   *
   * The short path drops only the questions the DATA can answer — which
   * qualities to develop — and the ones that were already optional. It keeps
   * days, equipment, season phase and INJURIES, because no amount of test
   * data tells the generator what surface you can train on or what hurts.
   */
  modes?: ('data' | 'manual')[]
} & (
  | { kind: 'single'; options: Opt[] | ((intake: any) => Opt[]) }
  | { kind: 'multi'; options: Opt[] }
  | {
      kind: 'text'
      placeholder?: string
      keyboard?: 'default' | 'decimal-pad'
      multiline?: boolean
      /** Tappable shortcuts above the field — the same "answers on screen"
          idea as the chips, for questions that would otherwise be a keypad. */
      quick?: { l: string; value: () => string }[]
    }
)

const qOpts: Opt[] = QUALITIES.map((q) => ({ v: q, l: q }))

/** ISO date `weeks` from today — for the competition-date shortcuts. */
function inWeeks(weeks: number): string {
  const d = new Date()
  d.setDate(d.getDate() + weeks * 7)
  const p = (n: number) => String(n).padStart(2, '0')
  return `${d.getFullYear()}-${p(d.getMonth() + 1)}-${p(d.getDate())}`
}

const STEPS: Step[] = [
  {
    key: 'focus_mode', kind: 'single',
    q: 'How should we build this?',
    options: [
      { v: 'data', l: 'From my data — target my weak points' },
      { v: 'manual', l: "I'll choose the focus myself" },
    ],
  },
  {
    key: 'season_phase', kind: 'single',
    q: 'Where are you in your season?',
    hint: 'This sets how the block is periodised.',
    options: PHASES,
  },
  {
    key: 'primary_quality', kind: 'single', modes: ['manual'],
    q: 'What do you most want to develop?',
    hint: 'The block will be built around this.',
    options: qOpts,
  },
  {
    key: 'secondary_quality', kind: 'single', optional: true, modes: ['manual'],
    q: 'And a secondary quality?',
    hint: 'Optional — supporting work alongside the main focus.',
    // Never offer the primary again: picking the same thing twice is the one
    // answer that cannot mean anything.
    options: (intake) => qOpts.filter((o) => o.v !== intake.primary_quality),
  },
  {
    key: 'training_days', kind: 'multi',
    q: 'Which days can you train?',
    hint: 'Be honest — the plan is built to be finished, and your sessions go on these days.',
    options: TRAINING_DAYS,
  },
  {
    key: 'equipment', kind: 'single',
    q: 'What have you got access to?',
    options: EQUIPMENT,
  },
  {
    key: 'injuries', kind: 'multi', optional: true,
    q: 'Anything to work around?',
    hint: 'Pick any that apply, or skip. Sessions will avoid loading these.',
    options: INJURY_AREAS,
  },
  {
    key: 'training_age_years', kind: 'text', optional: true, modes: ['manual'],
    q: 'How long have you trained seriously?',
    hint: 'Training age caps how aggressively the block progresses.',
    placeholder: 'e.g. 3',
    keyboard: 'decimal-pad',
    quick: [
      { l: 'Under a year', value: () => '0.5' },
      { l: '1–2 years', value: () => '1.5' },
      { l: '3–4 years', value: () => '3.5' },
      { l: '5+ years', value: () => '6' },
    ],
  },
  {
    key: 'target_competition_date', kind: 'text', optional: true, modes: ['manual'],
    q: 'When do you next compete?',
    hint: 'The block counts back from this date.',
    placeholder: 'YYYY-MM-DD',
    quick: [
      { l: 'In 4 weeks', value: () => inWeeks(4) },
      { l: 'In 8 weeks', value: () => inWeeks(8) },
      { l: 'In 12 weeks', value: () => inWeeks(12) },
    ],
  },
  {
    key: 'goal', kind: 'text', optional: true, multiline: true, modes: ['manual'],
    q: 'What do you want this block to do?',
    hint: 'In your own words. Optional.',
    placeholder: 'e.g. hold top speed to 60m without tightening up',
  },
]

/**
 * The questions this run of the intake asks.
 *
 * Until the mode is chosen the list is just that one question, so the
 * progress bar cannot promise "1 of 8" and then deliver four.
 */
function visibleSteps(intake: any): Step[] {
  const mode = intake?.focus_mode
  if (!mode) return STEPS.slice(0, 1)
  return STEPS.filter((st) => !st.modes || st.modes.includes(mode))
}

/** How an answer reads back on the review screen. */
function answerLabel(step: Step, intake: any): string {
  const v = intake[step.key]
  if (step.kind === 'multi') {
    const list = (v as string[]) || []
    if (!list.length) return 'None'
    return list
      .map((x) => (step.options.find((o) => o.v === x)?.l) || x)
      .join(', ')
  }
  if (!v) return 'Not set'
  if (step.kind === 'single') {
    const opts = typeof step.options === 'function' ? step.options(intake) : step.options
    return opts.find((o) => o.v === v)?.l || String(v)
  }
  return String(v)
}

function IntakeForm({
  intake, setIntake, onGenerate, onCancel, generating, dataReady, dnaSummary,
}: any) {
  const { colors } = useTheme()
  const reduced = useReducedMotion()
  const [i, setI] = useState(0)
  const anim = useRef(new Animated.Value(1)).current
  // +1 forward, -1 back — the step slides in from the side you came from, so
  // the motion tells you which way through the sequence you just moved.
  const dir = useRef(1)

  // The step list depends on the mode, so it changes mid-flow — the moment
  // the first question is answered. Everything downstream reads from here
  // rather than from STEPS, or the progress bar counts questions that will
  // never be asked.
  const steps = visibleSteps(intake)
  const total = steps.length + 1          // + the review step
  const onReview = i >= steps.length
  const step = steps[i]

  const setField = (k: string, v: any) => setIntake((s: any) => ({ ...s, [k]: v }))

  // One place that changes `i`, so every transition animates identically.
  const go = useCallback((next: number, delay = 0) => {
    const clamped = Math.max(0, Math.min(total - 1, next))
    // `total` is recomputed from the visible steps every render, so switching
    // from the long path to the short one while standing on question 7 cannot
    // strand the form past the end of the list.
    if (clamped === i) return
    dir.current = clamped > i ? 1 : -1
    if (reduced) { setI(clamped); return }
    Animated.timing(anim, {
      toValue: 0, duration: 130, delay, easing: EASE.out, useNativeDriver: true,
    }).start(({ finished }) => {
      if (!finished) return
      setI(clamped)
      anim.setValue(0)
      Animated.timing(anim, {
        toValue: 1, duration: DURATION.base, easing: EASE.out, useNativeDriver: true,
      }).start()
    })
  }, [i, total, reduced])

  // Keyed by the step, not by the field. This was hardcoded to `injuries`
  // back when that was the only multi-select question — a second one would
  // have quietly written its answers into the injury list.
  const toggleMulti = (key: string, v: string) =>
    setIntake((s: any) => {
      const list: string[] = Array.isArray(s[key]) ? s[key] : []
      return { ...s, [key]: list.includes(v) ? list.filter((x) => x !== v) : [...list, v] }
    })

  const input = {
    backgroundColor: colors.bg.primary, borderWidth: 1, borderColor: colors.glass.border,
    borderRadius: radius.control, paddingHorizontal: 12, paddingVertical: 12,
    fontSize: typeScale.body, color: colors.text.primary,
  }

  // A single-choice question is answered by the tap itself — asking for a
  // second tap on "Next" to confirm what you just chose is the friction that
  // makes wizards feel long. The short delay lets the selection register
  // visually before the screen moves.
  const pickSingle = (v: string, clearable: boolean) => {
    tapFeedback()
    const current = intake[step.key as string]
    if (clearable && current === v) { setField(step.key as string, ''); return }
    setField(step.key as string, v)
    go(i + 1, 190)
  }

  const answered = (() => {
    if (onReview || !step) return true
    const v = intake[step.key]
    // "None" is a real answer to an optional question (no injuries) and no
    // answer at all to a required one — a program cannot be laid out across
    // zero training days.
    if (step.kind === 'multi') {
      return step.optional ? true : (Array.isArray(v) ? v.length > 0 : false)
    }
    return !!(v && String(v).trim())
  })()

  const slide = anim.interpolate({
    inputRange: [0, 1],
    outputRange: [18 * dir.current, 0],
  })

  return (
    <View>
      {/* ── Progress ─────────────────────────────────────────────── */}
      <View style={{ marginBottom: rhythm.section }}>
        <View style={{ flexDirection: 'row', justifyContent: 'space-between', marginBottom: 8 }}>
          <MonoKicker>{onReview ? 'Review' : `Question ${i + 1} of ${steps.length}`}</MonoKicker>
          {!!step?.optional && <MonoKicker color={colors.text.dimmed}>Optional</MonoKicker>}
        </View>
        <View style={{ height: 3, borderRadius: radius.hair, backgroundColor: colors.glass.divider, overflow: 'hidden' }}>
          <View style={{
            height: '100%', borderRadius: radius.hair, backgroundColor: colors.accent[500],
            width: `${Math.round(((i + 1) / total) * 100)}%`,
          }} />
        </View>
      </View>

      {/* ── The step ─────────────────────────────────────────────── */}
      {/* minHeight keeps the footer still between a two-chip question and an
          eleven-chip one — controls that jump around are what makes a
          multi-step flow feel unsteady. */}
      <Animated.View style={{
        minHeight: 250, opacity: anim, transform: [{ translateX: slide }],
      }}>
        {onReview ? (
          <View>
            <Text style={{
              fontSize: typeScale.stat, fontWeight: weight.bold, color: colors.text.primary,
              letterSpacing: -0.4, marginBottom: 4,
            }}>
              Ready to build
            </Text>
            <Text style={{ fontSize: typeScale.caption, color: colors.text.secondary, marginBottom: spacing.lg, lineHeight: 19 }}>
              Tap anything to change it.
            </Text>

            {steps.map((st, idx) => (
              <Tappable
                key={st.key}
                onPress={() => go(idx)}
                accessibilityLabel={`${st.q} Currently ${answerLabel(st, intake)}. Tap to change.`}
                style={{
                  flexDirection: 'row', alignItems: 'center', gap: 10,
                  paddingVertical: 11,
                  borderBottomWidth: 1, borderBottomColor: colors.glass.divider,
                }}
              >
                <View style={{ flex: 1 }}>
                  <Text style={{ fontSize: typeScale.label, color: colors.text.muted }}>{st.q}</Text>
                  <Text style={{ fontSize: typeScale.body, fontWeight: weight.medium, color: colors.text.primary, marginTop: 2 }}>
                    {answerLabel(st, intake)}
                  </Text>
                </View>
                <Ionicons name="chevron-forward" size={15} color={colors.text.dimmed} />
              </Tappable>
            ))}
          </View>
        ) : (
          <View>
            <Text style={{
              fontSize: typeScale.stat, fontWeight: weight.bold, color: colors.text.primary,
              letterSpacing: -0.4, lineHeight: 28,
            }}>
              {step.q}
            </Text>
            {!!step.hint && (
              <Text style={{ fontSize: typeScale.caption, color: colors.text.secondary, marginTop: 6, lineHeight: 19 }}>
                {step.hint}
              </Text>
            )}

            <View style={{ marginTop: spacing.lg }}>
              {/* The pivotal question gets more than a chip. Choosing between
                  "use my data" and "I'll decide" needs to show what the data
                  actually is — an option that silently does nothing because
                  nothing has been logged is worse than one that says so. */}
              {step.key === 'focus_mode' ? (
                <View style={{ gap: 10 }}>
                  <ModeCard
                    title="From my data"
                    subtitle={dataReady
                      ? `Targets your weakest key quality. ${dnaSummary}`
                      : 'Nothing logged to work from yet. Record a few tests in the Log tab and this can build around what you actually need.'}
                    icon="analytics-outline"
                    active={intake.focus_mode === 'data'}
                    disabled={!dataReady}
                    onPress={() => pickSingle('data', false)}
                  />
                  <ModeCard
                    title="I'll choose the focus"
                    subtitle="Pick the qualities you want the block built around."
                    icon="options-outline"
                    active={intake.focus_mode === 'manual'}
                    onPress={() => pickSingle('manual', false)}
                  />
                </View>
              ) : step.kind === 'single' ? (
                <ChipRow>
                  {(typeof step.options === 'function' ? step.options(intake) : step.options).map((o) => (
                    <Chip
                      key={o.v} label={o.l}
                      active={String(intake[step.key]) === o.v}
                      onPress={() => pickSingle(o.v, !!step.optional)}
                    />
                  ))}
                </ChipRow>
              ) : null}

              {step.kind === 'multi' && (
                <ChipRow>
                  {step.options.map((o) => (
                    <Chip
                      key={o.v} label={o.l}
                      active={(intake[step.key] as string[]).includes(o.v)}
                      onPress={() => { tapFeedback(); toggleMulti(step.key as string, o.v) }}
                    />
                  ))}
                </ChipRow>
              )}

              {step.kind === 'text' && (
                <View>
                  {!!step.quick && (
                    <View style={{ marginBottom: spacing.md }}>
                      <ChipRow>
                        {step.quick.map((q) => {
                          const v = q.value()
                          return (
                            <Chip
                              key={q.l} label={q.l}
                              active={String(intake[step.key]) === v}
                              onPress={() => { tapFeedback(); setField(step.key as string, v) }}
                            />
                          )
                        })}
                      </ChipRow>
                    </View>
                  )}
                  <TextInput
                    style={[input, step.multiline ? { height: 92, textAlignVertical: 'top' } : null]}
                    value={String(intake[step.key] ?? '')}
                    onChangeText={(v) => setField(step.key as string, v)}
                    keyboardType={step.keyboard || 'default'}
                    multiline={!!step.multiline}
                    placeholder={step.placeholder}
                    placeholderTextColor={colors.text.dimmed}
                    // The palette here is white-on-translucent; the default
                    // light keyboard against it is a jarring flash.
                    keyboardAppearance="dark"
                    returnKeyType={step.multiline ? 'default' : 'done'}
                  />
                </View>
              )}
            </View>
          </View>
        )}
      </Animated.View>

      {/* ── Footer ───────────────────────────────────────────────── */}
      <View style={{
        flexDirection: 'row', alignItems: 'center', gap: 10,
        marginTop: rhythm.section,
      }}>
        <Tappable
          onPress={() => (i === 0 ? onCancel() : go(i - 1))}
          accessibilityLabel={i === 0 ? 'Cancel' : 'Previous question'}
          style={{
            flexDirection: 'row', alignItems: 'center', gap: 5,
            paddingHorizontal: 14, minHeight: 48, justifyContent: 'center',
            borderRadius: radius.control,
            borderWidth: 1, borderColor: colors.glass.border,
          }}
        >
          <Ionicons
            name={i === 0 ? 'close' : 'chevron-back'}
            size={15} color={colors.text.secondary}
          />
          <Text style={{ color: colors.text.secondary, fontSize: typeScale.caption, fontWeight: weight.medium }}>
            {i === 0 ? 'Cancel' : 'Back'}
          </Text>
        </Tappable>

        {onReview ? (
          <Tappable
            onPress={onGenerate} disabled={generating}
            accessibilityLabel="Generate a training program"
            style={{
              flex: 1, flexDirection: 'row', alignItems: 'center', justifyContent: 'center',
              gap: 8, minHeight: 48, borderRadius: radius.control,
              backgroundColor: colors.accent[500],
            }}
          >
            {generating
              ? <ActivityIndicator size="small" color="#FFFFFF" />
              : <Ionicons name="sparkles" size={15} color="#FFFFFF" />}
            <Text style={{ color: '#FFFFFF', fontWeight: weight.bold, fontSize: typeScale.body }}>
              {generating ? 'Building your program…' : 'Generate program'}
            </Text>
          </Tappable>
        ) : (
          <Tappable
            onPress={() => go(i + 1)}
            disabled={!answered && !step?.optional}
            accessibilityLabel={answered ? 'Next question' : 'Skip this question'}
            style={{
              flex: 1, flexDirection: 'row', alignItems: 'center', justifyContent: 'center',
              gap: 6, minHeight: 48, borderRadius: radius.control,
              backgroundColor: answered ? colors.accent[500] : 'transparent',
              borderWidth: answered ? 0 : 1, borderColor: colors.glass.border,
            }}
          >
            <Text style={{
              color: answered ? '#FFFFFF' : colors.text.secondary,
              fontWeight: weight.bold, fontSize: typeScale.body,
            }}>
              {answered ? 'Next' : 'Skip'}
            </Text>
            <Ionicons
              name="chevron-forward" size={15}
              color={answered ? '#FFFFFF' : colors.text.secondary}
            />
          </Tappable>
        )}
      </View>

      {onReview && (
        <Text style={{ fontSize: typeScale.label, color: colors.text.muted, marginTop: spacing.md, lineHeight: 16 }}>
          Educational guidance, not medical advice. Review with your coach (and a
          parent/guardian if under 18) before starting. Stop and see a professional
          if anything hurts.
        </Text>
      )}
    </View>
  )
}

// ── Block header ───────────────────────────────────────────────────
// The archetype is on the block, not just the session: an acceleration day
// legitimately contains a track block AND a gym block, and they should not
// look like the same kind of work.
function BlockHeader({ name, type }: { name: string; type: SessionType }) {
  const { colors } = useTheme()
  const st = TYPE_STYLE[type]
  const tone = st.tone === 'muted' ? colors.text.muted : (colors as any)[st.tone] || colors.accent[500]
  return (
    <View style={{ flexDirection: 'row', alignItems: 'center', gap: 7, marginBottom: 7 }}>
      <Ionicons name={st.icon as any} size={13} color={tone} />
      <Text style={{ fontSize: typeScale.caption, fontWeight: weight.bold, color: colors.text.secondary, flex: 1 }}>
        {name}
      </Text>
      <View style={{ paddingHorizontal: 6, paddingVertical: 2, borderRadius: radius.hair, backgroundColor: tone + '24' }}>
        <Text style={{ fontSize: typeScale.micro, fontWeight: weight.bold, letterSpacing: 0.8, color: tone }}>
          {st.label.toUpperCase()}
        </Text>
      </View>
    </View>
  )
}

// ── One prescribed exercise ────────────────────────────────────────
// Same row, different contents per archetype. A technical drill shows what a
// good rep looks like where a gym exercise shows its load — and neither shows
// an empty column belonging to the other.
function ExerciseRow({ ex, type = 'track' }: { ex: any; type?: SessionType }) {
  const { colors } = useTheme()
  if (!ex) return null
  const meta = exerciseMeta(ex, type)
  const technical = type === 'technical'

  return (
    <View style={{
      backgroundColor: colors.bg.primary, borderRadius: radius.chip,
      borderWidth: 1, borderColor: colors.glass.divider,
      paddingHorizontal: 10, paddingVertical: 8, marginBottom: 6,
    }}>
      <View style={{ flexDirection: 'row', alignItems: 'baseline', justifyContent: 'space-between', gap: 8 }}>
        <Text style={{ fontSize: typeScale.caption, fontWeight: weight.medium, color: colors.text.primary, flex: 1 }}>{ex.name}</Text>
        {filled(ex.prescription) && (
          <Text style={{ fontSize: typeScale.caption, fontWeight: weight.bold, color: colors.accent[500] }}>{ex.prescription}</Text>
        )}
      </View>
      {meta.length > 0 && (
        <Text style={{ fontSize: typeScale.label, color: colors.text.muted, marginTop: 3 }}>{meta.join(' · ')}</Text>
      )}
      {filled(ex.cue) && (
        <Text style={{ fontSize: typeScale.label, color: colors.text.muted, fontStyle: 'italic', marginTop: 3 }}>{ex.cue}</Text>
      )}
      {/* On a technical drill this IS the prescription, so it is given the
          weight a load would have elsewhere rather than being another
          grey line. */}
      {technical && filled(ex.good_rep) && (
        <View style={{
          flexDirection: 'row', gap: 6, marginTop: 6, paddingTop: 6,
          borderTopWidth: 1, borderTopColor: colors.glass.divider,
        }}>
          <Ionicons name="checkmark-circle-outline" size={13} color={colors.amber} style={{ marginTop: 1 }} />
          <Text style={{ fontSize: typeScale.label, lineHeight: 16, color: colors.text.secondary, flex: 1 }}>
            {ex.good_rep}
          </Text>
        </View>
      )}
    </View>
  )
}

// ── One program ────────────────────────────────────────────────────
// Completion is NOT owned here any more. This card and the week strip tick
// the same sessions from two places, and each holding its own Set of done
// indices is how a session ends up ticked in one and not the other. The
// screen owns it, via useSessionLogs, and passes it down.
function ProgramCard({ program, open, onToggle, onDelete, isDone, onToggleSession, busyKey }: any) {
  const { colors } = useTheme()
  const s = program.structure || {}
  const sessions: any[] = Array.isArray(s.sessions) ? s.sessions : []
  const done = { has: (i: number) => isDone(program.id, i) }
  const toggle = (i: number) => onToggleSession(program.id, i)

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
      backgroundColor: colors.glass.bg, borderRadius: radius.card,
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
            <Text numberOfLines={1} style={{ fontSize: typeScale.body, fontWeight: weight.bold, color: colors.text.primary, flexShrink: 1 }}>
              {s.title || program.title}
            </Text>
            {fromCoach && (
              <View style={{ paddingHorizontal: 6, paddingVertical: 2, borderRadius: radius.hair, backgroundColor: colors.blue + '1F' }}>
                <Text style={{ fontSize: typeScale.micro, fontWeight: weight.bold, letterSpacing: 1, textTransform: 'uppercase', color: colors.blue }}>
                  From coach
                </Text>
              </View>
            )}
          </View>
          {!!meta && (
            <Text numberOfLines={1} style={{ fontSize: typeScale.label, color: colors.text.muted, marginTop: 3 }}>{meta}</Text>
          )}
          {total > 0 && (
            <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8, marginTop: 8 }}>
              <View style={{ flex: 1, height: 5, borderRadius: radius.hair, backgroundColor: colors.glass.divider, overflow: 'hidden' }}>
                <View style={{
                  width: `${pct}%`, height: '100%', borderRadius: radius.hair,
                  backgroundColor: allDone ? colors.green : colors.accent[500],
                }} />
              </View>
              <Text style={{ fontSize: typeScale.label, color: allDone ? colors.green : colors.text.muted, fontWeight: weight.medium }}>
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
              marginTop: 12, padding: 10, borderRadius: radius.control,
              backgroundColor: colors.blue + '0F',
            }}>
              <Text style={{ fontSize: typeScale.micro, letterSpacing: 1.5, textTransform: 'uppercase', color: colors.blue, fontWeight: weight.bold, marginBottom: 4 }}>
                Why this plan
              </Text>
              <Text style={{ fontSize: typeScale.caption, color: colors.text.secondary, lineHeight: 17 }}>{s.focus_rationale}</Text>
            </View>
          ) : null}

          {s.maturity_note ? (
            <View style={{
              flexDirection: 'row', gap: 8, alignItems: 'flex-start',
              marginTop: 12, backgroundColor: colors.accent[500] + '0F',
              borderRadius: radius.chip, padding: 10,
            }}>
              <Ionicons name="leaf-outline" size={14} color={colors.accent[500]} style={{ marginTop: 1 }} />
              <Text style={{ flex: 1, fontSize: typeScale.caption, color: colors.accent[500], lineHeight: 17 }}>
                {s.maturity_note}
              </Text>
            </View>
          ) : null}

          {sessions.map((sess, i) => {
            const isDone = done.has(i)
            return (
              <View key={i} style={{
                marginTop: 12, padding: 12, borderRadius: radius.control,
                backgroundColor: isDone ? colors.green + '0F' : colors.bg.primary,
                borderWidth: 1, borderColor: isDone ? colors.green + '33' : 'transparent',
              }}>
                <View style={{ flexDirection: 'row', alignItems: 'flex-start', justifyContent: 'space-between', gap: 8 }}>
                  <View style={{ flex: 1 }}>
                    <Text style={{ fontSize: typeScale.body, fontWeight: weight.bold, color: colors.text.primary }}>
                      {sess.label || `Session ${i + 1}`}
                    </Text>
                    {sess.focus ? (
                      <Text style={{ fontSize: typeScale.label, letterSpacing: 1.5, textTransform: 'uppercase', color: colors.accent[500], fontWeight: weight.medium, marginTop: 3 }}>
                        {sess.focus}
                      </Text>
                    ) : null}
                  </View>
                  <Tappable
                    onPress={() => toggle(i)} disabled={busyKey === `${program.id}:${i}`} hitSlop={10}
                    accessibilityLabel={`${sess.label || 'Session ' + (i + 1)}, ${isDone ? 'done, tap to undo' : 'mark done'}`}
                    style={{ flexDirection: 'row', alignItems: 'center', gap: 6, minHeight: 44 }}
                  >
                    <Ionicons
                      name={isDone ? 'checkmark-circle' : 'ellipse-outline'}
                      size={19} color={isDone ? colors.green : colors.text.muted}
                    />
                    <Text style={{ fontSize: typeScale.label, fontWeight: weight.bold, color: isDone ? colors.green : colors.text.muted }}>
                      {isDone ? 'Done' : 'Mark done'}
                    </Text>
                  </Tappable>
                </View>

                <View style={{ marginTop: 10 }}>
                  {(Array.isArray(sess.blocks) ? sess.blocks : []).map((b: any, j: number) => (
                    <View key={j} style={{ marginBottom: 10 }}>
                      <BlockHeader name={b.name} type={sessionType(b.type || sess.type)} />
                      {Array.isArray(b.exercises) && b.exercises.length > 0
                        ? b.exercises.map((ex: any, k: number) => (
                            <ExerciseRow key={k} ex={ex} type={sessionType(b.type || sess.type)} />
                          ))
                        : <Text style={{ fontSize: typeScale.caption, color: colors.text.muted, lineHeight: 17 }}>{b.detail}</Text>}
                    </View>
                  ))}
                </View>

                {sess.notes ? (
                  <Text style={{ fontSize: typeScale.label, color: colors.text.muted, fontStyle: 'italic', marginTop: 6 }}>{sess.notes}</Text>
                ) : null}
              </View>
            )
          })}

          {s.progression ? (
            <Text style={{ fontSize: typeScale.caption, color: colors.text.secondary, marginTop: 12, lineHeight: 17 }}>
              <Text style={{ fontWeight: weight.bold }}>Progression: </Text>{s.progression}
            </Text>
          ) : null}
          {s.safety_note ? (
            <View style={{ flexDirection: 'row', gap: 8, alignItems: 'flex-start', marginTop: 10 }}>
              <Ionicons name="alert-circle-outline" size={14} color={colors.amber} style={{ marginTop: 1 }} />
              <Text style={{ flex: 1, fontSize: typeScale.caption, color: colors.text.muted, lineHeight: 17 }}>{s.safety_note}</Text>
            </View>
          ) : null}

          <Tappable
            onPress={onDelete}
            accessibilityLabel="Delete this program"
            style={{ flexDirection: 'row', alignItems: 'center', gap: 6, marginTop: rhythm.section, minHeight: 44 }}
          >
            <Ionicons name="trash-outline" size={13} color={colors.text.muted} />
            <Text style={{ fontSize: typeScale.caption, color: colors.red }}>Delete program</Text>
          </Tappable>
        </View>
      )}
    </View>
  )
}

// ── Screen ─────────────────────────────────────────────────────────
// The screen splits in two: the shell owns the backdrop and the theme
// override, the body is everything that repaints under it. They have to be
// separate components — useTheme() inside the shell would read the OUTER
// (light) palette, since a provider is only visible to its children.
export default function ProgramsScreen() {
  return (
    <OnImageTheme>
      <ProgramsBody />
    </OnImageTheme>
  )
}

function ProgramsBody() {
  const { user, profile } = useAuth()
  const { colors } = useTheme()
  const navigation = useNavigation()
  // Drives the backdrop's parallax, blur and dissolve — same treatment as Home.
  const scrollY = useRef(new Animated.Value(0)).current
  const [programs, setPrograms] = useState<any[]>([])
  const [loading, setLoading] = useState(true)
  const [intake, setIntake] = useState({ ...EMPTY_INTAKE })
  const [generating, setGenerating] = useState(false)
  const [error, setError] = useState('')
  const [openId, setOpenId] = useState<string | null>(null)
  const [showForm, setShowForm] = useState(false)

  // ── The week ──
  // weekStart is always a Monday; selectedDay is a real date inside it. Both
  // are day-strings — see src/lib/schedule.ts for why nothing here is a Date.
  const [weekStart, setWeekStart] = useState(() => mondayOf(todayDay()))
  const [selectedDay, setSelectedDay] = useState(() => todayDay())
  const [checkins, setCheckins] = useState<any[]>([])
  const [performances, setPerformances] = useState<any[]>([])
  const [metrics, setMetrics] = useState<any[]>([])
  const [wellnessOpen, setWellnessOpen] = useState(false)
  const [moveTarget, setMoveTarget] = useState<{ programId: string; index: number } | null>(null)
  // The athlete's own row — height, sitting height, weight, discipline and
  // scraped race history. Needed for the maturity estimate that decides the
  // program's loading ceiling.
  const [athleteRow, setAthleteRow] = useState<any>(null)
  const [events, setEvents] = useState<any[]>([])
  const [setLogs, setSetLogs] = useState<any[]>([])
  // Week is the working view; month is the season view. Both render the same
  // day cells, so switching never changes what a day says.
  const [view, setView] = useState<'week' | 'month'>('week')
  const [monthStart, setMonthStart] = useState(() => shiftMonth(todayDay(), 0))
  const [addEventOn, setAddEventOn] = useState<string | null>(null)
  const [logTarget, setLogTarget] = useState<
    { programId: string; sessionIndex: number; blockIndex: number; exerciseIndex: number } | null>(null)

  const { logs, isDone, toggle: toggleSession, busy: busyKey } = useSessionLogs(user?.id, weekStart)

  // Paging the week moves the selection with it, landing on the same weekday
  // — stepping back from Wednesday should show you last Wednesday, not last
  // Monday, and certainly not a day outside the week on screen.
  const goWeek = useCallback((delta: number) => {
    setWeekStart((ws) => {
      const next = addDays(ws, delta * 7)
      setSelectedDay((sd) => addDays(next, weekdayOf(sd) - 1))
      return next
    })
  }, [])

  const goToday = useCallback(() => {
    setWeekStart(mondayOf(todayDay()))
    setSelectedDay(todayDay())
  }, [])

  const load = useCallback(async () => {
    if (!user?.id) return
    setLoading(true)
    // Four independent queries, so they go together rather than in series.
    // Each falls back to an empty list on its own: a missing check-in table
    // should cost the check-in row, not the whole schedule.
    const [rows, ci, perf, mets, arow, evs, slogs] = await Promise.all([
      selectFrom('programs', {
        filter: `athlete_user_id=eq.${user.id}&status=eq.active`, order: 'created_at.desc',
      }).catch(() => []),
      // Every check-in, not a window: the wellness sheet charts all of them,
      // and the volume is a handful of rows per athlete per month.
      selectFrom('athlete_checkins', {
        filter: `athlete_id=eq.${user.id}`, order: 'checkin_date.desc', limit: '1000',
      }).catch(() => []),
      selectFrom('performances', {
        filter: `user_id=eq.${user.id}`, order: 'competition_date.desc', limit: '200',
      }).catch(() => []),
      selectFrom('athlete_metrics', {
        filter: `athlete_id=eq.${user.id}`, order: 'recorded_at.desc', limit: '1000',
      }).catch(() => []),
      selectFrom('athlete_profiles', { filter: `id=eq.${user.id}`, limit: '1' })
        .catch(() => []),
      // A generous window either side of today so paging a month or two in
      // any direction does not need a refetch.
      fetchEvents(user.id, addDays(todayDay(), -400), addDays(todayDay(), 400))
        .catch(() => []),
      selectFrom('exercise_set_logs', {
        filter: `athlete_id=eq.${user.id}`, order: 'week_start.desc', limit: '2000',
      }).catch(() => []),
    ])
    setPrograms(Array.isArray(rows) ? rows : [])
    setCheckins(Array.isArray(ci) ? ci : [])
    setPerformances(Array.isArray(perf) ? perf : [])
    setMetrics(Array.isArray(mets) ? mets : [])
    setAthleteRow(Array.isArray(arow) ? arow[0] || null : null)
    setEvents(Array.isArray(evs) ? evs : [])
    setSetLogs(Array.isArray(slogs) ? slogs : [])
    setLoading(false)
  }, [user])

  // Everything the generator is told about the athlete. Recomputed from data
  // the screen already holds, so opening the intake costs no extra queries.
  const programContext = useMemo(
    () => buildProgramContext({ profile, athleteRow, metrics, performances }),
    [profile, athleteRow, metrics, performances],
  )
  const dataReady = hasTargetableData(programContext.dna)
  const dnaSummary = describeDna(programContext.dna)

  const scheduleInput = useMemo(() => ({
    programs, sessionLogs: logs, checkins, performances, metrics, events,
  }), [programs, logs, checkins, performances, metrics, events])

  const week = useMemo(
    () => buildWeek({ weekStart, ...scheduleInput }),
    [weekStart, scheduleInput],
  )
  const month = useMemo(
    () => buildMonth(monthStart, scheduleInput),
    [monthStart, scheduleInput],
  )

  // The selected day may sit in the month grid but outside the current week,
  // so look in both rather than falling back to the wrong day.
  const day = week.days.find((d) => d.date === selectedDay)
    || month.weeks.flatMap((w) => w.days).find((d) => d.date === selectedDay)
    || week.days[0]

  // ── Set logs, indexed by exactly where the exercise sits ──
  const setLogKey = (p: string, si: number, bi: number, ei: number, ws: string) =>
    `${p}:${ws}:${si}:${bi}:${ei}`
  const logsByExercise = useMemo(() => {
    const m = new Map<string, any[]>()
    for (const r of setLogs) {
      const k = setLogKey(r.program_id, r.session_index, r.block_index, r.exercise_index, String(r.week_start).slice(0, 10))
      const list = m.get(k)
      list ? list.push(r) : m.set(k, [r])
    }
    return m
  }, [setLogs])

  // The week a logged set belongs to is the week being VIEWED, not today —
  // logging Monday's session on Tuesday must not file it under next week.
  const dayWeekStart = mondayOf(day?.date || todayDay())

  const sessionBody = useCallback((programId: string, index: number) => {
    const prog = programs.find((p) => p.id === programId)
    const sessions = prog?.structure?.sessions
    return Array.isArray(sessions) ? sessions[index] : null
  }, [programs])

  const loggedCount = useCallback((p: string, si: number, bi: number, ei: number) =>
    (logsByExercise.get(setLogKey(p, si, bi, ei, dayWeekStart)) || []).length,
    [logsByExercise, dayWeekStart])

  /** The athlete's tested 1RM for a lift, so a %1RM can be turned into kg. */
  const oneRepMaxFor = useCallback((metricKey: string): number | null => {
    const g = groupMetrics(metrics).find((x) => x.key === metricKey)
    if (!g) return null
    const vals = g.history.map((r) => Number(r.value)).filter(Number.isFinite)
    if (!vals.length) return null
    return LOWER_IS_BETTER.has(metricKey) ? Math.min(...vals) : Math.max(...vals)
  }, [metrics])

  /**
   * Write the logged sets. Upserts on the unique index, so re-opening the
   * sheet and correcting a number edits the row rather than stacking a
   * duplicate underneath it.
   */
  const saveSets = useCallback(async (rows: any[]) => {
    if (!user || !logTarget) return
    const { programId, sessionIndex, blockIndex, exerciseIndex } = logTarget
    const num = (v: any) => {
      const t = String(v ?? '').trim()
      if (!t) return null
      const n = Number(t.replace(',', '.'))
      return Number.isFinite(n) ? n : null
    }
    const payload = rows.map((r) => ({
      athlete_id: user.id, program_id: programId, week_start: dayWeekStart,
      session_index: sessionIndex, block_index: blockIndex, exercise_index: exerciseIndex,
      set_index: r.set_index,
      reps: num(r.reps), load_kg: num(r.load_kg),
      distance_m: num(r.distance_m), time_s: num(r.time_s), rpe: num(r.rpe),
      completed: !!r.completed,
      updated_at: new Date().toISOString(),
    }))
    await upsertInto('exercise_set_logs', payload,
      'program_id,week_start,session_index,block_index,exercise_index,set_index')
    const fresh = await selectFrom('exercise_set_logs', {
      filter: `athlete_id=eq.${user.id}`, order: 'week_start.desc', limit: '2000',
    }).catch(() => null)
    if (Array.isArray(fresh)) setSetLogs(fresh)
  }, [user, logTarget, dayWeekStart])

  const addEvent = useCallback(async (e: any) => {
    if (!user) return
    await createEvent({
      subject: { athleteId: user.id }, createdBy: user.id, date: e.date, endDate: e.endDate,
      kind: e.kind, title: e.title, notes: e.notes,
    })
    const fresh = await fetchEvents(user.id, addDays(todayDay(), -400), addDays(todayDay(), 400))
      .catch(() => null)
    if (Array.isArray(fresh)) setEvents(fresh)
  }, [user])

  /** Move one session to another weekday, in the program itself. */
  const moveSession = useCallback(async (programId: string, index: number, weekday: number) => {
    setMoveTarget(null)
    const prog = programs.find((p) => p.id === programId)
    if (!prog) return
    const structure = JSON.parse(JSON.stringify(prog.structure || {}))
    const sessions = Array.isArray(structure.sessions) ? structure.sessions : []
    if (!sessions[index]) return

    // EVERY session gets a day, not just the moved one.
    //
    // resolveSessionDays only trusts a program where all sessions carry a
    // valid day — a half-set field means something went wrong upstream. So
    // writing a day onto one session of an unassigned program would leave the
    // program in exactly that half-set state, and the whole week would fall
    // back to guessed days the moment the athlete moved anything. Freezing
    // the days they can currently see, then changing the one they moved,
    // makes the move do only what it looks like it does.
    const { days } = resolveSessionDays(sessions, trainingDaysOf(structure))
    sessions.forEach((sess: any, i: number) => {
      sess.day_of_week = i === index ? weekday : days[i]
    })
    structure.training_days = [...new Set(sessions.map((x: any) => x.day_of_week))]
      .sort((a: any, b: any) => a - b)

    tapFeedback()
    const before = programs
    setPrograms((ps) => ps.map((p) => (p.id === programId ? { ...p, structure } : p)))
    try {
      await updateIn('programs', `id=eq.${programId}`, { structure })
    } catch {
      errorFeedback()
      setPrograms(before)
    }
  }, [programs, week, weekStart])

  useEffect(() => { load() }, [load])

  const generate = async () => {
    setError(''); setGenerating(true)
    try {
      const payload = {
        role: 'athlete',
        // The FULL context, not a name and a discipline. `age` and `maturity`
        // are what the backend picks the loading ceiling from — without them
        // every athlete, at any age, got the adult one.
        context: programContext,
        weeks: 4,
        intake: {
          ...intake,
          // In data mode the qualities are the DATA's answer, not the
          // athlete's. Cancelling the intake does not reset it, so a quality
          // picked in an earlier manual run is still sitting in state — and
          // the server falls back to an explicit intake quality when the
          // athlete has no limiter, which would silently resurrect a choice
          // they did not make this time.
          primary_quality: intake.focus_mode === 'data' ? '' : intake.primary_quality,
          secondary_quality: intake.focus_mode === 'data' ? '' : intake.secondary_quality,
          // Sorted ISO weekday numbers. The server binds each session to one
          // of these, so the schedule can show real days rather than a guess.
          training_days: [...new Set(intake.training_days.map(Number))]
            .filter((n) => Number.isInteger(n) && n >= 1 && n <= 7)
            .sort((a, b) => a - b),
          // Still sent, and still derived from the days rather than asked for
          // separately: a backend that predates training_days keeps working
          // unchanged, and the two can never disagree.
          days_per_week: intake.training_days.length || 3,
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
        // The maturity the program was built under, stored with it. A block
        // is only as safe as the stage it was written for, and that stage
        // changes — without this there is no way to tell later whether a
        // plan was appropriate when it was made.
        maturity_context: programContext.maturity
          ? JSON.stringify(programContext.maturity) : null,
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
    // Same construction as Home: the photograph sits BEHIND the scroll view,
    // so the content slides over it rather than dragging it along.
    <View style={{ flex: 1, backgroundColor: BACKDROP_GROUND }}>
      <ScreenBackdrop image="gym" scrollY={scrollY} />
      <SafeAreaView style={{ flex: 1 }} edges={['top', 'left', 'right']}>
      <AppHeader onImage />
      <Animated.ScrollView
        style={{ backgroundColor: 'transparent' }}
        contentContainerStyle={{ padding: spacing.lg, paddingBottom: TAB_BAR_CLEARANCE }}
        showsVerticalScrollIndicator={false}
        scrollEventThrottle={16}
        onScroll={Animated.event(
          [{ nativeEvent: { contentOffset: { y: scrollY } } }],
          { useNativeDriver: true },
        )}
        refreshControl={<RefreshControl refreshing={loading} onRefresh={load} tintColor={colors.accent[500]} />}
      >
        {/* The title block is laid straight on the photograph — no card. The
            image is doing the work a header card used to do. */}
        <View style={{
          flexDirection: 'row', alignItems: 'flex-end',
          justifyContent: 'space-between', gap: 12,
          marginTop: spacing.sm, marginBottom: rhythm.block,
        }}>
          <View style={{ flex: 1 }}>
            <Text style={{
              fontSize: typeScale.hero, fontWeight: weight.bold, letterSpacing: -0.9,
              color: onImage.ink,
            }}>
              Your{'\n'}Schedule
            </Text>
          </View>
          {!showForm && (
            <Tappable
              onPress={() => setShowForm(true)}
              accessibilityLabel="Generate a new program"
              style={{
                flexDirection: 'row', alignItems: 'center', gap: 6,
                paddingHorizontal: 16, minHeight: 44, justifyContent: 'center',
                borderRadius: radius.full, backgroundColor: colors.accent[500],
              }}
            >
              <Ionicons name="sparkles" size={13} color="#FFFFFF" />
              <Text style={{ color: '#FFFFFF', fontSize: typeScale.caption, fontWeight: weight.bold }}>Generate</Text>
            </Tappable>
          )}
        </View>

        {/* ── THE WEEK ─────────────────────────────────────────────
            Its own panel, above the programs. The plan for the month is
            reference material; the plan for today is the screen. */}
        <GlassPanel tone="deep" intensity={24} radius={20} style={{ padding: 18, marginBottom: rhythm.block }}>
          {/* Week for working, month for the season. Both are built from the
              same day cells, so the toggle changes the lens and never the
              facts. */}
          <View style={styles.viewToggle}>
            {(['week', 'month'] as const).map((v) => (
              <Tappable key={v} onPress={() => { tapFeedback(); setView(v) }}
                accessibilityLabel={`${v} view`}
                style={[styles.viewBtn, view === v && {
                  backgroundColor: colors.accent[500] + '2E',
                  borderColor: colors.accent[500] + '73',
                }]}>
                <Text style={{
                  fontSize: typeScale.caption, fontWeight: weight.bold,
                  color: view === v ? colors.accent[500] : colors.text.secondary,
                }}>
                  {v === 'week' ? 'Week' : 'Month'}
                </Text>
              </Tappable>
            ))}
          </View>

          {view === 'week' ? (
            <WeekStrip
              week={week}
              selected={selectedDay}
              onSelect={(d) => { tapFeedback(); setSelectedDay(d) }}
              onPrev={() => goWeek(-1)}
              onNext={() => goWeek(1)}
              onToday={goToday}
            />
          ) : (
            <MonthView
              month={month}
              selected={selectedDay}
              onSelect={(d) => { tapFeedback(); setSelectedDay(d); setWeekStart(mondayOf(d)) }}
              onPrev={() => setMonthStart((m) => shiftMonth(m, -1))}
              onNext={() => setMonthStart((m) => shiftMonth(m, 1))}
              onToday={() => { goToday(); setMonthStart(shiftMonth(todayDay(), 0)) }}
              onAddEvent={() => setAddEventOn(selectedDay)}
            />
          )}

          <View style={{
            height: 1, backgroundColor: colors.glass.divider,
            marginVertical: spacing.lg, marginHorizontal: -18,
          }} />

          {day && (
            <DaySchedule
              day={day}
              onToggleSession={toggleSession}
              busyKey={busyKey}
              onOpenWellness={() => setWellnessOpen(true)}
              onMoveSession={(programId, index) => setMoveTarget({ programId, index })}
              sessionBody={sessionBody}
              loggedCount={loggedCount}
              onLogExercise={(programId, sessionIndex, blockIndex, exerciseIndex) =>
                setLogTarget({ programId, sessionIndex, blockIndex, exerciseIndex })}
              onTrackExercise={(metricKey) =>
                navigation.navigate('Log' as never, { metricKey } as never)}
            />
          )}
        </GlassPanel>

        <SectionLabel color={onImage.dim}>Your programs</SectionLabel>

        <GlassPanel tone="deep" intensity={24} radius={20} style={{ padding: 20 }}>
          {showForm && (
            <IntakeForm
              intake={intake} setIntake={setIntake} generating={generating}
              onGenerate={generate} onCancel={() => { setShowForm(false); setError('') }}
              dataReady={dataReady} dnaSummary={dnaSummary}
            />
          )}

          {!!error && (
            <View style={{ flexDirection: 'row', gap: 8, alignItems: 'flex-start', marginTop: spacing.md }}>
              <Ionicons name="alert-circle" size={15} color={colors.red} style={{ marginTop: 1 }} />
              <Text style={{ color: colors.red, fontSize: typeScale.caption, flex: 1, lineHeight: 17 }}>{error}</Text>
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
                  key={p.id} program={p}
                  open={openId === p.id}
                  onToggle={() => setOpenId(openId === p.id ? null : p.id)}
                  onDelete={() => remove(p.id)}
                  isDone={isDone}
                  onToggleSession={toggleSession}
                  busyKey={busyKey}
                />
              ))}
            </View>
          )}
        </GlassPanel>
      </Animated.ScrollView>

      <WellnessHistorySheet
        visible={wellnessOpen}
        onClose={() => setWellnessOpen(false)}
        checkins={checkins}
      />

      <AddEventSheet
        visible={!!addEventOn}
        day={addEventOn || selectedDay}
        onClose={() => setAddEventOn(null)}
        onSave={addEvent}
      />

      <SetLogger
        visible={!!logTarget}
        onClose={() => setLogTarget(null)}
        blockType={logTarget
          ? (sessionBody(logTarget.programId, logTarget.sessionIndex)
              ?.blocks?.[logTarget.blockIndex]?.type || 'track')
          : 'track'}
        exercise={logTarget
          ? sessionBody(logTarget.programId, logTarget.sessionIndex)
              ?.blocks?.[logTarget.blockIndex]?.exercises?.[logTarget.exerciseIndex]
          : null}
        existing={logTarget
          ? (logsByExercise.get(setLogKey(logTarget.programId, logTarget.sessionIndex,
              logTarget.blockIndex, logTarget.exerciseIndex, dayWeekStart)) || [])
          : []}
        oneRepMaxKg={logTarget
          ? oneRepMaxFor(metricForExercise(
              sessionBody(logTarget.programId, logTarget.sessionIndex)
                ?.blocks?.[logTarget.blockIndex]?.exercises?.[logTarget.exerciseIndex]?.name,
              null)?.metricKey || '')
          : null}
        onSave={saveSets}
      />

      <MoveSessionSheet
        target={moveTarget}
        onClose={() => setMoveTarget(null)}
        onPick={(wd) => moveTarget && moveSession(moveTarget.programId, moveTarget.index, wd)}
      />
      </SafeAreaView>
    </View>
  )
}

// ── Move a session to another day ──────────────────────────────────
// Seven chips, not a date picker: a session belongs to a weekday in the
// program, not to one calendar date. Moving it moves it every week, which is
// what "I train legs on Tuesdays now" actually means.
function MoveSessionSheet({
  target, onClose, onPick,
}: {
  target: { programId: string; index: number } | null
  onClose: () => void
  onPick: (weekday: number) => void
}) {
  const { colors } = useTheme()
  return (
    <Modal visible={!!target} transparent animationType="fade" onRequestClose={onClose}>
      <Tappable onPress={onClose} accessibilityLabel="Close" style={styles.scrim}>
        <View style={[styles.sheet, { backgroundColor: '#141636', borderColor: colors.glass.border }]}>
          <Text style={[styles.sheetTitle, { color: colors.text.primary }]}>Move to</Text>
          <Text style={[styles.sheetHint, { color: colors.text.muted }]}>
            Changes the day this session falls on every week.
          </Text>
          <View style={styles.sheetRow}>
            {WEEKDAY_SHORT.map((d, i) => (
              <Tappable
                key={d}
                onPress={() => onPick(i + 1)}
                accessibilityLabel={d}
                style={[styles.dayChip, { borderColor: colors.glass.border }]}
              >
                <Text style={{ fontSize: typeScale.caption, fontWeight: weight.bold, color: colors.text.primary }}>{d}</Text>
              </Tappable>
            ))}
          </View>
        </View>
      </Tappable>
    </Modal>
  )
}

const styles = StyleSheet.create({
  scrim: {
    flex: 1, backgroundColor: 'rgba(4,5,14,0.72)',
    alignItems: 'center', justifyContent: 'center', padding: spacing.lg,
  },
  sheet: {
    width: '100%', maxWidth: 400, borderRadius: radius.card, borderWidth: 1,
    padding: spacing.lg, gap: 4,
  },
  sheetTitle: { fontSize: typeScale.title, fontWeight: weight.bold, letterSpacing: -0.3 },
  sheetHint: { fontSize: typeScale.caption, lineHeight: 17 },
  sheetRow: { flexDirection: 'row', flexWrap: 'wrap', gap: 8, marginTop: spacing.md },
  viewToggle: { flexDirection: 'row', gap: 6, marginBottom: spacing.md },
  viewBtn: {
    flex: 1, minHeight: 36, alignItems: 'center', justifyContent: 'center',
    borderRadius: radius.control, borderWidth: 1, borderColor: 'rgba(255,255,255,0.16)',
    backgroundColor: 'rgba(255,255,255,0.05)',
  },
  dayChip: {
    minWidth: 44, minHeight: 44, paddingHorizontal: 10,
    alignItems: 'center', justifyContent: 'center',
    borderRadius: radius.control, borderWidth: 1,
    backgroundColor: 'rgba(255,255,255,0.06)',
  },
})
