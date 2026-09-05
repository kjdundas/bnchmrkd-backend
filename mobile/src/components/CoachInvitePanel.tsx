// ═══════════════════════════════════════════════════════════════════════
// COACH INVITE PANEL (mobile) — Phase A · A5
// Invite an athlete by email; manage pending invites + linked athletes.
// Backed by invite_athlete / revoke_link / get_my_links RPCs.
//
// ── WHY THIS ROOT IS BOUNDED ───────────────────────────────────────────
// The sheet that hosts this panel is sized by its content (maxHeight 80%,
// no height, no flex). A ScrollView has no intrinsic height — it takes one
// from its parent — so a ScrollView inside a content-sized parent measures
// ZERO, and the host wrapped this in `flex: 1`, which contributes nothing
// inside a content-sized parent either. Both agreed the answer was nought.
//
// The result was a sheet that opened to its title bar and nothing else:
// tapping "Invite Athlete" showed a header, an X, and empty space. The
// whole coach-side invite flow was unreachable, on a screen whose sibling
// branch ("Manual Entry") worked because it sizes to its content.
//
// A definite bound fixes it: the panel takes what its content needs, up to
// a share of the screen, and scrolls past that.
// ═══════════════════════════════════════════════════════════════════════
import React, { useState, useEffect, useCallback } from 'react'
import {
  View,
  Text,
  TextInput,
  ActivityIndicator,
  ScrollView,
  StyleSheet,
  Dimensions,
} from 'react-native'
import { Ionicons } from '@expo/vector-icons'
import { colors, spacing, radius, typeScale, weight } from '../lib/theme'
import { callRpc } from '../lib/supabase'
import { Tappable } from './ui'

interface Link {
  link_id: string
  status: string
  counterparty_name: string | null
  invite_email: string | null
  invite_token: string | null
}

export default function CoachInvitePanel() {
  const [email, setEmail] = useState('')
  const [sending, setSending] = useState(false)
  const [error, setError] = useState('')
  const [result, setResult] = useState<any>(null)
  const [links, setLinks] = useState<Link[]>([])

  const load = useCallback(async () => {
    try {
      const rows = await callRpc('get_my_links')
      setLinks(Array.isArray(rows) ? rows : [])
    } catch { setLinks([]) }
  }, [])

  useEffect(() => { load() }, [load])

  const send = async () => {
    const e = email.trim()
    if (!/^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(e)) { setError('Enter a valid email address.'); return }
    setError(''); setResult(null); setSending(true)
    try {
      const res = await callRpc('invite_athlete', { p_email: e })
      setResult(Array.isArray(res) ? res[0] : res)
      setEmail('')
      load()
    } catch (err: any) {
      setError(err.message?.replace(/^rpc \w+ failed: \d+\s*/, '') || 'Could not send invite.')
    } finally { setSending(false) }
  }

  const revoke = async (id: string) => {
    try { await callRpc('revoke_link', { p_link_id: id }); load() } catch { /* ignore */ }
  }

  const pending = links.filter((l) => l.status === 'pending')
  const active = links.filter((l) => l.status === 'active')

  return (
    <ScrollView style={styles.wrap} showsVerticalScrollIndicator={false}>
      <Text style={styles.intro}>
        Send a link request to an athlete's account. They approve before you can see their data — and can revoke anytime.
      </Text>

      <Text style={styles.label}>ATHLETE EMAIL</Text>
      <View style={styles.row}>
        <TextInput
          style={styles.input} value={email} onChangeText={setEmail}
          placeholder="athlete@email.com" placeholderTextColor={colors.text.dimmed}
          autoCapitalize="none" keyboardType="email-address" autoCorrect={false}
        />
        <Tappable style={styles.sendBtn} onPress={send} disabled={sending}>
          {sending ? <ActivityIndicator size="small" color="#000" /> : <Text style={styles.sendText}>Send</Text>}
        </Tappable>
      </View>

      {error !== '' && <Text style={styles.error}>{error}</Text>}

      {result?.delivery === 'in_app' && (
        <Text style={styles.ok}>✓ Invite sent — they'll see a request in their app to approve.</Text>
      )}
      {result?.delivery === 'share_link' && result?.invite_token && (
        <View style={styles.shareBox}>
          {/* The CODE, not the URL. This used to offer only
              https://bnchmrkd.app/?invite=<token> — a domain that resolves to
              nothing, on an app with no deep-link handler, carrying a token
              that `claim_invite` could redeem but which nothing in the app
              ever called. Every invite to someone without an account died
              here. The athlete now pastes this into Profile → Your coaches. */}
          <Text style={styles.shareLabel}>
            No account with that email yet. Send them this code — they sign up,
            then paste it under "Your coaches" on their Profile.
          </Text>
          <Text selectable style={styles.shareCode}>{result.invite_token}</Text>
          <Text style={styles.shareHint}>Long-press to copy. The invite waits until they use it.</Text>
        </View>
      )}
      {result?.result === 'already' && <Text style={styles.muted}>That athlete is already invited or linked.</Text>}

      {pending.length > 0 && (
        <View style={styles.section}>
          <Text style={styles.sectionKicker}>PENDING INVITES</Text>
          {pending.map((l) => (
            <View key={l.link_id} style={styles.item}>
              <Ionicons name="time-outline" size={15} color={colors.amber} />
              <Text style={styles.itemName} numberOfLines={1}>{l.counterparty_name || l.invite_email}</Text>
              <Tappable onPress={() => revoke(l.link_id)}><Text style={styles.action}>Cancel</Text></Tappable>
            </View>
          ))}
        </View>
      )}

      {active.length > 0 && (
        <View style={styles.section}>
          <Text style={styles.sectionKicker}>LINKED ATHLETES</Text>
          {active.map((l) => (
            <View key={l.link_id} style={styles.item}>
              <Ionicons name="checkmark-circle-outline" size={15} color={colors.green} />
              <Text style={styles.itemName} numberOfLines={1}>{l.counterparty_name || l.invite_email}</Text>
              <Tappable onPress={() => revoke(l.link_id)}><Text style={styles.action}>Unlink</Text></Tappable>
            </View>
          ))}
        </View>
      )}
    </ScrollView>
  )
}

const styles = StyleSheet.create({
  wrap: { paddingHorizontal: spacing.lg, maxHeight: Dimensions.get('window').height * 0.58 },
  intro: { color: colors.text.muted, fontSize: typeScale.caption, lineHeight: 17, marginBottom: spacing.lg },
  label: { color: colors.text.muted, fontSize: typeScale.label, fontWeight: weight.bold, letterSpacing: 1.5, marginBottom: 6 },
  row: { flexDirection: 'row', gap: 8 },
  input: {
    flex: 1, backgroundColor: 'rgba(255,255,255,0.03)', borderWidth: 1, borderColor: 'rgba(255,255,255,0.08)',
    borderRadius: radius.control, paddingHorizontal: spacing.md, paddingVertical: 11, color: colors.text.primary, fontSize: typeScale.body,
  },
  sendBtn: { backgroundColor: colors.orange[500], borderRadius: radius.control, paddingHorizontal: 18, alignItems: 'center', justifyContent: 'center', minWidth: 64 },
  sendText: { color: '#000', fontSize: typeScale.caption, fontWeight: weight.bold },
  error: { color: colors.red, fontSize: typeScale.caption, marginTop: spacing.sm },
  ok: { color: colors.green, fontSize: typeScale.caption, marginTop: spacing.sm, lineHeight: 17 },
  muted: { color: colors.text.muted, fontSize: typeScale.caption, marginTop: spacing.sm },
  shareBox: { marginTop: spacing.md, backgroundColor: 'rgba(59,130,246,0.06)', borderWidth: 1, borderColor: 'rgba(59,130,246,0.2)', borderRadius: radius.control, padding: spacing.md },
  shareLabel: { color: colors.text.secondary, fontSize: typeScale.label, marginBottom: 6 },
  shareCode: {
    color: colors.text.primary, fontSize: typeScale.body, fontWeight: weight.bold,
    letterSpacing: 0.5, marginTop: 6,
  },
  shareHint: { color: colors.text.muted, fontSize: typeScale.caption, marginTop: 6 },
  section: { marginTop: spacing.xl },
  sectionKicker: { color: colors.text.dimmed, fontSize: typeScale.label, fontWeight: weight.bold, letterSpacing: 1.5, marginBottom: spacing.sm },
  item: {
    flexDirection: 'row', alignItems: 'center', gap: 8,
    backgroundColor: 'rgba(255,255,255,0.02)', borderRadius: radius.control, paddingHorizontal: spacing.md, paddingVertical: 10, marginBottom: 6,
  },
  itemName: { flex: 1, color: colors.text.primary, fontSize: typeScale.caption },
  action: { color: colors.text.muted, fontSize: typeScale.label, fontWeight: weight.medium },
})
