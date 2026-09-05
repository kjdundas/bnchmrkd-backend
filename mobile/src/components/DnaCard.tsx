// ═══════════════════════════════════════════════════════════════════════
// ATHLETE DNA — one implementation, two entry points.
//
// <DnaStrip/> is a compact, tappable summary: six bars, one per axis, height
// and colour carrying the score. Tapping it opens the full ladder in a sheet.
//
// Home and Profile both render the strip, so the detail lives in exactly one
// place. Previously Profile had a "DNA Summary" mini card AND a full ladder
// showing the same six numbers twice.
// ═══════════════════════════════════════════════════════════════════════

import React, { useMemo, useState, useRef, useEffect } from 'react'
import { View, Text, Modal, Animated, ScrollView, Dimensions } from 'react-native'
import { Ionicons } from '@expo/vector-icons'
import { useTheme } from '../contexts/ThemeContext'
import { spacing, radius, rhythm, numerals, elevation, onImage, onDark, typeScale, weight } from '../lib/theme'
import { DURATION, EASE, STAGGER_STEP, useReducedMotion } from '../lib/motion'
import { Tappable, MonoKicker, GlassPanel } from './ui'
import { AthleteDNALadder } from './HomeSections'
import { buildDnaProfile, RADAR_AXES, scoreToTier } from '../lib/disciplineScience'
import { MetricTrendCards } from './OuraSections'

const { height: SCREEN_H } = Dimensions.get('window')

export interface DnaAxis {
  key: string
  label: string
  score: number | null
  tier: { label: string; color: string } | null
}

/** Shared derivation so the strip and the sheet can never disagree. */
export function useDnaAxes(metrics: any[]): {
  axes: DnaAxis[]; active: DnaAxis[]; overall: number | null; overallTier: any
} {
  return useMemo(() => {
    const profile = buildDnaProfile(
      (metrics || []).map((m) => ({
        metric_key: m.metric_key,
        metric_label: m.metric_label || m.metric_key?.replace(/_/g, ' '),
        value: m.value,
        unit: m.unit,
        recorded_at: m.recorded_at,
      }))
    ) as Record<string, any>

    const axes: DnaAxis[] = RADAR_AXES.map((a: any) => {
      const score = profile[a.key]?.score ?? null
      return { key: a.key, label: a.label, score, tier: score != null ? scoreToTier(score) : null }
    })
    const active = axes.filter((a) => a.score != null)
    const overall = active.length >= 2
      ? Math.round(active.reduce((s, a) => s + (a.score as number), 0) / active.length)
      : null
    return { axes, active, overall, overallTier: overall != null ? scoreToTier(overall) : null }
  }, [metrics])
}

// ── One axis row ───────────────────────────────────────────────────
// Horizontal, tracked, and directly labelled. The previous version drew six
// tiny vertical stubs coloured by TIER, which failed on three counts:
//
//  1. No value was shown at all — the summary summarised nothing.
//  2. No track, so a bar had no scale to be read against. 37 and 80 looked
//     much the same because neither had a "full" to compare with.
//  3. The tier palette is CATEGORICAL applied to ORDINAL data, so it inverted
//     meaning: Strength 40 rendered teal ("good") while Top Speed 74 rendered
//     amber ("warning") — the weaker axis looked healthier than the stronger.
//
// Now length alone carries the score in a single hue, the value is printed,
// and colour is used once — to flag the focus axis — with a text label beside
// it so meaning never rests on colour alone.
function AxisRow({
  axis, index, isFocus, onImage: over,
}: { axis: DnaAxis; index: number; isFocus: boolean; onImage?: boolean }) {
  const { colors } = useTheme()
  const reduced = useReducedMotion()
  const anim = useRef(new Animated.Value(0)).current
  const pct = axis.score != null ? Math.max(0, Math.min(100, axis.score)) : 0

  useEffect(() => {
    if (reduced) { anim.setValue(1); return }
    const a = Animated.timing(anim, {
      toValue: 1, duration: DURATION.slow, delay: index * STAGGER_STEP,
      easing: EASE.sweep, useNativeDriver: false,
    })
    a.start()
    return () => a.stop()
  }, [reduced, pct, index])

  const w = anim.interpolate({ inputRange: [0, 1], outputRange: ['0%', `${pct}%`] })
  // Indigo-500 on a dark ground loses almost all of its chroma — the bright
  // indigo is the accent that survives there. Amber still carries the focus.
  const fill = isFocus ? colors.amber : over ? onDark.accent : colors.accent[500]
  const untested = axis.score == null

  return (
    <View style={{ flexDirection: 'row', alignItems: 'center', gap: 10, paddingVertical: 5 }}>
      <Text
        numberOfLines={1}
        style={{ width: 88, fontSize: typeScale.caption, color: over ? onImage.muted : colors.text.secondary, fontWeight: weight.medium }}
      >
        {axis.label}
      </Text>

      {/* Track gives the score a scale to be read against. */}
      <View style={{
        flex: 1, height: 7, borderRadius: radius.hair,
        backgroundColor: over ? 'rgba(255,255,255,0.16)' : colors.glass.divider,
        overflow: 'hidden',
      }}>
        {!untested && (
          <Animated.View style={{ width: w, height: '100%', borderRadius: radius.hair, backgroundColor: fill }} />
        )}
      </View>

      <Text style={{
        width: 26, textAlign: 'right', fontSize: typeScale.caption, fontWeight: weight.bold,
        color: untested
          ? (over ? onImage.dim : colors.text.dimmed)
          : (over ? onImage.ink : colors.text.primary),
        ...numerals,
      }}>
        {untested ? '—' : axis.score}
      </Text>
    </View>
  )
}

// ── The sheet ──────────────────────────────────────────────────────
function DnaSheet({
  visible, onClose, metrics, discipline, dob, onLog,
}: {
  visible: boolean; onClose: () => void; metrics: any[]
  discipline?: string | null; dob?: string | null; onLog?: () => void
}) {
  const { colors } = useTheme()
  const reduced = useReducedMotion()
  const rise = useRef(new Animated.Value(0)).current

  useEffect(() => {
    if (!visible) { rise.setValue(0); return }
    if (reduced) { rise.setValue(1); return }
    const a = Animated.timing(rise, {
      toValue: 1, duration: DURATION.base, easing: EASE.out, useNativeDriver: true,
    })
    a.start()
    return () => a.stop()
  }, [visible, reduced])

  return (
    <Modal
      visible={visible}
      animationType={reduced ? 'none' : 'slide'}
      presentationStyle="pageSheet"
      onRequestClose={onClose}
    >
      <View style={{ flex: 1, backgroundColor: colors.bg.primary }}>
        {/* Grabber + close. A sheet must always offer an explicit dismiss,
            not just the swipe (Apple HIG escape-routes). */}
        <View style={{ alignItems: 'center', paddingTop: 10 }}>
          <View style={{ width: 36, height: 4, borderRadius: radius.full, backgroundColor: colors.glass.border }} />
        </View>
        <View style={{
          flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between',
          paddingHorizontal: spacing.lg, paddingTop: spacing.md, paddingBottom: spacing.sm,
        }}>
          <View>
            <MonoKicker>In detail</MonoKicker>
            <Text style={{ fontSize: typeScale.figure, fontWeight: weight.bold, color: colors.text.primary, letterSpacing: -0.5, marginTop: 4 }}>
              Athlete DNA
            </Text>
          </View>
          <Tappable
            onPress={onClose}
            accessibilityLabel="Close Athlete DNA"
            style={{
              width: 44, height: 44, borderRadius: radius.full, alignItems: 'center', justifyContent: 'center',
              backgroundColor: colors.glass.bg, borderWidth: 1, borderColor: colors.glass.border,
            }}
          >
            <Ionicons name="close" size={20} color={colors.text.secondary} />
          </Tappable>
        </View>

        <Animated.ScrollView
          contentContainerStyle={{ padding: spacing.lg, paddingBottom: 48 }}
          showsVerticalScrollIndicator={false}
          style={{
            opacity: rise,
            transform: [{ translateY: rise.interpolate({ inputRange: [0, 1], outputRange: [18, 0] }) }],
          }}
        >
          <AthleteDNALadder metrics={metrics} discipline={discipline} dob={dob} bare />

          {/* The tests behind the scores. This is the natural place for them —
              an axis score is only meaningful next to what produced it. */}
          <Text style={{
            fontSize: typeScale.label, letterSpacing: 2, textTransform: 'uppercase',
            color: colors.text.muted, fontWeight: weight.bold,
            marginTop: rhythm.block, marginBottom: rhythm.tight,
          }}>
            The tests behind these scores
          </Text>
          <MetricTrendCards metrics={metrics} limit={6} onLog={onLog} />
        </Animated.ScrollView>
      </View>
    </Modal>
  )
}

// ── The strip ──────────────────────────────────────────────────────
export default function DnaStrip({
  metrics, discipline, dob, onLog, onImage: over, noKicker = false,
}: {
  metrics: any[]
  discipline?: string | null
  dob?: string | null
  onLog?: () => void
  /** True when the strip sits over the stadium backdrop rather than on paper. */
  onImage?: boolean
  /** The section heading above already says "Athlete DNA". Two of the same
      words stacked is how one concept ends up reading as two features — the
      ladder inside already solves this with `bare`, and this is the same
      idea one level up. */
  noKicker?: boolean
}) {
  const { colors } = useTheme()
  const [open, setOpen] = useState(false)
  const { axes, active, overall, overallTier } = useDnaAxes(metrics)

  if (active.length === 0) return null

  const edge = [...active].sort((a, b) => (b.score as number) - (a.score as number))[0]
  // Lowest measured axis — the one thing this summary should actually tell you.
  const focus = [...active].sort((a, b) => (a.score as number) - (b.score as number))[0]

  const label =
    `Athlete DNA. Overall ${overall ?? 'not scored'}${overallTier ? ', ' + overallTier.label : ''}. ` +
    `Strongest ${edge?.label} ${edge?.score}. Focus ${focus?.label} ${focus?.score}. Open for detail.`

  const ink = over ? onImage.ink : colors.text.primary
  const sub = over ? onImage.muted : colors.text.secondary
  const dim = over ? onImage.dim : colors.text.muted
  const link = over ? onDark.accent : colors.accent[500]

  const body = (
    <>
      {/* Header: the one number, its tier, and the way in. */}
      <View style={{ flexDirection: 'row', alignItems: 'flex-start', justifyContent: 'space-between' }}>
        <View style={{ flex: 1 }}>
          {!noKicker && (
            <MonoKicker color={over ? onImage.dim : undefined}>Athlete DNA</MonoKicker>
          )}
          <View style={{ flexDirection: 'row', alignItems: 'baseline', gap: 8, marginTop: 4 }}>
            <Text style={{ fontSize: typeScale.figure, fontWeight: weight.bold, color: ink, letterSpacing: -0.6, ...numerals }}>
              {overall ?? '—'}
            </Text>
            {overallTier && (
              <Text style={{ fontSize: typeScale.body, fontWeight: weight.medium, color: sub }}>
                {overallTier.label}
              </Text>
            )}
            <Text style={{ fontSize: typeScale.caption, color: dim }}>
              · {active.length}/{axes.length} measured
            </Text>
          </View>
        </View>
        <View style={{ flexDirection: 'row', alignItems: 'center', gap: 3, marginTop: 4 }}>
          <Text style={{ fontSize: typeScale.caption, fontWeight: weight.medium, color: link }}>Open</Text>
          <Ionicons name="chevron-forward" size={15} color={link} />
        </View>
      </View>

      <View style={{
        height: 1, marginTop: 14, marginBottom: 8,
        backgroundColor: over ? onImage.divider : colors.glass.divider,
      }} />

      {axes.map((a, i) => (
        <AxisRow key={a.key} axis={a} index={i} isFocus={focus?.key === a.key} onImage={over} />
      ))}

      {/* Colour is never the only signal — the focus axis is named. */}
      {focus && (
        <View style={{ flexDirection: 'row', alignItems: 'center', gap: 7, marginTop: 12 }}>
          <View style={{ width: 8, height: 8, borderRadius: radius.full, backgroundColor: colors.amber }} />
          <Text style={{ fontSize: typeScale.caption, color: sub }}>
            <Text style={{ fontWeight: weight.bold, color: ink }}>{focus.label}</Text>
            {' is your focus area — lowest of the six.'}
          </Text>
        </View>
      )}
    </>
  )

  const pad = { paddingHorizontal: 18, paddingTop: 16, paddingBottom: 14, marginBottom: rhythm.section }

  return (
    <>
      {over ? (
        <GlassPanel
          tone="deep" intensity={22} radius={20}
          onPress={() => setOpen(true)}
          accessibilityLabel={label}
          style={pad}
        >
          {body}
        </GlassPanel>
      ) : (
        <Tappable
          onPress={() => setOpen(true)}
          accessibilityLabel={label}
          style={{
            backgroundColor: colors.glass.bg,
            borderRadius: radius.card, borderWidth: 1, borderColor: colors.glass.border,
            ...pad,
            ...elevation.raised,
          }}
        >
          {body}
        </Tappable>
      )}

      <DnaSheet
        visible={open}
        onClose={() => setOpen(false)}
        metrics={metrics}
        discipline={discipline}
        dob={dob}
        onLog={onLog}
      />
    </>
  )
}
