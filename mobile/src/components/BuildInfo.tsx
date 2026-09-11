// ═══════════════════════════════════════════════════════════════════════
// BUILD INFO — which code is this phone actually running?
//
// The line this replaces said "bnchmrkd. v0.1.0", hard-coded, and it was
// the only version information anywhere in the app. It could not be wrong,
// because it never changed; it also could not be right, for the same
// reason.
//
// That was survivable while the only tester was Keenan. It stopped being
// survivable the day an OTA update went out and nobody — not the tester,
// not the person reading the report — could tell whether the phone had
// picked it up. A fix shipped at 14:30 and a bug report filed at 14:45 are
// unrelatable events without this, and the honest answer to "is that still
// broken?" becomes "open the app and look at a chart and guess".
//
// So: the running update's ID, the channel it came from, and the runtime
// version it is pinned to, taken from expo-updates at runtime rather than
// typed into a string. A tester screenshots this and the report becomes
// specific.
//
// ── The two-launch problem ──────────────────────────────────────────
// fallbackToCacheTimeout is 0, which is the right setting — nobody should
// stare at a splash screen while a bundle downloads over hotel wifi. The
// cost is that a new update installs on one launch and runs on the NEXT,
// so a tester who opens the app once sees the old code and reports a bug
// that was fixed hours ago. The button below collapses that into one tap:
// check, download, restart. It is the single most useful control in a beta
// and it takes three calls.
// ═══════════════════════════════════════════════════════════════════════

import React, { useState } from 'react'
import { View, Text, StyleSheet, ActivityIndicator } from 'react-native'
import * as Updates from 'expo-updates'
import { Ionicons } from '@expo/vector-icons'
import { spacing, radius, typeScale, weight } from '../lib/theme'
import { useTheme } from '../contexts/ThemeContext'
import { Tappable } from './ui'

/**
 * Every one of these is a native constant, and in Expo Go or a dev client
 * expo-updates is disabled. Reading them is documented as safe — they come
 * back null — but this screen is the LAST place that should throw, because
 * it is where someone goes when something else already has.
 */
function safe<T>(read: () => T, fallback: T): T {
  try {
    const v = read()
    return v == null ? fallback : v
  } catch {
    return fallback
  }
}

/** The first segment of the UUID. Enough to tell two builds apart in a
 *  screenshot, short enough to sit on one line next to the version. */
const shortId = (id: string | null) => (id ? id.split('-')[0] : null)

const fmtDate = (d: Date | null) => {
  if (!d) return null
  try {
    return d.toLocaleString('en-GB', {
      day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit',
    })
  } catch {
    return null
  }
}

type Phase = 'idle' | 'checking' | 'downloading' | 'current' | 'error'

export default function BuildInfo() {
  const { colors: c } = useTheme()
  const [open, setOpen] = useState(false)
  const [phase, setPhase] = useState<Phase>('idle')
  const [problem, setProblem] = useState<string | null>(null)

  const enabled = safe(() => Updates.isEnabled, false)
  const updateId = safe<string | null>(() => Updates.updateId, null)
  const channel = safe<string | null>(() => Updates.channel, null)
  const runtime = safe<string | null>(() => Updates.runtimeVersion, null)
  const createdAt = safe<Date | null>(() => Updates.createdAt, null)
  const embedded = safe(() => Updates.isEmbeddedLaunch, false)
  const emergency = safe(() => Updates.isEmergencyLaunch, false)
  const emergencyWhy = safe<string | null>(() => Updates.emergencyLaunchReason, null)

  async function checkNow() {
    setProblem(null)
    try {
      setPhase('checking')
      const result = await Updates.checkForUpdateAsync()
      if (!result.isAvailable) { setPhase('current'); return }
      setPhase('downloading')
      await Updates.fetchUpdateAsync()
      // Does not return — the app restarts on the new bundle.
      await Updates.reloadAsync()
    } catch (e: any) {
      // Named, not swallowed. "Couldn't check" with no reason is how a
      // tester concludes the app is broken and stops reporting.
      setProblem(String(e?.message || e))
      setPhase('error')
    }
  }

  const line = [
    `v${runtime || '0.1.0'}`,
    shortId(updateId) || (embedded ? 'shipped build' : null),
  ].filter(Boolean).join(' · ')

  return (
    <View style={styles.wrap}>
      <Tappable
        onPress={() => setOpen((v) => !v)}
        accessibilityLabel="Build information — which version of the app this is"
        accessibilityState={{ expanded: open }}
        style={styles.summaryRow}
      >
        <Text style={[styles.version, { color: c.text.dimmed }]}>
          bnchmrkd. {line}
        </Text>
        <Ionicons
          name={open ? 'chevron-up' : 'chevron-down'}
          size={11}
          color={c.text.dimmed}
        />
      </Tappable>

      {open && (
        <View style={[styles.panel, { borderColor: c.text.dimmed + '22' }]}>
          {!enabled ? (
            <Text style={[styles.note, { color: c.text.muted }]}>
              Running from a development build, so over-the-air updates are
              switched off. This is the code on this machine, not the code on
              the server.
            </Text>
          ) : (
            <>
              {/* Selectable, not a copy button: expo-clipboard is a native
                  module and adding one would need a fresh binary, which is
                  precisely the thing this panel exists to avoid. Long-press
                  and copy works today, in the build people already have. */}
              <Row label="Update" value={updateId || '—'} c={c} mono />
              <Row label="Channel" value={channel || '—'} c={c} />
              <Row label="Runtime" value={runtime || '—'} c={c} />
              <Row label="Published" value={fmtDate(createdAt) || '—'} c={c} />
              {embedded && (
                <Text style={[styles.note, { color: c.text.muted }]}>
                  This is the bundle that shipped inside the build — no update
                  has been applied on top of it yet.
                </Text>
              )}
              {emergency && (
                <Text style={[styles.note, { color: c.red }]}>
                  Started in recovery mode: the last update failed to launch and
                  the app fell back to the bundle in the build.
                  {emergencyWhy ? ` ${emergencyWhy}` : ''}
                </Text>
              )}
            </>
          )}

          {enabled && (
            <Tappable
              onPress={checkNow}
              disabled={phase === 'checking' || phase === 'downloading'}
              style={[styles.btn, { borderColor: c.accent[500] + '33', backgroundColor: c.accent[500] + '0A' }]}
              accessibilityLabel="Check for an update and restart on it"
            >
              {phase === 'checking' || phase === 'downloading' ? (
                <ActivityIndicator size="small" color={c.accent[500]} />
              ) : (
                <Ionicons name="refresh-outline" size={14} color={c.accent[500]} />
              )}
              <Text style={[styles.btnText, { color: c.accent[500] }]}>
                {phase === 'checking' ? 'Checking…'
                  : phase === 'downloading' ? 'Downloading…'
                  : 'Check for update'}
              </Text>
            </Tappable>
          )}

          {phase === 'current' && (
            <Text style={[styles.note, { color: c.text.muted }]}>
              Already on the latest version.
            </Text>
          )}
          {phase === 'error' && (
            <Text style={[styles.note, { color: c.red }]}>
              Couldn't check: {problem}
            </Text>
          )}

          <Text style={[styles.note, { color: c.text.dimmed }]}>
            Found something wrong? Screenshot this panel with your report — it
            says exactly which code you were on.
          </Text>
        </View>
      )}
    </View>
  )
}

function Row({ label, value, c, mono }: {
  label: string; value: string; c: any; mono?: boolean
}) {
  return (
    <View style={styles.row}>
      <Text style={[styles.rowLabel, { color: c.text.dimmed }]}>{label}</Text>
      <Text
        selectable
        style={[
          styles.rowValue,
          { color: c.text.secondary },
          mono && { fontVariant: ['tabular-nums'], fontSize: typeScale.micro },
        ]}
      >
        {value}
      </Text>
    </View>
  )
}

const styles = StyleSheet.create({
  wrap: { marginTop: spacing.lg },
  summaryRow: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'center',
    gap: 5, paddingVertical: spacing.xs,
  },
  version: { fontSize: typeScale.label, letterSpacing: 0.4, textAlign: 'center' },
  panel: {
    marginTop: spacing.sm, marginHorizontal: spacing.lg,
    padding: spacing.md, borderRadius: radius.control, borderWidth: 1, gap: 6,
  },
  row: { flexDirection: 'row', alignItems: 'flex-start', gap: spacing.sm },
  rowLabel: {
    fontSize: typeScale.micro, letterSpacing: 0.8, textTransform: 'uppercase',
    fontWeight: weight.medium, width: 70,
  },
  rowValue: { flex: 1, fontSize: typeScale.label, lineHeight: 16 },
  note: { fontSize: typeScale.micro, lineHeight: 15, marginTop: 4 },
  btn: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'center',
    gap: 7, marginTop: spacing.sm, paddingVertical: 9,
    borderRadius: radius.chip, borderWidth: 1,
  },
  btnText: { fontSize: typeScale.label, fontWeight: weight.medium },
})
