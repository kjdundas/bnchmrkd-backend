// ═══════════════════════════════════════════════════════════════════════
// APPROVAL INBOX — everything waiting on your answer, either direction.
//
// The same component serves both sides. An athlete accepting a coach's
// training block and a coach approving an athlete's race result are the same
// act with the roles swapped, so they get one list, one vocabulary and one
// pair of buttons. What changes is the sentence above them, which says what
// saying yes actually DOES — "Accept" alone tells you nothing about whether
// six sessions are about to appear in your week.
//
// Declining asks for a reason and keeps the record. "No, not depth jumps
// three days out from a race" is the coaching, and deleting the row would
// throw it away along with the disagreement.
// ═══════════════════════════════════════════════════════════════════════

import React, { useState, useEffect, useCallback } from 'react'
import {
  View, Text, Modal, ScrollView, TextInput, StyleSheet, ActivityIndicator,
} from 'react-native'
import { Ionicons } from '@expo/vector-icons'
import { useTheme } from '../contexts/ThemeContext'
import { Tappable, MonoKicker } from './ui'
import { spacing, radius, onImage, typeScale, weight } from '../lib/theme'
import { tapFeedback } from '../lib/haptics'
import {
  fetchPendingFor, respond, KIND_LABEL, KIND_ICON, consequenceOf,
  type PendingItem,
} from '../lib/approvals'

// ── The banner, for the top of Home ────────────────────────────────────
export function ApprovalBanner({
  count, onPress,
}: { count: number; onPress: () => void }) {
  const { colors } = useTheme()
  if (count < 1) return null
  return (
    <Tappable
      onPress={onPress}
      accessibilityLabel={`${count} ${count === 1 ? 'item' : 'items'} waiting for your answer`}
      style={{
        flexDirection: 'row', alignItems: 'center', gap: 12,
        paddingHorizontal: 16, paddingVertical: 14, marginBottom: spacing.md,
        borderRadius: radius.card, borderWidth: 1,
        borderColor: colors.accent[500] + '5C',
        backgroundColor: colors.accent[500] + '1F',
      }}
    >
      <View style={{
        width: 30, height: 30, borderRadius: radius.full, alignItems: 'center', justifyContent: 'center',
        backgroundColor: colors.accent[500],
      }}>
        <Text style={{ color: '#FFFFFF', fontSize: typeScale.caption, fontWeight: weight.bold }}>{count}</Text>
      </View>
      <View style={{ flex: 1 }}>
        <Text style={{ color: onImage.ink, fontSize: typeScale.body, fontWeight: weight.bold }}>
          {count === 1 ? 'One thing needs your answer' : `${count} things need your answer`}
        </Text>
        <Text style={{ color: onImage.muted, fontSize: typeScale.caption, marginTop: 1 }}>
          Nothing takes effect until you decide.
        </Text>
      </View>
      <Ionicons name="chevron-forward" size={17} color={onImage.muted} />
    </Tappable>
  )
}

// ── The sheet ──────────────────────────────────────────────────────────
export default function ApprovalInbox({
  visible, userId, onClose, onChanged,
}: {
  visible: boolean
  userId?: string | null
  onClose: () => void
  /** Fired after any answer, so the screen behind can refetch. */
  onChanged?: () => void
}) {
  const { colors } = useTheme()
  const [items, setItems] = useState<PendingItem[]>([])
  const [loading, setLoading] = useState(true)
  const [busyId, setBusyId] = useState<string | null>(null)
  const [decliningId, setDecliningId] = useState<string | null>(null)
  const [note, setNote] = useState('')
  const [error, setError] = useState('')

  const load = useCallback(async () => {
    if (!userId) { setItems([]); setLoading(false); return }
    setLoading(true)
    try {
      setItems(await fetchPendingFor(userId))
      setError('')
    } catch (e: any) {
      setError(e?.message?.replace(/^Supabase \d+:\s*/, '') || 'Could not load these.')
    } finally {
      setLoading(false)
    }
  }, [userId])

  useEffect(() => {
    if (!visible) return
    setDecliningId(null); setNote(''); setError('')
    load()
  }, [visible, load])

  const answer = async (item: PendingItem, decision: 'accepted' | 'declined') => {
    tapFeedback()
    setBusyId(item.id)
    try {
      await respond(item.kind, item.id, decision, decision === 'declined' ? note : undefined)
      // Drop it from the list rather than refetching the whole view — the
      // answer is already committed, and a spinner over a list that is about
      // to lose one row reads as a stall.
      setItems((prev) => prev.filter((x) => x.id !== item.id))
      setDecliningId(null); setNote(''); setError('')
      onChanged?.()
    } catch (e: any) {
      const raw = e?.message?.replace(/^Supabase \d+:\s*/, '') || ''
      setError(
        /not yours/i.test(raw) ? 'That one is not yours to answer.'
        : /already/i.test(raw) ? 'Someone already answered that one.'
        : raw || 'Could not save that answer.',
      )
      if (/already|not yours/i.test(raw)) load()
    } finally {
      setBusyId(null)
    }
  }

  return (
    <Modal visible={visible} animationType="slide" presentationStyle="pageSheet" onRequestClose={onClose}>
      <View style={{ flex: 1, backgroundColor: '#0B0C18' }}>
        <View style={{ alignItems: 'center', paddingTop: 10 }}>
          <View style={{ width: 36, height: 4, borderRadius: radius.full, backgroundColor: 'rgba(255,255,255,0.22)' }} />
        </View>

        <View style={s.header}>
          <View style={{ flex: 1 }}>
            <MonoKicker color={colors.text.muted}>Waiting on you</MonoKicker>
            <Text style={[s.title, { color: colors.text.primary }]}>Your inbox</Text>
          </View>
          <Tappable onPress={onClose} accessibilityLabel="Close" style={s.close}>
            <Ionicons name="close" size={20} color={colors.text.secondary} />
          </Tappable>
        </View>

        {!!error && (
          <Text style={[s.error, { color: colors.red }]}>{error}</Text>
        )}

        {loading ? (
          <View style={{ paddingTop: 60, alignItems: 'center' }}>
            <ActivityIndicator color={colors.accent[500]} />
          </View>
        ) : items.length === 0 ? (
          <View style={{ paddingTop: 56, paddingHorizontal: spacing.lg, alignItems: 'center' }}>
            <Ionicons name="checkmark-done-outline" size={30} color={colors.text.muted} />
            <Text style={[s.emptyTitle, { color: colors.text.primary }]}>Nothing waiting</Text>
            <Text style={[s.emptyBody, { color: colors.text.muted }]}>
              Anything sent to you — a training block, a race day, a result to approve — turns up here first.
            </Text>
          </View>
        ) : (
          <ScrollView
            contentContainerStyle={{ padding: spacing.lg, paddingTop: 4, gap: 12 }}
            keyboardShouldPersistTaps="handled"
          >
            {items.map((item) => {
              const owedByAthlete = !!item.owed_by_athlete
              const busy = busyId === item.id
              const declining = decliningId === item.id
              return (
                <View key={item.id} style={[s.card, { borderColor: colors.glass.border }]}>
                  <View style={s.cardHead}>
                    <Ionicons
                      name={KIND_ICON[item.kind] as any}
                      size={15}
                      color={colors.accent[500]}
                    />
                    <MonoKicker color={colors.text.muted}>{KIND_LABEL[item.kind]}</MonoKicker>
                  </View>

                  <Text style={[s.cardTitle, { color: colors.text.primary }]} numberOfLines={2}>
                    {item.title || 'Untitled'}
                  </Text>
                  {!!item.detail && (
                    <Text style={[s.cardDetail, { color: colors.text.secondary }]} numberOfLines={2}>
                      {item.detail}
                    </Text>
                  )}

                  <Text style={[s.consequence, { color: colors.text.muted }]}>
                    {consequenceOf(item.kind, owedByAthlete)}
                  </Text>

                  {declining && (
                    <TextInput
                      style={[s.noteInput, {
                        backgroundColor: colors.bg.primary,
                        borderColor: colors.glass.border,
                        color: colors.text.primary,
                      }]}
                      value={note}
                      onChangeText={setNote}
                      placeholder="Why? They'll see this."
                      placeholderTextColor={colors.text.dimmed}
                      keyboardAppearance="dark"
                      maxLength={280}
                      multiline
                      autoFocus
                    />
                  )}

                  <View style={s.actions}>
                    <Tappable
                      onPress={() => {
                        if (declining) { answer(item, 'declined') }
                        else { tapFeedback(); setDecliningId(item.id); setNote(''); setError('') }
                      }}
                      accessibilityLabel={declining ? 'Confirm decline' : 'Decline'}
                      style={[s.btn, { borderWidth: 1, borderColor: colors.glass.border }]}
                    >
                      <Text style={[s.btnText, { color: colors.text.secondary }]}>
                        {declining ? 'Send decline' : 'Decline'}
                      </Text>
                    </Tappable>

                    {declining ? (
                      <Tappable
                        onPress={() => { tapFeedback(); setDecliningId(null); setNote('') }}
                        accessibilityLabel="Cancel"
                        style={[s.btn, { flex: 1, borderWidth: 1, borderColor: colors.glass.border }]}
                      >
                        <Text style={[s.btnText, { color: colors.text.secondary }]}>Cancel</Text>
                      </Tappable>
                    ) : (
                      <Tappable
                        onPress={() => answer(item, 'accepted')}
                        accessibilityLabel={owedByAthlete ? 'Accept' : 'Approve'}
                        style={[s.btn, { flex: 1, backgroundColor: colors.accent[500] }]}
                      >
                        {busy ? (
                          <ActivityIndicator color="#FFFFFF" size="small" />
                        ) : (
                          <Text style={[s.btnText, { color: '#FFFFFF' }]}>
                            {owedByAthlete ? 'Accept' : 'Approve'}
                          </Text>
                        )}
                      </Tappable>
                    )}
                  </View>
                </View>
              )
            })}
          </ScrollView>
        )}
      </View>
    </Modal>
  )
}

const s = StyleSheet.create({
  header: {
    flexDirection: 'row', alignItems: 'flex-end',
    paddingHorizontal: spacing.lg, paddingTop: 12, paddingBottom: 14, gap: 12,
  },
  title: { fontSize: typeScale.figure, fontWeight: weight.bold, letterSpacing: -0.6, marginTop: 4 },
  close: {
    width: 36, height: 36, borderRadius: radius.full,
    alignItems: 'center', justifyContent: 'center',
  },
  error: { fontSize: typeScale.caption, paddingHorizontal: spacing.lg, paddingBottom: 8 },
  emptyTitle: { fontSize: typeScale.title, fontWeight: weight.bold, marginTop: 12 },
  emptyBody: { fontSize: typeScale.body, lineHeight: 20, textAlign: 'center', marginTop: 6, maxWidth: 320 },
  card: {
    borderWidth: 1, borderRadius: radius.card, padding: 16,
    backgroundColor: 'rgba(255,255,255,0.04)',
  },
  cardHead: { flexDirection: 'row', alignItems: 'center', gap: 7, marginBottom: 8 },
  cardTitle: { fontSize: typeScale.body, fontWeight: weight.bold, letterSpacing: -0.2 },
  cardDetail: { fontSize: typeScale.caption, marginTop: 3 },
  consequence: { fontSize: typeScale.caption, lineHeight: 17, marginTop: 10 },
  noteInput: {
    borderWidth: 1, borderRadius: radius.control, padding: 12, marginTop: 12,
    fontSize: typeScale.body, minHeight: 72, textAlignVertical: 'top',
  },
  actions: { flexDirection: 'row', gap: 10, marginTop: 14 },
  btn: {
    minHeight: 44, borderRadius: radius.control, paddingHorizontal: 18,
    alignItems: 'center', justifyContent: 'center',
  },
  btnText: { fontSize: typeScale.body, fontWeight: weight.bold },
})
