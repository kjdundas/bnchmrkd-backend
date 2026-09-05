// ═══════════════════════════════════════════════════════════════════════
// SHARING — the athlete's side of the coach relationship.
//
// Only rendered when there IS a coach. A row of switches governing a
// relationship you do not have is a screen that teaches you to worry about
// nothing, and it invites someone to switch things off pre-emptively before
// they ever meet the person it would have affected.
//
// Every switch says what it costs. "Pain and injury" in particular is
// written as a consequence and not as a warning — an athlete is entitled to
// keep an injury to themselves, and a toggle that nags is a toggle people
// route around by simply not logging the injury at all, which is worse for
// them than the private version.
//
// The saving is optimistic and per-switch. A Save button on a privacy screen
// is a trap: people flip a switch, see it move, and leave.
// ═══════════════════════════════════════════════════════════════════════

import React, { useEffect, useState, useCallback } from 'react'
import { View, Text, StyleSheet, ActivityIndicator } from 'react-native'
import { Ionicons } from '@expo/vector-icons'
import { useTheme } from '../contexts/ThemeContext'
import { Tappable, MonoKicker } from './ui'
import InfoDot from './InfoDot'
import { spacing, radius, typeScale, weight } from '../lib/theme'
import { tapFeedback } from '../lib/haptics'
import { callRpc } from '../lib/supabase'
import {
  fetchSharing, saveSharing, summaryOf, SHARE_CATEGORIES,
  ALL_SHARED, type Sharing, type ShareKey,
} from '../lib/sharing'

export default function SharingSettings({ userId }: { userId?: string | null }) {
  const { colors } = useTheme()
  const [coaches, setCoaches] = useState<any[] | null>(null)
  const [sharing, setSharing] = useState<Sharing>({ ...ALL_SHARED })
  const [busy, setBusy] = useState<ShareKey | null>(null)
  const [failed, setFailed] = useState<ShareKey | null>(null)

  const load = useCallback(async () => {
    if (!userId) { setCoaches([]); return }
    const [c, s] = await Promise.all([
      callRpc('my_coaches').catch(() => []),
      fetchSharing(userId),
    ])
    setCoaches(Array.isArray(c) ? c : [])
    setSharing(s)
  }, [userId])

  useEffect(() => { load() }, [load])

  const toggle = async (key: ShareKey) => {
    if (busy) return
    tapFeedback()
    const next = { ...sharing, [key]: !sharing[key] }
    // Optimistic: the switch moves now, and puts itself back if the write
    // fails. A privacy control that lags reads as broken, and a broken
    // privacy control is one people stop trusting entirely.
    setSharing(next); setBusy(key); setFailed(null)
    try {
      await saveSharing(userId!, next)
    } catch {
      setSharing(sharing)
      setFailed(key)
    } finally {
      setBusy(null)
    }
  }

  if (coaches === null) return null            // still loading; say nothing
  if (coaches.length === 0) return null        // no coach, nothing to govern

  const names = coaches.map((c: any) => c.coach_name).filter(Boolean)
  const who = names.length === 1 ? names[0]
    : names.length === 2 ? `${names[0]} and ${names[1]}`
    : `${names.length} coaches`

  return (
    <View style={[s.wrap, { borderColor: colors.glass.border, backgroundColor: colors.bg.card }]}>
      <View style={s.head}>
        <Ionicons name="lock-closed-outline" size={13} color={colors.accent[500]} />
        <MonoKicker color={colors.text.muted}>{`Sharing with ${who}`}</MonoKicker>
        <InfoDot term="sharing" size={13} />
      </View>

      <Text style={[s.summary, { color: colors.text.secondary }]}>{summaryOf(sharing)}</Text>

      {/* Said once, at the top, rather than as a caveat on each row. */}
      <Text style={[s.always, { color: colors.text.muted }]}>
        Your competition results are always shared — that is what a coach is for.
        Everything else is yours to decide.
      </Text>

      {SHARE_CATEGORIES.map((cat) => {
        const on = sharing[cat.key]
        return (
          <View key={cat.key} style={[s.row, { borderTopColor: colors.glass.divider }]}>
            <Ionicons
              name={cat.icon as any} size={17}
              color={on ? colors.accent[500] : colors.text.dimmed}
              style={{ marginTop: 2 }}
            />
            <View style={{ flex: 1 }}>
              <Text style={[s.label, { color: colors.text.primary }]}>{cat.label}</Text>
              <Text style={[s.detail, { color: colors.text.muted }]}>
                {on ? cat.detail : cat.ifOff}
              </Text>
              {failed === cat.key && (
                <Text style={[s.failed, { color: colors.red }]}>
                  Could not save that — check your connection and try again.
                </Text>
              )}
            </View>

            <Tappable
              onPress={() => toggle(cat.key)}
              accessibilityRole="switch"
              accessibilityState={{ checked: on, disabled: busy === cat.key }}
              accessibilityLabel={`${cat.label}. ${on ? 'Shared with your coach' : 'Not shared'}`}
              accessibilityHint={on ? cat.ifOff : cat.detail}
              style={[s.track, {
                backgroundColor: on ? colors.accent[500] : colors.glass.bg,
                borderColor: on ? colors.accent[500] : colors.glass.border,
              }]}
            >
              {busy === cat.key
                ? <ActivityIndicator size="small" color={on ? '#FFFFFF' : colors.text.muted} />
                : <View style={[s.knob, {
                    backgroundColor: on ? '#FFFFFF' : colors.text.dimmed,
                    alignSelf: on ? 'flex-end' : 'flex-start',
                  }]} />}
            </Tappable>
          </View>
        )
      })}

      <Text style={[s.foot, { color: colors.text.dimmed }]}>
        Changes apply immediately. Anything your coach already wrote down
        stays with them — this controls what the app shows, not their memory.
      </Text>
    </View>
  )
}

const s = StyleSheet.create({
  // No horizontal margin: ProfileScreen's content already pads by spacing.lg
  // and adding it again would inset this card further than every sibling.
  wrap: {
    marginTop: spacing.lg,
    borderRadius: radius.card, borderWidth: 1, padding: 16,
  },
  head: { flexDirection: 'row', alignItems: 'center', gap: 7 },
  summary: { fontSize: typeScale.body, fontWeight: weight.medium, marginTop: 9, lineHeight: 20 },
  always: { fontSize: typeScale.caption, lineHeight: 18, marginTop: 7 },
  row: {
    flexDirection: 'row', alignItems: 'flex-start', gap: 12,
    paddingTop: 14, marginTop: 14, borderTopWidth: 1,
  },
  label: { fontSize: typeScale.body, fontWeight: weight.bold },
  detail: { fontSize: typeScale.caption, lineHeight: 18, marginTop: 2 },
  failed: { fontSize: typeScale.caption, marginTop: 5, fontWeight: weight.medium },
  track: {
    width: 46, height: 28, borderRadius: radius.full, borderWidth: 1,
    padding: 2, justifyContent: 'center',
  },
  knob: { width: 22, height: 22, borderRadius: radius.full },
  foot: { fontSize: typeScale.label, lineHeight: 17, marginTop: 16 },
})
