// ═══════════════════════════════════════════════════════════════════════
// ASSISTANT COACH — a box that starts the job, not a chatbot.
//
// An empty text field is the worst thing to hand a coach, because it makes
// them guess what the thing can do. So the default state is a set of jobs —
// write a program, put a race in the calendar, tell me who has gone
// backwards — and typing is the escape hatch rather than the entry point.
//
// The actions split in two, and the split is deliberate:
//
//   ROUTES  open the screen that already does the job properly, with the
//           right athletes pre-selected. Assigning a program is a real
//           object with a safety validator behind it; a chat reply is not
//           the place to conjure one.
//   ASKS    go to the assistant and come back as an answer. These are the
//           read-only ones — trends, comparisons, who has not logged.
//
// The model cannot yet WRITE anything on an athlete's behalf. When it can,
// the rule is that every write comes back as a proposal the coach confirms:
// two gates between a misheard number and a child's permanent record.
// ═══════════════════════════════════════════════════════════════════════

import React, { useState } from 'react'
import { View, Text, TextInput, StyleSheet, ActivityIndicator } from 'react-native'
import { Ionicons } from '@expo/vector-icons'
import { useTheme } from '../contexts/ThemeContext'
import { Tappable, MonoKicker } from './ui'
import { spacing, radius, onImage } from '../lib/theme'
import { tapFeedback } from '../lib/haptics'
import { askAssistant } from '../lib/api'

export type CoachAction =
  | { kind: 'route'; label: string; icon: string; to: 'assign-program' | 'assign-event' | 'assign-result' }
  | { kind: 'ask'; label: string; icon: string; prompt: string }

/** What a coach actually opens this for, in rough order of frequency. */
export const COACH_ACTIONS: CoachAction[] = [
  { kind: 'route', label: 'Set a program', icon: 'barbell-outline', to: 'assign-program' },
  { kind: 'route', label: 'Add an event', icon: 'calendar-outline', to: 'assign-event' },
  { kind: 'route', label: 'Record a result', icon: 'stopwatch-outline', to: 'assign-result' },
  {
    kind: 'ask', label: "Who's gone backwards?", icon: 'trending-down-outline',
    prompt: 'Which athletes in my squad have gone backwards over their last few results, and by how much?',
  },
  {
    kind: 'ask', label: 'Spot a trend', icon: 'pulse-outline',
    prompt: 'What patterns can you see across my squad — who is improving, who has plateaued, and what would you look at first?',
  },
  {
    kind: 'ask', label: 'Who needs a check-in?', icon: 'help-circle-outline',
    prompt: 'Who in my squad has not logged a check-in or a result recently, and who should I speak to first?',
  },
]

export default function AssistantCoachBox({
  context, onRoute,
}: {
  /** The squad as it is on screen, so an answer is about who you can see. */
  context: any
  onRoute: (to: 'assign-program' | 'assign-event' | 'assign-result') => void
}) {
  const { colors } = useTheme()
  const [text, setText] = useState('')
  const [busy, setBusy] = useState(false)
  const [answer, setAnswer] = useState('')
  const [error, setError] = useState('')

  const ask = async (question: string) => {
    const q = question.trim()
    if (!q) return
    setBusy(true); setError(''); setAnswer('')
    try {
      setAnswer(await askAssistant({ role: 'coach', question: q, context }))
      setText('')
    } catch (e: any) {
      setError(
        e?.message?.replace(/^Supabase \d+:\s*/, '')
        || 'Could not reach the assistant.',
      )
    } finally {
      setBusy(false)
    }
  }

  return (
    <View style={s.wrap}>
      <View style={s.head}>
        <Ionicons name="sparkles" size={13} color={colors.accent[500]} />
        <MonoKicker color={onImage.muted}>Assistant coach</MonoKicker>
      </View>

      <View style={s.chips}>
        {COACH_ACTIONS.map((a) => (
          <Tappable
            key={a.label}
            onPress={() => {
              tapFeedback()
              if (a.kind === 'route') onRoute(a.to)
              else ask(a.prompt)
            }}
            accessibilityLabel={a.label}
            style={[s.chip, a.kind === 'route' && {
              borderColor: colors.accent[500] + '5C',
              backgroundColor: colors.accent[500] + '1A',
            }]}
          >
            <Ionicons
              name={a.icon as any} size={13}
              color={a.kind === 'route' ? colors.accent[500] : onImage.muted} />
            <Text style={[s.chipText, a.kind === 'route' && { color: '#FFFFFF' }]}>{a.label}</Text>
          </Tappable>
        ))}
      </View>

      <View style={s.inputRow}>
        <TextInput
          style={s.input}
          value={text}
          onChangeText={setText}
          placeholder="Or ask about anyone in your squad…"
          placeholderTextColor="rgba(255,255,255,0.38)"
          keyboardAppearance="dark"
          multiline
          maxLength={500}
          onSubmitEditing={() => ask(text)}
        />
        <Tappable
          onPress={() => ask(text)}
          accessibilityLabel="Ask"
          style={[s.send, {
            backgroundColor: text.trim() ? colors.accent[500] : 'rgba(255,255,255,0.12)',
          }]}
        >
          {busy
            ? <ActivityIndicator color="#FFFFFF" size="small" />
            : <Ionicons name="arrow-up" size={17} color="#FFFFFF" />}
        </Tappable>
      </View>

      {!!error && (
        <View style={s.msgRow}>
          <Ionicons name="alert-circle" size={14} color={colors.red} style={{ marginTop: 1 }} />
          <Text style={[s.msg, { color: colors.red }]}>{error}</Text>
        </View>
      )}

      {!!answer && (
        <View style={s.answer}>
          <Text style={s.answerText}>{answer}</Text>
          <Text style={s.answerFoot}>
            It can read your squad but cannot change anything yet — use the
            actions above to assign.
          </Text>
        </View>
      )}
    </View>
  )
}

const s = StyleSheet.create({
  wrap: {
    marginHorizontal: spacing.lg, marginTop: 22,
    padding: 14, borderRadius: radius.lg, borderWidth: 1,
    borderColor: onImage.cardBorder, backgroundColor: onImage.card,
  },
  head: { flexDirection: 'row', alignItems: 'center', gap: 7, marginBottom: 12 },
  chips: { flexDirection: 'row', flexWrap: 'wrap', gap: 7 },
  chip: {
    flexDirection: 'row', alignItems: 'center', gap: 6,
    minHeight: 34, paddingHorizontal: 11,
    borderRadius: radius.full, borderWidth: 1,
    borderColor: onImage.cardBorder,
  },
  chipText: { color: onImage.muted, fontSize: 12.5, fontWeight: '600' },
  inputRow: { flexDirection: 'row', alignItems: 'flex-end', gap: 8, marginTop: 12 },
  input: {
    flex: 1, minHeight: 44, maxHeight: 120, paddingHorizontal: 12, paddingTop: 12,
    paddingBottom: 10, borderRadius: radius.md, borderWidth: 1,
    borderColor: onImage.cardBorder, backgroundColor: 'rgba(255,255,255,0.06)',
    color: onImage.ink, fontSize: 14.5, textAlignVertical: 'top',
  },
  send: {
    width: 44, height: 44, borderRadius: 22,
    alignItems: 'center', justifyContent: 'center',
  },
  msgRow: { flexDirection: 'row', gap: 7, marginTop: 10 },
  msg: { flex: 1, fontSize: 12.5, lineHeight: 18 },
  answer: {
    marginTop: 12, paddingTop: 12,
    borderTopWidth: 1, borderTopColor: onImage.divider,
  },
  answerText: { color: onImage.ink, fontSize: 14, lineHeight: 21 },
  answerFoot: { color: onImage.dim, fontSize: 11, lineHeight: 16, marginTop: 10 },
})
