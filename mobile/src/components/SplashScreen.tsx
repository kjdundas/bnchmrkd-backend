// ════════════════════════════��════════════════════════════��═════════════
// SPLASH SCREEN — Shown while auth state loads
// Minimal: just the logo with a subtle pulse animation
// ════════════════════��════════════════════════════════════════���═════════

import React, { useEffect, useRef } from 'react'
import { View, Text, StyleSheet, Animated } from 'react-native'
import { colors } from '../lib/theme'

export default function SplashScreen() {
  const pulseAnim = useRef(new Animated.Value(0.6)).current

  useEffect(() => {
    Animated.loop(
      Animated.sequence([
        Animated.timing(pulseAnim, { toValue: 1, duration: 1000, useNativeDriver: true }),
        Animated.timing(pulseAnim, { toValue: 0.6, duration: 1000, useNativeDriver: true }),
      ])
    ).start()
  }, [])

  return (
    <View style={styles.container}>
      <Animated.View style={{ opacity: pulseAnim }}>
        <Text style={styles.logo}>bnchmrkd.</Text>
      </Animated.View>
      <Text style={styles.tagline}>LOADING YOUR DATA</Text>
    </View>
  )
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: colors.bg.primary,
    alignItems: 'center',
    justifyContent: 'center',
  },
  logo: {
    fontSize: 38,
    fontWeight: '700',
    color: colors.orange[500],
    letterSpacing: -1,
  },
  tagline: {
    fontSize: 9,
    letterSpacing: 3,
    color: colors.text.dimmed,
    marginTop: 12,
    fontWeight: '600',
  },
})
