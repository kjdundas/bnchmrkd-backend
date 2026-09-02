// ═══════════════════════════════════════════════════════════════════════
// COACH ↔ ATHLETE LINKS (mobile)
// Pending invites (approve / decline) + active links (revoke).
// Backed by get_my_links / respond_to_invite / revoke_link RPCs.
//   pendingOnly — render only pending invites (or null if none). Home prompt.
//
// ONE link, TWO sides. get_my_links returns the same row to both parties and
// names the other one, so a coach opening their profile was reading their own
// athletes under the heading "Your coaches" — the component knew the data and
// not the reader. Every word that depends on which end you are standing at
// now comes from `role`.
// ═══════════════════════════════════════════════════════════════════════
import React, { useState, useEffect, useCallback } from 'react'
import { View, Text, TouchableOpacity, ActivityIndicator, StyleSheet } from 'react-native'
import { Ionicons } from '@expo/vector-icons'
import { colors, spacing, radius } from '../lib/theme'
import { callRpc } from '../lib/supabase'
import { useAuth } from '../contexts/AuthContext'

interface Link {
  link_id: string
  status: string
  counterparty_name: string | null
  counterparty_org: string | null
  invite_email: string | null
}

export default function AthleteCoachLinks({ pendingOnly = false }: { pendingOnly?: boolean }) {
  const { profile } = useAuth()
  const isCoach = profile?.role === 'coach' || (profile as any)?.account_type === 'coach'

  // The same row, said from whichever end the reader is standing at.
  const W = isCoach ? {
    heading: 'Your athletes',
    icon: 'people-outline',
    fallbackName: 'Athlete',
    empty: 'No athletes connected yet. Invite one and they will appear here once they accept.',
    action: 'Remove',
    foot: 'Athletes you are linked to share their results with you. Removing one cuts your access to their data immediately.',
  } : {
    heading: 'Your coaches',
    icon: 'people-outline',
    fallbackName: 'Coach',
    empty: "No coaches connected. When you approve a coach request, they'll appear here.",
    action: 'Revoke',
    foot: 'Coaches you approve can see your results and progress. Revoke anytime to cut access instantly.',
  }

  const [links, setLinks] = useState<Link[]>([])
  const [loading, setLoading] = useState(true)
  const [busy, setBusy] = useState<string | null>(null)
  const [error, setError] = useState('')

  const load = useCallback(async () => {
    setLoading(true)
    try {
      const rows = await callRpc('get_my_links')
      setLinks(Array.isArray(rows) ? rows : [])
    } catch {
      setLinks([])
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => { load() }, [load])

  const respond = async (linkId: string, accept: boolean) => {
    setBusy(linkId); setError('')
    try {
      await callRpc('respond_to_invite', { p_link_id: linkId, p_accept: accept })
      await load()
    } catch (e: any) {
      setError(e.message || 'Something went wrong.')
    } finally {
      setBusy(null)
    }
  }

  const revoke = async (linkId: string) => {
    setBusy(linkId); setError('')
    try {
      await callRpc('revoke_link', { p_link_id: linkId })
      await load()
    } catch (e: any) {
      setError(e.message || 'Could not revoke.')
    } finally {
      setBusy(null)
    }
  }

  const pending = links.filter((l) => l.status === 'pending')
  const active = links.filter((l) => l.status === 'active')

  if (loading) return null
  if (pendingOnly && pending.length === 0) return null

  return (
    <View style={{ gap: spacing.md }}>
      {/* Pending invites */}
      {pending.length > 0 && (
        <View style={styles.pendingCard}>
          <View style={styles.rowCenter}>
            <Ionicons name="shield-checkmark-outline" size={14} color={colors.orange[400]} />
            <Text style={styles.pendingKicker}>Coach {pending.length > 1 ? 'requests' : 'request'}</Text>
          </View>
          {pending.map((l) => (
            <View key={l.link_id} style={styles.pendingItem}>
              <Text style={styles.name}>
                {l.counterparty_name || 'A coach'}
                {l.counterparty_org ? <Text style={styles.org}>  ·  {l.counterparty_org}</Text> : null}
              </Text>
              <Text style={styles.sub}>wants to connect and view your performance data. You can revoke anytime.</Text>
              <View style={styles.btnRow}>
                <TouchableOpacity style={[styles.btn, styles.approve]} disabled={busy === l.link_id}
                  onPress={() => respond(l.link_id, true)} activeOpacity={0.85}>
                  {busy === l.link_id
                    ? <ActivityIndicator size="small" color="#000" />
                    : <Text style={styles.approveText}>Approve</Text>}
                </TouchableOpacity>
                <TouchableOpacity style={[styles.btn, styles.decline]} disabled={busy === l.link_id}
                  onPress={() => respond(l.link_id, false)} activeOpacity={0.85}>
                  <Text style={styles.declineText}>Decline</Text>
                </TouchableOpacity>
              </View>
            </View>
          ))}
        </View>
      )}

      {/* Active coaches */}
      {!pendingOnly && (
        <View>
          <View style={styles.rowCenter}>
            <Ionicons name={W.icon as any} size={14} color={colors.text.muted} />
            <Text style={styles.sectionKicker}>{W.heading}</Text>
          </View>
          {active.length === 0 ? (
            <Text style={styles.empty}>{W.empty}</Text>
          ) : (
            <View style={{ gap: 6, marginTop: spacing.sm }}>
              {active.map((l) => (
                <View key={l.link_id} style={styles.activeItem}>
                  <View style={{ flex: 1 }}>
                    <Text style={styles.name}>{l.counterparty_name || W.fallbackName}</Text>
                    {l.counterparty_org ? <Text style={styles.orgSmall}>{l.counterparty_org}</Text> : null}
                  </View>
                  <TouchableOpacity disabled={busy === l.link_id} onPress={() => revoke(l.link_id)}>
                    <Text style={styles.revoke}>{busy === l.link_id ? '…' : W.action}</Text>
                  </TouchableOpacity>
                </View>
              ))}
            </View>
          )}
          <Text style={styles.footnote}>{W.foot}</Text>
        </View>
      )}

      {error !== '' && <Text style={styles.error}>{error}</Text>}
    </View>
  )
}

const styles = StyleSheet.create({
  rowCenter: { flexDirection: 'row', alignItems: 'center', gap: 6 },
  pendingCard: {
    backgroundColor: 'rgba(249,115,22,0.06)', borderWidth: 1, borderColor: 'rgba(249,115,22,0.25)',
    borderRadius: radius.lg, padding: spacing.md, gap: spacing.sm,
  },
  pendingKicker: { color: colors.orange[300], fontSize: 11, fontWeight: '700', letterSpacing: 1, textTransform: 'uppercase' },
  pendingItem: { backgroundColor: 'rgba(0,0,0,0.2)', borderRadius: radius.md, padding: spacing.md },
  name: { color: colors.text.primary, fontSize: 14, fontWeight: '600' },
  org: { color: colors.text.muted, fontWeight: '400' },
  orgSmall: { color: colors.text.dimmed, fontSize: 11, marginTop: 1 },
  sub: { color: colors.text.muted, fontSize: 12, marginTop: 2, marginBottom: spacing.sm, lineHeight: 17 },
  btnRow: { flexDirection: 'row', gap: 8 },
  btn: { flex: 1, paddingVertical: 10, borderRadius: radius.md, alignItems: 'center' },
  approve: { backgroundColor: colors.orange[500] },
  approveText: { color: '#000', fontSize: 12, fontWeight: '700' },
  decline: { backgroundColor: 'rgba(255,255,255,0.05)', borderWidth: 1, borderColor: 'rgba(255,255,255,0.1)' },
  declineText: { color: colors.text.secondary, fontSize: 12, fontWeight: '600' },
  sectionKicker: { color: colors.text.muted, fontSize: 11, fontWeight: '700', letterSpacing: 1, textTransform: 'uppercase' },
  empty: { color: colors.text.dimmed, fontSize: 12, marginTop: spacing.sm },
  activeItem: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between',
    backgroundColor: 'rgba(255,255,255,0.02)', borderWidth: 1, borderColor: 'rgba(255,255,255,0.05)',
    borderRadius: radius.md, paddingHorizontal: spacing.md, paddingVertical: 10,
  },
  revoke: { color: colors.text.muted, fontSize: 11, fontWeight: '600' },
  footnote: { color: colors.text.dimmed, fontSize: 10, marginTop: spacing.sm, lineHeight: 14 },
  error: { color: colors.red, fontSize: 12 },
})
