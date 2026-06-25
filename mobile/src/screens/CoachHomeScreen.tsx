// ═══════════════════════════════════════════════════════════════════════════
// COACH HOME — the coach's landing tab. Orients them in seconds:
//   • Squad health (linked athletes, checked-in today)
//   • Needs attention — readiness flags, gone-quiet, behind-on-program
//   • Squad activity feed — recent results / tests / sessions, with reactions
// Pulls from get_linked_athletes + get_coach_feed + activity_reactions.
// ═══════════════════════════════════════════════════════════════════════════

import React, { useEffect, useState, useCallback, useMemo } from 'react'
import { View, Text, ScrollView, TouchableOpacity, StyleSheet, RefreshControl } from 'react-native'
import { SafeAreaView } from 'react-native-safe-area-context'
import { useNavigation } from '@react-navigation/native'
import { Ionicons } from '@expo/vector-icons'
import { colors, spacing, radius } from '../lib/theme'
import { useAuth } from '../contexts/AuthContext'
import { useTheme } from '../contexts/ThemeContext'
import { callRpc, insertInto, deleteFrom } from '../lib/supabase'
import { checkinStatus, READINESS_COLORS, isToday } from '../lib/readiness'

const EMOJIS = ['👏', '🔥', '💪']
const QUIET_DAYS = 14

function greeting(): string {
  const h = new Date().getHours()
  if (h < 12) return 'Good morning'
  if (h < 17) return 'Good afternoon'
  return 'Good evening'
}

function timeAgo(ts: string | null): string {
  if (!ts) return ''
  const diff = Date.now() - new Date(ts).getTime()
  const d = Math.floor(diff / 86400000)
  if (d > 0) return d === 1 ? 'yesterday' : `${d}d ago`
  const h = Math.floor(diff / 3600000)
  if (h > 0) return `${h}h ago`
  const m = Math.floor(diff / 60000)
  return m > 1 ? `${m}m ago` : 'just now'
}

function initials(name: string): string {
  return (name || '?').split(' ').map((n) => n[0]).join('').slice(0, 2).toUpperCase()
}

// Most-recent activity (days ago) across the linked athlete's results.
function lastActivityDays(a: any): number | null {
  let latest: Date | null = null
  const consider = (d: string | null) => { if (!d) return; const t = new Date(d); if (!isNaN(t.getTime()) && (!latest || t > latest)) latest = t }
  for (const r of (Array.isArray(a.races) ? a.races : [])) consider(r.date)
  for (const p of (Array.isArray(a.performances) ? a.performances : [])) consider(p.date)
  if (!latest) return null
  return Math.floor((Date.now() - (latest as Date).getTime()) / 86400000)
}

// Build the param the AthleteDetail screen expects from a linked-athlete row.
function buildAthleteParam(a: any) {
  const races = [
    ...(Array.isArray(a.races) ? a.races : []),
    ...(Array.isArray(a.performances) ? a.performances : []),
  ].filter((r: any) => r && r.value != null && r.date)
  return {
    name: a.name,
    dob: a.dob,
    gender: String(a.gender || 'M').toUpperCase().startsWith('F') ? 'Female' : 'Male',
    discipline: (a.discipline || '').trim(),
    pb_value: a.pb_value ?? null,
    races,
    disciplines_data: a.disciplines_data || {},
    _linked: true,
  }
}

export default function CoachHomeScreen() {
  const { user, profile } = useAuth()
  const { colors: c } = useTheme()
  const navigation = useNavigation<any>()
  const [linked, setLinked] = useState<any[]>([])
  const [feed, setFeed] = useState<any[]>([])
  const [reacts, setReacts] = useState<Record<string, Set<string>>>({})
  const [loading, setLoading] = useState(true)
  const [refreshing, setRefreshing] = useState(false)
  const [busy, setBusy] = useState<string | null>(null)

  const load = useCallback(async () => {
    if (!user?.id) { setLoading(false); return }   // wait for auth/token before fetching
    try {
      const [athletes, events] = await Promise.all([
        callRpc('get_linked_athletes').catch(() => []),
        callRpc('get_coach_feed').catch(() => []),
      ])
      setLinked(Array.isArray(athletes) ? athletes : [])
      const list = Array.isArray(events) ? events : []
      setFeed(list)
      const map: Record<string, Set<string>> = {}
      for (const e of list) map[e.event_key] = new Set(Array.isArray(e.my_reactions) ? e.my_reactions : [])
      setReacts(map)
    } finally { setLoading(false) }
  }, [user?.id])

  useEffect(() => { load() }, [load])
  useEffect(() => {
    const unsub = navigation.addListener('focus', () => load())
    return unsub
  }, [navigation, load])

  const onRefresh = async () => { setRefreshing(true); await load(); setRefreshing(false) }

  // ── Needs-attention items ──
  const items = useMemo(() => {
    const out: any[] = []
    const dow = (new Date().getDay() + 6) % 7
    for (const a of linked) {
      const fresh = isToday(a.latest_checkin)
      const status = checkinStatus(fresh ? a.latest_checkin : null)
      if (status.level === 'red' || status.level === 'amber') {
        out.push({ a, key: `${a.athlete_user_id}-r`, kind: 'readiness', level: status.level, rank: status.level === 'red' ? 2 : 1,
          headline: `${a.name} · ${status.label}`, detail: status.reasons.join(' · ') || 'Flagged on check-in', icon: 'heart-outline', color: READINESS_COLORS[status.level] })
      }
      const comp = a.program_compliance
      if (comp && comp.sessions_per_week && dow >= 3 && (comp.done_this_week / comp.sessions_per_week) < 0.5) {
        out.push({ a, key: `${a.athlete_user_id}-c`, kind: 'compliance', level: 'amber', rank: 1,
          headline: `${a.name} · behind on program`, detail: `${comp.done_this_week}/${comp.sessions_per_week} sessions this week`, icon: 'barbell-outline', color: '#fbbf24' })
      }
      const days = lastActivityDays(a)
      if (days != null && days >= QUIET_DAYS) {
        out.push({ a, key: `${a.athlete_user_id}-q`, kind: 'quiet', level: 'info', rank: 0,
          headline: `${a.name} · gone quiet`, detail: `No result in ${days} days`, icon: 'time-outline', color: '#64748b' })
      }
    }
    return out.sort((x, y) => y.rank - x.rank)
  }, [linked])

  const checkedToday = linked.filter((a) => isToday(a.latest_checkin)).length
  const firstName = profile?.full_name?.split(' ')[0] || 'Coach'

  const openAthlete = (a: any) => navigation.navigate('AthleteDetail', { athlete: buildAthleteParam(a) })

  const toggleReact = async (ev: any, emoji: string) => {
    const k = ev.event_key
    if (busy) return
    setBusy(`${k}${emoji}`)
    const has = reacts[k]?.has(emoji)
    setReacts((prev) => { const s = new Set(prev[k] || []); has ? s.delete(emoji) : s.add(emoji); return { ...prev, [k]: s } })
    try {
      if (has) await deleteFrom('activity_reactions', `event_key=eq.${encodeURIComponent(k)}&reactor_id=eq.${user?.id}&emoji=eq.${encodeURIComponent(emoji)}`)
      else await insertInto('activity_reactions', { event_key: k, athlete_user_id: ev.athlete_user_id, reactor_id: user?.id, reactor_name: profile?.full_name || 'Coach', event_title: ev.detail, emoji })
    } catch {
      setReacts((prev) => { const s = new Set(prev[k] || []); has ? s.add(emoji) : s.delete(emoji); return { ...prev, [k]: s } })
    } finally { setBusy(null) }
  }

  const feedMeta: Record<string, { icon: string; color: string; verb: string }> = {
    result: { icon: 'trophy-outline', color: colors.amber, verb: 'logged a result' },
    test: { icon: 'speedometer-outline', color: colors.blue, verb: 'logged a test' },
    session: { icon: 'barbell-outline', color: colors.green, verb: 'completed a session' },
  }

  return (
    <SafeAreaView style={[styles.safe, { backgroundColor: c.bg.primary }]}>
      <ScrollView showsVerticalScrollIndicator={false} contentContainerStyle={{ paddingBottom: 40 }}
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor={colors.orange[500]} />}>

        {/* Header */}
        <View style={styles.header}>
          <Text style={styles.greeting}>{greeting()}, {firstName}</Text>
          <Text style={styles.title}>Today</Text>
        </View>

        {/* Squad health */}
        {linked.length > 0 && (
          <View style={styles.statsRow}>
            <View style={styles.statItem}>
              <Text style={styles.statNum}>{linked.length}</Text>
              <Text style={styles.statLabel}>Athletes</Text>
            </View>
            <View style={styles.statDivider} />
            <View style={styles.statItem}>
              <Text style={styles.statNum}>{checkedToday}<Text style={styles.statSub}>/{linked.length}</Text></Text>
              <Text style={styles.statLabel}>Checked in</Text>
            </View>
            <View style={styles.statDivider} />
            <View style={styles.statItem}>
              <Text style={[styles.statNum, items.length > 0 && { color: colors.orange[500] }]}>{items.length}</Text>
              <Text style={styles.statLabel}>Flags</Text>
            </View>
          </View>
        )}

        {/* Needs attention */}
        {linked.length > 0 && (
          <View style={styles.section}>
            <View style={styles.sectionHead}>
              <Ionicons name="alert-circle-outline" size={15} color={colors.orange[500]} />
              <Text style={styles.sectionTitle}>Needs attention</Text>
            </View>
            {items.length === 0 ? (
              <View style={styles.allClear}>
                <Ionicons name="checkmark-circle-outline" size={18} color={colors.green} />
                <Text style={styles.allClearText}>All clear — no flags, everyone's active.</Text>
              </View>
            ) : (
              items.map((it) => (
                <TouchableOpacity key={it.key} style={styles.row} activeOpacity={0.6} onPress={() => openAthlete(it.a)}>
                  <View style={[styles.rowBar, { backgroundColor: it.color }]} />
                  <Ionicons name={it.icon as any} size={16} color={it.color} style={{ marginRight: spacing.sm }} />
                  <View style={{ flex: 1 }}>
                    <Text style={styles.rowTitle} numberOfLines={1}>{it.headline}</Text>
                    <Text style={styles.rowDetail} numberOfLines={1}>{it.detail}</Text>
                  </View>
                  <Ionicons name="chevron-forward" size={14} color={colors.text.dimmed} />
                </TouchableOpacity>
              ))
            )}
          </View>
        )}

        {/* Squad activity feed */}
        {feed.length > 0 && (
          <View style={styles.section}>
            <View style={styles.sectionHead}>
              <Ionicons name="pulse-outline" size={15} color={colors.orange[500]} />
              <Text style={styles.sectionTitle}>Squad activity</Text>
              <Text style={styles.sectionHint}>React to give a nudge</Text>
            </View>
            {feed.slice(0, 15).map((ev) => {
              const meta = feedMeta[ev.kind] || feedMeta.result
              const mine = reacts[ev.event_key] || new Set<string>()
              return (
                <View key={ev.event_key} style={styles.feedRow}>
                  <View style={[styles.avatar, { backgroundColor: meta.color + '14' }]}>
                    <Text style={[styles.avatarText, { color: meta.color }]}>{initials(ev.athlete_name)}</Text>
                  </View>
                  <View style={{ flex: 1, minWidth: 0 }}>
                    <Text style={styles.feedName} numberOfLines={1}>
                      <Text style={{ fontWeight: '700', color: colors.text.primary }}>{ev.athlete_name}</Text>
                      <Text style={{ color: colors.text.muted }}> {meta.verb}</Text>
                    </Text>
                    <View style={styles.feedMetaRow}>
                      <Ionicons name={meta.icon as any} size={11} color={meta.color} />
                      <Text style={styles.feedDetail} numberOfLines={1}>{ev.detail}</Text>
                      <Text style={styles.feedTime}>· {timeAgo(ev.occurred_at)}</Text>
                    </View>
                  </View>
                  <View style={styles.reactRow}>
                    {EMOJIS.map((e) => {
                      const on = mine.has(e)
                      return (
                        <TouchableOpacity key={e} onPress={() => toggleReact(ev, e)} disabled={busy === `${ev.event_key}${e}`}
                          style={[styles.reactBtn, on && styles.reactBtnOn]}>
                          <Text style={[styles.reactEmoji, !on && { opacity: 0.55 }]}>{e}</Text>
                        </TouchableOpacity>
                      )
                    })}
                  </View>
                </View>
              )
            })}
          </View>
        )}

        {/* Empty (no linked athletes yet) */}
        {!loading && linked.length === 0 && feed.length === 0 && (
          <View style={styles.emptyWrap}>
            <View style={styles.emptyIcon}><Ionicons name="people-outline" size={30} color={colors.text.dimmed} /></View>
            <Text style={styles.emptyTitle}>No linked athletes yet</Text>
            <Text style={styles.emptySub}>Invite athletes from your Squad to see their check-ins, programs and activity here.</Text>
            <TouchableOpacity style={styles.emptyBtn} onPress={() => navigation.navigate('Squad')}>
              <Text style={styles.emptyBtnText}>Go to Squad</Text>
            </TouchableOpacity>
          </View>
        )}
      </ScrollView>
    </SafeAreaView>
  )
}

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: colors.bg.primary },
  header: { paddingHorizontal: spacing.lg, paddingTop: spacing.md, paddingBottom: spacing.sm },
  greeting: { fontSize: 13, color: colors.text.muted, fontWeight: '500' },
  title: { fontSize: 28, fontWeight: '700', color: colors.text.primary, marginTop: 2, letterSpacing: -0.5 },

  statsRow: {
    flexDirection: 'row', marginHorizontal: spacing.lg, marginTop: spacing.sm,
    paddingVertical: spacing.md, backgroundColor: 'rgba(255,255,255,0.02)',
    borderRadius: radius.md, borderWidth: 1, borderColor: 'rgba(255,255,255,0.05)',
  },
  statItem: { flex: 1, alignItems: 'center' },
  statNum: { fontSize: 20, fontWeight: '700', color: colors.text.primary, letterSpacing: -0.5 },
  statSub: { fontSize: 13, color: colors.text.dimmed, fontWeight: '600' },
  statLabel: { fontSize: 10, letterSpacing: 1, color: colors.text.muted, fontWeight: '500', marginTop: 2, textTransform: 'uppercase' },
  statDivider: { width: 1, backgroundColor: 'rgba(255,255,255,0.06)', marginVertical: 2 },

  section: { marginTop: spacing.xl, paddingHorizontal: spacing.lg },
  sectionHead: { flexDirection: 'row', alignItems: 'center', gap: 6, marginBottom: spacing.sm },
  sectionTitle: { fontSize: 13, fontWeight: '700', color: colors.text.primary },
  sectionHint: { marginLeft: 'auto', fontSize: 10, color: colors.text.dimmed },

  allClear: { flexDirection: 'row', alignItems: 'center', gap: 8, paddingVertical: spacing.md },
  allClearText: { fontSize: 13, color: colors.text.secondary },

  row: {
    flexDirection: 'row', alignItems: 'center', paddingVertical: 11, paddingRight: 4,
    borderRadius: radius.md, borderWidth: 1, borderColor: 'rgba(255,255,255,0.04)',
    paddingLeft: 0, marginBottom: 8, overflow: 'hidden',
  },
  rowBar: { width: 4, alignSelf: 'stretch', borderTopLeftRadius: radius.md, borderBottomLeftRadius: radius.md, marginRight: spacing.md },
  rowTitle: { fontSize: 13, fontWeight: '600', color: colors.text.primary },
  rowDetail: { fontSize: 11, color: colors.text.muted, marginTop: 1 },

  feedRow: {
    flexDirection: 'row', alignItems: 'center', paddingVertical: 10, gap: spacing.sm,
    borderBottomWidth: 1, borderBottomColor: 'rgba(255,255,255,0.04)',
  },
  avatar: { width: 34, height: 34, borderRadius: 17, justifyContent: 'center', alignItems: 'center' },
  avatarText: { fontSize: 12, fontWeight: '700' },
  feedName: { fontSize: 12.5 },
  feedMetaRow: { flexDirection: 'row', alignItems: 'center', gap: 4, marginTop: 1 },
  feedDetail: { fontSize: 11, color: colors.text.muted, flexShrink: 1 },
  feedTime: { fontSize: 10, color: colors.text.dimmed },
  reactRow: { flexDirection: 'row', gap: 4 },
  reactBtn: {
    width: 30, height: 30, borderRadius: 8, justifyContent: 'center', alignItems: 'center',
    backgroundColor: 'rgba(255,255,255,0.03)', borderWidth: 1, borderColor: 'rgba(255,255,255,0.07)',
  },
  reactBtnOn: { backgroundColor: colors.orange[500] + '24', borderColor: colors.orange[500] + '60' },
  reactEmoji: { fontSize: 14 },

  emptyWrap: { alignItems: 'center', paddingHorizontal: spacing.xxl, paddingTop: 80 },
  emptyIcon: {
    width: 60, height: 60, borderRadius: 30, backgroundColor: 'rgba(255,255,255,0.03)',
    borderWidth: 1, borderColor: 'rgba(255,255,255,0.06)', justifyContent: 'center', alignItems: 'center', marginBottom: spacing.lg,
  },
  emptyTitle: { fontSize: 16, fontWeight: '600', color: colors.text.primary, marginBottom: 6 },
  emptySub: { fontSize: 13, color: colors.text.muted, textAlign: 'center', lineHeight: 19, marginBottom: spacing.lg },
  emptyBtn: { backgroundColor: colors.orange[500], borderRadius: radius.md, paddingVertical: 12, paddingHorizontal: 24 },
  emptyBtnText: { color: '#fff', fontSize: 14, fontWeight: '700' },
})
