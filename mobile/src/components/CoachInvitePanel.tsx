// ═══════════════════════════════════════════════════════════════════════
// COACH INVITE PANEL (mobile) — Phase A · A5
// Invite an athlete by email; manage pending invites + linked athletes.
// Backed by invite_athlete / revoke_link / get_my_links RPCs.
// ═══════════════════════════════════════════════════════════════════════
import React, { useState, useEffect, useCallback } from 'react'
import { View, Text, TextInput, TouchableOpacity, ActivityIndicator, ScrollView, StyleSheet } from 'react-native'
import { Ionicons } from '@expo/vector-icons'
import { colors, spacing, radius } from '../lib/theme'
import { callRpc } from '../lib/supabase'

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

  const shareLink = result?.invite_token ? `https://bnchmrkd.app/?invite=${result.invite_token}` : null
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
        <TouchableOpacity style={styles.sendBtn} onPress={send} disabled={sending} activeOpacity={0.85}>
          {sending ? <ActivityIndicator size="small" color="#000" /> : <Text style={styles.sendText}>Send</Text>}
        </TouchableOpacity>
      </View>

      {error !== '' && <Text style={styles.error}>{error}</Text>}

      {result?.delivery === 'in_app' && (
        <Text style={styles.ok}>✓ Invite sent — they'll see a request in their app to approve.</Text>
      )}
      {result?.delivery === 'share_link' && shareLink && (
        <View style={styles.shareBox}>
          <Text style={styles.shareLabel}>No account found — share this sign-up link (long-press to copy):</Text>
          <Text selectable style={styles.shareLink}>{shareLink}</Text>
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
              <TouchableOpacity onPress={() => revoke(l.link_id)}><Text style={styles.action}>Cancel</Text></TouchableOpacity>
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
              <TouchableOpacity onPress={() => revoke(l.link_id)}><Text style={styles.action}>Unlink</Text></TouchableOpacity>
            </View>
          ))}
        </View>
      )}
    </ScrollView>
  )
}

const styles = StyleSheet.create({
  wrap: { paddingHorizontal: spacing.lg },
  intro: { color: colors.text.muted, fontSize: 12, lineHeight: 17, marginBottom: spacing.lg },
  label: { color: colors.text.muted, fontSize: 10, fontWeight: '700', letterSpacing: 1.5, marginBottom: 6 },
  row: { flexDirection: 'row', gap: 8 },
  input: {
    flex: 1, backgroundColor: 'rgba(255,255,255,0.03)', borderWidth: 1, borderColor: 'rgba(255,255,255,0.08)',
    borderRadius: radius.md, paddingHorizontal: spacing.md, paddingVertical: 11, color: colors.text.primary, fontSize: 14,
  },
  sendBtn: { backgroundColor: colors.orange[500], borderRadius: radius.md, paddingHorizontal: 18, alignItems: 'center', justifyContent: 'center', minWidth: 64 },
  sendText: { color: '#000', fontSize: 13, fontWeight: '700' },
  error: { color: colors.red, fontSize: 12, marginTop: spacing.sm },
  ok: { color: colors.green, fontSize: 12, marginTop: spacing.sm, lineHeight: 17 },
  muted: { color: colors.text.muted, fontSize: 12, marginTop: spacing.sm },
  shareBox: { marginTop: spacing.md, backgroundColor: 'rgba(59,130,246,0.06)', borderWidth: 1, borderColor: 'rgba(59,130,246,0.2)', borderRadius: radius.md, padding: spacing.md },
  shareLabel: { color: colors.text.secondary, fontSize: 11, marginBottom: 6 },
  shareLink: { color: colors.blue, fontSize: 12 },
  section: { marginTop: spacing.xl },
  sectionKicker: { color: colors.text.dimmed, fontSize: 10, fontWeight: '700', letterSpacing: 1.5, marginBottom: spacing.sm },
  item: {
    flexDirection: 'row', alignItems: 'center', gap: 8,
    backgroundColor: 'rgba(255,255,255,0.02)', borderRadius: radius.md, paddingHorizontal: spacing.md, paddingVertical: 10, marginBottom: 6,
  },
  itemName: { flex: 1, color: colors.text.primary, fontSize: 13 },
  action: { color: colors.text.muted, fontSize: 11, fontWeight: '600' },
})
