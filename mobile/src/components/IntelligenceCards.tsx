// ═══════════════════════════════════════════════════════════════════════
// INTELLIGENCE CARDS — Phase 1 engagement features
// Post-log DNA Shift · Metric Impact · What-If Explorer ·
// Next Milestone · Smart Insight Engine
//
// Every card connects physical metrics → competition performance.
// The diary is the input; the intelligence is the product.
// ═══════════════════════════════════════════════════════════════════════

import React, { useState, useMemo, useEffect, useRef } from 'react'
import {
  View,
  Text,
  StyleSheet,
  Animated,
  TouchableOpacity,
  Platform,
} from 'react-native'
import { Ionicons } from '@expo/vector-icons'
import { colors, spacing, radius } from '../lib/theme'
import {
  buildDnaProfile,
  scoreToTier,
  findLimitingFactor,
  estimateSprintImpact,
  expectedMetric,
  performancePercentile,
  performancePosition,
  RADAR_AXES,
  REFERENCE_RANGES,
  disciplineFamily,
  isLowerBetter,
} from '../lib/disciplineScience'
import { AlmanacCard, MonoKicker } from './ui'

// ═══════════════════════════════════════════════════════════════════════
// 1. DNA SHIFT CARD — Shows axis changes after logging a metric
// ═══════════════════════════════════════════════════════════════════════

interface DnaShiftProps {
  beforeMetrics: any[] // metrics BEFORE the new log
  afterMetrics: any[]  // metrics INCLUDING the new log
  visible: boolean
}

export function DnaShiftCard({ beforeMetrics, afterMetrics, visible }: DnaShiftProps) {
  const fadeAnim = useRef(new Animated.Value(0)).current
  const slideAnim = useRef(new Animated.Value(30)).current

  useEffect(() => {
    if (visible) {
      Animated.parallel([
        Animated.timing(fadeAnim, { toValue: 1, duration: 500, useNativeDriver: false }),
        Animated.spring(slideAnim, { toValue: 0, useNativeDriver: false, friction: 8 }),
      ]).start()
    } else {
      fadeAnim.setValue(0)
      slideAnim.setValue(30)
    }
  }, [visible])

  const shifts = useMemo(() => {
    if (!visible || beforeMetrics.length === 0) return []

    const toProfile = (mets: any[]) =>
      buildDnaProfile(
        mets.map((m) => ({
          metric_key: m.metric_key,
          metric_label: m.metric_key?.replace(/_/g, ' '),
          value: m.value,
          unit: m.unit,
          recorded_at: m.recorded_at || m._recorded_at,
        }))
      )

    const before = toProfile(beforeMetrics)
    const after = toProfile(afterMetrics)

    const result: { axis: string; label: string; before: number; after: number; delta: number; tier: string; tierColor: string }[] = []

    for (const axis of RADAR_AXES) {
      const bScore = before[axis.key]?.score ?? null
      const aScore = after[axis.key]?.score ?? null
      if (aScore == null) continue
      const delta = bScore != null ? aScore - bScore : 0
      const tier = scoreToTier(aScore)
      result.push({
        axis: axis.key,
        label: axis.label,
        before: bScore ?? 0,
        after: aScore,
        delta,
        tier: tier.label,
        tierColor: tier.color,
      })
    }

    return result.filter((s) => s.after > 0).sort((a, b) => Math.abs(b.delta) - Math.abs(a.delta))
  }, [beforeMetrics, afterMetrics, visible])

  if (!visible || shifts.length === 0) return null

  const movedAxes = shifts.filter((s) => s.delta !== 0)
  const totalDelta = movedAxes.reduce((sum, s) => sum + s.delta, 0)

  return (
    <Animated.View style={[styles.dnaShiftWrap, { opacity: fadeAnim, transform: [{ translateY: slideAnim }] }]}>
      <View style={styles.dnaShiftHeader}>
        <View style={styles.dnaShiftIconWrap}>
          <Ionicons name="pulse" size={16} color={colors.orange[500]} />
        </View>
        <View style={{ flex: 1 }}>
          <Text style={styles.dnaShiftKicker}>DNA PROFILE UPDATED</Text>
          <Text style={styles.dnaShiftTitle}>
            {movedAxes.length > 0
              ? `${movedAxes.length} ${movedAxes.length === 1 ? 'axis' : 'axes'} shifted`
              : 'Profile recalculated'}
          </Text>
        </View>
        {totalDelta > 0 && (
          <View style={styles.dnaShiftBadge}>
            <Ionicons name="trending-up" size={12} color={colors.green} />
            <Text style={styles.dnaShiftBadgeText}>+{totalDelta.toFixed(0)}</Text>
          </View>
        )}
      </View>

      {shifts.slice(0, 4).map((s) => (
        <View key={s.axis} style={styles.dnaAxisRow}>
          <Text style={styles.dnaAxisLabel}>{s.label}</Text>
          <View style={styles.dnaBarTrack}>
            <View style={[styles.dnaBarFill, { width: `${Math.min(s.after, 100)}%`, backgroundColor: s.tierColor }]} />
          </View>
          <Text style={[styles.dnaAxisScore, { color: s.tierColor }]}>{Math.round(s.after)}</Text>
          {s.delta !== 0 && (
            <Text style={[styles.dnaAxisDelta, { color: s.delta > 0 ? colors.green : colors.red }]}>
              {s.delta > 0 ? '+' : ''}{s.delta.toFixed(1)}
            </Text>
          )}
        </View>
      ))}
    </Animated.View>
  )
}

// ═══════════════════════════════════════════════════════════════════════
// 2. METRIC IMPACT LINE — Shows what a logged metric means for performance
// ═══════════════════════════════════════════════════════════════════════

interface MetricImpactProps {
  metricKey: string
  value: number
  unit: string
  discipline: string | null
  sex: string
  visible: boolean
}

export function MetricImpactLine({ metricKey, value, unit, discipline, sex, visible }: MetricImpactProps) {
  if (!visible || !discipline || !metricKey) return null

  // Get what this metric should be for their performance level
  const percentile = performancePercentile(value, discipline, sex)
  const position = performancePosition(value, discipline, sex)

  // Try to get expected metric for semifinalist level (~70th percentile)
  let expectedVal: number | null = null
  try {
    expectedVal = expectedMetric(metricKey, 70)
  } catch { }

  // Try to estimate sprint impact if they improved to the expected value
  let impactSecs: number | null = null
  if (expectedVal != null && expectedVal !== value) {
    try {
      impactSecs = estimateSprintImpact(metricKey, value, expectedVal)
    } catch { }
  }

  // Only show if we have useful data
  if (!percentile && !expectedVal) return null

  const ref = REFERENCE_RANGES?.[metricKey]
  const isTime = ref?.lowerBetter

  return (
    <View style={styles.impactWrap}>
      <View style={styles.impactDot}>
        <Ionicons name="analytics" size={12} color={colors.teal} />
      </View>
      <View style={{ flex: 1 }}>
        {percentile != null && percentile > 0 && (
          <Text style={styles.impactText}>
            <Text style={{ color: colors.teal, fontWeight: '700' }}>{value}{unit}</Text>
            {' '}places you at the{' '}
            <Text style={{ color: colors.text.primary, fontWeight: '600' }}>
              {ordinal(percentile)} percentile
            </Text>
            {' '}for {discipline} athletes.
          </Text>
        )}
        {expectedVal != null && Math.abs(expectedVal - value) > 0.01 && (
          <Text style={styles.impactSubText}>
            Semifinalist average: <Text style={{ color: colors.amber, fontWeight: '600' }}>{expectedVal.toFixed(1)}{unit}</Text>
            {impactSecs != null && Math.abs(impactSecs) > 0.001 && (
              <Text> · Bridging the gap could save ~{Math.abs(impactSecs).toFixed(2)}s</Text>
            )}
          </Text>
        )}
      </View>
    </View>
  )
}

function ordinal(n: number): string {
  const s = ['th', 'st', 'nd', 'rd']
  const v = n % 100
  return n + (s[(v - 20) % 10] || s[v] || s[0])
}

// ═══════════════════════════════════════════════════════════════════════
// 3. WHAT-IF SCENARIO EXPLORER — Drag a metric, see projected impact
// ═══════════════════════════════════════════════════════════════════════

interface WhatIfProps {
  dnaProfile: any
  discipline: string | null
  pb: number | null
  sex: string
  metrics: any[]
}

export function WhatIfExplorer({ dnaProfile, discipline, pb, sex, metrics }: WhatIfProps) {
  // Find the limiting factor
  const perfPercentile = pb && discipline ? performancePercentile(pb, discipline, sex) : null
  const limiting = findLimitingFactor(dnaProfile, discipline, perfPercentile)

  const [sliderValue, setSliderValue] = useState<number | null>(null)
  const [expanded, setExpanded] = useState(false)

  // Reset slider when limiting factor changes
  useEffect(() => {
    if (limiting?.currentValue != null) {
      setSliderValue(limiting.currentValue)
    }
  }, [limiting?.metricKey])

  if (!limiting || !discipline) return null

  const { metricKey, metricLabel, unit, currentValue, expectedValue, axisLabel, gap, score } = limiting as any
  if (currentValue == null || expectedValue == null) return null

  const ref = REFERENCE_RANGES?.[metricKey]
  const lower = ref?.lowerBetter || false
  const current = sliderValue ?? currentValue

  // Calculate impact for slider position
  let impact = 0
  try {
    impact = estimateSprintImpact(metricKey, currentValue, current)
  } catch { }

  // Build step increments for the slider buttons
  const stepSize = Math.abs(expectedValue - currentValue) / 5
  const isImproved = lower ? current < currentValue : current > currentValue

  const steps = []
  for (let i = 0; i <= 5; i++) {
    const val = lower
      ? currentValue - stepSize * i
      : currentValue + stepSize * i
    steps.push(Math.round(val * 100) / 100)
  }

  return (
    <AlmanacCard kicker="WHAT IF" title="Scenario Explorer" accent={colors.purple}>
      <TouchableOpacity onPress={() => setExpanded(!expanded)} activeOpacity={0.8}>
        <View style={styles.whatIfHeader}>
          <View style={styles.whatIfLimitIcon}>
            <Ionicons name="flask" size={16} color={colors.purple} />
          </View>
          <View style={{ flex: 1 }}>
            <Text style={styles.whatIfQuestion}>
              What if your <Text style={{ color: colors.purple, fontWeight: '700' }}>{metricLabel || metricKey?.replace(/_/g, ' ')}</Text> improved?
            </Text>
            <Text style={styles.whatIfSub}>
              Your weakest axis: {axisLabel} ({score}/100)
            </Text>
          </View>
          <Ionicons name={expanded ? 'chevron-up' : 'chevron-down'} size={16} color={colors.text.muted} />
        </View>
      </TouchableOpacity>

      {expanded && (
        <View style={styles.whatIfBody}>
          {/* Current vs Target */}
          <View style={styles.whatIfCompare}>
            <View style={styles.whatIfStatBox}>
              <Text style={styles.whatIfStatLabel}>NOW</Text>
              <Text style={styles.whatIfStatVal}>{currentValue}</Text>
              <Text style={styles.whatIfStatUnit}>{unit}</Text>
            </View>
            <Ionicons name="arrow-forward" size={16} color={colors.text.dimmed} />
            <View style={styles.whatIfStatBox}>
              <Text style={[styles.whatIfStatLabel, { color: colors.purple }]}>TARGET</Text>
              <Text style={[styles.whatIfStatVal, { color: colors.purple }]}>{Math.round(current * 100) / 100}</Text>
              <Text style={styles.whatIfStatUnit}>{unit}</Text>
            </View>
          </View>

          {/* Step buttons as slider alternative (works on web + native) */}
          <View style={styles.whatIfSliderRow}>
            {steps.map((val, i) => {
              const isActive = Math.abs(val - current) < stepSize * 0.3
              return (
                <TouchableOpacity
                  key={i}
                  style={[
                    styles.whatIfStep,
                    isActive && { backgroundColor: colors.purple + '20', borderColor: colors.purple + '50' },
                  ]}
                  onPress={() => setSliderValue(val)}
                  activeOpacity={0.7}
                >
                  <Text style={[styles.whatIfStepText, isActive && { color: colors.purple }]}>
                    {i === 0 ? 'Now' : `+${i}`}
                  </Text>
                </TouchableOpacity>
              )
            })}
          </View>

          {/* Impact result */}
          {Math.abs(impact) > 0.001 && (
            <View style={styles.whatIfResult}>
              <View style={styles.whatIfResultGlow} />
              <Ionicons name="speedometer" size={18} color={colors.green} />
              <View style={{ flex: 1 }}>
                <Text style={styles.whatIfResultTitle}>Estimated Impact</Text>
                <Text style={styles.whatIfResultValue}>
                  <Text style={{ color: colors.green, fontWeight: '800', fontSize: 18 }}>
                    {impact > 0 ? '-' : '+'}{Math.abs(impact).toFixed(3)}s
                  </Text>
                  <Text style={styles.whatIfResultDisc}> on your {discipline}</Text>
                </Text>
              </View>
            </View>
          )}

          {/* Context line */}
          <Text style={styles.whatIfContext}>
            Based on published correlations between {metricLabel || metricKey?.replace(/_/g, ' ')} and {discipline} performance
            across Olympic-pipeline athletes.
          </Text>
        </View>
      )}
    </AlmanacCard>
  )
}

// ═══════════════════════════════════════════════════════════════════════
// 4. NEXT MILESTONE TARGET — Nearest meaningful target
// ═══════════════════════════════════════════════════════════════════════

interface MilestoneProps {
  dnaProfile: any
  discipline: string | null
  pb: number | null
  sex: string
}

export function NextMilestone({ dnaProfile, discipline, pb, sex }: MilestoneProps) {
  const milestones = useMemo(() => {
    const results: { type: string; label: string; gap: string; color: string; icon: string }[] = []

    // 1. Next tier in competition performance
    if (pb && discipline) {
      const pos = performancePosition(pb, discipline, sex)
      if (pos?.nextTier) {
        const gap = Math.abs(pos.nextTier.value - pb)
        const lowerBetter = isLowerBetter(discipline)
        results.push({
          type: 'competition',
          label: `${pos.nextTier.label} zone`,
          gap: lowerBetter
            ? `-${gap.toFixed(2)}s to go`
            : `+${gap.toFixed(2)}m to go`,
          color: colors.orange[500],
          icon: 'trophy',
        })
      }
    }

    // 2. Next DNA tier on weakest axis
    if (dnaProfile) {
      let weakest: { axis: string; label: string; score: number; toNext: number; nextLabel: string } | null = null
      for (const axis of RADAR_AXES) {
        const data = dnaProfile[axis.key]
        if (!data?.score) continue
        const tier = scoreToTier(data.score)
        if (tier.toNext != null && (!weakest || tier.toNext < weakest.toNext)) {
          weakest = {
            axis: axis.key,
            label: axis.label,
            score: data.score,
            toNext: tier.toNext,
            nextLabel: tier.nextTier || 'next tier',
          }
        }
      }
      if (weakest) {
        results.push({
          type: 'dna',
          label: `${weakest.label} → ${weakest.nextLabel}`,
          gap: `${weakest.toNext} points to go`,
          color: colors.teal,
          icon: 'fitness',
        })
      }
    }

    return results
  }, [dnaProfile, discipline, pb, sex])

  if (milestones.length === 0) return null

  return (
    <View style={styles.milestoneWrap}>
      <View style={styles.milestoneHeader}>
        <Ionicons name="flag" size={12} color={colors.amber} />
        <Text style={styles.milestoneKicker}>NEXT MILESTONE</Text>
      </View>
      {milestones.slice(0, 2).map((m, i) => (
        <View key={i} style={styles.milestoneRow}>
          <View style={[styles.milestoneIcon, { backgroundColor: m.color + '15' }]}>
            <Ionicons name={m.icon as any} size={14} color={m.color} />
          </View>
          <View style={{ flex: 1 }}>
            <Text style={styles.milestoneLabel}>{m.label}</Text>
            <Text style={[styles.milestoneGap, { color: m.color }]}>{m.gap}</Text>
          </View>
        </View>
      ))}
    </View>
  )
}

// ═══════════════════════════════════════════════════════════════════════
// 5. SMART DAILY INSIGHT — Dynamic, data-driven daily tip
// ═══════════════════════════════════════════════════════════════════════

interface SmartInsightProps {
  dnaProfile: any
  discipline: string | null
  pb: number | null
  sex: string
  totalLogs: number
  streak: number
  metrics: any[]
}

export function SmartDailyInsight({ dnaProfile, discipline, pb, sex, totalLogs, streak, metrics }: SmartInsightProps) {
  const insight = useMemo(() => {
    // Priority 1: No data yet — welcome
    if (totalLogs === 0) {
      return {
        icon: '🧬',
        text: "Welcome to bnchmrkd. Start by logging your first physical metric — even one data point begins to build your DNA profile. Each metric you add sharpens the analysis engine.",
      }
    }

    // Priority 2: Not enough axes — nudge breadth
    const activeAxes = RADAR_AXES.filter((a: any) => dnaProfile?.[a.key]?.score != null)
    if (activeAxes.length < 3) {
      const missing = RADAR_AXES.filter((a: any) => !dnaProfile?.[a.key]?.score)
        .map((a: any) => a.label)
        .slice(0, 2)
      return {
        icon: '🔬',
        text: `Your DNA profile has ${activeAxes.length} of 6 axes. Add ${missing.join(' and ')} metrics to unlock your full physical blueprint and more accurate limiting-factor analysis.`,
      }
    }

    // Priority 3: Axis imbalance insight
    const scores = RADAR_AXES
      .map((a: any) => ({ key: a.key, label: a.label, score: dnaProfile?.[a.key]?.score ?? null }))
      .filter((s) => s.score != null)

    if (scores.length >= 3) {
      const sorted = [...scores].sort((a, b) => b.score! - a.score!)
      const strongest = sorted[0]
      const weakest = sorted[sorted.length - 1]
      const gap = strongest.score! - weakest.score!

      if (gap > 30) {
        return {
          icon: '⚖️',
          text: `Your ${strongest.label} (${strongest.score}/100) outpaces your ${weakest.label} (${weakest.score}/100) by ${gap} points. Research shows closing large axis gaps yields faster competition improvements than pushing already-strong qualities higher.`,
        }
      }

      // Priority 4: Limiting factor with sprint impact
      if (discipline) {
        const limiting = findLimitingFactor(dnaProfile, discipline, null)
        if (limiting?.estImpactSec) {
          return {
            icon: '🎯',
            text: `Your ${limiting.axisLabel} axis (${limiting.score}/100) is your biggest limiting factor for ${discipline}. Improving ${limiting.metricLabel || limiting.metricKey?.replace(/_/g, ' ')} from ${limiting.currentValue} to ${limiting.expectedValue} could save ~${Math.abs(limiting.estImpactSec).toFixed(2)}s.`,
          }
        }
      }
    }

    // Priority 5: Streak acknowledgment
    if (streak >= 7) {
      return {
        icon: '🔥',
        text: `${streak}-day streak. Athletes who maintain consistent logging identify trajectory inflections 40% faster and can benchmark against rivals sooner. Your data compounds.`,
      }
    }

    // Priority 6: Recent trend insight
    const recentMetrics = metrics.slice(0, 20)
    const recentKeys = new Set(recentMetrics.map((m) => m.metric_key))
    if (recentKeys.size >= 3) {
      const categorySet = new Set<string>()
      for (const k of recentKeys) {
        const ax = RADAR_AXES.find((a: any) =>
          dnaProfile?.[a.key]?.metrics?.some((m: any) => m.key === k)
        )
        if (ax) categorySet.add(ax.label)
      }
      if (categorySet.size >= 2) {
        return {
          icon: '📊',
          text: `You've logged across ${categorySet.size} physical qualities recently (${[...categorySet].join(', ')}). Multi-axis development is the hallmark of elite athletic profiles. Keep broadening your data.`,
        }
      }
    }

    // Fallback
    return {
      icon: '🧪',
      text: `Consistency beats intensity. Athletes who log 3+ times per week see their trajectory patterns emerge faster and can benchmark against rivals sooner. You have ${totalLogs} total entries — keep building.`,
    }
  }, [dnaProfile, discipline, pb, totalLogs, streak, metrics])

  return (
    <View style={styles.insightRow}>
      <Text style={styles.insightIcon}>{insight.icon}</Text>
      <Text style={styles.insightText}>{insight.text}</Text>
    </View>
  )
}

// ═══════════════════════════════════════════════════════════════════════
// STYLES
// ═══════════════════════════════════════════════════════════════════════

const styles = StyleSheet.create({
  // ── DNA Shift Card ──
  dnaShiftWrap: {
    backgroundColor: 'rgba(249,115,22,0.04)',
    borderWidth: 1,
    borderColor: 'rgba(249,115,22,0.15)',
    borderRadius: radius.xl,
    padding: spacing.lg,
    marginTop: spacing.lg,
  },
  dnaShiftHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    marginBottom: spacing.md,
  },
  dnaShiftIconWrap: {
    width: 32,
    height: 32,
    borderRadius: 10,
    backgroundColor: 'rgba(249,115,22,0.12)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  dnaShiftKicker: {
    fontSize: 8,
    letterSpacing: 2,
    color: colors.orange[400],
    fontWeight: '700',
  },
  dnaShiftTitle: {
    fontSize: 14,
    fontWeight: '600',
    color: colors.text.primary,
    marginTop: 2,
  },
  dnaShiftBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    backgroundColor: 'rgba(52,211,153,0.1)',
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: radius.full,
    borderWidth: 1,
    borderColor: 'rgba(52,211,153,0.2)',
  },
  dnaShiftBadgeText: {
    fontSize: 12,
    fontWeight: '700',
    color: colors.green,
  },
  dnaAxisRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    paddingVertical: 6,
  },
  dnaAxisLabel: {
    width: 80,
    fontSize: 11,
    fontWeight: '600',
    color: colors.text.secondary,
    textTransform: 'capitalize',
  },
  dnaBarTrack: {
    flex: 1,
    height: 6,
    borderRadius: 3,
    backgroundColor: 'rgba(255,255,255,0.04)',
    overflow: 'hidden',
  },
  dnaBarFill: {
    height: '100%',
    borderRadius: 3,
  },
  dnaAxisScore: {
    width: 28,
    fontSize: 12,
    fontWeight: '700',
    textAlign: 'right',
  },
  dnaAxisDelta: {
    width: 36,
    fontSize: 11,
    fontWeight: '700',
    textAlign: 'right',
  },

  // ── Metric Impact ──
  impactWrap: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: 10,
    backgroundColor: 'rgba(45,212,191,0.06)',
    borderWidth: 1,
    borderColor: 'rgba(45,212,191,0.15)',
    borderRadius: radius.lg,
    padding: spacing.md,
    marginTop: spacing.md,
  },
  impactDot: {
    width: 24,
    height: 24,
    borderRadius: 8,
    backgroundColor: 'rgba(45,212,191,0.12)',
    alignItems: 'center',
    justifyContent: 'center',
    marginTop: 2,
  },
  impactText: {
    fontSize: 13,
    color: colors.text.secondary,
    lineHeight: 19,
  },
  impactSubText: {
    fontSize: 12,
    color: colors.text.muted,
    lineHeight: 18,
    marginTop: 4,
  },

  // ── What-If ──
  whatIfHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
  },
  whatIfLimitIcon: {
    width: 36,
    height: 36,
    borderRadius: 11,
    backgroundColor: 'rgba(167,139,250,0.1)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  whatIfQuestion: {
    fontSize: 14,
    color: colors.text.primary,
    fontWeight: '500',
  },
  whatIfSub: {
    fontSize: 11,
    color: colors.text.muted,
    marginTop: 2,
  },
  whatIfBody: {
    marginTop: spacing.lg,
    paddingTop: spacing.md,
    borderTopWidth: 1,
    borderTopColor: 'rgba(255,255,255,0.04)',
  },
  whatIfCompare: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 20,
    marginBottom: spacing.lg,
  },
  whatIfStatBox: {
    alignItems: 'center',
    backgroundColor: 'rgba(255,255,255,0.02)',
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.06)',
    borderRadius: radius.lg,
    paddingHorizontal: 24,
    paddingVertical: 14,
    minWidth: 100,
  },
  whatIfStatLabel: {
    fontSize: 8,
    letterSpacing: 2,
    fontWeight: '700',
    color: colors.text.dimmed,
    marginBottom: 4,
  },
  whatIfStatVal: {
    fontSize: 22,
    fontWeight: '800',
    color: colors.text.primary,
    letterSpacing: -0.5,
  },
  whatIfStatUnit: {
    fontSize: 10,
    color: colors.text.muted,
    fontWeight: '600',
    marginTop: 2,
  },
  whatIfSliderRow: {
    flexDirection: 'row',
    gap: 6,
    justifyContent: 'center',
    marginBottom: spacing.lg,
  },
  whatIfStep: {
    paddingHorizontal: 14,
    paddingVertical: 8,
    borderRadius: radius.full,
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.08)',
    backgroundColor: 'rgba(255,255,255,0.02)',
  },
  whatIfStepText: {
    fontSize: 11,
    fontWeight: '600',
    color: colors.text.muted,
  },
  whatIfResult: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 14,
    backgroundColor: 'rgba(52,211,153,0.06)',
    borderWidth: 1,
    borderColor: 'rgba(52,211,153,0.2)',
    borderRadius: radius.lg,
    padding: spacing.lg,
    marginBottom: spacing.md,
    position: 'relative',
    overflow: 'hidden',
  },
  whatIfResultGlow: {
    position: 'absolute',
    top: -30,
    right: -30,
    width: 80,
    height: 80,
    borderRadius: 40,
    backgroundColor: colors.green,
    opacity: 0.06,
  },
  whatIfResultTitle: {
    fontSize: 9,
    letterSpacing: 1.5,
    fontWeight: '700',
    color: colors.text.muted,
    textTransform: 'uppercase',
  },
  whatIfResultValue: {
    fontSize: 14,
    color: colors.text.primary,
    marginTop: 4,
  },
  whatIfResultDisc: {
    fontSize: 13,
    fontWeight: '400',
    color: colors.text.secondary,
  },
  whatIfContext: {
    fontSize: 10,
    color: colors.text.dimmed,
    lineHeight: 15,
    fontStyle: 'italic',
  },

  // ── Next Milestone ──
  milestoneWrap: {
    backgroundColor: 'rgba(251,191,36,0.04)',
    borderWidth: 1,
    borderColor: 'rgba(251,191,36,0.12)',
    borderRadius: radius.xl,
    padding: spacing.lg,
    marginBottom: spacing.md,
  },
  milestoneHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    marginBottom: spacing.md,
  },
  milestoneKicker: {
    fontSize: 8,
    letterSpacing: 2,
    fontWeight: '700',
    color: colors.amber,
  },
  milestoneRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    paddingVertical: 8,
  },
  milestoneIcon: {
    width: 32,
    height: 32,
    borderRadius: 10,
    alignItems: 'center',
    justifyContent: 'center',
  },
  milestoneLabel: {
    fontSize: 13,
    fontWeight: '600',
    color: colors.text.primary,
  },
  milestoneGap: {
    fontSize: 12,
    fontWeight: '700',
    marginTop: 2,
  },

  // ── Smart Insight ──
  insightRow: { flexDirection: 'row', gap: 12, alignItems: 'flex-start' },
  insightIcon: { fontSize: 22, marginTop: 2 },
  insightText: { color: colors.text.secondary, fontSize: 14, lineHeight: 21, flex: 1 },
})
