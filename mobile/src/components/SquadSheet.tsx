// ═══════════════════════════════════════════════════════════════════════
// SQUAD SHEET — create a squad, rename one, or file an athlete into one.
//
// Three jobs in one sheet because they are the same object seen from three
// sides, and three near-identical modals is how a codebase starts to drift.
//
// Deleting a squad ungroups its athletes. It never removes an athlete from
// the roster, and the sheet says so — "delete" next to a list of children is
// a word that needs its consequences spelled out.
// ═══════════════════════════════════════════════════════════════════════

import React, { useState, useEffect } from 'react'
import { View, Text, Modal, TextInput, ScrollView, StyleSheet, ActivityIndicator } from 'react-native'
import { Ionicons } from '@expo/vector-icons'
import { useTheme } from '../contexts/ThemeContext'
import { Tappable, MonoKicker } from './ui'
import { spacing, radius } from '../lib/theme'
import { tapFeedback } from '../lib/haptics'
import type { Squad, SquadAthlete } from '../lib/squads'

export type SquadSheetMode =
  | { kind: 'new' }
  | { kind: 'edit'; squad: Squad }
  | { kind: 'assign'; athlete: SquadAthlete }

export default function SquadSheet({
  mode, visible, squads, onClose, onCreate, onRename, onDelete, onAssign,
}: {
  mode: SquadSheetMode | null
  visible: boolean
  squads: Squad[]
  onClose: () => void
  onCreate: (name: string) => Promise<void>
  onRename: (id: string, name: string) => Promise<void>
  onDelete: (id: string) => Promise<void>
  onAssign: (athlete: SquadAthlete, squadId: string | null) => Promise<void>
}) {
  const { colors } = useTheme()
  const [name, setName] = useState('')
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState('')
  const [confirmDelete, setConfirmDelete] = useState(false)

  // The sheet stays mounted for its slide animation, so last visit's values
  // are still sitting here when it reopens.
  useEffect(() => {
    if (!visible) return
    setName(mode?.kind === 'edit' ? mode.squad.name : '')
    setBusy(false); setError(''); setConfirmDelete(false)
  }, [visible, mode])

  const run = async (fn: () => Promise<void>) => {
    setBusy(true); setError('')
    try { await fn(); onClose() }
    catch (e: any) {
      const raw = e?.message?.replace(/^Supabase \d+:\s*/, '') || ''
      setError(/duplicate|unique/i.test(raw)
        ? 'You already have a squad with that name.'
        : raw || 'Could not save that.')
      setBusy(false)
    }
  }

  const title =
    mode?.kind === 'edit' ? 'Edit squad'
    : mode?.kind === 'assign' ? mode.athlete.name
    : 'New squad'

  const input = {
    backgroundColor: colors.bg.primary, borderWidth: 1, borderColor: colors.glass.border,
    borderRadius: radius.md, paddingHorizontal: 12, minHeight: 48,
    fontSize: 15, color: colors.text.primary,
  }

  return (
    <Modal visible={visible} animationType="slide" presentationStyle="pageSheet" onRequestClose={onClose}>
      <View style={{ flex: 1, backgroundColor: '#0B0C18' }}>
        <View style={{ alignItems: 'center', paddingTop: 10 }}>
          <View style={{ width: 36, height: 4, borderRadius: 2, backgroundColor: 'rgba(255,255,255,0.22)' }} />
        </View>

        <View style={s.header}>
          <View style={{ flex: 1 }}>
            <MonoKicker color={colors.text.muted}>
              {mode?.kind === 'assign' ? 'Which squad?' : 'Squads'}
            </MonoKicker>
            <Text style={[s.title, { color: colors.text.primary }]} numberOfLines={1}>{title}</Text>
          </View>
          <Tappable onPress={onClose} accessibilityLabel="Close" style={s.close}>
            <Ionicons name="close" size={20} color={colors.text.secondary} />
          </Tappable>
        </View>

        <ScrollView contentContainerStyle={{ padding: spacing.lg, paddingTop: 0 }}
          keyboardShouldPersistTaps="handled">

          {!!error && (
            <View style={s.errorRow}>
              <Ionicons name="alert-circle" size={15} color={colors.red} style={{ marginTop: 1 }} />
              <Text style={{ flex: 1, fontSize: 12.5, lineHeight: 18, color: colors.red }}>{error}</Text>
            </View>
          )}

          {mode?.kind === 'assign' ? (
            <>
              <Text style={[s.label, { color: colors.text.muted }]}>
                Filing an athlete only groups them. It changes nothing about their training.
              </Text>
              {squads.map((sq) => {
                const on = mode.athlete.squad_id === sq.id
                return (
                  <Tappable
                    key={sq.id}
                    onPress={() => { tapFeedback(); run(() => onAssign(mode.athlete, sq.id)) }}
                    accessibilityLabel={sq.name}
                    accessibilityState={{ selected: on }}
                    style={[s.pick, {
                      borderColor: on ? colors.accent[500] + '8C' : colors.glass.border,
                      backgroundColor: on ? colors.accent[500] + '1F' : 'transparent',
                    }]}
                  >
                    <Text style={[s.pickText, { color: colors.text.primary }]}>{sq.name}</Text>
                    {on && <Ionicons name="checkmark" size={17} color={colors.accent[500]} />}
                  </Tappable>
                )
              })}
              <Tappable
                onPress={() => { tapFeedback(); run(() => onAssign(mode.athlete, null)) }}
                accessibilityLabel="Remove from every squad"
                style={[s.pick, { borderColor: colors.glass.border }]}
              >
                <Text style={[s.pickText, { color: colors.text.secondary }]}>No squad</Text>
              </Tappable>
              {squads.length === 0 && (
                <Text style={[s.label, { color: colors.text.muted, marginTop: 4 }]}>
                  You haven't made a squad yet. Close this and use the + to make one.
                </Text>
              )}
            </>
          ) : (
            <>
              <Text style={[s.label, { color: colors.text.muted }]}>Name</Text>
              <TextInput
                style={input as any}
                value={name}
                onChangeText={setName}
                placeholder="Sprints, Throws, Tuesday group…"
                placeholderTextColor={colors.text.dimmed}
                keyboardAppearance="dark"
                maxLength={60}
                autoFocus
              />

              <Tappable
                onPress={() => {
                  const t = name.trim()
                  if (!t) { setError('Give the squad a name.'); return }
                  tapFeedback()
                  run(() => mode?.kind === 'edit' ? onRename(mode.squad.id, t) : onCreate(t))
                }}
                accessibilityLabel={mode?.kind === 'edit' ? 'Save squad name' : 'Create squad'}
                style={[s.primary, { backgroundColor: colors.accent[500] }]}
              >
                {busy
                  ? <ActivityIndicator color="#FFFFFF" size="small" />
                  : <Text style={s.primaryText}>{mode?.kind === 'edit' ? 'Save' : 'Create squad'}</Text>}
              </Tappable>

              {mode?.kind === 'edit' && (
                <Tappable
                  onPress={() => {
                    tapFeedback()
                    if (!confirmDelete) { setConfirmDelete(true); return }
                    run(() => onDelete(mode.squad.id))
                  }}
                  accessibilityLabel={confirmDelete ? 'Confirm delete squad' : 'Delete squad'}
                  style={[s.danger, { borderColor: colors.red + '5C' }]}
                >
                  <Text style={{ fontSize: 13.5, fontWeight: '700', color: colors.red }}>
                    {confirmDelete ? 'Tap again to delete' : 'Delete squad'}
                  </Text>
                </Tappable>
              )}
              {mode?.kind === 'edit' && (
                <Text style={[s.label, { color: colors.text.muted, marginTop: 10 }]}>
                  Deleting a squad ungroups the athletes in it. Nobody is removed from your roster.
                </Text>
              )}
            </>
          )}
        </ScrollView>
      </View>
    </Modal>
  )
}

const s = StyleSheet.create({
  header: {
    flexDirection: 'row', alignItems: 'flex-end',
    paddingHorizontal: spacing.lg, paddingTop: 12, paddingBottom: 14, gap: 12,
  },
  title: { fontSize: 24, fontWeight: '700', letterSpacing: -0.5, marginTop: 4 },
  close: { width: 36, height: 36, borderRadius: 18, alignItems: 'center', justifyContent: 'center' },
  label: { fontSize: 12.5, lineHeight: 18, marginBottom: 8, marginTop: 14 },
  errorRow: { flexDirection: 'row', gap: 7, marginTop: 12 },
  primary: {
    minHeight: 48, borderRadius: radius.md, marginTop: 18,
    alignItems: 'center', justifyContent: 'center',
  },
  primaryText: { color: '#FFFFFF', fontSize: 14.5, fontWeight: '700' },
  danger: {
    minHeight: 44, borderRadius: radius.md, borderWidth: 1, marginTop: 12,
    alignItems: 'center', justifyContent: 'center',
  },
  pick: {
    minHeight: 50, borderRadius: radius.md, borderWidth: 1,
    paddingHorizontal: 14, marginTop: 8,
    flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between',
  },
  pickText: { fontSize: 15, fontWeight: '600' },
})
