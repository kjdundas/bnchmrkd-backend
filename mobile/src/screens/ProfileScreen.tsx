// ═══════════════════════════════════════════════════════════════════════
// PROFILE SCREEN — Athlete identity (premium brand)
// HeroCard avatar → Stats → DNA mini → Details → Sign Out
// Uses HeroCard, AlmanacCard, MonoKicker, StreakChip, AnimatedBar
// ═══════════════════════════════════════════════════════════════════════

import React, { useState, useEffect, useMemo } from 'react'
import {
  View,
  Text,
  ScrollView,
  TextInput,
  TouchableOpacity,
  StyleSheet,
  Alert,
} from 'react-native'
import { SafeAreaView } from 'react-native-safe-area-context'
import { useNavigation } from '@react-navigation/native'
import { Ionicons } from '@expo/vector-icons'
import { colors, spacing, radius } from '../lib/theme'
import { useAuth } from '../contexts/AuthContext'
import { updateIn, selectFrom } from '../lib/supabase'
import {
  HeroCard,
  AlmanacCard,
  GlassCard,
  MonoKicker,
  StreakChip,
  TierBadge,
  AnimatedBar,
  Divider,
} from '../components/ui'
import {
  RADAR_AXES,
  buildDnaProfile,
  scoreToTier,
} from '../lib/disciplineScience'

export default function ProfileScreen() {
  const { profile, user, signOut, refreshProfile } = useAuth()
  const [editing, setEditing] = useState(false)
  const [metrics, setMetrics] = useState<any[]>([])
  const [form, setForm] = useState({
    full_name: profile?.full_name || '',
    club: profile?.club || '',
    country: profile?.country || '',
    height_cm: profile?.height_cm?.toString() || '',
    weight_kg: profile?.weight_kg?.toString() || '',
  })
  const [saving, setSaving] = useState(false)

  const loadMetrics = () => {
    if (!user) return
    selectFrom('athlete_metrics', {
      filter: `athlete_id=eq.${user.id}`,
      order: 'recorded_at.desc',
      limit: '500',
    })
      .then((rows) => setMetrics(rows || []))
      .catch(() => {})
  }

  useEffect(() => { loadMetrics() }, [user])

  // Reload when tab comes into focus
  const navigation = useNavigation()
  useEffect(() => {
    const unsub = navigation.addListener('focus', () => { loadMetrics() })
    return unsub
  }, [navigation, user])

  // DNA summary
  const dnaProfile = useMemo(() => {
    return buildDnaProfile(
      metrics.map((m) => ({
        metric_key: m.metric_key,
        metric_label: m.metric_key?.replace(/_/g, ' '),
        value: m.value,
        unit: m.unit,
        recorded_at: m.recorded_at,
      }))
    )
  }, [metrics])

  const dnaAxes = RADAR_AXES.map((axis: any) => {
    const data = dnaProfile[axis.key]
    const score = data?.score ?? null
    const tier = score != null ? scoreToTier(score) : null
    return { key: axis.key, label: axis.label, score, tier }
  })

  const activeAxes = dnaAxes.filter((a) => a.score != null)
  const overallScore = activeAxes.length >= 2
    ? Math.round(activeAxes.reduce((s, a) => s + a.score!, 0) / activeAxes.length)
    : null
  const overallTier = overallScore != null ? scoreToTier(overallScore) : null

  // Stats
  const totalLogs = metrics.length
  const uniqueMetrics = new Set(metrics.map((m) => m.metric_key)).size
  // Compute PB count client-side
  const pbTracker: Record<string, number> = {}
  for (const m of metrics) {
    const k = m.metric_key
    const v = parseFloat(m.value)
    const lower = (k || '').match(/^(sprint_|flying_|split_|resting_hr|rhr|body_fat|tt_|bronco)/) != null
    if (!(k in pbTracker) || (lower ? v < pbTracker[k] : v > pbTracker[k])) {
      pbTracker[k] = v
    }
  }
  const pbCount = Object.keys(pbTracker).length
  const firstLog = metrics.length > 0 ? metrics[metrics.length - 1] : null
  const daysSinceStart = firstLog
    ? Math.ceil((Date.now() - new Date(firstLog.recorded_at).getTime()) / 86400000)
    : 0

  // Streak: consecutive days with logs
  const logDates = [...new Set(metrics.map((m) => m.recorded_at?.split('T')[0]))].sort().reverse()
  let streak = 0
  for (let i = 0; i < logDates.length; i++) {
    const expected = new Date(Date.now() - i * 86400000).toISOString().split('T')[0]
    if (logDates[i] === expected) streak++
    else break
  }

  const handleSave = async () => {
    if (!profile) return
    setSaving(true)
    try {
      await updateIn('athlete_profiles', `id=eq.${profile.id}`, {
        full_name: form.full_name,
        club: form.club || null,
        country: form.country || null,
        height_cm: form.height_cm ? parseFloat(form.height_cm) : null,
        weight_kg: form.weight_kg ? parseFloat(form.weight_kg) : null,
      })
      await refreshProfile()
      setEditing(false)
    } catch (e: any) {
      Alert.alert('Error', e.message || 'Failed to save')
    }
    setSaving(false)
  }

  const handleSignOut = () => {
    Alert.alert('Sign Out', 'Are you sure you want to sign out?', [
      { text: 'Cancel', style: 'cancel' },
      { text: 'Sign Out', style: 'destructive', onPress: signOut },
    ])
  }

  return (
    <SafeAreaView style={styles.safe}>
      <ScrollView contentContainerStyle={styles.content} showsVerticalScrollIndicator={false}>
        {/* ════════════════════════════════════════════════════════════════
            AVATAR HERO — Gradient card with identity
            ════════════════════════════════════════════════════════════ */}
        <HeroCard>
          <View style={styles.avatarSection}>
            <View style={styles.avatarRing}>
              <View style={styles.avatar}>
                <Text style={styles.avatarText}>
                  {(profile?.full_name || '?')[0].toUpperCase()}
                </Text>
              </View>
            </View>
            <Text style={styles.displayName}>{profile?.full_name || 'Athlete'}</Text>
            {profile?.club && <Text style={styles.clubText}>{profile.club}</Text>}

            <View style={styles.badges}>
              <View style={styles.roleBadge}>
                <Text style={styles.roleText}>
                  {profile?.role === 'coach' ? 'COACH' : 'ATHLETE'}
                </Text>
              </View>
              {overallTier && (
                <TierBadge label={`${overallTier.label} · ${overallScore}`} color={overallTier.color} />
              )}
              <StreakChip count={streak} />
            </View>
          </View>
        </HeroCard>

        {/* ════════════════════════════════════════════════════════════════
            STATS GRID
            ════════════════════════════════════════════════════════════ */}
        <AlmanacCard kicker="CAREER STATS" accent={colors.orange[500]}>
          <View style={styles.statsGrid}>
            <View style={styles.statItem}>
              <Text style={styles.statNum}>{totalLogs}</Text>
              <Text style={styles.statLabel}>LOGS</Text>
            </View>
            <View style={styles.statDivider} />
            <View style={styles.statItem}>
              <Text style={[styles.statNum, { color: colors.green }]}>{pbCount}</Text>
              <Text style={styles.statLabel}>PBs</Text>
            </View>
            <View style={styles.statDivider} />
            <View style={styles.statItem}>
              <Text style={[styles.statNum, { color: colors.blue }]}>{uniqueMetrics}</Text>
              <Text style={styles.statLabel}>METRICS</Text>
            </View>
            <View style={styles.statDivider} />
            <View style={styles.statItem}>
              <Text style={[styles.statNum, { color: colors.teal }]}>
                {daysSinceStart > 0 ? `${daysSinceStart}d` : '—'}
              </Text>
              <Text style={styles.statLabel}>TRACKING</Text>
            </View>
          </View>
        </AlmanacCard>

        {/* ════════════════════════════════════════════════════════════════
            DNA MINI SUMMARY — Animated bars per axis
            ════════════════════════════════════════════════════════════ */}
        {activeAxes.length > 0 && (
          <AlmanacCard kicker="ATHLETE BLUEPRINT" title="DNA Summary" accent={colors.orange[500]}>
            {dnaAxes.map((axis, i) => (
              <View key={axis.key} style={styles.dnaRow}>
                <View style={styles.dnaLabelRow}>
                  <Text style={styles.dnaLabel}>{axis.label}</Text>
                  {axis.tier ? (
                    <View style={styles.dnaScoreRow}>
                      <View style={[styles.dnaDot, { backgroundColor: axis.tier.color }]} />
                      <Text style={[styles.dnaTierText, { color: axis.tier.color }]}>
                        {axis.score} · {axis.tier.label}
                      </Text>
                    </View>
                  ) : (
                    <Text style={styles.dnaNoData}>—</Text>
                  )}
                </View>
                <AnimatedBar
                  progress={axis.score ?? 0}
                  color={axis.tier?.color || colors.text.dimmed}
                  height={5}
                  delay={i * 80}
                />
              </View>
            ))}
          </AlmanacCard>
        )}

        {/* ════════════════════════════════════════════════════════════════
            PROFILE DETAILS — Editable info
            ════════════════════════════════════════════════════════════ */}
        <AlmanacCard kicker="ATHLETE PROFILE" title="Details" accent={colors.blue}>
          {!editing && (
            <TouchableOpacity onPress={() => setEditing(true)} style={styles.editBtn}>
              <Ionicons name="pencil" size={13} color={colors.orange[400]} />
              <Text style={styles.editBtnText}>Edit</Text>
            </TouchableOpacity>
          )}

          {editing ? (
            <>
              <Field label="Full Name" value={form.full_name} onChange={(v) => setForm({ ...form, full_name: v })} />
              <Field label="Club" value={form.club} onChange={(v) => setForm({ ...form, club: v })} />
              <Field label="Country" value={form.country} onChange={(v) => setForm({ ...form, country: v })} />
              <Field label="Height (cm)" value={form.height_cm} onChange={(v) => setForm({ ...form, height_cm: v })} keyboard="decimal-pad" />
              <Field label="Weight (kg)" value={form.weight_kg} onChange={(v) => setForm({ ...form, weight_kg: v })} keyboard="decimal-pad" />

              <View style={styles.btnRow}>
                <TouchableOpacity style={styles.cancelBtn} onPress={() => setEditing(false)}>
                  <Text style={styles.cancelBtnText}>Cancel</Text>
                </TouchableOpacity>
                <TouchableOpacity style={styles.saveBtn} onPress={handleSave} disabled={saving}>
                  <Text style={styles.saveBtnText}>{saving ? 'Saving…' : 'Save'}</Text>
                </TouchableOpacity>
              </View>
            </>
          ) : (
            <>
              <InfoRow icon="flag-outline" label="Country" value={profile?.country || '—'} />
              <InfoRow icon="fitness-outline" label="Height" value={profile?.height_cm ? `${profile.height_cm} cm` : '—'} />
              <InfoRow icon="scale-outline" label="Weight" value={profile?.weight_kg ? `${profile.weight_kg} kg` : '—'} />
              <InfoRow icon="calendar-outline" label="Tracking since" value={
                firstLog
                  ? new Date(firstLog.recorded_at).toLocaleDateString('en-GB', { month: 'short', year: 'numeric' })
                  : '—'
              } />
              <InfoRow icon="mail-outline" label="Email" value={user?.email || '—'} />
            </>
          )}
        </AlmanacCard>

        {/* ════════════════════════════════════════════════════════════════
            SIGN OUT
            ════════════════════════════════════════════════════════════ */}
        <TouchableOpacity style={styles.signOutBtn} onPress={handleSignOut} activeOpacity={0.7}>
          <Ionicons name="log-out-outline" size={18} color={colors.red} />
          <Text style={styles.signOutText}>Sign Out</Text>
        </TouchableOpacity>

        {/* Version */}
        <Text style={styles.version}>bnchmrkd. v0.1.0</Text>

        <View style={{ height: 30 }} />
      </ScrollView>
    </SafeAreaView>
  )
}

// ── Helper components ──
function InfoRow({ icon, label, value }: { icon: string; label: string; value: string }) {
  return (
    <View style={styles.infoRow}>
      <View style={styles.infoIconWrap}>
        <Ionicons name={icon as any} size={15} color={colors.text.muted} />
      </View>
      <Text style={styles.infoLabel}>{label}</Text>
      <Text style={styles.infoValue}>{value}</Text>
    </View>
  )
}

function Field({ label, value, onChange, keyboard }: {
  label: string; value: string; onChange: (v: string) => void; keyboard?: 'decimal-pad' | 'default'
}) {
  return (
    <View style={styles.fieldWrap}>
      <Text style={styles.fieldLabel}>{label}</Text>
      <TextInput
        style={styles.fieldInput}
        value={value}
        onChangeText={onChange}
        placeholderTextColor={colors.text.dimmed}
        keyboardType={keyboard || 'default'}
      />
    </View>
  )
}

// ── Styles ──
const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: colors.bg.primary },
  content: { padding: spacing.lg },

  // Avatar hero
  avatarSection: { alignItems: 'center' },
  avatarRing: {
    width: 92,
    height: 92,
    borderRadius: 46,
    borderWidth: 2,
    borderColor: 'rgba(249,115,22,0.4)',
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: spacing.md,
    shadowColor: colors.orange[500],
    shadowOffset: { width: 0, height: 0 },
    shadowOpacity: 0.3,
    shadowRadius: 12,
  },
  avatar: {
    width: 78,
    height: 78,
    borderRadius: 39,
    backgroundColor: colors.orange[500],
    alignItems: 'center',
    justifyContent: 'center',
  },
  avatarText: { fontSize: 30, fontWeight: '700', color: '#fff' },
  displayName: { fontSize: 24, fontWeight: '700', color: colors.text.primary },
  clubText: { color: colors.text.secondary, fontSize: 14, marginTop: 4 },
  badges: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    marginTop: spacing.md,
  },
  roleBadge: {
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: radius.full,
    backgroundColor: 'rgba(249,115,22,0.12)',
    borderWidth: 1,
    borderColor: 'rgba(249,115,22,0.3)',
  },
  roleText: {
    fontSize: 10,
    fontWeight: '700',
    letterSpacing: 1.5,
    color: colors.orange[400],
  },

  // Stats grid
  statsGrid: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  statItem: { flex: 1, alignItems: 'center' },
  statNum: { fontSize: 22, fontWeight: '700', color: colors.text.primary, letterSpacing: -0.5 },
  statLabel: {
    fontSize: 8,
    letterSpacing: 2,
    color: colors.text.muted,
    fontWeight: '600',
    marginTop: 4,
  },
  statDivider: {
    width: 1,
    height: 28,
    backgroundColor: 'rgba(255,255,255,0.06)',
  },

  // DNA rows
  dnaRow: { marginBottom: 12 },
  dnaLabelRow: { flexDirection: 'row', justifyContent: 'space-between', marginBottom: 4 },
  dnaLabel: { color: colors.text.secondary, fontSize: 13, fontWeight: '500' },
  dnaScoreRow: { flexDirection: 'row', alignItems: 'center', gap: 5 },
  dnaDot: { width: 5, height: 5, borderRadius: 2.5 },
  dnaTierText: { fontSize: 11, fontWeight: '700' },
  dnaNoData: { color: colors.text.dimmed, fontSize: 12 },

  // Edit button
  editBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    alignSelf: 'flex-end',
    marginBottom: spacing.md,
    paddingHorizontal: 10,
    paddingVertical: 5,
    borderRadius: radius.full,
    backgroundColor: 'rgba(249,115,22,0.1)',
    borderWidth: 1,
    borderColor: 'rgba(249,115,22,0.25)',
  },
  editBtnText: { color: colors.orange[400], fontSize: 12, fontWeight: '600' },

  // Info rows
  infoRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    paddingVertical: 12,
    borderBottomWidth: 1,
    borderBottomColor: 'rgba(255,255,255,0.04)',
  },
  infoIconWrap: {
    width: 28,
    height: 28,
    borderRadius: 8,
    backgroundColor: 'rgba(255,255,255,0.04)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  infoLabel: { color: colors.text.secondary, fontSize: 14, flex: 1 },
  infoValue: { color: colors.text.primary, fontSize: 14, fontWeight: '500' },

  // Edit form
  fieldWrap: { marginBottom: spacing.md },
  fieldLabel: {
    fontSize: 10,
    letterSpacing: 1.5,
    textTransform: 'uppercase',
    color: colors.text.muted,
    fontWeight: '600',
    marginBottom: 6,
  },
  fieldInput: {
    backgroundColor: 'rgba(255,255,255,0.03)',
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.08)',
    borderRadius: radius.sm,
    paddingHorizontal: spacing.md,
    paddingVertical: 12,
    fontSize: 15,
    color: colors.text.primary,
  },
  btnRow: { flexDirection: 'row', gap: spacing.md, marginTop: spacing.md },
  cancelBtn: {
    flex: 1,
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.08)',
    borderRadius: radius.md,
    paddingVertical: 14,
    alignItems: 'center',
  },
  cancelBtnText: { color: colors.text.secondary, fontWeight: '600' },
  saveBtn: {
    flex: 1,
    backgroundColor: colors.orange[500],
    borderRadius: radius.md,
    paddingVertical: 14,
    alignItems: 'center',
    shadowColor: colors.orange[500],
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.3,
    shadowRadius: 8,
  },
  saveBtnText: { color: '#fff', fontWeight: '700' },

  // Sign out
  signOutBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    paddingVertical: 16,
    marginTop: spacing.lg,
    borderWidth: 1,
    borderColor: 'rgba(251,113,133,0.2)',
    borderRadius: radius.md,
    backgroundColor: 'rgba(251,113,133,0.04)',
  },
  signOutText: { color: colors.red, fontSize: 15, fontWeight: '600' },

  // Version
  version: {
    textAlign: 'center',
    color: colors.text.dimmed,
    fontSize: 11,
    marginTop: spacing.lg,
    letterSpacing: 1,
  },
})
