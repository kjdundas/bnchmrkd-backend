// ═══════════════════════════════════════════════════════════════════════
// PROFILE SCREEN — Athlete identity (premium brand)
// HeroCard avatar → Stats → DNA mini → Details → Sign Out
// Uses HeroCard, AlmanacCard, MonoKicker, StreakChip, AnimatedBar
// ═══════════════════════════════════════════════════════════════════════

import React, { useState, useEffect, useMemo, useCallback } from 'react'
import {
  View,
  Text,
  ScrollView,
  TextInput,
  StyleSheet,
  Alert,
  Pressable,
} from 'react-native'
import { SafeAreaView } from 'react-native-safe-area-context'
import { useNavigation } from '@react-navigation/native'
import { Ionicons } from '@expo/vector-icons'
import { colors, spacing, radius, typeScale, weight } from '../lib/theme'
import { useAuth } from '../contexts/AuthContext'
import { TAB_BAR_CLEARANCE } from '../navigation/FloatingTabBar'
import SharingSettings from '../components/SharingSettings'
import { useTheme, type ThemeMode } from '../contexts/ThemeContext'
import DnaStrip from '../components/DnaCard'
import { MetricRail } from '../components/OuraSections'
import IndicatorPicker from '../components/IndicatorPicker'
import { loadIndicators, saveIndicators } from '../lib/indicators'
import { groupMetrics } from '../lib/metricSemantics'
import ResultsTable from '../components/ResultsTable'
import { countPersonalBests } from '../lib/resultSemantics'
import DobField from '../components/DobField'
import { ageFromDob } from '../lib/age'
import { updateIn, selectFrom, upsertInto } from '../lib/supabase'
import {
  HeroCard,
  AlmanacCard,
  GlassCard,
  MonoKicker,
  StreakChip,
  TierBadge,
  AnimatedBar,
  Divider, Tappable, SectionLabel} from '../components/ui'
import {
  RADAR_AXES,
  buildDnaProfile,
  scoreToTier,
  findLimitingFactor,
} from '../lib/disciplineScience'
import AthleteCoachLinks from '../components/AthleteCoachLinks'

export default function ProfileScreen() {
  const { profile, user, signOut, refreshProfile } = useAuth()
  // One screen, two accounts. A coach was being shown their competition
  // record, their DNA strip, their height and weight and a count of their
  // personal bests — none of which a coach has, all of which read as empty
  // states nagging them to log something they will never log.
  const isCoach = profile?.role === 'coach' || (profile as any)?.account_type === 'coach'
  const { mode: themeMode, setMode: setThemeMode, isDark, colors: c } = useTheme()
  const [editing, setEditing] = useState(false)
  const [metrics, setMetrics] = useState<any[]>([])
  // The rings, and the sheet that reorders them. They were on Home, above the
  // mark, reading the same `metrics` array the DNA strip below reads — the
  // same data drawn twice, two blocks apart. They are a profile, so they live
  // on the profile.
  const [indicators, setIndicators] = useState<string[]>([])
  const [pickerFor, setPickerFor] = useState<string | null>(null)
  const [pickerOpen, setPickerOpen] = useState(false)
  const [performances, setPerformances] = useState<any[]>([])
  const [form, setForm] = useState({
    full_name: profile?.full_name || '',
    club: profile?.club || '',
    country: profile?.country || '',
    height_cm: profile?.height_cm?.toString() || '',
    weight_kg: profile?.weight_kg?.toString() || '',
  })
  // Kept out of `form` because these have their own validated controls rather
  // than being free text.
  const [dob, setDob] = useState<string | null>(profile?.dob || null)
  const [sex, setSex] = useState<string | null>(profile?.sex || null)
  const [saving, setSaving] = useState(false)
  const [physical, setPhysical] = useState<{ height_cm: number | null; weight_kg: number | null }>({
    height_cm: null,
    weight_kg: null,
  })

  // athlete_profiles holds height/weight; user_profiles (via AuthContext) holds identity.
  // Read once per athlete. The rail falls back to its automatic order while
  // this is in flight, so a slow read never leaves the rings blank.
  useEffect(() => {
    if (!user) { setIndicators([]); return }
    let cancelled = false
    loadIndicators(user.id).then((keys) => { if (!cancelled) setIndicators(keys) })
    return () => { cancelled = true }
  }, [user])

  // Written through on every edit rather than on dismiss: the sheet can be
  // swiped away, and a swipe is not a cancel.
  const changeIndicators = useCallback((keys: string[]) => {
    setIndicators(keys)
    if (user) saveIndicators(user.id, keys)
  }, [user])

  // The picker lists what the athlete has actually logged, in the same
  // automatic order the rail would use.
  const metricGroups = useMemo(() => groupMetrics(metrics), [metrics])

  useEffect(() => {
    if (!user) return
    selectFrom('athlete_profiles', { filter: `id=eq.${user.id}`, limit: '1' })
      .then((rows) => {
        const r = rows?.[0]
        if (!r) return
        setPhysical({ height_cm: r.height_cm ?? null, weight_kg: r.weight_kg ?? null })
        setForm((f) => ({
          ...f,
          height_cm: f.height_cm || (r.height_cm != null ? String(r.height_cm) : ''),
          weight_kg: f.weight_kg || (r.weight_kg != null ? String(r.weight_kg) : ''),
        }))
      })
      .catch(() => {})
  }, [user])

  const loadMetrics = () => {
    if (!user) return
    selectFrom('athlete_metrics', {
      filter: `athlete_id=eq.${user.id}`,
      order: 'recorded_at.desc',
      limit: '500',
    })
      .then((rows) => setMetrics(rows || []))
      .catch(() => {})
    // The whole competition record, not a recent window: this table is where
    // an athlete goes to see their career, and it groups by season.
    selectFrom('performances', {
      filter: `user_id=eq.${user.id}`,
      order: 'competition_date.desc',
      limit: '1000',
    })
      .then((rows) => setPerformances(rows || []))
      .catch(() => setPerformances([]))
  }

  useEffect(() => { loadMetrics() }, [user])

  // Reload when tab comes into focus
  const navigation = useNavigation()
  useEffect(() => {
    const unsub = navigation.addListener('focus', () => { loadMetrics() })
    return unsub
  }, [navigation, user])

  // Discipline for the DNA ladder — same source of truth as Home.
  const discipline = ((profile as any)?.primary_discipline || (profile as any)?.discipline || '').trim() || null

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
    const data = (dnaProfile as Record<string, any>)[axis.key]
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

  // ── PBs ──────────────────────────────────────────────────────────
  // A personal best is a RACE you improved on. This used to be built from
  // athlete_metrics, which had three problems stacked on each other:
  //
  //   1. it counted training tests — squatting more than last month is
  //      progress, not a personal best in the sense an athlete means it;
  //   2. it then returned Object.keys(...).length, which is just the number
  //      of distinct metrics logged — so "PBs" and "METRICS" were the same
  //      number by construction, and the card showed 9 and 9;
  //   3. its direction test was a third, divergent copy of LOWER_IS_BETTER
  //      written as a regex, which knew nothing of the metrics that have no
  //      better direction at all (body mass, height, wingspan) and happily
  //      counted a taller reading as a personal best.
  //
  // One shared definition now, over competition results only, and it agrees
  // with the PB count gamification awards XP for.
  const pbCount = useMemo(() => countPersonalBests(performances), [performances])

  const limitingFactor = useMemo(() => findLimitingFactor(dnaProfile, null, null), [dnaProfile])
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

  // `form` is seeded at mount, but profile arrives asynchronously on a cold
  // start — without this the fields sit empty over data that has since loaded,
  // and saving would blank the athlete's own details.
  useEffect(() => {
    if (!profile) return
    setForm((f) => ({
      full_name: f.full_name || profile.full_name || '',
      club: f.club || profile.club || '',
      country: f.country || profile.country || '',
      height_cm: f.height_cm || profile.height_cm?.toString() || '',
      weight_kg: f.weight_kg || profile.weight_kg?.toString() || '',
    }))
    setDob((d) => d || profile.dob || null)
    setSex((x) => x || profile.sex || null)
  }, [profile?.id, profile?.dob, profile?.sex])

  const handleSave = async () => {
    if (!profile) return
    setSaving(true)
    try {
      // Identity fields live on user_profiles; physical fields on athlete_profiles.
      await updateIn('user_profiles', `id=eq.${profile.id}`, {
        full_name: form.full_name,
        club_school: form.club || null,
        country: form.country || null,
        // Real column names. The app reads dob / sex; AuthContext maps these
        // back to those aliases on the way in.
        date_of_birth: dob || null,
        gender: sex === 'F' ? 'Female' : sex === 'M' ? 'Male' : null,
      })
      await upsertInto('athlete_profiles', {
        id: profile.id,
        height_cm: form.height_cm ? parseFloat(form.height_cm) : null,
        weight_kg: form.weight_kg ? parseFloat(form.weight_kg) : null,
      })
      setPhysical({
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
    if (typeof window !== 'undefined' && !window.confirm) {
      // Fallback: just sign out directly on web if confirm unavailable
      signOut()
      return
    }
    if (typeof window !== 'undefined' && window.confirm) {
      if (window.confirm('Are you sure you want to sign out?')) {
        signOut()
      }
      return
    }
    Alert.alert('Sign Out', 'Are you sure you want to sign out?', [
      { text: 'Cancel', style: 'cancel' },
      { text: 'Sign Out', style: 'destructive', onPress: signOut },
    ])
  }

  return (
    <SafeAreaView style={[styles.safe, { backgroundColor: c.bg.primary }]}>
      {/* Profile is pushed from the header avatar, so it needs its own back. */}
      <View style={{
        flexDirection: 'row', alignItems: 'center', gap: 10,
        paddingHorizontal: 16, paddingTop: 8, paddingBottom: 12,
      }}>
        <Tappable
          onPress={() => navigation.goBack()}
          accessibilityLabel="Go back"
          hitSlop={12}
          style={{ width: 44, height: 44, justifyContent: 'center' }}
        >
          <Ionicons name="chevron-back" size={24} color={c.text.primary} />
        </Tappable>
        <Text style={{ fontSize: typeScale.title, fontWeight: weight.bold, color: c.text.primary }}>Profile</Text>
      </View>
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
            <Text style={[styles.displayName, { color: c.text.primary }]}>
              {profile?.full_name || (isCoach ? 'Coach' : 'Athlete')}
            </Text>
            {profile?.club && <Text style={[styles.clubText, { color: c.text.secondary }]}>{profile.club}</Text>}

            <View style={styles.badges}>
              <View style={styles.roleBadge}>
                <Text style={styles.roleText}>
                  {profile?.role === 'coach' ? 'COACH' : 'ATHLETE'}
                </Text>
              </View>
              {!isCoach && overallTier && (
                <TierBadge label={`${overallTier.label} · ${overallScore}`} color={overallTier.color} />
              )}
              {!isCoach && <StreakChip count={streak} />}
            </View>
          </View>
        </HeroCard>

        {/* ════════════════════════════════════════════════════════════════
            STATS GRID
            ════════════════════════════════════════════════════════════ */}
        {!isCoach && (
        <AlmanacCard kicker="CAREER STATS" accent={c.accent[500]}>
          <View style={styles.statsGrid}>
            <View style={styles.statItem}>
              <Text style={[styles.statNum, { color: c.text.primary }]}>{totalLogs}</Text>
              <Text style={[styles.statLabel, { color: c.text.muted }]}>LOGS</Text>
            </View>
            <View style={[styles.statDivider, { backgroundColor: c.glass.border }]} />
            <View style={styles.statItem}>
              <Text style={[styles.statNum, { color: c.green }]}>{pbCount}</Text>
              <Text style={[styles.statLabel, { color: c.text.muted }]}>PBs</Text>
            </View>
            <View style={[styles.statDivider, { backgroundColor: c.glass.border }]} />
            <View style={styles.statItem}>
              <Text style={[styles.statNum, { color: c.blue }]}>{uniqueMetrics}</Text>
              <Text style={[styles.statLabel, { color: c.text.muted }]}>METRICS</Text>
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
        )}

        {/* ── Physical profile ─────────────────────────────────────────
            ONE DNA implementation. The strip opens the full ladder (and the
            tests behind it) in a sheet — the same component Home renders, so
            the detail can't drift or duplicate. ──────────────────────────── */}
        {/* ── Competition record ──────────────────────────────────────
            Every result, including the ones that do not count. See
            ResultsTable for why a DNF has to be visible here. ─────────── */}
        {!isCoach && (
          <>
            <SectionLabel>Competition results</SectionLabel>
            <ResultsTable performances={performances} />

            <SectionLabel>Physical profile</SectionLabel>

            {!!metrics.length && (
              <MetricRail
                metrics={metrics}
                onDarkSurface={isDark}
                order={indicators}
                discipline={discipline}
                onCustomise={(key) => { setPickerFor(key); setPickerOpen(true) }}
              />
            )}

            <DnaStrip
              metrics={metrics}
              discipline={discipline}
              dob={profile?.dob}
              onLog={() => navigation.navigate('Log' as never)}
            />
          </>
        )}

        {!isCoach && limitingFactor && (
          <AlmanacCard kicker="FOCUS AREA" title="Limiting factor" accent={c.amber}>
            <View style={{ flexDirection: 'row', gap: 14, alignItems: 'flex-start' }}>
              <View style={{
                width: 38, height: 38, borderRadius: radius.full,
                backgroundColor: c.amber + '1F',
                alignItems: 'center', justifyContent: 'center',
              }}>
                <Ionicons name="warning" size={19} color={c.amber} />
              </View>
              <View style={{ flex: 1 }}>
                <Text style={{ fontSize: typeScale.body, fontWeight: weight.bold, color: c.text.primary }}>
                  {limitingFactor.axisLabel}
                </Text>
                <Text style={{ fontSize: typeScale.caption, color: c.text.secondary, marginTop: 2 }}>
                  Score: <Text style={{ color: c.amber, fontWeight: weight.bold }}>{limitingFactor.score}</Text>
                </Text>
                {!!limitingFactor.why && (
                  <Text style={{ fontSize: typeScale.caption, color: c.text.secondary, marginTop: 8, lineHeight: 19 }}>
                    {limitingFactor.why}
                  </Text>
                )}
              </View>
            </View>
          </AlmanacCard>
        )}

        {/* ════════════════════════════════════════════════════════════════
            PROFILE DETAILS — Editable info
            ════════════════════════════════════════════════════════════ */}
        <AlmanacCard kicker={isCoach ? 'COACH PROFILE' : 'ATHLETE PROFILE'}
          title="Details" accent={colors.blue}>
          {!editing && (
            <Tappable onPress={() => setEditing(true)} style={styles.editBtn}>
              <Ionicons name="pencil" size={13} color={colors.orange[400]} />
              <Text style={styles.editBtnText}>Edit</Text>
            </Tappable>
          )}

          {editing ? (
            <>
              <Field label="Full Name" value={form.full_name} onChange={(v) => setForm({ ...form, full_name: v })} />

              {/* The two fields the whole analysis layer depends on. Trajectory
                  has been telling athletes to "add your date of birth in
                  Profile" at a screen that had no such field. */}
              <DobField value={dob} onChange={setDob} />

              <View style={{ marginBottom: spacing.lg }}>
                <Text style={{
                  fontSize: typeScale.label, letterSpacing: 2, textTransform: 'uppercase',
                  color: colors.text.muted, fontWeight: weight.medium, marginBottom: 8,
                }}>I compete in</Text>
                <View style={{ flexDirection: 'row', gap: 8 }}>
                  {([['M', "Men's"], ['F', "Women's"]] as const).map(([v, l]) => (
                    <Tappable
                      key={v}
                      onPress={() => setSex(v)}
                      accessibilityLabel={`${l} category${sex === v ? ', selected' : ''}`}
                      style={{
                        flex: 1, minHeight: 44, alignItems: 'center', justifyContent: 'center',
                        borderRadius: radius.control,
                        backgroundColor: sex === v ? colors.orange[500] : colors.bg.primary,
                        borderWidth: 1,
                        borderColor: sex === v ? colors.orange[500] : colors.glass.border,
                      }}
                    >
                      <Text style={{
                        fontSize: typeScale.caption, fontWeight: weight.bold,
                        color: sex === v ? '#FFFFFF' : colors.text.secondary,
                      }}>{l}</Text>
                    </Tappable>
                  ))}
                </View>
              </View>

              <Field label="Club" value={form.club} onChange={(v) => setForm({ ...form, club: v })} />
              <Field label="Country" value={form.country} onChange={(v) => setForm({ ...form, country: v })} />
              <Field label="Height (cm)" value={form.height_cm} onChange={(v) => setForm({ ...form, height_cm: v })} keyboard="decimal-pad" />
              <Field label="Weight (kg)" value={form.weight_kg} onChange={(v) => setForm({ ...form, weight_kg: v })} keyboard="decimal-pad" />

              <View style={styles.btnRow}>
                <Tappable style={styles.cancelBtn} onPress={() => setEditing(false)}>
                  <Text style={styles.cancelBtnText}>Cancel</Text>
                </Tappable>
                <Tappable style={styles.saveBtn} onPress={handleSave} disabled={saving}>
                  <Text style={styles.saveBtnText}>{saving ? 'Saving…' : 'Save'}</Text>
                </Tappable>
              </View>
            </>
          ) : (
            <>
              {!isCoach && (
                <>
                  <InfoRow
                    icon="calendar-number-outline" label="Date of birth"
                    value={profile?.dob
                      ? `${new Date(profile.dob).toLocaleDateString('en-GB', { day: 'numeric', month: 'short', year: 'numeric' })} · ${ageFromDob(profile.dob)} yrs`
                      : 'Not set — tap Edit'}
                  />
                  <InfoRow
                    icon="body-outline" label="Category"
                    value={profile?.sex === 'F' ? "Women's" : profile?.sex === 'M' ? "Men's" : 'Not set — tap Edit'}
                  />
                </>
              )}
              <InfoRow icon="flag-outline" label="Country" value={profile?.country || '—'} />
              {!isCoach && (
                <>
                  <InfoRow icon="fitness-outline" label="Height" value={physical.height_cm ? `${physical.height_cm} cm` : '—'} />
                  <InfoRow icon="scale-outline" label="Weight" value={physical.weight_kg ? `${physical.weight_kg} kg` : '—'} />
                  <InfoRow icon="calendar-outline" label="Tracking since" value={
                    firstLog
                      ? new Date(firstLog.recorded_at).toLocaleDateString('en-GB', { month: 'short', year: 'numeric' })
                      : '—'
                  } />
                </>
              )}
              {isCoach && (
                <InfoRow icon="people-outline" label="Club" value={(profile as any)?.club_school || '—'} />
              )}
              <InfoRow icon="mail-outline" label="Email" value={user?.email || '—'} />
            </>
          )}
        </AlmanacCard>

        {/* ════════════════════════════════════════════════════════════════
            COACH CONNECTIONS — approve requests + manage who sees your data
            ════════════════════════════════════════════════════════════ */}
        <View style={{ marginBottom: spacing.lg }}>
          <AthleteCoachLinks />
        </View>

        {/* ════════════════════════════════════════════════════════════════
            SIGN OUT
            ════════════════════════════════════════════════════════════ */}
        {/* Renders nothing at all when this athlete has no coach — see the
            component for why an empty relationship should not get a screen. */}
        <SharingSettings userId={user?.id} />

        <Tappable style={[styles.signOutBtn, { borderColor: c.red + '20', backgroundColor: c.red + '04' }]}
          onPress={handleSignOut}>
          <Ionicons name="log-out-outline" size={18} color={c.red} />
          <Text style={[styles.signOutText, { color: c.red }]}>Sign Out</Text>
        </Tappable>

        {/* Version */}
        <Text style={[styles.version, { color: c.text.dimmed }]}>bnchmrkd. v0.1.0</Text>

        <View style={{ height: 30 }} />
      </ScrollView>

      <IndicatorPicker
        visible={pickerOpen}
        onClose={() => setPickerOpen(false)}
        groups={metricGroups}
        chosen={indicators}
        onChange={changeIndicators}
        focusKey={pickerFor}
      />
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
  // Profile is a TAB on the coach side (where the floating bar hovers over
  // it) and a pushed screen on the athlete side (where it doesn't). The
  // clearance is harmless on the pushed one and necessary on the tab.
  content: { padding: spacing.lg, paddingBottom: TAB_BAR_CLEARANCE },

  // Avatar hero
  avatarSection: { alignItems: 'center' },
  avatarRing: {
    width: 92,
    height: 92,
    borderRadius: radius.full,
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
    borderRadius: radius.full,
    backgroundColor: colors.orange[500],
    alignItems: 'center',
    justifyContent: 'center',
  },
  avatarText: { fontSize: typeScale.figure, fontWeight: weight.bold, color: '#fff' },
  displayName: { fontSize: typeScale.stat, fontWeight: weight.bold, color: colors.text.primary },
  clubText: { color: colors.text.secondary, fontSize: typeScale.body, marginTop: 4 },
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
    fontSize: typeScale.label,
    fontWeight: weight.bold,
    letterSpacing: 1.5,
    color: colors.orange[400],
  },

  // Stats grid
  statsGrid: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  statItem: { flex: 1, alignItems: 'center' },
  statNum: { fontSize: typeScale.stat, fontWeight: weight.bold, color: colors.text.primary, letterSpacing: -0.5 },
  statLabel: {
    fontSize: typeScale.micro,
    letterSpacing: 2,
    color: colors.text.muted,
    fontWeight: weight.medium,
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
  dnaLabel: { color: colors.text.secondary, fontSize: typeScale.caption, fontWeight: weight.medium },
  dnaScoreRow: { flexDirection: 'row', alignItems: 'center', gap: 5 },
  dnaDot: { width: 5, height: 5, borderRadius: radius.full },
  dnaTierText: { fontSize: typeScale.label, fontWeight: weight.bold },
  dnaNoData: { color: colors.text.dimmed, fontSize: typeScale.caption },

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
  editBtnText: { color: colors.orange[400], fontSize: typeScale.caption, fontWeight: weight.medium },

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
    borderRadius: radius.chip,
    backgroundColor: 'rgba(255,255,255,0.04)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  infoLabel: { color: colors.text.secondary, fontSize: typeScale.body, flex: 1 },
  infoValue: { color: colors.text.primary, fontSize: typeScale.body, fontWeight: weight.medium },

  // Edit form
  fieldWrap: { marginBottom: spacing.md },
  fieldLabel: {
    fontSize: typeScale.label,
    letterSpacing: 1.5,
    textTransform: 'uppercase',
    color: colors.text.muted,
    fontWeight: weight.medium,
    marginBottom: 6,
  },
  fieldInput: {
    backgroundColor: 'rgba(255,255,255,0.03)',
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.08)',
    borderRadius: radius.chip,
    paddingHorizontal: spacing.md,
    paddingVertical: 12,
    fontSize: typeScale.body,
    color: colors.text.primary,
  },
  btnRow: { flexDirection: 'row', gap: spacing.md, marginTop: spacing.md },
  cancelBtn: {
    flex: 1,
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.08)',
    borderRadius: radius.control,
    paddingVertical: 14,
    alignItems: 'center',
  },
  cancelBtnText: { color: colors.text.secondary, fontWeight: weight.medium },
  saveBtn: {
    flex: 1,
    backgroundColor: colors.orange[500],
    borderRadius: radius.control,
    paddingVertical: 14,
    alignItems: 'center',
    shadowColor: colors.orange[500],
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.3,
    shadowRadius: 8,
  },
  saveBtnText: { color: '#fff', fontWeight: weight.bold },

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
    borderRadius: radius.control,
    backgroundColor: 'rgba(251,113,133,0.04)',
  },
  signOutText: { color: colors.red, fontSize: typeScale.body, fontWeight: weight.medium },

  // Theme toggle
  themeRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginTop: spacing.md,
  },
  themeLabel: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
  },
  themeLabelText: {
    fontSize: typeScale.body,
    fontWeight: weight.medium,
    color: colors.text.primary,
  },
  themeToggle: {
    flexDirection: 'row',
    backgroundColor: 'rgba(255,255,255,0.03)',
    borderRadius: radius.control,
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.06)',
    padding: 3,
  },
  themeOption: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    paddingHorizontal: 10,
    paddingVertical: 6,
    borderRadius: radius.control - 2,
  },
  themeOptionActive: {
    backgroundColor: colors.orange[500] + '15',
  },
  themeOptionText: {
    fontSize: typeScale.label,
    fontWeight: weight.medium,
    color: colors.text.dimmed,
  },
  themeOptionTextActive: {
    color: colors.orange[500],
  },

  // Version
  version: {
    textAlign: 'center',
    color: colors.text.dimmed,
    fontSize: typeScale.label,
    marginTop: spacing.lg,
    letterSpacing: 1,
  },
})
