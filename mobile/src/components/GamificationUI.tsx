// ═══════════════════════════════════════════════════════════════════════
// GAMIFICATION UI — XP bar, streak chip, post-save celebration, badges
// Makes every log feel rewarding. Drives the habit loop.
// ═══════════════════════════════════════════════════════════════════════

import React, { useEffect, useRef, useState } from 'react'
import {
  View,
  Text,
  StyleSheet,
  Animated,
  Dimensions,
} from 'react-native'
import { Ionicons } from '@expo/vector-icons'
import { celebrationFeedback } from '../lib/haptics'
// Rendered only by Home and Log, both of which run on the dark ground. This
// file was still on the static LIGHT palette — the swap repaints every
// reference below in one line, and is safe precisely because there is no
// light-surface caller to preserve.
import { onImageColors as colors, spacing, radius, typeScale, weight } from '../lib/theme'
import { getLevelFromXP, type Badge } from '../lib/gamification'

const { width: SCREEN_W } = Dimensions.get('window')

// ── XP PROGRESS BAR ──────────────────────────────────────────────────
// Shows current level, XP progress, and next level
export function XPBar({ totalXP }: { totalXP: number }) {
  const level = getLevelFromXP(totalXP)
  const barWidth = useRef(new Animated.Value(0)).current

  useEffect(() => {
    Animated.spring(barWidth, {
      toValue: level.progress,
      useNativeDriver: false,
      friction: 8,
    }).start()
  }, [level.progress])

  return (
    <View style={xpStyles.container}>
      <View style={xpStyles.topRow}>
        <View style={xpStyles.levelBadge}>
          <Ionicons name={((level as any).ionicon || 'star') as any} size={12} color={colors.accent[500]} />
          <Text style={xpStyles.levelNum}>LV{level.level}</Text>
        </View>
        <Text style={xpStyles.levelTitle}>{level.title}</Text>
        <Text style={xpStyles.xpText}>
          {totalXP.toLocaleString()} <Text style={xpStyles.xpLabel}>XP</Text>
        </Text>
      </View>

      {/* Progress bar */}
      <View style={xpStyles.barTrack}>
        <Animated.View
          style={[
            xpStyles.barFill,
            {
              width: barWidth.interpolate({
                inputRange: [0, 1],
                outputRange: ['0%', '100%'],
              }),
            },
          ]}
        />
      </View>

      {level.next && (
        <View style={xpStyles.bottomRow}>
          <Text style={xpStyles.nextText}>
            {level.xpForNext - level.xpInLevel} XP to {level.next.title}
          </Text>
          <Text style={xpStyles.nextIcon}>{level.next.icon}</Text>
        </View>
      )}
    </View>
  )
}

const xpStyles = StyleSheet.create({
  container: {
    backgroundColor: 'rgba(255,255,255,0.02)',
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.06)',
    borderRadius: radius.card,
    padding: spacing.md,
    marginBottom: spacing.md,
  },
  topRow: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 8,
  },
  levelBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    backgroundColor: 'rgba(139,131,255,0.16)',
    borderRadius: radius.full,
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderWidth: 1,
    borderColor: 'rgba(139,131,255,0.34)',
  },
  levelIcon: { fontSize: typeScale.caption },
  levelNum: {
    fontSize: typeScale.label,
    fontWeight: weight.bold,
    color: colors.orange[400],
    letterSpacing: 0.5,
  },
  levelTitle: {
    flex: 1,
    fontSize: typeScale.caption,
    fontWeight: weight.medium,
    color: colors.text.secondary,
    marginLeft: 8,
  },
  xpText: {
    fontSize: typeScale.body,
    fontWeight: weight.bold,
    color: colors.text.primary,
  },
  xpLabel: {
    fontSize: typeScale.label,
    fontWeight: weight.medium,
    color: colors.text.muted,
    letterSpacing: 1,
  },
  barTrack: {
    height: 6,
    backgroundColor: 'rgba(255,255,255,0.04)',
    borderRadius: radius.full,
    overflow: 'hidden',
  },
  barFill: {
    height: '100%',
    borderRadius: radius.full,
    backgroundColor: colors.orange[500],
  },
  bottomRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginTop: 6,
  },
  nextText: {
    fontSize: typeScale.label,
    color: colors.text.dimmed,
    fontWeight: weight.medium,
  },
  nextIcon: { fontSize: typeScale.caption },
})

// ── STREAK CHIP (for header) ──────────────────────────────────────────
export function StreakChip({ streak }: { streak: number }) {
  if (streak < 1) return null

  const isHot = streak >= 7
  const isFire = streak >= 14

  return (
    <View style={[
      streakStyles.chip,
      isHot && streakStyles.chipHot,
      isFire && streakStyles.chipFire,
    ]}>
      <Ionicons
        // 'link' rendered a chain-link on every streak under a week, which
        // reads as a hyperlink, not a run of days.
        name={isFire ? 'flame' : isHot ? 'flash' : 'ellipse'}
        size={13}
        color={isFire ? colors.accent[300] : isHot ? colors.accent[400] : colors.text.muted}
      />
      <Text style={[
        streakStyles.text,
        isHot && { color: colors.orange[400] },
        isFire && { color: colors.orange[300] },
      ]}>
        {streak}d streak
      </Text>
    </View>
  )
}

const streakStyles = StyleSheet.create({
  chip: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    backgroundColor: 'rgba(255,255,255,0.04)',
    borderRadius: radius.full,
    paddingHorizontal: 10,
    paddingVertical: 5,
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.08)',
  },
  chipHot: {
    backgroundColor: 'rgba(249,115,22,0.08)',
    borderColor: 'rgba(249,115,22,0.2)',
  },
  chipFire: {
    backgroundColor: 'rgba(139,131,255,0.16)',
    borderColor: 'rgba(139,131,255,0.30)',
  },
  icon: { fontSize: typeScale.caption },
  text: {
    fontSize: typeScale.label,
    fontWeight: weight.bold,
    color: colors.text.muted,
    letterSpacing: 0.3,
  },
})

// ── POST-SAVE XP POPUP ───────────────────────────────────────────────
// Shows XP earned breakdown, slides up after a save
export function XPPopup({
  visible,
  xpBreakdown,
  totalXP,
  message,
  newBadges,
  leveledUp,
  newLevel,
}: {
  visible: boolean
  xpBreakdown: { reason: string; xp: number }[]
  totalXP: number
  message: string
  newBadges: Badge[]
  leveledUp: boolean
  newLevel?: { level: number; title: string; icon: string }
}) {
  const slideAnim = useRef(new Animated.Value(0)).current
  const [show, setShow] = useState(false)

  useEffect(() => {
    if (visible) {
      setShow(true)
      Animated.sequence([
        Animated.spring(slideAnim, { toValue: 1, useNativeDriver: false, friction: 5 }),
        Animated.delay(3500),
        Animated.timing(slideAnim, { toValue: 0, duration: 400, useNativeDriver: false }),
      ]).start(() => setShow(false))
    }
  }, [visible])

  if (!show) return null

  const earnedXP = xpBreakdown.reduce((s, b) => s + b.xp, 0)

  return (
    <Animated.View
      style={[
        popupStyles.overlay,
        {
          opacity: slideAnim,
          transform: [{
            translateY: slideAnim.interpolate({
              inputRange: [0, 1],
              outputRange: [60, 0],
            }),
          }],
        },
      ]}
    >
      <View style={popupStyles.card}>
        {/* Level up banner */}
        {leveledUp && newLevel && (
          <View style={popupStyles.levelUpBanner}>
            <Text style={popupStyles.levelUpIcon}>{newLevel.icon}</Text>
            <Text style={popupStyles.levelUpText}>LEVEL UP! → {newLevel.title}</Text>
          </View>
        )}

        {/* XP earned */}
        <View style={popupStyles.xpHeader}>
          <Text style={popupStyles.xpAmount}>+{earnedXP}</Text>
          <Text style={popupStyles.xpLabel}>XP</Text>
        </View>

        {/* Breakdown */}
        {xpBreakdown.map((item, i) => (
          <View key={i} style={popupStyles.breakdownRow}>
            <Text style={popupStyles.breakdownReason}>{item.reason}</Text>
            <Text style={popupStyles.breakdownXP}>+{item.xp}</Text>
          </View>
        ))}

        {/* Message */}
        <Text style={popupStyles.message}>{message}</Text>

        {/* New badges */}
        {newBadges.length > 0 && (
          <View style={popupStyles.badgeSection}>
            <Text style={popupStyles.badgeTitle}>NEW BADGE{newBadges.length > 1 ? 'S' : ''}</Text>
            {newBadges.map((badge) => (
              <View key={badge.id} style={popupStyles.badgeRow}>
                <Text style={popupStyles.badgeIcon}>{badge.icon}</Text>
                <View style={{ flex: 1 }}>
                  <Text style={popupStyles.badgeName}>{badge.title}</Text>
                  <Text style={popupStyles.badgeDesc}>{badge.description}</Text>
                </View>
              </View>
            ))}
          </View>
        )}
      </View>
    </Animated.View>
  )
}

const popupStyles = StyleSheet.create({
  overlay: {
    position: 'absolute',
    bottom: 30,
    left: 16,
    right: 16,
    zIndex: 100,
  },
  card: {
    backgroundColor: 'rgba(11,12,24,0.96)',
    borderRadius: radius.card,
    borderWidth: 1,
    borderColor: 'rgba(139,131,255,0.40)',
    padding: spacing.lg,
    shadowColor: colors.orange[500],
    shadowOffset: { width: 0, height: 8 },
    shadowOpacity: 0.35,
    shadowRadius: 24,
    elevation: 12,
  },
  levelUpBanner: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    backgroundColor: 'rgba(249,115,22,0.15)',
    borderRadius: radius.control,
    paddingVertical: 10,
    marginBottom: spacing.md,
    borderWidth: 1,
    borderColor: 'rgba(139,131,255,0.30)',
  },
  levelUpIcon: { fontSize: typeScale.title },
  levelUpText: {
    fontSize: typeScale.caption,
    fontWeight: weight.bold,
    color: colors.orange[400],
    letterSpacing: 2,
  },
  xpHeader: {
    flexDirection: 'row',
    alignItems: 'baseline',
    gap: 4,
    marginBottom: 8,
  },
  xpAmount: {
    fontSize: typeScale.figure,
    fontWeight: weight.bold,
    color: colors.orange[400],
    letterSpacing: -1,
  },
  xpLabel: {
    fontSize: typeScale.body,
    fontWeight: weight.bold,
    color: colors.orange[300],
    letterSpacing: 1,
  },
  breakdownRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    paddingVertical: 3,
  },
  breakdownReason: {
    fontSize: typeScale.caption,
    color: colors.text.secondary,
  },
  breakdownXP: {
    fontSize: typeScale.caption,
    fontWeight: weight.bold,
    color: colors.orange[400],
  },
  message: {
    fontSize: typeScale.caption,
    color: colors.text.muted,
    fontStyle: 'italic',
    marginTop: 10,
    lineHeight: 18,
  },
  badgeSection: {
    marginTop: spacing.md,
    paddingTop: spacing.md,
    borderTopWidth: 1,
    borderTopColor: 'rgba(255,255,255,0.06)',
  },
  badgeTitle: {
    fontSize: typeScale.micro,
    letterSpacing: 2,
    color: colors.orange[300],
    fontWeight: weight.bold,
    marginBottom: 8,
  },
  badgeRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    paddingVertical: 6,
  },
  badgeIcon: { fontSize: typeScale.stat },
  badgeName: {
    fontSize: typeScale.body,
    fontWeight: weight.bold,
    color: colors.text.primary,
  },
  badgeDesc: {
    fontSize: typeScale.label,
    color: colors.text.muted,
    marginTop: 1,
  },
})

// ── PB CELEBRATION (enhanced) ─────────────────────────────────────────
// Big animated celebration for personal bests
export function PBCelebration({
  visible,
  value,
  unit,
  metricLabel,
  improvement,
}: {
  visible: boolean
  value: string
  unit: string
  metricLabel: string
  improvement?: string // e.g. "+2.3cm" or "-0.04s"
}) {
  const scaleAnim = useRef(new Animated.Value(0)).current
  const glowAnim = useRef(new Animated.Value(0)).current
  const [show, setShow] = useState(false)

  useEffect(() => {
    if (visible) {
      setShow(true)
      // A PB is the single moment in this app worth a heavy haptic.
      celebrationFeedback()
      scaleAnim.setValue(0)
      glowAnim.setValue(0)

      Animated.parallel([
        Animated.spring(scaleAnim, { toValue: 1, useNativeDriver: false, friction: 4, tension: 60 }),
        Animated.loop(
          Animated.sequence([
            Animated.timing(glowAnim, { toValue: 1, duration: 800, useNativeDriver: false }),
            Animated.timing(glowAnim, { toValue: 0.3, duration: 800, useNativeDriver: false }),
          ]),
          { iterations: 3 }
        ),
      ]).start()

      const timer = setTimeout(() => {
        Animated.timing(scaleAnim, { toValue: 0, duration: 300, useNativeDriver: false }).start(() => setShow(false))
      }, 4500)
      return () => clearTimeout(timer)
    }
  }, [visible])

  if (!show) return null

  return (
    <Animated.View style={[
      pbStyles.wrap,
      {
        opacity: scaleAnim,
        transform: [{
          scale: scaleAnim.interpolate({ inputRange: [0, 1], outputRange: [0.3, 1] }),
        }],
      },
    ]}>
      {/* Pulsing glow ring */}
      <Animated.View style={[
        pbStyles.glowRing,
        { opacity: glowAnim, transform: [{ scale: glowAnim.interpolate({ inputRange: [0, 1], outputRange: [0.8, 1.2] }) }] },
      ]} />

      <Ionicons name="trophy" size={34} color={colors.accent[500]} />
      <Text style={pbStyles.title}>PERSONAL BEST</Text>
      <Text style={pbStyles.metricName}>{metricLabel}</Text>
      <Text style={pbStyles.value}>
        {value} <Text style={pbStyles.unit}>{unit}</Text>
      </Text>
      {improvement && (
        <View style={pbStyles.improvementChip}>
          <Text style={pbStyles.improvementText}>{improvement} improvement</Text>
        </View>
      )}
    </Animated.View>
  )
}

const pbStyles = StyleSheet.create({
  wrap: {
    alignItems: 'center',
    paddingVertical: spacing.xl,
    position: 'relative',
  },
  glowRing: {
    position: 'absolute',
    top: 0,
    width: 160,
    height: 160,
    borderRadius: radius.full,
    backgroundColor: colors.green,
    opacity: 0.1,
  },
  emoji: { fontSize: typeScale.mark, marginBottom: spacing.sm },
  title: {
    fontSize: typeScale.body,
    fontWeight: weight.bold,
    color: colors.green,
    letterSpacing: 4,
    marginBottom: 4,
  },
  metricName: {
    fontSize: typeScale.caption,
    color: colors.text.secondary,
    fontWeight: weight.medium,
    marginBottom: spacing.sm,
  },
  value: {
    fontSize: typeScale.hero,
    fontWeight: weight.bold,
    color: colors.text.primary,
  },
  unit: {
    fontSize: typeScale.body,
    fontWeight: weight.medium,
    color: colors.text.muted,
  },
  improvementChip: {
    marginTop: 10,
    backgroundColor: 'rgba(52,211,153,0.12)',
    borderRadius: radius.full,
    paddingHorizontal: 14,
    paddingVertical: 6,
    borderWidth: 1,
    borderColor: 'rgba(52,211,153,0.25)',
  },
  improvementText: {
    fontSize: typeScale.caption,
    fontWeight: weight.bold,
    color: colors.green,
    letterSpacing: 0.5,
  },
})
