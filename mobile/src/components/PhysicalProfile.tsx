// ═══════════════════════════════════════════════════════════════════════
// WHAT YOU ARE MADE OF — the inputs to the trajectory.
//
// This block spent a while on Profile, which is a settings screen wearing a
// profile's name: sign-out, theme, sharing controls and an edit form, with
// the athlete's own physical data wedged in the middle. Nobody goes to
// settings to look at their sprint numbers.
//
// It belongs on Trajectory, under the discipline cards, because it is the
// same subject one level down. Speed and power PRODUCE the sprint time; the
// limiting factor is the sentence "here is what is holding this trajectory
// back". Per-discipline analysis sits behind a discipline card. This is the
// whole athlete, so it sits in the whole-athlete view.
//
// Self-contained on purpose — it loads its own metrics and its own saved ring
// order. TrajectoryScreen is 1,265 lines already and did not need another
// query, another effect and another sheet threaded through it.
// ═══════════════════════════════════════════════════════════════════════

import React, { useCallback, useEffect, useMemo, useState } from 'react'
import { View, Text } from 'react-native'
import { Ionicons } from '@expo/vector-icons'
import { selectFrom } from '../lib/supabase'
import { onImage, onDark, radius, spacing, rhythm, typeScale, weight } from '../lib/theme'
import { SectionLabel, GlassPanel, MonoKicker, Tappable } from './ui'
import { MetricRail } from './OuraSections'
import DnaStrip from './DnaCard'
import IndicatorPicker from './IndicatorPicker'
import { loadIndicators, saveIndicators } from '../lib/indicators'
import { groupMetrics } from '../lib/metricSemantics'
import { buildDnaProfile, findLimitingFactor } from '../lib/disciplineScience'
import { tapFeedback } from '../lib/haptics'

export default function PhysicalProfile({
  athleteId, discipline, dob, onLog,
}: {
  athleteId?: string | null
  /** Only used to say why a quality matters for THIS athlete's event. */
  discipline?: string | null
  dob?: string | null
  onLog: () => void
}) {
  const [metrics, setMetrics] = useState<any[]>([])
  const [loaded, setLoaded] = useState(false)
  const [indicators, setIndicators] = useState<string[]>([])
  const [pickerFor, setPickerFor] = useState<string | null>(null)
  const [pickerOpen, setPickerOpen] = useState(false)

  useEffect(() => {
    if (!athleteId) { setMetrics([]); setLoaded(true); return }
    let cancelled = false
    selectFrom('athlete_metrics', {
      filter: `athlete_id=eq.${athleteId}`,
      order: 'recorded_at.desc',
      limit: '500',
    })
      .then((rows) => { if (!cancelled) setMetrics(Array.isArray(rows) ? rows : []) })
      .catch(() => { if (!cancelled) setMetrics([]) })
      .finally(() => { if (!cancelled) setLoaded(true) })
    return () => { cancelled = true }
  }, [athleteId])

  // The saved ring order. The rail falls back to its automatic order while
  // this is in flight, so a slow read never leaves the rings blank.
  useEffect(() => {
    if (!athleteId) { setIndicators([]); return }
    let cancelled = false
    loadIndicators(athleteId).then((keys) => { if (!cancelled) setIndicators(keys) })
    return () => { cancelled = true }
  }, [athleteId])

  // Written through on every edit rather than on dismiss: the sheet can be
  // swiped away, and a swipe is not a cancel.
  const changeIndicators = useCallback((keys: string[]) => {
    setIndicators(keys)
    if (athleteId) saveIndicators(athleteId, keys)
  }, [athleteId])

  const metricGroups = useMemo(() => groupMetrics(metrics), [metrics])

  const limiting = useMemo(() => {
    if (!metrics.length) return null
    const forDna = metrics.map((m) => ({
      metric_key: m.metric_key,
      metric_label: m.metric_key?.replace(/_/g, ' '),
      value: m.value,
      unit: m.unit,
      recorded_at: m.recorded_at,
    }))
    return findLimitingFactor(buildDnaProfile(forDna), null, null)
  }, [metrics])

  // Nothing at all until the query has answered. A section heading that
  // appears and then collapses is worse than one that arrives late.
  if (!loaded) return null

  if (!metrics.length) {
    return (
      <>
        <SectionLabel color={onImage.dim}>Athlete DNA</SectionLabel>
        <Tappable
          onPress={() => { tapFeedback(); onLog() }}
          accessibilityLabel="No physical tests yet. Log one."
          style={{ marginBottom: rhythm.section }}
        >
          <GlassPanel tone="deep" intensity={24} radius={radius.card} style={{ padding: 16 }}>
            <Text style={{
              fontSize: typeScale.title, fontWeight: weight.bold,
              color: onImage.ink,
            }}>
              No physical tests yet
            </Text>
            <Text style={{ fontSize: typeScale.body, color: onImage.muted, marginTop: 4, lineHeight: 21 }}>
              A sprint, a jump, a lift — one test starts the profile that
              explains the marks above.
            </Text>
            <Text style={{
              fontSize: typeScale.label, letterSpacing: 1.6, textTransform: 'uppercase',
              color: onDark.accent, fontWeight: weight.medium, marginTop: 12,
            }}>
              Log a test →
            </Text>
          </GlassPanel>
        </Tappable>
      </>
    )
  }

  return (
    <>
      <SectionLabel color={onImage.dim}>Athlete DNA</SectionLabel>

      <MetricRail
        metrics={metrics}
        onDarkSurface
        order={indicators}
        discipline={discipline}
        onCustomise={(key) => { setPickerFor(key); setPickerOpen(true) }}
      />

      <DnaStrip
        metrics={metrics}
        discipline={discipline}
        dob={dob}
        onLog={onLog}
        onImage
        noKicker
      />

      {/* The one sentence this whole block exists to produce. */}
      {!!limiting && (
        <GlassPanel
          tone="deep"
          intensity={24}
          radius={radius.card}
          style={{ padding: 16, marginBottom: rhythm.section }}
        >
          <MonoKicker color={onImage.dim}>Focus area</MonoKicker>
          <View style={{ flexDirection: 'row', gap: 14, alignItems: 'flex-start', marginTop: 10 }}>
            <View style={{
              width: 38, height: 38, borderRadius: radius.full,
              backgroundColor: 'rgba(245,158,11,0.18)',
              alignItems: 'center', justifyContent: 'center',
            }}>
              <Ionicons name="warning" size={19} color="#F59E0B" />
            </View>
            <View style={{ flex: 1 }}>
              <Text style={{ fontSize: typeScale.body, fontWeight: weight.bold, color: onImage.ink }}>
                {limiting.axisLabel}
              </Text>
              <Text style={{ fontSize: typeScale.caption, color: onImage.muted, marginTop: 2 }}>
                Score <Text style={{ color: '#F59E0B', fontWeight: weight.bold }}>{limiting.score}</Text>
                {' '}— your lowest measured quality
              </Text>
            </View>
          </View>
        </GlassPanel>
      )}

      <IndicatorPicker
        visible={pickerOpen}
        onClose={() => setPickerOpen(false)}
        groups={metricGroups}
        chosen={indicators}
        onChange={changeIndicators}
        focusKey={pickerFor}
      />
    </>
  )
}
