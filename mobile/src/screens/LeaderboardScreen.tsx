// ═══════════════════════════════════════════════════════════════════════
// LEADERBOARD — where you sit, without showing you anyone else.
//
// The screen asks `board_position` for a rank and a field size and draws a
// ladder of POSITIONS. It never receives another athlete's name or mark, so
// there is nothing here to redact: the rows below and above you are empty by
// construction, not by styling.
//
// Rows are evenly spaced because they are ordinals. Spacing them by value —
// the obvious "nicer" chart — would leak: measure the pixels, use your own
// labelled mark as the scale, and everybody else's number falls out. That is
// why this looks like a race result rather than a graph, and it is the same
// reason a five-athlete floor exists in the database.
//
// Every empty state here is an ANSWER, not an error. "Not enough people yet"
// is a promise being kept.
// ═══════════════════════════════════════════════════════════════════════

import React, { useCallback, useEffect, useMemo, useState } from 'react'
import {
  View, Text, ScrollView, StyleSheet, RefreshControl, Animated,
} from 'react-native'
import { Ionicons } from '@expo/vector-icons'
import { useTheme } from '../contexts/ThemeContext'
import { useAuth } from '../contexts/AuthContext'
import ScreenBackdrop from '../components/ScreenBackdrop'
import { Tappable, MonoKicker, Stagger } from '../components/ui'
import { SafeAreaView } from 'react-native-safe-area-context'
import { TAB_BAR_CLEARANCE } from '../navigation/FloatingTabBar'
import AppHeader from '../components/AppHeader'
import { SkeletonCards, LoadFailed } from '../components/LoadState'
import CorpusStanding from '../components/CorpusStanding'
import FieldStrip from '../components/FieldStrip'
import InfoDot from '../components/InfoDot'
import { spacing, radius, onImage, typeScale, weight } from '../lib/theme'
import { tapFeedback } from '../lib/haptics'
import { selectFrom } from '../lib/supabase'
import { newTrouble, loadPhase } from '../lib/loadState'
import { ageFromDob } from '../lib/age'
import { getAgeGroup } from '../lib/performanceLevels'
import { formatMark } from '../lib/disciplineScience'
import { isRankable } from '../lib/leaderboard'
import {
  SCOPES, BAND_LABEL, fetchPosition, fetchScopeCounts, ordinal,
  explain, type Scope, type Kind, type Position, type ScopeCounts,
} from '../lib/boards'

export default function LeaderboardScreen() {
  const { colors } = useTheme()
  const { user } = useAuth()
  const scrollY = useState(new Animated.Value(0))[0]

  const [scope, setScope] = useState<Scope>('squad')
  const [kind, setKind] = useState<Kind>('performance')
  const [key, setKey] = useState<string>('')

  const [events, setEvents] = useState<string[]>([])
  const [metrics, setMetrics] = useState<{ key: string; label: string }[]>([])
  const [myAge, setMyAge] = useState<string | null>(null)
  const [myGender, setMyGender] = useState<string | null>(null)

  // Both on by default: an athlete's question is "how do I compare to people
  // like me", and widening is the deliberate act, not narrowing.
  const [sameAge, setSameAge] = useState(true)
  const [sameGender, setSameGender] = useState(true)

  const [pos, setPos] = useState<Position | null>(null)
  const [stripW, setStripW] = useState(0)

  // Placed on the board, or not. Drives which explanation the screen owes
  // you — the suppression rule belongs under a board that HAS placed you,
  // because `explain()` already gives it in full when one has not.
  const placed = pos?.rank != null && pos.field > 0

  // The mark the world-distribution is drawn against. Performances only:
  // a CMJ height has no World Athletics population to sit inside, and
  // pretending otherwise would be the most confident kind of wrong.
  const distMark = kind === 'performance' && pos?.value != null ? pos.value : null
  const [counts, setCounts] = useState<ScopeCounts | null>(null)
  const [loading, setLoading] = useState(true)
  const [failed, setFailed] = useState(false)
  const [busy, setBusy] = useState(false)

  // ── What this athlete can be ranked on ──────────────────────────────
  // Their own rows only — which they can always read. The board itself is
  // computed server-side; this is just the picker.
  const loadMine = useCallback(async () => {
    if (!user?.id) return
    setLoading(true); setFailed(false)
    const t = newTrouble()
    try {
      const [perfs, mets, profs] = await Promise.all([
        selectFrom('performances', { filter: `user_id=eq.${user.id}`, limit: '500' })
          .catch((e) => { t.note('performances', e); return [] }),
        selectFrom('athlete_metrics', { filter: `athlete_id=eq.${user.id}`, limit: '500' })
          .catch((e) => { t.note('metrics', e); return [] }),
        selectFrom('user_profiles', { filter: `id=eq.${user.id}`, limit: '1' })
          .catch((e) => { t.note('profile', e); return [] }),
      ])

      const evs = [...new Set((perfs as any[]).map((p) => String(p.discipline || '').trim()).filter(Boolean))].sort()
      setEvents(evs)

      const seen = new Map<string, string>()
      for (const m of mets as any[]) {
        const k = String(m.metric_key || '')
        if (k && isRankable(k) && !seen.has(k)) seen.set(k, String(m.metric_label || k))
      }
      setMetrics([...seen].map(([k, label]) => ({ key: k, label })))

      const p: any = (profs as any[])[0]
      const age = ageFromDob(p?.date_of_birth)
      setMyAge(age == null ? null : getAgeGroup(age))
      setMyGender(p?.gender ? String(p.gender).toUpperCase().startsWith('F') ? 'F' : 'M' : null)

      setKey((cur) => cur || evs[0] || '')
      setFailed(t.failed)
    } finally {
      setLoading(false)
    }
  }, [user?.id])

  useEffect(() => { loadMine() }, [loadMine])

  const ageGroups = useMemo(
    () => (sameAge && myAge ? [myAge] : []), [sameAge, myAge])
  const genders = useMemo(
    () => (sameGender && myGender ? [myGender] : []), [sameGender, myGender])

  // ── The board ───────────────────────────────────────────────────────
  const loadBoard = useCallback(async () => {
    if (!key) { setPos(null); setCounts(null); return }
    setBusy(true)
    try {
      const [p, c] = await Promise.all([
        fetchPosition({ scope, kind, key, ageGroups, genders }),
        fetchScopeCounts({ kind, key, ageGroups, genders }),
      ])
      setPos(p); setCounts(c); setFailed(false)
    } catch {
      setPos(null); setFailed(true)
    } finally {
      setBusy(false)
    }
  }, [scope, kind, key, ageGroups.join(), genders.join()])

  useEffect(() => { loadBoard() }, [loadBoard])

  const options = kind === 'performance'
    ? events.map((e) => ({ key: e, label: e }))
    : metrics

  const phase = loadPhase({ loading, failed, isEmpty: !options.length })

  return (
    // Same shell as every other athlete screen, which this one did not have.
    // A ScrollView as a direct child of the root has nothing pinned above it,
    // so content slides under the status bar the moment you scroll — padding
    // only ever positioned it correctly at rest, which is why the last fix
    // held for one screenshot and failed on the next. AppHeader lives OUTSIDE
    // the scroll view and stays put; it also gives Boards the way into
    // Profile that every other tab already had.
    <View style={{ flex: 1, backgroundColor: colors.bg.primary }}>
      <ScreenBackdrop scrollY={scrollY} image="discus" />
      <SafeAreaView style={{ flex: 1 }} edges={['top', 'left', 'right']}>
      <AppHeader onImage />

      {/* ── Pinned: the title, and every filter ───────────────────────
          These were inside the scroll view, so they slid under the header
          the moment the screen moved — twice fixed by padding, which only
          ever positions content at rest and does nothing once it scrolls.

          They are controls, not content. On a screen whose whole job is
          filtering, the filters scrolling away is wrong even without the
          collision: you cannot see what you are filtering by while you read
          the result. Outside the ScrollView they are pinned by
          construction, and no amount of scrolling can put them anywhere.

          The two-line lede went with them. It explained the privacy rule on
          every single visit, and the rule is already stated on the card when
          a board is too thin and in the note at the bottom when it is not. */}
      <View style={{ paddingHorizontal: spacing.lg, paddingTop: spacing.xs }}>
        <Text style={[s.h1, { color: onImage.ink }]}>Leaderboard</Text>
      </View>

      {phase === 'ready' && (
        <View style={{ paddingHorizontal: spacing.lg, paddingTop: spacing.sm, paddingBottom: spacing.md }}>
            {/* Scope */}
          <Stagger index={1}>
            <View style={[s.scope, { borderColor: colors.glass.border }]}>
              {SCOPES.map((sc) => {
                const on = sc.key === scope
                const n = counts?.[sc.key]
                return (
                  <Tappable
                    key={sc.key}
                    onPress={() => { tapFeedback(); setScope(sc.key) }}
                    accessibilityLabel={`${sc.label} leaderboard`}
                    accessibilityState={{ selected: on }}
                    style={[s.scopeBtn, on ? { backgroundColor: colors.accent[500] } : null] as any}
                  >
                    <Text style={[s.scopeText, { color: on ? '#0B0C18' : colors.text.muted }]}>
                      {sc.label}
                    </Text>
                    {n != null && !on && (
                      <Text style={[s.scopeN, { color: colors.text.muted }]}>{n}</Text>
                    )}
                  </Tappable>
                )
              })}
            </View>
          </Stagger>

          {/* Kind */}
          <Stagger index={2}>
            <View style={s.seg}>
              {(['performance', 'metric'] as Kind[]).map((k) => {
                const on = k === kind
                const label = k === 'performance' ? 'Performances' : 'Physical tests'
                const has = k === 'performance' ? events.length : metrics.length
                return (
                  <Tappable
                    key={k}
                    onPress={() => {
                      if (!has) return
                      tapFeedback(); setKind(k)
                      setKey(k === 'performance' ? events[0] || '' : metrics[0]?.key || '')
                    }}
                    disabled={!has}
                    accessibilityLabel={label}
                    accessibilityState={{ selected: on }}
                    style={[s.segBtn, {
                      borderColor: on ? colors.accent[500] + '4D' : colors.glass.border,
                      backgroundColor: on ? colors.accent[500] + '2E' : colors.glass.bg,
                      opacity: has ? 1 : 0.4,
                    }]}
                  >
                    <Text style={[s.segText, { color: on ? colors.text.primary : colors.text.muted }]}>
                      {label}
                    </Text>
                  </Tappable>
                )
              })}
            </View>
          </Stagger>

          {/* What, and who against */}
          <Stagger index={2}>
            <View style={s.chips}>
              {options.map((o) => {
                const on = o.key === key
                return (
                  <Tappable
                    key={o.key}
                    onPress={() => { tapFeedback(); setKey(o.key) }}
                    accessibilityLabel={o.label}
                    accessibilityState={{ selected: on }}
                    style={[s.chip, {
                      borderColor: on ? colors.accent[500] + '4D' : colors.glass.border,
                      backgroundColor: on ? colors.accent[500] + '2E' : colors.glass.bg,
                    }]}
                  >
                    <Text style={[s.chipText, {
                      color: on ? colors.text.primary : colors.text.secondary,
                      fontWeight: on ? weight.bold : weight.medium,
                    }]}>{o.label}</Text>
                  </Tappable>
                )
              })}
            </View>

            <View style={s.chips}>
              {!!myAge && (
                <Tappable
                  onPress={() => { tapFeedback(); setSameAge((v) => !v) }}
                  accessibilityLabel={`Compare within ${myAge}`}
                  accessibilityState={{ selected: sameAge }}
                  style={[s.chip, {
                    borderColor: sameAge ? colors.accent[500] + '4D' : colors.glass.border,
                    backgroundColor: sameAge ? colors.accent[500] + '2E' : colors.glass.bg,
                  }]}
                >
                  <Text style={[s.chipText, { color: sameAge ? colors.text.primary : colors.text.muted }]}>
                    {sameAge ? myAge : 'All ages'}
                  </Text>
                </Tappable>
              )}
              {!!myGender && (
                <Tappable
                  onPress={() => { tapFeedback(); setSameGender((v) => !v) }}
                  accessibilityLabel="Compare within your category"
                  accessibilityState={{ selected: sameGender }}
                  style={[s.chip, {
                    borderColor: sameGender ? colors.accent[500] + '4D' : colors.glass.border,
                    backgroundColor: sameGender ? colors.accent[500] + '2E' : colors.glass.bg,
                  }]}
                >
                  <Text style={[s.chipText, { color: sameGender ? colors.text.primary : colors.text.muted }]}>
                    {sameGender ? (myGender === 'F' ? 'Women' : 'Men') : 'All'}
                  </Text>
                </Tappable>
              )}
            </View>
          </Stagger>

        </View>
      )}

      <ScrollView
        contentContainerStyle={{ paddingBottom: TAB_BAR_CLEARANCE + spacing.xl }}
        refreshControl={
          <RefreshControl refreshing={false} onRefresh={() => { loadMine(); loadBoard() }}
            tintColor={colors.accent[500]} />
        }
        scrollEventThrottle={16}
        onScroll={Animated.event([{ nativeEvent: { contentOffset: { y: scrollY } } }],
          { useNativeDriver: false })}
      >

        {phase === 'loading' && (
          <View style={{ marginTop: 24 }}><SkeletonCards cards={2} /></View>
        )}

        {phase === 'failed' && (
          <View style={{ marginTop: 24 }}><LoadFailed onRetry={loadMine} /></View>
        )}

        {phase === 'empty' && (
          <Stagger index={1}>
            <View style={[s.card, { backgroundColor: colors.bg.card, borderColor: colors.glass.border }]}>
              <Text style={[s.emptyTitle, { color: colors.text.primary }]}>Nothing to rank yet</Text>
              <Text style={[s.emptyBody, { color: colors.text.secondary }]}>
                Log a competition result or a physical test and this fills in.
                A board needs five people before it can place you, so it may
                stay quiet for a while after that.
              </Text>
            </View>
          </Stagger>
        )}

        {phase === 'ready' && (
          <>
            {/* The board */}
            <Stagger index={3}>
              <View style={[s.card, {
                backgroundColor: colors.bg.card,
                borderColor: pos?.rank ? colors.accent[500] + '4D' : colors.glass.border,
                opacity: busy ? 0.55 : 1,
              }]}>
                <View style={s.cardHead}>
                  <Text style={[s.event, { color: colors.text.primary }]}>
                    {options.find((o) => o.key === key)?.label || key}
                  </Text>
                  <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6 }}>
                    <MonoKicker color={colors.text.muted}>
                      {SCOPES.find((x) => x.key === scope)?.label ?? ''}
                    </MonoKicker>
                    <InfoDot term="percentile" color={colors.text.muted} />
                  </View>
                </View>

                {pos?.rank ? (
                  <>
                    <View style={s.rankRow}>
                      <Text style={[s.rankN, { color: colors.text.primary }]}>{ordinal(pos.rank)}</Text>
                      <Text style={[s.rankOf, { color: colors.text.secondary }]}>
                        of {pos.field}{'\n'}
                        {scope === 'squad' ? 'in your squad' : `in your ${scope}`}
                      </Text>
                    </View>
                    {!!pos.band && (
                      <Text style={[s.band, { color: colors.accent[500] }]}>
                        {BAND_LABEL[pos.band]}
                      </Text>
                    )}

                    {/* The ladder that was here drew a full-width bar for
                        every position — eight grey bars with nothing in
                        them, because the device never receives anybody
                        else's value. A bar implies a quantity, so eight
                        empty ones read as data that failed to load, which
                        made a privacy guarantee look like a bug. This draws
                        only what is known: the size of the field, and which
                        one is you. */}
                    <View onLayout={(e) => {
                      const nw = Math.round(e.nativeEvent.layout.width)
                      if (nw && nw !== stripW) setStripW(nw)
                    }}>
                      {stripW > 0 && (
                        <FieldStrip
                          rank={pos.rank}
                          field={pos.field}
                          width={stripW}
                          accent={colors.accent[500]}
                          dim={colors.glass.border}
                          ink={colors.text.primary}
                          muted={colors.text.muted}
                        />
                      )}
                    </View>

                    <View style={[s.mine, { borderTopColor: colors.glass.border }]}>
                      <Text style={[s.mineL, { color: colors.text.secondary }]}>Your best</Text>
                      <Text style={[s.mineV, { color: colors.text.primary }]}>
                        {pos.value != null
                          ? (kind === 'performance' ? formatMark(pos.value, key) : pos.value)
                          : '—'}
                      </Text>
                    </View>
                  </>
                ) : (
                  <View style={s.empty}>
                    <Ionicons
                      name={pos?.reason === 'opted_out' ? 'eye-off-outline' : 'people-outline'}
                      size={22} color={colors.text.muted}
                    />
                    <Text style={[s.emptyTitle, { color: colors.text.primary, marginTop: 10 }]}>
                      {explain(pos || { reason: null } as any, scope).title}
                    </Text>
                    <Text style={[s.emptyBody, { color: colors.text.secondary }]}>
                      {explain(pos || { reason: null } as any, scope).body}
                    </Text>
                    {pos?.value != null && (
                      <View style={[s.mine, { borderTopColor: colors.glass.border }]}>
                        <Text style={[s.mineL, { color: colors.text.secondary }]}>Your best</Text>
                        <Text style={[s.mineV, { color: colors.text.primary }]}>
                          {kind === 'performance' ? formatMark(pos.value, key) : pos.value}
                        </Text>
                      </View>
                    )}
                  </View>
                )}
              </View>
            </Stagger>

            {/* ── The field ────────────────────────────────────────
                The board can only rank you against other bnchmrkd
                accounts, and with a squad of one that is four rows of
                filters over an apology. This does not wait for anybody
                else to sign up. */}
            {!!distMark && (
              <Stagger index={4}>
                <CorpusStanding
                  discipline={key}
                  sex={myGender}
                  mark={distMark}
                  colour={colors.accent[500]}
                  valueFmt={(v) => formatMark(v, key)}
                />
              </Stagger>
            )}

            {/* The suppression rule, said ONCE. `explain()` already gives it
                in full whenever a board is too thin, and this note repeated
                the same clause verbatim directly underneath — so the one
                screen that exists to explain a privacy promise was the one
                screen that said it twice. */}
            {placed && (
              <Stagger index={5}>
                <View style={[s.note, { borderColor: colors.glass.border, backgroundColor: colors.glass.bg }]}>
                  <Ionicons name="lock-closed-outline" size={13} color={colors.text.muted} />
                  <Text style={[s.noteText, { color: colors.text.muted }]}>
                    A board needs {pos?.minField ?? 5} people before it will place
                    you. Below that, a position would give away individual numbers.
                  </Text>
                </View>
              </Stagger>
            )}
          </>
        )}
      </ScrollView>
      </SafeAreaView>
    </View>
  )
}

const s = StyleSheet.create({
  h1: { fontSize: typeScale.figure, fontWeight: weight.bold, letterSpacing: -0.7, marginTop: 6 },

  scope: {
    flexDirection: 'row', gap: 4, marginHorizontal: spacing.lg,
    borderRadius: radius.full, borderWidth: 1, padding: 3,
    backgroundColor: 'rgba(255,255,255,0.05)',
  },
  scopeBtn: {
    flex: 1, minHeight: 34, borderRadius: radius.full,
    alignItems: 'center', justifyContent: 'center', flexDirection: 'row', gap: 5,
  },
  scopeText: { fontSize: typeScale.label, fontWeight: weight.bold, letterSpacing: 0.4 },
  scopeN: { fontSize: typeScale.micro, fontWeight: weight.bold, fontVariant: ['tabular-nums'] },

  seg: { flexDirection: 'row', gap: 7, marginHorizontal: spacing.lg, marginTop: 12 },
  segBtn: {
    flex: 1, minHeight: 40, borderRadius: radius.control ?? 10, borderWidth: 1,
    alignItems: 'center', justifyContent: 'center',
  },
  segText: { fontSize: typeScale.caption, fontWeight: weight.bold },

  chips: {
    flexDirection: 'row', flexWrap: 'wrap', gap: 7,
    marginHorizontal: spacing.lg, marginTop: 11,
  },
  chip: { minHeight: 34, paddingHorizontal: 12, borderRadius: radius.full, borderWidth: 1, justifyContent: 'center' },
  chipText: { fontSize: typeScale.caption },

  card: {
    marginHorizontal: spacing.lg, marginTop: 16,
    borderRadius: radius.card, borderWidth: 1, padding: 18,
  },
  cardHead: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginBottom: 14 },
  event: { fontSize: typeScale.body, fontWeight: weight.bold, letterSpacing: -0.2 },

  rankRow: { flexDirection: 'row', alignItems: 'baseline', gap: 11 },
  rankN: { fontSize: typeScale.mark, fontWeight: weight.bold, letterSpacing: -2.2, fontVariant: ['tabular-nums'] },
  rankOf: { fontSize: typeScale.caption, fontWeight: weight.medium, lineHeight: 18 },
  band: {
    fontSize: typeScale.label, fontWeight: weight.bold, letterSpacing: 1.2,
    textTransform: 'uppercase', marginTop: 9,
  },

  ladder: { marginTop: 16, gap: 3 },
  lrow: {
    flexDirection: 'row', alignItems: 'center', gap: 11,
    paddingHorizontal: 11, paddingVertical: 8, borderRadius: radius.chip, borderWidth: 1,
  },
  lpos: { fontSize: typeScale.label, fontWeight: weight.bold, width: 32, fontVariant: ['tabular-nums'] },
  lbar: { flex: 1, height: 5, borderRadius: radius.hair },
  lme: { fontSize: typeScale.label, fontWeight: weight.bold },
  gap: { textAlign: 'center', fontSize: typeScale.label, letterSpacing: 3, paddingVertical: 2 },

  empty: { alignItems: 'center', paddingVertical: 14 },
  emptyTitle: { fontSize: typeScale.body, fontWeight: weight.bold, textAlign: 'center' },
  emptyBody: { fontSize: typeScale.caption, lineHeight: 19.5, textAlign: 'center', marginTop: 6 },

  mine: {
    flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center',
    borderTopWidth: 1, paddingTop: 12, marginTop: 14, width: '100%',
  },
  mineL: { fontSize: typeScale.caption },
  mineV: { fontSize: typeScale.title, fontWeight: weight.bold, fontVariant: ['tabular-nums'] },

  note: {
    flexDirection: 'row', alignItems: 'flex-start', gap: 8,
    marginHorizontal: spacing.lg, marginTop: 12,
    borderWidth: 1, borderRadius: radius.control ?? 10, padding: 12,
  },
  noteText: { flex: 1, fontSize: typeScale.label, lineHeight: 17 },
})
