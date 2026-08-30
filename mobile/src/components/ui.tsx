// ═══════════════════════════════════════════════════════════════════════
// bnchmrkd. — Mobile UI Component Library (Theme-Aware)
//
// Matches the web athlete dashboard's card language:
//   • solid card surface, 20px radius, hairline #E7E9F2 border, soft shadow
//   • header = mono uppercase kicker → large ink title → optional mono
//     subtitle, with an optional right-aligned stat (e.g. PERSONAL BEST)
//   • no decorative accent bar — the web cards don't have one
// All colours come from ThemeContext; nothing here hardcodes a hex.
// ═══════════════════════════════════════════════════════════════════════

import React, { useEffect, useRef } from 'react'
import {
  View,
  Text,
  StyleSheet,
  Animated,
  Pressable,
  ViewStyle,
  Dimensions,
} from 'react-native'
import { Ionicons } from '@expo/vector-icons'
import { BlurView } from 'expo-blur'
import { LinearGradient as Gradient } from 'expo-linear-gradient'
import { useTheme } from '../contexts/ThemeContext'
import { spacing, radius, rhythm, numerals, elevation, onImage } from '../lib/theme'
import { DURATION, EASE, STAGGER_STEP, STAGGER_MAX_INDEX, useReducedMotion } from '../lib/motion'

const { width: SCREEN_W } = Dimensions.get('window')

// ── Surface hierarchy ──────────────────────────────────────────────
// Three levels, not one. A screen where every block is the same card reads
// as wallpaper: uniformity tells the eye nothing is more important than
// anything else. Assign every block a level and hierarchy appears without
// changing any component's contents.
//
//   'hero'    no chrome at all — the focal point owns the screen
//   'primary' elevated white card — the default, for content you act on
//   'ambient' borderless, sunk into the paper — engagement furniture,
//             summaries, anything read at a glance and moved past
export type Surface = 'hero' | 'primary' | 'ambient'

// Shared card chrome — the single source of truth for "what a card looks
// like". Every card component below builds on this so they can't drift.
function useCardSurface(level: Surface = 'primary') {
  const { colors, isDark } = useTheme()
  if (level === 'hero') {
    return {
      position: 'relative' as const,
      marginBottom: rhythm.block,
    }
  }
  if (level === 'ambient') {
    return {
      position: 'relative' as const,
      overflow: 'hidden' as const,
      borderRadius: 16,
      backgroundColor: colors.bg.primary,
      borderWidth: 0,
      marginBottom: rhythm.tight,
    }
  }
  return {
    position: 'relative' as const,
    overflow: 'hidden' as const,
    borderRadius: 20,
    backgroundColor: colors.glass.bg,
    borderWidth: 1,
    borderColor: colors.glass.border,
    marginBottom: rhythm.section,
    // On dark the border carries the edge — shadows are invisible on near-black.
    ...(isDark ? elevation.flat : elevation.raised),
  }
}

// ── Card header (kicker → title → subtitle, + optional right slot) ──
function CardHeader({
  kicker, title, subtitle, number, right,
}: {
  kicker?: string; title?: string; subtitle?: string
  number?: string; right?: React.ReactNode
}) {
  const { colors } = useTheme()
  if (!kicker && !title) return null
  return (
    <View style={{
      flexDirection: 'row', alignItems: 'flex-start',
      justifyContent: 'space-between', gap: 12,
      paddingHorizontal: 20, paddingTop: 20, paddingBottom: 14,
    }}>
      <View style={{ flex: 1 }}>
        {kicker ? (
          <Text style={{
            fontSize: 10, letterSpacing: 2, textTransform: 'uppercase',
            color: colors.text.muted, fontWeight: '600',
          }}>
            {number ? <Text style={{ color: colors.text.dimmed }}>{number} · </Text> : null}
            {kicker}
          </Text>
        ) : null}
        {title ? (
          <Text style={{
            fontSize: 22, fontWeight: '700', letterSpacing: -0.4,
            color: colors.text.primary, marginTop: 6,
          }}>{title}</Text>
        ) : null}
        {subtitle ? (
          <Text style={{
            fontSize: 10, letterSpacing: 2, textTransform: 'uppercase',
            color: colors.text.muted, fontWeight: '600', marginTop: 6,
          }}>{subtitle}</Text>
        ) : null}
      </View>
      {right ? <View style={{ alignItems: 'flex-end' }}>{right}</View> : null}
    </View>
  )
}




// ── Section label ──────────────────────────────────────────────────
// A quiet anchor between groups of blocks. Nineteen cards with no grouping
// gives the eye nothing to hold onto; three or four of these do most of the
// work of a hierarchy on their own.
export function SectionLabel({ children, style, color }: {
  children: string; style?: ViewStyle; color?: string
}) {
  const { colors } = useTheme()
  return (
    <View style={[{ marginTop: rhythm.block, marginBottom: rhythm.tight }, style]}>
      <Text style={{
        fontSize: 11, letterSpacing: 2, textTransform: 'uppercase',
        color: color || colors.text.muted, fontWeight: '700',
      }}>{children}</Text>
    </View>
  )
}

// ── Stagger ────────────────────────────────────────────────────────
// Wraps a feed item so it fades and lifts into place, offset by its position.
// A whole screen appearing at once reads as a page load; a staggered sequence
// reads as the app assembling itself. Honours Reduce Motion by rendering the
// final state immediately.
export function Stagger({
  index = 0, children, style,
}: { index?: number; children: React.ReactNode; style?: ViewStyle }) {
  const reduced = useReducedMotion()
  const anim = useRef(new Animated.Value(0)).current

  useEffect(() => {
    if (reduced) { anim.setValue(1); return }
    const a = Animated.timing(anim, {
      toValue: 1,
      duration: DURATION.base,
      delay: Math.min(index, STAGGER_MAX_INDEX) * STAGGER_STEP,
      easing: EASE.out,
      useNativeDriver: true,
    })
    a.start()
    return () => a.stop()   // interruptible — never block a fast scroller
  }, [reduced, index])

  return (
    <Animated.View
      style={[
        style,
        {
          opacity: anim,
          transform: [{ translateY: anim.interpolate({ inputRange: [0, 1], outputRange: [14, 0] }) }],
        },
      ]}
    >
      {children}
    </Animated.View>
  )
}

// ── Tappable ───────────────────────────────────────────────────────
// Every interactive surface should answer the finger. Without a pressed
// state a tap feels like nothing happened, which is the single biggest
// "cheap" tell on a native app. Opacity + a 2% scale, restored on release.
// `accessibilityLabel` is required for icon-only controls (VoiceOver).
export function Tappable({
  children, onPress, onLongPress, style, disabled, accessibilityLabel, hitSlop = 8,
}: {
  children: React.ReactNode
  onPress?: () => void
  onLongPress?: () => void
  style?: ViewStyle | ViewStyle[]
  disabled?: boolean
  accessibilityLabel?: string
  hitSlop?: number
}) {
  return (
    <Pressable
      onPress={onPress}
      onLongPress={onLongPress}
      disabled={disabled}
      hitSlop={hitSlop}
      accessibilityRole="button"
      accessibilityLabel={accessibilityLabel}
      accessibilityState={{ disabled: !!disabled }}
      style={({ pressed }) => [
        style as ViewStyle,
        pressed && !disabled && { opacity: 0.86, transform: [{ scale: 0.98 }] },
        disabled && { opacity: 0.45 },
      ]}
    >
      {children}
    </Pressable>
  )
}

// ── Glass Panel ────────────────────────────────────────────────────
// The one material for content that sits ON the stadium backdrop rather than
// on paper. Four layers, in this order, because each fixes a failure of the
// one before:
//
//   1. BlurView          — separates the text from the photograph's local
//                          contrast without hiding the image
//   2. a translucent veil — blur alone still lets a bright cloud punch
//                          through; the veil sets a floor for legibility
//   3. a hairline border  — a blurred panel with no edge has no shape; this
//                          is exactly why the bare GlassView read as invisible
//   4. a 1px specular top — light catching the upper edge is what makes a
//                          translucent rectangle read as glass and not as fog
//
// `tone`: 'light' is the frosted veil used over the photo itself; 'deep' is
// the smoked panel for blocks below the fold, where the ground is already
// dark and the panel needs to sit ON it rather than dissolve into it.
export function GlassPanel({
  children, style, onPress, accessibilityLabel,
  intensity = 26, tone = 'light', radius: r = 22,
}: {
  children: React.ReactNode
  style?: ViewStyle | ViewStyle[]
  onPress?: () => void
  accessibilityLabel?: string
  intensity?: number
  tone?: 'light' | 'deep'
  radius?: number
}) {
  const shell: ViewStyle = {
    position: 'relative',
    borderRadius: r,
    overflow: 'hidden',
    borderWidth: 1,
    borderColor: onImage.cardBorder,
    backgroundColor: 'transparent',
  }

  const body = (
    <>
      <BlurView intensity={intensity} tint="dark" style={StyleSheet.absoluteFill} />
      <View pointerEvents="none" style={[StyleSheet.absoluteFill, {
        backgroundColor: tone === 'deep' ? onImage.cardStrong : onImage.card,
      }]} />
      <View pointerEvents="none" style={{
        position: 'absolute', top: 0, left: 0, right: 0, height: 1,
        backgroundColor: 'rgba(255,255,255,0.22)',
      }} />
      {children}
    </>
  )

  if (onPress) {
    return (
      <Tappable onPress={onPress} accessibilityLabel={accessibilityLabel} style={[shell, style as any]}>
        {body}
      </Tappable>
    )
  }
  return <View style={[shell, style]}>{body}</View>
}

// ── Almanac Card (the standard dashboard card) ──────────────────────
interface AlmanacCardProps {
  children: React.ReactNode
  /** Which surface level this block sits on. Defaults to 'primary'. */
  level?: Surface
  kicker?: string
  title?: string
  subtitle?: string
  number?: string
  /** Tints the corner bloom. Purely decorative. */
  accent?: string
  /** Right-aligned header content, e.g. a <StatValue/>. */
  right?: React.ReactNode
  style?: ViewStyle
  noPadding?: boolean
  /**
   * Render as the same glass as the on-image panels rather than a flat
   * translucent rectangle.
   *
   * `useCardSurface` gives a dark card a fill and a border but no blur and no
   * specular edge, which is what made Trajectory's blocks read as a different,
   * cheaper material than Home's — same colours, no light in them.
   */
  glass?: boolean
}

export function AlmanacCard({
  children, level = 'primary', kicker, title, subtitle, number, accent, right, style, noPadding, glass,
}: AlmanacCardProps) {
  const { colors } = useTheme()
  const surface = useCardSurface(level)
  const accentColor = accent || colors.accent[500]

  return (
    <View style={[surface, glass && { backgroundColor: 'transparent' }, style]}>
      {glass && (
        <>
          <BlurView intensity={24} tint="dark" style={StyleSheet.absoluteFill} />
          <View pointerEvents="none" style={[StyleSheet.absoluteFill, {
            backgroundColor: onImage.cardStrong,
          }]} />
          {/* The light on the top edge. One pixel, and the single thing that
              separates glass from a grey rectangle. */}
          <View pointerEvents="none" style={{
            position: 'absolute', top: 0, left: 0, right: 0, height: 1,
            backgroundColor: 'rgba(255,255,255,0.20)',
          }} />
        </>
      )}
      {/* Corner wash.
          This was a 150pt circle of flat accent colour hung off the top-right
          corner. At 5% on white paper it read as the faint bloom it was meant
          to be; at 10% on a dark card it became a visible coloured disc — a
          bubble sitting in the corner of all eleven blocks on Trajectory.
          A corner-anchored gradient gives the same lift with no edge to see. */}
      {level === 'primary' && (
        <Gradient
          pointerEvents="none"
          colors={[accentColor + (glass ? '2A' : '14'), accentColor + '00']}
          start={{ x: 1, y: 0 }}
          end={{ x: 0.15, y: 0.85 }}
          style={StyleSheet.absoluteFill}
        />
      )}
      <CardHeader kicker={kicker} title={title} subtitle={subtitle} number={number} right={right} />
      <View style={[!noPadding && { paddingHorizontal: 20, paddingBottom: 20 }]}>{children}</View>
    </View>
  )
}

// ── Stat Value — the big accent number in a card header ─────────────
// Mirrors the web's "PERSONAL BEST / 10.10 s" treatment.
export function StatValue({ label, value, unit, color }: {
  label?: string; value: string | number; unit?: string; color?: string
}) {
  const { colors } = useTheme()
  return (
    <View style={{ alignItems: 'flex-end' }}>
      {label ? (
        <Text style={{
          fontSize: 9, letterSpacing: 2, textTransform: 'uppercase',
          color: colors.text.muted, fontWeight: '600', marginBottom: 2,
        }}>{label}</Text>
      ) : null}
      <View style={{ flexDirection: 'row', alignItems: 'baseline', gap: 3 }}>
        <Text style={{
          fontSize: 30, fontWeight: '700', letterSpacing: -1,
          color: color || colors.accent[500], ...numerals,
        }}>{value}</Text>
        {unit ? (
          <Text style={{ fontSize: 13, fontWeight: '600', color: color || colors.accent[500] }}>{unit}</Text>
        ) : null}
      </View>
    </View>
  )
}

// ── Note Block — left-ruled callout ("NEXT MILESTONE" on web) ───────
export function NoteBlock({ kicker, children, accent }: {
  kicker?: string; children: React.ReactNode; accent?: string
}) {
  const { colors } = useTheme()
  const bar = accent || colors.accent[500]
  return (
    <View style={{ flexDirection: 'row', gap: 12, marginTop: spacing.md }}>
      <View style={{ width: 3, borderRadius: 2, backgroundColor: bar }} />
      <View style={{ flex: 1 }}>
        {kicker ? (
          <Text style={{
            fontSize: 9, letterSpacing: 2, textTransform: 'uppercase',
            color: colors.text.muted, fontWeight: '600', marginBottom: 4,
          }}>{kicker}</Text>
        ) : null}
        {typeof children === 'string'
          ? <Text style={{ fontSize: 14, color: colors.text.primary, lineHeight: 20 }}>{children}</Text>
          : children}
      </View>
    </View>
  )
}

// ── Hero Card — accent-tinted feature card ──────────────────────────
interface HeroCardProps { children: React.ReactNode; style?: ViewStyle }

export function HeroCard({ children, style }: HeroCardProps) {
  const { colors, isDark } = useTheme()
  const accent = colors.accent[500]
  return (
    <View style={[{
      position: 'relative', overflow: 'hidden', borderRadius: 20,
      borderWidth: 1, borderColor: accent + (isDark ? '40' : '26'),
      marginBottom: spacing.md, padding: 20,
      backgroundColor: isDark ? accent + '14' : colors.glass.overlay,
      ...(isDark ? elevation.flat : elevation.lifted),
      shadowColor: accent,
    }, style]}>
      {/* Two 160pt discs, one accent and one blue, hung off opposite corners.
          Replaced by a single diagonal wash — same lift, no visible edges,
          and one light source instead of two competing ones. */}
      <Gradient
        pointerEvents="none"
        colors={[accent + (isDark ? '2E' : '1A'), accent + '00']}
        start={{ x: 0, y: 0 }}
        end={{ x: 0.9, y: 1 }}
        style={StyleSheet.absoluteFill}
      />
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
  const surface = useCardSurface()
  return (
    <View style={[surface, {
      borderColor: glowColor ? glowColor + '33' : colors.glass.border,
      padding: noPadding ? 0 : spacing.lg,
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
      paddingHorizontal: 10, paddingVertical: 4,
      borderRadius: radius.sm, backgroundColor: color + '1F',
    }}>
      <Text style={{ fontSize: small ? 9 : 10, fontWeight: '700', letterSpacing: 1,
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
    const a = Animated.timing(anim, {
      toValue: progress, duration: DURATION.slow, delay,
      easing: EASE.sweep, useNativeDriver: false,
    })
    a.start()
    return () => a.stop()
  }, [progress])
  const width = anim.interpolate({ inputRange: [0, 100], outputRange: ['0%', '100%'], extrapolate: 'clamp' })

  return (
    <View style={{ backgroundColor: colors.glass.divider, overflow: 'hidden', width: '100%', height, borderRadius: height / 2 }}>
      <Animated.View style={{
        position: 'absolute', left: 0, top: 0, width, height,
        borderRadius: height / 2, backgroundColor: color,
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
        <Text style={{ fontSize: small ? 22 : 28, fontWeight: '700', color: color || colors.text.primary, letterSpacing: -0.5, ...numerals }}>{value}</Text>
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
    <View style={{ paddingHorizontal: 8, paddingVertical: 3, borderRadius: radius.sm,
      backgroundColor: color + '14' }}>
      <Text style={{ fontSize: 11, fontWeight: '700', color }}>
        {arrow} {Math.abs(value).toFixed(suffix === '%' ? 1 : 2)}{suffix}
      </Text>
    </View>
  )
}

// ── Empty State ────────────────────────────────────────────────────
// `icon` is an Ionicons name. Emoji were used here originally; they render
// differently on every OS, can't be tinted by the theme, and read as a
// placeholder rather than a designed empty state.
export function EmptyState({ icon, title, subtitle }: { icon: string; title: string; subtitle: string }) {
  const { colors } = useTheme()
  return (
    <View style={{ alignItems: 'center', paddingVertical: spacing.xxxl, paddingHorizontal: spacing.xxl }}>
      {/* The icon, not an icon in a bubble. A 56pt tinted disc behind a 24pt
          glyph is the "empty folder" illustration every consumer app shipped in
          2016 — it adds a shape without adding meaning. */}
      <Ionicons
        name={icon as any} size={30} color={colors.accent[500]}
        style={{ marginBottom: spacing.md, opacity: 0.85 }}
      />
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
      backgroundColor: colors.accent[500] + '14',
    }}>
      <Ionicons name="flame" size={12} color={colors.accent[500]} />
      <Text style={{ fontSize: 12, fontWeight: '700', color: colors.accent[500] }}>{count}</Text>
      <Text style={{ fontSize: 9, letterSpacing: 1.5, textTransform: 'uppercase',
        color: colors.text.muted }}>day{count === 1 ? '' : 's'}</Text>
    </View>
  )
}
