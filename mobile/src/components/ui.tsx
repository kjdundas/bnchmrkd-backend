// ═══════════════════════════════════════════════════════════════════════
// bnchmrkd. — Mobile UI Component Library (Theme-Aware)
// Premium components matching the web brand language.
// All glass/card/text colors sourced from ThemeContext.
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
import { useTheme } from '../contexts/ThemeContext'
import { spacing, radius } from '../lib/theme'

const { width: SCREEN_W } = Dimensions.get('window')

// ── Almanac Card (web brand card) ───────────────────────────────────
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
  children, kicker, title, number, accent, style, noPadding,
}: AlmanacCardProps) {
  const { colors } = useTheme()
  const accentColor = accent || colors.orange[500]

  return (
    <View style={[{
      position: 'relative', overflow: 'hidden', borderRadius: 16,
      backgroundColor: colors.glass.bg, borderWidth: 1,
      borderColor: colors.glass.border, marginBottom: spacing.md,
    }, style]}>
      {/* Ambient glow bloom */}
      <View pointerEvents="none" style={{
        position: 'absolute', borderRadius: 9999,
        top: -40, right: -40, width: 120, height: 120,
        backgroundColor: accentColor, opacity: 0.06,
      }} />
      {(kicker || title) && (
        <View style={{
          flexDirection: 'row', alignItems: 'flex-end',
          justifyContent: 'space-between', paddingHorizontal: 20,
          paddingTop: 20, paddingBottom: 12, gap: 12,
        }}>
          <View style={{ flex: 1 }}>
            <Text style={{ fontSize: 10, letterSpacing: 2, textTransform: 'uppercase',
              color: colors.text.muted, fontWeight: '600' }}>
              {number ? <Text style={{ color: colors.text.dimmed }}>{number} · </Text> : null}
              {kicker}
            </Text>
            {title && <Text style={{ fontSize: 16, fontWeight: '600',
              color: colors.text.primary, marginTop: 4 }}>{title}</Text>}
          </View>
          <View style={{ width: 6, height: 40, borderRadius: 3, backgroundColor: accentColor }} />
        </View>
      )}
      <View style={[!noPadding && { paddingHorizontal: 20, paddingBottom: 20 }]}>{children}</View>
    </View>
  )
}

// ── Hero Card ──────────────────────────────────────────────────────
interface HeroCardProps { children: React.ReactNode; style?: ViewStyle }

export function HeroCard({ children, style }: HeroCardProps) {
  const { colors } = useTheme()
  return (
    <View style={[{
      position: 'relative', overflow: 'hidden', borderRadius: 16,
      borderWidth: 1, borderColor: 'rgba(249,115,22,0.25)',
      marginBottom: spacing.md, padding: 20,
      backgroundColor: 'rgba(249,115,22,0.08)',
      shadowColor: colors.orange[500],
      shadowOffset: { width: 0, height: 10 }, shadowOpacity: 0.2,
      shadowRadius: 30, elevation: 8,
    }, style]}>
      <View pointerEvents="none" style={{
        position: 'absolute', borderRadius: 9999,
        top: -60, left: -60, width: 160, height: 160,
        backgroundColor: colors.orange[500], opacity: 0.12,
      }} />
      <View pointerEvents="none" style={{
        position: 'absolute', borderRadius: 9999,
        bottom: -60, right: -60, width: 160, height: 160,
        backgroundColor: colors.blue, opacity: 0.06,
      }} />
      <View pointerEvents="none" style={{
        position: 'absolute', top: 0, left: 0, right: 0, bottom: 0,
        backgroundColor: colors.glass.bg,
      }} />
      <View style={{ position: 'relative' }}>{children}</View>
    </View>
  )
}

// ── Glass Card ─────────────────────────────────────────────────────
interface GlassCardProps {
  children: React.ReactNode; style?: ViewStyle
  glowColor?: string; noPadding?: boolean
}

export function GlassCard({ children, style, glowColor, noPadding }: GlassCardProps) {
  const { colors } = useTheme()
  return (
    <View style={[{
      position: 'relative', overflow: 'hidden',
      backgroundColor: colors.glass.bg, borderWidth: 1,
      borderColor: glowColor ? glowColor + '20' : colors.glass.border,
      borderRadius: 16, padding: noPadding ? 0 : spacing.lg,
      marginBottom: spacing.md,
    }, style]}>
      {glowColor && (
        <View pointerEvents="none" style={{
          position: 'absolute', borderRadius: 9999,
          top: -30, right: -30, width: 100, height: 100,
          backgroundColor: glowColor, opacity: 0.06,
        }} />
      )}
      {children}
    </View>
  )
}

// ── Section Header ─────────────────────────────────────────────────
export function SectionHeader({ label, color, right }: { label: string; color?: string; right?: React.ReactNode }) {
  const { colors } = useTheme()
  return (
    <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: spacing.md }}>
      <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8 }}>
        {color && <View style={{ width: 8, height: 8, borderRadius: 4, backgroundColor: color }} />}
        <Text style={{ fontSize: 10, letterSpacing: 2, textTransform: 'uppercase', color: colors.text.muted, fontWeight: '600' }}>{label}</Text>
      </View>
      {right}
    </View>
  )
}

// ── Mono Kicker ────────────────────────────────────────────────────
export function MonoKicker({ children, color }: { children: string; color?: string }) {
  const { colors } = useTheme()
  return (
    <Text style={{ fontSize: 10, letterSpacing: 2.5, textTransform: 'uppercase',
      color: color || colors.text.muted, fontWeight: '600' }}>{children}</Text>
  )
}

// ── Tier Badge ─────────────────────────────────────────────────────
export function TierBadge({ label, color, small }: { label: string; color: string; small?: boolean }) {
  return (
    <View style={{
      flexDirection: 'row', alignItems: 'center', gap: 5,
      paddingHorizontal: 10, paddingVertical: 4,
      borderRadius: radius.full, borderWidth: 1,
      borderColor: color + '50', backgroundColor: color + '15',
    }}>
      <View style={{ width: 6, height: 6, borderRadius: 3, backgroundColor: color }} />
      <Text style={{ fontSize: small ? 9 : 10, fontWeight: '700', letterSpacing: 0.5,
        textTransform: 'uppercase', color }}>{label}</Text>
    </View>
  )
}

// ── Animated Progress Bar ──────────────────────────────────────────
export function AnimatedBar({ progress, color, height = 6, delay = 0 }: {
  progress: number; color: string; height?: number; delay?: number
}) {
  const { colors } = useTheme()
  const anim = useRef(new Animated.Value(0)).current
  useEffect(() => {
    Animated.timing(anim, { toValue: progress, duration: 900, delay, useNativeDriver: false }).start()
  }, [progress])
  const width = anim.interpolate({ inputRange: [0, 100], outputRange: ['0%', '100%'], extrapolate: 'clamp' })

  return (
    <View style={{ backgroundColor: colors.glass.shimmer, overflow: 'hidden', width: '100%', height, borderRadius: height / 2 }}>
      <Animated.View style={{
        position: 'absolute', left: 0, top: 0, width, height,
        borderRadius: height / 2, backgroundColor: color,
        shadowColor: color, shadowOffset: { width: 0, height: 0 },
        shadowOpacity: 0.5, shadowRadius: 6,
      }} />
    </View>
  )
}

// ── Stat Block ─────────────────────────────────────────────────────
export function StatBlock({ value, label, unit, color, small, delta }: {
  value: string | number; label: string; unit?: string; color?: string
  small?: boolean; delta?: { text: string; tone: 'up' | 'down' | 'neutral' }
}) {
  const { colors } = useTheme()
  return (
    <View style={{ alignItems: 'center', flex: 1 }}>
      <View style={{ flexDirection: 'row', alignItems: 'baseline', gap: 2 }}>
        <Text style={{ fontSize: small ? 22 : 28, fontWeight: '700', color: color || colors.text.primary, letterSpacing: -0.5 }}>{value}</Text>
        {unit && <Text style={{ fontSize: 11, color: colors.text.muted, fontWeight: '500' }}>{unit}</Text>}
      </View>
      {delta && (
        <Text style={{ fontSize: 10, fontWeight: '700', marginTop: 2,
          color: delta.tone === 'up' ? colors.green : delta.tone === 'down' ? colors.red : colors.text.muted }}>
          {delta.text}
        </Text>
      )}
      <Text style={{ fontSize: 9, letterSpacing: 2, textTransform: 'uppercase',
        color: colors.text.muted, marginTop: 4, fontWeight: '600' }}>{label}</Text>
    </View>
  )
}

// ── Trend Arrow ────────────────────────────────────────────────────
export function TrendArrow({ value, suffix = '', inverted }: {
  value: number; suffix?: string; inverted?: boolean
}) {
  const { colors } = useTheme()
  const isPositive = inverted ? value < 0 : value > 0
  const color = isPositive ? colors.green : value === 0 ? colors.text.muted : colors.red
  const arrow = isPositive ? '↑' : value === 0 ? '→' : '↓'
  return (
    <View style={{ paddingHorizontal: 8, paddingVertical: 3, borderRadius: radius.sm, borderWidth: 1,
      borderColor: color + '30', backgroundColor: color + '10' }}>
      <Text style={{ fontSize: 11, fontWeight: '700', color }}>
        {arrow} {Math.abs(value).toFixed(suffix === '%' ? 1 : 2)}{suffix}
      </Text>
    </View>
  )
}

// ── Empty State ────────────────────────────────────────────────────
export function EmptyState({ icon, title, subtitle }: { icon: string; title: string; subtitle: string }) {
  const { colors } = useTheme()
  return (
    <View style={{ alignItems: 'center', paddingVertical: spacing.xxxl, paddingHorizontal: spacing.xxl }}>
      <Text style={{ fontSize: 40, marginBottom: spacing.md }}>{icon}</Text>
      <Text style={{ fontSize: 18, fontWeight: '700', color: colors.text.primary, marginBottom: 6 }}>{title}</Text>
      <Text style={{ fontSize: 14, color: colors.text.secondary, textAlign: 'center', lineHeight: 20 }}>{subtitle}</Text>
    </View>
  )
}

// ── Divider ────────────────────────────────────────────────────────
export function Divider() {
  const { colors } = useTheme()
  return <View style={{ height: 1, backgroundColor: colors.glass.divider, marginVertical: spacing.md }} />
}

// ── Metric Row ─────────────────────────────────────────────────────
export function MetricRow({ label, value, unit, color, trend, inverted }: {
  label: string; value: string | number; unit?: string; color?: string
  trend?: number; inverted?: boolean
}) {
  const { colors } = useTheme()
  return (
    <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center',
      paddingVertical: 10, borderBottomWidth: 1, borderBottomColor: colors.glass.divider }}>
      <Text style={{ color: colors.text.secondary, fontSize: 14, flex: 1 }}>{label}</Text>
      <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8 }}>
        {trend !== undefined && <TrendArrow value={trend} inverted={inverted} />}
        <Text style={{ color: color || colors.text.primary, fontSize: 16, fontWeight: '600' }}>
          {value}
          {unit && <Text style={{ fontSize: 12, fontWeight: '400', color: colors.text.muted }}> {unit}</Text>}
        </Text>
      </View>
    </View>
  )
}

// ── Streak Chip ────────────────────────────────────────────────────
export function StreakChip({ count }: { count: number }) {
  const { colors } = useTheme()
  if (count <= 0) return null
  return (
    <View style={{
      flexDirection: 'row', alignItems: 'center', gap: 4,
      paddingHorizontal: 10, paddingVertical: 5,
      borderRadius: radius.full,
      backgroundColor: 'rgba(249,115,22,0.15)',
      borderWidth: 1, borderColor: 'rgba(249,115,22,0.4)',
    }}>
      <Text style={{ fontSize: 12 }}>🔥</Text>
      <Text style={{ fontSize: 12, fontWeight: '700', color: colors.orange[300] }}>{count}</Text>
      <Text style={{ fontSize: 9, letterSpacing: 1.5, textTransform: 'uppercase',
        color: 'rgba(251,146,60,0.7)' }}>day{count === 1 ? '' : 's'}</Text>
    </View>
  )
}
