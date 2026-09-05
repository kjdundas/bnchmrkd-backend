// ═══════════════════════════════════════════════════════════════════════
// COACH ↔ ATHLETE LINKS (mobile)
// Pending invites (approve / decline) + active links (revoke).
// Backed by get_my_links / respond_to_invite / revoke_link RPCs.
//   pendingOnly — render only pending invites (or null if none). Home prompt.
//
// AND ONE DIRECTION. Only a coach can start a link — invite_athlete is
// coach-only and there is no request_coach. An athlete arriving here from
// "Connect your coach" on the Get started card found a receive-only list
// whose empty state said "when you approve a coach request, they'll appear
// here", which is a description of waiting, not something to do. There was
// no way to reach a coach and nothing explaining why.
//
// Worse, invite_athlete has two outcomes. If the athlete already has an
// account it makes a pending link they can approve — that path worked. If
// they DON'T, it mints an invite_token and hands the coach a share link, and
// `claim_invite` — the function that redeems that token — was called from
// nowhere in the app. Every invite sent to someone who had not yet signed up
// was unredeemable.
//
// So the empty state now does three things instead of describing one: it
// says which way a link travels, shows the athlete the exact email their
// coach has to type, and takes an invite code.
//
// ONE link, TWO sides. get_my_links returns the same row to both parties and
// names the other one, so a coach opening their profile was reading their own
// athletes under the heading "Your coaches" — the component knew the data and
// not the reader. Every word that depends on which end you are standing at
// now comes from `role`.
// ═══════════════════════════════════════════════════════════════════════
import React, { useState, useEffect, useCallback } from 'react'
import {
  View,
  Text,
  ActivityIndicator,
  StyleSheet,
  TextInput,
} from 'react-native'
import { Ionicons } from '@expo/vector-icons'
import { colors, spacing, radius, typeScale, weight } from '../lib/theme'
import { callRpc } from '../lib/supabase'
import { useAuth } from '../contexts/AuthContext'
import { Tappable } from './ui'

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

  // Invite code redemption. The token comes off the end of the share link a
  // coach is given, so accept either — nobody should have to know that
  // "https://bnchmrkd.app/?invite=abc123" and "abc123" are the same thing.
  const [code, setCode] = useState('')
  const [claiming, setClaiming] = useState(false)
  const [claimMsg, setClaimMsg] = useState('')

  const claim = async () => {
    const token = (code.match(/[0-9a-f]{24,}/i)?.[0] || code).trim()
    if (!token) return
    setClaiming(true); setClaimMsg(''); setError('')
    try {
      const r: any = await callRpc('claim_invite', { p_token: token })
      const result = Array.isArray(r) ? r[0]?.result : r?.result
      if (result === 'claimed') {
        setCode('')
        setClaimMsg('Found it. Approve the request above to finish.')
        await load()
      } else if (result === 'already') {
        setClaimMsg('You are already linked to that coach.')
      } else if (result === 'not_pending') {
        setClaimMsg('That code has already been used.')
      } else {
        setClaimMsg("That code didn't match an invite. Check it with your coach.")
      }
    } catch (e: any) {
      setClaimMsg(e.message || 'Could not check that code.')
    } finally {
      setClaiming(false)
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
                <Tappable style={[styles.btn, styles.approve]} disabled={busy === l.link_id}
                  onPress={() => respond(l.link_id, true)}>
                  {busy === l.link_id
                    ? <ActivityIndicator size="small" color="#000" />
                    : <Text style={styles.approveText}>Approve</Text>}
                </Tappable>
                <Tappable style={[styles.btn, styles.decline]} disabled={busy === l.link_id}
                  onPress={() => respond(l.link_id, false)}>
                  <Text style={styles.declineText}>Decline</Text>
                </Tappable>
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
            isCoach ? (
              <Text style={styles.empty}>{W.empty}</Text>
            ) : (
              <View style={styles.howto}>
                <Text style={styles.howtoTitle}>Your coach adds you</Text>
                <Text style={styles.empty}>
                  Links only travel one way — a coach sends the request and you
                  approve it. Give your coach the email you signed up with and
                  they can add you from their roster.
                </Text>
                {profile?.email ? (
                  <View style={styles.emailBox}>
                    <Text style={styles.emailLabel}>YOUR SIGN-UP EMAIL</Text>
                    {/* Selectable rather than a copy button: expo-clipboard is
                        a native module, and this had to reach the build that
                        is already on people's phones. */}
                    <Text style={styles.emailValue} selectable>{profile.email}</Text>
                  </View>
                ) : null}
                <Text style={[styles.empty, { marginTop: spacing.md }]}>
                  Been sent an invite link instead? Paste it here.
                </Text>
                <View style={styles.codeRow}>
                  <TextInput
                    style={styles.codeInput}
                    value={code}
                    onChangeText={(t) => { setCode(t); setClaimMsg('') }}
                    placeholder="Invite link or code"
                    placeholderTextColor={colors.text.dimmed}
                    autoCapitalize="none"
                    autoCorrect={false}
                    editable={!claiming}
                  />
                  <Tappable
                    style={[styles.codeBtn, (!code.trim() || claiming) && { opacity: 0.5 }]}
                    disabled={!code.trim() || claiming}
                    onPress={claim}
                  >
                    {claiming
                      ? <ActivityIndicator size="small" color={colors.text.primary} />
                      : <Text style={styles.codeBtnText}>Use</Text>}
                  </Tappable>
                </View>
                {claimMsg ? <Text style={styles.claimMsg}>{claimMsg}</Text> : null}
              </View>
            )
          ) : (
            <View style={{ gap: 6, marginTop: spacing.sm }}>
              {active.map((l) => (
                <View key={l.link_id} style={styles.activeItem}>
                  <View style={{ flex: 1 }}>
                    <Text style={styles.name}>{l.counterparty_name || W.fallbackName}</Text>
                    {l.counterparty_org ? <Text style={styles.orgSmall}>{l.counterparty_org}</Text> : null}
                  </View>
                  <Tappable disabled={busy === l.link_id} onPress={() => revoke(l.link_id)}>
                    <Text style={styles.revoke}>{busy === l.link_id ? '…' : W.action}</Text>
                  </Tappable>
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
  howto: { marginTop: spacing.sm, gap: 6 },
  howtoTitle: {
    color: colors.text.primary, fontSize: typeScale.body,
    fontWeight: weight.bold, marginBottom: 2,
  },
  emailBox: {
    marginTop: spacing.sm, paddingVertical: 10, paddingHorizontal: 12,
    borderRadius: radius.control, backgroundColor: 'rgba(255,255,255,0.05)',
    borderWidth: 1, borderColor: 'rgba(255,255,255,0.10)',
  },
  emailLabel: {
    color: colors.text.muted, fontSize: typeScale.micro,
    letterSpacing: 0.8, fontWeight: weight.bold, marginBottom: 3,
  },
  emailValue: { color: colors.text.primary, fontSize: typeScale.body, fontWeight: weight.medium },
  codeRow: { flexDirection: 'row', gap: 8, marginTop: 6, alignItems: 'center' },
  codeInput: {
    flex: 1, height: 42, paddingHorizontal: 12,
    borderRadius: radius.control, color: colors.text.primary,
    fontSize: typeScale.body,
    backgroundColor: 'rgba(255,255,255,0.05)',
    borderWidth: 1, borderColor: 'rgba(255,255,255,0.10)',
  },
  codeBtn: {
    height: 42, minWidth: 64, alignItems: 'center', justifyContent: 'center',
    paddingHorizontal: 16, borderRadius: radius.control,
    backgroundColor: colors.orange[500],
  },
  codeBtnText: { color: '#FFFFFF', fontSize: typeScale.body, fontWeight: weight.bold },
  claimMsg: { color: colors.text.secondary, fontSize: typeScale.caption, marginTop: 4 },

  rowCenter: { flexDirection: 'row', alignItems: 'center', gap: 6 },
  pendingCard: {
    backgroundColor: 'rgba(249,115,22,0.06)', borderWidth: 1, borderColor: 'rgba(249,115,22,0.25)',
    borderRadius: radius.card, padding: spacing.md, gap: spacing.sm,
  },
  pendingKicker: { color: colors.orange[300], fontSize: typeScale.label, fontWeight: weight.bold, letterSpacing: 1, textTransform: 'uppercase' },
  pendingItem: { backgroundColor: 'rgba(0,0,0,0.2)', borderRadius: radius.control, padding: spacing.md },
  name: { color: colors.text.primary, fontSize: typeScale.body, fontWeight: weight.medium },
  org: { color: colors.text.muted, fontWeight: weight.regular },
  orgSmall: { color: colors.text.dimmed, fontSize: typeScale.label, marginTop: 1 },
  sub: { color: colors.text.muted, fontSize: typeScale.caption, marginTop: 2, marginBottom: spacing.sm, lineHeight: 17 },
  btnRow: { flexDirection: 'row', gap: 8 },
  btn: { flex: 1, paddingVertical: 10, borderRadius: radius.control, alignItems: 'center' },
  approve: { backgroundColor: colors.orange[500] },
  approveText: { color: '#000', fontSize: typeScale.caption, fontWeight: weight.bold },
  decline: { backgroundColor: 'rgba(255,255,255,0.05)', borderWidth: 1, borderColor: 'rgba(255,255,255,0.1)' },
  declineText: { color: colors.text.secondary, fontSize: typeScale.caption, fontWeight: weight.medium },
  sectionKicker: { color: colors.text.muted, fontSize: typeScale.label, fontWeight: weight.bold, letterSpacing: 1, textTransform: 'uppercase' },
  empty: { color: colors.text.dimmed, fontSize: typeScale.caption, marginTop: spacing.sm },
  activeItem: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between',
    backgroundColor: 'rgba(255,255,255,0.02)', borderWidth: 1, borderColor: 'rgba(255,255,255,0.05)',
    borderRadius: radius.control, paddingHorizontal: spacing.md, paddingVertical: 10,
  },
  revoke: { color: colors.text.muted, fontSize: typeScale.label, fontWeight: weight.medium },
  footnote: { color: colors.text.dimmed, fontSize: typeScale.label, marginTop: spacing.sm, lineHeight: 14 },
  error: { color: colors.red, fontSize: typeScale.caption },
})
