// ═══════════════════════════════════════════════════════════════════════
// bnchmrkd. — Mobile UI Component Library
// Premium dark-mode components matching the web brand language:
// Deep slate bg, frosted white-on-white cards, ambient glow orbs,
// gradient accent bars, mono-font kickers, single orange accent.
// ═══════════════════════════════════════════════════════════════════════

import React, { useEffect, useRef } from 'react'
import {
  View,
  Text,
  StyleSheet,
  Animated,
  ViewStyle,
  Dimensions,
} from 'react-native'
import { colors, spacing, radius, fonts } from '../lib/theme'

const { width: SCREEN_W } = Dimensions.get('window')
const ORANGE = colors.orange[500]

// ── Almanac Card (web brand card) ───────────────────────────────────
// Matches the web's AlmanacCard: frosted glass + accent bloom + header
// with kicker/title + gradient accent bar on right side.
interface AlmanacCardProps {
  children: React.ReactNode
  kicker?: string
  title?: string
  number?: string
  accent?: string
  style?: ViewStyle
  noPadding?: boolean
}

export function AlmanacCard({
  children,
  kicker,
  title,
  number,
  accent = ORANGE,
  style,
  noPadding,
}: AlmanacCardProps) {
  return (
    <View style={[styles.almanacCard, style]}>
      {/* Ambient glow bloom top-right */}
      <View
        style={[
          styles.glowOrb,
          {
            top: -40,
            right: -40,
            width: 120,
            height: 120,
            backgroundColor: accent,
            opacity: 0.06,
          },
        ]}
      />

      {/* Header with kicker + accent bar */}
      {(kicker || title) && (
        <View style={styles.almanacHeader}>
          <View style={{ flex: 1 }}>
            <Text style={styles.almanacKicker}>
              {number ? (
                <Text style={{ color: colors.text.dimmed }}>{number} · </Text>
              ) : null}
              {kicker}
            </Text>
            {title && <Text style={styles.almanacTitle}>{title}</Text>}
          </View>
          <View
            style={[
              styles.accentBar,
              { backgroundColor: accent },
            ]}
          />
        </View>
      )}

      <View style={[!noPadding && styles.almanacBody]}>{children}</View>
    </View>
  )
}

// ── Hero Card (gradient background with glow) ───────────────────────
// Matches the web TrajectoryHero: gradient bg, drifting orbs, shimmer
interface HeroCardProps {
  children: React.ReactNode
  style?: ViewStyle
}

export function HeroCard({ children, style }: HeroCardProps) {
  return (
    <View style={[styles.heroCard, style]}>
      {/* Drifting ambient orbs */}
      <View
        style={[
          styles.glowOrb,
          {
            top: -60,
            left: -60,
            width: 160,
            height: 160,
            backgroundColor: ORANGE,
            opacity: 0.12,
          },
        ]}
      />
      <View
        style={[
          styles.glowOrb,
          {
            bottom: -60,
            right: -60,
            width: 160,
            height: 160,
            backgroundColor: colors.blue,
            opacity: 0.06,
          },
        ]}
      />
      {/* Shimmer overlay */}
      <View style={styles.shimmerOverlay} />
      <View style={{ position: 'relative' }}>{children}</View>
    </View>
  )
}

// ── Glass Card (simpler frosted card) ───────────────────────────────
interface GlassCardProps {
  children: React.ReactNode
  style?: ViewStyle
  glowColor?: string
  noPadding?: boolean
}

export function GlassCard({ children, style, glowColor, noPadding }: GlassCardProps) {
  return (
    <View
      style={[
        styles.glassCard,
        glowColor && { borderColor: glowColor + '20' },
        noPadding && { padding: 0 },
        style,
      ]}
    >
      {glowColor && (
        <View
          style={[
            styles.glowOrb,
            {
              top: -30,
              right: -30,
              width: 100,
              height: 100,
              backgroundColor: glowColor,
              opacity: 0.06,
            },
          ]}
        />
      )}
      {children}
    </View>
  )
}

// ── Section Header ──────────────────────────────────────────────────
interface SectionHeaderProps {
  label: string
  color?: string
  right?: React.ReactNode
}

export function SectionHeader({ label, color, right }: SectionHeaderProps) {
  return (
    <View style={styles.sectionHeader}>
      <View style={styles.sectionHeaderLeft}>
        {color && <View style={[styles.sectionDot, { backgroundColor: color }]} />}
        <Text style={styles.sectionLabel}>{label}</Text>
      </View>
      {right}
    </View>
  )
}

// ── Mono Kicker (the uppercase tracking-wide label) ─────────────────
export function MonoKicker({ children, color }: { children: string; color?: string }) {
  return (
    <Text style={[styles.monoKicker, color && { color }]}>{children}</Text>
  )
}

// ── Tier Badge ──────────────────────────────────────────────────────
interface TierBadgeProps {
  label: string
  color: string
  small?: boolean
}

export function TierBadge({ label, color, small }: TierBadgeProps) {
  return (
    <View style={[styles.tierBadge, { borderColor: color + '50', backgroundColor: color + '15' }]}>
      <View style={[styles.tierDot, { backgroundColor: color, shadowColor: color, shadowRadius: 4, shadowOpacity: 0.8 }]} />
      <Text style={[styles.tierText, { color }, small && { fontSize: 9 }]}>
        {label}
      </Text>
    </View>
  )
}

// ── Animated Progress Bar ───────────────────────────────────────────
interface AnimatedBarProps {
  progress: number
  color: string
  height?: number
  delay?: number
}

export function AnimatedBar({ progress, color, height = 6, delay = 0 }: AnimatedBarProps) {
  const anim = useRef(new Animated.Value(0)).current

  useEffect(() => {
    Animated.timing(anim, {
      toValue: progress,
      duration: 900,
      delay,
      useNativeDriver: false,
    }).start()
  }, [progress])

  const width = anim.interpolate({
    inputRange: [0, 100],
    outputRange: ['0%', '100%'],
    extrapolate: 'clamp',
  })

  return (
    <View style={[styles.barBg, { height, borderRadius: height / 2 }]}>
      <Animated.View
        style={[
          styles.barFill,
          {
            width,
            height,
            borderRadius: height / 2,
            backgroundColor: color,
            shadowColor: color,
            shadowOffset: { width: 0, height: 0 },
            shadowOpacity: 0.5,
            shadowRadius: 6,
          },
        ]}
      />
    </View>
  )
}

// ── Stat Block ──────────────────────────────────────────────────────
interface StatBlockProps {
  value: string | number
  label: string
  unit?: string
  color?: string
  small?: boolean
  delta?: { text: string; tone: 'up' | 'down' | 'neutral' }
}

export function StatBlock({ value, label, unit, color, small, delta }: StatBlockProps) {
  return (
    <View style={styles.statBlock}>
      <View style={styles.statValueRow}>
        <Text style={[styles.statValue, color && { color }, small && { fontSize: 22 }]}>
          {value}
        </Text>
        {unit && <Text style={styles.statUnit}>{unit}</Text>}
      </View>
      {delta && (
        <Text
          style={[
            styles.statDelta,
            {
              color:
                delta.tone === 'up' ? colors.green
                : delta.tone === 'down' ? colors.red
                : colors.text.muted,
            },
          ]}
        >
          {delta.text}
        </Text>
      )}
      <Text style={styles.statLabel}>{label}</Text>
    </View>
  )
}

// ── Trend Arrow ─────────────────────────────────────────────────────
interface TrendArrowProps {
  value: number
  suffix?: string
  inverted?: boolean
}

export function TrendArrow({ value, suffix = '', inverted }: TrendArrowProps) {
  const isPositive = inverted ? value < 0 : value > 0
  const color = isPositive ? colors.green : value === 0 ? colors.text.muted : colors.red
  const arrow = isPositive ? '↑' : value === 0 ? '→' : '↓'
  const display = Math.abs(value)

  return (
    <View style={[styles.trendBadge, { borderColor: color + '30', backgroundColor: color + '10' }]}>
      <Text style={[styles.trendText, { color }]}>
        {arrow} {display.toFixed(suffix === '%' ? 1 : 2)}{suffix}
      </Text>
    </View>
  )
}

// ── Empty State ─────────────────────────────────────────────────────
interface EmptyStateProps {
  icon: string
  title: string
  subtitle: string
}

export function EmptyState({ icon, title, subtitle }: EmptyStateProps) {
  return (
    <View style={styles.emptyState}>
      <Text style={styles.emptyIcon}>{icon}</Text>
      <Text style={styles.emptyTitle}>{title}</Text>
      <Text style={styles.emptySub}>{subtitle}</Text>
    </View>
  )
}

// ── Divider ─────────────────────────────────────────────────────────
export function Divider() {
  return <View style={styles.divider} />
}

// ── Metric Row ──────────────────────────────────────────────────────
interface MetricRowProps {
  label: string
  value: string | number
  unit?: string
  color?: string
  trend?: number
  inverted?: boolean
}

export function MetricRow({ label, value, unit, color, trend, inverted }: MetricRowProps) {
  return (
    <View style={styles.metricRow}>
      <Text style={styles.metricRowLabel}>{label}</Text>
      <View style={styles.metricRowRight}>
        {trend !== undefined && <TrendArrow value={trend} inverted={inverted} />}
        <Text style={[styles.metricRowValue, color && { color }]}>
          {value}
          {unit && <Text style={styles.metricRowUnit}> {unit}</Text>}
        </Text>
      </View>
    </View>
  )
}

// ── Streak Chip ─────────────────────────────────────────────────────
export function StreakChip({ count }: { count: number }) {
  if (count <= 0) return null
  return (
    <View style={styles.streakChip}>
      <Text style={styles.streakFlame}>🔥</Text>
      <Text style={styles.streakNum}>{count}</Text>
      <Text style={styles.streakLabel}>day{count === 1 ? '' : 's'}</Text>
    </View>
  )
}

// ── Styles ──────────────────────────────────────────────────────────

const styles = StyleSheet.create({
  // Almanac Card
  almanacCard: {
    position: 'relative',
    overflow: 'hidden',
    borderRadius: 16,
    backgroundColor: 'rgba(255,255,255,0.02)',
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.06)',
    marginBottom: spacing.md,
  },
  almanacHeader: {
    flexDirection: 'row',
    alignItems: 'flex-end',
    justifyContent: 'space-between',
    paddingHorizontal: 20,
    paddingTop: 20,
    paddingBottom: 12,
    gap: 12,
  },
  almanacKicker: {
    fontSize: 10,
    letterSpacing: 2,
    textTransform: 'uppercase',
    color: colors.text.muted,
    fontWeight: '600',
  },
  almanacTitle: {
    fontSize: 16,
    fontWeight: '600',
    color: colors.text.primary,
    marginTop: 4,
  },
  accentBar: {
    width: 6,
    height: 40,
    borderRadius: 3,
  },
  almanacBody: {
    paddingHorizontal: 20,
    paddingBottom: 20,
  },

  // Hero Card
  heroCard: {
    position: 'relative',
    overflow: 'hidden',
    borderRadius: 16,
    borderWidth: 1,
    borderColor: 'rgba(249,115,22,0.25)',
    marginBottom: spacing.md,
    padding: 20,
    // Gradient-like bg using layered background
    backgroundColor: 'rgba(249,115,22,0.08)',
    shadowColor: ORANGE,
    shadowOffset: { width: 0, height: 10 },
    shadowOpacity: 0.2,
    shadowRadius: 30,
    elevation: 8,
  },
  shimmerOverlay: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    backgroundColor: 'rgba(255,255,255,0.02)',
  },

  // Glow orb (shared)
  glowOrb: {
    position: 'absolute',
    borderRadius: 9999,
  },

  // Glass Card
  glassCard: {
    position: 'relative',
    overflow: 'hidden',
    backgroundColor: 'rgba(255,255,255,0.03)',
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.06)',
    borderRadius: 16,
    padding: spacing.lg,
    marginBottom: spacing.md,
  },

  // Section Header
  sectionHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: spacing.md,
  },
  sectionHeaderLeft: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  sectionDot: { width: 8, height: 8, borderRadius: 4 },
  sectionLabel: {
    fontSize: 10,
    letterSpacing: 2,
    textTransform: 'uppercase',
    color: colors.text.muted,
    fontWeight: '600',
  },

  // Mono kicker
  monoKicker: {
    fontSize: 10,
    letterSpacing: 2.5,
    textTransform: 'uppercase',
    color: colors.text.muted,
    fontWeight: '600',
  },

  // Tier Badge
  tierBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 5,
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: radius.full,
    borderWidth: 1,
  },
  tierDot: { width: 6, height: 6, borderRadius: 3 },
  tierText: { fontSize: 10, fontWeight: '700', letterSpacing: 0.5, textTransform: 'uppercase' },

  // Animated Bar
  barBg: {
    backgroundColor: 'rgba(255,255,255,0.06)',
    overflow: 'hidden',
    width: '100%',
  },
  barFill: {
    position: 'absolute',
    left: 0,
    top: 0,
  },

  // Stat Block
  statBlock: { alignItems: 'center', flex: 1 },
  statValueRow: { flexDirection: 'row', alignItems: 'baseline', gap: 2 },
  statValue: { fontSize: 28, fontWeight: '700', color: colors.text.primary, letterSpacing: -0.5 },
  statUnit: { fontSize: 11, color: colors.text.muted, fontWeight: '500' },
  statDelta: { fontSize: 10, fontWeight: '700', marginTop: 2 },
  statLabel: {
    fontSize: 9,
    letterSpacing: 2,
    textTransform: 'uppercase',
    color: colors.text.muted,
    marginTop: 4,
    fontWeight: '600',
  },

  // Trend
  trendBadge: {
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: radius.sm,
    borderWidth: 1,
  },
  trendText: { fontSize: 11, fontWeight: '700' },

  // Empty State
  emptyState: {
    alignItems: 'center',
    paddingVertical: spacing.xxxl,
    paddingHorizontal: spacing.xxl,
  },
  emptyIcon: { fontSize: 40, marginBottom: spacing.md },
  emptyTitle: { fontSize: 18, fontWeight: '700', color: colors.text.primary, marginBottom: 6 },
  emptySub: { fontSize: 14, color: colors.text.secondary, textAlign: 'center', lineHeight: 20 },

  // Divider
  divider: {
    height: 1,
    backgroundColor: 'rgba(255,255,255,0.04)',
    marginVertical: spacing.md,
  },

  // Metric Row
  metricRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingVertical: 10,
    borderBottomWidth: 1,
    borderBottomColor: 'rgba(255,255,255,0.04)',
  },
  metricRowLabel: { color: colors.text.secondary, fontSize: 14, flex: 1 },
  metricRowRight: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  metricRowValue: { color: colors.text.primary, fontSize: 16, fontWeight: '600' },
  metricRowUnit: { fontSize: 12, fontWeight: '400', color: colors.text.muted },

  // Streak chip
  streakChip: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    paddingHorizontal: 10,
    paddingVertical: 5,
    borderRadius: radius.full,
    backgroundColor: 'rgba(249,115,22,0.15)',
    borderWidth: 1,
    borderColor: 'rgba(249,115,22,0.4)',
  },
  streakFlame: { fontSize: 12 },
  streakNum: { fontSize: 12, fontWeight: '700', color: colors.orange[300] },
  streakLabel: { fontSize: 9, letterSpacing: 1.5, textTransform: 'uppercase', color: 'rgba(251,146,60,0.7)' },
})
